import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleDevWorkflowCommand } from './command-handler';

// Mock Temporal client
vi.mock('@temporalio/client', () => ({
  Connection: {
    connect: vi.fn().mockResolvedValue({
      close: vi.fn()
    })
  },
  Client: vi.fn().mockImplementation(() => ({
    workflow: {
      start: vi.fn().mockResolvedValue({
        workflowId: 'test-workflow-id'
      })
    }
  }))
}));

describe('Slack Command Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
