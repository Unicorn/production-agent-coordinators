# Advanced Workflows

Advanced workflow patterns and features.

## Scheduled Workflows

Scheduled workflows run automatically on a schedule defined by a cron expression.

### Creating a Scheduled Workflow

1. Add a "Scheduled Workflow" node to your workflow
2. Configure the cron expression:
   - `0 0 * * *` - Daily at midnight
   - `*/30 * * * *` - Every 30 minutes
   - `0 9 * * 1-5` - Weekdays at 9 AM
3. Set timezone (default: UTC)
4. Configure max runs (optional)

### Use Cases

- Periodic checks for new work
- Scheduled reports
- Cleanup tasks
- Health checks

## Signals and Queries

### Signals

Signals allow external systems to send data to running workflows.

**Creating a Signal**:
1. Add a "Signal" node to your workflow
2. Define signal name and parameters
3. Handle signal in workflow logic

**Use Cases**:
- User approval
- External events
- Work queue items

### Queries

Queries allow read-only inspection of workflow state.

**Creating a Query**:
1. Add a "Query" node to your workflow
2. Define query name and return type
3. Implement query handler

**Use Cases**:
- Status checks
- State inspection
- Monitoring

## Child Workflows

Child workflows enable breaking complex processes into manageable pieces.

### Creating a Child Workflow

1. Add a "Child Workflow" node
2. Select the child workflow to start
3. Configure parent close policy
4. Set up parent communication (optional)

### Parent Communication

Child workflows can:
- Signal parent workflows
- Query parent state
- Send results back to parent

## Work Queues

Work queues hold pending work items for batch processing.

### Creating a Work Queue

1. Add a "Work Queue" node to your workflow
2. Configure queue settings:
   - Max size (optional)
   - Priority (FIFO, LIFO, or priority)
   - Deduplication
3. Define work item schema

### Using Work Queues

- Scheduled workflows can discover and queue work
- Workflows can process items from queue
- Supports batch processing patterns

## Dependency Management

### Block Until

Child workflows can wait for dependencies:
- Wait for other workflows to complete
- Wait for conditions to be met
- Create dependency chains

## Error Handling

### Retry Policies

Configure retries in workflow definition:
- Initial interval
- Backoff coefficient
- Maximum attempts
- Maximum interval

### Failure Handling

Handle failures gracefully:
- Catch and handle errors
- Retry failed activities
- Log errors for debugging

## Related Documentation

- [Advanced Patterns](../architecture/advanced-patterns.md) - Technical details
- [Building Workflows](building-workflows.md) - Basic workflow creation

