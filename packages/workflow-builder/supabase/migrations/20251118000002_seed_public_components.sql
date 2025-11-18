-- ============================================================================
-- MIGRATION: Seed Public Components for All Users
-- Created: 2025-11-18
-- Depends on: 20251117000006_add_custom_activity_code.sql (uses implementation_code)
--             20251118000001_create_system_user.sql (system role and function)
-- Description: Creates system user, task queue, and seeds public components
--              Integrates system user setup from 20251118000001
--              No conditional logic - always seeds (idempotent)
-- ============================================================================

DO $$
DECLARE
  -- Fixed UUIDs for system and test users (MUST be created FIRST)
  system_user_id UUID := '00000000-0000-0000-0000-000000000001';
  system_auth_user_id UUID := '00000000-0000-0000-0000-000000000001';
  admin_user_id UUID := '11111111-0000-0000-0000-000000000001';
  admin_auth_user_id UUID := '11111111-0000-0000-0000-000000000001';
  test_user_id UUID := '22222222-0000-0000-0000-000000000001';
  test_auth_user_id UUID := '22222222-0000-0000-0000-000000000001';
  testuser_user_id UUID := '33333333-0000-0000-0000-000000000001';
  testuser_auth_user_id UUID := '33333333-0000-0000-0000-000000000001';
  
  -- Fixed UUIDs for system infrastructure
  system_project_id UUID := '00000000-0000-0000-0000-000000000001';
  demo_project_id UUID := 'dddddddd-0000-0000-0000-000000000001';
  agent_tester_workflow_id UUID := 'aaaaaaaa-0000-0000-0000-000000000001';
  hello_world_workflow_id UUID := 'aaaaaaaa-1111-0000-0000-000000000001';
  agent_conversation_workflow_id UUID := 'aaaaaaaa-2222-0000-0000-000000000001';
  
  -- Role and reference IDs
  system_role_id UUID;
  admin_role_id UUID;
  developer_role_id UUID;
  public_visibility_id UUID;
  activity_type_id UUID;
  agent_type_id UUID;
  signal_type_id UUID;
  trigger_type_id UUID;
  code_analyzer_prompt_id UUID;
  test_writer_prompt_id UUID;
  system_task_queue_id UUID;
  default_task_queue_id UUID;
  active_status_id UUID;
BEGIN
  -- ============================================================================
  -- STEP 1: ROLES (Create system role if needed)
  -- ============================================================================
  
  RAISE NOTICE 'Step 1: Setting up roles...';
  
  INSERT INTO user_roles (name, description, permissions)
  VALUES (
    'system',
    'System user for internal workflows',
    '{"workflows": ["create", "read", "update", "delete"], "components": ["create", "read", "update", "delete"], "agents": ["create", "read", "update", "delete"]}'::JSONB
  )
  ON CONFLICT (name) DO NOTHING;
  
  -- Get role IDs
  SELECT id INTO system_role_id FROM user_roles WHERE name = 'system' LIMIT 1;
  SELECT id INTO admin_role_id FROM user_roles WHERE name = 'admin' LIMIT 1;
  SELECT id INTO developer_role_id FROM user_roles WHERE name = 'developer' LIMIT 1;
  
  RAISE NOTICE '  ✓ Roles configured';
  
  -- ============================================================================
  -- STEP 2: AUTH USERS (Create in auth.users FIRST!)
  -- ============================================================================
  
  RAISE NOTICE 'Step 2: Creating auth users (in auth.users table)...';
  
  -- Create auth users directly (workaround for Supabase Auth API limitation)
  -- Use INSERT ... ON CONFLICT to handle existing users gracefully
  
  -- System User
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change_token_new, recovery_token)
  SELECT system_auth_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'system@example.com', crypt('system-internal-password', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', ''
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'system@example.com' OR id = system_auth_user_id);
  
  -- Admin User
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change_token_new, recovery_token)
  SELECT admin_auth_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.com', crypt('testpassword123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', ''
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@example.com' OR id = admin_auth_user_id);
  
  -- Test User
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change_token_new, recovery_token)
  SELECT test_auth_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test@example.com', crypt('testpassword123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', ''
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'test@example.com' OR id = test_auth_user_id);
  
  -- TestUser User
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, email_change_token_new, recovery_token)
  SELECT testuser_auth_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'testuser@example.com', crypt('testpassword123', gen_salt('bf')), NOW(), NOW(), NOW(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, '', '', ''
  WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'testuser@example.com' OR id = testuser_auth_user_id);
  
  RAISE NOTICE '  ✓ Auth users created in auth.users (trigger auto-creates public.users records)';
  
  -- ============================================================================
  -- STEP 3: VERIFY USER RECORDS (Auto-created by trigger)
  -- ============================================================================
  
  RAISE NOTICE 'Step 3: Verifying user records (auto-created by handle_new_user trigger)...';
  
  -- User records should have been auto-created by the on_auth_user_created trigger
  -- Let's verify and update with correct display names and roles
  
  UPDATE users SET display_name = 'System User', role_id = system_role_id
  WHERE auth_user_id = system_auth_user_id;
  
  UPDATE users SET display_name = 'Admin User', role_id = admin_role_id
  WHERE auth_user_id = admin_auth_user_id;
  
  UPDATE users SET display_name = 'Test User', role_id = developer_role_id
  WHERE auth_user_id = test_auth_user_id;
  
  UPDATE users SET display_name = 'Test User 2', role_id = developer_role_id
  WHERE auth_user_id = testuser_auth_user_id;
  
  -- Get the user IDs that were auto-created
  SELECT id INTO system_user_id FROM users WHERE auth_user_id = system_auth_user_id;
  SELECT id INTO admin_user_id FROM users WHERE auth_user_id = admin_auth_user_id;
  SELECT id INTO test_user_id FROM users WHERE auth_user_id = test_auth_user_id;
  SELECT id INTO testuser_user_id FROM users WHERE auth_user_id = testuser_auth_user_id;
  
  RAISE NOTICE '  ✓ System user (system@example.com) - ID: %', system_user_id;
  RAISE NOTICE '  ✓ Admin user (admin@example.com / testpassword123) - ID: %', admin_user_id;
  RAISE NOTICE '  ✓ Test user (test@example.com / testpassword123) - ID: %', test_user_id;
  RAISE NOTICE '  ✓ TestUser user (testuser@example.com / testpassword123) - ID: %', testuser_user_id;
  RAISE NOTICE '  ✓ All users verified BEFORE seeding components (prevents skip!)';
  
  -- ============================================================================
  -- STEP 4: GET REFERENCE IDs
  -- ============================================================================
  
  RAISE NOTICE 'Step 4: Getting reference IDs...';
  
  SELECT id INTO public_visibility_id FROM component_visibility WHERE name = 'public' LIMIT 1;
  SELECT id INTO activity_type_id FROM component_types WHERE name = 'activity' LIMIT 1;
  SELECT id INTO agent_type_id FROM component_types WHERE name = 'agent' LIMIT 1;
  SELECT id INTO signal_type_id FROM component_types WHERE name = 'signal' LIMIT 1;
  SELECT id INTO trigger_type_id FROM component_types WHERE name = 'trigger' LIMIT 1;
  SELECT id INTO active_status_id FROM workflow_statuses WHERE name = 'active' LIMIT 1;
  SELECT id INTO default_task_queue_id FROM task_queues WHERE name = 'default-queue' LIMIT 1;
  
  RAISE NOTICE '  ✓ Reference IDs retrieved';
  
  -- ============================================================================
  -- STEP 5: SYSTEM TASK QUEUE & PROJECT
  -- ============================================================================
  
  RAISE NOTICE 'Step 5: Creating system infrastructure...';
  
  INSERT INTO task_queues (
    name,
    display_name,
    description,
    created_by,
    is_system_queue,
    max_concurrent_workflows,
    max_concurrent_activities
  ) VALUES (
    'system-workflows-queue',
    'System Workflows Queue',
    'Task queue for system workflows (agent tester, workflow compiler, etc.)',
    system_user_id,
    TRUE,
    50,
    500
  )
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO system_task_queue_id;
  
  -- Get task queue ID if already existed
  IF system_task_queue_id IS NULL THEN
    SELECT id INTO system_task_queue_id FROM task_queues WHERE name = 'system-workflows-queue' LIMIT 1;
  END IF;
  
  RAISE NOTICE '  ✓ System task queue created';
  
  -- System Project
  INSERT INTO projects (
    id,
    name,
    description,
    created_by,
    task_queue_name,
    is_active
  ) VALUES (
    '00000000-0000-0000-0000-000000000001',  -- Fixed UUID for system project
    'System Workflows',
    'System workflows for agent testing and other system operations',
    system_user_id,
    'system-workflows-queue',
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE '  ✓ System project created';
  
  -- ============================================================================
  -- STEP 6: AGENT PROMPTS (3 prompts)
  -- ============================================================================
  
  RAISE NOTICE 'Step 6: Seeding agent prompts...';
  
  INSERT INTO agent_prompts (
    id,
    name,
    display_name,
    description,
    version,
    prompt_content,
    prompt_variables,
    created_by,
    visibility_id,
    capabilities,
    tags,
    recommended_models
  ) VALUES
  -- 1. Code Analyzer
  (
    '10000000-0000-0000-0000-000000000001',
    'code-analyzer',
    'Code Analyzer',
    'Analyzes code for bugs, performance issues, and improvements',
    '1.0.0',
    'You are an expert code analyzer. Analyze the provided code and identify:\n\n- Potential bugs and errors\n- Performance issues\n- Security vulnerabilities\n- Code smells and anti-patterns\n- Suggested improvements\n\nCode to analyze:\n```\n{{code}}\n```\n\nProvide a structured analysis with specific line numbers and actionable recommendations.',
    '{"code": {"type": "string", "description": "Code to analyze"}}'::JSONB,
    system_user_id,
    public_visibility_id,
    ARRAY['code-analysis', 'bug-detection', 'code-review', 'static-analysis'],
    ARRAY['analysis', 'code-quality', 'debugging', 'ai'],
    '[{"provider": "anthropic", "model": "claude-sonnet-4", "reason": "Excellent code understanding and detailed analysis"}]'::JSONB
  ),
  -- 2. Test Writer
  (
    '10000000-0000-0000-0000-000000000002',
    'test-writer',
    'Test Writer',
    'Generates comprehensive unit tests for code',
    '1.0.0',
    'You are a test writing expert. Generate comprehensive unit tests for the provided code.\n\nRequirements:\n- Use {{framework}} testing framework\n- Cover edge cases and error conditions\n- Include positive and negative test cases\n- Use descriptive test names\n- Add setup/teardown if needed\n\nCode to test:\n```{{language}}\n{{code}}\n```\n\nGenerate complete, runnable test code.',
    '{"code": {"type": "string"}, "language": {"type": "string"}, "framework": {"type": "string", "default": "jest"}}'::JSONB,
    system_user_id,
    public_visibility_id,
    ARRAY['test-generation', 'unit-testing', 'tdd', 'code-coverage'],
    ARRAY['testing', 'automation', 'quality-assurance', 'ai'],
    '[{"provider": "openai", "model": "gpt-4", "reason": "Great at generating structured, well-formatted code"}]'::JSONB
  ),
  -- 3. Documentation Writer
  (
    '10000000-0000-0000-0000-000000000003',
    'documentation-writer',
    'Documentation Writer',
    'Creates clear and comprehensive technical documentation',
    '1.0.0',
    'You are a technical documentation expert. Create clear, comprehensive documentation for the provided code.\n\nInclude:\n- Overview and purpose\n- Parameters with types and descriptions\n- Return values\n- Usage examples\n- Edge cases and limitations\n- Any dependencies or prerequisites\n\nCode to document:\n```{{language}}\n{{code}}\n```\n\nFormat: Use Markdown with proper syntax highlighting.',
    '{"code": {"type": "string"}, "language": {"type": "string", "default": "typescript"}}'::JSONB,
    system_user_id,
    public_visibility_id,
    ARRAY['documentation', 'technical-writing', 'api-docs'],
    ARRAY['docs', 'markdown', 'api-documentation', 'ai'],
    '[{"provider": "anthropic", "model": "claude-sonnet-4", "reason": "Excellent at clear, well-structured explanations"}]'::JSONB
  )
  ON CONFLICT (name, version, created_by) DO NOTHING;
  
  -- Get prompt IDs for linking to agent components
  SELECT id INTO code_analyzer_prompt_id FROM agent_prompts WHERE name = 'code-analyzer' AND created_by = system_user_id LIMIT 1;
  SELECT id INTO test_writer_prompt_id FROM agent_prompts WHERE name = 'test-writer' AND created_by = system_user_id LIMIT 1;
  
  RAISE NOTICE '  ✓ Agent prompts seeded';
  
  -- ============================================================================
  -- STEP 7: ACTIVITY COMPONENTS (6 activities)
  -- ============================================================================
  
  RAISE NOTICE 'Step 7: Seeding activity components...';
  
  INSERT INTO components (
    id,
    name,
    display_name,
    description,
    component_type_id,
    version,
    created_by,
    visibility_id,
    config_schema,
    input_schema,
    output_schema,
    tags,
    capabilities,
    implementation_path,
    npm_package,
    is_active
  ) VALUES
  -- 1. Fetch API Data
  (
    '20000000-0000-0000-0000-000000000001',
    'fetch-api-data',
    'Fetch API Data',
    'Fetches data from an external API endpoint with configurable HTTP method, headers, and body',
    activity_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"timeout": {"type": "number", "default": 30000}, "retries": {"type": "number", "default": 3}}}'::JSONB,
    '{"type": "object", "properties": {"url": {"type": "string", "format": "uri"}, "method": {"type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"]}, "headers": {"type": "object"}, "body": {"type": "object"}}, "required": ["url", "method"]}'::JSONB,
    '{"type": "object", "properties": {"data": {"type": "object"}, "status": {"type": "number"}, "headers": {"type": "object"}, "success": {"type": "boolean"}}}'::JSONB,
    ARRAY['api', 'http', 'network', 'rest'],
    ARRAY['fetch-data', 'api-call', 'http-request'],
    'activities/fetch-api-data.ts',
    '@workflow-builder/activities',
    true
  ),
  -- 2. Process Data
  (
    '20000000-0000-0000-0000-000000000002',
    'process-data',
    'Process Data',
    'Transforms and processes data using configurable transformation rules',
    activity_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"transformationType": {"type": "string", "enum": ["map", "filter", "reduce", "custom"]}}}'::JSONB,
    '{"type": "object", "properties": {"data": {"type": "object"}, "rules": {"type": "array", "items": {"type": "object"}}}, "required": ["data"]}'::JSONB,
    '{"type": "object", "properties": {"processedData": {"type": "object"}, "stats": {"type": "object", "properties": {"itemsProcessed": {"type": "number"}, "itemsFiltered": {"type": "number"}}}}}'::JSONB,
    ARRAY['processing', 'transformation', 'etl'],
    ARRAY['data-processing', 'transform', 'pipeline'],
    'activities/process-data.ts',
    '@workflow-builder/activities',
    true
  ),
  -- 3. Send Notification
  (
    '20000000-0000-0000-0000-000000000003',
    'send-notification',
    'Send Notification',
    'Sends notifications via multiple channels: email, Slack, webhook, or SMS',
    activity_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"channel": {"type": "string", "enum": ["email", "slack", "webhook", "sms"]}, "credentials": {"type": "object"}}}'::JSONB,
    '{"type": "object", "properties": {"channel": {"type": "string"}, "recipient": {"type": "string"}, "subject": {"type": "string"}, "message": {"type": "string"}, "priority": {"type": "string", "enum": ["low", "normal", "high"]}}, "required": ["channel", "recipient", "message"]}'::JSONB,
    '{"type": "object", "properties": {"sent": {"type": "boolean"}, "messageId": {"type": "string"}, "timestamp": {"type": "string"}}}'::JSONB,
    ARRAY['notification', 'communication', 'alerting'],
    ARRAY['send-notification', 'alert', 'messaging'],
    'activities/send-notification.ts',
    '@workflow-builder/activities',
    true
  ),
  -- 4. Save to Database
  (
    '20000000-0000-0000-0000-000000000004',
    'save-to-database',
    'Save to Database',
    'Saves data to a database with support for multiple database types',
    activity_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"databaseType": {"type": "string", "enum": ["postgres", "mysql", "mongodb"]}, "connectionString": {"type": "string"}}}'::JSONB,
    '{"type": "object", "properties": {"table": {"type": "string"}, "data": {"type": "object"}, "operation": {"type": "string", "enum": ["insert", "update", "upsert"]}}, "required": ["table", "data", "operation"]}'::JSONB,
    '{"type": "object", "properties": {"saved": {"type": "boolean"}, "recordId": {"type": "string"}, "rowsAffected": {"type": "number"}}}'::JSONB,
    ARRAY['database', 'storage', 'persistence'],
    ARRAY['save-data', 'database-write', 'data-persistence'],
    'activities/save-to-database.ts',
    '@workflow-builder/activities',
    true
  ),
  -- 5. Read from Database
  (
    '20000000-0000-0000-0000-000000000005',
    'read-from-database',
    'Read from Database',
    'Reads data from a database with query support',
    activity_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"databaseType": {"type": "string", "enum": ["postgres", "mysql", "mongodb"]}, "connectionString": {"type": "string"}}}'::JSONB,
    '{"type": "object", "properties": {"query": {"type": "string"}, "parameters": {"type": "object"}}, "required": ["query"]}'::JSONB,
    '{"type": "object", "properties": {"data": {"type": "array"}, "rowCount": {"type": "number"}, "success": {"type": "boolean"}}}'::JSONB,
    ARRAY['database', 'storage', 'query'],
    ARRAY['read-data', 'database-read', 'query-data'],
    'activities/read-from-database.ts',
    '@workflow-builder/activities',
    true
  ),
  -- 6. Log Message
  (
    '20000000-0000-0000-0000-000000000006',
    'log-message',
    'Log Message',
    'Logs a message with configurable severity level for debugging and monitoring',
    activity_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"includeTimestamp": {"type": "boolean", "default": true}, "includeContext": {"type": "boolean", "default": true}}}'::JSONB,
    '{"type": "object", "properties": {"message": {"type": "string"}, "level": {"type": "string", "enum": ["debug", "info", "warn", "error"]}, "context": {"type": "object"}}, "required": ["message", "level"]}'::JSONB,
    '{"type": "object", "properties": {"logged": {"type": "boolean"}, "timestamp": {"type": "string"}}}'::JSONB,
    ARRAY['logging', 'monitoring', 'debugging'],
    ARRAY['log', 'debug', 'monitoring'],
    'activities/log-message.ts',
    '@workflow-builder/activities',
    true
  )
  ON CONFLICT (name, version, created_by) DO NOTHING;
  
  RAISE NOTICE '  ✓ Activity components seeded';
  
  -- ============================================================================
  -- STEP 8: AGENT COMPONENTS (2 agents)
  -- ============================================================================
  
  RAISE NOTICE 'Step 8: Seeding agent components...';
  
  INSERT INTO components (
    id,
    name,
    display_name,
    description,
    component_type_id,
    version,
    created_by,
    visibility_id,
    config_schema,
    input_schema,
    output_schema,
    tags,
    capabilities,
    agent_prompt_id,
    model_provider,
    model_name,
    is_active
  ) VALUES
  -- 1. Code Analysis Agent
  (
    '30000000-0000-0000-0000-000000000001',
    'code-analysis-agent',
    'Code Analysis Agent',
    'AI agent that analyzes code for issues, bugs, and improvements',
    agent_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"analysisDepth": {"type": "string", "enum": ["quick", "standard", "thorough"], "default": "standard"}}}'::JSONB,
    '{"type": "object", "properties": {"code": {"type": "string"}, "language": {"type": "string"}}, "required": ["code", "language"]}'::JSONB,
    '{"type": "object", "properties": {"issues": {"type": "array"}, "suggestions": {"type": "array"}, "score": {"type": "number"}, "analysis": {"type": "string"}}}'::JSONB,
    ARRAY['ai', 'analysis', 'code-quality', 'agent'],
    ARRAY['code-analysis', 'bug-detection', 'code-review'],
    code_analyzer_prompt_id,
    'anthropic',
    'claude-sonnet-4',
    true
  ),
  -- 2. Test Generation Agent
  (
    '30000000-0000-0000-0000-000000000002',
    'test-generation-agent',
    'Test Generation Agent',
    'AI agent that generates comprehensive unit tests for code',
    agent_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"testFramework": {"type": "string", "enum": ["jest", "vitest", "mocha"], "default": "jest"}, "coverageTarget": {"type": "number", "default": 80}}}'::JSONB,
    '{"type": "object", "properties": {"code": {"type": "string"}, "language": {"type": "string"}, "framework": {"type": "string"}}, "required": ["code", "language"]}'::JSONB,
    '{"type": "object", "properties": {"tests": {"type": "string"}, "coverage": {"type": "number"}, "testCount": {"type": "number"}}}'::JSONB,
    ARRAY['ai', 'testing', 'automation', 'agent'],
    ARRAY['test-generation', 'unit-testing', 'tdd'],
    test_writer_prompt_id,
    'openai',
    'gpt-4',
    true
  )
  ON CONFLICT (name, version, created_by) DO NOTHING;
  
  RAISE NOTICE '  ✓ Agent components seeded';
  
  -- ============================================================================
  -- STEP 9: TRIGGER COMPONENTS (3 triggers)
  -- ============================================================================
  
  RAISE NOTICE 'Step 9: Seeding trigger components...';
  
  INSERT INTO components (
    id,
    name,
    display_name,
    description,
    component_type_id,
    version,
    created_by,
    visibility_id,
    config_schema,
    input_schema,
    output_schema,
    tags,
    capabilities,
    is_active
  ) VALUES
  -- 1. Manual Trigger
  (
    '40000000-0000-0000-0000-000000000001',
    'manual-trigger',
    'Manual Trigger',
    'Manually triggered workflow start - user clicks a button to start the workflow',
    trigger_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {}}'::JSONB,
    '{"type": "object", "properties": {"parameters": {"type": "object"}}, "required": []}'::JSONB,
    '{"type": "object", "properties": {"triggered": {"type": "boolean"}, "timestamp": {"type": "string"}, "triggeredBy": {"type": "string"}}}'::JSONB,
    ARRAY['trigger', 'manual', 'user-action'],
    ARRAY['manual-start', 'user-trigger'],
    true
  ),
  -- 2. Schedule Trigger
  (
    '40000000-0000-0000-0000-000000000002',
    'schedule-trigger',
    'Schedule Trigger',
    'Triggers workflow on a schedule using cron expression',
    trigger_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"cronExpression": {"type": "string"}, "timezone": {"type": "string", "default": "UTC"}}}'::JSONB,
    '{"type": "object", "properties": {"scheduledTime": {"type": "string"}}, "required": []}'::JSONB,
    '{"type": "object", "properties": {"triggered": {"type": "boolean"}, "scheduledTime": {"type": "string"}, "actualTime": {"type": "string"}}}'::JSONB,
    ARRAY['trigger', 'schedule', 'cron', 'automation'],
    ARRAY['scheduled-start', 'cron-trigger', 'periodic'],
    true
  ),
  -- 3. Webhook Trigger
  (
    '40000000-0000-0000-0000-000000000003',
    'webhook-trigger',
    'Webhook Trigger',
    'Triggers workflow via HTTP webhook/API call',
    trigger_type_id,
    '1.0.0',
    system_user_id,
    public_visibility_id,
    '{"type": "object", "properties": {"path": {"type": "string"}, "method": {"type": "string", "enum": ["POST", "GET"]}, "authType": {"type": "string", "enum": ["none", "bearer", "api-key"]}}}'::JSONB,
    '{"type": "object", "properties": {"headers": {"type": "object"}, "body": {"type": "object"}, "query": {"type": "object"}}, "required": []}'::JSONB,
    '{"type": "object", "properties": {"triggered": {"type": "boolean"}, "requestId": {"type": "string"}, "timestamp": {"type": "string"}}}'::JSONB,
    ARRAY['trigger', 'webhook', 'api', 'http'],
    ARRAY['webhook-start', 'api-trigger', 'http-trigger'],
    true
  )
  ON CONFLICT (name, version, created_by) DO NOTHING;
  
  RAISE NOTICE '  ✓ Trigger components seeded';
  
  -- ============================================================================
  -- STEP 10: DEMO WORKFLOWS FOR ALL USERS
  -- ============================================================================
  
  RAISE NOTICE 'Step 10: Creating demo workflows for all users...';
  
  -- Demo Project (shared by all users)
  INSERT INTO projects (
    id,
    name,
    description,
    created_by,
    task_queue_name,
    is_active
  ) VALUES (
    demo_project_id,
    'Demo Workflows',
    'Showcase workflows demonstrating agent coordination patterns',
    admin_user_id,
    'default-queue',
    TRUE
  )
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE '  ✓ Demo project created';
  
  -- Hello World Workflow (public, visible to all)
  INSERT INTO workflows (
    id,
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
    temporal_workflow_type
  ) VALUES (
    hello_world_workflow_id,
    'hello-world-demo',
    'Hello World Demo',
    'A simple greeting workflow demonstrating the basic agent coordinator system. The agent says hello and the workflow completes.',
    '1.0.0',
    active_status_id,
    public_visibility_id,
    admin_user_id,
    default_task_queue_id,
    demo_project_id,
    '{"nodes":[{"id":"start-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Start","config":{}}},{"id":"agent-1","type":"agent","position":{"x":300,"y":100},"data":{"label":"Greet","componentName":"MockAgent","config":{"workKind":"greet","payload":{"message":"Say hello"}}}},{"id":"end-1","type":"end","position":{"x":500,"y":100},"data":{"label":"Complete","config":{}}}],"edges":[{"id":"e1","source":"start-1","target":"agent-1"},{"id":"e2","source":"agent-1","target":"end-1"}]}'::jsonb,
    'helloWorldWorkflow'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE '  ✓ Hello World workflow created';
  
  -- Agent Conversation Workflow (public, visible to all)
  INSERT INTO workflows (
    id,
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
    temporal_workflow_type
  ) VALUES (
    agent_conversation_workflow_id,
    'agent-conversation-demo',
    'Agent Conversation Demo',
    'Two agents (Alice and Bob) having a conversation about their favorite programming languages.',
    '1.0.0',
    active_status_id,
    public_visibility_id,
    admin_user_id,
    default_task_queue_id,
    demo_project_id,
    '{"nodes":[{"id":"start-1","type":"trigger","position":{"x":50,"y":200},"data":{"label":"Start Conversation","config":{}}},{"id":"alice-1","type":"agent","position":{"x":250,"y":100},"data":{"label":"Alice Initiates","componentName":"MockAgent","config":{"workKind":"agent_a_initiate","agentRole":"Alice","payload":{"speaker":"Alice","message":"Hi Bob! I''m curious - what''s your favorite programming language and why?"}}}},{"id":"bob-1","type":"agent","position":{"x":450,"y":100},"data":{"label":"Bob Responds","componentName":"MockAgent","config":{"workKind":"agent_b_respond","agentRole":"Bob","payload":{"speaker":"Bob","message":"Hey Alice! I love TypeScript because of its type safety and excellent tooling. What about you?"}}}},{"id":"alice-2","type":"agent","position":{"x":250,"y":300},"data":{"label":"Alice Replies","componentName":"MockAgent","config":{"workKind":"agent_a_reply","agentRole":"Alice","payload":{"speaker":"Alice","message":"Great choice! I''m a fan of Python for its simplicity and amazing data science ecosystem."}}}},{"id":"bob-2","type":"agent","position":{"x":450,"y":300},"data":{"label":"Bob Concludes","componentName":"MockAgent","config":{"workKind":"agent_b_conclude","agentRole":"Bob","payload":{"speaker":"Bob","message":"I have! Python is fantastic for data science and scripting. Nice chatting with you!"}}}},{"id":"end-1","type":"end","position":{"x":350,"y":450},"data":{"label":"Complete","config":{}}}],"edges":[{"id":"e1","source":"start-1","target":"alice-1"},{"id":"e2","source":"alice-1","target":"bob-1"},{"id":"e3","source":"bob-1","target":"alice-2"},{"id":"e4","source":"alice-2","target":"bob-2"},{"id":"e5","source":"bob-2","target":"end-1"}]}'::jsonb,
    'agentConversationWorkflow'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE '  ✓ Agent Conversation workflow created';
  RAISE NOTICE '  ✓ Demo workflows are public and visible to all users';
  
  -- ============================================================================
  -- STEP 11: AGENT TESTER WORKFLOW (System Workflow)
  -- ============================================================================
  
  RAISE NOTICE 'Step 11: Creating Agent Tester system workflow...';
  
  INSERT INTO workflows (
    id,
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
    agent_tester_workflow_id,
    'agent-tester',
    'Agent Tester',
    'System workflow for testing agent prompts with human-in-the-loop interaction. Allows users to have conversational tests with their agent prompts.',
    '1.0.0',
    active_status_id,
    public_visibility_id,
    system_user_id,
    system_task_queue_id,
    system_project_id,
    '{"nodes": [{"id": "start", "type": "trigger", "position": {"x": 0, "y": 0}, "data": {"label": "Start"}}], "edges": []}'::jsonb,
    'agentTesterWorkflow',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create workflow start node (only if workflow was just created)
  INSERT INTO workflow_nodes (
    workflow_id,
    node_id,
    node_type,
    position,
    config,
    created_at
  )
  SELECT
    agent_tester_workflow_id,
    'start',
    'trigger',
    '{"x": 0, "y": 0}'::jsonb,
    jsonb_build_object(
      'name', 'Start',
      'description', 'Workflow start trigger'
    ),
    NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM workflow_nodes 
    WHERE workflow_id = agent_tester_workflow_id AND node_id = 'start'
  );
  
  -- ============================================================================
  -- SUMMARY
  -- ============================================================================
  
  -- ============================================================================
  -- MIGRATION COMPLETE SUMMARY
  -- ============================================================================
  
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║       Migration 20251118000002 Complete - All Seeds Applied!        ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'USERS (Created FIRST to prevent seed skipping):';
  RAISE NOTICE '  ✓ System User: system@example.com';
  RAISE NOTICE '  ✓ Admin User: admin@example.com / testpassword123';
  RAISE NOTICE '  ✓ Test User: test@example.com / testpassword123';
  RAISE NOTICE '  ✓ TestUser: testuser@example.com / testpassword123';
  RAISE NOTICE '';
  RAISE NOTICE 'SYSTEM INFRASTRUCTURE:';
  RAISE NOTICE '  ✓ System Role: "system" role created';
  RAISE NOTICE '  ✓ System Task Queue: system-workflows-queue';
  RAISE NOTICE '  ✓ System Project: "System Workflows"';
  RAISE NOTICE '  ✓ Agent Tester Workflow: Available for all users';
  RAISE NOTICE '';
  RAISE NOTICE 'PUBLIC COMPONENTS (Visible to all users):';
  RAISE NOTICE '  ✓ Activities: 6 (Fetch API, Process, Notify, Save/Read DB, Log)';
  RAISE NOTICE '  ✓ Agents: 2 (Code Analysis, Test Generation)';
  RAISE NOTICE '  ✓ Triggers: 3 (Manual, Schedule, Webhook)';
  RAISE NOTICE '  ✓ Agent Prompts: 3 (Code Analyzer, Test Writer, Doc Writer)';
  RAISE NOTICE '';
  RAISE NOTICE 'DEMO WORKFLOWS (Public - visible to all users):';
  RAISE NOTICE '  ✓ Hello World Demo: Simple greeting workflow';
  RAISE NOTICE '  ✓ Agent Conversation Demo: Alice & Bob conversation';
  RAISE NOTICE '';
  RAISE NOTICE 'READY TO USE:';
  RAISE NOTICE '  • All users can see 14 public components + 3 prompts';
  RAISE NOTICE '  • All users can access 3 demo/system workflows';
  RAISE NOTICE '  • Login with any of the test users above';
  RAISE NOTICE '  • Component palette fully populated!';
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  🎉 No more empty component palette - everything is seeded!  🎉      ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════╝';
  
END $$;

