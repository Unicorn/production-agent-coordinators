# Investigation: requestTaskBreakdown Activity Hanging Issue

## Problem Statement

When running `PackageBuildWorkflow`, the workflow hangs on the `requestTaskBreakdown` activity. The user suspects:
1. The E2E test (`npm run test:cli`) might not actually be testing a real Temporal workflow
2. The `requestTaskBreakdown` activity might not be properly piping the CLI to run with node
3. The activity might not have been tested properly

## Investigation Findings

### 1. E2E Test Analysis

**File**: `src/__tests__/cli-integration.e2e.test.ts`

**Findings**:
- ✅ **The test DOES run a real Temporal workflow** - it uses `client.workflow.start(PackageBuildWorkflow, ...)`
- ✅ **The test uses a real Temporal server** - connects to `localhost:7233`
- ⚠️ **The test requires a worker to be running separately** - uses taskQueue `engine-cli-e2e`
- ⚠️ **The test does NOT start a worker** - expects worker to be started manually

**Test Flow**:
1. Connects to Temporal server
2. Starts `PackageBuildWorkflow` via `client.workflow.start()`
3. Waits for workflow result (30 minute timeout)
4. Verifies package files were created

**Worker Requirement**:
- Worker must be started separately: `TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker`
- If worker is not running, workflow will hang waiting for activities to execute
- Documentation: `docs/RUNNING_E2E_TESTS.md`

### 2. requestTaskBreakdown Activity Analysis

**File**: `src/activities/cli-agent.activities.ts` (lines 977-1260)

**Flow**:
1. `requestTaskBreakdown` builds a prompt
2. Calls `executeClaudeCLI` (line 1135)
3. `executeClaudeCLI` calls `provider.executeAgent` (line 920)
4. `ClaudeCLIProvider.executeAgent` calls `executeClaudeAgent` from `temporal-coordinator` (line 387)
5. `executeClaudeAgent` spawns the CLI process (line 167 in `temporal-coordinator/src/claude-activities.ts`)

**CLI Spawn Implementation** (temporal-coordinator/src/claude-activities.ts):
```typescript
const proc = spawn('claude', args, {
  cwd: workingDir,
  timeout: timeoutMs,
  env: { ...process.env },
  stdio: ['pipe', 'pipe', 'pipe'], // Explicitly set stdin/stdout/stderr to pipes
});

// CRITICAL: Close stdin immediately to prevent CLI from waiting for input
proc.stdin.end();
```

**Analysis**:
- ✅ stdin is properly closed with `proc.stdin.end()`
- ✅ stdio is set to pipes (not inherit)
- ✅ stdout/stderr are drained
- ✅ Error handling is in place
- ✅ Timeout is set (600000ms = 10 minutes)

### 3. Potential Issues Identified

#### Issue 1: Instruction Double-Processing
In `requestTaskBreakdown`:
1. Line 1133: `buildClaudeInstruction(breakdownPrompt, modelSelection)` - processes instruction once
2. Line 1135: Calls `executeClaudeCLI` with processed instruction
3. In `ClaudeCLIProvider.executeAgent` (line 367): If `params.task` is set, it calls `buildClaudeInstruction` AGAIN

However, `executeClaudeCLI` passes `task: 'implement'` as default (line 927), so the instruction might be processed twice if the provider checks `params.task`.

**Status**: Need to verify if this causes issues

#### Issue 2: Worker Not Running
If the worker is not running when the test executes:
- Workflow starts successfully
- Activities are queued but never execute
- Workflow hangs waiting for activity completion
- Test times out after 30 minutes

**Status**: This is likely the main issue - test requires manual worker startup

#### Issue 3: CLI Command Construction
The CLI command is constructed correctly:
- `--print` flag for non-interactive mode
- `--output-format json` for structured output
- `--permission-mode` and `--model` flags
- Instruction as positional argument

**Status**: Command construction looks correct

### 4. Test Verification

**To verify if the test actually runs a workflow**:
1. Check if worker is running: `ps aux | grep "start:worker"`
2. Check Temporal UI: http://localhost:8080
3. Look for workflow executions in Temporal UI
4. Check worker logs for activity execution

**To verify if requestTaskBreakdown is being called**:
1. Add console.log at start of `requestTaskBreakdown`
2. Check worker logs for the log message
3. Check Temporal UI for activity execution

## Recommendations

### Immediate Actions

1. **Verify Worker is Running**
   - Before running tests, ensure worker is started:
     ```bash
     cd packages/agents/package-builder-production
     TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker
     ```

2. **Add Worker Startup to Test**
   - Consider using `@temporalio/testing` TestWorkflowEnvironment
   - Or add worker startup in test `beforeAll` hook
   - Or document clearly that worker must be running

3. **Add Direct Activity Test**
   - Create a test that directly calls `requestTaskBreakdown` activity
   - This will verify the activity works without full workflow
   - Can use TestWorkflowEnvironment for this

4. **Fix Instruction Double-Processing**
   - In `requestTaskBreakdown`, don't call `buildClaudeInstruction` if it will be called again in provider
   - Or pass `task: undefined` to `executeClaudeCLI` to skip double-processing

### Long-term Improvements

1. **Automated Worker Management**
   - Use TestWorkflowEnvironment for E2E tests
   - Automatically start/stop worker in test lifecycle
   - No manual worker startup required

2. **Better Error Messages**
   - If activity times out, check if worker is running
   - Provide clear error message if worker not found

3. **Activity Unit Tests**
   - Test `requestTaskBreakdown` directly with mocked CLI
   - Test CLI spawn logic separately
   - Verify stdin/stdout/stderr handling

## Test Plan

### Test 1: Verify Worker Requirement
```bash
# Without worker running
npm run test:cli
# Expected: Test should fail with clear error about worker not running

# With worker running
TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker &
npm run test:cli
# Expected: Test should execute workflow successfully
```

### Test 2: Direct Activity Test
Create a test that directly calls `requestTaskBreakdown`:
```typescript
it('should execute requestTaskBreakdown activity directly', async () => {
  const result = await requestTaskBreakdown({
    planContent: TEST_PLAN_CONTENT,
    requirementsContent: TEST_REQUIREMENTS_CONTENT,
    phase: 'scaffold',
    workingDir: testPackagePath,
    provider: 'claude',
  });
  
  expect(result.tasks).toBeDefined();
  expect(result.tasks.length).toBeGreaterThan(0);
});
```

### Test 3: CLI Spawn Verification
Test that CLI spawn works correctly:
```typescript
it('should spawn Claude CLI without hanging', async () => {
  const proc = spawn('claude', ['--version'], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  proc.stdin.end();
  
  const result = await new Promise((resolve) => {
    let stdout = '';
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.on('close', (code) => resolve({ code, stdout }));
  });
  
  expect(result.code).toBe(0);
});
```

## Next Steps

1. ✅ Verify test actually runs workflow (CONFIRMED - it does)
2. ⏳ Check if worker is required (CONFIRMED - it is)
3. ⏳ Create direct activity test to isolate issue
4. ⏳ Fix instruction double-processing if needed
5. ⏳ Add automated worker management to tests

