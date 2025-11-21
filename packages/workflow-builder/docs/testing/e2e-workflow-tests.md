# End-to-End Workflow Testing Documentation

## Overview

This document describes the comprehensive E2E test suite for the workflow creation, deployment, and execution lifecycle. The test suite validates the complete user journey from creating a workflow through the UI to monitoring execution results.

## Test Architecture

### Page Object Pattern

The test suite uses the **Page Object Model (POM)** pattern for maintainability and reusability:

- **WorkflowBuilderPage**: Encapsulates all interactions with the workflow builder UI
- **ExecutionMonitorPage**: Encapsulates execution history and monitoring UI

Benefits:
- Centralized element selectors
- Reusable test actions
- Easy to maintain when UI changes
- Clear separation of concerns

### Test Structure

```
tests/e2e/
├── workflows/
│   └── end-to-end.spec.ts        # Main E2E test suite
├── page-objects/
│   ├── WorkflowBuilderPage.ts    # Builder page object
│   └── ExecutionMonitorPage.ts   # Monitor page object
└── helpers/
    ├── workflow.ts               # Workflow helper functions
    └── console-errors.ts         # Error capture utilities
```

## Test Coverage

### Core E2E Test Cases

The test suite covers all acceptance criteria from **MILESTONE-1-TASKS.md**:

#### 1. Single Activity Workflow
**Test**: `should create workflow with 1 activity, deploy, and execute successfully`

Steps:
1. Create workflow through UI
2. Add single activity node
3. Save workflow
4. Compile and verify generated code
5. Execute workflow
6. Verify successful completion
7. Check execution history

**Validates**:
- Basic workflow creation flow
- Activity node configuration
- Code generation
- Workflow execution
- Execution monitoring

---

#### 2. Multiple Activities Workflow
**Test**: `should create workflow with 5 activities, deploy, and execute successfully`

Steps:
1. Create workflow
2. Add 5 activity nodes sequentially
3. Compile workflow
4. Verify all activities in generated code
5. Execute workflow
6. Verify all activities executed

**Validates**:
- Multiple node handling
- Complex workflow compilation
- Multi-activity execution

---

#### 3. Timeout Configuration
**Test**: `should create workflow with timeout configuration and execute`

Steps:
1. Create workflow
2. Add activity with timeout configuration (5 minutes)
3. Compile and verify timeout in code
4. Execute workflow
5. Verify timeout is applied

**Validates**:
- Timeout property configuration
- Timeout code generation
- Runtime timeout enforcement

---

#### 4. Retry Policy Configuration
**Test**: `should create workflow with retry policy and execute`

Steps:
1. Create workflow
2. Add activity with retry policy:
   - Maximum attempts: 3
   - Initial interval: 1s
   - Backoff coefficient: 2.0
3. Compile and verify retry policy in code
4. Execute workflow
5. Verify retry behavior

**Validates**:
- Retry policy configuration
- Retry policy code generation
- Runtime retry behavior

---

#### 5. Code Viewing and Results
**Test**: `should create workflow, view code, execute, and view results`

Steps:
1. Create workflow with activity
2. Compile workflow
3. View generated code in all tabs:
   - Workflow code
   - Activities code
   - Worker code
4. Execute workflow
5. View execution results in history
6. View execution details

**Validates**:
- Code viewer functionality
- Multi-tab code display
- Execution result viewing
- Execution detail navigation

---

#### 6. Invalid Workflow Validation
**Test**: `should prevent deployment of invalid workflow (missing trigger)`

Steps:
1. Create workflow
2. Leave workflow empty (no trigger node)
3. Attempt to compile
4. Verify validation error appears
5. Verify code viewer does NOT open
6. Verify execution is blocked

**Validates**:
- Workflow validation logic
- Error message display
- Deployment prevention
- User feedback on errors

---

#### 7. Node Deletion
**Test**: `should create workflow, delete node, and execute successfully`

Steps:
1. Create workflow
2. Add 3 activity nodes
3. Delete middle node
4. Verify only 2 nodes remain
5. Compile workflow
6. Verify deleted activity NOT in code
7. Verify remaining activities ARE in code
8. Execute successfully

**Validates**:
- Node deletion functionality
- Canvas state updates
- Code generation after deletion
- Execution with modified workflow

---

### Additional UI Tests

#### Keyboard Shortcuts
**Test**: `should support keyboard shortcuts for delete`

Validates:
- Delete key removes selected node
- Keyboard interaction support

#### Auto-Save
**Test**: `should auto-save workflow changes`

Validates:
- Automatic saving after changes
- Persistence across page reloads
- No data loss

#### Execution Monitoring
**Test**: `should display workflow statistics after executions`

Validates:
- Statistics tab functionality
- Execution metrics display
- Historical data tracking

## Prerequisites

Before running E2E tests, ensure:

1. **Temporal Server Running**
   ```bash
   docker-compose up temporal
   ```

2. **Worker Service Running**
   ```bash
   cd packages/workflow-worker-service
   npm run dev
   ```

3. **Database Seeded**
   ```bash
   cd packages/workflow-builder
   npm run db:seed
   ```

4. **Dev Server Running**
   ```bash
   cd packages/workflow-builder
   npm run dev
   ```
   Server must be running on `http://localhost:3010`

5. **Authentication Setup**
   The auth setup script automatically creates test user credentials:
   ```bash
   npm run test:e2e:setup
   ```

## Running Tests

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Specific Test Suite
```bash
npx playwright test tests/e2e/workflows/end-to-end.spec.ts
```

### Run in Headed Mode (Watch Browser)
```bash
npx playwright test --headed
```

### Run Single Test
```bash
npx playwright test --grep "should create workflow with 1 activity"
```

### Debug Mode
```bash
npx playwright test --debug
```

### Generate HTML Report
```bash
npx playwright show-report
```

## Test Configuration

Configuration in `playwright.config.ts`:

```typescript
{
  testDir: './tests/e2e',
  fullyParallel: false,        // Sequential execution
  workers: 1,                   // Single worker for stability
  retries: process.env.CI ? 2 : 0,
  timeout: 60000,              // 60 second test timeout
  expect: {
    timeout: 5000              // 5 second assertion timeout
  },
  use: {
    baseURL: 'http://localhost:3010',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  }
}
```

## Page Object APIs

### WorkflowBuilderPage

#### Creation Methods
```typescript
// Create new workflow
const workflowId = await builderPage.createWorkflow({
  name: 'My Workflow',
  description: 'Test workflow',
  useDefaultProject: true,
});

// Open existing workflow
await builderPage.openBuilder(workflowId);
```

#### Canvas Manipulation
```typescript
// Add activity node
const nodeId = await builderPage.addActivityNode({
  name: 'myActivity',
  timeout: '5 minutes',
  retryPolicy: {
    maximumAttempts: 3,
    initialInterval: '1s',
    backoffCoefficient: 2.0,
  },
});

// Delete node
await builderPage.deleteNode(nodeId);

// Connect nodes
await builderPage.connectNodes(sourceNodeId, targetNodeId);

// Get node count
const count = await builderPage.getActivityNodeCount();
```

#### Workflow Actions
```typescript
// Save workflow
await builderPage.save();

// Compile workflow
await builderPage.compile();

// Get generated code
const workflowCode = await builderPage.getGeneratedCode('workflow');
const activitiesCode = await builderPage.getGeneratedCode('activities');
const workerCode = await builderPage.getGeneratedCode('worker');

// Close code viewer
await builderPage.closeCodeViewer();

// Execute workflow
const executionId = await builderPage.buildAndRun({ input: 'data' });

// Wait for execution
const status = await builderPage.waitForExecution(30000);
```

#### Validation
```typescript
// Check for validation errors
const hasError = await builderPage.hasValidationError();
const errorMessage = await builderPage.getValidationError();

// Get execution results
const result = await builderPage.getExecutionResult();
const error = await builderPage.getExecutionError();
```

### ExecutionMonitorPage

#### Navigation
```typescript
// Navigate to execution history
await monitorPage.navigateToExecutionHistory(workflowId);

// Navigate to statistics
await monitorPage.navigateToStatistics(workflowId);
```

#### Execution History
```typescript
// Get execution list
const executions = await monitorPage.getExecutionList();

// View execution details
await monitorPage.viewExecutionDetails(executionId);

// Get execution status
const status = await monitorPage.getExecutionStatus();

// Get execution duration
const duration = await monitorPage.getExecutionDuration();

// Get execution output
const output = await monitorPage.getExecutionOutput();

// Get execution error
const error = await monitorPage.getExecutionErrorMessage();

// Back to history
await monitorPage.backToHistory();
```

#### Statistics
```typescript
// Get statistics
const stats = await monitorPage.getStatistics();
// Returns: { totalRuns, successRate, averageDuration, mostUsedComponent }

// Check if history is empty
const isEmpty = await monitorPage.isExecutionHistoryEmpty();
```

## Test Data Management

### Cleanup Strategy

Tests create workflows with timestamped names to avoid conflicts:
```typescript
const workflowName = `Test Workflow ${Date.now()}`;
```

### Isolation

- Each test creates its own workflow
- Tests run sequentially to avoid race conditions
- Created workflow IDs are tracked for potential cleanup
- Tests use default project to simplify setup

## Debugging Failed Tests

### 1. Check Prerequisites
```bash
# Verify all services running
docker ps | grep temporal
lsof -i :3010  # Check dev server
```

### 2. Run in Headed Mode
```bash
npx playwright test --headed --grep "failing test name"
```

### 3. Check Screenshots
Failed tests automatically capture screenshots:
```
test-results/
└── [test-name]/
    └── test-failed-1.png
```

### 4. View Trace
```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

### 5. Console Errors
Check test output for captured console errors:
```
Console errors detected: [error messages]
```

## Common Issues and Solutions

### Test Timeout
**Problem**: Test exceeds 60 second timeout

**Solution**:
- Increase timeout for specific test:
  ```typescript
  test('long running test', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes
    // test code
  });
  ```
- Check if worker service is running
- Verify Temporal server is responsive

### Element Not Found
**Problem**: Locator fails to find element

**Solution**:
- Run in headed mode to inspect UI
- Update locator in page object
- Add proper wait conditions:
  ```typescript
  await expect(element).toBeVisible({ timeout: 10000 });
  ```

### Flaky Tests
**Problem**: Test passes sometimes, fails others

**Solution**:
- Add explicit waits instead of timeouts
- Use `waitForLoadState('networkidle')`
- Check for race conditions in UI
- Ensure sequential execution (workers: 1)

### Authentication Failure
**Problem**: Tests fail with auth errors

**Solution**:
- Run auth setup:
  ```bash
  npx playwright test auth.setup.ts
  ```
- Check `playwright/.auth/user.json` exists
- Verify test user in database

## Continuous Integration

### GitHub Actions Configuration

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Start services
        run: docker-compose up -d temporal postgres

      - name: Run migrations
        run: npm run db:migrate

      - name: Seed database
        run: npm run db:seed

      - name: Start dev server
        run: npm run dev &

      - name: Wait for server
        run: npx wait-on http://localhost:3010

      - name: Run E2E tests
        run: npm run test:e2e

      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Performance Benchmarks

Expected execution times (on average hardware):

- Single activity workflow: ~5-10 seconds
- Multi-activity workflow (5 nodes): ~10-15 seconds
- Workflow with timeout: ~5-10 seconds
- Workflow with retry: ~5-15 seconds (varies with retries)
- Code viewing test: ~8-12 seconds
- Invalid workflow test: ~3-5 seconds
- Node deletion test: ~10-15 seconds

Total suite execution: **~60-90 seconds**

## Best Practices

### 1. Use Page Objects
Always use page object methods instead of direct locators:
```typescript
// Good
await builderPage.addActivityNode({ name: 'test' });

// Avoid
await page.locator('[data-component-type="activity"]').click();
```

### 2. Proper Waits
Use explicit waits, not arbitrary timeouts:
```typescript
// Good
await expect(element).toBeVisible();

// Avoid
await page.waitForTimeout(5000);
```

### 3. Meaningful Test Names
Use descriptive test names that explain intent:
```typescript
// Good
test('should create workflow with 1 activity, deploy, and execute successfully', ...)

// Avoid
test('test workflow', ...)
```

### 4. Test Independence
Each test should be fully independent:
- Create own test data
- Clean up after itself
- Don't rely on other tests

### 5. Assertion Clarity
Make assertions clear and specific:
```typescript
// Good
expect(status).toBe('completed');

// Avoid
expect(status).toBeTruthy();
```

## Future Enhancements

Potential additions to test suite:

1. **Visual Regression Testing**
   - Screenshot comparison for UI consistency
   - Detect unintended visual changes

2. **Performance Testing**
   - Measure page load times
   - Track compilation duration
   - Monitor execution latency

3. **Accessibility Testing**
   - WCAG compliance validation
   - Keyboard navigation testing
   - Screen reader compatibility

4. **Cross-Browser Testing**
   - Firefox support
   - WebKit/Safari support
   - Mobile browser testing

5. **API Integration Tests**
   - Direct tRPC endpoint testing
   - Database state validation
   - Temporal workflow queries

## Troubleshooting Guide

### Quick Diagnostic Checklist

```bash
# 1. Check all services
docker ps

# 2. Check dev server
curl http://localhost:3010

# 3. Check database connection
npm run db:status

# 4. Re-run auth setup
npx playwright test auth.setup.ts

# 5. Clear test artifacts
rm -rf test-results playwright-report

# 6. Run single test in debug mode
npx playwright test --debug --grep "test name"
```

### Getting Help

If tests continue to fail:

1. Check recent git commits for breaking changes
2. Review Playwright trace files
3. Compare against passing CI runs
4. Consult team for known issues
5. File issue with:
   - Test output
   - Screenshots
   - Trace files
   - Environment details

## References

- [Playwright Documentation](https://playwright.dev)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [MILESTONE-1-TASKS.md](../../MILESTONE-1-TASKS.md)
- [Workflow Builder Architecture](../architecture/workflow-builder.md)

## Conclusion

This E2E test suite provides comprehensive coverage of the workflow creation, deployment, and execution lifecycle. By following the page object pattern and best practices, the tests are:

- **Maintainable**: Easy to update when UI changes
- **Reliable**: Deterministic execution with proper waits
- **Comprehensive**: All acceptance criteria covered
- **Isolated**: Tests run independently
- **Fast**: Efficient execution under 2 minutes

The test suite ensures production-ready quality for the workflow builder feature.
