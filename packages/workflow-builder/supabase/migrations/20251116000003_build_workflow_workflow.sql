-- Migration: Create the "Build Workflow" system workflow
-- This is the meta-workflow that builds other workflows

-- First, get IDs we need and determine which user will own the system workflow
DO $$
DECLARE
  system_user_id UUID;
  public_visibility_id UUID;
  activity_type_id UUID;
  agent_type_id UUID;
BEGIN
  -- Get the first existing user to own the system workflow
  -- (System workflows need a real user owner due to RLS policies)
  SELECT id INTO system_user_id
  FROM public.users
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- If no users exist yet, we'll skip creating the workflow
  -- It will be created automatically when the first user signs up
  IF system_user_id IS NULL THEN
    RAISE NOTICE 'No users exist yet. Build Workflow will be created when first user signs up.';
    RETURN;
  END IF;

  -- Get required reference IDs
  SELECT id INTO public_visibility_id
  FROM public.component_visibility
  WHERE name = 'public'
  LIMIT 1;

  SELECT id INTO activity_type_id
  FROM public.component_types
  WHERE name = 'activity'
  LIMIT 1;

  SELECT id INTO agent_type_id
  FROM public.component_types
  WHERE name = 'agent'
  LIMIT 1;

  -- Create the Build Workflow workflow
  INSERT INTO public.workflows (
    id,
    name,
    display_name,
    description,
    version,
    status_id,
    visibility_id,
    created_by,
    task_queue_id,
    definition,
    created_at,
    updated_at
  ) VALUES (
    'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    'build-workflow',
    'Build Workflow',
    'System workflow that compiles, validates, and executes user-defined workflows. This is the meta-workflow that makes the workflow builder work.',
    '1.0.0',
    (SELECT id FROM public.workflow_statuses WHERE name = 'active' LIMIT 1),
    public_visibility_id,
    system_user_id,
    (SELECT id FROM public.task_queues WHERE name = 'default-queue' LIMIT 1),
    '{"nodes": [], "edges": []}'::jsonb,
    NOW(),
    NOW()
  );

  -- Node 1: Compile Workflow Definition
  INSERT INTO public.workflow_nodes (
    id,
    workflow_id,
    node_id,
    node_type,
    position,
    config,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    'compile-workflow',
    'activity',
    '{"x": 100, "y": 100}'::jsonb,
    jsonb_build_object(
      'name', 'Compile Workflow',
      'description', 'Converts workflow definition from database into executable Temporal TypeScript code',
      'activityName', 'compileWorkflowDefinition',
      'inputSchema', jsonb_build_object(
        'workflowId', 'string',
        'includeComments', 'boolean',
        'strictMode', 'boolean'
      ),
      'outputSchema', jsonb_build_object(
        'workflowCode', 'string',
        'activitiesCode', 'string',
        'workerCode', 'string',
        'success', 'boolean'
      )
    ),
    NOW()
  );

  -- Node 2: Validate Generated Code
  INSERT INTO public.workflow_nodes (
    id,
    workflow_id,
    node_id,
    node_type,
    position,
    config,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    'validate-code',
    'activity',
    '{"x": 300, "y": 100}'::jsonb,
    jsonb_build_object(
      'name', 'Validate Code',
      'description', 'Validates generated TypeScript code for syntax errors and type safety',
      'activityName', 'validateGeneratedCode',
      'inputSchema', jsonb_build_object(
        'workflowCode', 'string',
        'activitiesCode', 'string'
      ),
      'outputSchema', jsonb_build_object(
        'valid', 'boolean',
        'errors', 'array'
      )
    ),
    NOW()
  );

  -- Node 3: Register Activities
  INSERT INTO public.workflow_nodes (
    id,
    workflow_id,
    node_id,
    node_type,
    position,
    config,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    'register-activities',
    'activity',
    '{"x": 500, "y": 100}'::jsonb,
    jsonb_build_object(
      'name', 'Register Activities',
      'description', 'Registers all activities defined in the workflow with the Temporal worker',
      'activityName', 'registerWorkflowActivities',
      'inputSchema', jsonb_build_object(
        'workflowId', 'string',
        'activities', 'array'
      ),
      'outputSchema', jsonb_build_object(
        'registered', 'boolean',
        'activityCount', 'number'
      )
    ),
    NOW()
  );

  -- Node 4: Initialize Execution Environment
  INSERT INTO public.workflow_nodes (
    id,
    workflow_id,
    node_id,
    node_type,
    position,
    config,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    'init-environment',
    'activity',
    '{"x": 700, "y": 100}'::jsonb,
    jsonb_build_object(
      'name', 'Initialize Environment',
      'description', 'Sets up execution environment and prepares worker for workflow execution',
      'activityName', 'initializeExecutionEnvironment',
      'inputSchema', jsonb_build_object(
        'workflowId', 'string',
        'taskQueue', 'string'
      ),
      'outputSchema', jsonb_build_object(
        'ready', 'boolean',
        'workerId', 'string'
      )
    ),
    NOW()
  );

  -- Node 5: Execute Workflow (Agent-powered coordinator)
  INSERT INTO public.workflow_nodes (
    id,
    workflow_id,
    node_id,
    node_type,
    position,
    config,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    'execute-workflow',
    'agent',
    '{"x": 900, "y": 100}'::jsonb,
    jsonb_build_object(
      'name', 'Execute Workflow',
      'description', 'LLM-powered agent that orchestrates workflow execution, handles dynamic failures, and coordinates activities',
      'agentPromptId', NULL,
      'activityName', 'coordinateWorkflowExecution',
      'model', 'claude-sonnet-4.5',
      'systemPrompt', 'You are a workflow execution coordinator. Your job is to execute the compiled workflow, monitor its progress, handle any failures gracefully, and ensure successful completion. You have access to all workflow activities and can make intelligent decisions about retry strategies and error handling.',
      'inputSchema', jsonb_build_object(
        'workflowId', 'string',
        'executionId', 'string',
        'workerId', 'string'
      ),
      'outputSchema', jsonb_build_object(
        'status', 'string',
        'result', 'object',
        'executionTime', 'number'
      )
    ),
    NOW()
  );

  -- Node 6: Update Execution Status
  INSERT INTO public.workflow_nodes (
    id,
    workflow_id,
    node_id,
    node_type,
    position,
    config,
    created_at
  ) VALUES (
    gen_random_uuid(),
    'aaaaaaaa-bbbb-cccc-dddd-000000000001',
    'update-status',
    'activity',
    '{"x": 1100, "y": 100}'::jsonb,
    jsonb_build_object(
      'name', 'Update Status',
      'description', 'Updates execution record in database with final results',
      'activityName', 'updateExecutionStatus',
      'inputSchema', jsonb_build_object(
        'executionId', 'string',
        'status', 'string',
        'result', 'object'
      ),
      'outputSchema', jsonb_build_object(
        'updated', 'boolean'
      )
    ),
    NOW()
  );

  -- Create edges connecting the nodes
  INSERT INTO public.workflow_edges (
    id,
    workflow_id,
    edge_id,
    source_node_id,
    target_node_id,
    label,
    created_at
  ) VALUES
    (gen_random_uuid(), 'aaaaaaaa-bbbb-cccc-dddd-000000000001', 'edge-1', 'compile-workflow', 'validate-code', 'on_success', NOW()),
    (gen_random_uuid(), 'aaaaaaaa-bbbb-cccc-dddd-000000000001', 'edge-2', 'validate-code', 'register-activities', 'on_valid', NOW()),
    (gen_random_uuid(), 'aaaaaaaa-bbbb-cccc-dddd-000000000001', 'edge-3', 'register-activities', 'init-environment', 'on_success', NOW()),
    (gen_random_uuid(), 'aaaaaaaa-bbbb-cccc-dddd-000000000001', 'edge-4', 'init-environment', 'execute-workflow', 'on_ready', NOW()),
    (gen_random_uuid(), 'aaaaaaaa-bbbb-cccc-dddd-000000000001', 'edge-5', 'execute-workflow', 'update-status', 'on_complete', NOW());

END $$;

-- Add comment to explain this workflow
COMMENT ON TABLE public.workflows IS 'Stores workflow definitions. The "Build Workflow" workflow (id: aaaaaaaa-bbbb-cccc-dddd-000000000001) is a special system workflow that builds other workflows. It is owned by the first user but marked as public for all to use.';

-- Note: If no users existed when this migration ran, the Build Workflow will be
-- created automatically when the first user signs up (add trigger/function if needed)

