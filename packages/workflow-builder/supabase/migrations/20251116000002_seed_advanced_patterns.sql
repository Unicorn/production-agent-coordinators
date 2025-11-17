-- ============================================================================
-- MIGRATION: Seed Data for Advanced Workflow Patterns
-- Created: 2025-11-16
-- Description: Insert example workflows demonstrating advanced patterns
--              (scheduled workflows, work queues, signals, queries)
-- ============================================================================

-- This migration depends on a default user existing in the system
-- We'll use a placeholder user_id that should be updated after first user signup

-- ============================================================================
-- EXAMPLE 1: Plan Writer Coordinator Workflow
-- ============================================================================

-- Note: In production, this would be created through the UI
-- This is just for demonstration and testing

DO $$
DECLARE
  v_workflow_id UUID;
  v_user_id UUID;
  v_draft_status_id UUID;
  v_default_queue_id UUID;
  v_work_queue_id UUID;
  v_check_workflow_id UUID;
BEGIN
  -- Get first user (or create placeholder)
  SELECT id INTO v_user_id FROM users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No users found - skipping seed data. Run after first user signup.';
    RETURN;
  END IF;

  -- Get draft status
  SELECT id INTO v_draft_status_id FROM workflow_statuses WHERE name = 'draft' LIMIT 1;
  
  -- Get default task queue
  SELECT id INTO v_default_queue_id FROM task_queues WHERE name = 'default' LIMIT 1;

  -- Create main coordinator workflow
  INSERT INTO workflows (
    name,
    description,
    status_id,
    default_task_queue_id,
    visibility_id,
    created_by
  ) VALUES (
    'Plan Writer Coordinator',
    'Coordinates plan writing with automated plan discovery via scheduled workflow',
    v_draft_status_id,
    v_default_queue_id,
    (SELECT id FROM component_visibility WHERE name = 'public' LIMIT 1),
    v_user_id
  ) RETURNING id INTO v_workflow_id;

  RAISE NOTICE 'Created main workflow: %', v_workflow_id;

  -- Create work queue for plans to write
  INSERT INTO workflow_work_queues (
    workflow_id,
    queue_name,
    description,
    signal_name,
    query_name,
    max_size,
    priority,
    deduplicate,
    work_item_schema,
    created_by
  ) VALUES (
    v_workflow_id,
    'plansToWrite',
    'Queue of plans that need to be written',
    'addPlanToQueue',
    'getPlansToWrite',
    100,
    'fifo',
    true,
    '{"type": "object", "properties": {"planId": {"type": "string"}, "priority": {"type": "number"}}}'::jsonb,
    v_user_id
  ) RETURNING id INTO v_work_queue_id;

  RAISE NOTICE 'Created work queue: %', v_work_queue_id;
  
  -- Note: Trigger automatically created signal and query handlers

  -- Create scheduled child workflow (cron)
  INSERT INTO workflows (
    name,
    description,
    status_id,
    default_task_queue_id,
    visibility_id,
    is_scheduled,
    schedule_spec,
    parent_workflow_id,
    signal_to_parent_name,
    start_immediately,
    end_with_parent,
    created_by
  ) VALUES (
    'Check for Plans (Cron)',
    'Runs every 30 minutes to check for plans that need writing',
    v_draft_status_id,
    (SELECT id FROM task_queues WHERE name = 'cron-queue' LIMIT 1),
    (SELECT id FROM component_visibility WHERE name = 'private' LIMIT 1),
    true,
    '*/30 * * * *',  -- Every 30 minutes
    v_workflow_id,
    'addPlanToQueue',
    true,
    true,
    v_user_id
  ) RETURNING id INTO v_check_workflow_id;

  RAISE NOTICE 'Created scheduled workflow: %', v_check_workflow_id;

  -- Create main workflow nodes (simplified for example)
  INSERT INTO workflow_nodes (workflow_id, node_id, type, label, position_x, position_y, config) VALUES
    (v_workflow_id, 'trigger-1', 'trigger', 'Start', 100, 100, '{}'::jsonb),
    (v_workflow_id, 'activity-1', 'activity', 'Process Plan Queue', 300, 100, '{"activityName": "processPlanQueue"}'::jsonb),
    (v_workflow_id, 'activity-2', 'activity', 'Write Plan', 500, 100, '{"activityName": "writePlan"}'::jsonb);

  -- Create scheduled workflow nodes
  INSERT INTO workflow_nodes (workflow_id, node_id, type, label, position_x, position_y, config, signal_to_parent, work_queue_target) VALUES
    (v_check_workflow_id, 'trigger-1', 'trigger', 'Start Cron', 100, 100, '{}'::jsonb, NULL, NULL),
    (v_check_workflow_id, 'activity-1', 'activity', 'Check for Plans', 300, 100, '{"activityName": "checkForPlansNeedingWrite"}'::jsonb, NULL, NULL),
    (v_check_workflow_id, 'signal-1', 'signal', 'Signal Parent with Plans', 500, 100, '{}'::jsonb, 'addPlanToQueue', 'plansToWrite');

  RAISE NOTICE 'Seed data for Plan Writer Coordinator completed successfully';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error seeding data: %', SQLERRM;
END $$;

-- ============================================================================
-- EXAMPLE 2: Dependency Chain Workflow
-- ============================================================================

DO $$
DECLARE
  v_workflow_id UUID;
  v_user_id UUID;
  v_draft_status_id UUID;
  v_default_queue_id UUID;
  v_tests_queue_id UUID;
BEGIN
  -- Get first user
  SELECT id INTO v_user_id FROM users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Get draft status
  SELECT id INTO v_draft_status_id FROM workflow_statuses WHERE name = 'draft' LIMIT 1;
  
  -- Get default task queue
  SELECT id INTO v_default_queue_id FROM task_queues WHERE name = 'default' LIMIT 1;

  -- Create main workflow
  INSERT INTO workflows (
    name,
    description,
    status_id,
    default_task_queue_id,
    visibility_id,
    created_by
  ) VALUES (
    'Build with Test Dependencies',
    'Demonstrates dependency blocking: build waits for all tests to complete',
    v_draft_status_id,
    v_default_queue_id,
    (SELECT id FROM component_visibility WHERE name = 'public' LIMIT 1),
    v_user_id
  ) RETURNING id INTO v_workflow_id;

  -- Create work queue for tests
  INSERT INTO workflow_work_queues (
    workflow_id,
    queue_name,
    description,
    signal_name,
    query_name,
    priority,
    created_by
  ) VALUES (
    v_workflow_id,
    'tests',
    'Queue of tests that need to run',
    'addTestToQueue',
    'getTestsStatus',
    'fifo',
    v_user_id
  ) RETURNING id INTO v_tests_queue_id;

  -- Create nodes with blocking dependencies
  INSERT INTO workflow_nodes (workflow_id, node_id, type, label, position_x, position_y, config, block_until_queue) VALUES
    (v_workflow_id, 'trigger-1', 'trigger', 'Start', 100, 100, '{}'::jsonb, NULL),
    (v_workflow_id, 'child-1', 'child-workflow', 'Run Tests', 300, 100, '{"workflowName": "runTestsWorkflow"}'::jsonb, NULL),
    (v_workflow_id, 'child-2', 'child-workflow', 'Build Application', 500, 100, '{"workflowName": "buildWorkflow"}'::jsonb, 'tests');  -- Blocks until tests queue is empty

  RAISE NOTICE 'Seed data for dependency chain workflow completed successfully';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error seeding dependency chain data: %', SQLERRM;
END $$;

-- ============================================================================
-- LOG COMPLETION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 20251116000002_seed_advanced_patterns completed';
  RAISE NOTICE 'Created example workflows: Plan Writer Coordinator, Build with Test Dependencies';
  RAISE NOTICE 'Note: Examples will only be created if at least one user exists in the system';
END $$;

