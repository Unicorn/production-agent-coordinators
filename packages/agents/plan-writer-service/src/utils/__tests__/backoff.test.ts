import { describe, it, expect } from 'vitest';
import { fibonacciBackoff } from '../backoff';

describe('Fibonacci Backoff', () => {
  it('should generate Fibonacci sequence in milliseconds', () => {
    const gen = fibonacciBackoff(30 * 60 * 1000); // 30 min cap

    expect(gen.next().value).toBe(60000);  // 1 minute
    expect(gen.next().value).toBe(60000);  // 1 minute
    expect(gen.next().value).toBe(120000); // 2 minutes
    expect(gen.next().value).toBe(180000); // 3 minutes
    expect(gen.next().value).toBe(300000); // 5 minutes
    expect(gen.next().value).toBe(480000); // 8 minutes
  });

  it('should cap at maximum value', () => {
    const gen = fibonacciBackoff(5 * 60 * 1000); // 5 min cap

    // Skip to values that would exceed cap
    gen.next(); // 1m
    gen.next(); // 1m
    gen.next(); // 2m
    gen.next(); // 3m
    expect(gen.next().value).toBe(5 * 60 * 1000); // Capped at 5m
    expect(gen.next().value).toBe(5 * 60 * 1000); // Still capped
  });

  it('should generate indefinitely', () => {
    const gen = fibonacciBackoff(1000);

    // Generate many values
    for (let i = 0; i < 100; i++) {
      const value = gen.next().value;
      expect(value).toBeLessThanOrEqual(1000);
      expect(value).toBeGreaterThan(0);
    }
  });
});
