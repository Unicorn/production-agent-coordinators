import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDevWorkflowSlackConfig, validateSlackEnv } from './slack-config';

describe('Slack Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateSlackEnv', () => {
    it('should validate when all required vars present', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';
      process.env.SLACK_APP_TOKEN = 'xapp-test';

      const result = validateSlackEnv();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when SLACK_BOT_TOKEN missing', () => {
      process.env.SLACK_SIGNING_SECRET = 'secret';

      const result = validateSlackEnv();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SLACK_BOT_TOKEN is required');
    });

    it('should fail when SLACK_SIGNING_SECRET missing', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';

      const result = validateSlackEnv();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SLACK_SIGNING_SECRET is required');
    });
  });

  describe('createDevWorkflowSlackConfig', () => {
    it('should create config from environment variables', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';
      process.env.SLACK_APP_TOKEN = 'xapp-test';
      process.env.SLACK_SOCKET_MODE = 'true';

      const config = createDevWorkflowSlackConfig();

      expect(config.slack.botToken).toBe('xoxb-test');
      expect(config.slack.signingSecret).toBe('secret');
      expect(config.slack.appToken).toBe('xapp-test');
      expect(config.slack.socketMode).toBe(true);
    });

    it('should throw if environment validation fails', () => {
      process.env = {}; // Clear all env vars

      expect(() => createDevWorkflowSlackConfig()).toThrow('Slack environment validation failed');
    });

    it('should enable dev-workflow specific commands', () => {
      process.env.SLACK_BOT_TOKEN = 'xoxb-test';
      process.env.SLACK_SIGNING_SECRET = 'secret';

      const config = createDevWorkflowSlackConfig();

      expect(config.slack.commandsEnabled).toBe(true);
      expect(config.messaging.bridgeThreads).toBe(true);
    });
  });
});
