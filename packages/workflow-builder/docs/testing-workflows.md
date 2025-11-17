# Testing Workflows Guide

## Overview

This guide provides step-by-step instructions for testing workflow execution with Temporal integration.

## Prerequisites

- Temporal dev server running (`temporal server start-dev`)
- Supabase running locally
- Workflow Builder dev server running (`yarn dev`)
- User account created and logged in

## Test Scenarios

### Scenario 1: Simple Sequential Workflow

**Description:** Test basic workflow execution with sequential activities.

**Workflow Configuration:**
```yaml
Name: User Onboarding
Project: Test Project
Activities:
  1. Send Welcome Email
  2. Create User Profile
  3. Assign Default Permissions
```

**Steps:**

1. **Create Project**
   - Navigate to `/projects/new`
   - Enter project name: "Test Project"
   - Click "Create Project"
   - Note the task queue name generated

2. **Create Workflow**
   - Navigate to `/workflows/new`
   - Select "Test Project"
   - Enter workflow name: "User Onboarding"
   - Add workflow nodes:
     - Node 1: Activity "Send Welcome Email"
     - Node 2: Activity "Create User Profile"
     - Node 3: Activity "Assign Default Permissions"
   - Connect nodes sequentially
   - Save workflow

3. **Build and Execute**
   - Open workflow in builder
   - Click "Build Workflow" button
   - Monitor execution in UI

4. **Verify Results**
   - Check Temporal UI (http://localhost:8233)
   - Verify workflow appears in "Workflows" tab
   - Check status is "Completed"
   - Review activity execution timeline

5. **Database Verification**
   ```sql
   -- Check execution record
   SELECT * FROM workflow_executions 
   WHERE workflow_id = '{your-workflow-id}'
   ORDER BY started_at DESC LIMIT 1;
   
   -- Check compiled code
   SELECT * FROM workflow_compiled_code
   WHERE workflow_id = '{your-workflow-id}'
   AND is_active = true;
   
   -- Check worker registration
   SELECT * FROM workflow_workers
   WHERE project_id = '{your-project-id}'
   AND status = 'running';
   ```

**Expected Results:**
- ✅ Workflow compiles without errors
- ✅ Worker starts for project
- ✅ All activities execute successfully
- ✅ Execution status = "completed"
- ✅ No errors logged

### Scenario 2: Workflow with Signals

**Description:** Test workflow that waits for external signal before proceeding.

**Workflow Configuration:**
```yaml
Name: Approval Process
Project: Test Project
Activities:
  1. Submit for Approval
  2. Wait for Approval (signal)
  3. Notify Approval Decision
```

**Steps:**

1. **Create Workflow with Signal**
   - Create workflow "Approval Process"
   - Add signal handler: `approvalReceived`
   - Configure activity to wait for signal

2. **Start Execution**
   - Build and execute workflow
   - Workflow should pause at "Wait for Approval"

3. **Send Signal via Temporal CLI**
   ```bash
   temporal workflow signal \
     --workflow-id {workflow-id} \
     --name approvalReceived \
     --input '{"approved": true, "comments": "Looks good"}'
   ```

4. **Verify Continuation**
   - Workflow should resume after receiving signal
   - Final activity should execute
   - Status should be "completed"

**Expected Results:**
- ✅ Workflow pauses at signal wait
- ✅ Signal received successfully
- ✅ Workflow resumes after signal
- ✅ Final activities execute

### Scenario 3: Workflow with Query

**Description:** Test querying workflow state while it's running.

**Workflow Configuration:**
```yaml
Name: Data Processing
Project: Test Project
Query: getProcessingStatus
Activities:
  1. Fetch Data
  2. Process Data (long-running)
  3. Save Results
```

**Steps:**

1. **Create Workflow with Query**
   - Create workflow "Data Processing"
   - Add query handler: `getProcessingStatus`
   - Configure long-running activity

2. **Start Execution**
   - Build and execute workflow
   - While processing, query status

3. **Query Workflow State**
   ```bash
   temporal workflow query \
     --workflow-id {workflow-id} \
     --name getProcessingStatus
   ```

4. **Verify Response**
   - Query should return current processing status
   - Status should update as workflow progresses

**Expected Results:**
- ✅ Query responds while workflow running
- ✅ Status reflects current progress
- ✅ Workflow completes successfully

### Scenario 4: Error Handling

**Description:** Test workflow error handling and recovery.

**Test Cases:**

#### A. Missing Activity

1. Create workflow with non-existent activity
2. Build and execute
3. Verify error captured:
   ```sql
   SELECT error_message FROM workflow_executions
   WHERE id = '{execution-id}';
   ```
4. Expected: Descriptive error message about missing activity

#### B. Activity Failure

1. Create workflow with activity that throws error
2. Build and execute
3. Check Temporal UI for error details
4. Verify retry attempts (if configured)

#### C. Timeout

1. Create workflow with timeout configured
2. Add long-running activity
3. Verify workflow times out appropriately
4. Check error message indicates timeout

**Expected Results:**
- ✅ Errors captured in database
- ✅ Descriptive error messages
- ✅ No system crashes
- ✅ Worker remains healthy after errors

### Scenario 5: Worker Health and Recovery

**Description:** Test worker resilience and recovery.

**Steps:**

1. **Start Worker**
   - Build workflow to start worker
   - Verify worker status = "running"
   - Check heartbeat updates

2. **Monitor Worker Health**
   ```sql
   SELECT worker_id, status, last_heartbeat,
          EXTRACT(EPOCH FROM (NOW() - last_heartbeat)) as seconds_since_heartbeat
   FROM workflow_workers
   WHERE project_id = '{your-project-id}';
   ```

3. **Test Worker Recovery**
   - Stop Next.js dev server
   - Wait 60 seconds
   - Restart dev server
   - Verify new worker starts
   - Check old worker marked as "stopped"

**Expected Results:**
- ✅ Heartbeat updates every 30 seconds
- ✅ Worker status accurate
- ✅ Graceful recovery after restart

### Scenario 6: Multiple Concurrent Workflows

**Description:** Test multiple workflows executing simultaneously.

**Steps:**

1. **Create Multiple Workflows**
   - Create 3 different workflows in same project
   - Each with 3-5 activities

2. **Execute Concurrently**
   - Build and execute all 3 workflows
   - All should share same project worker

3. **Monitor Execution**
   - Check Temporal UI shows all 3 workflows
   - Verify they execute concurrently
   - Check no conflicts or errors

4. **Verify Results**
   ```sql
   SELECT workflow_id, status, started_at, completed_at
   FROM workflow_executions
   WHERE project_id = '{your-project-id}'
   AND started_at > NOW() - INTERVAL '10 minutes'
   ORDER BY started_at DESC;
   ```

**Expected Results:**
- ✅ All workflows execute successfully
- ✅ No resource conflicts
- ✅ Execution times reasonable
- ✅ Statistics recorded for each

## Performance Testing

### Load Test

Test workflow system under load:

1. Create simple workflow (3 activities)
2. Execute 10 times rapidly
3. Monitor:
   - Workflow completion times
   - Worker resource usage
   - Database performance
   - Error rates

**Metrics to Track:**
- Average execution time
- P95 execution time
- Success rate
- Worker CPU/memory usage

### Stress Test

Push system limits:

1. Create complex workflow (20+ activities)
2. Execute multiple times
3. Monitor for:
   - Memory leaks
   - Connection pool exhaustion
   - Timeout errors
   - Worker crashes

## Debugging Workflows

### Using Temporal UI

1. **Find Workflow:**
   - Navigate to http://localhost:8233
   - Go to "Workflows" tab
   - Search by workflow ID or name

2. **Inspect Execution:**
   - Click on workflow
   - View "History" tab for complete event timeline
   - Check "Summary" for overview
   - Review "Workers" to see which worker handled it

3. **Debug Failures:**
   - Look for "Failed" status
   - Check activity error messages
   - Review retry attempts
   - Inspect input/output values

### Using Server Logs

Monitor Next.js dev server logs for:

```
🔨 Compiling workflow...
💾 Storing compiled code...
🔧 Ensuring worker is running...
🚀 Starting workflow execution...
👀 Monitoring workflow execution...
✅ Workflow completed in {time}ms
❌ Workflow execution failed: {error}
```

### Database Queries

**Recent Failures:**
```sql
SELECT w.display_name, we.error_message, we.started_at
FROM workflow_executions we
JOIN workflows w ON w.id = we.workflow_id
WHERE we.status = 'failed'
ORDER BY we.started_at DESC
LIMIT 10;
```

**Slow Workflows:**
```sql
SELECT w.display_name, we.duration_ms, we.started_at
FROM workflow_executions we
JOIN workflows w ON w.id = we.workflow_id
WHERE we.status = 'completed'
  AND we.duration_ms > 5000
ORDER BY we.duration_ms DESC
LIMIT 10;
```

**Activity Performance:**
```sql
SELECT activity_name, execution_count, avg_duration_ms,
       failure_count, 
       (failure_count::float / execution_count * 100) as failure_rate_pct
FROM activity_statistics
ORDER BY avg_duration_ms DESC
LIMIT 20;
```

## Test Checklist

Before marking Temporal integration as complete:

- [ ] Temporal server starts successfully
- [ ] Next.js dev server starts without webpack errors
- [ ] Simple workflow compiles successfully
- [ ] Worker registers with Temporal
- [ ] Workflow executes end-to-end
- [ ] Activities run in correct order
- [ ] Execution results saved to database
- [ ] Statistics recorded accurately
- [ ] Temporal UI shows workflow execution
- [ ] Worker heartbeat updates regularly
- [ ] Error handling works correctly
- [ ] Multiple workflows can execute concurrently
- [ ] Worker recovers after restart
- [ ] Signals work correctly
- [ ] Queries work correctly
- [ ] Documentation complete

## Common Issues

### Workflow Doesn't Start

**Symptoms:** Build succeeds but no execution in Temporal UI

**Causes:**
- Worker not started
- Task queue mismatch
- Temporal connection failed
- Worker crashed

**Solutions:**
1. Check worker status in database
2. Verify task queue names match
3. Check Temporal server is running
4. Review server logs for errors

### Activities Don't Execute

**Symptoms:** Workflow shows in Temporal but activities never run

**Causes:**
- Activities not registered with worker
- Activity implementation missing
- Compilation error in activities code

**Solutions:**
1. Check activities_code in workflow_compiled_code
2. Verify activity functions exported
3. Review worker startup logs
4. Check for compilation errors

### Worker Stops Unexpectedly

**Symptoms:** Worker status changes to "stopped" or "failed"

**Causes:**
- Worker crash
- Server restart
- Memory exhaustion
- Code error in workflow/activity

**Solutions:**
1. Check worker metadata for error details
2. Review server logs before failure
3. Monitor resource usage
4. Fix code errors in workflow implementation

## Next Steps

After completing basic testing:

1. Test with real-world workflows
2. Implement production error monitoring
3. Set up alerting for failed executions
4. Optimize slow activities
5. Configure retry policies
6. Set up production Temporal cluster
7. Deploy worker processes separately

## References

- [Temporal Testing Documentation](https://docs.temporal.io/docs/typescript/testing)
- [Workflow Builder Documentation](./temporal-setup.md)
- [Phase 2 Tasks](../plans/phase2-remaining-tasks.md)

