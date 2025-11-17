# Troubleshooting for AI Agents

Common errors and fixes for AI agents.

## Common Errors

### "Component not found"

**Cause**: Component doesn't exist or visibility issue.

**Fix**:
- Check component exists in database
- Verify visibility (public vs private)
- Check RLS policies

### "Workflow not executing"

**Cause**: Worker not running or workflow not deployed.

**Fix**:
- Verify worker is running: Check `workflow_workers` table
- Check workflow status is 'active'
- Verify Temporal connection

### "Migration failed"

**Cause**: SQL syntax error or constraint violation.

**Fix**:
- Check SQL syntax
- Verify table doesn't already exist
- Check foreign key constraints

### "Type error"

**Cause**: TypeScript types out of sync.

**Fix**:
- Regenerate types: `yarn gen:types`
- Check database schema matches types
- Restart TypeScript server

## Debugging Strategies

### Check Database

```sql
-- Verify table exists
SELECT * FROM information_schema.tables 
WHERE table_name = 'table_name';

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'table_name';
```

### Check Logs

- Browser console for frontend errors
- Server logs for backend errors
- Temporal Web UI for workflow errors

### Verify State

- Check `workflow_workers` for worker status
- Check `workflow_executions` for execution status
- Check `workflow_compiled_code` for compiled code

## Related Documentation

- [Troubleshooting](../troubleshooting.md) - User troubleshooting
- [Debugging](../development/debugging.md) - Developer debugging

