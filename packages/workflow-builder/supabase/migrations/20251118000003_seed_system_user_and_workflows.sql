-- ============================================================================
-- SEED: System User, Project, Task Queue, and Agent Tester Workflow
-- Created: 2025-11-18
-- Description: Creates system user infrastructure and agent tester workflow
-- ============================================================================
-- 
-- PREREQUISITE: Create auth user via Supabase Auth API:
--   - Email: system@example.com
--   - Password: (set a secure password)
--   - Or use: supabase auth admin create-user --email system@example.com
--

DO $$
DECLARE
  system_role_id UUID;
  system_user_id UUID;
  auth_user_id UUID;
  system_project_id UUID;
  system_task_queue_id UUID;
  system_visibility_id UUID;
  active_status_id UUID;
  agent_tester_workflow_id UUID;
BEGIN
  -- 1. Get system role
  SELECT id INTO system_role_id FROM user_roles WHERE name = 'system';
  
  IF system_role_id IS NULL THEN
    RAISE EXCEPTION 'System role not found. Run migration 20251118000001 first.';
  END IF;
  
  -- 2. Try to find auth user (must be created via Supabase Auth first)
  -- Note: This requires admin access - if not available, we'll create placeholder
  BEGIN
    SELECT id INTO auth_user_id 
    FROM auth.users 
    WHERE email = 'system@example.com' 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Cannot access auth.users table. System user will be created when auth user exists.';
    auth_user_id := NULL;
  END;
  
  -- 3. Create or get system user record
  IF auth_user_id IS NOT NULL THEN
    -- Check if user already exists
    SELECT id INTO system_user_id FROM users WHERE email = 'system@example.com';
    
    IF system_user_id IS NULL THEN
      -- Create user record
      INSERT INTO users (auth_user_id, email, display_name, role_id)
      VALUES (auth_user_id, 'system@example.com', 'System User', system_role_id)
      RETURNING id INTO system_user_id;
      
      RAISE NOTICE 'Created system user record: %', system_user_id;
    ELSE
      RAISE NOTICE 'System user already exists: %', system_user_id;
    END IF;
  ELSE
    RAISE NOTICE 'Auth user not found. Skipping system user creation. Run this migration again after creating auth user.';
    RETURN;
  END IF;
  
  -- 4. Create system task queue
  SELECT id INTO system_task_queue_id 
  FROM task_queues 
  WHERE name = 'system-workflows-queue';
  
  IF system_task_queue_id IS NULL THEN
    INSERT INTO task_queues (name, description, created_by, is_system_queue)
    VALUES (
      'system-workflows-queue',
      'Task queue for system workflows (agent tester, etc.)',
      system_user_id,
      TRUE
    )
    RETURNING id INTO system_task_queue_id;
    
    RAISE NOTICE 'Created system task queue: %', system_task_queue_id;
  ELSE
    RAISE NOTICE 'System task queue already exists: %', system_task_queue_id;
  END IF;
  
  -- 5. Create system project
  SELECT id INTO system_project_id 
  FROM projects 
  WHERE name = 'System Workflows' AND created_by = system_user_id;
  
  IF system_project_id IS NULL THEN
    INSERT INTO projects (
      name,
      description,
      created_by,
      task_queue_name,
      is_active
    ) VALUES (
      'System Workflows',
      'System workflows for agent testing and other system operations',
      system_user_id,
      'system-workflows-queue',
      TRUE
    )
    RETURNING id INTO system_project_id;
    
    RAISE NOTICE 'Created system project: %', system_project_id;
  ELSE
    RAISE NOTICE 'System project already exists: %', system_project_id;
  END IF;
  
  -- 6. Get required IDs for workflow creation
  SELECT id INTO system_visibility_id FROM component_visibility WHERE name = 'public';
  SELECT id INTO active_status_id FROM workflow_statuses WHERE name = 'active';
  
  -- 7. Create Agent Tester Workflow
  SELECT id INTO agent_tester_workflow_id 
  FROM workflows 
  WHERE name = 'agent-tester' AND created_by = system_user_id;
  
  IF agent_tester_workflow_id IS NULL THEN
    INSERT INTO workflows (
      name,
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
      'agent-tester',
      'agent-tester',
      'Agent Tester',
      'System workflow for testing agent prompts with human-in-the-loop interaction. Allows users to have conversational tests with their agent prompts.',
      '1.0.0',
      active_status_id,
      system_visibility_id,
      system_user_id,
      system_task_queue_id,
      system_project_id,
      '{"nodes": [{"id": "start", "type": "trigger", "position": {"x": 0, "y": 0}, "data": {"label": "Start"}}], "edges": []}'::jsonb,
      'agentTesterWorkflow',
      NOW(),
      NOW()
    )
    RETURNING id INTO agent_tester_workflow_id;
    
    RAISE NOTICE 'Created agent tester workflow: %', agent_tester_workflow_id;
    
    -- Create a simple start node for the workflow
    INSERT INTO workflow_nodes (
      workflow_id,
      node_id,
      node_type,
      position,
      config,
      created_at
    ) VALUES (
      agent_tester_workflow_id,
      'start',
      'trigger',
      '{"x": 0, "y": 0}'::jsonb,
      jsonb_build_object(
        'name', 'Start',
        'description', 'Workflow start trigger'
      ),
      NOW()
    );
    
  ELSE
    RAISE NOTICE 'Agent tester workflow already exists: %', agent_tester_workflow_id;
  END IF;
  
  RAISE NOTICE 'System infrastructure setup complete!';
  RAISE NOTICE '  - System User ID: %', system_user_id;
  RAISE NOTICE '  - System Project ID: %', system_project_id;
  RAISE NOTICE '  - System Task Queue ID: %', system_task_queue_id;
  RAISE NOTICE '  - Agent Tester Workflow ID: %', agent_tester_workflow_id;
  
END $$;

-- Add helpful comments
COMMENT ON TABLE public.projects IS 'Projects group workflows. The "System Workflows" project (owned by system@example.com) contains system workflows like the Agent Tester.';
COMMENT ON TABLE public.task_queues IS 'Task queues for Temporal workers. The "system-workflows-queue" is used for system workflows.';
COMMENT ON TABLE public.workflows IS 'Workflow definitions. The "agent-tester" workflow (owned by system@example.com) is a system workflow for testing agent prompts.';

