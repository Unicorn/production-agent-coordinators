-- ============================================================================
-- MIGRATION: Map Components to Categories
-- Created: 2025-01-XX
-- Description: Maps all existing components to their appropriate categories
--              and adds keywords for AI searchability
-- ============================================================================

DO $$
DECLARE
  -- Category IDs
  start_end_id UUID;
  execution_id UUID;
  state_management_id UUID;
  api_endpoints_id UUID;
  api_gateway_id UUID;
  external_apis_id UUID;
  database_id UUID;
  cache_id UUID;
  file_storage_id UUID;
  branching_id UUID;
  loops_id UUID;
  organization_id UUID;
  ai_agents_id UUID;
  notifications_id UUID;
  service_integration_id UUID;
  
  -- Component IDs (will be looked up)
  component_id_var UUID;
BEGIN
  RAISE NOTICE 'Mapping components to categories...';

  -- Get category IDs
  SELECT id INTO start_end_id FROM component_categories WHERE name = 'start-end';
  SELECT id INTO execution_id FROM component_categories WHERE name = 'execution';
  SELECT id INTO state_management_id FROM component_categories WHERE name = 'state-management';
  SELECT id INTO api_endpoints_id FROM component_categories WHERE name = 'api-endpoints';
  SELECT id INTO api_gateway_id FROM component_categories WHERE name = 'api-gateway';
  SELECT id INTO external_apis_id FROM component_categories WHERE name = 'external-apis';
  SELECT id INTO database_id FROM component_categories WHERE name = 'database';
  SELECT id INTO cache_id FROM component_categories WHERE name = 'cache';
  SELECT id INTO file_storage_id FROM component_categories WHERE name = 'file-storage';
  SELECT id INTO branching_id FROM component_categories WHERE name = 'branching';
  SELECT id INTO loops_id FROM component_categories WHERE name = 'loops';
  SELECT id INTO organization_id FROM component_categories WHERE name = 'organization';
  SELECT id INTO ai_agents_id FROM component_categories WHERE name = 'ai-agents';
  SELECT id INTO notifications_id FROM component_categories WHERE name = 'notifications';
  SELECT id INTO service_integration_id FROM component_categories WHERE name = 'service-integration';

  -- ============================================================================
  -- TRIGGERS → start-end
  -- ============================================================================

  FOR component_id_var IN 
    SELECT id FROM components WHERE name IN ('manual-trigger', 'schedule-trigger', 'webhook-trigger')
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, start_end_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- ACTIVITIES → execution
  -- ============================================================================

  FOR component_id_var IN 
    SELECT id FROM components 
    WHERE name IN (
      'fetch-api-data', 'process-data', 'send-notification', 'save-to-database', 
      'read-from-database', 'log-message', 'compileWorkflowDefinition', 
      'validateGeneratedCode', 'registerWorkflowActivities', 
      'initializeExecutionEnvironment', 'updateExecutionStatus',
      'postgresql-query', 'redis-command', 'typescript-processor'
    )
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, execution_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- AGENTS → ai-agents
  -- ============================================================================

  FOR component_id_var IN 
    SELECT id FROM components WHERE name IN ('code-analysis-agent', 'test-generation-agent')
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, ai_agents_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- API ENDPOINTS → api-endpoints
  -- ============================================================================

  FOR component_id_var IN 
    SELECT id FROM components 
    WHERE name IN ('api-endpoint') 
    OR component_type_id IN (
      SELECT id FROM component_types WHERE name IN ('data-in', 'data-out')
    )
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, api_endpoints_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- API GATEWAY → api-gateway
  -- ============================================================================

  FOR component_id_var IN 
    SELECT id FROM components 
    WHERE name IN ('kong-logging', 'kong-cache', 'kong-cors', 'graphql-gateway')
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, api_gateway_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- DATABASE → database
  -- ============================================================================

  FOR component_id_var IN 
    SELECT id FROM components 
    WHERE name IN ('save-to-database', 'read-from-database', 'postgresql-query')
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, database_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- CACHE → cache
  -- ============================================================================

  FOR component_id_var IN 
    SELECT id FROM components WHERE name = 'redis-command'
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, cache_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- CONTROL FLOW → branching, loops, organization
  -- ============================================================================

  -- Condition → branching
  FOR component_id_var IN 
    SELECT id FROM components 
    WHERE component_type_id IN (SELECT id FROM component_types WHERE name = 'condition')
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, branching_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- Retry → loops
  FOR component_id_var IN 
    SELECT id FROM components 
    WHERE component_type_id IN (SELECT id FROM component_types WHERE name = 'retry')
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, loops_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- Phase → organization
  FOR component_id_var IN 
    SELECT id FROM components 
    WHERE component_type_id IN (SELECT id FROM component_types WHERE name = 'phase')
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, organization_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- COMMUNICATION → notifications
  -- ============================================================================

  FOR component_id_var IN 
    SELECT id FROM components WHERE name = 'send-notification'
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, notifications_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  -- ============================================================================
  -- SERVICE INTEGRATION
  -- ============================================================================

  FOR component_id_var IN 
    SELECT id FROM components 
    WHERE component_type_id IN (SELECT id FROM component_types WHERE name = 'service-container')
  LOOP
    INSERT INTO component_category_mapping (component_id, category_id, sort_order)
    VALUES (component_id_var, service_integration_id, 0)
    ON CONFLICT (component_id, category_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE '✅ Component category mappings created';

  -- ============================================================================
  -- ADD KEYWORDS FOR AI SEARCHABILITY
  -- ============================================================================

  RAISE NOTICE 'Adding keywords for AI searchability...';

  -- Fetch API Data
  SELECT id INTO component_id_var FROM components WHERE name = 'fetch-api-data';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'fetch', 1.0),
      (component_id_var, 'api', 1.0),
      (component_id_var, 'http', 0.9),
      (component_id_var, 'request', 0.9),
      (component_id_var, 'external', 0.8),
      (component_id_var, 'rest', 0.7)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Process Data
  SELECT id INTO component_id_var FROM components WHERE name = 'process-data';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'process', 1.0),
      (component_id_var, 'transform', 1.0),
      (component_id_var, 'data', 0.9),
      (component_id_var, 'etl', 0.8),
      (component_id_var, 'pipeline', 0.7)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Send Notification
  SELECT id INTO component_id_var FROM components WHERE name = 'send-notification';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'notification', 1.0),
      (component_id_var, 'send', 1.0),
      (component_id_var, 'email', 0.9),
      (component_id_var, 'slack', 0.9),
      (component_id_var, 'sms', 0.8),
      (component_id_var, 'alert', 0.8),
      (component_id_var, 'message', 0.7)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Save to Database
  SELECT id INTO component_id_var FROM components WHERE name = 'save-to-database';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'save', 1.0),
      (component_id_var, 'database', 1.0),
      (component_id_var, 'write', 0.9),
      (component_id_var, 'insert', 0.8),
      (component_id_var, 'update', 0.8),
      (component_id_var, 'persist', 0.7)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Read from Database
  SELECT id INTO component_id_var FROM components WHERE name = 'read-from-database';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'read', 1.0),
      (component_id_var, 'database', 1.0),
      (component_id_var, 'query', 0.9),
      (component_id_var, 'select', 0.8),
      (component_id_var, 'fetch', 0.7)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- PostgreSQL Query
  SELECT id INTO component_id_var FROM components WHERE name = 'postgresql-query';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'postgresql', 1.0),
      (component_id_var, 'postgres', 1.0),
      (component_id_var, 'query', 1.0),
      (component_id_var, 'sql', 0.9),
      (component_id_var, 'database', 0.8)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Redis Command
  SELECT id INTO component_id_var FROM components WHERE name = 'redis-command';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'redis', 1.0),
      (component_id_var, 'cache', 1.0),
      (component_id_var, 'key-value', 0.9),
      (component_id_var, 'get', 0.8),
      (component_id_var, 'set', 0.8)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Code Analysis Agent
  SELECT id INTO component_id_var FROM components WHERE name = 'code-analysis-agent';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'agent', 1.0),
      (component_id_var, 'ai', 1.0),
      (component_id_var, 'code', 1.0),
      (component_id_var, 'analysis', 1.0),
      (component_id_var, 'review', 0.9),
      (component_id_var, 'bug', 0.8),
      (component_id_var, 'claude', 0.7)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Test Generation Agent
  SELECT id INTO component_id_var FROM components WHERE name = 'test-generation-agent';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'agent', 1.0),
      (component_id_var, 'ai', 1.0),
      (component_id_var, 'test', 1.0),
      (component_id_var, 'generate', 1.0),
      (component_id_var, 'unit', 0.9),
      (component_id_var, 'tdd', 0.8),
      (component_id_var, 'gpt', 0.7)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Kong Logging
  SELECT id INTO component_id_var FROM components WHERE name = 'kong-logging';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'kong', 1.0),
      (component_id_var, 'logging', 1.0),
      (component_id_var, 'log', 1.0),
      (component_id_var, 'api-gateway', 0.9),
      (component_id_var, 'monitoring', 0.8)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Kong Cache
  SELECT id INTO component_id_var FROM components WHERE name = 'kong-cache';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'kong', 1.0),
      (component_id_var, 'cache', 1.0),
      (component_id_var, 'redis', 0.9),
      (component_id_var, 'api-gateway', 0.9),
      (component_id_var, 'performance', 0.8)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- Kong CORS
  SELECT id INTO component_id_var FROM components WHERE name = 'kong-cors';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'kong', 1.0),
      (component_id_var, 'cors', 1.0),
      (component_id_var, 'api-gateway', 0.9),
      (component_id_var, 'security', 0.8),
      (component_id_var, 'cross-origin', 0.8)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  -- GraphQL Gateway
  SELECT id INTO component_id_var FROM components WHERE name = 'graphql-gateway';
  IF component_id_var IS NOT NULL THEN
    INSERT INTO component_keywords (component_id, keyword, weight) VALUES
      (component_id_var, 'graphql', 1.0),
      (component_id_var, 'gateway', 1.0),
      (component_id_var, 'api', 0.9),
      (component_id_var, 'endpoint', 0.9),
      (component_id_var, 'query', 0.8),
      (component_id_var, 'mutation', 0.8)
    ON CONFLICT (component_id, keyword) DO NOTHING;
  END IF;

  RAISE NOTICE '✅ Keywords added for AI searchability';
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║     Component Category Mapping Complete!                              ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'All components have been mapped to categories';
  RAISE NOTICE 'Keywords have been added for AI searchability';

END $$;

