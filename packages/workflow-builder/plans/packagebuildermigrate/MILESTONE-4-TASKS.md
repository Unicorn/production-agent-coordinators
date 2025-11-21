# Milestone 4: Batch Processing - Detailed Task Breakdown

**Goal**: Ship batch processing workflows with concurrency control in 6 weeks.

**Timeline**: Weeks 19-24
**Target Demo Date**: End of Week 24

---

## Executive Summary

### Critical Path (Longest Dependencies)
```
Loop Container Backend (12h)
  → Concurrency Control Pattern (20h)
    → Progress Tracking System (16h)
      → Performance Testing (16h)
        → Load Testing (12h)

Total Critical Path: ~76 hours = ~2 weeks (with buffer)
```

### Team Structure
- **Backend Engineer 1**: Loop pattern compiler, concurrency control (Promise.race)
- **Backend Engineer 2**: Progress tracking, state management, performance optimization
- **Frontend Engineer 1**: Loop container UI, concurrency controls, progress visualization
- **DevOps Engineer**: Performance monitoring, horizontal scaling, load testing infrastructure
- **QA Engineer**: Performance testing, load testing, edge case validation

### Parallelization Strategy
- **Week 19**: All teams work in parallel on foundations (sequential loop first)
- **Week 20-21**: Focus on concurrency control (Promise.race pattern) - COMPLEX
- **Week 22**: Performance testing and optimization - CRITICAL
- **Week 23**: Demo preparation and documentation
- **Week 24**: Buffer for performance issues and final polish

### Key Challenges (Unique to Milestone 4)

1. **Concurrency Control Complexity** (Highest Risk)
   - Promise.race() pattern is complex to compile correctly
   - Slot management with dynamic availability
   - Dependency-aware scheduling (for M5 preview)
   - Estimated 20h, but may take 30-40h

2. **Performance at Scale**
   - Must handle 1000+ items efficiently
   - Memory management for large arrays
   - Database query optimization (progress tracking)
   - Requires extensive load testing

3. **Progress Tracking Precision**
   - Real-time progress updates for long-running loops
   - Accurate percentage calculation
   - Handling failures mid-loop
   - Resume/retry semantics

---

## Phase 1: Sequential Loop Foundation (Week 19)
**Goal**: Implement basic loop pattern (sequential execution only)

### Backend Tasks - Loop Pattern Compiler

#### M4-T001: Design loop container schema and types
**Owner**: Backend Engineer 1
**Dependencies**: None (starts from existing Milestone 3 foundation)
**Parallel with**: M4-T010, M4-T020
**Estimate**: 6 hours

**Description**:
Design the JSON schema and TypeScript types for loop container nodes. Must support both sequential and parallel modes, concurrency limits, and progress tracking.

**Acceptance Criteria**:
- [ ] Loop container node type defined in schema (extends base node)
- [ ] Properties: `loopType` (sequential, parallel), `concurrency` (1-10), `inputSource` (variable reference)
- [ ] Child nodes can be nested inside loop container
- [ ] Loop state variables: `item`, `index`, `total`, `completed`
- [ ] TypeScript types in `src/types/workflow-nodes.ts`
- [ ] Can serialize/deserialize loop container with 5+ child activities
- [ ] Validation: loop must have exactly 1 input source, concurrency 1-10

**Testing Requirements**:
- [ ] Unit tests for schema validation
- [ ] Test loop container with sequential/parallel modes
- [ ] Test validation catches invalid concurrency (0, 11, -1)
- [ ] Test loop container with nested nodes

**Completion Requirements**:
- [ ] Code committed to `feature/milestone-4-batch-processing` branch
- [ ] All tests passing
- [ ] Type checking passes
- [ ] Schema documentation updated

**Deliverables**:
- `src/types/workflow-nodes.ts` (updated with LoopContainerNode type)
- `src/lib/validation/loop-schema.ts` (loop-specific validation)
- `tests/unit/schema/loop-container.test.ts`
- `docs/architecture/loop-container-schema.md`

---

#### M4-T002: Implement sequential loop pattern compiler
**Owner**: Backend Engineer 1
**Dependencies**: M4-T001
**Parallel with**: M4-T011, M4-T021
**Estimate**: 12 hours

**Description**:
Build compiler pattern for sequential loops (for-of loop in generated TypeScript). This is the foundation before adding concurrency control.

**Acceptance Criteria**:
- [ ] Compiles loop container to TypeScript `for (const item of items)` loop
- [ ] Loop body contains compiled child activities
- [ ] Each iteration has access to: `item`, `index`, `total`
- [ ] Progress updates after each iteration
- [ ] Handles empty arrays (no iterations)
- [ ] Handles single-item arrays
- [ ] Handles arrays with 100+ items (tested)
- [ ] Generated code follows Temporal deterministic requirements
- [ ] Error in one iteration stops loop (fail-fast by default)

**Testing Requirements**:
- [ ] Unit test: Compile loop with 1 activity child
- [ ] Unit test: Compile loop with 3 activity children (nested sequence)
- [ ] Integration test: Execute loop with 5 items, verify all complete
- [ ] Integration test: Execute loop with 100 items, verify performance
- [ ] Integration test: Force error in iteration 3, verify loop stops
- [ ] Test generated code compiles with TypeScript

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Generated code is deterministic (no Date.now(), Math.random())
- [ ] Code review completed

**Deliverables**:
- `src/lib/workflow-compiler/patterns/sequential-loop.ts`
- `src/lib/workflow-compiler/patterns/loop-state.ts` (loop state management)
- `tests/unit/compiler/sequential-loop.test.ts`
- `tests/integration/compiler/loop-execution.test.ts`
- `docs/architecture/sequential-loop-pattern.md`

---

#### M4-T003: Implement loop input source resolver
**Owner**: Backend Engineer 2
**Dependencies**: M4-T001
**Parallel with**: M4-T002, M4-T011
**Estimate**: 8 hours

**Description**:
Build system to resolve loop input sources (workflow variables, activity results, static arrays) and validate they are iterable.

**Acceptance Criteria**:
- [ ] Can resolve loop input from workflow variable (e.g., `state.users`)
- [ ] Can resolve loop input from previous activity result
- [ ] Can resolve loop input from static array in workflow definition
- [ ] Validates input is an array at runtime
- [ ] Throws helpful error if input is not iterable (string, number, object)
- [ ] Supports TypeScript generics for type safety (Array<T>)
- [ ] Handles undefined/null input gracefully (treat as empty array)
- [ ] Logs loop size for monitoring (e.g., "Processing 50 items")

**Testing Requirements**:
- [ ] Unit test: Resolve variable input source
- [ ] Unit test: Resolve activity result input source
- [ ] Unit test: Resolve static array input source
- [ ] Integration test: Execute loop with variable input (100 items)
- [ ] Test error handling for non-array input
- [ ] Test empty array handling

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Error messages are user-friendly
- [ ] Documentation complete

**Deliverables**:
- `src/lib/workflow-compiler/input-resolver.ts`
- `src/lib/workflow-compiler/validators/loop-input-validator.ts`
- `tests/unit/compiler/input-resolver.test.ts`
- `tests/integration/compiler/loop-input-resolution.test.ts`

---

### Frontend Tasks - Loop Container UI

#### M4-T010: Design and implement loop container node UI
**Owner**: Frontend Engineer 1
**Dependencies**: None (starts from existing canvas)
**Parallel with**: M4-T001, M4-T020
**Estimate**: 16 hours

**Description**:
Create visual loop container component that acts as a "container" for child nodes on the canvas.

**Acceptance Criteria**:
- [ ] Loop container appears as expandable box on canvas (similar to swimlane)
- [ ] Can drag activity nodes inside loop container
- [ ] Can drag activity nodes out of loop container
- [ ] Container visually highlights when dragging nodes over it
- [ ] Container shows loop icon and input source label
- [ ] Container shows concurrency setting (e.g., "Parallel (4x)")
- [ ] Nested nodes are visually indented/grouped
- [ ] Cannot nest loop containers (validation prevents)
- [ ] Container resizes based on child node count
- [ ] Canvas handles scrolling for large loop containers (10+ children)

**Testing Requirements**:
- [ ] E2E test: Drag activity into loop container
- [ ] E2E test: Drag activity out of loop container
- [ ] E2E test: Cannot nest loop inside loop
- [ ] E2E test: Container resizes with 1, 5, 10 children
- [ ] Unit test: Container calculates bounds correctly
- [ ] Test visual feedback during drag operations

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is accessible (keyboard navigation)
- [ ] Design review approved

**Deliverables**:
- `src/components/workflow/nodes/LoopContainerNode.tsx`
- `src/components/workflow/LoopContainerBounds.tsx`
- `src/lib/canvas/loop-container-layout.ts` (auto-layout logic)
- `tests/e2e/loop-container/drag-drop.spec.ts`
- `tests/unit/canvas/loop-layout.test.ts`

---

#### M4-T011: Create loop configuration panel
**Owner**: Frontend Engineer 1
**Dependencies**: M4-T010
**Parallel with**: M4-T002, M4-T003, M4-T021
**Estimate**: 12 hours

**Description**:
Build property panel for configuring loop container: input source, loop type (sequential/parallel), concurrency limit.

**Acceptance Criteria**:
- [ ] Panel shows when loop container is selected
- [ ] Input source selector (dropdown of available arrays)
- [ ] Loop type toggle: Sequential vs Parallel (with descriptions)
- [ ] Concurrency slider (1-10, only enabled for parallel mode)
- [ ] Concurrency slider shows "1x", "2x", "4x", "10x" labels
- [ ] Visual indicator shows expected speedup (e.g., "~4x faster")
- [ ] Preview shows loop iteration structure
- [ ] Real-time validation (input source must be array)
- [ ] Help tooltips explain sequential vs parallel tradeoffs
- [ ] Changes auto-save

**Testing Requirements**:
- [ ] E2E test: Configure loop input source
- [ ] E2E test: Toggle between sequential and parallel
- [ ] E2E test: Adjust concurrency slider (1, 4, 10)
- [ ] E2E test: Parallel mode disables when sequential selected
- [ ] Test validation shows error for invalid input source
- [ ] Test help tooltips render correctly

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is accessible
- [ ] UX review approved

**Deliverables**:
- `src/components/workflow/forms/LoopConfigForm.tsx`
- `src/components/workflow/forms/ConcurrencySlider.tsx`
- `src/components/workflow/forms/LoopTypeToggle.tsx`
- `tests/e2e/loop-container/config-panel.spec.ts`
- `tests/unit/forms/loop-config.test.ts`

---

### DevOps Tasks

#### M4-T020: Set up performance monitoring infrastructure
**Owner**: DevOps Engineer
**Dependencies**: None
**Parallel with**: M4-T001, M4-T010
**Estimate**: 12 hours

**Description**:
Set up infrastructure for monitoring workflow execution performance: metrics, traces, resource usage.

**Acceptance Criteria**:
- [ ] Application Performance Monitoring (APM) configured (DataDog, New Relic, or open-source)
- [ ] Custom metrics for loop execution: iteration count, duration, concurrency
- [ ] Database query performance monitoring (slow query log)
- [ ] Memory usage tracking during loop execution
- [ ] Temporal workflow execution traces visible
- [ ] Dashboards for key metrics: p50, p95, p99 latency
- [ ] Alerts for high memory usage (>1GB per workflow)
- [ ] Alerts for slow executions (>1min for 100 items)

**Testing Requirements**:
- [ ] Test: Execute loop with 100 items, verify metrics captured
- [ ] Test: Force slow execution, verify alert triggers
- [ ] Test: Dashboard displays all key metrics
- [ ] Test: Traces show individual iteration timing

**Completion Requirements**:
- [ ] Monitoring infrastructure deployed
- [ ] Documentation complete
- [ ] Team trained on using dashboards

**Deliverables**:
- `docker-compose.yml` (updated with monitoring services)
- `config/monitoring/apm-config.yml`
- `config/monitoring/dashboards/` (JSON dashboard definitions)
- `docs/operations/performance-monitoring.md`

---

## Phase 2: Concurrency Control (Weeks 20-21)
**Goal**: Implement parallel loop pattern with Promise.race() and slot management

### Backend Tasks - Concurrency Control (HIGH COMPLEXITY)

#### M4-T030: Implement concurrency control pattern compiler
**Owner**: Backend Engineer 1
**Dependencies**: M4-T002 (sequential loop foundation)
**Parallel with**: M4-T031
**Estimate**: 20 hours ⚠️ HIGH RISK - May take 30-40h

**Description**:
Build compiler for parallel loop pattern using Promise.race() with concurrency limits. This is the MOST COMPLEX task in Milestone 4.

**Pattern to Generate**:
```typescript
const maxConcurrent = 4;
const activeJobs = new Map<number, Promise<void>>();
const items = [/* 1000 items */];

for (let i = 0; i < items.length; i++) {
  // Wait if at capacity
  while (activeJobs.size >= maxConcurrent) {
    const completed = await Promise.race(
      Array.from(activeJobs.entries()).map(async ([idx, promise]) => {
        await promise;
        return idx;
      })
    );
    activeJobs.delete(completed);
  }

  // Start new job
  const job = processItem(items[i], i);
  activeJobs.set(i, job);
}

// Wait for remaining
while (activeJobs.size > 0) {
  const completed = await Promise.race(
    Array.from(activeJobs.entries()).map(async ([idx, promise]) => {
      await promise;
      return idx;
    })
  );
  activeJobs.delete(completed);
}
```

**Acceptance Criteria**:
- [ ] Generates while loop with Promise.race() for concurrency control
- [ ] Slot management using Map (tracks active jobs)
- [ ] Waits for any job to complete when at capacity (fills available slot)
- [ ] Drains remaining jobs after loop (final while loop)
- [ ] Each iteration executes child activities with proper context (item, index)
- [ ] Progress tracking updates after each completion (not each start)
- [ ] Handles errors in individual iterations (continue or stop based on config)
- [ ] Generated code is deterministic (Temporal-safe)
- [ ] Memory-efficient (doesn't load all promises at once)
- [ ] Concurrency limit is respected exactly (never exceeds maxConcurrent)

**Testing Requirements**:
- [ ] Unit test: Compile parallel loop with concurrency 1 (same as sequential)
- [ ] Unit test: Compile parallel loop with concurrency 4
- [ ] Unit test: Compile parallel loop with concurrency 10
- [ ] Integration test: Execute 100 items with concurrency 4, verify exactly 4 run at a time
- [ ] Integration test: Force error in iteration 30, verify other iterations continue
- [ ] Integration test: Measure speedup (4x concurrency should be ~3-4x faster)
- [ ] Load test: Execute 1000 items with concurrency 10, verify completion
- [ ] Memory test: 1000 items does not exceed 500MB memory
- [ ] Test generated code compiles with TypeScript

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Performance benchmarks documented
- [ ] Code review by senior engineer (complexity warrants extra review)
- [ ] Temporal workflow testing in local cluster

**Deliverables**:
- `src/lib/workflow-compiler/patterns/parallel-loop.ts`
- `src/lib/workflow-compiler/patterns/concurrency-control.ts`
- `src/lib/workflow-compiler/patterns/promise-race-pattern.ts`
- `tests/unit/compiler/parallel-loop.test.ts`
- `tests/integration/compiler/concurrency-control.test.ts`
- `tests/performance/parallel-loop-benchmark.test.ts`
- `docs/architecture/concurrency-control-pattern.md`
- `docs/architecture/promise-race-implementation.md`

**Risk Mitigation**:
- Start this task early (beginning of Week 20)
- Daily check-ins with Backend Engineer 1
- Have Backend Engineer 2 as backup if blocked
- Fallback: Ship with sequential-only for demo, add parallel in Week 24

---

#### M4-T031: Implement error handling strategies for loops
**Owner**: Backend Engineer 2
**Dependencies**: M4-T002 (sequential loop)
**Parallel with**: M4-T030
**Estimate**: 10 hours

**Description**:
Build error handling strategies for loops: fail-fast, continue-on-error, retry-failed-items.

**Acceptance Criteria**:
- [ ] Strategy 1: Fail-fast - stop on first error (default)
- [ ] Strategy 2: Continue - log error, continue to next item
- [ ] Strategy 3: Retry - retry failed item N times before continuing
- [ ] Error tracking: collects all errors with item index
- [ ] Final error report: shows success count, failure count, error details
- [ ] Configurable via loop container properties
- [ ] Compatible with both sequential and parallel modes
- [ ] Errors include item data for debugging (up to 1KB)

**Testing Requirements**:
- [ ] Test fail-fast: Force error on item 5 of 10, verify stops at 5
- [ ] Test continue: Force errors on items 2, 5, 8, verify all 10 process
- [ ] Test retry: Force error with retry=3, verify 3 attempts before giving up
- [ ] Test error report includes correct counts and details
- [ ] Test with parallel loop (errors still tracked correctly)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Error messages are actionable
- [ ] Documentation complete

**Deliverables**:
- `src/lib/workflow-compiler/patterns/loop-error-handling.ts`
- `src/lib/execution/loop-error-strategies.ts`
- `tests/unit/compiler/loop-error-handling.test.ts`
- `tests/integration/execution/loop-error-strategies.test.ts`
- `docs/user-guide/loop-error-handling.md`

---

### Backend Tasks - Progress Tracking

#### M4-T032: Implement real-time progress tracking for loops
**Owner**: Backend Engineer 2
**Dependencies**: M4-T030 (concurrency control)
**Parallel with**: M4-T040
**Estimate**: 16 hours

**Description**:
Build system to track loop execution progress in real-time and expose via API for UI updates.

**Acceptance Criteria**:
- [ ] Progress tracking: completed count, total count, percentage
- [ ] Tracks progress per loop container (supports nested loops in future)
- [ ] Updates database after each batch completion (not every item - performance)
- [ ] Batch size configurable (default: update every 10 items or 1 second)
- [ ] Exposes progress via tRPC query (polling-friendly)
- [ ] Progress includes: ETA, items/second rate, elapsed time
- [ ] Handles long-running loops (hours) without database bloat
- [ ] Progress survives workflow restarts (continue-as-new in M6)
- [ ] Cleanup: removes progress data after workflow completes (retention: 24h)

**Testing Requirements**:
- [ ] Integration test: Execute loop with 100 items, verify progress updates
- [ ] Test progress updates in batches (not every item)
- [ ] Test ETA calculation is accurate (within 10% error)
- [ ] Test items/second rate calculation
- [ ] Load test: 1000 items, verify progress tracking doesn't degrade performance
- [ ] Test progress API returns correct data at different stages

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Performance benchmarks met (<5% overhead)
- [ ] API documentation updated

**Deliverables**:
- `src/lib/execution/loop-progress-tracker.ts`
- `src/server/api/routers/loop-progress.ts` (tRPC endpoints)
- `src/lib/database/loop-progress-storage.ts` (database layer)
- `tests/integration/execution/loop-progress.test.ts`
- `tests/performance/progress-tracking-overhead.test.ts`
- `docs/api/loop-progress.md`

---

### Frontend Tasks - Progress Visualization

#### M4-T040: Build loop execution progress UI
**Owner**: Frontend Engineer 1
**Dependencies**: M4-T032 (progress tracking API)
**Parallel with**: M4-T032
**Estimate**: 14 hours

**Description**:
Create UI component to visualize loop execution progress in real-time.

**Acceptance Criteria**:
- [ ] Progress bar with percentage (0-100%)
- [ ] Shows completed / total items (e.g., "45 / 100")
- [ ] Shows items/second rate (e.g., "5.2 items/sec")
- [ ] Shows ETA (e.g., "~2 minutes remaining")
- [ ] Shows elapsed time
- [ ] For parallel loops: shows concurrency (e.g., "4 concurrent")
- [ ] Progress bar color changes: blue (running), green (complete), red (errors)
- [ ] Error count badge if errors occurred
- [ ] Polls for updates every 1 second during execution
- [ ] Stops polling when execution completes
- [ ] Handles long-running loops (hours) - doesn't freeze UI

**Testing Requirements**:
- [ ] E2E test: Execute loop, watch progress bar fill
- [ ] E2E test: Progress reaches 100% on completion
- [ ] E2E test: ETA updates and becomes accurate over time
- [ ] E2E test: Polling starts on execution, stops on completion
- [ ] Test handles errors during execution (shows error count)
- [ ] Test UI doesn't freeze with rapid updates

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is accessible
- [ ] Performance review (no memory leaks from polling)

**Deliverables**:
- `src/components/execution/LoopProgressBar.tsx`
- `src/components/execution/LoopProgressStats.tsx`
- `src/hooks/useLoopProgress.ts` (polling hook)
- `tests/e2e/execution/loop-progress.spec.ts`
- `tests/unit/components/loop-progress.test.ts`

---

#### M4-T041: Build loop execution history viewer
**Owner**: Frontend Engineer 1
**Dependencies**: M4-T040
**Parallel with**: M4-T050
**Estimate**: 10 hours

**Description**:
Create UI to view completed loop executions with per-item results.

**Acceptance Criteria**:
- [ ] Table showing all items processed
- [ ] Columns: Index, Item (truncated), Status (success/error), Duration
- [ ] Pagination for large loops (100+ items)
- [ ] Filter by status (all, success, error)
- [ ] Search by item data (JSON search)
- [ ] Click item row to see full details (input, output, error)
- [ ] Export results as CSV
- [ ] Visual indicators for failed items (red highlight)
- [ ] Supports 1000+ items without UI lag

**Testing Requirements**:
- [ ] E2E test: Execute loop with 50 items, view history table
- [ ] E2E test: Filter by errors only
- [ ] E2E test: Search for specific item
- [ ] E2E test: Pagination works with 200 items
- [ ] E2E test: Export to CSV
- [ ] Performance test: Render 1000 items (virtual scrolling)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is accessible
- [ ] Virtual scrolling implemented for performance

**Deliverables**:
- `src/components/execution/LoopHistoryTable.tsx`
- `src/components/execution/LoopItemDetailModal.tsx`
- `src/lib/export/loop-results-csv.ts` (CSV export)
- `tests/e2e/execution/loop-history.spec.ts`
- `tests/unit/components/loop-history.test.ts`

---

## Phase 3: Performance Testing & Optimization (Week 22)
**Goal**: Validate system handles 1000+ items efficiently, optimize bottlenecks

### Performance Testing Tasks (CRITICAL FOR MILESTONE 4)

#### M4-T050: Create performance test suite
**Owner**: QA Engineer
**Dependencies**: M4-T030 (concurrency control), M4-T032 (progress tracking)
**Parallel with**: M4-T041, M4-T051
**Estimate**: 16 hours

**Description**:
Create comprehensive performance test suite to validate loop execution at scale.

**Test Scenarios**:
1. **Small Loop**: 10 items, sequential → Baseline
2. **Medium Loop**: 100 items, sequential → Should complete in <30s
3. **Large Loop**: 1000 items, sequential → Should complete in <5min
4. **Parallel 4x**: 100 items, concurrency 4 → Should be ~3-4x faster than sequential
5. **Parallel 10x**: 100 items, concurrency 10 → Should be ~8-10x faster
6. **High Concurrency Stress**: 1000 items, concurrency 10 → Must handle without memory issues
7. **Error Recovery**: 100 items, 20% error rate, retry → Verify all retries complete
8. **Long-Running**: 500 items, 1s each → Verify progress tracking accuracy

**Acceptance Criteria**:
- [ ] All 8 test scenarios pass with documented benchmarks
- [ ] Performance regression tests (fails if 20% slower than baseline)
- [ ] Memory usage stays under 1GB for 1000 items
- [ ] Database query count stays under 100 for 100-item loop
- [ ] Progress updates complete within 100ms
- [ ] No memory leaks detected (heap snapshots before/after)
- [ ] Tests run in CI with performance budgets
- [ ] Tests generate performance report (charts, tables)

**Testing Requirements**:
- [ ] Run all scenarios 3 times, average results
- [ ] Measure: total time, memory peak, DB query count, CPU usage
- [ ] Compare parallel vs sequential speedup (must be >70% of theoretical)
- [ ] Identify bottlenecks using profiling
- [ ] Test on production-like hardware (not just local dev)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Performance report generated
- [ ] Bottlenecks identified and documented
- [ ] Team review of results

**Deliverables**:
- `tests/performance/loop-execution-benchmarks.test.ts`
- `tests/performance/concurrency-scaling.test.ts`
- `tests/performance/memory-usage.test.ts`
- `scripts/performance/run-benchmarks.sh`
- `docs/performance/milestone-4-benchmarks.md`
- Performance report (PDF/HTML with charts)

---

#### M4-T051: Performance optimization based on test results
**Owner**: Backend Engineer 1 + Backend Engineer 2
**Dependencies**: M4-T050 (performance tests must run first)
**Parallel with**: M4-T052
**Estimate**: 20 hours (depends on issues found)

**Description**:
Optimize bottlenecks identified in performance testing. This is a buffer task for performance issues.

**Common Optimizations** (based on likely bottlenecks):
1. **Database Query Optimization**
   - Batch progress updates (every 10 items instead of every item)
   - Use connection pooling
   - Index optimization for progress queries
   - Reduce payload size (don't store full item data)

2. **Memory Optimization**
   - Stream large arrays instead of loading all at once
   - Clear completed job references from Map
   - Limit progress history retention (last 1000 items)

3. **Temporal Optimization**
   - Reduce workflow history size (fewer update calls)
   - Use signals for progress instead of database polling
   - Consider child workflows for very large loops (M5 preview)

**Acceptance Criteria**:
- [ ] All performance benchmarks meet targets (see M4-T050)
- [ ] Memory usage reduced by >30% if initially over budget
- [ ] Database query count reduced by >50% if initially over 100
- [ ] Parallel speedup improved to >70% of theoretical max
- [ ] No regressions in functionality (all tests still pass)
- [ ] Optimizations documented with before/after metrics

**Testing Requirements**:
- [ ] Re-run performance test suite after each optimization
- [ ] Verify functionality tests still pass
- [ ] Load test: 5000 items (stretch goal)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Performance targets met
- [ ] Code review completed

**Deliverables**:
- Optimized code (various files)
- `docs/performance/optimization-report.md` (before/after metrics)
- Updated performance benchmarks

**Risk Mitigation**:
- Start performance testing early (beginning of Week 22)
- If major issues found, escalate immediately
- Fallback: Reduce demo scope to 100 items instead of 1000

---

### Load Testing Tasks

#### M4-T052: Set up load testing infrastructure
**Owner**: DevOps Engineer
**Dependencies**: M4-T050
**Parallel with**: M4-T051
**Estimate**: 12 hours

**Description**:
Set up infrastructure to simulate real-world load on loop execution system.

**Acceptance Criteria**:
- [ ] Load testing tool configured (k6, Artillery, or JMeter)
- [ ] Can simulate 10 concurrent workflow executions
- [ ] Can simulate 50 concurrent workflow executions (stress test)
- [ ] Each workflow processes 100-1000 items
- [ ] Monitoring dashboards show real-time load metrics
- [ ] Database connection pool sized correctly for load
- [ ] Temporal cluster scaled for load (worker count)
- [ ] Results stored for comparison over time

**Testing Requirements**:
- [ ] Test: 10 concurrent workflows with 100 items each (1000 total items)
- [ ] Test: 50 concurrent workflows with 100 items each (5000 total items)
- [ ] Measure: throughput (items/sec), error rate, latency (p95, p99)
- [ ] Identify breaking point (when system starts to fail)

**Completion Requirements**:
- [ ] Infrastructure deployed
- [ ] Load tests run successfully
- [ ] Results documented
- [ ] Team trained on running load tests

**Deliverables**:
- `tests/load/loop-execution-load.k6.js`
- `tests/load/concurrent-workflows-load.k6.js`
- `scripts/load/run-load-tests.sh`
- `docs/operations/load-testing-guide.md`
- Load test results report

---

## Phase 4: Demo Preparation (Week 23)
**Goal**: Prepare demo, documentation, and training materials

### Demo Preparation Tasks

#### M4-T060: Create demo workflow examples
**Owner**: Backend Engineer 2 + QA Engineer
**Dependencies**: M4-T051 (optimization complete)
**Parallel with**: M4-T061, M4-T062
**Estimate**: 8 hours

**Description**:
Create 3-5 example workflows that showcase Milestone 4 batch processing capabilities.

**Acceptance Criteria**:
- [ ] Example 1: Bulk email sender (100 users, sequential)
- [ ] Example 2: Multi-package build (20 packages, parallel 4x)
- [ ] Example 3: Data migration (1000 records, parallel 10x)
- [ ] Example 4: API batch processor (500 API calls, concurrency 5x, with retries)
- [ ] Each example has realistic mock data
- [ ] Examples demonstrate different concurrency levels
- [ ] Examples show error handling (some items fail intentionally)
- [ ] Examples can be imported via seed script
- [ ] Examples execute successfully in <5 minutes each

**Testing Requirements**:
- [ ] Test: Import all examples successfully
- [ ] Test: Execute all examples end-to-end
- [ ] Test: Examples showcase variety of features (sequential, parallel, errors)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Examples tested and working
- [ ] Documentation complete

**Deliverables**:
- `examples/milestone-4/bulk-email-sender.json`
- `examples/milestone-4/multi-package-build.json`
- `examples/milestone-4/data-migration.json`
- `examples/milestone-4/api-batch-processor.json`
- `scripts/seed-milestone-4-demos.ts`
- `docs/examples/milestone-4-demos.md`

---

#### M4-T061: Write user documentation
**Owner**: Frontend Engineer 1 + Backend Engineer 1
**Dependencies**: M4-T051
**Parallel with**: M4-T060, M4-T062
**Estimate**: 12 hours

**Description**:
Create comprehensive user documentation for batch processing workflows.

**Acceptance Criteria**:
- [ ] Loop container guide (how to create, configure)
- [ ] Sequential vs parallel guide (when to use each)
- [ ] Concurrency tuning guide (how to choose concurrency limit)
- [ ] Error handling guide (fail-fast vs continue)
- [ ] Performance best practices (batch size, input source optimization)
- [ ] Troubleshooting guide (common issues: memory, slow execution)
- [ ] Video walkthrough (7-10 minutes)
- [ ] All documentation has screenshots and examples

**Testing Requirements**:
- [ ] Have non-team member follow guide and provide feedback
- [ ] Verify all code examples execute correctly
- [ ] Verify all screenshots are up-to-date

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Feedback incorporated

**Deliverables**:
- `docs/user-guide/batch-processing.md`
- `docs/user-guide/loop-containers.md`
- `docs/user-guide/concurrency-control.md`
- `docs/user-guide/batch-performance-tuning.md`
- `docs/user-guide/batch-troubleshooting.md`
- `docs/user-guide/video-batch-processing.mp4`

---

#### M4-T062: Create developer/API documentation
**Owner**: Backend Engineer 1 + Backend Engineer 2
**Dependencies**: M4-T051
**Parallel with**: M4-T060, M4-T061
**Estimate**: 8 hours

**Description**:
Create developer documentation for loop compilation, concurrency patterns, and performance tuning.

**Acceptance Criteria**:
- [ ] Loop compiler architecture document
- [ ] Promise.race() pattern explanation (with diagrams)
- [ ] Concurrency control algorithm documentation
- [ ] Progress tracking API reference
- [ ] Performance tuning guide for developers
- [ ] Code examples for extending loop patterns
- [ ] Database schema documentation for loop progress

**Testing Requirements**:
- [ ] Test all code examples execute correctly
- [ ] Verify API documentation matches implementation
- [ ] Peer review by senior engineer

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Documentation versioned

**Deliverables**:
- `docs/architecture/loop-compiler.md`
- `docs/architecture/concurrency-control-algorithm.md`
- `docs/architecture/promise-race-pattern.md`
- `docs/api/loop-progress-api.md`
- `docs/development/performance-tuning.md`

---

#### M4-T063: Prepare demo script and environment
**Owner**: QA Engineer + DevOps Engineer
**Dependencies**: M4-T060, M4-T061
**Parallel with**: None (final task)
**Estimate**: 8 hours

**Description**:
Prepare stable demo environment and rehearse demo script for Week 24 stakeholder presentation.

**Acceptance Criteria**:
- [ ] Demo environment deployed with examples pre-seeded
- [ ] Demo script written (5-point demo from roadmap)
- [ ] Demo rehearsed with timing (15 minutes total)
- [ ] Performance monitoring enabled for demo
- [ ] Backup plan if live demo fails (recording)
- [ ] Q&A talking points prepared
- [ ] Success metrics prepared (throughput, speedup, items processed)

**Testing Requirements**:
- [ ] Run demo script 3+ times successfully
- [ ] Test demo environment is stable (no crashes)
- [ ] Have backup recording ready

**Completion Requirements**:
- [ ] Demo environment stable
- [ ] Team rehearsed and confident
- [ ] Backup materials ready

**Deliverables**:
- `docs/demo/milestone-4-script.md`
- `docs/demo/talking-points.md`
- `docs/demo/success-metrics.md`
- Demo environment URL
- Backup demo recording

---

## Phase 5: Buffer & Final Polish (Week 24)
**Goal**: Address issues found in Week 23, final polish, prepare for demo

### Buffer Tasks

#### M4-T070: Bug fixes and issue resolution
**Owner**: All engineers
**Dependencies**: M4-T063
**Parallel with**: M4-T071
**Estimate**: 40 hours (distributed across team)

**Description**:
Address all bugs and issues found during Week 23 testing and rehearsals.

**Acceptance Criteria**:
- [ ] All critical bugs fixed (P0)
- [ ] All high-priority bugs fixed (P1)
- [ ] Medium-priority bugs triaged (fix or defer to M5)
- [ ] No known blockers for demo
- [ ] Regression testing passed
- [ ] Performance targets still met after bug fixes

**Testing Requirements**:
- [ ] All existing tests still pass
- [ ] New tests added for bug fixes
- [ ] Performance tests re-run (no regressions)
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

#### M4-T071: Final demo preparation and rehearsal
**Owner**: All team members
**Dependencies**: M4-T063, M4-T070
**Parallel with**: None (final task before demo)
**Estimate**: 8 hours (team activity)

**Description**:
Final team rehearsal, polish demo environment, prepare presentation materials.

**Acceptance Criteria**:
- [ ] Demo runs smoothly start to finish
- [ ] All team members can present sections
- [ ] Presentation slides prepared (if needed)
- [ ] Success metrics compiled (items processed, speedup achieved)
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
Week 19 (Foundation - All Parallel):
├─ M4-T001 (Loop Schema)
│  ├─ M4-T002 (Sequential Loop Compiler)
│  └─ M4-T003 (Input Resolver)
├─ M4-T010 (Loop Container UI)
│  └─ M4-T011 (Loop Config Panel)
└─ M4-T020 (Performance Monitoring)

Week 20-21 (Concurrency - CRITICAL):
├─ M4-T030 (Concurrency Control) [depends: T002] ⚠️ HIGH RISK
├─ M4-T031 (Error Handling) [depends: T002]
└─ M4-T032 (Progress Tracking) [depends: T030]

Week 21-22 (UI + Performance):
├─ M4-T040 (Progress UI) [depends: T032]
├─ M4-T041 (History Viewer) [depends: T040]
├─ M4-T050 (Performance Tests) [depends: T030, T032] ⚠️ CRITICAL
├─ M4-T051 (Optimization) [depends: T050]
└─ M4-T052 (Load Testing) [depends: T050]

Week 23 (Demo Prep):
├─ M4-T060 (Demo Examples) [depends: T051]
├─ M4-T061 (User Docs) [depends: T051]
├─ M4-T062 (Dev Docs) [depends: T051]
└─ M4-T063 (Demo Script) [depends: T060, T061]

Week 24 (Buffer):
├─ M4-T070 (Bug Fixes) [depends: T063]
└─ M4-T071 (Final Rehearsal) [depends: T063, T070]
```

### Critical Path (76 hours = ~2 weeks)

```
M4-T001 (6h)
  → M4-T002 (12h)
    → M4-T030 (20h) ⚠️ BOTTLENECK
      → M4-T032 (16h)
        → M4-T050 (16h)
          → M4-T051 (20h)

Total: 90 hours (2.25 weeks with 40h/week)
```

**This is your critical path. Any delays here push the entire milestone.**

---

## Weekly Timeline with Team Assignments

### Week 19: Foundation (Sequential Loop)

**Backend Team**:
- BE1: M4-T001 (Loop Schema) - 6h
- BE1: M4-T002 (Sequential Loop Compiler) - 12h
- BE2: M4-T003 (Input Resolver) - 8h
- BE2: Start M4-T031 (Error Handling) - 8h
**Total**: 34 hours

**Frontend Team**:
- FE1: M4-T010 (Loop Container UI) - 16h
- FE1: M4-T011 (Loop Config Panel) - 12h
**Total**: 28 hours

**DevOps Team**:
- DevOps: M4-T020 (Performance Monitoring) - 12h
- DevOps: Infrastructure preparation for load testing - 8h
**Total**: 20 hours

**End of Week 19 Deliverables**:
- Sequential loop pattern works
- Loop container UI functional
- Performance monitoring operational
- Team ready for concurrency implementation

---

### Week 20: Concurrency Control (HIGH RISK WEEK)

**Backend Team**:
- BE1: M4-T030 (Concurrency Control) - 20h ⚠️ FOCUS
- BE1: Support with M4-T032 if ahead of schedule - 8h
- BE2: Complete M4-T031 (Error Handling) - 8h
- BE2: Start M4-T032 (Progress Tracking) - 10h
**Total**: 46 hours (both engineers working full week + overtime)

**Frontend Team**:
- FE1: Prepare for M4-T040 (study progress API) - 8h
- FE1: Polish M4-T011 based on feedback - 8h
**Total**: 16 hours (lighter week, waiting for backend)

**DevOps Team**:
- DevOps: Support backend with Temporal scaling - 8h
- DevOps: Prepare load testing infrastructure - 8h
**Total**: 16 hours

**End of Week 20 Deliverables**:
- Concurrency control pattern compiles correctly
- Promise.race() implementation working
- Error handling strategies implemented
- Progress tracking started

---

### Week 21: Progress & UI Integration

**Backend Team**:
- BE1: Complete M4-T030 if needed (buffer) - 8h
- BE1: Support M4-T050 preparation - 8h
- BE2: Complete M4-T032 (Progress Tracking) - 16h
**Total**: 32 hours

**Frontend Team**:
- FE1: M4-T040 (Progress UI) - 14h
- FE1: M4-T041 (History Viewer) - 10h
**Total**: 24 hours

**DevOps Team**:
- DevOps: Complete M4-T052 (Load Testing Infra) - 12h
- DevOps: Deploy staging environment - 8h
**Total**: 20 hours

**QA Team**:
- QA: Start M4-T050 (Performance Tests) - 16h
**Total**: 16 hours

**End of Week 21 Deliverables**:
- Progress tracking API complete
- Progress UI showing real-time updates
- Load testing infrastructure ready
- Performance test suite started

---

### Week 22: Performance Testing & Optimization (CRITICAL WEEK)

**Backend Team**:
- BE1: M4-T051 (Optimization) - 16h
- BE2: M4-T051 (Optimization) - 16h
**Total**: 32 hours (both engineers focused on performance)

**Frontend Team**:
- FE1: Complete M4-T041 if needed - 4h
- FE1: UI performance optimization - 8h
- FE1: Bug fixes from testing - 8h
**Total**: 20 hours

**DevOps Team**:
- DevOps: Run load tests - 8h
- DevOps: Performance tuning (DB, Temporal) - 8h
**Total**: 16 hours

**QA Team**:
- QA: Complete M4-T050 (Performance Tests) - 16h
- QA: Run M4-T052 (Load Testing) - 8h
- QA: Document performance results - 4h
**Total**: 28 hours

**End of Week 22 Deliverables**:
- All performance tests passing
- Performance targets met
- Load testing complete
- Bottlenecks identified and fixed
- System validated for 1000+ items

---

### Week 23: Demo Preparation

**Backend Team**:
- BE1: M4-T062 (Dev Docs) - 8h
- BE1: M4-T061 (User Docs) - 4h
- BE2: M4-T060 (Demo Examples) - 8h
- BE2: Bug fixes - 8h
**Total**: 28 hours

**Frontend Team**:
- FE1: M4-T061 (User Docs) - 8h
- FE1: Record demo video - 4h
- FE1: Bug fixes - 8h
**Total**: 20 hours

**QA Team**:
- QA: M4-T060 (Demo Examples) - 4h
- QA: M4-T063 (Demo Script) - 8h
- QA: Final testing - 8h
**Total**: 20 hours

**DevOps Team**:
- DevOps: M4-T063 (Demo Environment) - 8h
- DevOps: Final infrastructure checks - 4h
**Total**: 12 hours

**End of Week 23 Deliverables**:
- Demo workflows created and tested
- User and developer documentation complete
- Demo script rehearsed
- Demo environment stable
- Team ready to demo

---

### Week 24: Buffer & Demo

**All Team**:
- M4-T070 (Bug Fixes) - 20h distributed
- M4-T071 (Final Rehearsal) - 8h team activity
- Buffer for unexpected issues - 12h

**Demo Day** (End of Week 24):
- Present to stakeholders
- Show 5-point demo from roadmap
- Gather feedback for Milestone 5

**End of Week 24 Deliverables**:
- Milestone 4 complete
- Demo successful
- Stakeholder feedback collected
- Go/No-Go decision on Milestone 5

---

## Risk Mitigation

### High-Risk Items

1. **Concurrency Control Implementation** (M4-T030) ⚠️ HIGHEST RISK
   - **Risk**: Promise.race() pattern is complex, may take 30-40h instead of 20h
   - **Mitigation**:
     - Start early (Week 20, day 1)
     - Daily pair programming with BE1 and BE2
     - Senior engineer code review
     - Fallback: Ship sequential-only, add parallel in Week 24
   - **Early Warning Signs**: If not compiling by end of Week 20, escalate

2. **Performance at Scale** (M4-T050, M4-T051)
   - **Risk**: System may not handle 1000+ items efficiently
   - **Mitigation**:
     - Start performance testing early (Week 21)
     - Have optimization week (Week 22)
     - Database tuning and query optimization
   - **Fallback**: Reduce demo to 100 items, document 1000-item support as future work

3. **Progress Tracking Overhead** (M4-T032)
   - **Risk**: Progress updates may slow down execution
   - **Mitigation**:
     - Batch updates (every 10 items, not every item)
     - Async progress writes
     - Test overhead in performance suite
   - **Fallback**: Reduce update frequency (every 50 items)

4. **Load Testing Infrastructure** (M4-T052)
   - **Risk**: May not have time to set up comprehensive load tests
   - **Mitigation**:
     - Start infrastructure setup in Week 19
     - Use simple load testing tools (k6) instead of complex ones
   - **Fallback**: Manual load testing with multiple concurrent executions

### Dependencies on External Systems

- **Temporal**: Must handle 1000+ activities in single workflow. Verify workflow history limits.
- **Database**: Connection pooling must support concurrent progress updates.
- **Monitoring**: Performance monitoring must not add overhead.

### Team Availability Risks

- **Key person dependency**: BE1 is critical for M4-T030 (concurrency control)
  - If unavailable, BE2 must step in (training needed)
- **Week 22 is critical**: Performance testing week. Team must be fully available.
- **Buffer**: Week 24 is intentional buffer for unexpected absences

---

## Success Metrics for Milestone 4

### Quantitative Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Workflows with loops created | 10-15 | Count in database |
| Items processed (total) | >10,000 | Sum across all executions |
| Concurrency speedup (4x) | >3x actual | Benchmark: 100 items, 4x vs 1x |
| Concurrency speedup (10x) | >8x actual | Benchmark: 100 items, 10x vs 1x |
| Large loop execution (1000 items) | <5 minutes | Benchmark: 1000 items, 10x concurrency |
| Memory usage (1000 items) | <1GB | Monitoring during execution |
| Progress update overhead | <5% | Compare execution time with/without progress |
| Error handling accuracy | 100% | All errors tracked, correct counts |
| User adoption | 15-20 users | Users who create loop workflows |

### Qualitative Success Criteria

- [ ] **Usable**: Non-technical user can create loop workflow in 15 minutes
- [ ] **Performant**: Parallel execution shows visible speedup
- [ ] **Reliable**: 1000-item loop completes without crashes
- [ ] **Understandable**: Users understand sequential vs parallel tradeoffs
- [ ] **Production-ready**: Can handle production workloads

### Demo Success Criteria (Week 24)

Must successfully demonstrate all 5 points from roadmap:
1. [ ] Create workflow that processes 100 items
2. [ ] Set concurrency to 5 (show concurrency slider)
3. [ ] Run workflow, watch 5 items process in parallel (monitor active count)
4. [ ] Show progress bar filling up (real-time updates)
5. [ ] Show execution completed in ~1/5th the time vs sequential (show comparison)

**Bonus Demo** (if time allows):
6. [ ] Execute workflow with 1000 items, concurrency 10 (show it works at scale)

**If all 5 succeed**: Milestone 4 complete ✓
**If <5 succeed**: Use Week 24 buffer to address issues

---

## Performance Benchmarks (Target Numbers)

### Sequential Loop Benchmarks
| Items | Expected Time | Acceptable Range |
|-------|---------------|------------------|
| 10 | <5s | 3-8s |
| 100 | <30s | 20-45s |
| 1000 | <5min | 3-7min |

### Parallel Loop Benchmarks (Concurrency 4x)
| Items | Expected Time | Speedup vs Sequential |
|-------|---------------|----------------------|
| 100 | <10s | ~3x (75% efficiency) |
| 1000 | <90s | ~3x (75% efficiency) |

### Parallel Loop Benchmarks (Concurrency 10x)
| Items | Expected Time | Speedup vs Sequential |
|-------|---------------|----------------------|
| 100 | <5s | ~6-8x (60-80% efficiency) |
| 1000 | <45s | ~6-8x (60-80% efficiency) |

**Note**: Speedup efficiency decreases with higher concurrency due to overhead. 75% efficiency at 4x is excellent.

### Memory Benchmarks
| Items | Max Memory | Acceptable Range |
|-------|-----------|------------------|
| 100 | <100MB | 50-150MB |
| 1000 | <500MB | 300-800MB |
| 5000 | <1GB | 800MB-1.5GB |

### Database Query Benchmarks
| Items | Max Queries | Notes |
|-------|-------------|-------|
| 100 | <20 | Batch updates every 10 items |
| 1000 | <150 | Batch updates every 10 items |

---

## Handoff to Milestone 5

### Prerequisites for M5 Start

- [ ] All M4 tasks completed (or deferred with documented reason)
- [ ] Demo successful and stakeholder approval received
- [ ] Performance benchmarks met (1000 items in <5 minutes)
- [ ] User feedback collected and documented
- [ ] Known issues triaged (fix in M5 or defer)
- [ ] M4 code merged to main branch
- [ ] M4 documentation published
- [ ] Team retrospective completed

### Lessons Learned Handoff

At end of M4, document:
1. How long did M4-T030 (concurrency control) actually take? (adjust M5 estimates)
2. What performance bottlenecks were found? (inform M5 architecture)
3. What concurrency patterns work best? (reuse in M5)
4. User feedback on loop UI (improve in M5)
5. Team velocity (actual vs. estimated hours)

### Milestone 5 Preview

Based on M4 completion, M5 will add:
- **Child workflow nodes** (spawn workflows from within workflows)
- **Dependency-aware concurrency** (build packages in dependency order)
- **Dynamic slot management** (Promise.race() with dependencies)
- **Advanced loop patterns** (while loop with dynamic condition)

**M5 builds directly on M4's concurrency control foundation.**

Expected start: Week 25 (immediately after M4 completion)

---

## Appendix: Task Summary Table

| Task ID | Task Name | Owner | Estimate | Week | Dependencies |
|---------|-----------|-------|----------|------|--------------|
| M4-T001 | Loop schema design | BE1 | 6h | 19 | None |
| M4-T002 | Sequential loop compiler | BE1 | 12h | 19 | T001 |
| M4-T003 | Input source resolver | BE2 | 8h | 19 | T001 |
| M4-T010 | Loop container UI | FE1 | 16h | 19 | None |
| M4-T011 | Loop config panel | FE1 | 12h | 19 | T010 |
| M4-T020 | Performance monitoring | DevOps | 12h | 19 | None |
| M4-T030 | Concurrency control ⚠️ | BE1 | 20h | 20 | T002 |
| M4-T031 | Error handling | BE2 | 10h | 19-20 | T002 |
| M4-T032 | Progress tracking | BE2 | 16h | 20-21 | T030 |
| M4-T040 | Progress UI | FE1 | 14h | 21 | T032 |
| M4-T041 | History viewer | FE1 | 10h | 21 | T040 |
| M4-T050 | Performance tests ⚠️ | QA | 16h | 21-22 | T030, T032 |
| M4-T051 | Optimization | BE1+BE2 | 20h | 22 | T050 |
| M4-T052 | Load testing | DevOps | 12h | 22 | T050 |
| M4-T060 | Demo examples | BE2+QA | 8h | 23 | T051 |
| M4-T061 | User documentation | FE1+BE1 | 12h | 23 | T051 |
| M4-T062 | Developer documentation | BE1+BE2 | 8h | 23 | T051 |
| M4-T063 | Demo script | QA+DevOps | 8h | 23 | T060, T061 |
| M4-T070 | Bug fixes | All | 40h | 24 | T063 |
| M4-T071 | Final rehearsal | All | 8h | 24 | T063, T070 |

**Total Estimated Hours**: ~250 hours
**Team Size**: 5 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA)
**Timeline**: 6 weeks
**Capacity**: 200 hours per week (5 people × 40 hours)
**Buffer**: ~20% (Week 24 is mostly buffer)

---

## Questions & Answers

**Q: Why is M4-T030 (concurrency control) estimated at 20h but marked high risk?**
A: Promise.race() with slot management is complex. 20h is optimistic. Realistic is 30-40h. We have buffer in Week 24 and can parallelize other work.

**Q: What if performance tests fail in Week 22?**
A: Week 22 is dedicated to optimization (M4-T051). We have 20h allocated to fix performance issues. If major issues found, escalate immediately and consider reducing demo scope.

**Q: Can we handle more than 1000 items?**
A: Yes, with optimizations. But 1000 is our target for M4. Larger workloads (10K+) will benefit from M5's child workflow pattern (continue-as-new).

**Q: What if concurrency speedup doesn't meet targets?**
A: Focus on correctness first, performance second. 2x speedup at 4x concurrency is acceptable for M4. Optimize further in M5 based on profiling.

**Q: How do we track progress during the milestone?**
A: Daily standups, weekly demos, task board. Each task has clear acceptance criteria. Performance metrics tracked continuously after Week 21.

---

**Created**: 2025-01-19
**Version**: 1.0
**Next Review**: End of Week 21 (mid-milestone check-in on concurrency control)
