# Testing Pyramid - Package Builder Production

## Current Testing Layers

### Layer 1: Unit Tests ✅
**Status**: Passing  
**Location**: `src/workflows/__tests__/package-build.workflow.test.ts`, `src/activities/__tests__/cli-agent.activities.test.ts`

**What's tested:**
- Type checking and data structure validation
- Activity function signatures and return types
- Helper functions and utilities
- Mock validation

**Speed**: Fast (< 1 second)  
**Requirements**: None  
**Run**: `npm test`

---

### Layer 2: Integration Tests (TestWorkflowEnvironment) ✅
**Status**: Passing (just fixed)  
**Location**: `src/workflows/__tests__/package-build.workflow.integration.test.ts`

**What's tested:**
- Workflow execution with `TestWorkflowEnvironment`
- Activity orchestration and sequencing
- Workflow logic and decision making
- Task breakdown and iterative planning
- Error handling and recovery

**Speed**: Medium (5-10 seconds)  
**Requirements**: `@temporalio/testing` package  
**Run**: `npm test -- package-build.workflow.integration.test.ts`

**Key difference from E2E**: Uses mocked activities, no real CLI calls, no real Temporal server

---

### Layer 3: E2E Tests (Real Temporal + Real CLI) ⏭️
**Status**: Next step  
**Location**: `src/__tests__/cli-integration.e2e.test.ts`

**What's tested:**
- Complete workflow execution with real Temporal server
- Real CLI tool execution (Claude/Gemini)
- Real file system operations
- Real activity execution
- End-to-end package building

**Speed**: Slow (5-10 minutes per test)  
**Requirements**:
- Temporal server running (`localhost:7233`)
- Worker running with CLI activities
- Claude CLI installed and authenticated
- Gemini CLI installed and authenticated

**Run**: `npm run test:cli`

**Key difference from Integration**: Uses real Temporal server, real CLI tools, real activities

---

## Testing Strategy

### Recommended Testing Flow

1. **Unit Tests** → Run first, catch type/logic errors quickly
2. **Integration Tests** → Verify workflow orchestration with mocked activities
3. **E2E Tests** → Validate complete system with real dependencies

### When to Run Each Layer

- **During Development**: Unit + Integration tests (fast feedback)
- **Before Committing**: All tests including E2E (full validation)
- **In CI/CD**: All tests (comprehensive validation)

---

## Next Steps

### Immediate: Run E2E Tests

The E2E tests are the next logical step to validate the complete workflow:

```bash
# 1. Ensure Temporal server is running
# Check: http://localhost:7233/health

# 2. Start worker in separate terminal
cd packages/agents/package-builder-production
TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker

# 3. Run E2E tests
npm run test:cli
```

### What E2E Tests Will Validate

- ✅ Workflow executes successfully with real Temporal
- ✅ Granular activities appear in Temporal UI
- ✅ Real CLI tools are called correctly
- ✅ Task breakdown and iterative planning works
- ✅ Activity requests are handled properly
- ✅ Session management (for Claude) works
- ✅ Error handling and recovery

---

## Test Coverage Summary

| Layer | Tests | Status | Speed | Real Dependencies |
|-------|-------|--------|-------|-------------------|
| Unit | 14 tests | ✅ Passing | < 1s | None |
| Integration | 2 tests | ✅ Passing | 5-10s | TestWorkflowEnvironment |
| E2E | 2+ tests | ⏭️ Next | 5-10min | Temporal + CLI tools |

---

## Notes

- **No middle layer needed**: The jump from Integration (mocked) to E2E (real) is appropriate
- **Integration tests are sufficient** for validating workflow logic without external dependencies
- **E2E tests validate** the complete system including real CLI execution
- **Both are necessary** for comprehensive coverage

