# Architecture Principles

Design patterns and conventions for AI agents.

## Database Design

### No Enums

All enums replaced with lookup tables + foreign keys:

```sql
-- Instead of: CREATE TYPE component_type AS ENUM ('activity', 'agent');
-- Use:
CREATE TABLE component_types (
  id UUID PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);
```

### Row-Level Security

All tables have RLS enabled:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own resources"
  ON table_name FOR SELECT
  USING (auth.uid() IN (
    SELECT auth_user_id FROM users WHERE id = created_by
  ));
```

### Denormalization

Nodes and edges stored separately for performance:

```sql
CREATE TABLE workflow_nodes (...);
CREATE TABLE workflow_edges (...);
```

## API Design

### tRPC Patterns

```typescript
// Protected procedure
protectedProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ ctx, input }) => {
    // Verify ownership
    const resource = await ctx.supabase
      .from('resources')
      .select('*')
      .eq('id', input.id)
      .eq('created_by', ctx.user.id)
      .single();
    
    if (!resource) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    
    return resource;
  });
```

### Error Handling

```typescript
throw new TRPCError({
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST',
  message: 'User-friendly message',
});
```

## Code Conventions

### TypeScript

- Strict mode enabled
- No `any` types
- Interfaces for pure types
- Types for unions/intersections

### Naming

- Functions: `camelCase`
- Components: `PascalCase`
- Files: `kebab-case.ts` or `PascalCase.tsx`
- Tables: `snake_case`

## Related Documentation

- [System Design](../architecture/system-design.md) - Architecture overview
- [Database Schema](../architecture/database-schema.md) - Schema details

