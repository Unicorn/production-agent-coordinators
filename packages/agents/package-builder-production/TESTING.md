# Testing the New Granular CLI Activities

## Overview

The `executeCLIAgent` activity has been broken down into granular activities for better visibility in Temporal UI. This document explains how to test these new activities.

## New Activities

1. **`checkCLICreditsForExecution`** - Explicit credit check before execution
2. **`selectClaudeModel`** - Model selection for Claude tasks
3. **`executeGeminiCLI`** - Direct Gemini CLI execution
4. **`executeClaudeCLI`** - Direct Claude CLI execution
5. **`validateCLIResult`** - Result validation and formatting

## Testing Approaches

### 1. Unit Tests

Unit tests for the new activities are located in:
```
src/activities/__tests__/cli-agent.activities.test.ts
```

**Run unit tests:**
```bash
npm test -- cli-agent.activities.test.ts
```

**What's tested:**
- ✅ `checkCLICreditsForExecution` - Returns correct credit status structure
- ✅ `selectClaudeModel` - Selects appropriate models for different tasks
- ✅ `executeGeminiCLI` - Executes Gemini CLI and returns unified result
- ✅ `executeClaudeCLI` - Executes Claude CLI with session management
- ✅ `validateCLIResult` - Validates results and detects provider mismatches

### 2. End-to-End Tests

The existing E2E tests in `src/__tests__/cli-integration.e2e.test.ts` still work because:
- `executeCLIAgent` is maintained as a backward-compatible wrapper
- The workflow now uses granular activities internally
- Tests verify the complete workflow execution

**Run E2E tests:**
```bash
# Make sure Temporal server is running
# Make sure worker is running: npm run start:worker (with TEMPORAL_TASK_QUEUE=engine-cli-e2e)

npm run test:cli
```

**What's tested:**
- ✅ Full package build workflow with Claude CLI
- ✅ Full package build workflow with Gemini CLI
- ✅ Scaffold-only execution
- ✅ Resume detection and continuation

### 3. Manual Testing via Temporal UI

The granular activities provide better visibility in Temporal UI:

1. **Start a workflow:**
   ```bash
   # Use the E2E test script or start workflow manually
   ```

2. **View in Temporal UI:**
   - Navigate to the workflow execution
   - You should now see separate activities for:
     - `checkCLICreditsForExecution`
     - `selectClaudeModel` (for Claude provider)
     - `executeGeminiCLI` or `executeClaudeCLI`
     - `validateCLIResult`

3. **Benefits:**
   - See exactly which step failed
   - Track progress through individual activities
   - Monitor costs per activity
   - Debug specific activity failures

## Test Coverage

### Unit Tests Coverage

All new granular activities have unit tests covering:
- ✅ Happy path execution
- ✅ Error handling
- ✅ Input validation
- ✅ Provider-specific behavior
- ✅ Session management (for Claude)

### E2E Tests Coverage

E2E tests verify:
- ✅ Complete workflow execution
- ✅ Provider selection
- ✅ Credit checking
- ✅ Model selection (for Claude)
- ✅ CLI execution
- ✅ Result validation
- ✅ Error recovery

## Running All Tests

```bash
# Run all unit tests
npm test

# Run only CLI-related unit tests
npm test -- cli-agent.activities.test.ts

# Run E2E tests (requires Temporal server and worker)
npm run test:cli
```

## Debugging Failed Tests

### Unit Test Failures

1. Check that mocks are set up correctly
2. Verify provider availability checks
3. Ensure CLI tools are properly mocked

### E2E Test Failures

1. **Check Temporal server is running:**
   ```bash
   # Should see Temporal server logs
   ```

2. **Check worker is running:**
   ```bash
   TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker
   ```

3. **Check CLI tools are installed:**
   ```bash
   gemini --version
   claude --version
   ```

4. **Check credits/authentication:**
   - Gemini CLI should be authenticated
   - Claude CLI should be authenticated and have credits

## Test Structure

```
src/
├── activities/
│   ├── cli-agent.activities.ts          # Implementation
│   └── __tests__/
│       └── cli-agent.activities.test.ts # Unit tests
└── __tests__/
    └── cli-integration.e2e.test.ts      # E2E tests
```

## Notes

- The new granular activities maintain backward compatibility
- `executeCLIAgent` still works as a wrapper
- Existing tests continue to pass
- New tests verify granular activity behavior

