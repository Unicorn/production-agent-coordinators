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

- [ ] Set up React Testing Library infrastructure for `packages/workflow-builder`:
  - [ ] Common `render` helper that includes providers (theme, router, query client, etc.).
- [ ] Add tests under `tests/ui/components/`:
  - [ ] `ComponentPalette.test.tsx`
  - [ ] `ServiceBuilderView.test.tsx`
  - [ ] `ServiceContainerNode.test.tsx` (or equivalent).
- [ ] Add tests under `tests/ui/forms/`:
  - [ ] `TimeoutConfigForm.test.tsx`
  - [ ] `RetryPolicyForm.test.tsx`
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

- [ ] Add Playwright tests under `playwright/tests/`:
  - [ ] `workflow-simple.spec.ts`
  - [ ] `workflow-timeout.spec.ts`
  - [ ] `workflow-retry.spec.ts`
- [ ] Configure Playwright to:
  - [ ] Use environment variables for base URL and Temporal address/namespace.
  - [ ] Capture screenshots and trace files for failing tests.

---

## 5. tRPC / Server-Side Tests

### 5.1 Goals

- Ensure tRPC routes that back the builder and execution pages:
  - Validate inputs thoroughly.
  - Enforce auth and authorization where required.
  - Correctly call the compiler and Temporal client.

### 5.2 Tasks

- [ ] Add tests under `tests/server/` for key procedures:
  - [ ] `compileWorkflow` / `createBuild` routes:
    - Validate inputs (definitions, names).
    - Confirm compilation success or surface clear errors.
  - [ ] `startWorkflowExecution` routes:
    - Verify Temporal client calls have expected parameters.
    - Use real Temporal in integration tests where possible.

---

## 6. Exit Criteria

- Component and form tests:
  - Run and pass under `yarn test:unit` (or a dedicated `test:ui` if separated).
- Playwright E2E:
  - All core scenarios (simple, timeout, retry) pass reliably:
    - Locally, with `yarn infra:up` and dev server.
    - In CI, under a controlled environment.
- Users (and developers) can:
  - Build and run workflows via the UI with confidence that:
    - What they configure is what executes.
    - Errors and timeouts are transparently surfaced and explainable.



