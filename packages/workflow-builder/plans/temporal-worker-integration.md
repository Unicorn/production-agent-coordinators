# Temporal Worker Integration Plan

## Executive Summary

This document outlines the plan for integrating actual Temporal workers with the Workflow Builder system, transitioning from the current simulated execution to real Temporal workflow orchestration.

**Current State**: Workflows are compiled to TypeScript code and execution is simulated  
**Target State**: Workflows are compiled, registered, and executed by real Temporal workers  
**Timeline**: 4-6 weeks for full integration  
**Complexity**: High - involves distributed system coordination

---

## Architecture Overview

### Current Architecture (Simulated)

```
┌─────────────┐
│ Workflow    │
│ Builder UI  │
└─────┬───────┘
      │
      ▼
┌─────────────────┐
│ Workflow        │
│ Compiler        │
└─────┬───────────┘
      │
      ▼
┌──────────────────┐
│ Simulated        │
│ Execution        │
│ (No real worker) │
└──────────────────┘
```

### Target Architecture (Real Temporal)

```
┌─────────────┐
│ Workflow    │
│ Builder UI  │
└─────┬───────┘
      │
      ▼
┌─────────────────┐      ┌──────────────┐
│ Workflow        │      │ Temporal     │
│ Compiler        ├─────▶│ Server       │
└─────┬───────────┘      │              │
      │                  │ - Workflows  │
      │                  │ - Activities │
      ▼                  │ - Schedules  │
┌──────────────────┐     └──────┬───────┘
│ Worker Registry  │            │
│ & Deployment     │            │
└─────┬────────────┘            │
      │                         │
      ▼                         ▼
┌──────────────────────────────────┐
│ Dynamic Temporal Workers         │
│                                  │
│ ┌────────────┐  ┌────────────┐ │
│ │ Worker 1   │  │ Worker 2   │ │
│ │ (Queue A)  │  │ (Queue B)  │ │
│ └────────────┘  └────────────┘ │
│                                  │
│ ┌────────────┐  ┌────────────┐ │
│ │ Worker 3   │  │ Worker N   │ │
│ │ (Queue C)  │  │ ...        │ │
│ └────────────┘  └────────────┘ │
└──────────────────────────────────┘
```

---

## Key Components

### 1. Temporal Server Connection

**Purpose**: Connect to Temporal server for workflow orchestration

**Configuration**:
```typescript
// src/lib/temporal/connection.ts
export interface TemporalConfig {
  address: string; // e.g., 'localhost:7233' or 'temporal.example.com:7233'
  namespace: string; // e.g., 'default' or 'workflow-builder'
  tls?: {
    clientCertPath: string;
    clientKeyPath: string;
    serverRootCACertificatePath: string;
  };
}

export async function createTemporalConnection(config: TemporalConfig) {
  const { Connection } = await import('@temporalio/client');
  
  return await Connection.connect({
    address: config.address,
    tls: config.tls,
  });
}
```

**Environment Variables**:
```bash
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TLS_ENABLED=false
TEMPORAL_CLIENT_CERT_PATH=/path/to/cert.pem
TEMPORAL_CLIENT_KEY_PATH=/path/to/key.pem
TEMPORAL_SERVER_ROOT_CA_PATH=/path/to/ca.pem
```

---

### 2. Worker Registry

**Purpose**: Track and manage deployed workers dynamically

**Database Schema** (extend existing):
```sql
-- Worker registration table
CREATE TABLE IF NOT EXISTS public.workflow_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id VARCHAR(255) NOT NULL UNIQUE,
  task_queue_id UUID NOT NULL REFERENCES public.task_queues(id),
  status VARCHAR(50) NOT NULL CHECK (status IN ('starting', 'running', 'stopping', 'stopped', 'failed')),
  host VARCHAR(255),
  port INTEGER,
  process_id VARCHAR(255),
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  last_heartbeat TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Worker capabilities (what workflows/activities it can execute)
CREATE TABLE IF NOT EXISTS public.worker_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES public.workflow_workers(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  activity_name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workers_task_queue ON public.workflow_workers(task_queue_id);
CREATE INDEX idx_workers_status ON public.workflow_workers(status);
CREATE INDEX idx_worker_capabilities_worker ON public.worker_capabilities(worker_id);
CREATE INDEX idx_worker_capabilities_workflow ON public.worker_capabilities(workflow_id);
```

---

### 3. Dynamic Worker Manager

**Purpose**: Start, stop, and manage Temporal workers dynamically

**Implementation**:
```typescript
// src/lib/temporal/worker-manager.ts
import { Worker } from '@temporalio/worker';
import { createClient } from '@/lib/supabase/server';

export class DynamicWorkerManager {
  private workers: Map<string, Worker> = new Map();
  
  async startWorker(options: {
    workerId: string;
    taskQueue: string;
    workflowsPath: string;
    activitiesPath: string;
  }) {
    const worker = await Worker.create({
      workflowsPath: options.workflowsPath,
      activities: await this.loadActivities(options.activitiesPath),
      taskQueue: options.taskQueue,
    });
    
    this.workers.set(options.workerId, worker);
    
    // Register in database
    await this.registerWorker(options.workerId, options.taskQueue);
    
    // Start worker (non-blocking)
    worker.run().catch(error => {
      console.error(`Worker ${options.workerId} error:`, error);
      this.handleWorkerError(options.workerId, error);
    });
    
    return worker;
  }
  
  async stopWorker(workerId: string) {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.shutdown();
      this.workers.delete(workerId);
      await this.unregisterWorker(workerId);
    }
  }
  
  private async loadActivities(activitiesPath: string) {
    // Dynamically import activities from generated code
    const activities = await import(activitiesPath);
    return activities;
  }
  
  private async registerWorker(workerId: string, taskQueue: string) {
    const supabase = createClient();
    
    // Get task queue ID
    const { data: queue } = await supabase
      .from('task_queues')
      .select('id')
      .eq('name', taskQueue)
      .single();
    
    // Register worker
    await supabase.from('workflow_workers').insert({
      worker_id: workerId,
      task_queue_id: queue?.id,
      status: 'running',
      host: process.env.HOSTNAME || 'localhost',
      process_id: process.pid.toString(),
      started_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
    });
  }
  
  private async unregisterWorker(workerId: string) {
    const supabase = createClient();
    await supabase
      .from('workflow_workers')
      .update({
        status: 'stopped',
        stopped_at: new Date().toISOString(),
      })
      .eq('worker_id', workerId);
  }
  
  private async handleWorkerError(workerId: string, error: Error) {
    const supabase = createClient();
    await supabase
      .from('workflow_workers')
      .update({
        status: 'failed',
        metadata: { error: error.message },
        stopped_at: new Date().toISOString(),
      })
      .eq('worker_id', workerId);
  }
  
  async heartbeat() {
    const supabase = createClient();
    for (const [workerId] of this.workers) {
      await supabase
        .from('workflow_workers')
        .update({ last_heartbeat: new Date().toISOString() })
        .eq('worker_id', workerId);
    }
  }
}

// Singleton instance
export const workerManager = new DynamicWorkerManager();

// Heartbeat interval
setInterval(() => workerManager.heartbeat(), 30000); // Every 30 seconds
```

---

### 4. Workflow Deployment Pipeline

**Purpose**: Deploy compiled workflows to workers

**Flow**:
```
1. User clicks "Build Workflow"
   ↓
2. Workflow Compiler generates TypeScript code
   ↓
3. Code is written to file system or database
   ↓
4. Worker Manager is notified
   ↓
5. Worker loads new workflow definition
   ↓
6. Worker registers with Temporal
   ↓
7. Workflow is ready for execution
```

**Implementation**:
```typescript
// src/lib/temporal/deployment.ts
export class WorkflowDeployment {
  async deploy(workflowId: string): Promise<DeploymentResult> {
    // 1. Get workflow from database
    const workflow = await this.getWorkflow(workflowId);
    
    // 2. Compile to TypeScript
    const compiled = compileWorkflow(workflow, {
      includeComments: true,
      strictMode: true,
    });
    
    // 3. Write to file system
    const deploymentPath = await this.writeToFileSystem(workflowId, compiled);
    
    // 4. Start or update worker
    const workerId = `worker-${workflowId}-${Date.now()}`;
    const worker = await workerManager.startWorker({
      workerId,
      taskQueue: workflow.taskQueue,
      workflowsPath: `${deploymentPath}/workflow.ts`,
      activitiesPath: `${deploymentPath}/activities.ts`,
    });
    
    // 5. Record deployment
    await this.recordDeployment(workflowId, workerId, deploymentPath);
    
    return {
      success: true,
      workerId,
      deploymentPath,
      worker,
    };
  }
  
  private async writeToFileSystem(
    workflowId: string,
    compiled: CompiledWorkflow
  ): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const deploymentDir = path.join(
      process.cwd(),
      'deployed-workflows',
      workflowId
    );
    
    await fs.mkdir(deploymentDir, { recursive: true });
    await fs.writeFile(path.join(deploymentDir, 'workflow.ts'), compiled.workflowCode);
    await fs.writeFile(path.join(deploymentDir, 'activities.ts'), compiled.activitiesCode);
    await fs.writeFile(path.join(deploymentDir, 'worker.ts'), compiled.workerCode);
    await fs.writeFile(path.join(deploymentDir, 'package.json'), compiled.packageJson);
    await fs.writeFile(path.join(deploymentDir, 'tsconfig.json'), compiled.tsConfig);
    
    return deploymentDir;
  }
  
  private async recordDeployment(
    workflowId: string,
    workerId: string,
    deploymentPath: string
  ) {
    const supabase = createClient();
    await supabase.from('workflow_deployments').insert({
      workflow_id: workflowId,
      worker_id: workerId,
      deployment_path: deploymentPath,
      deployed_at: new Date().toISOString(),
      status: 'active',
    });
  }
}
```

---

### 5. Workflow Execution

**Purpose**: Start and monitor Temporal workflow executions

**Implementation**:
```typescript
// src/lib/temporal/execution.ts
export class WorkflowExecutor {
  private client: WorkflowClient;
  
  constructor(client: WorkflowClient) {
    this.client = client;
  }
  
  async execute(options: {
    workflowId: string;
    input: Record<string, any>;
    executionId: string;
  }): Promise<ExecutionHandle> {
    // Get workflow details
    const workflow = await this.getWorkflow(options.workflowId);
    
    // Start Temporal workflow
    const handle = await this.client.start(workflow.name, {
      taskQueue: workflow.taskQueue,
      workflowId: `${options.workflowId}-${options.executionId}`,
      args: [options.input],
    });
    
    // Update execution record
    await this.updateExecution(options.executionId, {
      status: 'running',
      temporal_workflow_id: handle.workflowId,
      temporal_run_id: handle.firstExecutionRunId,
    });
    
    // Monitor execution (non-blocking)
    this.monitorExecution(handle, options.executionId);
    
    return handle;
  }
  
  private async monitorExecution(
    handle: WorkflowHandle,
    executionId: string
  ) {
    try {
      const result = await handle.result();
      
      await this.updateExecution(executionId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        output: result,
      });
    } catch (error) {
      await this.updateExecution(executionId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error.message,
      });
    }
  }
  
  async getExecutionStatus(executionId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .single();
    
    // If Temporal IDs exist, get detailed status from Temporal
    if (data?.temporal_workflow_id) {
      const handle = this.client.getHandle(data.temporal_workflow_id);
      const description = await handle.describe();
      
      return {
        ...data,
        temporal_status: description.status.name,
        temporal_history_length: description.historyLength,
      };
    }
    
    return data;
  }
}
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup ✅ COMPLETE

**Status**: READY FOR PHASE 2

**Completed**:
- ✅ POC fully functional with simulated execution
- ✅ All database schema in place
- ✅ Workflow compiler working
- ✅ Execution tracking implemented
- ✅ UI complete with real-time status updates
- ✅ All console warnings resolved (4 remaining are Tamagui internal, cosmetic only)

**Ready to Start**:
- [ ] Install Temporal CLI and start local server
- [ ] Add `@temporalio/client`, `@temporalio/worker`, `@temporalio/workflow` dependencies
- [ ] Run worker registry migrations (already have schema, need to apply)
- [ ] Create `.env` configuration for Temporal connection
- [ ] Test basic Temporal connection

**Success Criteria for Phase 1→2 Transition**:
- ✅ POC demonstrates full workflow (DONE)
- ✅ Database ready (DONE)
- ✅ Compiler generates valid TypeScript (DONE)
- 🔄 Temporal server running locally (NEXT)
- 🔄 Can connect from Next.js app (NEXT)

---

### Phase 2: Worker Manager (Current Focus)

**Goals**:
- Implement dynamic worker management
- Create worker lifecycle management
- Connect simulated execution to real Temporal workers

**Prerequisites**:
1. **Temporal Server Running**
   ```bash
   # Install Temporal CLI
   brew install temporal
   
   # Start local Temporal server
   temporal server start-dev
   # Server will run on localhost:7233
   # Web UI available at http://localhost:8233
   ```

2. **Add Temporal Dependencies**
   ```bash
   cd packages/workflow-builder
   yarn add @temporalio/client @temporalio/worker @temporalio/workflow @temporalio/activity @temporalio/common
   ```

3. **Apply Worker Registry Migrations**
   ```bash
   # Create migration file: supabase/migrations/20251117000001_worker_registry.sql
   # (Schema already defined in plan, need to create actual file)
   ```

**Tasks**:
- [ ] Set up local Temporal server
- [ ] Install Temporal SDK packages
- [ ] Create worker registry migration
- [ ] Implement `DynamicWorkerManager` class
- [ ] Create worker registration/unregistration logic
- [ ] Implement heartbeat mechanism
- [ ] Create worker status monitoring API
- [ ] Update execution router to use real Temporal client
- [ ] Add worker management UI (admin panel)

**Success Criteria**:
- ✅ Temporal server running on localhost:7233
- ✅ Can connect from Next.js app
- ✅ Can start a worker programmatically
- ✅ Can stop a worker gracefully
- ✅ Worker status is tracked in database
- ✅ Can view active workers in UI
- ✅ Existing "Build Workflow" button triggers real Temporal execution

---

### Phase 3: Deployment Pipeline (Week 3-4)

**Goals**:
- Deploy compiled workflows to file system
- Load workflows into workers dynamically

**Tasks**:
- [ ] Implement `WorkflowDeployment` class
- [ ] Create file system deployment logic
- [ ] Implement dynamic workflow loading in workers
- [ ] Add deployment status tracking
- [ ] Create deployment UI controls

**Success Criteria**:
- Can deploy workflow from UI
- Workflow code is written to file system
- Worker loads and registers workflow with Temporal
- Deployment status is visible in UI

---

### Phase 4: Workflow Execution (Week 4-5)

**Goals**:
- Execute workflows on Temporal
- Track execution status in real-time

**Tasks**:
- [ ] Implement `WorkflowExecutor` class
- [ ] Connect "Build Workflow" button to real Temporal execution
- [ ] Implement execution status polling
- [ ] Add execution history view
- [ ] Create execution retry/cancel controls

**Success Criteria**:
- Can start a workflow from UI
- Workflow executes on Temporal server
- Execution status updates in real-time
- Can view execution history in Temporal Web UI

---

### Phase 5: Advanced Features (Week 5-6)

**Goals**:
- Implement scheduled workflows (cron)
- Add signal and query support
- Implement child workflow orchestration

**Tasks**:
- [ ] Implement cron workflow scheduling
- [ ] Add signal handlers to workflow executor
- [ ] Implement query handlers
- [ ] Create child workflow spawning logic
- [ ] Add work queue integration

**Success Criteria**:
- Can create scheduled workflows
- Can send signals to running workflows
- Can query workflow state
- Can spawn child workflows
- Work queues function correctly

---

### Phase 6: Production Readiness (Week 6+)

**Goals**:
- Add monitoring and observability
- Implement error handling and recovery
- Prepare for production deployment

**Tasks**:
- [ ] Add structured logging
- [ ] Implement error handling and retry logic
- [ ] Create monitoring dashboards
- [ ] Add health check endpoints
- [ ] Write deployment documentation
- [ ] Create backup and recovery procedures

**Success Criteria**:
- System is observable (logs, metrics, traces)
- Errors are handled gracefully
- Can recover from failures
- Documentation is complete
- Ready for production deployment

---

## Deployment Strategies

### Strategy 1: Single Worker (Simplest)

**Description**: One long-running worker handles all workflows

**Pros**:
- Simple to implement
- Easy to debug
- Low resource usage

**Cons**:
- Not scalable
- Single point of failure
- Limited to one task queue

**Use Case**: Development, POC, small-scale deployments

```
┌──────────────────┐
│   Single Worker  │
│                  │
│ All Workflows    │
│ All Activities   │
└──────────────────┘
```

---

### Strategy 2: Task Queue Per Workflow (Recommended)

**Description**: Dedicated worker for each workflow/task queue

**Pros**:
- Good isolation
- Scales horizontally
- Can restart individual workflows

**Cons**:
- More resource usage
- More complexity

**Use Case**: Production deployments, multi-tenant systems

```
┌────────────┐  ┌────────────┐  ┌────────────┐
│ Worker 1   │  │ Worker 2   │  │ Worker N   │
│ Queue A    │  │ Queue B    │  │ Queue N    │
└────────────┘  └────────────┘  └────────────┘
```

---

### Strategy 3: Shared Workers (Advanced)

**Description**: Pool of workers share workflows based on load

**Pros**:
- Most efficient resource usage
- Best scalability
- Load balancing

**Cons**:
- Complex to implement
- Requires orchestration layer

**Use Case**: High-scale production, cloud deployments

```
┌─────────────────────────────────┐
│      Worker Pool Manager        │
└─────────────┬───────────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐
│Worker 1│ │Worker 2│ │Worker N│
└────────┘ └────────┘ └────────┘
```

---

## Security Considerations

### 1. Code Execution
- **Risk**: Generated workflow code could contain malicious logic
- **Mitigation**:
  - Sandboxed execution environment
  - Code review for public workflows
  - Resource limits (CPU, memory, time)
  - Input validation and sanitization

### 2. Access Control
- **Risk**: Unauthorized access to workflows or execution
- **Mitigation**:
  - RLS policies on all tables
  - User authentication required
  - Workflow ownership verification
  - Temporal namespace isolation

### 3. Secrets Management
- **Risk**: Workflow activities might need secrets (API keys, etc.)
- **Mitigation**:
  - Use environment variables
  - Integrate with secret management system (AWS Secrets Manager, HashiCorp Vault)
  - Never store secrets in workflow definitions
  - Rotate secrets regularly

### 4. Resource Exhaustion
- **Risk**: Workflows consuming too many resources
- **Mitigation**:
  - Rate limiting on workflow starts
  - Execution time limits
  - Memory limits per worker
  - Activity retry limits

---

## Monitoring and Observability

### Metrics to Track

**Worker Metrics**:
- Worker count (active/stopped/failed)
- Worker CPU/memory usage
- Worker heartbeat status
- Worker uptime

**Workflow Metrics**:
- Workflow execution count
- Workflow success/failure rate
- Workflow execution duration
- Workflow retry count

**System Metrics**:
- API response times
- Database query performance
- Temporal server health
- Error rates

### Logging Strategy

**Structured Logging**:
```typescript
logger.info('Workflow started', {
  workflowId,
  userId,
  taskQueue,
  timestamp: new Date().toISOString(),
});

logger.error('Workflow execution failed', {
  workflowId,
  executionId,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString(),
});
```

**Log Aggregation**:
- Use centralized logging (e.g., CloudWatch, Datadog, ELK stack)
- Correlate logs with workflow execution IDs
- Alert on error patterns

---

## Testing Strategy

### Unit Tests
- Test workflow compiler output
- Test worker manager lifecycle
- Test deployment pipeline
- Test execution tracking

### Integration Tests
- Test end-to-end workflow execution
- Test worker registration/deregistration
- Test signal/query handling
- Test cron workflow scheduling

### Load Tests
- Test multiple concurrent workflows
- Test worker scaling
- Test Temporal server limits
- Test database performance under load

---

## Rollout Plan

### Phase 1: Internal Testing (Week 6-7)
- Deploy to staging environment
- Run end-to-end tests
- Invite internal users for testing
- Gather feedback and iterate

### Phase 2: Beta Release (Week 8-9)
- Deploy to production with feature flag
- Enable for select beta users
- Monitor metrics and logs
- Address issues as they arise

### Phase 3: General Availability (Week 10+)
- Remove feature flag
- Announce to all users
- Provide documentation and tutorials
- Monitor adoption and support

---

## Maintenance and Support

### Ongoing Tasks
- Monitor worker health
- Rotate secrets
- Update Temporal server
- Backup workflow definitions
- Clean up old executions

### Support Channels
- Documentation site
- Community forum/Discord
- Email support
- GitHub issues

---

## Success Metrics

**Technical Metrics**:
- 99.9% uptime for worker system
- < 100ms workflow start latency
- < 1% workflow execution failure rate
- < 5 minute deployment time

**Business Metrics**:
- Number of workflows created
- Number of workflow executions
- User satisfaction score
- Feature adoption rate

---

## Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Temporal server downtime | High | Low | Redundant Temporal cluster, monitoring |
| Worker crashes | Medium | Medium | Auto-restart, health checks, monitoring |
| Code compilation errors | Medium | Medium | Validation, testing, error handling |
| Security vulnerabilities | High | Low | Code review, sandboxing, audits |
| Performance issues | Medium | Medium | Load testing, optimization, scaling |

---

## Resources Needed

### Infrastructure
- Temporal server (self-hosted or cloud)
- Worker compute resources (EC2, Kubernetes, etc.)
- Database (already have Supabase)
- Monitoring tools (Datadog, New Relic, or open source)

### Team
- Backend developer (2-3 weeks full-time)
- DevOps engineer (1 week for infrastructure)
- QA engineer (1 week for testing)
- Technical writer (1 week for documentation)

### Budget Estimate
- Infrastructure: $200-500/month (varies by scale)
- Monitoring: $0-200/month (can use open source)
- Development time: 4-6 weeks
- Total: $5K-15K (including labor)

---

## Conclusion

Integrating real Temporal workers with the Workflow Builder system is feasible and will unlock powerful distributed workflow orchestration capabilities. The phased approach allows for incremental delivery of value while managing complexity and risk.

**Recommended Next Steps**:
1. Review and approve this plan
2. Set up local Temporal server for development
3. Begin Phase 1 (Infrastructure Setup)
4. Schedule weekly check-ins to track progress

**Timeline**: 6-10 weeks for full production readiness  
**Risk Level**: Medium (manageable with proper planning)  
**Value**: High (enables core product functionality)

---

## References

- [Temporal Documentation](https://docs.temporal.io/)
- [Temporal TypeScript SDK](https://github.com/temporalio/sdk-typescript)
- [Temporal Server Setup](https://docs.temporal.io/self-hosted-guide)
- [Temporal Best Practices](https://docs.temporal.io/dev-guide/temporal-sdk/best-practices)
- [Workflow Builder Architecture](./2025-11-14-workflow-builder-system-design.md)

