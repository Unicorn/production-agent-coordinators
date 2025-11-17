# Contributing

Code organization and conventions for contributing to the Workflow Builder.

## Code Organization

### Directory Structure

```
src/
├── app/              # Next.js App Router pages
├── components/      # React components
├── lib/             # Utilities and helpers
├── server/          # Backend (tRPC)
├── types/           # TypeScript types
└── utils/           # Utility functions
```

### Component Structure

- **UI Components**: `src/components/` organized by domain
- **Workflow Components**: `src/components/workflow/`
- **Shared Components**: `src/components/shared/`

### Backend Structure

- **Routers**: `src/server/api/routers/` - One file per domain
- **tRPC Setup**: `src/server/api/trpc.ts` - Context and middleware
- **Root Router**: `src/server/api/root.ts` - Router composition

## TypeScript Conventions

### Strict Mode

TypeScript strict mode is enabled:
- `strict: true`
- `noImplicitAny: true`
- `strictNullChecks: true`

### Naming

- **Interfaces**: `IComponent`, `IWorkflow` (pure interfaces)
- **Types**: `Component`, `WorkflowDefinition` (no prefix)
- **Functions**: `camelCase` (e.g., `generateWorkflowCode`)
- **Files**: `kebab-case.ts` or `PascalCase.tsx`

## Code Style

### Imports

```typescript
// External packages
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

// Internal modules (absolute paths)
import { createTRPCRouter } from '@/server/api/trpc';
import type { Database } from '@/types/database';
```

### Error Handling

```typescript
try {
  const result = await operation();
  return result;
} catch (error) {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'User-friendly message',
    cause: error,
  });
}
```

### Database Queries

```typescript
const { data, error } = await ctx.supabase
  .from('table')
  .select('*')
  .eq('id', id)
  .single();

if (error) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Resource not found',
  });
}
```

## Adding New Features

### 1. Create tRPC Route

1. Create router file in `src/server/api/routers/`
2. Define Zod input schema
3. Create procedure (public/protected)
4. Add to root router in `src/server/api/root.ts`

### 2. Create UI Component

1. Create component in appropriate directory
2. Use Tamagui components
3. Follow existing component patterns
4. Add to component exports

### 3. Update Types

1. Update database types: `yarn gen:types`
2. Add workflow types if needed
3. Export types from `src/types/`

## Testing

See [Testing](testing.md) for testing guidelines.

## Related Documentation

- [Database Migrations](database-migrations.md) - Schema changes
- [Adding Component Types](adding-component-types.md) - New component types

