# Component Inventory - Complete List

**Date:** 2025-01-XX  
**Purpose:** Complete inventory of all components in the workflow builder  
**Status:** ✅ Complete - All components audited and categorized

---

## Component Types (Current)

### Core Workflow Types
1. **activity** - Temporal activities that perform work
2. **agent** - AI agents that make decisions
3. **signal** - Signal handlers for workflow communication
4. **trigger** - Workflow trigger/start condition
5. **query** - Query handler for read-only state inspection
6. **scheduled-workflow** - Scheduled (cron) child workflow
7. **work-queue** - Work queue for pending items

### Interface Types
8. **data-in** - Interface component for receiving data (creates POST/PATCH endpoints)
9. **data-out** - Interface component for providing data (creates GET endpoints)

### API Gateway Types (Kong)
10. **kong-logging** - Logging configuration for API endpoints (project-level)
11. **kong-cache** - Kong proxy caching configuration with Redis backend
12. **kong-cors** - CORS (Cross-Origin Resource Sharing) configuration
13. **graphql-gateway** - GraphQL endpoint gateway with schema definition and resolver mapping

### Control Flow Types
13. **condition** - Branch workflow based on condition (if/else)
14. **phase** - Organize workflow into phases (sequential or concurrent)
15. **retry** - Retry logic with exponential backoff
16. **state-variable** - Manage workflow state variables

### Workflow Structure Types
18. **api-endpoint** - Expose workflow as HTTP API endpoint
19. **child-workflow** - Start a child workflow
20. **service-container** - Service container node
21. **end** - End node

---

## Activity Components (Examples from Seed Data)

1. **fetch-api-data**
   - Description: Fetches data from an external API endpoint
   - Tags: api, http, network, rest
   - Capabilities: fetch-data, api-call, http-request

2. **process-data**
   - Description: Transforms and processes data
   - Tags: processing, transformation, etl
   - Capabilities: data-processing, transform, pipeline

3. **send-notification**
   - Description: Sends notifications via multiple channels
   - Tags: notification, communication, alerting
   - Capabilities: send-notification, alert, messaging

4. **save-to-database**
   - Description: Saves data to a database
   - Tags: database, storage, persistence
   - Capabilities: save-data, database-write, data-persistence

5. **read-from-database**
   - Description: Reads data from a database
   - Tags: database, storage, query
   - Capabilities: read-data, database-read, query-data

6. **log-message**
   - Description: Logs messages with severity levels
   - Tags: logging, monitoring, debugging
   - Capabilities: log, debug, monitoring

---

## Agent Components (Examples from Seed Data)

1. **code-analysis-agent**
   - Description: AI agent that analyzes code for issues
   - Tags: ai, analysis, code-quality, agent
   - Capabilities: code-analysis, bug-detection, code-review
   - Model: Anthropic Claude Sonnet 4

2. **test-generation-agent**
   - Description: AI agent that generates unit tests
   - Tags: ai, testing, automation, agent
   - Capabilities: test-generation, unit-testing, tdd
   - Model: OpenAI GPT-4

---

## Trigger Components (Examples from Seed Data)

1. **webhook-trigger** (example)
   - Description: Triggers workflow on webhook
   - Tags: webhook, trigger, http

2. **scheduled-trigger** (example)
   - Description: Triggers workflow on schedule
   - Tags: schedule, cron, trigger

3. **manual-trigger** (example)
   - Description: Manual workflow trigger
   - Tags: manual, trigger

---

## Node Components (React Flow)

### Core Nodes
- `ActivityNode` - Renders activity components
- `AgentNode` - Renders agent components
- `SignalNode` - Renders signal handlers
- `TriggerNode` - Renders trigger components
- `EndNode` - Renders end node
- `ChildWorkflowNode` - Renders child workflow
- `ApiEndpointNode` - Renders API endpoint

### Control Flow Nodes
- `ConditionNode` - Renders condition/branching
- `PhaseNode` - Renders phase organization
- `RetryNode` - Renders retry logic
- `StateVariableNode` - Renders state variables

### Interface Nodes
- `DataInNode` - Renders data-in interface
- `DataOutNode` - Renders data-out interface

### Service Nodes
- `ServiceContainerNode` - Renders service container

### API Gateway Nodes
- `KongLoggingNode` - Renders Kong logging config
- `KongCacheNode` - Renders Kong cache config
- `KongCorsNode` - Renders Kong CORS config
- `GraphQLNode` - Renders GraphQL gateway config

---

## Component Type Registry

### Current Registry (nodeTypes)
```typescript
{
  activity: ActivityNodeComponent,
  agent: AgentNodeComponent,
  signal: SignalNodeComponent,
  trigger: TriggerNodeComponent,
  end: EndNodeComponent,
  'child-workflow': ChildWorkflowNodeComponent,
  'api-endpoint': ApiEndpointNode,
  condition: ConditionNodeComponent,
  phase: PhaseNodeComponent,
  retry: RetryNodeComponent,
  'state-variable': StateVariableNodeComponent,
  'service-container': ServiceContainerNodeComponent,
  'data-in': DataInNodeComponent,
  'data-out': DataOutNodeComponent,
  'kong-logging': KongLoggingNodeComponent,
  'kong-cache': KongCacheNodeComponent,
  'kong-cors': KongCorsNodeComponent,
  'graphql-gateway': GraphQLNodeComponent,
}
```

---

## Planned Components (From Plans)

### Database Components
- PostgreSQL Query
- PostgreSQL Write
- Supabase Query
- Supabase Write
- Generic Database

### Cache Components
- Redis Command
- Upstash Redis
- Memory Cache

### File Storage Components
- Local File Storage
- S3 File Storage
- File Operations (create, update, delete)

### Git Components
- Git Commit
- Git Push
- Git Branch
- Create Pull Request

### Build & Test Components
- Run Build
- Run Tests
- Quality Checks

### BrainGrid Components
- Create Requirement
- List Projects
- Manage Tasks

### Communication Components
- Send Email
- Send Slack Message
- Send SMS
- Send Webhook

---

## Component Organization by Function

### Data Operations
- fetch-api-data
- process-data
- save-to-database
- read-from-database
- (Future: PostgreSQL, Supabase, Redis, etc.)

### Communication
- send-notification
- (Future: Email, Slack, SMS, Webhook)

### AI & Automation
- code-analysis-agent
- test-generation-agent
- (Future: Documentation Agent, Custom Agents)

### API & Integration
- api-endpoint
- data-in
- data-out
- kong-logging
- kong-cache
- kong-cors

### Control Flow
- condition
- phase
- retry
- state-variable

### Workflow Structure
- trigger
- end
- child-workflow
- service-container
- scheduled-workflow
- work-queue
- signal
- query

---

## Component Metadata Fields

### Required Fields
- `id` - UUID
- `name` - Component identifier (kebab-case)
- `display_name` - Human-readable name
- `component_type_id` - Reference to component_types
- `version` - Semver version
- `created_by` - User ID
- `visibility_id` - Visibility level

### Optional Fields
- `description` - Component description
- `config_schema` - JSON Schema for configuration
- `input_schema` - JSON Schema for inputs
- `output_schema` - JSON Schema for outputs
- `tags` - Array of tags
- `capabilities` - Array of capabilities
- `agent_prompt_id` - For agent components
- `model_provider` - For agent components
- `model_name` - For agent components
- `implementation_path` - Path to implementation
- `npm_package` - NPM package name
- `deprecated` - Deprecation flag

---

## Component Search Keywords

### By Function
- **API**: fetch-api-data, api-endpoint, data-in, data-out
- **Database**: save-to-database, read-from-database
- **AI**: code-analysis-agent, test-generation-agent
- **Communication**: send-notification
- **Control Flow**: condition, phase, retry
- **State**: state-variable, work-queue, signal, query
- **Gateway**: kong-logging, kong-cache, kong-cors

### By Type
- **Activity**: All activity components
- **Agent**: All agent components
- **Trigger**: All trigger components
- **Interface**: data-in, data-out
- **Control**: condition, phase, retry
- **Gateway**: kong-*

---

## Component Count Summary

- **Component Types**: 21
- **Activity Components**: 14 (in `components` table)
  - 6 from seed_public_components.sql
  - 5 from seed_build_workflow_components.sql
  - 3 from seed_sync_workflow_and_components.sql
- **Agent Components**: 2 (in `components` table)
- **Trigger Components**: 3 (in `components` table)
- **API Gateway Components**: 4 (in `components` table)
  - kong-logging
  - kong-cache
  - kong-cors
  - graphql-gateway
- **Node Components**: 18 (React Flow nodes)
- **Activities Table**: 5 (separate registry system)
- **Total Components in Database**: 23
- **Planned Components**: 20+ (from plans)

---

## Additional Components Found

### From seed_sync_workflow_and_components.sql
- **postgresql-query** - Execute parameterized PostgreSQL queries
- **redis-command** - Execute Redis commands (GET, SET, DEL, etc.)
- **typescript-processor** - Execute TypeScript code to process data

### From seed_build_workflow_components.sql
- **compileWorkflowDefinition** - Converts workflow definition to executable code
- **validateGeneratedCode** - Validates generated TypeScript code
- **registerWorkflowActivities** - Registers activities with Temporal worker
- **initializeExecutionEnvironment** - Prepares execution environment
- **updateExecutionStatus** - Updates execution record in database

### Activities Table (Separate Registry)
The `activities` table contains 5 activities that are separate from the `components` table:
- sampleActivity
- buildPackage
- httpRequest
- executeQuery
- transformData

**Note:** These may need to be migrated to `components` table or kept as a separate registry system.

## Missing Components (Now Fixed)

The following components had nodes and types but were missing from the `components` table. They are now seeded in migration `20250120000000_seed_all_components_complete.sql`:

1. **kong-logging** - ✅ Now seeded
2. **kong-cache** - ✅ Now seeded
3. **kong-cors** - ✅ Now seeded
4. **graphql-gateway** - ✅ Now seeded

## Notes

1. Component types are stored in `component_types` table (21 types)
2. Components are stored in `components` table (23 components)
3. Activities are stored in `activities` table (5 activities) - separate registry
4. Node components are React components in `src/components/workflow/nodes/` (18 nodes)
5. Component registry is in `src/components/workflow/nodes/index.ts`
6. Component palette is in `src/components/workflow-builder/NodeTypesPalette.tsx`
7. Component categorization is in `src/lib/component-categorization.ts`
8. Complete audit document: `plans/component-audit-complete.md`
9. Seed migration: `supabase/migrations/20250120000000_seed_all_components_complete.sql`

