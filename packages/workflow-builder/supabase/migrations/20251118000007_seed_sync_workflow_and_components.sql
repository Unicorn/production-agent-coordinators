-- ============================================================================
-- SEED: Sync Coordinator Workflow and Database Components
-- Created: 2025-11-18
-- Description: Creates sync coordinator workflow and registers PostgreSQL,
--              Redis, and TypeScript components
-- ============================================================================

DO $$
DECLARE
  system_user_id UUID;
  system_project_id UUID;
  system_task_queue_id UUID;
  system_visibility_id UUID;
  active_status_id UUID;
  activity_type_id UUID;
  sync_workflow_id UUID;
BEGIN
  -- 1. Get system user
  SELECT id INTO system_user_id FROM users WHERE email = 'system@example.com' LIMIT 1;
  
  IF system_user_id IS NULL THEN
    RAISE NOTICE 'System user not found. Run migration 20251118000003 first.';
    RETURN;
  END IF;

  -- 2. Get system project
  SELECT id INTO system_project_id 
  FROM projects 
  WHERE name = 'System Workflows' AND created_by = system_user_id
  LIMIT 1;
  
  IF system_project_id IS NULL THEN
    RAISE NOTICE 'System project not found. Run migration 20251118000003 first.';
    RETURN;
  END IF;

  -- 3. Get system task queue
  SELECT id INTO system_task_queue_id 
  FROM task_queues 
  WHERE name = 'system-workflows-queue'
  LIMIT 1;
  
  IF system_task_queue_id IS NULL THEN
    RAISE NOTICE 'System task queue not found. Run migration 20251118000003 first.';
    RETURN;
  END IF;

  -- 4. Get reference IDs
  SELECT id INTO system_visibility_id FROM component_visibility WHERE name = 'public' LIMIT 1;
  SELECT id INTO active_status_id FROM workflow_statuses WHERE name = 'active' LIMIT 1;
  SELECT id INTO activity_type_id FROM component_types WHERE name = 'activity' LIMIT 1;

  -- 5. Create Sync Coordinator Workflow
  SELECT id INTO sync_workflow_id 
  FROM workflows 
  WHERE kebab_name = 'sync-coordinator' AND created_by = system_user_id;
  
  IF sync_workflow_id IS NULL THEN
    INSERT INTO workflows (
      kebab_name,
      display_name,
      description,
      version,
      status_id,
      visibility_id,
      created_by,
      task_queue_id,
      project_id,
      definition,
      temporal_workflow_type,
      created_at,
      updated_at
    ) VALUES (
      'sync-coordinator',
      'Sync Coordinator',
      'System workflow that coordinates syncing execution history from Temporal to database. Manages queue of executions to sync and spawns child sync workflows.',
      '1.0.0',
      active_status_id,
      system_visibility_id,
      system_user_id,
      system_task_queue_id,
      system_project_id,
      '{"nodes": [{"id": "start", "type": "trigger", "position": {"x": 0, "y": 0}, "data": {"label": "Start"}}], "edges": []}'::jsonb,
      'syncCoordinatorWorkflow',
      NOW(),
      NOW()
    )
    RETURNING id INTO sync_workflow_id;
    
    RAISE NOTICE 'Created sync coordinator workflow: %', sync_workflow_id;
    
    -- Create a simple start node for the workflow
    INSERT INTO workflow_nodes (
      workflow_id,
      node_id,
      node_type,
      position,
      config,
      created_at
    ) VALUES (
      sync_workflow_id,
      'start',
      'trigger',
      '{"x": 0, "y": 0}'::jsonb,
      jsonb_build_object(
        'name', 'Start',
        'description', 'Sync coordinator workflow start trigger'
      ),
      NOW()
    );
  ELSE
    RAISE NOTICE 'Sync coordinator workflow already exists: %', sync_workflow_id;
  END IF;

  -- 6. Register PostgreSQL Component
  INSERT INTO components (
    name,
    display_name,
    description,
    component_type_id,
    visibility_id,
    created_by,
    version,
    config_schema,
    input_schema,
    output_schema,
    tags,
    capabilities
  ) VALUES (
    'postgresql-query',
    'PostgreSQL Query',
    'Execute parameterized PostgreSQL queries. Requires a project connection to be configured.',
    activity_type_id,
    system_visibility_id,
    system_user_id,
    '1.0.0',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'connectionId', jsonb_build_object('type', 'string', 'description', 'Project connection ID'),
        'query', jsonb_build_object('type', 'string', 'description', 'SQL query with parameter placeholders ($1, $2, etc.)'),
        'parameters', jsonb_build_object('type', 'array', 'description', 'Query parameters array')
      ),
      'required', jsonb_build_array('connectionId', 'query')
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'connectionUrl', jsonb_build_object('type', 'string'),
        'query', jsonb_build_object('type', 'string'),
        'parameters', jsonb_build_object('type', 'array')
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'success', jsonb_build_object('type', 'boolean'),
        'rows', jsonb_build_object('type', 'array'),
        'rowCount', jsonb_build_object('type', 'number')
      )
    ),
    ARRAY['database', 'postgresql', 'sql'],
    ARRAY['query', 'data-access']
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    config_schema = EXCLUDED.config_schema,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    updated_at = NOW();

  -- 7. Register Redis Component
  INSERT INTO components (
    name,
    display_name,
    description,
    component_type_id,
    visibility_id,
    created_by,
    version,
    config_schema,
    input_schema,
    output_schema,
    tags,
    capabilities
  ) VALUES (
    'redis-command',
    'Redis Command',
    'Execute Redis commands (GET, SET, DEL, etc.). Requires a project connection to be configured.',
    activity_type_id,
    system_visibility_id,
    system_user_id,
    '1.0.0',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'connectionId', jsonb_build_object('type', 'string', 'description', 'Project connection ID'),
        'command', jsonb_build_object('type', 'string', 'enum', jsonb_build_array('GET', 'SET', 'DEL', 'EXISTS', 'INCR', 'DECR')),
        'key', jsonb_build_object('type', 'string', 'description', 'Redis key'),
        'value', jsonb_build_object('type', 'string', 'description', 'Value (required for SET command)')
      ),
      'required', jsonb_build_array('connectionId', 'command', 'key')
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'connectionUrl', jsonb_build_object('type', 'string'),
        'command', jsonb_build_object('type', 'string'),
        'key', jsonb_build_object('type', 'string'),
        'value', jsonb_build_object('type', 'string')
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'success', jsonb_build_object('type', 'boolean'),
        'result', jsonb_build_object('type', 'any')
      )
    ),
    ARRAY['cache', 'redis', 'key-value'],
    ARRAY['cache', 'data-access']
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    config_schema = EXCLUDED.config_schema,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    updated_at = NOW();

  -- 8. Register TypeScript Component
  INSERT INTO components (
    name,
    display_name,
    description,
    component_type_id,
    visibility_id,
    created_by,
    version,
    config_schema,
    input_schema,
    output_schema,
    tags,
    capabilities
  ) VALUES (
    'typescript-processor',
    'TypeScript Processor',
    'Execute TypeScript code to process data. Useful for data transformation and processing between workflow steps.',
    activity_type_id,
    system_visibility_id,
    system_user_id,
    '1.0.0',
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'code', jsonb_build_object('type', 'string', 'description', 'TypeScript code that exports a process function'),
        'inputSchema', jsonb_build_object('type', 'object', 'description', 'JSON schema for input validation'),
        'outputSchema', jsonb_build_object('type', 'object', 'description', 'JSON schema for output validation')
      ),
      'required', jsonb_build_array('code')
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'code', jsonb_build_object('type', 'string'),
        'input', jsonb_build_object('type', 'any')
      )
    ),
    jsonb_build_object(
      'type', 'object',
      'properties', jsonb_build_object(
        'success', jsonb_build_object('type', 'boolean'),
        'output', jsonb_build_object('type', 'any')
      )
    ),
    ARRAY['processing', 'typescript', 'data-transformation'],
    ARRAY['data-processing', 'transformation']
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    config_schema = EXCLUDED.config_schema,
    input_schema = EXCLUDED.input_schema,
    output_schema = EXCLUDED.output_schema,
    updated_at = NOW();

  RAISE NOTICE '✅ Sync coordinator workflow and database components registered successfully';
  RAISE NOTICE '  - Sync Coordinator Workflow ID: %', sync_workflow_id;
  RAISE NOTICE '  - PostgreSQL component: postgresql-query';
  RAISE NOTICE '  - Redis component: redis-command';
  RAISE NOTICE '  - TypeScript component: typescript-processor';

END $$;

COMMENT ON TABLE public.workflows IS 'Workflow definitions. The "sync-coordinator" workflow (owned by system@example.com) is a system workflow for syncing execution history.';
COMMENT ON TABLE public.components IS 'Reusable workflow components. Includes PostgreSQL, Redis, and TypeScript components for data access and processing.';

