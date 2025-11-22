/**
 * Service Interfaces router - Manage service interfaces for inter-service communication
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

const interfaceTypeSchema = z.enum(['signal', 'query', 'update', 'start_child']);

export const serviceInterfacesRouter = createTRPCRouter({
  // List interfaces for a service
  list: protectedProcedure
    .input(z.object({
      serviceId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user owns the service
      const { data: service, error: serviceError } = await ctx.supabase
        .from('workflows')
        .select('id, created_by')
        .eq('id', input.serviceId)
        .single();

      if (serviceError || !service) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service not found',
        });
      }

      if (service.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this service',
        });
      }

      const { data, error } = await ctx.supabase
        .from('service_interfaces')
        .select(`
          *,
          activity_connection:components(id, name, display_name)
        `)
        .eq('service_id', input.serviceId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return data || [];
    }),

  // Get interface by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('service_interfaces')
        .select(`
          *,
          service:workflows(id, name, service_display_name, created_by),
          activity_connection:components(id, name, display_name)
        `)
        .eq('id', input.id)
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service interface not found',
        });
      }

      // Verify user owns the service
      if (data.service?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this service interface',
        });
      }

      return data;
    }),

  // Create new interface
  create: protectedProcedure
    .input(z.object({
      serviceId: z.string().uuid(),
      name: z.string().min(1).max(255),
      displayName: z.string().min(1).max(255),
      description: z.string().optional(),
      interfaceType: interfaceTypeSchema,
      temporalCallableName: z.string().min(1).max(255),
      payloadSchema: z.record(z.any()),
      returnSchema: z.record(z.any()).optional(),
      activityConnectionId: z.string().uuid().optional(),
      isPublic: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the service
      const { data: service, error: serviceError } = await ctx.supabase
        .from('workflows')
        .select('id, created_by')
        .eq('id', input.serviceId)
        .single();

      if (serviceError || !service) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service not found',
        });
      }

      if (service.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this service',
        });
      }

      const { data, error } = await ctx.supabase
        .from('service_interfaces')
        .insert({
          service_id: input.serviceId,
          name: input.name,
          display_name: input.displayName,
          description: input.description,
          interface_type: input.interfaceType,
          temporal_callable_name: input.temporalCallableName,
          payload_schema: input.payloadSchema,
          return_schema: input.returnSchema,
          activity_connection_id: input.activityConnectionId,
          is_public: input.isPublic,
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

  // Update interface
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      displayName: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      payloadSchema: z.record(z.any()).optional(),
      returnSchema: z.record(z.any()).optional(),
      activityConnectionId: z.string().uuid().optional().nullable(),
      isPublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get interface and verify ownership
      const { data: interface, error: getError } = await ctx.supabase
        .from('service_interfaces')
        .select(`
          id,
          service:workflows(id, created_by)
        `)
        .eq('id', input.id)
        .single();

      if (getError || !interface) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service interface not found',
        });
      }

      if (interface.service?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this service interface',
        });
      }

      const updateData: Record<string, any> = {};
      if (input.displayName !== undefined) updateData.display_name = input.displayName;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.payloadSchema !== undefined) updateData.payload_schema = input.payloadSchema;
      if (input.returnSchema !== undefined) updateData.return_schema = input.returnSchema;
      if (input.activityConnectionId !== undefined) {
        updateData.activity_connection_id = input.activityConnectionId;
      }
      if (input.isPublic !== undefined) updateData.is_public = input.isPublic;

      const { data, error } = await ctx.supabase
        .from('service_interfaces')
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

  // Delete interface
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get interface and verify ownership
      const { data: interface, error: getError } = await ctx.supabase
        .from('service_interfaces')
        .select(`
          id,
          service:workflows(id, created_by)
        `)
        .eq('id', input.id)
        .single();

      if (getError || !interface) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service interface not found',
        });
      }

      if (interface.service?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this service interface',
        });
      }

      const { error } = await ctx.supabase
        .from('service_interfaces')
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

  // Get interfaces by service
  getByService: protectedProcedure
    .input(z.object({ serviceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify user owns the service
      const { data: service, error: serviceError } = await ctx.supabase
        .from('workflows')
        .select('id, created_by')
        .eq('id', input.serviceId)
        .single();

      if (serviceError || !service) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service not found',
        });
      }

      if (service.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this service',
        });
      }

      const { data, error } = await ctx.supabase
        .from('service_interfaces')
        .select(`
          *,
          activity_connection:components(id, name, display_name)
        `)
        .eq('service_id', input.serviceId)
        .order('interface_type')
        .order('name');

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return data || [];
    }),
});

