# Milestone 2: Decision Trees - Detailed Task Breakdown

**Goal**: Ship working conditional workflows (if/else branching), variables, and basic retry configuration within 6 weeks.

**Timeline**: Weeks 7-12
**Target Demo Date**: End of Week 12

---

## Executive Summary

### Critical Path (Longest Dependencies)
```
Database Schema (4h)
  → Backend Conditional Pattern (12h)
    → Code Generation (16h)
      → Variable Management (12h)
        → Frontend Conditional Node (16h)
          → E2E Testing (12h)

Total Critical Path: ~72 hours = ~2 weeks (with buffer)
```

### Team Structure
- **Backend Engineer 1**: Conditional pattern compiler, variable management, code generation
- **Backend Engineer 2**: API layer enhancements, retry logic, state management
- **Frontend Engineer 1**: Conditional node UI, visual path connections, canvas enhancements
- **DevOps Engineer (0.5 FTE)**: Infrastructure support, monitoring enhancements
- **QA Engineer (0.5 FTE)**: Testing, validation, demo prep

### Parallelization Strategy
- **Week 7**: All teams work in parallel on foundations (build on M1)
- **Week 8-9**: Frontend and backend converge on conditional logic
- **Week 10**: Integration testing and polish
- **Week 11**: Demo preparation and documentation
- **Week 12**: Buffer for issues and final polish

---

## Phase 1: Foundation (Week 7)
**Goal**: Extend M1 foundations to support conditionals, variables, and retry

### Database Schema Tasks

#### M2-T001: Extend workflow schema for conditional nodes
**Owner**: Backend Engineer 2
**Dependencies**: M1 complete
**Parallel with**: M2-T010, M2-T020, M2-T030, M2-T040
**Estimate**: 4 hours

**Description**:
Extend the workflow `definition` JSONB schema to support conditional node types (if/else), branch definitions (true/false paths), and node metadata for variable declarations.

**Acceptance Criteria**:
- [ ] Conditional node type supported in definition schema
- [ ] Nodes can have `branches` field (array of {condition, target})
- [ ] Nodes can have `variables` field (array of {name, type, defaultValue})
- [ ] Schema validation prevents invalid branch structures (cycles)
- [ ] Migration script created and tested locally
- [ ] TypeScript types updated in `src/types/database.ts`
- [ ] Can create workflow with 2+ conditional nodes via SQL

**Testing Requirements**:
- [ ] Unit tests for schema validation
- [ ] Integration test: Create workflow with conditional node
- [ ] Integration test: Query workflows with branches
- [ ] Test migration rollback works

**Completion Requirements**:
- [ ] Code committed to feature branch `feature/milestone-2`
- [ ] All tests passing
- [ ] Type checking passes
- [ ] Documentation updated in `docs/database-schema.md`

**Deliverables**:
- `supabase/migrations/YYYYMMDD_extend_workflow_conditional_schema.sql`
- `src/types/database.ts` (updated TypeScript types)
- `tests/integration/database/conditional-schema.test.ts`
- `docs/database-schema.md` (schema documentation update)

---

#### M2-T002: Create workflow_variables table
**Owner**: Backend Engineer 2
**Dependencies**: M2-T001
**Parallel with**: M2-T011, M2-T021
**Estimate**: 3 hours

**Description**:
Create a new `workflow_variables` table to store workflow-level variable definitions and runtime values.

**Acceptance Criteria**:
- [ ] Table has: id, workflow_id, name, type, default_value, description
- [ ] Foreign key to workflows table with CASCADE delete
- [ ] Index on workflow_id and name (unique constraint)
- [ ] Can store variable metadata as JSONB
- [ ] TypeScript types generated
- [ ] Validation for variable types (string, number, boolean, object, array)

**Testing Requirements**:
- [ ] Integration test: Create variable record
- [ ] Integration test: Query variables by workflow_id
- [ ] Integration test: Update variable value
- [ ] Test cascade delete works
- [ ] Test unique constraint enforced

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Documentation updated

**Deliverables**:
- `supabase/migrations/YYYYMMDD_create_workflow_variables.sql`
- `src/types/database.ts` (updated)
- `tests/integration/database/workflow-variables.test.ts`
- `docs/database-schema.md` (updated)

---

### Backend API Foundation Tasks

#### M2-T010: Enhance tRPC workflows router for conditionals
**Owner**: Backend Engineer 2
**Dependencies**: M2-T001
**Parallel with**: M2-T001, M2-T020, M2-T030
**Estimate**: 6 hours

**Description**:
Extend existing tRPC workflows router to support creating and updating workflows with conditional nodes, branches, and variables.

**Acceptance Criteria**:
- [ ] `workflows.create` accepts conditional nodes in definition
- [ ] `workflows.update` supports updating branches and variables
- [ ] `workflows.validate` endpoint checks conditional logic validity
- [ ] Input validation with Zod schemas for conditional nodes
- [ ] Error handling for invalid branch structures
- [ ] API returns detailed validation errors (which node, which branch)

**Testing Requirements**:
- [ ] Unit tests for conditional node validation
- [ ] Integration test: Create workflow with conditional node
- [ ] Integration test: Update conditional branches
- [ ] Test validation errors return 400 with details

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documentation updated

**Deliverables**:
- `src/server/api/routers/workflows.ts` (enhanced)
- `src/server/api/schemas/conditional.schemas.ts` (Zod schemas)
- `tests/integration/api/workflows/conditional-crud.test.ts`
- `docs/api/workflows.md` (updated)

---

#### M2-T011: Create variables API endpoints
**Owner**: Backend Engineer 2
**Dependencies**: M2-T002, M2-T010
**Parallel with**: M2-T012, M2-T021, M2-T031
**Estimate**: 8 hours

**Description**:
Create tRPC endpoints for managing workflow variables: create, update, delete, list, get.

**Acceptance Criteria**:
- [ ] `variables.create` endpoint creates variable for workflow
- [ ] `variables.update` endpoint updates variable definition
- [ ] `variables.delete` endpoint removes variable
- [ ] `variables.list` endpoint lists all variables for workflow
- [ ] `variables.get` endpoint retrieves single variable
- [ ] Validation for variable types and default values
- [ ] Can set runtime values vs. definition values

**Testing Requirements**:
- [ ] Unit tests for each endpoint
- [ ] Integration tests with Supabase
- [ ] Test type validation (string/number/boolean/object/array)
- [ ] Test default value validation

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documentation complete

**Deliverables**:
- `src/server/api/routers/variables.ts`
- `src/server/api/schemas/variable.schemas.ts`
- `tests/integration/api/variables/endpoints.test.ts`
- `docs/api/variables.md`

---

#### M2-T012: Extend execution API for conditional tracking
**Owner**: Backend Engineer 2
**Dependencies**: M2-T010
**Parallel with**: M2-T011, M2-T021, M2-T031
**Estimate**: 6 hours

**Description**:
Enhance execution API to track which branches were taken during conditional node execution.

**Acceptance Criteria**:
- [ ] Execution history includes branch decisions (true/false)
- [ ] Can query which path was taken for each conditional
- [ ] Stores condition evaluation results (variable values at decision time)
- [ ] `execution.getHistory` returns branch visualization data
- [ ] Real-time status updates include branch path

**Testing Requirements**:
- [ ] Unit tests for branch tracking
- [ ] Integration test: Execute workflow with conditional, verify branch tracked
- [ ] Test history includes condition evaluation results
- [ ] Test can reconstruct execution path from history

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documentation complete

**Deliverables**:
- `src/server/api/routers/execution.ts` (enhanced)
- `src/lib/execution/branch-tracker.ts`
- `tests/integration/api/execution/branch-tracking.test.ts`
- `docs/api/execution.md` (updated)

---

### Pattern Compiler Tasks

#### M2-T020: Build conditional pattern compiler
**Owner**: Backend Engineer 1
**Dependencies**: M1-T021 (code generator)
**Parallel with**: M2-T001, M2-T010, M2-T030
**Estimate**: 12 hours

**Description**:
Create new compiler pattern for generating if/else conditional code from conditional nodes. Build on M1's activity proxy pattern.

**Acceptance Criteria**:
- [ ] Compiles conditional node to TypeScript if/else statement
- [ ] Supports 2-way branches (if/else) and N-way branches (if/else if/else)
- [ ] Generates condition evaluation code (variable comparisons)
- [ ] Handles nested conditionals (conditional inside conditional)
- [ ] Produces TypeScript that passes `tsc --noEmit`
- [ ] Generated code follows Temporal best practices (no side effects in conditions)
- [ ] Condition expressions support: ==, !=, >, <, >=, <=, &&, ||

**Testing Requirements**:
- [ ] Unit test: Compile simple if/else (2 branches)
- [ ] Unit test: Compile if/else if/else (3+ branches)
- [ ] Unit test: Compile nested conditionals
- [ ] Test generated code compiles with TypeScript
- [ ] Test condition expressions are valid JavaScript

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Compiler generates production-ready code

**Deliverables**:
- `src/lib/workflow-compiler/patterns/conditional-pattern.ts`
- `src/lib/workflow-compiler/expression-compiler.ts`
- `tests/unit/compiler/conditional-pattern.test.ts`
- `tests/unit/compiler/expression-compiler.test.ts`

---

#### M2-T021: Implement variable management in compiler
**Owner**: Backend Engineer 1
**Dependencies**: M2-T020
**Parallel with**: M2-T011, M2-T031, M2-T041
**Estimate**: 12 hours

**Description**:
Extend code generator to produce variable declaration and state management code in generated workflows.

**Acceptance Criteria**:
- [ ] Generates workflow variable declarations at top of workflow function
- [ ] Variables scoped correctly (workflow-level vs. activity-level)
- [ ] Generates code to read variable values from workflow context
- [ ] Generates code to update variable values (setState pattern)
- [ ] Supports all variable types (string, number, boolean, object, array)
- [ ] Variable access is type-safe (TypeScript types generated)
- [ ] Generated code includes helpful comments for variable usage

**Testing Requirements**:
- [ ] Unit test: Generate workflow with 1 variable (each type)
- [ ] Unit test: Generate workflow with 5 variables
- [ ] Unit test: Variable used in condition expression
- [ ] Unit test: Variable updated in activity
- [ ] Integration test: Generated code compiles and executes

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Generated code is production-ready

**Deliverables**:
- `src/lib/workflow-compiler/generators/variable-generator.ts`
- `src/lib/workflow-compiler/state-management.ts`
- `tests/unit/compiler/variable-generation.test.ts`
- `tests/integration/compiler/conditional-execution.test.ts`

---

#### M2-T022: Implement basic retry pattern compiler
**Owner**: Backend Engineer 1
**Dependencies**: M2-T021
**Parallel with**: M2-T032, M2-T042
**Estimate**: 10 hours

**Description**:
Create compiler pattern for basic retry logic (exponential backoff, max attempts) on activity nodes.

**Acceptance Criteria**:
- [ ] Generates Temporal retry policy in `proxyActivities` call
- [ ] Supports configuration: maxAttempts, initialInterval, backoffCoefficient, maximumInterval
- [ ] Default retry policy: maxAttempts=3, initialInterval=1s, backoffCoefficient=2, maximumInterval=60s
- [ ] Generates code with inline comments explaining retry behavior
- [ ] Retry configuration stored in node metadata
- [ ] Can disable retry per activity (maxAttempts=1)

**Testing Requirements**:
- [ ] Unit test: Generate activity with retry policy
- [ ] Unit test: Generate activity with disabled retry
- [ ] Integration test: Execute activity with retry, force failure, verify retry occurs
- [ ] Integration test: Verify exponential backoff timing
- [ ] Test generated code follows Temporal retry best practices

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Generated retry code is production-ready

**Deliverables**:
- `src/lib/workflow-compiler/patterns/retry-pattern.ts`
- `tests/unit/compiler/retry-pattern.test.ts`
- `tests/integration/compiler/retry-execution.test.ts`
- `docs/architecture/retry-patterns.md`

---

### DevOps Foundation Tasks

#### M2-T030: Enhance monitoring for conditional workflows
**Owner**: DevOps Engineer
**Dependencies**: M2-T012
**Parallel with**: M2-T001, M2-T010, M2-T020
**Estimate**: 6 hours

**Description**:
Enhance Temporal monitoring and logging to track conditional branch execution and variable state changes.

**Acceptance Criteria**:
- [ ] Temporal Web UI shows which branch was taken for each conditional
- [ ] Logs include variable values at each decision point
- [ ] Can filter executions by branch taken (all true path, all false path, mixed)
- [ ] Dashboards show conditional branch statistics (% true vs. false)
- [ ] Alerting on unexpected branch patterns (e.g., always taking same path)

**Testing Requirements**:
- [ ] Test: Execute workflow with conditional, verify branch shown in UI
- [ ] Test: Variable changes logged correctly
- [ ] Test: Dashboard shows branch statistics
- [ ] Test: Alerts fire on anomalies

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Monitoring dashboards deployed
- [ ] Documentation updated

**Deliverables**:
- `docker/temporal/conditional-monitoring.yaml` (custom metrics)
- `monitoring/dashboards/conditional-workflows.json` (Grafana dashboard)
- `docs/monitoring/conditional-workflows.md`

---

#### M2-T031: Set up staging environment for Milestone 2
**Owner**: DevOps Engineer
**Dependencies**: M2-T030
**Parallel with**: M2-T011, M2-T021, M2-T041
**Estimate**: 4 hours

**Description**:
Deploy staging environment with M2 features enabled, configure for conditional workflow testing.

**Acceptance Criteria**:
- [ ] Staging environment deployed with M2 code
- [ ] Database migrations applied successfully
- [ ] Temporal workers running with M2 patterns
- [ ] Environment variables configured for M2 features
- [ ] Can create and execute conditional workflows in staging
- [ ] Monitoring dashboards accessible

**Testing Requirements**:
- [ ] Test: Deploy sample conditional workflow to staging
- [ ] Test: Execute workflow successfully
- [ ] Test: Monitoring shows branch execution
- [ ] Test: No errors in logs

**Completion Requirements**:
- [ ] Staging environment stable
- [ ] All M2 features working
- [ ] Documentation updated

**Deliverables**:
- Staging environment URL
- `docs/deployment/staging-m2.md`
- Environment configuration files

---

### Frontend Foundation Tasks

#### M2-T040: Design and implement ConditionalNode component
**Owner**: Frontend Engineer 1
**Dependencies**: M1-T040 (canvas component)
**Parallel with**: M2-T001, M2-T010, M2-T020, M2-T030
**Estimate**: 16 hours

**Description**:
Create new ReactFlow custom node component for conditional logic (if/else) with visual branch indicators.

**Acceptance Criteria**:
- [ ] Conditional node displays diamond shape (standard flowchart symbol)
- [ ] Node shows condition expression in center
- [ ] Node has 2 output handles: "true" (green) and "false" (red)
- [ ] Handles are labeled and color-coded
- [ ] Can connect true/false handles to different target nodes
- [ ] Node is resizable if condition text is long
- [ ] Hover shows full condition expression (tooltip)
- [ ] Selected state highlights active branch during execution replay
- [ ] Validation prevents connecting same handle to multiple targets (for binary if/else)

**Testing Requirements**:
- [ ] Unit tests for component rendering
- [ ] E2E test: Drag conditional node to canvas
- [ ] E2E test: Connect true branch to one node, false to another
- [ ] E2E test: Validation prevents invalid connections
- [ ] Visual regression test: Conditional node appearance

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/nodes/ConditionalNode.tsx`
- `src/components/workflow/nodes/ConditionalNode.module.css`
- `tests/e2e/workflow-canvas/conditional-node.spec.ts`
- `tests/unit/workflow/conditional-node.test.tsx`

---

#### M2-T041: Implement visual path connections (branch edges)
**Owner**: Frontend Engineer 1
**Dependencies**: M2-T040
**Parallel with**: M2-T021, M2-T031, M2-T051
**Estimate**: 10 hours

**Description**:
Enhance ReactFlow edges to visually distinguish true/false branch paths with colors and labels.

**Acceptance Criteria**:
- [ ] True branch edges render in green with "✓" label
- [ ] False branch edges render in red with "✗" label
- [ ] Edges have smooth bezier curves (not straight lines)
- [ ] Edge labels are always visible and positioned clearly
- [ ] Can click edge to select and view branch metadata
- [ ] During execution replay, active branch edge is highlighted
- [ ] Edges have hover state with tooltip (shows condition result)
- [ ] Validation prevents cycles in conditional branches

**Testing Requirements**:
- [ ] Unit tests for edge rendering
- [ ] E2E test: Create conditional with 2 branches, verify colors/labels
- [ ] E2E test: Execution replay highlights correct branch
- [ ] E2E test: Cycle validation prevents invalid graphs
- [ ] Visual regression test: Branch edge appearance

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/edges/ConditionalEdge.tsx`
- `src/lib/workflow-validation/cycle-detection.ts`
- `tests/e2e/workflow-canvas/conditional-edges.spec.ts`
- `tests/unit/workflow/edge-rendering.test.tsx`

---

#### M2-T042: Create VariablesPanel component
**Owner**: Frontend Engineer 1
**Dependencies**: M2-T040
**Parallel with**: M2-T022, M2-T052
**Estimate**: 12 hours

**Description**:
Create new side panel component for declaring and managing workflow-level variables.

**Acceptance Criteria**:
- [ ] Panel displays list of all workflow variables
- [ ] Can add new variable (name, type, default value, description)
- [ ] Can edit existing variable
- [ ] Can delete variable (with confirmation if used in conditions)
- [ ] Type selection dropdown (string, number, boolean, object, array)
- [ ] Default value input validates against type
- [ ] Shows where variable is used in workflow (references)
- [ ] Panel has search/filter functionality
- [ ] Changes auto-save (debounced)
- [ ] Panel is collapsible/expandable

**Testing Requirements**:
- [ ] Unit tests for variable CRUD operations
- [ ] E2E test: Add variable with each type
- [ ] E2E test: Edit variable, verify updates everywhere
- [ ] E2E test: Delete variable, verify confirmation if used
- [ ] E2E test: Search/filter variables

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/VariablesPanel.tsx`
- `src/components/workflow/forms/VariableForm.tsx`
- `tests/e2e/workflow-canvas/variables-panel.spec.ts`
- `tests/unit/workflow/variables-panel.test.tsx`

---

## Phase 2: Integration (Weeks 8-9)
**Goal**: Connect frontend and backend for conditional workflows with variables

### Frontend Integration Tasks

#### M2-T050: Enhance PropertyPanel for conditional node configuration
**Owner**: Frontend Engineer 1
**Dependencies**: M2-T042, M2-T040
**Parallel with**: M2-T051, M2-T061
**Estimate**: 12 hours

**Description**:
Extend PropertyPanel component to configure conditional nodes: condition expression, branch logic, variable references.

**Acceptance Criteria**:
- [ ] Panel shows when conditional node is selected
- [ ] Condition expression editor (text input with validation)
- [ ] Variable selector dropdown (inserts variable reference)
- [ ] Operator selector (==, !=, >, <, >=, <=, &&, ||)
- [ ] Expression preview shows evaluated result (with sample data)
- [ ] Syntax highlighting for expression editor
- [ ] Real-time validation with error messages
- [ ] Autocomplete for variable names
- [ ] Can test expression with custom variable values

**Testing Requirements**:
- [ ] Unit tests for expression validation
- [ ] E2E test: Configure conditional with simple expression (var == value)
- [ ] E2E test: Configure conditional with complex expression (var1 > 5 && var2 == "test")
- [ ] E2E test: Validation shows error for invalid syntax
- [ ] E2E test: Autocomplete suggests variables

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/PropertyPanel.tsx` (enhanced)
- `src/components/workflow/forms/ConditionalConfigForm.tsx`
- `src/lib/expression-validator.ts`
- `tests/e2e/workflow-canvas/conditional-config.spec.ts`

---

#### M2-T051: Implement retry configuration UI
**Owner**: Frontend Engineer 1
**Dependencies**: M2-T042
**Parallel with**: M2-T050, M2-T061
**Estimate**: 10 hours

**Description**:
Add retry policy configuration to PropertyPanel for activity nodes: max attempts, backoff strategy, intervals.

**Acceptance Criteria**:
- [ ] Retry policy section in activity property panel
- [ ] Max attempts slider (1-10, default 3)
- [ ] Initial interval input (seconds, default 1s)
- [ ] Backoff coefficient slider (1-5, default 2)
- [ ] Maximum interval input (seconds, default 60s)
- [ ] Visual preview of retry timing (timeline visualization)
- [ ] Preset buttons: "No Retry", "Fast Retry", "Slow Retry", "Custom"
- [ ] Inline help text explaining each setting
- [ ] Changes auto-save

**Testing Requirements**:
- [ ] Unit tests for retry configuration form
- [ ] E2E test: Configure retry with each preset
- [ ] E2E test: Configure custom retry policy
- [ ] E2E test: Disable retry (max attempts = 1)
- [ ] E2E test: Preview shows correct retry timeline

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/forms/RetryConfigForm.tsx`
- `src/components/workflow/RetryTimelinePreview.tsx`
- `tests/e2e/workflow-canvas/retry-config.spec.ts`
- `tests/unit/workflow/retry-config-form.test.tsx`

---

### Backend Integration Tasks

#### M2-T060: Implement state management service
**Owner**: Backend Engineer 2
**Dependencies**: M2-T021, M2-T011
**Parallel with**: M2-T050, M2-T061
**Estimate**: 12 hours

**Description**:
Create service layer for managing workflow state (variables) during execution, integrating with Temporal's state management.

**Acceptance Criteria**:
- [ ] Service can initialize workflow variables with default values
- [ ] Service can read variable values at any point in workflow
- [ ] Service can update variable values (immutable updates)
- [ ] Service tracks variable history (state changes over time)
- [ ] Integrates with Temporal's workflow.getInfo() for state queries
- [ ] Can serialize/deserialize complex objects (JSON)
- [ ] Type-safe variable access (TypeScript generics)

**Testing Requirements**:
- [ ] Unit tests for state service CRUD operations
- [ ] Integration test: Initialize variables, update, read
- [ ] Integration test: State persists across workflow restarts
- [ ] Integration test: Complex object serialization works
- [ ] Test type safety (TypeScript compilation)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Service is production-ready

**Deliverables**:
- `src/lib/execution/state-management.ts`
- `src/lib/execution/variable-serializer.ts`
- `tests/integration/execution/state-management.test.ts`
- `docs/architecture/state-management.md`

---

#### M2-T061: Build conditional execution engine
**Owner**: Backend Engineer 1
**Dependencies**: M2-T060, M2-T020
**Parallel with**: M2-T050, M2-T051, M2-T062
**Estimate**: 16 hours

**Description**:
Create execution engine that evaluates conditional expressions and routes workflow execution to correct branch.

**Acceptance Criteria**:
- [ ] Engine evaluates condition expressions using variable values
- [ ] Supports all operators: ==, !=, >, <, >=, <=, &&, ||, !
- [ ] Handles type coercion safely (strict equality checks)
- [ ] Logs branch decision with variable values (for debugging)
- [ ] Tracks which branch was taken in execution history
- [ ] Handles errors in condition evaluation (defaults to false branch)
- [ ] Performance: evaluates conditions in <10ms
- [ ] Security: sanitizes expressions (no arbitrary code execution)

**Testing Requirements**:
- [ ] Unit test: Evaluate simple condition (var == value)
- [ ] Unit test: Evaluate complex condition (nested &&/||)
- [ ] Unit test: Handle type coercion (string "5" vs. number 5)
- [ ] Unit test: Handle null/undefined safely
- [ ] Integration test: Execute workflow with conditional, verify correct branch taken
- [ ] Security test: Malicious expression is rejected

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Engine is production-ready and secure

**Deliverables**:
- `src/lib/execution/conditional-engine.ts`
- `src/lib/execution/expression-evaluator.ts`
- `tests/unit/execution/conditional-engine.test.ts`
- `tests/integration/execution/conditional-workflow.test.ts`
- `docs/architecture/conditional-execution.md`

---

#### M2-T062: Implement retry execution logic
**Owner**: Backend Engineer 2
**Dependencies**: M2-T022
**Parallel with**: M2-T061
**Estimate**: 10 hours

**Description**:
Implement runtime retry logic that executes retry policies configured on activity nodes, integrating with Temporal's built-in retry.

**Acceptance Criteria**:
- [ ] Retry policy applied to activities at runtime
- [ ] Exponential backoff implemented correctly
- [ ] Max attempts enforced
- [ ] Retry attempts logged with timestamps
- [ ] Can customize retry policy per activity
- [ ] Non-retryable errors bypass retry (e.g., validation errors)
- [ ] Retry state tracked in execution history
- [ ] Can cancel retries mid-execution

**Testing Requirements**:
- [ ] Integration test: Activity fails, retries 3 times, succeeds on 3rd
- [ ] Integration test: Activity fails, retries 3 times, fails permanently
- [ ] Integration test: Non-retryable error bypasses retry
- [ ] Integration test: Exponential backoff timing is correct (1s, 2s, 4s)
- [ ] Integration test: Can cancel workflow mid-retry

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Retry logic is production-ready

**Deliverables**:
- `src/lib/execution/retry-executor.ts`
- `src/lib/execution/error-classifier.ts` (retryable vs. non-retryable)
- `tests/integration/execution/retry-execution.test.ts`
- `docs/architecture/retry-execution.md`

---

### Deployment Integration Tasks

#### M2-T070: Enhance deployment pipeline for conditionals
**Owner**: Backend Engineer 1
**Dependencies**: M2-T061, M2-T051
**Parallel with**: M2-T071
**Estimate**: 10 hours

**Description**:
Extend deployment pipeline to validate conditional workflows, compile variables, and register with worker.

**Acceptance Criteria**:
- [ ] Validates conditional node expressions before deployment
- [ ] Validates branch structures (no cycles, all branches covered)
- [ ] Compiles variables into workflow TypeScript code
- [ ] Validates variable types and default values
- [ ] Deployment fails gracefully with detailed validation errors
- [ ] Can deploy workflow with nested conditionals (3+ levels)
- [ ] Rollback works if deployment fails

**Testing Requirements**:
- [ ] Integration test: Deploy valid conditional workflow succeeds
- [ ] Integration test: Deploy invalid workflow (cycle) fails with error
- [ ] Integration test: Deploy workflow with variables succeeds
- [ ] Integration test: Rollback on failure cleans up artifacts
- [ ] Test nested conditionals (3 levels deep)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Deployment is production-ready

**Deliverables**:
- `src/lib/workflow-compiler/deployment.ts` (enhanced)
- `src/lib/workflow-compiler/conditional-validator.ts`
- `tests/integration/deployment/conditional-workflows.test.ts`
- `docs/architecture/conditional-deployment.md`

---

#### M2-T071: Enhance execution monitoring for conditionals
**Owner**: Frontend Engineer 1
**Dependencies**: M2-T061, M2-T012
**Parallel with**: M2-T070
**Estimate**: 14 hours

**Description**:
Enhance execution monitoring UI to visualize conditional branch paths, show which branches were taken, and display variable values.

**Acceptance Criteria**:
- [ ] Execution panel highlights which branch was taken (green for true, red for false)
- [ ] Displays condition evaluation result (variable values at decision time)
- [ ] Shows variable state changes over time (timeline view)
- [ ] Can replay execution and see branch decisions in sequence
- [ ] Hovering over conditional node shows condition and result
- [ ] Execution history shows branch path (e.g., "true → false → true")
- [ ] Can filter executions by branch path taken
- [ ] Shows retry attempts with timestamps and error messages

**Testing Requirements**:
- [ ] E2E test: Execute conditional workflow, verify branch highlighted
- [ ] E2E test: View execution history, see condition results
- [ ] E2E test: Replay execution, see branch decisions in order
- [ ] E2E test: Variable timeline shows state changes
- [ ] E2E test: Retry attempts displayed correctly

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is production-ready

**Deliverables**:
- `src/components/workflow-execution/ConditionalExecutionView.tsx`
- `src/components/workflow-execution/VariableTimeline.tsx`
- `src/components/workflow-execution/RetryAttemptsList.tsx`
- `tests/e2e/execution/conditional-monitoring.spec.ts`

---

## Phase 3: Testing & Polish (Week 10)
**Goal**: Comprehensive testing, bug fixes, polish UI/UX

### Integration Testing Tasks

#### M2-T080: End-to-end conditional workflow test suite
**Owner**: QA Engineer
**Dependencies**: M2-T071, M2-T070
**Parallel with**: M2-T081, M2-T082
**Estimate**: 12 hours

**Description**:
Create comprehensive E2E test suite covering conditional workflow creation, deployment, and execution.

**Acceptance Criteria**:
- [ ] Test: Create conditional workflow (if/else), deploy, execute, verify correct branch taken
- [ ] Test: Create workflow with variables, execute, verify state changes
- [ ] Test: Create workflow with retry, force failure, verify retries occur
- [ ] Test: Create workflow with nested conditionals (2 levels), execute successfully
- [ ] Test: Create workflow with complex condition (&&/||), execute, verify logic
- [ ] Test: Attempt to deploy invalid conditional (cycle), verify error
- [ ] Test: View execution monitoring, verify branch path displayed
- [ ] All tests pass consistently (no flakiness)

**Testing Requirements**:
- [ ] Tests use Playwright with page object pattern
- [ ] Tests clean up after themselves (delete test workflows)
- [ ] Tests are isolated (can run in parallel)
- [ ] Tests have proper waits (no arbitrary sleeps)
- [ ] Tests verify both UI and backend state

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing in CI
- [ ] Test coverage report shows >80%

**Deliverables**:
- `tests/e2e/workflows/conditional-workflows.spec.ts`
- `tests/e2e/workflows/variable-workflows.spec.ts`
- `tests/e2e/workflows/retry-workflows.spec.ts`
- `tests/e2e/workflows/page-objects/ConditionalBuilder.ts`

---

#### M2-T081: Integration test suite for conditional engine
**Owner**: Backend Engineer 1
**Dependencies**: M2-T061, M2-T062
**Parallel with**: M2-T080, M2-T082
**Estimate**: 10 hours

**Description**:
Create integration tests that verify conditional engine and retry logic work correctly in Temporal.

**Acceptance Criteria**:
- [ ] Test: Execute workflow with conditional, verify correct branch taken based on variable
- [ ] Test: Execute workflow with nested conditionals, verify all branches evaluated correctly
- [ ] Test: Execute workflow with retry, force failure, verify exponential backoff timing
- [ ] Test: Execute workflow with non-retryable error, verify no retry occurs
- [ ] Test: Execute 5 different conditional workflows simultaneously
- [ ] Test: Variable state persists across workflow restarts

**Testing Requirements**:
- [ ] Tests use real Temporal instance (from docker-compose)
- [ ] Tests have proper cleanup (unregister workflows)
- [ ] Tests verify actual Temporal execution (not mocked)
- [ ] Tests measure retry timing accuracy

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Tests run in CI environment

**Deliverables**:
- `tests/integration/execution/conditional-execution.test.ts`
- `tests/integration/execution/retry-execution.test.ts`
- `tests/integration/execution/variable-state.test.ts`
- `tests/integration/execution/fixtures/` (test workflows)

---

#### M2-T082: Performance testing for conditional workflows
**Owner**: QA Engineer
**Dependencies**: M2-T080, M2-T081
**Parallel with**: M2-T083
**Estimate**: 8 hours

**Description**:
Create performance tests to verify conditional workflows meet performance requirements.

**Acceptance Criteria**:
- [ ] Test: Create 10 conditional workflows simultaneously (via API)
- [ ] Test: Deploy 10 conditional workflows simultaneously
- [ ] Test: Execute 20 conditional workflows simultaneously
- [ ] Test: Workflow with 10 conditionals executes in <30 seconds
- [ ] Test: Condition evaluation time <10ms per condition
- [ ] All operations complete within acceptable time (90th percentile <5s)
- [ ] No memory leaks during extended test run (30 minutes)

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
- `tests/performance/conditional-workflows.k6.js`
- `tests/performance/variable-operations.k6.js`
- `tests/performance/retry-scenarios.k6.js`
- `docs/testing/performance-benchmarks-m2.md`

---

### Polish Tasks

#### M2-T083: UI/UX polish for conditional workflows
**Owner**: Frontend Engineer 1
**Dependencies**: M2-T071
**Parallel with**: M2-T082, M2-T084
**Estimate**: 14 hours

**Description**:
Polish UI/UX for conditional nodes, variables panel, and execution monitoring based on internal testing feedback.

**Acceptance Criteria**:
- [ ] Conditional node diamond shape is clear and distinctive
- [ ] Branch edge colors (green/red) are colorblind-accessible
- [ ] Variables panel has smooth animations (add/edit/delete)
- [ ] Expression editor has syntax highlighting
- [ ] Autocomplete for variables is fast and accurate
- [ ] Execution replay animation is smooth (60fps)
- [ ] All interactive elements have focus states
- [ ] Keyboard navigation works (tab through all controls)
- [ ] ARIA labels on all conditional-specific elements
- [ ] Loading states consistent across all new components
- [ ] Error states have clear messaging and recovery actions
- [ ] No console errors or warnings

**Testing Requirements**:
- [ ] Accessibility audit with axe-core (0 violations)
- [ ] Manual keyboard navigation test
- [ ] Test on Chrome, Firefox, Safari
- [ ] Visual regression tests for new components
- [ ] Colorblind simulation testing

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Accessibility audit passes
- [ ] Cross-browser testing passes
- [ ] Design review approved

**Deliverables**:
- UI components updated with polish
- `tests/e2e/accessibility/conditional-workflows.spec.ts`
- `docs/accessibility/wcag-compliance-m2.md`

---

#### M2-T084: Error handling and validation improvements
**Owner**: Backend Engineer 2 + Frontend Engineer 1
**Dependencies**: M2-T080, M2-T081
**Parallel with**: M2-T083
**Estimate**: 12 hours

**Description**:
Improve error messages, validation feedback, and error recovery flows for conditional workflows.

**Acceptance Criteria**:
- [ ] Condition expression errors show specific syntax issue (not generic)
- [ ] Variable type mismatch errors show expected vs. actual type
- [ ] Cycle detection shows which nodes form the cycle
- [ ] Branch validation shows which branches are missing targets
- [ ] Retry errors show attempt number and next retry time
- [ ] Deployment errors highlight problematic nodes in canvas
- [ ] All errors logged to monitoring system
- [ ] User-friendly error messages (no stack traces in UI)
- [ ] Suggested fixes provided for common errors

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
- `src/lib/errors/conditional-errors.ts` (error classes)
- `src/lib/validation/conditional-validator.ts` (enhanced)
- `src/components/workflow/ErrorBoundary.tsx` (enhanced)
- `docs/troubleshooting/conditional-errors.md`

---

## Phase 4: Demo Preparation (Week 11)
**Goal**: Prepare demo, documentation, and training materials

### Demo Preparation Tasks

#### M2-T090: Create demo workflow examples for Milestone 2
**Owner**: Backend Engineer 2 + QA Engineer
**Dependencies**: M2-T083, M2-T084
**Parallel with**: M2-T091, M2-T092
**Estimate**: 10 hours

**Description**:
Create 3-5 example workflows that showcase Milestone 2 capabilities for Week 12 demo.

**Acceptance Criteria**:
- [ ] Example 1: Approval workflow (simple if/else with variables)
- [ ] Example 2: Validation pipeline (nested conditionals with retry)
- [ ] Example 3: Smart routing (multi-branch conditional with state management)
- [ ] Each example has descriptive name and documentation
- [ ] Examples can be imported via seed script
- [ ] Examples demonstrate different configuration options
- [ ] Examples execute successfully with realistic mock data
- [ ] Examples cover all M2 features (conditionals, variables, retry)

**Testing Requirements**:
- [ ] Test: Import all examples successfully
- [ ] Test: Execute all examples end-to-end
- [ ] Test: Examples show variety of M2 features
- [ ] Test: Documentation is clear and accurate

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Examples tested and working
- [ ] Documentation complete

**Deliverables**:
- `examples/milestone-2/approval-workflow.json`
- `examples/milestone-2/validation-pipeline.json`
- `examples/milestone-2/smart-routing.json`
- `scripts/seed-demo-workflows-m2.ts`
- `docs/examples/milestone-2-demos.md`

---

#### M2-T091: Write user documentation for Milestone 2
**Owner**: Frontend Engineer 1 + Backend Engineer 1
**Dependencies**: M2-T083, M2-T084
**Parallel with**: M2-T090, M2-T092
**Estimate**: 14 hours

**Description**:
Create comprehensive user documentation for conditional workflows, variables, and retry configuration.

**Acceptance Criteria**:
- [ ] Guide: Creating conditional workflows (step-by-step with screenshots)
- [ ] Guide: Using variables in workflows (declaring, referencing, updating)
- [ ] Guide: Configuring retry policies (when to use, best practices)
- [ ] Guide: Understanding execution monitoring for conditionals
- [ ] Guide: Troubleshooting conditional workflows (common issues)
- [ ] Video walkthrough (7-10 minutes) demonstrating all M2 features
- [ ] All documentation has screenshots and code examples
- [ ] Documentation versioned (for Milestone 2)
- [ ] Interactive tutorial (optional but nice to have)

**Testing Requirements**:
- [ ] Have non-team member follow guide and provide feedback
- [ ] Test all code examples execute correctly
- [ ] Verify all links work
- [ ] Test video quality and audio

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Feedback incorporated

**Deliverables**:
- `docs/user-guide/conditional-workflows.md`
- `docs/user-guide/workflow-variables.md`
- `docs/user-guide/retry-policies.md`
- `docs/user-guide/conditional-monitoring.md`
- `docs/user-guide/troubleshooting-conditionals.md`
- `docs/user-guide/video-walkthrough-m2.mp4`

---

#### M2-T092: Create developer/API documentation for Milestone 2
**Owner**: Backend Engineer 1 + Backend Engineer 2
**Dependencies**: M2-T084
**Parallel with**: M2-T090, M2-T091
**Estimate**: 10 hours

**Description**:
Create developer documentation for conditional patterns, variable API, and retry configuration API.

**Acceptance Criteria**:
- [ ] API reference for variables endpoints (OpenAPI/Swagger-style)
- [ ] Conditional pattern architecture document (how compilation works)
- [ ] State management guide (how variables work internally)
- [ ] Retry pattern documentation (how retry logic works)
- [ ] Expression language reference (operators, syntax, examples)
- [ ] Code examples for programmatic workflow creation with conditionals
- [ ] All API endpoints have curl examples
- [ ] Migration guide from M1 to M2

**Testing Requirements**:
- [ ] Test all code examples execute correctly
- [ ] Test all curl examples work
- [ ] Verify API documentation matches implementation

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Documentation versioned

**Deliverables**:
- `docs/api/variables-reference.md`
- `docs/architecture/conditional-patterns.md`
- `docs/architecture/state-management.md`
- `docs/architecture/retry-patterns.md`
- `docs/reference/expression-language.md`
- `docs/migration/m1-to-m2.md`

---

#### M2-T093: Prepare demo script and environment for Milestone 2
**Owner**: QA Engineer + DevOps Engineer
**Dependencies**: M2-T090, M2-T091
**Parallel with**: None (final task)
**Estimate**: 8 hours

**Description**:
Prepare stable demo environment and rehearse demo script for Week 12 stakeholder presentation.

**Acceptance Criteria**:
- [ ] Demo environment deployed with M2 features
- [ ] Demo environment pre-seeded with example workflows
- [ ] Demo script written (covers 6-point M2 demo)
- [ ] Demo rehearsed with timing (20 minutes total)
- [ ] Backup plan if live demo fails (recording)
- [ ] Q&A talking points prepared
- [ ] Success metrics prepared (what we achieved in M2)
- [ ] Comparison with M1 (what's new)

**Testing Requirements**:
- [ ] Run demo script 3+ times successfully
- [ ] Test demo environment is stable (no crashes)
- [ ] Have backup recording ready
- [ ] Test Q&A scenarios

**Completion Requirements**:
- [ ] Demo environment stable
- [ ] Team rehearsed and confident
- [ ] Backup materials ready

**Deliverables**:
- `docs/demo/milestone-2-script.md`
- `docs/demo/talking-points-m2.md`
- `docs/demo/success-metrics-m2.md`
- Demo environment URL
- Backup demo recording

---

## Phase 5: Buffer & Final Polish (Week 12)
**Goal**: Address issues found in Week 11, final polish, prepare for demo

### Buffer Tasks

#### M2-T100: Bug fixes and issue resolution
**Owner**: All engineers
**Dependencies**: M2-T093
**Parallel with**: M2-T101
**Estimate**: 40 hours (distributed across team)

**Description**:
Address all bugs and issues found during Week 11 testing and rehearsals. This is a buffer task for unexpected issues.

**Acceptance Criteria**:
- [ ] All critical bugs fixed (P0)
- [ ] All high-priority bugs fixed (P1)
- [ ] Medium-priority bugs triaged (fix or defer to M3)
- [ ] No known blockers for demo
- [ ] Regression testing passed
- [ ] Performance still meets benchmarks

**Testing Requirements**:
- [ ] All existing tests still pass
- [ ] New tests added for bug fixes
- [ ] Manual testing of demo flows
- [ ] Performance regression testing

**Completion Requirements**:
- [ ] All critical and high-priority issues resolved
- [ ] Release candidate created
- [ ] Final testing completed

**Deliverables**:
- Bug fixes committed to feature branch
- Updated test suites
- Release notes

---

#### M2-T101: Final demo preparation and rehearsal
**Owner**: All team members
**Dependencies**: M2-T093, M2-T100
**Parallel with**: None (final task before demo)
**Estimate**: 8 hours (team activity)

**Description**:
Final team rehearsal, polish demo environment, prepare presentation materials.

**Acceptance Criteria**:
- [ ] Demo runs smoothly start to finish
- [ ] All team members can present sections
- [ ] Presentation slides prepared (if needed)
- [ ] Success metrics compiled (workflows created, features added)
- [ ] Stakeholder invite sent
- [ ] Demo environment tested 1 hour before presentation
- [ ] Backup recording tested

**Testing Requirements**:
- [ ] Full demo run-through with timing
- [ ] Fallback plan tested (recording)
- [ ] All demo workflows execute successfully
- [ ] Q&A preparation

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
Week 7 (Foundation - All Parallel):
├─ M2-T001 (Database Schema)
│  └─ M2-T002 (Variables Table)
├─ M2-T010 (tRPC Conditionals)
│  ├─ M2-T011 (Variables API)
│  └─ M2-T012 (Execution Tracking)
├─ M2-T020 (Conditional Pattern)
│  ├─ M2-T021 (Variable Management)
│  └─ M2-T022 (Retry Pattern)
├─ M2-T030 (Monitoring)
│  └─ M2-T031 (Staging)
└─ M2-T040 (Conditional Node)
   ├─ M2-T041 (Branch Edges)
   └─ M2-T042 (Variables Panel)

Week 8 (Backend Integration):
├─ M2-T060 (State Management) [depends: T021, T011]
└─ M2-T061 (Conditional Engine) [depends: T060, T020]
   └─ M2-T062 (Retry Executor) [depends: T022]

Week 9 (Frontend Integration):
├─ M2-T050 (PropertyPanel Conditionals) [depends: T042, T040]
├─ M2-T051 (Retry Config UI) [depends: T042]
├─ M2-T070 (Deployment Pipeline) [depends: T061, T051]
└─ M2-T071 (Execution Monitoring) [depends: T061, T012]

Week 10 (Testing):
├─ M2-T080 (E2E Tests) [depends: T071, T070]
├─ M2-T081 (Integration Tests) [depends: T061, T062]
├─ M2-T082 (Performance Tests) [depends: T080, T081]
├─ M2-T083 (UI Polish) [depends: T071]
└─ M2-T084 (Error Handling) [depends: T080, T081]

Week 11 (Demo Prep):
├─ M2-T090 (Demo Examples) [depends: T083, T084]
├─ M2-T091 (User Docs) [depends: T083, T084]
├─ M2-T092 (Dev Docs) [depends: T084]
└─ M2-T093 (Demo Script) [depends: T090, T091]

Week 12 (Buffer):
├─ M2-T100 (Bug Fixes) [depends: T093]
└─ M2-T101 (Final Rehearsal) [depends: T093, T100]
```

### Critical Path (72 hours = ~2 weeks)

```
M2-T001 (4h)
  → M2-T010 (6h)
    → M2-T020 (12h)
      → M2-T021 (12h)
        → M2-T040 (16h)
          → M2-T050 (12h)
            → M2-T080 (12h)

Total: 74 hours
```

This is your critical path. Any delays here push the entire milestone. Focus engineering effort here.

---

## Weekly Timeline with Team Assignments

### Week 7: Foundation (All Teams in Parallel)

**Backend Team**:
- BE1: M2-T020 (Conditional Pattern) - 12h
- BE1: M2-T022 (Retry Pattern) - 10h
- BE2: M2-T001 (Database Schema) - 4h
- BE2: M2-T002 (Variables Table) - 3h
- BE2: M2-T010 (tRPC Conditionals) - 6h
- BE2: M2-T011 (Variables API) - 8h
- BE2: M2-T012 (Execution Tracking) - 6h
**Total**: 49 hours (both engineers working full week)

**Frontend Team**:
- FE1: M2-T040 (Conditional Node) - 16h
- FE1: M2-T041 (Branch Edges) - 10h
- FE1: M2-T042 (Variables Panel) - 12h
**Total**: 38 hours

**DevOps Team**:
- DevOps: M2-T030 (Monitoring) - 6h
- DevOps: M2-T031 (Staging) - 4h
- DevOps: Support team - 4h
**Total**: 14 hours (0.5 FTE)

**QA Team**:
- QA: Test planning for M2 - 8h
- QA: Manual testing - 8h
**Total**: 16 hours (0.5 FTE)

**End of Week 7 Deliverables**:
- Database schema supports conditionals and variables
- tRPC API endpoints for variables
- Conditional pattern compiler working
- Conditional node UI component complete
- Variables panel functional
- Staging environment ready

---

### Week 8: Backend Integration

**Backend Team**:
- BE1: M2-T021 (Variable Management) - 12h
- BE1: M2-T061 (Conditional Engine) - 16h
- BE2: M2-T060 (State Management) - 12h
- BE2: M2-T062 (Retry Executor) - 10h
**Total**: 50 hours (both engineers)

**Frontend Team**:
- FE1: M2-T050 (PropertyPanel Conditionals) - 12h
- FE1: M2-T051 (Retry Config UI) - 10h
- FE1: Polish from Week 7 - 8h
**Total**: 30 hours (lighter week waiting for backend)

**DevOps Team**:
- DevOps: Support backend integration - 8h
- DevOps: Monitoring enhancements - 4h
**Total**: 12 hours (0.5 FTE)

**QA Team**:
- QA: Manual testing - 12h
- QA: Test case creation - 8h
**Total**: 20 hours (0.5 FTE)

**End of Week 8 Deliverables**:
- Conditional engine evaluates expressions
- State management tracks variables
- Retry executor implements backoff
- PropertyPanel configures conditionals
- Retry configuration UI complete

---

### Week 9: Full Stack Integration

**Backend Team**:
- BE1: M2-T070 (Deployment Pipeline) - 10h
- BE1: Support frontend integration - 8h
- BE2: Support M2-T071 (data endpoints) - 8h
- BE2: Bug fixes - 8h
**Total**: 34 hours

**Frontend Team**:
- FE1: M2-T071 (Execution Monitoring) - 14h
- FE1: Integration testing - 8h
**Total**: 22 hours

**DevOps Team**:
- DevOps: Deploy to staging - 6h
- DevOps: Monitoring dashboards - 6h
**Total**: 12 hours (0.5 FTE)

**QA Team**:
- QA: Integration testing - 12h
- QA: Manual testing - 8h
**Total**: 20 hours (0.5 FTE)

**End of Week 9 Deliverables**:
- Can deploy conditional workflows
- Can execute conditional workflows
- Can monitor conditional execution with branch paths
- Can configure and see retry attempts
- Staging environment operational

---

### Week 10: Testing & Polish

**Backend Team**:
- BE1: M2-T081 (Integration Tests) - 10h
- BE1: M2-T084 (Error Handling) - 6h
- BE2: M2-T084 (Error Handling) - 6h
- BE2: Bug fixes - 10h
**Total**: 32 hours

**Frontend Team**:
- FE1: M2-T083 (UI Polish) - 14h
- FE1: M2-T084 (Error Handling) - 6h
**Total**: 20 hours

**QA Team**:
- QA: M2-T080 (E2E Tests) - 12h
- QA: M2-T082 (Performance Tests) - 8h
- QA: Manual testing - 8h
**Total**: 28 hours

**DevOps Team**:
- DevOps: Performance tuning - 8h
- DevOps: Demo environment prep - 6h
**Total**: 14 hours (0.5 FTE)

**End of Week 10 Deliverables**:
- Comprehensive test suites passing
- UI polished and accessible
- Error handling improved
- Demo environment ready
- Bug backlog triaged

---

### Week 11: Demo Preparation

**Backend Team**:
- BE1: M2-T092 (Dev Docs) - 10h
- BE1: M2-T091 (User Docs) - 4h
- BE2: M2-T090 (Demo Examples) - 10h
- BE2: Bug fixes - 8h
**Total**: 32 hours

**Frontend Team**:
- FE1: M2-T091 (User Docs) - 10h
- FE1: Record demo video - 6h
- FE1: Bug fixes - 8h
**Total**: 24 hours

**QA Team**:
- QA: M2-T090 (Demo Examples) - 4h
- QA: M2-T093 (Demo Script) - 8h
- QA: Final testing - 12h
**Total**: 24 hours

**DevOps Team**:
- DevOps: M2-T093 (Demo Environment) - 8h
- DevOps: Infrastructure checks - 4h
**Total**: 12 hours (0.5 FTE)

**End of Week 11 Deliverables**:
- Demo workflows created and tested
- User and developer documentation complete
- Demo script rehearsed
- Demo environment stable
- Team ready to demo

---

### Week 12: Buffer & Demo

**All Team**:
- M2-T100 (Bug Fixes) - 20h distributed
- M2-T101 (Final Rehearsal) - 8h team activity
- Buffer for unexpected issues - 12h

**Demo Day** (End of Week 12):
- Present to stakeholders
- Show 6-point demo from roadmap
- Gather feedback for Milestone 3

**End of Week 12 Deliverables**:
- Milestone 2 complete
- Demo successful
- Stakeholder feedback collected
- Go/No-Go decision on Milestone 3

---

## Risk Mitigation

### High-Risk Items

1. **Conditional Engine Complexity** (M2-T061)
   - **Risk**: Expression evaluation may have edge cases, security risks
   - **Mitigation**: Extensive unit tests, security review, use safe eval library
   - **Fallback**: Limit expression complexity (simple comparisons only)

2. **State Management** (M2-T060)
   - **Risk**: Variable state may be lost or corrupted during workflow execution
   - **Mitigation**: Use Temporal's built-in state management, comprehensive integration tests
   - **Fallback**: Store state in external database (Redis)

3. **UI Complexity** (M2-T040, M2-T041)
   - **Risk**: Conditional nodes may be confusing, branch edges hard to visualize
   - **Mitigation**: User testing, iterate on design, provide clear help text
   - **Fallback**: Simplify UI, use standard flowchart symbols

4. **Retry Logic** (M2-T062)
   - **Risk**: Exponential backoff may not work as expected, timing issues
   - **Mitigation**: Integration tests verify timing, use Temporal's built-in retry
   - **Fallback**: Simple fixed-interval retry

### Dependencies on External Systems

- **Temporal**: Critical dependency. Continue using Temporal Cloud as backup.
- **Supabase**: Database. Ensure migrations tested thoroughly.
- **ReactFlow**: Canvas library. Ensure custom nodes are compatible with updates.

### Team Availability Risks

- **Key person dependency**: BE1 is critical for conditional engine. If unavailable, BE2 must be trained.
- **Reduced capacity**: DevOps and QA at 0.5 FTE. Plan accordingly.
- **Buffer**: Week 12 is intentional buffer for unexpected absences.

---

## Success Metrics for Milestone 2

### Quantitative Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Conditional workflows created | 15-25 | Count in database |
| Successful executions | >92% | Execution success rate |
| User adoption | 5-10 users | User accounts with conditional workflows |
| Deployment time | <3 minutes | Average time from "Deploy" click to "Active" |
| Condition evaluation time | <10ms | Performance test average |
| UI response time | <200ms | 95th percentile for canvas operations |
| Test coverage | >80% | Code coverage report |
| Zero critical bugs | 0 P0 bugs | Bug tracker |

### Qualitative Success Criteria

- [ ] **Usable**: User can create conditional workflow in 15 minutes
- [ ] **Reliable**: Demo runs successfully without crashes
- [ ] **Understandable**: Users understand branch logic and variable state
- [ ] **Documented**: User guide enables self-service conditional workflow creation
- [ ] **Production-ready**: Code quality suitable for production deployment

### Demo Success Criteria (Week 12)

Must successfully demonstrate all 6 points from roadmap:
1. [ ] Build approval workflow with 2 branches (if/else)
2. [ ] Set up workflow variables (name, type, default value)
3. [ ] Configure retry policy (max 3, exponential backoff)
4. [ ] Run workflow, see it take different paths based on data (true and false branches)
5. [ ] Show failed activity auto-retrying (3 attempts)
6. [ ] View execution monitoring with branch path highlighted

**If all 6 succeed**: Milestone 2 complete ✓
**If <6 succeed**: Use Week 12 buffer to address issues

---

## Handoff to Milestone 3

### Prerequisites for M3 Start

- [ ] All M2 tasks completed (or deferred with documented reason)
- [ ] Demo successful and stakeholder approval received
- [ ] User feedback collected and documented
- [ ] Known issues triaged (fix in M3 or defer)
- [ ] M2 code merged to main branch
- [ ] M2 documentation published
- [ ] Team retrospective completed

### Lessons Learned Handoff

At end of M2, document:
1. What took longer than expected (adjust M3 estimates)
2. What went smoothly (repeat in M3)
3. Technical debt created (address in M3 if critical)
4. User feedback themes (prioritize in M3)
5. Team velocity (actual vs. estimated hours)

### Milestone 3 Preview

Based on M2 completion, M3 will add:
- AI remediation toggle on activities
- Prompt template editor
- Context configuration
- Decision routing (RETRY/FAIL/ESCALATE)
- Self-healing workflows

Expected start: Week 13 (immediately after M2 completion)

---

## Appendix: Task Summary Table

| Task ID | Task Name | Owner | Estimate | Week | Dependencies |
|---------|-----------|-------|----------|------|--------------|
| M2-T001 | Extend workflow schema for conditionals | BE2 | 4h | 7 | M1 complete |
| M2-T002 | Create workflow_variables table | BE2 | 3h | 7 | T001 |
| M2-T010 | Enhance tRPC for conditionals | BE2 | 6h | 7 | T001 |
| M2-T011 | Create variables API endpoints | BE2 | 8h | 7 | T002, T010 |
| M2-T012 | Extend execution API for tracking | BE2 | 6h | 7 | T010 |
| M2-T020 | Build conditional pattern compiler | BE1 | 12h | 7 | M1-T021 |
| M2-T021 | Variable management in compiler | BE1 | 12h | 8 | T020 |
| M2-T022 | Basic retry pattern compiler | BE1 | 10h | 7 | T021 |
| M2-T030 | Enhance monitoring for conditionals | DevOps | 6h | 7 | T012 |
| M2-T031 | Set up staging for M2 | DevOps | 4h | 7 | T030 |
| M2-T040 | Design ConditionalNode component | FE1 | 16h | 7 | M1-T040 |
| M2-T041 | Visual path connections (edges) | FE1 | 10h | 7 | T040 |
| M2-T042 | Create VariablesPanel component | FE1 | 12h | 7 | T040 |
| M2-T050 | PropertyPanel for conditionals | FE1 | 12h | 8 | T042, T040 |
| M2-T051 | Retry configuration UI | FE1 | 10h | 8 | T042 |
| M2-T060 | State management service | BE2 | 12h | 8 | T021, T011 |
| M2-T061 | Conditional execution engine | BE1 | 16h | 8 | T060, T020 |
| M2-T062 | Retry execution logic | BE2 | 10h | 8 | T022 |
| M2-T070 | Enhance deployment for conditionals | BE1 | 10h | 9 | T061, T051 |
| M2-T071 | Execution monitoring for conditionals | FE1 | 14h | 9 | T061, T012 |
| M2-T080 | E2E conditional workflow tests | QA | 12h | 10 | T071, T070 |
| M2-T081 | Integration tests for engine | BE1 | 10h | 10 | T061, T062 |
| M2-T082 | Performance testing | QA | 8h | 10 | T080, T081 |
| M2-T083 | UI polish for conditionals | FE1 | 14h | 10 | T071 |
| M2-T084 | Error handling improvements | BE2+FE1 | 12h | 10 | T080, T081 |
| M2-T090 | Demo examples for M2 | BE2+QA | 10h | 11 | T083, T084 |
| M2-T091 | User documentation for M2 | FE1+BE1 | 14h | 11 | T083, T084 |
| M2-T092 | Developer documentation for M2 | BE1+BE2 | 10h | 11 | T084 |
| M2-T093 | Demo script and environment | QA+DevOps | 8h | 11 | T090, T091 |
| M2-T100 | Bug fixes | All | 40h | 12 | T093 |
| M2-T101 | Final rehearsal | All | 8h | 12 | T093, T100 |

**Total Estimated Hours**: ~385 hours
**Team Size**: 5 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA)
**Timeline**: 6 weeks
**Capacity**: 200 hours per week (5 people × 40 hours)
**Buffer**: ~38% (Week 12 is mostly buffer)

---

**Created**: 2025-01-19
**Version**: 1.0
**Next Review**: End of Week 9 (mid-milestone check-in)
