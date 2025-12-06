# Complete Component Audit

**Date:** 2025-01-XX  
**Purpose:** Complete audit of all components in the codebase to ensure they're all in seed data and database

---

## Component Types (21 Total)

### Core Workflow Types (7)
1. `activity` - Temporal activities that perform work
2. `agent` - AI agents that make decisions
3. `signal` - Signal handlers for workflow communication
4. `trigger` - Workflow trigger/start condition
5. `query` - Query handler for read-only state inspection
6. `scheduled-workflow` - Scheduled (cron) child workflow
7. `work-queue` - Work queue for pending items

### Interface Types (2)
8. `data-in` - Interface component for receiving data (creates POST/PATCH endpoints)
9. `data-out` - Interface component for providing data (creates GET endpoints)

### API Gateway Types (4)
10. `kong-logging` - Logging configuration for API endpoints (project-level)
11. `kong-cache` - Kong proxy caching configuration with Redis backend
12. `kong-cors` - CORS (Cross-Origin Resource Sharing) configuration
13. `graphql-gateway` - GraphQL endpoint gateway with schema definition and resolver mapping

### Control Flow Types (4)
14. `condition` - Branch workflow based on condition (if/else)
15. `phase` - Organize workflow into phases (sequential or concurrent)
16. `retry` - Retry logic with exponential backoff
17. `state-variable` - Manage workflow state variables

### Workflow Structure Types (4)
18. `api-endpoint` - Expose workflow as HTTP API endpoint
19. `child-workflow` - Start a child workflow
20. `service-container` - Service container node
21. `end` - End node

---

## Components in `components` Table

### Activity Components (14 Total)

#### From `seed_public_components.sql` (6)
1. **fetch-api-data** (`20000000-0000-0000-0000-000000000001`)
   - Fetches data from an external API endpoint
   - Tags: api, http, network, rest
   - Capabilities: fetch-data, api-call, http-request

2. **process-data** (`20000000-0000-0000-0000-000000000002`)
   - Transforms and processes data
   - Tags: processing, transformation, etl
   - Capabilities: data-processing, transform, pipeline

3. **send-notification** (`20000000-0000-0000-0000-000000000003`)
   - Sends notifications via multiple channels
   - Tags: notification, communication, alerting
   - Capabilities: send-notification, alert, messaging

4. **save-to-database** (`20000000-0000-0000-0000-000000000004`)
   - Saves data to a database
   - Tags: database, storage, persistence
   - Capabilities: save-data, database-write, data-persistence

5. **read-from-database** (`20000000-0000-0000-0000-000000000005`)
   - Reads data from a database
   - Tags: database, storage, query
   - Capabilities: read-data, database-read, query-data

6. **log-message** (`20000000-0000-0000-0000-000000000006`)
   - Logs messages with severity levels
   - Tags: logging, monitoring, debugging
   - Capabilities: log, debug, monitoring

#### From `seed_build_workflow_components.sql` (5)
7. **compileWorkflowDefinition** (`11111111-0000-0000-0000-000000000001`)
   - Converts workflow definition to executable Temporal TypeScript code
   - Tags: system, compiler, workflow-builder
   - Implementation: TypeScript

8. **validateGeneratedCode** (`11111111-0000-0000-0000-000000000002`)
   - Validates generated TypeScript code
   - Tags: system, validation, typescript
   - Implementation: TypeScript

9. **registerWorkflowActivities** (`11111111-0000-0000-0000-000000000003`)
   - Registers activities with Temporal worker
   - Tags: system, worker, registration
   - Implementation: TypeScript

10. **initializeExecutionEnvironment** (`11111111-0000-0000-0000-000000000004`)
    - Prepares execution environment for workflow
    - Tags: system, worker, initialization
    - Implementation: TypeScript

11. **updateExecutionStatus** (`11111111-0000-0000-0000-000000000005`)
    - Updates execution record in database
    - Tags: system, database, status
    - Implementation: TypeScript

#### From `seed_sync_workflow_and_components.sql` (3)
12. **postgresql-query**
    - Execute parameterized PostgreSQL queries
    - Tags: database, postgresql, sql
    - Capabilities: query, data-access
    - Requires: project connection

13. **redis-command**
    - Execute Redis commands (GET, SET, DEL, etc.)
    - Tags: cache, redis, key-value
    - Capabilities: cache, data-access
    - Requires: project connection

14. **typescript-processor**
    - Execute TypeScript code to process data
    - Tags: processing, typescript, data-transformation
    - Capabilities: data-processing, transformation

### Agent Components (2)

#### From `seed_public_components.sql`
1. **code-analysis-agent** (`30000000-0000-0000-0000-000000000001`)
   - AI agent that analyzes code for issues
   - Tags: ai, analysis, code-quality, agent
   - Capabilities: code-analysis, bug-detection, code-review
   - Model: Anthropic Claude Sonnet 4

2. **test-generation-agent** (`30000000-0000-0000-0000-000000000002`)
   - AI agent that generates unit tests
   - Tags: ai, testing, automation, agent
   - Capabilities: test-generation, unit-testing, tdd
   - Model: OpenAI GPT-4

### Trigger Components (3)

#### From `seed_public_components.sql`
1. **manual-trigger** (`40000000-0000-0000-0000-000000000001`)
   - Manually triggered workflow start
   - Tags: trigger, manual, user-action
   - Capabilities: manual-start, user-trigger

2. **schedule-trigger** (`40000000-0000-0000-0000-000000000002`)
   - Triggers workflow on a schedule using cron
   - Tags: trigger, schedule, cron, automation
   - Capabilities: scheduled-start, cron-trigger, periodic

3. **webhook-trigger** (`40000000-0000-0000-0000-000000000003`)
   - Triggers workflow via HTTP webhook/API call
   - Tags: trigger, webhook, api, http
   - Capabilities: webhook-start, api-trigger, http-trigger

---

## Activities in `activities` Table (Separate Registry)

### From `seed_initial_activities.sql` (5)
**Note:** These are in the `activities` table, not `components` table. They may need to be migrated to `components` or kept separate.

1. **sampleActivity** (`11111111-1111-0000-0000-000000000001`)
   - A sample activity that processes a message
   - Category: Sample
   - Tags: demo, testing, example

2. **buildPackage** (`11111111-1111-0000-0000-000000000002`)
   - Build a package with configurable build options
   - Category: Build
   - Tags: package, build, deployment, npm

3. **httpRequest** (`11111111-1111-0000-0000-000000000003`)
   - Make HTTP requests with timeout and retry support
   - Category: HTTP
   - Tags: http, api, request, network, rest

4. **executeQuery** (`11111111-1111-0000-0000-000000000004`)
   - Execute a database query with connection pooling
   - Category: Database
   - Tags: database, sql, query, postgres

5. **transformData** (`11111111-1111-0000-0000-000000000005`)
   - Transform data using JSONata expressions
   - Category: Transform
   - Tags: transform, data, jsonata, mapping

---

## React Flow Node Components (18)

### Core Nodes
1. `ActivityNode` - Renders activity components
2. `AgentNode` - Renders agent components
3. `SignalNode` - Renders signal handlers
4. `TriggerNode` - Renders trigger components
5. `EndNode` - Renders end node
6. `ChildWorkflowNode` - Renders child workflow
7. `ApiEndpointNode` - Renders API endpoint

### Control Flow Nodes
8. `ConditionNode` - Renders condition/branching
9. `PhaseNode` - Renders phase organization
10. `RetryNode` - Renders retry logic
11. `StateVariableNode` - Renders state variables

### Interface Nodes
12. `DataInNode` - Renders data-in interface
13. `DataOutNode` - Renders data-out interface

### Service Nodes
14. `ServiceContainerNode` - Renders service container

### API Gateway Nodes
15. `KongLoggingNode` - Renders Kong logging config
16. `KongCacheNode` - Renders Kong cache config
17. `KongCorsNode` - Renders Kong CORS config
18. `GraphQLNode` - Renders GraphQL gateway config

---

## Missing Components Analysis

### Components in Code but Not in Database
1. **GraphQL Gateway** - Node exists, component type exists, but no component entry in `components` table
2. **Kong Logging** - Node exists, component type exists, but no component entry in `components` table
3. **Kong Cache** - Node exists, component type exists, but no component entry in `components` table
4. **Kong CORS** - Node exists, component type exists, but no component entry in `components` table

### Activities Table vs Components Table
- `activities` table has 5 activities that may need to be migrated to `components` table
- OR: Keep `activities` separate as a different registry system
- Decision needed: Should `activities` be merged into `components`?

---

## Summary

### Component Types: 21
### Components in `components` Table: 19
- Activities: 14
- Agents: 2
- Triggers: 3

### Activities in `activities` Table: 5
- Separate registry system

### React Flow Nodes: 18
- All have corresponding component types
- 4 API Gateway nodes missing component entries

### Missing Component Entries: 4
1. graphql-gateway (component type exists, node exists, but no component entry)
2. kong-logging (component type exists, node exists, but no component entry)
3. kong-cache (component type exists, node exists, but no component entry)
4. kong-cors (component type exists, node exists, but no component entry)

---

## Action Items

1. **Create component entries for API Gateway components**
   - Add `graphql-gateway` component entry
   - Add `kong-logging` component entry
   - Add `kong-cache` component entry
   - Add `kong-cors` component entry

2. **Decide on `activities` table**
   - Migrate to `components` table?
   - Keep separate?
   - Create mapping between them?

3. **Ensure all components have proper metadata**
   - Tags
   - Capabilities
   - Descriptions
   - Schemas

4. **Create comprehensive seed migration**
   - Single migration that seeds all components
   - Ensures all components are in database
   - Handles conflicts gracefully

