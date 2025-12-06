# Storage Connector Components Plan

**Date:** 2025-01-20  
**Status:** Planning  
**Related:** [Component Planning Guide](../../../docs/standards/component-planning-guide.md), [Overview](./00-overview.md)

---

## Overview

This plan covers creating enhanced storage connector components for:
1. **Upstash Redis** - Enhanced Redis connector with Upstash-specific features
2. **Supabase Postgres** - Enhanced PostgreSQL connector with Supabase-specific features
3. **S3/Cloud File Storage** - File storage components for cloud storage providers

---

## Current State Analysis

### Existing Components

#### PostgreSQL Query Component
- **Name**: `postgresql-query`
- **Type**: `activity`
- **Location**: `packages/workflow-builder/src/lib/components/postgresql-activity.ts`
- **Features**:
  - Parameterized queries
  - Connection URL from project connections
  - Basic error handling
- **Limitations**:
  - No Supabase-specific features (RLS, realtime, storage API)
  - No transaction support
  - No connection pooling
  - No batch operations

#### Redis Command Component
- **Name**: `redis-command`
- **Type**: `activity`
- **Location**: `packages/workflow-builder/src/lib/components/redis-activity.ts`
- **Features**:
  - Basic commands: GET, SET, DEL, EXISTS, INCR, DECR
  - Connection URL from project connections
  - Basic error handling
- **Limitations**:
  - No Upstash-specific features (REST API, serverless optimizations)
  - No pub/sub support
  - No streams support
  - No advanced data structures (sorted sets, lists, etc.)

### Storage Infrastructure

#### Local File Storage
- **Package**: `@coordinator/storage`
- **Location**: `packages/storage/src/local.ts`
- **Interface**: `IStorage` from `@coordinator/contracts`
- **Features**:
  - Secure path validation
  - File operations (write, read, exists, delete, list)
- **Missing**:
  - S3 implementation
  - GCS implementation
  - Database blob storage

---

## Component Plans

### 1. Upstash Redis Connector Component

#### Component Classification

- **Component Type**: `activity`
- **Category**: `core-actions` (or potentially new `storage` category)
- **Name**: `upstash-redis-command`
- **Display Name**: "Upstash Redis Command"

#### NPM Package Requirements

**Question**: Do we have a @bernierllc npm package for this?

**Answer**: No existing package. Should create `@bernierllc/redis-activities` or add to existing `@bernierllc/database-activities` if it exists.

**Package Structure**:
```
packages/redis-activities/
  src/
    activities/
      upstash-redis.activities.ts
      redis-advanced.activities.ts
    index.ts
  package.json
  README.md
```

#### Component Configuration

```typescript
interface UpstashRedisConfig {
  connectorId: string; // Upstash Redis connector
  command: 'GET' | 'SET' | 'DEL' | 'EXISTS' | 'INCR' | 'DECR' | 
           'PUBLISH' | 'SUBSCRIBE' | 'XADD' | 'XREAD' | 'ZADD' | 'ZRANGE';
  key: string;
  value?: string;
  options?: {
    ttl?: number; // For SET command
    pattern?: string; // For SUBSCRIBE
    stream?: string; // For streams commands
    score?: number; // For sorted sets
  };
}
```

#### Connector Requirements

- **Connector Type**: `database` (or new `redis` type)
- **Connector Configuration**:
  - Upstash REST API URL
  - Upstash REST API token
  - Optional: Redis URL (for direct connection)
- **Connector Name**: `upstash-redis`
- **Note**: Upstash connector classification and caching component integration moved to [Kong API Components Plan](../../kong/kong-api-components-and-state-management.md)

#### Data Input/Output

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "command": { "type": "string", "enum": ["GET", "SET", "DEL", ...] },
    "key": { "type": "string" },
    "value": { "type": "string" },
    "options": { "type": "object" }
  },
  "required": ["command", "key"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "result": { "type": "any" },
    "error": { "type": "string" }
  },
  "required": ["success"]
}
```

#### Implementation Checklist

- [ ] Create `@bernierllc/redis-activities` package
- [ ] Implement Upstash REST API client
- [ ] Add Upstash-specific commands (REST API support)
- [ ] Add advanced Redis commands (pub/sub, streams, sorted sets)
- [ ] Create connector type for Upstash Redis
- [ ] Create component definition in database
- [ ] Create UI component for property panel
- [ ] Add tests for Upstash Redis activities
- [ ] Document Upstash Redis connector setup
- [ ] Add examples for Upstash Redis usage

---

### 2. Supabase Postgres Connector Component

#### Component Classification

- **Component Type**: `activity`
- **Category**: `core-actions` (or potentially new `storage` category)
- **Name**: `supabase-postgres-query`
- **Display Name**: "Supabase Postgres Query"

#### NPM Package Requirements

**Question**: Do we have a @bernierllc npm package for this?

**Answer**: We have `@bernierllc/supabase-client` - should leverage this package!

**Package Structure**:
```
packages/database-activities/
  src/
    activities/
      supabase-postgres.activities.ts
      postgres-transaction.activities.ts
    index.ts
  package.json
  README.md
```

#### Component Configuration

```typescript
interface SupabasePostgresConfig {
  connectorId: string; // Supabase Postgres connector
  query: string; // SQL query
  parameters?: any[]; // Query parameters
  options?: {
    useRLS?: boolean; // Use Row Level Security
    useRealtime?: boolean; // Subscribe to realtime changes
    transaction?: boolean; // Execute in transaction
  };
}
```

#### Connector Requirements

- **Connector Type**: `database`
- **Connector Configuration**:
  - Supabase project URL
  - Supabase anon/service role key
  - Database connection string (optional, for direct connection)
- **Connector Name**: `supabase-postgres`

#### Data Input/Output

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string" },
    "parameters": { "type": "array" },
    "options": {
      "type": "object",
      "properties": {
        "useRLS": { "type": "boolean" },
        "useRealtime": { "type": "boolean" },
        "transaction": { "type": "boolean" }
      }
    }
  },
  "required": ["query"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "rows": { "type": "array" },
    "rowCount": { "type": "number" },
    "error": { "type": "string" }
  },
  "required": ["success"]
}
```

#### Implementation Checklist

- [ ] Review `@bernierllc/supabase-client` package capabilities
- [ ] Create `@bernierllc/database-activities` package (or add to existing)
- [ ] Implement Supabase Postgres activity using `@bernierllc/supabase-client`
- [ ] Add RLS support (use anon key for RLS, service key for bypass)
- [ ] Add transaction support
- [ ] Add batch operation support
- [ ] Create connector type for Supabase Postgres
- [ ] Create component definition in database
- [ ] Create UI component for property panel
- [ ] Add tests for Supabase Postgres activities
- [ ] Document Supabase Postgres connector setup
- [ ] Add examples for Supabase Postgres usage

---

### 3. S3 File Storage Component

#### Component Classification

- **Component Type**: `activity`
- **Category**: `core-actions` (or potentially new `storage` category)
- **Name**: `s3-file-storage`
- **Display Name**: "S3 File Storage"

#### NPM Package Requirements

**Question**: Do we have a @bernierllc npm package for this?

**Answer**: No existing package. Should create `@bernierllc/storage-activities` or extend `@coordinator/storage` package.

**Package Structure**:
```
packages/storage-activities/
  src/
    activities/
      s3-storage.activities.ts
      gcs-storage.activities.ts
      local-storage.activities.ts
    index.ts
  package.json
  README.md
```

**OR** extend existing:
```
packages/storage/
  src/
    s3.ts (new)
    gcs.ts (new)
    activities/
      storage.activities.ts (new)
    index.ts
```

#### Component Configuration

```typescript
interface S3StorageConfig {
  connectorId: string; // S3 connector
  operation: 'write' | 'read' | 'delete' | 'exists' | 'list';
  key: string; // S3 key (path)
  data?: string | Buffer; // For write operations
  options?: {
    contentType?: string;
    metadata?: Record<string, string>;
    prefix?: string; // For list operations
    maxKeys?: number; // For list operations
  };
}
```

#### Connector Requirements

- **Connector Type**: `storage` (new type)
- **Connector Configuration**:
  - AWS Access Key ID
  - AWS Secret Access Key
  - S3 Bucket name
  - AWS Region
  - Optional: S3 endpoint (for S3-compatible services)
- **Connector Name**: `s3-storage`

#### Data Input/Output

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "operation": {
      "type": "string",
      "enum": ["write", "read", "delete", "exists", "list"]
    },
    "key": { "type": "string" },
    "data": { "type": "string" },
    "options": { "type": "object" }
  },
  "required": ["operation", "key"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "success": { "type": "boolean" },
    "url": { "type": "string" }, // S3 URL for write operations
    "data": { "type": "string" }, // File content for read operations
    "exists": { "type": "boolean" }, // For exists operation
    "keys": { "type": "array" }, // For list operation
    "error": { "type": "string" }
  },
  "required": ["success"]
}
```

#### Implementation Checklist

- [ ] Review `@coordinator/storage` package and `IStorage` interface
- [ ] Create S3 storage implementation extending `IStorage`
- [ ] Create `@bernierllc/storage-activities` package (or add to existing)
- [ ] Implement S3 storage activities (write, read, delete, exists, list)
- [ ] Add support for S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
- [ ] Create connector type for S3 storage
- [ ] Create component definition in database
- [ ] Create UI component for property panel
- [ ] Add tests for S3 storage activities
- [ ] Document S3 storage connector setup
- [ ] Add examples for S3 storage usage
- [ ] Consider GCS (Google Cloud Storage) implementation
- [ ] Consider Azure Blob Storage implementation

---

### 4. Enhanced Redis Features Component

#### Component Classification

- **Component Type**: `activity`
- **Category**: `core-actions`
- **Name**: `redis-advanced`
- **Display Name**: "Redis Advanced Operations"

#### Features to Add

1. **Pub/Sub**:
   - PUBLISH command
   - SUBSCRIBE command (long-running activity)
   - PSUBSCRIBE command (pattern subscribe)

2. **Streams**:
   - XADD - Add to stream
   - XREAD - Read from stream
   - XRANGE - Range query
   - XGROUP - Consumer groups

3. **Sorted Sets**:
   - ZADD - Add to sorted set
   - ZRANGE - Range query
   - ZSCORE - Get score
   - ZRANK - Get rank

4. **Lists**:
   - LPUSH/RPUSH - Push to list
   - LPOP/RPOP - Pop from list
   - LRANGE - Range query
   - LLEN - List length

#### Implementation Checklist

- [ ] Add pub/sub commands to Redis activity
- [ ] Add streams commands to Redis activity
- [ ] Add sorted sets commands to Redis activity
- [ ] Add lists commands to Redis activity
- [ ] Update component configuration schema
- [ ] Update UI property panel
- [ ] Add tests for advanced commands
- [ ] Document advanced Redis features

---

### 5. Enhanced PostgreSQL Features Component

#### Component Classification

- **Component Type**: `activity`
- **Category**: `core-actions`
- **Name**: `postgresql-advanced`
- **Display Name**: "PostgreSQL Advanced Operations"

#### Features to Add

1. **Transactions**:
   - BEGIN transaction
   - COMMIT transaction
   - ROLLBACK transaction
   - Transaction context management

2. **Batch Operations**:
   - Execute multiple queries in sequence
   - Batch insert/update operations

3. **Connection Pooling**:
   - Reuse connections
   - Connection pool management

4. **Advanced Queries**:
   - COPY command for bulk operations
   - EXPLAIN ANALYZE for query analysis

#### Implementation Checklist

- [ ] Add transaction support to PostgreSQL activity
- [ ] Add batch operation support
- [ ] Add connection pooling
- [ ] Add COPY command support
- [ ] Add EXPLAIN ANALYZE support
- [ ] Update component configuration schema
- [ ] Update UI property panel
- [ ] Add tests for advanced features
- [ ] Document advanced PostgreSQL features

---

## Category Reclassification Consideration

**Question**: Should we create a new `storage` category?

**Analysis**:
- Current components: PostgreSQL, Redis are in `core-actions`
- New components: S3 storage, enhanced storage features
- Consideration: Storage operations are a distinct domain

**Recommendation**: 
- Keep existing components in `core-actions` for backward compatibility
- Consider creating `storage` category for new storage-focused components
- OR add `storage` as a tag/capability rather than a category

---

## Testing Requirements

### Unit Tests
- [ ] Test each storage connector activity independently
- [ ] Test error handling for connection failures
- [ ] Test input validation
- [ ] Test output schema validation

### Integration Tests
- [ ] Test with actual Upstash Redis instance
- [ ] Test with actual Supabase Postgres instance
- [ ] Test with actual S3 bucket (or S3-compatible service)
- [ ] Test connector creation and selection
- [ ] Test component execution in workflow context

### E2E Tests
- [ ] Test complete workflow with storage components
- [ ] Test error scenarios and recovery
- [ ] Test performance with large data sets

---

## Documentation Requirements

- [ ] Component usage guides for each storage connector
- [ ] Connector setup instructions
- [ ] Examples for common use cases
- [ ] API reference for each component
- [ ] Troubleshooting guides

---

## References

- [Component Planning Guide](../../../docs/standards/component-planning-guide.md)
- [Overview](./00-overview.md)
- [Services/Components/Connectors Refactor Plan](../2025-01-20-services-components-connectors-refactor.md)
- [Storage Package Architecture](../../../docs/internal/architecture/storage.md)

