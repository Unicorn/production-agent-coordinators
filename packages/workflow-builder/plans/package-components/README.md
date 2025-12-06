# Package Components Implementation Plans

**Date:** 2025-01-20  
**Status:** Planning  
**Directory:** `packages/workflow-builder/plans/package-components/`

---

## Quick Start

This directory contains comprehensive plans for creating workflow components from:
1. **Storage Connectors** - Enhanced 3rd party storage connectors
2. **@bernierllc NPM Packages** - Components from existing npm packages

---

## Plan Documents

### Overview
- **[00-overview.md](./00-overview.md)** - Master overview, current state, and priorities

### Storage Connectors
- **[01-storage-connectors.md](./01-storage-connectors.md)** - Plans for:
  - Upstash Redis connector
  - Supabase Postgres connector
  - S3/Cloud file storage
  - Enhanced Redis features
  - Enhanced PostgreSQL features

### @bernierllc Packages
- **[02-bernierllc-packages.md](./02-bernierllc-packages.md)** - Plans for components from:
  - High priority: Supabase client, email template engine, rate limiter
  - Medium priority: Cache manager, logging, Anthropic client
  - Low priority: Validators, markdown detector, etc.

### Other Packages
- **[03-other-packages.md](./03-other-packages.md)** - Plans for components from other codebase packages:
  - High priority: BrainGrid CLI wrapper, Git operations, File operations, Build/test operations
  - Medium priority: Dev workflow activities, Package queue orchestrator activities
  - Low priority: Infrastructure packages (not component candidates)

---

## Implementation Checklist

### Phase 1: High Priority Storage Connectors

#### Upstash Redis Connector
- [ ] Review existing Redis component
- [ ] Create `@bernierllc/redis-activities` package
- [ ] Implement Upstash REST API support
- [ ] Add advanced Redis commands (pub/sub, streams, sorted sets)
- [ ] Create connector type and component definition
- [ ] Create UI property panel
- [ ] Add tests and documentation

#### Supabase Postgres Connector
- [ ] Review `@bernierllc/supabase-client` package
- [ ] Create `@bernierllc/database-activities` package
- [ ] Implement Supabase Postgres activity
- [ ] Add RLS and transaction support
- [ ] Create connector type and component definition
- [ ] Create UI property panel
- [ ] Add tests and documentation

#### S3 File Storage
- [ ] Review `@coordinator/storage` package and `IStorage` interface
- [ ] Create S3 storage implementation
- [ ] Create `@bernierllc/storage-activities` package
- [ ] Implement S3 storage activities
- [ ] Create connector type and component definition
- [ ] Create UI property panel
- [ ] Add tests and documentation

### Phase 2: High Priority @bernierllc Components

#### Email Template Engine
- [ ] Review `@bernierllc/email-template-engine` package
- [ ] Create `@bernierllc/email-activities` package
- [ ] Implement email template render activity
- [ ] Create component definition
- [ ] Create UI property panel
- [ ] Add tests and documentation

#### Rate Limiter
- [ ] Review `@bernierllc/rate-limiter` package
- [ ] Create `@bernierllc/rate-limiter-activities` package
- [ ] Implement rate limit check activity
- [ ] Add Redis/Upstash backend support
- [ ] Create component definition
- [ ] Create UI property panel
- [ ] Add tests and documentation

#### Cache Manager
- [ ] Review `@bernierllc/cache-manager` package
- [ ] Assess overlap with Redis component
- [ ] If valuable, create cache activities package
- [ ] Implement cache operations
- [ ] Create component definition
- [ ] Add tests and documentation

### Phase 3: Medium Priority Components

#### Logging
- [ ] Review `@bernierllc/logging` package
- [ ] Create logging activities package
- [ ] Implement structured logging activity
- [ ] Create component definition
- [ ] Add tests and documentation

#### Anthropic Client
- [ ] Review `@bernierllc/anthropic-client` package
- [ ] Check if Anthropic agent component exists
- [ ] If not, create agent component
- [ ] Create connector type for API keys
- [ ] Create component definition
- [ ] Add tests and documentation

### Phase 4: Other Packages Components

#### BrainGrid Components
- [ ] Review `@bernierllc/braingrid-cli-wrapper` package
- [ ] Create `@bernierllc/braingrid-activities` package
- [ ] Implement all BrainGrid activities (create-requirement, list-projects, create-task, etc.)
- [ ] Create connector type for BrainGrid
- [ ] Create component definitions
- [ ] Add tests and documentation

#### Git Operations
- [ ] Review package-builder-production git activities
- [ ] Create `@bernierllc/git-activities` package
- [ ] Implement git activities (commit, push, create-branch, create-pr)
- [ ] Create component definitions
- [ ] Add tests and documentation

#### File Operations
- [ ] Review package-builder-production file activities
- [ ] Create `@bernierllc/file-activities` package
- [ ] Implement file operations activity
- [ ] Create component definition
- [ ] Add tests and documentation

#### Build/Test Operations
- [ ] Review package-builder-production build activities
- [ ] Create `@bernierllc/build-activities` package
- [ ] Implement build/test activities
- [ ] Create component definitions
- [ ] Add tests and documentation

---

## Component Planning Process

For each component, follow the [Component Planning Guide](../../../docs/standards/component-planning-guide.md):

### 1. Classification
- [ ] Determine component type (activity, agent, signal, trigger, data-in, data-out)
- [ ] Determine category (or create new category)
- [ ] Choose component name (camelCase) and display name

### 2. Package Management
- [ ] Identify or create @bernierllc npm package
- [ ] Define activity metadata
- [ ] Plan package structure

### 3. Configuration
- [ ] Define component configuration schema
- [ ] Define input/output schemas
- [ ] Plan property panel fields

### 4. Connectors
- [ ] Determine connector requirements
- [ ] Identify or create connector type
- [ ] Define connector configuration schema

### 5. Implementation
- [ ] Implement activity/agent code
- [ ] Create component definition in database
- [ ] Create UI component for property panel
- [ ] Add tests (unit, integration, E2E)
- [ ] Write documentation

---

## Current State Summary

### ✅ Existing Components
- **PostgreSQL Query** - Basic PostgreSQL query component
- **Redis Command** - Basic Redis command component
- **Local File Storage** - Local file storage implementation

### ❌ Missing Components
- **Upstash Redis** - Enhanced Redis with Upstash features
- **Supabase Postgres** - Enhanced PostgreSQL with Supabase features
- **S3 File Storage** - Cloud file storage component
- **Email Template Engine** - Email template rendering
- **Rate Limiter** - Rate limiting component
- **Cache Manager** - Cache operations component
- **Structured Logging** - Logging component
- **Anthropic Agent** - Claude AI agent component
- **BrainGrid Components** - BrainGrid integration (create requirement, list projects, manage tasks)
- **Git Operations** - Git commit, push, create branch, create PR
- **File Operations** - File create/update/delete operations
- **Build/Test Operations** - Run build, run tests, quality checks

---

## Priority Reference

### High Priority (Phase 1)
1. Supabase Postgres Connector
2. Upstash Redis Connector
3. S3 File Storage Component
4. Email Template Engine Component
5. Rate Limiter Component

### Medium Priority (Phase 2)
1. Cache Manager Component
2. Structured Logging Component
3. Anthropic Agent Component
4. Enhanced Redis Features
5. Enhanced PostgreSQL Features

### Low Priority (Phase 3+)
1. Validator Components
2. Markdown Detector
3. Content Type Registry
4. MCP Registry
5. Todo List / Planning Session

### Phase 4: Other Packages (High Value)
1. BrainGrid Components (create requirement, list projects, manage tasks)
2. Git Operations (commit, push, create branch, create PR)
3. File Operations (create, update, delete files)
4. Build/Test Operations (run build, run tests, quality checks)
5. Credential Checks (check GitHub, NPM, Git credentials)

---

## References

- [Component Planning Guide](../../../docs/standards/component-planning-guide.md)
- [Component Discoverability Standards](../../../docs/standards/component-discoverability-and-reusability.md)
- [Services/Components/Connectors Refactor Plan](../2025-01-20-services-components-connectors-refactor.md)
- [Storage Package Architecture](../../../docs/internal/architecture/storage.md)

---

## Next Steps

1. **Review Plans**: Read through all plan documents
2. **Prioritize**: Determine which components to implement first
3. **Start Implementation**: Begin with Phase 1 high-priority components
4. **Follow Process**: Use Component Planning Guide for each component
5. **Update Plans**: Update plans as implementation progresses

