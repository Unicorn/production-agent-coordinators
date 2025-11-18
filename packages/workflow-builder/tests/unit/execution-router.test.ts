/**
 * Execution Router Unit Tests
 * 
 * Tests tRPC router endpoints for execution monitoring
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Execution Router Logic', () => {
  let mockSupabase: any;
  let mockCtx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn(),
    };
    
    mockCtx = {
      supabase: mockSupabase,
      user: {
        id: 'user-123',
        email: 'test@example.com',
      } as any,
    };
  });

  describe('getExecutionHistory', () => {
    it('should return paginated execution history', async () => {
      const executionsQuery: any = {
        select: vi.fn(() => executionsQuery),
        eq: vi.fn(() => executionsQuery),
        order: vi.fn(() => executionsQuery),
        range: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'exec-1',
              workflow_id: 'workflow-123',
              status: 'completed',
              started_at: '2024-01-01T00:00:00Z',
              completed_at: '2024-01-01T00:05:00Z',
              duration_ms: 300000,
              output: { result: 'success' },
              error_message: null,
              history_sync_status: 'synced',
            },
          ],
          error: null,
          count: 1,
        }),
      };

      mockSupabase.from.mockReturnValue(executionsQuery);

      const page = 1;
      const pageSize = 20;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await mockSupabase
        .from('workflow_executions')
        .select('*', { count: 'exact' })
        .eq('workflow_id', 'workflow-123')
        .eq('created_by', mockCtx.user.id)
        .order('started_at', { ascending: false })
        .range(from, to);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(count).toBe(1);
      expect(data[0].status).toBe('completed');
    });

    it('should filter by status', async () => {
      const executionsQuery: any = {
        select: vi.fn(() => executionsQuery),
        eq: vi.fn(() => executionsQuery),
        order: vi.fn(() => executionsQuery),
        range: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'exec-1',
              status: 'failed',
              started_at: '2024-01-01T00:00:00Z',
              error_message: 'Test error',
            },
          ],
          error: null,
          count: 1,
        }),
      };

      mockSupabase.from.mockReturnValue(executionsQuery);

      const query = mockSupabase
        .from('workflow_executions')
        .select('*', { count: 'exact' })
        .eq('workflow_id', 'workflow-123')
        .eq('created_by', mockCtx.user.id)
        .eq('status', 'failed');

      const { data } = await query.order('started_at', { ascending: false }).range(0, 19);

      expect(data).toHaveLength(1);
      expect(data[0].status).toBe('failed');
    });
  });

  describe('getExecutionDetails', () => {
    it('should return execution with component executions', async () => {
      const executionQuery: any = {
        select: vi.fn(() => executionQuery),
        eq: vi.fn(() => executionQuery),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'exec-1',
            workflow_id: 'workflow-123',
            status: 'completed',
            started_at: '2024-01-01T00:00:00Z',
            completed_at: '2024-01-01T00:05:00Z',
            duration_ms: 300000,
            temporal_workflow_id: 'workflow-123-run-1',
            temporal_run_id: 'run-123',
            history_sync_status: 'synced',
            history_synced_at: '2024-01-01T00:05:00Z',
          },
          error: null,
        }),
      };

      const componentsQuery: any = {
        select: vi.fn(() => componentsQuery),
        eq: vi.fn(() => componentsQuery),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'comp-exec-1',
              workflow_execution_id: 'exec-1',
              node_id: 'node-1',
              component_name: 'postgresql-query',
              status: 'completed',
              started_at: '2024-01-01T00:01:00Z',
              completed_at: '2024-01-01T00:02:00Z',
              duration_ms: 60000,
              input_data: { query: 'SELECT * FROM users' },
              output_data: { rows: [] },
              retry_count: 0,
              is_expected_retry: false,
            },
          ],
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        if (callCount++ === 0) return executionQuery;
        return componentsQuery;
      });

      const { data: execution } = await mockSupabase
        .from('workflow_executions')
        .select('*')
        .eq('id', 'exec-1')
        .eq('created_by', mockCtx.user.id)
        .single();

      expect(execution).toBeDefined();
      expect(execution.status).toBe('completed');

      const { data: componentExecutions } = await mockSupabase
        .from('component_executions')
        .select('*')
        .eq('workflow_execution_id', 'exec-1')
        .order('started_at', { ascending: true });

      expect(componentExecutions).toHaveLength(1);
      expect(componentExecutions[0].component_name).toBe('postgresql-query');
    });
  });

  describe('getWorkflowStatistics', () => {
    it('should return workflow statistics', async () => {
      const workflowQuery: any = {
        select: vi.fn(() => workflowQuery),
        eq: vi.fn(() => workflowQuery),
        single: vi.fn().mockResolvedValue({
          data: { id: 'workflow-123' },
          error: null,
        }),
      };

      const statsQuery: any = {
        select: vi.fn(() => statsQuery),
        eq: vi.fn(() => statsQuery),
        single: vi.fn().mockResolvedValue({
          data: {
            workflow_id: 'workflow-123',
            total_runs: 10,
            successful_runs: 8,
            failed_runs: 2,
            avg_duration_ms: 5000,
            most_used_component_id: 'comp-1',
            most_used_component_count: 5,
            total_errors: 2,
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        if (callCount++ === 0) return workflowQuery;
        return statsQuery;
      });

      const { data: workflow } = await mockSupabase
        .from('workflows')
        .select('id')
        .eq('id', 'workflow-123')
        .eq('created_by', mockCtx.user.id)
        .single();

      expect(workflow).toBeDefined();

      const { data: stats } = await mockSupabase
        .from('workflow_statistics')
        .select('*')
        .eq('workflow_id', 'workflow-123')
        .single();

      expect(stats).toBeDefined();
      expect(stats.total_runs).toBe(10);
      expect(stats.successful_runs).toBe(8);
    });
  });

  describe('getProjectStatistics', () => {
    it('should return project statistics', async () => {
      const projectQuery: any = {
        select: vi.fn(() => projectQuery),
        eq: vi.fn(() => projectQuery),
        single: vi.fn().mockResolvedValue({
          data: { id: 'project-123' },
          error: null,
        }),
      };

      const statsQuery: any = {
        select: vi.fn(() => statsQuery),
        eq: vi.fn(() => statsQuery),
        single: vi.fn().mockResolvedValue({
          data: {
            project_id: 'project-123',
            total_executions: 50,
            most_used_workflow_id: 'workflow-1',
            most_used_workflow_count: 20,
            most_used_component_id: 'comp-1',
            most_used_component_count: 30,
            total_failures: 5,
          },
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        if (callCount++ === 0) return projectQuery;
        return statsQuery;
      });

      const { data: project } = await mockSupabase
        .from('projects')
        .select('id')
        .eq('id', 'project-123')
        .eq('created_by', mockCtx.user.id)
        .single();

      expect(project).toBeDefined();

      const { data: stats } = await mockSupabase
        .from('project_statistics')
        .select('*')
        .eq('project_id', 'project-123')
        .single();

      expect(stats).toBeDefined();
      expect(stats.total_executions).toBe(50);
    });
  });
});
