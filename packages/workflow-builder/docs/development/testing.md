# Testing

Testing guidelines for the Workflow Builder.

## Test Types

### Unit Tests

Test individual functions and components:

```typescript
import { describe, it, expect } from 'vitest';
import { compileWorkflow } from '@/lib/workflow-compiler/compiler';

describe('compileWorkflow', () => {
  it('should compile simple workflow', () => {
    const workflow = { /* ... */ };
    const result = compileWorkflow(workflow);
    expect(result.workflowCode).toContain('export async function');
  });
});
```

### Integration Tests

Test component interactions:

```typescript
describe('WorkflowCanvas', () => {
  it('should save workflow on node change', async () => {
    // Test workflow saving
  });
});
```

### E2E Tests

Test complete user flows with Playwright:

```typescript
import { test, expect } from '@playwright/test';

test('should create and deploy workflow', async ({ page }) => {
  await page.goto('/workflows/new');
  // Test workflow creation flow
});
```

## Running Tests

```bash
# Unit tests
yarn test

# E2E tests
yarn test:e2e

# All tests
yarn test:all
```

## Test Files

- **Unit**: `src/**/*.test.ts`
- **E2E**: `tests/e2e/**/*.spec.ts`

## Related Documentation

- [Playwright Tests](../../tests/README.md) - E2E test guide

