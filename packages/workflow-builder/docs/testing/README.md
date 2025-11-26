# Testing Guide - Workflow Builder

**Last Updated**: 2025-11-26  
**Testing Architecture Plan**: `packages/workflow-builder/plans/testing/2025-11-26-testing-architecture-master-plan.md`

---

## Overview

The Workflow Builder uses a **layered testing strategy** to ensure reliability at every level:

1. **Unit Tests** - Pure TypeScript functions, helpers, and generators
2. **Integration Tests** - Temporal workflow compilation and execution
3. **UI Component Tests** - React components with React Testing Library
4. **E2E Tests** - Full user flows with Playwright

---

## Quick Start

### Prerequisites

```bash
# Start Temporal stack (required for integration and E2E tests)
yarn infra:up

# For E2E tests, also start the dev server
cd packages/workflow-builder && yarn dev
```

### Running Tests

```bash
# Unit tests (fast, no dependencies)
yarn test:unit

# Integration tests (requires Temporal)
yarn test:integration

# E2E tests (requires Temporal + dev server)
yarn test:e2e

# All tests
yarn test
```

---

## Test Commands

### Unit Tests

```bash
# Run all unit tests
yarn test:unit

# Run specific test file
yarn test tests/unit/helpers/timeout-helpers.test.ts

# Watch mode
yarn test:watch tests/unit/
```

**What's tested:**
- Helper functions (timeout parsing, retry policy validation)
- AST utilities (code generation helpers)
- Generator sub-functions (buildImports, buildRetryOptions, etc.)
- Workflow definition validation

**Expected runtime:** < 5 seconds

### Integration Tests

```bash
# Run all integration tests
yarn test:integration

# Run compiler/execution tests only
yarn test:integration:compiler

# With debug mode (preserves artifacts)
WORKFLOW_BUILDER_TEST_DEBUG=1 yarn test:integration
```

**What's tested:**
- Workflow compilation to TypeScript
- Temporal workflow initialization
- Activity timeouts and retry policies
- Workflow cancellation and concurrency

**Expected runtime:** 2-5 minutes

**Requirements:**
- Temporal stack running (`yarn infra:up`)
- Temporal address: `localhost:7233`
- Namespace: `default`

### E2E Tests

```bash
# Run all E2E tests
yarn test:e2e

# Run with UI (headed browser)
yarn test:e2e:ui

# Debug mode (step through tests)
yarn test:e2e:debug

# View test report
yarn test:e2e:report
```

**What's tested:**
- Workflow creation via UI
- Compilation and deployment
- Workflow execution
- Timeout and retry configuration

**Expected runtime:** 5-10 minutes

**Requirements:**
- Temporal stack running (`yarn infra:up`)
- Dev server running (`yarn dev`)
- Base URL: `http://localhost:3010`

---

## Debug Mode

Set `WORKFLOW_BUILDER_TEST_DEBUG=1` to enable debug artifacts:

```bash
WORKFLOW_BUILDER_TEST_DEBUG=1 yarn test:integration
```

**What it does:**
- Preserves `.test-workflows` directories for failing tests
- Dumps generated `workflows/index.ts` to `tests/_artifacts/`
- Logs workflow names, IDs, and exported function names
- Writes JSON history summaries for failing tests

**Artifacts location:** `tests/_artifacts/`

---

## Test Structure

```
tests/
├── unit/                    # Unit tests (pure TS)
│   ├── helpers/            # Helper function tests
│   ├── compiler/           # Generator helper tests
│   └── nodes/              # Node component tests
├── integration/            # Integration tests (Temporal)
│   └── compiler-execution/ # Workflow compilation & execution
├── ui/                     # UI component tests (React Testing Library)
│   ├── components/         # Component tests
│   └── forms/              # Form validation tests
├── e2e/                    # E2E tests (Playwright)
│   └── workflows/          # Workflow E2E scenarios
└── _artifacts/             # Debug artifacts (gitignored)
```

---

## Troubleshooting

### "Failed to connect before the deadline"

**Problem:** Temporal is not running or not accessible.

**Solution:**
```bash
# Start Temporal stack
yarn infra:up

# Verify it's running
curl http://localhost:7233/health
```

### "no such function is exported by the workflow bundle"

**Problem:** Generated workflow function name doesn't match Temporal's expectations.

**Solution:**
1. Enable debug mode: `WORKFLOW_BUILDER_TEST_DEBUG=1`
2. Check `tests/_artifacts/` for generated code
3. Verify exported function name matches `workflow.name` exactly
4. See `tests/integration/compiler-execution/workflow-initialization.test.ts` for examples

### Flaky Timeout Tests

**Problem:** Tests fail intermittently due to timing.

**Solution:**
- Integration tests use generous but bounded time ranges
- If consistently failing, check Temporal worker status
- Verify activity timeouts are correctly configured in workflow definition

### UI Tests Failing

**Problem:** React components not rendering or tRPC queries failing.

**Solution:**
1. Check that test helpers include all providers (Tamagui, tRPC, React Query)
2. Verify mocks are set up correctly in test file
3. Check browser console for errors in E2E tests

---

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { parseTemporalDuration } from '@/lib/utils/temporal-utils';

describe('parseTemporalDuration', () => {
  it('should parse valid duration strings', () => {
    expect(parseTemporalDuration('30s')).toBe('30s');
    expect(parseTemporalDuration('5m')).toBe('5m');
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegrationTestContext } from './test-helpers';
import { simpleWorkflow } from './fixtures';

describe('Simple Workflow', () => {
  let context: IntegrationTestContext;

  beforeEach(async () => {
    context = new IntegrationTestContext();
    await context.setup();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it('should compile and execute successfully', async () => {
    await context.compileAndRegister(simpleWorkflow);
    await context.waitForWorkerReady();

    const workflowId = generateWorkflowId('test');
    const result = await context.executeWorkflow(
      simpleWorkflow.name,
      workflowId,
      [{ test: 'data' }]
    );

    expect(result).toBeDefined();
  });
});
```

### UI Component Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../test-helpers';
import { ComponentPalette } from '@/components/workflow/ComponentPalette';

describe('ComponentPalette', () => {
  it('renders component palette with title', () => {
    render(<ComponentPalette components={mockComponents} />);
    expect(screen.getByText('Build Your Service')).toBeInTheDocument();
  });
});
```

---

## Testing Standards

See `.cursor/rules/testing-standards.mdc` for detailed testing requirements and standards.

**Key principles:**
- Prefer real systems over mocks
- If mocking, provide verification tests
- Test at the appropriate layer (unit → integration → E2E)
- Make failures actionable with clear logs and artifacts

---

## CI Integration

Tests are designed to run in CI with:
- Temporal stack in Docker
- Dev server for E2E tests
- Artifact collection for debugging

See repository CI configuration for details.

---

## Related Documentation

- [Testing Architecture Plan](../plans/testing/2025-11-26-testing-architecture-master-plan.md)
- [Phase 1: Testing Foundation](../plans/testing/2025-11-26-phase1-testing-foundation.md)
- [Phase 2: Temporal Integration](../plans/testing/2025-11-26-phase2-temporal-integration.md)
- [Phase 3: UI & E2E Testing](../plans/testing/2025-11-26-phase3-ui-e2e-testing.md)
- [Phase 4: Observability & Maintenance](../plans/testing/2025-11-26-phase4-observability-and-maintenance.md)
- [AGENTINFO.md](../../AGENTINFO.md) - Testing requirements section

