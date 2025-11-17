# Debugging

Debugging guide for workflows and workers.

## Common Issues

### Workflow Won't Compile

**Check**:
- Workflow has at least one trigger node
- All nodes are properly configured
- No circular dependencies

**Debug**:
- Check console for compilation errors
- Verify workflow definition JSON is valid
- Check node configurations

### Worker Not Starting

**Check**:
- Temporal server is running
- Project has task queue
- Compiled code exists in database

**Debug**:
- Check `workflow_workers` table
- View worker logs in terminal
- Check Temporal connection

### Execution Failing

**Check**:
- Workflow is deployed (status = active)
- Worker is running
- Activities are registered

**Debug**:
- Check Temporal Web UI
- View execution logs
- Check `workflow_executions` table

## Debugging Tools

### Temporal Web UI

Access at `http://localhost:8233`:
- View workflow executions
- Check task queues
- Inspect execution timeline

### Browser DevTools

- Console: Check for errors
- Network: Monitor API calls
- React DevTools: Inspect component state

### Database Queries

```sql
-- Check worker status
SELECT * FROM workflow_workers WHERE project_id = 'xxx';

-- Check executions
SELECT * FROM workflow_executions WHERE workflow_id = 'xxx';

-- Check compiled code
SELECT * FROM workflow_compiled_code WHERE workflow_id = 'xxx';
```

## Related Documentation

- [Troubleshooting](../troubleshooting.md) - Common issues
- [Temporal Integration](../architecture/temporal-integration.md) - Worker details

