-- ============================================================================
-- Migration: User Defaults and Archive Support
-- Created: 2025-11-18
-- Description: 
--   - Add is_archived and is_default columns
--   - Set up default project for each user
--   - Enable archiving instead of deletion
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add archive and default columns
-- ============================================================================

-- Add is_archived to workflows
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_is_archived ON workflows(is_archived) WHERE is_archived = false;

-- Add is_archived to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_is_archived ON projects(is_archived) WHERE is_archived = false;

-- Add is_default to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_is_default ON projects(is_default, created_by);

-- Add is_default to task_queues
ALTER TABLE task_queues
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_queues_is_default ON task_queues(is_default, created_by);

-- ============================================================================
-- STEP 2: Create default project for existing users
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  default_project_id UUID;
  default_queue_id UUID;
  default_queue_name TEXT;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT id, email
    FROM users
    WHERE role_id NOT IN (SELECT id FROM user_roles WHERE name = 'system')
  LOOP
    -- Check if user already has a default project
    SELECT id INTO default_project_id
    FROM projects
    WHERE created_by = user_record.id
      AND is_default = true
    LIMIT 1;
    
    IF default_project_id IS NULL THEN
      -- Generate unique queue name for this user
      default_queue_name := user_record.id::text || '-default-queue';
      
      -- Create default task queue
      INSERT INTO task_queues (
        name,
        display_name,
        description,
        created_by,
        is_system_queue,
        is_default
      ) VALUES (
        default_queue_name,
        'Default Queue',
        'Default task queue for your workflows',
        user_record.id,
        false,
        true
      )
      RETURNING id INTO default_queue_id;
      
      -- Create default project
      INSERT INTO projects (
        name,
        description,
        created_by,
        task_queue_name,
        is_active,
        is_default
      ) VALUES (
        'Default Project',
        'Your default project for workflows',
        user_record.id,
        default_queue_name,
        true,
        true
      )
      RETURNING id INTO default_project_id;
      
      RAISE NOTICE 'Created default project and queue for user: %', user_record.email;
      
      -- Move any workflows without a project to the default project
      UPDATE workflows
      SET project_id = default_project_id
      WHERE created_by = user_record.id
        AND project_id IS NULL;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Archive old public demo workflows (if they exist)
-- ============================================================================

DO $$
DECLARE
  archived_count INTEGER;
BEGIN
  -- Archive old public demo workflows (created in previous migrations)
  UPDATE workflows
  SET is_archived = true,
      updated_at = NOW()
  WHERE kebab_name IN ('hello-world-demo', 'agent-conversation-demo')
    AND visibility_id IN (SELECT id FROM component_visibility WHERE name = 'public')
    AND is_archived = false;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  
  IF archived_count > 0 THEN
    RAISE NOTICE 'Archived % old public demo workflow(s)', archived_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Create per-user demo workflows
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  default_project_id UUID;
  default_queue_id UUID;
  hello_world_workflow_id UUID;
  agent_conversation_workflow_id UUID;
  active_status_id UUID;
  private_visibility_id UUID;
  workflow_exists BOOLEAN;
BEGIN
  -- Get status and visibility IDs
  SELECT id INTO active_status_id FROM workflow_statuses WHERE name = 'active';
  SELECT id INTO private_visibility_id FROM component_visibility WHERE name = 'private';
  
  IF active_status_id IS NULL OR private_visibility_id IS NULL THEN
    RAISE EXCEPTION 'Required status or visibility not found';
  END IF;
  
  -- For each user (except system), create their own demo workflows
  FOR user_record IN 
    SELECT DISTINCT id, email
    FROM users
    WHERE role_id NOT IN (SELECT id FROM user_roles WHERE name = 'system')
  LOOP
    -- Get user's default project
    SELECT id INTO default_project_id
    FROM projects
    WHERE created_by = user_record.id
      AND is_default = true
    LIMIT 1;
    
    -- Get user's default queue
    SELECT id INTO default_queue_id
    FROM task_queues
    WHERE created_by = user_record.id
      AND is_default = true
    LIMIT 1;
    
    IF default_project_id IS NOT NULL AND default_queue_id IS NOT NULL THEN
      -- Check if user already has demo workflows (avoid duplicates)
      SELECT EXISTS(
        SELECT 1 FROM workflows
        WHERE created_by = user_record.id
          AND kebab_name LIKE 'hello-world-demo-%'
          AND is_archived = false
      ) INTO workflow_exists;
      
      IF NOT workflow_exists THEN
        -- Generate unique IDs for this user's demo workflows
        hello_world_workflow_id := gen_random_uuid();
        agent_conversation_workflow_id := gen_random_uuid();
        
        -- Create Hello World Demo for this user
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
          is_archived
        ) VALUES (
          hello_world_workflow_id,
          'hello-world-demo-' || substring(user_record.id::text, 1, 8),
          'Hello World Demo',
          'A simple greeting workflow demonstrating the basic agent coordinator system. The agent says hello and the workflow completes.',
          '1.0.0',
          active_status_id,
          private_visibility_id,
          user_record.id,
          default_queue_id,
          default_project_id,
          '{"nodes":[{"id":"start-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Start","config":{}}},{"id":"agent-1","type":"agent","position":{"x":300,"y":100},"data":{"label":"Greet","componentName":"MockAgent","config":{"workKind":"greet","payload":{"message":"Say hello"}}}},{"id":"end-1","type":"end","position":{"x":500,"y":100},"data":{"label":"Complete","config":{}}}],"edges":[{"id":"e1","source":"start-1","target":"agent-1"},{"id":"e2","source":"agent-1","target":"end-1"}]}'::jsonb,
          'helloWorldWorkflow',
          false
        );
        
        -- Create Agent Conversation Demo for this user
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
          is_archived
        ) VALUES (
          agent_conversation_workflow_id,
          'agent-conversation-demo-' || substring(user_record.id::text, 1, 8),
          'Agent Conversation Demo',
          'Two agents (Alice and Bob) having a conversation about their favorite programming languages.',
          '1.0.0',
          active_status_id,
          private_visibility_id,
          user_record.id,
          default_queue_id,
          default_project_id,
          '{"nodes":[{"id":"start-1","type":"trigger","position":{"x":50,"y":200},"data":{"label":"Start Conversation","config":{}}},{"id":"alice-1","type":"agent","position":{"x":250,"y":100},"data":{"label":"Alice Initiates","componentName":"MockAgent","config":{"workKind":"agent_a_initiate","agentRole":"Alice","payload":{"speaker":"Alice","message":"Hi Bob! I''m curious - what''s your favorite programming language and why?"}}}},{"id":"bob-1","type":"agent","position":{"x":450,"y":100},"data":{"label":"Bob Responds","componentName":"MockAgent","config":{"workKind":"agent_b_respond","agentRole":"Bob","payload":{"speaker":"Bob","message":"Hey Alice! I love TypeScript because of its type safety and excellent tooling. What about you?"}}}},{"id":"alice-2","type":"agent","position":{"x":250,"y":300},"data":{"label":"Alice Replies","componentName":"MockAgent","config":{"workKind":"agent_a_reply","agentRole":"Alice","payload":{"speaker":"Alice","message":"Great choice! I''m a fan of Python for its simplicity and amazing data science ecosystem."}}}},{"id":"bob-2","type":"agent","position":{"x":450,"y":300},"data":{"label":"Bob Concludes","componentName":"MockAgent","config":{"workKind":"agent_b_conclude","agentRole":"Bob","payload":{"speaker":"Bob","message":"I have! Python is fantastic for data science and scripting. Nice chatting with you!"}}}},{"id":"end-1","type":"end","position":{"x":350,"y":450},"data":{"label":"Complete","config":{}}}],"edges":[{"id":"e1","source":"start-1","target":"alice-1"},{"id":"e2","source":"alice-1","target":"bob-1"},{"id":"e3","source":"bob-1","target":"alice-2"},{"id":"e4","source":"alice-2","target":"bob-2"},{"id":"e5","source":"bob-2","target":"end-1"}]}'::jsonb,
          'agentConversationWorkflow',
          false
        );
        
        RAISE NOTICE 'Created demo workflows for user: %', user_record.email;
      ELSE
        RAISE NOTICE 'Demo workflows already exist for user: %', user_record.email;
      END IF;
    ELSE
      RAISE WARNING 'Default project or queue not found for user: %', user_record.email;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Create functions and triggers for user defaults
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_user_default_project()
RETURNS TRIGGER AS $$
DECLARE
  default_project_id UUID;
  default_queue_id UUID;
  default_queue_name TEXT;
BEGIN
  -- Only create for non-system users
  IF NEW.role_id NOT IN (SELECT id FROM user_roles WHERE name = 'system') THEN
    -- Check if default project already exists
    SELECT id INTO default_project_id
    FROM projects
    WHERE created_by = NEW.id
      AND is_default = true
    LIMIT 1;
    
    IF default_project_id IS NULL THEN
      -- Generate unique queue name
      default_queue_name := NEW.id::text || '-default-queue';
      
      -- Create default task queue
      INSERT INTO task_queues (
        name,
        display_name,
        description,
        created_by,
        is_system_queue,
        is_default
      ) VALUES (
        default_queue_name,
        'Default Queue',
        'Default task queue for your workflows',
        NEW.id,
        false,
        true
      )
      RETURNING id INTO default_queue_id;
      
      -- Create default project
      INSERT INTO projects (
        name,
        description,
        created_by,
        task_queue_name,
        is_active,
        is_default
      ) VALUES (
        'Default Project',
        'Your default project for workflows',
        NEW.id,
        default_queue_name,
        true,
        true
      )
      RETURNING id INTO default_project_id;
      
      RAISE NOTICE 'Created default project and queue for new user: %', NEW.email;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_user_default_project_trigger ON users;
CREATE TRIGGER ensure_user_default_project_trigger
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_default_project();

-- ============================================================================
-- STEP 6: Create function to seed demo workflows for new users
-- ============================================================================

CREATE OR REPLACE FUNCTION seed_demo_workflows_for_user(user_id UUID)
RETURNS VOID AS $$
DECLARE
  default_project_id UUID;
  default_queue_id UUID;
  hello_world_workflow_id UUID;
  agent_conversation_workflow_id UUID;
  active_status_id UUID;
  private_visibility_id UUID;
BEGIN
  -- Get user's default project
  SELECT id INTO default_project_id
  FROM projects
  WHERE created_by = user_id
    AND is_default = true
  LIMIT 1;
  
  -- Get user's default queue
  SELECT id INTO default_queue_id
  FROM task_queues
  WHERE created_by = user_id
    AND is_default = true
  LIMIT 1;
  
  IF default_project_id IS NULL OR default_queue_id IS NULL THEN
    RAISE EXCEPTION 'Default project or queue not found for user %', user_id;
  END IF;
  
  -- Get status and visibility IDs
  SELECT id INTO active_status_id FROM workflow_statuses WHERE name = 'active';
  SELECT id INTO private_visibility_id FROM component_visibility WHERE name = 'private';
  
  -- Generate unique IDs
  hello_world_workflow_id := gen_random_uuid();
  agent_conversation_workflow_id := gen_random_uuid();
  
  -- Create Hello World Demo
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
    is_archived
  ) VALUES (
    hello_world_workflow_id,
    'hello-world-demo-' || substring(user_id::text, 1, 8),
    'Hello World Demo',
    'A simple greeting workflow demonstrating the basic agent coordinator system. The agent says hello and the workflow completes.',
    '1.0.0',
    active_status_id,
    private_visibility_id,
    user_id,
    default_queue_id,
    default_project_id,
    '{"nodes":[{"id":"start-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Start","config":{}}},{"id":"agent-1","type":"agent","position":{"x":300,"y":100},"data":{"label":"Greet","componentName":"MockAgent","config":{"workKind":"greet","payload":{"message":"Say hello"}}}},{"id":"end-1","type":"end","position":{"x":500,"y":100},"data":{"label":"Complete","config":{}}}],"edges":[{"id":"e1","source":"start-1","target":"agent-1"},{"id":"e2","source":"agent-1","target":"end-1"}]}'::jsonb,
    'helloWorldWorkflow',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Create Agent Conversation Demo
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
    is_archived
  ) VALUES (
    agent_conversation_workflow_id,
    'agent-conversation-demo-' || substring(user_id::text, 1, 8),
    'Agent Conversation Demo',
    'Two agents (Alice and Bob) having a conversation about their favorite programming languages.',
    '1.0.0',
    active_status_id,
    private_visibility_id,
    user_id,
    default_queue_id,
    default_project_id,
    '{"nodes":[{"id":"start-1","type":"trigger","position":{"x":50,"y":200},"data":{"label":"Start Conversation","config":{}}},{"id":"alice-1","type":"agent","position":{"x":250,"y":100},"data":{"label":"Alice Initiates","componentName":"MockAgent","config":{"workKind":"agent_a_initiate","agentRole":"Alice","payload":{"speaker":"Alice","message":"Hi Bob! I''m curious - what''s your favorite programming language and why?"}}}},{"id":"bob-1","type":"agent","position":{"x":450,"y":100},"data":{"label":"Bob Responds","componentName":"MockAgent","config":{"workKind":"agent_b_respond","agentRole":"Bob","payload":{"speaker":"Bob","message":"Hey Alice! I love TypeScript because of its type safety and excellent tooling. What about you?"}}}},{"id":"alice-2","type":"agent","position":{"x":250,"y":300},"data":{"label":"Alice Replies","componentName":"MockAgent","config":{"workKind":"agent_a_reply","agentRole":"Alice","payload":{"speaker":"Alice","message":"Great choice! I''m a fan of Python for its simplicity and amazing data science ecosystem."}}}},{"id":"bob-2","type":"agent","position":{"x":450,"y":300},"data":{"label":"Bob Concludes","componentName":"MockAgent","config":{"workKind":"agent_b_conclude","agentRole":"Bob","payload":{"speaker":"Bob","message":"I have! Python is fantastic for data science and scripting. Nice chatting with you!"}}}},{"id":"end-1","type":"end","position":{"x":350,"y":450},"data":{"label":"Complete","config":{}}}],"edges":[{"id":"e1","source":"start-1","target":"alice-1"},{"id":"e2","source":"alice-1","target":"bob-1"},{"id":"e3","source":"bob-1","target":"alice-2"},{"id":"e4","source":"alice-2","target":"bob-2"},{"id":"e5","source":"bob-2","target":"end-1"}]}'::jsonb,
    'agentConversationWorkflow',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  
  -- Call the seed function after a short delay to ensure project exists
  PERFORM pg_sleep(0.1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to also seed demo workflows
CREATE OR REPLACE FUNCTION ensure_user_default_project()
RETURNS TRIGGER AS $$
DECLARE
  default_project_id UUID;
  default_queue_id UUID;
  default_queue_name TEXT;
BEGIN
  -- Only create for non-system users
  IF NEW.role_id NOT IN (SELECT id FROM user_roles WHERE name = 'system') THEN
    -- Check if default project already exists
    SELECT id INTO default_project_id
    FROM projects
    WHERE created_by = NEW.id
      AND is_default = true
    LIMIT 1;
    
    IF default_project_id IS NULL THEN
      -- Generate unique queue name
      default_queue_name := NEW.id::text || '-default-queue';
      
      -- Create default task queue
      INSERT INTO task_queues (
        name,
        display_name,
        description,
        created_by,
        is_system_queue,
        is_default
      ) VALUES (
        default_queue_name,
        'Default Queue',
        'Default task queue for your workflows',
        NEW.id,
        false,
        true
      )
      RETURNING id INTO default_queue_id;
      
      -- Create default project
      INSERT INTO projects (
        name,
        description,
        created_by,
        task_queue_name,
        is_active,
        is_default
      ) VALUES (
        'Default Project',
        'Your default project for workflows',
        NEW.id,
        default_queue_name,
        true,
        true
      )
      RETURNING id INTO default_project_id;
      
      RAISE NOTICE 'Created default project and queue for new user: %', NEW.email;
      
      -- Seed demo workflows for this user
      PERFORM seed_demo_workflows_for_user(NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

