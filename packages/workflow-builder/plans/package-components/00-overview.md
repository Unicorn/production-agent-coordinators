# Package Components Planning Overview

**Date:** 2025-01-20  
**Status:** Planning  
**Related:** [Component Planning Guide](../../../docs/standards/component-planning-guide.md)

---

## Purpose

This directory contains plans for creating workflow components from:
1. **Storage Connectors**: Enhanced connectors for 3rd party storage services (Upstash Redis, Supabase Postgres, S3/file storage)
2. **@bernierllc NPM Packages**: Components created from existing @bernierllc packages in our npm registry

---

## Current State

### Existing Storage Connectors

✅ **PostgreSQL Connector** - Basic PostgreSQL query component exists
- Location: `packages/workflow-builder/src/lib/components/postgresql-activity.ts`
- Uses connection URL from project connections
- Supports parameterized queries
- Component: `postgresql-query`

✅ **Redis Connector** - Basic Redis command component exists
- Location: `packages/workflow-builder/src/lib/components/redis-activity.ts`
- Uses connection URL from project connections
- Supports GET, SET, DEL, EXISTS, INCR, DECR commands
- Component: `redis-command`

### Storage Infrastructure

✅ **Local File Storage** - Exists in `packages/storage/src/local.ts`
- Implements `IStorage` interface
- Security-focused with path validation
- No cloud storage implementations yet (S3, GCS planned but not implemented)

### Missing Storage Connectors

❌ **Upstash Redis** - No dedicated Upstash connector (uses generic Redis)
❌ **Supabase Postgres** - No dedicated Supabase connector (uses generic PostgreSQL)
❌ **S3/Cloud File Storage** - No file storage components for S3, GCS, or other cloud storage
❌ **Enhanced Redis** - No advanced Redis features (pub/sub, streams, etc.)
❌ **Enhanced PostgreSQL** - No transaction support, connection pooling features

---

## @bernierllc NPM Packages Analysis

### Packages Found in Registry

From npm search, we have the following @bernierllc packages:

1. **@bernierllc/temporal-workflow-ui** - UI component (not a workflow component)
2. **@bernierllc/todo-list** - Potential component candidate
3. **@bernierllc/planning-session-core** - Potential component candidate
4. **@bernierllc/logging** - Potential activity component
5. **@bernierllc/validators-image-asset** - Potential activity component
6. **@bernierllc/supabase-client** - Potential connector/component
7. **@bernierllc/validators-cli** - Potential activity component
8. **@bernierllc/mcp-registry** - Potential component
9. **@bernierllc/content-type-registry** - Potential component
10. **@bernierllc/email-template-engine** - Potential activity component
11. **@bernierllc/task-queue** - Potential component
12. **@bernierllc/rate-limiter** - Potential activity component
13. **@bernierllc/cache-manager** - Potential activity component (may overlap with Redis)
14. **@bernierllc/validators-editorial-style** - Potential activity component
15. **@bernierllc/generic-workflow-ui** - UI component (not a workflow component)
16. **@bernierllc/messaging-ui** - UI component (not a workflow component)
17. **@bernierllc/markdown-detector** - Potential activity component
18. **@bernierllc/retry-policy** - Potential activity component
19. **@bernierllc/anthropic-client** - Potential agent component
20. **@bernierllc/email-tracking** - Potential activity component

---

## Plan Documents

1. **[Storage Connectors Plan](./01-storage-connectors.md)** - Plans for Upstash Redis, Supabase Postgres, and S3/file storage components
2. **[@bernierllc Package Components Plan](./02-bernierllc-packages.md)** - Plans for components from @bernierllc npm packages
3. **[Other Packages Components Plan](./03-other-packages.md)** - Plans for components from other codebase packages (BrainGrid, Git, File operations, Build/test)

---

## Priority Assessment

### High Priority

1. **Supabase Postgres Connector** - Enhanced PostgreSQL with Supabase-specific features
2. **Upstash Redis Connector** - Enhanced Redis with Upstash-specific features
3. **S3 File Storage Component** - Cloud file storage for workflows
4. **@bernierllc/supabase-client** - Leverage existing Supabase client package
5. **@bernierllc/email-template-engine** - Email template processing component
6. **@bernierllc/rate-limiter** - Rate limiting activity component

### Medium Priority

1. **Enhanced Redis Features** - Pub/sub, streams, advanced commands
2. **Enhanced PostgreSQL Features** - Transactions, connection pooling
3. **@bernierllc/cache-manager** - Cache management component
4. **@bernierllc/logging** - Structured logging component
5. **@bernierllc/retry-policy** - Retry policy configuration component
6. **@bernierllc/anthropic-client** - Anthropic agent component

### Phase 4: Other Packages (High Value)

1. **BrainGrid Components** - Create requirement, list projects, manage tasks (from `@bernierllc/braingrid-cli-wrapper`)
2. **Git Operations** - Commit, push, create branch, create PR (from package-builder-production)
3. **File Operations** - Create, update, delete files (from package-builder-production)
4. **Build/Test Operations** - Run build, run tests, quality checks (from package-builder-production)
5. **Credential Checks** - Check GitHub, NPM, Git credentials (from package-builder-production)

### Low Priority

1. **@bernierllc/validators-*** - Validation components (image-asset, editorial-style, cli)
2. **@bernierllc/markdown-detector** - Markdown detection component
3. **@bernierllc/content-type-registry** - Content type registry component
4. **@bernierllc/mcp-registry** - MCP registry component
5. **@bernierllc/todo-list** - Todo list component
6. **@bernierllc/planning-session-core** - Planning session component

---

## Implementation Strategy

### Phase 1: Storage Connectors (High Priority)
- Focus on Supabase Postgres and Upstash Redis connectors
- Add S3 file storage component
- Enhance existing Redis and PostgreSQL components

### Phase 2: High-Value @bernierllc Components
- Implement components from high-priority packages
- Focus on packages that provide clear workflow value

### Phase 3: Enhanced Features
- Add advanced features to storage connectors
- Implement medium-priority components

### Phase 4: Additional Components
- Implement remaining components as needed
- Focus on user demand and workflow requirements

---

## References

- [Component Planning Guide](../../../docs/standards/component-planning-guide.md)
- [Component Discoverability Standards](../../../docs/standards/component-discoverability-and-reusability.md)
- [Services/Components/Connectors Refactor Plan](../2025-01-20-services-components-connectors-refactor.md)

