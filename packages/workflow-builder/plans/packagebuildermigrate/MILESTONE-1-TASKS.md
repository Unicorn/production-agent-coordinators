# Milestone 1: Linear Workflows - Detailed Task Breakdown

**Goal**: Ship working linear workflows that users can create, configure, deploy, and monitor within 6 weeks.

**Timeline**: Weeks 1-6
**Target Demo Date**: End of Week 6

---

## Executive Summary

### Critical Path (Longest Dependencies)
```
Database Schema (4h)
  → Backend API Foundation (8h)
    → Pattern Compiler Core (12h)
      → Code Generation (16h)
        → Worker Integration (16h)
          → E2E Testing (12h)

Total Critical Path: ~68 hours = ~2 weeks (with buffer)
```

### Team Structure
- **Backend Engineer 1**: Compiler, code generation, worker integration
- **Backend Engineer 2**: API layer, execution engine, monitoring
- **Frontend Engineer 1**: Canvas UI, drag-and-drop, node components
- **Frontend Engineer 2**: Property panels, execution monitoring, deployment UI
- **DevOps Engineer**: CI/CD, Temporal infrastructure, deployment automation
- **QA Engineer**: Test automation, integration testing, demo prep

### Parallelization Strategy
- **Week 1**: All teams work in parallel on foundations
- **Week 2-3**: Frontend and backend converge on integration
- **Week 4**: Integration testing and polish
- **Week 5**: Demo preparation and documentation
- **Week 6**: Buffer for issues and final polish

---

## Phase 1: Foundation (Week 1)
**Goal**: Set up all foundational infrastructure so teams can work in parallel

### Database Schema Tasks

#### M1-T001: Extend workflow schema for linear workflows
**Owner**: Backend Engineer 2
**Dependencies**: None
**Parallel with**: M1-T010, M1-T020, M1-T030, M1-T040
**Estimate**: 4 hours

**Description**:
Extend the existing `workflows` table schema in Supabase to support linear workflow definitions with nodes and edges. Review current schema at `src/types/database.ts` and identify required fields.

**Acceptance Criteria**:
- [ ] `definition` JSONB field can store workflow nodes and edges
- [ ] Schema supports `trigger_type` field (manual, scheduled, signal)
- [ ] Schema has `status` field (draft, active, paused, archived)
- [ ] `execution_settings` JSONB field stores timeout, retry configuration
- [ ] Migration script created and tested locally
- [ ] TypeScript types updated in `src/types/database.ts`
- [ ] Can create workflow with 3+ activity nodes via SQL

**Testing Requirements**:
- [ ] Unit tests for schema validation
- [ ] Integration test: Create workflow with definition
- [ ] Integration test: Query workflow by status
- [ ] Test migration rollback works

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Type checking passes
- [ ] Documentation updated in `docs/database-schema.md`

**Deliverables**:
- `supabase/migrations/YYYYMMDD_extend_workflow_schema.sql`
- `src/types/database.ts` (updated TypeScript types)
- `tests/integration/database/workflow-schema.test.ts`
- `docs/database-schema.md` (schema documentation)

---

#### M1-T002: Create workflow_executions table
**Owner**: Backend Engineer 2
**Dependencies**: M1-T001
**Parallel with**: M1-T011, M1-T021
**Estimate**: 3 hours

**Description**:
Create a new `workflow_executions` table to track workflow execution history, status, and results.

**Acceptance Criteria**:
- [ ] Table has: id, workflow_id, status, started_at, completed_at, error, result
- [ ] Foreign key to workflows table with CASCADE delete
- [ ] Index on workflow_id and status
- [ ] Index on created_at for time-based queries
- [ ] Can store execution steps as JSONB
- [ ] TypeScript types generated

**Testing Requirements**:
- [ ] Integration test: Create execution record
- [ ] Integration test: Query executions by workflow_id
- [ ] Integration test: Update execution status
- [ ] Test cascade delete works

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Documentation updated

**Deliverables**:
- `supabase/migrations/YYYYMMDD_create_workflow_executions.sql`
- `src/types/database.ts` (updated)
- `tests/integration/database/workflow-executions.test.ts`

---

### Backend API Foundation Tasks

#### M1-T010: Set up tRPC workflows router foundation
**Owner**: Backend Engineer 2
**Dependencies**: None
**Parallel with**: M1-T001, M1-T020, M1-T030
**Estimate**: 6 hours

**Description**:
Review and enhance existing tRPC workflows router at `src/server/api/routers/workflows.ts` to support linear workflow CRUD operations. Already has basic structure but needs endpoints for deployment and execution.

**Acceptance Criteria**:
- [ ] `workflows.create` endpoint accepts nodes/edges in definition
- [ ] `workflows.update` endpoint supports partial updates
- [ ] `workflows.get` endpoint returns full definition with nodes/edges
- [ ] `workflows.list` endpoint filters by status (draft, active)
- [ ] `workflows.deploy` endpoint validates and activates workflow
- [ ] Input validation with Zod schemas
- [ ] Error handling with proper HTTP status codes

**Testing Requirements**:
- [ ] Unit tests for each endpoint
- [ ] Integration tests with Supabase
- [ ] Test validation errors return 400
- [ ] Test authorization checks

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documentation updated

**Deliverables**:
- `src/server/api/routers/workflows.ts` (enhanced)
- `src/server/api/schemas/workflow.schemas.ts` (Zod schemas)
- `tests/integration/api/workflows/crud.test.ts`
- `docs/api/workflows.md`

---

#### M1-T011: Create execution engine API endpoints
**Owner**: Backend Engineer 2
**Dependencies**: M1-T002, M1-T010
**Parallel with**: M1-T012, M1-T021, M1-T031
**Estimate**: 8 hours

**Description**:
Create tRPC endpoints for workflow execution: build, run, get status, get history, cancel.

**Acceptance Criteria**:
- [ ] `execution.build` endpoint compiles and starts workflow
- [ ] `execution.getStatus` endpoint returns current execution state
- [ ] `execution.getHistory` endpoint returns execution steps
- [ ] `execution.cancel` endpoint stops running workflow
- [ ] `execution.list` endpoint lists executions for a workflow
- [ ] Endpoints integrate with Temporal client
- [ ] Real-time status updates supported (polling-friendly)

**Testing Requirements**:
- [ ] Unit tests for each endpoint
- [ ] Integration tests with mock Temporal client
- [ ] Test execution state transitions
- [ ] Test cancellation works mid-execution

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documentation complete

**Deliverables**:
- `src/server/api/routers/execution.ts`
- `src/server/api/schemas/execution.schemas.ts`
- `tests/integration/api/execution/endpoints.test.ts`
- `docs/api/execution.md`

---

#### M1-T012: Create compiler API endpoint
**Owner**: Backend Engineer 1
**Dependencies**: M1-T010
**Parallel with**: M1-T011, M1-T021, M1-T031
**Estimate**: 4 hours

**Description**:
Create tRPC endpoint for on-demand workflow compilation (for "View Code" feature).

**Acceptance Criteria**:
- [ ] `compiler.compile` endpoint accepts workflow ID
- [ ] Returns compiled TypeScript code (workflow, activities, worker)
- [ ] Supports options: includeComments, strictMode
- [ ] Validates workflow definition before compiling
- [ ] Returns syntax-highlighted code for UI display
- [ ] Handles compilation errors gracefully

**Testing Requirements**:
- [ ] Unit tests for endpoint
- [ ] Integration test with valid workflow
- [ ] Test error handling for invalid workflow
- [ ] Test all output code formats returned

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documentation complete

**Deliverables**:
- `src/server/api/routers/compiler.ts`
- `tests/integration/api/compiler/compile.test.ts`
- `docs/api/compiler.md`

---

### Pattern Compiler Tasks

#### M1-T020: Enhance activity proxy pattern compiler
**Owner**: Backend Engineer 1
**Dependencies**: None
**Parallel with**: M1-T001, M1-T010, M1-T030
**Estimate**: 12 hours

**Description**:
Review existing compiler at `src/lib/workflow-compiler/compiler.ts` and enhance to fully support linear activity chains. Already has basic structure but needs improvements for production use.

**Acceptance Criteria**:
- [ ] Compiles workflow with 1-10 activity nodes
- [ ] Generates correct `proxyActivities` call with timeout config
- [ ] Generates sequential activity execution code
- [ ] Handles activity configuration (timeout, retry policy)
- [ ] Produces TypeScript that passes `tsc --noEmit`
- [ ] Includes proper error handling in generated code
- [ ] Generated code follows Temporal best practices

**Testing Requirements**:
- [ ] Unit tests for compiler with 1, 3, 5, 10 activities
- [ ] Test generated code compiles with TypeScript
- [ ] Test retry configuration is correctly applied
- [ ] Test timeout configuration is correctly applied

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Compiler generates production-ready code

**Deliverables**:
- `src/lib/workflow-compiler/compiler.ts` (enhanced)
- `src/lib/workflow-compiler/patterns/activity-proxy.ts`
- `tests/unit/compiler/activity-proxy.test.ts`
- `tests/unit/compiler/node-compiler.test.ts` (enhanced)

---

#### M1-T021: Build TypeScript code generator
**Owner**: Backend Engineer 1
**Dependencies**: M1-T020
**Parallel with**: M1-T011, M1-T031, M1-T041
**Estimate**: 16 hours

**Description**:
Enhance code generation to produce complete, deployable Temporal workflow packages from JSON definitions.

**Acceptance Criteria**:
- [ ] Generates `workflow.ts` with proper imports and types
- [ ] Generates `activities.ts` with activity stubs (TODOs for implementation)
- [ ] Generates `worker.ts` with correct task queue and worker config
- [ ] Generates `package.json` with correct Temporal dependencies
- [ ] Generates `tsconfig.json` with strict mode
- [ ] Generated code has proper formatting (prettier-compatible)
- [ ] Generated code includes helpful comments
- [ ] Supports customizable package names and metadata

**Testing Requirements**:
- [ ] Unit test: Generated workflow compiles
- [ ] Unit test: Generated worker imports are correct
- [ ] Integration test: Generated package can be `npm install`'d
- [ ] Integration test: Generated code passes `tsc --noEmit`
- [ ] Test generated code with different workflow sizes (1, 5, 10 activities)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Generated code is production-ready

**Deliverables**:
- `src/lib/workflow-compiler/generators/workflow-generator.ts`
- `src/lib/workflow-compiler/generators/activities-generator.ts`
- `src/lib/workflow-compiler/generators/worker-generator.ts`
- `src/lib/workflow-compiler/generators/package-generator.ts`
- `tests/unit/compiler/code-generation.test.ts`
- `tests/integration/compiler/end-to-end.test.ts`

---

### DevOps Foundation Tasks

#### M1-T030: Set up Temporal local development environment
**Owner**: DevOps Engineer
**Dependencies**: None
**Parallel with**: M1-T001, M1-T010, M1-T020
**Estimate**: 8 hours

**Description**:
Create Docker Compose setup for local Temporal development with proper networking and persistence.

**Acceptance Criteria**:
- [ ] `docker-compose.yml` includes Temporal Server, PostgreSQL, Elasticsearch
- [ ] Temporal Web UI accessible at localhost:8080
- [ ] Temporal Server accessible at localhost:7233
- [ ] All services start with `docker-compose up`
- [ ] Data persists across restarts
- [ ] README with setup instructions
- [ ] Environment variables documented

**Testing Requirements**:
- [ ] Test: All services start successfully
- [ ] Test: Can connect to Temporal from Node.js client
- [ ] Test: Can view workflows in Web UI
- [ ] Test: Data persists after `docker-compose restart`

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Documentation complete
- [ ] All team members can run locally

**Deliverables**:
- `docker-compose.yml`
- `docker/temporal/` (configuration files)
- `docs/development/temporal-setup.md`
- `.env.example` (updated with Temporal variables)

---

#### M1-T031: Create CI/CD pipeline for workflow-builder
**Owner**: DevOps Engineer
**Dependencies**: M1-T030
**Parallel with**: M1-T011, M1-T021, M1-T041
**Estimate**: 12 hours

**Description**:
Set up GitHub Actions workflow for automated testing, building, and deployment of workflow-builder package.

**Acceptance Criteria**:
- [ ] CI runs on every PR: lint, typecheck, unit tests, integration tests
- [ ] CI runs e2e tests with Playwright
- [ ] CD deploys to staging on merge to main
- [ ] CD deploys to production on release tag
- [ ] Secrets managed securely
- [ ] Build artifacts cached for speed
- [ ] Workflow uses matrix strategy for parallel test execution

**Testing Requirements**:
- [ ] Test: CI fails on linting errors
- [ ] Test: CI fails on type errors
- [ ] Test: CI fails on test failures
- [ ] Test: CD deploys successfully to staging

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Pipeline runs successfully on PR
- [ ] Documentation complete

**Deliverables**:
- `.github/workflows/workflow-builder-ci.yml`
- `.github/workflows/workflow-builder-cd.yml`
- `docs/deployment/ci-cd.md`

---

### Frontend Foundation Tasks

#### M1-T040: Enhance WorkflowCanvas component for linear workflows
**Owner**: Frontend Engineer 1
**Dependencies**: None
**Parallel with**: M1-T001, M1-T010, M1-T020, M1-T030
**Estimate**: 16 hours

**Description**:
Review and enhance existing `WorkflowCanvas` component at `src/components/workflow/WorkflowCanvas.tsx` to support drag-and-drop of Trigger and Activity nodes. Already uses ReactFlow but needs enhancements.

**Acceptance Criteria**:
- [ ] Canvas displays existing workflow nodes and edges
- [ ] Can drag Trigger node from palette to canvas (only 1 allowed)
- [ ] Can drag Activity nodes from palette to canvas (unlimited)
- [ ] Can connect nodes by dragging edges
- [ ] Cannot create cycles (enforced by validation)
- [ ] Nodes have proper styling and icons
- [ ] Canvas has zoom, pan, minimap controls
- [ ] Undo/redo functionality works (Ctrl+Z, Ctrl+Y)
- [ ] Canvas auto-saves on changes (debounced)

**Testing Requirements**:
- [ ] Unit tests for node creation
- [ ] Unit tests for edge validation (no cycles)
- [ ] E2E test: Drag Trigger node to canvas
- [ ] E2E test: Drag 3 Activity nodes and connect them
- [ ] E2E test: Undo/redo operations
- [ ] E2E test: Canvas persists on page refresh

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/WorkflowCanvas.tsx` (enhanced)
- `src/components/workflow/nodes/TriggerNode.tsx`
- `src/components/workflow/nodes/ActivityNode.tsx`
- `tests/e2e/workflow-canvas/drag-drop.spec.ts`
- `tests/unit/workflow/canvas-validation.test.ts`

---

#### M1-T041: Create ComponentPalette for Trigger and Activity
**Owner**: Frontend Engineer 1
**Dependencies**: M1-T040
**Parallel with**: M1-T021, M1-T031, M1-T051
**Estimate**: 8 hours

**Description**:
Review and enhance existing `ComponentPalette` component to display draggable Trigger and Activity node types.

**Acceptance Criteria**:
- [ ] Palette displays "Trigger" node type (only 1 per workflow)
- [ ] Palette displays "Activity" node type
- [ ] Nodes are draggable from palette to canvas
- [ ] Palette shows node descriptions on hover
- [ ] Palette is collapsible/expandable
- [ ] Palette has search/filter functionality
- [ ] Visual feedback during drag operation

**Testing Requirements**:
- [ ] Unit tests for palette rendering
- [ ] E2E test: Drag node from palette to canvas
- [ ] E2E test: Filter palette nodes by search
- [ ] E2E test: Palette prevents multiple triggers

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/ComponentPalette.tsx` (enhanced)
- `tests/e2e/workflow-canvas/palette.spec.ts`
- `tests/unit/workflow/palette.test.ts`

---

#### M1-T042: Create PropertyPanel for node configuration
**Owner**: Frontend Engineer 2
**Dependencies**: M1-T040
**Parallel with**: M1-T041, M1-T052
**Estimate**: 16 hours

**Description**:
Review and enhance existing `PropertyPanel` component at `src/components/workflow/PropertyPanel.tsx` to configure Activity nodes (name, timeout, retry policy).

**Acceptance Criteria**:
- [ ] Panel appears when node is selected
- [ ] Shows node type and ID
- [ ] For Activity nodes: editable name field
- [ ] For Activity nodes: timeout configuration (duration picker)
- [ ] For Activity nodes: retry policy (max attempts, backoff)
- [ ] For Trigger nodes: trigger type selection (manual, scheduled)
- [ ] Real-time validation with error messages
- [ ] Changes auto-save (debounced)
- [ ] Panel has "Delete Node" button

**Testing Requirements**:
- [ ] Unit tests for form validation
- [ ] E2E test: Configure activity name
- [ ] E2E test: Configure timeout and retry
- [ ] E2E test: Delete node removes it from canvas
- [ ] Test validation errors display correctly

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/PropertyPanel.tsx` (enhanced)
- `src/components/workflow/forms/ActivityConfigForm.tsx`
- `src/components/workflow/forms/TriggerConfigForm.tsx`
- `tests/e2e/workflow-canvas/property-panel.spec.ts`
- `tests/unit/workflow/property-panel.test.ts`

---

## Phase 2: Integration (Weeks 2-3)
**Goal**: Connect frontend and backend, implement deployment and execution

### Worker Integration Tasks

#### M1-T050: Create dynamic worker registration system
**Owner**: Backend Engineer 1
**Dependencies**: M1-T021, M1-T030
**Parallel with**: M1-T051, M1-T061
**Estimate**: 16 hours

**Description**:
Build system to dynamically register compiled workflows with Temporal workers at runtime.

**Acceptance Criteria**:
- [ ] Worker manager can register new workflows without restart
- [ ] Generated workflow code is loaded dynamically (require/import)
- [ ] Activity implementations are registered with worker
- [ ] Multiple workflows can run on same worker
- [ ] Worker health check endpoint
- [ ] Worker can unregister workflows (cleanup)
- [ ] Supports hot-reload in development
- [ ] Production-safe error handling

**Testing Requirements**:
- [ ] Unit tests for worker registration
- [ ] Integration test: Register workflow, execute it
- [ ] Integration test: Register 3 workflows, execute all
- [ ] Test worker recovery after registration failure
- [ ] Test worker cleanup on workflow deletion

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Worker is production-ready

**Deliverables**:
- `src/lib/temporal/worker-manager.ts` (enhanced)
- `src/lib/temporal/workflow-registry.ts`
- `src/lib/temporal/activity-registry.ts`
- `tests/integration/temporal/worker-registration.test.ts`
- `docs/architecture/worker-management.md`

---

#### M1-T051: Build workflow deployment pipeline
**Owner**: Backend Engineer 1
**Dependencies**: M1-T050
**Parallel with**: M1-T041, M1-T052, M1-T061
**Estimate**: 12 hours

**Description**:
Create end-to-end deployment flow: compile → validate → register → activate.

**Acceptance Criteria**:
- [ ] `deployWorkflow` function compiles workflow JSON to TypeScript
- [ ] Validates generated TypeScript with `tsc --noEmit`
- [ ] Writes generated code to temporary workspace
- [ ] Registers workflow with worker
- [ ] Updates workflow status to "active" in database
- [ ] Rolls back on any failure (cleanup)
- [ ] Returns deployment ID for tracking
- [ ] Logs all deployment steps

**Testing Requirements**:
- [ ] Integration test: Deploy valid workflow succeeds
- [ ] Integration test: Deploy invalid workflow fails and rolls back
- [ ] Integration test: Deploy workflow, execute it immediately
- [ ] Test rollback cleans up all artifacts
- [ ] Test concurrent deployments don't conflict

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Deployment is production-ready

**Deliverables**:
- `src/lib/workflow-compiler/deployment.ts`
- `src/lib/workflow-compiler/validation.ts`
- `src/lib/workflow-compiler/storage.ts` (enhanced)
- `tests/integration/deployment/end-to-end.test.ts`
- `docs/architecture/deployment-flow.md`

---

### Execution Engine Tasks

#### M1-T060: Build workflow execution service
**Owner**: Backend Engineer 2
**Dependencies**: M1-T051, M1-T011
**Parallel with**: M1-T061, M1-T070
**Estimate**: 12 hours

**Description**:
Create service layer that manages workflow execution lifecycle with Temporal.

**Acceptance Criteria**:
- [ ] `executeWorkflow` function starts Temporal workflow
- [ ] Creates execution record in database
- [ ] Returns execution ID immediately (async execution)
- [ ] Polls Temporal for execution status
- [ ] Updates database with execution progress
- [ ] Handles execution completion (success/failure)
- [ ] Supports execution cancellation
- [ ] Stores execution results in database

**Testing Requirements**:
- [ ] Unit tests for execution service
- [ ] Integration test: Execute workflow, verify completion
- [ ] Integration test: Cancel running workflow
- [ ] Integration test: Handle workflow failure gracefully
- [ ] Test concurrent executions of same workflow

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Service is production-ready

**Deliverables**:
- `src/lib/execution/execution-service.ts`
- `src/lib/execution/status-tracker.ts`
- `tests/integration/execution/execution-service.test.ts`
- `docs/architecture/execution-engine.md`

---

#### M1-T061: Implement execution monitoring system
**Owner**: Backend Engineer 2
**Dependencies**: M1-T060
**Parallel with**: M1-T050, M1-T051, M1-T070
**Estimate**: 8 hours

**Description**:
Build system to track and expose workflow execution progress in real-time.

**Acceptance Criteria**:
- [ ] Tracks execution steps (activity completions)
- [ ] Exposes execution status via tRPC query (for polling)
- [ ] Returns execution history with timestamps
- [ ] Shows current step being executed
- [ ] Calculates execution progress percentage
- [ ] Handles long-running executions (minutes to hours)
- [ ] Cleans up old execution data (retention policy)

**Testing Requirements**:
- [ ] Integration test: Monitor workflow execution from start to finish
- [ ] Integration test: Query execution status at different stages
- [ ] Test progress calculation is accurate
- [ ] Test history retrieval performance with 100+ executions

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Monitoring is production-ready

**Deliverables**:
- `src/lib/execution/monitoring.ts`
- `src/lib/execution/history-service.ts`
- `tests/integration/execution/monitoring.test.ts`
- `docs/api/execution-monitoring.md`

---

### Frontend Integration Tasks

#### M1-T070: Build deployment UI flow
**Owner**: Frontend Engineer 2
**Dependencies**: M1-T042, M1-T051
**Parallel with**: M1-T060, M1-T061, M1-T071
**Estimate**: 12 hours

**Description**:
Create UI for deploying workflows with validation feedback and progress indication.

**Acceptance Criteria**:
- [ ] "Deploy" button in workflow builder header
- [ ] Button disabled when workflow is invalid
- [ ] Deployment shows progress modal (compiling, validating, registering)
- [ ] Success state shows "Workflow Active" badge
- [ ] Error state shows detailed error messages
- [ ] Can view generated code before deployment (optional step)
- [ ] Deployment history list (past deployments)
- [ ] Can undeploy/deactivate workflow

**Testing Requirements**:
- [ ] E2E test: Deploy valid workflow, verify success
- [ ] E2E test: Attempt to deploy invalid workflow, verify error
- [ ] E2E test: View generated code before deployment
- [ ] E2E test: Deactivate deployed workflow
- [ ] Test progress modal shows correct steps

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is production-ready

**Deliverables**:
- `src/components/workflow-builder/DeploymentButton.tsx`
- `src/components/workflow-builder/DeploymentProgressModal.tsx`
- `src/components/workflow-builder/DeploymentHistory.tsx`
- `tests/e2e/deployment/deploy-workflow.spec.ts`

---

#### M1-T071: Build execution monitoring UI
**Owner**: Frontend Engineer 2
**Dependencies**: M1-T061, M1-T042
**Parallel with**: M1-T070, M1-T072
**Estimate**: 16 hours

**Description**:
Create UI for monitoring workflow execution progress and viewing results. Review existing `WorkflowExecutionPanel` at `src/components/workflow-execution/WorkflowExecutionPanel.tsx` and enhance.

**Acceptance Criteria**:
- [ ] Execution panel shows current status (building, running, completed, failed)
- [ ] Progress bar with percentage (0-100%)
- [ ] List of execution steps with status indicators (pending, running, completed, failed)
- [ ] Step durations and timestamps
- [ ] "Run Workflow" button (with input modal if workflow requires params)
- [ ] "View Results" expands to show execution output
- [ ] "View Logs" shows activity logs
- [ ] Real-time updates (polls every 1 second during execution)
- [ ] Error messages with stack traces (if failed)
- [ ] "Retry" button for failed executions

**Testing Requirements**:
- [ ] E2E test: Run workflow, watch progress in real-time
- [ ] E2E test: View completed execution results
- [ ] E2E test: View failed execution error details
- [ ] E2E test: Retry failed execution
- [ ] Test polling starts/stops correctly

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is production-ready

**Deliverables**:
- `src/components/workflow-execution/WorkflowExecutionPanel.tsx` (enhanced)
- `src/components/workflow-execution/ExecutionProgress.tsx`
- `src/components/workflow-execution/ExecutionSteps.tsx`
- `src/components/workflow-execution/ExecutionResults.tsx`
- `tests/e2e/execution/execution-monitoring.spec.ts` (enhanced)

---

#### M1-T072: Create code preview dialog
**Owner**: Frontend Engineer 2
**Dependencies**: M1-T012, M1-T021
**Parallel with**: M1-T071
**Estimate**: 8 hours

**Description**:
Review and enhance existing `CodePreviewDialog` component at `src/components/workflow-builder/CodePreviewDialog.tsx` to display generated TypeScript code with syntax highlighting.

**Acceptance Criteria**:
- [ ] Dialog shows tabs: Workflow, Activities, Worker, package.json, tsconfig.json
- [ ] Syntax highlighting for TypeScript code (using Prism.js or similar)
- [ ] Line numbers displayed
- [ ] "Copy to Clipboard" button for each tab
- [ ] "Download Package" button (downloads all files as .zip)
- [ ] Code is read-only (no editing)
- [ ] Dialog is responsive (works on mobile)

**Testing Requirements**:
- [ ] E2E test: View code for simple workflow (1 activity)
- [ ] E2E test: View code for complex workflow (5 activities)
- [ ] E2E test: Copy code to clipboard
- [ ] E2E test: Download package as .zip
- [ ] Test syntax highlighting renders correctly

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow-builder/CodePreviewDialog.tsx` (enhanced)
- `src/lib/code-highlighting.ts` (syntax highlighting utility)
- `tests/e2e/code-preview/view-code.spec.ts`

---

## Phase 3: Testing & Polish (Week 4)
**Goal**: Comprehensive testing, bug fixes, polish UI/UX

### Integration Testing Tasks

#### M1-T080: End-to-end workflow creation test suite
**Owner**: QA Engineer
**Dependencies**: M1-T071, M1-T072
**Parallel with**: M1-T081, M1-T082
**Estimate**: 12 hours

**Description**:
Create comprehensive E2E test suite covering entire workflow creation, deployment, and execution flow.

**Acceptance Criteria**:
- [ ] Test: Create workflow with 1 activity, deploy, execute successfully
- [ ] Test: Create workflow with 5 activities, deploy, execute successfully
- [ ] Test: Create workflow, configure timeouts, deploy, execute with timeout
- [ ] Test: Create workflow, configure retry, deploy, execute with failure and retry
- [ ] Test: Create workflow, view code, deploy, execute, view results
- [ ] Test: Create workflow, attempt to deploy invalid (missing trigger), verify error
- [ ] Test: Create workflow, delete node, deploy, execute
- [ ] All tests pass consistently (no flakiness)

**Testing Requirements**:
- [ ] Tests use Playwright with page object pattern
- [ ] Tests clean up after themselves (delete test workflows)
- [ ] Tests are isolated (can run in parallel)
- [ ] Tests have proper waits (no arbitrary sleeps)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing in CI
- [ ] Test coverage report shows >80%

**Deliverables**:
- `tests/e2e/workflows/end-to-end.spec.ts`
- `tests/e2e/workflows/page-objects/WorkflowBuilder.ts`
- `tests/e2e/workflows/page-objects/ExecutionMonitor.ts`
- `docs/testing/e2e-workflow-tests.md`

---

#### M1-T081: Integration test suite for compiler and execution
**Owner**: Backend Engineer 1
**Dependencies**: M1-T060, M1-T061
**Parallel with**: M1-T080, M1-T082
**Estimate**: 8 hours

**Description**:
Create integration tests that verify compiler output executes correctly in Temporal.

**Acceptance Criteria**:
- [ ] Test: Compile workflow, execute in Temporal, verify completion
- [ ] Test: Compile workflow with retry, force failure, verify retry occurs
- [ ] Test: Compile workflow with timeout, force slow activity, verify timeout
- [ ] Test: Compile 5 different workflows, execute all simultaneously
- [ ] Test: Compile workflow, register with worker, execute immediately
- [ ] Test: Compile invalid workflow, verify compiler error

**Testing Requirements**:
- [ ] Tests use real Temporal instance (from docker-compose)
- [ ] Tests have proper cleanup (unregister workflows)
- [ ] Tests verify actual Temporal execution (not mocked)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Tests run in CI environment

**Deliverables**:
- `tests/integration/compiler-execution/end-to-end.test.ts`
- `tests/integration/compiler-execution/retry-handling.test.ts`
- `tests/integration/compiler-execution/timeout-handling.test.ts`
- `tests/integration/compiler-execution/fixtures/` (test workflows)

---

#### M1-T082: Performance and load testing
**Owner**: QA Engineer
**Dependencies**: M1-T080, M1-T081
**Parallel with**: M1-T083
**Estimate**: 8 hours

**Description**:
Create performance tests to verify system handles expected load for Milestone 1.

**Acceptance Criteria**:
- [ ] Test: Create 10 workflows simultaneously (via API)
- [ ] Test: Deploy 10 workflows simultaneously
- [ ] Test: Execute 20 workflows simultaneously
- [ ] Test: Compile workflow with 50 activities (stress test)
- [ ] All operations complete within acceptable time (90th percentile <5s)
- [ ] No memory leaks during extended test run (30 minutes)
- [ ] Database queries are efficient (no N+1 queries)

**Testing Requirements**:
- [ ] Use k6 or Artillery for load testing
- [ ] Tests generate performance report (response times, throughput)
- [ ] Tests identify bottlenecks if any
- [ ] Tests run in CI (with performance thresholds)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Performance benchmarks documented
- [ ] No critical performance issues found

**Deliverables**:
- `tests/performance/workflow-creation.k6.js`
- `tests/performance/workflow-execution.k6.js`
- `tests/performance/compiler-stress.k6.js`
- `docs/testing/performance-benchmarks.md`

---

### Polish Tasks

#### M1-T083: UI/UX polish and accessibility
**Owner**: Frontend Engineer 1 + Frontend Engineer 2
**Dependencies**: M1-T071, M1-T072
**Parallel with**: M1-T082, M1-T084
**Estimate**: 16 hours

**Description**:
Polish UI/UX based on internal testing feedback, ensure accessibility standards met.

**Acceptance Criteria**:
- [ ] All interactive elements have focus states
- [ ] Keyboard navigation works (tab through all controls)
- [ ] ARIA labels on all important elements
- [ ] Color contrast meets WCAG AA standards
- [ ] Loading states consistent across all components
- [ ] Error states have clear messaging and recovery actions
- [ ] Success states have clear visual feedback
- [ ] Responsive design works on tablet and mobile
- [ ] Animations are smooth (60fps)
- [ ] No console errors or warnings

**Testing Requirements**:
- [ ] Accessibility audit with axe-core (0 violations)
- [ ] Manual keyboard navigation test
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on tablet (iPad) and mobile (iPhone)
- [ ] Screen reader test (VoiceOver or NVDA)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Accessibility audit passes
- [ ] Cross-browser testing passes
- [ ] Design review approved

**Deliverables**:
- UI components updated with polish
- `docs/accessibility/wcag-compliance.md`
- `tests/e2e/accessibility/workflow-builder.spec.ts`

---

#### M1-T084: Error handling and validation improvements
**Owner**: Backend Engineer 2 + Frontend Engineer 2
**Dependencies**: M1-T080, M1-T081
**Parallel with**: M1-T083
**Estimate**: 12 hours

**Description**:
Improve error messages, validation feedback, and error recovery flows based on testing insights.

**Acceptance Criteria**:
- [ ] Validation errors show specific field and issue (not generic messages)
- [ ] Network errors show retry button
- [ ] Workflow compilation errors highlight problematic nodes
- [ ] Execution errors show step that failed with details
- [ ] Timeout errors suggest increasing timeout configuration
- [ ] Database errors are caught and logged (not exposed to user)
- [ ] All errors logged to monitoring system
- [ ] User-friendly error messages (no stack traces in UI)

**Testing Requirements**:
- [ ] Test all error scenarios return proper messages
- [ ] Test error recovery flows (retry after failure)
- [ ] Test validation catches edge cases
- [ ] Test errors are logged correctly

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Error messages reviewed and approved

**Deliverables**:
- `src/lib/errors/workflow-errors.ts` (error classes)
- `src/lib/validation/workflow-validator.ts` (enhanced)
- `src/components/workflow/ErrorBoundary.tsx`
- `docs/troubleshooting/common-errors.md`

---

## Phase 4: Demo Preparation (Week 5)
**Goal**: Prepare demo, documentation, and training materials

### Demo Preparation Tasks

#### M1-T090: Create demo workflow examples
**Owner**: Backend Engineer 2 + QA Engineer
**Dependencies**: M1-T083, M1-T084
**Parallel with**: M1-T091, M1-T092
**Estimate**: 8 hours

**Description**:
Create 3-5 example workflows that showcase Milestone 1 capabilities for Week 6 demo.

**Acceptance Criteria**:
- [ ] Example 1: Simple API orchestration (3 activities)
- [ ] Example 2: Data pipeline (5 activities with retry)
- [ ] Example 3: Notification chain (4 activities with timeout)
- [ ] Each example has descriptive name and documentation
- [ ] Examples can be imported via seed script
- [ ] Examples demonstrate different configuration options
- [ ] Examples execute successfully with realistic mock data

**Testing Requirements**:
- [ ] Test: Import all examples successfully
- [ ] Test: Execute all examples end-to-end
- [ ] Test: Examples show variety of features

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Examples tested and working
- [ ] Documentation complete

**Deliverables**:
- `examples/milestone-1/api-orchestration.json`
- `examples/milestone-1/data-pipeline.json`
- `examples/milestone-1/notification-chain.json`
- `scripts/seed-demo-workflows.ts`
- `docs/examples/milestone-1-demos.md`

---

#### M1-T091: Write user documentation
**Owner**: Frontend Engineer 1 + Backend Engineer 1
**Dependencies**: M1-T083, M1-T084
**Parallel with**: M1-T090, M1-T092
**Estimate**: 12 hours

**Description**:
Create comprehensive user documentation for creating, deploying, and executing workflows.

**Acceptance Criteria**:
- [ ] Getting started guide (5-10 minutes to first workflow)
- [ ] Canvas user guide (drag-and-drop, configuration)
- [ ] Deployment guide (step-by-step with screenshots)
- [ ] Execution monitoring guide (understanding status, logs, errors)
- [ ] Troubleshooting guide (common issues and solutions)
- [ ] Video walkthrough (5-7 minutes screencast)
- [ ] All documentation has screenshots and code examples
- [ ] Documentation versioned (for Milestone 1)

**Testing Requirements**:
- [ ] Have non-team member follow guide and provide feedback
- [ ] Test all code examples execute correctly
- [ ] Verify all links work

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Feedback incorporated

**Deliverables**:
- `docs/user-guide/getting-started.md`
- `docs/user-guide/workflow-canvas.md`
- `docs/user-guide/deployment.md`
- `docs/user-guide/execution-monitoring.md`
- `docs/user-guide/troubleshooting.md`
- `docs/user-guide/video-walkthrough.mp4`

---

#### M1-T092: Create developer/API documentation
**Owner**: Backend Engineer 1 + Backend Engineer 2
**Dependencies**: M1-T084
**Parallel with**: M1-T090, M1-T091
**Estimate**: 8 hours

**Description**:
Create developer documentation for API endpoints, compiler architecture, and extension points.

**Acceptance Criteria**:
- [ ] API reference for all tRPC endpoints (OpenAPI/Swagger-style)
- [ ] Compiler architecture document (how compilation works)
- [ ] Worker registration guide (how dynamic workers work)
- [ ] Extension guide (how to add new node types in future)
- [ ] Database schema documentation
- [ ] Code examples for programmatic workflow creation
- [ ] All API endpoints have curl examples

**Testing Requirements**:
- [ ] Test all code examples execute correctly
- [ ] Test all curl examples work
- [ ] Verify API documentation matches implementation

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Documentation versioned

**Deliverables**:
- `docs/api/reference.md`
- `docs/architecture/compiler.md`
- `docs/architecture/worker-registration.md`
- `docs/development/extension-guide.md`
- `docs/database/schema.md`

---

#### M1-T093: Prepare demo script and environment
**Owner**: QA Engineer + DevOps Engineer
**Dependencies**: M1-T090, M1-T091
**Parallel with**: None (final task)
**Estimate**: 8 hours

**Description**:
Prepare stable demo environment and rehearse demo script for Week 6 stakeholder presentation.

**Acceptance Criteria**:
- [ ] Dedicated demo environment deployed (demo.workflow-builder.com)
- [ ] Demo environment pre-seeded with example workflows
- [ ] Demo script written (6-point demo from roadmap)
- [ ] Demo rehearsed with timing (15 minutes total)
- [ ] Backup plan if live demo fails (recording)
- [ ] Q&A talking points prepared
- [ ] Success metrics prepared (what we achieved)

**Testing Requirements**:
- [ ] Run demo script 3+ times successfully
- [ ] Test demo environment is stable (no crashes)
- [ ] Have backup recording ready

**Completion Requirements**:
- [ ] Demo environment stable
- [ ] Team rehearsed and confident
- [ ] Backup materials ready

**Deliverables**:
- `docs/demo/milestone-1-script.md`
- `docs/demo/talking-points.md`
- `docs/demo/success-metrics.md`
- Demo environment URL
- Backup demo recording

---

## Phase 5: Buffer & Final Polish (Week 6)
**Goal**: Address issues found in Week 5, final polish, prepare for demo

### Buffer Tasks

#### M1-T100: Bug fixes and issue resolution
**Owner**: All engineers
**Dependencies**: M1-T093
**Parallel with**: M1-T101
**Estimate**: 40 hours (distributed across team)

**Description**:
Address all bugs and issues found during Week 5 testing and rehearsals. This is a buffer task for unexpected issues.

**Acceptance Criteria**:
- [ ] All critical bugs fixed (P0)
- [ ] All high-priority bugs fixed (P1)
- [ ] Medium-priority bugs triaged (fix or defer)
- [ ] No known blockers for demo
- [ ] Regression testing passed

**Testing Requirements**:
- [ ] All existing tests still pass
- [ ] New tests added for bug fixes
- [ ] Manual testing of demo flows

**Completion Requirements**:
- [ ] All critical and high-priority issues resolved
- [ ] Release candidate created
- [ ] Final testing completed

**Deliverables**:
- Bug fixes committed to feature branch
- Updated test suites
- Release notes

---

#### M1-T101: Final demo preparation and rehearsal
**Owner**: All team members
**Dependencies**: M1-T093, M1-T100
**Parallel with**: None (final task before demo)
**Estimate**: 8 hours (team activity)

**Description**:
Final team rehearsal, polish demo environment, prepare presentation materials.

**Acceptance Criteria**:
- [ ] Demo runs smoothly start to finish
- [ ] All team members can present sections
- [ ] Presentation slides prepared (if needed)
- [ ] Success metrics compiled (workflows created, time saved)
- [ ] Stakeholder invite sent
- [ ] Demo environment tested 1 hour before presentation

**Testing Requirements**:
- [ ] Full demo run-through with timing
- [ ] Fallback plan tested (recording)
- [ ] All demo workflows execute successfully

**Completion Requirements**:
- [ ] Team confident in demo
- [ ] All materials ready
- [ ] Stakeholders confirmed

**Deliverables**:
- Final demo environment
- Presentation materials
- Success metrics report
- Team ready to present

---

## Dependency Graph

### Visual Representation

```
Week 1 (Foundation - All Parallel):
├─ M1-T001 (Database Schema)
│  └─ M1-T002 (Executions Table)
├─ M1-T010 (tRPC Foundation)
│  ├─ M1-T011 (Execution API)
│  └─ M1-T012 (Compiler API)
├─ M1-T020 (Compiler Core)
│  └─ M1-T021 (Code Generator)
├─ M1-T030 (Temporal Setup)
│  └─ M1-T031 (CI/CD)
└─ M1-T040 (Canvas UI)
   ├─ M1-T041 (Palette)
   └─ M1-T042 (Property Panel)

Week 2 (Integration):
├─ M1-T050 (Worker Registration) [depends: T021, T030]
│  └─ M1-T051 (Deployment Pipeline)
└─ M1-T060 (Execution Service) [depends: T051, T011]
   └─ M1-T061 (Monitoring)

Week 3 (Frontend Integration):
├─ M1-T070 (Deployment UI) [depends: T042, T051]
├─ M1-T071 (Execution UI) [depends: T061, T042]
└─ M1-T072 (Code Preview) [depends: T012, T021]

Week 4 (Testing):
├─ M1-T080 (E2E Tests) [depends: T071, T072]
├─ M1-T081 (Integration Tests) [depends: T060, T061]
├─ M1-T082 (Performance Tests) [depends: T080, T081]
├─ M1-T083 (UI Polish) [depends: T071, T072]
└─ M1-T084 (Error Handling) [depends: T080, T081]

Week 5 (Demo Prep):
├─ M1-T090 (Demo Examples) [depends: T083, T084]
├─ M1-T091 (User Docs) [depends: T083, T084]
├─ M1-T092 (Dev Docs) [depends: T084]
└─ M1-T093 (Demo Script) [depends: T090, T091]

Week 6 (Buffer):
├─ M1-T100 (Bug Fixes) [depends: T093]
└─ M1-T101 (Final Rehearsal) [depends: T093, T100]
```

### Critical Path (68 hours = ~2 weeks)

```
M1-T001 (4h)
  → M1-T010 (6h)
    → M1-T020 (12h)
      → M1-T021 (16h)
        → M1-T050 (16h)
          → M1-T051 (12h)
            → M1-T080 (12h)

Total: 78 hours
```

This is your critical path. Any delays here push the entire milestone. Focus engineering effort here.

---

## Weekly Timeline with Team Assignments

### Week 1: Foundation (All Teams in Parallel)

**Backend Team**:
- BE1: M1-T020 (Compiler Core) - 12h
- BE1: M1-T012 (Compiler API) - 4h
- BE2: M1-T001 (Database Schema) - 4h
- BE2: M1-T002 (Executions Table) - 3h
- BE2: M1-T010 (tRPC Foundation) - 6h
- BE2: M1-T011 (Execution API) - 8h
**Total**: 37 hours (both engineers working full week)

**Frontend Team**:
- FE1: M1-T040 (Canvas Component) - 16h
- FE1: M1-T041 (Palette Component) - 8h
- FE2: M1-T042 (Property Panel) - 16h
**Total**: 40 hours (both engineers working full week)

**DevOps Team**:
- DevOps: M1-T030 (Temporal Setup) - 8h
- DevOps: M1-T031 (CI/CD Pipeline) - 12h
**Total**: 20 hours

**End of Week 1 Deliverables**:
- Database schema deployed
- tRPC endpoints stubbed out
- Compiler core structure in place
- Canvas with drag-and-drop working
- Temporal running locally for all devs
- CI/CD pipeline operational

---

### Week 2: Backend Integration

**Backend Team**:
- BE1: M1-T021 (Code Generator) - 16h
- BE1: M1-T050 (Worker Registration) - 16h
- BE2: M1-T060 (Execution Service) - 12h
- BE2: M1-T061 (Monitoring) - 8h
**Total**: 52 hours (both engineers working full week)

**Frontend Team**:
- FE1: Polish canvas based on feedback - 8h
- FE1: Start M1-T072 (Code Preview) - 8h
- FE2: Polish property panel - 8h
- FE2: Start M1-T070 (Deployment UI) - 8h
**Total**: 32 hours (lighter week, waiting for backend)

**DevOps Team**:
- DevOps: Support backend with Temporal issues - 8h
- DevOps: Improve CI/CD based on usage - 4h
**Total**: 12 hours

**End of Week 2 Deliverables**:
- Code generator producing valid TypeScript
- Workers can register workflows dynamically
- Execution service can start workflows
- Monitoring tracks execution progress

---

### Week 3: Full Stack Integration

**Backend Team**:
- BE1: M1-T051 (Deployment Pipeline) - 12h
- BE1: Support frontend integration - 8h
- BE2: Complete M1-T061 (Monitoring) - 8h
- BE2: Support frontend integration - 8h
**Total**: 36 hours

**Frontend Team**:
- FE1: Complete M1-T072 (Code Preview) - 8h
- FE1: Integration testing - 8h
- FE2: Complete M1-T070 (Deployment UI) - 12h
- FE2: M1-T071 (Execution Monitoring UI) - 16h
**Total**: 44 hours (heavy integration week)

**DevOps Team**:
- DevOps: Deploy staging environment - 8h
- DevOps: Set up monitoring/logging - 8h
**Total**: 16 hours

**End of Week 3 Deliverables**:
- Can deploy workflow from UI
- Can execute workflow from UI
- Can monitor execution in real-time
- Can view generated code
- Staging environment operational

---

### Week 4: Testing & Polish

**Backend Team**:
- BE1: M1-T081 (Integration Tests) - 8h
- BE1: M1-T084 (Error Handling) - 6h
- BE2: M1-T084 (Error Handling) - 6h
- BE2: Bug fixes - 8h
**Total**: 28 hours

**Frontend Team**:
- FE1: M1-T083 (UI Polish) - 12h
- FE1: Accessibility improvements - 4h
- FE2: M1-T083 (UI Polish) - 4h
- FE2: M1-T084 (Error Handling) - 6h
- FE2: Bug fixes - 6h
**Total**: 32 hours

**QA Team**:
- QA: M1-T080 (E2E Tests) - 12h
- QA: M1-T082 (Performance Tests) - 8h
- QA: Manual testing and bug reporting - 8h
**Total**: 28 hours

**DevOps Team**:
- DevOps: Performance tuning - 8h
- DevOps: Deploy demo environment - 8h
**Total**: 16 hours

**End of Week 4 Deliverables**:
- Comprehensive test suites passing
- UI polished and accessible
- Error handling improved
- Demo environment ready
- Bug backlog triaged

---

### Week 5: Demo Preparation

**Backend Team**:
- BE1: M1-T092 (Dev Docs) - 8h
- BE1: M1-T091 (User Docs) - 4h
- BE2: M1-T090 (Demo Examples) - 8h
- BE2: Bug fixes - 8h
**Total**: 28 hours

**Frontend Team**:
- FE1: M1-T091 (User Docs) - 8h
- FE1: Record demo video - 4h
- FE2: Bug fixes - 8h
- FE2: Demo prep - 4h
**Total**: 24 hours

**QA Team**:
- QA: M1-T090 (Demo Examples) - 4h
- QA: M1-T093 (Demo Script) - 8h
- QA: Final testing - 8h
**Total**: 20 hours

**DevOps Team**:
- DevOps: M1-T093 (Demo Environment) - 8h
- DevOps: Final infrastructure checks - 4h
**Total**: 12 hours

**End of Week 5 Deliverables**:
- Demo workflows created and tested
- User and developer documentation complete
- Demo script rehearsed
- Demo environment stable
- Team ready to demo

---

### Week 6: Buffer & Demo

**All Team**:
- M1-T100 (Bug Fixes) - 20h distributed
- M1-T101 (Final Rehearsal) - 8h team activity
- Buffer for unexpected issues - 12h

**Demo Day** (End of Week 6):
- Present to stakeholders
- Show 6-point demo from roadmap
- Gather feedback for Milestone 2

**End of Week 6 Deliverables**:
- Milestone 1 complete
- Demo successful
- Stakeholder feedback collected
- Go/No-Go decision on Milestone 2

---

## Risk Mitigation

### High-Risk Items

1. **Dynamic Worker Registration** (M1-T050)
   - **Risk**: Complex, may take longer than estimated
   - **Mitigation**: Start early, allocate BE1's full focus, have BE2 as backup
   - **Fallback**: Use static worker registration (manual restart required)

2. **Code Generation Quality** (M1-T021)
   - **Risk**: Generated code may have bugs or not compile
   - **Mitigation**: Extensive unit tests, validate with `tsc --noEmit`
   - **Fallback**: Manual templates for demo

3. **Temporal Integration** (M1-T030, M1-T050)
   - **Risk**: Local Temporal setup may have networking issues
   - **Mitigation**: DevOps sets up first, documents issues
   - **Fallback**: Use Temporal Cloud trial

4. **E2E Test Flakiness** (M1-T080)
   - **Risk**: E2E tests may be flaky, slow down development
   - **Mitigation**: Use proper waits, page object pattern, run in CI
   - **Fallback**: Manual testing for demo prep

### Dependencies on External Systems

- **Temporal**: Critical dependency. Have fallback to Temporal Cloud if local issues.
- **Supabase**: Database. Ensure connection pooling configured correctly.
- **GitHub Actions**: CI/CD. Have local testing workflow as backup.

### Team Availability Risks

- **Key person dependency**: BE1 is critical for compiler and worker. If unavailable, BE2 must be trained.
- **Buffer**: Week 6 is intentional buffer for unexpected absences.

---

## Success Metrics for Milestone 1

### Quantitative Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Workflows created | 5-10 | Count in database |
| Successful executions | >90% | Execution success rate |
| User adoption | 3-5 users | User accounts with workflows |
| Deployment time | <2 minutes | Average time from "Deploy" click to "Active" |
| Execution latency | <5 seconds | Average time for simple 3-activity workflow |
| UI response time | <200ms | 95th percentile for canvas operations |
| Test coverage | >80% | Code coverage report |
| Zero critical bugs | 0 P0 bugs | Bug tracker |

### Qualitative Success Criteria

- [ ] **Usable**: Non-technical stakeholder can create workflow in 10 minutes
- [ ] **Reliable**: Demo runs successfully without crashes
- [ ] **Understandable**: Users understand execution monitoring and errors
- [ ] **Documented**: User guide enables self-service workflow creation
- [ ] **Production-ready**: Code quality suitable for production deployment

### Demo Success Criteria (Week 6)

Must successfully demonstrate all 6 points from roadmap:
1. [ ] Create a workflow in UI (drag 3 activities)
2. [ ] Configure each activity (name, timeout)
3. [ ] Click "Deploy" (shows compilation progress)
4. [ ] Workflow executes successfully (monitor in real-time)
5. [ ] View generated TypeScript code (properly formatted)
6. [ ] Monitor execution in UI (shows steps, progress, results)

**If all 6 succeed**: Milestone 1 complete ✓
**If <6 succeed**: Use Week 6 buffer to address issues

---

## Handoff to Milestone 2

### Prerequisites for M2 Start

- [ ] All M1 tasks completed (or deferred with documented reason)
- [ ] Demo successful and stakeholder approval received
- [ ] User feedback collected and documented
- [ ] Known issues triaged (fix in M2 or defer)
- [ ] M1 code merged to main branch
- [ ] M1 documentation published
- [ ] Team retrospective completed

### Lessons Learned Handoff

At end of M1, document:
1. What took longer than expected (adjust M2 estimates)
2. What went smoothly (repeat in M2)
3. Technical debt created (address in M2 if critical)
4. User feedback themes (prioritize in M2)
5. Team velocity (actual vs. estimated hours)

### Milestone 2 Preview

Based on M1 completion, M2 will add:
- Conditional nodes (if/else branching)
- Variables panel
- Basic retry configuration
- Decision tree workflows

Expected start: Week 7 (immediately after M1 completion)

---

## Appendix: Task Summary Table

| Task ID | Task Name | Owner | Estimate | Week | Dependencies |
|---------|-----------|-------|----------|------|--------------|
| M1-T001 | Extend workflow schema | BE2 | 4h | 1 | None |
| M1-T002 | Create executions table | BE2 | 3h | 1 | T001 |
| M1-T010 | tRPC workflows router | BE2 | 6h | 1 | None |
| M1-T011 | Execution API endpoints | BE2 | 8h | 1 | T002, T010 |
| M1-T012 | Compiler API endpoint | BE1 | 4h | 1 | T010 |
| M1-T020 | Activity proxy compiler | BE1 | 12h | 1 | None |
| M1-T021 | Code generator | BE1 | 16h | 2 | T020 |
| M1-T030 | Temporal local setup | DevOps | 8h | 1 | None |
| M1-T031 | CI/CD pipeline | DevOps | 12h | 1 | T030 |
| M1-T040 | Canvas component | FE1 | 16h | 1 | None |
| M1-T041 | Component palette | FE1 | 8h | 1 | T040 |
| M1-T042 | Property panel | FE2 | 16h | 1 | T040 |
| M1-T050 | Worker registration | BE1 | 16h | 2 | T021, T030 |
| M1-T051 | Deployment pipeline | BE1 | 12h | 2-3 | T050 |
| M1-T060 | Execution service | BE2 | 12h | 2 | T051, T011 |
| M1-T061 | Monitoring system | BE2 | 8h | 2-3 | T060 |
| M1-T070 | Deployment UI | FE2 | 12h | 2-3 | T042, T051 |
| M1-T071 | Execution monitoring UI | FE2 | 16h | 3 | T061, T042 |
| M1-T072 | Code preview dialog | FE2 | 8h | 2-3 | T012, T021 |
| M1-T080 | E2E test suite | QA | 12h | 4 | T071, T072 |
| M1-T081 | Integration tests | BE1 | 8h | 4 | T060, T061 |
| M1-T082 | Performance tests | QA | 8h | 4 | T080, T081 |
| M1-T083 | UI polish | FE1+FE2 | 16h | 4 | T071, T072 |
| M1-T084 | Error handling | BE2+FE2 | 12h | 4 | T080, T081 |
| M1-T090 | Demo examples | BE2+QA | 8h | 5 | T083, T084 |
| M1-T091 | User documentation | FE1+BE1 | 12h | 5 | T083, T084 |
| M1-T092 | Developer documentation | BE1+BE2 | 8h | 5 | T084 |
| M1-T093 | Demo script | QA+DevOps | 8h | 5 | T090, T091 |
| M1-T100 | Bug fixes | All | 40h | 6 | T093 |
| M1-T101 | Final rehearsal | All | 8h | 6 | T093, T100 |

**Total Estimated Hours**: ~350 hours
**Team Size**: 6 people
**Timeline**: 6 weeks
**Capacity**: 240 hours per week (6 people × 40 hours)
**Buffer**: ~40% (Week 6 is mostly buffer)

---

## Questions & Answers

**Q: What if we fall behind in Week 2?**
A: Critical path is code generation (T021) and worker registration (T050). Prioritize these. Frontend can continue with mock data. Cut scope on polish tasks (T083) if needed.

**Q: Can we parallelize more?**
A: Week 1 is already maximally parallel. Weeks 2-3 have natural dependencies (frontend needs backend APIs). Adding more engineers won't speed up critical path.

**Q: What if demo fails?**
A: Week 6 buffer allows 1 more week to fix critical issues. If still not ready, delay demo by 1 week. Backup: show recorded demo instead of live.

**Q: How do we track progress?**
A: Daily standups, weekly demos, task board (GitHub Projects or Jira). Each task has clear acceptance criteria - when all met, task is done.

**Q: What if we want to add features not in Milestone 1?**
A: Defer to Milestone 2. Stay disciplined on scope. Goal is working system, not perfect system.

---

**Created**: 2025-01-19
**Version**: 1.0
**Next Review**: End of Week 3 (mid-milestone check-in)
