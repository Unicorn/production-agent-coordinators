# Compiler-Execution Integration Tests

## Overview

This test suite verifies that the workflow compiler generates production-quality TypeScript code that executes correctly in a real Temporal instance. These tests validate the complete workflow lifecycle from compilation through execution.

## Test Structure

```
compiler-execution/
├── fixtures/                    # Test workflow definitions
│   ├── simple-workflow.ts       # Basic single-activity workflow
│   ├── retry-workflow.ts        # Workflow with retry configuration
│   ├── timeout-workflow.ts      # Workflow with timeout configuration
│   ├── multi-activity-workflow.ts  # 5-activity sequential workflow
│   ├── invalid-workflow.ts      # Invalid workflows for error testing
│   └── index.ts                 # Fixture exports
├── test-helpers.ts              # Integration test utilities
├── end-to-end.test.ts          # Basic compilation and execution tests
├── retry-handling.test.ts      # Retry policy tests
├── timeout-handling.test.ts    # Timeout handling tests
└── README.md                    # This file
```

## Prerequisites

### Required Services

1. **Temporal Server** - Must be running before tests
   ```bash
   # Start Temporal via docker-compose
   cd /path/to/project
   docker-compose -f docker/temporal/docker-compose.temporal.yml up -d
   ```

2. **Environment Variables**
   ```bash
   export TEMPORAL_ADDRESS=localhost:7233
   export TEMPORAL_NAMESPACE=default
   ```

### Dependencies

All dependencies are managed by the parent package. Ensure you've run:

```bash
npm install
# or
yarn install
```

## Running Tests

### Run All Integration Tests

```bash
# From project root
npm run test:integration

# From workflow-builder package
cd packages/workflow-builder
npm run test:integration
```

### Run Specific Test Suite

```bash
# End-to-end tests only
npm test tests/integration/compiler-execution/end-to-end.test.ts

# Retry handling tests only
npm test tests/integration/compiler-execution/retry-handling.test.ts

# Timeout handling tests only
npm test tests/integration/compiler-execution/timeout-handling.test.ts
```

### Run in Watch Mode (NOT recommended for integration tests)

```bash
# These tests use real Temporal - don't watch
npm test -- --watch tests/integration/compiler-execution
```

## Test Coverage

### M1-T081 Acceptance Criteria

- ✅ Test: Compile workflow, execute in Temporal, verify completion
- ✅ Test: Compile workflow with retry, force failure, verify retry occurs
- ✅ Test: Compile workflow with timeout, force slow activity, verify timeout
- ✅ Test: Compile 5 different workflows, execute all simultaneously
- ✅ Test: Compile workflow, register with worker, execute immediately
- ✅ Test: Compile invalid workflow, verify compiler error

### Test Categories

#### 1. End-to-End Tests (`end-to-end.test.ts`)

Tests the complete workflow lifecycle:
- Simple workflow compilation and execution
- Multi-activity workflows (5 sequential activities)
- Immediate execution after registration
- Concurrent execution of multiple workflows
- Workflow history and monitoring
- Workflow cancellation
- Compiler error handling
- TypeScript code validation
- Generated code structure

#### 2. Retry Handling Tests (`retry-handling.test.ts`)

Tests retry policies and error recovery:
- Exponential backoff retry
- Max attempts configuration
- Different retry strategies (keep-trying, fail-after-x, none)
- Retry timing and backoff intervals
- Max interval limits
- Workflow history for retries

#### 3. Timeout Handling Tests (`timeout-handling.test.ts`)

Tests timeout configurations:
- Activity-level timeouts
- Workflow-level timeouts
- Timeout with retry combinations
- Multiple activities with different timeouts
- Timeout events in history
- Duration string parsing

## Test Helpers

### IntegrationTestContext

Main test harness for managing Temporal resources:

```typescript
const context = new IntegrationTestContext();
await context.setup();

// Compile and register workflow
const { workflowCode, worker } = await context.compileAndRegister(workflow);

// Execute workflow
const result = await context.executeWorkflow(workflowName, workflowId, args);

// Cleanup
await context.cleanup();
```

### Test Activities

Pre-built activity implementations for testing:

- `sayHello()` - Simple success activity
- `stepOne()` through `stepFive()` - Sequential activities
- `flakyActivity()` - Fails first N attempts for retry testing
- `slowActivity()` - Delays for timeout testing

### Utility Functions

- `generateWorkflowId()` - Generate unique workflow IDs
- `sleep()` - Promise-based delay
- `retryWithBackoff()` - Retry with exponential backoff

## Best Practices

### 1. Temporal Must Be Running

These tests require a real Temporal instance. They will fail if Temporal is not accessible.

```bash
# Verify Temporal is running
curl http://localhost:7233/health
```

### 2. Test Isolation

Each test creates unique workflow IDs to prevent conflicts:

```typescript
const workflowId = generateWorkflowId('my-test');
```

### 3. Proper Cleanup

Always use `beforeAll` and `afterAll` hooks:

```typescript
beforeAll(async () => {
  context = new IntegrationTestContext();
  await context.setup();
}, 30000);

afterAll(async () => {
  await context.cleanup();
}, 10000);
```

### 4. Realistic Timeouts

Integration tests take time. Set appropriate timeouts:

```typescript
it('should execute workflow', async () => {
  // Test implementation
}, 60000); // 60 second timeout
```

### 5. No Watch Mode

Don't use `--watch` with integration tests - they consume Temporal resources.

## Debugging

### Enable Verbose Logging

Set environment variables for detailed logs:

```bash
export DEBUG=temporal*
export LOG_LEVEL=debug
npm test
```

### View Temporal UI

Monitor executions in Temporal Web UI:

```
http://localhost:8080
```

### Common Issues

#### Tests Timeout

- Verify Temporal is running
- Check network connectivity to localhost:7233
- Increase test timeout values

#### Worker Registration Fails

- Check worker logs for compilation errors
- Verify generated code is valid TypeScript
- Ensure activities are properly exported

#### Flaky Tests

- Integration tests shouldn't be flaky
- If they are, it indicates a real timing issue
- Don't just increase timeouts - investigate root cause

## Maintenance

### Adding New Tests

1. Create fixture in `fixtures/` if needed
2. Add test to appropriate test file
3. Use `IntegrationTestContext` for setup/cleanup
4. Set realistic timeout values
5. Document what the test verifies

### Updating Fixtures

When modifying workflow definitions:
1. Update fixture file
2. Update tests that use the fixture
3. Verify all tests still pass
4. Document breaking changes

## CI/CD Integration

These tests run in CI with a Temporal instance:

```yaml
# GitHub Actions example
- name: Start Temporal
  run: docker-compose -f docker/temporal/docker-compose.temporal.yml up -d

- name: Wait for Temporal
  run: |
    timeout 60 bash -c 'until curl -f http://localhost:7233/health; do sleep 2; done'

- name: Run Integration Tests
  run: npm run test:integration

- name: Stop Temporal
  run: docker-compose -f docker/temporal/docker-compose.temporal.yml down
```

## Performance Benchmarks

Expected test execution times (with Temporal running):

- Simple workflow execution: < 5 seconds
- Multi-activity workflow: < 10 seconds
- Retry tests: 10-30 seconds (depends on backoff)
- Timeout tests: 5-15 seconds
- Full test suite: 3-5 minutes

## Related Documentation

- [Workflow Compiler](/packages/workflow-builder/src/lib/compiler/README.md)
- [Worker Manager](/packages/workflow-worker-service/README.md)
- [Execution Service](/packages/workflow-builder/src/lib/execution/README.md)
- [MILESTONE-1-TASKS.md](/packages/workflow-builder/plans/packagebuildermigrate/MILESTONE-1-TASKS.md)

## Support

For issues or questions:
1. Check Temporal logs: `docker-compose logs temporal`
2. Check worker logs in test output
3. Review workflow history in Temporal UI
4. Consult Temporal documentation: https://docs.temporal.io
