import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendThreadMessage, askQuestion, waitForResponse } from './slack.activities';

// Mock the slack config module
vi.mock('../slack/slack-config', () => ({
  createDevWorkflowSlackConfig: vi.fn().mockReturnValue({
    enabled: true,
    slack: {
      botToken: 'xoxb-test',
      signingSecret: 'test-secret',
      appToken: 'xapp-test'
    },
    connection: {
      socketMode: true
    },
    channels: {
      whitelist: ['#general']
    },
    userMapping: {
      strategy: 'external',
      displayFormat: '{real_name}',
      syncPresence: true,
      syncAvatars: true
    },
    messaging: {
      bidirectional: true,
      formatMessages: true,
      bridgeReactions: true,
      bridgeThreads: true,
      maxMessageLength: 4000
    },
    slashCommands: {
      enabled: true,
      autoRegister: true,
      responseStyle: 'ephemeral',
      timeout: 30000
    },
    roleMapping: {},
    neverhub: {
      enabled: false,
      serviceName: 'test'
    }
  })
}));

// Mock @slack/web-api
vi.mock('@slack/web-api', () => ({
  WebClient: vi.fn().mockImplementation(() => ({
    chat: {
      postMessage: vi.fn().mockResolvedValue({
        ok: true,
        ts: '1234567890.123456'
      })
    }
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
