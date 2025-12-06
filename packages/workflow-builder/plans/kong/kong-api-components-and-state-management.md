---
name: Kong API Components and Enhanced State Management
overview: Add Kong API gateway components (CORS, GraphQL, REST enhancements, MCP, Logging, Caching) and enhance state variable management with project-level, service-level, and data-store backed options. Include monitoring, alerting, and UI tooltips to guide users on best practices.
todos: []
---

# Kong API Components and Enhanced State Management

Add Kong API gateway components and enhance state variable management with comprehensive options for project-level, service-level, and data-store backed state.

## Overview

This plan extends the workflow builder with:

1. **Kong API Gateway Components**: CORS, GraphQL, REST enhancements, MCP (Model Context Protocol), Logging, Caching
2. **Enhanced State Variables**: Project-level, service-level, and data-store backed options
3. **Component Discovery**: Proper categorization and integration into component library
4. **UI Integration**: Project/service visualizations, property panels, validation
5. **Monitoring & Alerting**: State variable limits, best practices guidance, tooltips

## 1. Kong API Gateway Components

### 1.1 Logging Component

**Component Type**: `kong-logging` (new type)

**Category**: `api-gateway` (API gateway configuration)

**Scope**: Project-level (visible on all services in project once added)

**Features**:

- Configure logging destination via connectors
- Maps to Kong logging plugins (HTTP Log, Syslog, File Log, TCP/UDP Log)
- Project-level component: once added to any service, visible on all services in project
- **Connector Required**: Must select connector when adding component to React Flow UI
- Logging settings in component property panel list all data-in/data-out components with checkboxes
- Each data-in/data-out component has checkbox in its property panel to enable/disable logging
- Bidirectional sync: changes in logging component update data-in/data-out checkboxes and vice versa
- Visual note on component: "Project-level: Applies to all services in this project"

**Connector Requirements**:

- Requires connector selection when adding to React Flow UI (blocking - cannot add without connector)
- Connector classifications: `http-log`, `syslog`, `file-log`, `tcp-log`, `udp-log`
- Connector classification system needed (see section 1.6)
- Connector selector filters by classification type

**Files to Create/Modify**:

- Migration: `supabase/migrations/[timestamp]_add_kong_component_types.sql`
  - Add `kong-logging` to `component_types`
- `src/components/workflow/nodes/KongLoggingNode.tsx` - React Flow node
  - Display project-level indicator/badge prominently
  - Show note: "Project-level: Applies to all services in this project"
  - Show connector name if configured
- `src/lib/kong/logging-config.ts` - Logging configuration manager
- `src/lib/kong/client.ts` - Add logging plugin methods (`enableHttpLogPlugin`, `enableSyslogPlugin`, etc.)
- `src/lib/compiler/patterns/kong-logging.ts` - Compiler pattern
- `src/components/workflow-builder/NodePropertyPanel.tsx` - Logging property panel
  - Connector selector (required, filtered by logging classification)
  - List of all data-in/data-out components in project with checkboxes
  - Real-time sync with data-in/data-out component checkboxes
- `src/components/workflow/nodes/DataInNode.tsx` - Add logging checkbox (if logging component exists)
- `src/components/workflow/nodes/DataOutNode.tsx` - Add logging checkbox (if logging component exists)
- `src/components/workflow-builder/NodePropertyPanel.tsx` - Add logging checkbox to data-in/data-out panels
  - Checkbox only visible if project has logging component
  - Updates logging component configuration when toggled

**Database Schema**:

- Migration: Add `project_logging_config` table
  - `id`, `project_id`, `connector_id`, `logging_component_id`, `enabled_endpoints` (JSONB array of endpoint IDs), `created_at`, `updated_at`
  - Unique constraint on `project_id` (one logging config per project)
- Migration: Add `logging_enabled` boolean to `public_interfaces` table
  - Track which endpoints have logging enabled
  - Default: `false`

**Kong Integration**:

- When logging component is configured, enable appropriate Kong logging plugin on routes
- Plugin config includes connector endpoint/credentials from connector config
- Store logging config in `public_interfaces.logging_config` JSON field
- On deploy, enable logging plugin on all routes for endpoints with `logging_enabled = true`

### 1.2 Caching Component

**Component Type**: `kong-cache` (new type)

**Category**: `api-gateway` (API gateway configuration)

**Features**:

- Proxy caching using Kong Proxy Cache plugin
- Requires Redis connector (via connector classification system)
- **Connector Required**: Must select Redis connector when adding component to React Flow UI
- Cache key: auto-generated with random UUID when component is added to UI, editable until save, immutable after save
- Key removal: removing component marks key for deletion, removed from Redis on next deploy
- Configuration: TTL, cache key strategy, content types, response codes
- **Comprehensive Testing**: All cache key lifecycle operations must be thoroughly tested

**Connector Requirements**:

- Requires Redis connector (identified via connector classification)
- Connector classification system needed (see section 1.3)
- Components query for connectors by classification (e.g., "redis")
- **Upstash connector must be classified as "redis"** - this is a metadata/classification update to the connector system
- Connector selector filters by "redis" classification
- Currently only Upstash is available as Redis connector, but system supports any Redis-compatible connector

**Files to Create/Modify**:

- Migration: Add `kong-cache` to `component_types`
- `src/components/workflow/nodes/KongCacheNode.tsx` - React Flow node
- `src/lib/kong/cache-config.ts` - Cache configuration manager
  - Cache key generation (random UUID-based)
  - Key validation and immutability enforcement
- `src/lib/kong/client.ts` - Add `enableCachePlugin()` method
- `src/lib/compiler/patterns/kong-cache.ts` - Compiler pattern
  - Handle cache key deletion on component removal
- `src/components/workflow-builder/NodePropertyPanel.tsx` - Cache property panel
  - Redis connector selector (required, filtered by "redis" classification)
  - Cache key field (auto-generated, editable until save, read-only after save)
  - TTL, content types, response codes configuration
- `src/lib/validation/kong-validation.ts` - Validate cache key immutability

**Database Schema**:

- Migration: Add `cache_keys` table for tracking
  - `id`, `component_id`, `cache_key`, `connector_id`, `created_at`, `marked_for_deletion`
- Migration: Add `cache_config` JSONB to `public_interfaces` table

**Key Management**:

- Auto-generate cache key on component add to React Flow UI: `cache-${randomUUID().substring(0, 8)}`
- Store in component config (not yet in database), allow editing until first save
- **Key is only written to data store when component is saved** (workflow save operation)
- After save, mark as `saved: true` in database and make field read-only in UI
- **Once saved, key cannot be changed** - user must remove component to change key
- On component removal, mark key as `marked_for_deletion: true` in database
- On next deploy, remove keys marked for deletion from Redis data store
- **Comprehensive testing required** for:
  - Key generation on component add
  - Key editing before save
  - Key immutability after save
  - Key deletion on component removal
  - Key cleanup on deploy

### 1.3 Connector Classification System

**Purpose**: Allow components to query connectors by type/classification (e.g., "redis", "logging"). This is a metadata/classification system that extends beyond the existing connector grouping system.

**Scope**: This is an update to the datastore connector types and connectors in general - a classification or metadata style update that is outside of the grouping we have, allowing components to query for specific types of connectors.

**Database Schema**:

- Migration: Add `connector_classifications` table
  - `id`, `connector_id`, `classification` (e.g., "redis", "http-log", "syslog"), `created_at`
  - Index on `(connector_id, classification)`
  - Index on `classification` for fast queries
- Migration: Add `classifications` JSONB array to `connectors` table (denormalized for performance)
  - Store classifications directly on connector for fast queries
  - Default: `[]` (empty array)

**Files to Create/Modify**:

- `src/lib/connectors/classifications.ts` - Connector classification utilities
  - `getConnectorsByClassification(projectId, classification)` - Query connectors by classification
  - `addClassification(connectorId, classification)` - Add classification to connector
  - `removeClassification(connectorId, classification)` - Remove classification
  - `getConnectorClassifications(connectorId)` - Get all classifications for a connector
- `src/server/api/routers/connectors.ts` - Add classification endpoints
  - `getByClassification` - Query by classification (returns connectors with matching classification)
  - `addClassification` - Add classification to connector
  - `removeClassification` - Remove classification from connector
- `src/components/connector/ConnectorSelector.tsx` - Support classification filtering
  - Add `classification` prop to filter connectors by classification
  - Show only connectors matching the classification
- Migration: Update existing Upstash connectors to have "redis" classification
  - Find all connectors with name/type matching Upstash Redis
  - Add "redis" classification to them

**Classification Types**:

- `redis` - Redis-compatible connectors (Upstash, Redis Cloud, etc.)
  - **Upstash must be classified as "redis"** for caching component to work
- `http-log` - HTTP logging endpoints (for Kong logging component)
- `syslog` - Syslog servers (for Kong logging component)
- `file-log` - File logging (local filesystem, for Kong logging component)
- `tcp-log` - TCP logging endpoints (for Kong logging component)
- `udp-log` - UDP logging endpoints (for Kong logging component)

**Implementation Notes**:

- Classification is separate from connector type/grouping
- A connector can have multiple classifications
- Classifications are metadata that describe connector capabilities
- Components query for connectors by classification to find compatible connectors

**Upstash Redis Connector Details** (from package-components plan):

- **Connector Type**: `database` (or new `redis` type)
- **Connector Configuration**:
  - Upstash REST API URL
  - Upstash REST API token
  - Optional: Redis URL (for direct connection)
- **Connector Name**: `upstash-redis`
- **Classification**: Must be classified as `redis` for caching component compatibility
- **Current State**: Basic Redis command component exists at `packages/workflow-builder/src/lib/components/redis-activity.ts`
- **Enhancement Needed**: Add Upstash-specific features (REST API support, serverless optimizations)

### 1.4 CORS Component

**Component Type**: `kong-cors` (new type)

**Category**: `connect-external` (API gateway configuration)

**Features**:

- Configure CORS headers for API endpoints
- Maps to Kong CORS plugin
- Can be attached to data-in/data-out components or service interfaces
- Configuration: allowed origins, methods, headers, credentials, max-age

**Files to Create/Modify**:

- Migration: `supabase/migrations/[timestamp]_add_kong_component_types.sql`
  - Add `kong-cors` to `component_types`
- `src/components/workflow/nodes/KongCorsNode.tsx` - React Flow node
- `src/lib/kong/cors-config.ts` - CORS configuration manager
- `src/lib/kong/client.ts` - Add `enableCorsPlugin()` method
- `src/lib/compiler/patterns/kong-cors.ts` - Compiler pattern
- `src/components/workflow-builder/NodePropertyPanel.tsx` - CORS property panel

**Kong Integration**:

- When CORS component is connected to data-in/data-out, enable CORS plugin on the Kong route
- Store CORS config in `public_interfaces.cors_config` JSON field

### 1.5 GraphQL Component

**Component Type**: `graphql-gateway` (new type)

**Category**: `provide-data` (GraphQL queries) or `receive-data` (GraphQL mutations)

**Features**:

- GraphQL endpoint configuration
- Schema definition and validation
- Query/mutation resolvers mapping to Temporal workflows
- Maps to Kong GraphQL plugin or custom GraphQL handler

**Files to Create/Modify**:

- Migration: Add `graphql-gateway` to `component_types`
- `src/components/workflow/nodes/GraphQLNode.tsx` - React Flow node
- `src/lib/graphql/schema-builder.ts` - GraphQL schema generation
- `src/lib/graphql/resolver-mapper.ts` - Map resolvers to workflows
- `src/lib/kong/graphql-handler.ts` - GraphQL request handler
- `src/lib/compiler/patterns/graphql-gateway.ts` - Compiler pattern
- `src/app/api/graphql/route.ts` - GraphQL endpoint handler

**GraphQL Schema Storage**:

- Store GraphQL schema in `service_interfaces.graphql_schema` JSON field
- Generate TypeScript types from schema

### 1.6 REST API Enhancements

**Enhancement to existing `data-in`/`data-out` components**:

- Add REST-specific configuration (versioning, content negotiation, HATEOAS)
- Request/response transformation components
- API documentation generation (OpenAPI/Swagger)

**Files to Modify**:

- `src/components/component/ComponentForm.tsx` - Add REST-specific fields
- `src/lib/kong/rest-enhancements.ts` - REST feature manager
- `src/lib/openapi/generator.ts` - OpenAPI spec generation
- `src/components/project/ProjectEndpointsList.tsx` - Show OpenAPI docs link

### 1.7 MCP (Model Context Protocol) Component

**Component Type**: `mcp-server` (new type)

**Category**: `connect-external` (external protocol integration)

**Features**:

- MCP server endpoint configuration
- Resource and tool definitions
- Maps to Temporal workflows as MCP handlers
- Kong route with MCP protocol support

**Files to Create/Modify**:

- Migration: Add `mcp-server` to `component_types`
- `src/components/workflow/nodes/McpServerNode.tsx` - React Flow node
- `src/lib/mcp/server-builder.ts` - MCP server implementation
- `src/lib/mcp/resource-handler.ts` - MCP resource handlers
- `src/lib/mcp/tool-handler.ts` - MCP tool handlers
- `src/lib/compiler/patterns/mcp-server.ts` - Compiler pattern
- `src/app/api/mcp/route.ts` - MCP endpoint handler

**MCP Configuration Storage**:

- Store MCP config in `service_interfaces.mcp_config` JSON field
- Resources and tools defined in component config

## 2. Enhanced State Variable Management

### 2.1 State Variable Scope Options

**Enhancement to existing `state-variable` component**:

- Add scope selection: `workflow` (service-level) or `project` (project-level)
- Add storage type: `workflow` (in-memory), `database`, `redis`, `external`
- Variable selection: create new or reference existing

**Files to Modify**:

- `src/components/workflow/nodes/StateVariableNode.tsx` - Add scope/storage UI
- `src/components/workflow-builder/NodePropertyPanel.tsx` - Enhanced state variable panel
- `src/lib/compiler/patterns/state-management.ts` - Handle different storage types
- `src/lib/state/project-state-manager.ts` - Project-level state management
- `src/lib/state/storage-adapters.ts` - Database/Redis adapters

**Database Schema**:

- Migration: Add `project_state_variables` table
  - `id`, `project_id`, `name`, `type`, `storage_type`, `storage_config`, `schema`, `created_at`, `updated_at`
- Migration: Add `workflow_state_variables` table (if not exists)
  - `id`, `workflow_id`, `name`, `type`, `storage_type`, `storage_config`, `schema`, `created_at`, `updated_at`

### 2.2 State Variable Storage Adapters

**Storage Types**:

1. **Workflow State** (default): In-memory Temporal workflow state
2. **Database**: PostgreSQL-backed state (via Supabase)
3. **Redis**: Redis-backed state for high-performance access
4. **External**: Custom storage adapter

**Files to Create**:

- `src/lib/state/storage-adapters/workflow-state.ts` - Temporal workflow state
- `src/lib/state/storage-adapters/database-state.ts` - PostgreSQL state
- `src/lib/state/storage-adapters/redis-state.ts` - Redis state
- `src/lib/state/storage-adapters/external-state.ts` - External adapter interface
- `src/lib/state/state-factory.ts` - Factory for creating storage adapters

### 2.3 State Variable Selection UI

**Component**: State Variable Selector

- Show existing variables (project-level and service-level)
- Filter by scope and storage type
- Create new variable option
- Variable preview (type, size, last updated)

**Files to Create**:

- `src/components/state/StateVariableSelector.tsx` - Variable selection component
- `src/components/state/StateVariableCreator.tsx` - Variable creation modal
- `src/server/api/routers/stateVariables.ts` - State variable CRUD operations

## 3. Component Categorization

### 3.1 New Categories

**Add to `src/lib/component-categorization.ts`**:

- **API Gateway** (`api-gateway`): Kong-specific components (CORS, GraphQL, MCP, Logging, Caching)
  - Keywords: `kong`, `cors`, `graphql`, `mcp`, `gateway`, `api-gateway`, `logging`, `cache`
- **State Management** (`state-management`): State variables and storage
  - Keywords: `state`, `variable`, `storage`, `database`, `redis`, `persist`

### 3.2 Category Updates

**Update existing categories**:

- `receive-data`: Add GraphQL mutations, MCP resources
- `provide-data`: Add GraphQL queries, MCP tools
- `connect-external`: Add API gateway components

## 4. UI Integration

### 4.1 Component Property Panels

**Files to Modify**:

- `src/components/workflow-builder/NodePropertyPanel.tsx`
  - Add panels for: KongLoggingNode, KongCacheNode, KongCorsNode, GraphQLNode, McpServerNode
  - Enhanced StateVariableNode panel with scope/storage selection

**Property Panel Features**:

- Logging: Connector selector, endpoint checkboxes, bidirectional sync
- Caching: Redis connector selector, cache key (immutable after save), TTL, content types
- CORS: Origin whitelist, methods, headers, credentials
- GraphQL: Schema editor, resolver mapping, query complexity limits
- MCP: Resource definitions, tool definitions, protocol version
- State Variable: Scope selector, storage type, variable selector, size limits

### 4.2 Project Visualization

**Files to Modify**:

- `src/components/service/ProjectView.tsx`
  - Show API gateway components as interface decorations
  - Display state variables (project-level) in project overview
  - Show connections between services via shared state variables
  - Show project-level logging component if exists

- `src/components/service/ServiceBuilderView.tsx`
  - Show Kong components attached to interfaces
  - Display state variables (service-level and project-level)
  - Visual indicators for storage type (icon for database, Redis, etc.)
  - Show logging checkbox on data-in/data-out nodes

### 4.3 Component Discovery

**Files to Modify**:

- `src/components/workflow-builder/NodeTypesPalette.tsx`
  - Add Kong components to palette
  - Filter by category (API Gateway, State Management)
  - Show component descriptions and use cases

## 5. Validation and Compilation

### 5.1 Kong Component Validation

**Files to Create**:

- `src/lib/validation/kong-validation.ts`
  - Validate logging component has connector selected
  - Validate cache component has Redis connector and valid cache key
  - Validate CORS component is connected to data-in/data-out
  - Validate GraphQL schema syntax
  - Validate MCP resource/tool definitions
  - Check Kong route configuration

**Files to Modify**:

- `src/lib/validation/workflow-validator.ts`
  - Add Kong component validation
  - Validate state variable references (project-level variables must exist)
  - Validate cache key immutability

### 5.2 Compiler Integration

**Files to Create/Modify**:

- `src/lib/compiler/patterns/kong-logging.ts` - Generate Kong logging plugin config
- `src/lib/compiler/patterns/kong-cache.ts` - Generate Kong cache plugin config and handle key deletion
- `src/lib/compiler/patterns/kong-cors.ts` - Generate Kong CORS plugin config
- `src/lib/compiler/patterns/graphql-gateway.ts` - Generate GraphQL handler code
- `src/lib/compiler/patterns/mcp-server.ts` - Generate MCP server code
- `src/lib/compiler/patterns/state-management.ts` - Enhanced for storage types
- `src/lib/compiler/index.ts` - Register new patterns

**Compilation Output**:

- Kong plugin configurations
- GraphQL schema and resolvers
- MCP server implementation
- State variable access code (with storage adapter calls)
- Cache key cleanup on component removal

## 6. Monitoring and Alerting

### 6.1 State Variable Monitoring

**Database Schema**:

- Migration: Add `state_variable_metrics` table
  - `id`, `variable_id`, `scope` (project/workflow), `size_bytes`, `access_count`, `last_accessed`, `created_at`

**Files to Create**:

- `src/lib/monitoring/state-monitor.ts` - State variable monitoring
- `src/lib/monitoring/state-alerts.ts` - Alert generation
- `src/server/api/routers/stateMonitoring.ts` - Monitoring API

**Metrics Tracked**:

- Variable size (bytes)
- Access frequency
- Storage type performance
- Cost implications (database vs Redis vs workflow state)

### 6.2 Alerting System

**Alert Types**:

1. **Size Warning**: Variable approaching size limit (80% threshold)
2. **Size Critical**: Variable exceeds recommended size
3. **Performance Warning**: High access frequency suggests Redis might be better
4. **Cost Warning**: Database storage for frequently accessed small data
5. **Best Practice**: Suggestions for optimization

**Files to Create**:

- `src/lib/alerts/state-alerts.ts` - Alert definitions
- `src/components/monitoring/StateVariableAlerts.tsx` - Alert display component
- `src/components/monitoring/StateVariableMetrics.tsx` - Metrics dashboard

### 6.3 UI Tooltips and Guidance

**Files to Modify**:

- `src/components/workflow/nodes/StateVariableNode.tsx`
  - Add tooltip explaining scope options
  - Show storage type recommendations
  - Display current size and limits

- `src/components/workflow-builder/NodePropertyPanel.tsx`
  - Add help text for each configuration option
  - Show best practice recommendations
  - Display cost/performance implications

**Tooltip Content**:

- **Workflow State**: "Fast, in-memory state. Best for temporary data. Limited by workflow history size."
- **Database State**: "Persistent, queryable state. Best for large data or cross-workflow access. Higher latency."
- **Redis State**: "High-performance, cached state. Best for frequently accessed data. Additional infrastructure cost."
- **Project Scope**: "Shared across all services in project. Use for cross-service coordination."
- **Service Scope**: "Isolated to this service. Use for service-specific state."

## 7. Database Migrations

### 7.1 Component Types

```sql
-- Add Kong component types
INSERT INTO component_types (name, description, icon) VALUES
  ('kong-logging', 'Logging configuration for API endpoints (project-level)', 'file-text'),
  ('kong-cache', 'Proxy caching for API endpoints', 'database'),
  ('kong-cors', 'CORS configuration for API endpoints', 'globe'),
  ('graphql-gateway', 'GraphQL API gateway endpoint', 'network'),
  ('mcp-server', 'Model Context Protocol server endpoint', 'bot')
ON CONFLICT (name) DO NOTHING;
```

### 7.2 Connector Classifications

```sql
-- Connector classifications table
CREATE TABLE connector_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  classification TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connector_id, classification)
);

CREATE INDEX idx_connector_classifications_classification ON connector_classifications(classification);
CREATE INDEX idx_connector_classifications_connector ON connector_classifications(connector_id);

-- Add classifications column to connectors table (denormalized for performance)
ALTER TABLE connectors 
  ADD COLUMN IF NOT EXISTS classifications JSONB DEFAULT '[]'::jsonb;

-- Insert classifications for existing Upstash connectors
INSERT INTO connector_classifications (connector_id, classification)
SELECT id, 'redis'
FROM connectors
WHERE name ILIKE '%upstash%' 
   OR name ILIKE '%redis%'
   OR connector_type = 'redis'
ON CONFLICT (connector_id, classification) DO NOTHING;

-- Update classifications JSONB column to match
UPDATE connectors
SET classifications = (
  SELECT COALESCE(jsonb_agg(classification), '[]'::jsonb)
  FROM connector_classifications
  WHERE connector_classifications.connector_id = connectors.id
)
WHERE EXISTS (
  SELECT 1 FROM connector_classifications 
  WHERE connector_classifications.connector_id = connectors.id
);
```

### 7.3 Logging Configuration

```sql
-- Project logging configuration
CREATE TABLE project_logging_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  logging_component_id UUID NOT NULL,
  enabled_endpoints JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Add logging fields to public_interfaces
ALTER TABLE public_interfaces 
  ADD COLUMN IF NOT EXISTS logging_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS logging_config JSONB;
```

### 7.4 Caching Configuration

```sql
-- Cache keys tracking
CREATE TABLE cache_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL,
  cache_key TEXT NOT NULL,
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  saved BOOLEAN DEFAULT false,
  marked_for_deletion BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(component_id, cache_key)
);

-- Add cache config to public_interfaces
ALTER TABLE public_interfaces 
  ADD COLUMN IF NOT EXISTS cache_config JSONB;
```

### 7.5 State Variable Tables

```sql
-- Project-level state variables
CREATE TABLE project_state_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'string', 'number', 'boolean', 'object', 'array'
  storage_type TEXT NOT NULL, -- 'workflow', 'database', 'redis', 'external'
  storage_config JSONB,
  schema JSONB, -- JSON schema for validation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Workflow-level state variables (if not exists)
CREATE TABLE IF NOT EXISTS workflow_state_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  storage_type TEXT NOT NULL,
  storage_config JSONB,
  schema JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workflow_id, name)
);

-- State variable metrics
CREATE TABLE state_variable_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_id UUID NOT NULL,
  scope TEXT NOT NULL, -- 'project' or 'workflow'
  size_bytes BIGINT,
  access_count BIGINT DEFAULT 0,
  last_accessed TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.6 Service Interface Extensions

```sql
-- Add Kong-specific config fields to public_interfaces
ALTER TABLE public_interfaces 
  ADD COLUMN IF NOT EXISTS cors_config JSONB,
  ADD COLUMN IF NOT EXISTS graphql_schema JSONB,
  ADD COLUMN IF NOT EXISTS mcp_config JSONB;
```

## 8. Testing

### 8.1 Test Files to Create

- `src/lib/kong/__tests__/logging-config.test.ts`
- `src/lib/kong/__tests__/cache-config.test.ts`
- `src/lib/kong/__tests__/cors-config.test.ts`
- `src/lib/graphql/__tests__/schema-builder.test.ts`
- `src/lib/mcp/__tests__/server-builder.test.ts`
- `src/lib/connectors/__tests__/classifications.test.ts`
- `src/lib/state/__tests__/storage-adapters.test.ts`
- `src/lib/state/__tests__/project-state-manager.test.ts`
- `src/lib/monitoring/__tests__/state-monitor.test.ts`
- `src/components/workflow/nodes/__tests__/KongLoggingNode.test.tsx`
- `src/components/workflow/nodes/__tests__/KongCacheNode.test.tsx`
- `src/components/workflow/nodes/__tests__/KongCorsNode.test.tsx`
- `src/components/workflow/nodes/__tests__/GraphQLNode.test.tsx`
- `src/components/workflow/nodes/__tests__/McpServerNode.test.tsx`

### 8.2 Key Testing Scenarios

**Logging Component**:
- **Connector selection required** when adding component to React Flow UI (blocking)
- Project-level visibility across all services in project
- Logging settings panel lists all data-in/data-out components with checkboxes
- Each data-in/data-out component has checkbox that syncs bidirectionally
- Visual note on component about project-level scope
- Kong plugin configuration with connector endpoint/credentials

**Caching Component**:
- **Redis connector required** when adding component (filtered by "redis" classification)
- **Cache key auto-generation** on component add (random UUID)
- **Cache key editable** until component is saved
- **Cache key immutable** after save (read-only field)
- **Key deletion** on component removal (marked for deletion)
- **Redis key cleanup** on next deploy (removes marked keys)
- **Comprehensive testing** for:
  - Key generation on add
  - Key editing before save
  - Key immutability after save
  - Key deletion on component removal
  - Key cleanup on deploy
  - Upstash connector classification as "redis"

**State Variables**:
- Project vs workflow scope
- Storage type selection (workflow, database, Redis)
- Variable creation and reference
- Storage adapter functionality

## 9. Documentation

### 9.1 User Documentation

- `docs/user-guide/kong-components.md` - Kong component usage
- `docs/user-guide/state-variables.md` - State variable guide
- `docs/user-guide/monitoring.md` - Monitoring and alerting guide

### 9.2 Developer Documentation

- `docs/development/kong-integration.md` - Kong integration architecture
- `docs/development/state-management.md` - State management architecture
- `docs/development/monitoring.md` - Monitoring system architecture
- `docs/development/connector-classifications.md` - Connector classification system

## Implementation Order

1. **Phase 1: Connector Classification System**
   - Database migration for classifications
   - Classification utilities and API
   - Update Upstash connector
   - ConnectorSelector with classification filtering

2. **Phase 2: Enhanced State Variables**
   - Database migrations for state variables
   - State variable scope and storage selection
   - Storage adapters (workflow, database, Redis)
   - UI updates for state variable configuration

3. **Phase 3: Kong Logging Component**
   - Logging component type and node
   - Project-level configuration (visible on all services)
   - **Connector selection required** when adding to React Flow UI
   - Logging settings panel with data-in/data-out checkboxes
   - Bidirectional sync with data-in/data-out component checkboxes
   - Visual note on component about project-level scope
   - Kong logging plugin integration

4. **Phase 4: Kong Caching Component**
   - Caching component type and node
   - **Redis connector selection required** (filtered by "redis" classification)
   - Cache key management:
     - Auto-generation on component add (random UUID)
     - Editable until save
     - Immutable after save (read-only)
     - Deletion on component removal
     - Cleanup on deploy
   - Kong cache plugin integration
   - **Comprehensive testing** for all key lifecycle operations

5. **Phase 5: Kong CORS Component**
   - CORS component type and node
   - Kong CORS plugin integration
   - Validation and compilation
   - UI integration

6. **Phase 6: GraphQL Gateway**
   - GraphQL component type and node
   - Schema builder and resolver mapper
   - GraphQL endpoint handler
   - UI integration

7. **Phase 7: MCP Server**
   - MCP component type and node
   - MCP server implementation
   - Resource and tool handlers
   - UI integration

8. **Phase 8: Monitoring and Alerting**
   - State variable metrics collection
   - Alert system
   - UI tooltips and guidance
   - Best practices recommendations

## Key Files Summary

**New Files**:

- Kong components: `KongLoggingNode.tsx`, `KongCacheNode.tsx`, `KongCorsNode.tsx`, `GraphQLNode.tsx`, `McpServerNode.tsx`
- Kong libraries: `logging-config.ts`, `cache-config.ts`, `cors-config.ts`, `graphql-handler.ts`, `mcp/server-builder.ts`
- Connector system: `classifications.ts`
- State management: `project-state-manager.ts`, `storage-adapters/*.ts`
- Monitoring: `state-monitor.ts`, `state-alerts.ts`
- UI components: `StateVariableSelector.tsx`, `StateVariableAlerts.tsx`

**Modified Files**:

- `component-categorization.ts` - Add new categories
- `NodePropertyPanel.tsx` - Add property panels
- `DataInNode.tsx` - Add logging checkbox
- `DataOutNode.tsx` - Add logging checkbox
- `ProjectView.tsx` - Show state variables and Kong components
- `ServiceBuilderView.tsx` - Enhanced visualization
- `workflow-validator.ts` - Add validation rules
- `state-management.ts` - Enhanced compiler pattern
- `ConnectorSelector.tsx` - Add classification filtering
- `connectors.ts` router - Add classification endpoints

