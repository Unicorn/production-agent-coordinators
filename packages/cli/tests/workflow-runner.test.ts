import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runWorkflow, type WorkflowOptions } from '../src/workflow-runner.js';
import type { ILogger } from '@coordinator/contracts';

describe('Workflow Runner', () => {
  let mockLogger: ILogger;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
  });

  describe('runWorkflow', () => {
    it('should initialize workflow runner and log messages', async () => {
      const options: WorkflowOptions = {
        spec: 'hello',
        agent: 'mock',
        config: {
          defaultAgent: 'mock',
          defaultSpec: 'hello',
          apiKeys: {}
        },
        logger: mockLogger
      };

      const result = await runWorkflow(options);

      // Should have attempted to run the workflow
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting workflow: hello')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using agent: mock')
      );
      // Result should be defined (success or failure)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle unknown spec error', async () => {
      const options: WorkflowOptions = {
        spec: 'unknown',
        agent: 'mock',
        config: {
          defaultAgent: 'mock',
          defaultSpec: 'hello',
          apiKeys: {}
        },
        logger: mockLogger
      };

      const result = await runWorkflow(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Unknown spec: unknown');
    });

    it('should handle unknown agent error', async () => {
      const options: WorkflowOptions = {
        spec: 'hello',
        agent: 'unknown',
        config: {
          defaultAgent: 'mock',
          defaultSpec: 'hello',
          apiKeys: {}
        },
        logger: mockLogger
      };

      const result = await runWorkflow(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Unknown agent: unknown');
    });

    it('should use default agent from config when not specified', async () => {
      const options: WorkflowOptions = {
        spec: 'hello',
        config: {
          defaultAgent: 'mock',
          defaultSpec: 'hello',
          apiKeys: {}
        },
        logger: mockLogger
      };

      await runWorkflow(options);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using agent: mock')
      );
    });

    it('should report progress during workflow execution', async () => {
      const options: WorkflowOptions = {
        spec: 'hello',
        agent: 'mock',
        config: {
          defaultAgent: 'mock',
          defaultSpec: 'hello',
          apiKeys: {}
        },
        logger: mockLogger
      };

      await runWorkflow(options);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting workflow')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using agent')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing')
      );
    });

    it('should handle workflow execution errors gracefully', async () => {
      const options: WorkflowOptions = {
        spec: 'hello',
        agent: 'mock',
        config: {
          defaultAgent: 'mock',
          defaultSpec: 'hello',
          apiKeys: {},
          simulateError: true // Special flag for testing
        },
        logger: mockLogger
      };

      const result = await runWorkflow(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('list specs', () => {
    it('should list all available specs', async () => {
      const specs = await import('../src/workflow-runner').then(m => m.listSpecs());

      expect(specs).toContain('hello');
      expect(specs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('list agents', () => {
    it('should list all available agents', async () => {
      const agents = await import('../src/workflow-runner').then(m => m.listAgents());

      expect(agents).toContain('mock');
      expect(agents).toContain('anthropic');
      expect(agents.length).toBeGreaterThanOrEqual(2);
    });
  });
});
