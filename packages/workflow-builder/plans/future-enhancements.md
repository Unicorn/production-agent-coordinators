# Future Features & Enhancements

**Status**: Backlog  
**Priority**: Determined based on usage, feedback, and implementation impact

This document captures all planned features and optimizations for future development phases. Features are organized by priority to guide implementation decisions.

---

## High Priority Future Work

### 1. Multi-Queue Support Per Project

**Status**: Planned for future phase  
**Priority**: High  
**Complexity**: Medium

#### Current State

- Each project automatically gets a single default task queue
- Queue naming: `{userId_prefix}-{project-kebab-name}-queue`
- Queue display name: `{Project Name} Task Queue`
- All workflows in a project use the project's default queue

#### Planned Enhancements

1. **Multiple Task Queues Per Project**
   - Allow users to create additional task queues within a project
   - Use cases:
     - Separate queues for different workflow types (e.g., high-priority vs. background)
     - Environment-specific queues (dev, staging, prod)
     - Team-based queues for workflow organization

2. **Queue Management UI**
   - Create new queues within a project
   - View all queues associated with a project
   - Edit queue properties (name, description)
   - Set queue-specific worker configurations
   - Archive/disable unused queues

3. **Workflow-Queue Assignment**
   - Allow workflows to specify which queue they use
   - Support queue switching for existing workflows
   - Validate queue belongs to workflow's project
   - Show queue usage statistics per workflow

4. **Queue Configuration Options**
   - Max concurrent tasks
   - Task timeout defaults
   - Worker assignment rules
   - Rate limiting
   - Priority levels

5. **Worker Management Per Queue**
   - View active workers for each queue
   - Start/stop workers for specific queues
   - Monitor worker health per queue
   - Configure worker scaling policies

#### Implementation Considerations

**Database Changes**:
```sql
-- Add queue configuration table
CREATE TABLE task_queue_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_queue_id UUID NOT NULL REFERENCES task_queues(id) ON DELETE CASCADE,
  max_concurrent_tasks INTEGER,
  default_timeout_seconds INTEGER,
  priority_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraint to ensure queue belongs to project
ALTER TABLE task_queues
ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- Update workflows to explicitly reference their queue
-- (already exists, but ensure validation)
```

**API Changes**:
- `projects.listQueues(projectId)` - List all queues for a project
- `projects.createQueue(projectId, name, config)` - Create new queue
- `projects.updateQueue(queueId, config)` - Update queue settings
- `projects.deleteQueue(queueId)` - Delete/archive queue
- `workflows.setQueue(workflowId, queueId)` - Change workflow's queue

**UI Changes**:
- Project detail page: List of queues
- Queue management page: Create/edit/delete queues
- Workflow form: Dropdown to select queue from project's queues
- Worker dashboard: Filter by queue

#### Migration Path

1. **Phase 1** (Current):
   - Single default queue per project
   - Automatic queue creation on project creation
   - All workflows use project's default queue

2. **Phase 2** (Next):
   - Add `project_id` to `task_queues` table
   - Migrate existing queues to be associated with projects
   - Add UI to view project queues
   - Maintain backward compatibility

3. **Phase 3** (Future):
   - Enable multiple queue creation
   - Add queue selection to workflow form
   - Implement queue configuration options
   - Add worker management per queue

---

### 2. Activity Worker Splitting (Performance Optimization)

**Status**: Planned  
**Priority**: High  
**Complexity**: High

#### Problem

As a project grows, some activities may become bottlenecks or consume disproportionate resources.

#### Solution

Automatically split high-usage activities to dedicated workers within a project's namespace.

#### Implementation

- Use `activity_statistics` table to identify:
  - High execution count activities (> 1000/day threshold)
  - High-latency activities (p95 > 5s threshold)
  - High-failure-rate activities (failure rate > 5%)
- Create dedicated task queue for that activity: `{user_id}-{project_id}-{activity_name}`
- Start a dedicated worker for that task queue
- Route that activity's executions to the dedicated worker
- Keep other activities on the main project worker

**Statistics Already Captured**:
```sql
-- From activity_statistics table
execution_count
avg_duration_ms
p95_duration_ms
p99_duration_ms
failure_count
requires_dedicated_worker -- Boolean flag we can set
```

#### UI Changes

- Project dashboard shows "Hot Activities" section
- Suggest splitting with one-click action
- Show cost/benefit analysis (estimated performance improvement)

#### Benefits

- Isolate resource-heavy activities
- Prevent one activity from blocking others
- Better resource allocation
- Easier debugging and monitoring

---

### 3. Cross-Project Communication via Nexus

**Status**: Planned  
**Priority**: High  
**Complexity**: High

#### Problem

Users need workflows in different projects to communicate (send signals, query data).

#### Challenge

Temporal's Nexus endpoints require setup and configuration that users shouldn't need to understand.

#### Solution

Obfuscate Nexus with user-friendly UI terminology.

**UI Terminology** (Temporal → User-Friendly):
- ❌ "Nexus Endpoint" → ✅ "Project Connection"
- ❌ "Service" → ✅ "Data Source"
- ❌ "Operation" → ✅ "Action"
- ❌ "StartOperation" → ✅ "Request Work From..."
- ❌ "Signal" → ✅ "Send Data To..."

#### Implementation

```typescript
// User sees: "Connect to Project B"
// Behind the scenes: Create Nexus endpoint

// Step 1: User selects "Share Data" in Project A
// Step 2: System creates Nexus service for Project A
// Step 3: User selects "Receive Data From Project A" in Project B
// Step 4: System creates Nexus endpoint in Project B pointing to Project A
// Step 5: UI shows: "Project B can now receive data from Project A"
```

#### UI Flow

1. **Project Settings** → "Connections" tab
2. **"Share Data With Other Projects"** button
   - Shows list of other user's projects
   - Select project → generates connection code
3. **"Connect To Another Project"** button
   - Paste connection code
   - System validates and establishes Nexus link
4. **In Workflow Builder**:
   - New node type: "Send to Project"
   - Dropdown: Select connected project
   - Input: Data to send
   - System generates Nexus StartOperation call

#### Security

- Users can only connect their own projects (same user_id)
- Future: Add "Share project access" for team collaboration
- Connection requires mutual consent (both projects must approve)

#### Database Schema

```sql
CREATE TABLE project_connections (
  id UUID PRIMARY KEY,
  source_project_id UUID REFERENCES projects(id),
  target_project_id UUID REFERENCES projects(id),
  nexus_endpoint_id VARCHAR(255), -- Temporal Nexus ID
  connection_name VARCHAR(255), -- User-friendly name
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4. Worker Auto-Scaling

**Status**: Planned  
**Priority**: High  
**Complexity**: High

#### Problem

Fixed one-worker-per-project doesn't handle variable load.

#### Solution

Dynamically scale workers based on queue depth and execution metrics.

#### Metrics to Monitor

- Task queue depth (from Temporal)
- Average wait time for tasks
- Worker CPU/memory usage
- Execution failure rate

#### Scaling Rules

```typescript
// Scale UP if:
- Queue depth > 100 tasks
- Average wait time > 30 seconds
- Worker CPU > 80% for 5 minutes

// Scale DOWN if:
- Queue depth < 10 tasks
- Average wait time < 5 seconds
- Worker CPU < 20% for 15 minutes
```

#### Implementation

- Monitor task queue via Temporal gRPC API
- Store metrics in `workflow_workers` table
- Background job checks every 30 seconds
- Scale up: Start additional worker with same task queue
- Scale down: Gracefully shutdown excess workers

#### Constraints

- Min workers per project: 1
- Max workers per project: 10 (configurable)
- Scale-up cooldown: 5 minutes
- Scale-down cooldown: 15 minutes

---

### 5. Multi-Region Deployment

**Status**: Planned  
**Priority**: High  
**Complexity**: High

#### Problem

Users want low-latency execution in different geographic regions.

#### Solution

Deploy worker pools in multiple regions, route workflows to nearest region.

#### Architecture

- Temporal Cloud with multi-region support
- Regional worker pools (us-east, us-west, eu-west, ap-south)
- Projects can specify preferred region(s)
- Workflows route to specified region's task queue

#### Task Queue Naming (updated)

```
{user_id}-{project_id}-{region}
Example: user-123-project-456-us-east
```

#### UI

- Project settings: "Preferred Regions" multi-select
- Default: Closest region to user
- Advanced: Pin specific workflows to specific regions

---

## Medium Priority Future Work

### 6. Workflow Versioning & Rollback

**Status**: Planned  
**Priority**: Medium  
**Complexity**: High

#### Current State

Each compilation creates a new version, but no rollback mechanism.

#### Planned Features

- List all versions of a workflow
- Compare versions (diff view)
- Rollback to previous version
- A/B testing between versions
- Git-like workflow history

#### UI

- "Version History" tab in workflow details
- Show version number, compiled date, compiled by
- "Rollback" button on any version
- "Deploy" button to make a version active
- Diff view to compare two versions side-by-side

---

### 7. Workflow Testing & Simulation

**Status**: Planned  
**Priority**: Medium  
**Complexity**: High

#### Problem

Users want to test workflows before deploying to production.

#### Solution

- Test mode: Execute workflow in isolated environment
- Mock activities: Provide sample inputs/outputs
- Replay testing: Re-run historical executions
- Load testing: Simulate high volume
- Test data generation
- Test coverage tracking

#### UI

- "Test Workflow" button in builder
- Define test inputs
- Mock external dependencies
- View test results and logs
- Save test cases for regression testing

---

### 8. Advanced Monitoring & Alerting

**Status**: Planned  
**Priority**: Medium  
**Complexity**: High

#### Features

- Real-time workflow execution monitoring
- Real-time execution metrics dashboard
- Alerts for failures, slow executions, high error rates
- Integration with external monitoring (Datadog, New Relic)
- Custom SLOs per workflow
- Performance metrics and alerts
- Error tracking and debugging
- Cost analysis and optimization suggestions

#### Metrics to Track

- Execution count (success/failure)
- Execution duration (avg, p50, p95, p99)
- Activity success rates
- Queue depth over time
- Worker health

#### Alerting Rules

- Execution failure rate > 10%
- Execution duration > 5x average
- Queue depth growing continuously
- Worker offline for > 5 minutes

---

### 9. Team Collaboration

**Status**: Planned  
**Priority**: Medium  
**Complexity**: Medium

#### Current State

One user per project.

#### Planned Features

- Team workspaces
- Share projects with team members
- Role-based access (owner, editor, viewer)
- Workflow sharing and permissions
- Audit log of changes
- Comments and annotations on workflows
- Activity feed for changes
- Real-time collaborative editing

#### Roles

- **Owner**: Full control, can delete
- **Editor**: Can modify workflows, can't delete project
- **Viewer**: Read-only access, can view executions
- **Runner**: Can execute workflows, can't edit

---

### 10. Workflow Templates & Marketplace

**Status**: Planned  
**Priority**: Medium  
**Complexity**: Medium

#### Vision

Library of pre-built workflows users can clone and customize.

#### Templates

- Pre-built workflow templates for common use cases
- Data processing pipelines
- API integration patterns
- Notification workflows
- Approval workflows
- Scheduled reports
- Template versioning and updates
- Fork/clone templates for customization

#### Marketplace

- Users can publish workflows as templates (public or paid)
- Browse by category, popularity, rating
- One-click clone to your project
- Automatic updates when template changes
- Template marketplace for sharing workflows

---

### 11. Cost Optimization & Budgets

**Status**: Planned  
**Priority**: Medium  
**Complexity**: Medium

#### Problem

Users want to control costs as usage scales.

#### Features

- Set budget limits per project
- Pause workflows when budget exceeded
- Cost estimates before execution
- Recommendations for optimization
- Usage reports and projections

#### Cost Factors

- Workflow execution count
- Activity execution count
- Execution duration
- Worker hours
- Storage (compiled code, execution history)

---

### 12. Advanced Workflow Patterns

**Status**: Planned  
**Priority**: Medium  
**Complexity**: High

#### Already Implemented (Phase 2)

- Cron workflows
- Signals
- Queries
- Work queues

#### Future Patterns

- **Sagas**: Long-running distributed transactions with compensation
- **Fan-out/Fan-in**: Parallel execution with aggregation
- **State Machines**: Complex state transitions with guards
- **Event Sourcing**: Workflow-driven event log
- **CQRS**: Separate read/write models

---

### 13. Developer Experience Enhancements

**Status**: Planned  
**Priority**: Medium  
**Complexity**: Medium

#### Code Generation

- Export workflow as standalone TypeScript project
- Generate OpenAPI spec from workflow
- Create SDK for calling workflow from external apps

#### Local Development

- VS Code extension for workflow editing
- Local debugging with breakpoints
- Hot reload for workflow changes
- TypeScript types auto-generated from workflow definition

#### CLI

```bash
# Deploy workflow
wfb deploy --project my-project --workflow my-workflow

# Execute workflow
wfb run --workflow my-workflow --input '{"key": "value"}'

# View logs
wfb logs --execution abc-123

# Manage workers
wfb workers list
wfb workers start --project my-project
wfb workers stop --project my-project
```

---

## Low Priority / Nice to Have

### 14. Workflow Analytics

**Status**: Planned  
**Priority**: Low  
**Complexity**: Medium

- Execution trends over time
- Popular workflows
- Most active users
- Bottleneck detection
- Cost per workflow type

---

### 15. Integrations

**Status**: Planned  
**Priority**: Low  
**Complexity**: Medium

- Zapier-like connectors
- Pre-built activities for common APIs (Stripe, Twilio, SendGrid)
- Database connectors (Postgres, MongoDB, Redis)
- Cloud service integrations (AWS, GCP, Azure)

---

### 16. Security Enhancements

**Status**: Planned  
**Priority**: Low  
**Complexity**: High

- Secrets management (encrypted storage)
- Audit logs for all actions
- Compliance reports (SOC2, HIPAA, GDPR)
- IP whitelisting for worker connections
- SSO/SAML support

---

### 17. Advanced UI Features

**Status**: Planned  
**Priority**: Low  
**Complexity**: Low to Medium

- Dark mode
- Keyboard shortcuts
- Drag-and-drop workflow creation (already planned for Phase 2)
- Workflow diff/merge
- Search across all workflows

---

### 18. Mobile App

**Status**: Planned  
**Priority**: Low  
**Complexity**: High

- View workflow status
- Approve/reject manual approval steps
- Receive push notifications for execution events
- Basic workflow creation (simplified UI)

---

### 19. AI-Powered Features

**Status**: Planned  
**Priority**: Low  
**Complexity**: High

- **Natural Language Workflow Creation**: Describe workflow in plain English, AI generates it
- **Workflow Suggestions**: AI suggests workflows based on project description
- **Workflow Optimization Suggestions**: AI analyzes execution patterns and suggests improvements
- **Activity Recommendations**: AI recommends activities for workflow nodes
- **Automatic Error Detection and Fixes**: AI suggests fixes for failed executions
- **Error Resolution**: AI suggests fixes for failed executions
- **Intelligent Workflow Recommendations**: AI recommends workflows based on usage patterns

---

## Statistics Collection (Already in Phase 2)

The following statistics are already being collected in Phase 2 to support future optimization:

### Project-Level

```sql
total_workflow_executions
total_activity_executions
avg_execution_duration_ms
last_execution_at
```

### Workflow-Level (compiled_code)

```sql
execution_count
avg_execution_duration_ms
error_count
last_executed_at
```

### Activity-Level

```sql
execution_count
success_count
failure_count
avg_duration_ms
p95_duration_ms
p99_duration_ms
requires_dedicated_worker -- Flag for future splitting
```

### Worker-Level

```sql
total_tasks_completed
total_tasks_failed
avg_task_duration_ms
cpu_usage_percent
memory_usage_mb
```

These statistics will enable:
- Activity worker splitting (when needed)
- Auto-scaling decisions
- Performance optimization
- Cost analysis
- Capacity planning

---

## Implementation Priority Suggestions

When ready to implement, consider this order:

1. **Activity Worker Splitting** (highest impact on performance)
2. **Workflow Versioning & Rollback** (critical for production safety)
3. **Cross-Project Communication** (enables advanced use cases)
4. **Advanced Monitoring & Alerting** (production readiness)
5. **Team Collaboration** (enables business scaling)
6. **Worker Auto-Scaling** (cost optimization)
7. **Workflow Templates & Marketplace** (user acquisition)
8. **Multi-Region Deployment** (enterprise feature)
9. **Multi-Queue Support** (organizational flexibility)

---

## Contributing

To propose a new enhancement or update an existing one:

1. Add the enhancement to this document
2. Include status, priority, and complexity
3. Describe current state and planned improvements
4. Document implementation considerations
5. Create a GitHub issue for tracking
6. Link the issue in this document

---

## Notes

- This is a living document - add new ideas as they come up
- Prioritization should be data-driven (user requests, usage patterns)
- Some features may become unnecessary (validate before building)
- Keep the UI simple and user-friendly (don't expose Temporal complexity)

---

## References

- [Phase 2 Plan](./phase2.md)
- [Architecture Rules](../.cursor/rules/architecture.mdc)
- [Development Workflow](../.cursor/rules/development-workflow.mdc)
