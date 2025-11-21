# Pattern Library Implementation Guide

## Overview

This document provides complete implementation specs for the 6 core patterns that power the workflow compiler.

## Pattern Interface

Every pattern follows this structure:

```typescript
interface Pattern {
  name: string;
  priority: number; // Lower = runs first
  detect: (context: CompilerContext) => boolean;
  generate: (context: CompilerContext) => CodeFragment;
  dependencies?: string[]; // Other patterns this depends on
}

interface CodeFragment {
  imports?: string[];
  declarations?: string[];
  beforeWorkflow?: string[];
  insideWorkflow?: string[];
  helpers?: string[];
}
```

## Pattern 1: Activity Proxy Pattern

**Purpose:** Generate `proxyActivities()` calls with proper imports and timeouts

### Detection

```typescript
detect: (context) => {
  return context.definition.nodes.some(n => n.type === 'activity');
}
```

### Implementation

```typescript
import { Pattern, CompilerContext, CodeFragment } from '../types';

export const ActivityProxyPattern: Pattern = {
  name: 'activity-proxy',
  priority: 1, // Run first - others depend on this

  detect(context: CompilerContext): boolean {
    return context.definition.nodes.some(n => n.type === 'activity');
  },

  generate(context: CompilerContext): CodeFragment {
    // Group activities by module
    const activities = context.definition.nodes
      .filter(n => n.type === 'activity')
      .map(n => ({
        name: n.data.activityName,
        timeout: n.data.timeout || '10 minutes',
        module: this.inferModule(n.data.activityName)
      }));

    const byModule = this.groupByModule(activities);

    const imports: string[] = [
      `import { proxyActivities } from '@temporalio/workflow';`
    ];

    const declarations: string[] = [];

    for (const [module, acts] of Object.entries(byModule)) {
      imports.push(`import type * as ${module} from '../activities/${module}.activities';`);

      declarations.push(`
const { ${acts.map(a => a.name).join(', ')} } = proxyActivities<typeof ${module}>({
  startToCloseTimeout: '${acts[0].timeout}'
});
      `.trim());
    }

    return { imports, declarations };
  },

  inferModule(activityName: string): string {
    // Infer module from activity name
    const moduleMap: Record<string, string> = {
      'runBuild': 'build',
      'runTests': 'build',
      'runQualityChecks': 'build',
      'publishPackage': 'build',
      'spawnFixAgent': 'agent',
      'verifyDependencies': 'agent',
      'loadAgentRegistry': 'agentRegistry',
      'writePackageBuildReport': 'report',
      'loadAllPackageReports': 'report'
    };
    return moduleMap[activityName] || 'build';
  },

  groupByModule(activities: Array<{name: string; module: string; timeout: string}>) {
    return activities.reduce((acc, act) => {
      if (!acc[act.module]) acc[act.module] = [];
      acc[act.module].push(act);
      return acc;
    }, {} as Record<string, Array<{name: string; timeout: string}>>);
  }
};
```

### Generated Code Example

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as build from '../activities/build.activities';
import type * as agent from '../activities/agent.activities';

const { runBuild, runTests } = proxyActivities<typeof build>({
  startToCloseTimeout: '10 minutes'
});

const { spawnFixAgent } = proxyActivities<typeof agent>({
  startToCloseTimeout: '30 minutes'
});
```

## Pattern 2: State Management Pattern

**Purpose:** Generate state interface and initialization from variables panel

### Detection

```typescript
detect: (context) => {
  return context.definition.settings.variables?.length > 0;
}
```

### Implementation

```typescript
export const StateManagementPattern: Pattern = {
  name: 'state-management',
  priority: 2,

  detect(context: CompilerContext): boolean {
    return (context.definition.settings.variables?.length ?? 0) > 0;
  },

  generate(context: CompilerContext): CodeFragment {
    const variables = context.definition.settings.variables || [];

    // Generate TypeScript interface
    const stateInterface = `
interface WorkflowState {
  ${variables.map(v => `${v.name}: ${this.mapType(v.type)};`).join('\n  ')}
}
    `.trim();

    // Generate initialization
    const stateInit = `
const state: WorkflowState = {
  ${variables.map(v => {
    const value = this.formatValue(v.type, v.initialValue);
    return `${v.name}: ${value},`;
  }).join('\n  ')}
};
    `.trim();

    return {
      declarations: [stateInterface],
      insideWorkflow: [stateInit]
    };
  },

  mapType(uiType: string): string {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'number': 'number',
      'boolean': 'boolean',
      'object': 'any',
      'array': 'any[]'
    };
    return typeMap[uiType] || 'any';
  },

  formatValue(type: string, value: any): string {
    if (type === 'string') return `'${value}'`;
    if (type === 'array') return JSON.stringify(value);
    if (type === 'object') return JSON.stringify(value);
    return String(value);
  }
};
```

### Generated Code Example

```typescript
interface WorkflowState {
  buildResult: any;
  attemptCount: number;
  failedPackages: any[];
}

const state: WorkflowState = {
  buildResult: {},
  attemptCount: 0,
  failedPackages: [],
};
```

## Pattern 3: AI Remediation Pattern

**Purpose:** Generate CoordinatorWorkflow spawning code for AI-driven retry

### Detection

```typescript
detect: (context) => {
  return context.definition.settings.aiRemediation?.enabled === true ||
         context.definition.nodes.some(n =>
           n.type === 'activity' && n.data.retry?.useAI === true
         );
}
```

### Implementation

```typescript
export const AIRemediationPattern: Pattern = {
  name: 'ai-remediation',
  priority: 4,
  dependencies: ['activity-proxy'],

  detect(context: CompilerContext): boolean {
    return (
      context.definition.settings.aiRemediation?.enabled === true ||
      context.definition.nodes.some(n =>
        n.type === 'activity' && n.data.retry?.useAI === true
      )
    );
  },

  generate(context: CompilerContext): CodeFragment {
    const aiConfig = context.definition.settings.aiRemediation;
    const imports: string[] = [
      `import { executeChild } from '@temporalio/workflow';`,
      `import { CoordinatorWorkflow } from './coordinator.workflow';`,
      `import type { Problem, CoordinatorAction } from '../types/coordinator.types';`
    ];

    // Generate helper function
    const helperFunction = this.generateHelperFunction(aiConfig, context);

    return {
      imports,
      helpers: [helperFunction]
    };
  },

  generateHelperFunction(aiConfig: any, context: CompilerContext): string {
    const includeContext = aiConfig?.includeContext || {
      workflowState: true,
      errorDetails: true,
      previousAttempts: true
    };

    return `
async function handleFailureWithAI(
  error: Error,
  attemptNumber: number,
  state: any,
  nodeId: string
): Promise<'RETRY' | 'FAIL'> {
  // Build context object
  const context = {
    ${includeContext.errorDetails ? 'error: error.message,' : ''}
    ${includeContext.workflowState ? 'state: state,' : ''}
    ${includeContext.previousAttempts ? 'attemptNumber: attemptNumber,' : ''}
    nodeId: nodeId,
  };

  // Load agent registry
  const agentRegistry = await loadAgentRegistry(
    '/Users/mattbernier/projects/tools/.claude/agents'
  );

  // Create problem description
  const problem: Problem = {
    type: 'ACTIVITY_FAILURE',
    error: {
      message: error.message,
      stderr: error.stack || '',
      stdout: ''
    },
    context
  };

  // Spawn coordinator workflow
  const action: CoordinatorAction = await executeChild(CoordinatorWorkflow, {
    taskQueue: 'engine',
    workflowId: \`coordinator-\${workflowInfo().workflowId}-\${nodeId}-\${Date.now()}\`,
    args: [{
      problem,
      agentRegistry,
      maxAttempts: 1,
      workspaceRoot: input.workspaceRoot
    }]
  });

  // Return decision
  return action.decision === 'RETRY' ? 'RETRY' : 'FAIL';
}
    `.trim();
  }
};
```

### Usage in Generated Workflow

```typescript
// Generated retry loop with AI
let buildSuccess = false;
let attemptCount = 0;

while (!buildSuccess && attemptCount < 3) {
  try {
    state.buildResult = await runBuild({
      packagePath: input.packagePath
    });
    buildSuccess = true;
  } catch (error) {
    const decision = await handleFailureWithAI(
      error as Error,
      attemptCount,
      state,
      'build-node-id'
    );

    if (decision === 'RETRY') {
      attemptCount++;
      console.log(`[AI Retry] Attempt ${attemptCount}/3`);
      continue;
    } else {
      throw error;
    }
  }
}
```

## Pattern 4: Concurrency Control Pattern

**Purpose:** Generate while loop with Promise.race() for parallel execution

### Detection

```typescript
detect: (context) => {
  return context.definition.nodes.some(n =>
    n.type === 'loop' && (n.data.maxConcurrent || 1) > 1
  );
}
```

### Implementation

```typescript
export const ConcurrencyControlPattern: Pattern = {
  name: 'concurrency-control',
  priority: 5,

  detect(context: CompilerContext): boolean {
    return context.definition.nodes.some(n =>
      n.type === 'loop' && (n.data.maxConcurrent || 1) > 1
    );
  },

  generate(context: CompilerContext): CodeFragment {
    const loopNodes = context.definition.nodes.filter(n =>
      n.type === 'loop' && n.data.maxConcurrent > 1
    );

    const helpers: string[] = loopNodes.map(node =>
      this.generateConcurrencyLoop(node, context)
    );

    return { helpers };
  },

  generateConcurrencyLoop(node: any, context: CompilerContext): string {
    const maxConcurrent = node.data.maxConcurrent;
    const condition = node.data.condition;
    const children = context.getNodesByIds(node.data.children || []);

    // Generate child execution code
    const childCode = children
      .map(child => context.generateNodeCode(child))
      .join('\n    ');

    return `
// Concurrency control loop for ${node.id}
const activeBuilds_${node.id} = new Map<string, Promise<any>>();

while (${condition}) {
  // Find items ready to process (all dependencies met)
  const readyItems = findReadyItems(state);

  if (readyItems.length === 0) {
    // No more items to process
    break;
  }

  // Calculate available slots
  const availableSlots = ${maxConcurrent} - activeBuilds_${node.id}.size;
  const batch = readyItems.slice(0, availableSlots);

  // Spawn child workflows for batch
  for (const item of batch) {
    const childPromise = (async () => {
      try {
        ${childCode}
        return { id: item.id, success: true, item };
      } catch (error) {
        return { id: item.id, success: false, error, item };
      }
    })();

    activeBuilds_${node.id}.set(item.id, childPromise);
  }

  // Wait for any child to complete
  if (activeBuilds_${node.id}.size > 0) {
    const result = await Promise.race([...activeBuilds_${node.id}.values()]);
    activeBuilds_${node.id}.delete(result.id);

    // Update state based on result
    if (result.success) {
      state.completedItems.push(result.item);
    } else {
      state.failedItems.push({ item: result.item, error: result.error });
    }
  }
}
    `.trim();
  }
};
```

### Generated Code Example

```typescript
// Concurrency control loop for build-phase
const activeBuilds_buildPhase = new Map<string, Promise<any>>();

while (hasUnbuiltPackages(state)) {
  const readyItems = findReadyItems(state);

  if (readyItems.length === 0) break;

  const availableSlots = 4 - activeBuilds_buildPhase.size;
  const batch = readyItems.slice(0, availableSlots);

  for (const item of batch) {
    const childPromise = (async () => {
      try {
        const result = await startChild(PackageBuildWorkflow, {
          args: [{ packageName: item.name, /* ... */ }]
        });
        return { id: item.id, success: true, item };
      } catch (error) {
        return { id: item.id, success: false, error, item };
      }
    })();

    activeBuilds_buildPhase.set(item.id, childPromise);
  }

  if (activeBuilds_buildPhase.size > 0) {
    const result = await Promise.race([...activeBuilds_buildPhase.values()]);
    activeBuilds_buildPhase.delete(result.id);

    if (result.success) {
      state.completedPackages.push(result.item);
    } else {
      state.failedPackages.push({ item: result.item, error: result.error });
    }
  }
}
```

## Pattern 5: Signal Handler Pattern

**Purpose:** Generate setHandler() calls for workflow signals

### Implementation

```typescript
export const SignalHandlerPattern: Pattern = {
  name: 'signal-handlers',
  priority: 3,

  detect(context: CompilerContext): boolean {
    return (context.definition.settings.signals?.length ?? 0) > 0;
  },

  generate(context: CompilerContext): CodeFragment {
    const signals = context.definition.settings.signals || [];

    const imports = [
      `import { defineSignal, setHandler } from '@temporalio/workflow';`
    ];

    const declarations = signals.map(signal => `
const ${signal.name}Signal = defineSignal<[any]>('${signal.name}');
    `.trim());

    const insideWorkflow = signals.map(signal =>
      this.generateSignalHandler(signal)
    );

    return { imports, declarations, insideWorkflow };
  },

  generateSignalHandler(signal: any): string {
    const actionCode = this.generateActionCode(signal);

    return `
// Signal handler: ${signal.name}
setHandler(${signal.name}Signal, (data: any) => {
  ${actionCode}
});
    `.trim();
  },

  generateActionCode(signal: any): string {
    switch (signal.action) {
      case 'update-state':
        return `state.${signal.handler} = data;`;
      case 'queue':
        return `signalQueue.push({ signal: '${signal.name}', data });`;
      case 'trigger':
        return `${signal.handler}(data);`;
      default:
        return `console.log('Signal received:', data);`;
    }
  }
};
```

## Pattern 6: Continue-as-New Pattern

**Purpose:** Auto-generate continue-as-new when history exceeds threshold

### Implementation

```typescript
export const ContinueAsNewPattern: Pattern = {
  name: 'continue-as-new',
  priority: 10, // Run last

  detect(context: CompilerContext): boolean {
    return context.definition.settings.longRunning?.autoContinueAsNew === true;
  },

  generate(context: CompilerContext): CodeFragment {
    const config = context.definition.settings.longRunning;
    const maxEvents = config?.maxHistoryEvents || 10000;

    const imports = [
      `import { continueAsNew, workflowInfo } from '@temporalio/workflow';`
    ];

    // This check is inserted at strategic points in the workflow
    const checkCode = `
if (workflowInfo().historyLength > ${maxEvents}) {
  console.log('[ContinueAsNew] History limit reached, continuing as new workflow');
  await continueAsNew<typeof ${context.workflowName}>(state);
}
    `.trim();

    return {
      imports,
      beforeWorkflow: [checkCode] // Injected in loop iterations
    };
  }
};
```

## Compiler Integration

### Pattern Registry

```typescript
// src/lib/compiler/PatternRegistry.ts

import { Pattern } from './types';
import { ActivityProxyPattern } from './patterns/activity-proxy';
import { StateManagementPattern } from './patterns/state-management';
import { AIRemediationPattern } from './patterns/ai-remediation';
import { ConcurrencyControlPattern } from './patterns/concurrency-control';
import { SignalHandlerPattern } from './patterns/signal-handlers';
import { ContinueAsNewPattern } from './patterns/continue-as-new';

export class PatternRegistry {
  private patterns: Pattern[] = [
    ActivityProxyPattern,
    StateManagementPattern,
    SignalHandlerPattern,
    AIRemediationPattern,
    ConcurrencyControlPattern,
    ContinueAsNewPattern,
  ];

  constructor() {
    // Sort by priority
    this.patterns.sort((a, b) => a.priority - b.priority);
  }

  detectPatterns(context: CompilerContext): Pattern[] {
    return this.patterns.filter(p => p.detect(context));
  }

  generateCode(context: CompilerContext): string {
    const activePatterns = this.detectPatterns(context);

    const codeFragments = activePatterns.map(p => p.generate(context));

    return this.mergeFragments(codeFragments);
  }

  private mergeFragments(fragments: CodeFragment[]): string {
    const imports = [...new Set(fragments.flatMap(f => f.imports || []))];
    const declarations = fragments.flatMap(f => f.declarations || []);
    const helpers = fragments.flatMap(f => f.helpers || []);
    const insideWorkflow = fragments.flatMap(f => f.insideWorkflow || []);

    return `
${imports.join('\n')}

${declarations.join('\n\n')}

${helpers.join('\n\n')}

export async function GeneratedWorkflow(input: any): Promise<void> {
  ${insideWorkflow.join('\n\n  ')}

  // ... main workflow code ...
}
    `.trim();
  }
}
```

## Testing Patterns

Each pattern should have comprehensive tests:

```typescript
// src/lib/compiler/patterns/__tests__/ai-remediation.test.ts

describe('AIRemediationPattern', () => {
  it('detects when AI remediation is enabled globally', () => {
    const context = createMockContext({
      settings: {
        aiRemediation: { enabled: true }
      }
    });

    expect(AIRemediationPattern.detect(context)).toBe(true);
  });

  it('detects when individual activity has AI retry', () => {
    const context = createMockContext({
      nodes: [{
        type: 'activity',
        data: { retry: { useAI: true } }
      }]
    });

    expect(AIRemediationPattern.detect(context)).toBe(true);
  });

  it('generates helper function with correct context', () => {
    const context = createMockContext({
      settings: {
        aiRemediation: {
          enabled: true,
          includeContext: {
            workflowState: true,
            errorDetails: true
          }
        }
      }
    });

    const fragment = AIRemediationPattern.generate(context);

    expect(fragment.helpers[0]).toContain('handleFailureWithAI');
    expect(fragment.helpers[0]).toContain('error: error.message');
    expect(fragment.helpers[0]).toContain('state: state');
  });

  it('integrates with CoordinatorWorkflow', () => {
    const fragment = AIRemediationPattern.generate(createMockContext());

    expect(fragment.imports).toContain(
      `import { CoordinatorWorkflow } from './coordinator.workflow';`
    );
    expect(fragment.helpers[0]).toContain('executeChild(CoordinatorWorkflow');
  });
});
```

## Next Steps

1. **Implement core patterns** - Start with #1-3
2. **Build pattern registry** - Central orchestration
3. **Test each pattern** - Comprehensive test coverage
4. **Integrate with compiler** - Wire patterns into compilation flow
5. **Add more patterns** - Extend as needed

See SIMPLIFIED-PHASE-1.md for implementation roadmap.
