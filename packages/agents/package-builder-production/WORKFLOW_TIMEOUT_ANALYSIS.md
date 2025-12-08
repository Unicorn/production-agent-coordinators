# Workflow Task Timeout Analysis

## Sequence of Events Leading to Failure

### Timeline
1. **Event 248**: `requestTaskBreakdown` scheduled (scaffold phase, 6 tasks already completed)
2. **Event 250**: Task breakdown completed successfully
   - Returned **7 new tasks**
   - `more_tasks: true` (indicating more work needed)
   - This was the **second iteration** of the scaffold phase
3. **Events 254, 260, 266**: Multiple `executeAgentActivityRequest` calls completed
   - `read_file` (2x)
   - `list_dir` (1x)
   - All completed successfully
4. **Event 269**: New workflow task scheduled
5. **Event 270**: Workflow task started
6. **Event 271**: **WorkflowTaskTimedOut** (StartToClose timeout after 10 seconds)
7. **Event 272**: Workflow task scheduled for replay
8. **Event 273**: Workflow task started (replay)
9. **Event 274**: **WorkflowTaskFailed** - Nondeterminism error

## Root Cause: Workflow Task Timeout

The workflow task timed out after **10 seconds** (the default Temporal workflow task timeout). This happened because:

### What the Workflow Was Doing

After `requestTaskBreakdown` returned 7 tasks, the workflow needed to:
1. Process the task breakdown result (7 tasks)
2. Filter activity requests for each task (checking for test/lint/build commands)
3. Process activity requests from the breakdown
4. Set up task execution loops for 7 tasks
5. Build context strings and prepare for task execution

### Why It Timed Out

The workflow task timeout (10 seconds) is too short for the amount of synchronous processing happening:
- **String manipulation**: Building context strings, sanitizing package names
- **Array filtering**: Filtering activity requests for each of 7 tasks
- **Object processing**: Processing task breakdown results, building maps/caches
- **Conditional logic**: Checking dependencies, filtering commands, etc.

With 7 tasks and multiple activity requests per task, the synchronous processing exceeded 10 seconds.

## The Nondeterminism Error

After the timeout, Temporal tried to replay the workflow:
- **Original run**: Code had `readPackageJsonProgrammatically` **outside** the conditional block
- **Replay**: Code had been updated, `readPackageJsonProgrammatically` was now **inside** the conditional block
- **Result**: Activity order changed, causing nondeterminism error

## Cost Impact

- **Total cost**: >$7.00
- **Activities executed**: 52 activity calls before failure
- **Work completed**: Scaffold phase partially completed (6 tasks done, 7 more tasks queued)

## Solutions

### 1. Increase Workflow Task Timeout (Immediate Fix)

The workflow task timeout should be increased to handle complex processing:

```typescript
// In workflow definition or client options
workflowTaskTimeout: '60s' // or longer for complex workflows
```

### 2. Reduce Synchronous Processing (Long-term Fix)

- **Break up large loops**: Process tasks in smaller batches
- **Use activities for heavy processing**: Move string manipulation to activities if needed
- **Optimize filtering**: Cache filtered results instead of re-filtering
- **Limit task batch size**: Request fewer tasks per breakdown (e.g., max 3-5 tasks)

### 3. Fix Nondeterminism (Already Fixed)

- ✅ Moved programmatic context gathering inside conditional blocks
- ✅ Ensures deterministic activity ordering

## Recommendations

1. **Increase workflow task timeout** to 60 seconds or more
2. **Monitor workflow task duration** to identify bottlenecks
3. **Consider batching**: Request fewer tasks per breakdown to reduce processing time
4. **Add workflow task heartbeat**: If possible, to prevent timeouts during long processing

## Prevention

- **Test with realistic task counts**: Ensure workflow can handle 7+ tasks without timeout
- **Monitor workflow task metrics**: Track average task duration
- **Set appropriate timeouts**: Match timeout to expected processing time
- **Avoid heavy synchronous processing**: Move to activities when possible

