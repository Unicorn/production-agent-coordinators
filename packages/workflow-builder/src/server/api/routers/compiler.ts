/**
 * Compiler tRPC Router
 * API endpoints for workflow compilation using pattern-based compiler
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { WorkflowCompiler } from '@/lib/compiler';
import type { WorkflowDefinition } from '@/lib/compiler/types';

/**
 * Zod schema for workflow node
 */
const workflowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['trigger', 'activity', 'agent', 'conditional', 'loop', 'child-workflow', 'signal', 'phase', 'retry', 'state-variable', 'api-endpoint', 'condition', 'end']),
  data: z.object({
    label: z.string(),
    componentId: z.string().optional(),
    componentName: z.string().optional(),
    activityName: z.string().optional(),
    signalName: z.string().optional(),
    config: z.record(z.any()).optional(),
    timeout: z.string().optional(),
    retryPolicy: z.object({
      strategy: z.enum(['keep-trying', 'fail-after-x', 'exponential-backoff', 'none']),
      maxAttempts: z.number().optional(),
      initialInterval: z.string().optional(),
      maxInterval: z.string().optional(),
      backoffCoefficient: z.number().optional(),
    }).optional(),
  }),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

/**
 * Zod schema for workflow edge
 */
const workflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  label: z.string().optional(),
  type: z.string().optional(),
});

/**
 * Zod schema for workflow definition
 */
const workflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    initialValue: z.any().optional(),
    description: z.string().optional(),
  })).optional(),
  settings: z.object({
    timeout: z.string().optional(),
    retryPolicy: z.object({
      strategy: z.enum(['keep-trying', 'fail-after-x', 'exponential-backoff', 'none']),
      maxAttempts: z.number().optional(),
      initialInterval: z.string().optional(),
      maxInterval: z.string().optional(),
      backoffCoefficient: z.number().optional(),
    }).optional(),
    taskQueue: z.string().optional(),
    description: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});

/**
 * Convert database workflow to WorkflowDefinition
 */
function convertToWorkflowDefinition(data: {
  id: string;
  name: string;
  definition?: unknown;
  execution_timeout_seconds?: number | null;
  description?: string | null;
  version?: string;
}): WorkflowDefinition {
  // If definition is stored as JSON
  if (data.definition && typeof data.definition === 'object') {
    const def = data.definition as Record<string, unknown>;
    return {
      id: data.id,
      name: data.name,
      nodes: (def.nodes as WorkflowDefinition['nodes']) || [],
      edges: (def.edges as WorkflowDefinition['edges']) || [],
      variables: (def.variables as WorkflowDefinition['variables']) || [],
      settings: {
        timeout: data.execution_timeout_seconds ? `${data.execution_timeout_seconds}s` : undefined,
        description: data.description || undefined,
        version: data.version || '1.0.0',
        ...(def.settings as Record<string, unknown>),
      },
    };
  }

  // Default fallback
  return {
    id: data.id,
    name: data.name,
    nodes: [],
    edges: [],
    variables: [],
    settings: {
      description: data.description || undefined,
      version: data.version || '1.0.0',
    },
  };
}

/**
 * Compiler Router
 */
export const compilerRouter = createTRPCRouter({
  /**
   * Compile a workflow by ID (fetch from database and compile)
   */
  compile: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
      includeComments: z.boolean().default(true),
      strictMode: z.boolean().default(true),
      optimizationLevel: z.enum(['none', 'basic', 'aggressive']).default('basic'),
      saveToDatabase: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch workflow from database
      const { data: workflowData, error: workflowError } = await ctx.supabase
        .from('workflows')
        .select('*')
        .eq('id', input.workflowId)
        .eq('created_by', ctx.user.id)
        .single();

      if (workflowError || !workflowData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow not found or not authorized',
        });
      }

      // Convert to WorkflowDefinition format
      const workflowDef = convertToWorkflowDefinition(workflowData);

      // Create compiler instance
      const compiler = new WorkflowCompiler({
        includeComments: input.includeComments,
        strictMode: input.strictMode,
        optimizationLevel: input.optimizationLevel,
      });

      // Compile workflow
      const result = compiler.compile(workflowDef);

      if (!result.success) {
        return {
          success: false,
          errors: result.errors || [],
          warnings: result.warnings || [],
          metadata: result.metadata,
        };
      }

      // Save compiled code to database if requested
      if (input.saveToDatabase && result.workflowCode) {
        await ctx.supabase
          .from('workflows')
          .update({
            compiled_typescript: result.workflowCode,
            updated_at: new Date().toISOString(),
          })
          .eq('id', input.workflowId);
      }

      return {
        success: true,
        workflowCode: result.workflowCode,
        activitiesCode: result.activitiesCode,
        workerCode: result.workerCode,
        packageJson: result.packageJson,
        tsConfig: result.tsConfig,
        errors: result.errors || [],
        warnings: result.warnings || [],
        metadata: result.metadata,
      };
    }),

  /**
   * Compile a workflow definition directly (without saving to database)
   */
  compileDefinition: protectedProcedure
    .input(z.object({
      workflow: workflowDefinitionSchema,
      includeComments: z.boolean().default(true),
      strictMode: z.boolean().default(true),
      optimizationLevel: z.enum(['none', 'basic', 'aggressive']).default('basic'),
    }))
    .mutation(async ({ input }) => {
      // Create compiler instance
      const compiler = new WorkflowCompiler({
        includeComments: input.includeComments,
        strictMode: input.strictMode,
        optimizationLevel: input.optimizationLevel,
      });

      // Compile workflow
      const result = compiler.compile(input.workflow);

      return {
        success: result.success,
        workflowCode: result.workflowCode,
        activitiesCode: result.activitiesCode,
        workerCode: result.workerCode,
        packageJson: result.packageJson,
        tsConfig: result.tsConfig,
        errors: result.errors || [],
        warnings: result.warnings || [],
        metadata: result.metadata,
      };
    }),

  /**
   * Get compiled code for a workflow
   */
  getCompiledCode: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { data: workflow, error } = await ctx.supabase
        .from('workflows')
        .select('id, name, compiled_typescript, updated_at')
        .eq('id', input.workflowId)
        .eq('created_by', ctx.user.id)
        .single();

      if (error || !workflow) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow not found or not authorized',
        });
      }

      if (!workflow.compiled_typescript) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow has not been compiled yet',
        });
      }

      return {
        id: workflow.id,
        name: workflow.name,
        compiledCode: workflow.compiled_typescript,
        compiledAt: workflow.updated_at,
      };
    }),

  /**
   * Validate a workflow without compiling
   */
  validate: protectedProcedure
    .input(z.object({
      workflowId: z.string().optional(),
      workflow: workflowDefinitionSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let workflowDef: WorkflowDefinition;

      if (input.workflowId) {
        // Fetch from database
        const { data: workflowData, error: workflowError } = await ctx.supabase
          .from('workflows')
          .select('*')
          .eq('id', input.workflowId)
          .eq('created_by', ctx.user.id)
          .single();

        if (workflowError || !workflowData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Workflow not found or not authorized',
          });
        }

        workflowDef = convertToWorkflowDefinition(workflowData);
      } else if (input.workflow) {
        workflowDef = input.workflow;
      } else {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either workflowId or workflow definition is required',
        });
      }

      // Create compiler with validateOnly option
      const compiler = new WorkflowCompiler({
        validateOnly: true,
      });

      // Run validation
      const result = compiler.compile(workflowDef);

      return {
        valid: result.success,
        errors: result.errors || [],
        warnings: result.warnings || [],
        metadata: result.metadata,
      };
    }),

  /**
   * Preview compiled code without saving
   */
  preview: protectedProcedure
    .input(z.object({
      workflowId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Fetch workflow from database
      const { data: workflowData, error: workflowError } = await ctx.supabase
        .from('workflows')
        .select('*')
        .eq('id', input.workflowId)
        .eq('created_by', ctx.user.id)
        .single();

      if (workflowError || !workflowData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Workflow not found or not authorized',
        });
      }

      // Convert to WorkflowDefinition format
      const workflowDef = convertToWorkflowDefinition(workflowData);

      // Create compiler instance
      const compiler = new WorkflowCompiler({
        includeComments: true,
        strictMode: true,
      });

      // Compile workflow
      const result = compiler.compile(workflowDef);

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate preview',
        });
      }

      return {
        workflowCode: result.workflowCode,
        activitiesCode: result.activitiesCode,
        workerCode: result.workerCode,
        packageJson: result.packageJson,
        tsConfig: result.tsConfig,
      };
    }),

  /**
   * Get compiler metadata (version, capabilities)
   */
  getMetadata: protectedProcedure
    .query(() => {
      return {
        version: '1.0.0',
        supportedNodeTypes: [
          'trigger',
          'activity',
          'agent',
          'conditional',
          'loop',
          'child-workflow',
          'signal',
          'phase',
          'retry',
          'state-variable',
          'api-endpoint',
          'condition',
          'end',
        ],
        optimizationLevels: ['none', 'basic', 'aggressive'],
        features: [
          'pattern-based-compilation',
          'validation',
          'retry-policies',
          'state-management',
          'activity-proxy',
        ],
      };
    }),
});
