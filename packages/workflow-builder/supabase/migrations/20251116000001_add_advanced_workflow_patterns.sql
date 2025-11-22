-- ============================================================================
-- MIGRATION: Add Advanced Workflow Patterns Support
-- Created: 2025-11-16
-- Description: Adds support for scheduled workflows (cron), work queues,
--              signals, queries, and enhanced child workflow communication
-- ============================================================================

-- ============================================================================
-- WORKFLOW WORK QUEUES
-- ============================================================================
-- NOTE: This table must be created FIRST because workflow_queries and 
-- workflow_signals reference it via foreign key

CREATE TABLE IF NOT EXISTS workflow_work_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  queue_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Automatically created signal/query for this queue
  signal_name VARCHAR(100) NOT NULL,  -- e.g., 'addToQueue'
  query_name VARCHAR(100) NOT NULL,   -- e.g., 'getQueueStatus'
  
  -- Queue configuration
  max_size INTEGER,  -- NULL = unlimited
  priority VARCHAR(20) NOT NULL DEFAULT 'fifo' CHECK (priority IN ('fifo', 'lifo', 'priority')),
  deduplicate BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Work item schema
  work_item_schema JSONB,  -- JSON schema of work items
  
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique queue names per workflow
  CONSTRAINT unique_queue_name_per_workflow UNIQUE (workflow_id, queue_name),
  -- Ensure signal/query names are unique per workflow
  CONSTRAINT unique_signal_name_per_workflow_queue UNIQUE (workflow_id, signal_name),
  CONSTRAINT unique_query_name_per_workflow_queue UNIQUE (workflow_id, query_name)
);

CREATE INDEX idx_workflow_work_queues_workflow_id ON workflow_work_queues(workflow_id);
CREATE INDEX idx_workflow_work_queues_priority ON workflow_work_queues(priority);

COMMENT ON TABLE workflow_work_queues IS 'Work queues on coordinator workflows - hold pending work items';
COMMENT ON COLUMN workflow_work_queues.queue_name IS 'Unique name of the work queue (e.g., plansToWrite)';
COMMENT ON COLUMN workflow_work_queues.signal_name IS 'Auto-generated signal handler name for adding items';
COMMENT ON COLUMN workflow_work_queues.query_name IS 'Auto-generated query handler name for checking queue';
COMMENT ON COLUMN workflow_work_queues.priority IS 'Queue ordering: fifo (first-in-first-out), lifo (last-in-first-out), or priority';
COMMENT ON COLUMN workflow_work_queues.deduplicate IS 'Whether to prevent duplicate work items';
COMMENT ON COLUMN workflow_work_queues.work_item_schema IS 'JSON schema describing work items in the queue';

-- ============================================================================
-- WORKFLOW QUERIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  query_name VARCHAR(100) NOT NULL,
  description TEXT,
  return_type JSONB,  -- JSON schema of return type
  auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  work_queue_id UUID REFERENCES workflow_work_queues(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique query names per workflow
  CONSTRAINT unique_query_name_per_workflow UNIQUE (workflow_id, query_name)
);

CREATE INDEX idx_workflow_queries_workflow_id ON workflow_queries(workflow_id);
CREATE INDEX idx_workflow_queries_auto_generated ON workflow_queries(auto_generated);
CREATE INDEX idx_workflow_queries_work_queue_id ON workflow_queries(work_queue_id);

COMMENT ON TABLE workflow_queries IS 'Query handlers on workflows - allow read-only state inspection';
COMMENT ON COLUMN workflow_queries.query_name IS 'Unique name of the query handler (e.g., getPlansToWrite)';
COMMENT ON COLUMN workflow_queries.auto_generated IS 'True if auto-generated from work queue';
COMMENT ON COLUMN workflow_queries.return_type IS 'JSON schema describing the query return type';

-- ============================================================================
-- WORKFLOW SIGNALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  signal_name VARCHAR(100) NOT NULL,
  description TEXT,
  parameters JSONB,  -- JSON schema of signal parameters
  auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  work_queue_id UUID REFERENCES workflow_work_queues(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique signal names per workflow
  CONSTRAINT unique_signal_name_per_workflow UNIQUE (workflow_id, signal_name)
);

CREATE INDEX idx_workflow_signals_workflow_id ON workflow_signals(workflow_id);
CREATE INDEX idx_workflow_signals_auto_generated ON workflow_signals(auto_generated);
CREATE INDEX idx_workflow_signals_work_queue_id ON workflow_signals(work_queue_id);

COMMENT ON TABLE workflow_signals IS 'Signal handlers on workflows - allow external communication';
COMMENT ON COLUMN workflow_signals.signal_name IS 'Unique name of the signal handler (e.g., addPlanToQueue)';
COMMENT ON COLUMN workflow_signals.auto_generated IS 'True if auto-generated from work queue or scheduled workflow';
COMMENT ON COLUMN workflow_signals.parameters IS 'JSON schema describing the signal parameters';

-- ============================================================================
-- EXTEND WORKFLOWS TABLE FOR SCHEDULED WORKFLOWS
-- ============================================================================

-- Add columns for scheduled workflow support
ALTER TABLE workflows
  ADD COLUMN is_scheduled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN schedule_spec VARCHAR(100),  -- Cron expression
  ADD COLUMN parent_workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  ADD COLUMN signal_to_parent_name VARCHAR(100),
  ADD COLUMN query_parent_name VARCHAR(100),
  ADD COLUMN start_immediately BOOLEAN DEFAULT TRUE,
  ADD COLUMN end_with_parent BOOLEAN DEFAULT TRUE,
  ADD COLUMN max_runs INTEGER,  -- NULL = unlimited
  ADD COLUMN last_run_at TIMESTAMPTZ,
  ADD COLUMN next_run_at TIMESTAMPTZ,
  ADD COLUMN run_count INTEGER DEFAULT 0;

CREATE INDEX idx_workflows_is_scheduled ON workflows(is_scheduled);
CREATE INDEX idx_workflows_parent_workflow_id ON workflows(parent_workflow_id);
CREATE INDEX idx_workflows_next_run_at ON workflows(next_run_at) WHERE is_scheduled = TRUE;

COMMENT ON COLUMN workflows.is_scheduled IS 'True if this is a scheduled (cron) workflow';
COMMENT ON COLUMN workflows.schedule_spec IS 'Cron expression for scheduled workflows (e.g., */30 * * * *)';
COMMENT ON COLUMN workflows.parent_workflow_id IS 'Parent workflow ID for child/scheduled workflows';
COMMENT ON COLUMN workflows.signal_to_parent_name IS 'Signal name for sending data to parent';
COMMENT ON COLUMN workflows.query_parent_name IS 'Query name for checking parent state';
COMMENT ON COLUMN workflows.start_immediately IS 'Start scheduled workflow when parent starts';
COMMENT ON COLUMN workflows.end_with_parent IS 'Terminate scheduled workflow when parent completes';
COMMENT ON COLUMN workflows.max_runs IS 'Maximum number of runs (NULL = unlimited)';
COMMENT ON COLUMN workflows.last_run_at IS 'Timestamp of last scheduled run';
COMMENT ON COLUMN workflows.next_run_at IS 'Timestamp of next scheduled run';
COMMENT ON COLUMN workflows.run_count IS 'Number of times this scheduled workflow has run';

-- ============================================================================
-- EXTEND WORKFLOW NODES FOR ADVANCED PATTERNS
-- ============================================================================

-- Add columns for enhanced child workflow communication
ALTER TABLE workflow_nodes
  ADD COLUMN signal_to_parent VARCHAR(100),
  ADD COLUMN query_parent VARCHAR(100),
  ADD COLUMN work_queue_target VARCHAR(100),
  ADD COLUMN block_until_queue VARCHAR(100),
  ADD COLUMN block_until_work_items JSONB;  -- Array of work item IDs

CREATE INDEX idx_workflow_nodes_signal_to_parent ON workflow_nodes(signal_to_parent) WHERE signal_to_parent IS NOT NULL;
CREATE INDEX idx_workflow_nodes_query_parent ON workflow_nodes(query_parent) WHERE query_parent IS NOT NULL;
CREATE INDEX idx_workflow_nodes_work_queue_target ON workflow_nodes(work_queue_target) WHERE work_queue_target IS NOT NULL;

COMMENT ON COLUMN workflow_nodes.signal_to_parent IS 'Signal name for child to send to parent';
COMMENT ON COLUMN workflow_nodes.query_parent IS 'Query name for child to query parent';
COMMENT ON COLUMN workflow_nodes.work_queue_target IS 'Work queue name to interact with';
COMMENT ON COLUMN workflow_nodes.block_until_queue IS 'Work queue name to wait for (dependency blocking)';
COMMENT ON COLUMN workflow_nodes.block_until_work_items IS 'Specific work item IDs to wait for';

-- ============================================================================
-- EXTEND COMPONENT TYPES FOR NEW NODE TYPES
-- ============================================================================

-- Add new component types
INSERT INTO component_types (name, description, icon) VALUES
  ('query', 'Query handler for read-only state inspection', 'search'),
  ('scheduled-workflow', 'Scheduled (cron) child workflow', 'clock'),
  ('work-queue', 'Work queue for pending items', 'inbox')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE workflow_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_work_queues ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON workflow_queries TO authenticated;
GRANT INSERT ON workflow_queries TO authenticated;
GRANT UPDATE ON workflow_queries TO authenticated;
GRANT DELETE ON workflow_queries TO authenticated;

GRANT SELECT ON workflow_signals TO authenticated;
GRANT INSERT ON workflow_signals TO authenticated;
GRANT UPDATE ON workflow_signals TO authenticated;
GRANT DELETE ON workflow_signals TO authenticated;

GRANT SELECT ON workflow_work_queues TO authenticated;
GRANT INSERT ON workflow_work_queues TO authenticated;
GRANT UPDATE ON workflow_work_queues TO authenticated;
GRANT DELETE ON workflow_work_queues TO authenticated;

-- Policies for workflow_queries
CREATE POLICY "Users can view queries for their workflows" ON workflow_queries
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create queries for their workflows" ON workflow_queries
  FOR INSERT WITH CHECK (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update queries for their workflows" ON workflow_queries
  FOR UPDATE USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete queries for their workflows" ON workflow_queries
  FOR DELETE USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
  );

-- Policies for workflow_signals
CREATE POLICY "Users can view signals for their workflows" ON workflow_signals
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create signals for their workflows" ON workflow_signals
  FOR INSERT WITH CHECK (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update signals for their workflows" ON workflow_signals
  FOR UPDATE USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete signals for their workflows" ON workflow_signals
  FOR DELETE USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
  );

-- Policies for workflow_work_queues
CREATE POLICY "Users can view work queues for their workflows" ON workflow_work_queues
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create work queues for their workflows" ON workflow_work_queues
  FOR INSERT WITH CHECK (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update work queues for their workflows" ON workflow_work_queues
  FOR UPDATE USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete work queues for their workflows" ON workflow_work_queues
  FOR DELETE USING (
    workflow_id IN (
      SELECT id FROM workflows WHERE created_by = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC SIGNAL/QUERY CREATION
-- ============================================================================

-- Function to auto-create signal and query for work queue
CREATE OR REPLACE FUNCTION auto_create_work_queue_handlers()
RETURNS TRIGGER AS $$
DECLARE
  v_workflow_creator UUID;
BEGIN
  -- Get workflow creator
  SELECT created_by INTO v_workflow_creator
  FROM workflows
  WHERE id = NEW.workflow_id;

  -- Create signal handler for adding to queue
  INSERT INTO workflow_signals (
    workflow_id,
    signal_name,
    description,
    auto_generated,
    work_queue_id,
    created_by
  ) VALUES (
    NEW.workflow_id,
    NEW.signal_name,
    format('Auto-generated signal handler for work queue: %s', NEW.queue_name),
    TRUE,
    NEW.id,
    v_workflow_creator
  );

  -- Create query handler for checking queue
  INSERT INTO workflow_queries (
    workflow_id,
    query_name,
    description,
    auto_generated,
    work_queue_id,
    created_by
  ) VALUES (
    NEW.workflow_id,
    NEW.query_name,
    format('Auto-generated query handler for work queue: %s', NEW.queue_name),
    TRUE,
    NEW.id,
    v_workflow_creator
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create handlers when work queue is created
CREATE TRIGGER on_work_queue_created
  AFTER INSERT ON workflow_work_queues
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_work_queue_handlers();

GRANT EXECUTE ON FUNCTION auto_create_work_queue_handlers() TO authenticated;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to validate cron expression (basic validation)
CREATE OR REPLACE FUNCTION validate_cron_expression(cron_expr VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  -- Basic validation: 5 or 6 space-separated fields
  -- Full validation would require more complex logic or external library
  RETURN (
    cron_expr IS NOT NULL
    AND cron_expr ~ '^(\S+\s+){4,5}\S+$'
    AND length(cron_expr) <= 100
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_cron_expression IS 'Basic validation of cron expression format';

-- Function to detect circular dependencies in block_until
CREATE OR REPLACE FUNCTION check_circular_block_dependencies(
  p_workflow_id UUID,
  p_node_id UUID,
  p_block_queue VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_cycle BOOLEAN;
BEGIN
  -- Check if any node that adds to p_block_queue is blocked by a queue
  -- that this node adds to (simplified check - real implementation would be recursive)
  
  -- For now, just check direct circular dependencies
  SELECT EXISTS (
    SELECT 1
    FROM workflow_nodes n1
    JOIN workflow_nodes n2 ON n1.workflow_id = n2.workflow_id
    WHERE n1.workflow_id = p_workflow_id
      AND n1.id = p_node_id
      AND n1.work_queue_target IS NOT NULL
      AND n2.block_until_queue = n1.work_queue_target
      AND n1.block_until_queue = n2.work_queue_target
  ) INTO v_has_cycle;
  
  RETURN NOT v_has_cycle;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_circular_block_dependencies IS 'Check for circular dependencies in block_until configuration';

-- ============================================================================
-- VALIDATION CONSTRAINTS
-- ============================================================================

-- Add check constraint for scheduled workflows
ALTER TABLE workflows
  ADD CONSTRAINT check_scheduled_workflow_has_spec
    CHECK (
      (is_scheduled = FALSE AND schedule_spec IS NULL)
      OR
      (is_scheduled = TRUE AND schedule_spec IS NOT NULL AND validate_cron_expression(schedule_spec))
    );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20251116000001_add_advanced_workflow_patterns completed successfully';
  RAISE NOTICE 'Added tables: workflow_queries, workflow_signals, workflow_work_queues';
  RAISE NOTICE 'Extended tables: workflows, workflow_nodes';
  RAISE NOTICE 'Added component types: query, scheduled-workflow, work-queue';
  RAISE NOTICE 'Added RLS policies and auto-generation triggers';
END $$;

