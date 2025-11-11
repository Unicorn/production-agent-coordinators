import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config-loader.js';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Config Loader', () => {
  let testDir: string;
  let configPath: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `coordinator-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir && existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loading from .coordinatorrc', () => {
    it('should load JSON config from .coordinatorrc', async () => {
      configPath = join(testDir, '.coordinatorrc');
      const config = {
        defaultAgent: 'anthropic',
        defaultSpec: 'hello',
        apiKeys: {
          anthropic: 'test-key'
        }
      };
      writeFileSync(configPath, JSON.stringify(config));

      const result = await loadConfig(testDir);

      expect(result).toEqual(config);
    });

    it('should return default config when no file exists', async () => {
      const result = await loadConfig(testDir);

      expect(result).toEqual({
        defaultAgent: 'mock',
        defaultSpec: 'hello',
        apiKeys: {}
      });
    });
  });

  describe('loading from coordinator.config.js', () => {
    it('should load config from coordinator.config.js', async () => {
      configPath = join(testDir, 'coordinator.config.js');
      const config = `
        export default {
          defaultAgent: 'anthropic',
          defaultSpec: 'todo',
          apiKeys: {
            anthropic: process.env.ANTHROPIC_API_KEY || ''
          }
        };
      `;
      writeFileSync(configPath, config);

      const result = await loadConfig(testDir);

      expect(result.defaultAgent).toBe('anthropic');
      expect(result.defaultSpec).toBe('todo');
      expect(result.apiKeys).toBeDefined();
    });
  });

  describe('config validation', () => {
    it('should use default agent when not specified in config', async () => {
      configPath = join(testDir, '.coordinatorrc');
      const config = {
        defaultSpec: 'hello',
        apiKeys: {}
      };
      writeFileSync(configPath, JSON.stringify(config));

      const result = await loadConfig(testDir);

      // Should merge with defaults
      expect(result.defaultAgent).toBe('mock');
      expect(result.defaultSpec).toBe('hello');
    });

    it('should use default spec when not specified in config', async () => {
      configPath = join(testDir, '.coordinatorrc');
      const config = {
        defaultAgent: 'anthropic',
        apiKeys: {}
      };
      writeFileSync(configPath, JSON.stringify(config));

      const result = await loadConfig(testDir);

      // Should merge with defaults
      expect(result.defaultAgent).toBe('anthropic');
      expect(result.defaultSpec).toBe('hello');
    });

    it('should validate apiKeys is an object', async () => {
      configPath = join(testDir, '.coordinatorrc');
      const config = {
        defaultAgent: 'mock',
        defaultSpec: 'hello',
        apiKeys: 'invalid'
      };
      writeFileSync(configPath, JSON.stringify(config));

      await expect(loadConfig(testDir)).rejects.toThrow('Invalid config: apiKeys must be an object');
    });
  });

  describe('config override', () => {
    it('should allow override via options', async () => {
      configPath = join(testDir, '.coordinatorrc');
      const config = {
        defaultAgent: 'mock',
        defaultSpec: 'hello',
        apiKeys: {}
      };
      writeFileSync(configPath, JSON.stringify(config));

      const result = await loadConfig(testDir, {
        defaultAgent: 'anthropic'
      });

      expect(result.defaultAgent).toBe('anthropic');
      expect(result.defaultSpec).toBe('hello');
    });
  });
});
