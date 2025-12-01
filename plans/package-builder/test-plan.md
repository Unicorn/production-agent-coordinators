# CLI Agent Integration Test Plan

## Overview

This test plan validates the end-to-end CLI agent integration in PackageBuildWorkflow, ensuring that:
1. Gemini CLI agent works correctly
2. Claude CLI agent works correctly
3. Provider selection and fallback work
4. Resume capability works
5. Multi-package builds work

## Test Environment Setup

### Prerequisites
- Gemini CLI installed and authenticated (`gemini --version`)
- Claude CLI installed and authenticated (`claude --version`)
- Temporal server running
- Worker running with CLI activities registered
- Test package plan available

### Environment Variables
```bash
GEMINI_API_KEY=your_key_here  # Optional if CLI handles auth
ANTHROPIC_API_KEY=your_key_here  # Optional if CLI handles auth
TEMPORAL_NAMESPACE=default
TEMPORAL_ADDRESS=localhost:7233
```

## Test Cases

### Test 1: Basic Gemini CLI Agent Execution
**Objective**: Verify Gemini CLI agent can execute a simple scaffold task

**Steps**:
1. Create a test workspace
2. Call `executeCLIAgent` with Gemini provider
3. Task: Scaffold a simple package (package.json, tsconfig.json)
4. Verify files are created
5. Verify result structure

**Expected Result**:
- Files created successfully
- `CLIAgentResult` has `success: true`
- `provider: 'gemini'`
- `session_id` is empty (Gemini doesn't use sessions)

### Test 2: Basic Claude CLI Agent Execution
**Objective**: Verify Claude CLI agent can execute a simple scaffold task

**Steps**:
1. Create a test workspace
2. Call `executeCLIAgent` with Claude provider
3. Task: Scaffold a simple package
4. Verify files are created
5. Verify session_id is captured

**Expected Result**:
- Files created successfully
- `CLIAgentResult` has `success: true`
- `provider: 'claude'`
- `session_id` is present and non-empty

### Test 3: Provider Selection (Gemini Preferred)
**Objective**: Verify ProviderFactory selects Gemini when both are available

**Steps**:
1. Set up both providers as available
2. Call `selectProvider` with no preference
3. Verify Gemini is selected

**Expected Result**:
- Gemini provider selected
- Credit status checked

### Test 4: Provider Fallback (Gemini → Claude)
**Objective**: Verify fallback works when Gemini fails

**Steps**:
1. Set up Gemini as unavailable (rate limited)
2. Call `executeWithFallback`
3. Verify Claude is used as fallback
4. Verify result indicates fallback occurred

**Expected Result**:
- Gemini attempt fails
- Claude attempt succeeds
- Result shows fallback occurred

### Test 5: Session Continuity (Claude)
**Objective**: Verify Claude session management works across multiple calls

**Steps**:
1. Execute first Claude agent call (scaffold)
2. Capture session_id
3. Execute second Claude agent call (implement) with session_id
4. Verify Claude remembers context

**Expected Result**:
- First call returns session_id
- Second call uses session_id
- Claude references previous work in response

### Test 6: Resume Detection
**Objective**: Verify resume detection identifies partial builds

**Steps**:
1. Create a package with partial implementation (package.json exists, src/ missing)
2. Call `detectResumePoint`
3. Verify correct phase is detected
4. Verify resume instructions are generated

**Expected Result**:
- Phase detected: 'scaffold' or 'implement'
- Resume instructions include existing files
- Resume instructions include missing files

### Test 7: End-to-End Package Build (Gemini)
**Objective**: Complete package build using Gemini CLI

**Steps**:
1. Start PackageBuildWorkflow with test package
2. Verify scaffold phase uses Gemini
3. Verify implement phase uses Gemini
4. Verify build/test/publish phases complete
5. Verify package is published

**Expected Result**:
- All phases complete successfully
- Package built and tested
- Package published (or ready to publish)

### Test 8: End-to-End Package Build (Claude)
**Objective**: Complete package build using Claude CLI

**Steps**:
1. Start PackageBuildWorkflow with test package (force Claude)
2. Verify scaffold phase uses Claude
3. Verify implement phase uses Claude (with session)
4. Verify build/test/publish phases complete

**Expected Result**:
- All phases complete successfully
- Session continuity maintained
- Package built and tested

### Test 9: End-to-End with Fallback
**Objective**: Verify fallback works in real workflow

**Steps**:
1. Start PackageBuildWorkflow
2. Simulate Gemini rate limit during scaffold
3. Verify workflow falls back to Claude
4. Verify build completes

**Expected Result**:
- Gemini fails with rate limit
- Claude takes over seamlessly
- Build completes successfully

### Test 10: Multi-Package Build
**Objective**: Verify PackageBuilderWorkflow coordinates multiple packages

**Steps**:
1. Start PackageBuilderWorkflow with 3 packages (with dependencies)
2. Verify packages build in dependency order
3. Verify each uses CLI agents correctly
4. Verify all packages complete

**Expected Result**:
- Packages build in correct order
- Dependencies resolved
- All packages complete successfully

## Test Script Structure

```typescript
// test-cli-integration.ts
// 1. Unit tests for CLI abstraction
// 2. Integration tests for provider selection
// 3. End-to-end workflow tests
// 4. Mock utilities for testing
```

## Success Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] End-to-end tests complete successfully
- [ ] No regressions in existing functionality
- [ ] Performance is acceptable (< 5 min per package)

## Known Limitations

1. **CLI Availability**: Tests require actual CLI tools installed
2. **Rate Limits**: Real API calls may hit rate limits
3. **Cost**: Real API calls incur costs
4. **Time**: End-to-end tests take time (5-10 min each)

## Mitigation Strategies

1. **Mock Mode**: Create mock CLI providers for unit tests
2. **Test Packages**: Use minimal test packages to reduce cost/time
3. **Parallel Testing**: Run tests in parallel where possible
4. **CI Integration**: Run full tests in CI with proper credentials

