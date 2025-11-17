# Worker Status Indicator - Testing Guide

**Feature**: Real-time worker status indicator in Workflow Builder  
**Date**: 2025-11-17  
**Status**: Implementation Complete

## Overview

The Worker Status Indicator displays the real-time status of Temporal workers for each project in the workflow builder interface. It polls the worker status every 5 seconds and provides visual feedback with color-coded badges.

## Features Implemented

### 1. WorkerStatus Component
- Location: `src/components/workflow/WorkerStatus.tsx`
- Real-time polling every 5 seconds
- Color-coded status badges
- Interactive Start/Stop buttons
- Detailed tooltip with worker information

### 2. API Endpoints
- Location: `src/server/api/routers/projects.ts`
- `projects.workerHealth` - Get worker status for a project
- `projects.startWorker` - Start a worker for a project
- `projects.stopWorker` - Stop a worker for a project

### 3. Integration
- Location: `src/app/workflows/[id]/builder/page.tsx`
- Integrated into workflow builder header
- Displays next to workflow description

## Testing Guide

### Prerequisites

1. **Supabase Running**:
   ```bash
   # Make sure Supabase is running
   supabase status
   # If not running:
   supabase start
   ```

2. **Dev Server Running**:
   ```bash
   cd packages/workflow-builder
   npm run dev
   # Server should be at http://localhost:3010
   ```

3. **Test User Authenticated**:
   - Navigate to http://localhost:3010
   - Sign in with test credentials

### Manual Testing Steps

#### Test 1: Initial Status Display (Stopped)

**Steps**:
1. Navigate to an existing workflow builder page: `/workflows/{id}/builder`
2. Look for the Worker Status indicator in the header

**Expected Result**:
- Status badge shows: "Worker: Stopped" in yellow
- Small yellow circle indicator visible
- Square icon displayed
- Tooltip shows project details when hovering

#### Test 2: Start Worker

**Steps**:
1. Click on the Worker Status component to see the tooltip
2. Click the "Start" button

**Expected Result**:
- Button shows loading state immediately
- Status changes to "Worker: Starting" in blue with spinner
- After ~2-5 seconds, status changes to "Worker: Running" in green
- Green circle indicator and Activity icon displayed
- Last heartbeat time appears (e.g., "2 seconds ago")

**Database Verification**:
```sql
SELECT * FROM workflow_workers 
WHERE project_id = '{your-project-id}'
ORDER BY started_at DESC 
LIMIT 1;
```
- Should see a new worker record with status = 'running'
- `last_heartbeat` should be recent

#### Test 3: Real-time Polling

**Steps**:
1. With worker running, keep the page open
2. Watch the "last heartbeat" time update

**Expected Result**:
- Status polls every 5 seconds
- Last heartbeat time updates automatically
- No page flicker or console errors
- Network tab shows periodic API calls to `projects.workerHealth`

#### Test 4: Stop Worker

**Steps**:
1. With worker running, click the Worker Status component
2. Click the "Stop" button

**Expected Result**:
- Button shows loading state
- Status changes to "Worker: Stopping" in orange with spinner
- After ~1-2 seconds, status changes to "Worker: Stopped" in yellow
- Start button reappears

**Database Verification**:
```sql
SELECT * FROM workflow_workers 
WHERE project_id = '{your-project-id}'
ORDER BY started_at DESC 
LIMIT 1;
```
- Worker status should be 'stopped'
- `stopped_at` timestamp should be set

#### Test 5: Worker Health Check

**Steps**:
1. Start a worker
2. Manually update database to set `last_heartbeat` to 2 minutes ago:
   ```sql
   UPDATE workflow_workers 
   SET last_heartbeat = NOW() - INTERVAL '2 minutes'
   WHERE project_id = '{your-project-id}' 
   AND status = 'running';
   ```
3. Wait for next poll (5 seconds)

**Expected Result**:
- Status changes to "Worker: Unhealthy" in orange
- Alert icon displayed
- Tooltip shows stale heartbeat time
- Stop button still available

#### Test 6: Multiple Workflows in Same Project

**Steps**:
1. Create 2+ workflows in the same project
2. Open workflow builder for each workflow
3. Start worker from one workflow

**Expected Result**:
- All workflow builder pages show same worker status
- Status updates across all pages (may take up to 5 seconds due to polling)
- Only one worker should be running per project

#### Test 7: Error Handling

**Steps**:
1. Stop Temporal server (if running): 
   ```bash
   # Kill Temporal dev server if running
   pkill -f temporal
   ```
2. Try to start worker from UI

**Expected Result**:
- Error displayed in console
- Status shows "Worker: Failed" in red with alert icon
- Error message displayed in UI (if toast/alert system exists)
- Start button should reappear for retry

#### Test 8: Tooltip Information

**Steps**:
1. Hover over Worker Status component with different states

**Expected Result for Running Worker**:
- Tooltip shows:
  - Project name
  - Status: running
  - Worker ID
  - Last heartbeat (time ago)
  - Queue name

**Expected Result for Stopped Worker**:
- Tooltip shows:
  - Project name
  - Status: stopped
  - "No worker information available" message

### Automated Testing

#### Unit Tests (Future)
Create tests for:
- `WorkerStatus` component rendering
- Status color mapping logic
- Polling interval behavior
- Button state handling

#### Integration Tests (Future)
Create tests for:
- API endpoints (workerHealth, startWorker, stopWorker)
- Worker manager integration
- Database operations

#### E2E Tests (Future)
Add to `tests/e2e/worker-status.spec.ts`:
```typescript
test('should display worker status and allow start/stop', async ({ page }) => {
  // Navigate to workflow builder
  // Verify initial stopped status
  // Click start button
  // Wait for running status
  // Click stop button
  // Verify stopped status
});
```

## Performance Considerations

### Polling Frequency
- Current: Every 5 seconds
- Consider: Increase to 10 seconds if performance is an issue
- Implementation: Adjust `refetchInterval` in WorkerStatus.tsx

### Database Load
- Each poll queries `workflow_workers` table
- Indexed on `project_id` and `status`
- Should handle hundreds of concurrent users

### Memory Leaks
- Component properly unmounts and stops polling
- No memory leaks expected
- Verify with browser memory profiler if issues arise

## Known Issues

### Temporal Not Running
- If Temporal server not running, start/stop will fail
- Currently disabled in execution router (`TEMPORAL_ENABLED = false`)
- For full testing, need to:
  1. Start Temporal dev server: `temporal server start-dev`
  2. Re-enable Temporal in `src/server/api/routers/execution.ts`

### Worker Persistence
- Workers are in-memory and will restart when Next.js server restarts
- Production should use separate worker processes
- Consider implementing worker health check on server startup

## Troubleshooting

### Status Always Shows "Stopped"
1. Check if project exists in database
2. Verify `workflow_workers` table has recent entries
3. Check API endpoint returns data (Network tab)
4. Verify authentication working

### Polling Not Working
1. Check browser console for errors
2. Verify tRPC query is enabled
3. Check `refetchInterval` is set correctly
4. Ensure component is mounted

### Start Button Not Working
1. Check console for API errors
2. Verify Temporal packages installed
3. Check worker manager can be imported
4. Verify project permissions

### Heartbeat Not Updating
1. Check worker is actually running
2. Verify heartbeat interval in worker manager (30 seconds)
3. Check database trigger updating `last_heartbeat`
4. Ensure worker hasn't crashed

## Next Steps

After testing passes:
1. ✅ Update phase2-remaining-tasks.md to mark Task 2 complete
2. ✅ Document in completed tasks section
3. Move to next task: Task 1 (Project Management UI) or Task 3 (Temporal E2E Testing)
4. Consider adding automated tests
5. Consider adding toast notifications for start/stop actions

## References

- **Implementation Doc**: `plans/phase2-remaining-tasks.md` - Task 2
- **Component**: `src/components/workflow/WorkerStatus.tsx`
- **API Router**: `src/server/api/routers/projects.ts`
- **Worker Manager**: `src/lib/temporal/worker-manager.ts`
- **Database Schema**: `supabase/migrations/20251117000001_phase2_temporal_integration.sql`

