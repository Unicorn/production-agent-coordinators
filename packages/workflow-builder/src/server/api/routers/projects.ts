/**
 * Projects tRPC Router
 * 
 * Projects group workflows and define task queues.
 * Each user+project tuple maps to a unique task queue for Temporal workers.
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const projectsRouter = createTRPCRouter({
  /**
   * List user's projects
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const userRecord = await ctx.getUserRecord();
    
    console.log('📋 [Projects List] Fetching projects for user:', userRecord.id);
    
    const { data, error } = await ctx.supabase
      .from('projects')
      .select(`
        *,
        workflow_count:workflows(count),
        active_workers:workflow_workers(id, status, last_heartbeat)
      `)
      .eq('created_by', userRecord.id)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('❌ [Projects List] Error:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to list projects',
      });
    }
    
    console.log('✅ [Projects List] Found', data?.length || 0, 'projects');
    
    return { projects: data || [] };
  }),
  
  /**
   * Get project by ID with full details
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      const { data, error } = await ctx.supabase
        .from('projects')
        .select(`
          *,
          workflows:workflows(id, name, display_name, status_id),
          workers:workflow_workers(id, worker_id, status, last_heartbeat, started_at)
        `)
        .eq('id', input.id)
        .eq('created_by', userRecord.id)
        .single();
      
      if (error || !data) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }
      
      return { project: data };
    }),
  
  /**
   * Create new project
   * Automatically generates task queue name: {user_id}-{project_id}
   */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      // Generate kebab-case from project name
      const projectKebab = input.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      // Generate task queue name
      // Format: {userId_prefix}-{project-kebab-name}-queue
      const userIdPrefix = userRecord.id.split('-')[0];
      const taskQueueName = `${userIdPrefix}-${projectKebab}-queue`;
      
      // Create project
      const { data: project, error: projectError } = await ctx.supabase
        .from('projects')
        .insert({
          name: input.name,
          description: input.description || null,
          created_by: userRecord.id,
          task_queue_name: taskQueueName,
          is_active: true,
        })
        .select()
        .single();
      
      if (projectError) {
        console.error('❌ [Project Creation] Error:', {
          code: projectError.code,
          message: projectError.message,
          details: projectError.details,
          hint: projectError.hint,
        });
        
        if (projectError.code === '23505') { // Unique violation
          // Check which constraint was violated
          const errorMessage = projectError.message || '';
          if (errorMessage.includes('unique_user_project_name')) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'You already have a project with this name. Please choose a different name.',
            });
          } else if (errorMessage.includes('task_queue_name')) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: 'Task queue name conflict. Please try again or contact support.',
            });
          } else {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `Project already exists: ${errorMessage}`,
            });
          }
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create project: ${projectError.message}`,
        });
      }
      
      // Auto-create default task queue for the project
      const { data: taskQueue, error: queueError } = await ctx.supabase
        .from('task_queues')
        .insert({
          name: taskQueueName,
          display_name: `${input.name} Task Queue`,
          description: `Default task queue for ${input.name} project`,
          created_by: userRecord.id,
        })
        .select()
        .single();
      
      if (queueError || !taskQueue) {
        console.error('Error creating task queue:', queueError);
        // If task queue creation fails, delete the project and fail
        await ctx.supabase
          .from('projects')
          .delete()
          .eq('id', project.id);
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create project task queue',
        });
      }
      
      console.log('✅ [Project Created]', { projectId: project.id, queueId: taskQueue.id, queueName: taskQueueName });
      
      return { 
        project,
        taskQueue,
      };
    }),
  
  /**
   * Update project
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      is_active: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      const { id, ...updates } = input;
      
      const { data, error } = await ctx.supabase
        .from('projects')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('created_by', userRecord.id)
        .select()
        .single();
      
      if (error || !data) {
        if (error?.code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'A project with this name already exists',
          });
        }
        
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }
      
      return { project: data };
    }),
  
  /**
   * Archive project (replaces delete)
   * Archives all workflows in the project as well
   */
  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      // Check if project exists and user owns it
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('id, created_by, is_default, is_archived')
        .eq('id', input.id)
        .single();
      
      if (!project || project.created_by !== userRecord.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to archive this project',
        });
      }
      
      // Prevent archiving default project
      if (project.is_default) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot archive default project. You can rename it, but not archive it.',
        });
      }
      
      if (project.is_archived) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Project is already archived',
        });
      }
      
      // First check if any workers are running
      const { data: workers } = await ctx.supabase
        .from('workflow_workers')
        .select('id, status')
        .eq('project_id', input.id)
        .in('status', ['starting', 'running']);
      
      if (workers && workers.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cannot archive project with running workers. Stop all workers first.',
        });
      }
      
      // Archive all workflows in the project
      await ctx.supabase
        .from('workflows')
        .update({ 
          is_archived: true,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', input.id)
        .eq('is_archived', false);
      
      // Archive the project
      const { error } = await ctx.supabase
        .from('projects')
        .update({ 
          is_archived: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.id);
      
      if (error) {
        console.error('Error archiving project:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to archive project',
        });
      }
      
      return { success: true };
    }),

  /**
   * Unarchive project
   */
  unarchive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      // Check if project exists and user owns it
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('id, created_by, is_archived')
        .eq('id', input.id)
        .single();
      
      if (!project || project.created_by !== userRecord.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to unarchive this project',
        });
      }
      
      if (!project.is_archived) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Project is not archived',
        });
      }
      
      // Unarchive the project
      const { error } = await ctx.supabase
        .from('projects')
        .update({ 
          is_archived: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', input.id);
      
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to unarchive project',
        });
      }
      
      return { success: true };
    }),

  /**
   * Update project (allows renaming default project)
   */
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      // Check if project exists and user owns it
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('id, created_by, is_default')
        .eq('id', input.id)
        .single();
      
      if (!project || project.created_by !== userRecord.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to update this project',
        });
      }
      
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      
      if (input.name !== undefined) {
        updates.name = input.name;
      }
      
      if (input.description !== undefined) {
        updates.description = input.description;
      }
      
      const { data, error } = await ctx.supabase
        .from('projects')
        .update(updates)
        .eq('id', input.id)
        .select()
        .single();
      
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }
      
      return { project: data };
    }),
  
  /**
   * Get project statistics
   */
  stats: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      // Get project with stats
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('*')
        .eq('id', input.id)
        .eq('created_by', userRecord.id)
        .single();
      
      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }
      
      // Get top activities
      const { data: topActivities } = await ctx.supabase
        .from('activity_statistics')
        .select('*')
        .eq('project_id', input.id)
        .order('execution_count', { ascending: false })
        .limit(10);
      
      // Get recent executions
      const { data: recentExecutions } = await ctx.supabase
        .from('workflow_executions')
        .select(`
          id,
          workflow_id,
          status,
          created_at,
          completed_at,
          workflows!inner(name, display_name, project_id)
        `)
        .eq('workflows.project_id', input.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      return {
        project: {
          id: project.id,
          name: project.name,
          total_workflow_executions: project.total_workflow_executions,
          total_activity_executions: project.total_activity_executions,
          avg_execution_duration_ms: project.avg_execution_duration_ms,
          last_execution_at: project.last_execution_at,
        },
        topActivities: topActivities || [],
        recentExecutions: recentExecutions || [],
      };
    }),
  
  /**
   * Get worker health for a project
   */
  workerHealth: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      // Verify user owns this project
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('id, name, task_queue_name')
        .eq('id', input.id)
        .eq('created_by', userRecord.id)
        .single();
      
      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }
      
      // Get most recent worker for this project
      const { data: workers } = await ctx.supabase
        .from('workflow_workers')
        .select('*')
        .eq('project_id', input.id)
        .order('started_at', { ascending: false })
        .limit(1);
      
      const worker = workers?.[0];
      
      if (!worker) {
        return {
          status: 'stopped' as const,
          isHealthy: false,
          workerId: null,
          lastHeartbeat: null,
          taskQueueName: project.task_queue_name,
        };
      }
      
      // Check if worker is healthy (heartbeat within last 60 seconds)
      const lastHeartbeat = worker.last_heartbeat ? new Date(worker.last_heartbeat) : null;
      const isHealthy = lastHeartbeat 
        ? (Date.now() - lastHeartbeat.getTime()) < 60000 
        : false;
      
      return {
        status: worker.status,
        isHealthy,
        workerId: worker.worker_id,
        lastHeartbeat: worker.last_heartbeat,
        taskQueueName: worker.task_queue_name,
        startedAt: worker.started_at,
        host: worker.host,
      };
    }),
  
  /**
   * Start worker for a project
   */
  startWorker: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      // Verify user owns this project
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('*')
        .eq('id', input.id)
        .eq('created_by', userRecord.id)
        .single();
      
      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }
      
      // Check if worker is already running
      const { data: existingWorkers } = await ctx.supabase
        .from('workflow_workers')
        .select('*')
        .eq('project_id', input.id)
        .in('status', ['running', 'starting'])
        .order('started_at', { ascending: false })
        .limit(1);
      
      if (existingWorkers && existingWorkers.length > 0) {
        const worker = existingWorkers[0];
        const lastHeartbeat = worker.last_heartbeat ? new Date(worker.last_heartbeat) : null;
        const isHealthy = lastHeartbeat 
          ? (Date.now() - lastHeartbeat.getTime()) < 60000 
          : false;
        
        if (isHealthy) {
          return {
            success: true,
            message: 'Worker is already running',
            workerId: worker.worker_id,
          };
        }
      }
      
      // Call worker service via HTTP
      const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://localhost:3011';
      
      try {
        const response = await fetch(`${WORKER_SERVICE_URL}/workers/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: input.id }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to start worker');
        }
        
        console.log('✅ [Start Worker] Worker started for project:', input.id);
        
        return {
          success: true,
          message: 'Worker started successfully',
        };
      } catch (error) {
        console.error('❌ [Start Worker] Error:', error);
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to start worker',
        });
      }
    }),
  
  /**
   * Stop worker for a project
   */
  stopWorker: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const userRecord = await ctx.getUserRecord();
      
      // Verify user owns this project
      const { data: project } = await ctx.supabase
        .from('projects')
        .select('*')
        .eq('id', input.id)
        .eq('created_by', userRecord.id)
        .single();
      
      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found',
        });
      }
      
      // Call worker service via HTTP
      const WORKER_SERVICE_URL = process.env.WORKER_SERVICE_URL || 'http://localhost:3011';
      
      try {
        const response = await fetch(`${WORKER_SERVICE_URL}/workers/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: input.id }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to stop worker');
        }
        
        console.log('✅ [Stop Worker] Worker stopped for project:', input.id);
        
        return {
          success: true,
          message: 'Worker stopped successfully',
        };
      } catch (error) {
        console.error('❌ [Stop Worker] Error:', error);
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to stop worker',
        });
      }
    }),
});

