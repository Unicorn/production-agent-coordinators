## Phase 3 – UI and End-to-End Testing

**Parent plan**: `2025-11-26-testing-architecture-master-plan.md`  
**Depends on**: Phase 1 (foundation) and Phase 2 (Temporal integration)  
**Goal**: Ensure that the Workflow Builder UI, its server-side handlers, and the full UI→compiler→Temporal path work together in realistic, automated end-to-end tests.

---

## 1. Scope

- Frontend:
  - `src/app/**`
  - `src/components/workflow/**`
  - `src/components/service/**`
  - Any UI elements that configure timeouts, retries, and execution parameters.
- Backend API / server:
  - `src/server/**` (tRPC routes, handlers that trigger compilation and execution).
- E2E:
  - Playwright configuration in `playwright.config.ts`.
  - Playwright tests under `playwright/**` and `tests/e2e/**` (if present).

---

## 2. Objectives

- **Component-level reliability**:
  - Key UI components are unit-tested for structure, interactions, and state mapping.
- **End-to-end workflows**:
  - Create, compile, deploy, and run workflows via the real UI, against the real `infra:up` Temporal stack.
- **User-visible correctness**:
  - UI accurately reflects Temporal state (running, succeeded, failed, timed out).
  - Errors are surfaced as actionable, user-friendly messages.

---

## 3. Component and Integration Tests (React)

### 3.1 Targets

- **Component Palette**:
  - Grouping and categorization (utility-based groups).
  - Filtering, search (if present).
  - Drag-and-drop stubs (where testable without full React Flow).
- **Workflow Canvas / Nodes**:
  - `ServiceContainerNode` and related nodes (inside/outside zones).
  - Node labels, icons, connection points.
- **Service Builder Views**:
  - `ServiceBuilderView` end-to-end rendering of a single service:
    - External connectors.
    - Internal components.
    - Boundary visualization.
- **Configuration Forms**:
  - Timeout and retry configuration panels:
    - Input validation (numbers, units, required fields).
    - Mapping to internal state (e.g., updating node `data.timeout`, `data.retryPolicy`).

### 3.2 Tasks

- [x] Set up React Testing Library infrastructure for `packages/workflow-builder`:
  - [x] Common `render` helper that includes providers (theme, router, query client, etc.).
  - [x] Added polyfills for window.matchMedia, IntersectionObserver, ResizeObserver.
- [x] Add tests under `tests/ui/components/`:
  - [x] `ComponentPalette.test.tsx` (6 tests passing)
  - [x] `ServiceBuilderView.test.tsx` (needs React Flow mocking refinement)
  - [x] `ServiceContainerNode.test.tsx` (needs React Flow mocking refinement).
- [x] Add tests under `tests/ui/forms/`:
  - [x] `ActivityConfigPanel.test.tsx` (10 tests passing)
  - Validate:
    - Accepts valid inputs.
    - Rejects invalid ones with visible messages.
    - Calls callbacks with correct, normalized configs.

---

## 4. Playwright E2E Flows

### 4.1 Environment Requirements

- Temporal:
  - Use `yarn infra:up` at repo root (single canonical stack).
- App:
  - Start Next.js dev server or production build:
    - Dev: `cd packages/workflow-builder && yarn dev`
    - Or: `yarn build && yarn start` if CI prefers production mode.
- Playwright:
  - Always run in **headless mode** by default.

### 4.2 Core E2E Scenarios

- **Scenario A – Simple Workflow Creation and Execution**
  - [ ] Open builder UI.
  - [ ] Drag a trigger node and one activity node to the canvas.
  - [ ] Connect nodes and save the workflow.
  - [ ] Trigger compilation and deployment.
  - [ ] Start a workflow run from UI.
  - [ ] Assert:
    - Execution completes successfully.
    - Result (or status) is surfaced in UI.

- **Scenario B – Activity Timeout**

  - [ ] Create or load a workflow with an activity configured to exceed its timeout.
  - [ ] Configure timeout via UI (e.g., `2s`).
  - [ ] Compile and deploy.
  - [ ] Start a run.
  - [ ] Assert:
    - UI shows a timeout-related failure.
    - Optionally, a link or hint to check Temporal UI.

- **Scenario C – Retry Policy**

  - [ ] Configure a workflow with:
    - An activity that fails a couple of times before succeeding.
    - A retry policy (e.g., exponential backoff) set via UI.
  - [ ] Compile and deploy.
  - [ ] Start a run.
  - [ ] Assert:
    - Execution eventually succeeds.
    - UI indicates success (possibly including “retries occurred” meta info).

### 4.3 Tasks

- [x] Add Playwright tests under `tests/e2e/workflows/`:
  - [x] `workflow-simple.spec.ts`
  - [x] `workflow-timeout.spec.ts`
  - [x] `workflow-retry.spec.ts`
- [x] Configure Playwright to:
  - [x] Use environment variables for base URL and Temporal address/namespace.
  - [x] Capture screenshots and trace files for failing tests.

---

## 5. tRPC / Server-Side Tests

### 5.1 Goals

- Ensure tRPC routes that back the builder and execution pages:
  - Validate inputs thoroughly.
  - Enforce auth and authorization where required.
  - Correctly call the compiler and Temporal client.

### 5.2 Tasks

- [x] Add tests under `tests/server/` for key procedures:
  - [x] `compiler.compile` route:
    - Validate inputs (workflowId).
    - Confirm compilation success or surface clear errors.
    - Enforce authorization.
  - [x] `execution.build` route:
    - Verify workflow compilation and execution record creation.
    - Test with real workflow definitions.

---

## 6. Exit Criteria

- ✅ Component and form tests:
  - ComponentPalette: 6/6 tests passing
  - ActivityConfigPanel: 10/10 tests passing
  - ServiceBuilderView and ServiceContainerNode: Tests created, need React Flow mocking refinement
- ✅ Playwright E2E:
  - All core scenarios (simple, timeout, retry) test files created:
    - `workflow-simple.spec.ts`
    - `workflow-timeout.spec.ts`
    - `workflow-retry.spec.ts`
- ✅ Server-side tests:
  - Compiler router tests created
  - Execution router tests created
- Users (and developers) can:
  - Build and run workflows via the UI with confidence that:
    - What they configure is what executes.
    - Errors and timeouts are transparently surfaced and explainable.

## 7. Status

**Phase 3 Status: MOSTLY COMPLETE ✅**

Completed:
- React Testing Library infrastructure set up
- ComponentPalette tests: 6/6 passing
- ActivityConfigPanel tests: 10/10 passing
- Playwright E2E test files created for all 3 scenarios
- Server-side tRPC tests created

Remaining:
- Refine React Flow mocking for ServiceBuilderView and ServiceContainerNode tests
- Fix server-side test setup (tRPC router mocking)



