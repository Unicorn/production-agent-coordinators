# Milestone 5: Dynamic Orchestration - Detailed Task Breakdown

**Goal**: Complete PackageBuilder migration with dynamic dependency-aware orchestration, child workflow spawning, and Promise.race concurrency patterns within 6 weeks.

**Timeline**: Weeks 25-30
**Target Demo Date**: End of Week 30

---

## Executive Summary

### Critical Path (Longest Dependencies)
```
Dependency Graph Engine (16h)
  → Dynamic Concurrency with Promise.race (20h)
    → Child Workflow Spawning (startChild) (16h)
      → PackageBuilder Integration (24h)
        → Real-time Execution View (16h)
          → E2E PackageBuilder Testing (20h)

Total Critical Path: ~112 hours = ~3 weeks (with buffer)
```

### Team Structure
- **Backend Engineer 1**: Dependency graph engine, Promise.race pattern, child workflow compiler (Critical Path Owner)
- **Backend Engineer 2**: Child workflow registration, state management, execution coordination
- **Frontend Engineer 1**: Dependency graph visualization, real-time execution view
- **DevOps Engineer (0.5 FTE)**: Performance tuning, monitoring, production prep
- **QA Engineer (0.5 FTE)**: PackageBuilder integration testing, performance validation

### Parallelization Strategy
- **Week 25**: Backend builds dependency engine + child workflow support in parallel with frontend graph visualization
- **Week 26-27**: Integration of dynamic concurrency with PackageBuilder workflow
- **Week 28**: Full PackageBuilder integration testing and real-time monitoring
- **Week 29**: Performance optimization and production polish
- **Week 30**: Demo preparation and celebration 🎉

---

## Phase 1: Foundation (Week 25)
**Goal**: Build dependency graph engine and child workflow infrastructure

### Dependency Graph Engine Tasks

#### M5-T001: Implement dependency graph data structure
**Owner**: Backend Engineer 1
**Dependencies**: None (builds on M4 loop patterns)
**Parallel with**: M5-T010, M5-T020
**Estimate**: 16 hours

**Description**:
Implement graph data structure to represent package dependencies, detect cycles, calculate build order with topological sort, and support dynamic updates.

**Acceptance Criteria**:
- [ ] Graph structure stores nodes (packages) and edges (dependencies)
- [ ] `addNode(package)` method adds package to graph
- [ ] `addDependency(from, to)` method creates directed edge
- [ ] `detectCycles()` method identifies circular dependencies (critical for validation)
- [ ] `topologicalSort()` method returns build order respecting dependencies
- [ ] `getReadyNodes(completed)` method finds packages ready to build (all deps completed)
- [ ] Handles complex graphs (20+ nodes, 50+ edges) efficiently
- [ ] Supports dynamic updates (mark node complete, recalculate ready nodes)
- [ ] TypeScript types: `DependencyGraph`, `GraphNode`, `GraphEdge`

**Testing Requirements**:
- [ ] Unit test: Simple graph (3 nodes, linear dependencies)
- [ ] Unit test: Complex graph (20 nodes, multiple layers)
- [ ] Unit test: Cycle detection (should throw error)
- [ ] Unit test: getReadyNodes() with partial completion
- [ ] Performance test: Graph with 50 nodes builds in <100ms

**Completion Requirements**:
- [ ] Code committed to feature/milestone-5-dynamic-orchestration branch
- [ ] All tests passing
- [ ] TypeScript compilation succeeds
- [ ] Code review completed

**Deliverables**:
- `src/lib/workflow-compiler/patterns/dependency-graph.ts` (graph engine)
- `src/lib/workflow-compiler/patterns/topological-sort.ts` (sorting algorithm)
- `tests/unit/compiler/patterns/dependency-graph.test.ts`
- `docs/architecture/dependency-resolution.md`

---

#### M5-T002: Create dependency graph compiler pattern
**Owner**: Backend Engineer 1
**Dependencies**: M5-T001
**Parallel with**: M5-T011, M5-T021
**Estimate**: 12 hours

**Description**:
Build compiler pattern that generates TypeScript code for dependency-aware orchestration using topological sort and dynamic ready-node calculation.

**Acceptance Criteria**:
- [ ] Compiles visual workflow with dependency graph node to TypeScript
- [ ] Generated code initializes dependency graph from workflow definition
- [ ] Generated code implements `getReadyPackages()` function (filters by deps)
- [ ] Generated code tracks completed packages in state
- [ ] Generated code handles dependency validation errors gracefully
- [ ] Supports configuration: failFast (stop on first failure) vs continue
- [ ] Generated code includes proper TypeScript types
- [ ] Code passes `tsc --noEmit` validation

**Testing Requirements**:
- [ ] Unit test: Compile simple 3-package dependency graph
- [ ] Unit test: Compile complex 10-package graph with multiple layers
- [ ] Integration test: Generated code executes correctly in Temporal
- [ ] Test generated code handles missing dependency gracefully
- [ ] Test generated code respects failFast configuration

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Generated code validated with actual PackageBuilder workflow
- [ ] Pattern documented in pattern library

**Deliverables**:
- `src/lib/workflow-compiler/patterns/dependency-graph-pattern.ts`
- `src/lib/workflow-compiler/generators/dependency-graph-code-gen.ts`
- `tests/unit/compiler/patterns/dependency-graph-pattern.test.ts`
- `tests/integration/compiler/dependency-graph-execution.test.ts`

---

### Child Workflow Infrastructure Tasks

#### M5-T010: Implement startChild vs executeChild pattern
**Owner**: Backend Engineer 2
**Dependencies**: None (builds on M3 child workflow knowledge)
**Parallel with**: M5-T001, M5-T020
**Estimate**: 12 hours

**Description**:
Implement compiler support for Temporal's `startChild()` API (non-blocking child workflow spawning) vs `executeChild()` (blocking). This is critical for dynamic concurrency.

**Key Differences**:
- `executeChild`: Waits for child completion (blocking) - used in M3 for AI remediation
- `startChild`: Returns workflow handle immediately (non-blocking) - needed for parallel builds

**Acceptance Criteria**:
- [ ] Compiler supports "Child Workflow" node type with mode: start vs execute
- [ ] Generated code uses `startChild()` for async spawning
- [ ] Generated code stores child handles in Map<string, ChildWorkflowHandle>
- [ ] Generated code can wait for child completion via handle.result()
- [ ] Generated code can query child status via handle
- [ ] Supports child workflow configuration (task queue, timeout, retry)
- [ ] TypeScript types: `ChildWorkflowNode`, `ChildWorkflowHandle`

**Testing Requirements**:
- [ ] Unit test: Compile child workflow node (startChild mode)
- [ ] Integration test: Spawn 3 child workflows, wait for all
- [ ] Integration test: Spawn child workflows, cancel one mid-execution
- [ ] Test child workflow isolation (separate execution context)
- [ ] Test child workflow handle tracking (no memory leaks)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Pattern works with Temporal Server 1.20+
- [ ] Documentation includes examples

**Deliverables**:
- `src/lib/workflow-compiler/patterns/child-workflow-pattern.ts`
- `src/lib/workflow-compiler/generators/child-workflow-code-gen.ts`
- `tests/unit/compiler/patterns/child-workflow.test.ts`
- `tests/integration/temporal/child-workflow-spawning.test.ts`
- `docs/architecture/child-workflows.md`

---

#### M5-T011: Create child workflow registration system
**Owner**: Backend Engineer 2
**Dependencies**: M5-T010
**Parallel with**: M5-T002, M5-T021
**Estimate**: 10 hours

**Description**:
Build system to register child workflows with Temporal worker so parent workflows can spawn them dynamically.

**Acceptance Criteria**:
- [ ] Worker manager can register multiple child workflow definitions
- [ ] Parent workflow can spawn registered child workflows by name
- [ ] Child workflows execute on correct task queue
- [ ] Supports versioning (parent v1 can call child v2)
- [ ] Child workflows inherit parent namespace and identity
- [ ] Registration includes validation (workflow exists, callable)
- [ ] Handles child workflow failures (propagate error to parent)

**Testing Requirements**:
- [ ] Unit test: Register 3 child workflows
- [ ] Integration test: Parent spawns 5 children, all complete
- [ ] Integration test: Child workflow fails, parent handles error
- [ ] Test child workflow versioning
- [ ] Test child workflow task queue routing

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Supports PackageBuilder + PackageBuild hierarchy
- [ ] Documentation complete

**Deliverables**:
- `src/lib/temporal/child-workflow-registry.ts`
- `src/lib/temporal/worker-manager.ts` (enhanced)
- `tests/integration/temporal/child-workflow-registration.test.ts`
- `docs/architecture/child-workflow-registry.md`

---

### Frontend Graph Visualization Tasks

#### M5-T020: Create dependency graph visualization component
**Owner**: Frontend Engineer 1
**Dependencies**: None (builds on M1-4 canvas experience)
**Parallel with**: M5-T001, M5-T010
**Estimate**: 20 hours

**Description**:
Build interactive dependency graph visualization showing packages, dependencies, and build status in real-time. This is a complex UI component.

**Acceptance Criteria**:
- [ ] Graph displays nodes (packages) with name, category, status
- [ ] Graph displays edges (dependencies) as arrows
- [ ] Nodes color-coded by status (pending, building, completed, failed)
- [ ] Auto-layout using dagre or ELK.js (hierarchical layout)
- [ ] Zoom and pan controls
- [ ] Click node to show details (package info, dependencies, build log)
- [ ] Highlight critical path (longest dependency chain)
- [ ] Highlight ready nodes (all deps completed, ready to build)
- [ ] Real-time updates (poll execution status every 2 seconds)
- [ ] Handles large graphs (50+ nodes) without performance issues

**Testing Requirements**:
- [ ] Unit test: Render simple 3-node graph
- [ ] Unit test: Render complex 20-node graph
- [ ] E2E test: Graph updates in real-time during execution
- [ ] E2E test: Click node shows details panel
- [ ] Performance test: Render 50-node graph in <2 seconds

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is responsive (works on tablet)
- [ ] Accessibility: keyboard navigation, ARIA labels

**Deliverables**:
- `src/components/workflow-execution/DependencyGraphView.tsx`
- `src/components/workflow-execution/GraphNode.tsx`
- `src/components/workflow-execution/GraphEdge.tsx`
- `src/lib/graph-layout/dagre-layout.ts` (auto-layout utility)
- `tests/e2e/execution/dependency-graph.spec.ts`
- `tests/unit/components/dependency-graph-view.test.tsx`

---

#### M5-T021: Create real-time execution status panel
**Owner**: Frontend Engineer 1
**Dependencies**: M5-T020
**Parallel with**: M5-T002, M5-T011
**Estimate**: 12 hours

**Description**:
Build panel that shows real-time execution status for dynamic orchestration: active builds, concurrency level, completed/failed packages, estimated completion time.

**Acceptance Criteria**:
- [ ] Panel shows: total packages, completed, failed, in-progress
- [ ] Shows concurrency level (e.g., "Building 4 of 4 concurrent")
- [ ] Shows estimated completion time (based on average package build time)
- [ ] Shows critical path progress (% of critical path completed)
- [ ] Shows build queue (packages waiting for dependencies)
- [ ] Real-time updates via polling (every 2 seconds)
- [ ] Shows build duration for each package
- [ ] Shows failed packages with error summary (click to expand)
- [ ] "Retry Failed" button (restarts failed packages)

**Testing Requirements**:
- [ ] Unit test: Panel renders with mock execution data
- [ ] E2E test: Panel updates in real-time during execution
- [ ] E2E test: Retry failed packages button works
- [ ] Test estimated completion time accuracy (+/- 20%)
- [ ] Test panel performance with 50+ package executions

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is polished and responsive
- [ ] Works with slow network (graceful degradation)

**Deliverables**:
- `src/components/workflow-execution/ExecutionStatusPanel.tsx`
- `src/components/workflow-execution/ConcurrencyIndicator.tsx`
- `src/components/workflow-execution/BuildQueue.tsx`
- `tests/e2e/execution/execution-status-panel.spec.ts`
- `tests/unit/components/execution-status-panel.test.tsx`

---

## Phase 2: Dynamic Concurrency (Weeks 26-27)
**Goal**: Implement Promise.race pattern for dynamic slot management

### Promise.race Concurrency Tasks

#### M5-T030: Implement Promise.race concurrency pattern
**Owner**: Backend Engineer 1
**Dependencies**: M5-T002, M5-T010
**Parallel with**: M5-T031, M5-T040
**Estimate**: 20 hours

**Description**:
Implement most complex concurrency pattern: dynamic slot management using Promise.race to maintain N concurrent operations without blocking. This is the heart of PackageBuilder.

**Pattern Explanation**:
```typescript
// Standard approach (M4): Process batch, wait for all, repeat
await Promise.all(batch.map(item => process(item)));

// Promise.race approach (M5): Keep N slots full dynamically
while (hasWork()) {
  // Fill available slots
  const availableSlots = maxConcurrent - activeBuilds.size;
  const readyPackages = getReadyPackages(availableSlots);

  for (const pkg of readyPackages) {
    const child = await startChild(PackageBuildWorkflow, { args: [pkg] });
    activeBuilds.set(pkg.name, child);
  }

  // Wait for ANY child to complete (Promise.race)
  const { name, result } = await Promise.race(
    Array.from(activeBuilds.entries()).map(async ([name, handle]) => {
      const result = await handle.result();
      return { name, result };
    })
  );

  // Update state, free slot, continue loop
  activeBuilds.delete(name);
  markCompleted(name);
}
```

**Acceptance Criteria**:
- [ ] Compiler generates Promise.race loop pattern
- [ ] Maintains exact N concurrent child workflows (no over/under)
- [ ] Dynamically fills slots as children complete
- [ ] Tracks active builds in Map<string, ChildWorkflowHandle>
- [ ] Handles child failures (remove from activeBuilds, mark failed)
- [ ] Respects dependency constraints (only ready packages)
- [ ] Generates efficient TypeScript (no memory leaks)
- [ ] Supports configuration: maxConcurrent (1-10)
- [ ] Works with dependency graph (combines T002 + T030)

**Testing Requirements**:
- [ ] Unit test: Compile Promise.race pattern with concurrency=4
- [ ] Integration test: Execute 20 packages with concurrency=4 (5 batches)
- [ ] Integration test: Verify exactly 4 concurrent at all times
- [ ] Integration test: Handle child failure mid-execution
- [ ] Performance test: 50 packages complete in optimal time (not N+1 problem)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Pattern generates production-ready code
- [ ] Benchmarked against PackageBuilder actual performance

**Deliverables**:
- `src/lib/workflow-compiler/patterns/promise-race-pattern.ts`
- `src/lib/workflow-compiler/generators/dynamic-concurrency-code-gen.ts`
- `tests/unit/compiler/patterns/promise-race.test.ts`
- `tests/integration/compiler/promise-race-execution.test.ts`
- `docs/architecture/promise-race-concurrency.md` (detailed explanation)

---

#### M5-T031: Create dynamic slot management UI node
**Owner**: Backend Engineer 2
**Dependencies**: M5-T030
**Parallel with**: M5-T040, M5-T041
**Estimate**: 8 hours

**Description**:
Create "Dynamic Loop" workflow node type that configures Promise.race pattern with dependency graph support.

**Acceptance Criteria**:
- [ ] Node type: "Dynamic Loop" (extends "Loop Container" from M4)
- [ ] Configuration: maxConcurrent (slider 1-10)
- [ ] Configuration: dependencyMode (enabled/disabled)
- [ ] Configuration: failFast (stop on first failure) vs continue
- [ ] Node accepts dependency graph input (from graph builder)
- [ ] Node supports child workflow selection (which workflow to spawn)
- [ ] Visual indicator shows it's dynamic (not batched like M4)
- [ ] Property panel shows concurrency configuration

**Testing Requirements**:
- [ ] Unit test: Dynamic loop node validation
- [ ] E2E test: Create dynamic loop node, configure concurrency
- [ ] E2E test: Connect dependency graph to dynamic loop
- [ ] Test validation errors (invalid concurrency, no child workflow)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is intuitive and self-documenting
- [ ] Integrates with existing canvas

**Deliverables**:
- `src/components/workflow/nodes/DynamicLoopNode.tsx`
- `src/components/workflow/forms/DynamicLoopConfigForm.tsx`
- `src/server/api/schemas/dynamic-loop.schemas.ts`
- `tests/e2e/workflow-canvas/dynamic-loop-node.spec.ts`

---

### State Management Tasks

#### M5-T040: Implement workflow state tracking for dynamic orchestration
**Owner**: Backend Engineer 2
**Dependencies**: M5-T030
**Parallel with**: M5-T031, M5-T050
**Estimate**: 12 hours

**Description**:
Build state management system to track dynamic orchestration state: completed packages, active builds, failed packages, dependency status.

**Acceptance Criteria**:
- [ ] State structure: `OrchestrationState` TypeScript type
- [ ] Tracks: `completedPackages: string[]`
- [ ] Tracks: `activeBuilds: Map<string, ChildWorkflowHandle>`
- [ ] Tracks: `failedPackages: FailedPackage[]`
- [ ] Tracks: `dependencyGraph: DependencyGraph`
- [ ] Compiler generates state initialization code
- [ ] Compiler generates state update code (mark completed, mark failed)
- [ ] State persists across workflow continues (serializable)
- [ ] State queryable during execution (for monitoring UI)

**Testing Requirements**:
- [ ] Unit test: State initialization
- [ ] Unit test: State updates (mark completed)
- [ ] Integration test: State persists across workflow continues
- [ ] Integration test: State queryable via Temporal query API
- [ ] Test state serialization/deserialization

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] State structure documented
- [ ] Works with PackageBuilder workflow

**Deliverables**:
- `src/lib/workflow-compiler/patterns/orchestration-state.ts`
- `src/lib/workflow-compiler/generators/state-management-code-gen.ts`
- `tests/unit/compiler/patterns/orchestration-state.test.ts`
- `tests/integration/temporal/state-persistence.test.ts`

---

## Phase 3: PackageBuilder Integration (Week 28)
**Goal**: Integrate actual PackageBuilder workflow and test end-to-end

### PackageBuilder Integration Tasks

#### M5-T050: Import PackageBuilder workflow definition
**Owner**: Backend Engineer 1
**Dependencies**: M5-T030, M5-T040
**Parallel with**: M5-T051, M5-T060
**Estimate**: 24 hours

**Description**:
Convert actual PackageBuilder workflow from `packages/agents/package-builder-production` to visual workflow definition in workflow-builder UI. This is a critical integration task.

**PackageBuilder Workflow Structure** (from source code):
```typescript
// Parent: PackageBuilderWorkflow
async function PackageBuilderWorkflow(input: PackageBuilderInput) {
  // Phase 1: Initialize (parse plan, build dependency graph)
  const state = await initializePhase(input);

  // Phase 2: Plan (verify plans exist)
  await planPhase(state);

  // Phase 3: Build (dynamic concurrency with startChild)
  while (hasUnbuiltPackages(state)) {
    const readyPackages = getReadyPackages(state, maxConcurrent);

    for (const pkg of readyPackages) {
      const child = await startChild(PackageBuildWorkflow, { args: [pkg] });
      activeBuilds.set(pkg.name, child);
    }

    const { name, result } = await Promise.race(...activeBuilds);
    updateState(name, result);
  }

  // Phase 4: Verify (integration tests)
  await verifyPhase(state);

  // Phase 5: Complete (generate report)
  await completePhase(state);
}

// Child: PackageBuildWorkflow
async function PackageBuildWorkflow(input: PackageBuildInput) {
  // Build, test, possibly spawn AI remediation child
}
```

**Acceptance Criteria**:
- [ ] Create workflow definition JSON for PackageBuilder
- [ ] Workflow includes dependency graph node (from plan parsing)
- [ ] Workflow includes dynamic loop node (build phase)
- [ ] Workflow includes child workflow nodes (PackageBuildWorkflow)
- [ ] Workflow includes report generation activity
- [ ] Map all activities from source code to visual nodes
- [ ] Preserve all configuration (timeouts, retry policies, concurrency)
- [ ] Validate workflow compiles to equivalent TypeScript
- [ ] Generated code matches original logic (diff check)

**Testing Requirements**:
- [ ] Unit test: Workflow definition validates
- [ ] Integration test: Compile workflow, compare to original
- [ ] Integration test: Execute workflow with 3 test packages
- [ ] Integration test: Execute workflow with 10 packages
- [ ] E2E test: Full PackageBuilder execution (20+ packages)
- [ ] Verify reports match original PackageBuilder output

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Workflow executes successfully in Temporal
- [ ] Performance within 10% of original (not slower)
- [ ] Documentation of conversion process

**Deliverables**:
- `examples/package-builder/package-builder-workflow.json` (workflow definition)
- `examples/package-builder/package-build-workflow.json` (child workflow)
- `src/lib/workflow-compiler/converters/package-builder-converter.ts` (conversion script)
- `tests/integration/package-builder/end-to-end.test.ts`
- `docs/examples/package-builder-migration.md`

---

#### M5-T051: Create PackageBuilder seed script
**Owner**: Backend Engineer 2
**Dependencies**: M5-T050
**Parallel with**: M5-T060, M5-T061
**Estimate**: 8 hours

**Description**:
Create seed script to import PackageBuilder workflow into workflow-builder database for demo.

**Acceptance Criteria**:
- [ ] Script imports PackageBuilder workflow definition
- [ ] Script imports PackageBuild child workflow definition
- [ ] Script sets up demo data (test packages, dependencies)
- [ ] Script validates workflow is deployable
- [ ] Script can be run multiple times (idempotent)
- [ ] Script outputs workflow ID for demo use
- [ ] Documentation includes setup instructions

**Testing Requirements**:
- [ ] Test script runs successfully on clean database
- [ ] Test script is idempotent (run twice, no errors)
- [ ] Test imported workflow is valid
- [ ] Test workflow can be deployed immediately

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Script tested on staging environment
- [ ] Documentation complete
- [ ] Works with demo environment

**Deliverables**:
- `scripts/seed-package-builder.ts`
- `examples/package-builder/test-packages.json` (demo data)
- `docs/examples/package-builder-setup.md`

---

### Real-time Monitoring Tasks

#### M5-T060: Implement real-time execution API
**Owner**: Backend Engineer 2
**Dependencies**: M5-T040
**Parallel with**: M5-T050, M5-T061
**Estimate**: 16 hours

**Description**:
Build API endpoints to query dynamic orchestration state in real-time for monitoring UI.

**Acceptance Criteria**:
- [ ] tRPC endpoint: `execution.getDynamicState(executionId)` returns state
- [ ] Returns: completedPackages, activeBuilds (with progress), failedPackages
- [ ] Returns: dependencyGraph with build status annotations
- [ ] Returns: concurrency metrics (current, max, utilization)
- [ ] Returns: estimated completion time
- [ ] Endpoint polls Temporal workflow for state (query API)
- [ ] Supports filtering (only show failed, only show active, etc.)
- [ ] Response time <500ms (critical for real-time feel)

**Testing Requirements**:
- [ ] Unit test: Endpoint returns correct state
- [ ] Integration test: Query state during execution
- [ ] Integration test: State updates in real-time (poll every 2s)
- [ ] Performance test: Query state with 50+ packages in <500ms
- [ ] Test error handling (workflow not found, Temporal down)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documented
- [ ] Works with PackageBuilder workflow

**Deliverables**:
- `src/server/api/routers/dynamic-execution.ts`
- `src/server/api/schemas/dynamic-execution.schemas.ts`
- `src/lib/execution/dynamic-state-tracker.ts`
- `tests/integration/api/dynamic-execution/state-query.test.ts`
- `docs/api/dynamic-execution.md`

---

#### M5-T061: Build real-time execution monitoring page
**Owner**: Frontend Engineer 1
**Dependencies**: M5-T060, M5-T021
**Parallel with**: M5-T050, M5-T051
**Estimate**: 16 hours

**Description**:
Build dedicated page for monitoring dynamic orchestration execution with graph visualization and real-time updates.

**Acceptance Criteria**:
- [ ] Page route: `/executions/[id]/dynamic` (dedicated page for dynamic workflows)
- [ ] Page includes dependency graph visualization (from M5-T020)
- [ ] Page includes execution status panel (from M5-T021)
- [ ] Page includes build log viewer (shows logs from active builds)
- [ ] Real-time updates via polling (every 2 seconds)
- [ ] Updates are efficient (only fetch changed data)
- [ ] Page shows concurrency visualization (bar chart of concurrent builds over time)
- [ ] Page includes "Cancel Execution" button
- [ ] Page includes "Retry Failed Packages" button
- [ ] Page is responsive (works on tablet)

**Testing Requirements**:
- [ ] E2E test: Navigate to dynamic execution page
- [ ] E2E test: Page updates in real-time during execution
- [ ] E2E test: Click node in graph shows build details
- [ ] E2E test: Cancel execution works
- [ ] E2E test: Retry failed packages works
- [ ] Performance test: Page updates 50+ times without memory leak

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is polished and production-ready
- [ ] Accessibility audit passes

**Deliverables**:
- `src/app/executions/[id]/dynamic/page.tsx`
- `src/components/workflow-execution/DynamicExecutionPage.tsx`
- `src/components/workflow-execution/ConcurrencyChart.tsx`
- `tests/e2e/execution/dynamic-execution-page.spec.ts`

---

## Phase 4: Performance & Polish (Week 29)
**Goal**: Optimize performance, polish UI, prepare for scale

### Performance Optimization Tasks

#### M5-T070: Optimize dependency graph algorithm performance
**Owner**: Backend Engineer 1
**Dependencies**: M5-T050 (need real PackageBuilder data)
**Parallel with**: M5-T071, M5-T080
**Estimate**: 12 hours

**Description**:
Optimize dependency graph algorithms to handle large monorepos (100+ packages, 500+ dependencies) efficiently.

**Performance Targets**:
- Build dependency graph from 100 packages: <200ms
- Calculate ready packages (with 50 completed): <50ms
- Topological sort of 100 packages: <100ms

**Acceptance Criteria**:
- [ ] Benchmarks created for all graph operations
- [ ] Identify bottlenecks (profiling data)
- [ ] Optimize topological sort (memoization, caching)
- [ ] Optimize getReadyNodes (incremental updates, not full recalc)
- [ ] Use efficient data structures (Set vs Array where appropriate)
- [ ] Memory usage <50MB for 100-package graph
- [ ] All operations scale linearly O(n) not exponentially

**Testing Requirements**:
- [ ] Performance test: 100-package graph operations
- [ ] Performance test: 500-package graph (stress test)
- [ ] Benchmark comparison (before vs after optimization)
- [ ] Memory profiling (no leaks during long-running workflow)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Performance targets met
- [ ] Benchmarks documented
- [ ] No performance regressions

**Deliverables**:
- `src/lib/workflow-compiler/patterns/dependency-graph.ts` (optimized)
- `benchmarks/dependency-graph-performance.ts`
- `docs/performance/dependency-graph-benchmarks.md`

---

#### M5-T071: Optimize real-time UI updates
**Owner**: Frontend Engineer 1
**Dependencies**: M5-T061
**Parallel with**: M5-T070, M5-T080
**Estimate**: 12 hours

**Description**:
Optimize real-time UI to handle large executions (50+ packages) without performance degradation or excessive network traffic.

**Performance Targets**:
- Render 50-package graph: <2 seconds
- Update graph on state change: <100ms
- Network requests per minute: <30 (polling every 2s, but smart)

**Acceptance Criteria**:
- [ ] Implement incremental updates (only changed nodes, not full graph)
- [ ] Use React.memo for graph nodes (prevent unnecessary re-renders)
- [ ] Implement virtual scrolling for large package lists
- [ ] Optimize polling (use long-polling or WebSocket if available)
- [ ] Throttle/debounce expensive operations (layout recalculation)
- [ ] Use Web Workers for graph layout (don't block main thread)
- [ ] Memory usage <100MB for 50-package execution

**Testing Requirements**:
- [ ] Performance test: Render 50-package graph
- [ ] Performance test: 100 state updates without slowdown
- [ ] Network traffic analysis (measure requests, payload size)
- [ ] Memory profiling (no leaks during 30-minute session)
- [ ] Test on slower devices (throttled CPU)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Performance targets met
- [ ] UI is responsive and smooth
- [ ] Works on mobile devices

**Deliverables**:
- `src/components/workflow-execution/DependencyGraphView.tsx` (optimized)
- `src/lib/graph-layout/graph-layout-worker.ts` (Web Worker)
- `src/hooks/useOptimizedPolling.ts` (smart polling hook)
- `docs/performance/ui-optimization.md`

---

### Production Readiness Tasks

#### M5-T080: Create comprehensive PackageBuilder test suite
**Owner**: QA Engineer
**Dependencies**: M5-T050, M5-T060
**Parallel with**: M5-T070, M5-T071, M5-T081
**Estimate**: 20 hours

**Description**:
Create comprehensive test suite for PackageBuilder integration covering all scenarios, edge cases, and failure modes.

**Test Scenarios**:
1. **Happy Path**: 20 packages, all succeed
2. **Partial Failure**: 20 packages, 3 fail, others complete
3. **Dependency Failure**: Package fails, dependents are blocked
4. **Concurrency Stress**: 50 packages, test concurrency=1, 4, 8
5. **Cycle Detection**: Invalid dependency graph (should fail gracefully)
6. **Long-Running**: Simulate 2-hour build (continue-as-new)

**Acceptance Criteria**:
- [ ] E2E test: Full PackageBuilder workflow (20+ packages)
- [ ] E2E test: Verify dependency order (layer 0 before layer 1)
- [ ] E2E test: Verify concurrency (exactly N concurrent at all times)
- [ ] E2E test: Handle package build failure (fail gracefully)
- [ ] E2E test: Verify build report generated correctly
- [ ] Integration test: Dependency graph cycle detection
- [ ] Integration test: State persistence across continues
- [ ] Performance test: 50 packages complete in optimal time
- [ ] All tests pass consistently (no flakiness)

**Testing Requirements**:
- [ ] Tests use real Temporal instance (not mocked)
- [ ] Tests use page object pattern (maintainable)
- [ ] Tests have proper cleanup (delete test executions)
- [ ] Tests run in CI (GitHub Actions)
- [ ] Test coverage >80% for new code

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing in CI
- [ ] Tests documented
- [ ] Test data fixtures created

**Deliverables**:
- `tests/e2e/package-builder/full-workflow.spec.ts`
- `tests/e2e/package-builder/failure-scenarios.spec.ts`
- `tests/e2e/package-builder/concurrency.spec.ts`
- `tests/integration/package-builder/dependency-graph.test.ts`
- `tests/fixtures/package-builder/` (test data)
- `docs/testing/package-builder-tests.md`

---

#### M5-T081: Create production monitoring and alerting
**Owner**: DevOps Engineer
**Dependencies**: M5-T060
**Parallel with**: M5-T080, M5-T090
**Estimate**: 12 hours

**Description**:
Set up production monitoring and alerting for dynamic orchestration workflows.

**Acceptance Criteria**:
- [ ] Monitor concurrency utilization (avg, max, p95)
- [ ] Monitor workflow execution duration (by package count)
- [ ] Monitor failure rate (packages failed / total)
- [ ] Monitor Temporal Server health (queue depth, worker health)
- [ ] Alert on high failure rate (>10% packages failing)
- [ ] Alert on stuck workflows (no progress in 30 minutes)
- [ ] Alert on Temporal Server issues
- [ ] Dashboard showing key metrics (Grafana or similar)

**Testing Requirements**:
- [ ] Test alerts trigger correctly (simulate failure scenario)
- [ ] Test dashboard displays metrics correctly
- [ ] Test metrics collection doesn't impact performance
- [ ] Test retention (keep metrics for 30 days)

**Completion Requirements**:
- [ ] Monitoring deployed to staging and production
- [ ] Alerts tested and working
- [ ] Dashboard accessible to team
- [ ] Documentation complete

**Deliverables**:
- `infrastructure/monitoring/dynamic-orchestration-dashboard.json`
- `infrastructure/monitoring/alert-rules.yml`
- `docs/operations/monitoring.md`

---

## Phase 5: Demo Preparation (Week 30)
**Goal**: Prepare PackageBuilder demo, documentation, and celebration

### Demo Preparation Tasks

#### M5-T090: Create PackageBuilder demo workflow
**Owner**: Backend Engineer 1 + QA Engineer
**Dependencies**: M5-T080
**Parallel with**: M5-T091, M5-T092
**Estimate**: 12 hours

**Description**:
Create compelling demo workflow that showcases PackageBuilder capabilities for Week 30 stakeholder presentation.

**Demo Workflow** (15-minute presentation):
1. **Setup**: Show workflow-builder UI with PackageBuilder workflow loaded
2. **Graph Visualization**: Show dependency graph (20 packages, multiple layers)
3. **Configuration**: Show concurrency configuration (maxConcurrent=4)
4. **Execution**: Click "Run", watch packages build in real-time
5. **Monitoring**: Show dependency graph updating (pending → building → completed)
6. **Concurrency**: Show exactly 4 packages building concurrently
7. **Dependency Handling**: Show package waiting for dependency to complete
8. **Failure Handling**: Show package failure, dependents blocked
9. **Completion**: Show build report generated
10. **Performance**: Show build completed in optimal time

**Acceptance Criteria**:
- [ ] Demo workflow with 20 test packages (realistic dependencies)
- [ ] Demo data includes packages with varying build times (5s - 60s)
- [ ] Demo includes intentional failure scenario (1 package fails gracefully)
- [ ] Demo highlights critical path (longest dependency chain)
- [ ] Demo environment is stable (tested 10+ times without crash)
- [ ] Demo runs in <10 minutes (including explanation)
- [ ] Backup recording available (if live demo fails)

**Testing Requirements**:
- [ ] Rehearse demo 5+ times
- [ ] Test demo on different networks (simulate slow connection)
- [ ] Test demo environment stability (24-hour uptime)
- [ ] Verify all demo points work consistently

**Completion Requirements**:
- [ ] Demo workflow tested and stable
- [ ] Demo script written and rehearsed
- [ ] Backup materials ready
- [ ] Team confident in demo

**Deliverables**:
- `examples/package-builder/demo-workflow.json`
- `examples/package-builder/demo-packages.json` (20 packages)
- `docs/demo/milestone-5-script.md`
- `docs/demo/milestone-5-talking-points.md`
- Backup demo recording (video)

---

#### M5-T091: Write PackageBuilder user documentation
**Owner**: Backend Engineer 2 + Frontend Engineer 1
**Dependencies**: M5-T080
**Parallel with**: M5-T090, M5-T092
**Estimate**: 16 hours

**Description**:
Create comprehensive user documentation for creating and running dynamic orchestration workflows like PackageBuilder.

**Documentation Sections**:
1. **Introduction**: What is dynamic orchestration? When to use?
2. **Dependency Graphs**: How to define dependencies, visualize, validate
3. **Dynamic Concurrency**: How Promise.race works, when to use vs batching
4. **Child Workflows**: How to spawn child workflows, handle results
5. **Monitoring**: How to monitor dynamic execution, interpret graph
6. **Troubleshooting**: Common issues (cycles, stuck workflows, failures)
7. **Performance**: Best practices for large monorepos (100+ packages)

**Acceptance Criteria**:
- [ ] Getting started guide (create PackageBuilder-like workflow in 20 min)
- [ ] Dependency graph tutorial (step-by-step with screenshots)
- [ ] Dynamic concurrency guide (when to use vs M4 batching)
- [ ] Child workflow guide (startChild vs executeChild)
- [ ] Monitoring guide (interpret execution page, understand metrics)
- [ ] Troubleshooting guide (common errors, solutions)
- [ ] Performance tuning guide (optimize for 100+ packages)
- [ ] All documentation has screenshots and code examples
- [ ] Video walkthrough (10-minute screencast)

**Testing Requirements**:
- [ ] Have non-team member follow guide and provide feedback
- [ ] Test all code examples execute correctly
- [ ] Verify all screenshots are up-to-date
- [ ] Verify all links work

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Feedback incorporated
- [ ] Documentation versioned (Milestone 5)

**Deliverables**:
- `docs/user-guide/dynamic-orchestration.md`
- `docs/user-guide/dependency-graphs.md`
- `docs/user-guide/child-workflows.md`
- `docs/user-guide/monitoring-dynamic-workflows.md`
- `docs/user-guide/troubleshooting-dynamic-workflows.md`
- `docs/user-guide/video-walkthrough-dynamic.mp4`

---

#### M5-T092: Create developer documentation for patterns
**Owner**: Backend Engineer 1
**Dependencies**: M5-T090
**Parallel with**: M5-T091, M5-T093
**Estimate**: 12 hours

**Description**:
Create developer documentation for implementing dependency graph, Promise.race, and child workflow patterns.

**Documentation Sections**:
1. **Architecture Overview**: How dynamic orchestration works internally
2. **Dependency Graph Engine**: Data structures, algorithms, complexity
3. **Promise.race Pattern**: How it works, when to use, edge cases
4. **Child Workflow Pattern**: startChild API, handle management, lifecycle
5. **State Management**: How state is tracked, persisted, queried
6. **Code Generation**: How patterns compile to TypeScript
7. **Extension Guide**: How to add new orchestration patterns

**Acceptance Criteria**:
- [ ] Architecture diagrams (dependency graph, Promise.race flow, state management)
- [ ] Algorithm documentation (topological sort, ready-node calculation)
- [ ] Code examples for each pattern
- [ ] Performance characteristics (time complexity, memory usage)
- [ ] Edge cases documented (cycles, failures, race conditions)
- [ ] Extension guide (add new patterns in future milestones)
- [ ] All code examples compile and execute

**Testing Requirements**:
- [ ] Test all code examples execute correctly
- [ ] Verify diagrams are accurate
- [ ] Have backend engineer review for technical accuracy

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Documentation versioned

**Deliverables**:
- `docs/architecture/dynamic-orchestration.md`
- `docs/architecture/dependency-graph-engine.md`
- `docs/architecture/promise-race-pattern.md`
- `docs/architecture/child-workflow-lifecycle.md`
- `docs/development/extending-orchestration-patterns.md`

---

#### M5-T093: Prepare final demo and celebration
**Owner**: All team members
**Dependencies**: M5-T090, M5-T091, M5-T092
**Parallel with**: None (final task)
**Estimate**: 8 hours

**Description**:
Final rehearsal, polish demo environment, prepare presentation, and plan celebration for completing PackageBuilder migration! 🎉

**Acceptance Criteria**:
- [ ] Demo environment stable and tested
- [ ] Demo rehearsed with all team members
- [ ] Presentation slides prepared (if needed)
- [ ] Success metrics compiled (packages built, time saved, ROI)
- [ ] Stakeholder invite sent and confirmed
- [ ] Demo environment tested 1 hour before presentation
- [ ] Celebration plan (team dinner, awards, retrospective)
- [ ] Lessons learned document drafted

**Testing Requirements**:
- [ ] Full demo run-through with timing (15 minutes)
- [ ] Fallback plan tested (recording)
- [ ] All demo workflows execute successfully

**Completion Requirements**:
- [ ] Team confident in demo
- [ ] All materials ready
- [ ] Stakeholders confirmed
- [ ] Celebration planned

**Deliverables**:
- Final demo environment
- Presentation materials
- Success metrics report
- `docs/retrospective/milestone-5-lessons-learned.md`
- Team celebration! 🎉

---

## Dependency Graph

### Visual Representation

```
Week 25 (Foundation - Parallel):
├─ M5-T001 (Dependency Graph Engine)
│  └─ M5-T002 (Dependency Graph Compiler)
├─ M5-T010 (startChild Pattern)
│  └─ M5-T011 (Child Workflow Registry)
└─ M5-T020 (Graph Visualization)
   └─ M5-T021 (Execution Status Panel)

Week 26-27 (Dynamic Concurrency - Critical):
├─ M5-T030 (Promise.race Pattern) [depends: T002, T010] 🔴 CRITICAL
│  └─ M5-T031 (Dynamic Loop UI Node)
└─ M5-T040 (State Management) [depends: T030]

Week 28 (PackageBuilder Integration - Critical):
├─ M5-T050 (Import PackageBuilder) [depends: T030, T040] 🔴 CRITICAL
│  └─ M5-T051 (Seed Script)
├─ M5-T060 (Real-time API) [depends: T040]
│  └─ M5-T061 (Monitoring Page) [depends: T060, T021]

Week 29 (Performance & Polish):
├─ M5-T070 (Optimize Graph Algorithms) [depends: T050]
├─ M5-T071 (Optimize UI) [depends: T061]
├─ M5-T080 (PackageBuilder Tests) [depends: T050, T060] 🔴 CRITICAL
└─ M5-T081 (Production Monitoring) [depends: T060]

Week 30 (Demo Prep):
├─ M5-T090 (Demo Workflow) [depends: T080]
├─ M5-T091 (User Docs) [depends: T080]
├─ M5-T092 (Dev Docs) [depends: T090]
└─ M5-T093 (Final Demo) [depends: T090, T091, T092]
```

### Critical Path (112 hours = ~3 weeks)

```
M5-T001 (16h) → M5-T002 (12h) → M5-T030 (20h) → M5-T050 (24h) → M5-T080 (20h) → M5-T090 (12h) → M5-T093 (8h)

Total: 112 hours
```

**Critical Path Duration**: 112 hours = 3 weeks of focused work (1 person)
**Actual Calendar Time**: 5 weeks (Weeks 25-29)
**Slack Time**: Week 30 (demo prep and celebration)

---

## Weekly Timeline with Team Assignments

### Week 25: Foundation (Parallel Work)

**Backend Team**:
- BE1: M5-T001 (Dependency Graph Engine) - 16h 🔴
- BE1: M5-T002 (Dependency Graph Compiler) - 12h 🔴
- BE2: M5-T010 (startChild Pattern) - 12h
- BE2: M5-T011 (Child Workflow Registry) - 10h
**Total**: 50 hours (both engineers)

**Frontend Team**:
- FE1: M5-T020 (Graph Visualization) - 20h
- FE1: M5-T021 (Execution Status Panel) - 12h
**Total**: 32 hours

**DevOps Team**:
- DevOps: Environment prep - 8h
- DevOps: Monitoring setup (start) - 4h
**Total**: 12 hours

**End of Week 25 Deliverables**:
- Dependency graph engine working
- Child workflow infrastructure ready
- Graph visualization component built
- Ready for dynamic concurrency implementation

---

### Week 26: Dynamic Concurrency (Critical Path)

**Backend Team**:
- BE1: M5-T030 (Promise.race Pattern) - 20h 🔴 CRITICAL
- BE1: M5-T031 (Dynamic Loop Node) - 8h
- BE2: M5-T040 (State Management) - 12h
- BE2: Support integration - 8h
**Total**: 48 hours

**Frontend Team**:
- FE1: Integration with backend - 16h
- FE1: Polish graph visualization - 8h
**Total**: 24 hours

**DevOps Team**:
- DevOps: Performance testing infrastructure - 8h
- DevOps: Monitoring setup (continue) - 4h
**Total**: 12 hours

**End of Week 26 Deliverables**:
- Promise.race pattern working
- Dynamic concurrency compiles correctly
- State management in place
- Ready for PackageBuilder integration

---

### Week 27: Integration Preparation

**Backend Team**:
- BE1: Start M5-T050 (Import PackageBuilder) - 16h 🔴
- BE2: M5-T060 (Real-time API) - 16h
**Total**: 32 hours

**Frontend Team**:
- FE1: Start M5-T061 (Monitoring Page) - 16h
**Total**: 16 hours

**QA Team**:
- QA: Test planning for PackageBuilder - 8h
- QA: Create test fixtures - 8h
**Total**: 16 hours

**End of Week 27 Deliverables**:
- PackageBuilder conversion in progress
- Real-time API working
- Monitoring page started
- Test plan ready

---

### Week 28: PackageBuilder Integration (Critical)

**Backend Team**:
- BE1: Complete M5-T050 (Import PackageBuilder) - 8h 🔴
- BE1: M5-T051 (Seed Script) - 8h
- BE1: Support QA testing - 8h
- BE2: Complete M5-T060 (Real-time API) - 8h
- BE2: Support integration - 8h
**Total**: 40 hours

**Frontend Team**:
- FE1: Complete M5-T061 (Monitoring Page) - 8h
- FE1: Integration testing - 8h
**Total**: 16 hours

**QA Team**:
- QA: M5-T080 (PackageBuilder Tests) - 20h 🔴
**Total**: 20 hours

**End of Week 28 Deliverables**:
- PackageBuilder workflow imported and working
- Real-time monitoring fully functional
- Initial test suite passing
- Ready for optimization

---

### Week 29: Performance & Polish

**Backend Team**:
- BE1: M5-T070 (Optimize Graph Algorithms) - 12h
- BE1: Support testing - 8h
- BE2: Bug fixes - 8h
- BE2: Start M5-T091 (User Docs) - 8h
**Total**: 36 hours

**Frontend Team**:
- FE1: M5-T071 (Optimize UI) - 12h
- FE1: M5-T091 (User Docs) - 8h
**Total**: 20 hours

**QA Team**:
- QA: Complete M5-T080 (Tests) - 8h
- QA: Performance validation - 8h
**Total**: 16 hours

**DevOps Team**:
- DevOps: M5-T081 (Production Monitoring) - 12h
**Total**: 12 hours

**End of Week 29 Deliverables**:
- Performance optimized
- UI polished
- Comprehensive tests passing
- Production monitoring ready

---

### Week 30: Demo & Celebration 🎉

**All Team**:
- BE1: M5-T092 (Dev Docs) - 12h
- BE2: M5-T091 (User Docs continued) - 8h
- FE1: M5-T090 (Demo Workflow) - 6h
- QA: M5-T090 (Demo Workflow) - 6h
- DevOps: Demo environment - 4h
- All: M5-T093 (Final Demo & Celebration) - 8h
**Total**: 44 hours

**Demo Day** (End of Week 30):
- Present PackageBuilder to stakeholders
- Show 10-point demo (full dynamic orchestration)
- Celebrate completion of PackageBuilder migration! 🎉
- Plan Milestone 6 (Production Polish)

---

## Risk Mitigation

### High-Risk Items

1. **Promise.race Pattern Complexity** (M5-T030) 🔴
   - **Risk**: Most complex concurrency pattern, may have edge cases
   - **Mitigation**: Extensive unit tests, pair programming with BE2, study Temporal examples
   - **Fallback**: Use simpler batching (M4 pattern) for demo if race conditions found

2. **PackageBuilder Integration** (M5-T050) 🔴
   - **Risk**: Converting real workflow may uncover edge cases in compiler
   - **Mitigation**: Start early (Week 27), incremental conversion, validate each phase
   - **Fallback**: Demo with simplified PackageBuilder (10 packages instead of 20)

3. **Real-time Performance** (M5-T071)
   - **Risk**: Large graphs may slow down UI
   - **Mitigation**: Performance testing early, Web Workers, virtual scrolling
   - **Fallback**: Limit demo to 20 packages (not 50)

4. **Dependency Graph Cycles**
   - **Risk**: Invalid dependency graphs may crash workflow
   - **Mitigation**: Cycle detection in compiler, validation before deployment
   - **Fallback**: Manual validation step in demo

### Dependencies on External Systems

- **Temporal Server**: Ensure 1.20+ for latest startChild API features
- **Database**: Ensure JSONB queries optimized for large dependency graphs
- **Network**: Real-time monitoring requires reliable connection

### Team Capacity Risks

- **BE1 Overload**: Critical path owner, Weeks 26-27 are heavy
  - **Mitigation**: BE2 can assist with M5-T030 if needed
- **Week 28 Crunch**: Integration week is heavy for all teams
  - **Mitigation**: Week 29 is lighter (buffer for slippage)

---

## Success Metrics for Milestone 5

### Quantitative Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| PackageBuilder execution | 20+ packages | Count in demo |
| Dependency graph size | 20+ nodes, 50+ edges | Graph complexity |
| Concurrency maintained | Exactly 4 concurrent (or configured) | Execution metrics |
| Build completion time | Within 10% of original | Performance comparison |
| Real-time update latency | <2 seconds | Monitoring lag time |
| Graph render performance | <2 seconds for 50 nodes | UI performance test |
| Test coverage | >80% | Code coverage report |
| Zero critical bugs | 0 P0 bugs | Bug tracker |

### Qualitative Success Criteria

- [ ] **Complete**: PackageBuilder workflow executes successfully in workflow-builder
- [ ] **Performant**: Execution time within 10% of original (not slower)
- [ ] **Understandable**: Dependency graph is clear and intuitive
- [ ] **Monitored**: Real-time monitoring shows exactly what's happening
- [ ] **Documented**: Users can build similar workflows from docs

### Demo Success Criteria (Week 30)

Must successfully demonstrate all 10 points:
1. [ ] Load PackageBuilder workflow in UI
2. [ ] Show dependency graph (20 packages, multiple layers)
3. [ ] Configure concurrency (set to 4)
4. [ ] Run workflow, watch in real-time
5. [ ] Show packages building in parallel (exactly 4 at a time)
6. [ ] Show dependency handling (package waits for dependency)
7. [ ] Show package completion (dependency unblocks dependents)
8. [ ] Show failure handling (1 package fails, dependents blocked)
9. [ ] Show build report generated
10. [ ] Show execution completed in optimal time

**If all 10 succeed**: Milestone 5 complete! PackageBuilder migration DONE! 🎉

---

## Handoff to Milestone 6

### Prerequisites for M6 Start

- [ ] PackageBuilder workflow executes successfully
- [ ] Demo successful and stakeholder approval received
- [ ] User feedback collected
- [ ] Performance benchmarks documented
- [ ] M5 code merged to main branch
- [ ] Team retrospective completed

### Lessons Learned Handoff

Document:
1. What worked well (repeat in M6)
2. What was challenging (avoid in M6)
3. Performance insights (apply to future patterns)
4. User feedback themes (prioritize in M6)
5. Technical debt created (address in M6 if critical)

### Milestone 6 Preview

Based on M5 completion, M6 will add:
- Signal handling (pause/resume workflows)
- Long-running workflow support (continue-as-new)
- Advanced debugging tools
- Performance monitoring dashboard
- Workflow templates library
- Production polish and GA preparation

Expected start: Week 31 (immediately after M5 completion)

---

## Appendix: Task Summary Table

| Task ID | Task Name | Owner | Estimate | Week | Dependencies |
|---------|-----------|-------|----------|------|--------------|
| M5-T001 | Dependency graph engine | BE1 | 16h | 25 | None |
| M5-T002 | Dependency graph compiler | BE1 | 12h | 25 | T001 |
| M5-T010 | startChild pattern | BE2 | 12h | 25 | None |
| M5-T011 | Child workflow registry | BE2 | 10h | 25 | T010 |
| M5-T020 | Graph visualization | FE1 | 20h | 25 | None |
| M5-T021 | Execution status panel | FE1 | 12h | 25 | T020 |
| M5-T030 | Promise.race pattern | BE1 | 20h | 26 | T002, T010 🔴 |
| M5-T031 | Dynamic loop UI node | BE2 | 8h | 26 | T030 |
| M5-T040 | State management | BE2 | 12h | 26 | T030 |
| M5-T050 | Import PackageBuilder | BE1 | 24h | 27-28 | T030, T040 🔴 |
| M5-T051 | Seed script | BE2 | 8h | 28 | T050 |
| M5-T060 | Real-time API | BE2 | 16h | 27-28 | T040 |
| M5-T061 | Monitoring page | FE1 | 16h | 27-28 | T060, T021 |
| M5-T070 | Optimize algorithms | BE1 | 12h | 29 | T050 |
| M5-T071 | Optimize UI | FE1 | 12h | 29 | T061 |
| M5-T080 | PackageBuilder tests | QA | 20h | 28-29 | T050, T060 🔴 |
| M5-T081 | Production monitoring | DevOps | 12h | 29 | T060 |
| M5-T090 | Demo workflow | BE1+QA | 12h | 30 | T080 |
| M5-T091 | User documentation | BE2+FE1 | 16h | 29-30 | T080 |
| M5-T092 | Developer documentation | BE1 | 12h | 30 | T090 |
| M5-T093 | Final demo | All | 8h | 30 | T090-T092 |

**Total Estimated Hours**: ~300 hours
**Team Size**: 4 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA)
**Timeline**: 6 weeks (Weeks 25-30)
**Capacity**: 160 hours per week (4 people × 40 hours)
**Utilization**: ~62% (healthy for complex milestone)

---

**Created**: 2025-01-19
**Version**: 1.0
**Next Review**: End of Week 27 (mid-milestone check-in)

**THIS IS IT!** 🎯 After Milestone 5, PackageBuilder is fully migrated to workflow-builder! 🎉
