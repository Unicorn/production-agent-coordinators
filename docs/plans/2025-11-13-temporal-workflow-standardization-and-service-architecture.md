# Temporal Workflow Standardization and Service-Oriented Architecture

**Date:** 2025-11-13
**Status:** Design
**Version:** 1.0

## Executive Summary

This design establishes standards for Temporal workflow naming, component discoverability, and a service-oriented architecture for autonomous package lifecycle management. The system consists of long-running service workflows that signal each other through standardized contracts, using MCP as the central package state store and Git for versioned artifacts.

**Key Objectives:**
1. Standardize naming conventions for workflows, activities, and agentic components
2. Improve UI readability and operational visibility in Temporal
3. Enable component discoverability and reusability across workflows
4. Create service-oriented architecture for package lifecycle (discovery → planning → building → QA → publishing)
5. Refactor existing workflows for consistency while building new services incrementally

---

## Table of Contents

1. [Architecture Vision](#architecture-vision)
2. [Standards (Enforced)](#standards-enforced)
3. [Recommendations (Guidance)](#recommendations-guidance)
4. [Service Ecosystem](#service-ecosystem)
5. [Orchestration Patterns](#orchestration-patterns)
6. [Migration Plan](#migration-plan)
7. [Implementation Phases](#implementation-phases)
8. [Future Enhancements](#future-enhancements)

---

## Architecture Vision

### Core Principles

**Microservices within Temporal**: Each workflow is a long-running service with single responsibility, signaling between services for handoffs.

**MCP as State Store**: The packages-api MCP serves as the central registry for package lifecycle status, plan file paths, and quality metrics.

**Git as Artifact Store**: Plans, code, tests, and documentation are versioned in Git. Feature branches use `--no-verify` for intermediate commits; main branch enforces quality gates.

**Self-Improving System**: Workflows can request new specialized agents from the Agent Prompt Writer service, creating a system that evolves its own capabilities.

### Service-Oriented Workflow Model

```
Long-Running Service Workflows (always running)
  ├─> Receive signals from other services
  ├─> Query MCP for work
  ├─> Process work items
  ├─> Update MCP with status
  ├─> Commit artifacts to Git (--no-verify on feature branches)
  └─> Signal downstream services

Short-Running Task Workflows (spawned per package/entity)
  ├─> Named by entity being processed
  ├─> Execute specific task
  ├─> Report results to parent service
  └─> Terminate on completion
```

---

## Standards (Enforced)

These standards are **mandatory** for all workflows, activities, and components.

### 1. Naming Conventions

#### Workflow Naming

**Long-Running Service Workflows:**
- **Pattern:** `{service-name}-service` (kebab-case)
- **Examples:**
  - `plan-writer-service`
  - `package-builder-service`
  - `qa-service`
  - `discovery-service`
- **Workflow ID:** Same as workflow name (no timestamps, no package names)
- **TypeScript:** PascalCase for workflow function names (e.g., `PlanWriterServiceWorkflow`)

**Short-Running Task Workflows:**
- **Pattern:** `{entity-identifier}` or `{service}:{entity-identifier}`
- **Examples:**
  - `@bernierllc/package-name`
  - `builder:@bernierllc/package-name`
- **Workflow ID:** Constructed with entity being processed
- **TypeScript:** PascalCase for workflow function names (e.g., `PackageBuildWorkflow`)

#### Activity Naming

**Standard Activities:**
- **Pattern:** `{verb}{Noun}` (camelCase)
- **Examples:**
  - `executeSpecDecision`
  - `verifyDependencies`
  - `writePackageBuildReport`
- **NEVER** use "Activity" suffix
- **ALWAYS** start with action verb

**CLI/Command Activities:**
- **Pattern:** `run{Command}` (camelCase)
- **Examples:**
  - `runBuild`
  - `runTests`
  - `runLint`

**Agentic Activities (calls to AI agents):**
- **Pattern:** `spawn{AgentName}Agent` (camelCase)
- **Examples:**
  - `spawnFixAgent`
  - `spawnTestWriterAgent`
  - `spawnDocsAgent`
  - `spawnWhimsyAgent`
- **Required metadata:**
  - `modelProvider`: e.g., "anthropic", "openai"
  - `modelName`: e.g., "claude-sonnet-4-5-20250929"
  - `agentPromptId`: Reference to agent registry entry
  - `agentPromptVersion`: Semver version of prompt

**Activity Display Names (for Temporal UI):**
- **Pattern:** Human-readable description
- **Examples:**
  - Activity: `runBuild` → Display: "Run package build (npm run build)"
  - Activity: `spawnFixAgent` → Display: "Fix test failures (claude-sonnet-4-5 | fix-agent-v1.2.0)"
  - Activity: `verifyDependencies` → Display: "Verify all dependencies are published"

**Format for Agentic Display Names:**
```
{Human Description} ({model-name} | {agent-prompt-id}-v{version})
```

Example:
```typescript
{
  name: 'spawnFixAgent',
  displayName: 'Fix test failures (claude-sonnet-4-5 | fix-agent-v1.2.0)',
  modelProvider: 'anthropic',
  modelName: 'claude-sonnet-4-5-20250929',
  agentPromptId: 'fix-agent',
  agentPromptVersion: '1.2.0'
}
```

#### Type Naming

- **Pattern:** `{Entity}{Purpose}{Kind}` (PascalCase)
- **Examples:**
  - `PackageBuildInput`
  - `BuildResult`
  - `QAValidationResult`
  - `ServiceSignalPayload`

### 2. Component Metadata Standards

All workflows and activities MUST include standardized metadata for discoverability.

#### Workflow Metadata

```typescript
interface WorkflowMetadata {
  name: string;              // Workflow function name (PascalCase)
  workflowId: string;        // Workflow ID pattern
  description: string;       // Human-readable description
  serviceType: 'long-running' | 'short-running';
  triggers: string[];        // What triggers this workflow
  signalsTo: string[];       // Which services it signals
  signalsFrom: string[];     // Which services signal it
  mcpOperations: string[];   // Which MCP operations it performs
  gitOperations: string[];   // Which git operations it performs
  version: string;           // Semver version
}
```

**Example:**
```typescript
export const PlanWriterServiceMetadata: WorkflowMetadata = {
  name: 'PlanWriterServiceWorkflow',
  workflowId: 'plan-writer-service',
  description: 'Long-running service that writes package plans and files them to MCP',
  serviceType: 'long-running',
  triggers: ['discovery-service', 'monitor-service', 'integration-service', 'ideation-service'],
  signalsTo: ['mcp-api'],
  signalsFrom: ['discovery-service', 'monitor-service', 'integration-service', 'ideation-service'],
  mcpOperations: ['packages_update (plan_file_path, plan_git_branch, status)'],
  gitOperations: ['commit --no-verify', 'push origin feature/{package-name}'],
  version: '1.0.0'
};
```

#### Activity Metadata

```typescript
interface ActivityMetadata {
  name: string;              // Activity function name (camelCase)
  displayName: string;       // Human-readable UI name
  description: string;       // What this activity does
  activityType: 'standard' | 'cli' | 'agentic';

  // Agentic activities only:
  modelProvider?: string;    // e.g., 'anthropic', 'openai'
  modelName?: string;        // e.g., 'claude-sonnet-4-5-20250929'
  agentPromptId?: string;    // Reference to agent registry
  agentPromptVersion?: string; // Semver version
}
```

**Example (Agentic):**
```typescript
export const spawnFixAgentMetadata: ActivityMetadata = {
  name: 'spawnFixAgent',
  displayName: 'Fix test failures (claude-sonnet-4-5 | fix-agent-v1.2.0)',
  description: 'Spawns AI agent to analyze and fix failing tests',
  activityType: 'agentic',
  modelProvider: 'anthropic',
  modelName: 'claude-sonnet-4-5-20250929',
  agentPromptId: 'fix-agent',
  agentPromptVersion: '1.2.0'
};
```

### 3. Signal Contracts Standards

All service-to-service signals MUST follow standardized payload formats.

#### Signal Payload Format

```typescript
interface ServiceSignalPayload<T = unknown> {
  signalType: string;           // e.g., 'package_plan_needed', 'build_complete'
  sourceService: string;        // e.g., 'discovery-service'
  targetService: string;        // e.g., 'plan-writer-service'
  packageId: string;            // e.g., '@bernierllc/package-name'
  timestamp: string;            // ISO 8601
  priority?: 'low' | 'normal' | 'high' | 'critical';
  data?: T;                     // Signal-specific data
}
```

#### Standard Signal Types

| Signal Type | Source | Target | Payload Data | Description |
|-------------|--------|--------|--------------|-------------|
| `package_plan_needed` | Discovery, Monitor, Integration, Ideation | Plan Writer | `{ reason: string, context: object }` | Request new package plan |
| `plan_written` | Plan Writer | Builder | `{ planFilePath: string, gitBranch: string }` | Plan ready for implementation |
| `build_complete` | Builder | Docs, QA | `{ gitBranch: string, testsPassed: boolean }` | Build finished |
| `docs_written` | Docs | QA | `{ gitBranch: string }` | Documentation complete |
| `qa_passed` | QA | Publisher | `{ gitBranch: string, qualityScore: number }` | All quality gates passed |
| `qa_failed` | QA | Builder | `{ failures: string[], gitBranch: string }` | Quality gates failed, rework needed |
| `published` | Publisher | Monitor | `{ version: string, npmUrl: string }` | Package published to npm |
| `agent_prompt_needed` | Any | Agent Prompt Writer | `{ purpose: string, capabilities: string[] }` | Request new agent prompt |

#### Error Handling in Signals

All signal handlers MUST:
1. Validate payload schema
2. Return acknowledgment
3. Handle failures gracefully (dead letter queue for failed signals)
4. Log signal receipt and processing

```typescript
async function handleSignal(signal: ServiceSignalPayload): Promise<void> {
  try {
    validateSignalPayload(signal);
    await processSignal(signal);
    logger.info('Signal processed', { signalType: signal.signalType, packageId: signal.packageId });
  } catch (error) {
    logger.error('Signal processing failed', { signal, error });
    await sendToDeadLetterQueue(signal, error);
    throw error;
  }
}
```

### 4. Git Branching Strategy

**Feature Branches:**
- **Pattern:** `feature/{package-name}` (e.g., `feature/@bernierllc/my-package`)
- **Commits:** Use `git commit --no-verify` and `git push origin feature/{package-name} --no-verify`
- **Purpose:** Allow intermediate commits without triggering hooks during active development

**Main Branch:**
- **Merges:** Only from feature branches that pass ALL quality gates
- **Protection:** Enforced by Publisher service after QA passes
- **Hooks:** Full validation on merge (tests, linting, build, quality score)

**Quality Gates for Merge to Main:**
1. All tests pass (100% pass rate)
2. Linting passes (no errors)
3. Build succeeds
4. Documentation complete
5. QA quality score meets threshold
6. No security vulnerabilities

### 5. MCP Integration Standards

**Required Status Fields:**
- `status`: Enum of lifecycle states
- `plan_file_path`: Absolute path to plan markdown file
- `plan_git_branch`: Feature branch where plan is committed
- `current_version`: Published version (if any)
- `quality_score`: 0-100 score from QA service
- `health_score`: 0-100 score from Monitor service

**Status Lifecycle:**

```
discovered → plan_needed → plan_written → plan_ready → building → built →
docs_written → qa_in_progress → qa_passed → publishing → published → monitored
                                      ↓
                                  qa_failed → building (rework loop)
```

**MCP Operations by Service:**

| Service | MCP Operations |
|---------|---------------|
| Discovery | `packages_create`, `packages_update (status=plan_needed)` |
| Plan Writer | `packages_update (plan_file_path, plan_git_branch, status=plan_written)` |
| Builder | `packages_query (status=plan_ready)`, `packages_update (status=building/built)` |
| Docs | `packages_update (status=docs_written)` |
| QA | `packages_update (quality_score, status=qa_passed/qa_failed)` |
| Publisher | `packages_update (current_version, status=published)` |
| Monitor | `packages_query`, `packages_update (health_score)` |

---

## Recommendations (Guidance)

These are **guidelines** for workflow design, not enforced rules. Context matters.

### Workflow Size and Scope

**When to break up a workflow:**
- Workflow has multiple distinct responsibilities (violates Single Responsibility Principle)
- Different parts scale independently (e.g., building vs. QA)
- Different failure modes require different retry/compensation strategies
- Different parts have different SLAs or priorities
- You want to reuse part of the workflow in other contexts

**When to keep workflow together:**
- Steps are tightly coupled and share state
- Breaking up creates more complexity than value
- Transaction semantics require atomicity
- Coordination overhead outweighs benefits

**Example Analysis: Package Builder**

**Current (Monolithic):**
```
PackageBuilderWorkflow:
  - Query MCP for plans
  - Clone repo
  - Run build
  - Run tests
  - Fix failures (spawn agent)
  - Write docs
  - Run QA
  - Publish
```

**Recommended (Service-Oriented):**
```
BuilderService:
  - Query MCP for plans
  - Clone repo
  - Run build
  - Run tests
  - Fix failures (spawn agent)
  - Signal Docs service

DocsService:
  - Receive build complete signal
  - Generate/update documentation
  - Signal QA service

QAService:
  - Receive docs complete signal
  - Run quality validation
  - Signal Publisher (pass) or Builder (fail)

PublisherService:
  - Receive QA passed signal
  - Merge to main
  - Publish to npm
```

**Why?** Each service has distinct scaling needs, failure modes, and can be optimized independently.

### Service Sizing Principles

1. **One service per lifecycle stage**: Discovery, Planning, Building, Docs, QA, Publishing, Monitoring
2. **Synchronous handoffs**: Service signals next service upon completion
3. **Async triggers**: Services can also be triggered by schedules (cron) or webhooks (future)
4. **Idempotency**: All services must handle duplicate signals gracefully
5. **Stateless where possible**: Use MCP and Git as external state; workflow state should be minimal

---

## Service Ecosystem

### Service Catalog

| Service | Workflow ID | Service Type | Description | Triggers | Signals To |
|---------|-------------|--------------|-------------|----------|------------|
| **Discovery** | `discovery-service` | Long-running | Scans business repos for MECE package opportunities | Schedule, Manual, Webhook (future) | Plan Writer |
| **Monitor** | `monitor-service` | Long-running | Queries MCP for package health, outdated deps | Schedule, MCP Events (future webhook) | Plan Writer |
| **Integration** | `integration-service` | Long-running | Identifies cross-package integration opportunities | Package Publish, Manual | Plan Writer |
| **Ideation** | `ideation-service` | Long-running | Uses whimsy/creative agents for enhancement ideas | Schedule, User Request | Plan Writer |
| **Plan Writer** | `plan-writer-service` | Long-running | Writes package plans, commits to Git, files to MCP | Discovery, Monitor, Integration, Ideation | MCP (HTTP) |
| **Builder** | `package-builder-service` | Long-running | Queries MCP for plans, builds packages, runs tests | MCP query, QA (rework), Manual | Docs, QA, MCP (HTTP), Git |
| **Docs** | `docs-service` | Long-running | Writes/updates package documentation | Builder (code complete), Manual | QA, MCP (HTTP), Git |
| **QA** | `qa-service` | Long-running | Validates quality requirements | Builder, Docs (completion) | Publisher (pass), Builder (fail), MCP (HTTP) |
| **Publisher** | `publisher-service` | Long-running | Merges to main, publishes to npm | QA (passed) | MCP (HTTP), Git (merge to main) |
| **Agent Prompt Writer** | `agent-prompt-writer-service` | Long-running | Writes/updates/versions agent prompts, registers them | Any Service, Human | Agent Registry, Git |

### Service Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                    External Triggers                         │
│  (Cron, Manual, Webhooks from mbernier.com [future])       │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────────────────┐
│              Information Gathering Services                    │
│  ┌──────────┐ ┌─────────┐ ┌────────────┐ ┌─────────┐        │
│  │Discovery │ │ Monitor │ │Integration │ │Ideation │        │
│  └────┬─────┘ └────┬────┘ └─────┬──────┘ └────┬────┘        │
│       │            │(MCP query)  │             │             │
└───────┼────────────┼─────────────┼─────────────┼─────────────┘
        │            │             │             │
        └────────────┴─────────────┴─────────────┘
                     │
                     ▼ Signal: package_plan_needed
        ┌────────────────────────┐
        │    Plan Writer         │
        │    Service             │──┐
        └────────────┬───────────┘  │ Git: feature/{pkg} --no-verify
                     │              │ MCP: status=plan_written
                     ▼              ▼
        ┌─────────────────────────────────┐
        │            MCP                   │
        │   Package Status Store           │
        └──────────────┬──────────────────┘
                       │
                       ▼ Query: status=plan_ready
        ┌──────────────────────────┐
    ┌───│       Builder            │──┐
    │   │       Service            │  │ Git: feature/{pkg} --no-verify
    │   └──────────┬───────────────┘  │ MCP: status=building → built
    │              │                  │
    │              ▼                  ▼
    │   ┌──────────────────────┐
    │   │       Docs           │──┐
    │   │      Service         │  │ Git: feature/{pkg} --no-verify
    │   └──────────┬───────────┘  │ MCP: status=docs_written
    │              │              │
    │              ▼              ▼
    │   ┌──────────────────────┐
    │ ┌─│        QA            │──┐
    │ │ │      Service         │  │ MCP: status=qa_in_progress
    │ │ └──────────┬───────────┘  │
    │ │            │              │
    │ │            ├─ PASS ───────┼──> MCP: status=qa_passed
    │ │            │              │
    │ └─ FAIL ─────┘              ▼
    │   (Signal: rework_needed)
    │                      ┌──────────────────┐
    └─────────────────────>│    Publisher     │
                           │     Service      │
                           └──────────┬───────┘
                                      │
                                      ├──> Git: merge to main (quality gate)
                                      ├──> npm publish
                                      └──> MCP: status=published
                                           │
                                           ▼
                                  Monitor Service (health checks)
```

---

## Orchestration Patterns

### Pattern 1: Long-Running Service Workflow

**Use Case:** Discovery, Monitor, Plan Writer, Builder, Docs, QA, Publisher services

**Structure:**
```typescript
export async function LongRunningServiceWorkflow(): Promise<void> {
  // Long-running loop
  while (true) {
    // Listen for signals
    const workItem = await waitForSignal<WorkItem>('work_available');

    // Process work
    await processWorkItem(workItem);

    // Update MCP
    await updateMCPStatus(workItem.packageId, 'completed');

    // Signal downstream service
    await signalDownstreamService(workItem);

    // Wait for next work
  }
}
```

**Key Characteristics:**
- Never terminates (runs indefinitely)
- Listens for signals from upstream services
- Queries external systems (MCP, Git) for work
- Signals downstream services upon completion
- Updates MCP with status changes

### Pattern 2: Scheduled Service Workflow

**Use Case:** Discovery service (cron), Monitor service (periodic health checks)

**Structure:**
```typescript
export async function ScheduledServiceWorkflow(): Promise<void> {
  while (true) {
    // Wait for schedule or signal
    const trigger = await Promise.race([
      scheduleActivity(discoverPackages, { schedule: '0 */6 * * *' }), // Every 6 hours
      waitForSignal<void>('trigger_now')
    ]);

    // Execute work
    const discoveries = await executeActivity(discoverPackages);

    // Signal downstream for each discovery
    for (const discovery of discoveries) {
      await signalService('plan-writer-service', {
        signalType: 'package_plan_needed',
        packageId: discovery.packageId,
        data: discovery
      });
    }
  }
}
```

### Pattern 3: QA Feedback Loop

**Use Case:** QA service that can pass work to Publisher or kick back to Builder

**Structure:**
```typescript
export async function QAServiceWorkflow(): Promise<void> {
  while (true) {
    const workItem = await waitForSignal<QAWorkItem>('qa_needed');

    const result = await executeActivity(validateQualityGates, workItem);

    if (result.passed) {
      // Signal Publisher
      await signalService('publisher-service', {
        signalType: 'qa_passed',
        packageId: workItem.packageId,
        data: { qualityScore: result.score, gitBranch: workItem.gitBranch }
      });
    } else {
      // Signal Builder for rework
      await signalService('package-builder-service', {
        signalType: 'qa_failed',
        packageId: workItem.packageId,
        data: { failures: result.failures, gitBranch: workItem.gitBranch }
      });
    }

    // Update MCP regardless
    await updateMCPStatus(workItem.packageId, result.passed ? 'qa_passed' : 'qa_failed');
  }
}
```

### Pattern 4: Agent Prompt Writer Service

**Use Case:** Any service or human can request new agent prompts

**Structure:**
```typescript
export async function AgentPromptWriterServiceWorkflow(): Promise<void> {
  while (true) {
    const request = await waitForSignal<AgentPromptRequest>('agent_prompt_needed');

    // Spawn creative agent to write prompt
    const prompt = await spawnPromptWriterAgent(request.purpose, request.capabilities);

    // Version the prompt
    const version = await determineNextVersion(request.agentPromptId);

    // Write to registry
    const registryPath = `agents/registry/${request.agentPromptId}/v${version}.md`;
    await executeActivity(writeFile, { path: registryPath, content: prompt });

    // Commit to git
    await executeActivity(gitCommit, {
      message: `feat: Add ${request.agentPromptId} v${version}`,
      files: [registryPath],
      branch: 'main',
      noVerify: false // Full validation for agent prompts
    });

    // Register in metadata
    await executeActivity(updateAgentRegistry, {
      agentPromptId: request.agentPromptId,
      version: version,
      filePath: registryPath,
      capabilities: request.capabilities
    });

    // Respond to requester
    await respondToSignal(request.sourceService, {
      agentPromptId: request.agentPromptId,
      version: version,
      ready: true
    });
  }
}
```

---

## Migration Plan

### Phase 1: Extract Standards from Existing Workflows

**Goal:** Document current patterns in `plan-writer-service` and `package-builder-service`

**Tasks:**
1. Analyze plan-writer workflow naming patterns
2. Analyze package-builder workflow naming patterns
3. Document activity naming conventions
4. Document type naming conventions
5. Identify agentic activities and their metadata
6. Extract signal patterns (if any)
7. Create standards document (this document)

**Deliverables:**
- Standards documentation (this document)
- Naming patterns reference (NAMING_PATTERNS_REFERENCE.md)
- Current workflow analysis (WORKFLOW_STRUCTURE_ANALYSIS.md)

### Phase 2: Refactor plan-writer-service for Standards Compliance

**Goal:** Apply new naming standards to plan-writer-service as proof-of-concept

**Tasks:**
1. Rename workflow ID from `plan-writer-{datetime}` to `plan-writer-service`
2. Add workflow metadata object
3. Rename activities to follow conventions
4. Add activity metadata (including display names)
5. Standardize signal payloads
6. Update MCP integration to use standard status lifecycle
7. Implement Git branching strategy (feature/{package-name})
8. Add component discoverability (metadata exports)
9. Update tests
10. Deploy and validate in Temporal UI

**Success Criteria:**
- Workflow ID is `plan-writer-service` (no datetime)
- Activity names in UI are human-readable
- Agentic activities show model and prompt version
- Can restart workflow by service name alone
- All metadata is exported and discoverable

**Lessons Learned:**
- Document pain points and surprises
- Update migration plan for package-builder based on learnings

### Phase 3: Refactor package-builder-service for Standards Compliance

**Goal:** Apply updated migration plan to package-builder-service

**Tasks:**
1. Review lessons learned from plan-writer migration
2. Update migration plan as needed
3. Rename workflow ID from `package-builder-{datetime}` to `package-builder-service`
4. Add workflow metadata
5. Rename all activities (build, test, agent, report)
6. Add activity metadata with display names
7. Standardize signal contracts
8. Implement QA feedback loop (signal to qa-service, receive rework signal)
9. Update Git strategy for feature branches
10. Update tests
11. Deploy and validate

**Success Criteria:**
- Same as Phase 2
- QA feedback loop works correctly
- Builder can receive rework signals from QA

### Phase 4: Build New Services (Incremental)

**Goal:** Build new long-running services using standards from day 1

**Priority Order:**
1. **QA Service** (needed for feedback loop with Builder)
2. **Docs Service** (builder handoff)
3. **Publisher Service** (terminal service)
4. **Monitor Service** (queries MCP for health)
5. **Discovery Service** (scans repos)
6. **Integration Service** (cross-package opportunities)
7. **Ideation Service** (creative enhancements)
8. **Agent Prompt Writer Service** (on-demand agent creation)

**For Each Service:**
1. Define service metadata
2. Define signal contracts (inputs/outputs)
3. Identify activities needed
4. Create activity metadata
5. Implement workflow following patterns
6. Write tests
7. Deploy
8. Validate in Temporal UI
9. Test signal integration with other services

### Phase 5: Agent Prompt Registry

**Goal:** Create centralized, versioned registry for agent prompts

**Tasks:**
1. Design registry structure (`agents/registry/{agent-id}/v{version}.md`)
2. Create registry metadata schema
3. Migrate existing agent prompts to registry
4. Implement Agent Prompt Writer service
5. Create API for querying registry
6. Update all agentic activities to reference registry

**Registry Structure:**
```
agents/
  registry/
    fix-agent/
      v1.0.0.md
      v1.1.0.md
      v1.2.0.md
      metadata.json
    test-writer-agent/
      v1.0.0.md
      metadata.json
    whimsy-agent/
      v1.0.0.md
      metadata.json
  registry-index.json
```

**metadata.json Schema:**
```json
{
  "agentPromptId": "fix-agent",
  "latestVersion": "1.2.0",
  "versions": [
    {
      "version": "1.0.0",
      "filePath": "agents/registry/fix-agent/v1.0.0.md",
      "createdAt": "2025-11-01T00:00:00Z",
      "capabilities": ["fix-failing-tests", "analyze-errors"]
    },
    {
      "version": "1.2.0",
      "filePath": "agents/registry/fix-agent/v1.2.0.md",
      "createdAt": "2025-11-13T00:00:00Z",
      "capabilities": ["fix-failing-tests", "analyze-errors", "suggest-test-improvements"]
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Standardization (Weeks 1-2)

- [ ] Extract standards from existing workflows
- [ ] Create comprehensive documentation (this document)
- [ ] Create naming patterns reference
- [ ] Create migration plan
- [ ] Get stakeholder approval

### Phase 2: Pilot Migration - Plan Writer (Weeks 3-4)

- [ ] Refactor plan-writer-service
- [ ] Apply naming standards
- [ ] Add metadata
- [ ] Test in Temporal UI
- [ ] Document lessons learned
- [ ] Update migration plan

### Phase 3: Package Builder Migration (Weeks 5-6)

- [ ] Refactor package-builder-service
- [ ] Implement QA feedback loop (stub QA service if needed)
- [ ] Apply updated migration plan
- [ ] Test in Temporal UI
- [ ] Validate end-to-end

### Phase 4: Core Services (Weeks 7-12)

- [ ] Build QA Service (Week 7)
- [ ] Build Docs Service (Week 8)
- [ ] Build Publisher Service (Week 9)
- [ ] Build Monitor Service (Week 10)
- [ ] Build Discovery Service (Week 11)
- [ ] Test full pipeline (Week 12)

### Phase 5: Advanced Services (Weeks 13-16)

- [ ] Build Integration Service (Week 13)
- [ ] Build Ideation Service (Week 14)
- [ ] Build Agent Prompt Writer Service (Week 15)
- [ ] Build Agent Prompt Registry (Week 16)

### Phase 6: Optimization & Scaling (Weeks 17+)

- [ ] Performance tuning
- [ ] Worker scaling strategy
- [ ] Observability improvements
- [ ] Cost optimization
- [ ] Documentation finalization

---

## Future Enhancements

### 1. MCP Webhooks

**Vision:** mbernier.com sends webhooks to Monitor/Discovery services when package events occur

**Use Cases:**
- Package health degradation detected → Trigger Monitor service
- New package dependency published → Trigger Integration service
- Security vulnerability detected → Trigger Monitor service (high priority)

**Implementation:**
- Temporal supports webhook triggers via HTTP API
- MCP sends POST to Temporal webhook endpoint
- Temporal routes to appropriate service workflow
- Service processes event and signals downstream

### 2. Temporal Nexus Integration

**Vision:** Services expose APIs via Temporal Nexus for external integration

**Use Cases:**
- External systems can request package builds
- CI/CD pipelines can query build status
- Humans can trigger services via API (not just Temporal UI)

**Benefits:**
- Service abstraction (hide Temporal implementation details)
- Versioned service APIs
- Cross-namespace communication
- Better integration with existing systems

### 3. Multi-Repo Discovery

**Vision:** Discovery service can add/remove/query repos dynamically

**Implementation:**
- Discovery service maintains list of repos in Temporal state or external DB
- Admin API to add/remove repos
- Validation step: Check repo access (GitHub token permissions)
- Parallel scanning of multiple repos
- Deduplication of package discoveries across repos

### 4. Human-in-the-Loop Workflows

**Vision:** Some workflows pause and wait for human approval

**Use Cases:**
- Plan Writer writes plan → Human reviews → Approve/Reject → Builder proceeds
- QA finds critical issues → Human reviews → Approve merge anyway / Reject
- Agent Prompt Writer creates new agent → Human reviews → Approve/Reject

**Implementation:**
- Temporal signals for human input
- Web UI for human review queues
- Timeout policies for stale approvals
- Audit trail of human decisions

---

## Appendix A: Reference Materials

**Related Documents:**
- `TEMPORAL_DOCUMENTATION_INDEX.md` - Navigation guide for temporal docs
- `WORKFLOW_STRUCTURE_ANALYSIS.md` - Detailed analysis of current workflows
- `NAMING_PATTERNS_REFERENCE.md` - Quick reference for naming conventions
- `CODE_EXAMPLES.md` - Real code examples from current workflows

**External Resources:**
- [Temporal Best Practices](https://docs.temporal.io/dev-guide)
- [Temporal Nexus](https://docs.temporal.io/nexus)
- [Temporal Signals](https://docs.temporal.io/dev-guide/typescript/features#signals)
- [Temporal Schedules](https://docs.temporal.io/workflows#schedule)

---

## Appendix B: Glossary

- **Long-Running Service Workflow**: A workflow that never terminates; runs indefinitely processing work items
- **Short-Running Task Workflow**: A workflow spawned for a specific task/entity; terminates upon completion
- **Agentic Activity**: An activity that invokes an AI agent (LLM) to perform work
- **MCP**: Model Context Protocol - the packages-api service that stores package metadata
- **Signal Contract**: Standardized payload format for service-to-service communication
- **Quality Gate**: A requirement that must be met before proceeding (e.g., tests pass, linting clean)
- **Feature Branch**: Git branch for active development; uses `--no-verify` for intermediate commits
- **Agent Prompt Registry**: Centralized, versioned storage for AI agent prompts

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-13 | Claude + User | Initial design document |

**Status:** Draft - Pending implementation

**Next Steps:**
1. Review this design with stakeholders
2. Create task breakdown for Phase 1
3. Begin standardization extraction

**Questions/Open Items:**
- [ ] Should we use Temporal Nexus or HTTP webhooks for MCP integration?
- [ ] What's the threshold quality score for QA to pass packages?
- [ ] Should Discovery service have access to private repos, and if so, how do we manage credentials?
- [ ] Do we need rate limiting for agent spawning (cost control)?

---

**END OF DESIGN DOCUMENT**
