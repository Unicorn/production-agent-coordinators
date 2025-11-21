# Extension Guide: Adding New Node Types

This guide walks you through adding a new node type to the Workflow Builder system, from UI components to code compilation.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Step-by-Step Guide](#step-by-step-guide)
- [Example: Loop Node](#example-loop-node)
- [Testing Your Extension](#testing-your-extension)
- [Best Practices](#best-practices)

---

## Overview

### What You'll Build

Adding a new node type requires changes in four layers:

1. **Frontend (React Flow UI)** - Visual node component
2. **Database Schema** - Node type registration
3. **Compiler Pattern** - Code generation logic
4. **Runtime** - Temporal workflow execution

### Example Node Types

Built-in node types:
- `trigger` - Workflow entry point
- `activity` - Execute an activity function
- `agent` - AI agent execution
- `conditional` - Branch based on condition
- `loop` - Iterate over array
- `state-variable` - Manage workflow state
- `signal` - Receive external signal
- `end` - Workflow termination

---

## System Architecture

### Node Type Flow

```
┌─────────────┐
│   User      │
│   Drags     │
│   Node      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│  React Flow Canvas      │
│  • NodeRenderer         │
│  • NodeConfig Panel     │
└──────┬──────────────────┘
       │
       │ Save
       ▼
┌─────────────────────────┐
│  Database               │
│  • workflows.definition │
│  • workflow_nodes       │
└──────┬──────────────────┘
       │
       │ Compile
       ▼
┌─────────────────────────┐
│  Compiler               │
│  • Pattern Detection    │
│  • Code Generation      │
└──────┬──────────────────┘
       │
       │ Deploy
       ▼
┌─────────────────────────┐
│  Temporal Worker        │
│  • Workflow Execution   │
└─────────────────────────┘
```

---

## Step-by-Step Guide

### Step 1: Define Node Type

**File:** `packages/workflow-builder/src/types/workflow-nodes.ts`

```typescript
export type NodeType =
  | 'trigger'
  | 'activity'
  | 'agent'
  | 'conditional'
  | 'loop'
  | 'my-custom-node'  // Add your node type
  // ... other types

export interface MyCustomNodeData {
  label: string;
  config: {
    // Your custom configuration
    customParam1: string;
    customParam2: number;
    // ...
  };
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  data: NodeData | MyCustomNodeData;  // Union with your type
  position: { x: number; y: number };
}
```

### Step 2: Create React Component

**File:** `packages/workflow-builder/src/components/workflow/nodes/MyCustomNode.tsx`

```typescript
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

export interface MyCustomNodeData {
  label: string;
  config: {
    customParam1: string;
    customParam2: number;
  };
}

export function MyCustomNode({ data, selected }: NodeProps<MyCustomNodeData>) {
  return (
    <div className={`
      px-4 py-2 shadow-md rounded-md border-2
      ${selected ? 'border-blue-500' : 'border-gray-300'}
      bg-white
    `}>
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3"
      />

      {/* Node Content */}
      <div className="flex items-center gap-2">
        <div className="text-lg">⚡</div>
        <div>
          <div className="font-bold text-sm">{data.label}</div>
          <div className="text-xs text-gray-500">
            Custom Node
          </div>
        </div>
      </div>

      {/* Display Config */}
      {data.config && (
        <div className="mt-2 text-xs text-gray-600">
          <div>Param1: {data.config.customParam1}</div>
          <div>Param2: {data.config.customParam2}</div>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3"
      />
    </div>
  );
}
```

### Step 3: Register Node Component

**File:** `packages/workflow-builder/src/components/workflow/nodes/index.ts`

```typescript
import { MyCustomNode } from './MyCustomNode';

export const nodeTypes = {
  trigger: TriggerNode,
  activity: ActivityNode,
  agent: AgentNode,
  conditional: ConditionalNode,
  loop: LoopNode,
  'my-custom-node': MyCustomNode,  // Register your node
  // ... other nodes
};
```

### Step 4: Add to Node Palette

**File:** `packages/workflow-builder/src/components/workflow/NodePalette.tsx`

```typescript
const nodeCategories = [
  {
    name: 'Control Flow',
    nodes: [
      // ... existing nodes
      {
        type: 'my-custom-node',
        label: 'My Custom Node',
        icon: '⚡',
        description: 'Does something custom',
        defaultData: {
          label: 'Custom Node',
          config: {
            customParam1: 'default value',
            customParam2: 0
          }
        }
      }
    ]
  }
];
```

### Step 5: Create Configuration Panel

**File:** `packages/workflow-builder/src/components/workflow/config-panels/MyCustomNodeConfig.tsx`

```typescript
import React from 'react';
import { WorkflowNode } from '@/types/workflow-nodes';

interface Props {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
}

export function MyCustomNodeConfig({ node, onUpdate }: Props) {
  const config = node.data.config || {};

  const handleChange = (key: string, value: any) => {
    onUpdate({
      data: {
        ...node.data,
        config: {
          ...config,
          [key]: value
        }
      }
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="font-bold">Custom Node Configuration</h3>

      {/* Label */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Label
        </label>
        <input
          type="text"
          value={node.data.label}
          onChange={(e) => onUpdate({
            data: { ...node.data, label: e.target.value }
          })}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Custom Param 1 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Custom Parameter 1
        </label>
        <input
          type="text"
          value={config.customParam1 || ''}
          onChange={(e) => handleChange('customParam1', e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Custom Param 2 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Custom Parameter 2
        </label>
        <input
          type="number"
          value={config.customParam2 || 0}
          onChange={(e) => handleChange('customParam2', parseInt(e.target.value))}
          className="w-full border rounded px-3 py-2"
        />
      </div>
    </div>
  );
}
```

### Step 6: Register Config Panel

**File:** `packages/workflow-builder/src/components/workflow/config-panels/index.tsx`

```typescript
import { MyCustomNodeConfig } from './MyCustomNodeConfig';

export function NodeConfigPanel({ node, onUpdate }: Props) {
  switch (node.type) {
    case 'trigger':
      return <TriggerConfig node={node} onUpdate={onUpdate} />;
    case 'activity':
      return <ActivityConfig node={node} onUpdate={onUpdate} />;
    case 'my-custom-node':
      return <MyCustomNodeConfig node={node} onUpdate={onUpdate} />;
    // ... other cases
    default:
      return null;
  }
}
```

### Step 7: Create Compiler Pattern

**File:** `packages/workflow-builder/src/lib/compiler/patterns/my-custom-pattern.ts`

```typescript
import type { Pattern, WorkflowNode, GeneratorContext, CodeBlock } from '../types';
import { indent } from '../utils/ast-helpers';

export const MyCustomPattern: Pattern = {
  name: 'my-custom-pattern',
  priority: 50,

  detect: (node: WorkflowNode, context: GeneratorContext): boolean => {
    return node.type === 'my-custom-node';
  },

  generate: (node: WorkflowNode, context: GeneratorContext): CodeBlock => {
    const config = node.data.config || {};
    const indentStr = indent(context.currentIndent);

    // Generate result variable
    const resultVar = `result_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    context.resultVars.set(node.id, resultVar);

    // Generate code
    const code = `
${indentStr}// Execute custom node: ${node.data.label}
${indentStr}const ${resultVar} = await customActivity({
${indentStr}  param1: '${config.customParam1}',
${indentStr}  param2: ${config.customParam2}
${indentStr}});
${indentStr}console.log('Custom node result:', ${resultVar});
    `.trim();

    return {
      code,
      imports: [
        "import { proxyActivities } from '@temporalio/workflow';"
      ],
      declarations: [
        "const { customActivity } = proxyActivities<typeof activities>({ startToCloseTimeout: '1 minute' });"
      ],
      resultVar
    };
  },

  dependencies: ['@temporalio/workflow']
};
```

### Step 8: Register Compiler Pattern

**File:** `packages/workflow-builder/src/lib/compiler/patterns/index.ts`

```typescript
export { ActivityProxyPattern } from './activity-proxy';
export { StateManagementPattern } from './state-management';
export { MyCustomPattern } from './my-custom-pattern';  // Add export
```

**File:** `packages/workflow-builder/src/lib/compiler/index.ts`

```typescript
import { MyCustomPattern } from './patterns';

private registerDefaultPatterns(): void {
  this.registerPattern(ActivityProxyPattern);
  this.registerPattern(StateManagementPattern);
  this.registerPattern(MyCustomPattern);  // Register pattern
}
```

### Step 9: Add Validation

**File:** `packages/workflow-builder/src/lib/compiler/utils/validation.ts`

```typescript
function validateNode(node: WorkflowNode): CompilerError[] {
  const errors: CompilerError[] = [];

  switch (node.type) {
    case 'my-custom-node':
      const config = node.data.config;

      if (!config.customParam1) {
        errors.push({
          message: 'Custom Parameter 1 is required',
          nodeId: node.id,
          type: 'validation',
          severity: 'error'
        });
      }

      if (config.customParam2 < 0) {
        errors.push({
          message: 'Custom Parameter 2 must be non-negative',
          nodeId: node.id,
          type: 'validation',
          severity: 'error'
        });
      }
      break;
    // ... other cases
  }

  return errors;
}
```

### Step 10: Update Database Types

**File:** `packages/workflow-builder/src/types/database.ts`

Add node type to enum if using database-enforced types:

```typescript
// If you have a node_types table
CREATE TYPE node_type AS ENUM (
  'trigger',
  'activity',
  'agent',
  'conditional',
  'loop',
  'my-custom-node'  -- Add your type
);
```

---

## Example: Loop Node

Let's implement a complete loop node that iterates over an array.

### 1. Type Definition

```typescript
export interface LoopNodeData {
  label: string;
  config: {
    arraySource: 'input' | 'variable' | 'previousNode';
    arrayVariable?: string;
    arrayPath?: string;
    itemVariable: string;
    maxIterations?: number;
  };
}
```

### 2. React Component

```typescript
export function LoopNode({ data, selected }: NodeProps<LoopNodeData>) {
  const config = data.config || {};

  return (
    <div className={`
      px-4 py-2 shadow-md rounded-md border-2
      ${selected ? 'border-blue-500' : 'border-gray-300'}
      bg-purple-50
    `}>
      <Handle type="target" position={Position.Top} />

      <div className="flex items-center gap-2">
        <div className="text-lg">🔄</div>
        <div>
          <div className="font-bold text-sm">{data.label}</div>
          <div className="text-xs text-gray-500">Loop</div>
        </div>
      </div>

      {config.itemVariable && (
        <div className="mt-2 text-xs text-gray-600">
          For each <code>{config.itemVariable}</code>
          {config.maxIterations && ` (max: ${config.maxIterations})`}
        </div>
      )}

      {/* Two output handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="loop-body"
        style={{ left: '33%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="loop-complete"
        style={{ left: '66%' }}
      />
    </div>
  );
}
```

### 3. Configuration Panel

```typescript
export function LoopNodeConfig({ node, onUpdate }: Props) {
  const config = node.data.config || {};

  return (
    <div className="space-y-4">
      <h3 className="font-bold">Loop Configuration</h3>

      {/* Array Source */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Array Source
        </label>
        <select
          value={config.arraySource || 'input'}
          onChange={(e) => handleChange('arraySource', e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          <option value="input">Workflow Input</option>
          <option value="variable">State Variable</option>
          <option value="previousNode">Previous Node Result</option>
        </select>
      </div>

      {/* Array Path */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Array Path (e.g., "items" or "data.items")
        </label>
        <input
          type="text"
          value={config.arrayPath || ''}
          onChange={(e) => handleChange('arrayPath', e.target.value)}
          placeholder="items"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Item Variable */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Item Variable Name
        </label>
        <input
          type="text"
          value={config.itemVariable || ''}
          onChange={(e) => handleChange('itemVariable', e.target.value)}
          placeholder="item"
          className="w-full border rounded px-3 py-2"
        />
      </div>

      {/* Max Iterations */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Max Iterations (optional)
        </label>
        <input
          type="number"
          value={config.maxIterations || ''}
          onChange={(e) => handleChange('maxIterations', parseInt(e.target.value))}
          placeholder="Unlimited"
          className="w-full border rounded px-3 py-2"
        />
      </div>
    </div>
  );
}
```

### 4. Compiler Pattern

```typescript
export const LoopPattern: Pattern = {
  name: 'loop',
  priority: 70,

  detect: (node: WorkflowNode, context: GeneratorContext): boolean => {
    return node.type === 'loop';
  },

  generate: (node: WorkflowNode, context: GeneratorContext): CodeBlock => {
    const config = node.data.config || {};
    const itemVar = config.itemVariable || 'item';
    const arrayPath = config.arrayPath || 'items';
    const maxIterations = config.maxIterations;

    const indentStr = indent(context.currentIndent);

    // Get array source
    let arraySource: string;
    switch (config.arraySource) {
      case 'variable':
        arraySource = config.arrayVariable || 'items';
        break;
      case 'previousNode':
        const prevResult = getPreviousNodeResult(node, context);
        arraySource = `${prevResult}.${arrayPath}`;
        break;
      case 'input':
      default:
        arraySource = `input.${arrayPath}`;
    }

    // Get edges for loop body and completion
    const edges = context.edgeMap.get(node.id) || [];
    const bodyEdge = edges.find(e => e.sourceHandle === 'loop-body');
    const completeEdge = edges.find(e => e.sourceHandle === 'loop-complete');

    // Generate code
    const code = `
${indentStr}// Loop: ${node.data.label}
${indentStr}const array_${node.id} = ${arraySource} || [];
${indentStr}const results_${node.id} = [];
${indentStr}
${indentStr}for (let i = 0; i < array_${node.id}.length; i++) {
${maxIterations ? `${indentStr}  if (i >= ${maxIterations}) break;` : ''}
${indentStr}  const ${itemVar} = array_${node.id}[i];
${indentStr}  console.log('Loop iteration', i, ${itemVar});
${indentStr}
${bodyEdge ? generateLoopBody(bodyEdge, itemVar, context) : ''}
${indentStr}}
${indentStr}
${indentStr}console.log('Loop completed with', results_${node.id}.length, 'results');
    `.trim();

    return {
      code,
      imports: [],
      declarations: [],
      resultVar: `results_${node.id}`
    };
  }
};

function generateLoopBody(
  edge: WorkflowEdge,
  itemVar: string,
  context: GeneratorContext
): string {
  const targetNode = context.nodeMap.get(edge.target);
  if (!targetNode) return '';

  // Generate code for target node with itemVar in scope
  // This would recursively call pattern generation
  return `  // Execute loop body for ${itemVar}`;
}
```

### 5. Testing

```typescript
// __tests__/loop-pattern.test.ts

describe('LoopPattern', () => {
  it('generates loop code for input array', () => {
    const node: WorkflowNode = {
      id: 'loop1',
      type: 'loop',
      data: {
        label: 'Process Items',
        config: {
          arraySource: 'input',
          arrayPath: 'items',
          itemVariable: 'item',
          maxIterations: 10
        }
      },
      position: { x: 0, y: 0 }
    };

    const context = createMockContext();
    const result = LoopPattern.generate(node, context);

    expect(result.code).toContain('for (let i = 0');
    expect(result.code).toContain('const item =');
    expect(result.code).toContain('if (i >= 10) break');
  });
});
```

---

## Testing Your Extension

### Unit Tests

Test each layer independently:

```typescript
// 1. Component Test
import { render } from '@testing-library/react';
import { MyCustomNode } from '@/components/workflow/nodes/MyCustomNode';

test('renders custom node', () => {
  const { getByText } = render(
    <MyCustomNode
      data={{
        label: 'Test Node',
        config: { customParam1: 'test', customParam2: 42 }
      }}
      id="test"
      selected={false}
    />
  );

  expect(getByText('Test Node')).toBeInTheDocument();
});

// 2. Pattern Test
import { MyCustomPattern } from '@/lib/compiler/patterns/my-custom-pattern';

test('detects custom node type', () => {
  const node = { type: 'my-custom-node', /* ... */ };
  expect(MyCustomPattern.detect(node, mockContext)).toBe(true);
});

test('generates correct code', () => {
  const result = MyCustomPattern.generate(node, mockContext);
  expect(result.code).toContain('customActivity');
  expect(result.imports).toContain('@temporalio/workflow');
});

// 3. Integration Test
import { WorkflowCompiler } from '@/lib/compiler';

test('compiles workflow with custom node', () => {
  const workflow = {
    id: 'test',
    name: 'test-workflow',
    nodes: [
      { type: 'trigger', /* ... */ },
      { type: 'my-custom-node', /* ... */ }
    ],
    edges: [/* ... */]
  };

  const compiler = new WorkflowCompiler();
  const result = compiler.compile(workflow);

  expect(result.success).toBe(true);
  expect(result.workflowCode).toContain('customActivity');
});
```

### End-to-End Tests

Test the full flow:

```typescript
// packages/workflow-builder/tests/e2e/custom-node.spec.ts

import { test, expect } from '@playwright/test';

test('create workflow with custom node', async ({ page }) => {
  await page.goto('/workflows/new');

  // Drag custom node
  await page.dragAndDrop(
    '[data-node-type="my-custom-node"]',
    '.react-flow-wrapper',
    { targetPosition: { x: 400, y: 300 } }
  );

  // Configure node
  await page.click('.react-flow__node-my-custom-node');
  await page.fill('[name="customParam1"]', 'test value');
  await page.fill('[name="customParam2"]', '42');

  // Save workflow
  await page.click('button:text("Save")');

  // Verify saved
  await expect(page.locator('.toast-success')).toBeVisible();
});

test('compile workflow with custom node', async ({ page }) => {
  // ... create workflow

  // Compile
  await page.click('button:text("Compile")');

  // Verify compilation
  await expect(page.locator('.compilation-success')).toBeVisible();

  // Check generated code
  const code = await page.textContent('.compiled-code');
  expect(code).toContain('customActivity');
});
```

---

## Best Practices

### 1. Node Design

**Clear Visual Identity**
```typescript
<div className="bg-purple-50">  {/* Unique color */}
  <div className="text-lg">🔄</div>  {/* Unique icon */}
  <div className="font-bold">{label}</div>
</div>
```

**Informative Display**
```typescript
{/* Show key config in node */}
<div className="text-xs">
  For each {config.itemVariable}
  {config.maxIterations && ` (max: ${config.maxIterations})`}
</div>
```

**Proper Handles**
```typescript
{/* Input handle */}
<Handle type="target" position={Position.Top} />

{/* Multiple outputs if needed */}
<Handle type="source" position={Position.Bottom} id="success" />
<Handle type="source" position={Position.Right} id="error" />
```

### 2. Configuration Panel

**Validation**
```typescript
const handleChange = (key: string, value: any) => {
  // Validate before updating
  if (key === 'customParam2' && value < 0) {
    setError('Parameter must be non-negative');
    return;
  }

  onUpdate({
    data: {
      ...node.data,
      config: { ...config, [key]: value }
    }
  });
};
```

**Help Text**
```typescript
<div>
  <label>Custom Parameter</label>
  <input {...} />
  <p className="text-xs text-gray-500 mt-1">
    This parameter controls the behavior of...
  </p>
</div>
```

**Defaults**
```typescript
const config = {
  customParam1: 'default',
  customParam2: 0,
  ...node.data.config  // Override with saved values
};
```

### 3. Compiler Pattern

**Error Handling**
```typescript
generate: (node, context) => {
  try {
    const config = node.data.config;

    if (!config.requiredParam) {
      throw new Error('Required parameter missing');
    }

    // Generate code...
  } catch (error) {
    console.error('Pattern generation failed:', error);
    return {
      code: `// Error: ${error.message}`,
      imports: [],
      declarations: []
    };
  }
}
```

**Documentation**
```typescript
/**
 * My Custom Pattern
 *
 * Generates code for custom node type.
 *
 * Example generated code:
 * ```typescript
 * const result = await customActivity({ param1: 'value' });
 * ```
 */
export const MyCustomPattern: Pattern = {
  // ...
};
```

**Optimization**
```typescript
generate: (node, context) => {
  // Check if this is first occurrence
  const isFirst = isFirstOccurrence(node, context);

  const declarations = isFirst
    ? [/* setup code */]
    : [];  // Don't repeat setup

  return { code, imports, declarations };
}
```

### 4. Type Safety

**Strict Types**
```typescript
interface MyCustomNodeConfig {
  customParam1: string;
  customParam2: number;
  optionalParam?: boolean;
}

interface MyCustomNodeData {
  label: string;
  config: MyCustomNodeConfig;
}
```

**Type Guards**
```typescript
function isMyCustomNode(node: WorkflowNode): node is WorkflowNode<MyCustomNodeData> {
  return node.type === 'my-custom-node';
}

// Usage
if (isMyCustomNode(node)) {
  // TypeScript knows node.data is MyCustomNodeData
  console.log(node.data.config.customParam1);
}
```

### 5. Documentation

Create documentation for your node type:

**File:** `docs/user-guide/nodes/my-custom-node.md`

```markdown
# My Custom Node

## Overview

The My Custom Node allows you to...

## Configuration

- **Custom Parameter 1** - Description
- **Custom Parameter 2** - Description

## Example

[Screenshot of configured node]

## Generated Code

```typescript
const result = await customActivity({
  param1: 'value',
  param2: 42
});
```

## See Also

- [Activity Nodes](./activity-node.md)
- [Custom Activities Guide](../development/custom-activities.md)
```

---

## Checklist

Before releasing your extension:

- [ ] Type definitions added
- [ ] React component created and styled
- [ ] Component registered in node types
- [ ] Added to node palette
- [ ] Configuration panel created
- [ ] Config panel registered
- [ ] Compiler pattern created
- [ ] Pattern registered and tested
- [ ] Validation logic added
- [ ] Database types updated (if needed)
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] E2E tests written
- [ ] Documentation created
- [ ] Example workflows created

---

## Next Steps

- [Compiler Architecture](../architecture/compiler.md) - Deep dive into patterns
- [API Reference](../api/reference.md) - Using the compilation API
- [Database Schema](../database/schema.md) - Database structure
- [Testing Guide](../testing/README.md) - Testing workflows
