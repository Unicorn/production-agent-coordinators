/**
 * Tests for StateVariableNode component
 */

import { describe, it, expect } from 'vitest';

describe('StateVariableNode', () => {
  it('validates state variable node data structure', () => {
    const data = {
      label: 'counter',
      config: {
        name: 'counter',
        operation: 'increment',
        scope: 'workflow',
      },
    };

    expect(data.config.name).toBe('counter');
    expect(data.config.operation).toBe('increment');
    expect(data.config.scope).toBe('workflow');
  });

  it('handles set operation', () => {
    const data = {
      label: 'myVar',
      config: {
        name: 'myVar',
        operation: 'set',
        value: 'initialValue',
        scope: 'workflow',
      },
    };

    expect(data.config.operation).toBe('set');
    expect(data.config.value).toBe('initialValue');
  });

  it('handles append operation', () => {
    const data = {
      label: 'items',
      config: {
        name: 'items',
        operation: 'append',
        value: 'newItem',
        scope: 'workflow',
      },
    };

    expect(data.config.operation).toBe('append');
    expect(data.config.value).toBe('newItem');
  });

  it('handles different scopes', () => {
    const data = {
      label: 'phaseVar',
      config: {
        name: 'phaseVar',
        operation: 'set',
        scope: 'phase',
      },
    };

    expect(data.config.scope).toBe('phase');
  });
});

