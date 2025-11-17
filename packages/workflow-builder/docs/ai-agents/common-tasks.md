# Common Tasks

Step-by-step guides for common operations.

## Creating a tRPC Route

1. **Create router file** in `src/server/api/routers/`:

```typescript
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';

export const newRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from('table_name')
      .select('*');
    return data;
  }),
});
```

2. **Add to root router** in `src/server/api/root.ts`:

```typescript
import { newRouter } from './routers/new';

export const appRouter = createTRPCRouter({
  // ... existing routers
  new: newRouter,
});
```

## Adding a Component Type

1. **Add to database**:

```sql
INSERT INTO component_types (name, description, icon)
VALUES ('new-type', 'Description', 'icon-name');
```

2. **Create node component** in `src/components/workflow/nodes/NewTypeNode.tsx`

3. **Add to registry** in `src/components/workflow/nodes/index.ts`

4. **Update compiler** in `src/lib/workflow-compiler/compiler.ts`

## Creating a Migration

1. **Create file**: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`

2. **Write migration**:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns
);

ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

COMMIT;
```

3. **Apply**: `npx supabase db push`

4. **Regenerate types**: `yarn gen:types`

## Deploying a Workflow

1. **Compile workflow**:

```typescript
const code = compileWorkflow(workflow);
await storeCompiledCode(workflowId, code);
```

2. **Start worker**:

```typescript
await workerManager.startWorkerForProject(projectId);
```

3. **Update status**:

```typescript
await updateWorkflowStatus(workflowId, 'active');
```

## Related Documentation

- [Contributing](../development/contributing.md) - Code standards
- [Database Migrations](../development/database-migrations.md) - Migration guide

