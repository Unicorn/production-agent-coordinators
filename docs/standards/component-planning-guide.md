# Component Planning Guide

**Version:** 1.0.0  
**Date:** 2025-01-20  
**Status:** Standard  
**Related:** [Component Discoverability and Reusability Standards](./component-discoverability-and-reusability.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Component Classification](#component-classification)
3. [Package Management](#package-management)
4. [React Flow UI Integration](#react-flow-ui-integration)
5. [Data Flow and Interfaces](#data-flow-and-interfaces)
6. [Project Page Integration](#project-page-integration)
7. [Metrics and Monitoring](#metrics-and-monitoring)
8. [Testing Considerations](#testing-considerations)
9. [Additional Considerations](#additional-considerations)
10. [Planning Checklist](#planning-checklist)

---

## Overview

This guide provides a comprehensive framework for planning new components in the Workflow Builder system. Use this guide before implementing any new component to ensure consistency, reusability, and proper integration across the system.

### When to Use This Guide

- Planning a new component (activity, agent, signal, trigger, data-in, data-out)
- Evaluating whether to create a new component or reuse existing ones
- Refactoring or extending existing components
- Adding new capabilities to the system

---

## Component Classification

### 1. Component Type Selection

**Question:** What component type should this be?

**Available Types:**
- **`activity`**: Temporal activity that performs a specific unit of work (e.g., send email, fetch data, process file)
- **`agent`**: AI-powered component that makes decisions or analyzes content
- **`signal`**: Signal handler for receiving events from external systems or other workflows
- **`trigger`**: Entry point that starts a workflow (every workflow must have at least one)
- **`data-in`**: Interface component for receiving data from external sources (creates service interface)
- **`data-out`**: Interface component for providing data to external consumers (creates service interface)

**Decision Criteria:**
- Does it perform work? → `activity`
- Does it use AI/LLM? → `agent`
- Does it receive events? → `signal` or `data-in`
- Does it start workflows? → `trigger`
- Does it expose data? → `data-out`

**Reference:** See `packages/workflow-builder/docs/user-guide/components.md`

---

### 2. Category Classification

**Question:** What category would this component go in? Do we need a new category for this component? Does adding this component justify reclassifying some components we already have into a new category?

**Existing Categories:**

1. **Core Actions** (`core-actions`)
   - Basic operations like sending notifications, saving data, fetching APIs
   - Keywords: `notification`, `send`, `email`, `slack`, `save`, `database`, `postgresql`, `redis`, `fetch`, `api`, `http`, `process`, `data`, `transform`

2. **AI & Automation** (`ai-automation`)
   - AI agents, decision making, content generation
   - Keywords: `agent`, `ai`, `claude`, `anthropic`, `decision`, `generate`, `content`, `analyze`, `intelligent`

3. **Connect to Services** (`connect-services`)
   - Call other services, receive from services
   - Keywords: `service`, `child-workflow`, `start-child`, `call`, `invoke`, `service-to-service`

4. **Connect to External** (`connect-external`)
   - External APIs, webhooks, third-party services
   - Keywords: `external`, `webhook`, `third-party`, `integration`, `connector`

5. **Receive Data** (`receive-data`)
   - API endpoints, webhook receivers
   - Keywords: `receive`, `endpoint`, `api-endpoint`, `webhook`, `post`, `input`, `trigger`

6. **Provide Data** (`provide-data`)
   - API queries, state queries
   - Keywords: `query`, `get`, `state`, `provide`, `read`, `retrieve`

7. **Control Flow** (`control-flow`)
   - Conditions, loops, retries
   - Keywords: `condition`, `if`, `loop`, `retry`, `repeat`, `while`, `for`, `branch`

**Decision Process:**

1. **Check existing categories first**: Review keywords and descriptions to see if your component fits
2. **Evaluate fit**: Does your component match the keywords and purpose of an existing category?
3. **Consider reclassification**: If your component doesn't fit but existing components also don't fit well, consider:
   - Creating a new category
   - Reclassifying existing components to a new category
   - Splitting an existing category if it's too broad
4. **Document rationale**: If creating a new category, document why and which components should move

**Reference:** See `packages/workflow-builder/src/lib/component-categorization.ts`

---

## Package Management

### 3. NPM Package Requirements

**Question:** Do we have a @bernierllc npm package for the activity code for this component? If not, why not?

**Decision Criteria:**

1. **Is this a reusable activity?**
   - If yes, it should be in a `@bernierllc/*` package
   - If no (component-specific logic), it can live in the component definition

2. **Package Naming Convention:**
   - Format: `@bernierllc/{package-name}`
   - Examples: `@bernierllc/temporal-activities`, `@bernierllc/email-activities`, `@bernierllc/database-activities`

3. **When to Create a New Package:**
   - New domain of functionality (e.g., email, database, notifications)
   - Significant set of related activities (5+ activities)
   - Reusable across multiple projects/workflows

4. **When to Add to Existing Package:**
   - Related to existing package's domain
   - Small addition (1-2 activities)
   - Fits the package's purpose

5. **When NOT to Create a Package:**
   - Component-specific logic that won't be reused
   - One-off implementations
   - Experimental/prototype code

**Package Structure:**
```
packages/
  {package-name}/
    src/
      activities/
        {activity-name}.activities.ts
      index.ts
    package.json
    README.md
```

**Activity Metadata Requirements:**
All activities in packages must export metadata:
```typescript
export const activityNameMetadata: ActivityMetadata = {
  name: 'activityName',
  displayName: 'Human-readable name',
  description: 'What this activity does',
  activityType: 'standard' | 'cli' | 'agentic',
  version: '1.0.0',
  tags: ['tag1', 'tag2'],
  expectedDurationMs: { min: 1000, avg: 5000, max: 30000 }
};
```

**Reference:** See `docs/standards/component-discoverability-and-reusability.md`

---

## React Flow UI Integration

### 4. Component Name

**Question:** What will the component name be?

**Naming Conventions:**

1. **Component Identifier (`name`):**
   - Format: `camelCase` (e.g., `sendEmail`, `fetchApiData`, `processFile`)
   - No spaces, no special characters
   - Descriptive and action-oriented
   - Must be unique within component type

2. **Display Name (`display_name`):**
   - Format: Human-readable with spaces (e.g., "Send Email", "Fetch API Data")
   - User-friendly description
   - Shown in component palette and node labels

3. **Kebab Name (for URLs/IDs):**
   - Format: `kebab-case` (e.g., `send-email`, `fetch-api-data`)
   - Generated automatically from `name`
   - Used in API endpoints, database IDs

**Examples:**
```typescript
{
  name: 'sendEmail',
  display_name: 'Send Email',
  // kebab_name: 'send-email' (auto-generated)
}
```

**Reference:** See `packages/workflow-builder/src/server/api/routers/components.ts`

---

### 5. Component Configuration

**Question:** What will the component configuration look like?

**Configuration Schema Structure:**

```typescript
interface ComponentConfig {
  // Component-specific fields
  [key: string]: any;
  
  // Common patterns:
  connectorId?: string;        // If requires connector
  endpointPath?: string;       // For data-in/data-out
  httpMethod?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  inputSchema?: JSONSchema;    // For data validation
  outputSchema?: JSONSchema;   // For output validation
  isPublic?: boolean;          // For public interfaces
}
```

**Configuration Schema Definition:**

Components must define a `config_schema` (JSON Schema) that:
- Validates user input in the property panel
- Provides field types, validation rules, default values
- Supports conditional fields (e.g., show connector selector only if connector required)

**Example:**
```typescript
const configSchema = {
  type: 'object',
  properties: {
    connectorId: {
      type: 'string',
      title: 'Email Connector',
      description: 'Select email service connector',
      // Connector selector UI component
    },
    to: {
      type: 'string',
      title: 'To',
      format: 'email',
      required: true
    },
    subject: {
      type: 'string',
      title: 'Subject',
      required: true
    },
    body: {
      type: 'string',
      title: 'Body',
      format: 'textarea',
      required: true
    }
  },
  required: ['connectorId', 'to', 'subject', 'body']
};
```

**Property Panel Integration:**

- Configuration fields appear in the property panel when component is selected
- Use appropriate input types (text, number, select, checkbox, etc.)
- Support validation and error messages
- Show/hide fields based on other field values

**Reference:** See `packages/workflow-builder/src/components/workflow/PropertyPanel.tsx`

---

### 6. Connector Requirements

**Question:** Will it have a connector? Does that connector already exist?

**Connector Types:**

1. **Email Connectors** (`email`)
   - SendGrid, SMTP, etc.
   - Used by: Send Email, Send Notification components

2. **Slack Connectors** (`slack`)
   - Slack webhook URLs, bot tokens
   - Used by: Send Slack Message components

3. **Database Connectors** (`database`)
   - PostgreSQL, MySQL, MongoDB connection strings
   - Used by: Save to Database, Read from Database components

4. **API Connectors** (`api`)
   - External API credentials, base URLs
   - Used by: Fetch API Data, Call External API components

5. **Custom Connectors**
   - Project-specific connector types
   - Defined per project

**Decision Process:**

1. **Does component need external credentials/config?**
   - Yes → Requires connector
   - No → Skip connector

2. **Check existing connector types:**
   - Review `packages/workflow-builder/plans/2025-01-20-services-components-connectors-refactor.md`
   - Check if connector type exists in database schema

3. **If connector needed but doesn't exist:**
   - Plan connector type creation
   - Define connector configuration schema
   - Plan connector management UI

**Connector Integration:**

```typescript
// Component config includes connector_id
{
  connectorId: 'connector-uuid',
  // ... other config
}

// Component implementation uses connector
const connector = await getConnector(config.connectorId);
// Use connector credentials/config
```

**Reference:** See `packages/workflow-builder/plans/2025-01-20-services-components-connectors-refactor.md`

---

### 7. Data Input/Output

**Question:** Will this component have data input? Data output?

**Input Schema (`input_schema`):**

- JSON Schema defining what data the component accepts
- Used for:
  - Type validation in workflow compiler
  - UI hints in property panel
  - Runtime validation

**Output Schema (`output_schema`):**

- JSON Schema defining what data the component returns
- Used for:
  - Type checking in workflow compiler
  - Downstream component validation
  - Documentation generation

**Data Flow Patterns:**

1. **No Input/Output:**
   - Trigger components (start workflow)
   - Some signal handlers

2. **Input Only:**
   - Data sinks (save to database, send notification)
   - Terminal components

3. **Output Only:**
   - Data sources (read from database, fetch API)
   - Initial components

4. **Input and Output:**
   - Transform components (process data, transform format)
   - Most activities and agents

**Schema Definition Example:**
```typescript
const inputSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    metadata: { type: 'object' }
  },
  required: ['email', 'name']
};

const outputSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    messageId: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' }
  },
  required: ['success']
};
```

**Reference:** See `packages/workflow-builder/docs/user-guide/components.md`

---

## Data Flow and Interfaces

### 8. Service Interface (Signal)

**Question:** Will this component be an interface for the service? (signal)

**Service Interfaces:**

Service interfaces allow services to communicate with each other within a project.

**Interface Types:**

1. **Signal Interface** (`signal`)
   - Send data to a running workflow
   - Maps to Temporal `signal`
   - Created from `data-in` components
   - Used for: Receiving events, user input, external triggers

2. **Query Interface** (`query`)
   - Read-only mechanism for checking workflow state
   - Maps to Temporal `query`
   - Created from `data-out` components
   - Used for: Status checks, state inspection

3. **Update Interface** (`update`)
   - Modify workflow state
   - Maps to Temporal `update`
   - Used for: State modifications

4. **Start Child Interface** (`start_child`)
   - Start a child workflow
   - Maps to Temporal `startChild`
   - Used for: Service composition

**Decision Process:**

1. **Is this a `data-in` or `data-out` component?**
   - Yes → Automatically creates service interface
   - No → Skip this section

2. **For `data-in` components:**
   - Creates `signal` interface
   - Maps to Temporal signal handler
   - Exposed as service interface

3. **For `data-out` components:**
   - Creates `query` interface
   - Maps to Temporal query handler
   - Exposed as service interface

**Interface Configuration:**

```typescript
// Created automatically from component config
{
  workflow_id: 'workflow-uuid',
  name: 'componentName',
  interface_type: 'signal' | 'query',
  callable_name: 'temporal-signal-name',
  input_schema: { /* from component */ },
  output_schema: { /* from component */ },
  activity_connection_id: 'component-uuid',
  is_public: false  // Set to true for public interfaces
}
```

**Reference:** See `packages/workflow-builder/src/lib/interfaces/interface-component-manager.ts`

---

### 9. Public Interface (Kong/UI)

**Question:** Will this component be an interface for the project? (Kong / UI interface - we have not built anything for this yet, but this is coming so it should be included)

**Public Interfaces:**

Public interfaces expose service functionality to external systems via Kong API Gateway.

**Planning Considerations:**

1. **Should this be publicly accessible?**
   - Yes → Set `is_public: true` in service interface
   - No → Keep as internal service interface

2. **Kong Route Creation:**
   - Public interfaces automatically create Kong routes
   - Route pattern: `/api/projects/{project_id}/services/{service_id}/interfaces/{interface_name}`
   - Authentication handled by Kong

3. **UI Interface (Future):**
   - Public interfaces may be exposed in project UI
   - User-facing API endpoints
   - Documentation generation

**Configuration:**
```typescript
// In component config
{
  endpointPath: '/receive-data',
  httpMethod: 'POST',
  isPublic: true,  // Creates public interface
  // ... other config
}
```

**Future Implementation:**
- Kong route management
- API documentation generation
- Rate limiting and authentication
- UI for testing public interfaces

**Reference:** See `packages/workflow-builder/plans/2025-01-20-services-components-connectors-refactor.md`

---

### 10. Task Queue Interface (Nexus)

**Question:** Will this component be an interface for the task queue? (Nexus)

**Nexus Integration:**

Nexus enables cross-project communication via Temporal's Nexus endpoints.

**Planning Considerations:**

1. **Does this component need cross-project communication?**
   - Yes → Plan Nexus integration
   - No → Skip this section

2. **Nexus Endpoint Types:**
   - **Start Operation**: Start workflow in another project
   - **Signal Operation**: Send signal to workflow in another project
   - **Query Operation**: Query workflow state in another project

3. **User-Friendly Terminology:**
   - ❌ "Nexus Endpoint" → ✅ "Project Connection"
   - ❌ "Service" → ✅ "Data Source"
   - ❌ "Operation" → ✅ "Action"
   - ❌ "StartOperation" → ✅ "Request Work From..."
   - ❌ "Signal" → ✅ "Send Data To..."

**Implementation Pattern:**
```typescript
// Component config for Nexus integration
{
  nexusEndpointId: 'endpoint-uuid',
  targetProjectId: 'project-uuid',
  operationType: 'start' | 'signal' | 'query',
  // ... other config
}
```

**Future Implementation:**
- Nexus endpoint management UI
- Project connection visualization
- Cross-project data flow tracking

**Reference:** See `packages/workflow-builder/plans/future-enhancements.md` (Cross-Project Communication via Nexus)

---

## Project Page Integration

### 11. Project Page Information Display

**Question:** Will this component show some information on the project page?

**Project Page Sections:**

1. **Service Visualization:**
   - Components appear as nodes in service builder view
   - Service-to-service connections shown
   - External connectors displayed

2. **Statistics Panel:**
   - Component execution counts
   - Success/failure rates
   - Average duration
   - Most used components

3. **Connector Management:**
   - Components requiring connectors listed
   - Connector usage by component
   - Connector status indicators

4. **Interface Display:**
   - Service interfaces listed
   - Public interfaces highlighted
   - Interface usage statistics

**Planning Considerations:**

1. **Should this component appear in project visualization?**
   - Yes → Ensure proper node rendering
   - No → Internal-only component

2. **Should this component have statistics?**
   - Yes → Plan metrics collection
   - No → Skip statistics

3. **Should this component appear in connector management?**
   - Yes (if uses connector) → Show in connector usage
   - No → Skip

**Implementation:**
```typescript
// Component metadata for project page
{
  showInVisualization: true,
  showStatistics: true,
  showInConnectorManagement: true,  // If uses connector
  // ... other metadata
}
```

**Reference:** See `packages/workflow-builder/src/components/service/ProjectView.tsx`

---

## Metrics and Monitoring

### 12. Metrics, Stats, Alerts

**Question:** Are there metrics, stats, alerts, or other things that need to be set up for this component?

**Metrics to Consider:**

1. **Execution Metrics:**
   - Execution count
   - Success rate
   - Failure rate
   - Average duration
   - P50, P90, P95, P99 percentiles

2. **Performance Metrics:**
   - Response time
   - Throughput
   - Resource usage (CPU, memory)
   - Queue depth (if applicable)

3. **Business Metrics:**
   - Usage frequency
   - User adoption
   - Error types and frequencies
   - Cost per execution (if applicable)

**Alerts to Consider:**

1. **Error Alerts:**
   - High failure rate (>10%)
   - Repeated failures
   - Timeout errors

2. **Performance Alerts:**
   - Slow execution (P95 > threshold)
   - High latency
   - Resource exhaustion

3. **Business Alerts:**
   - Unusual usage patterns
   - Capacity limits approaching

**Statistics Collection:**

Components automatically collect statistics if:
- Component is executed in workflows
- Execution monitoring is enabled
- Statistics panel is configured

**Custom Metrics:**

For components requiring custom metrics:
```typescript
// In component implementation
await recordMetric({
  componentId: 'component-uuid',
  metricName: 'custom-metric',
  value: metricValue,
  tags: { /* additional context */ }
});
```

**Reference:** See `packages/workflow-builder/docs/user-guide/execution-monitoring.md`

---

## Testing Considerations

### 13. Testing Requirements

**Question:** Testing WILL be included, is there extra testing we should consider?

**Standard Testing:**

1. **Unit Tests:**
   - Component logic
   - Configuration validation
   - Input/output schema validation
   - Error handling

2. **Integration Tests:**
   - Component execution in workflow
   - Connector integration (if applicable)
   - Service interface creation (if applicable)
   - Data flow validation

3. **E2E Tests:**
   - Full workflow execution
   - UI interaction
   - End-to-end data flow

**Additional Testing Considerations:**

1. **Connector Testing:**
   - Test connector selection
   - Test connector configuration
   - Test connector failure scenarios
   - Test connector switching

2. **Interface Testing:**
   - Test service interface creation
   - Test public interface exposure
   - Test interface data flow
   - Test interface error handling

3. **Performance Testing:**
   - Load testing
   - Stress testing
   - Latency testing
   - Resource usage testing

4. **Security Testing:**
   - Authentication/authorization
   - Input validation
   - SQL injection (if database)
   - XSS (if web interface)

5. **Edge Case Testing:**
   - Invalid inputs
   - Missing connectors
   - Network failures
   - Timeout scenarios
   - Concurrent execution

**Test Coverage Requirements:**

- Minimum 80% code coverage
- 100% coverage for critical paths
- All error paths tested
- All configuration options tested

**Reference:** See testing standards in `.cursor/rules/frameworks/testing/standards.mdc`

---

## Additional Considerations

### 14. Version Management

**Semantic Versioning:**
- Use semver format: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features (backward-compatible)
- PATCH: Bug fixes

**Version Strategy:**
- Start at `1.0.0` for new components
- Increment based on changes
- Document breaking changes

**Reference:** See `docs/standards/component-discoverability-and-reusability.md`

---

### 15. Visibility and Sharing

**Visibility Levels:**

1. **Private:**
   - Only creator can see/use
   - Default for new components

2. **Public:**
   - All users can see/use
   - For reusable components

3. **Organization:**
   - Organization members can see/use
   - Future feature

**Decision:**
- Start with `private`
- Move to `public` when ready for reuse
- Consider organization visibility for team components

---

### 16. Deprecation Strategy

**When to Deprecate:**
- Component replaced by better version
- Component no longer needed
- Breaking changes required

**Deprecation Process:**
1. Mark as deprecated in metadata
2. Add migration guidance
3. Log warnings when used
4. Maintain for 2 major versions before removal

---

### 17. Documentation Requirements

**Required Documentation:**

1. **Component Description:**
   - What it does
   - When to use it
   - Configuration options
   - Examples

2. **API Documentation:**
   - Input/output schemas
   - Error handling
   - Return values

3. **Integration Guide:**
   - How to use in workflows
   - Connector setup (if applicable)
   - Interface configuration (if applicable)

**Documentation Location:**
- Component description in database
- API docs in `/docs/api/`
- User guide in `/docs/user-guide/`

---

### 18. Error Handling

**Error Handling Patterns:**

1. **Validation Errors:**
   - Invalid configuration
   - Missing required fields
   - Type mismatches

2. **Execution Errors:**
   - External service failures
   - Network errors
   - Timeout errors

3. **Recovery Strategies:**
   - Retry logic
   - Fallback behavior
   - Error notifications

**Error Messages:**
- Clear and actionable
- Include context
- Suggest solutions

---

### 19. Security Considerations

**Security Requirements:**

1. **Authentication:**
   - Connector credentials encrypted
   - API keys secured
   - User permissions checked

2. **Authorization:**
   - Component access control
   - Connector access control
   - Interface access control

3. **Input Validation:**
   - Schema validation
   - Type checking
   - Sanitization

4. **Output Sanitization:**
   - Sensitive data filtering
   - Log sanitization
   - Error message sanitization

---

### 20. Performance Considerations

**Performance Requirements:**

1. **Execution Time:**
   - Expected duration
   - Timeout configuration
   - Async operations

2. **Resource Usage:**
   - Memory usage
   - CPU usage
   - Network bandwidth

3. **Scalability:**
   - Concurrent execution
   - Rate limiting
   - Caching strategies

---

## Planning Checklist

Use this checklist when planning a new component:

### Classification
- [ ] Component type selected (activity, agent, signal, trigger, data-in, data-out)
- [ ] Category determined (or new category planned)
- [ ] Reclassification of existing components considered

### Package Management
- [ ] NPM package identified or created
- [ ] Activity metadata defined
- [ ] Package structure planned

### React Flow UI
- [ ] Component name chosen (camelCase)
- [ ] Display name chosen (human-readable)
- [ ] Configuration schema defined
- [ ] Property panel fields planned

### Connectors
- [ ] Connector requirement determined
- [ ] Existing connector type identified or new type planned
- [ ] Connector configuration schema defined

### Data Flow
- [ ] Input schema defined (if applicable)
- [ ] Output schema defined (if applicable)
- [ ] Data validation planned

### Interfaces
- [ ] Service interface requirement determined (signal/query)
- [ ] Public interface requirement determined (Kong/UI)
- [ ] Nexus integration requirement determined (cross-project)

### Project Page
- [ ] Visualization requirement determined
- [ ] Statistics requirement determined
- [ ] Connector management display planned

### Metrics & Monitoring
- [ ] Metrics to collect identified
- [ ] Alerts to configure identified
- [ ] Statistics display planned

### Testing
- [ ] Unit tests planned
- [ ] Integration tests planned
- [ ] E2E tests planned
- [ ] Additional testing considerations identified

### Additional
- [ ] Version strategy planned
- [ ] Visibility level determined
- [ ] Deprecation strategy considered (if applicable)
- [ ] Documentation requirements identified
- [ ] Error handling planned
- [ ] Security considerations addressed
- [ ] Performance requirements defined

---

## References

### Documentation
- [Component User Guide](../packages/workflow-builder/docs/user-guide/components.md)
- [Component Discoverability Standards](./component-discoverability-and-reusability.md)
- [Services/Components/Connectors Refactor Plan](../packages/workflow-builder/plans/2025-01-20-services-components-connectors-refactor.md)
- [Execution Monitoring Guide](../packages/workflow-builder/docs/user-guide/execution-monitoring.md)

### Code References
- Component Categorization: `packages/workflow-builder/src/lib/component-categorization.ts`
- Component Router: `packages/workflow-builder/src/server/api/routers/components.ts`
- Interface Manager: `packages/workflow-builder/src/lib/interfaces/interface-component-manager.ts`
- Node Types: `packages/workflow-builder/src/components/workflow/nodes/index.ts`
- Property Panel: `packages/workflow-builder/src/components/workflow/PropertyPanel.tsx`
- Project View: `packages/workflow-builder/src/components/service/ProjectView.tsx`

### Database Schema
- Components Table: `packages/workflow-builder/supabase/migrations/20251114000001_initial_schema.sql`
- Service Interfaces: `packages/workflow-builder/supabase/migrations/20250120000003_create_service_interfaces.sql`

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-20 | AI Assistant | Initial comprehensive planning guide |

**Related Documents:**
- [Component Discoverability and Reusability Standards](./component-discoverability-and-reusability.md)
- [Testing Standards](../.cursor/rules/frameworks/testing/standards.mdc)
- [Architecture Overview](../docs/internal/architecture/)

