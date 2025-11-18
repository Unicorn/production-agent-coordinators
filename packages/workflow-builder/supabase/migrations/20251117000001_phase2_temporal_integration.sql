-- Phase 2: Temporal Integration
-- User + Project → Task Queue architecture with database-stored compiled code

BEGIN;

-- ============================================================================
-- 1. PROJECTS TABLE
-- ============================================================================
-- Projects group workflows and define task queues (user + project = task queue)

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Task queue name: user_id-project_id
  task_queue_name VARCHAR(255) NOT NULL UNIQUE,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Future: Statistics for optimization
  total_workflow_executions BIGINT DEFAULT 0,
  total_activity_executions BIGINT DEFAULT 0,
  avg_execution_duration_ms INTEGER DEFAULT 0,
  last_execution_at TIMESTAMPTZ,
  
  CONSTRAINT unique_user_project_name UNIQUE(created_by, name)
);

-- Indexes
CREATE INDEX idx_projects_task_queue ON public.projects(task_queue_name);
CREATE INDEX idx_projects_created_by ON public.projects(created_by);
CREATE INDEX idx_projects_active ON public.projects(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (auth.uid() IN (
    SELECT auth_user_id FROM public.users WHERE id = created_by
  ));

CREATE POLICY "Users can create their own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT auth_user_id FROM public.users WHERE id = created_by
  ));

CREATE POLICY "Users can update their own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() IN (
    SELECT auth_user_id FROM public.users WHERE id = created_by
  ));

CREATE POLICY "Users can delete their own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() IN (
    SELECT auth_user_id FROM public.users WHERE id = created_by
  ));

-- ============================================================================
-- 2. UPDATE WORKFLOWS TABLE - ADD PROJECT ASSOCIATION
-- ============================================================================

-- Add project_id column to workflows
ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Index
CREATE INDEX IF NOT EXISTS idx_workflows_project ON public.workflows(project_id);

-- Note: Existing workflows will have NULL project_id
-- We'll create a default project for them in a data migration

-- ============================================================================
-- 3. COMPILED CODE STORAGE
-- ============================================================================
-- Store compiled workflow code in database (not file system)

CREATE TABLE IF NOT EXISTS public.workflow_compiled_code (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  
  -- Compiled code (stored as TEXT)
  workflow_code TEXT NOT NULL,
  activities_code TEXT NOT NULL,
  worker_code TEXT NOT NULL,
  package_json TEXT NOT NULL,
  tsconfig_json TEXT NOT NULL,
  
  -- Metadata
  compiled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  compiled_by UUID REFERENCES public.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Future: Statistics for optimization
  execution_count BIGINT DEFAULT 0,
  avg_execution_duration_ms INTEGER DEFAULT 0,
  error_count BIGINT DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  
  CONSTRAINT unique_workflow_version UNIQUE(workflow_id, version)
);

-- Indexes
CREATE INDEX idx_compiled_code_workflow ON public.workflow_compiled_code(workflow_id);
CREATE INDEX idx_compiled_code_active ON public.workflow_compiled_code(is_active) WHERE is_active = true;
CREATE INDEX idx_compiled_code_version ON public.workflow_compiled_code(workflow_id, version);

-- RLS Policies
ALTER TABLE public.workflow_compiled_code ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view compiled code for their workflows"
  ON public.workflow_compiled_code FOR SELECT
  USING (
    workflow_id IN (
      SELECT w.id FROM public.workflows w
      JOIN public.users u ON w.created_by = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create compiled code for their workflows"
  ON public.workflow_compiled_code FOR INSERT
  WITH CHECK (
    workflow_id IN (
      SELECT w.id FROM public.workflows w
      JOIN public.users u ON w.created_by = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update compiled code for their workflows"
  ON public.workflow_compiled_code FOR UPDATE
  USING (
    workflow_id IN (
      SELECT w.id FROM public.workflows w
      JOIN public.users u ON w.created_by = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. WORKER REGISTRY
-- ============================================================================
-- Track workers (one per project)

CREATE TABLE IF NOT EXISTS public.workflow_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Link to project (one worker per user+project)
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_queue_name VARCHAR(255) NOT NULL,
  
  -- Worker status
  status VARCHAR(50) NOT NULL CHECK (status IN ('starting', 'running', 'stopping', 'stopped', 'failed')),
  host VARCHAR(255),
  port INTEGER,
  process_id VARCHAR(255),
  
  -- Lifecycle
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  last_heartbeat TIMESTAMPTZ,
  
  -- Future: Statistics for optimization
  total_tasks_completed BIGINT DEFAULT 0,
  total_tasks_failed BIGINT DEFAULT 0,
  avg_task_duration_ms INTEGER DEFAULT 0,
  cpu_usage_percent DECIMAL(5,2),
  memory_usage_mb INTEGER,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workers_project ON public.workflow_workers(project_id);
CREATE INDEX idx_workers_task_queue ON public.workflow_workers(task_queue_name);
CREATE INDEX idx_workers_status ON public.workflow_workers(status);

-- Only one active worker per project
CREATE UNIQUE INDEX idx_one_active_worker_per_project 
  ON public.workflow_workers(project_id) 
  WHERE status IN ('starting', 'running');

-- RLS Policies
ALTER TABLE public.workflow_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workers for their projects"
  ON public.workflow_workers FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.created_by = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage workers"
  ON public.workflow_workers FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. ACTIVITY STATISTICS (Future Optimization)
-- ============================================================================
-- Track individual activity performance for future worker splitting

CREATE TABLE IF NOT EXISTS public.activity_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  activity_name VARCHAR(255) NOT NULL,
  
  -- Statistics
  execution_count BIGINT DEFAULT 0,
  success_count BIGINT DEFAULT 0,
  failure_count BIGINT DEFAULT 0,
  avg_duration_ms INTEGER DEFAULT 0,
  p95_duration_ms INTEGER,
  p99_duration_ms INTEGER,
  
  -- Last updated
  last_executed_at TIMESTAMPTZ,
  
  -- Future: Use this to identify high-usage activities that need dedicated workers
  requires_dedicated_worker BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_project_activity UNIQUE(project_id, activity_name)
);

-- Indexes
CREATE INDEX idx_activity_stats_project ON public.activity_statistics(project_id);
CREATE INDEX idx_activity_stats_high_usage ON public.activity_statistics(execution_count DESC);
CREATE INDEX idx_activity_stats_high_duration ON public.activity_statistics(avg_duration_ms DESC);

-- RLS Policies
ALTER TABLE public.activity_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view statistics for their projects"
  ON public.activity_statistics FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM public.projects p
      JOIN public.users u ON p.created_by = u.id
      WHERE u.auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. DATABASE FUNCTIONS FOR STATISTICS
-- ============================================================================

-- Increment project statistics (atomic)
CREATE OR REPLACE FUNCTION increment_project_stats(
  p_project_id UUID,
  p_duration_ms INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.projects
  SET 
    total_workflow_executions = total_workflow_executions + 1,
    avg_execution_duration_ms = CASE 
      WHEN total_workflow_executions = 0 THEN p_duration_ms
      ELSE (avg_execution_duration_ms * total_workflow_executions + p_duration_ms) / (total_workflow_executions + 1)
    END,
    last_execution_at = NOW(),
    updated_at = NOW()
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment compiled code statistics
CREATE OR REPLACE FUNCTION increment_code_stats(
  p_workflow_id UUID,
  p_duration_ms INTEGER,
  p_success BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.workflow_compiled_code
  SET 
    execution_count = execution_count + 1,
    avg_execution_duration_ms = CASE 
      WHEN execution_count = 0 THEN p_duration_ms
      ELSE (avg_execution_duration_ms * execution_count + p_duration_ms) / (execution_count + 1)
    END,
    error_count = CASE WHEN NOT p_success THEN error_count + 1 ELSE error_count END,
    last_executed_at = NOW()
  WHERE workflow_id = p_workflow_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update activity statistics
CREATE OR REPLACE FUNCTION update_activity_stats(
  p_project_id UUID,
  p_activity_name VARCHAR,
  p_duration_ms INTEGER,
  p_success BOOLEAN
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.activity_statistics (
    project_id,
    activity_name,
    execution_count,
    success_count,
    failure_count,
    avg_duration_ms,
    last_executed_at
  ) VALUES (
    p_project_id,
    p_activity_name,
    1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    p_duration_ms,
    NOW()
  )
  ON CONFLICT (project_id, activity_name) DO UPDATE SET
    execution_count = activity_statistics.execution_count + 1,
    success_count = activity_statistics.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    failure_count = activity_statistics.failure_count + CASE WHEN p_success THEN 0 ELSE 1 END,
    avg_duration_ms = CASE 
      WHEN activity_statistics.execution_count = 0 THEN p_duration_ms
      ELSE (activity_statistics.avg_duration_ms * activity_statistics.execution_count + p_duration_ms) / (activity_statistics.execution_count + 1)
    END,
    last_executed_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. DATA MIGRATION - CREATE DEFAULT PROJECT FOR EXISTING WORKFLOWS
-- ============================================================================

-- Create a default project for each user that has workflows without a project
DO $$
DECLARE
  user_record RECORD;
  default_project_id UUID;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT created_by 
    FROM public.workflows 
    WHERE project_id IS NULL
  LOOP
    -- Create default project for this user
    INSERT INTO public.projects (
      name,
      description,
      created_by,
      task_queue_name
    ) VALUES (
      'Default Project',
      'Auto-created project for existing workflows',
      user_record.created_by,
      user_record.created_by || '-default-' || gen_random_uuid()
    )
    RETURNING id INTO default_project_id;
    
    -- Assign all workflows without a project to this default project
    UPDATE public.workflows
    SET project_id = default_project_id
    WHERE created_by = user_record.created_by
      AND project_id IS NULL;
  END LOOP;
END $$;

-- Make project_id NOT NULL after migration
ALTER TABLE public.workflows
  ALTER COLUMN project_id SET NOT NULL;

COMMIT;




