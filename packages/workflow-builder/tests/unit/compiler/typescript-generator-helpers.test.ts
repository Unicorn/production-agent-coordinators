import { describe, it, expect } from 'vitest';
import {
  generateWorkflowFunction,
  buildImports,
  buildDeclarations,
  generateActivitiesFile,
} from '@/lib/compiler/generators/typescript-generator';
import type { CodeBlock, WorkflowDefinition } from '@/lib/compiler/types';

describe('generateWorkflowFunction helper', () => {
  it('emits an exported async function with the expected name and Promise<any> return type', () => {
    const code = generateWorkflowFunction(
      'TestSimpleWorkflow',
      'Example workflow',
      [],
      '// body',
      true,
      null
    );

    expect(code).toContain('export async function TestSimpleWorkflow');
    expect(code).toContain('(input: any): Promise<any>');
  });

  it('returns the last result variable when provided', () => {
    const code = generateWorkflowFunction(
      'TestReturnWorkflow',
      'Returns last result',
      [],
      '  const result_step1 = await doSomething(input);',
      false,
      'result_step1'
    );

    // Ensure we return the provided lastResultVar and not the default success object.
    expect(code).toContain('return result_step1;');
    expect(code).not.toContain("return { success: true }");
  });

  it('falls back to a default success object when no result variable is provided', () => {
    const code = generateWorkflowFunction(
      'TestDefaultReturnWorkflow',
      undefined,
      [],
      '// no explicit result variable',
      false,
      null
    );

    expect(code).toContain("return { success: true };");
  });
});

describe('buildImports helper', () => {
  it('collects and merges imports from code blocks', () => {
    const blocks: CodeBlock[] = [
      {
        code: '// block 1',
        imports: ["import { foo } from './module1';"],
      },
      {
        code: '// block 2',
        imports: ["import { bar } from './module1';", "import { baz } from './module2';"],
      },
    ];

    const imports = buildImports(blocks);

    expect(imports.length).toBeGreaterThan(0);
    expect(imports.some(imp => imp.includes('foo'))).toBe(true);
    expect(imports.some(imp => imp.includes('bar'))).toBe(true);
    expect(imports.some(imp => imp.includes('baz'))).toBe(true);
  });

  it('deduplicates imports from the same module', () => {
    const blocks: CodeBlock[] = [
      {
        code: '// block 1',
        imports: ["import { foo } from './module1';"],
      },
      {
        code: '// block 2',
        imports: ["import { foo } from './module1';", "import { bar } from './module1';"],
      },
    ];

    const imports = buildImports(blocks);
    const module1Imports = imports.filter(imp => imp.includes('./module1'));

    // Should have only one import statement for module1 with both foo and bar
    expect(module1Imports.length).toBe(1);
    expect(module1Imports[0]).toContain('foo');
    expect(module1Imports[0]).toContain('bar');
  });

  it('handles empty code blocks', () => {
    const blocks: CodeBlock[] = [];
    const imports = buildImports(blocks);
    expect(imports).toEqual([]);
  });

  it('handles blocks without imports', () => {
    const blocks: CodeBlock[] = [
      { code: '// block 1' },
      { code: '// block 2' },
    ];
    const imports = buildImports(blocks);
    expect(imports).toEqual([]);
  });
});

describe('buildDeclarations helper', () => {
  it('collects declarations from code blocks', () => {
    const blocks: CodeBlock[] = [
      {
        code: '// block 1',
        declarations: ['const x = 1;', 'let y = 2;'],
      },
      {
        code: '// block 2',
        declarations: ['const z = 3;'],
      },
    ];

    const declarations = buildDeclarations(blocks);

    expect(declarations).toHaveLength(3);
    expect(declarations).toContain('const x = 1;');
    expect(declarations).toContain('let y = 2;');
    expect(declarations).toContain('const z = 3;');
  });

  it('handles empty code blocks', () => {
    const blocks: CodeBlock[] = [];
    const declarations = buildDeclarations(blocks);
    expect(declarations).toEqual([]);
  });

  it('handles blocks without declarations', () => {
    const blocks: CodeBlock[] = [
      { code: '// block 1' },
      { code: '// block 2' },
    ];
    const declarations = buildDeclarations(blocks);
    expect(declarations).toEqual([]);
  });
});

describe('generateActivitiesFile helper', () => {
  it('exports functions for all activity nodes', () => {
    const workflow: WorkflowDefinition = {
      id: 'test',
      name: 'TestWorkflow',
      nodes: [
        {
          id: 'activity-1',
          type: 'activity',
          position: { x: 0, y: 0 },
          data: {
            label: 'Activity 1',
            componentName: 'activityOne',
          },
        },
        {
          id: 'activity-2',
          type: 'activity',
          position: { x: 100, y: 0 },
          data: {
            label: 'Activity 2',
            componentName: 'activityTwo',
          },
        },
      ],
      edges: [],
      variables: [],
      settings: {},
    };

    const code = generateActivitiesFile(workflow);

    expect(code).toContain('export async function activityOne');
    expect(code).toContain('export async function activityTwo');
  });

  it('exports functions for agent nodes', () => {
    const workflow: WorkflowDefinition = {
      id: 'test',
      name: 'TestWorkflow',
      nodes: [
        {
          id: 'agent-1',
          type: 'agent',
          position: { x: 0, y: 0 },
          data: {
            label: 'Agent 1',
            componentName: 'agentOne',
          },
        },
      ],
      edges: [],
      variables: [],
      settings: {},
    };

    const code = generateActivitiesFile(workflow);

    expect(code).toContain('export async function agentOne');
  });

  it('generates placeholder activity when no activities exist', () => {
    const workflow: WorkflowDefinition = {
      id: 'test',
      name: 'TestWorkflow',
      nodes: [],
      edges: [],
      variables: [],
      settings: {},
    };

    const code = generateActivitiesFile(workflow);

    expect(code).toContain('export async function placeholderActivity');
  });

  it('uses componentName when available, otherwise generates from node ID', () => {
    const workflow: WorkflowDefinition = {
      id: 'test',
      name: 'TestWorkflow',
      nodes: [
        {
          id: 'my-activity',
          type: 'activity',
          position: { x: 0, y: 0 },
          data: {
            label: 'My Activity',
            // No componentName
          },
        },
      ],
      edges: [],
      variables: [],
      settings: {},
    };

    const code = generateActivitiesFile(workflow);

    // Should use camelCase of node ID
    expect(code).toContain('export async function myActivity');
  });
});


