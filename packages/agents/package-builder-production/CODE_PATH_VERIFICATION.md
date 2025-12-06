# Code Path Verification: requestTaskBreakdown

## Question
Are we running the same code for `requestTaskBreakdown` in the integration test and the workflow?

## Code Path Analysis

### Integration Test Path
**File**: `src/activities/__tests__/cli-activities-integration.test.ts`

```typescript
import {
  requestTaskBreakdown,
} from '../cli-agent.activities';

// Direct function call
const result = await requestTaskBreakdown({
  planContent: testPlanContent,
  requirementsContent: testRequirementsContent,
  phase: 'scaffold',
  workingDir: testDir,
  provider: 'claude',
});
```

**Execution**: Direct function call to `requestTaskBreakdown` from `cli-agent.activities.ts`

### Workflow Path
**File**: `src/workflows/package-build.workflow.ts`

```typescript
import type * as cliActivities from '../activities/cli-agent.activities';

const { 
  requestTaskBreakdown,
} = proxyActivities<typeof cliActivities>({
  startToCloseTimeout: '30 minutes'
});

// Proxy call (sends task to Temporal, worker executes)
const taskBreakdown = await requestTaskBreakdown({
  planContent: sanitizedFullPlanContent,
  requirementsContent: sanitizedFullRequirementsContent,
  phase: 'scaffold',
  workingDir: packageFullPath,
  provider: provider.name,
  contextContent: baseContextContent,
  completedTaskIds: completedTaskIds.length > 0 ? completedTaskIds : undefined,
});
```

**Execution**: 
1. Workflow calls proxy function
2. Proxy sends activity task to Temporal server
3. Worker picks up task
4. Worker calls actual `requestTaskBreakdown` function

### Worker Registration Path
**File**: `src/worker.ts`

```typescript
import * as activities from './activities/index.js';

const worker = await Worker.create({
  taskQueue,
  workflowsPath: path.join(__dirname, 'workflows'),
  activities,  // <-- Registers all activities
});
```

**File**: `src/activities/index.ts`

```typescript
export * from './cli-agent.activities.js';
```

**Execution**: Worker registers `requestTaskBreakdown` from `cli-agent.activities.ts`

## Answer: YES, Same Code

✅ **Same source file**: Both use `src/activities/cli-agent.activities.ts`
✅ **Same function**: Both call `export async function requestTaskBreakdown(...)`
✅ **Same implementation**: No conditional logic or different code paths

## Key Difference: Execution Context

The **code is the same**, but the **execution context is different**:

### Integration Test Context
- Runs in **test process** (vitest)
- Direct function call (no Temporal proxy)
- Test process environment variables
- Test process working directory
- Test process stdin/stdout/stderr

### Workflow Activity Context
- Runs in **worker process** (Temporal worker)
- Called via Temporal activity execution
- Worker process environment variables
- Worker process working directory
- Worker process stdin/stdout/stderr

## Potential Issues in Worker Context

1. **Environment Variables**
   - Worker might not have `ANTHROPIC_API_KEY`
   - Worker might have different `PATH`
   - Worker might have different `HOME` or working directory

2. **Process Context**
   - Worker process might handle signals differently
   - Worker process stdin/stdout/stderr might be different
   - Child process spawn might behave differently

3. **Working Directory**
   - Worker might be running from different directory
   - Relative paths might not resolve correctly

4. **Process Isolation**
   - Worker might be in a sandboxed environment
   - File system access might be different
   - Network access might be different

## Verification Steps

1. **Check worker environment**:
   ```bash
   # In worker startup, add:
   console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET');
   console.log('Working directory:', process.cwd());
   console.log('PATH:', process.env.PATH);
   ```

2. **Check activity execution**:
   - Look for heartbeat in Temporal UI
   - Check worker logs for step-by-step progress
   - Verify which step it hangs on

3. **Compare environments**:
   - Test process: `console.log(process.env)` in integration test
   - Worker process: `console.log(process.env)` in worker startup
   - Compare differences

## Conclusion

**Same code, different execution context**. The hanging issue is likely due to:
- Missing environment variables in worker
- Different process context affecting child process spawn
- Working directory or path resolution issues
- Process signal handling differences

The heartbeat and detailed logging we added will help identify where it hangs.

