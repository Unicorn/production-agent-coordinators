/**
 * Project Connections API Router
 * 
 * Manages project-level database and service connections
 * (PostgreSQL, Redis, etc.)
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const connectionsRouter = createTRPCRouter({
  /**
   * List connections for a project
   */
  list: protectedProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify project belongs to user
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('id')
        .eq('id', input.projectId)
        .eq('created_by', ctx.user.id)
        .single();

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      const { data, error } = await ctx.supabase
        .from('project_connections')
        .select('*')
        .eq('project_id', input.projectId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return {
        connections: data?.map(conn => ({
          id: conn.id,
          projectId: conn.project_id,
          connectionType: conn.connection_type,
          name: conn.name,
          connectionUrl: conn.connection_url, // Note: In production, this should be encrypted/decrypted
          config: conn.config,
          createdAt: new Date(conn.created_at),
          updatedAt: new Date(conn.updated_at),
        })) || [],
      };
    }),

  /**
   * Create a new connection
   */
  create: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      connectionType: z.enum(['postgresql', 'redis']),
      name: z.string().min(1),
      connectionUrl: z.string().min(1),
      config: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify project belongs to user
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('id')
        .eq('id', input.projectId)
        .eq('created_by', ctx.user.id)
        .single();

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      // Check if connection name already exists
      const { data: existing } = await ctx.supabase
        .from('project_connections')
        .select('id')
        .eq('project_id', input.projectId)
        .eq('name', input.name)
        .single();

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Connection with this name already exists',
        });
      }

      const { data, error } = await ctx.supabase
        .from('project_connections')
        .insert({
          project_id: input.projectId,
          connection_type: input.connectionType,
          name: input.name,
          connection_url: input.connectionUrl,
          config: input.config || {},
          created_by: ctx.user.id,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return {
        id: data.id,
        projectId: data.project_id,
        connectionType: data.connection_type,
        name: data.name,
        connectionUrl: data.connection_url,
        config: data.config,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    }),

  /**
   * Update a connection
   */
  update: protectedProcedure
    .input(z.object({
      connectionId: z.string(),
      name: z.string().min(1).optional(),
      connectionUrl: z.string().min(1).optional(),
      config: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { connectionId, ...updates } = input;

      // Verify connection belongs to user's project
      const { data: connection } = await ctx.supabase
        .from('project_connections')
        .select('project_id, projects!inner(created_by)')
        .eq('id', connectionId)
        .single();

      if (!connection || (connection.projects as any).created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      // If updating name, check for conflicts
      if (updates.name) {
        const { data: existing } = await ctx.supabase
          .from('project_connections')
          .select('id')
          .eq('project_id', (connection as any).project_id)
          .eq('name', updates.name)
          .neq('id', connectionId)
          .single();

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Connection with this name already exists',
          });
        }
      }

      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.connectionUrl) updateData.connection_url = updates.connectionUrl;
      if (updates.config !== undefined) updateData.config = updates.config;

      const { data, error } = await ctx.supabase
        .from('project_connections')
        .update(updateData)
        .eq('id', connectionId)
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return {
        id: data.id,
        projectId: data.project_id,
        connectionType: data.connection_type,
        name: data.name,
        connectionUrl: data.connection_url,
        config: data.config,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    }),

  /**
   * Delete a connection
   */
  delete: protectedProcedure
    .input(z.object({
      connectionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify connection belongs to user's project
      const { data: connection } = await ctx.supabase
        .from('project_connections')
        .select('project_id, projects!inner(created_by)')
        .eq('id', input.connectionId)
        .single();

      if (!connection || (connection.projects as any).created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      const { error } = await ctx.supabase
        .from('project_connections')
        .delete()
        .eq('id', input.connectionId);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return { success: true };
    }),

  /**
   * Test connection connectivity
   */
  test: protectedProcedure
    .input(z.object({
      connectionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify connection belongs to user's project
      const { data: connection } = await ctx.supabase
        .from('project_connections')
        .select('*')
        .eq('id', input.connectionId)
        .single();

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Connection not found',
        });
      }

      // Verify project ownership
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('id')
        .eq('id', connection.project_id)
        .eq('created_by', ctx.user.id)
        .single();

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      // Test connection based on type
      try {
        if (connection.connection_type === 'postgresql') {
          // Test PostgreSQL connection
          const { testPostgresConnection } = await import('@/lib/connections/postgresql');
          const result = await testPostgresConnection(connection.connection_url);
          return {
            success: result.success,
            message: result.message,
            error: result.error,
          };
        } else if (connection.connection_type === 'redis') {
          // Test Redis connection
          const { testRedisConnection } = await import('@/lib/connections/redis');
          const result = await testRedisConnection(connection.connection_url);
          return {
            success: result.success,
            message: result.message,
            error: result.error,
          };
        } else {
          return {
            success: false,
            message: 'Unknown connection type',
            error: `Unsupported connection type: ${connection.connection_type}`,
          };
        }
      } catch (error: any) {
        return {
          success: false,
          message: 'Connection test failed',
          error: error.message || 'Unknown error',
        };
      }
    }),
});

