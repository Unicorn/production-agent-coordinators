# Summary: requestTaskBreakdown Investigation

## Key Findings

### ✅ Test DOES Run Real Temporal Workflow
- The E2E test (`cli-integration.e2e.test.ts`) uses `client.workflow.start(PackageBuildWorkflow)`
- It connects to a real Temporal server (localhost:7233)
- It waits for workflow completion with a 30-minute timeout

### ⚠️ Worker Must Be Running Separately
- The test uses taskQueue `engine-cli-e2e`
- **The test does NOT start a worker** - it expects one to be running
- If worker is not running, workflow will hang waiting for activities
- Worker must be started manually: `TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker`

### ✅ CLI Spawn Code Looks Correct
- `executeClaudeAgent` in `temporal-coordinator` properly:
  - Sets stdio to pipes: `['pipe', 'pipe', 'pipe']`
  - Closes stdin immediately: `proc.stdin.end()`
  - Drains stdout/stderr
  - Handles errors and timeouts
  - Sets 10-minute timeout

### ⚠️ Potential Issue: Instruction Processing
In `requestTaskBreakdown`:
1. Line 1133: Calls `buildClaudeInstruction(breakdownPrompt, modelSelection)` 
2. Line 1135: Passes processed instruction to `executeClaudeCLI`
3. `executeClaudeCLI` passes `task: 'implement'` to provider (line 927)
4. Provider checks `params.model` first (line 355) - if set, skips instruction processing
5. Since `model` IS explicitly passed (line 924), provider should skip double-processing

**Status**: Should be fine, but worth verifying

## Root Cause Hypothesis

**Most Likely**: Worker not running when test executes
- Workflow starts successfully
- Activities are queued in Temporal
- No worker to execute activities
- Workflow hangs waiting for activity completion
- Test times out after 30 minutes

**Less Likely**: CLI hanging issue
- CLI spawn might hang in certain environments
- stdin/stdout/stderr handling might have edge cases
- Need direct activity test to verify

## Recommended Actions

### Immediate (To Verify Issue)

1. **Check if worker is running when test executes**
   ```bash
   # In terminal 1: Start worker
   cd packages/agents/package-builder-production
   TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker
   
   # In terminal 2: Run test
   npm run test:cli
   ```

2. **Check Temporal UI for workflow execution**
   - Open http://localhost:8080
   - Look for workflow executions
   - Check if activities are being executed or stuck

3. **Run direct activity test**
   ```bash
   RUN_DIRECT_REQUESTTASKBREAKDOWN=true npm test -- requestTaskBreakdown-direct.test.ts
   ```
   This will test the activity directly without workflow/worker

### Fixes Needed

1. **Add worker startup to test** (or use TestWorkflowEnvironment)
2. **Add clear error message** if worker not running
3. **Verify instruction processing** doesn't cause issues
4. **Add direct activity tests** to isolate issues

## Test Files Created

1. `INVESTIGATION_REQUESTTASKBREAKDOWN.md` - Detailed investigation
2. `src/__tests__/requestTaskBreakdown-direct.test.ts` - Direct activity test
3. `SUMMARY_INVESTIGATION.md` - This summary

## Next Steps

1. Run the direct activity test to verify if activity hangs
2. Verify worker is running when E2E test executes
3. Check Temporal UI for workflow/activity status
4. Fix any issues found

