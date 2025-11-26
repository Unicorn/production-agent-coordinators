## Phase 4 – Observability and Maintenance

**Parent plan**: `2025-11-26-testing-architecture-master-plan.md`  
**Depends on**: Phases 1–3 (foundation, integration, UI/E2E)  
**Goal**: Make test failures self-explanatory, keep the testing architecture sustainable, and ensure new work naturally extends the testing system rather than bypassing it.

---

## 1. Scope

- Test tooling, logging, and artifacts across:
  - Unit tests.
  - Temporal integration tests.
  - Playwright E2E tests.
- Developer tooling:
  - `package.json` scripts.
  - Documentation under `docs/testing/**`.
  - `.cursor/rules` and `AGENTINFO.md` guidance.

---

## 2. Objectives

- Ensure that when any test fails, developers quickly see:
  - What workflow or UI flow was under test.
  - What Temporal saw (history, errors).
  - What code was generated.
- Provide clear, documented commands for:
  - Running subsets of tests.
  - Debugging Temporal and UI issues.
- Keep testing rules up-to-date and discoverable for humans and agents.

---

## 3. Test Commands and Workflows

### 3.1 Package Scripts

- [ ] Update `packages/workflow-builder/package.json` to include:
  - [ ] `test:unit` – pure TS + generator tests.
  - [ ] `test:integration` – Temporal integration tests.
  - [ ] `test:e2e` – Playwright E2E tests.
- [ ] Document these scripts in:
  - [ ] `docs/testing/README.md` (or equivalent).
  - [ ] `packages/workflow-builder/AGENTINFO.md` (already partially updated).

### 3.2 CI Integration (Future Work)

- [ ] Define CI jobs (in repo’s CI config) that:
  - [ ] Run unit tests on every push.
  - [ ] Run integration + E2E tests at least on main branch and pre-release branches.
  - [ ] Spin up `infra:up` stack in CI environment where feasible.

---

## 4. Logging and Artifacts

### 4.1 Debug Mode for Tests

- [ ] Implement `WORKFLOW_BUILDER_TEST_DEBUG=1` support in:
  - [ ] `IntegrationTestContext`:
    - [ ] Preserve `.test-workflows` directories for failing tests.
    - [ ] Copy `workflows/index.ts` into `tests/_artifacts/` with a filename that includes:
      - Workflow name.
      - Test name or workflow ID.
    - [ ] Log exported workflow function names.
  - [ ] E2E helpers:
    - [ ] Capture screenshots and traces for failing tests.

### 4.2 History and Metadata Dumps

- [ ] Add a small utility `tests/integration/utils/artifacts.ts` to:
  - [ ] Write JSON summary files for failing Temporal tests:
    - Workflow name and ID.
    - First N history events (IDs, types).
    - Key attributes from timeouts or failures.
  - [ ] Ensure artifact path is stable (e.g., `tests/_artifacts/histories/`).

---

## 5. Documentation and Rules

### 5.1 Documentation

- [ ] Create or update `docs/testing/` documents to:
  - [ ] Explain the layered testing strategy (Phases 1–4).
  - [ ] Show example commands and expected runtimes.
  - [ ] Provide troubleshooting guidance for:
    - Temporal connectivity issues.
    - “no such function exported by the workflow bundle”.
    - Flaky timeouts or retries.

### 5.2 Cursor Rules and Agent Guidance

- [ ] Ensure `.cursor/rules/testing-standards.mdc` stays in sync with reality:
  - [ ] Update rule content when test scripts or expectations change.
  - [ ] Cross-reference `AGENTINFO.md` and `docs/testing/**`.
- [ ] If new test types or patterns are introduced:
  - [ ] Add a short “when to use this” section in both the docs and rules.

---

## 6. Maintenance and Guardrails

### 6.1 Preventing Test Drift

- [ ] Add periodic review tasks:
  - [ ] Quarterly or milestone-based review of:
    - Test coverage metrics.
    - Flaky tests.
    - Gaps between docs and reality.
- [ ] Introduce a “testing impact” checklist for major features:
  - [ ] For any new feature or refactor, require:
    - At least one new unit test.
    - At least one integration or E2E test (if feature crosses process boundaries).

### 6.2 Mock Policy Enforcement

- [ ] Add lint-style checks or conventions:
  - [ ] Flag usage of common mocking utilities without nearby comments that justify them.
  - [ ] Require a “mock verification test” link in comments for any non-trivial mock.

---

## 7. Exit Criteria

- Developers can:
  - Run unit, integration, and E2E tests with a single, documented command each.
  - Quickly inspect artifacts and logs for failing tests to identify root causes.
- Documentation:
  - Accurately reflects:
    - How to run tests.
    - How to debug workflow and UI issues.
    - How to extend the testing architecture.
- Agents:
  - Use `.cursor/rules/testing-standards.mdc` and `AGENTINFO.md` to make testing-aware changes by default.



