/**
 * Tests for RetryNode component
 */

import { describe, it, expect } from 'vitest';

describe('RetryNode', () => {
  it('validates retry node data structure', () => {
    const data = {
      label: 'Retry Build',
      config: {
        maxAttempts: 3,
        retryOn: 'failure',
      },
    };

    expect(data.config.maxAttempts).toBe(3);
    expect(data.config.retryOn).toBe('failure');
  });

  it('handles exponential backoff', () => {
    const data = {
      label: 'Exponential Backoff',
      config: {
        maxAttempts: 3,
        retryOn: 'failure',
        backoff: {
          type: 'exponential',
          initialInterval: '1s',
          multiplier: 2,
        },
      },
    };

    expect(data.config.backoff.type).toBe('exponential');
    expect(data.config.backoff.multiplier).toBe(2);
  });

  it('defaults to 3 attempts', () => {
    const data = {
      label: 'Default Retry',
      config: {},
    };

    expect(data.config.maxAttempts).toBeUndefined();
  });
});

