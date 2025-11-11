# E2E Test Suite

## Overview

This directory contains end-to-end (E2E) tests for the agent-coordinator system. These tests validate the complete integration of all components working together in realistic scenarios.

## Phase 1: Hello World Workflow

The Phase 1 E2E tests (`phase1-hello-world.test.ts`) validate the complete Hello World workflow:

### Test Coverage

1. **Complete Workflow Execution**
   - Tests full workflow from initialization to completion
   - Validates state transitions at each step
   - Verifies artifact storage and persistence
   - Tests workflow iteration limits
   - Ensures proper error handling

2. **Component Integration**
   - Container dependency injection
   - Spec factory registration and instantiation
   - Agent factory registration and execution
   - Storage service integration
   - Logger integration

3. **State Management**
   - Initial state creation
   - Step state transitions (WAITING → IN_PROGRESS → DONE)
   - Final state verification
   - Artifact annotation

### Components Tested

- **HelloSpec**: Phase 1 workflow specification
- **MockAgent**: Deterministic agent for testing
- **Engine**: Core workflow execution engine
- **Container**: Dependency injection container
- **LocalFileStorage**: File-based artifact storage
- **ConsoleLogger**: Logging infrastructure

### Running E2E Tests

```bash
# Run E2E tests only
yarn test:e2e

# Run E2E tests in watch mode
yarn test:e2e:watch

# Run all tests (unit + E2E)
yarn test && yarn test:e2e
```

### Test Structure

Each E2E test follows this pattern:

1. **Setup**: Initialize all required components (Container, Storage, Spec, Agent)
2. **Execution**: Run the complete workflow using Engine.runWorkflow()
3. **Verification**: Assert final state, artifacts, and behavior
4. **Cleanup**: Automatic cleanup via beforeEach hooks

### Configuration

E2E tests use a dedicated vitest configuration (`vitest.config.ts`) that:
- Sets longer timeouts (30s) for complex workflows
- Configures path aliases for source imports
- Uses Node.js environment for file system access

### Design Principles

1. **Integration Testing**: Tests real components working together
2. **Deterministic**: Uses MockAgent instead of AnthropicAgent for predictable results
3. **Isolated**: Each test creates its own temporary storage directory
4. **Comprehensive**: Covers happy paths and error scenarios
5. **Fast**: Completes in <10ms per test

### Future Phases

- Phase 2: Multi-step workflows with TodoSpec
- Phase 3: Error handling and retry logic
- Phase 4: Complex agent interactions
- Phase 5: Performance and load testing

## Coverage Summary

- **8 tests** covering complete workflow execution
- **All tests passing** with clean linting
- **Integration**: Container + Engine + Storage + Specs + Agents
- **Execution time**: <10ms total
