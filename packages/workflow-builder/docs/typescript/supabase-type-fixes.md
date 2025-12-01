# Supabase TypeScript Type Fixes

## Problem

Supabase queries with complex select statements (joins, aliases, nested selects) often return `never` type in TypeScript, causing errors like:
- `Property 'id' does not exist on type 'never'`
- `Property 'display_name' does not exist on type 'never'`
- `No overload matches this call`

This is a known limitation of Supabase's TypeScript type inference system.

## Solution

We've implemented a pragmatic approach using type assertions for complex queries:

### 1. Helper Utilities

Created `src/lib/supabase/query-helpers.ts` with utilities:
- `castSupabaseClient()` - Casts the Supabase client for complex operations
- `typedQuery()` - Type-safe wrapper for queries
- `assertType()` - Type assertion helper

### 2. Type Assertion Pattern

For complex queries, cast the Supabase client:

```typescript
import { castSupabaseClient } from '@/lib/supabase/query-helpers';

// Complex select with joins
const { data, error } = await (castSupabaseClient(ctx.supabase)
  .from('projects')
  .select(`
    *,
    workflow_count:workflows(count),
    active_workers:workflow_workers(id, status, last_heartbeat)
  `)
  .eq('created_by', userRecord.id)
  .single());

// Then cast the result
const project = data as ProjectWithRelations;
```

### 3. Property Access Pattern

For accessing properties from query results:

```typescript
// Cast the entire result object
const wfData = workflowData as any;

// Or cast individual properties
const projectId = (workflowData as any).project_id;
```

### 4. Update/Insert Pattern

For update and insert operations:

```typescript
await ((ctx.supabase as any)
  .from('projects')
  .update({ 
    is_archived: true,
    updated_at: new Date().toISOString()
  })
  .eq('id', input.id));
```

## Fixed Files

✅ **projects-core.ts** - All TypeScript errors fixed (0 errors)
- Used `castSupabaseClient()` for complex queries
- Added type assertions for property access
- Fixed all update/insert operations

✅ **execution-core.ts** - Reduced from 50+ errors to 22 errors
- Applied same pattern to workflow queries
- Fixed execution record creation
- Fixed property accesses

## Remaining Work

There are ~1427 total TypeScript errors in the codebase, many of which are pre-existing. The pattern established here can be applied to other routers:

- `execution-monitoring.ts`
- `execution-results.ts`
- `project-settings.ts`
- `project-workers.ts`
- Other routers with complex Supabase queries

## Best Practices

1. **Use `castSupabaseClient()` for complex queries** - When you have joins, aliases, or nested selects
2. **Cast query results** - Use `as any` or create specific types like `ProjectWithRelations`
3. **Cast property accesses** - Use `(obj as any).property` when TypeScript can't infer
4. **Document complex types** - Add types to `src/lib/supabase/types.ts` for reusable query results

## Alternative Solutions

If you want to avoid type assertions, consider:
1. **Simpler queries** - Break complex queries into multiple simpler ones
2. **Type generation** - Use Supabase CLI to regenerate types after schema changes
3. **Explicit types** - Define explicit return types for each query result

However, for complex queries with joins and aliases, type assertions are the most pragmatic solution.

