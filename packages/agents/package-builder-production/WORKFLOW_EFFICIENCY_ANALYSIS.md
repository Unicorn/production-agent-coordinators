# Workflow Efficiency Analysis

## Problem: $5 in Credits for Simple Package

### Current Workflow Structure

The workflow uses an **iterative task breakdown pattern** with multiple nested loops:

1. **Task Breakdown Loop** (`while (moreTasksAvailable)`)
   - Calls `requestTaskBreakdown` → **1 CLI call per iteration**
   - Continues until `more_tasks: false`
   - **Problem**: Agent might return `more_tasks: true` many times

2. **Task Execution Loop** (`while (!taskComplete && taskSequence < 10)`)
   - Calls `executeTaskWithCLI` → **1 CLI call per iteration**
   - Max 10 iterations per task
   - **Problem**: Each iteration is a full CLI call

3. **Validation Loop** (per task)
   - `runTaskValidations` → checks files/commands
   - `executeFixWithCLI` → **1 CLI call per fix iteration**
   - Loops until all validations pass
   - **Problem**: Each fix is a full CLI call

### Cost Calculation

For a simple package, if:
- **Scaffold phase**: 2 task breakdown iterations × 5 tasks × 2 iterations per task = **20 CLI calls**
- **Implement phase**: 2 task breakdown iterations × 5 tasks × 2 iterations per task = **20 CLI calls**
- **Validation fixes**: 3 tasks × 1 fix iteration = **3 CLI calls**
- **Total**: ~43 CLI calls

At ~$0.10-0.15 per CLI call (Claude Sonnet), that's **$4.30-6.45** for a simple package.

### Issues Identified

1. **Too Many Task Breakdown Calls**
   - Agent is instructed to return `more_tasks: true` for iterative planning
   - But for simple packages, this might be overkill
   - Each breakdown call is a full CLI API call

2. **Task Iteration Limit Too High**
   - Max 10 iterations per task
   - Most tasks should complete in 1-2 iterations
   - 10 iterations = 10x the cost

3. **Validation Loop Can Be Expensive**
   - Each fix iteration is a full CLI call
   - Could accumulate many calls if there are many validation errors

4. **No Cost Tracking Per Phase**
   - Can't see where costs are accumulating
   - No early exit if costs exceed budget

### Potential Solutions

1. **Reduce Task Breakdown Iterations**
   - For simple packages, allow agent to return all tasks at once
   - Only use iterative planning for complex packages
   - Add a complexity check before starting iterative mode

2. **Reduce Task Iteration Limit**
   - Lower max iterations from 10 to 3-4
   - Most tasks should complete in 1-2 iterations
   - If a task needs more, it's likely stuck

3. **Optimize Validation Loop**
   - Batch validation errors
   - Fix multiple errors in one CLI call
   - Only loop if critical errors remain

4. **Add Cost Budget**
   - Set a budget per package (e.g., $1 for simple, $5 for complex)
   - Track costs and fail fast if budget exceeded
   - Log cost breakdown per phase

5. **Session Reuse**
   - Already implemented for tasks
   - But each task breakdown starts a new session
   - Could reuse session across breakdown iterations

## Multiple Workflows Issue

### Root Cause

The test file has:
```typescript
workflowId: `test-resume-claude-${Date.now()}`
```

If the test:
- Runs multiple times (test retries, manual runs)
- Has multiple test cases using this pattern
- Fails and gets retried

Then multiple workflows will be created.

### Solution

1. **Check for existing workflow before starting**
   - Use `client.workflow.getHandle()` to check if workflow exists
   - Only start if it doesn't exist
   - Or use deterministic workflow IDs

2. **Clean up test workflows**
   - Add cleanup in `afterAll` to cancel/terminate test workflows
   - Or use a test-specific namespace

3. **Use deterministic workflow IDs for tests**
   - Instead of `Date.now()`, use a fixed ID per test
   - Or check if workflow exists before starting

