# Temporal-Based Development Workflow Proposal

**Date:** 2025-01-27
**Author:** Auto (AI Assistant)
**Status:** Proposal
**Related Documents:**
- [Autonomous Deployment Workflow](/docs/dev-workflow/autonomous-deployment-workflow.md)
- [Autonomous Deployment Visual Workflow](/docs/dev-workflow/autonomous-deployment-visual-workflow.md)
- [Autonomous Deployment Agents Summary](/docs/dev-workflow/autonomous-deployment-agents-summary.md)
- [Package Builder Workflow Analysis](/PACKAGE_BUILDER_WORKFLOW_ANALYSIS.md)

---

## Executive Summary

This proposal breaks down the autonomous end-to-end development workflow into a resilient Temporal-based orchestration system. The design leverages Temporal's parent/child workflows, signals, queries, activities, and human-in-the-loop patterns to create a production-grade system that can handle feature development from requirement intake through production deployment with safe rollback capabilities.

**Key Design Principles:**
- **Resilience**: Automatic retries, rollbacks, and error recovery
- **Observability**: Queries for real-time status, comprehensive logging
- **Control**: Signals for human intervention, pause/resume, emergency stops
- **Efficiency**: Parallel execution where possible, dependency-aware sequencing
- **Safety**: Multiple validation gates, automatic rollback triggers, evidence-based decisions

---

## Workflow Architecture Overview

### High-Level Workflow Hierarchy

```
FeatureDevelopmentOrchestrator (Parent, Long-Running)
├── RequirementIntakeWorkflow (Child, Short)
│   └── Human Approval Gate (Signal)
├── TaskPlanningWorkflow (Child, Short)
│   └── Task Review Gate (Signal)
├── DevelopmentWorkflow (Child, Long-Running)
│   ├── TaskExecutionWorkflow (Child, Medium) × N tasks
│   └── CodeReviewWorkflow (Child, Short)
├── TestingWorkflow (Child, Medium)
│   └── Parallel test execution
├── StagingDeploymentWorkflow (Child, Medium)
│   └── Health monitoring loop
├── ProductionReadinessWorkflow (Child, Short)
│   └── Human Approval Gate (Signal)
└── ProductionDeploymentWorkflow (Child, Medium)
    └── Continuous monitoring with rollback triggers
```

---

## Core Workflow Definitions

### 1. FeatureDevelopmentOrchestrator (Parent Workflow)

**Type:** Long-running parent orchestrator
**Purpose:** Coordinates entire feature development lifecycle
**Pattern:** Similar to `PackageBuilderWorkflow` - manages child workflows, handles signals, uses continue-as-new

**Input:**
```typescript
interface FeatureDevelopmentInput {
  featureRequest: string;
  requesterId: string;
  projectId: string;
  repositoryUrl: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetEnvironment: 'staging' | 'production';
  autoApprove?: boolean; // Skip human gates if true
}
```

**State:**
```typescript
interface OrchestratorState {
  phase: 'intake' | 'planning' | 'development' | 'testing' | 'staging' | 'production-readiness' | 'production' | 'complete' | 'failed';
  requirementId?: string; // BrainGrid REQ ID
  taskIds?: string[]; // BrainGrid task IDs
  currentBranch?: string;
  stagingDeploymentId?: string;
  productionDeploymentId?: string;
  rollbackTriggered?: boolean;
  incidentId?: string;
  evidence: {
    testResults?: TestResults;
    securityScan?: SecurityScanResults;
    stagingValidation?: StagingValidationResults;
    productionValidation?: ProductionValidationResults;
  };
  blockers: string[];
  metadata: {
    startedAt: Date;
    lastActivityAt: Date;
    estimatedCompletion?: Date;
  };
}
```

**Signals:**
- `pauseOrchestrator` - Pause all child workflows
- `resumeOrchestrator` - Resume execution
- `emergencyStop` - Immediately stop and rollback if in production
- `skipGate` - Skip a human approval gate (requires authorization)
- `updatePriority` - Change feature priority
- `addBlocker` - Add a blocker that prevents progression
- `removeBlocker` - Remove a blocker

**Queries:**
- `getStatus` - Current phase, progress, blockers
- `getEvidence` - All collected evidence for current phase
- `getTimeline` - Timeline of completed steps
- `getChildWorkflows` - Status of all child workflows
- `getApprovalGates` - Pending human approval gates

**Child Workflows:**
1. `RequirementIntakeWorkflow` - Phase 1
2. `TaskPlanningWorkflow` - Phase 2
3. `DevelopmentWorkflow` - Phase 3 (spawns multiple TaskExecutionWorkflows)
4. `TestingWorkflow` - Phase 4
5. `StagingDeploymentWorkflow` - Phase 5
6. `ProductionReadinessWorkflow` - Phase 6
7. `ProductionDeploymentWorkflow` - Phase 7

**Activities:**
- `logPhaseTransition` - Log phase changes
- `notifyStakeholders` - Send notifications (Slack, email)
- `updateBrainGridStatus` - Sync status to BrainGrid

**Error Handling:**
- Automatic retry with exponential backoff for transient failures
- Escalate to human on repeated failures (>3 attempts)
- Automatic rollback if in production and critical error detected

---

### 2. RequirementIntakeWorkflow (Child)

**Type:** Short workflow with human-in-the-loop
**Purpose:** Validate and structure feature request, create BrainGrid requirement
**Duration:** 5-30 minutes (depends on human response time)

**Input:**
```typescript
interface RequirementIntakeInput {
  featureRequest: string;
  requesterId: string;
  projectId: string;
}
```

**Activities:**
1. `validateRequirementCompleteness` (Activity) - Non-agentic validation
2. `checkFeasibility` (Agent Activity) - Agent checks technical feasibility
3. `identifyAmbiguities` (Agent Activity) - Agent identifies unclear requirements
4. `createBrainGridRequirement` (Activity) - API call to BrainGrid
5. `triggerTaskBreakdown` (Activity) - Trigger BrainGrid AI breakdown
6. `retrieveTasks` (Activity) - Get task list from BrainGrid

**Signals:**
- `approveRequirement` - Human approves validated requirement
- `requestClarification` - Human requests more info
- `rejectRequirement` - Human rejects requirement

**Queries:**
- `getValidationStatus` - Current validation state
- `getClarificationQuestions` - Questions needing answers

**Human-in-the-Loop:**
- Web form for requirement approval/rejection
- Slack message with approval button
- Timeout: 24 hours, then escalate

**Output:**
```typescript
interface RequirementIntakeOutput {
  requirementId: string; // BrainGrid REQ ID
  tasks: BrainGridTask[];
  validated: boolean;
  approved: boolean;
}
```

---

### 3. TaskPlanningWorkflow (Child)

**Type:** Short workflow with human-in-the-loop
**Purpose:** Review BrainGrid task breakdown, approve or request revisions
**Duration:** 10-60 minutes

**Input:**
```typescript
interface TaskPlanningInput {
  requirementId: string;
  tasks: BrainGridTask[];
}
```

**Activities:**
1. `reviewTaskBreakdown` (Agent Activity) - Agent reviews task logic
2. `validateDependencies` (Activity) - Non-agentic dependency validation
3. `estimateEffort` (Agent Activity) - Agent estimates time/complexity
4. `identifyMissingTasks` (Agent Activity) - Agent finds gaps
5. `updateBrainGridTasks` (Activity) - Update tasks if revisions needed

**Signals:**
- `approveTasks` - Human approves task breakdown
- `requestRevisions` - Human requests task changes
- `addCustomTask` - Human adds additional task

**Queries:**
- `getTaskReview` - Agent's review of tasks
- `getDependencyGraph` - Visual dependency graph

**Human-in-the-Loop:**
- Web UI showing task breakdown with agent review
- Ability to request revisions or approve
- Timeout: 48 hours

**Output:**
```typescript
interface TaskPlanningOutput {
  approvedTasks: BrainGridTask[];
  taskAssignments: TaskAssignment[]; // Which agent handles which task
  estimatedDuration: string;
}
```

---

### 4. DevelopmentWorkflow (Child, Long-Running)

**Type:** Long-running parent workflow
**Purpose:** Orchestrate development of all tasks
**Duration:** Hours to days (depends on feature size)

**Input:**
```typescript
interface DevelopmentInput {
  requirementId: string;
  tasks: BrainGridTask[];
  taskAssignments: TaskAssignment[];
  baseBranch: string;
  featureBranch: string;
}
```

**State:**
```typescript
interface DevelopmentState {
  completedTasks: string[];
  inProgressTasks: string[];
  failedTasks: string[];
  currentTask?: string;
  branchName: string;
  commits: Commit[];
  codeReviewStatus: 'pending' | 'approved' | 'rejected';
}
```

**Child Workflows:**
- `TaskExecutionWorkflow` × N (one per task, respecting dependencies)
- `CodeReviewWorkflow` (after all tasks complete)

**Activities:**
1. `createFeatureBranch` (Activity) - Git operation
2. `routeTaskToAgent` (Activity) - Determine which agent handles task
3. `waitForTaskDependencies` (Activity) - Wait for prerequisite tasks
4. `aggregateCodeChanges` (Activity) - Collect all changes
5. `updateBrainGridTaskStatus` (Activity) - Sync task status

**Signals:**
- `pauseDevelopment` - Pause all task execution
- `skipTask` - Skip a specific task
- `retryTask` - Retry a failed task
- `updateTaskPriority` - Change task priority

**Queries:**
- `getTaskProgress` - Progress of all tasks
- `getCodeChanges` - Summary of code changes
- `getBranchStatus` - Git branch status

**Parallel Execution:**
- Tasks without dependencies run in parallel (up to maxConcurrent = 4)
- Dependency-aware: Task B waits for Task A if A is a dependency

**Output:**
```typescript
interface DevelopmentOutput {
  branchName: string;
  commits: Commit[];
  codeReviewApproved: boolean;
  allTasksComplete: boolean;
}
```

---

### 5. TaskExecutionWorkflow (Child)

**Type:** Medium workflow
**Purpose:** Execute a single development task
**Duration:** 30 minutes to 4 hours

**Input:**
```typescript
interface TaskExecutionInput {
  taskId: string;
  taskDescription: string;
  taskType: 'frontend' | 'backend' | 'database' | 'api' | 'testing' | 'documentation';
  agentType: string; // Which agent to use
  dependencies: string[]; // Task IDs that must complete first
  packagePath?: string;
  context: {
    relatedFiles: string[];
    acceptanceCriteria: string[];
  };
}
```

**Activities:**
1. `waitForDependencies` (Activity) - Wait for prerequisite tasks
2. `loadTaskContext` (Activity) - Load related files and context
3. `executeAgentTask` (Agent Activity) - Agent implements the task
4. `validateCodeChanges` (Activity) - Non-agentic validation
5. `runUnitTests` (Activity) - Run tests for changed code
6. `commitChanges` (Activity) - Git commit with conventional format
7. `updateTaskStatus` (Activity) - Update BrainGrid task status

**Signals:**
- `retryExecution` - Retry task execution
- `skipValidation` - Skip validation (dangerous, requires auth)

**Queries:**
- `getExecutionStatus` - Current execution state
- `getCodeChanges` - What code was changed
- `getTestResults` - Test results

**Retry Logic:**
- Up to 3 retries with exponential backoff
- If agent fails, try alternative agent
- If all retries fail, mark task as failed and escalate

**Output:**
```typescript
interface TaskExecutionOutput {
  success: boolean;
  changes: CodeChange[];
  testResults?: TestResults;
  commitSha?: string;
  error?: string;
}
```

---

### 6. CodeReviewWorkflow (Child)

**Type:** Short workflow
**Purpose:** Automated code review before merge
**Duration:** 10-30 minutes

**Input:**
```typescript
interface CodeReviewInput {
  branchName: string;
  commits: Commit[];
  changedFiles: string[];
}
```

**Activities:**
1. `loadCodeChanges` (Activity) - Load all changed files
2. `reviewCodeQuality` (Agent Activity) - Agent reviews code patterns
3. `scanSecurity` (Activity) - Non-agentic security scan (SAST)
4. `checkTestCoverage` (Activity) - Calculate test coverage
5. `validateTypeScript` (Activity) - TypeScript strict mode check
6. `checkAccessibility` (Activity) - Accessibility scan
7. `generateReviewReport` (Activity) - Create review report

**Signals:**
- `approveReview` - Human approves review (if auto-review fails)
- `requestChanges` - Human requests code changes
- `overrideGate` - Override a failed gate (requires authorization)

**Queries:**
- `getReviewStatus` - Current review state
- `getReviewFindings` - All findings from review
- `getGateStatus` - Status of each quality gate

**Quality Gates:**
- Code quality: Must meet standards
- Security: No high/critical vulnerabilities
- Test coverage: >80% for changed code
- TypeScript: Strict mode compliance
- Accessibility: WCAG 2.1 AA compliance

**Output:**
```typescript
interface CodeReviewOutput {
  approved: boolean;
  findings: ReviewFinding[];
  gateResults: GateResult[];
  requiresHumanReview: boolean;
}
```

---

### 7. TestingWorkflow (Child)

**Type:** Medium workflow
**Purpose:** Run comprehensive test suite
**Duration:** 30 minutes to 2 hours

**Input:**
```typescript
interface TestingInput {
  branchName: string;
  testTypes: ('unit' | 'integration' | 'e2e' | 'api' | 'ui' | 'accessibility' | 'performance' | 'security')[];
}
```

**Activities:**
1. `runUnitTests` (Activity) - Jest/Vitest
2. `runIntegrationTests` (Activity) - Integration test suite
3. `runE2ETests` (Activity) - Playwright tests
4. `runAPITests` (Activity) - API test suite
5. `runUITests` (Activity) - UI component tests
6. `runAccessibilityTests` (Activity) - Axe/Pa11y
7. `runPerformanceTests` (Activity) - Lighthouse/k6
8. `runSecurityScan` (Activity) - OWASP ZAP/Snyk
9. `detectRegressions` (Agent Activity) - Agent compares to baseline
10. `analyzeTestResults` (Agent Activity) - Agent analyzes all results
11. `collectEvidence` (Activity) - Collect all test evidence

**Parallel Execution:**
- All test types run in parallel (up to maxConcurrent = 8)
- Results aggregated after all complete

**Signals:**
- `retryTests` - Retry failed tests
- `skipTestType` - Skip a test type (requires auth)

**Queries:**
- `getTestProgress` - Progress of all test types
- `getTestResults` - Aggregated results
- `getFailures` - Detailed failure information

**Output:**
```typescript
interface TestingOutput {
  allTestsPassed: boolean;
  testResults: {
    unit: TestResult;
    integration: TestResult;
    e2e: TestResult;
    api: TestResult;
    ui: TestResult;
    accessibility: TestResult;
    performance: TestResult;
    security: SecurityScanResult;
  };
  regressions: Regression[];
  evidence: EvidencePackage;
}
```

---

### 8. StagingDeploymentWorkflow (Child)

**Type:** Medium workflow with monitoring loop
**Purpose:** Deploy to staging and validate
**Duration:** 20-60 minutes

**Input:**
```typescript
interface StagingDeploymentInput {
  branchName: string;
  commitSha: string;
  environment: 'staging';
}
```

**Activities:**
1. `createStagingBackup` (Activity) - Database backup
2. `runStagingMigrations` (Activity) - Run database migrations
3. `deployToStaging` (Activity) - Vercel deployment
4. `waitForDeployment` (Activity) - Wait for deployment to complete
5. `verifyDeployment` (Activity) - Verify deployment succeeded
6. `monitorHealth` (Activity) - Health check monitoring (runs in loop)
7. `runStagingUAT` (Activity) - User acceptance tests on staging
8. `validateStaging` (Agent Activity) - Agent validates staging evidence

**Signals:**
- `triggerRollback` - Manual rollback trigger
- `extendMonitoring` - Extend health monitoring period
- `skipUAT` - Skip UAT (requires auth)

**Queries:**
- `getDeploymentStatus` - Current deployment state
- `getHealthMetrics` - Real-time health metrics
- `getUATResults` - UAT test results

**Monitoring Loop:**
- Health monitoring runs for 5+ minutes
- Checks every 30 seconds
- Automatic rollback if health fails >3 consecutive times

**Rollback Triggers:**
- Database migration failure
- Deployment failure
- Health check failure >3 times
- UAT test failure (critical journeys)
- Error rate spike >3x baseline

**Output:**
```typescript
interface StagingDeploymentOutput {
  deployed: boolean;
  deploymentId: string;
  healthValidated: boolean;
  uatPassed: boolean;
  rollbackTriggered: boolean;
  evidence: StagingValidationEvidence;
}
```

---

### 9. ProductionReadinessWorkflow (Child)

**Type:** Short workflow with human-in-the-loop
**Purpose:** Final approval gate before production
**Duration:** 5-60 minutes (depends on human response)

**Input:**
```typescript
interface ProductionReadinessInput {
  requirementId: string;
  stagingEvidence: StagingValidationEvidence;
  testResults: TestResults;
  securityScan: SecurityScanResult;
  codeReview: CodeReviewOutput;
}
```

**Activities:**
1. `validateAllGates` (Agent Activity) - Agent validates all 40+ gates
2. `collectAllEvidence` (Activity) - Aggregate all evidence
3. `generateReadinessReport` (Activity) - Create comprehensive report
4. `checkDocumentation` (Activity) - Verify docs updated
5. `checkMonitoring` (Activity) - Verify monitoring configured

**Signals:**
- `approveProduction` - Human approves production deployment
- `rejectProduction` - Human rejects (blocks deployment)
- `requestMoreEvidence` - Human requests additional evidence

**Queries:**
- `getGateStatus` - Status of all gates
- `getEvidenceSummary` - Summary of all evidence
- `getReadinessScore` - Calculated readiness score (0-100)

**Human-in-the-Loop:**
- Web form with comprehensive evidence dashboard
- All 40+ gates must show evidence
- Cannot proceed without explicit approval
- Timeout: 72 hours, then auto-reject

**Gates Validated:**
- Zero P0/P1 bugs
- Test coverage >95% (critical paths)
- Security scan clean (no high/critical)
- Performance meets SLAs
- Accessibility WCAG 2.1 AA compliant
- Database migrations tested with rollback
- Documentation updated
- Monitoring configured
- Staging UAT 100% pass
- All previous phase evidence validated

**Output:**
```typescript
interface ProductionReadinessOutput {
  approved: boolean;
  readinessScore: number;
  gateResults: GateResult[];
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
}
```

---

### 10. ProductionDeploymentWorkflow (Child)

**Type:** Medium workflow with continuous monitoring
**Purpose:** Deploy to production with automatic rollback
**Duration:** 30-90 minutes (includes monitoring period)

**Input:**
```typescript
interface ProductionDeploymentInput {
  branchName: string;
  commitSha: string;
  environment: 'production';
  featureFlags?: FeatureFlagConfig;
}
```

**Activities:**
1. `createProductionBackup` (Activity) - Full production backup
2. `verifyBackup` (Activity) - Verify backup integrity
3. `runProductionMigrations` (Activity) - Production database migrations
4. `deployToProduction` (Activity) - Vercel production deployment
5. `waitForDeployment` (Activity) - Wait for deployment
6. `verifyDeployment` (Activity) - Verify deployment succeeded
7. `monitorHealth` (Activity) - Continuous health monitoring (10+ minutes)
8. `runProductionUAT` (Activity) - Production UAT tests
9. `validateProduction` (Agent Activity) - Agent validates production evidence
10. `setupMonitoring` (Activity) - Ensure monitoring dashboards active

**Signals:**
- `triggerRollback` - Manual rollback (immediate)
- `extendMonitoring` - Extend monitoring period
- `pauseMonitoring` - Pause monitoring (dangerous)

**Queries:**
- `getDeploymentStatus` - Current deployment state
- `getHealthMetrics` - Real-time production metrics
- `getUATResults` - Production UAT results
- `getRollbackStatus` - Rollback capability status

**Monitoring Loop:**
- Health monitoring runs for 10+ minutes (critical period)
- Checks every 15 seconds (more frequent than staging)
- Automatic rollback triggers are more aggressive

**Rollback Triggers (IMMEDIATE):**
- Database migration failure
- Deployment failure
- Health check failure >3 consecutive
- Error rate spike >3x baseline
- Response time >5x baseline sustained >5 minutes
- Production UAT failure (any critical journey)
- P0/P1 bug discovered
- Database connection failures

**Rollback Sequence:**
1. Rollback database migration (if applicable)
2. Rollback code to previous Git SHA
3. Re-deploy previous version via Vercel
4. Verify rollback successful
5. Monitor system returns to healthy state
6. Document rollback reason

**Output:**
```typescript
interface ProductionDeploymentOutput {
  deployed: boolean;
  deploymentId: string;
  healthValidated: boolean;
  uatPassed: boolean;
  rollbackTriggered: boolean;
  rollbackCompleted?: boolean;
  evidence: ProductionValidationEvidence;
  monitoringActive: boolean;
}
```

---

## Activity Definitions

### Non-Agentic Activities (Code-Based)

These are deterministic activities that don't require AI:

**Git Operations:**
- `createFeatureBranch` - Create git branch
- `commitChanges` - Git commit with conventional format
- `createPullRequest` - Create PR
- `mergeBranch` - Merge branch to main
- `getCommitDiff` - Get diff between commits
- `rollbackToCommit` - Rollback to specific commit SHA

**Database Operations:**
- `createBackup` - Database backup (pg_dump)
- `verifyBackup` - Verify backup integrity
- `runMigration` - Run database migration
- `rollbackMigration` - Rollback migration
- `testMigration` - Test migration on staging

**Deployment Operations:**
- `deployToVercel` - Vercel deployment
- `getDeploymentStatus` - Check deployment status
- `rollbackVercelDeployment` - Rollback Vercel deployment
- `updateEnvironmentVariables` - Update env vars

**Testing Operations:**
- `runUnitTests` - Jest/Vitest execution
- `runIntegrationTests` - Integration test suite
- `runE2ETests` - Playwright execution
- `runAPITests` - API test suite
- `runUITests` - UI component tests
- `runAccessibilityTests` - Axe/Pa11y
- `runPerformanceTests` - Lighthouse/k6
- `runSecurityScan` - OWASP ZAP/Snyk
- `calculateTestCoverage` - Coverage calculation

**Validation Operations:**
- `validateCodeQuality` - Linting, formatting checks
- `validateTypeScript` - TypeScript strict mode
- `checkTestCoverage` - Coverage threshold validation
- `validateDocumentation` - Doc completeness check

**Monitoring Operations:**
- `checkHealthEndpoint` - Health check API call
- `getMetrics` - Fetch metrics from APM
- `checkErrorRate` - Calculate error rate
- `checkResponseTime` - Calculate response time
- `setupMonitoringDashboard` - Create/update dashboard

**BrainGrid Operations (via CLI Wrapper):**
- `createBrainGridRequirement` - Create REQ (via `@bernierllc/braingrid-cli-wrapper`)
- `triggerTaskBreakdown` - Trigger AI breakdown (via CLI wrapper)
- `retrieveTasks` - Get task list (via CLI wrapper)
- `updateTaskStatus` - Update task status (via CLI wrapper)
- `updateRequirementStatus` - Update REQ status (via CLI wrapper)

**Note**: All BrainGrid operations use `@bernierllc/braingrid-cli-wrapper` instead of MCP server for better feature coverage and reliability.

**Communication Operations:**
- `sendSlackMessage` - Send Slack notification
- `sendEmail` - Send email notification
- `createIncidentTicket` - Create incident ticket
- `updateStatusPage` - Update status page

### Agentic Activities (AI-Powered)

These use agents from the agency-agents repository:

**Requirement & Planning:**
- `validateRequirementCompleteness` - Agent validates requirement
- `checkFeasibility` - Agent checks technical feasibility
- `identifyAmbiguities` - Agent finds unclear requirements
- `reviewTaskBreakdown` - Agent reviews task logic
- `estimateEffort` - Agent estimates time/complexity
- `identifyMissingTasks` - Agent finds gaps in task breakdown

**Development:**
- `executeAgentTask` - Agent implements code changes
- `reviewCodeQuality` - Agent reviews code patterns
- `suggestCodeImprovements` - Agent suggests improvements

**Testing & Validation:**
- `detectRegressions` - Agent compares to baseline
- `analyzeTestResults` - Agent analyzes test results
- `validateStagingEvidence` - Agent validates staging evidence
- `validateProductionEvidence` - Agent validates production evidence

**Quality Assurance:**
- `validateAllGates` - Agent validates all quality gates
- `generateReadinessReport` - Agent generates comprehensive report

**Incident Response:**
- `triageIncident` - Agent triages incident severity
- `analyzeRootCause` - Agent performs root cause analysis
- `suggestFix` - Agent suggests fix for incident

---

## Signal Definitions

### Orchestrator-Level Signals

**Control Signals:**
- `pauseOrchestrator` - Pause all child workflows
- `resumeOrchestrator` - Resume execution
- `emergencyStop` - Immediately stop (rollback if in production)
- `skipGate` - Skip a human approval gate (requires authorization)
- `updatePriority` - Change feature priority
- `addBlocker` - Add a blocker
- `removeBlocker` - Remove a blocker

**Approval Signals:**
- `approveRequirement` - Approve requirement intake
- `rejectRequirement` - Reject requirement
- `requestClarification` - Request more info
- `approveTasks` - Approve task breakdown
- `requestTaskRevisions` - Request task changes
- `approveProduction` - Approve production deployment
- `rejectProduction` - Reject production deployment

**Development Signals:**
- `pauseDevelopment` - Pause task execution
- `skipTask` - Skip a specific task
- `retryTask` - Retry a failed task
- `updateTaskPriority` - Change task priority
- `approveCodeReview` - Approve code review
- `requestCodeChanges` - Request code changes

**Deployment Signals:**
- `triggerRollback` - Manual rollback trigger
- `extendMonitoring` - Extend monitoring period
- `skipUAT` - Skip UAT (requires auth)

---

## Query Definitions

### Orchestrator Queries

- `getStatus` - Current phase, progress, blockers
- `getEvidence` - All collected evidence for current phase
- `getTimeline` - Timeline of completed steps
- `getChildWorkflows` - Status of all child workflows
- `getApprovalGates` - Pending human approval gates
- `getMetrics` - Performance metrics (duration, retries, etc.)

### Workflow-Specific Queries

**RequirementIntakeWorkflow:**
- `getValidationStatus` - Current validation state
- `getClarificationQuestions` - Questions needing answers

**TaskPlanningWorkflow:**
- `getTaskReview` - Agent's review of tasks
- `getDependencyGraph` - Visual dependency graph

**DevelopmentWorkflow:**
- `getTaskProgress` - Progress of all tasks
- `getCodeChanges` - Summary of code changes
- `getBranchStatus` - Git branch status

**TaskExecutionWorkflow:**
- `getExecutionStatus` - Current execution state
- `getCodeChanges` - What code was changed
- `getTestResults` - Test results

**CodeReviewWorkflow:**
- `getReviewStatus` - Current review state
- `getReviewFindings` - All findings from review
- `getGateStatus` - Status of each quality gate

**TestingWorkflow:**
- `getTestProgress` - Progress of all test types
- `getTestResults` - Aggregated results
- `getFailures` - Detailed failure information

**StagingDeploymentWorkflow:**
- `getDeploymentStatus` - Current deployment state
- `getHealthMetrics` - Real-time health metrics
- `getUATResults` - UAT test results

**ProductionReadinessWorkflow:**
- `getGateStatus` - Status of all gates
- `getEvidenceSummary` - Summary of all evidence
- `getReadinessScore` - Calculated readiness score (0-100)

**ProductionDeploymentWorkflow:**
- `getDeploymentStatus` - Current deployment state
- `getHealthMetrics` - Real-time production metrics
- `getUATResults` - Production UAT results
- `getRollbackStatus` - Rollback capability status

---

## Human-in-the-Loop Patterns

### Web Form Approvals

**Requirement Approval:**
- Form shows validated requirement
- Agent's feasibility assessment
- Clarification questions (if any)
- Buttons: Approve / Request Clarification / Reject

**Task Review Approval:**
- Form shows task breakdown
- Agent's review and recommendations
- Dependency graph visualization
- Buttons: Approve / Request Revisions / Add Custom Task

**Production Readiness Approval:**
- Comprehensive dashboard with all 40+ gates
- Evidence for each gate
- Readiness score (0-100)
- Buttons: Approve / Reject / Request More Evidence
- Cannot approve if any critical gate fails

### Slack Integration

**Notifications:**
- Phase transitions
- Approval requests
- Deployment status
- Incident alerts
- Rollback notifications

**Interactive Buttons:**
- Approve/Reject buttons in Slack messages
- Quick status checks via Slack commands
- Emergency stop via Slack

### Timeout Handling

**Requirement Approval:** 24 hours
- After timeout: Escalate to project manager
- Auto-reject if no response after 48 hours

**Task Review Approval:** 48 hours
- After timeout: Escalate to senior developer
- Auto-approve if no response after 72 hours (with warning)

**Production Approval:** 72 hours
- After timeout: Auto-reject (safety first)
- Requires explicit approval, no auto-approve

---

## Git Workflow Integration

### Branch Strategy

**Feature Branch:**
- Created by `DevelopmentWorkflow`
- Format: `feature/REQ-{requirementId}-{kebab-case-description}`
- All task commits go to this branch

**Pull Request:**
- Created after code review passes
- Auto-merge after all gates pass
- Manual merge option available

**Merge Strategy:**
- Squash merge for feature branches
- Preserves commit history in main
- Creates single merge commit

### Commit Strategy

**Conventional Commits:**
- Format: `type(scope): description`
- Types: feat, fix, docs, test, refactor, etc.
- Scope: package name or feature area

**Commit Messages:**
- Include BrainGrid task ID
- Include requirement ID
- Link to related issues

### Rollback Strategy

**Code Rollback:**
- Store Git SHA before deployment
- Rollback to previous SHA on failure
- Create rollback commit with explanation

**Database Rollback:**
- Run down migrations
- Restore from backup if needed
- Verify data integrity

---

## Error Handling & Resilience

### Retry Strategies

**Transient Errors:**
- API timeouts: 3 retries with exponential backoff
- Network errors: 5 retries with exponential backoff
- Rate limiting: Retry with backoff, respect rate limits

**Permanent Errors:**
- Invalid input: Fail immediately, no retry
- Authentication errors: Fail immediately, escalate
- Configuration errors: Fail immediately, require fix

### Failure Escalation

**Level 1: Automatic Retry**
- Transient errors retry automatically
- Up to 3-5 retries depending on error type

**Level 2: Alternative Agent**
- If agent fails, try alternative agent
- Different agent may have different approach

**Level 3: Human Intervention**
- After all retries exhausted
- Create incident ticket
- Notify stakeholders
- Pause workflow until resolved

**Level 4: Rollback**
- If in production and critical error
- Automatic rollback triggered
- Incident response workflow started

### Circuit Breaker Pattern

**For External Services:**
- Track failure rate
- Open circuit if failure rate >50%
- Wait before retrying
- Half-open to test recovery

---

## Monitoring & Observability

### Metrics to Track

**Workflow Metrics:**
- Phase duration
- Total workflow duration
- Retry count
- Failure rate
- Human approval wait time

**Development Metrics:**
- Tasks completed per hour
- Code review cycles
- Test pass rate
- Deployment success rate

**Quality Metrics:**
- Test coverage percentage
- Security vulnerabilities found
- Performance regression rate
- Accessibility compliance rate

**Deployment Metrics:**
- Deployment duration
- Rollback rate
- Time to detect issues (MTTD)
- Time to rollback (MTTR)
- Production incident rate

### Logging Strategy

**Workflow Logs:**
- Phase transitions
- Signal receipts
- Query executions
- Child workflow spawns/completions

**Activity Logs:**
- Activity start/complete
- Input/output (sanitized)
- Error details
- Duration

**Agent Logs:**
- Agent selection
- Prompt construction
- Response parsing
- Code changes made

### Dashboards

**Real-Time Dashboard:**
- Active workflows
- Current phase
- Pending approvals
- Recent deployments

**Historical Dashboard:**
- Workflow success rate
- Average duration
- Common failure points
- Quality trends

---

## Implementation Phases

### Phase 1: Core Orchestration (Weeks 1-2)

**Goal:** Basic workflow orchestration

**Prerequisites:**
- **Priority**: Implement `@bernierllc/braingrid-cli-wrapper` first (hours to days)
  - This is critical blocker for Phase 1
  - Can be done in parallel with workflow skeleton setup

**Workflows:**
- FeatureDevelopmentOrchestrator (skeleton)
- RequirementIntakeWorkflow
- TaskPlanningWorkflow

**Activities:**
- BrainGrid integration via CLI wrapper (`@bernierllc/braingrid-cli-wrapper`)
- Git operations (use existing packages or create wrapper)
- Human approval gates (web forms)

**Packages to Use:**
- `@bernierllc/braingrid-cli-wrapper` (implement first)
- `@bernierllc/logger` - Logging
- `@bernierllc/retry-policy` - Retry logic
- `@bernierllc/state-machine` - State management

**Deliverable:** Can intake requirement and create tasks

---

### Phase 2: Development Execution (Weeks 3-4)

**Goal:** Execute development tasks

**Workflows:**
- DevelopmentWorkflow
- TaskExecutionWorkflow

**Activities:**
- Agent execution (integrate agency-agents)
- Code generation
- Git commits

**Deliverable:** Can develop code autonomously

---

### Phase 3: Quality Gates (Weeks 5-6)

**Goal:** Add quality enforcement

**Workflows:**
- CodeReviewWorkflow
- TestingWorkflow

**Activities:**
- Code review agents
- Test execution
- Security scanning
- Evidence collection

**Deliverable:** Can validate code quality before merge

---

### Phase 4: Staging Deployment (Weeks 7-8)

**Goal:** Deploy to staging

**Workflows:**
- StagingDeploymentWorkflow

**Activities:**
- Database migrations
- Vercel deployment
- Health monitoring
- UAT execution

**Deliverable:** Can deploy to staging with validation

---

### Phase 5: Production Readiness (Weeks 9-10)

**Goal:** Production approval gates

**Workflows:**
- ProductionReadinessWorkflow

**Activities:**
- Gate validation
- Evidence aggregation
- Readiness scoring

**Deliverable:** Can validate production readiness

---

### Phase 6: Production Deployment (Weeks 11-12)

**Goal:** Production deployment with rollback

**Workflows:**
- ProductionDeploymentWorkflow

**Activities:**
- Production backups
- Production migrations
- Production deployment
- Continuous monitoring
- Automatic rollback

**Deliverable:** Can deploy to production safely

---

### Phase 7: Polish & Optimization (Weeks 13-16)

**Goal:** Production-grade system

**Enhancements:**
- Performance optimization
- Advanced monitoring
- Incident response automation
- Documentation
- Training materials

**Deliverable:** Production-ready autonomous deployment system

---

## Package Ecosystem Integration

### Leveraging Existing Packages

The tools repository (`/Users/mattbernier/projects/tools/packages`) contains many proven, well-tested packages that can significantly accelerate implementation. These packages are production-ready and can be used directly in Temporal activities.

### Package Usage Strategy

**Phase 1: Identify & Evaluate**
- Review existing packages for fit
- Check package status (published vs planned)
- Evaluate integration effort
- Prioritize packages that save the most time

**Phase 2: Integrate**
- Install packages as dependencies
- Create activity wrappers where needed
- Test integration
- Document usage

**Phase 3: Extend (if needed)**
- Only create new packages if no existing package fits
- Consider extending existing packages vs creating new ones
- Follow package development guidelines

### Package Categories for This Workflow

**Core Utilities (Ready to Use):**
- `@bernierllc/retry-policy` - Activity retry logic
- `@bernierllc/backoff-retry` - Exponential backoff
- `@bernierllc/logger` - Structured logging
- `@bernierllc/state-machine` - Workflow state management
- `@bernierllc/queue-manager` - Task queue management
- `@bernierllc/rate-limiter` - API rate limiting
- `@bernierllc/postgres-client` - Database operations
- `@bernierllc/query-builder` - Database queries
- `@bernierllc/template-engine` - Notification templates
- `@bernierllc/markdown-parser` - Documentation processing
- `@bernierllc/html-sanitizer` - Content sanitization
- `@bernierllc/file-handler` - File operations
- `@bernierllc/crypto-utils` - Security utilities

**Service Packages (Ready to Use):**
- `@bernierllc/email-sender` - Email notifications
- `@bernierllc/webhook-sender` - Webhook notifications
- `@bernierllc/task-manager` - Task management
- `@bernierllc/work-item-core` - Work item tracking

**AI/Agent Packages (Ready to Use):**
- `@bernierllc/anthropic-client` - Claude API client
- `@bernierllc/openai-client` - OpenAI API client
- `@bernierllc/ai-prompt-builder` - Prompt construction
- `@bernierllc/ai-response-parser` - Response parsing

**UI Components (Ready to Use):**
- `@bernierllc/temporal-workflow-ui` - Workflow UI components
- `@bernierllc/generic-workflow-ui` - Generic workflow UI

### Planned Packages (Priority for This Work)

**Critical (Must Have):**

1. **`@bernierllc/braingrid-cli-wrapper`** ⭐⭐⭐
   - **Status**: Planned, ready for implementation
   - **Location**: `/Users/mattbernier/projects/tools/plans/packages/core/braingridcli-wrapper.md`
   - **Effort**: Hours to days
   - **Priority**: CRITICAL - Blocks Phase 1
   - **Use Case**: All BrainGrid operations (requirements, tasks, status)
   - **Action**: Implement immediately, can be done in parallel with workflow skeleton

**High Priority (Should Have):**

2. **Git Operations Package** (if not exists)
   - **Use Case**: Branch creation, commits, PRs, rollbacks
   - **Effort**: 1-2 days
   - **Priority**: High - needed for Phase 2
   - **Action**: Check if exists, create if needed

3. **Database Migration Package** (if not exists)
   - **Use Case**: Migration execution, rollback, testing
   - **Effort**: 2-3 days
   - **Priority**: High - needed for Phase 4
   - **Action**: Check if exists, create if needed

4. **Deployment Package** (if not exists)
   - **Use Case**: Vercel deployment, status, rollback
   - **Effort**: 2-3 days
   - **Priority**: High - needed for Phase 4
   - **Action**: Check if exists, create if needed

**Medium Priority (Nice to Have):**

5. **Test Execution Package** (if not exists)
   - **Use Case**: Unified test execution interface
   - **Effort**: 3-4 days
   - **Priority**: Medium - can use direct tooling initially
   - **Action**: Evaluate after Phase 3

6. **Security Scanning Package** (if not exists)
   - **Use Case**: Unified security scanning interface
   - **Effort**: 2-3 days
   - **Priority**: Medium - can use direct tooling initially
   - **Action**: Evaluate after Phase 3

### Package Implementation Priority

**Week 1:**
1. `@bernierllc/braingrid-cli-wrapper` (CRITICAL)
2. Evaluate git/database/deployment packages

**Week 2-3:**
3. Implement missing git operations package (if needed)
4. Implement missing database migration package (if needed)

**Week 4-5:**
5. Implement missing deployment package (if needed)

**Later:**
6. Test execution package (if needed)
7. Security scanning package (if needed)

### Package Integration Examples

**Example: Using Retry Policy**
```typescript
import { RetryPolicy } from '@bernierllc/retry-policy';

const retryPolicy = new RetryPolicy({
  maxAttempts: 3,
  backoffStrategy: 'exponential',
  initialDelay: 1000,
});

// In activity
export async function deployToVercel(input: DeploymentInput) {
  return await retryPolicy.execute(async () => {
    // Deployment logic
  });
}
```

**Example: Using Logger**
```typescript
import { Logger } from '@bernierllc/logger';

const logger = new Logger('FeatureDevelopmentOrchestrator');

// In workflow/activity
logger.info('Phase transition', { from: 'development', to: 'testing' });
logger.error('Deployment failed', { error, deploymentId });
```

**Example: Using BrainGrid CLI Wrapper**
```typescript
import { createIdea, updateRequirementStatus } from '@bernierllc/braingrid-cli-wrapper';

// In activity
export async function createBrainGridRequirement(prompt: string, projectId: string) {
  const requirement = await createIdea(prompt, projectId);
  return requirement;
}
```

---

## Integration Points

### Agency-Agents Repository

**Agent Integration:**
- Use existing agents where possible
- Create wrapper activities for agent calls
- Handle agent failures gracefully
- Support agent selection logic

**Available Agents:**
- Frontend Developer
- Backend Architect
- DevOps Automator
- Git Branch Manager
- Git Commit Manager
- Playwright Auditor
- API Tester
- UI Tester
- And 30+ more...

### BrainGrid Integration

**CLI Wrapper Package:**
- Use `@bernierllc/braingrid-cli-wrapper` (planned, can be prioritized)
- Type-safe programmatic interface to BrainGrid CLI
- No MCP server dependencies
- Better feature coverage than MCP server

**Package Details:**
- **Location**: `/Users/mattbernier/projects/tools/plans/packages/core/braingridcli-wrapper.md`
- **Status**: Planned, ready for implementation
- **Estimated Effort**: Hours to days (can be prioritized for this work)
- **API**: TypeScript functions returning structured data
- **Features**:
  - Create requirements (ideas)
  - List/create projects
  - Update requirement status
  - Future: Task operations, file attachments

**Status Sync:**
- Real-time status updates via CLI wrapper
- Bidirectional sync
- Evidence linking

### Existing Packages from Tools Repository

**Available Packages (Published/Proven):**

**Core Utilities:**
- `@bernierllc/retry-policy` - Retry logic for activities
- `@bernierllc/backoff-retry` - Exponential backoff
- `@bernierllc/logger` - Structured logging
- `@bernierllc/postgres-client` - PostgreSQL operations
- `@bernierllc/state-machine` - State management for workflows
- `@bernierllc/queue-manager` - Queue management
- `@bernierllc/rate-limiter` - Rate limiting for API calls
- `@bernierllc/query-builder` - Database query building
- `@bernierllc/template-engine` - Template rendering (for notifications)
- `@bernierllc/markdown-parser` - Markdown processing
- `@bernierllc/html-sanitizer` - HTML sanitization
- `@bernierllc/file-handler` - File operations
- `@bernierllc/crypto-utils` - Cryptographic utilities

**Service Packages:**
- `@bernierllc/email-sender` - Email notifications
- `@bernierllc/webhook-sender` - Webhook notifications
- `@bernierllc/task-manager` - Task management
- `@bernierllc/work-item-core` - Work item management
- `@bernierllc/refactoring-core` - Code refactoring utilities

**Integration Packages:**
- `@bernierllc/anthropic-client` - Anthropic API client
- `@bernierllc/openai-client` - OpenAI API client
- `@bernierllc/supabase-client` - Supabase client

**UI Packages:**
- `@bernierllc/temporal-workflow-ui` - Temporal workflow UI components
- `@bernierllc/generic-workflow-ui` - Generic workflow UI components

### Planned Packages (Can Be Prioritized)

**High Priority for This Workflow:**

1. **`@bernierllc/braingrid-cli-wrapper`** ⭐⭐⭐
   - **Status**: Planned, ready for implementation
   - **Effort**: Hours to days
   - **Priority**: Critical - needed for Phase 1
   - **Use Case**: All BrainGrid operations

2. **Git Operations Package** (if not exists)
   - **Use Case**: Git branch, commit, PR operations
   - **Effort**: Days
   - **Priority**: High - needed for Phase 2

3. **Database Migration Package** (if not exists)
   - **Use Case**: Migration execution, rollback
   - **Effort**: Days
   - **Priority**: High - needed for Phase 4

4. **Deployment Package** (if not exists)
   - **Use Case**: Vercel deployment operations
   - **Effort**: Days
   - **Priority**: High - needed for Phase 4

**Medium Priority:**

5. **Test Execution Package** (if not exists)
   - **Use Case**: Unified test execution interface
   - **Effort**: Days
   - **Priority**: Medium - can use direct tooling initially

6. **Security Scanning Package** (if not exists)
   - **Use Case**: Unified security scanning interface
   - **Effort**: Days
   - **Priority**: Medium - can use direct tooling initially

### Vercel Integration

**Deployment:**
- Vercel CLI activities (or create wrapper package)
- Deployment status tracking
- Rollback capability
- Environment variable management

### Monitoring Integration

**APM Tools:**
- DataDog/New Relic/Sentry
- Health check endpoints
- Metrics collection
- Alert integration

**Existing Packages:**
- `@bernierllc/logger` - Structured logging with performance monitoring
- `@bernierllc/retry-metrics` - Retry metrics tracking

---

## Security Considerations

### Authentication & Authorization

**Workflow Access:**
- User authentication required
- Role-based access control
- Approval gates require authorized users

**Agent Access:**
- Agents use service accounts
- No user credentials in workflows
- Secure credential storage

### Secret Management

**Environment Variables:**
- Stored in secure vault
- Never logged or exposed
- Rotated regularly

**API Keys:**
- Stored securely
- Different keys per environment
- Revoked on compromise

### Audit Logging

**All Actions Logged:**
- Workflow executions
- Human approvals
- Code changes
- Deployments
- Rollbacks

**Immutable Logs:**
- Cannot be modified
- Retained for compliance
- Searchable and queryable

---

## Testing Strategy

### Unit Tests

**Workflow Tests:**
- Test workflow logic
- Mock activities
- Test signal handling
- Test query responses

**Activity Tests:**
- Test activity logic
- Mock external services
- Test error handling

### Integration Tests

**End-to-End Tests:**
- Test complete workflow
- Use test environment
- Validate all gates
- Test rollback scenarios

### Load Tests

**Concurrent Workflows:**
- Test multiple workflows
- Test resource limits
- Test queue handling

---

## Success Metrics

### Development Velocity

- Time from requirement to production
- Tasks completed per day
- Code review cycles reduced
- Deployment frequency increased

### Quality Metrics

- Production incident rate <1%
- Rollback rate <5%
- Test coverage >95% (critical paths)
- Security vulnerabilities: 0 high/critical

### Reliability Metrics

- Workflow success rate >95%
- Automatic recovery rate >90%
- Time to detect issues <2 minutes
- Time to rollback <5 minutes

---

## Open Questions & Decisions Needed

### Technical Decisions

1. **Agent Selection Logic:**
   - How to determine which agent handles which task?
   - Should we use a routing agent or rule-based?

2. **Parallel Task Execution:**
   - Maximum concurrent tasks?
   - Resource limits per agent?

3. **Evidence Storage:**
   - Where to store evidence packages?
   - How long to retain evidence?

4. **Monitoring Integration:**
   - Which APM tool to use?
   - How to handle multiple monitoring tools?

### Process Decisions

1. **Human Approval Timeouts:**
   - Current timeouts appropriate?
   - Escalation path?

2. **Rollback Triggers:**
   - Current thresholds appropriate?
   - Should we be more/less aggressive?

3. **Quality Gates:**
   - Are all 40+ gates necessary?
   - Can some be optional?

### Integration Decisions

1. **BrainGrid Integration:**
   - ✅ **Decision**: Use `@bernierllc/braingrid-cli-wrapper` (CLI wrapper)
   - **Rationale**: Better feature coverage than MCP server, more reliable
   - **Action**: Prioritize CLI wrapper implementation (hours to days)
   - How to handle BrainGrid downtime? (retry with exponential backoff)

2. **Git Workflow:**
   - Branch naming convention?
   - Merge strategy preferences?

3. **Communication Channels:**
   - Slack vs email vs web UI?
   - Notification preferences?

---

## Next Steps

### Immediate Actions

1. **Review this proposal** with stakeholders
2. **Answer open questions** and make decisions
3. **Prioritize implementation phases**
4. **Set up development environment**
5. **Implement `@bernierllc/braingrid-cli-wrapper`** (critical blocker, hours to days)
   - Location: `/Users/mattbernier/projects/tools/plans/packages/core/braingridcli-wrapper.md`
   - Can be done in parallel with workflow skeleton
   - Required for Phase 1

### Short Term (Next 2 Weeks)

1. **Implement `@bernierllc/braingrid-cli-wrapper`** (Priority #1, hours to days)
2. **Implement Phase 1** (Core Orchestration)
3. **Set up BrainGrid integration** via CLI wrapper
4. **Create basic web forms** for approvals
5. **Test requirement intake** end-to-end
6. **Evaluate existing packages** for git, database, deployment operations

### Medium Term (Next 2 Months)

1. **Complete Phases 2-4** (Development through Staging)
2. **Integrate agency-agents**
3. **Set up monitoring**
4. **Test staging deployment**

### Long Term (Next 3-4 Months)

1. **Complete Phases 5-7** (Production through Polish)
2. **Optimize performance**
3. **Document system**
4. **Train team**

---

## Conclusion

This proposal provides a comprehensive design for breaking down the autonomous development workflow into resilient Temporal workflows. The system leverages Temporal's strengths (durability, observability, control) while integrating with existing agents, tools, and processes.

The phased implementation approach allows for incremental delivery of value while building toward a production-grade autonomous deployment system.

**Key Advantages:**
- Resilient to failures with automatic retries and rollbacks
- Observable with comprehensive queries and logging
- Controllable with signals and human-in-the-loop gates
- Efficient with parallel execution and dependency awareness
- Safe with multiple validation gates and evidence-based decisions

---

**Document Status:** Proposal v1.0
**Last Updated:** 2025-01-27
**Next Review:** After stakeholder feedback

