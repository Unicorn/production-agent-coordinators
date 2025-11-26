## Testing Architecture Master Plan – Workflow Builder

**Project**: Workflow Builder / Temporal Coordinators  
**Owner**: Testing Architect (`agents/testing/testing-architect`)  
**Scope**: `packages/workflow-builder` (UI, API bindings, compiler, generators, Temporal integration, docs, and supporting scripts)

---

## 1. Objectives

- **End-to-end confidence**: Any workflow built in the UI, compiled, and executed in Temporal behaves predictably and observably.
- **No “magic” for us**: Every transformation (UI → model → compiler → TS → Temporal) is explicit, testable, and logged.
- **Minimal mocks, maximum reality**:
  - Prefer real Temporal, real TypeScript compilation, and real HTTP where feasible.
  - If a mock is introduced, it must have **its own verification tests** against the real thing before being used.
- **Fast feedback for developers**: High-signal test suites (unit + integration + E2E) that developers can run locally in predictable time.

---

## 2. Test Strategy Overview

We divide the testing surface into five layers:

1. **Model & Helpers Layer** (pure TypeScript, no IO)
2. **Compiler & Generators Layer** (code generation, no Temporal)
3. **Temporal Integration Layer** (real Temporal via `yarn infra:up`)
4. **UI & UX Layer** (component/unit + Playwright E2E)
5. **Observability & Tooling Layer** (logging, artifacts, invariants)

Each layer has:
- **Goals**
- **Test types**
- **Logging/diagnostics**
- **Tasks & milestones**

---

## 3. Layer 1 – Model & Helpers (Pure TS)

### 3.1 Goals

- All core types and helper functions are **fully unit-tested** with deterministic, fast tests.
- No Temporal server, no filesystem access – pure logic.

### 3.2 Scope

- `src/lib/compiler/types.ts` and related type definitions.
- Helper utilities in `src/lib/**`:
  - AST helpers
  - config normalizers
  - timeout / retry parsing and validation
  - mapping from UI configuration to internal `WorkflowDefinition`.

### 3.3 Test Types

- **Unit tests** with Vitest:
  - Valid + invalid timeout strings (`'2s'`, `'500ms'`, `'1h'`, garbage).
  - Retry policy parsing:
    - `none`, `fail-after-x`, `exponential-backoff`, `keep-trying`.
  - Node and edge normalization:
    - Missing labels, missing IDs, duplicate IDs.
  - Validation of `WorkflowDefinition` invariants:
    - Exactly one trigger.
    - No invalid edge references.

### 3.4 Tasks

- [ ] Identify all helper modules in `src/lib/**` with logic but no tests.
- [ ] Add `tests/unit/helpers/*.test.ts` covering:
  - [ ] Timeout parsing & normalization.
  - [ ] Retry policy normalization.
  - [ ] WorkflowDefinition validation.
  - [ ] Utility functions used by the compiler (e.g. ID generation, naming normalization).

---

## 4. Layer 2 – Compiler & Generators (Codegen)

### 4.1 Goals

- Validate that for any `WorkflowDefinition`, the **generated TypeScript code**:
  - Exports the correct workflow function name (`export async function ${workflow.name}`).
  - Exports all referenced activities / agents.
  - Configures timeouts and retry policies correctly in `proxyActivities`.
- Catch regressions via **snapshot and invariant tests**, without running Temporal.

### 4.2 Scope

- `src/lib/compiler/generators/typescript-generator.ts`
- `src/lib/compiler/patterns/activity-proxy.ts`
- Any additional generator patterns (workers, package.json, tsconfig).

### 4.3 Refactor for Testability

Break large generator files into smaller testable units:

- `typescript-generator.ts`:
  - `buildImports(blocks)`
  - `buildDeclarations(blocks)`
  - `buildWorkflowFunction(name, description, declarations, body, lastResultVar)`
  - `buildActivitiesFile(workflow)`
  - `buildWorkerFile(workflow)`
- `activity-proxy.ts`:
  - `groupActivitiesByConfig(nodes)`
  - `buildActivityProxyConfig(group)`
  - `buildRetryOptions(policy)`
  - `generateProxyVarName(config)`

### 4.4 Test Types

- **Generator unit tests**:
  - Feed fixtures (`simpleWorkflow`, `timeoutWorkflow`, retry workflows) into the compiler up to the point of string generation.
  - Assert:
    - The presence of `export async function TestSimpleWorkflow`.
    - The presence and structure of `proxyActivities` calls.
    - Correct mapping of `timeout` and `retryPolicy`.
- **Snapshot tests**:
  - For a curated set of workflows (simple, timeout, retry, cancellation, concurrency):
    - Snapshot `workflowCode` and `activitiesCode`.
    - Use focused snapshots (ignore license/header noise).

### 4.5 Tasks

- [ ] Extract helper functions from `typescript-generator.ts` into named exports.
- [ ] Extract helper functions from `activity-proxy.ts` into named exports.
- [ ] Add `tests/unit/compiler/typescript-generator.test.ts`:
  - [ ] Asserts workflow function exports matching `workflow.name`.
  - [ ] Asserts last activity result is returned (for simple flows).
- [ ] Add `tests/unit/compiler/activity-proxy.test.ts`:
  - [ ] Grouping logic across multiple timeout/retry configurations.
  - [ ] Retry policy formatting and object literals (no trailing commas).
- [ ] Add generator snapshot tests for:
  - [ ] `TestSimpleWorkflow`
  - [ ] `TestTimeoutWorkflow`
  - [ ] `TestTimeoutRetryWorkflow`
  - [ ] `TestAlwaysTimeoutWorkflow`
  - [ ] `TestMultiTimeoutWorkflow`

---

## 5. Layer 3 – Temporal Integration (Real Temporal)

### 5.1 Goals

- Confirm that compiled workflows **initialize and execute correctly** in a real Temporal instance.
- Ensure that Timeouts, Retries, Cancellations, and Concurrency behave as intended.
- History events are **detectable and robustly asserted** (string + numeric codes).

### 5.2 Scope

- Existing integration tests under:
  - `tests/integration/compiler-execution/*`
- `IntegrationTestContext` in `tests/integration/compiler-execution/test-helpers.ts`.
- Temporal instance from `yarn infra:up` (canonical local Temporal).

### 5.3 Test Extensions

- **Workflow initialization tests**:
  - For each workflow type mentioned in logs:
    - `TestSimpleWorkflow`
    - `TestTimeoutWorkflow`
    - `TestTimeoutRetryWorkflow`
    - `TestAlwaysTimeoutWorkflow`
    - `TestMultiTimeoutWorkflow`
    - `TestNoRetryWorkflow`
    - `TestKeepTryingWorkflow`
    - `TestMaxIntervalWorkflow`
    - `TestCancelWorkflow`
    - `TestConcurrentWorkflow{0..4}`
  - Assert:
    - Worker bundle contains an exported function with that exact name.
    - Temporal can successfully start the workflow.
- **Timeout & Retry tests (extended)**:
  - Assertions for:
    - Execution duration ranges (with generous margins).
    - Correct retry behavior (attempt count, final status).
    - History events for timeouts and failures.

### 5.4 Logging & Artifacts

- **Test debug mode** (`WORKFLOW_BUILDER_TEST_DEBUG=1`):
  - Preserve generated `.test-workflows` directories for failing tests.
  - Log **exported function names** from each `workflows/index.ts`.
  - Dump minimal JSON artifacts per failing test:
    - Workflow name & ID.
    - History summary (first N events and event types).

### 5.5 Tasks

- [ ] Enhance `IntegrationTestContext.compileAndRegister` to:
  - [ ] Optionally write a copy of `workflows/index.ts` to a `tests/_artifacts` directory for failing tests.
  - [ ] Log the list of exported workflow function names when `WORKFLOW_BUILDER_TEST_DEBUG` is set.
- [ ] Add dedicated initialization tests for each workflow type listed above.
- [ ] Harden timeout & retry tests with:
  - [ ] History-based validations that handle both typed and numeric event codes.
  - [ ] Looser timing bounds but strict semantic checks (timeout vs success).

---

## 6. Layer 4 – UI & UX

### 6.1 Goals

- Ensure the Workflow Builder UI:
  - Renders all elements correctly (component palette, inside/outside service visualization).
  - Correctly maps user edits into internal models (`WorkflowDefinition`).
  - Surfaces Temporal execution state cleanly (success, failure, timeout, retry).

### 6.2 Scope

- `src/app` pages (builder, executions).
- `src/components/workflow/**`
- `src/components/service/**`
- `src/server` tRPC handlers related to compilation and execution.

### 6.3 Test Types

- **Component/unit tests** (React Testing Library):
  - Component palette:
    - [ ] Correct grouping, filtering, and drag interactions.
  - Service builder / Service containers:
    - [ ] Inside/outside zones render as expected.
    - [ ] Connectors and interfaces appear in correct zones.
  - Forms for timeouts and retries:
    - [ ] Input validation.
    - [ ] Correct mapping to internal model.
- **Browser E2E tests** (Playwright, headless):
  - Flows:
    - [ ] Create and run a simple workflow end-to-end.
    - [ ] Configure and observe a timeout.
    - [ ] Configure and observe retries.
  - Assertions:
    - [ ] UI states / toasts.
    - [ ] Temporal execution actually happened (via API endpoint or test helper).

### 6.4 Tasks

- [ ] Add React Testing Library tests under `tests/ui/**` for:
  - [ ] `ComponentPalette`
  - [ ] `ServiceBuilderView`
  - [ ] Key workflow node components (`ServiceContainerNode`, etc.).
- [ ] Extend existing Playwright config to add:
  - [ ] “Build & run simple workflow” E2E.
  - [ ] “Timeout & retry” E2E with `infra:up` Temporal.

---

## 7. Layer 5 – Observability & Developer Experience

### 7.1 Goals

- Make failures **actionable**, not mysterious:
  - Clear logs.
  - Minimal but precise artifacts.
- Make tests easy to run:
  - `yarn test:unit`
  - `yarn test:integration`
  - `yarn test:e2e`

### 7.2 Tasks

- [ ] Introduce top-level scripts in `packages/workflow-builder/package.json`:
  - [ ] `test:unit` – pure TS + generator tests.
  - [ ] `test:integration` – Temporal integration tests (require `yarn infra:up`).
  - [ ] `test:e2e` – UI E2E tests (also require `yarn infra:up` + dev server).
- [ ] Document expected runtime and setup in `docs/testing/README.md`.
- [ ] Add standardized logger for tests that includes:
  - Workflow name, ID, task queue.
  - Temporal instance address & namespace.

---

## 8. Mocking Policy

- **Preferred**: Real systems (Temporal, DB, HTTP) for any non-trivial behavior.
- If a mock is required:
  - [ ] Document the rationale in the test file.
  - [ ] Provide a **mock verification test** that:
    - Spins up the real dependency in isolation.
    - Confirms the mock’s behavior matches the real API for the scenarios we rely on.
  - [ ] Mocks must be **local to the test suite**, not global/shared “magic” mocks.

---

## 9. Phases & Milestones

Each phase has its own detailed plan document under `packages/workflow-builder/plans/testing/`.  
Use those phase documents as the **source of truth for executable tasks**.

### Phase 1 – Testing Foundation (Unit + Generators)

**Plan**: `plans/testing/2025-11-26-phase1-testing-foundation.md`

- **Executable tasks (30–60 min each)**:
  - [ ] Inventory helper modules:
    - Scan `src/lib/**` for helpers without tests; produce a short list in the phase-1 plan.
  - [ ] Refactor helpers into named exports:
    - For each targeted helper module, extract inline functions into exported functions suitable for unit tests.
  - [ ] Add `tests/unit/helpers/timeout-helpers.test.ts`:
    - Cover valid + invalid timeout strings and normalization behavior.
  - [ ] Add `tests/unit/helpers/retry-policy-helpers.test.ts`:
    - Cover all supported retry strategies and edge cases.
  - [ ] Add `tests/unit/helpers/workflow-definition-validation.test.ts`:
    - Validate triggers, edges, and structural invariants.
  - [ ] Refactor `typescript-generator.ts` into smaller helper functions (buildImports, buildWorkflowFunction, etc.).
  - [ ] Refactor `activity-proxy.ts` into smaller helper functions (groupActivitiesByConfig, buildRetryOptions, etc.).
  - [ ] Add `tests/unit/compiler/typescript-generator-helpers.test.ts`:
    - Assert exported workflow function names and return of last result variable.
  - [ ] Add `tests/unit/compiler/activity-proxy-helpers.test.ts`:
    - Assert grouping and retry option generation.
  - [ ] Add generator snapshot tests for key workflows (`TestSimpleWorkflow`, `TestTimeoutWorkflow`, etc.).
- **Exit criteria**: All generator invariants hold; unit tests for helpers and generator sub-functions run cleanly via `yarn test:unit`.

### Phase 2 – Temporal Integration Hardening

**Plan**: `plans/testing/2025-11-26-phase2-temporal-integration.md`

- **Executable tasks (30–60 min each)**:
  - [ ] Add `workflow-initialization.test.ts` under `tests/integration/compiler-execution/`:
    - One test per special workflow type (`TestSimpleWorkflow`, `TestTimeoutWorkflow`, etc.) asserting successful initialization.
  - [ ] Enhance `IntegrationTestContext.compileAndRegister`:
    - Optionally persist `workflows/index.ts` into `tests/_artifacts` when `WORKFLOW_BUILDER_TEST_DEBUG=1`.
  - [ ] Add logging of exported workflow function names in debug mode.
  - [ ] Extend timeout tests to assert execution-time ranges with generous bounds, not strict equality.
  - [ ] Extend retry tests to assert `attemptCount` and final status per strategy.
  - [ ] Add or refine tests for `TestCancelWorkflow`:
    - Start, cancel, and verify cancellation via history events.
  - [ ] Add or refine concurrency tests for `TestConcurrentWorkflow{0..4}`:
    - Launch multiple workflows on `test-queue-concurrent` and assert no initialization or race failures.
  - [ ] Implement a small artifact helper to dump workflow history summaries for failing tests.
- **Exit criteria**: All `tests/integration/compiler-execution/**` pass reliably against `yarn infra:up`; no remaining “no such function exported” errors for covered workflows.

### Phase 3 – UI & E2E Coverage

**Plan**: `plans/testing/2025-11-26-phase3-ui-e2e-testing.md`

- **Executable tasks (30–60 min each)**:
  - [ ] Set up a shared React Testing Library `render` helper for UI tests in this package.
  - [ ] Add `ComponentPalette.test.tsx`:
    - Assert grouping, search/filter behavior, and basic drag affordances.
  - [ ] Add `ServiceBuilderView.test.tsx`:
    - Assert inside/outside zones and correct rendering of connectors/components.
  - [ ] Add node-level tests (`ServiceContainerNode.test.tsx` or similar) for visual/layout expectations.
  - [ ] Add `TimeoutConfigForm.test.tsx` and `RetryPolicyForm.test.tsx`:
    - Validate user input and mapping to internal config objects.
  - [ ] Add Playwright E2E spec `workflow-simple.spec.ts`:
    - Build a simple workflow via the UI and run it end-to-end against Temporal.
  - [ ] Add Playwright E2E spec `workflow-timeout.spec.ts`:
    - Configure an activity timeout and verify UI shows a timeout failure.
  - [ ] Add Playwright E2E spec `workflow-retry.spec.ts`:
    - Configure retries and verify eventual success after transient failures.
  - [ ] Add server-side tests for tRPC routes that handle compilation and execution.
- **Exit criteria**: All UI and E2E suites pass locally and in CI with `yarn infra:up` and a running dev/production server.

### Phase 4 – Observability & Maintenance

**Plan**: `plans/testing/2025-11-26-phase4-observability-and-maintenance.md`

- **Executable tasks (30–60 min each)**:
  - [ ] Add or update `test:unit`, `test:integration`, and `test:e2e` scripts in `packages/workflow-builder/package.json`.
  - [ ] Document test commands and expected setup in `docs/testing/README.md`.
  - [ ] Wire `WORKFLOW_BUILDER_TEST_DEBUG` into `IntegrationTestContext`:
    - Control whether artifacts are preserved and logs are more verbose.
  - [ ] Implement artifact writing helpers for Temporal history and generated code.
  - [ ] Add test failure logging that includes workflow name, ID, task queue, and Temporal address/namespace.
  - [ ] Align `.cursor/rules/testing-standards.mdc` with actual scripts and capabilities.
  - [ ] Ensure `AGENTINFO.md` links to testing plans and documents test expectations for new work.
  - [ ] Define a lightweight review checklist for new features (tests required per layer as applicable).
- **Exit criteria**: Developers and agents have a clear, documented path to running and extending tests; failures are easy to interpret and debug.

---

## 10. References

- `docs/testing/` – Existing testing guides and workflows.
- `docs/plans/2025-11-14-workflow-builder-system-design.md` – System design and phases.
- `packages/workflow-builder/tests/**` – Current test suites to extend and refactor.


