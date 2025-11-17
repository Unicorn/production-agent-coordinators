# Temporal Setup and Testing Guide

## Overview

This guide explains how to set up and test the Temporal workflow engine integration with the Workflow Builder application.

## Prerequisites

- Temporal CLI installed (`brew install temporal` on macOS)
- Supabase running locally (`supabase start`)
- Node.js and Yarn installed

## Quick Start

### 1. Start Temporal Dev Server

```bash
temporal server start-dev
```

This will start:
- Temporal server on `localhost:7233`
- Temporal UI on `http://localhost:8233`

### 2. Start Workflow Builder Dev Server

```bash
cd packages/workflow-builder
yarn dev
```

The application will be available at `http://localhost:3010`

### 3. Verify Temporal Integration Status

Check that `TEMPORAL_ENABLED` is set to `true` in:
- `src/server/api/routers/execution.ts`

## Environment Variables

Ensure the following variables are set in `.env.local`:

```env
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Architecture

### Components

1. **Temporal Connection** (`src/lib/temporal/connection.ts`)
   - Manages connection to Temporal server
   - Provides client instances
   - Singleton pattern for connection pooling

2. **Worker Manager** (`src/lib/temporal/worker-manager.ts`)
   - Dynamically starts/stops workers per project
   - Loads compiled workflow code from database
   - Manages worker lifecycle and health checks
   - Registers activities at runtime

3. **Statistics Module** (`src/lib/temporal/statistics.ts`)
   - Records workflow execution metrics
   - Tracks activity performance
   - Identifies optimization opportunities

4. **Execution Router** (`src/server/api/routers/execution.ts`)
   - Compiles workflow definitions to TypeScript
   - Stores compiled code in database
   - Starts workers for projects
   - Executes workflows on Temporal
   - Monitors execution status

### Workflow Execution Flow

```
1. User creates workflow in UI
2. User clicks "Build Workflow"
3. Backend compiles workflow definition → TypeScript code
4. Compiled code stored in `workflow_compiled_code` table
5. Worker manager starts project-specific worker
6. Worker loads compiled code from database
7. Worker registers with Temporal on project's task queue
8. Workflow execution starts on Temporal
9. Activities execute in sequence
10. Results stored in `workflow_executions` table
11. Statistics recorded for optimization
```

## Testing Temporal Integration

### Test 1: Temporal Server Health

```bash
# Check if Temporal UI is accessible
curl http://localhost:8233

# Expected: HTML response (Temporal UI homepage)
```

### Test 2: Temporal Client Connection

The connection is tested automatically when the dev server starts. Check logs for:

```
✅ Connected to Temporal at localhost:7233
✅ Temporal client initialized
```

### Test 3: Workflow Compilation

1. Log in to Workflow Builder UI (`http://localhost:3010`)
2. Create a new workflow with 1-2 activities
3. Click "Build Workflow"
4. Check server logs for:

```
🔨 Compiling workflow {name}...
💾 Storing compiled code...
✅ Compiled code stored with ID: {uuid}
```

5. Verify in database:

```sql
SELECT id, workflow_id, version, compiled_at 
FROM workflow_compiled_code 
ORDER BY compiled_at DESC 
LIMIT 5;
```

### Test 4: Worker Registration

After building a workflow, check:

1. **Database:**
```sql
SELECT id, project_id, worker_id, status, last_heartbeat 
FROM workflow_workers 
WHERE status = 'running';
```

2. **Temporal UI:**
   - Navigate to http://localhost:8233
   - Go to "Workers" tab
   - Verify worker is registered with task queue name
   - Check worker is "Healthy"

3. **Server Logs:**
```
🔧 Ensuring worker is running for project...
📦 Loading {n} workflow(s) from database
✅ Worker started for project "{name}"
   Worker ID: worker-{project-id}-{timestamp}
   Task Queue: {queue-name}
   Workflows: {count}
```

### Test 5: Workflow Execution

1. Trigger workflow execution (via "Build Workflow" button)
2. Check server logs:

```
🚀 Starting workflow execution on Temporal...
✅ Workflow started: {workflow-id}
   Run ID: {run-id}
👀 Monitoring workflow execution {execution-id}...
```

3. **Monitor in Temporal UI:**
   - Navigate to http://localhost:8233
   - Go to "Workflows" tab
   - Find your workflow by ID
   - Watch status change from "Running" to "Completed"

4. **Check Database:**
```sql
SELECT id, workflow_id, status, started_at, completed_at, output
FROM workflow_executions
ORDER BY started_at DESC 
LIMIT 5;
```

### Test 6: Activity Execution Statistics

After workflow completes:

```sql
SELECT activity_name, execution_count, success_count, 
       failure_count, avg_duration_ms
FROM activity_statistics
ORDER BY execution_count DESC 
LIMIT 10;
```

### Test 7: Error Handling

Test error scenarios:

1. **Missing Activity:**
   - Create workflow with activity that doesn't exist
   - Build and execute
   - Verify error recorded in `workflow_executions.error_message`

2. **Worker Crash:**
   - Stop worker manually
   - Attempt to execute workflow
   - Verify graceful error handling

## Known Issues

### Webpack Build Issue

**Problem:** Production build fails when trying to bundle @temporalio/worker dependencies (esbuild, webpack).

**Status:** 
- ✅ Dev server works fine with dynamic imports
- ❌ Production build (`yarn build`) fails

**Workaround:** Use dev server for testing Temporal integration

**Error:**
```
./node_modules/esbuild/lib/main.d.ts
Module parse failed: Unexpected token
```

**Root Cause:** Webpack tries to process esbuild and webpack dependencies that are part of @temporalio/worker's bundler, even though they're marked as external.

**Potential Solutions:**
1. Use separate API route outside Next.js for Temporal operations
2. Run worker manager as separate Node.js process
3. Use Webpack NormalModuleReplacementPlugin to completely skip @temporalio/worker during build
4. Move Temporal integration to serverless functions with dynamic imports

## Troubleshooting

### Temporal Server Not Starting

```bash
# Check if port 7233 is already in use
lsof -i :7233

# Kill existing process
kill -9 {PID}

# Restart Temporal
temporal server start-dev
```

### Worker Not Registering

1. Check worker status in database
2. Verify task queue name matches between project and worker
3. Check server logs for errors
4. Ensure Temporal server is running
5. Verify `TEMPORAL_ADDRESS` environment variable

### Workflow Execution Fails

1. Check Temporal UI for error details
2. Review server logs for exceptions
3. Verify compiled code is valid TypeScript
4. Check activity implementations exist
5. Ensure worker is running for the project

### Database Connection Issues

```bash
# Verify Supabase is running
curl http://127.0.0.1:54321/rest/v1/

# Check environment variables
env | grep SUPABASE
```

## Monitoring and Observability

### Temporal UI

Access at `http://localhost:8233` to:
- View all workflow executions
- Monitor worker health
- Inspect workflow history
- Debug failed executions
- View activity execution timeline

### Database Queries

**Recent Executions:**
```sql
SELECT w.display_name, we.status, we.started_at, we.completed_at,
       we.error_message
FROM workflow_executions we
JOIN workflows w ON w.id = we.workflow_id
ORDER BY we.started_at DESC
LIMIT 20;
```

**Worker Health:**
```sql
SELECT p.name as project, ww.worker_id, ww.status, 
       ww.last_heartbeat, ww.total_tasks_completed
FROM workflow_workers ww
JOIN projects p ON p.id = ww.project_id
WHERE ww.status = 'running'
ORDER BY ww.last_heartbeat DESC;
```

**Activity Performance:**
```sql
SELECT activity_name, execution_count, 
       avg_duration_ms, failure_count,
       (failure_count::float / execution_count * 100) as failure_rate
FROM activity_statistics
WHERE execution_count > 0
ORDER BY execution_count DESC
LIMIT 20;
```

## Production Deployment

### Requirements

- Temporal Cloud account or self-hosted Temporal cluster
- Database migrations applied
- Environment variables configured
- Worker processes running on servers

### Configuration

```env
# Production Temporal
TEMPORAL_ADDRESS=your-namespace.tmprl.cloud:7233
TEMPORAL_NAMESPACE=your-namespace
TEMPORAL_TLS_CERT=/path/to/cert.pem
TEMPORAL_TLS_KEY=/path/to/key.pem

# Production Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_production_service_key
```

### Deployment Steps

1. Apply database migrations
2. Build Next.js application (requires webpack fix)
3. Deploy application to hosting platform
4. Start worker manager processes on separate servers
5. Configure monitoring and alerting
6. Test with sample workflows

## References

- [Temporal Documentation](https://docs.temporal.io/)
- [Temporal TypeScript SDK](https://typescript.temporal.io/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)

## Support

For issues or questions:
1. Check Temporal UI for workflow errors
2. Review server logs
3. Check database for execution records
4. Consult this documentation
5. Review `plans/phase2-remaining-tasks.md`

