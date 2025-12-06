-- ============================================================================
-- MIGRATION: Seed Component Categories
-- Created: 2025-01-XX
-- Description: Seeds the hierarchical category structure for component organization
-- ============================================================================

DO $$
DECLARE
  core_workflow_id UUID;
  api_integration_id UUID;
  data_storage_id UUID;
  control_flow_id UUID;
  ai_automation_id UUID;
  dev_tools_id UUID;
  communication_id UUID;
  service_integration_id UUID;
  
  -- Core Workflow subcategories
  start_end_id UUID;
  execution_id UUID;
  state_management_id UUID;
  
  -- API & Integration subcategories
  api_endpoints_id UUID;
  api_gateway_id UUID;
  external_apis_id UUID;
  
  -- Data & Storage subcategories
  database_id UUID;
  cache_id UUID;
  file_storage_id UUID;
  
  -- Control Flow subcategories
  branching_id UUID;
  loops_id UUID;
  organization_id UUID;
  
  -- AI & Automation subcategories
  ai_agents_id UUID;
  ai_services_id UUID;
  
  -- Development Tools subcategories
  git_ops_id UUID;
  build_test_id UUID;
  file_ops_id UUID;
  
  -- Communication subcategories
  notifications_id UUID;
  messaging_id UUID;
BEGIN
  RAISE NOTICE 'Seeding component categories...';

  -- ============================================================================
  -- TOP-LEVEL CATEGORIES
  -- ============================================================================

  -- Core Workflow
  INSERT INTO component_categories (id, name, display_name, description, icon, icon_provider, color, sort_order)
  VALUES (
    gen_random_uuid(),
    'core-workflow',
    'Core Workflow',
    'Fundamental workflow components: start/end, execution, state management',
    'Workflow',
    'lucide',
    '#3b82f6',
    1
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color
  RETURNING id INTO core_workflow_id;

  -- API & Integration
  INSERT INTO component_categories (id, name, display_name, description, icon, icon_provider, color, sort_order)
  VALUES (
    gen_random_uuid(),
    'api-integration',
    'API & Integration',
    'API endpoints, gateways, and external integrations',
    'Globe',
    'lucide',
    '#10b981',
    2
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color
  RETURNING id INTO api_integration_id;

  -- Data & Storage
  INSERT INTO component_categories (id, name, display_name, description, icon, icon_provider, color, sort_order)
  VALUES (
    gen_random_uuid(),
    'data-storage',
    'Data & Storage',
    'Database operations, caching, and file storage',
    'Database',
    'lucide',
    '#8b5cf6',
    3
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color
  RETURNING id INTO data_storage_id;

  -- Control Flow
  INSERT INTO component_categories (id, name, display_name, description, icon, icon_provider, color, sort_order)
  VALUES (
    gen_random_uuid(),
    'control-flow',
    'Control Flow',
    'Branching, loops, and workflow organization',
    'GitBranch',
    'lucide',
    '#f59e0b',
    4
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color
  RETURNING id INTO control_flow_id;

  -- AI & Automation
  INSERT INTO component_categories (id, name, display_name, description, icon, icon_provider, color, sort_order)
  VALUES (
    gen_random_uuid(),
    'ai-automation',
    'AI & Automation',
    'AI agents and automated decision making',
    'Bot',
    'lucide',
    '#a855f7',
    5
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color
  RETURNING id INTO ai_automation_id;

  -- Development Tools
  INSERT INTO component_categories (id, name, display_name, description, icon, icon_provider, color, sort_order)
  VALUES (
    gen_random_uuid(),
    'dev-tools',
    'Development Tools',
    'Git operations, build/test, and file operations',
    'Wrench',
    'lucide',
    '#06b6d4',
    6
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color
  RETURNING id INTO dev_tools_id;

  -- Communication
  INSERT INTO component_categories (id, name, display_name, description, icon, icon_provider, color, sort_order)
  VALUES (
    gen_random_uuid(),
    'communication',
    'Communication',
    'Notifications, messaging, and alerts',
    'MessageSquare',
    'lucide',
    '#ec4899',
    7
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color
  RETURNING id INTO communication_id;

  -- Service Integration
  INSERT INTO component_categories (id, name, display_name, description, icon, icon_provider, color, sort_order)
  VALUES (
    gen_random_uuid(),
    'service-integration',
    'Service Integration',
    'Service containers and external service integrations',
    'Network',
    'lucide',
    '#14b8a6',
    8
  )
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color
  RETURNING id INTO service_integration_id;

  -- Get IDs if they already existed
  IF core_workflow_id IS NULL THEN
    SELECT id INTO core_workflow_id FROM component_categories WHERE name = 'core-workflow';
  END IF;
  IF api_integration_id IS NULL THEN
    SELECT id INTO api_integration_id FROM component_categories WHERE name = 'api-integration';
  END IF;
  IF data_storage_id IS NULL THEN
    SELECT id INTO data_storage_id FROM component_categories WHERE name = 'data-storage';
  END IF;
  IF control_flow_id IS NULL THEN
    SELECT id INTO control_flow_id FROM component_categories WHERE name = 'control-flow';
  END IF;
  IF ai_automation_id IS NULL THEN
    SELECT id INTO ai_automation_id FROM component_categories WHERE name = 'ai-automation';
  END IF;
  IF dev_tools_id IS NULL THEN
    SELECT id INTO dev_tools_id FROM component_categories WHERE name = 'dev-tools';
  END IF;
  IF communication_id IS NULL THEN
    SELECT id INTO communication_id FROM component_categories WHERE name = 'communication';
  END IF;
  IF service_integration_id IS NULL THEN
    SELECT id INTO service_integration_id FROM component_categories WHERE name = 'service-integration';
  END IF;

  -- ============================================================================
  -- SUBCATEGORIES: Core Workflow
  -- ============================================================================

  INSERT INTO component_categories (name, display_name, description, icon, parent_category_id, sort_order)
  VALUES
    ('start-end', 'Start & End', 'Workflow triggers and end points', 'Play', core_workflow_id, 1),
    ('execution', 'Execution', 'Activities, agents, and child workflows', 'Activity', core_workflow_id, 2),
    ('state-management', 'State Management', 'State variables, queues, signals, queries', 'Database', core_workflow_id, 3)
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    parent_category_id = EXCLUDED.parent_category_id;

  SELECT id INTO start_end_id FROM component_categories WHERE name = 'start-end';
  SELECT id INTO execution_id FROM component_categories WHERE name = 'execution';
  SELECT id INTO state_management_id FROM component_categories WHERE name = 'state-management';

  -- ============================================================================
  -- SUBCATEGORIES: API & Integration
  -- ============================================================================

  INSERT INTO component_categories (name, display_name, description, icon, parent_category_id, sort_order)
  VALUES
    ('api-endpoints', 'API Endpoints', 'HTTP endpoints for exposing workflows', 'Globe', api_integration_id, 1),
    ('api-gateway', 'API Gateway', 'Kong gateway components (logging, cache, CORS, GraphQL)', 'Shield', api_integration_id, 2),
    ('external-apis', 'External APIs', 'HTTP requests and webhook receivers', 'Network', api_integration_id, 3)
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    parent_category_id = EXCLUDED.parent_category_id;

  SELECT id INTO api_endpoints_id FROM component_categories WHERE name = 'api-endpoints';
  SELECT id INTO api_gateway_id FROM component_categories WHERE name = 'api-gateway';
  SELECT id INTO external_apis_id FROM component_categories WHERE name = 'external-apis';

  -- ============================================================================
  -- SUBCATEGORIES: Data & Storage
  -- ============================================================================

  INSERT INTO component_categories (name, display_name, description, icon, parent_category_id, sort_order)
  VALUES
    ('database', 'Database', 'PostgreSQL, Supabase, and generic database operations', 'Database', data_storage_id, 1),
    ('cache', 'Cache', 'Redis, Upstash, and memory caching', 'Zap', data_storage_id, 2),
    ('file-storage', 'File Storage', 'Local and cloud file storage operations', 'File', data_storage_id, 3)
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    parent_category_id = EXCLUDED.parent_category_id;

  SELECT id INTO database_id FROM component_categories WHERE name = 'database';
  SELECT id INTO cache_id FROM component_categories WHERE name = 'cache';
  SELECT id INTO file_storage_id FROM component_categories WHERE name = 'file-storage';

  -- ============================================================================
  -- SUBCATEGORIES: Control Flow
  -- ============================================================================

  INSERT INTO component_categories (name, display_name, description, icon, parent_category_id, sort_order)
  VALUES
    ('branching', 'Branching', 'Conditional logic and switches', 'GitBranch', control_flow_id, 1),
    ('loops', 'Loops', 'Retry logic and iteration', 'RotateCcw', control_flow_id, 2),
    ('organization', 'Organization', 'Phases and parallel execution', 'Layers', control_flow_id, 3)
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    parent_category_id = EXCLUDED.parent_category_id;

  SELECT id INTO branching_id FROM component_categories WHERE name = 'branching';
  SELECT id INTO loops_id FROM component_categories WHERE name = 'loops';
  SELECT id INTO organization_id FROM component_categories WHERE name = 'organization';

  -- ============================================================================
  -- SUBCATEGORIES: AI & Automation
  -- ============================================================================

  INSERT INTO component_categories (name, display_name, description, icon, parent_category_id, sort_order)
  VALUES
    ('ai-agents', 'AI Agents', 'AI-powered agents for analysis and generation', 'Bot', ai_automation_id, 1),
    ('ai-services', 'AI Services', 'AI model providers and services', 'Brain', ai_automation_id, 2)
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    parent_category_id = EXCLUDED.parent_category_id;

  SELECT id INTO ai_agents_id FROM component_categories WHERE name = 'ai-agents';
  SELECT id INTO ai_services_id FROM component_categories WHERE name = 'ai-services';

  -- ============================================================================
  -- SUBCATEGORIES: Development Tools
  -- ============================================================================

  INSERT INTO component_categories (name, display_name, description, icon, parent_category_id, sort_order)
  VALUES
    ('git-operations', 'Git Operations', 'Git commit, push, branch, and PR operations', 'GitBranch', dev_tools_id, 1),
    ('build-test', 'Build & Test', 'Run builds, tests, and quality checks', 'Hammer', dev_tools_id, 2),
    ('file-operations', 'File Operations', 'Create, update, and delete files', 'FileEdit', dev_tools_id, 3)
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    parent_category_id = EXCLUDED.parent_category_id;

  SELECT id INTO git_ops_id FROM component_categories WHERE name = 'git-operations';
  SELECT id INTO build_test_id FROM component_categories WHERE name = 'build-test';
  SELECT id INTO file_ops_id FROM component_categories WHERE name = 'file-operations';

  -- ============================================================================
  -- SUBCATEGORIES: Communication
  -- ============================================================================

  INSERT INTO component_categories (name, display_name, description, icon, parent_category_id, sort_order)
  VALUES
    ('notifications', 'Notifications', 'Email, Slack, SMS, and webhook notifications', 'Bell', communication_id, 1),
    ('messaging', 'Messaging', 'Queue messages and publish events', 'MessageSquare', communication_id, 2)
  ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    parent_category_id = EXCLUDED.parent_category_id;

  SELECT id INTO notifications_id FROM component_categories WHERE name = 'notifications';
  SELECT id INTO messaging_id FROM component_categories WHERE name = 'messaging';

  RAISE NOTICE '✅ Component categories seeded successfully';
  RAISE NOTICE '  • 8 top-level categories';
  RAISE NOTICE '  • 18 subcategories';

END $$;

COMMENT ON TABLE component_categories IS 'Hierarchical category system for organizing components. Categories are organized into 8 top-level categories with 18 subcategories.';

