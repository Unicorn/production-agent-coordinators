/**
 * Workflows router - CRUD and deployment operations
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const workflowsRouter = createTRPCRouter({
  // List workflows
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      // Get public visibility ID
      const { data: publicVisibility } = await ctx.supabase
        .from('component_visibility')
        .select('id')
        .eq('name', 'public')
        .single();
      
      let query = ctx.supabase
        .from('workflows')
        .select(`
          *,
          status:workflow_statuses(id, name, color),
          task_queue:task_queues(id, name),
          created_by_user:users!workflows_created_by_fkey(id, display_name)
        `, { count: 'exact' });
      
      // User can only see their own workflows or public ones
      if (publicVisibility) {
        query = query.or(`created_by.eq.${ctx.user.id},visibility_id.eq.${publicVisibility.id}`);
      } else {
        // If no public visibility, only show user's own workflows
        query = query.eq('created_by', ctx.user.id);
      }
      
      if (input.status) {
        const { data: statusData } = await ctx.supabase
          .from('workflow_statuses')
          .select('id')
          .eq('name', input.status)
          .single();
        
        if (statusData) {
          query = query.eq('status_id', statusData.id);
        }
      }
      
      const from = (input.page - 1) * input.pageSize;
      const to = from + input.pageSize - 1;
      
      const { data, error, count } = await query
        .range(from, to)
        .order('updated_at', { ascending: false });
      
      if (error) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: error.message 
        });
      }
      
      return {
        workflows: data || [],
        total: count || 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count || 0) / input.pageSize),
      };
    }),

  // Get workflow by ID
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('workflows')
        .select(`
          *,
          status:workflow_statuses(id, name, color, description),
          task_queue:task_queues(id, name, description),
          created_by_user:users!workflows_created_by_fkey(id, display_name, email),
          visibility:component_visibility(id, name),
          nodes:workflow_nodes(*),
          edges:workflow_edges(*)
        `)
        .eq('id', input.id)
        .single();
      
      if (error) {
        throw new TRPCError({ 
          code: 'NOT_FOUND', 
          message: 'Workflow not found' 
        });
      }
      
      // Check access
      const { data: publicVisibility } = await ctx.supabase
        .from('component_visibility')
        .select('id')
        .eq('name', 'public')
        .single();
      
      if (data.created_by !== ctx.user.id && data.visibility_id !== publicVisibility?.id) {
        throw new TRPCError({ 
          code: 'FORBIDDEN', 
          message: 'Not authorized to view this workflow' 
        });
      }
      
      return { workflow: data };
    }),

  // Create workflow
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      displayName: z.string().min(1).max(255),
      description: z.string().optional(),
      visibility: z.enum(['public', 'private', 'organization']),
      taskQueueId: z.string().uuid(),
      definition: z.any().optional(), // React Flow JSON
    }))
    .mutation(async ({ ctx, input }) => {
      // Get status ID for 'draft'
      const { data: status } = await ctx.supabase
        .from('workflow_statuses')
        .select('id')
        .eq('name', 'draft')
        .single();
      
      if (!status) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Draft status not found' 
        });
      }
      
      // Get visibility ID
      const { data: visibility } = await ctx.supabase
        .from('component_visibility')
        .select('id')
        .eq('name', input.visibility)
        .single();
      
      if (!visibility) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Invalid visibility' 
        });
      }
      
      // Check for duplicate name
      const { data: existing } = await ctx.supabase
        .from('workflows')
        .select('id')
        .eq('name', input.name)
        .eq('created_by', ctx.user.id)
        .single();
      
      if (existing) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Workflow with this name already exists' 
        });
      }
      
      // Create workflow
      const { data: workflow, error } = await ctx.supabase
        .from('workflows')
        .insert({
          name: input.name,
          display_name: input.displayName,
          description: input.description,
          created_by: ctx.user.id,
          visibility_id: visibility.id,
          status_id: status.id,
          task_queue_id: input.taskQueueId,
          definition: input.definition || { nodes: [], edges: [] },
        })
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: error.message 
        });
      }
      
      return workflow;
    }),

  // Update workflow
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      displayName: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      definition: z.any().optional(),
      taskQueueId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      
      // Check ownership
      const { data: workflow } = await ctx.supabase
        .from('workflows')
        .select('created_by')
        .eq('id', id)
        .single();
      
      if (!workflow || workflow.created_by !== ctx.user.id) {
        throw new TRPCError({ 
          code: 'FORBIDDEN', 
          message: 'Not authorized to update this workflow' 
        });
      }
      
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.definition !== undefined) updateData.definition = updates.definition;
      if (updates.taskQueueId !== undefined) updateData.task_queue_id = updates.taskQueueId;
      
      const { data, error } = await ctx.supabase
        .from('workflows')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: error.message 
        });
      }
      
      return data;
    }),

  // Deploy workflow (change status to active)
  deploy: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get workflow
      const { data: workflow } = await ctx.supabase
        .from('workflows')
        .select('*')
        .eq('id', input.id)
        .single();
      
      if (!workflow || workflow.created_by !== ctx.user.id) {
        throw new TRPCError({ 
          code: 'FORBIDDEN', 
          message: 'Not authorized to deploy this workflow' 
        });
      }
      
      // Validate workflow has nodes
      if (!workflow.definition || 
          typeof workflow.definition !== 'object' ||
          !('nodes' in workflow.definition) ||
          !Array.isArray((workflow.definition as any).nodes) ||
          (workflow.definition as any).nodes.length === 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Cannot deploy empty workflow' 
        });
      }
      
      // Get active status
      const { data: activeStatus } = await ctx.supabase
        .from('workflow_statuses')
        .select('id')
        .eq('name', 'active')
        .single();
      
      if (!activeStatus) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Active status not found' 
        });
      }
      
      // TODO: Generate TypeScript code (Phase 4)
      // TODO: Register with Temporal (Phase 4)
      
      // Update status
      const { data, error } = await ctx.supabase
        .from('workflows')
        .update({
          status_id: activeStatus.id,
          temporal_workflow_id: `${workflow.name}-${Date.now()}`,
          temporal_workflow_type: workflow.name,
          deployed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: error.message 
        });
      }
      
      return data;
    }),

  // Pause workflow
  pause: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: pausedStatus } = await ctx.supabase
        .from('workflow_statuses')
        .select('id')
        .eq('name', 'paused')
        .single();
      
      if (!pausedStatus) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: 'Paused status not found' 
        });
      }
      
      const { data, error } = await ctx.supabase
        .from('workflows')
        .update({
          status_id: pausedStatus.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('created_by', ctx.user.id)
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: error.message 
        });
      }
      
      return data;
    }),

  // Delete workflow
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const { data: workflow } = await ctx.supabase
        .from('workflows')
        .select('created_by')
        .eq('id', input.id)
        .single();
      
      if (!workflow || workflow.created_by !== ctx.user.id) {
        throw new TRPCError({ 
          code: 'FORBIDDEN', 
          message: 'Not authorized to delete this workflow' 
        });
      }
      
      // Check if workflow has executions
      const { count } = await ctx.supabase
        .from('workflow_executions')
        .select('*', { count: 'exact', head: true })
        .eq('workflow_id', input.id);
      
      if (count && count > 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Workflow has ${count} execution(s). Archive it instead of deleting.` 
        });
      }
      
      const { error } = await ctx.supabase
        .from('workflows')
        .delete()
        .eq('id', input.id);
      
      if (error) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: error.message 
        });
      }
      
      return { success: true };
    }),

  // Get workflow statuses (for dropdowns)
  getStatuses: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('workflow_statuses')
        .select('*')
        .order('name');
      
      if (error) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: error.message 
        });
      }
      
      return data;
    }),
});

