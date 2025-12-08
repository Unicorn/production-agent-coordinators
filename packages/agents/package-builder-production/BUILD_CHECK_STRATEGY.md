# Build Check Strategy: When to Run `npm run build` After File Writes

## Overview
After the agent writes files, we run `npm run build` programmatically to check for compilation errors and provide immediate feedback.

## When to RUN Build Checks ✅

1. **After task completion in implement phase** - When agent signals `task_complete: true`
   - Files are complete and should compile
   - Agent expects feedback on compilation errors

2. **After validation fixes** - When agent fixes validation errors
   - Agent has made changes to fix issues
   - Need to verify code still compiles

3. **Before final validation** - Before running full test suite
   - Ensure code compiles before running expensive tests
   - Catch compilation errors early

4. **After scaffold phase completes** - When all scaffold tasks are done
   - Initial structure should be compilable
   - Catch structural issues early

## When to SKIP Build Checks ❌

1. **During scaffold phase** - Files are intentionally incomplete
   - Package structure is being created
   - Dependencies may not be installed yet
   - Files may be partial implementations

2. **After first file write in a task** - Code may be incomplete
   - Agent may write multiple files per task
   - First file may have incomplete imports/references
   - Wait until task is complete

3. **If package.json doesn't exist** - No build script available
   - Can't run build without package.json
   - Skip gracefully

4. **If build script doesn't exist** - No `npm run build` script
   - Some packages may not have build scripts
   - Skip gracefully (already handled)

5. **If node_modules doesn't exist** - Dependencies not installed
   - Build will fail due to missing dependencies
   - Install dependencies first, then build

6. **During task continuation** - When `taskSequence > 0` and `!taskComplete`
   - Agent is still working on the task
   - Code is intentionally incomplete
   - Wait until task is complete

7. **After non-code file writes** - Markdown, JSON configs, etc.
   - No compilation needed
   - Skip build check

## Implementation Strategy

### After `executeTaskWithCLI` Completes
```typescript
// After task completes (taskComplete === true)
if (taskComplete && phase === 'implement') {
  // Check if build is appropriate
  if (shouldRunBuildCheck(packageFullPath)) {
    const buildResult = await runBuild({
      workspaceRoot: input.workspaceRoot,
      packagePath: input.packagePath,
    });
    
    if (!buildResult.success) {
      // Pass build errors to agent for fixing
      // Include in next task context or create fix task
    }
  }
}
```

### Helper Function: `shouldRunBuildCheck`
```typescript
function shouldRunBuildCheck(packagePath: string): boolean {
  // Check if package.json exists
  // Check if build script exists
  // Check if node_modules exists (or dependencies installed)
  // Check if we're in implement phase (not scaffold)
  // Check if task is complete (not in progress)
  return true/false;
}
```

## Benefits

1. **Early Error Detection** - Catch compilation errors immediately after file writes
2. **Reduced Token Usage** - Agent doesn't need to request build checks
3. **Faster Feedback Loop** - Agent gets immediate feedback on compilation errors
4. **Better Code Quality** - Ensures code compiles before moving to next task

## Cost Savings

- **Before**: Agent requests `run_cmd npm run build` (~$0.10-0.15 per request)
- **After**: Workflow runs build programmatically (no CLI call needed)
- **Savings**: ~$0.10-0.30 per workflow (depending on how many times agent would request it)

