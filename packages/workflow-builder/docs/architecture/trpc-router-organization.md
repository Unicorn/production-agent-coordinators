# tRPC Router Organization Strategy

## Current State

### Router Sizes (as of Phase 1.5)
- Small (< 200 lines): `users.ts`, `workflow-endpoints.ts`, `projectConnectors.ts`
- Medium (200-400 lines): Most routers fall here
- Large (400-600 lines): `workflows.ts` (595), `compiler.ts` (409), `components.ts` (403)
- Very Large (> 600 lines): `execution.ts` (819), `projects.ts` (705)

### Current Organization Pattern
Routers are organized by **domain/entity**:
- `activities.ts` - Activity registry management (CRUD, discovery, tracking)
- `workflows.ts` - Workflow CRUD and deployment
- `execution.ts` - Workflow execution and monitoring
- `components.ts` - Component CRUD
- `compiler.ts` - Code compilation
- `projects.ts` - Project management
- etc.

## Principles for Router Organization

### 1. Domain-Based Organization (Primary)
Group endpoints by business domain/entity:
- ✅ `activities.ts` - Activity registry operations
- ✅ `workflows.ts` - Workflow operations
- ✅ `execution.ts` - Execution operations

### 2. Size Guidelines
- **Target**: 200-400 lines per router
- **Warning**: 400-600 lines - consider splitting
- **Action Required**: > 600 lines - split into sub-routers

### 3. Splitting Strategy

When a router exceeds 600 lines, split by:
1. **Sub-domain** (e.g., `workflows.ts` → `workflows.ts` + `workflow-deployment.ts`)
2. **Operation type** (e.g., `projects.ts` → `projects.ts` + `project-settings.ts`)
3. **User role** (e.g., `users.ts` → `users.ts` + `admin-users.ts`)

### 4. Activity Execution Pattern

**Important**: Activities are executed within Temporal workflows, NOT directly via tRPC.

- ✅ Activities are registered in the registry (`activities.ts` router)
- ✅ Activities are executed within compiled workflows via Temporal
- ❌ Activities should NOT have direct tRPC execution endpoints

**Exception**: If UI needs direct access to activity-like operations (e.g., file system for loading workflows), create separate, focused routers:
- `fileSystem.ts` - UI file operations (if needed)
- `notifications.ts` - UI notification operations (if needed)

These would be **UI helpers**, not activity execution endpoints.

## Current Router Assessment

### ✅ Well-Sized Routers
- `activities.ts` (334 lines) - Registry management, good size
- `components.ts` (403 lines) - Component CRUD, acceptable
- `compiler.ts` (409 lines) - Compilation operations, acceptable

### ⚠️ Routers to Monitor
- `workflows.ts` (595 lines) - Approaching split threshold
- `execution.ts` (819 lines) - **Should be split**

### 🔧 Recommended Splits

#### `execution.ts` (819 lines) → Split into:
1. `execution.ts` - Core execution operations (build, start, status)
2. `execution-monitoring.ts` - Monitoring, history, statistics
3. `execution-results.ts` - Results, outputs, error handling

#### `projects.ts` (705 lines) → Consider splitting:
1. `projects.ts` - Core project CRUD
2. `project-settings.ts` - Settings, configuration, workers

#### `workflows.ts` (595 lines) → Monitor, split if grows:
1. `workflows.ts` - Core workflow CRUD
2. `workflow-deployment.ts` - Deployment operations (if it grows)

## Activity-Specific Considerations

### New Activities (Phase 1.1-1.4)

**File System Activities** (7 activities):
- Executed within workflows (e.g., `readFile`, `writeFile` in workflow steps)
- No direct tRPC endpoints needed
- Registry managed via `activities.ts`

**Command Execution Activities** (4 activities):
- Executed within workflows (e.g., `runBuildCommand` in compilation workflows)
- No direct tRPC endpoints needed
- Registry managed via `activities.ts`

**Git Activities** (4 activities):
- Executed within workflows (e.g., `gitStatus` in deployment workflows)
- No direct tRPC endpoints needed
- Registry managed via `activities.ts`

**Notification Activities** (4 activities):
- Executed within workflows (e.g., `sendSlackNotification` in deployment workflows)
- No direct tRPC endpoints needed
- Registry managed via `activities.ts`

### UI Integration Pattern

If UI needs direct access to activity-like operations:

1. **Create focused UI helper routers** (not activity execution):
   ```typescript
   // fileSystem.ts - UI file operations
   export const fileSystemRouter = createTRPCRouter({
     // Direct file operations for UI (not Temporal activities)
     loadWorkflow: protectedProcedure...,
     saveWorkflow: protectedProcedure...,
     discoverComponents: protectedProcedure...,
   });
   ```

2. **Keep activities separate**:
   - Activities remain in `src/lib/activities/`
   - Activities are registered in `activities.ts` router
   - Activities are executed within workflows

## Implementation Plan

### Phase 1.6: tRPC Integration (Current)

**Decision**: No new routers needed for activity execution.

**Rationale**:
- Activities are executed within Temporal workflows
- Registry management is handled by existing `activities.ts` router
- UI doesn't need direct activity execution endpoints

**Action Items**:
1. ✅ Verify `activities.ts` router handles all registry operations
2. ✅ Ensure activities are properly registered (Phase 1.5 complete)
3. ⏭️ Skip creating execution endpoints (not needed)

### Future Considerations

If UI needs direct file/notification operations:
1. Create `fileSystem.ts` router for UI file operations
2. Create `notifications.ts` router for UI notifications
3. Keep these separate from activity execution

## Best Practices

1. **Keep routers focused** - One domain per router
2. **Monitor size** - Split when > 600 lines
3. **Separate concerns** - Registry management ≠ Activity execution
4. **Follow patterns** - Match existing router organization
5. **Document splits** - Update this doc when splitting routers

## References

- Current routers: `src/server/api/routers/`
- Root router: `src/server/api/root.ts`
- Activity registry: `src/lib/activities/activity-registry.ts`
- Activity implementations: `src/lib/activities/*.activities.ts`

