# Executing Workflows

How to run and monitor workflow executions.

## Overview

Once a workflow is deployed, you can execute it:
1. Provide input parameters
2. Start execution via Temporal
3. Monitor execution progress
4. View results and history

## Starting an Execution

### Via UI

1. Open the workflow detail page
2. Click **Execute** or **Run**
3. Provide input parameters (if required)
4. Click **Start Execution**

### Execution Input

Workflows may require input parameters:
- Defined in workflow definition
- Validated before execution
- Passed to workflow as arguments

## Monitoring Execution

### Execution Status

Executions have different statuses:

- **Pending**: Waiting to start
- **Running**: Currently executing
- **Completed**: Finished successfully
- **Failed**: Encountered an error
- **Canceled**: Manually canceled

### Viewing Progress

1. Open workflow detail page
2. View execution history
3. Click on an execution to see details
4. Check execution logs and outputs

### Temporal Web UI

For detailed execution information:
1. Open Temporal Web UI: http://localhost:8233
2. Find your workflow execution
3. View execution timeline
4. Check activity execution details

## Execution Results

### Outputs

Successful executions return outputs:
- Stored in `workflow_executions` table
- Available in execution detail view
- Can be used for debugging

### Errors

Failed executions include error information:
- Error message
- Stack trace (if available)
- Failed activity details
- Execution timeline

## Execution History

View all executions for a workflow:
- Execution list shows all runs
- Filter by status
- Sort by date
- View execution details

## Best Practices

### Testing
- Test workflows with sample data
- Verify outputs are correct
- Check error handling

### Monitoring
- Monitor execution status
- Check for failures
- Review execution logs

### Optimization
- Review execution duration
- Check activity performance
- Optimize slow workflows

## Related Documentation

- [Deploying Workflows](deploying-workflows.md) - Preparing workflows
- [Temporal Integration](../architecture/temporal-integration.md) - Technical details

