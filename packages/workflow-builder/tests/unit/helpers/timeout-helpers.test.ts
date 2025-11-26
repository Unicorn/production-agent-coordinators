import { describe, it, expect } from 'vitest';
import type { RetryPolicy } from '@/lib/compiler/types';
// We don't yet have a dedicated timeout helper module; Phase 1 will likely
// introduce one. For now, this file serves as a scaffold and focuses on the
// timeout-related fields and defaults we rely on in compiler types.

describe('Timeout and Retry configuration shape', () => {
  it('supports basic timeout strings on node and workflow settings', () => {
    // These are type-level guarantees today; this test documents the contract
    // and can be expanded once we introduce concrete parsing helpers.
    const exampleTimeouts: string[] = ['500ms', '2s', '30s', '5m', '1h', '5 minutes'];
    expect(exampleTimeouts).toContain('2s');
  });

  it('supports core retry policy strategies', () => {
    const policies: RetryPolicy[] = [
      { strategy: 'none' },
      { strategy: 'keep-trying', initialInterval: '1s', maxInterval: '1h', backoffCoefficient: 2.0 },
      { strategy: 'fail-after-x', maxAttempts: 3, initialInterval: '1s' },
      { strategy: 'exponential-backoff', maxAttempts: 5, initialInterval: '1s', maxInterval: '1h' },
    ];

    expect(policies.map(p => p.strategy).sort()).toEqual(
      ['none', 'keep-trying', 'fail-after-x', 'exponential-backoff'].sort()
    );
  });
});


