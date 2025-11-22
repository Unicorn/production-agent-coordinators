/**
 * Mock Validation Tests for SlackIntegration
 *
 * Per CLAUDE.md requirement: "mocks used in tests must always be validated!"
 *
 * These tests verify that our mocks match the actual implementation of
 * @bernierllc/chat-integration-slack to ensure test reliability.
 */

import { describe, it, expect } from 'vitest';
import { SlackIntegration, createSlackConfig } from '@bernierllc/chat-integration-slack';

describe('SlackIntegration Mock Validation', () => {
  describe('Class Structure Validation', () => {
    it('should validate SlackIntegration class exists', () => {
      expect(SlackIntegration).toBeDefined();
      expect(typeof SlackIntegration).toBe('function');
    });

    it('should validate SlackIntegration can be instantiated', async () => {
      const config = await createSlackConfig();
      const instance = new SlackIntegration(config);

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(SlackIntegration);
    });
  });

  describe('Method Signature Validation', () => {
    let instance: SlackIntegration;

    beforeAll(async () => {
      const config = await createSlackConfig();
      instance = new SlackIntegration(config);
    });

    it('should validate getStatus() method exists with correct signature', () => {
      expect(instance.getStatus).toBeDefined();
      expect(typeof instance.getStatus).toBe('function');

      const status = instance.getStatus();

      expect(status).toBeDefined();
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('neverhubConnected');
      expect(typeof status.enabled).toBe('boolean');
      expect(typeof status.neverhubConnected).toBe('boolean');
    });

    it('should validate getConfig() method exists with correct signature', () => {
      expect(instance.getConfig).toBeDefined();
      expect(typeof instance.getConfig).toBe('function');

      const config = instance.getConfig();

      expect(config).toBeDefined();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('slack');
      expect(config).toHaveProperty('connection');
      expect(config).toHaveProperty('channels');
      expect(config).toHaveProperty('userMapping');
      expect(config).toHaveProperty('messaging');
      expect(config).toHaveProperty('slashCommands');
      expect(config).toHaveProperty('roleMapping');
      expect(config).toHaveProperty('neverhub');
    });

    it('should validate isEnabled() method exists with correct signature', () => {
      expect(instance.isEnabled).toBeDefined();
      expect(typeof instance.isEnabled).toBe('function');

      const enabled = instance.isEnabled();

      expect(typeof enabled).toBe('boolean');
    });

    it('should validate initialize() method exists with correct signature', () => {
      expect(instance.initialize).toBeDefined();
      expect(typeof instance.initialize).toBe('function');
    });

    it('should verify sendMessage() method DOES NOT exist', () => {
      // CRITICAL: This validates that sendMessage() does not exist on SlackIntegration
      // The implementation should use @slack/web-api WebClient instead
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((instance as any).sendMessage).toBeUndefined();
    });
  });

  describe('Config Structure Validation', () => {
    it('should validate createSlackConfig() returns expected structure', async () => {
      const config = await createSlackConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBeDefined();
      expect(typeof config.enabled).toBe('boolean');

      // Slack credentials
      expect(config.slack).toBeDefined();
      expect(config.slack.botToken).toBeDefined();
      expect(config.slack.signingSecret).toBeDefined();

      // Connection settings
      expect(config.connection).toBeDefined();
      expect(config.connection.socketMode).toBeDefined();
      expect(typeof config.connection.socketMode).toBe('boolean');

      // Channels
      expect(config.channels).toBeDefined();
      expect(Array.isArray(config.channels.whitelist)).toBe(true);

      // User mapping
      expect(config.userMapping).toBeDefined();
      expect(config.userMapping.strategy).toBeDefined();
      expect(['external', 'hybrid', 'link']).toContain(config.userMapping.strategy);

      // Messaging
      expect(config.messaging).toBeDefined();
      expect(typeof config.messaging.bidirectional).toBe('boolean');
      expect(typeof config.messaging.formatMessages).toBe('boolean');
      expect(typeof config.messaging.bridgeReactions).toBe('boolean');
      expect(typeof config.messaging.bridgeThreads).toBe('boolean');
      expect(typeof config.messaging.maxMessageLength).toBe('number');

      // Slash commands
      expect(config.slashCommands).toBeDefined();
      expect(typeof config.slashCommands.enabled).toBe('boolean');
      expect(typeof config.slashCommands.autoRegister).toBe('boolean');
      expect(['ephemeral', 'in_channel', 'blocks']).toContain(config.slashCommands.responseStyle);
      expect(typeof config.slashCommands.timeout).toBe('number');

      // Role mapping
      expect(config.roleMapping).toBeDefined();
      expect(typeof config.roleMapping).toBe('object');

      // NeverHub
      expect(config.neverhub).toBeDefined();
      expect(typeof config.neverhub.enabled).toBe('boolean');
      expect(typeof config.neverhub.serviceName).toBe('string');
    });
  });

  describe('Type Compatibility Validation', () => {
    it('should validate mock config structure matches real config', async () => {
      const realConfig = await createSlackConfig();

      // This is the structure used in our mocks
      const mockConfig = {
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
          strategy: 'external' as const,
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
          responseStyle: 'ephemeral' as const,
          timeout: 30000
        },
        roleMapping: {},
        neverhub: {
          enabled: false,
          serviceName: 'test'
        }
      };

      // Validate structure compatibility
      expect(Object.keys(mockConfig).sort()).toEqual(Object.keys(realConfig).sort());
      expect(Object.keys(mockConfig.slack).sort()).toContain('botToken');
      expect(Object.keys(mockConfig.slack).sort()).toContain('signingSecret');
    });
  });
});
