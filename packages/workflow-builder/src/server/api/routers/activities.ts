/**
 * Activities router - CRUD operations and discovery for activities
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { createActivityRegistry } from '@/lib/activities/activity-registry';

export const activitiesRouter = createTRPCRouter({
  /**
   * List all activities with optional filters
   */
  list: protectedProcedure
    .input(z.object({
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      search: z.string().optional(),
      includeDeprecated: z.boolean().optional().default(false),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        const activities = await registry.listActivities(input);
        return activities;
      } catch (error) {
        console.error('Error listing activities:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list activities',
        });
      }
    }),

  /**
   * Get activity details by name
   */
  get: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ ctx, input }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        const activity = await registry.getActivity(input.name);

        if (!activity) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Activity '${input.name}' not found`,
          });
        }

        return activity;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Error getting activity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get activity',
        });
      }
    }),

  /**
   * Get activity by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        const activity = await registry.getActivityById(input.id);

        if (!activity) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Activity with ID '${input.id}' not found`,
          });
        }

        return activity;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Error getting activity by ID:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get activity',
        });
      }
    }),

  /**
   * Get all activity categories
   */
  categories: publicProcedure
    .query(async ({ ctx }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        const categories = await registry.getCategoryDetails();
        return categories;
      } catch (error) {
        console.error('Error getting categories:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get categories',
        });
      }
    }),

  /**
   * Register a new activity
   */
  register: protectedProcedure
    .input(z.object({
      name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid activity name format'),
      description: z.string().optional(),
      inputSchema: z.any(),
      outputSchema: z.any().optional(),
      packageName: z.string(),
      modulePath: z.string(),
      functionName: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid function name format'),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      examples: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        const activity = await registry.registerActivity({
          ...input,
          createdBy: ctx.user.id,
        });

        return activity;
      } catch (error: any) {
        console.error('Error registering activity:', error);

        // Handle unique constraint violation
        if (error.code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `Activity '${input.name}' already exists`,
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to register activity',
        });
      }
    }),

  /**
   * Discover activities from a package
   */
  discover: protectedProcedure
    .input(z.object({
      packagePath: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        const activities = await registry.discoverActivities(
          input.packagePath,
          ctx.user.id
        );

        return {
          discovered: activities.length,
          activities,
        };
      } catch (error) {
        console.error('Error discovering activities:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to discover activities',
        });
      }
    }),

  /**
   * Track activity usage
   */
  trackUsage: protectedProcedure
    .input(z.object({
      name: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        await registry.trackUsage(input.name);
        return { success: true };
      } catch (error) {
        console.error('Error tracking activity usage:', error);
        // Don't throw - usage tracking is non-critical
        return { success: false };
      }
    }),

  /**
   * Deprecate an activity
   */
  deprecate: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      message: z.string().optional(),
      migrateToActivityId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        // Verify ownership or admin role
        const activity = await registry.getActivityById(input.id);

        if (!activity) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Activity not found',
          });
        }

        if (activity.created_by !== ctx.user.id) {
          // Check if user is admin
          const { data: userRole } = await ctx.supabase
            .from('user_roles')
            .select('name')
            .eq('id', ctx.user.role_id)
            .single();

          if (!userRole || userRole.name !== 'admin') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Not authorized to deprecate this activity',
            });
          }
        }

        const deprecated = await registry.deprecateActivity(
          input.id,
          input.message,
          input.migrateToActivityId
        );

        return deprecated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Error deprecating activity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to deprecate activity',
        });
      }
    }),

  /**
   * Deactivate an activity (soft delete)
   */
  deactivate: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        // Verify ownership or admin role
        const activity = await registry.getActivityById(input.id);

        if (!activity) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Activity not found',
          });
        }

        if (activity.created_by !== ctx.user.id) {
          // Check if user is admin
          const { data: userRole } = await ctx.supabase
            .from('user_roles')
            .select('name')
            .eq('id', ctx.user.role_id)
            .single();

          if (!userRole || userRole.name !== 'admin') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'Not authorized to deactivate this activity',
            });
          }
        }

        const deactivated = await registry.deactivateActivity(input.id);
        return deactivated;
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Error deactivating activity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to deactivate activity',
        });
      }
    }),

  /**
   * Get activity usage statistics
   */
  usageStats: protectedProcedure
    .query(async ({ ctx }) => {
      const registry = createActivityRegistry(ctx.supabase);

      try {
        const stats = await registry.getUsageStats();
        return stats;
      } catch (error) {
        console.error('Error getting usage stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get usage statistics',
        });
      }
    }),
});
