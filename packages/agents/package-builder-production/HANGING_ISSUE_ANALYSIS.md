# requestTaskBreakdown Hanging Issue - Analysis

## Key Findings

### Direct Call Performance
- **Integration test**: `requestTaskBreakdown` completes in **~38 seconds** when called directly
- **Direct test**: Completes in **~33 seconds** when called directly
- **CLI spawn**: Works correctly, no hanging

### Workflow Activity Performance  
- **Workflow activity**: Hangs for **minutes** without completing
- **Timeout set**: 30 minutes (`startToCloseTimeout: '30 minutes'`)
- **Worker running**: Yes, worker is running on `engine-cli-e2e` queue

## Root Cause Hypothesis

The activity works fine when called directly but hangs when executed as a Temporal activity. This suggests a **Temporal activity execution context issue**.

### Possible Causes

1. **Process Context Difference**
   - Temporal activities run in worker process context
   - Worker might have different stdin/stdout/stderr handling
   - Child process spawn might behave differently in worker context

2. **Environment Variable Issues**
   - Worker process might not have all required env vars
   - CLI might need specific env vars that aren't available in worker

3. **Stdio Pipe Handling**
   - Worker process might be buffering stdout/stderr differently
   - Backpressure from pipes might cause deadlock in worker context
   - stdin.end() might not work correctly in worker process

4. **Signal Handling**
   - Worker process might handle signals differently
   - Child process might be waiting for signals that never come

5. **Working Directory Issues**
   - Worker might be running from different directory
   - Relative paths might not resolve correctly

## Evidence

### What Works
- ✅ Direct function call: ~38 seconds
- ✅ CLI spawn in test: Works correctly
- ✅ stdin.end() in direct call: Works
- ✅ stdio pipes in direct call: Work correctly

### What Doesn't Work
- ❌ Activity execution in workflow: Hangs
- ❌ Worker process context: Different behavior

## Recommended Fixes

### 1. Add Activity Heartbeat
Add heartbeat to `requestTaskBreakdown` to verify it's actually executing:

```typescript
export async function requestTaskBreakdown(params: {...}): Promise<TaskBreakdown> {
  const activity = Activity.current();
  
  // Send heartbeat every 10 seconds
  const heartbeatInterval = setInterval(() => {
    activity.heartbeat('requestTaskBreakdown in progress');
  }, 10000);
  
  try {
    // ... existing code ...
  } finally {
    clearInterval(heartbeatInterval);
  }
}
```

### 2. Add Detailed Logging
Add logging at each step to see where it hangs:

```typescript
console.log('[requestTaskBreakdown] Step 1: Building prompt');
// ... build prompt ...
console.log('[requestTaskBreakdown] Step 2: Calling executeClaudeCLI');
const result = await executeClaudeCLI({...});
console.log('[requestTaskBreakdown] Step 3: Parsing result');
// ... parse result ...
```

### 3. Check Worker Environment
Verify worker has all required environment variables:

```typescript
// In worker startup
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET');
console.log('Working directory:', process.cwd());
```

### 4. Test Activity in Isolation
Create a test that runs the activity through Temporal's test environment:

```typescript
import { TestWorkflowEnvironment } from '@temporalio/testing';

const testEnv = await TestWorkflowEnvironment.createLocal();
const worker = await testEnv.worker.create({
  taskQueue: 'test',
  activities: { requestTaskBreakdown },
});
```

### 5. Check for Blocking Operations
Ensure no blocking operations in activity:

- ✅ `proc.stdin.end()` - Non-blocking
- ✅ `proc.stdout.on('data')` - Event-based, non-blocking
- ✅ `proc.on('close')` - Event-based, non-blocking
- ⚠️ Check if Promise resolution is blocking

## Immediate Action Items

1. **Add heartbeat** to verify activity is executing
2. **Add step-by-step logging** to identify hang point
3. **Check worker logs** for any errors or warnings
4. **Verify environment variables** in worker process
5. **Test with TestWorkflowEnvironment** to isolate issue

## Next Steps

1. Run workflow with heartbeat enabled
2. Check Temporal UI for activity heartbeat status
3. Review worker logs for detailed execution steps
4. Compare worker environment with test environment
5. Test activity in TestWorkflowEnvironment

