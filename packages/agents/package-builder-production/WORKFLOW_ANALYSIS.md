# Workflow History Analysis & Optimization Recommendations

## Executive Summary

Analyzed 3 workflow executions for a simple package (`@test/simple-package`). Found **massive inefficiencies** causing $5+ in costs:

1. **20+ duplicate activity requests** per workflow (npm install, build, lint, test executed multiple times)
2. **Agent over-planning**: 8 tasks for a simple package (should be 3-4)
3. **Unnecessary iterative planning**: Agent returns `more_tasks: true` even for simple packages
4. **No activity request deduplication**: Same commands executed 3-4 times
5. **File system errors causing retries**: ENOENT errors waste CLI calls

## Workflow Breakdown

### Workflow 1: `test-resume-claude-1764984561354` (b6464412)
**Status**: Terminated manually after 2 tasks
**Duration**: ~4 minutes before termination

**Activity Counts**:
- `requestTaskBreakdown`: **1 call** (returned 8 tasks, `more_tasks: true`)
- `executeTaskWithCLI`: **3 calls** (T1: 60.9s, T2: 26.9s, T3: started but terminated)
- `executeAgentActivityRequest`: **10 calls**
  - npm install: 2x
  - npm run build: 2x
  - npm run lint: 2x
  - npm test: 2x
  - npx tsc --noEmit: 1x
  - read_file: 1x
- `runTaskValidations`: **2 calls**

**Issues Found**:
1. Agent returned **8 tasks** for a simple package (should be 3-4)
2. Agent requested **4 activity requests** in breakdown (npm install, build, lint, test)
3. Each task also had `activity_requests` (duplicate commands)
4. **ENOENT error** on first task execution (missing `.claude/logs/` directory)
5. Agent set `more_tasks: true` despite simple package

### Workflow 2: `test-resume-claude-1764984159592` (32b3875d)
**Status**: Completed more tasks (6 tasks completed)
**Duration**: ~8 minutes

**Activity Counts**:
- `requestTaskBreakdown`: **2 calls** (iterative planning - agent returned `more_tasks: true` first time)
- `executeTaskWithCLI`: **7 calls**
  - T1: 28.2s
  - T2: 33.4s
  - T3: 41.5s
  - T4: 64.0s
  - T5: 100.6s
  - T6: 12.3s (retry after ENOENT)
- `executeAgentActivityRequest`: **20 calls** (massive duplication)
  - npm install: 4x
  - npm run build: 4x
  - npm run lint: 4x
  - npm test: 4x
  - npx tsc --noEmit: 2x
  - read_file: 2x
- `runTaskValidations`: **6 calls**
- `selectClaudeModel`: **7 calls** (one per task - unnecessary)

**Issues Found**:
1. **2 task breakdown iterations** (agent returned `more_tasks: true` first time)
2. **20 activity requests** (many duplicates - same commands 4x)
3. **7 task executions** (some tasks needed multiple iterations)
4. **ENOENT error** on T6 (missing log directory)
5. Agent requested same commands in:
   - Breakdown `activities` array
   - Each task's `activity_requests` array
   - Result: npm install/build/lint/test executed 4 times each

### Workflow 3: `test-e2e-claude-1764983859272` (e8341b5d)
**Status**: Earlier workflow (less complete)
**Duration**: ~3 minutes

**Activity Counts**:
- `requestTaskBreakdown`: **1 call**
- `executeTaskWithCLI`: **2 calls** (T1: 46.5s, T2: 11.9s)
- `executeAgentActivityRequest`: **12 calls**
- `setupCLIWorkspace`: **1 call** (scaffold phase)

## Root Causes

### 1. Agent Over-Planning (8 tasks for simple package)

**Problem**: Agent breaks down simple package into 8 granular tasks:
- T1: Verify package state
- T2: Run baseline verification
- T3: Create package.json
- T4: Create tsconfig.json
- T5: Create ESLint config
- T6: Create directory structure
- T7: Inspect repository (duplicate of T1)
- T8: Run baseline verification (duplicate of T2)

**Should be**: 3-4 consolidated tasks:
- T1: Setup configuration files (package.json, tsconfig.json, ESLint)
- T2: Create directory structure
- T3: Implement greet function with tests
- T4: Verify and polish

**Impact**: 2x more task executions = 2x more CLI calls

### 2. Duplicate Activity Requests (20 requests, ~5 unique)

**Problem**: Agent requests same commands multiple times:
- In breakdown `activities` array: npm install, build, lint, test
- In each task's `activity_requests`: same commands again
- Result: npm install executed 4x, build 4x, lint 4x, test 4x

**Should be**: Execute each unique command once, share results

**Impact**: 4x more activity requests than necessary = 4x more CLI calls

### 3. Unnecessary Iterative Planning

**Problem**: Agent returns `more_tasks: true` for simple packages, causing:
- Second `requestTaskBreakdown` call
- Additional CLI call cost
- More tasks generated

**Should be**: For simple packages (< 10 tasks), return all tasks at once

**Impact**: 1 extra `requestTaskBreakdown` call per workflow

### 4. File System Errors Causing Retries

**Problem**: ENOENT errors when writing log files:
- Missing `.claude/logs/` directory
- Activity retries, wasting CLI calls
- Error: `ENOENT: no such file or directory, open '.../.claude/logs/...jsonl'`

**Should be**: Create directories recursively before writing

**Impact**: 1-2 wasted CLI calls per workflow due to retries

### 5. No Activity Request Deduplication

**Problem**: Workflow executes same activity requests multiple times:
- No tracking of executed requests
- No caching of results
- Same commands executed in breakdown and tasks

**Should be**: Track executed requests, cache results, skip duplicates

**Impact**: 3-4x more activity requests than necessary

## Cost Analysis

### Current Cost Per Workflow

**Workflow 2 (most complete)**:
- `requestTaskBreakdown`: 2 calls × $0.10 = $0.20
- `executeTaskWithCLI`: 7 calls × $0.10 = $0.70
- `executeAgentActivityRequest`: 20 calls × $0.01 = $0.20 (non-CLI, but still cost)
- **Total**: ~$1.10 per workflow (excluding actual Claude API costs)

**Actual Claude API costs** (from CLI calls):
- Each `requestTaskBreakdown`: ~$0.15-0.20 (large prompt)
- Each `executeTaskWithCLI`: ~$0.10-0.15 (medium prompt)
- **Total**: ~$1.50-2.00 in Claude API costs

**Combined**: **$2.60-3.10 per workflow** for a simple package

### Optimized Cost Target

**With optimizations**:
- `requestTaskBreakdown`: 1 call × $0.15 = $0.15
- `executeTaskWithCLI`: 4 calls × $0.10 = $0.40
- `executeAgentActivityRequest`: 5 calls × $0.01 = $0.05
- **Total**: ~$0.60 per workflow

**Actual Claude API costs**:
- `requestTaskBreakdown`: ~$0.15
- `executeTaskWithCLI`: ~$0.40
- **Total**: ~$0.55 in Claude API costs

**Combined**: **$1.15 per workflow** (56% reduction)

## Optimization Recommendations

### Priority 1: Deduplicate Activity Requests (HIGHEST IMPACT)

**Problem**: 20 activity requests, only ~5 unique
**Solution**: Track executed requests, cache results, skip duplicates

**Implementation**:
```typescript
// In workflow, track executed activity requests
const executedActivityRequests = new Map<string, ActivityResult>();

// Before executing, check if already executed
const requestKey = `${activity.type}:${JSON.stringify(activity.args)}`;
if (executedActivityRequests.has(requestKey)) {
  return executedActivityRequests.get(requestKey);
}

// Execute and cache
const result = await executeAgentActivityRequest(...);
executedActivityRequests.set(requestKey, result);
```

**Impact**: Reduce 20 requests to 5 = **75% reduction in activity requests**

### Priority 2: Fix File System Errors

**Problem**: ENOENT errors cause retries
**Solution**: Create directories recursively before writing

**Implementation**:
```typescript
// In executeTaskWithCLI, ensure directory exists
await fs.mkdir(path.dirname(logFilePath), { recursive: true });
```

**Impact**: Eliminate retries = **Save 1-2 CLI calls per workflow**

### Priority 3: Optimize Task Breakdown Prompt

**Problem**: Agent generates 8 tasks for simple package
**Solution**: Improve prompt to encourage consolidation

**Implementation**:
- Add complexity detection (plan size, requirements count)
- For simple packages, instruct agent to return 3-4 consolidated tasks
- Discourage `more_tasks: true` for simple packages
- Example: "For simple packages, combine related tasks (e.g., 'Setup configuration files' instead of separate tasks for package.json, tsconfig.json, ESLint)"

**Impact**: Reduce 8 tasks to 4 = **50% reduction in task executions**

### Priority 4: Prevent Iterative Planning for Simple Packages

**Problem**: Agent returns `more_tasks: true` unnecessarily
**Solution**: Detect simple packages and force `more_tasks: false`

**Implementation**:
```typescript
// After task breakdown, if simple package and more_tasks: true
if (isSimplePackage && taskBreakdown.more_tasks) {
  console.warn('Agent returned more_tasks for simple package, forcing false');
  taskBreakdown.more_tasks = false;
}
```

**Impact**: Eliminate second breakdown call = **Save 1 CLI call per workflow**

### Priority 5: Reduce Task Iteration Limits

**Problem**: Max 10 iterations per task (too high)
**Solution**: Reduce to 4, add early exit

**Implementation**:
```typescript
while (!taskComplete && taskSequence < 4) { // Reduced from 10
  // ... execute task
  if (taskSequence >= 2 && !progressMade) {
    throw new Error('No progress after 2 iterations');
  }
}
```

**Impact**: Fail fast on stuck tasks = **Prevent wasted CLI calls**

### Priority 6: Fix Test Workflow IDs

**Problem**: Tests create duplicate workflows
**Solution**: Use deterministic IDs or check for existing

**Implementation**:
```typescript
const workflowId = `test-resume-claude-${TEST_PACKAGE_SPEC.name}`;
const existingHandle = await client.workflow.getHandle(workflowId);
if (existingHandle) {
  // Wait for existing or terminate
}
```

**Impact**: Prevent duplicate workflows = **Save entire workflow cost**

## Expected Cost Reduction

### Current State
- **Per workflow**: $2.60-3.10
- **3 workflows**: $7.80-9.30

### After Optimizations
- **Per workflow**: $1.15
- **1 workflow** (no duplicates): $1.15

### Savings
- **Per workflow**: 56% reduction ($1.45-1.95 saved)
- **Overall**: 85% reduction ($6.65-8.15 saved for 3 workflows → 1 workflow)

## Implementation Priority

1. **Phase 6: Deduplicate Activity Requests** - 75% reduction in activity requests
2. **Phase 8: Fix File System Issues** - Eliminate retries
3. **Phase 1: Fix Test Workflow IDs** - Prevent duplicate workflows
4. **Phase 7: Optimize Task Breakdown Prompt** - Reduce task count
5. **Phase 2: Reduce Iteration Limits** - Fail fast on stuck tasks
6. **Phase 4: Add Cost Tracking** - Enable measurement
7. **Phase 3: Optimize Breakdown Strategy** - Prevent iterative planning

## References

- Workflow histories: `b6464412-5227-4aa8-a38f-c1cbb4299148_events.json`, `32b3875d-0596-4758-823e-992662651c08_events.json`, `e8341b5d-85b9-4626-9389-7801f0a06f55_events.json`
- [workflow-cost-optimization.md](./plans/workflow-cost-optimization.md) - Detailed optimization plan
- [WORKFLOW_EFFICIENCY_ANALYSIS.md](./WORKFLOW_EFFICIENCY_ANALYSIS.md) - Cost breakdown

