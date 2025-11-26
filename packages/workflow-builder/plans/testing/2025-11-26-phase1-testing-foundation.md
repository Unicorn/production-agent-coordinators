## Phase 1 – Testing Foundation (Models, Helpers, Generators)

**Parent plan**: `2025-11-26-testing-architecture-master-plan.md`  
**Owner**: Testing Architect (`agents/testing/testing-architect`)  
**Goal**: Establish a solid, fast, deterministic unit-testing base for all pure TypeScript logic and code generators in `packages/workflow-builder`.

---

## 1. Scope

- **Pure TypeScript logic** (no IO, no Temporal):
  - Types and helpers in `src/lib/**`:
    - Compiler types and utilities.
    - Timeout and retry parsing / normalization.
    - WorkflowDefinition validation utilities.
    - Mapping from UI configuration models to internal `WorkflowDefinition`.
- **Code generators**:
  - `src/lib/compiler/generators/typescript-generator.ts`
  - `src/lib/compiler/patterns/activity-proxy.ts`

---

## 2. Objectives

- All critical helpers and generator sub-functions are:
  - **Isolated** into named exports.
  - **Unit-tested** with realistic inputs and edge cases.
- Generators have **invariant tests** and **snapshots** that make regressions obvious:
  - Workflow function name equals `workflow.name`.
  - All referenced activities and agents are exported.
  - Timeouts and retry policies are wired into `proxyActivities` correctly.

---

## 3. Tasks – Models and Helpers

### 3.1 Inventory and Refactor

- [x] Enumerate all helper modules in `src/lib/**` that contain logic but lack tests.
  - [x] Compiler-related helpers.
  - [x] Timeout / retry parsing.
  - [x] Workflow graph validation and normalization.
- [x] Extract any deeply nested inline functions into named exports suitable for unit testing.

### 3.2 Unit Tests for Helpers

Create `tests/unit/helpers/` with the following suites:

- [x] `timeout-helpers.test.ts`
  - [x] Parse valid timeouts: `'2s'`, `'500ms'`, `'1m'`, `'1h'` (via `parseDuration` in `ast-helpers.test.ts`).
  - [x] Reject or normalize invalid timeouts: `'abc'`, negative values, missing units (via `parseDuration` tests).
  - [x] Round-trip tests (string → internal → string) where applicable.
- [x] `retry-policy-helpers.test.ts`
  - [x] Normalize `none`, `fail-after-x`, `exponential-backoff`, `keep-trying`.
  - [x] Validate `maxAttempts`, `initialInterval`, `maxInterval`, `backoffCoefficient`.
  - [x] Edge cases: zero or negative values, missing fields.
- [x] `workflow-definition-validation.test.ts` (exists at `src/lib/validation/__tests__/workflow-validator.test.ts`)
  - [x] Exactly one trigger node required (tested via "should require a start node").
  - [x] No edges pointing to missing nodes (tested via "should validate source/target node exists").
  - [x] No duplicate node IDs (tested via "should detect duplicate node IDs").
  - [x] Reasonable defaults applied where config is missing (tested via various validation tests).
- [x] `ui-model-mapping.test.ts`
  - [x] Sample UI configs for simple, timeout, and retry workflows.
  - [x] Verify mapping to `WorkflowDefinition` matches expectations (nodes, edges, settings).

---

## 4. Tasks – Generators (Codegen)

### 4.1 Refactor Generators into Sub-functions

- [x] In `typescript-generator.ts`, extract:
  - [x] `buildImports(blocks)` - Extracted and exported
  - [x] `buildDeclarations(blocks)` - Extracted and exported
  - [x] `buildWorkflowFunction(name, description, declarations, body, lastResultVar)` - Already exported as `generateWorkflowFunction`
  - [x] `buildActivitiesFile(workflow)` - Already exported as `generateActivitiesFile`
  - [x] `buildWorkerFile(workflow)` - Already exported as `generateWorkerFile`
- [x] In `activity-proxy.ts`, extract:
  - [x] `groupActivitiesByConfig(nodes)` - Extracted and exported
  - [x] `buildActivityProxyConfig(group)` - Handled via `groupActivitiesByConfig` and proxy generation
  - [x] `buildRetryOptions(policy)` - Extracted and exported
  - [x] `generateProxyVarName(config)` - Extracted and exported

### 4.2 Unit Tests for Generator Helpers

Under `tests/unit/compiler/`:

- [x] `typescript-generator-helpers.test.ts`
  - [x] `buildWorkflowFunction` emits `export async function ${name}` and returns the last result variable when provided.
  - [x] `buildImports` merges and deduplicates imports.
  - [x] `buildActivitiesFile` exports functions for all activity/agent nodes.
- [x] `activity-proxy-helpers.test.ts`
  - [x] `groupActivitiesByConfig` groups nodes by timeout + retry config.
  - [x] `buildRetryOptions` outputs valid JS object literals (no trailing commas, no syntax errors).
  - [x] `generateProxyVarName` produces stable, JS-safe identifiers.

### 4.3 Snapshot Tests for End-to-End Codegen

Create `tests/unit/compiler/generator-snapshots.test.ts`:

- [x] Use existing fixtures (`simpleWorkflow`, `timeoutWorkflow`, retry workflows) as inputs.
- [x] Generate `workflowCode` and `activitiesCode` without running Temporal.
- [x] Assert:
  - [x] Presence of `export async function TestSimpleWorkflow`.
  - [x] Presence of `proxyActivities` blocks with expected configuration.
  - [x] Returned value matches last activity for simple flow (verified result variable creation).
- [x] Maintain snapshots with **high signal**, focusing on structure and key strings, not formatting trivia.

---

## 5. Deliverables

- New unit test suites under `tests/unit/helpers/**` and `tests/unit/compiler/**`.
- Refactored generators with small, well-named helper functions.
- Snapshot and invariant tests for core workflows and patterns.

---

## 6. Exit Criteria

- All new unit suites pass under `yarn test:unit` in `packages/workflow-builder`.
- Coverage reports show:
  - **Near 100%** coverage for timeout/retry helpers and WorkflowDefinition validation.
  - High coverage for generator helper functions.
- Any change in generated code that affects:
  - Exported workflow function names.
  - `proxyActivities` configuration.
  - Activity export signatures.
  
  must cause a snapshot or invariant test to fail, forcing explicit review.



