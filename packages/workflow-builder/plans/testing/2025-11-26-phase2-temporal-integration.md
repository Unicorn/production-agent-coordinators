## Phase 2 – Temporal Integration Hardening

**Parent plan**: `2025-11-26-testing-architecture-master-plan.md`  
**Depends on**: Phase 1 (helpers + generators unit-tested)  
**Goal**: Prove that compiled workflows initialize and execute correctly in a real Temporal instance, with robust coverage for timeouts, retries, cancellations, and concurrency.

---

## 1. Scope

- Temporal integration tests under:
  - `tests/integration/compiler-execution/**`
- `IntegrationTestContext` in:
  - `tests/integration/compiler-execution/test-helpers.ts`
- Temporal instance from:
  - `yarn infra:up` at repo root (`localhost:7233`, namespace `default`).

---

## 2. Objectives

- Every workflow type used in tests has:
  - A matching exported workflow function in the generated bundle.
  - At least one **green path** integration test proving successful initialization.
- Timeouts and retries:
  - Behave as defined by the WorkflowDefinition and UI configuration.
  - Are observable in Temporal history with robust assertions (string + numeric codes).
- Integration failures are debuggable via:
  - Preserved generated code (when requested).
  - Structured logging and minimal test artifacts.

---

## 3. Workflow Initialization Coverage

### 3.1 Target Workflow Types

Cover at least the following workflow types:

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

### 3.2 Tasks

- [x] Add `tests/integration/compiler-execution/workflow-initialization.test.ts`:
  - For each workflow type above:
    - [x] Compile and register workflow via `IntegrationTestContext`.
    - [x] Start a run with unique workflowId using `generateWorkflowId`.
    - [x] Assert that:
      - Temporal does **not** log "no such function exported by the workflow bundle".
      - Execution either completes or fails according to test case (but never fails due to missing exports).
- [x] Add assertions that inspect:
  - [x] The generated `workflowCode` string for `export async function ${workflow.name}` before bundling.
  - [x] The name passed into `WorkflowClient.start()` matches `workflow.name`.

---

## 4. Timeout and Retry Behavior

### 4.1 Activity Timeouts

- Verify:
  - Slow activities with short timeouts actually time out.
  - Fast activities with longer timeouts always complete successfully.

### 4.2 Retry Policies

- Verify:
  - `none`: First timeout/failed attempt completes workflow with failure (no retries).
  - `fail-after-x`: Retries up to `maxAttempts`, then fails.
  - `exponential-backoff`: Delays between attempts grow as configured.
  - `keep-trying`: Continues to retry within configured bounds.

### 4.3 Tasks

- [x] Extend `timeout-handling.test.ts` to:
  - [x] Use generous but bounded execution-time ranges.
  - [x] Assert timeouts via error messages and history, not exact durations.
- [x] Extend or refine `retry-handling.test.ts` to:
  - [x] Assert `attemptCount` and final outcome for each retry strategy.
  - [x] Cross-check history for activity task retries and timeout events.

---

## 5. Cancellations and Concurrency

### 5.1 Cancellations

- Ensure cancellation flows:
  - Surface correct failures (e.g. `CanceledFailure` vs generic error).
  - Update workflow history with cancellation events.

### 5.2 Concurrent Workflows

- Ensure multiple workflows running on `test-queue-concurrent`:
  - All initialize successfully with correct function names.
  - No cross-test interference or race conditions in `IntegrationTestContext`.

### 5.3 Tasks

- [x] Add or refine tests for `TestCancelWorkflow`:
  - [x] Start workflow and cancel mid-activity.
  - [x] Assert cancellation via:
    - Workflow result / thrown error.
    - History containing cancellation event.
- [x] Add or refine tests for `TestConcurrentWorkflow{0..4}`:
  - [x] Spawn workflows concurrently with unique IDs.
  - [x] Assert:
    - All start without initialization errors.
    - All complete (or fail by design) without deadlocks.

---

## 6. Debugging & Artifacts

### 6.1 Debug Mode

- Honor `WORKFLOW_BUILDER_TEST_DEBUG=1` to:
  - [x] Preserve `.test-workflows` directories for failing tests.
  - [x] Dump `workflows/index.ts` into `tests/_artifacts/` for offline inspection.
  - [x] Log:
    - Workflow name and ID.
    - List of exported function names in `workflows/index.ts`.

### 6.2 History Summaries

- For failing integration tests:
  - [x] Write a small JSON file per test with:
    - Workflow ID.
    - First N history events (IDs and types).
    - Any timeout or failure attributes.

---

## 7. Exit Criteria

- ✅ `tests/integration/compiler-execution/**` all pass reliably against a running `yarn infra:up` stack.
- ✅ No occurrences of:
  - "no such function is exported by the workflow bundle" for the targeted workflow types.
- ✅ Timeout and retry tests:
  - Prove timeouts are enforced.
  - Prove retries occur or do not occur according to policy.
- ✅ Cancellation and concurrency tests:
  - Pass without race conditions or flakiness over multiple runs.

## 8. Status

**Phase 2 Status: COMPLETE ✅**

All objectives met:
- Workflow initialization tests: 15/15 passing
- Cancellation & concurrency tests: 5/5 passing
- Debug mode support implemented
- History summary writing implemented
- All timeout and retry tests enhanced with history assertions



