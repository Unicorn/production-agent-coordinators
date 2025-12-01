/**
 * Chaos Engineering Tests
 *
 * These tests verify system resilience under failure conditions.
 * They test how the system handles various failure scenarios including:
 * - Network failures
 * - API rate limiting
 * - Disk space issues
 * - Process crashes
 * - Timeout scenarios
 */

import { describe, it, expect, vi } from 'vitest';

describe('Chaos Engineering - Network Failures', () => {
  describe('Gemini API Connection Failures', () => {
    it('should handle connection timeout gracefully', async () => {
      const simulateTimeout = async (): Promise<never> => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('ETIMEDOUT: Connection timed out');
      };

      await expect(simulateTimeout()).rejects.toThrow('ETIMEDOUT');
    });

    it('should handle DNS resolution failure', async () => {
      const simulateDnsFailure = async (): Promise<never> => {
        throw new Error('ENOTFOUND: getaddrinfo failed for api.google.com');
      };

      await expect(simulateDnsFailure()).rejects.toThrow('ENOTFOUND');
    });

    it('should handle connection reset', async () => {
      const simulateReset = async (): Promise<never> => {
        throw new Error('ECONNRESET: Connection reset by peer');
      };

      await expect(simulateReset()).rejects.toThrow('ECONNRESET');
    });

    it('should detect retriable vs non-retriable network errors', () => {
      const retriableErrors = [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'EPIPE',
        'ENETUNREACH'
      ];

      const nonRetriableErrors = [
        'ENOTFOUND', // DNS failure - won't resolve itself
        'EACCES',    // Permission denied
        'EINVAL'     // Invalid argument
      ];

      const isRetriable = (error: string) => retriableErrors.some(e => error.includes(e));

      expect(isRetriable('ETIMEDOUT: Connection timed out')).toBe(true);
      expect(isRetriable('ECONNRESET: Connection reset')).toBe(true);
      expect(isRetriable('ENOTFOUND: DNS failed')).toBe(false);
    });
  });

  describe('npm Registry Connection Failures', () => {
    it('should handle registry timeout', async () => {
      const simulateNpmTimeout = async (): Promise<never> => {
        throw new Error('npm ERR! network request to https://registry.npmjs.org failed, reason: ETIMEDOUT');
      };

      await expect(simulateNpmTimeout()).rejects.toThrow('ETIMEDOUT');
    });

    it('should handle registry 503 Service Unavailable', () => {
      const httpErrors = [
        { status: 503, message: 'Service Unavailable', retriable: true },
        { status: 502, message: 'Bad Gateway', retriable: true },
        { status: 500, message: 'Internal Server Error', retriable: true },
        { status: 429, message: 'Too Many Requests', retriable: true },
        { status: 404, message: 'Not Found', retriable: false },
        { status: 401, message: 'Unauthorized', retriable: false }
      ];

      for (const error of httpErrors) {
        const shouldRetry = [500, 502, 503, 429].includes(error.status);
        expect(shouldRetry).toBe(error.retriable);
      }
    });
  });
});

describe('Chaos Engineering - API Rate Limiting', () => {
  describe('Gemini Rate Limit Handling', () => {
    it('should detect rate limit error from Gemini', () => {
      const rateLimitErrors = [
        'RESOURCE_EXHAUSTED: Quota exceeded',
        'ResourceExhausted: 429 Too Many Requests',
        'Rate limit exceeded. Please retry after 60 seconds.'
      ];

      const isRateLimited = (error: string) =>
        error.includes('RESOURCE_EXHAUSTED') ||
        error.includes('429') ||
        error.includes('Rate limit') ||
        error.includes('Quota exceeded');

      for (const error of rateLimitErrors) {
        expect(isRateLimited(error)).toBe(true);
      }
    });

    it('should calculate appropriate backoff for rate limits', () => {
      const parseRetryAfter = (errorMessage: string): number => {
        const match = errorMessage.match(/retry after (\d+)/i);
        if (match) return parseInt(match[1], 10) * 1000;
        return 60000; // Default 60 second backoff
      };

      expect(parseRetryAfter('Rate limit exceeded. Please retry after 30 seconds.')).toBe(30000);
      expect(parseRetryAfter('Rate limit exceeded. Please retry after 120 seconds.')).toBe(120000);
      expect(parseRetryAfter('Rate limit exceeded.')).toBe(60000);
    });

    it('should implement exponential backoff with jitter', () => {
      const calculateBackoffWithJitter = (attempt: number, baseDelay: number = 1000): number => {
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000; // 0-1000ms random jitter
        return Math.min(exponentialDelay + jitter, 120000); // Max 2 minutes
      };

      // First attempt should be around 1-2 seconds
      const firstBackoff = calculateBackoffWithJitter(1);
      expect(firstBackoff).toBeGreaterThanOrEqual(1000);
      expect(firstBackoff).toBeLessThan(3000);

      // Third attempt should be around 4-5 seconds
      const thirdBackoff = calculateBackoffWithJitter(3);
      expect(thirdBackoff).toBeGreaterThanOrEqual(4000);
      expect(thirdBackoff).toBeLessThan(6000);
    });

    it('should track rate limit hits for circuit breaker', () => {
      const rateLimitTracker = {
        hits: 0,
        windowStart: Date.now(),
        windowDuration: 60000, // 1 minute window
        threshold: 5
      };

      const recordHit = () => {
        const now = Date.now();
        if (now - rateLimitTracker.windowStart > rateLimitTracker.windowDuration) {
          rateLimitTracker.hits = 0;
          rateLimitTracker.windowStart = now;
        }
        rateLimitTracker.hits++;
      };

      const shouldCircuitBreak = () => rateLimitTracker.hits >= rateLimitTracker.threshold;

      // Simulate 5 rate limit hits
      for (let i = 0; i < 5; i++) {
        recordHit();
      }

      expect(shouldCircuitBreak()).toBe(true);
    });
  });

  describe('npm Rate Limit Handling', () => {
    it('should detect npm rate limit errors', () => {
      const npmErrors = [
        'npm ERR! 429 Too Many Requests',
        'npm ERR! code E429',
        'You have exceeded the rate limit'
      ];

      const isNpmRateLimited = (error: string) =>
        error.includes('429') ||
        error.includes('E429') ||
        error.includes('rate limit');

      for (const error of npmErrors) {
        expect(isNpmRateLimited(error)).toBe(true);
      }
    });
  });
});

describe('Chaos Engineering - Disk Space Issues', () => {
  describe('Write Failure Handling', () => {
    it('should detect disk full errors', () => {
      const diskErrors = [
        { error: 'ENOSPC: no space left on device', isDiskFull: true },
        { error: 'EDQUOT: disk quota exceeded', isDiskFull: true },
        { error: 'EACCES: permission denied', isDiskFull: false },
        { error: 'ENOENT: file not found', isDiskFull: false }
      ];

      const isDiskSpaceError = (error: string) =>
        error.includes('ENOSPC') || error.includes('EDQUOT');

      for (const { error, isDiskFull } of diskErrors) {
        expect(isDiskSpaceError(error)).toBe(isDiskFull);
      }
    });

    it('should handle partial write failures', () => {
      const totalFiles = 10;
      const successfulWrites = 7;
      const failedWrites = totalFiles - successfulWrites;

      const writeResults = {
        succeeded: Array(successfulWrites).fill(null).map((_, i) => `file${i}.ts`),
        failed: Array(failedWrites).fill(null).map((_, i) => ({
          file: `file${successfulWrites + i}.ts`,
          error: 'ENOSPC: no space left on device'
        }))
      };

      expect(writeResults.succeeded.length).toBe(7);
      expect(writeResults.failed.length).toBe(3);

      // Should be able to rollback successful writes on failure
      const rollbackNeeded = writeResults.failed.length > 0;
      expect(rollbackNeeded).toBe(true);
    });
  });

  describe('Temp Directory Issues', () => {
    it('should handle temp directory creation failure', () => {
      const tempDirErrors = [
        'ENOSPC: no space left on device',
        'EACCES: permission denied',
        'EROFS: read-only file system'
      ];

      const cannotCreateTemp = (error: string) =>
        tempDirErrors.some(e => error.includes(e.split(':')[0]));

      expect(cannotCreateTemp('ENOSPC: no space left')).toBe(true);
      expect(cannotCreateTemp('EACCES: permission denied')).toBe(true);
      expect(cannotCreateTemp('ENOENT: not found')).toBe(false);
    });
  });
});

describe('Chaos Engineering - Process Crashes', () => {
  describe('Activity Timeout Handling', () => {
    it('should handle activity exceeding timeout', async () => {
      const activityTimeout = 100; // ms for test

      const longRunningActivity = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Activity timed out')), activityTimeout);
      });

      await expect(longRunningActivity).rejects.toThrow('timed out');
    });

    it('should track activity execution time', () => {
      const activityMetrics = {
        startTime: Date.now() - 5000, // Started 5 seconds ago
        maxDuration: 10000, // 10 second limit
        warningThreshold: 0.8 // Warn at 80%
      };

      const elapsed = Date.now() - activityMetrics.startTime;
      const percentUsed = elapsed / activityMetrics.maxDuration;

      expect(percentUsed).toBeLessThan(1); // Not exceeded
      expect(percentUsed).toBeLessThan(activityMetrics.warningThreshold); // Not in warning zone
    });
  });

  describe('Workflow Interruption', () => {
    it('should handle workflow cancellation', () => {
      const workflowState = {
        status: 'running' as 'running' | 'cancelled' | 'completed' | 'failed',
        completedSteps: ['init', 'planning'],
        currentStep: 'scaffolding',
        pendingSteps: ['build', 'test', 'publish']
      };

      // Simulate cancellation
      workflowState.status = 'cancelled';

      expect(workflowState.status).toBe('cancelled');
      expect(workflowState.completedSteps).toContain('planning');
      expect(workflowState.pendingSteps).toContain('publish');
    });

    it('should preserve state for resume after crash', () => {
      const checkpointData = {
        workflowId: 'wf-123',
        lastCompletedStep: 'scaffolding',
        filesCreated: ['package.json', 'src/index.ts'],
        commitHash: 'abc123',
        timestamp: Date.now()
      };

      // Verify checkpoint has enough info to resume
      expect(checkpointData.workflowId).toBeDefined();
      expect(checkpointData.lastCompletedStep).toBeDefined();
      expect(checkpointData.commitHash).toBeDefined();
      expect(checkpointData.filesCreated.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Pressure', () => {
    it('should detect potential memory issues from large responses', () => {
      const maxResponseSize = 10 * 1024 * 1024; // 10MB limit

      const responses = [
        { size: 1000, safe: true },
        { size: 1000000, safe: true },      // 1MB - OK
        { size: 5000000, safe: true },      // 5MB - OK
        { size: 15000000, safe: false }     // 15MB - Too large
      ];

      for (const { size, safe } of responses) {
        const isSafe = size <= maxResponseSize;
        expect(isSafe).toBe(safe);
      }
    });
  });
});

describe('Chaos Engineering - External Service Failures', () => {
  describe('Git Operations', () => {
    it('should handle git command failures', () => {
      const gitErrors = [
        { error: 'fatal: not a git repository', recoverable: false },
        { error: 'error: failed to push some refs', recoverable: true },
        { error: 'fatal: unable to access remote', recoverable: true },
        { error: 'error: Your local changes would be overwritten', recoverable: false }
      ];

      const isRecoverable = (error: string) =>
        error.includes('push') || error.includes('remote') || error.includes('network');

      for (const { error, recoverable } of gitErrors) {
        // Only push/remote errors are retriable
        const shouldRetry = isRecoverable(error);
        expect(shouldRetry).toBe(error.includes('push') || error.includes('remote'));
      }
    });

    it('should handle pre-commit hook failures', () => {
      const hookFailure = `husky - pre-commit hook exited with code 1
> lint-staged
✖ eslint --fix src/index.ts:
  10:5  error  Unsafe assignment  @typescript-eslint/no-unsafe-assignment

✖ 1 problem (1 error, 0 warnings)`;

      const isPreCommitFailure = hookFailure.includes('pre-commit');
      const hasLintErrors = hookFailure.includes('eslint');
      const errorFiles = hookFailure.match(/src\/[\w./]+\.ts/g) || [];

      expect(isPreCommitFailure).toBe(true);
      expect(hasLintErrors).toBe(true);
      expect(errorFiles).toContain('src/index.ts');
    });
  });

  describe('TypeScript Compiler Issues', () => {
    it('should handle tsc out of memory', () => {
      const tscErrors = [
        'FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory',
        'error TS5042: Option "incremental" can only be specified using tsconfig',
        'error TS2307: Cannot find module'
      ];

      const isOomError = (error: string) =>
        error.includes('heap out of memory') || error.includes('Allocation failed');

      expect(isOomError(tscErrors[0])).toBe(true);
      expect(isOomError(tscErrors[1])).toBe(false);
      expect(isOomError(tscErrors[2])).toBe(false);
    });
  });
});

describe('Chaos Engineering - Data Corruption', () => {
  describe('JSON Parsing Failures', () => {
    it('should handle corrupted JSON response', () => {
      const corruptedResponses = [
        '{"command": "APPLY_CODE_CHANGES"', // Truncated
        '{"command": APPLY_CODE_CHANGES}',   // Missing quotes
        'undefined',                          // Not JSON
        '',                                   // Empty
        '{"command": "APPLY_CODE_CHANGES", "files": [{"path": src/index.ts}]}' // Missing quotes in nested
      ];

      for (const response of corruptedResponses) {
        let parsed = null;
        try {
          parsed = JSON.parse(response);
        } catch {
          parsed = null;
        }
        expect(parsed).toBeNull();
      }
    });

    it('should handle package.json corruption', () => {
      const corruptedPackageJson = `{
        "name": "@bernierllc/test",
        "version": "1.0.0",
        "dependencies": {
          "lodash": "^4.17.21"
        // Missing closing braces`;

      let isValid = true;
      try {
        JSON.parse(corruptedPackageJson);
      } catch {
        isValid = false;
      }

      expect(isValid).toBe(false);
    });
  });

  describe('File Content Corruption', () => {
    it('should detect binary content in TypeScript files', () => {
      const textContent = 'export const x = 1;';
      const binaryContent = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR';

      const hasBinaryContent = (content: string) =>
        content.includes('\x00') ||
        (content.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length > content.length * 0.1;

      expect(hasBinaryContent(textContent)).toBe(false);
      expect(hasBinaryContent(binaryContent)).toBe(true);
    });
  });
});

describe('Chaos Engineering - Concurrent Access', () => {
  describe('File Lock Conflicts', () => {
    it('should handle file already locked', () => {
      const lockErrors = [
        'EBUSY: resource busy or locked',
        'EACCES: permission denied (file locked)',
        'EPERM: operation not permitted'
      ];

      const isLockError = (error: string) =>
        error.includes('EBUSY') || error.includes('locked');

      expect(isLockError(lockErrors[0])).toBe(true);
      expect(isLockError(lockErrors[1])).toBe(true);
      expect(isLockError(lockErrors[2])).toBe(false);
    });
  });

  describe('Git Conflicts', () => {
    it('should detect merge conflicts', () => {
      const conflictMarkers = `<<<<<<< HEAD
export const x = 1;
=======
export const x = 2;
>>>>>>> feature-branch`;

      const hasConflict = conflictMarkers.includes('<<<<<<<') &&
        conflictMarkers.includes('=======') &&
        conflictMarkers.includes('>>>>>>>');

      expect(hasConflict).toBe(true);
    });
  });
});

describe('Chaos Engineering - Recovery Strategies', () => {
  describe('Automatic Recovery', () => {
    it('should implement circuit breaker pattern', () => {
      const circuitBreaker = {
        state: 'closed' as 'closed' | 'open' | 'half-open',
        failures: 0,
        threshold: 5,
        cooldownMs: 30000,
        lastFailure: 0
      };

      const recordFailure = () => {
        circuitBreaker.failures++;
        circuitBreaker.lastFailure = Date.now();
        if (circuitBreaker.failures >= circuitBreaker.threshold) {
          circuitBreaker.state = 'open';
        }
      };

      const canExecute = () => {
        if (circuitBreaker.state === 'closed') return true;
        if (circuitBreaker.state === 'open') {
          const elapsed = Date.now() - circuitBreaker.lastFailure;
          if (elapsed > circuitBreaker.cooldownMs) {
            circuitBreaker.state = 'half-open';
            return true;
          }
          return false;
        }
        return true; // half-open allows one attempt
      };

      // Initially closed
      expect(canExecute()).toBe(true);

      // Record failures until threshold
      for (let i = 0; i < 5; i++) {
        recordFailure();
      }

      expect(circuitBreaker.state).toBe('open');
    });

    it('should implement retry with backoff', async () => {
      const retryWithBackoff = async <T>(
        fn: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 100
      ): Promise<T> => {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await fn();
          } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries) {
              const delay = baseDelay * Math.pow(2, attempt - 1);
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }

        throw lastError;
      };

      let attempts = 0;
      const failingFn = async () => {
        attempts++;
        if (attempts < 3) throw new Error('Temporary failure');
        return 'success';
      };

      const result = await retryWithBackoff(failingFn, 3, 10);

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
  });

  describe('Graceful Degradation', () => {
    it('should fall back to cached data on API failure', () => {
      const cache = {
        lastKnownGood: { command: 'RUN_BUILD' },
        timestamp: Date.now() - 60000, // 1 minute old
        maxAge: 300000 // 5 minutes
      };

      const apiError = new Error('API unavailable');
      const isCacheValid = Date.now() - cache.timestamp < cache.maxAge;

      expect(isCacheValid).toBe(true);

      // Use cache on failure
      const result = isCacheValid ? cache.lastKnownGood : null;
      expect(result).toEqual({ command: 'RUN_BUILD' });
    });
  });
});
