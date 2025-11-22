# Services, Components, and Connectors Refactor Plan

## Overview

This plan outlines a comprehensive refactoring to improve user experience by:
1. Renaming "workflows" to "services" throughout the UI, code, and database
2. Obfuscating "task queue" terminology with user-friendly naming
3. Implementing a comprehensive interface system (Service Interfaces, Public Interfaces)
4. Building a connector system for project-to-project and third-party integrations
5. Creating reusable connector configuration patterns for components
6. Enhancing the project page with connector management and service visualization

## Naming Changes

### Core Terminology

- **Projects** → No change (already correct)
- **Workflows** → **Services** (user-facing term)
- **Task Queue** → **Execution Channel** (obfuscated term for user-facing UI)
  - Internal code can still use "task_queue" but UI should use "Execution Channel" or "Channel"
  - Alternative names considered: "Channel", "Execution Channel", "Processing Channel"
  - Recommendation: **"Channel"** (short, clear, non-technical)

### Database Schema Changes

#### Tables to Rename/Update

1. **`workflows` table** → Keep table name for backward compatibility, but:
   - Add `service_name` column (computed from `name` or `display_name`)
   - Update all UI references to use "service" terminology
   - Migration strategy: Add new columns, migrate data, deprecate old columns gradually

2. **`task_queues` table** → Keep table name internally, but:
   - Add `channel_name` column for display
   - Update UI to show "Channel" instead of "Task Queue"
   - Internal references can remain as `task_queue` in code

#### Migration Strategy

```sql
-- Phase 1: Add new columns
ALTER TABLE workflows ADD COLUMN service_display_name VARCHAR(255);
ALTER TABLE task_queues ADD COLUMN channel_display_name VARCHAR(255);

-- Phase 2: Populate new columns from existing data
UPDATE workflows SET service_display_name = COALESCE(display_name, name);
UPDATE task_queues SET channel_display_name = COALESCE(display_name, name);

-- Phase 3: Update constraints and indexes
-- Phase 4: Update application code to use new columns
-- Phase 5: (Future) Deprecate old columns
```

## Interface System

### Service Interfaces

**Purpose**: Allow services to communicate with each other within a project.

**Temporal Mapping**:
- Each Temporal workflow callable needs a corresponding interface:
  - `signal` → "Send Action" interface
  - `query` → "Get State" interface  
  - `update` → "Modify State" interface
  - `startChild` → "Start Service" interface (for child workflows)

**Database Schema**:

```sql
CREATE TABLE service_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  interface_type VARCHAR(50) NOT NULL, -- 'signal', 'query', 'update', 'start_child'
  temporal_callable_name VARCHAR(255) NOT NULL, -- The actual Temporal signal/query/update name
  payload_schema JSONB NOT NULL, -- JSON schema for payload validation
  return_schema JSONB, -- JSON schema for return value (queries/updates)
  activity_connection_id UUID REFERENCES components(id), -- Optional: connects to activity
  is_public BOOLEAN DEFAULT false, -- If true, exposed via Kong API
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(service_id, name)
);

CREATE INDEX idx_service_interfaces_service ON service_interfaces(service_id);
CREATE INDEX idx_service_interfaces_type ON service_interfaces(interface_type);
```

**UI Requirements**:
- Show interfaces on service detail page
- Allow adding interfaces when configuring a service
- Display interface type with icon (Send Action, Get State, Modify State, Start Service)
- Show payload schema in interface configuration
- Connect interfaces to activities for processing

### Public Interfaces

**Purpose**: Expose services via RESTful APIs through Kong gateway.

**Implementation**:
- When `is_public = true` on a `service_interface`, automatically create Kong route
- Map Temporal callables to HTTP methods:
  - `signal` → POST `/api/v1/services/{service_id}/actions/{interface_name}`
  - `query` → GET `/api/v1/services/{service_id}/state/{interface_name}`
  - `update` → PATCH `/api/v1/services/{service_id}/state/{interface_name}`

**Authentication**:
- API key authentication (per project or per interface)
- OAuth 2.0 support (future)
- JWT tokens (future)

**Database Schema**:

```sql
CREATE TABLE public_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_interface_id UUID NOT NULL REFERENCES service_interfaces(id) ON DELETE CASCADE,
  kong_route_id VARCHAR(255), -- Kong route identifier
  http_method VARCHAR(10) NOT NULL, -- GET, POST, PATCH, etc.
  http_path VARCHAR(500) NOT NULL, -- API path
  auth_type VARCHAR(50) DEFAULT 'api_key', -- 'api_key', 'oauth2', 'jwt', 'none'
  auth_config JSONB, -- Auth-specific configuration
  rate_limit_per_minute INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_public_interfaces_service_interface ON public_interfaces(service_interface_id);
```

### Receive API Data Interface

**Purpose**: Allow services to receive data via POST endpoints.

**Component Type**: Special interface component that:
- Automatically creates Kong POST endpoint
- Maps to a Temporal signal
- Shows endpoint URL on service view page
- Configurable in component settings

**Implementation**:
- New component type: `receive_api_data`
- When added to service, creates:
  1. Service interface (type: `signal`)
  2. Public interface (POST endpoint)
  3. Kong route configuration

### Query API Data Interface

**Purpose**: Allow external systems to query service state or trigger actions that return data.

**Component Type**: Special interface component that:
- Creates GET endpoint via Kong
- Can return data from:
  - State variable (Temporal query)
  - Activity result (Temporal signal + activity)
- Configurable return source

**Implementation**:
- New component type: `query_api_data`
- Configuration options:
  - Return source: "state" or "activity"
  - State variable name (if state)
  - Activity component (if activity)
  - Return schema

## Project Interfaces / Connectors

**Decision**: Use term **"Connector"** for cross-project communication.

**Purpose**: Allow projects to call services in other projects via Temporal Nexus.

**Database Schema**:

```sql
CREATE TABLE project_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_service_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  target_interface_id UUID NOT NULL REFERENCES service_interfaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  nexus_endpoint_name VARCHAR(255) NOT NULL, -- Nexus endpoint identifier
  visibility VARCHAR(50) DEFAULT 'private', -- 'private', 'public', 'organization'
  auth_config JSONB, -- Auth configuration if public
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_project_id, name)
);

CREATE INDEX idx_project_connectors_source ON project_connectors(source_project_id);
CREATE INDEX idx_project_connectors_target ON project_connectors(target_project_id);
```

**Implementation**:
- Use Temporal Nexus for cross-project calls
- UI: Connector selector in component configuration
- When public: Requires auth system (API keys, OAuth)

## Connectors (Third-Party)

**Purpose**: Connect to external services (SendGrid, Slack, databases, APIs).

**Database Schema**:

```sql
CREATE TABLE connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  connector_type VARCHAR(100) NOT NULL, -- 'email', 'slack', 'database', 'api', 'oauth'
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  config_schema JSONB NOT NULL, -- JSON schema for configuration
  config_data JSONB NOT NULL, -- Encrypted configuration data
  credentials_encrypted BYTEA, -- Encrypted credentials (API keys, passwords, tokens)
  oauth_config JSONB, -- OAuth configuration if applicable
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, connector_type, name)
);

CREATE INDEX idx_connectors_project ON connectors(project_id);
CREATE INDEX idx_connectors_type ON connectors(connector_type);
```

**Connector Types**:
- `email` - SendGrid, SMTP, etc.
- `slack` - Slack webhooks, bot tokens
- `database` - PostgreSQL, MySQL, etc.
- `api` - Generic REST API
- `oauth` - OAuth 2.0 providers

**Security**:
- Encrypt credentials at rest
- Use environment variables for sensitive data
- Support OAuth flow for OAuth connectors

## Component Connector Pattern

### Reusable Connector Configuration

**Pattern**: All components that need connectors follow the same configuration pattern.

**Component Configuration Schema**:

```typescript
interface ComponentConnectorConfig {
  connectorType: string; // 'email', 'slack', 'database', etc.
  connectorId?: string; // Selected connector ID
  allowNewConnector: boolean; // Can create new connector from component
}
```

**UI Pattern**:

1. **Component Configuration Panel**:
   - If component requires connector, show connector selector
   - Dropdown: "Select Connector" or "Create New Connector"
   - If "Create New Connector", open connector creation modal
   - Show selected connector name and type

2. **Connector Creation Modal**:
   - Type selector (email, slack, database, etc.)
   - Type-specific configuration form
   - Test connection button
   - Save to project

3. **Component State**:
   - Each component node stores `connector_id` in its config
   - When connector is selected, component config updated
   - When new connector created, automatically selected

### Components Requiring Connectors

1. **Send Notification Component**:
   - Connector type: `email` or `slack`
   - Notification type selector in component
   - Connector selector based on notification type
   - Multiple connectors per type supported

2. **Save to Database Component**:
   - Connector type: `database`
   - Database connector selector
   - Table/collection selector
   - Field mapping configuration

3. **Read from Database Component**:
   - Connector type: `database`
   - Database connector selector
   - Query builder or SQL input

4. **Fetch API Data Component**:
   - Connector type: `api`
   - API connector selector
   - Endpoint configuration
   - Request method, headers, body

## Project Page Enhancements

### Connector Management Section

**Location**: New tab on project detail page: "Connectors"

**Layout** (using design UI designer principles):
- Group connectors by type
- Card-based layout
- Each connector card shows:
  - Type icon
  - Name and description
  - Status (active/inactive)
  - Last used timestamp
  - Actions: Edit, Test, Delete

**Connector Types Section**:
```
┌─────────────────────────────────────┐
│ Email Connectors (2)                │
├─────────────────────────────────────┤
│ [Card] SendGrid Production          │
│ [Card] SendGrid Development         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Database Connectors (1)             │
├─────────────────────────────────────┤
│ [Card] Main PostgreSQL              │
└─────────────────────────────────────┘
```

### Service Connection Visualization

**Feature**: React Flow diagram showing services and their connections.

**Visualization**:
- Each service as a node
- Service-to-service connections as edges (when interfaces are used)
- Color coding:
  - Services: Blue nodes
  - Interfaces: Green connection points
  - Connectors: Orange connection points
  - External APIs: Gray connection points

**Implementation**:
- Use React Flow (already in use)
- Query service interfaces and connectors
- Build graph of connections
- Interactive: Click nodes to navigate to service
- Show interface names on edges

**Data Model**:
```typescript
interface ServiceConnectionGraph {
  nodes: Array<{
    id: string; // service_id
    type: 'service';
    data: {
      serviceId: string;
      serviceName: string;
      interfaces: Array<ServiceInterface>;
    };
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string; // source service_id
    target: string; // target service_id
    sourceHandle: string; // interface_id
    targetHandle: string; // interface_id
    label: string; // interface name
  }>;
}
```

## Inside/Outside Service Visualization

**See**: `2025-01-20-inside-outside-service-visualization.md` for detailed implementation plan.

**Key Concept**: Visualize services with clear inside/outside boundaries:
- **What comes INTO a service** (interfaces, connectors from outside)
- **What happens INSIDE a service** (components, flow, logic)
- **What goes OUT of a service** (interfaces, connectors to outside)

**Two Views**:
1. **Service Builder View**: Single service with zone-based layout showing all boundaries
2. **Project View**: Multiple services showing how they connect

**Benefits**:
- Makes it easier to build complex applications as multiple services
- Clear service boundaries help with setup, testing, monitoring, and optimization
- Visual distinction between interfaces (service-to-service) and connectors (external)

## Implementation Tasks

### Phase 1: Naming Changes

- [ ] Add `service_display_name` column to `workflows` table
- [ ] Add `channel_display_name` column to `task_queues` table
- [ ] Update all UI components to use "Service" instead of "Workflow"
- [ ] Update all UI components to use "Channel" instead of "Task Queue"
- [ ] Update API routes and tRPC routers
- [ ] Update TypeScript types
- [ ] Update documentation

### Phase 2: Service Interfaces

- [ ] Create `service_interfaces` table migration
- [ ] Create `public_interfaces` table migration
- [ ] Implement service interface CRUD API
- [ ] Add interface management UI to service detail page
- [ ] Implement Kong route creation for public interfaces
- [ ] Create "Receive API Data" component
- [ ] Create "Query API Data" component
- [ ] Map Temporal callables to interfaces

### Phase 3: Connectors System

- [ ] Create `connectors` table migration
- [ ] Create `project_connectors` table migration
- [ ] Implement connector CRUD API
- [ ] Implement connector encryption/decryption
- [ ] Create connector management UI on project page
- [ ] Implement connector selector component
- [ ] Create connector creation modal
- [ ] Implement connector test functionality

### Phase 4: Component Connector Pattern

- [ ] Create reusable `ConnectorSelector` component
- [ ] Create reusable `ConnectorCreationModal` component
- [ ] Update "Send Notification" component with connector support
- [ ] Update "Save to Database" component with connector support
- [ ] Update "Read from Database" component with connector support
- [ ] Update "Fetch API Data" component with connector support
- [ ] Store connector_id in component node config

### Phase 5: Project Page Enhancements

- [ ] Design connector management UI (using design UI designer)
- [ ] Implement connector management tab
- [ ] Implement service connection graph visualization (Project View)
- [ ] Query service interfaces and connectors for graph
- [ ] Build React Flow graph component
- [ ] Add interactivity (click to navigate)
- [ ] Implement Service Builder View with zone-based layout
- [ ] Create ServiceContainerNode component
- [ ] Implement zone boundaries (top, left, center, right, bottom)
- [ ] Add port system for interfaces and connectors
- [ ] Implement navigation between Project View and Service Builder View

### Phase 6: Authentication & Security

- [ ] Implement API key generation for public interfaces
- [ ] Implement API key authentication middleware
- [ ] Add OAuth 2.0 support (future)
- [ ] Encrypt connector credentials
- [ ] Implement connector access control

## Database Migration Order

1. Add new columns to existing tables (backward compatible)
2. Create `service_interfaces` table
3. Create `public_interfaces` table
4. Create `connectors` table
5. Create `project_connectors` table
6. Populate new columns from existing data
7. Update application code
8. (Future) Deprecate old columns

## UI/UX Design Considerations

### Design Principles (from design UI designer)

- **Accessibility**: WCAG AA compliance
- **Clarity**: Clear labels and descriptions
- **Consistency**: Reusable component patterns
- **Feedback**: Clear success/error states
- **Progressive Disclosure**: Show advanced options when needed

### Component Design

- Use Tamagui components (existing design system)
- Follow existing color scheme and spacing
- Use icons from lucide-react
- Responsive design for mobile/tablet

## Testing Strategy

- [ ] Unit tests for database migrations
- [ ] Integration tests for interface creation
- [ ] Integration tests for connector management
- [ ] E2E tests for service-to-service communication
- [ ] E2E tests for public interface API calls
- [ ] Security tests for credential encryption

## Documentation Updates

- [ ] Update architecture documentation
- [ ] Create user guide for connectors
- [ ] Create developer guide for interfaces
- [ ] Update API documentation
- [ ] Create migration guide for existing users

## Rollout Strategy

1. **Phase 1** (Naming): Non-breaking, can deploy immediately
2. **Phase 2-3** (Interfaces & Connectors): Feature flag for gradual rollout
3. **Phase 4** (Component Pattern): Update components incrementally
4. **Phase 5** (UI Enhancements): Can deploy independently
5. **Phase 6** (Security): Critical, deploy after thorough testing

## Open Questions

1. **Task Queue Obfuscation Name**: 
   - Options: "Channel", "Execution Channel", "Processing Channel"
   - **Recommendation**: "Channel" (shortest, clearest)

2. **Project Connector Naming**:
   - Options: "Connector", "Interface", "Link"
   - **Decision**: "Connector" (consistent with third-party connectors)

3. **Public Interface Auth**:
   - Initial: API keys
   - Future: OAuth 2.0, JWT

4. **Connector Encryption**:
   - Use Supabase Vault for encryption
   - Or application-level encryption with environment key

5. **Service Connection Graph**:
   - Auto-layout algorithm (dagre, elkjs)
   - Or manual positioning with save

## Success Metrics

- [ ] All "workflow" references changed to "service" in UI
- [ ] All "task queue" references changed to "channel" in UI
- [ ] Service interfaces functional for service-to-service communication
- [ ] Public interfaces accessible via Kong API
- [ ] Connectors manageable from project page
- [ ] Components can select and use connectors
- [ ] Service connection graph displays correctly

