# Integration Testing Plan for Phase 4 Features

This document outlines comprehensive integration tests to validate Phase 4 features with real workflows, CLI tools, and external services.

## Test Objectives

1. **Validate PR Creation** - Test with real GitHub repositories
2. **Verify Hook Execution** - Confirm hooks are called during Claude CLI runs
3. **Test Optimization Dashboard** - Analyze real audit logs from builds
4. **End-to-End Workflows** - Full package build with all Phase 4 features
5. **Credential Validation** - Test in various environments

---

## Prerequisites

### Required Services
- [ ] Temporal server running
- [ ] GitHub CLI (`gh`) installed and authenticated
- [ ] Claude CLI installed and authenticated
- [ ] npm configured
- [ ] Git configured

### Test Environment Setup
- [ ] Test GitHub repository (or use existing)
- [ ] Clean workspace directory
- [ ] Temporal worker running
- [ ] All credentials verified

---

## Test Scenarios

### Test 1: End-to-End Package Build with PR Creation
**Priority:** High  
**Duration:** ~10-15 minutes

**Steps:**
1. Start Temporal worker
2. Execute `ClaudeAuditedBuildWorkflow` with:
   - Simple package spec
   - `createPR: true`
   - PR configuration
3. Monitor workflow execution
4. Verify:
   - Package builds successfully
   - All compliance checks pass
   - Git branch created
   - Changes committed
   - Branch pushed
   - PR created on GitHub
   - PR URL returned

**Success Criteria:**
- ✅ Workflow completes successfully
- ✅ PR exists on GitHub
- ✅ PR contains expected content
- ✅ Audit logs generated

---

### Test 2: Hook Execution Validation
**Priority:** High  
**Duration:** ~5 minutes

**Steps:**
1. Execute workflow with Claude CLI
2. Monitor workspace for hook log files
3. Verify:
   - `tool_call_log.jsonl` created
   - `response_log.jsonl` created
   - Logs contain expected data
   - Hooks don't block workflow

**Success Criteria:**
- ✅ Hook log files exist
- ✅ Logs contain tool call data
- ✅ Logs contain response data
- ✅ Workflow completes normally

---

### Test 3: Optimization Dashboard with Real Data
**Priority:** Medium  
**Duration:** ~5 minutes

**Steps:**
1. Run workflow to generate audit logs
2. Run optimization dashboard CLI
3. Verify:
   - Dashboard reads audit logs
   - Analysis is accurate
   - Recommendations are generated
   - Report can be exported

**Success Criteria:**
- ✅ Dashboard analyzes real data
- ✅ Metrics are accurate
- ✅ Recommendations are actionable
- ✅ Export works

---

### Test 4: Credential Checks in Various Scenarios
**Priority:** Medium  
**Duration:** ~5 minutes

**Scenarios:**
1. **All credentials available**
   - Should pass all checks
   - Workflow proceeds normally

2. **Missing GitHub CLI**
   - Should fail fast with clear error
   - Should provide fix instructions

3. **Missing npm**
   - Should fail fast with clear error
   - Should provide fix instructions

4. **Partial credentials**
   - Should identify missing ones
   - Should allow workflow if optional

**Success Criteria:**
- ✅ Early failure when required credentials missing
- ✅ Clear error messages
- ✅ Actionable fix instructions

---

### Test 5: Multi-Package Build with Dependencies
**Priority:** Low  
**Duration:** ~20-30 minutes

**Steps:**
1. Build package with dependencies
2. Verify dependency order
3. Test PR creation for multiple packages
4. Verify dependency relationships

**Success Criteria:**
- ✅ Packages build in correct order
- ✅ Dependencies resolved
- ✅ Multiple PRs created if needed

---

## Test Infrastructure

### Test Helper Functions

```typescript
// Test utilities for integration testing
export async function setupTestWorkspace(): Promise<string>;
export async function cleanupTestWorkspace(path: string): Promise<void>;
export async function waitForWorkflowCompletion(workflowId: string): Promise<void>;
export async function verifyPRExists(prUrl: string): Promise<boolean>;
export async function verifyHookLogs(workspacePath: string): Promise<boolean>;
```

### Test Data

- Simple package specs for testing
- Test GitHub repository
- Mock audit logs for dashboard testing

---

## Implementation Plan

### Step 1: Create Test Infrastructure
- [ ] Test helper utilities
- [ ] Test workspace management
- [ ] Test data fixtures
- [ ] Test assertions

### Step 2: Implement Test Scenarios
- [ ] Test 1: End-to-end with PR
- [ ] Test 2: Hook execution
- [ ] Test 3: Optimization dashboard
- [ ] Test 4: Credential checks
- [ ] Test 5: Multi-package build

### Step 3: Run and Validate
- [ ] Execute all tests
- [ ] Fix any issues
- [ ] Document results
- [ ] Update documentation

---

## Success Metrics

### Functional
- ✅ All integration tests pass
- ✅ PR creation works with real GitHub
- ✅ Hooks execute during workflow
- ✅ Dashboard analyzes real data
- ✅ Credential checks work correctly

### Performance
- ✅ Workflow completes in reasonable time
- ✅ PR creation adds < 1 minute overhead
- ✅ Hooks don't slow down workflow
- ✅ Dashboard analysis is fast

### Quality
- ✅ No data loss
- ✅ No race conditions
- ✅ Proper error handling
- ✅ Clean test cleanup

---

## Rollback Plan

If integration tests reveal issues:
1. Document all failures
2. Prioritize fixes
3. Re-run tests after fixes
4. Update documentation

---

## Notes

- Tests require real external services (GitHub, Claude CLI)
- Some tests may require manual verification
- Test data should be cleaned up after tests
- Consider using test GitHub organization for PRs

