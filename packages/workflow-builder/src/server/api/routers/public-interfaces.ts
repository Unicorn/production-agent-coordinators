/**
 * Public Interfaces router - Manage public interfaces exposed via Kong API gateway
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

const httpMethodSchema = z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']);
const authTypeSchema = z.enum(['api_key', 'oauth2', 'jwt', 'none']);

export const publicInterfacesRouter = createTRPCRouter({
  // List public interfaces
  list: protectedProcedure
    .input(z.object({
      serviceId: z.string().uuid().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('public_interfaces')
        .select(`
          *,
          service_interface:service_interfaces(
            id,
            name,
            display_name,
            interface_type,
            service:workflows(id, name, service_display_name, created_by)
          )
        `);

      if (input?.serviceId) {
        query = query.eq('service_interface.service_id', input.serviceId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      // Filter by ownership (RLS should handle this, but double-check)
      const filtered = (data || []).filter((pi: any) => 
        pi.service_interface?.service?.created_by === ctx.user.id
      );

      return filtered;
    }),

  // Get public interface by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('public_interfaces')
        .select(`
          *,
          service_interface:service_interfaces(
            id,
            name,
            display_name,
            interface_type,
            temporal_callable_name,
            payload_schema,
            return_schema,
            service:workflows(id, name, service_display_name, created_by)
          )
        `)
        .eq('id', input.id)
        .single();

      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Public interface not found',
        });
      }

      // Verify ownership
      if (data.service_interface?.service?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this public interface',
        });
      }

      return data;
    }),

  // Create public interface (auto-creates Kong route)
  create: protectedProcedure
    .input(z.object({
      serviceInterfaceId: z.string().uuid(),
      httpMethod: httpMethodSchema,
      httpPath: z.string().min(1).max(500),
      authType: authTypeSchema.default('api_key'),
      authConfig: z.record(z.any()).optional(),
      rateLimitPerMinute: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify user owns the service interface
      const { data: serviceInterface, error: siError } = await ctx.supabase
        .from('service_interfaces')
        .select(`
          id,
          is_public,
          service:workflows(id, created_by)
        `)
        .eq('id', input.serviceInterfaceId)
        .single();

      if (siError || !serviceInterface) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Service interface not found',
        });
      }

      if (serviceInterface.service?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this service interface',
        });
      }

      // TODO: Create Kong route here
      // For now, we'll just create the database record
      // In production, this should call Kong API to create the route
      const kongRouteId = `kong-route-${Date.now()}`; // Placeholder

      const { data, error } = await ctx.supabase
        .from('public_interfaces')
        .insert({
          service_interface_id: input.serviceInterfaceId,
          kong_route_id: kongRouteId,
          http_method: input.httpMethod,
          http_path: input.httpPath,
          auth_type: input.authType,
          auth_config: input.authConfig,
          rate_limit_per_minute: input.rateLimitPerMinute,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      // Update service interface to mark as public if not already
      if (!serviceInterface.is_public) {
        await ctx.supabase
          .from('service_interfaces')
          .update({ is_public: true })
          .eq('id', input.serviceInterfaceId);
      }

      return data;
    }),

  // Update public interface
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      httpMethod: httpMethodSchema.optional(),
      httpPath: z.string().min(1).max(500).optional(),
      authType: authTypeSchema.optional(),
      authConfig: z.record(z.any()).optional(),
      rateLimitPerMinute: z.number().int().positive().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get and verify ownership
      const { data: publicInterface, error: getError } = await ctx.supabase
        .from('public_interfaces')
        .select(`
          id,
          service_interface:service_interfaces(
            service:workflows(id, created_by)
          )
        `)
        .eq('id', input.id)
        .single();

      if (getError || !publicInterface) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Public interface not found',
        });
      }

      if (publicInterface.service_interface?.service?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this public interface',
        });
      }

      const updateData: Record<string, any> = {};
      if (input.httpMethod !== undefined) updateData.http_method = input.httpMethod;
      if (input.httpPath !== undefined) updateData.http_path = input.httpPath;
      if (input.authType !== undefined) updateData.auth_type = input.authType;
      if (input.authConfig !== undefined) updateData.auth_config = input.authConfig;
      if (input.rateLimitPerMinute !== undefined) {
        updateData.rate_limit_per_minute = input.rateLimitPerMinute;
      }

      // TODO: Update Kong route here

      const { data, error } = await ctx.supabase
        .from('public_interfaces')
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

  // Delete public interface (and Kong route)
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get and verify ownership
      const { data: publicInterface, error: getError } = await ctx.supabase
        .from('public_interfaces')
        .select(`
          id,
          kong_route_id,
          service_interface:service_interfaces(
            id,
            service:workflows(id, created_by)
          )
        `)
        .eq('id', input.id)
        .single();

      if (getError || !publicInterface) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Public interface not found',
        });
      }

      if (publicInterface.service_interface?.service?.created_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this public interface',
        });
      }

      // TODO: Delete Kong route here
      // if (publicInterface.kong_route_id) {
      //   await deleteKongRoute(publicInterface.kong_route_id);
      // }

      const { error } = await ctx.supabase
        .from('public_interfaces')
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
});

