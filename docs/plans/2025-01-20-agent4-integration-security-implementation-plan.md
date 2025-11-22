# Agent 4: Integration & Security Implementation Plan

## Overview

This plan covers Phases 12-14 of the services/components/connectors refactor, focusing on:
- **Phase 12**: Authentication & Security
- **Phase 13**: Kong Integration
- **Phase 14**: Temporal Nexus Integration

## Current State Analysis

### What Exists

1. **Kong Integration (Partial)**
   - ✅ Kong client (`packages/workflow-builder/src/lib/kong/client.ts`)
   - ✅ Endpoint registry (`packages/workflow-builder/src/lib/kong/endpoint-registry.ts`)
   - ✅ Hash-based routing implementation
   - ✅ `workflow_endpoints` table migration exists
   - ❌ Not integrated with `service_interfaces` / `public_interfaces` tables
   - ❌ No API key management system

2. **Security (Minimal)**
   - ✅ Supabase authentication for UI
   - ✅ tRPC protected procedures
   - ❌ No API key generation/management
   - ❌ No API key authentication middleware
   - ❌ No connector credential encryption

3. **Nexus Integration (None)**
   - ❌ No Nexus client implementation
   - ❌ No Nexus service registration
   - ❌ No Nexus endpoint management
   - ❌ No cross-project communication

### What Needs to Be Built

## Phase 12: Authentication & Security

### 12.1 API Key Management System

**Database Schema**:
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  public_interface_id UUID REFERENCES public_interfaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE, -- Hashed API key
  key_prefix VARCHAR(10) NOT NULL, -- First 4 chars for display
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_public_interface ON api_keys(public_interface_id);
```

**Implementation Tasks**:
- [ ] Create migration for `api_keys` table
- [ ] Create API key generation utility (crypto-secure random keys)
- [ ] Create API key hashing utility (bcrypt or similar)
- [ ] Create tRPC router for API key CRUD operations
- [ ] Create API key management UI component
- [ ] Add API key display/regeneration functionality

**Key Files**:
- `packages/workflow-builder/supabase/migrations/YYYYMMDD_create_api_keys.sql`
- `packages/workflow-builder/src/lib/security/api-key-generator.ts`
- `packages/workflow-builder/src/lib/security/api-key-hasher.ts`
- `packages/workflow-builder/src/server/api/routers/apiKeys.ts`

### 12.2 API Key Authentication Middleware

**Implementation Tasks**:
- [ ] Create middleware to validate API keys from `X-API-Key` header
- [ ] Integrate with Next.js API routes (`/api/v1/[...path]/route.ts`)
- [ ] Add rate limiting per API key
- [ ] Log API key usage (update `last_used_at`)
- [ ] Handle expired/revoked keys

**Key Files**:
- `packages/workflow-builder/src/lib/security/api-key-auth.ts`
- `packages/workflow-builder/src/app/api/v1/[...path]/route.ts` (update)

### 12.3 Connector Credential Encryption

**Database Schema Update**:
```sql
-- Add encryption fields to connectors table (if not exists)
ALTER TABLE connectors 
  ADD COLUMN IF NOT EXISTS encrypted_credentials BYTEA,
  ADD COLUMN IF NOT EXISTS encryption_key_id VARCHAR(255);

-- Add encryption fields to project_connectors table (if not exists)
ALTER TABLE project_connectors
  ADD COLUMN IF NOT EXISTS encrypted_auth_config BYTEA,
  ADD COLUMN IF NOT EXISTS encryption_key_id VARCHAR(255);
```

**Implementation Tasks**:
- [ ] Create encryption key management (use Supabase Vault or env var)
- [ ] Create encryption/decryption utilities
- [ ] Update connector creation to encrypt credentials
- [ ] Update connector usage to decrypt credentials
- [ ] Add key rotation support

**Key Files**:
- `packages/workflow-builder/src/lib/security/encryption.ts`
- `packages/workflow-builder/src/lib/security/key-manager.ts`
- Update connector routers to use encryption

### 12.4 Connector Access Control

**Implementation Tasks**:
- [ ] Add RLS policies for connectors
- [ ] Implement permission checks (user owns project, etc.)
- [ ] Add audit logging for connector access
- [ ] Implement connector sharing (future: organization-level)

**Key Files**:
- Update connector migrations with RLS policies
- `packages/workflow-builder/src/lib/security/connector-permissions.ts`

## Phase 13: Kong Integration

### 13.1 Integrate Kong with Service Interfaces

**Current State**: Kong is integrated with `workflow_endpoints` table, but we need to integrate with the new `service_interfaces` and `public_interfaces` tables.

**Database Schema** (from refactor plan):
```sql
-- service_interfaces table (needs to be created)
CREATE TABLE service_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  interface_type VARCHAR(50) NOT NULL CHECK (interface_type IN ('signal', 'query', 'update')),
  callable_name VARCHAR(255) NOT NULL, -- Temporal signal/query name
  input_schema JSONB,
  output_schema JSONB,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workflow_id, name)
);

-- public_interfaces table (needs to be created)
CREATE TABLE public_interfaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_interface_id UUID NOT NULL REFERENCES service_interfaces(id) ON DELETE CASCADE,
  kong_route_id VARCHAR(255),
  http_method VARCHAR(10) NOT NULL,
  http_path VARCHAR(500) NOT NULL,
  auth_type VARCHAR(50) DEFAULT 'api_key',
  auth_config JSONB,
  rate_limit_per_minute INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Implementation Tasks**:
- [ ] Create `service_interfaces` table migration
- [ ] Create `public_interfaces` table migration
- [ ] Update Kong endpoint registry to work with `public_interfaces`
- [ ] Create service interface → Kong route mapping
- [ ] Auto-create Kong routes when `is_public = true` on service interface
- [ ] Update endpoint cleanup to work with service interfaces

**Key Files**:
- `packages/workflow-builder/supabase/migrations/YYYYMMDD_create_service_interfaces.sql`
- `packages/workflow-builder/supabase/migrations/YYYYMMDD_create_public_interfaces.sql`
- `packages/workflow-builder/src/lib/kong/service-interface-registry.ts` (new)
- Update `packages/workflow-builder/src/lib/kong/endpoint-registry.ts`

### 13.2 Kong Route Management for Public Interfaces

**Implementation Tasks**:
- [ ] Create service to register public interface with Kong
- [ ] Create service to update Kong route when interface changes
- [ ] Create service to delete Kong route when interface is removed
- [ ] Link API keys to public interfaces
- [ ] Enable rate limiting per public interface
- [ ] Handle Kong route updates on service interface updates

**Key Files**:
- `packages/workflow-builder/src/lib/kong/public-interface-manager.ts` (new)
- Update public interfaces router to trigger Kong operations

### 13.3 Hash-Based Routing for Public Interfaces

**Implementation Tasks**:
- [ ] Reuse existing hash generation for public interfaces
- [ ] Map hash to service interface ID
- [ ] Update API route handler to resolve service interface from hash
- [ ] Test hash collision handling

**Key Files**:
- Update `packages/workflow-builder/src/lib/kong/hash-generator.ts` (if needed)
- Update `packages/workflow-builder/src/app/api/v1/[...path]/route.ts`

## Phase 14: Temporal Nexus Integration

### 14.1 Nexus Client Implementation

**Implementation Tasks**:
- [ ] Create Nexus client wrapper
- [ ] Implement Nexus service registration
- [ ] Implement Nexus endpoint creation
- [ ] Implement StartOperation calls
- [ ] Implement Signal/Query routing via Nexus
- [ ] Add error handling and retries

**Key Files**:
- `packages/workflow-builder/src/lib/nexus/client.ts` (new)
- `packages/workflow-builder/src/lib/nexus/service-registry.ts` (new)
- `packages/workflow-builder/src/lib/nexus/endpoint-manager.ts` (new)

### 14.2 Project Connector Nexus Integration

**Database Schema** (from refactor plan):
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
  nexus_endpoint_name VARCHAR(255) NOT NULL,
  nexus_service_name VARCHAR(255) NOT NULL,
  visibility VARCHAR(50) DEFAULT 'private',
  auth_config JSONB,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_project_id, name)
);
```

**Implementation Tasks**:
- [ ] Create `project_connectors` table migration
- [ ] Create Nexus service when connector is created
- [ ] Create Nexus endpoint pointing to target service
- [ ] Implement connector → Nexus operation mapping
- [ ] Add connector test functionality (test Nexus connection)
- [ ] Handle Nexus endpoint cleanup on connector deletion

**Key Files**:
- `packages/workflow-builder/supabase/migrations/YYYYMMDD_create_project_connectors.sql`
- `packages/workflow-builder/src/lib/nexus/connector-manager.ts` (new)
- `packages/workflow-builder/src/server/api/routers/projectConnectors.ts` (update)

### 14.3 Cross-Project Communication

**Implementation Tasks**:
- [ ] Create component that uses project connectors
- [ ] Implement Nexus StartOperation for service calls
- [ ] Implement Nexus Signal for async communication
- [ ] Implement Nexus Query for state queries
- [ ] Add error handling for cross-project failures
- [ ] Add monitoring/logging for cross-project calls

**Key Files**:
- Update workflow compiler to support Nexus calls
- `packages/workflow-builder/src/lib/nexus/workflow-integration.ts` (new)

## Implementation Order

### Week 1: Phase 12 (Security Foundation)
1. Day 1-2: API key management system
2. Day 3-4: API key authentication middleware
3. Day 5: Connector credential encryption

### Week 2: Phase 13 (Kong Integration)
1. Day 1-2: Service interfaces and public interfaces tables
2. Day 3-4: Kong integration with public interfaces
3. Day 5: Testing and refinement

### Week 3: Phase 14 (Nexus Integration)
1. Day 1-2: Nexus client implementation
2. Day 3-4: Project connector Nexus integration
3. Day 5: Cross-project communication testing

## Testing Strategy

### Phase 12 Tests
- [ ] Unit tests for API key generation/hashing
- [ ] Integration tests for API key authentication
- [ ] Unit tests for encryption/decryption
- [ ] E2E tests for API key management flow

### Phase 13 Tests
- [ ] Integration tests for Kong route creation
- [ ] Integration tests for public interface → Kong mapping
- [ ] E2E tests for public interface API calls
- [ ] Test rate limiting and authentication

### Phase 14 Tests
- [ ] Unit tests for Nexus client
- [ ] Integration tests for Nexus service registration
- [ ] Integration tests for cross-project communication
- [ ] E2E tests for project connector usage

## Dependencies

### External Services
- **Kong**: Must be running and accessible
- **Temporal**: Must have Nexus enabled
- **Supabase**: For database and encryption (if using Vault)

### Internal Dependencies
- Service interfaces table (Phase 2)
- Connectors table (Phase 3)
- Kong client (already exists)
- Temporal client (already exists)

## Risk Mitigation

### Security Risks
- **API Key Exposure**: Use hashing, never store plain keys
- **Credential Leakage**: Use encryption, secure key management
- **Unauthorized Access**: Implement proper RLS policies

### Integration Risks
- **Kong Unavailable**: Graceful degradation, error handling
- **Nexus Configuration**: Clear error messages, validation
- **Cross-Project Failures**: Retry logic, circuit breakers

## Success Criteria

- [ ] API keys can be generated and managed per public interface
- [ ] API key authentication works for all public endpoints
- [ ] Connector credentials are encrypted at rest
- [ ] Public interfaces automatically create Kong routes
- [ ] Kong routes are properly configured with auth and rate limiting
- [ ] Project connectors can communicate via Nexus
- [ ] Cross-project service calls work end-to-end
- [ ] All security features are tested and documented

## Documentation Updates

- [ ] Update API documentation with API key usage
- [ ] Create developer guide for Nexus integration
- [ ] Create user guide for public interfaces
- [ ] Document security best practices
- [ ] Update architecture diagrams

