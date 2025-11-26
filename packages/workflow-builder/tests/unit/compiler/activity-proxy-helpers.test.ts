import { describe, it, expect } from 'vitest';
import type { WorkflowNode, GeneratorContext } from '@/lib/compiler/types';
import {
  buildInputParameter,
  buildRetryOptions,
  groupActivitiesByConfig,
  generateProxyVarName,
} from '@/lib/compiler/patterns/activity-proxy';

function makeContext(partial?: Partial<GeneratorContext>): GeneratorContext {
  return {
    nodes: [],
    edges: [],
    variables: [],
    settings: {},
    nodeMap: new Map(),
    edgeMap: new Map(),
    visitedNodes: new Set(),
    resultVars: new Map(),
    currentIndent: 1,
    ...partial,
  };
}

describe('activity-proxy helpers', () => {
  it('groupActivitiesByConfig groups by timeout and retry policy', () => {
    const baseNode: WorkflowNode = {
      id: 'a',
      type: 'activity',
      position: { x: 0, y: 0 },
      data: { label: 'A', timeout: '2s', retryPolicy: { strategy: 'none' } },
    };

    const nodes: WorkflowNode[] = [
      baseNode,
      {
        ...baseNode,
        id: 'b',
        data: { ...baseNode.data },
      },
      {
        ...baseNode,
        id: 'c',
        data: { ...baseNode.data, timeout: '5s' },
      },
    ];

    const groups = groupActivitiesByConfig(nodes);
    expect(groups.size).toBe(2);

    const sizes = Array.from(groups.values()).map(g => g.length).sort();
    expect(sizes).toEqual([1, 2]);
  });

  it('generateProxyVarName produces safe and descriptive identifiers', () => {
    const name1 = generateProxyVarName('2s', { strategy: 'none' });
    const name2 = generateProxyVarName('5 minutes', {
      strategy: 'exponential-backoff',
      maxAttempts: 3,
    });

    expect(name1).toMatch(/^activities/);
    expect(name1).not.toMatch(/[^a-zA-Z0-9]/);

    expect(name2).toContain('activities5minutes');
    expect(name2).toContain('RetryExponentialBackoff');
  });

  it('buildRetryOptions emits valid-looking config for fail-after-x', () => {
    const retry = {
      strategy: 'fail-after-x' as const,
      maxAttempts: 3,
      initialInterval: '1s',
      maxInterval: '30s',
      backoffCoefficient: 2,
    };

    const text = buildRetryOptions(retry, '  ');
    expect(text).toContain('maximumAttempts: 3');
    expect(text).toContain("initialInterval: '1s'");
    expect(text).toContain("maximumInterval: '30s'");
    expect(text).toContain('backoffCoefficient: 2');
    expect(text.trim().startsWith('{')).toBe(true);
    expect(text.trim().endsWith('}')).toBe(true);
  });

  it('buildInputParameter uses previous resultVar when available', () => {
    const node: WorkflowNode = {
      id: 'activity-2',
      type: 'activity',
      position: { x: 0, y: 0 },
      data: { label: 'Second Activity' },
    };

    const context = makeContext({
      edges: [{ id: 'e1', source: 'activity-1', target: 'activity-2' }],
      resultVars: new Map<string, string>([['activity-1', 'result_activity_1']]),
    });

    const param = buildInputParameter(node, context);
    expect(param).toBe('result_activity_1');
  });

  it('buildInputParameter falls back to input when there is no mapping', () => {
    const node: WorkflowNode = {
      id: 'activity-2',
      type: 'activity',
      position: { x: 0, y: 0 },
      data: { label: 'Second Activity' },
    };

    const context = makeContext();
    const param = buildInputParameter(node, context);
    expect(param).toBe('input');
  });
});

