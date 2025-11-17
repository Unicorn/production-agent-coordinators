# Troubleshooting

Common issues and solutions for the Workflow Builder system.

## Authentication Issues

### "Invalid API key" or "401 Unauthorized"

**Problem**: Supabase credentials are incorrect or missing.

**Solutions**:
1. Verify `.env.local` has correct Supabase credentials
2. Check `NEXT_PUBLIC_SUPABASE_URL` matches your Supabase project
3. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
4. Restart dev server after changing `.env.local`

**For Local Supabase**:
- Run `supabase start` and copy the anon key from output
- Update `.env.local` with the local values

### "Cannot sign up" or "Sign up fails"

**Problem**: Database tables or triggers not created.

**Solutions**:
1. Verify migrations ran: `npx supabase migration list`
2. Run migrations: `npx supabase db push`
3. Check `users` table exists in Supabase Studio
4. Verify user trigger exists (creates user record on signup)

### "Login fails" or "User not found"

**Problem**: User exists in auth but not in `users` table.

**Solutions**:
1. Check if user exists in Supabase Auth (Authentication → Users)
2. Manually create user record:
   ```sql
   INSERT INTO users (auth_user_id, email, display_name, role_id)
   SELECT id, email, raw_user_meta_data->>'display_name', 
          (SELECT id FROM user_roles WHERE name = 'developer')
   FROM auth.users
   WHERE email = 'user@example.com';
   ```

## Database Issues

### "Table does not exist"

**Problem**: Migrations haven't been applied.

**Solutions**:
1. Run migrations: `npx supabase db push`
2. Check migration files exist in `supabase/migrations/`
3. Verify Supabase connection in `.env.local`
4. For local Supabase, ensure it's running: `supabase status`

### "Migration failed" or "Migration error"

**Problem**: Database schema conflicts or connection issues.

**Solutions**:
1. Check migration SQL for syntax errors
2. Verify no conflicting migrations
3. Reset database (⚠️ deletes all data): `npx supabase db reset`
4. Re-run migrations: `npx supabase db push`

### "RLS policy violation" or "Permission denied"

**Problem**: Row-Level Security policies blocking access.

**Solutions**:
1. Verify user is authenticated (check session)
2. Check RLS policies allow user access
3. For debugging, temporarily disable RLS:
   ```sql
   ALTER TABLE components DISABLE ROW LEVEL SECURITY;
   -- Test query
   ALTER TABLE components ENABLE ROW LEVEL SECURITY;
   ```
4. Check component visibility settings (public vs private)

### "Foreign key constraint violation"

**Problem**: Trying to delete or modify referenced data.

**Solutions**:
1. Check what's referencing the record:
   ```sql
   SELECT * FROM workflows WHERE component_id = 'xxx';
   ```
2. Delete or update dependent records first
3. Use CASCADE delete if appropriate (check migration)

## Workflow Issues

### "Component not found in palette"

**Problem**: Component not visible or not loaded.

**Solutions**:
1. Refresh the page
2. Verify component exists: Check Components page
3. Check component visibility (must be public or owned by you)
4. Verify component type is supported
5. Check browser console for errors

### "Cannot connect nodes"

**Problem**: Node connection validation failing.

**Solutions**:
1. Ensure both nodes are on the canvas
2. Check node types are compatible
3. Try dragging from output handle to input handle
4. Verify workflow definition is valid
5. Check browser console for validation errors

### "Workflow won't save"

**Problem**: Auto-save or manual save failing.

**Solutions**:
1. Check browser console for errors
2. Verify you're logged in (session expired?)
3. Check network connection
4. Verify workflow definition is valid JSON
5. Check database connection
6. Try manual save button

### "Build workflow failed"

**Problem**: Workflow compilation or worker startup failing.

**Solutions**:
1. Ensure Temporal is running: `temporal server start-dev`
2. Check workflow has at least one trigger node
3. Verify all nodes are properly configured
4. Check worker logs for errors
5. Verify project has a task queue
6. Check `workflow_compiled_code` table for errors

### "Workflow execution failed"

**Problem**: Temporal execution error.

**Solutions**:
1. Check Temporal Web UI: http://localhost:8233
2. Verify worker is running for the project
3. Check workflow definition is valid
4. Verify activities are registered
5. Check execution logs in Temporal UI
6. Verify task queue name matches project

## Temporal Issues

### "Cannot connect to Temporal"

**Problem**: Temporal server not running or wrong address.

**Solutions**:
1. Start Temporal: `temporal server start-dev`
2. Verify `TEMPORAL_ADDRESS` in `.env.local` is correct
3. Check Temporal is accessible: `curl http://localhost:7233`
4. Verify Temporal Web UI loads: http://localhost:8233

### "Worker not starting"

**Problem**: Worker manager failing to start worker.

**Solutions**:
1. Check Temporal connection
2. Verify project has a task queue
3. Check `workflow_workers` table for errors
4. Verify compiled code exists in `workflow_compiled_code`
5. Check worker logs in terminal
6. Restart worker: Use worker manager API

### "Workflow not found in Temporal"

**Problem**: Workflow not registered with Temporal.

**Solutions**:
1. Verify workflow was built (compiled code exists)
2. Check worker is running for the project
3. Verify workflow name matches definition
4. Check Temporal Web UI for registered workflows
5. Rebuild workflow to re-register

## Development Issues

### "Port 3010 already in use"

**Problem**: Another process using the port.

**Solutions**:
```bash
# Find process using port
lsof -i:3010

# Kill the process
lsof -ti:3010 | xargs kill -9

# Or change port in package.json
```

### "Type errors" or "TypeScript errors"

**Problem**: Type definitions out of sync with database.

**Solutions**:
1. Regenerate types: `yarn gen:types`
2. Restart TypeScript server in IDE
3. Check database schema matches types
4. Verify migration was applied

### "Module not found" errors

**Problem**: Dependencies not installed or path issues.

**Solutions**:
1. Reinstall dependencies: `yarn install`
2. Clear node_modules: `rm -rf node_modules && yarn install`
3. Check import paths are correct
4. Verify package.json has the dependency

### "Hot reload not working"

**Problem**: Next.js dev server not detecting changes.

**Solutions**:
1. Restart dev server
2. Clear `.next` cache: `rm -rf .next`
3. Check file watcher limits (macOS/Linux)
4. Verify file is being saved

## Component Issues

### "Component type not supported"

**Problem**: Trying to use unsupported component type.

**Solutions**:
1. Check available types in `component_types` table
2. Verify component type exists
3. Check if custom node component exists
4. See [Adding Component Types](../development/adding-component-types.md)

### "Component configuration invalid"

**Problem**: Component config doesn't match schema.

**Solutions**:
1. Check component's `config_schema` in database
2. Verify property values match schema
3. Check required fields are provided
4. Validate JSON structure

## Performance Issues

### "Slow page loads"

**Problem**: Database queries or network issues.

**Solutions**:
1. Check database indexes exist
2. Verify RLS policies are efficient
3. Check network latency to Supabase
4. Use Supabase Studio to analyze slow queries
5. Consider pagination for large lists

### "Canvas lag" or "UI freezing"

**Problem**: Too many nodes or inefficient rendering.

**Solutions**:
1. Reduce number of nodes on canvas
2. Check React Flow performance settings
3. Verify auto-save isn't blocking UI
4. Check browser console for errors
5. Consider virtualizing large lists

## Environment Issues

### "Environment variable not found"

**Problem**: Missing or incorrect env var.

**Solutions**:
1. Check `.env.local` exists and has the variable
2. Verify variable name is correct (case-sensitive)
3. Restart dev server after changing `.env.local`
4. Check variable is prefixed with `NEXT_PUBLIC_` for client-side

### "Different behavior in production"

**Problem**: Environment differences.

**Solutions**:
1. Compare `.env.local` with production env vars
2. Check Supabase project settings
3. Verify Temporal connection in production
4. Check build output for differences

## Getting More Help

### Check Logs

**Browser Console**:
- Open DevTools (F12)
- Check Console tab for errors
- Check Network tab for failed requests

**Server Logs**:
- Check terminal where `yarn dev` is running
- Look for error messages or stack traces

**Supabase Logs**:
```bash
# Local Supabase
supabase logs

# Or check Supabase Studio → Logs
```

**Temporal Logs**:
- Check Temporal Web UI: http://localhost:8233
- View workflow execution history
- Check worker status

### Debug Mode

**Enable verbose logging**:
```typescript
// In src/server/api/trpc.ts
onError: ({ path, error }) => {
  console.error(`tRPC failed on ${path}:`, error);
}
```

**Database debugging**:
```sql
-- Temporarily disable RLS
ALTER TABLE components DISABLE ROW LEVEL SECURITY;

-- Test queries
SELECT * FROM components;

-- Re-enable RLS
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
```

## Related Documentation

- [Installation](../getting-started/installation.md) - Setup issues
- [Local Development](../getting-started/local-development.md) - Local setup issues
- [Database Schema](../architecture/database-schema.md) - Schema reference
- [Development Guide](../development/README.md) - Development issues
- [API Reference](../api/README.md) - API troubleshooting

