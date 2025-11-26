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

# Start Temporal stack used by tests and local runs
yarn infra:up
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
- For compiler / Temporal integration issues, run:
  - Unit tests: `cd packages/workflow-builder && yarn test:unit`
  - Integration tests (requires `yarn infra:up`): `yarn test:integration`
  - E2E UI tests (requires `yarn infra:up` + dev server): `yarn test:e2e`

---

## Testing Requirements (Workflow Builder)

**See**: `.cursor/rules/testing-standards.mdc` for comprehensive testing standards  
**See**: `docs/testing/README.md` for testing guide and troubleshooting  
**See**: `plans/testing/` for testing architecture and phase plans

### Quick Reference

**Test Commands:**
```bash
# Unit tests (fast, no dependencies)
yarn test:unit

# Integration tests (requires Temporal: yarn infra:up)
yarn test:integration

# E2E tests (requires Temporal + dev server)
yarn test:e2e

# Debug mode (preserves artifacts)
WORKFLOW_BUILDER_TEST_DEBUG=1 yarn test:integration
```

### General Principles

- ✅ Prefer **real systems** (Temporal, Supabase, tRPC) over mocks
- ✅ If mocking is required:
  - Document rationale in test file
  - Provide verification test comparing mock to real system
  - Keep mocks local to test suite

### Testing Layers

**Layer 1: Unit Tests** (`tests/unit/`)
- Helper functions (timeout parsing, retry validation, AST utilities)
- Generator sub-functions (buildImports, buildRetryOptions, etc.)
- Workflow definition validation
- **Command**: `yarn test:unit`

**Layer 2: Integration Tests** (`tests/integration/compiler-execution/`)
- Workflow compilation to TypeScript
- Temporal workflow initialization and execution
- Activity timeouts, retries, cancellations, concurrency
- **Command**: `yarn test:integration` (requires `yarn infra:up`)

**Layer 3: UI Component Tests** (`tests/ui/`)
- React component rendering and interactions
- Form validation (timeout/retry configuration)
- **Command**: `yarn test:unit` (includes UI tests)

**Layer 4: E2E Tests** (`tests/e2e/`)
- Complete user flows (create → compile → deploy → run)
- UI interactions end-to-end
- **Command**: `yarn test:e2e` (requires `yarn infra:up` + dev server)

### Debugging Support

**Environment Variable**: `WORKFLOW_BUILDER_TEST_DEBUG=1`

**What it enables:**
- Preserves `.test-workflows` directories for failing tests
- Dumps generated `workflows/index.ts` to `tests/_artifacts/`
- Logs workflow names, IDs, and exported function names
- Writes JSON history summaries for failing tests

**Usage:**
```bash
WORKFLOW_BUILDER_TEST_DEBUG=1 yarn test:integration
```

### For New Features

**Minimum test requirements:**
- ✅ At least one unit test for helper functions
- ✅ At least one integration test if feature involves Temporal
- ✅ At least one UI test if feature has UI components
- ✅ At least one E2E test if feature is user-facing

### Temporal Setup

**For integration and E2E tests:**
```bash
# Start Temporal stack (from repo root)
yarn infra:up

# Verify it's running
curl http://localhost:7233/health
```

**Configuration:**
- Address: `localhost:7233` (default)
- Namespace: `default`
- Task Queue: `test-queue` (or `test-queue-concurrent` for concurrency tests)

---

## References

- Design Doc: `docs/plans/2025-11-14-workflow-builder-system-design.md`
- Component Standards: `docs/standards/component-discoverability-and-reusability.md`
- Temporal Docs: https://docs.temporal.io/
- Supabase Docs: https://supabase.com/docs
- tRPC Docs: https://trpc.io/docs

