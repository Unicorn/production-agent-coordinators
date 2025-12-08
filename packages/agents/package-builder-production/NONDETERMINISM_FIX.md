# Nondeterminism Error Fix

## Problem

The workflow failed with a nondeterminism error:
```
[TMPRL1100] Nondeterminism error: Activity type of scheduled event 'checkCLICreditsForExecution' 
does not match activity type of activity command 'readPackageJsonProgrammatically'
```

**Root Cause**: The programmatic context gathering activities (`readPackageJsonProgrammatically`, `readTsConfigProgrammatically`, etc.) were called **outside** the conditional block, while `checkCLICreditsForExecution` was called **inside** the conditional block.

When the workflow was replayed after a timeout:
- Original run: `readPackageJsonProgrammatically` (outside conditional) → `checkCLICreditsForExecution` (inside conditional)
- Replay: Code had been updated, so `readPackageJsonProgrammatically` was now inside the conditional, changing the activity order
- Temporal detected the mismatch and threw a nondeterminism error

## Fix

**Moved programmatic context gathering INSIDE the conditional block** to ensure deterministic activity ordering:

```typescript
// BEFORE (NON-DETERMINISTIC):
if (!codeExists || (resumePoint && resumePoint.phase === 'scaffold')) {
  await setupCLIWorkspace(...);
}
// ❌ Called outside conditional - order changes if conditional changes
const packageJsonResult = await readPackageJsonProgrammatically(...);
// ...
if (!codeExists || (resumePoint && resumePoint.phase === 'scaffold')) {
  await checkCLICreditsForExecution(...); // ❌ Different order on replay
}

// AFTER (DETERMINISTIC):
if (!codeExists || (resumePoint && resumePoint.phase === 'scaffold')) {
  await setupCLIWorkspace(...);
  // ✅ All activities inside same conditional - order is always the same
  const packageJsonResult = await readPackageJsonProgrammatically(...);
  // ...
  await checkCLICreditsForExecution(...);
}
```

## Impact

- **Cost**: The failed workflow cost >$7.00 before failing
- **Prevention**: Future workflows will maintain deterministic activity ordering
- **Note**: The current running workflow cannot be recovered - it must be terminated and restarted

## Temporal Determinism Rules

Temporal workflows must be **100% deterministic**:
- ✅ Same code path must execute in the same order on replay
- ✅ Activities must be called in the same order
- ✅ Conditional logic must evaluate the same way
- ❌ Cannot use non-deterministic values (Date.now(), Math.random())
- ❌ Cannot change code while workflow is running (causes replay mismatch)

## Prevention

To prevent future nondeterminism errors:
1. **Always call activities in the same conditional block** - don't mix inside/outside
2. **Use deterministic values** - avoid Date.now(), Math.random(), etc.
3. **Don't deploy code changes while workflows are running** - wait for workflows to complete
4. **Test workflow replay** - ensure workflows can be replayed successfully

