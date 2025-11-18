# Workflow Execution Monitoring

## Overview

The workflow execution monitoring system provides comprehensive visibility into workflow runs without requiring users to understand Temporal internals. Users can see component-level execution details, inputs/outputs, errors, retries, and aggregated statistics directly from the workflow builder UI.

## Features

### Execution History

View a paginated list of all workflow executions with:
- Execution status (completed, failed, running, pending)
- Start time and duration
- Quick navigation to detailed execution views

**Location**: Workflow Detail Page → Execution History tab

### Execution Details

Drill down into individual execution runs to see:
- **Component Executions**: Each component/node that ran during the execution
  - Component name and node ID
  - Execution status and timing
  - Input data passed to the component
  - Output data returned from the component
  - Error messages and types (if any)
  - Retry count and whether retries were expected
- **Execution Metadata**: Overall execution status, timing, and errors

**Location**: Workflow Detail Page → Execution History tab → Click on an execution

### Workflow Statistics

View aggregated statistics for a specific workflow:
- Total number of runs
- Average execution duration
- Success rate
- Error count
- Most used component
- Recent executions list

**Location**: Workflow Detail Page → Statistics tab

### Project Statistics

View aggregated statistics across all workflows in a project:
- Total workflows and executions
- Average duration
- Total errors
- Most used task queue
- Most used workflow
- Most used component
- Longest run details

**Location**: Project Detail Page → Statistics tab

## How It Works

### Background Synchronization

The system uses a cache-aside pattern to store execution history:

1. **Database as Cache**: Execution history is stored in the database for fast UI access
2. **On-Demand Sync**: When viewing execution details, if data is missing or stale, a sync is triggered
3. **Background Sync**: A system workflow (`sync-coordinator`) manages syncing execution history from Temporal to the database
4. **Immediate Sync**: For active viewing, the system can perform an immediate (blocking) sync to get data quickly

### Sync Coordinator Workflow

The `sync-coordinator` workflow is a system workflow that:
- Manages a queue of executions to sync
- Spawns child sync workflows for each execution
- Handles retries and error recovery
- Runs on the `system-workflows-queue` task queue

### Data Storage

Execution data is stored in several tables:

- **`workflow_executions`**: High-level execution records with full Temporal history JSON
- **`component_executions`**: Extracted component-level execution details (UI-friendly)
- **`workflow_statistics`**: Aggregated statistics per workflow
- **`project_statistics`**: Aggregated statistics per project

All tables have Row Level Security (RLS) policies to ensure users only see their own data.

## Expected vs Unexpected Retries

The system distinguishes between expected and unexpected retries based on the retry policy configured for each node:

- **Expected Retry**: Component has a retry policy configured (e.g., "keep trying until success", "exponential backoff"), so retries are part of normal operation
- **Unexpected Retry**: Component failed but had no retry policy or exhausted its retry attempts

This helps users understand whether failures are expected behavior or actual errors.

## Retry Policies

Components can be configured with retry policies:

1. **Keep Trying**: Retry indefinitely until success
2. **Fail After X Attempts**: Retry up to N times, then fail
3. **Exponential Backoff**: Retry with increasing delays between attempts
4. **No Retries**: Fail immediately on first error

Retry policies are configured in the Node Property Panel when editing activity nodes.

## Usage

### Viewing Execution History

1. Navigate to a workflow detail page
2. Click the "Execution History" tab
3. Browse the list of executions
4. Click on an execution to see detailed component execution data

### Viewing Statistics

**Workflow Statistics**:
1. Navigate to a workflow detail page
2. Click the "Statistics" tab
3. View aggregated metrics and recent executions

**Project Statistics**:
1. Navigate to a project detail page
2. Click the "Statistics" tab
3. View project-wide metrics and insights

### Manual Sync

If execution data seems stale, you can manually trigger a sync (this will be available via API in future versions).

## Technical Details

### Database Schema

See migration: `20251118000006_execution_monitoring_tables.sql`

### API Endpoints

All execution monitoring features are exposed via tRPC:

- `execution.getExecutionHistory`: List executions for a workflow
- `execution.getExecutionDetails`: Get detailed execution and component data
- `execution.syncExecutionFromTemporal`: Manually trigger a sync
- `execution.getWorkflowStatistics`: Get workflow-level statistics
- `execution.getProjectStatistics`: Get project-level statistics

### Temporal Integration

The system queries Temporal's workflow execution history API to extract:
- Activity execution details
- Workflow execution lifecycle events
- Error information
- Timing data

This data is then parsed and stored in a UI-friendly format in the database.

## Future Enhancements

- Real-time execution updates (WebSocket/polling)
- Execution filtering and search
- Export execution data
- Execution comparison (diff between runs)
- Performance profiling and optimization suggestions
- Custom alerting based on execution patterns

