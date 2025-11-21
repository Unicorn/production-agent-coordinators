# Compiler Architecture

The Workflow Builder uses a pattern-based compilation system to transform visual workflow definitions into executable TypeScript code for Temporal.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Compilation Pipeline](#compilation-pipeline)
- [Pattern System](#pattern-system)
- [Code Generation](#code-generation)
- [Extending the Compiler](#extending-the-compiler)

---

## Overview

The compiler transforms workflow definitions (nodes + edges) into three TypeScript files:

1. **Workflow File** (`workflows.ts`) - Main workflow logic using Temporal SDK
2. **Activities File** (`activities.ts`) - Activity implementations (business logic)
3. **Worker File** (`worker.ts`) - Worker configuration and bootstrap

### Design Principles

1. **Pattern-Based** - Compilation uses reusable patterns for node types
2. **Graph Traversal** - Follows workflow graph from start node
3. **Context-Aware** - Maintains state during compilation for cross-node references
4. **Type-Safe** - Generates fully-typed TypeScript code
5. **Extensible** - New patterns can be registered for custom node types

---

## Architecture

### Core Classes and Interfaces

```
┌──────────────────────┐
│  WorkflowCompiler    │  Main compiler class
└──────────┬───────────┘
           │ uses
           ▼
┌──────────────────────┐
│  Pattern[]           │  Registered patterns
└──────────┬───────────┘
           │ generates
           ▼
┌──────────────────────┐
│  CodeBlock[]         │  Code blocks with metadata
└──────────┬───────────┘
           │ assembled by
           ▼
┌──────────────────────┐
│  TypeScript          │  Final TypeScript files
│  Generator           │
└──────────────────────┘
```

### File Structure

```
packages/workflow-builder/src/lib/compiler/
├── index.ts                    # Main WorkflowCompiler class
├── types.ts                    # TypeScript interfaces
├── patterns/
│   ├── index.ts               # Pattern exports
│   ├── activity-proxy.ts      # Activity/agent pattern
│   └── state-management.ts    # State variable pattern
├── generators/
│   ├── typescript-generator.ts # Code generation
│   └── import-generator.ts    # Import statement handling
└── utils/
    ├── validation.ts          # Workflow validation
    └── ast-helpers.ts         # AST utility functions
```

---

## Compilation Pipeline

The compiler follows a five-step pipeline:

### Step 1: Validation

```typescript
const validation = validateWorkflow(workflow);

if (!validation.valid) {
  return {
    success: false,
    errors: validation.errors,
    warnings: validation.warnings
  };
}
```

**Validation Checks:**
- At least one node exists
- Start node (trigger) exists
- No circular dependencies
- All edges connect to valid nodes
- Required node properties are present
- Node configurations are valid

### Step 2: Context Building

```typescript
const context: GeneratorContext = {
  nodes: workflow.nodes,
  edges: workflow.edges,
  variables: workflow.variables,
  settings: workflow.settings,
  nodeMap: Map<string, WorkflowNode>,      // Quick node lookup
  edgeMap: Map<string, WorkflowEdge[]>,    // Outgoing edges per node
  visitedNodes: Set<string>,               // Track visited nodes
  resultVars: Map<string, string>,         // Map node ID to result var
  currentIndent: 0
};
```

The context provides:
- Quick lookups for nodes and edges
- Tracking of visited nodes (prevents infinite loops)
- Variable naming across nodes
- Current indentation level

### Step 3: Pattern Application

The compiler traverses the workflow graph depth-first, applying patterns to each node:

```typescript
private traverseAndGenerate(
  node: WorkflowNode,
  context: GeneratorContext,
  codeBlocks: CodeBlock[]
): void {
  // Skip if already visited
  if (context.visitedNodes.has(node.id)) {
    return;
  }

  context.visitedNodes.add(node.id);

  // Find matching pattern (sorted by priority)
  for (const pattern of this.patterns) {
    if (pattern.detect(node, context)) {
      const codeBlock = pattern.generate(node, context);
      codeBlocks.push(codeBlock);
      break;
    }
  }

  // Traverse connected nodes
  const outgoingEdges = context.edgeMap.get(node.id) || [];
  for (const edge of outgoingEdges) {
    const nextNode = context.nodeMap.get(edge.target);
    if (nextNode) {
      this.traverseAndGenerate(nextNode, context, codeBlocks);
    }
  }
}
```

### Step 4: Code Generation

Code blocks are assembled into complete TypeScript files:

```typescript
const workflowCode = generateWorkflowFile(
  workflow,
  codeBlocks,
  context,
  options.includeComments
);

const activitiesCode = generateActivitiesFile(
  workflow,
  options.includeComments
);

const workerCode = generateWorkerFile(
  workflow,
  options.includeComments
);
```

### Step 5: Result Assembly

```typescript
return {
  success: true,
  workflowCode,        // Complete workflow TypeScript
  activitiesCode,      // Activity stubs
  workerCode,          // Worker bootstrap
  packageJson,         // package.json
  tsConfig,            // tsconfig.json
  errors: [],
  warnings: validationWarnings,
  metadata: {
    nodeCount: workflow.nodes.length,
    edgeCount: workflow.edges.length,
    patternsApplied: Array.from(context.visitedNodes),
    compilationTime: Date.now() - startTime,
    version: '1.0.0'
  }
};
```

---

## Pattern System

Patterns are the core compilation mechanism. Each pattern handles one or more node types.

### Pattern Interface

```typescript
interface Pattern {
  name: string;                  // Pattern identifier
  priority?: number;             // Higher runs first (default: 0)
  detect: (node: WorkflowNode, context: GeneratorContext) => boolean;
  generate: (node: WorkflowNode, context: GeneratorContext) => CodeBlock;
  dependencies?: string[];       // NPM packages required
}
```

### CodeBlock Interface

```typescript
interface CodeBlock {
  code: string;                  // Generated code
  imports?: string[];            // Import statements needed
  declarations?: string[];       // Top-level declarations
  resultVar?: string;            // Variable name for result
}
```

### Built-in Patterns

#### 1. Activity Proxy Pattern

**Priority:** 100 (High)

**Detects:** `activity` and `agent` node types

**Generates:**
- `proxyActivities()` setup (on first activity)
- Activity invocation with timeout and retry
- Result variable assignment

**Example Output:**
```typescript
// Activity proxies (generated once)
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from './activities';

const { sendEmail, validateData } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

// Activity invocation (per node)
// Execute activity: Send Email
const result_send_email = await sendEmail(input);
```

**Implementation:**
```typescript
export const ActivityProxyPattern: Pattern = {
  name: 'activity-proxy',
  priority: 100,

  detect: (node: WorkflowNode, context: GeneratorContext): boolean => {
    return node.type === 'activity' || node.type === 'agent';
  },

  generate: (node: WorkflowNode, context: GeneratorContext): CodeBlock => {
    const activityName = node.data.activityName || toCamelCase(node.id);
    const resultVar = `result_${node.id.replace(/[^a-zA-Z0-9]/g, '_')}`;

    context.resultVars.set(node.id, resultVar);

    return {
      code: `const ${resultVar} = await ${activityName}(input);`,
      imports: ['import { proxyActivities } from \'@temporalio/workflow\';'],
      declarations: [/* proxy setup */],
      resultVar
    };
  },

  dependencies: ['@temporalio/workflow', '@temporalio/activity']
};
```

#### 2. State Management Pattern

**Priority:** 90

**Detects:** `state-variable` node types

**Generates:**
- Variable declarations (on first use)
- State operations (set, append, increment, etc.)

**Example Output:**
```typescript
// State variable declaration
let counter = 0;
let items = [];

// State operations
counter++;
items.push(result_previous_node);
```

**Implementation:**
```typescript
export const StateManagementPattern: Pattern = {
  name: 'state-management',
  priority: 90,

  detect: (node: WorkflowNode, context: GeneratorContext): boolean => {
    return node.type === 'state-variable';
  },

  generate: (node: WorkflowNode, context: GeneratorContext): CodeBlock => {
    const config = node.data.config || {};
    const varName = config.name || toCamelCase(node.id);
    const operation = config.operation || 'set';

    const code = generateStateOperation(varName, operation, config);
    const declarations = isFirstOccurrence(node, context)
      ? [`let ${varName} = ${getInitialValue(operation)};`]
      : [];

    return { code, declarations, imports: [] };
  }
};
```

### Pattern Registration

Patterns are registered in the compiler constructor:

```typescript
constructor(options: CompilerOptions = {}) {
  this.options = { ...defaultOptions, ...options };
  this.registerDefaultPatterns();
}

private registerDefaultPatterns(): void {
  this.registerPattern(ActivityProxyPattern);
  this.registerPattern(StateManagementPattern);
  // Sorted by priority automatically
}

registerPattern(pattern: Pattern): void {
  this.patterns.push(pattern);
  this.patterns.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}
```

---

## Code Generation

### Workflow File Generation

The workflow file combines:
1. Imports (merged and deduplicated)
2. Top-level declarations (from patterns)
3. Workflow function with body

```typescript
export function generateWorkflowFile(
  workflow: WorkflowDefinition,
  codeBlocks: CodeBlock[],
  context: GeneratorContext,
  includeComments = true
): string {
  // 1. Collect and merge imports
  const allImports = codeBlocks.flatMap(b => b.imports || []);
  const imports = mergeImports(allImports);

  // 2. Collect declarations
  const declarations = codeBlocks.flatMap(b => b.declarations || []);

  // 3. Combine code blocks
  const workflowBody = codeBlocks
    .map(block => block.code)
    .filter(code => code.trim().length > 0)
    .join('\n\n');

  // 4. Generate complete function
  return `
${imports.join('\n')}

/**
 * Workflow: ${workflow.name}
 * ${workflow.settings.description || 'Auto-generated Temporal workflow'}
 */
export async function ${toCamelCase(workflow.name)}Workflow(input: any): Promise<any> {
  ${declarations.map(d => '  ' + d).join('\n')}

  ${indentCode(workflowBody, 1)}

  return { success: true };
}
`.trim() + '\n';
}
```

### Import Merging

Imports are merged to avoid duplicates:

```typescript
function mergeImports(imports: string[]): string[] {
  const importMap = new Map<string, Set<string>>();

  for (const imp of imports) {
    const match = imp.match(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/);
    if (match) {
      const [, items, module] = match;
      if (!importMap.has(module)) {
        importMap.set(module, new Set());
      }
      items.split(',').forEach(item => {
        importMap.get(module)!.add(item.trim());
      });
    }
  }

  return Array.from(importMap.entries()).map(([module, items]) => {
    return `import { ${Array.from(items).join(', ')} } from '${module}';`;
  });
}
```

### Activities File Generation

Activity stubs are generated from activity/agent nodes:

```typescript
export function generateActivitiesFile(
  workflow: WorkflowDefinition,
  includeComments = true
): string {
  const activityNodes = workflow.nodes.filter(
    n => n.type === 'activity' || n.type === 'agent'
  );

  return activityNodes.map(node => {
    const name = node.data.componentName || toCamelCase(node.id);
    const description = node.data.label || node.id;

    return `
/**
 * ${description}
 */
export async function ${name}(input: any): Promise<any> {
  // TODO: Implement activity logic
  console.log('Executing ${name}', input);
  return { success: true, data: input };
}
`.trim();
  }).join('\n\n') + '\n';
}
```

### Worker File Generation

Worker bootstrap code:

```typescript
export function generateWorkerFile(
  workflow: WorkflowDefinition,
  includeComments = true
): string {
  const taskQueue = workflow.settings.taskQueue || 'default';

  return `
import { Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: '${taskQueue}',
  });

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
`.trim() + '\n';
}
```

---

## Extending the Compiler

### Adding a New Pattern

1. **Create Pattern File**

```typescript
// packages/workflow-builder/src/lib/compiler/patterns/my-pattern.ts

import type { Pattern, WorkflowNode, GeneratorContext, CodeBlock } from '../types';

export const MyCustomPattern: Pattern = {
  name: 'my-custom-pattern',
  priority: 50,  // Medium priority

  detect: (node: WorkflowNode, context: GeneratorContext): boolean => {
    return node.type === 'my-custom-type';
  },

  generate: (node: WorkflowNode, context: GeneratorContext): CodeBlock => {
    const config = node.data.config || {};

    // Generate code
    const code = `
      // Custom node logic
      console.log('Executing custom node: ${node.data.label}');
    `.trim();

    // Return code block
    return {
      code,
      imports: ['import { customFunction } from \'my-package\';'],
      declarations: [],
      resultVar: `result_${node.id}`
    };
  },

  dependencies: ['my-package']
};
```

2. **Register Pattern**

```typescript
// packages/workflow-builder/src/lib/compiler/patterns/index.ts

export { ActivityProxyPattern } from './activity-proxy';
export { StateManagementPattern } from './state-management';
export { MyCustomPattern } from './my-pattern';  // Add export
```

3. **Register in Compiler**

```typescript
// packages/workflow-builder/src/lib/compiler/index.ts

import { MyCustomPattern } from './patterns';

private registerDefaultPatterns(): void {
  this.registerPattern(ActivityProxyPattern);
  this.registerPattern(StateManagementPattern);
  this.registerPattern(MyCustomPattern);  // Add here
}
```

### Pattern Best Practices

1. **Single Responsibility** - Each pattern handles one node type or concept
2. **High Cohesion** - Related code generation stays together
3. **Context Usage** - Use context for cross-node references
4. **Result Variables** - Store result vars in context for downstream nodes
5. **Idempotency** - Patterns should be safe to run multiple times
6. **Documentation** - Add JSDoc comments explaining the pattern

### Example: Conditional Pattern

```typescript
export const ConditionalPattern: Pattern = {
  name: 'conditional',
  priority: 80,

  detect: (node: WorkflowNode, context: GeneratorContext): boolean => {
    return node.type === 'conditional' || node.type === 'condition';
  },

  generate: (node: WorkflowNode, context: GeneratorContext): CodeBlock => {
    const config = node.data.config || {};
    const condition = config.condition || 'true';

    // Get edges
    const edges = context.edgeMap.get(node.id) || [];
    const trueEdge = edges.find(e => e.label === 'true' || e.sourceHandle === 'true');
    const falseEdge = edges.find(e => e.label === 'false' || e.sourceHandle === 'false');

    // Generate if/else
    const code = `
if (${condition}) {
  // True branch
  ${trueEdge ? `// Go to ${trueEdge.target}` : ''}
} else {
  // False branch
  ${falseEdge ? `// Go to ${falseEdge.target}` : ''}
}
    `.trim();

    return {
      code,
      imports: [],
      declarations: []
    };
  }
};
```

### Testing Patterns

Create unit tests for your patterns:

```typescript
// packages/workflow-builder/src/lib/compiler/patterns/__tests__/my-pattern.test.ts

import { MyCustomPattern } from '../my-pattern';
import type { WorkflowNode, GeneratorContext } from '../../types';

describe('MyCustomPattern', () => {
  it('detects custom node type', () => {
    const node: WorkflowNode = {
      id: 'test',
      type: 'my-custom-type',
      data: { label: 'Test' },
      position: { x: 0, y: 0 }
    };

    const context = createMockContext();
    expect(MyCustomPattern.detect(node, context)).toBe(true);
  });

  it('generates correct code', () => {
    const node: WorkflowNode = {
      id: 'test',
      type: 'my-custom-type',
      data: { label: 'Test Node' },
      position: { x: 0, y: 0 }
    };

    const context = createMockContext();
    const result = MyCustomPattern.generate(node, context);

    expect(result.code).toContain('Executing custom node');
    expect(result.imports).toContain('my-package');
  });
});
```

---

## Advanced Topics

### Optimization Levels

The compiler supports three optimization levels:

```typescript
type OptimizationLevel = 'none' | 'basic' | 'aggressive';
```

**none:**
- No optimizations
- Verbose comments
- Readable code

**basic:** (default)
- Remove unnecessary variables
- Merge simple operations
- Basic dead code elimination

**aggressive:**
- Inline small functions
- Aggressive dead code elimination
- Minimize output size

### Strict Mode

Strict mode enables additional validation:

```typescript
const compiler = new WorkflowCompiler({
  strictMode: true
});
```

**Checks:**
- All activity nodes have valid activity names
- All variables are declared before use
- No unreachable nodes
- Type consistency

### Validation Only Mode

Run validation without compilation:

```typescript
const compiler = new WorkflowCompiler({
  validateOnly: true
});

const result = compiler.compile(workflow);
// result contains only validation errors/warnings
```

---

## Performance Considerations

### Compilation Speed

Typical compilation times:
- Small workflow (< 10 nodes): < 50ms
- Medium workflow (10-50 nodes): 50-200ms
- Large workflow (50-100 nodes): 200-500ms
- Very large workflow (100+ nodes): 500ms-1s

### Memory Usage

The compiler uses minimal memory:
- Context object: O(n) where n = number of nodes
- Code blocks array: O(n)
- Pattern matching: O(n * p) where p = number of patterns

### Caching

Compiled code is cached in the database:

```sql
UPDATE workflows
SET compiled_typescript = $1
WHERE id = $2;
```

Subsequent compilations can skip if definition hasn't changed.

---

## Troubleshooting

### Common Issues

**Issue:** Pattern not being applied

**Solution:** Check priority and detect function. Higher priority patterns run first.

**Issue:** Imports not being included

**Solution:** Ensure pattern returns imports in CodeBlock.

**Issue:** Variables not found

**Solution:** Store result variables in `context.resultVars`.

**Issue:** Circular dependencies

**Solution:** Validation should catch this. Check `validateWorkflow()` output.

### Debug Mode

Enable debug logging:

```typescript
const compiler = new WorkflowCompiler({
  debug: true  // Logs compilation steps
});
```

---

## Next Steps

- [Worker Registration Guide](./worker-registration.md) - How dynamic workers work
- [Extension Guide](../development/extension-guide.md) - Adding new node types
- [API Reference](../api/reference.md) - Using the compiler API
- [Database Schema](../database/schema.md) - Storing compiled code
