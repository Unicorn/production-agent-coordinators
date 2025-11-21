# Execution Monitoring Guide

Complete guide to monitoring, understanding, and debugging workflow executions.

## Overview

After deploying a workflow, you'll want to monitor its executions to:
- Verify workflows complete successfully
- Understand execution flow and timing
- Identify and debug errors
- Track performance metrics
- Analyze execution patterns

This guide shows you how to monitor executions without needing to understand Temporal internals.

## Execution Lifecycle

Every workflow execution goes through these states:

```
Pending → Running → Completed/Failed/Canceled
```

**Pending**: Execution created, waiting to start
- Workflow is queued
- Worker will pick it up soon
- Usually very brief (milliseconds)

**Running**: Workflow is executing
- Activities are running
- Real-time progress updates available
- Can take seconds to hours depending on workflow

**Completed**: Workflow finished successfully
- All activities completed
- Final output available
- Execution history preserved

**Failed**: Workflow encountered an error
- Error details available
- Failed activity identified
- Retry information shown

**Canceled**: Execution manually stopped
- User or system canceled
- Partial results may be available
- Clean termination

## Viewing Execution History

### Access Execution History

1. Navigate to **Workflows** in sidebar
2. Click on a workflow to open detail page
3. Click **Execution History** tab
4. You'll see a list of all executions

### Execution List View

The execution list shows:

| Column | Description |
|--------|-------------|
| **Status** | Visual indicator (green=success, red=failed, blue=running) |
| **Execution ID** | Unique identifier for this run |
| **Started At** | When execution began |
| **Duration** | How long it took (or current runtime) |
| **Status Text** | Completed, Failed, Running, etc. |

**Actions:**
- **View Details**: Click on row to see full execution details
- **Retry Failed**: Click retry button for failed executions (coming soon)
- **Cancel Running**: Stop a running execution (coming soon)

### Filtering Executions

Filter executions to find what you need:

**By Status:**
- Click status filter dropdown
- Select: All, Completed, Failed, Running, Canceled
- List updates to show matching executions

**By Date Range:**
- Coming soon: Date range picker
- For now: Sorted by most recent first

**By Workflow:**
- Already filtered to current workflow
- To see all executions across workflows: Go to Project → Executions

### Pagination

Large execution lists are paginated:
- 20 executions per page (default)
- Navigation: Previous / Next buttons
- Jump to page: Page number input
- Showing: "1-20 of 150 executions"

## Execution Detail View

Click on an execution to see comprehensive details.

### Overview Section

Top section shows high-level information:

**Execution Metadata:**
- **Execution ID**: Full Temporal execution ID
- **Workflow Name**: Which workflow ran
- **Status**: Current state with icon
- **Started At**: Timestamp when started
- **Completed At**: Timestamp when finished (if complete)
- **Duration**: Total execution time

**Quick Actions:**
- **View in Temporal**: Open in Temporal Web UI
- **Retry**: Rerun with same inputs (failed executions)
- **Download Details**: Export execution data as JSON

### Component Executions

The heart of execution monitoring - see each component that ran:

**Component List:**
Each component execution shows:
- **Component Name**: Activity or node name
- **Status Icon**: ✓ (success), ✗ (failed), ⟳ (running), ⏸ (pending)
- **Duration**: How long this component took
- **Retry Count**: Number of retry attempts
- **Retry Status**: Expected/Unexpected (based on retry policy)

**Expandable Details:**
Click on a component to expand and see:

1. **Input Data:**
   ```json
   {
     "userId": "user-12345",
     "action": "fetch"
   }
   ```
   - Data passed into this component
   - Formatted JSON for readability
   - Copy button to copy JSON

2. **Output Data:**
   ```json
   {
     "status": "success",
     "user": {
       "id": "user-12345",
       "name": "John Doe",
       "email": "john@example.com"
     }
   }
   ```
   - Data returned from this component
   - Formatted JSON
   - Shows component's result

3. **Error Information** (if failed):
   ```json
   {
     "error": "Network timeout",
     "type": "TIMEOUT_ERROR",
     "message": "Request to api.example.com timed out after 30s",
     "stackTrace": "..."
   }
   ```
   - Error type and message
   - Stack trace for debugging
   - Retry information

4. **Timing Information:**
   - **Start Time**: When component started
   - **End Time**: When component finished
   - **Duration**: Total time (ms, s, m)
   - **Scheduled Time**: When queued (for worker latency)

5. **Retry Information:**
   - **Retry Count**: How many times retried
   - **Expected**: Was retry expected based on policy?
   - **Retry Policy**: What policy was configured
   - **Last Retry At**: When last retry occurred

### Understanding Retry Status

Each component shows whether retries were expected:

**Expected Retry** (Blue icon):
- Component has retry policy configured
- Retry is normal behavior
- Example: API call with exponential backoff
- Not an error condition

**Unexpected Retry** (Orange icon):
- Component failed but had no retry policy
- Or exhausted all retry attempts
- Indicates a problem that needs attention
- Review error details

**No Retries** (Gray):
- Component succeeded on first attempt
- Or retry policy set to "No Retries"
- Normal successful execution

### Execution Timeline

Visual timeline of execution (coming soon):
- See components as horizontal bars
- Length represents duration
- Color indicates status
- Overlapping bars show parallel execution
- Gaps show waiting/idle time

### Execution Logs

Detailed logs for advanced debugging (coming soon):
- All Temporal events
- Worker logs
- Activity heartbeats
- Signal events
- Timer events

## Execution Statistics

View aggregated statistics to understand workflow behavior.

### Workflow Statistics

See statistics for a specific workflow:

1. Go to Workflow detail page
2. Click **Statistics** tab

**Available Metrics:**
- **Total Runs**: Number of executions
- **Success Rate**: Percentage successful
- **Average Duration**: Mean execution time
- **Error Count**: Total failures
- **Most Used Component**: Which activity runs most
- **Recent Executions**: Last 10 runs

**Visual Charts:**
- Success vs Failure pie chart
- Duration over time line chart
- Most common errors bar chart

### Project Statistics

See statistics across all workflows in a project:

1. Go to Project detail page
2. Click **Statistics** tab

**Available Metrics:**
- **Total Workflows**: Count of workflows
- **Total Executions**: All runs across workflows
- **Average Duration**: Mean across all workflows
- **Total Errors**: Failures across all workflows
- **Most Used Workflow**: Which workflow runs most
- **Most Used Component**: Most common activity
- **Longest Run**: Slowest execution details

**Use Cases:**
- Identify performance bottlenecks
- Find most critical workflows
- Track system health
- Plan capacity and scaling

## Real-Time Monitoring

### Monitoring Running Executions

For executions currently running:

1. Go to Execution Detail page
2. Page auto-refreshes every 5 seconds (while running)
3. Watch components complete in real-time
4. See current component highlighted
5. Progress indicator shows completion percentage

**Manual Refresh:**
- Click refresh button to update immediately
- Auto-refresh pauses if you scroll or interact

### Monitoring Multiple Executions

To watch multiple executions at once:

1. Keep Execution History tab open
2. Enable auto-refresh (toggle in top-right)
3. List updates every 10 seconds
4. New executions appear at top
5. Status indicators update live

**Use Case:**
- Monitoring a batch of workflow runs
- Watching scheduled workflows execute
- Debugging concurrent executions

## Debugging Failed Executions

When an execution fails, use these steps to debug:

### Step 1: Identify the Failed Component

1. Open the failed execution detail
2. Look for component with red ✗ icon
3. This is where execution failed
4. Click to expand component details

### Step 2: Read the Error Message

1. In component details, find **Error** section
2. Read the error message carefully
3. Note the error type (TIMEOUT, NETWORK, etc.)
4. Check if retry count is shown

**Common Error Types:**
- `TIMEOUT_ERROR`: Operation exceeded timeout
- `NETWORK_ERROR`: Network connectivity issue
- `VALIDATION_ERROR`: Invalid input data
- `ACTIVITY_FAILURE`: Activity code threw error

### Step 3: Check Input Data

1. Look at the **Input** section for failed component
2. Verify input data looks correct
3. Check for:
   - Missing required fields
   - Invalid data formats
   - Unexpected values

### Step 4: Review Component Configuration

1. Go back to workflow editor
2. Click on the failed component node
3. Check configuration in Property Panel:
   - Is timeout too short?
   - Is retry policy appropriate?
   - Is component correctly selected?

### Step 5: Check Previous Components

Sometimes the issue is in earlier components:

1. Expand components that ran before failure
2. Check their outputs
3. Look for data quality issues
4. Verify the data flow is correct

### Step 6: Test Component Individually

If you suspect the component itself has issues:

1. Go to **Components** page
2. Find the failing component
3. Click **Test Component** button
4. Provide test input and run
5. See if component works in isolation

### Step 7: Fix and Retry

Once you've identified the issue:

1. **If workflow design issue:**
   - Edit the workflow
   - Fix configuration or logic
   - Redeploy the workflow
   - Run a new execution

2. **If transient failure:**
   - Click **Retry** on failed execution
   - Same execution retries with same input
   - Check if it succeeds this time

3. **If data issue:**
   - Run new execution with corrected input
   - Monitor to verify success

## Understanding Execution Performance

### Analyzing Duration

Long execution times? Analyze where time is spent:

1. Open execution detail
2. Look at component durations
3. Identify slowest components:
   - Longest duration highlighted
   - Percentage of total time shown
4. Optimize slow components:
   - Reduce timeout if too high
   - Optimize activity code
   - Use parallel execution (coming soon)

### Identifying Bottlenecks

Common bottlenecks:
- **Long API calls**: Increase timeout or optimize endpoint
- **Large data processing**: Break into smaller chunks
- **Sequential execution**: Consider parallel execution
- **Excessive retries**: Fix root cause of failures

**Performance Best Practices:**
- Keep activity duration under 5 minutes
- Use appropriate timeout values
- Configure retry policies wisely
- Monitor execution trends over time

## Common Execution Patterns

### Successful Execution

What a healthy execution looks like:
- All components show green ✓
- Duration within expected range
- Zero retries (or expected retries only)
- Clean input/output data flow
- No error messages

### Execution with Expected Retries

Normal for workflows with retry policies:
- Some components show retry count > 0
- Retry status: "Expected"
- Eventually completes successfully
- Total duration includes retry delays

**Example:**
```
Component: Call External API
Status: ✓ Completed
Duration: 45s
Retries: 2 (Expected)
Retry Policy: Exponential Backoff
```

This is normal - API was rate-limited, retried, succeeded.

### Failed Execution

Needs attention:
- One or more components with red ✗
- Error message present
- Execution status: Failed
- May have exhausted retries

**Action Required:**
- Review error details
- Fix the issue
- Retry or run new execution

### Canceled Execution

Manually stopped:
- Status: Canceled
- Some components may have completed
- Current component was interrupted
- No error (intentional cancellation)

## Best Practices

### Regular Monitoring

1. **Check Daily**: Review recent executions
2. **Watch for Patterns**: Look for recurring errors
3. **Track Success Rates**: Ensure >95% success
4. **Monitor Duration**: Watch for performance degradation
5. **Review Errors**: Investigate and fix issues promptly

### Setting Up Alerts

Currently manual monitoring. Coming soon:
- Email alerts on failures
- Slack notifications
- Threshold-based alerts (success rate <90%)
- Anomaly detection

**Current Workaround:**
- Check execution history daily
- Review statistics weekly
- Set calendar reminders
- Manual reporting

### Execution Data Retention

Execution history is retained:
- **Detailed Execution Data**: 90 days (default)
- **Statistics**: Indefinitely
- **Logs**: 30 days

**Best Practice:**
- Export important execution data
- Archive long-term for compliance
- Review retention policies for your needs

### Privacy and Security

Execution data contains sensitive information:
- Only visible to project owner
- Row-level security enforced
- Inputs/outputs may contain secrets
- Be careful when sharing execution details

**Security Tips:**
- Don't include secrets in workflow inputs
- Use environment variables for credentials
- Sanitize logs before sharing
- Review data access controls

## Troubleshooting Monitoring Issues

### Execution History Not Showing

**Symptoms:**
- Execution list is empty
- But you know executions ran

**Solutions:**
1. Check you're viewing correct workflow
2. Try refreshing the page
3. Check execution status filter (might be filtered)
4. Look at Project-level executions (might be in different workflow)

### Execution Details Not Loading

**Symptoms:**
- Click execution, nothing happens
- Or details section is empty

**Solutions:**
1. Wait a few seconds (might be syncing)
2. Refresh the page
3. Check browser console for errors
4. Try different browser
5. Check if execution is very recent (sync delay)

### Component Details Missing

**Symptoms:**
- Execution detail shows but no component data
- Components list is empty

**Possible Causes:**
1. **Sync Not Complete**: Wait 30 seconds and refresh
2. **Old Execution**: Executed before monitoring system added
3. **Sync Failed**: Check system logs

**Solutions:**
1. Click **Sync Now** button (if available)
2. Wait and refresh
3. Check Temporal Web UI for raw data

### Statistics Not Updating

**Symptoms:**
- Statistics show old data
- Recent executions not reflected

**Cause:**
- Statistics calculated periodically (every 5 minutes)

**Solution:**
- Wait a few minutes
- Refresh the page
- Statistics will update on next calculation cycle

## Advanced Monitoring

### Temporal Web UI

For advanced users, use Temporal's Web UI:

1. Open http://localhost:8233
2. Find your namespace (usually `default`)
3. Search for workflow execution by ID
4. View complete Temporal event history
5. See raw workflow data

**When to use:**
- Deep debugging of complex issues
- Understanding Temporal internals
- Investigating worker issues
- Advanced performance analysis

### Execution Data Export

Export execution data for analysis:

1. Open execution detail
2. Click **Download** button
3. JSON file downloads with complete execution data
4. Use for:
   - Offline analysis
   - Sharing with team
   - Importing to analytics tools
   - Long-term archival

**Export Format:**
```json
{
  "executionId": "wf-123-abc",
  "workflowId": "my-workflow",
  "status": "completed",
  "startedAt": "2025-11-19T10:00:00Z",
  "completedAt": "2025-11-19T10:05:30Z",
  "duration": 330000,
  "componentExecutions": [...],
  "input": {...},
  "output": {...}
}
```

### API Access

For programmatic access (coming soon):
- REST API for execution history
- GraphQL API for statistics
- WebSocket for real-time updates
- Webhook notifications

## Related Resources

- **[Deployment Guide](deployment.md)** - Deploy workflows for execution
- **[Troubleshooting](troubleshooting.md)** - Common execution issues
- **[Temporal Integration](../architecture/temporal-integration.md)** - Technical details
- **[Execution Monitoring Architecture](../execution-monitoring.md)** - System design

## Quick Reference

### Execution Status Icons

| Icon | Status | Meaning |
|------|--------|---------|
| ✓ Green | Completed | Success |
| ✗ Red | Failed | Error occurred |
| ⟳ Blue | Running | Currently executing |
| ⏸ Gray | Pending | Waiting to start |
| ⊘ Orange | Canceled | Manually stopped |

### Component Retry Icons

| Icon | Status | Meaning |
|------|--------|---------|
| Blue | Expected Retry | Normal retry per policy |
| Orange | Unexpected Retry | Retry exhausted or no policy |
| Gray | No Retry | Succeeded first try |

### Common Tasks

| Task | Steps |
|------|-------|
| View executions | Workflow → Execution History |
| View execution details | Execution History → Click execution |
| Retry failed execution | Execution Detail → Retry |
| View statistics | Workflow → Statistics |
| Export execution | Execution Detail → Download |
| View in Temporal | Execution Detail → View in Temporal |

## Need Help?

- See [Troubleshooting Guide](troubleshooting.md)
- Check [Common Errors](../troubleshooting/common-errors.md)
- Review [Execution Monitoring Docs](../execution-monitoring.md)
- Contact support with execution ID

Happy monitoring!
