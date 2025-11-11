# How to Create a Custom Workflow

Learn to build your own workflow specification from scratch. This guide walks through creating a "Code Review" workflow that analyzes code and provides feedback.

## What You'll Build

A workflow that:
1. Accepts code input
2. Analyzes code quality
3. Generates improvement suggestions
4. Creates a review report

## Prerequisites

- Agent Coordinator installed and built
- Understanding of [HelloSpec](run-hello-workflow.md) and [TodoSpec](run-todo-workflow.md)
- Basic TypeScript knowledge

## Step 1: Create the Package Structure

```bash
cd packages/specs
mkdir -p review/src
cd review
```

**Create package.json:**

```bash
cat > package.json << 'EOF'
{
  "name": "@coordinator/specs-review",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist tsconfig.tsbuildinfo",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@coordinator/contracts": "*"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "typescript": "^5.6.3",
    "vitest": "^1.6.0"
  }
}
EOF
```

**Create tsconfig.json:**

```bash
cat > tsconfig.json << 'EOF'
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../contracts" }
  ]
}
EOF
```

## Step 2: Define Your Workflow Logic

Create `src/ReviewSpec.ts`:

```typescript
import type {
  ISpec,
  ISpecFactory,
  SpecContext,
  SpecDescriptor,
  EngineState,
  AgentResponse,
  EngineDecision,
  SpecExecutionContext,
} from '@coordinator/contracts';

/**
 * ReviewSpec - Code review workflow
 *
 * Stages:
 * 1. Analyze code quality
 * 2. Generate suggestions
 * 3. Create review report
 */
export class ReviewSpec implements ISpec {
  readonly name = 'review';

  constructor(private readonly context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision {
    const decisionId = `decision-${context.now}-${Math.floor(context.random() * 1000000)}`;

    // Track workflow progress
    const hasAnalysis = 'analysis' in state.artifacts;
    const hasSuggestions = 'suggestions' in state.artifacts;
    const hasReport = 'report' in state.artifacts;

    // Stage 1: Analyze code
    if (!hasAnalysis) {
      return this.requestAnalysis(state, resp, decisionId, context);
    }

    // Stage 2: Generate suggestions
    if (hasAnalysis && !hasSuggestions) {
      return this.requestSuggestions(state, resp, decisionId, context);
    }

    // Stage 3: Create report
    if (hasAnalysis && hasSuggestions && !hasReport) {
      return this.requestReport(state, resp, decisionId, context);
    }

    // All stages complete
    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: true,
    };
  }

  private requestAnalysis(
    state: EngineState,
    resp: AgentResponse,
    decisionId: string,
    context: SpecExecutionContext
  ): EngineDecision {
    // Check if we received analysis results
    if (resp.status === 'OK' && resp.content && 'analysis' in resp.content) {
      this.context.logger.info('Code analysis completed', {
        metrics: (resp.content as any).analysis
      });

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'analysis',
            value: (resp.content as any).analysis,
          },
          {
            type: 'REQUEST_WORK',
            workKind: 'generate_suggestions',
            payload: {
              analysis: (resp.content as any).analysis,
            },
          },
        ],
        finalize: false,
      };
    }

    // Initial request for analysis
    this.context.logger.info('Requesting code analysis');

    // Get code from workflow config
    const code = (state.artifacts.input as any)?.code || '';

    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [
        {
          type: 'REQUEST_WORK',
          workKind: 'analyze_code',
          payload: {
            code,
            metrics: ['complexity', 'maintainability', 'security'],
          },
        },
      ],
      finalize: false,
    };
  }

  private requestSuggestions(
    state: EngineState,
    resp: AgentResponse,
    decisionId: string,
    context: SpecExecutionContext
  ): EngineDecision {
    if (resp.status === 'OK' && resp.content && 'suggestions' in resp.content) {
      this.context.logger.info('Suggestions generated', {
        count: Array.isArray((resp.content as any).suggestions)
          ? (resp.content as any).suggestions.length
          : 0
      });

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'suggestions',
            value: (resp.content as any).suggestions,
          },
          {
            type: 'REQUEST_WORK',
            workKind: 'create_report',
            payload: {
              analysis: state.artifacts.analysis,
              suggestions: (resp.content as any).suggestions,
            },
          },
        ],
        finalize: false,
      };
    }

    // Should not reach here if workflow is progressing correctly
    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: false,
    };
  }

  private requestReport(
    state: EngineState,
    resp: AgentResponse,
    decisionId: string,
    context: SpecExecutionContext
  ): EngineDecision {
    if (resp.status === 'OK' && resp.content) {
      this.context.logger.info('Review report created');

      return {
        decisionId,
        basedOn: { stepId: resp.stepId, runId: resp.runId },
        actions: [
          {
            type: 'ANNOTATE',
            key: 'report',
            value: resp.content,
          },
        ],
        finalize: true,
      };
    }

    // Should not reach here
    return {
      decisionId,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize: false,
    };
  }

  onAgentError(
    _state: EngineState,
    workKind: string,
    error: unknown,
    attemptNumber: number
  ): EngineDecision {
    const maxRetries = 3;

    if (attemptNumber < maxRetries) {
      this.context.logger.warn(`Retrying ${workKind}`, {
        attemptNumber,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        decisionId: `retry-${workKind}-${attemptNumber}-${Date.now()}`,
        actions: [
          {
            type: 'REQUEST_WORK',
            workKind,
            payload: {
              retry: true,
              attemptNumber: attemptNumber + 1,
            },
          },
        ],
        finalize: false,
      };
    }

    this.context.logger.error(`Max retries exceeded for ${workKind}`);

    return {
      decisionId: `fail-${workKind}-${Date.now()}`,
      actions: [
        {
          type: 'ANNOTATE',
          key: 'error',
          value: {
            workKind,
            error: error instanceof Error ? error.message : String(error),
            attemptNumber,
          },
        },
      ],
      finalize: true,
    };
  }
}

/**
 * Factory for creating ReviewSpec instances
 */
export class ReviewSpecFactory implements ISpecFactory {
  readonly name = 'review';
  readonly version = '0.1.0';

  create(context: SpecContext): ISpec {
    return new ReviewSpec(context);
  }

  describe(): SpecDescriptor {
    return {
      name: this.name,
      version: this.version,
      description: 'Code review workflow: analyze code, generate suggestions, create report',
      requiredWorkKinds: ['analyze_code', 'generate_suggestions', 'create_report'],
      configSchema: {
        type: 'object',
        properties: {
          metricsToAnalyze: {
            type: 'array',
            items: { type: 'string' },
            description: 'Code metrics to analyze',
            default: ['complexity', 'maintainability', 'security'],
          },
        },
      },
    };
  }

  validate(config: unknown): boolean {
    if (typeof config !== 'object' || config === null) {
      return true; // Empty config is valid
    }

    const cfg = config as Record<string, unknown>;

    if ('metricsToAnalyze' in cfg) {
      return (
        Array.isArray(cfg.metricsToAnalyze) &&
        cfg.metricsToAnalyze.every(m => typeof m === 'string')
      );
    }

    return true;
  }
}
```

**Create src/index.ts:**

```typescript
export { ReviewSpec, ReviewSpecFactory } from './ReviewSpec.js';
```

## Step 3: Add Tests

Create `src/ReviewSpec.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ReviewSpec, ReviewSpecFactory } from './ReviewSpec.js';
import type { SpecContext, EngineState, AgentResponse, SpecExecutionContext } from '@coordinator/contracts';

describe('ReviewSpec', () => {
  let factory: ReviewSpecFactory;
  let context: SpecContext;
  let spec: ReviewSpec;
  let execContext: SpecExecutionContext;

  beforeEach(() => {
    factory = new ReviewSpecFactory();
    context = {
      storage: {} as any,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      config: {},
    };
    spec = factory.create(context) as ReviewSpec;
    execContext = {
      now: 1000,
      random: () => 0.5,
    };
  });

  it('should request analysis on first call', () => {
    const state: EngineState = {
      goalId: 'review-1',
      status: 'RUNNING',
      openSteps: {},
      artifacts: {
        input: { code: 'function test() { return 42; }' }
      },
      log: [],
    };

    const resp: AgentResponse = {
      stepId: 'step-0',
      runId: 'run-1',
      agentRole: 'reviewer',
      status: 'OK',
      content: {},
    };

    const decision = spec.onAgentCompleted(state, resp, execContext);

    expect(decision.actions).toHaveLength(1);
    expect(decision.actions[0]).toMatchObject({
      type: 'REQUEST_WORK',
      workKind: 'analyze_code',
    });
    expect(decision.finalize).toBe(false);
  });

  it('should request suggestions after analysis', () => {
    const state: EngineState = {
      goalId: 'review-1',
      status: 'RUNNING',
      openSteps: {},
      artifacts: {},
      log: [],
    };

    const resp: AgentResponse = {
      stepId: 'step-1',
      runId: 'run-1',
      agentRole: 'reviewer',
      status: 'OK',
      content: {
        analysis: {
          complexity: 'low',
          maintainability: 'high',
          security: 'good',
        },
      },
    };

    const decision = spec.onAgentCompleted(state, resp, execContext);

    expect(decision.actions).toHaveLength(2);
    expect(decision.actions[0].type).toBe('ANNOTATE');
    expect(decision.actions[1]).toMatchObject({
      type: 'REQUEST_WORK',
      workKind: 'generate_suggestions',
    });
    expect(decision.finalize).toBe(false);
  });

  it('should finalize after report created', () => {
    const state: EngineState = {
      goalId: 'review-1',
      status: 'RUNNING',
      openSteps: {},
      artifacts: {
        analysis: { complexity: 'low' },
        suggestions: [{ type: 'style', message: 'Use const' }],
      },
      log: [],
    };

    const resp: AgentResponse = {
      stepId: 'step-3',
      runId: 'run-1',
      agentRole: 'reviewer',
      status: 'OK',
      content: {
        report: 'Code review report...',
      },
    };

    const decision = spec.onAgentCompleted(state, resp, execContext);

    expect(decision.actions).toHaveLength(1);
    expect(decision.actions[0].type).toBe('ANNOTATE');
    expect(decision.finalize).toBe(true);
  });
});

describe('ReviewSpecFactory', () => {
  it('should create spec instances', () => {
    const factory = new ReviewSpecFactory();
    const context: SpecContext = {
      storage: {} as any,
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      config: {},
    };

    const spec = factory.create(context);

    expect(spec).toBeInstanceOf(ReviewSpec);
    expect(spec.name).toBe('review');
  });

  it('should validate config', () => {
    const factory = new ReviewSpecFactory();

    expect(factory.validate({})).toBe(true);
    expect(factory.validate({ metricsToAnalyze: ['complexity'] })).toBe(true);
    expect(factory.validate({ metricsToAnalyze: 'invalid' })).toBe(false);
  });
});
```

## Step 4: Build and Test

```bash
# Install dependencies
yarn install

# Build the spec
yarn build

# Run tests
yarn test
```

**Expected output:**

```
 ✓ src/ReviewSpec.test.ts (5 tests)
   ✓ ReviewSpec
     ✓ should request analysis on first call
     ✓ should request suggestions after analysis
     ✓ should finalize after report created
   ✓ ReviewSpecFactory
     ✓ should create spec instances
     ✓ should validate config

Test Files  1 passed (1)
     Tests  5 passed (5)
```

## Step 5: Register with CLI

Edit `packages/cli/src/workflow-runner.ts`:

```typescript
import { ReviewSpecFactory } from '@coordinator/specs-review';

// In the setup function
coordinator.registerSpec(new ReviewSpecFactory());
```

Update `packages/cli/package.json` dependencies:

```json
{
  "dependencies": {
    "@coordinator/specs-review": "*"
  }
}
```

Rebuild CLI:

```bash
cd packages/cli
yarn install
yarn build
```

## Step 6: Run Your Workflow

```bash
node dist/cli.js run review
```

**Expected output:**

```json
{
  "analysis": {
    "complexity": "low",
    "maintainability": "high",
    "security": "good"
  },
  "suggestions": [
    {
      "type": "style",
      "line": 5,
      "message": "Consider using const instead of let",
      "severity": "low"
    },
    {
      "type": "performance",
      "line": 12,
      "message": "Cache this computed value",
      "severity": "medium"
    }
  ],
  "report": {
    "summary": "Overall code quality is good",
    "score": 85,
    "details": "..."
  }
}
```

## Best Practices

### 1. Use Type Guards

Validate agent responses:

```typescript
function isAnalysisResponse(content: unknown): content is { analysis: Analysis } {
  return (
    typeof content === 'object' &&
    content !== null &&
    'analysis' in content
  );
}

if (isAnalysisResponse(resp.content)) {
  // Safe to use resp.content.analysis
}
```

### 2. Deterministic Decision IDs

Always use context.now and context.random:

```typescript
const decisionId = `decision-${context.now}-${Math.floor(context.random() * 1000000)}`;
```

Never use `Date.now()` or `Math.random()` in decision generation!

### 3. Clear State Management

Track workflow progress explicitly:

```typescript
const hasAnalysis = 'analysis' in state.artifacts;
const hasSuggestions = 'suggestions' in state.artifacts;

if (!hasAnalysis) {
  // Stage 1
} else if (!hasSuggestions) {
  // Stage 2
} else {
  // Stage 3
}
```

### 4. Error Handling

Implement retry logic with limits:

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (attemptNumber < MAX_RETRIES) {
    return { /* retry */ };
  }
  return { /* fail gracefully */ };
}
```

### 5. Comprehensive Logging

Log at each stage transition:

```typescript
this.context.logger.info('Stage completed', {
  stage: 'analysis',
  metrics: analysis
});
```

## Common Patterns

### Conditional Branching

```typescript
if (state.artifacts.userChoice === 'detailed') {
  return { actions: [{ type: 'REQUEST_WORK', workKind: 'detailed_analysis', ... }] };
} else {
  return { actions: [{ type: 'REQUEST_WORK', workKind: 'quick_analysis', ... }] };
}
```

### Parallel Steps

```typescript
return {
  actions: [
    { type: 'REQUEST_WORK', workKind: 'analyze_style', payload: {...} },
    { type: 'REQUEST_WORK', workKind: 'analyze_security', payload: {...} }
  ],
  finalize: false
};
```

### Collect and Process

```typescript
// Collect results from parallel steps
const results = Object.values(state.openSteps)
  .filter(step => step.status === 'DONE')
  .map(step => step.result);

if (results.length === expectedCount) {
  // All results collected, process them
  return {
    actions: [{
      type: 'REQUEST_WORK',
      workKind: 'aggregate_results',
      payload: { results }
    }],
    finalize: false
  };
}
```

## Troubleshooting

### "Spec not found"

Ensure the spec is registered in CLI and built:

```bash
yarn workspace @coordinator/specs-review build
yarn workspace @coordinator/cli build
node dist/cli.js list-specs
```

### "Workflow loops infinitely"

Check that finalize is set correctly:

```typescript
// Good - finalize when done
return { actions: [], finalize: true };

// Bad - never finalizes
return { actions: [], finalize: false };
```

### "Type errors in tests"

Ensure contracts are imported correctly:

```typescript
import type { EngineState, AgentResponse } from '@coordinator/contracts';
```

## Next Steps

- [Configure agents for your spec](configure-agents.md)
- [Learn CLI integration](use-cli.md)
- [Explore use cases](../use-cases/multi-step-workflows.md)
- Study existing specs: [Hello](run-hello-workflow.md), [Todo](run-todo-workflow.md)

## Related Documentation

- [Workflow Specs Reference](../reference/workflow-specs.md)
- [Configuration Reference](../reference/configuration.md)
- [Multi-Step Workflows](../use-cases/multi-step-workflows.md)
