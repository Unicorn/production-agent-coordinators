# Cost Tracking Implementation

## Overview
The workflow now tracks costs at a granular level to understand where money is being spent.

## Cost Categories

### 1. Task Breakdown Cost (`taskBreakdownCost`)
- **What**: Cost of requesting task breakdowns from the CLI agent (planning phase)
- **When**: Every time `requestTaskBreakdown` is called
- **Includes**: Both scaffold and implement phase breakdowns
- **Example**: Agent analyzes plan and returns list of tasks

### 2. Task Execution Cost (`taskExecutionCost`)
- **What**: Cost of executing tasks (actual work)
- **When**: Every time `executeTaskWithCLI` is called
- **Includes**: All task execution iterations (scaffold and implement phases)
- **Example**: Agent writes files, creates code, implements features

### 3. Fix Attempt Cost (`fixAttemptCost`)
- **What**: Cost of fix attempts when validation errors occur
- **When**: Every time `executeFixWithCLI` is called
- **Includes**: All fix attempts in both scaffold and implement phases
- **Example**: Agent fixes lint errors, test failures, type errors

### 4. Phase Totals
- **Scaffold Cost** (`scaffoldCost`): Sum of all costs in scaffold phase
- **Implement Cost** (`implementCost`): Sum of all costs in implement phase
- **Total Cost** (`totalCost`): Sum of all costs across entire workflow

## Cost Tracking Flow

```
Workflow Start
  ↓
[Scaffold Phase]
  ├─ requestTaskBreakdown → taskBreakdownCost += cost
  ├─ executeTaskWithCLI → taskExecutionCost += cost
  └─ executeFixWithCLI → fixAttemptCost += cost
  ↓
[Implement Phase]
  ├─ requestTaskBreakdown → taskBreakdownCost += cost
  ├─ executeTaskWithCLI → taskExecutionCost += cost
  └─ executeFixWithCLI → fixAttemptCost += cost
  ↓
[Final Report]
  └─ costMetrics with all breakdowns
```

## Cost Sources

All costs come from CLI agent responses:
- `CLIAgentResult.cost_usd` - Returned by `executeClaudeCLI` and `executeGeminiCLI`
- `TaskBreakdownResult.cost_usd` - Returned by `requestTaskBreakdown` (now includes cost)
- `executeTaskWithCLI` returns `cost_usd` from CLI result
- `executeFixWithCLI` returns `cost_usd` from CLI result

## Cost Logging

The workflow logs costs at multiple levels:
1. **Per-operation**: Each CLI call logs its cost
2. **Per-task**: Each task logs cumulative costs
3. **Per-phase**: Each phase logs total costs
4. **Final summary**: Complete breakdown at workflow end

## Example Output

```
[Scaffold] Received 5 tasks from CLI agent (breakdown cost: $0.1234, total breakdown: $0.1234)
[Scaffold] Task T1 iteration 1 execution cost: $0.2345 (total execution: $0.2345, total scaffold: $0.3579)
[Scaffold] Task T1 fix attempt 1 cost: $0.0567 (total fix attempts: $0.0567)
[Cost] Total workflow cost: $1.2345
[Cost] Breakdown:
  - Task Breakdown (planning): $0.2468
  - Task Execution (work): $0.8765
  - Fix Attempts (errors): $0.1112
  - Scaffold Phase: $0.5000
  - Implement Phase: $0.7345
```

## Benefits

1. **Visibility**: See exactly where costs are incurred
2. **Optimization**: Identify expensive operations
3. **Budgeting**: Understand cost per operation type
4. **Debugging**: Track down unexpected costs

## Future Enhancements

- Track costs per task ID (which tasks are most expensive)
- Track costs per model (sonnet vs opus vs haiku)
- Track costs per validation type (test failures vs lint errors)
- Export cost metrics to monitoring/analytics

