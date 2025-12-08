# Optimization Proposal: Programmatic Test/Lint Execution

## Current Problem

The workflow is asking the CLI agent to run tests and linting via `executeAgentActivityRequest`, which:
1. **Wastes CLI calls** - Each test/lint request is a separate CLI call ($0.10-0.15 each)
2. **Duplicates work** - We already have `runTaskValidations` that runs tests/lint programmatically
3. **Inefficient** - Agent has to parse output and decide what to do, even when tests pass

## Current Flow

```
1. Agent requests activity: "run_tests" or "run_lint"
2. Workflow executes: executeAgentActivityRequest('run_tests')
3. Activity runs: npm test (via CLI agent)
4. Agent parses output
5. Workflow continues...
6. Later: runTaskValidations also runs tests/lint programmatically
```

**Result**: Tests/lint run **twice** - once via agent, once programmatically.

## Proposed Flow

```
1. Workflow runs: runTaskValidations (programmatic - no CLI call)
2. If allPassed: Skip to next step (no agent involved)
3. If errors: Write errors to file, call executeFixWithCLI
4. Agent fixes issues, workflow re-validates
```

**Result**: Tests/lint run **once** programmatically, agent only involved when there are failures.

## Implementation

### Step 1: Filter Activity Requests

Before executing activity requests from the agent, filter out test/lint commands:

```typescript
// Filter out test/lint commands - we'll run these programmatically
const filteredActivities = taskBreakdown.activities?.filter(
  activity => !['run_tests', 'run_lint', 'run_cmd'].includes(activity.type) ||
    (activity.type === 'run_cmd' && 
     !activity.args?.command?.includes('test') && 
     !activity.args?.command?.includes('lint'))
) || [];
```

### Step 2: Run Validations Programmatically

After task execution, always run `runTaskValidations` (already doing this):

```typescript
const validationResult = await runTaskValidations({
  task,
  workingDir: packageFullPath,
  workflowId: workflowId,
});
```

### Step 3: Only Involve Agent on Failures

Only call `executeFixWithCLI` if there are validation errors:

```typescript
if (!validationResult.allPassed) {
  // Only now involve the CLI agent
  const fixResult = await executeFixWithCLI({
    task,
    validationErrorsFilePath: validationResult.validationErrorsFilePath,
    // ...
  });
}
```

## Cost Savings

### Current Cost (per task with tests/lint)
- Agent activity request: `run_tests` = 1 CLI call ($0.10-0.15)
- Agent activity request: `run_lint` = 1 CLI call ($0.10-0.15)
- `runTaskValidations` = 0 CLI calls (programmatic)
- **Total**: 2 CLI calls = **$0.20-0.30 per task**

### Proposed Cost (per task with tests/lint)
- `runTaskValidations` = 0 CLI calls (programmatic)
- `executeFixWithCLI` = 0 CLI calls (only if failures)
- **Total**: 0 CLI calls if tests pass = **$0.00 per task**

### Savings
- **If tests pass**: Save $0.20-0.30 per task
- **If tests fail**: Same cost (agent still needs to fix)
- **For 8 tasks**: Save $1.60-2.40 if all tests pass

## Benefits

1. **Massive cost reduction** - No CLI calls for passing tests/lint
2. **Faster execution** - Programmatic execution is faster than CLI calls
3. **Simpler logic** - Workflow controls test/lint execution directly
4. **Better error handling** - Programmatic execution captures errors more reliably

## Migration Path

1. **Phase 1**: Filter activity requests (prevent agent from requesting tests/lint)
2. **Phase 2**: Ensure `runTaskValidations` runs for all tasks
3. **Phase 3**: Remove test/lint from agent's activity request capabilities
4. **Phase 4**: Update agent prompts to not suggest test/lint activities

## Questions

1. Should we completely remove test/lint from agent's activity requests?
2. Or should we keep them but mark as "deprecated" for backward compatibility?
3. Should we add a flag to control this behavior (for testing/debugging)?

