# Workflow Cost Optimization Plan

## Problem Statement

The `PackageBuildWorkflow` is burning through excessive credits ($5+ for simple packages) due to:
1. **Multiple workflow starts** - Tests create duplicate workflows when retried
2. **Excessive CLI calls** - Nested loops with high iteration limits cause 40+ CLI calls per simple package
3. **No cost visibility** - Can't see where costs accumulate
4. **Inefficient iteration strategy** - Iterative planning overkill for simple packages

## Goals

- Reduce workflow costs by 60-80% for simple packages
- Prevent duplicate workflow starts in tests
- Add cost tracking and budgeting
- Optimize iteration limits based on package complexity

## Analysis

See [WORKFLOW_EFFICIENCY_ANALYSIS.md](../WORKFLOW_EFFICIENCY_ANALYSIS.md) for detailed cost breakdown.

### Current Cost Structure

For a simple package:
- **Task Breakdown Loop**: 2-3 iterations × 1 CLI call = 2-3 calls
- **Task Execution Loop**: 5 tasks × 2 iterations × 1 CLI call = 10 calls
- **Validation Loop**: 3 tasks × 1 fix × 1 CLI call = 3 calls
- **Total**: ~15-20 CLI calls per phase × 2 phases = **30-40 CLI calls**
- **Cost**: $0.10-0.15 per call = **$3-6 per simple package**

### Target Cost Structure

For a simple package:
- **Task Breakdown**: 1 iteration (all tasks at once) = 1 call
- **Task Execution**: 5 tasks × 1 iteration = 5 calls
- **Validation**: 3 tasks × 0.5 fixes (batch fixes) = 1-2 calls
- **Total**: ~7-8 CLI calls per phase × 2 phases = **14-16 CLI calls**
- **Target Cost**: $0.10-0.15 per call = **$1.40-2.40 per simple package**

## Workflow History Analysis

### Workflow 1: `test-resume-claude-1764984561354` (b6464412)
- **Status**: Terminated manually
- **Activities**:
  - `requestTaskBreakdown`: 1 call
  - `executeTaskWithCLI`: 3 calls (T1: 60.9s, T2: 26.9s, T3: started but terminated)
  - `executeAgentActivityRequest`: 10 calls (npm install, build, lint, test, etc.)
  - `runTaskValidations`: 2 calls
- **Issues**:
  - Agent returned 8 tasks with `more_tasks: true`
  - Agent requested 4 activity requests in breakdown (npm install, build, lint, test)
  - Each task had its own activity_requests (duplicate commands)
  - ENOENT error on first task execution (missing log directory)

### Workflow 2: `test-resume-claude-1764984159592` (32b3875d)
- **Status**: Completed more tasks
- **Activities**:
  - `requestTaskBreakdown`: 2 calls (iterative planning)
  - `executeTaskWithCLI`: 7 calls
  - `executeAgentActivityRequest`: 20 calls
  - `runTaskValidations`: 6 calls
  - `selectClaudeModel`: 7 calls (one per task)
- **Issues**:
  - **2 task breakdown iterations** (agent returned `more_tasks: true` first time)
  - **20 activity requests** (many duplicate npm commands)
  - **7 task executions** (some tasks needed multiple iterations)
  - Agent requested same commands multiple times (npm install, build, lint, test)

### Workflow 3: `test-e2e-claude-1764983859272` (e8341b5d)
- **Status**: Earlier workflow
- **Activities**:
  - `requestTaskBreakdown`: 1 call
  - `executeTaskWithCLI`: 2 calls
  - `executeAgentActivityRequest`: 12 calls
  - `setupCLIWorkspace`: 1 call (scaffold phase)

### Key Findings

1. **Agent Over-Planning**: Agent returns 8 tasks for a simple package that should be 3-4 tasks
2. **Duplicate Activity Requests**: Agent requests same commands (npm install, build, lint, test) multiple times:
   - In breakdown `activities` array
   - In each task's `activity_requests` array
   - Results in 10-20 `executeAgentActivityRequest` calls
3. **Iterative Planning Unnecessary**: Agent returns `more_tasks: true` even for simple packages
4. **Task Breakdown Too Granular**: 8 tasks for a simple package (should be 3-4)
5. **No Activity Request Deduplication**: Same commands executed multiple times

## Tasks

### Phase 1: Fix Multiple Workflow Starts

- [ ] **Fix test workflow IDs**
  - [ ] Update `cli-integration.e2e.test.ts` to use deterministic workflow IDs
  - [ ] Check for existing workflow before starting (use `client.workflow.getHandle()`)
  - [ ] Add cleanup in `afterAll` to terminate test workflows
  - [ ] Use test-specific workflow ID pattern: `test-{test-name}-{package-name}`

- [ ] **Add workflow deduplication**
  - [ ] Check if workflow with same ID exists before starting
  - [ ] If exists and running, wait for completion instead of starting new
  - [ ] If exists and failed, allow restart with new run ID

### Phase 2: Reduce Iteration Limits

- [ ] **Lower task execution iteration limit**
  - [ ] Reduce from 10 to 4 iterations per task
  - [ ] Most tasks complete in 1-2 iterations
  - [ ] If task needs more, it's likely stuck and should fail fast

- [ ] **Lower validation iteration limit**
  - [ ] Reduce from 5 to 3 validation attempts
  - [ ] Batch validation errors in single fix call when possible
  - [ ] Only loop if critical errors remain

- [ ] **Add early exit conditions**
  - [ ] Exit task loop if no progress after 2 iterations
  - [ ] Exit validation loop if same errors persist after 2 attempts
  - [ ] Log warnings when hitting iteration limits

### Phase 3: Optimize Task Breakdown Strategy

- [ ] **Add package complexity detection**
  - [ ] Analyze plan file to estimate complexity (lines, tasks, dependencies)
  - [ ] Simple packages: return all tasks at once (`more_tasks: false`)
  - [ ] Complex packages: use iterative planning (`more_tasks: true`)

- [ ] **Optimize breakdown prompt**
  - [ ] For simple packages, instruct agent to return all tasks
  - [ ] For complex packages, use iterative planning
  - [ ] Add complexity threshold (e.g., < 10 tasks = simple)

- [ ] **Add breakdown limit**
  - [ ] Max 5 breakdown iterations per phase
  - [ ] If limit reached, log warning and proceed with current tasks
  - [ ] Prevent infinite breakdown loops

- [ ] **Limit task count per breakdown**
  - [ ] For simple packages, limit to 5-6 tasks max
  - [ ] Agent is generating 8 tasks for simple packages (too granular)
  - [ ] Combine related tasks (e.g., "Create tsconfig.json" + "Create ESLint config" = "Setup configuration files")

### Phase 4: Add Cost Tracking

- [ ] **Track costs per activity**
  - [ ] Add `cost_usd` field to activity results
  - [ ] Sum costs in workflow report
  - [ ] Log cost per phase (scaffold, implement)

- [ ] **Add cost budget**
  - [ ] Set budget per package type (simple: $2, medium: $5, complex: $10)
  - [ ] Fail fast if budget exceeded
  - [ ] Log cost breakdown before failing

- [ ] **Add cost metrics to report**
  - [ ] Include `totalCost`, `scaffoldCost`, `implementCost` in `PackageBuildReport`
  - [ ] Track cost per task breakdown iteration
  - [ ] Track cost per task execution

### Phase 5: Optimize Validation Loop

- [ ] **Batch validation fixes**
  - [ ] Collect all validation errors first
  - [ ] Fix multiple errors in single CLI call when possible
  - [ ] Only loop if critical errors remain

- [ ] **Skip non-critical validations**
  - [ ] Skip lint validation if script missing (already implemented)
  - [ ] Skip test validation if script missing
  - [ ] Log skipped validations instead of failing

- [ ] **Add validation caching**
  - [ ] Cache validation results per task
  - [ ] Only re-validate if files changed
  - [ ] Skip validation if task files unchanged

### Phase 6: Deduplicate Activity Requests

- [ ] **Deduplicate activity requests**
  - [ ] Track executed activity requests per workflow
  - [ ] Skip duplicate `run_cmd` requests (same command already executed)
  - [ ] Skip duplicate `read_file` requests (file already read)
  - [ ] Cache activity request results

- [ ] **Merge activity requests**
  - [ ] Combine activity requests from breakdown and tasks
  - [ ] Execute unique requests once
  - [ ] Share results with agent

- [ ] **Optimize activity request execution**
  - [ ] Execute activity requests in parallel when possible
  - [ ] Batch similar requests (e.g., all `run_cmd` requests)
  - [ ] Cache results for reuse

### Phase 7: Optimize Task Breakdown Prompt

- [ ] **Improve prompt for simple packages**
  - [ ] Detect simple packages (small plan, few requirements)
  - [ ] Use simpler prompt that encourages fewer, larger tasks
  - [ ] Discourage `more_tasks: true` for simple packages

- [ ] **Limit activity requests in breakdown**
  - [ ] Discourage agent from requesting same commands multiple times
  - [ ] Instruct agent to reuse activity results
  - [ ] Limit activity requests to 2-3 per breakdown

- [ ] **Encourage task consolidation**
  - [ ] Instruct agent to combine related tasks
  - [ ] Discourage over-granular task breakdown
  - [ ] Example: "Create tsconfig.json" + "Create ESLint config" = "Setup configuration files"

### Phase 8: Fix File System Issues

- [ ] **Fix ENOENT errors**
  - [ ] Ensure log directories exist before writing
  - [ ] Create directories recursively if missing
  - [ ] Handle file system errors gracefully

- [ ] **Optimize file operations**
  - [ ] Cache file reads
  - [ ] Batch file writes
  - [ ] Use atomic file operations

## Implementation Order

1. **Phase 1** (Fix multiple workflows) - **HIGH PRIORITY**
   - Prevents duplicate workflows and wasted credits
   - Quick win, low risk

2. **Phase 8** (Fix file system issues) - **HIGH PRIORITY**
   - Fixes ENOENT errors causing retries
   - Prevents wasted CLI calls on retries

3. **Phase 6** (Deduplicate activity requests) - **HIGH PRIORITY**
   - Biggest cost savings (10-20 duplicate activity requests per workflow)
   - Reduces 20 activity requests to ~5-6 unique ones

4. **Phase 2** (Reduce iteration limits) - **HIGH PRIORITY**
   - Immediate cost reduction
   - Low risk, high impact

5. **Phase 7** (Optimize task breakdown prompt) - **MEDIUM PRIORITY**
   - Reduces task count from 8 to 3-4 for simple packages
   - Prevents unnecessary `more_tasks: true`

6. **Phase 4** (Add cost tracking) - **MEDIUM PRIORITY**
   - Enables visibility into cost accumulation
   - Required before Phase 3 optimization

7. **Phase 3** (Optimize breakdown strategy) - **MEDIUM PRIORITY**
   - Requires cost tracking to measure impact
   - More complex, needs testing

8. **Phase 5** (Optimize validation) - **LOW PRIORITY**
   - Smaller impact, already partially implemented
   - Can be done incrementally

## Success Metrics

- [ ] **Cost reduction**: Simple packages cost < $2.50 (60% reduction)
- [ ] **No duplicate workflows**: Tests never create duplicate workflows
- [ ] **Cost visibility**: Can see cost breakdown per phase in workflow report
- [ ] **Iteration efficiency**: Average 1.5 iterations per task (down from 2.5)
- [ ] **Breakdown efficiency**: Simple packages use 1 breakdown (down from 2-3)
- [ ] **Activity request efficiency**: < 8 unique activity requests per workflow (down from 20)
- [ ] **Task count efficiency**: 3-4 tasks for simple packages (down from 8)

## Testing Strategy

- [ ] **Unit tests**: Test cost tracking and iteration limits
- [ ] **Integration tests**: Test workflow with cost tracking
- [ ] **E2E tests**: Verify cost reduction for simple packages
- [ ] **Manual testing**: Run workflow on simple package and verify costs

## References

- [WORKFLOW_EFFICIENCY_ANALYSIS.md](../WORKFLOW_EFFICIENCY_ANALYSIS.md) - Detailed cost analysis
- [workflow-steps-breakdown.md](../docs/workflow-steps-breakdown.md) - Workflow structure
- [cli-integration.e2e.test.ts](../src/__tests__/cli-integration.e2e.test.ts) - E2E tests
- [package-build.workflow.ts](../src/workflows/package-build.workflow.ts) - Main workflow

## Notes

- Iterative planning is good for complex packages but overkill for simple ones
- Most cost comes from duplicate activity requests, not task execution
- Agent is over-granular: 8 tasks for simple package (should be 3-4)
- Agent requests same commands multiple times (npm install, build, lint, test)
- ENOENT errors cause retries, wasting CLI calls
- Validation loops are already optimized (skip missing scripts)
- Session reuse could save 10-20% but requires careful implementation
