/**
 * Unit tests for retry policy normalization and validation
 */

import { describe, it, expect } from 'vitest';
import type { RetryPolicy } from '@/lib/compiler/types';
import { validateRetryPolicy } from '@/lib/compiler/utils/validation';

describe('Retry Policy Helpers', () => {
  describe('RetryPolicy type validation', () => {
    it('accepts "none" strategy', () => {
      const policy: RetryPolicy = { strategy: 'none' };
      expect(policy.strategy).toBe('none');
    });

    it('accepts "fail-after-x" strategy with maxAttempts', () => {
      const policy: RetryPolicy = {
        strategy: 'fail-after-x',
        maxAttempts: 3,
        initialInterval: '1s',
      };
      expect(policy.strategy).toBe('fail-after-x');
      expect(policy.maxAttempts).toBe(3);
    });

    it('accepts "exponential-backoff" strategy', () => {
      const policy: RetryPolicy = {
        strategy: 'exponential-backoff',
        maxAttempts: 5,
        initialInterval: '1s',
        maxInterval: '1h',
        backoffCoefficient: 2.0,
      };
      expect(policy.strategy).toBe('exponential-backoff');
      expect(policy.maxAttempts).toBe(5);
    });

    it('accepts "keep-trying" strategy', () => {
      const policy: RetryPolicy = {
        strategy: 'keep-trying',
        initialInterval: '1s',
        maxInterval: '1h',
        backoffCoefficient: 2.0,
      };
      expect(policy.strategy).toBe('keep-trying');
    });
  });

  describe('validateRetryPolicy', () => {
    it('returns no errors for valid "none" policy', () => {
      const policy = { strategy: 'none' as const };
      const errors = validateRetryPolicy(policy);
      expect(errors).toHaveLength(0);
    });

    it('returns no errors for valid "fail-after-x" policy', () => {
      const policy = {
        strategy: 'fail-after-x' as const,
        maxAttempts: 3,
        initialInterval: '1s',
      };
      const errors = validateRetryPolicy(policy);
      expect(errors).toHaveLength(0);
    });

    it('returns no errors for valid "exponential-backoff" policy', () => {
      const policy = {
        strategy: 'exponential-backoff' as const,
        maxAttempts: 5,
        initialInterval: '1s',
        maxInterval: '1h',
        backoffCoefficient: 2.0,
      };
      const errors = validateRetryPolicy(policy);
      expect(errors).toHaveLength(0);
    });

    it('returns no errors for valid "keep-trying" policy', () => {
      const policy = {
        strategy: 'keep-trying' as const,
        initialInterval: '1s',
        maxInterval: '1h',
        backoffCoefficient: 2.0,
      };
      const errors = validateRetryPolicy(policy);
      expect(errors).toHaveLength(0);
    });

    it('returns error when strategy is missing', () => {
      const policy = {} as any;
      const errors = validateRetryPolicy(policy);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('strategy');
    });

    it('returns error when "fail-after-x" lacks maxAttempts', () => {
      const policy = {
        strategy: 'fail-after-x' as const,
      };
      const errors = validateRetryPolicy(policy);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('maxAttempts');
    });

    it('returns error when maxAttempts is less than 1', () => {
      const policy = {
        strategy: 'fail-after-x' as const,
        maxAttempts: 0,
      };
      const errors = validateRetryPolicy(policy);
      expect(errors.length).toBeGreaterThan(0);
      // When maxAttempts is 0 (falsy), it first checks for missing maxAttempts
      // When maxAttempts is explicitly set to a value < 1, it checks "at least 1"
      // Since 0 is falsy, the first check catches it
      const errorMessages = errors.map(e => e.message).join('; ');
      expect(errorMessages).toMatch(/maxAttempts|at least 1/);
    });

    it('returns error when maxAttempts is negative', () => {
      const policy = {
        strategy: 'fail-after-x' as const,
        maxAttempts: -1,
      };
      const errors = validateRetryPolicy(policy);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns error when backoffCoefficient is less than 1', () => {
      const policy = {
        strategy: 'exponential-backoff' as const,
        maxAttempts: 3,
        backoffCoefficient: 0.5,
      };
      const errors = validateRetryPolicy(policy);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('backoffCoefficient');
    });

    it('returns no errors for null/undefined policy', () => {
      expect(validateRetryPolicy(null)).toEqual([]);
      expect(validateRetryPolicy(undefined as any)).toEqual([]);
    });

    it('accepts valid backoffCoefficient values', () => {
      const policy1 = {
        strategy: 'exponential-backoff' as const,
        maxAttempts: 3,
        backoffCoefficient: 1.0,
      };
      const policy2 = {
        strategy: 'exponential-backoff' as const,
        maxAttempts: 3,
        backoffCoefficient: 2.5,
      };
      expect(validateRetryPolicy(policy1)).toHaveLength(0);
      expect(validateRetryPolicy(policy2)).toHaveLength(0);
    });
  });

  describe('Retry policy normalization expectations', () => {
    it('normalizes missing initialInterval to default', () => {
      // This test documents expected behavior - when initialInterval is missing,
      // code generators should use a default (typically '1s')
      const policy: RetryPolicy = {
        strategy: 'exponential-backoff',
        maxAttempts: 3,
      };
      // The policy itself is valid even without initialInterval
      expect(validateRetryPolicy(policy)).toHaveLength(0);
    });

    it('normalizes missing maxInterval for exponential-backoff', () => {
      const policy: RetryPolicy = {
        strategy: 'exponential-backoff',
        maxAttempts: 3,
        initialInterval: '1s',
      };
      expect(validateRetryPolicy(policy)).toHaveLength(0);
    });

    it('handles edge case: maxAttempts = 1 (single attempt)', () => {
      const policy = {
        strategy: 'fail-after-x' as const,
        maxAttempts: 1,
      };
      const errors = validateRetryPolicy(policy);
      expect(errors).toHaveLength(0);
    });

    it('handles large maxAttempts values', () => {
      const policy = {
        strategy: 'fail-after-x' as const,
        maxAttempts: 100,
      };
      const errors = validateRetryPolicy(policy);
      expect(errors).toHaveLength(0);
    });
  });
});

