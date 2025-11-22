import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendThreadMessage, askQuestion, waitForResponse } from './slack.activities';

// Mock the slack config module
vi.mock('../slack/slack-config', () => ({
  createDevWorkflowSlackConfig: vi.fn().mockReturnValue({
    slack: {
      botToken: 'xoxb-test',
      signingSecret: 'test-secret',
      appToken: 'xapp-test',
      socketMode: true,
      commandsEnabled: true
    },
    messaging: {
      bidirectional: true,
      bridgeThreads: true,
      bridgeReactions: true,
      formatMessages: true
    }
  })
}));

// Mock @bernierllc/chat-integration-slack
vi.mock('@bernierllc/chat-integration-slack', () => ({
  SlackIntegration: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn().mockResolvedValue({ ts: '1234567890.123456' }),
    getStatus: vi.fn().mockReturnValue({ enabled: true })
  }))
}));

describe('Slack Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendThreadMessage', () => {
    it('should send message to thread', async () => {
      const result = await sendThreadMessage({
        channel: 'C12345',
        threadTs: '1234567890.000000',
        text: 'Test message'
      });

      expect(result.success).toBe(true);
      expect(result.ts).toBeDefined();
    });

    it('should handle optional blocks', async () => {
      const blocks = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Bold text*' }
        }
      ];

      const result = await sendThreadMessage({
        channel: 'C12345',
        threadTs: '1234567890.000000',
        text: 'Fallback text',
        blocks
      });

      expect(result.success).toBe(true);
    });
  });

  describe('askQuestion', () => {
    it('should send question and return message timestamp', async () => {
      const result = await askQuestion({
        channel: 'C12345',
        threadTs: '1234567890.000000',
        question: 'What is the feature name?'
      });

      expect(result.messageTs).toBeDefined();
      expect(result.channel).toBe('C12345');
    });
  });

  describe('waitForResponse', () => {
    it('should timeout if no response received', async () => {
      const result = await waitForResponse({
        channel: 'C12345',
        threadTs: '1234567890.000000',
        questionTs: '1234567890.123456',
        timeoutMs: 100
      });

      expect(result.timedOut).toBe(true);
      expect(result.response).toBeUndefined();
    });
  });
});
