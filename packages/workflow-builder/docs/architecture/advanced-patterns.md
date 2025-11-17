# Advanced Workflow Patterns

Advanced workflow patterns supported by the Workflow Builder.

## Overview

The system supports several advanced Temporal patterns:
- **Scheduled Workflows** - Cron-based recurring workflows
- **Signals** - Event-driven workflow communication
- **Queries** - Read-only state inspection
- **Child Workflows** - Nested workflow execution
- **Work Queues** - Batch processing patterns

## Scheduled Workflows (Cron)

Scheduled workflows run automatically on a schedule defined by a cron expression.

### Database Schema

**Table**: `workflow_scheduled_workflows`

**Columns**:
- `cron_expression` - Cron expression (e.g., `0 0 * * *`)
- `timezone` - Timezone (default: UTC)
- `start_immediately` - Start on parent workflow start
- `max_runs` - Maximum number of runs (NULL = unlimited)
- `work_queue_id` - Optional work queue for discovered work

### Use Cases

- **Periodic Checks**: Check for new work every 30 minutes
- **Scheduled Reports**: Generate reports daily at midnight
- **Cleanup Tasks**: Clean up old data weekly
- **Monitoring**: Health checks every 5 minutes

### Example

```typescript
// Cron: Every 30 minutes
const schedule = {
  cronExpression: '*/30 * * * *',
  timezone: 'UTC',
  startImmediately: true,
  maxRuns: null, // Unlimited
};
```

## Signals

Signals allow external systems or other workflows to send data to a running workflow.

### Database Schema

**Table**: `workflow_signals`

**Columns**:
- `signal_name` - Unique signal name
- `parameters` - JSON schema of signal parameters
- `auto_generated` - True if auto-generated from work queue
- `work_queue_id` - Optional work queue association

### Use Cases

- **User Input**: Wait for user approval
- **External Events**: React to external system events
- **Work Queue**: Add items to work queue
- **Parent Communication**: Child workflow signals parent

### Example

```typescript
// Signal handler
setHandler(defineSignal('approveRequest'), (data) => {
  approvalReceived = data;
});

// Wait for signal
await condition(() => approvalReceived !== null);
```

## Queries

Queries allow read-only inspection of workflow state without affecting execution.

### Database Schema

**Table**: `workflow_queries`

**Columns**:
- `query_name` - Unique query name
- `return_type` - JSON schema of return type
- `auto_generated` - True if auto-generated from work queue
- `work_queue_id` - Optional work queue association

### Use Cases

- **Status Checks**: Check workflow progress
- **Work Queue Status**: Check work queue size
- **State Inspection**: Read workflow state
- **Monitoring**: Get workflow metrics

### Example

```typescript
// Query handler
setHandler(defineQuery('getStatus'), () => {
  return {
    progress: currentStep,
    itemsProcessed: count,
  };
});
```

## Child Workflows

Child workflows enable breaking complex processes into manageable pieces.

### Database Schema

**Table**: `workflow_child_workflows`

**Columns**:
- `child_workflow_id` - Reference to child workflow
- `child_workflow_name` - Workflow name to start
- `parent_close_policy` - terminate, abandon, request_cancel
- `can_signal_parent` - Can child signal parent?
- `can_query_parent` - Can child query parent?
- `block_until` - Dependency configuration

### Use Cases

- **Parallel Processing**: Process multiple items in parallel
- **Modular Design**: Break workflows into reusable pieces
- **Error Isolation**: Isolate failures to child workflows
- **Scalability**: Scale child workflows independently

### Example

```typescript
// Start child workflow
const childHandle = await startChild(childWorkflow, {
  args: [inputData],
  workflowId: `child-${parentWorkflowId}-${index}`,
});

// Wait for completion
const result = await childHandle.result();
```

## Work Queues

Work queues hold pending work items that can be processed by workflows.

### Database Schema

**Table**: `workflow_work_queues`

**Columns**:
- `queue_name` - Unique queue name
- `signal_name` - Auto-generated signal for adding items
- `query_name` - Auto-generated query for checking queue
- `max_size` - Maximum queue size (NULL = unlimited)
- `priority` - fifo, lifo, or priority
- `deduplicate` - Prevent duplicate items
- `work_item_schema` - JSON schema of work items

### Use Cases

- **Batch Processing**: Queue items for batch processing
- **Work Discovery**: Scheduled workflows discover and queue work
- **Rate Limiting**: Control processing rate
- **Prioritization**: Process high-priority items first

### Example

```typescript
// Add to queue (via signal)
await workflow.signal('addToQueue', { item: workItem });

// Get from queue (in workflow)
const item = await getFromQueue();
if (item) {
  await processItem(item);
}
```

## Parent-Child Communication

### Signal to Parent

Child workflows can signal parent workflows:

```typescript
// In child workflow
await signalParent('childComplete', { result: data });

// In parent workflow
setHandler(defineSignal('childComplete'), (data) => {
  childResults.push(data);
});
```

### Query Parent

Child workflows can query parent state:

```typescript
// In child workflow
const parentState = await queryParent('getState');

// In parent workflow
setHandler(defineQuery('getState'), () => {
  return currentState;
});
```

## Dependency Management

### Block Until

Child workflows can wait for dependencies:

```typescript
// Block until condition
await blockUntil({
  workflowIds: ['workflow-1', 'workflow-2'],
  condition: 'all-complete',
});
```

## Scheduling Patterns

### Immediate Start

Start scheduled workflow immediately when parent starts:

```typescript
{
  startImmediately: true,
  cronExpression: '*/30 * * * *',
}
```

### Delayed Start

Start scheduled workflow after delay:

```typescript
{
  startImmediately: false,
  cronExpression: '0 0 * * *', // Daily at midnight
}
```

## Error Handling

### Retry Policies

Configure retries in workflow definition:

```typescript
{
  retryPolicy: {
    initialInterval: '1s',
    backoffCoefficient: 2.0,
    maximumInterval: '100s',
    maximumAttempts: 5,
  },
}
```

### Failure Handling

Handle failures in child workflows:

```typescript
try {
  const result = await childHandle.result();
} catch (error) {
  // Handle child workflow failure
  failedChildren.push(childId);
}
```

## Related Documentation

- [Database Schema](database-schema.md) - Schema details
- [User Guide](../user-guide/advanced-workflows.md) - Using advanced patterns
- [Temporal Integration](temporal-integration.md) - Execution details

