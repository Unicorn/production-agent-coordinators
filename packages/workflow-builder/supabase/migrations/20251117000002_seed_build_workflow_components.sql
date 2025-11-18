-- Seed Data: Create components for Build Workflow activities
-- These are the activities that the "Build Workflow" meta-workflow uses

DO $$
DECLARE
  system_user_id UUID;
  public_visibility_id UUID;
  activity_type_id UUID;
  agent_type_id UUID;
  build_workflow_project_id UUID;
BEGIN
  -- Get first user (owner of system workflows)
  SELECT id INTO system_user_id
  FROM public.users
  ORDER BY created_at ASC
  LIMIT 1;
  
  IF system_user_id IS NULL THEN
    RAISE NOTICE 'No users exist yet. Skipping seed data.';
    RETURN;
  END IF;

  -- Get reference IDs
  SELECT id INTO public_visibility_id FROM public.component_visibility WHERE name = 'public' LIMIT 1;
  SELECT id INTO activity_type_id FROM public.component_types WHERE name = 'activity' LIMIT 1;
  SELECT id INTO agent_type_id FROM public.component_types WHERE name = 'agent' LIMIT 1;

  -- Create/find "System" project for Build Workflow
  INSERT INTO public.projects (
    id,
    name,
    description,
    created_by,
    task_queue_name,
    is_active
  ) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'System Workflows',
    'System-level workflows that power the workflow builder itself',
    system_user_id,
    'system-workflows',
    true
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO build_workflow_project_id;

  -- If already existed, get its ID
  IF build_workflow_project_id IS NULL THEN
    SELECT id INTO build_workflow_project_id
    FROM public.projects
    WHERE id = '00000000-0000-0000-0000-000000000001';
  END IF;

  -- Update Build Workflow to be in System project
  UPDATE public.workflows
  SET project_id = build_workflow_project_id
  WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-000000000001'
    AND project_id IS NULL;

  -- ==============================================================================
  -- ACTIVITY 1: Compile Workflow Definition
  -- ==============================================================================
  INSERT INTO public.components (
    id,
    name,
    display_name,
    description,
    component_type_id,
    visibility_id,
    created_by,
    implementation_language,
    implementation_code,
    input_schema,
    output_schema,
    tags,
    version,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    '11111111-0000-0000-0000-000000000001',
    'compileWorkflowDefinition',
    'Compile Workflow Definition',
    'Converts a workflow definition from database format into executable Temporal TypeScript code. This is the core compilation step that transforms visual workflows into runnable code.',
    activity_type_id,
    public_visibility_id,
    system_user_id,
    'typescript',
    '// Implemented in: src/lib/workflow-compiler/compiler.ts
import { compileWorkflow } from "@/lib/workflow-compiler/compiler";
import type { TemporalWorkflow } from "@/types/advanced-patterns";

export async function compileWorkflowDefinition(
  workflow: TemporalWorkflow,
  options: { includeComments: boolean; strictMode: boolean }
) {
  const compiled = compileWorkflow(workflow, options);
  return {
    workflowCode: compiled.workflowCode,
    activitiesCode: compiled.activitiesCode,
    workerCode: compiled.workerCode,
    packageJson: compiled.packageJson,
    tsConfig: compiled.tsConfig,
    success: true,
  };
}',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'workflow', jsonb_build_object('type', 'object', 'description', 'Workflow definition from database'),
        'includeComments', jsonb_build_object('type', 'boolean', 'default', true),
        'strictMode', jsonb_build_object('type', 'boolean', 'default', true)
      ),
      'required', jsonb_build_array('workflow')
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'workflowCode', jsonb_build_object('type', 'string'),
        'activitiesCode', jsonb_build_object('type', 'string'),
        'workerCode', jsonb_build_object('type', 'string'),
        'packageJson', jsonb_build_object('type', 'string'),
        'tsConfig', jsonb_build_object('type', 'string'),
        'success', jsonb_build_object('type', 'boolean')
      )
    ),
    jsonb_build_array('system', 'compiler', 'workflow-builder'),
    '1.0.0',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- ==============================================================================
  -- ACTIVITY 2: Validate Generated Code
  -- ==============================================================================
  INSERT INTO public.components (
    id,
    name,
    display_name,
    description,
    component_type_id,
    visibility_id,
    created_by,
    implementation_language,
    implementation_code,
    input_schema,
    output_schema,
    tags,
    version,
    is_active
  ) VALUES (
    '11111111-0000-0000-0000-000000000002',
    'validateGeneratedCode',
    'Validate Generated Code',
    'Validates the generated TypeScript code for syntax errors, type safety, and potential runtime issues using TypeScript compiler API.',
    activity_type_id,
    public_visibility_id,
    system_user_id,
    'typescript',
    '// Validates TypeScript code
export async function validateGeneratedCode(input: {
  workflowCode: string;
  activitiesCode: string;
}) {
  // TODO: Implement TypeScript compiler API validation
  // For now, basic validation
  const errors: string[] = [];
  
  if (!input.workflowCode || input.workflowCode.trim().length === 0) {
    errors.push("Workflow code is empty");
  }
  
  if (!input.activitiesCode || input.activitiesCode.trim().length === 0) {
    errors.push("Activities code is empty");
  }
  
  // Check for basic syntax issues
  if (input.workflowCode.includes("undefined") && !input.workflowCode.includes("!== undefined")) {
    errors.push("Potential undefined reference in workflow code");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'workflowCode', jsonb_build_object('type', 'string'),
        'activitiesCode', jsonb_build_object('type', 'string')
      ),
      'required', jsonb_build_array('workflowCode', 'activitiesCode')
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'valid', jsonb_build_object('type', 'boolean'),
        'errors', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string'))
      )
    ),
    jsonb_build_array('system', 'validation', 'typescript'),
    '1.0.0',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- ==============================================================================
  -- ACTIVITY 3: Register Activities
  -- ==============================================================================
  INSERT INTO public.components (
    id,
    name,
    display_name,
    description,
    component_type_id,
    visibility_id,
    created_by,
    implementation_language,
    implementation_code,
    input_schema,
    output_schema,
    tags,
    version,
    is_active
  ) VALUES (
    '11111111-0000-0000-0000-000000000003',
    'registerWorkflowActivities',
    'Register Workflow Activities',
    'Registers all activities defined in a workflow with the Temporal worker. Activities must be registered before the workflow can execute.',
    activity_type_id,
    public_visibility_id,
    system_user_id,
    'typescript',
    '// Register activities with worker
export async function registerWorkflowActivities(input: {
  workflowId: string;
  activities: string[];
}) {
  // In a real implementation, this would dynamically register activities
  // For now, activities are loaded when worker starts from database
  console.log(`Registering ${input.activities.length} activities for workflow ${input.workflowId}`);
  
  return {
    registered: true,
    activityCount: input.activities.length,
  };
}',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'workflowId', jsonb_build_object('type', 'string', 'format', 'uuid'),
        'activities', jsonb_build_object('type', 'array', 'items', jsonb_build_object('type', 'string'))
      ),
      'required', jsonb_build_array('workflowId', 'activities')
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'registered', jsonb_build_object('type', 'boolean'),
        'activityCount', jsonb_build_object('type', 'number')
      )
    ),
    jsonb_build_array('system', 'worker', 'registration'),
    '1.0.0',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- ==============================================================================
  -- ACTIVITY 4: Initialize Execution Environment
  -- ==============================================================================
  INSERT INTO public.components (
    id,
    name,
    display_name,
    description,
    component_type_id,
    visibility_id,
    created_by,
    implementation_language,
    implementation_code,
    input_schema,
    output_schema,
    tags,
    version,
    is_active
  ) VALUES (
    '11111111-0000-0000-0000-000000000004',
    'initializeExecutionEnvironment',
    'Initialize Execution Environment',
    'Prepares the execution environment for a workflow, ensuring the worker is running and ready to accept tasks.',
    activity_type_id,
    public_visibility_id,
    system_user_id,
    'typescript',
    '// Initialize execution environment
import { projectWorkerManager } from "@/lib/temporal/worker-manager";

export async function initializeExecutionEnvironment(input: {
  workflowId: string;
  projectId: string;
  taskQueue: string;
}) {
  // Ensure worker is running for the project
  await projectWorkerManager.startWorkerForProject(input.projectId);
  
  const workerId = `worker-${input.projectId}-${Date.now()}`;
  
  return {
    ready: true,
    workerId,
    taskQueue: input.taskQueue,
  };
}',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'workflowId', jsonb_build_object('type', 'string', 'format', 'uuid'),
        'projectId', jsonb_build_object('type', 'string', 'format', 'uuid'),
        'taskQueue', jsonb_build_object('type', 'string')
      ),
      'required', jsonb_build_array('workflowId', 'projectId', 'taskQueue')
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'ready', jsonb_build_object('type', 'boolean'),
        'workerId', jsonb_build_object('type', 'string'),
        'taskQueue', jsonb_build_object('type', 'string')
      )
    ),
    jsonb_build_array('system', 'worker', 'initialization'),
    '1.0.0',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- ==============================================================================
  -- ACTIVITY 5: Update Execution Status
  -- ==============================================================================
  INSERT INTO public.components (
    id,
    name,
    display_name,
    description,
    component_type_id,
    visibility_id,
    created_by,
    implementation_language,
    implementation_code,
    input_schema,
    output_schema,
    tags,
    version,
    is_active
  ) VALUES (
    '11111111-0000-0000-0000-000000000005',
    'updateExecutionStatus',
    'Update Execution Status',
    'Updates the execution record in the database with the final status and results of the workflow execution.',
    activity_type_id,
    public_visibility_id,
    system_user_id,
    'typescript',
    '// Update execution status in database
import { createClient } from "@supabase/supabase-js";

export async function updateExecutionStatus(input: {
  executionId: string;
  status: string;
  result?: any;
  error?: string;
}) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { error } = await supabase
    .from("workflow_executions")
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      output: input.result,
      error_message: input.error,
    })
    .eq("id", input.executionId);
  
  if (error) {
    throw new Error(`Failed to update execution status: ${error.message}`);
  }
  
  return { updated: true };
}',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'executionId', jsonb_build_object('type', 'string', 'format', 'uuid'),
        'status', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('completed', 'failed', 'cancelled')),
        'result', jsonb_build_object('type', 'object'),
        'error', jsonb_build_object('type', 'string')
      ),
      'required', jsonb_build_array('executionId', 'status')
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'updated', jsonb_build_object('type', 'boolean')
      )
    ),
    jsonb_build_array('system', 'database', 'status'),
    '1.0.0',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Build Workflow components seeded successfully';
END $$;

