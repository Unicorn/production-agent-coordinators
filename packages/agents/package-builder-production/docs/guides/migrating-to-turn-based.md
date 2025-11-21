# Migrating to Turn-Based Package Generation

## Table of Contents

1. [Overview](#overview)
2. [Differences Between Workflows](#differences-between-workflows)
3. [When to Use Turn-Based](#when-to-use-turn-based)
4. [When to Use Original](#when-to-use-original)
5. [Migration Checklist](#migration-checklist)
6. [Migration Examples](#migration-examples)
7. [Rollback Procedure](#rollback-procedure)
8. [FAQ](#faq)

## Overview

The turn-based package generation workflow is a new approach that complements (not replaces) the original single-shot workflow. This guide helps you understand the differences and choose the right workflow for your needs.

### Key Changes

- **Multiple phases** instead of single generation call
- **State persistence** for recovery
- **Git commits** between phases
- **Longer execution time** but more reliable
- **Better observability** of generation progress

## Differences Between Workflows

### Original Workflow (Single-Shot)

```typescript
PackageBuildWorkflow(input) {
  // Single large scaffolding call
  const scaffoldResult = await scaffoldPackage(input);

  // Build and test
  await buildPackage(scaffoldResult);
  await runTests(scaffoldResult);

  // Publish
  await publishPackage(scaffoldResult);

  return result;
}
```

**Characteristics**:
- Fast execution (5-10 minutes)
- Single Claude API call for all generation
- No intermediate state
- Can exceed token limits on large packages
- Hard to debug failures
- No recovery mechanism

### Turn-Based Workflow

```typescript
PackageBuildTurnBasedWorkflow(input) {
  // Initialize context
  const context = initializeContext(input);

  // Execute 15 phases sequentially
  for (const phase of PHASES) {
    const result = await executePhase(context, phase);
    await recordStep(context, result);
    await commitToGit(context, result);
    await saveState(context);
  }

  return result;
}
```

**Characteristics**:
- Slower execution (25-35 minutes)
- 15 focused Claude API calls
- State persisted after each phase
- Never exceeds token limits
- Easy to debug (inspect each phase)
- Full recovery support

### Side-by-Side Comparison

| Feature | Original Workflow | Turn-Based Workflow |
|---------|------------------|---------------------|
| **Execution Time** | 5-10 minutes | 25-35 minutes |
| **Token Limits** | Can exceed | Never exceeds |
| **Rate Limits** | Can hit | Spreads over time |
| **Recovery** | Start from scratch | Resume from failure |
| **State Persistence** | None | Full context saved |
| **Git Integration** | Final commit only | Commit per phase |
| **Debugging** | Difficult | Easy (phase-level) |
| **Observability** | Limited | Full visibility |
| **Complexity** | Simple | More complex |
| **Best For** | Small packages | Large packages |
| **Maturity** | Production-tested | New (use with caution) |

### API Differences

#### Original Workflow Input

```typescript
interface PackageBuildInput {
  packageName: string;
  packagePath: string;
  planPath: string;
  category: PackageCategory;
  dependencies: string[];
  workspaceRoot: string;
  config: BuildConfig;
}
```

#### Turn-Based Workflow Input

```typescript
interface TurnBasedPackageBuildInput extends PackageBuildInput {
  // All fields from PackageBuildInput plus:
  resumeFromContext?: GenerationContext;  // For recovery
  enableTurnBasedGeneration: boolean;     // Feature flag
}
```

### Output Differences

#### Original Workflow Output

```typescript
interface PackageBuildResult {
  success: boolean;
  packageName: string;
  report: PackageBuildReport;
  failedPhase?: string;
  error?: string;
  fixAttempts?: number;
}
```

#### Turn-Based Workflow Output

Same as original, but `report` includes additional fields:

```typescript
report: {
  // ... standard fields ...
  turnBasedGeneration?: {
    sessionId: string;
    totalPhases: number;
    completedPhases: number;
    totalSteps: number;
    executionTime: number;
    phaseTiming: Record<GenerationPhase, number>;
  }
}
```

## When to Use Turn-Based

### Recommended Scenarios

1. **Large Packages**:
   - More than 10 source files
   - Complex type hierarchies
   - Multiple integration points

2. **High-Value Packages**:
   - Core infrastructure packages
   - Packages with strict quality requirements
   - Packages requiring comprehensive testing

3. **Complex Requirements**:
   - Logger integration required
   - Neverhub integration required
   - Multiple external dependencies

4. **Development/Testing**:
   - Experimenting with package structure
   - Iterating on prompts
   - Need to inspect intermediate results

5. **Recovery Needed**:
   - Previous generation failed partway
   - Want to resume from checkpoint
   - Need to retry specific phases

### Example: When to Use Turn-Based

```typescript
// Large core package with complex requirements
const input: TurnBasedPackageBuildInput = {
  packageName: '@bernierllc/workflow-orchestrator',
  category: 'core',  // 90% coverage required
  // ... other fields ...
  enableTurnBasedGeneration: true  // Use turn-based
};

// Reasons:
// - Core package (high quality bar)
// - Likely 15+ source files
// - Complex type system
// - Multiple integrations
// - High test coverage requirement
```

## When to Use Original

### Recommended Scenarios

1. **Small Packages**:
   - Fewer than 5 source files
   - Simple utility packages
   - Straightforward requirements

2. **Simple Packages**:
   - No external integrations
   - Standard structure
   - Few dependencies

3. **Time-Sensitive**:
   - Need package generated quickly
   - Willing to retry if it fails
   - Don't need detailed progress

4. **Well-Tested Flow**:
   - Package type you've generated before
   - Confident it won't exceed limits
   - Standard prompts work well

5. **Prototyping**:
   - Quick proof of concept
   - Temporary package
   - Fast iteration more important than reliability

### Example: When to Use Original

```typescript
// Simple utility package
const input: PackageBuildInput = {
  packageName: '@bernierllc/string-helpers',
  category: 'utility',  // 85% coverage
  // ... other fields ...
  // enableTurnBasedGeneration: false (default)
};

// Reasons:
// - Utility package (lower complexity)
// - Likely 3-5 source files
// - Simple string manipulation functions
// - No external integrations
// - Fast turnaround desired
```

## Migration Checklist

### Pre-Migration

- [ ] Review package requirements and complexity
- [ ] Estimate number of source files (>10 = turn-based)
- [ ] Check if package has failed generation before
- [ ] Verify Claude API rate limits are sufficient
- [ ] Ensure git repository is clean
- [ ] Create package plan document
- [ ] Test turn-based workflow on small package first

### During Migration

- [ ] Update workflow invocation to use `PackageBuildTurnBasedWorkflow`
- [ ] Add `enableTurnBasedGeneration: true` to input
- [ ] Configure any custom token budgets or phase settings
- [ ] Set up monitoring for state files and git commits
- [ ] Prepare recovery procedures for team
- [ ] Document workflow ID and session ID for tracking

### Post-Migration

- [ ] Verify all phases completed successfully
- [ ] Review generated code quality
- [ ] Check test coverage meets target
- [ ] Validate build and tests pass
- [ ] Compare output to original workflow (if available)
- [ ] Document any issues or improvements needed
- [ ] Share learnings with team

### Rollback Checklist

If turn-based doesn't work for your use case:

- [ ] Document why turn-based didn't work
- [ ] Revert to original workflow invocation
- [ ] Clean up state files and generation branch
- [ ] Notify team of rollback
- [ ] File issue with details for improvement

## Migration Examples

### Example 1: Simple Migration

**Before (Original Workflow)**:

```typescript
import { PackageBuildWorkflow } from '@bernierllc/package-builder-production';

const input = {
  packageName: '@bernierllc/data-validator',
  packagePath: 'packages/core/data-validator',
  planPath: 'plans/packages/core/data-validator.md',
  category: 'core',
  dependencies: [],
  workspaceRoot: process.cwd(),
  config: {
    // ... config ...
  }
};

const handle = await client.workflow.start(PackageBuildWorkflow, {
  taskQueue: 'package-builder',
  args: [input]
});
```

**After (Turn-Based Workflow)**:

```typescript
import { PackageBuildTurnBasedWorkflow } from '@bernierllc/package-builder-production';

const input = {
  packageName: '@bernierllc/data-validator',
  packagePath: 'packages/core/data-validator',
  planPath: 'plans/packages/core/data-validator.md',
  category: 'core',
  dependencies: [],
  workspaceRoot: process.cwd(),
  config: {
    // ... config ...
    turnBasedGeneration: {
      enabled: true
    }
  },
  enableTurnBasedGeneration: true  // Add this field
};

const handle = await client.workflow.start(
  PackageBuildTurnBasedWorkflow,  // Changed workflow
  {
    taskQueue: 'package-builder',
    args: [input]
  }
);
```

### Example 2: Migration with Custom Configuration

**Before**:

```typescript
const input = {
  packageName: '@bernierllc/email-service',
  category: 'service',
  // ... other fields ...
  config: {
    npmRegistry: 'https://registry.npmjs.org',
    testing: {
      enableCoverage: true,
      minCoveragePercent: 85
    }
  }
};
```

**After**:

```typescript
const input = {
  packageName: '@bernierllc/email-service',
  category: 'service',
  // ... other fields ...
  config: {
    npmRegistry: 'https://registry.npmjs.org',
    testing: {
      enableCoverage: true,
      minCoveragePercent: 85
    },
    turnBasedGeneration: {
      enabled: true,
      // Skip examples for service packages
      phasesToSkip: ['EXAMPLES'],
      // Increase test phase budget
      tokenBudgets: {
        TESTING: 8000  // Increased from 6000
      }
    }
  },
  enableTurnBasedGeneration: true
};
```

### Example 3: Conditional Migration

Use turn-based only for large packages:

```typescript
function shouldUseTurnBased(packageName: string, category: PackageCategory): boolean {
  // Use turn-based for:
  // - Core packages (always)
  // - Service packages with "complex" in name
  // - Any validator packages

  if (category === 'core') return true;
  if (category === 'validator') return true;
  if (category === 'service' && packageName.includes('complex')) return true;

  return false;
}

// Usage
const useTurnBased = shouldUseTurnBased(input.packageName, input.category);

const WorkflowToUse = useTurnBased
  ? PackageBuildTurnBasedWorkflow
  : PackageBuildWorkflow;

const handle = await client.workflow.start(WorkflowToUse, {
  taskQueue: 'package-builder',
  args: [useTurnBased ? { ...input, enableTurnBasedGeneration: true } : input]
});
```

### Example 4: Gradual Rollout

Roll out turn-based to packages gradually:

```typescript
// rollout-config.ts
export const TURN_BASED_ROLLOUT = {
  // Stage 1: Small packages for testing
  stage1: [
    '@bernierllc/simple-validator',
    '@bernierllc/type-helpers'
  ],

  // Stage 2: Medium complexity packages
  stage2: [
    '@bernierllc/data-validator',
    '@bernierllc/schema-parser'
  ],

  // Stage 3: Complex packages
  stage3: [
    '@bernierllc/workflow-orchestrator',
    '@bernierllc/event-processor'
  ],

  // All other packages
  default: false
};

// Usage
function isInRollout(packageName: string): boolean {
  const currentStage = 'stage2'; // Update as rollout progresses

  for (const stage of ['stage1', 'stage2', 'stage3']) {
    if (TURN_BASED_ROLLOUT[stage].includes(packageName)) {
      return stage <= currentStage;
    }
  }

  return TURN_BASED_ROLLOUT.default;
}
```

## Rollback Procedure

### When to Rollback

Consider rolling back to original workflow if:

1. Turn-based consistently fails for your packages
2. 25-35 minute execution time is too slow
3. Recovery features not needed
4. Original workflow works fine for your use case
5. Team prefers simpler workflow

### Rollback Steps

1. **Stop Using Turn-Based**:
   ```typescript
   // Change workflow back
   const handle = await client.workflow.start(
     PackageBuildWorkflow,  // Original workflow
     {
       taskQueue: 'package-builder',
       args: [input]  // Remove enableTurnBasedGeneration field
     }
   );
   ```

2. **Clean Up State Files**:
   ```bash
   # Archive state files
   mkdir -p .generation-state/archive
   mv .generation-state/gen-*.json .generation-state/archive/

   # Or delete if not needed
   rm -rf .generation-state/
   ```

3. **Clean Up Git Branches**:
   ```bash
   # List generation branches
   git branch | grep "feat/package-generation-"

   # Delete unused branches
   git branch -D feat/package-generation-<timestamp>
   ```

4. **Update Configuration**:
   ```typescript
   // Remove turn-based config
   const config: BuildConfig = {
     // ... other config ...
     // Remove turnBasedGeneration section
   };
   ```

5. **Document Rollback**:
   - Note why turn-based didn't work
   - File issues for improvements
   - Update team documentation

### Rollback Decision Matrix

| Scenario | Rollback? | Alternative |
|----------|-----------|-------------|
| Package too small | Yes | Use original for small packages |
| Execution too slow | Maybe | Try skipping optional phases |
| Phases failing | No | Debug and fix phase executors |
| Token limits still hit | No | Adjust token budgets |
| Recovery not needed | Yes | Original workflow sufficient |
| Team unfamiliar | Maybe | Training or stick with original |

## FAQ

### Q: Can I use both workflows in the same project?

**A**: Yes! Use turn-based for complex packages and original for simple packages. See [Example 3: Conditional Migration](#example-3-conditional-migration).

### Q: What happens to state files after workflow completes?

**A**: State files remain in `.generation-state/` directory. You can archive or delete them. They're useful for auditing and understanding generation history.

### Q: Can I pause and resume a turn-based workflow?

**A**: Yes! That's one of the key benefits. If workflow crashes or fails, use `resumeFromContext` to continue from last successful phase.

### Q: How much longer does turn-based take?

**A**: 3-5x longer than original workflow. Original: 5-10 minutes. Turn-based: 25-35 minutes. The extra time buys reliability and observability.

### Q: Do I need to change my package plans?

**A**: No. Both workflows use the same package plan format. No changes needed.

### Q: Can I customize which phases run?

**A**: Yes. Use `phasesToExecute` or `phasesToSkip` in config:

```typescript
turnBasedGeneration: {
  enabled: true,
  phasesToSkip: ['EXAMPLES', 'INTEGRATION_REVIEW']  // Skip optional phases
}
```

### Q: What if a phase fails?

**A**: Workflow saves state and returns error. You can fix the issue and resume from last successful phase. See [Recovery Procedures](./turn-based-generation-guide.md#recovery-procedures).

### Q: Can I increase token budgets for specific phases?

**A**: Yes. Use `tokenBudgets` in config:

```typescript
turnBasedGeneration: {
  enabled: true,
  tokenBudgets: {
    CORE_IMPLEMENTATION: 10000,  // Increased from 8000
    TESTING: 8000                 // Increased from 6000
  }
}
```

### Q: How do I monitor turn-based workflow progress?

**A**: Three ways:
1. Watch state files: `watch -n 2 'cat .generation-state/gen-*.json | jq ".currentPhase"'`
2. Watch git commits: `git log --oneline -10`
3. Use Temporal UI: `http://localhost:8233`

See [Monitoring Progress](./turn-based-generation-guide.md#monitoring-progress).

### Q: Is turn-based production-ready?

**A**: It's stable but new. We recommend:
- Test on non-critical packages first
- Start with small packages
- Have rollback plan ready
- Monitor closely during rollout

### Q: Can I go back to original workflow after trying turn-based?

**A**: Yes! See [Rollback Procedure](#rollback-procedure). Simply stop using `PackageBuildTurnBasedWorkflow` and go back to `PackageBuildWorkflow`.

### Q: Do both workflows generate the same output?

**A**: Output should be very similar, but not identical:
- File content depends on Claude API responses
- Turn-based may be slightly more comprehensive (more focused prompts)
- Both follow same quality standards
- Both produce working, tested packages

### Q: How do I know if my package is too large for original workflow?

**A**: Signs package may exceed limits:
- More than 10 source files planned
- Multiple complex integrations
- Large type definitions
- Comprehensive test coverage required
- Previous generation attempts failed

When in doubt, use turn-based for packages ≥ 10 files.

### Q: Can I switch mid-generation from original to turn-based?

**A**: No. You must complete or cancel the current workflow first. Turn-based has different state management and can't resume an original workflow.

### Q: What's the cost difference?

**A**: Turn-based uses ~58K tokens across 15 phases. Original uses ~20-40K tokens in one call. Turn-based is ~2x more expensive in tokens, but provides recovery and reliability.

---

For more details, see:
- [Turn-Based Generation Architecture](../architecture/turn-based-generation.md)
- [Turn-Based Generation Guide](./turn-based-generation-guide.md)
