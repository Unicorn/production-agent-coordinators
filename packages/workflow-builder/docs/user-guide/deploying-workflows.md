# Deploying Workflows

How to compile and deploy workflows for execution.

## Overview

Deploying a workflow:
1. Compiles the workflow definition to executable code
2. Stores the code in the database
3. Starts a worker for the project (if not running)
4. Registers the workflow with Temporal
5. Makes it available for execution

## Prerequisites

Before deploying:
- Workflow must be valid (has trigger, nodes connected)
- Project must exist
- Temporal server must be running (for execution)

## Deploying a Workflow

### 1. Build the Workflow

1. Open the workflow in the visual editor
2. Click **Build Workflow** in the toolbar
3. Wait for compilation to complete

**What Happens**:
- Workflow definition is compiled to TypeScript
- Code is stored in `workflow_compiled_code` table
- Worker is started for the project (if needed)
- Workflow is registered with Temporal

### 2. Verify Deployment

Check the workflow status:
- Should show "Active" status
- Worker status should show "Running"
- No errors in the console

### 3. Monitor Worker

View worker status:
- Check worker is running for the project
- Verify task queue is active
- Check Temporal Web UI for registered workflows

## Workflow Status

### Draft
Workflow is being designed, not yet deployed.

### Active
Workflow is deployed and ready to execute.

### Paused
Workflow is temporarily stopped (can be resumed).

### Archived
Workflow is archived (no longer in use).

## Troubleshooting

### Build Failed

**Possible Causes**:
- Workflow definition is invalid
- Missing required configuration
- Compilation errors

**Solutions**:
- Check validation errors in property panel
- Verify all nodes are properly configured
- Check console for error messages

### Worker Not Starting

**Possible Causes**:
- Temporal server not running
- Project task queue not configured
- Database connection issues

**Solutions**:
- Start Temporal: `temporal server start-dev`
- Verify project exists and has task queue
- Check database connection

### Workflow Not Registered

**Possible Causes**:
- Worker not running
- Code compilation failed
- Temporal connection issues

**Solutions**:
- Check worker status
- Verify code was stored in database
- Check Temporal connection

## Related Documentation

- [Executing Workflows](executing-workflows.md) - Running deployed workflows
- [Temporal Integration](../architecture/temporal-integration.md) - Technical details

