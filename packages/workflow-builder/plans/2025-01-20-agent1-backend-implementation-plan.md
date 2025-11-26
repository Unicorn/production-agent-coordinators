# Agent 1: Database & Backend Foundation - Implementation Plan

## Overview

Agent 1 is responsible for Phases 0-3 of the services/components/connectors refactor, focusing on:
- Database migrations
- Backend naming changes
- Service interfaces backend
- Connectors backend

## Worktree Setup

**Worktree**: `phase0-backend`  
**Branch**: `phase0-backend` (to be created)  
**Location**: `../production-agent-coordinators-phase0-backend`

## Phase 0: Database Naming Changes

### Tasks

1. **Add `service_display_name` to workflows table**
   - Migration: `20250120000001_add_service_display_name.sql`
   - Add column: `service_display_name VARCHAR(255)`
   - Populate from existing `display_name` or `name`
   - Make it NOT NULL after population

2. **Rename `display_name` to `channel_display_name` in task_queues**
   - Migration: `20250120000002_rename_task_queue_display_name.sql`
   - Current: `display_name` (from migration 20251117000005)
   - New: `channel_display_name`
   - Migrate existing data
   - Update all references

### Migration Files to Create

```sql
-- 20250120000001_add_service_display_name.sql
ALTER TABLE workflows ADD COLUMN service_display_name VARCHAR(255);
UPDATE workflows SET service_display_name = COALESCE(display_name, name);
ALTER TABLE workflows ALTER COLUMN service_display_name SET NOT NULL;
COMMENT ON COLUMN workflows.service_display_name IS 'User-facing service name (replaces workflow terminology)';

-- 20250120000002_rename_task_queue_display_name.sql
ALTER TABLE task_queues RENAME COLUMN display_name TO channel_display_name;
COMMENT ON COLUMN task_queues.channel_display_name IS 'User-facing channel name (replaces task queue terminology)';
```

## Phase 1: Service Interfaces Backend

### Database Migrations

1. **Create `service_interfaces` table**
   - Migration: `20250120000003_create_service_interfaces.sql`
   - Schema from refactor plan (lines 69-89)
   - Indexes: `service_id`, `interface_type`

2. **Create `public_interfaces` table**
   - Migration: `20250120000004_create_public_interfaces.sql`
   - Schema from refactor plan (lines 116-131)
   - Index: `service_interface_id`

### tRPC Router: `serviceInterfacesRouter`

**Location**: `packages/workflow-builder/src/server/api/routers/service-interfaces.ts`

**Procedures**:
- `list` - List interfaces for a service
- `get` - Get interface by ID
- `create` - Create new interface
- `update` - Update interface
- `delete` - Delete interface
- `getByService` - Get all interfaces for a service

**Type Definitions**:
```typescript
interface ServiceInterface {
  id: string;
  serviceId: string;
  name: string;
  displayName: string;
  description?: string;
  interfaceType: 'signal' | 'query' | 'update' | 'start_child';
  temporalCallableName: string;
  payloadSchema: JSONB;
  returnSchema?: JSONB;
  activityConnectionId?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### tRPC Router: `publicInterfacesRouter`

**Location**: `packages/workflow-builder/src/server/api/routers/public-interfaces.ts`

**Procedures**:
- `list` - List public interfaces
- `get` - Get public interface by ID
- `create` - Create public interface (auto-creates Kong route)
- `update` - Update public interface
- `delete` - Delete public interface and Kong route

## Phase 2: Connectors Backend

### Database Migrations

1. **Create `connectors` table**
   - Migration: `20250120000005_create_connectors.sql`
   - Schema from refactor plan (lines 211-232)
   - Indexes: `project_id`, `connector_type`

2. **Create `project_connectors` table**
   - Migration: `20250120000006_create_project_connectors.sql`
   - Schema from refactor plan (lines 177-198)
   - Indexes: `source_project_id`, `target_project_id`

### tRPC Router: `connectorsRouter`

**Location**: `packages/workflow-builder/src/server/api/routers/connectors.ts`

**Procedures**:
- `list` - List connectors for a project
- `get` - Get connector by ID
- `create` - Create new connector (with encryption)
- `update` - Update connector
- `delete` - Delete connector
- `test` - Test connector connection
- `getByType` - Get connectors by type

**Encryption**:
- Use Supabase Vault or application-level encryption
- Encrypt `credentials_encrypted` field
- Decrypt on read

### tRPC Router: `projectConnectorsRouter`

**Location**: `packages/workflow-builder/src/server/api/routers/project-connectors.ts`

**Procedures**:
- `list` - List connectors for a project
- `get` - Get connector by ID
- `create` - Create new project connector
- `update` - Update project connector
- `delete` - Delete project connector
- `getBySourceProject` - Get connectors from source project
- `getByTargetProject` - Get connectors to target project

## Phase 3: Update Existing Routers

### Update `workflowsRouter`

**File**: `packages/workflow-builder/src/server/api/routers/workflows.ts`

**Changes**:
- Add `serviceDisplayName` to response types
- Update field names in queries to use `service_display_name`
- Keep backward compatibility with `display_name`

### Update `taskQueuesRouter`

**File**: `packages/workflow-builder/src/server/api/routers/task-queues.ts`

**Changes**:
- Update to use `channel_display_name` instead of `display_name`
- Update response types to include `channelDisplayName`

### Update Root Router

**File**: `packages/workflow-builder/src/server/api/root.ts`

**Add**:
```typescript
import { serviceInterfacesRouter } from './routers/service-interfaces';
import { publicInterfacesRouter } from './routers/public-interfaces';
import { connectorsRouter } from './routers/connectors';
import { projectConnectorsRouter } from './routers/project-connectors';

export const appRouter = createTRPCRouter({
  // ... existing routers
  serviceInterfaces: serviceInterfacesRouter,
  publicInterfaces: publicInterfacesRouter,
  connectors: connectorsRouter,
  projectConnectors: projectConnectorsRouter,
});
```

## Implementation Order

1. **Phase 0** (Database naming)
   - Create migrations
   - Test migrations
   - Update TypeScript types

2. **Phase 1** (Service interfaces)
   - Create migrations
   - Create serviceInterfacesRouter
   - Create publicInterfacesRouter
   - Add to root router
   - Test endpoints

3. **Phase 2** (Connectors)
   - Create migrations
   - Create connectorsRouter (with encryption)
   - Create projectConnectorsRouter
   - Add to root router
   - Test endpoints

4. **Phase 3** (Update existing)
   - Update workflowsRouter
   - Update taskQueuesRouter
   - Test backward compatibility

## Testing Requirements

- [ ] All migrations run successfully
- [ ] All tRPC endpoints work correctly
- [ ] Encryption/decryption works for connectors
- [ ] Backward compatibility maintained
- [ ] TypeScript types updated
- [ ] No breaking changes to existing API

## Dependencies

- Supabase client (already in use)
- tRPC (already in use)
- Encryption library (to be determined)

## Notes

- Keep backward compatibility where possible
- Use existing patterns from other routers
- Follow existing error handling patterns
- Document all new endpoints

