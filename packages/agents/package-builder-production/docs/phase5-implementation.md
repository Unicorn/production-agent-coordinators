# Phase 5: Optimization Implementation

## Overview

Phase 5 implements systematic optimization tools for model selection, thinking level tuning, and subagent strategy optimization. These tools enable data-driven decisions to minimize cost while maximizing success rates.

## Implementation Summary

### ✅ Completed Features

1. **A/B Testing Framework**
   - `executeABTest` - Run A/B tests comparing different model selections
   - `analyzeABTest` - Analyze results to determine optimal variant
   - `compareModelSelection` - Direct comparison of two model selections

2. **Thinking Level Tuning**
   - `testThinkingLevels` - Test different thinking keywords
   - `analyzeThinkingLevels` - Find optimal thinking budget allocation
   - Measure improvement over baseline

3. **Subagent Optimization**
   - `testSubagentStrategies` - Compare parallel vs sequential execution
   - `analyzeSubagentStrategies` - Determine best cost/time tradeoff
   - Measure task completion rates

4. **CLI Tool**
   - `optimization-runner` - Command-line interface for running optimization tests

### Files Created

- `packages/agents/package-builder-production/src/activities/optimization-ab-testing.activities.ts`
- `packages/agents/package-builder-production/src/activities/optimization-tuning.activities.ts`
- `packages/agents/package-builder-production/src/activities/optimization-subagent.activities.ts`
- `packages/agents/package-builder-production/src/scripts/optimization-runner.ts`
- `packages/agents/package-builder-production/docs/phase5-implementation.md`

---

## A/B Testing Framework

### Purpose

Systematically compare different model selections (Opus vs Sonnet vs Haiku) and thinking levels to find the optimal configuration for each task type.

### Usage

```typescript
import { executeABTest, analyzeABTest } from './activities/optimization-ab-testing.activities.js';

// Define test configuration
const config: ABTestConfig = {
  testName: 'architecture-comparison',
  variants: [
    {
      name: 'opus-ultrathink',
      model: 'opus',
      thinkingLevel: 'ultrathink',
      description: 'Opus with ultrathink for architecture',
    },
    {
      name: 'sonnet-think-hard',
      model: 'sonnet',
      thinkingLevel: 'think hard',
      description: 'Sonnet with think hard for architecture',
    },
  ],
  testSpec: '...',
  requirements: '...',
  runsPerVariant: 5,
  metrics: ['cost', 'success_rate', 'duration'],
};

// Run test
const results = await executeABTest(config, workspacePath);

// Analyze results
const analysis = await analyzeABTest(workspacePath, 'architecture-comparison');
```

### Analysis Output

```json
{
  "testName": "architecture-comparison",
  "totalRuns": 10,
  "variants": [
    {
      "name": "opus-ultrathink",
      "runs": 5,
      "successRate": 1.0,
      "averageCost": 0.25,
      "averageDuration": 45000,
      "averageRepairAttempts": 0.2,
      "costPerSuccess": 0.25
    },
    {
      "name": "sonnet-think-hard",
      "runs": 5,
      "successRate": 0.8,
      "averageCost": 0.15,
      "averageDuration": 38000,
      "averageRepairAttempts": 0.6,
      "costPerSuccess": 0.1875
    }
  ],
  "winner": {
    "variant": "sonnet-think-hard",
    "reason": "Lowest cost per success ($0.1875) with 80% success rate"
  },
  "recommendations": [
    "Use sonnet-think-hard for this task type (lowest cost per success: $0.1875)"
  ]
}
```

---

## Thinking Level Tuning

### Purpose

Find the optimal thinking budget allocation by testing different thinking keywords (`think`, `think hard`, `ultrathink`) and measuring their impact on success rate and cost.

### Usage

```typescript
import { testThinkingLevels, analyzeThinkingLevels } from './activities/optimization-tuning.activities.js';

const config: ThinkingLevelTest = {
  testName: 'architecture-thinking',
  baseModel: 'opus',
  thinkingLevels: [
    { keyword: 'none', description: 'No extended thinking' },
    { keyword: 'think', description: 'Basic extended thinking' },
    { keyword: 'think hard', description: 'More computation' },
    { keyword: 'ultrathink', description: 'Maximum thinking budget' },
  ],
  testSpec: '...',
  requirements: '...',
  runsPerLevel: 5,
};

const results = await testThinkingLevels(config, workspacePath);
const analysis = await analyzeThinkingLevels(workspacePath, 'architecture-thinking');
```

### Analysis Output

```json
{
  "testName": "architecture-thinking",
  "baseModel": "opus",
  "levels": [
    {
      "keyword": "none",
      "successRate": 0.6,
      "averageCost": 0.20,
      "costPerSuccess": 0.3333,
      "improvementOverNone": null
    },
    {
      "keyword": "think hard",
      "successRate": 0.9,
      "averageCost": 0.25,
      "costPerSuccess": 0.2778,
      "improvementOverNone": 16.7
    },
    {
      "keyword": "ultrathink",
      "successRate": 1.0,
      "averageCost": 0.30,
      "costPerSuccess": 0.30,
      "improvementOverNone": 10.0
    }
  ],
  "optimalLevel": {
    "keyword": "think hard",
    "reason": "Best cost/benefit ratio: $0.2778 per success with 90% success rate",
    "costBenefit": "Saves 16.7% compared to no thinking"
  }
}
```

---

## Subagent Optimization

### Purpose

Measure the cost/time tradeoffs between parallel subagent execution vs sequential execution to determine the optimal strategy.

### Usage

```typescript
import { testSubagentStrategies, analyzeSubagentStrategies } from './activities/optimization-subagent.activities.js';

const config: SubagentStrategyTest = {
  testName: 'parallel-vs-sequential',
  strategies: [
    {
      name: 'parallel',
      type: 'parallel',
      description: 'Execute subagents in parallel',
    },
    {
      name: 'sequential',
      type: 'sequential',
      description: 'Execute subagents sequentially',
    },
  ],
  tasks: [
    { name: 'types', instruction: 'Implement types' },
    { name: 'core', instruction: 'Implement core logic' },
    { name: 'tests', instruction: 'Write tests' },
  ],
  testSpec: '...',
  requirements: '...',
  runsPerStrategy: 5,
};

const results = await testSubagentStrategies(config, workspacePath);
const analysis = await analyzeSubagentStrategies(workspacePath, 'parallel-vs-sequential');
```

### Analysis Output

```json
{
  "testName": "parallel-vs-sequential",
  "strategies": [
    {
      "name": "parallel",
      "type": "parallel",
      "successRate": 1.0,
      "averageCost": 0.30,
      "averageDuration": 60000,
      "costPerTask": 0.10,
      "timePerTask": 20000
    },
    {
      "name": "sequential",
      "type": "sequential",
      "successRate": 1.0,
      "averageCost": 0.25,
      "averageDuration": 90000,
      "costPerTask": 0.0833,
      "timePerTask": 30000
    }
  ],
  "winner": {
    "strategy": "parallel",
    "reason": "Best cost/time tradeoff: $0.10 per task, 20.0s per task"
  },
  "recommendations": [
    "Parallel execution saves 33.3% time with only 20.0% cost increase - recommended for this task"
  ]
}
```

---

## CLI Tool: optimization-runner

### Commands

```bash
# Run A/B test
npm run optimization-runner ab-test architecture-comparison --workspace /tmp/opt

# Test thinking levels
npm run optimization-runner thinking architecture-thinking --workspace /tmp/opt

# Test subagent strategies
npm run optimization-runner subagent parallel-vs-sequential --workspace /tmp/opt

# Analyze results
npm run optimization-runner analyze ab-test architecture-comparison
npm run optimization-runner analyze thinking architecture-thinking
npm run optimization-runner analyze subagent parallel-vs-sequential
```

---

## Integration with Workflows

### Future Integration

These optimization activities are designed to be integrated with actual workflow execution. In a full implementation:

1. **Workflow Integration**: Tests would execute actual `ClaudeAuditedBuildWorkflow` runs
2. **Real Metrics**: Capture actual costs, durations, and success rates
3. **Automated Recommendations**: Use analysis results to automatically select optimal configurations
4. **Continuous Optimization**: Run tests periodically to adapt to changing patterns

### Example Integration Pattern

```typescript
// In workflow
const optimalModel = await getOptimalModelForTask('architecture');
const optimalThinking = await getOptimalThinkingLevel('opus', 'architecture');

await executeClaudeAgent({
  instruction: `${optimalThinking.toUpperCase()} about architecture...`,
  model: optimalModel,
  // ...
});
```

---

## Best Practices

### A/B Testing
- Run at least 5-10 runs per variant for statistical significance
- Test with representative package specs
- Compare variants on same test data
- Track multiple metrics (cost, success rate, duration)

### Thinking Level Tuning
- Test all levels (none, think, think hard, ultrathink)
- Measure improvement over baseline
- Consider cost vs benefit tradeoff
- Document optimal levels per task type

### Subagent Optimization
- Test with realistic task sets
- Measure both cost and time
- Consider task dependencies
- Factor in failure rates

---

## Next Steps

### Immediate
- ✅ Optimization framework implemented
- ⏸️ Integrate with actual workflow execution
- ⏸️ Run real optimization tests
- ⏸️ Document optimal configurations

### Future Enhancements
- [ ] Automated configuration selection
- [ ] Continuous optimization monitoring
- [ ] Historical trend analysis
- [ ] Cost prediction models
- [ ] Performance regression detection

---

## Related Documentation

- [Claude CLI Integration Plan](../../../../plans/headless-claude/claude-cli-integration-plan.md)
- [Phase 3 Implementation](./phase3-implementation.md)
- [Phase 4 Implementation](./phase4-implementation.md)
- [Optimization Dashboard](./phase4-implementation.md#optimization-dashboard)

