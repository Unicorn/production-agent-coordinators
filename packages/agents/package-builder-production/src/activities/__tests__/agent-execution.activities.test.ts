import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeAgentWithClaude, executeAgentTask } from '../agent-execution.activities';

// Store original fetch
const originalFetch = global.fetch;

describe('Agent Execution Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('executeAgentWithClaude', () => {
    it('should execute successful Claude API call', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockResponse = {
        content: [{ type: 'text', text: 'This is Claude\'s response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await executeAgentWithClaude({
        prompt: 'Test prompt',
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.2,
        maxTokens: 8000
      });

      expect(result).toBe('This is Claude\'s response');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 8000,
            temperature: 0.2,
            messages: [{ role: 'user', content: 'Test prompt' }]
          })
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith('[Claude] Input tokens: 100');
      expect(consoleSpy).toHaveBeenCalledWith('[Claude] Output tokens: 50');
      expect(consoleSpy).toHaveBeenCalledWith('[Claude] Stop reason: end_turn');

      consoleSpy.mockRestore();
    });

    it('should use default model and maxTokens when not provided', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await executeAgentWithClaude({
        prompt: 'Test'
      });

      const callArgs = (global.fetch as any).mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.model).toBe('claude-sonnet-4-5-20250929');
      expect(body.max_tokens).toBe(8000);
      expect(body.temperature).toBe(0.2);
    });

    it('should handle multiple text content blocks', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockResponse = {
        content: [
          { type: 'text', text: 'First block' },
          { type: 'text', text: 'Second block' }
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 10 }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await executeAgentWithClaude({ prompt: 'Test' });

      expect(result).toBe('First block\nSecond block');
    });

    it('should filter out non-text content blocks', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockResponse = {
        content: [
          { type: 'text', text: 'Text block' },
          { type: 'tool_use', id: 'tool_123' },
          { type: 'text', text: 'Another text' }
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 10 }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await executeAgentWithClaude({ prompt: 'Test' });

      expect(result).toBe('Text block\nAnother text');
    });

    it('should throw error when ANTHROPIC_API_KEY is missing', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      await expect(
        executeAgentWithClaude({ prompt: 'Test' })
      ).rejects.toThrow('ANTHROPIC_API_KEY environment variable is required');
    });

    it('should throw error on 401 authentication failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      } as Response);

      await expect(
        executeAgentWithClaude({ prompt: 'Test' })
      ).rejects.toThrow('Claude API execution failed: Authentication failed - check ANTHROPIC_API_KEY is valid');
    });

    it('should throw error on 429 rate limit', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limited'
      } as Response);

      await expect(
        executeAgentWithClaude({ prompt: 'Test' })
      ).rejects.toThrow('Claude API execution failed: Rate limit exceeded - please retry after a delay');
    });

    it('should throw error on 400 bad request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid request parameters'
      } as Response);

      await expect(
        executeAgentWithClaude({ prompt: 'Test' })
      ).rejects.toThrow('Claude API execution failed: Bad request: Invalid request parameters');
    });

    it('should throw error on generic API error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      } as Response);

      await expect(
        executeAgentWithClaude({ prompt: 'Test' })
      ).rejects.toThrow('Claude API execution failed: API error (500): Internal server error');
    });

    it('should throw error when response has no text content', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockResponse = {
        content: [
          { type: 'tool_use', id: 'tool_123' }
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 0 }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response);

      await expect(
        executeAgentWithClaude({ prompt: 'Test' })
      ).rejects.toThrow('Claude API execution failed: Claude returned empty response');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      await expect(
        executeAgentWithClaude({ prompt: 'Test' })
      ).rejects.toThrow('Claude API execution failed: Network failure');
    });

    it('should handle non-Error exceptions', async () => {
      global.fetch = vi.fn().mockRejectedValue('String error');

      await expect(
        executeAgentWithClaude({ prompt: 'Test' })
      ).rejects.toThrow('Claude API execution failed with unknown error');
    });
  });

  describe('executeAgentTask (deprecated)', () => {
    it('should return success with simulated fix message', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await executeAgentTask(
        'package-development-agent',
        'BUG_FIX',
        'Fix the linting errors',
        'packages/core/test-package'
      );

      expect(result.success).toBe(true);
      expect(result.changes).toContain('Simulated fix by package-development-agent');
      expect(result.output).toContain('Agent package-development-agent analyzed the task: BUG_FIX');
      expect(result.output).toContain('This is a PoC stub');
      expect(result.output).toContain('Fix the linting errors');

      expect(consoleSpy).toHaveBeenCalledWith('[AgentExecution] Agent: package-development-agent');
      expect(consoleSpy).toHaveBeenCalledWith('[AgentExecution] Task: BUG_FIX');
      expect(consoleSpy).toHaveBeenCalledWith('[AgentExecution] Instructions: Fix the linting errors');
      expect(consoleSpy).toHaveBeenCalledWith('[AgentExecution] Package Path: packages/core/test-package');

      consoleSpy.mockRestore();
    });

    it('should handle different agent types', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await executeAgentTask(
        'quality-validator-agent',
        'QUALITY_CHECK',
        'Validate code quality',
        'packages/service/api'
      );

      expect(result.success).toBe(true);
      expect(result.changes).toContain('Simulated fix by quality-validator-agent');

      consoleSpy.mockRestore();
    });
  });
});
