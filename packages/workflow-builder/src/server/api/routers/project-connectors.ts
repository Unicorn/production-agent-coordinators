/**
 * Project Connectors router - Manage connectors for cross-project communication
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

const visibilitySchema = z.enum(['private', 'public', 'organization']);

export const projectConnectorsRouter = createTRPCRouter({
  // List connectors for a project
  list: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      source: z.boolean().default(true), // true = connectors FROM this project, false = connectors TO this project
    }))
    .query(async ({ ctx, input }) => {
      // Verify user owns the project
      const { data: project, error: projectError } = await ctx.supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', input.projectId)
        .single();

      if (projectError || !project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      if (project.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        });
      }

      let query = ctx.supabase
        .from('project_connectors')
        .select(`
          *,
          source_project:projects!project_connectors_source_project_id_fkey(id, name),
          target_project:projects!project_connectors_target_project_id_fkey(id, name),
          target_service:workflows(id, name, service_display_name),
          target_interface:service_interfaces(id, name, display_name, interface_type)
        `);

      if (input.source) {
        query = query.eq('source_project_id', input.projectId);
      } else {
        query = query.eq('target_project_id', input.projectId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return data || [];
    }),

  // Get connector by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('project_connectors')
        .select(`
          *,
          source_project:projects!project_connectors_source_project_id_fkey(id, name, created_by),
          target_project:projects!project_connectors_target_project_id_fkey(id, name),
          target_service:workflows(id, name, service_display_name),
          target_interface:service_interfaces(id, name, display_name, interface_type, temporal_callable_name)
        `)
        .eq('id', input.id)
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project connector not found',
        });
      }

      // Verify ownership
      if (data.source_project?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this project connector',
        });
      }

      return data;
    }),

  // Create new project connector
  create: protectedProcedure
    .input(z.object({
      sourceProjectId: z.string().uuid(),
      targetProjectId: z.string().uuid(),
      targetServiceId: z.string().uuid(),
      targetInterfaceId: z.string().uuid(),
      name: z.string().min(1).max(255),
      displayName: z.string().min(1).max(255),
      description: z.string().optional(),
      nexusEndpointName: z.string().min(1).max(255),
      visibility: visibilitySchema.default('private'),
      authConfig: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the source project
      const { data: sourceProject, error: sourceError } = await ctx.supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', input.sourceProjectId)
        .single();

      if (sourceError || !sourceProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Source project not found',
        });
      }

      if (sourceProject.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to the source project',
        });
      }

      // Verify target service and interface exist
      const { data: targetInterface, error: targetError } = await ctx.supabase
        .from('service_interfaces')
        .select(`
          id,
          service_id,
          service:workflows(id, project_id)
        `)
        .eq('id', input.targetInterfaceId)
        .single();

      if (targetError || !targetInterface) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Target interface not found',
        });
      }

      if (targetInterface.service_id !== input.targetServiceId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Target interface does not belong to the specified service',
        });
      }

      if (targetInterface.service?.project_id !== input.targetProjectId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Target service does not belong to the specified project',
        });
      }

      // TODO: Create Temporal Nexus endpoint here
      // For now, we'll just create the database record

      const { data, error } = await ctx.supabase
        .from('project_connectors')
        .insert({
          source_project_id: input.sourceProjectId,
          target_project_id: input.targetProjectId,
          target_service_id: input.targetServiceId,
          target_interface_id: input.targetInterfaceId,
          name: input.name,
          display_name: input.displayName,
          description: input.description,
          nexus_endpoint_name: input.nexusEndpointName,
          visibility: input.visibility,
          auth_config: input.authConfig,
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

      return data;
    }),

  // Update project connector
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      displayName: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      visibility: visibilitySchema.optional(),
      authConfig: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get and verify ownership
      const { data: connector, error: getError } = await ctx.supabase
        .from('project_connectors')
        .select(`
          id,
          source_project:projects!project_connectors_source_project_id_fkey(id, created_by)
        `)
        .eq('id', input.id)
        .single();

      if (getError || !connector) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project connector not found',
        });
      }

      if (connector.source_project?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this project connector',
        });
      }

      const updateData: Record<string, any> = {};
      if (input.displayName !== undefined) updateData.display_name = input.displayName;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.visibility !== undefined) updateData.visibility = input.visibility;
      if (input.authConfig !== undefined) updateData.auth_config = input.authConfig;

      const { data, error } = await ctx.supabase
        .from('project_connectors')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return data;
    }),

  // Delete project connector
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get and verify ownership
      const { data: connector, error: getError } = await ctx.supabase
        .from('project_connectors')
        .select(`
          id,
          nexus_endpoint_name,
          source_project:projects!project_connectors_source_project_id_fkey(id, created_by)
        `)
        .eq('id', input.id)
        .single();

      if (getError || !connector) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project connector not found',
        });
      }

      if (connector.source_project?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this project connector',
        });
      }

      // TODO: Delete Temporal Nexus endpoint here
      // if (connector.nexus_endpoint_name) {
      //   await deleteNexusEndpoint(connector.nexus_endpoint_name);
      // }

      const { error } = await ctx.supabase
        .from('project_connectors')
        .delete()
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return { success: true };
    }),

  // Get connectors by source project
  getBySourceProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const { data: project, error: projectError } = await ctx.supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', input.projectId)
        .single();

      if (projectError || !project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      if (project.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        });
      }

      const { data, error } = await ctx.supabase
        .from('project_connectors')
        .select(`
          *,
          target_project:projects!project_connectors_target_project_id_fkey(id, name),
          target_service:workflows(id, name, service_display_name),
          target_interface:service_interfaces(id, name, display_name)
        `)
        .eq('source_project_id', input.projectId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return data || [];
    }),

  // Get connectors by target project
  getByTargetProject: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify ownership (user should own target project to see incoming connectors)
      const { data: project, error: projectError } = await ctx.supabase
        .from('projects')
        .select('id, created_by')
        .eq('id', input.projectId)
        .single();

      if (projectError || !project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }

      if (project.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this project',
        });
      }

      const { data, error } = await ctx.supabase
        .from('project_connectors')
        .select(`
          *,
          source_project:projects!project_connectors_source_project_id_fkey(id, name),
          target_service:workflows(id, name, service_display_name),
          target_interface:service_interfaces(id, name, display_name)
        `)
        .eq('target_project_id', input.projectId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return data || [];
    }),
});

