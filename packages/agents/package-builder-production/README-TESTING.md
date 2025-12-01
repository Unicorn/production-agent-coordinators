# CLI Agent Integration Testing Guide

## Quick Start

### Prerequisites
1. **Gemini CLI**: Install and authenticate
   ```bash
   # Check if installed
   gemini --version
   
   # If not installed, follow Gemini CLI installation guide
   ```

2. **Claude CLI**: Install and authenticate
   ```bash
   # Check if installed
   claude --version
   
   # If not installed, follow Claude CLI installation guide
   ```

3. **Temporal Server**: Running on localhost:7233
   ```bash
   # Start Temporal (if using docker-compose)
   docker-compose up -d temporal
   
   # Verify it's running
   curl http://localhost:7233/health
   ```

4. **Worker**: Running with CLI activities
   ```bash
   # In one terminal
   yarn workspace @coordinator/agent-package-builder-production start:worker
   ```

### Run Tests

#### Unit Tests (Fast, No CLI Required)
```bash
yarn test cli-agent.activities.test.ts
```

#### Integration Tests (Requires CLI and Temporal)
```bash
# Run all CLI integration tests
yarn test:cli

# Or use the test script (includes checks)
yarn test:integration
```

#### Watch Mode
```bash
yarn test:cli:watch
```

## Test Structure

### Unit Tests
- **File**: `src/activities/__tests__/cli-agent.activities.test.ts`
- **Purpose**: Test CLI abstraction layer without actual CLI calls
- **Speed**: Fast (< 1 second)
- **Requirements**: None

### Integration Tests
- **File**: `src/__tests__/cli-integration.e2e.test.ts`
- **Purpose**: Test end-to-end workflow with real CLI tools
- **Speed**: Slow (5-10 minutes per test)
- **Requirements**: CLI tools, Temporal server, Worker running

## Test Cases

### 1. Basic CLI Agent Execution
Tests that CLI agents can execute simple tasks.

**Gemini Test**:
- Creates test workspace
- Executes scaffold task
- Verifies files created
- Verifies result structure

**Claude Test**:
- Same as Gemini
- Additionally verifies session_id capture

### 2. Provider Selection
Tests that ProviderFactory selects the correct provider.

**Test**: Gemini preferred when both available

### 3. Provider Fallback
Tests that fallback works when primary provider fails.

**Test**: Gemini → Claude fallback on rate limit

### 4. Session Continuity (Claude)
Tests that Claude session management works.

**Test**: Multiple calls with session_id maintain context

### 5. Resume Detection
Tests that partial builds are detected and resumed.

**Test**: Package with partial implementation resumes correctly

### 6. End-to-End Package Build
Tests complete package build workflow.

**Gemini E2E**:
- Full scaffold → implement → build → test → publish flow
- Verifies all files created
- Verifies package is valid

**Claude E2E**:
- Same as Gemini
- Verifies session continuity

## Troubleshooting

### "Gemini CLI not found"
- Install Gemini CLI
- Ensure it's in PATH
- Run `gemini --version` to verify

### "Claude CLI not found"
- Install Claude CLI
- Ensure it's in PATH
- Run `claude --version` to verify

### "Temporal server not running"
- Start Temporal server
- Check `curl http://localhost:7233/health`
- Verify TEMPORAL_ADDRESS environment variable

### "Worker not running"
- Start worker in separate terminal
- Check worker logs for errors
- Verify activities are registered

### "Tests timeout"
- CLI operations can take 5-10 minutes
- Increase timeout in test file if needed
- Check worker logs for activity execution

### "Rate limit errors"
- CLI tools may hit rate limits
- Wait and retry
- Consider using test API keys with higher limits

## Test Data

Tests use minimal package specifications to:
- Reduce execution time
- Minimize API costs
- Keep tests focused

Test packages are created in `test-workspace/` and cleaned up after tests.

## CI/CD Integration

For CI/CD, ensure:
1. CLI tools are installed in CI environment
2. API keys are set as secrets
3. Temporal server is available
4. Worker is started before tests
5. Test timeouts are appropriate (10+ minutes)

## Next Steps

After tests pass:
1. Review test output for any warnings
2. Check audit logs for token usage
3. Verify package quality (lint, test coverage)
4. Test with real packages (not test packages)

