/**
 * Tests for Gemini API rate limiting utilities
 *
 * Tests the rate limit detection, retry delay parsing, and error handling
 * that helps Temporal properly backoff when Gemini returns 429 errors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the internal functions, so we'll import them via a test helper
// Since the functions are not exported, we'll test them through the activity behavior

// Mock all dependencies before importing the module
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn()
}));

vi.mock('simple-git', () => ({
  default: vi.fn(() => ({
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue({ commit: 'abc123' })
  }))
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('# Test Plan'),
  readdir: vi.fn().mockResolvedValue([])
}));

vi.mock('@temporalio/activity', () => ({
  Context: {
    current: () => ({
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    })
  }
}));

vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue('Success')
}));

describe('Gemini Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  describe('Real Error Message Parsing', () => {
    it('should correctly parse the actual Gemini error format from production', async () => {
      // This is the ACTUAL error message format from production logs
      const realErrorMessage = `GoogleGenAIError: [429 Too Many Requests] {"error":{"code":429,"message":"Resource has been exhausted (e.g. check quota).","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"RATE_LIMIT_EXCEEDED","domain":"generativelanguage.googleapis.com","metadata":{"service":"generativelanguage.googleapis.com","consumer":"projects/123","quota_limit_value":"10","quota_metric":"generativelanguage.googleapis.com/generate_content_free_tier_requests_per_minute_per_project_per_base_model","quota_limit":"GenerateContentFreeRequestsPerMinutePerProjectPerBaseModel","quota_location":"global"}},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"31s"},{"@type":"type.googleapis.com/google.rpc.Help","links":[{"description":"Learn more about Gemini API rate limits and quotas.","url":"https://ai.google.dev/gemini-api/docs/rate-limits"}]}]}}`;

      const { GoogleGenAI } = await import('@google/genai');
      const { determineNextAction } = await import('../gemini-agent.activities');

      const mockError = new Error(realErrorMessage);
      const mockGenerateContent = vi.fn().mockRejectedValue(mockError);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      try {
        await determineNextAction({
          fullPlan: '# Plan',
          agentInstructions: 'Build',
          actionHistory: [],
          currentCodebaseContext: 'Empty'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Verify the error is properly classified as rate limiting
        expect(error.type).toBe('RATE_LIMITED');
        expect(error.message).toContain('rate limited');

        // Verify the retry delay was extracted (31s + 5s buffer = 36s)
        // nextRetryDelay is a direct property on ApplicationFailure
        expect(error.nextRetryDelay).toBe('36s');
      }
    });

    it('should handle error with minutes in retryDelay format', async () => {
      const errorWithMinutes = `[429] {"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"1m30s"}]}`;

      const { GoogleGenAI } = await import('@google/genai');
      const { determineNextAction } = await import('../gemini-agent.activities');

      const mockError = new Error(errorWithMinutes);
      const mockGenerateContent = vi.fn().mockRejectedValue(mockError);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      try {
        await determineNextAction({
          fullPlan: '# Plan',
          agentInstructions: 'Build',
          actionHistory: [],
          currentCodebaseContext: 'Empty'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe('RATE_LIMITED');
        // 1m30s = 90s + 5s buffer = 95s
        // nextRetryDelay is a direct property on ApplicationFailure
        expect(error.nextRetryDelay).toBe('95s');
      }
    });

    it('should cap retry delay at max configured value', async () => {
      // Set max to 60 seconds via environment
      process.env.GEMINI_MAX_RETRY_DELAY_SEC = '60';

      // Force module re-import to pick up new env vars
      vi.resetModules();

      // Re-mock after module reset
      vi.doMock('@google/genai', () => ({
        GoogleGenAI: vi.fn()
      }));
      vi.doMock('@temporalio/activity', () => ({
        Context: {
          current: () => ({
            log: {
              info: vi.fn(),
              warn: vi.fn(),
              error: vi.fn()
            }
          })
        }
      }));
      vi.doMock('fs/promises', () => ({
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
        mkdir: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue('# Test Plan'),
        readdir: vi.fn().mockResolvedValue([])
      }));
      vi.doMock('simple-git', () => ({
        default: vi.fn(() => ({
          add: vi.fn().mockResolvedValue(undefined),
          commit: vi.fn().mockResolvedValue({ commit: 'abc123' })
        }))
      }));
      vi.doMock('child_process', () => ({
        execSync: vi.fn().mockReturnValue('Success')
      }));

      const { GoogleGenAI } = await import('@google/genai');
      const { determineNextAction } = await import('../gemini-agent.activities');

      // Error with very long delay (5 minutes = 300s)
      const errorWithLongDelay = `[429] {"details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"300s"}]}`;

      const mockError = new Error(errorWithLongDelay);
      const mockGenerateContent = vi.fn().mockRejectedValue(mockError);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      try {
        await determineNextAction({
          fullPlan: '# Plan',
          agentInstructions: 'Build',
          actionHistory: [],
          currentCodebaseContext: 'Empty'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe('RATE_LIMITED');
        // Should be capped at 60s (the max we set)
        // nextRetryDelay is a direct property on ApplicationFailure
        expect(error.nextRetryDelay).toBe('60s');
      }

      // Clean up
      delete process.env.GEMINI_MAX_RETRY_DELAY_SEC;
    });
  });

  describe('Error Classification', () => {
    it('should NOT treat regular API errors as rate limiting', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      const { determineNextAction } = await import('../gemini-agent.activities');

      // A regular API error (not rate limiting)
      const regularError = new Error('Invalid API key');
      const mockGenerateContent = vi.fn().mockRejectedValue(regularError);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      try {
        await determineNextAction({
          fullPlan: '# Plan',
          agentInstructions: 'Build',
          actionHistory: [],
          currentCodebaseContext: 'Empty'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should NOT be classified as rate limiting
        expect(error.type).not.toBe('RATE_LIMITED');
        // The error message now includes "Failed to process Gemini response" wrapper
        expect(error.message).toContain('Invalid API key');
      }
    });

    it('should treat "quota exceeded" messages as rate limiting', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      const { determineNextAction } = await import('../gemini-agent.activities');

      const quotaError = new Error('Quota exceeded for project');
      const mockGenerateContent = vi.fn().mockRejectedValue(quotaError);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      try {
        await determineNextAction({
          fullPlan: '# Plan',
          agentInstructions: 'Build',
          actionHistory: [],
          currentCodebaseContext: 'Empty'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe('RATE_LIMITED');
      }
    });

    it('should treat "rate limit" messages as rate limiting', async () => {
      const { GoogleGenAI } = await import('@google/genai');
      const { determineNextAction } = await import('../gemini-agent.activities');

      const rateLimitError = new Error('Rate limit exceeded');
      const mockGenerateContent = vi.fn().mockRejectedValue(rateLimitError);

      vi.mocked(GoogleGenAI).mockImplementation(() => ({
        models: {
          generateContent: mockGenerateContent
        }
      }) as any);

      try {
        await determineNextAction({
          fullPlan: '# Plan',
          agentInstructions: 'Build',
          actionHistory: [],
          currentCodebaseContext: 'Empty'
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.type).toBe('RATE_LIMITED');
      }
    });
  });
});
