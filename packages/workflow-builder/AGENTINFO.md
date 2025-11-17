# AGENTINFO.md - Workflow Builder System

**Project:** Workflow Builder for Temporal Coordinators  
**Stack:** Next.js 14, TypeScript (strict), Tamagui, tRPC, Supabase, Temporal

---

## Architecture Principles

### Database Design
- **No Enums**: All enums → lookup tables (`component_types`, `workflow_statuses`)
- **Foreign Keys**: All relationships use UUIDs with FK constraints
- **Row-Level Security**: Supabase RLS enabled on all tables
- **Denormalization**: `workflow_nodes` and `workflow_edges` for performance

### API Design (tRPC)
- Type-safe RPC between frontend/backend
- Protected routes require authentication
- All list endpoints support pagination
- Mutations verify user ownership

### Integration
- Sync with `ActivityRegistry` and `WorkflowRegistry` from `@coordinator/temporal-registry`
- Dynamic workers load workflow definitions from Supabase at startup
- JSON definitions compiled to executable Temporal workflows

---

## Component Structure

### UI Components (Tamagui)
- Use `YStack`/`XStack` for layout (no CSS grid/flexbox)
- Tamagui primitives: `Button`, `Input`, `Dialog`, `Sheet`, `ScrollView`
- Theme tokens: `$background`, `$color`, `$borderColor`, `$space4`

### Workflow Canvas
- Uses `@bernierllc/workflow-ui` (React Flow based)
- Custom nodes: `ActivityNode`, `AgentNode`, `SignalNode`, `TriggerNode`
- Drag-and-drop from component palette
- Real-time validation

---

## Database Conventions

### Naming
- **Tables**: lowercase + underscores (`workflow_nodes`)
- **Columns**: snake_case (`created_at`, `display_name`)
- **FKs**: `{table_singular}_id` (`component_type_id`)
- **Timestamps**: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### JSON Columns
- Use `JSONB` (not `JSON`)
- Always default: `JSONB NOT NULL DEFAULT '{}'`

---

## TypeScript Patterns

### Strict Mode Enabled
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUncheckedIndexedAccess": true
}
```

### Naming
- **Interfaces**: `IComponent`, `IWorkflow` (pure interfaces)
- **Types**: `Component`, `WorkflowDefinition` (no prefix)
- **Functions**: camelCase (`generateWorkflowFunction`)

---

## Error Handling

### Backend (tRPC)
```typescript
throw new TRPCError({ 
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST',
  message: 'User-friendly message'
});
```

### Frontend
```typescript
try {
  await mutation.mutateAsync({ ... });
} catch (error) {
  if (error instanceof TRPCClientError) {
    toast.error(error.message);
  }
}
```

---

## Security

### Authentication
- Supabase Auth for user management
- Tokens in httpOnly cookies
- Auto-refresh via Supabase client

### Authorization
- RLS on all tables
- Check ownership in tRPC procedures
- Validate permissions against user role

---

## Development Workflow

### Local Setup
```bash
# Install dependencies
yarn install

# Start Supabase (optional)
npx supabase start

# Run migrations
npx supabase db push

# Start dev server
yarn dev

# Start Temporal
temporal server start-dev

# Start dynamic worker
yarn worker:dev
```

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_KEY=eyJxxx
TEMPORAL_ADDRESS=localhost:7233
```

---

## Common Patterns

### Creating tRPC Route
1. Define Zod input schema
2. Create procedure (public/protected)
3. Query Supabase with RLS
4. Return typed data

### Adding Component Type
1. Insert into `component_types` table
2. Create custom node component
3. Add to node registry
4. Update workflow compiler

### Deploying Workflow
1. Save definition to Supabase
2. Generate TypeScript (optional)
3. Update status to 'active'
4. Worker auto-loads on next poll

---

## Troubleshooting

**"Component not found"**
- Check component visibility (public vs private)
- Verify RLS policies
- Sync from ActivityRegistry

**Workflow not executing**
- Verify status is 'active'
- Check worker is running
- Look at Temporal UI
- Check worker logs

---

## References

- Design Doc: `docs/plans/2025-11-14-workflow-builder-system-design.md`
- Component Standards: `docs/standards/component-discoverability-and-reusability.md`
- Temporal Docs: https://docs.temporal.io/
- Supabase Docs: https://supabase.com/docs
- tRPC Docs: https://trpc.io/docs

