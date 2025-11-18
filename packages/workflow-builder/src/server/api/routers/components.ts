/**
 * Components router - CRUD operations for workflow components
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { validateTypeScriptCode, validateActivityStructure, extractExportedFunctions } from '@/lib/typescript-validator';

export const componentsRouter = createTRPCRouter({
  // List all accessible components
  list: protectedProcedure
    .input(z.object({
      type: z.string().optional(),
      capability: z.string().optional(),
      tags: z.array(z.string()).optional(),
      includeDeprecated: z.boolean().default(false),
      page: z.number().default(1),
      pageSize: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const { supabase } = ctx;
      
      let query = supabase
        .from('components')
        .select(`
          *,
          component_type:component_types(id, name, icon),
          created_by_user:users!components_created_by_fkey(id, display_name),
          visibility:component_visibility(id, name)
        `, { count: 'exact' });
      
      // Apply filters
      if (input.type) {
        const { data: typeData } = await supabase
          .from('component_types')
          .select('id')
          .eq('name', input.type)
          .single();
        
        if (typeData) {
          query = query.eq('component_type_id', typeData.id);
        }
      }
      
      if (input.capability) {
        query = query.contains('capabilities', [input.capability]);
      }
      
      if (input.tags && input.tags.length > 0) {
        query = query.overlaps('tags', input.tags);
      }
      
      if (!input.includeDeprecated) {
        query = query.eq('deprecated', false);
      }
      
      // Pagination
      const from = (input.page - 1) * input.pageSize;
      const to = from + input.pageSize - 1;
      
      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR', 
          message: error.message 
        });
      }
      
      return {
        components: data || [],
        total: count || 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil((count || 0) / input.pageSize),
      };
    }),

  // Get single component by ID
  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('components')
        .select(`
          *,
          component_type:component_types(id, name, icon, description),
          created_by_user:users!components_created_by_fkey(id, display_name, email),
          visibility:component_visibility(id, name, description),
          agent_prompt:agent_prompts(id, name, display_name, version)
        `)
        .eq('id', input.id)
        .single();
      
      if (error) {
        throw new TRPCError({ 
          code: 'NOT_FOUND', 
          message: 'Component not found' 
        });
      }
      
      return data;
    }),

  // Create new component
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      displayName: z.string().min(1).max(255),
      description: z.string().optional(),
      componentType: z.enum(['activity', 'agent', 'signal', 'trigger']),
      version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be valid semver'),
      visibility: z.enum(['public', 'private', 'organization']),
      configSchema: z.any().optional(),
      inputSchema: z.any().optional(),
      outputSchema: z.any().optional(),
      tags: z.array(z.string()).optional(),
      capabilities: z.array(z.string()).optional(),
      // Agent-specific
      agentPromptId: z.string().uuid().optional(),
      modelProvider: z.string().optional(),
      modelName: z.string().optional(),
      // Implementation
      implementationPath: z.string().optional(),
      npmPackage: z.string().optional(),
      // Custom activity code
      implementationLanguage: z.string().optional(),
      implementationCode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      
      // Get type ID
      const { data: componentType } = await supabase
        .from('component_types')
        .select('id')
        .eq('name', input.componentType)
        .single();
      
      if (!componentType) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Invalid component type' 
        });
      }
      
      // Get visibility ID
      const { data: visibility } = await supabase
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
      
      // Check for duplicate name/version
      const { data: existing } = await supabase
        .from('components')
        .select('id')
        .eq('name', input.name)
        .eq('version', input.version)
        .eq('created_by', user.id)
        .single();
      
      if (existing) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: 'Component with this name and version already exists' 
        });
      }

      // Validate custom activity code if provided
      if (input.implementationCode) {
        const validation = validateTypeScriptCode(input.implementationCode);
        
        if (!validation.valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `TypeScript validation failed: ${validation.errors.map(e => e.message).join(', ')}`,
          });
        }

        // Validate activity structure
        const structureValidation = validateActivityStructure(input.implementationCode);
        if (!structureValidation.valid) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: structureValidation.error || 'Invalid activity structure',
          });
        }

        // Extract exported functions for metadata
        const exportedFunctions = extractExportedFunctions(input.implementationCode);
        if (exportedFunctions.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Activity code must export at least one function',
          });
        }
      }
      
      // Create component
      const { data, error } = await supabase
        .from('components')
        .insert({
          name: input.name,
          display_name: input.displayName,
          description: input.description,
          component_type_id: componentType.id,
          version: input.version,
          created_by: user.id,
          visibility_id: visibility.id,
          config_schema: input.configSchema || null,
          input_schema: input.inputSchema || null,
          output_schema: input.outputSchema || null,
          tags: input.tags || null,
          capabilities: input.capabilities || null,
          agent_prompt_id: input.agentPromptId || null,
          model_provider: input.modelProvider || null,
          model_name: input.modelName || null,
          implementation_path: input.implementationPath || null,
          npm_package: input.npmPackage || null,
          implementation_language: input.implementationLanguage || null,
          implementation_code: input.implementationCode || null,
          is_active: true,
        })
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

  // Update component
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      displayName: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      capabilities: z.array(z.string()).optional(),
      deprecated: z.boolean().optional(),
      deprecatedMessage: z.string().optional(),
      migrateToComponentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      
      // Check ownership
      const { data: component } = await ctx.supabase
        .from('components')
        .select('created_by')
        .eq('id', id)
        .single();
      
      if (!component || component.created_by !== ctx.user.id) {
        throw new TRPCError({ 
          code: 'FORBIDDEN', 
          message: 'Not authorized to update this component' 
        });
      }
      
      // Build update object
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.tags !== undefined) updateData.tags = updates.tags;
      if (updates.capabilities !== undefined) updateData.capabilities = updates.capabilities;
      if (updates.deprecated !== undefined) updateData.deprecated = updates.deprecated;
      if (updates.deprecatedMessage !== undefined) updateData.deprecated_message = updates.deprecatedMessage;
      if (updates.migrateToComponentId !== undefined) updateData.migrate_to_component_id = updates.migrateToComponentId;
      
      if (updates.deprecated) {
        updateData.deprecated_since = new Date().toISOString();
      }
      
      // Update
      const { data, error } = await ctx.supabase
        .from('components')
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

  // Delete component
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check ownership
      const { data: component } = await ctx.supabase
        .from('components')
        .select('created_by')
        .eq('id', input.id)
        .single();
      
      if (!component || component.created_by !== ctx.user.id) {
        throw new TRPCError({ 
          code: 'FORBIDDEN', 
          message: 'Not authorized to delete this component' 
        });
      }
      
      // Check if component is used in any workflows
      const { count } = await ctx.supabase
        .from('workflow_nodes')
        .select('*', { count: 'exact', head: true })
        .eq('component_id', input.id);
      
      if (count && count > 0) {
        throw new TRPCError({ 
          code: 'BAD_REQUEST', 
          message: `Component is used in ${count} workflow(s). Deprecate it instead of deleting.` 
        });
      }
      
      // Delete
      const { error } = await ctx.supabase
        .from('components')
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

  // Get component types (for dropdowns)
  getTypes: publicProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('component_types')
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

  // Validate TypeScript code
  validateTypeScript: publicProcedure
    .input(z.object({
      code: z.string(),
    }))
    .mutation(({ input }) => {
      const validation = validateTypeScriptCode(input.code, { strict: true });
      const structureValidation = validateActivityStructure(input.code);
      const exportedFunctions = extractExportedFunctions(input.code);

      return {
        valid: validation.valid && structureValidation.valid,
        errors: [
          ...validation.errors,
          ...(structureValidation.valid ? [] : [{ 
            line: 0, 
            column: 0, 
            message: structureValidation.error || 'Invalid structure',
            code: 0 
          }]),
        ],
        warnings: validation.warnings,
        exportedFunctions,
      };
    }),
});

