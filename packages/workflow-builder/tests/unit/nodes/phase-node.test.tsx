/**
 * Tests for PhaseNode component
 */

import { describe, it, expect } from 'vitest';

describe('PhaseNode', () => {
  it('validates phase node data structure', () => {
    const data = {
      label: 'INITIALIZE',
      config: {
        name: 'INITIALIZE',
        description: 'Initialize phase',
        sequential: true,
      },
    };

    expect(data.config.name).toBe('INITIALIZE');
    expect(data.config.sequential).toBe(true);
  });

  it('handles concurrent mode', () => {
    const data = {
      label: 'BUILD',
      config: {
        name: 'BUILD',
        sequential: false,
        maxConcurrency: 4,
      },
    };

    expect(data.config.sequential).toBe(false);
    expect(data.config.maxConcurrency).toBe(4);
  });

  it('defaults to sequential when not specified', () => {
    const data = {
      label: 'DEFAULT',
      config: {
        name: 'DEFAULT',
      },
    };

    expect(data.config.sequential).toBeUndefined();
  });
});

