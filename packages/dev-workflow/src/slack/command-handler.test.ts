import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDevWorkflowCommand } from './command-handler';

// Mock the temporal connection module
vi.mock('../temporal/connection', () => ({
  getTemporalClient: vi.fn().mockResolvedValue({
    workflow: {
      start: vi.fn().mockResolvedValue({
        workflowId: 'test-workflow-id'
      }),
      list: vi.fn().mockResolvedValue([])
    }
  }),
  closeTemporalConnection: vi.fn().mockResolvedValue(undefined),
  checkTemporalHealth: vi.fn().mockResolvedValue(true)
}));

describe('Slack Command Handler', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment to clean state
    process.env = { ...originalEnv };
    // Set required environment variable
    process.env.REPO_PATH = '/test/repo/path';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should parse /dev-workflow command', async () => {
    const command = {
      command: '/dev-workflow',
      text: 'Add user authentication',
      channel_id: 'C12345',
      user_id: 'U12345',
      response_url: 'https://hooks.slack.com/commands/123'
    };

    const result = await handleDevWorkflowCommand(command);

    expect(result.success).toBe(true);
    expect(result.workflowId).toBeDefined();
  });

  it('should require feature description', async () => {
    const command = {
      command: '/dev-workflow',
      text: '',
      channel_id: 'C12345',
      user_id: 'U12345',
      response_url: 'https://hooks.slack.com/commands/123'
    };

    const result = await handleDevWorkflowCommand(command);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Please provide a feature description');
  });

  it('should require REPO_PATH environment variable', async () => {
    // Remove REPO_PATH to test validation
    delete process.env.REPO_PATH;

    const command = {
      command: '/dev-workflow',
      text: 'Add user authentication',
      channel_id: 'C12345',
      user_id: 'U12345',
      response_url: 'https://hooks.slack.com/commands/123'
    };

    const result = await handleDevWorkflowCommand(command);

    expect(result.success).toBe(false);
    expect(result.error).toContain('REPO_PATH');
    expect(result.error).toContain('environment variable');
  });

  it('should use configurable task queue from environment', async () => {
    const { getTemporalClient } = await import('../temporal/connection');
    const mockClient = await getTemporalClient();

    process.env.DEV_WORKFLOW_TASK_QUEUE = 'custom-task-queue';

    const command = {
      command: '/dev-workflow',
      text: 'Add user authentication',
      channel_id: 'C12345',
      user_id: 'U12345',
      response_url: 'https://hooks.slack.com/commands/123'
    };

    await handleDevWorkflowCommand(command);

    // Verify workflow.start was called with the custom task queue
    expect(mockClient.workflow.start).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        taskQueue: 'custom-task-queue'
      })
    );
  });

  it('should handle Temporal connection errors with enhanced error messages', async () => {
    const { getTemporalClient } = await import('../temporal/connection');

    // Mock a connection failure
    vi.mocked(getTemporalClient).mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const command = {
      command: '/dev-workflow',
      text: 'Add user authentication',
      channel_id: 'C12345',
      user_id: 'U12345',
      response_url: 'https://hooks.slack.com/commands/123'
    };

    const result = await handleDevWorkflowCommand(command);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to start workflow');
    expect(result.error).toContain('Connection refused');
  });
});
