import { describe, it, expect } from 'vitest';
import { UserDecisionSignal, validateUserDecision } from '../user-decision.types';

describe('UserDecisionSignal Types', () => {
  it('should validate retry decision', () => {
    const signal: UserDecisionSignal = {
      decision: 'retry',
      taskId: 'task-1',
      timestamp: new Date().toISOString()
    };

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(true);
  });

  it('should validate skip decision', () => {
    const signal: UserDecisionSignal = {
      decision: 'skip',
      taskId: 'task-2',
      timestamp: new Date().toISOString()
    };

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(true);
  });

  it('should validate abort decision', () => {
    const signal: UserDecisionSignal = {
      decision: 'abort',
      taskId: 'task-3',
      timestamp: new Date().toISOString()
    };

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(true);
  });

  it('should reject invalid decision', () => {
    const signal = {
      decision: 'invalid',
      taskId: 'task-1',
      timestamp: new Date().toISOString()
    } as any;

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid decision type');
  });

  it('should reject missing taskId', () => {
    const signal = {
      decision: 'retry',
      timestamp: new Date().toISOString()
    } as any;

    const result = validateUserDecision(signal);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('taskId is required');
  });
});
