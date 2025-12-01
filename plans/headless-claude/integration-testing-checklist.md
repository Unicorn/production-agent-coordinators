# Integration Testing Checklist

## Overview

This checklist covers end-to-end integration testing of the Claude CLI integration with real workflows, repositories, and services. All features should be validated in a production-like environment.

---

## Prerequisites Checklist

Before starting integration tests, verify:

- [ ] **Temporal Server**
  - [ ] Temporal server is running
  - [ ] Worker can connect to Temporal
  - [ ] Workflows can be executed

- [ ] **GitHub CLI**
  - [ ] `gh` CLI is installed
  - [ ] `gh auth status` shows authenticated
  - [ ] Has permissions to create PRs in test repository

- [ ] **Claude CLI**
  - [ ] Claude CLI is installed (`claude --version`)
  - [ ] Claude CLI is authenticated
  - [ ] Can execute `claude -p "test" --output-format json` successfully

- [ ] **Test Repository**
  - [ ] Test repository exists (or can be created)
  - [ ] Has write access
  - [ ] Can create branches and PRs

- [ ] **NPM/Node**
  - [ ] Node.js installed
  - [ ] npm/pnpm available
  - [ ] Can install packages

- [ ] **Credentials**
  - [ ] All credential checks pass (`checkCredentials` activity)
  - [ ] GitHub token available
  - [ ] NPM token available (if needed)
  - [ ] Packages API credentials (if needed)

---

## Test 1: End-to-End Package Build with PR Creation

**Goal:** Validate complete workflow from spec to PR

### Setup
- [ ] Create test package specification
- [ ] Create test requirements file
- [ ] Set up test repository branch

### Execution
- [ ] Run `ClaudeAuditedBuildWorkflow` with test spec
- [ ] Verify workspace is created
- [ ] Verify `CLAUDE.md` is written correctly
- [ ] Verify scaffolding phase completes
- [ ] Verify implementation phase completes
- [ ] Verify compliance checks run
- [ ] Verify repair loop works (if needed)
- [ ] Verify final validation passes

### Git Operations
- [ ] Verify branch is created
- [ ] Verify commit is created with proper message
- [ ] Verify push succeeds
- [ ] Verify PR is created
- [ ] Verify PR has correct title and body
- [ ] Verify PR has correct labels

### Validation
- [ ] Check generated code compiles
- [ ] Check generated code passes lint
- [ ] Check generated code passes tests
- [ ] Check PR contains all expected files
- [ ] Check PR description is accurate

**Expected Result:** Complete package built, committed, pushed, and PR created successfully

---

## Test 2: Hook Execution Verification

**Goal:** Verify hooks are called during actual Claude CLI execution

### Setup
- [ ] Verify `.claude/settings.json` exists
- [ ] Verify hook scripts are executable
- [ ] Clear hook log files (`tool_call_log.jsonl`, `response_log.jsonl`)

### Execution
- [ ] Run workflow that triggers Claude CLI
- [ ] Monitor hook script execution
- [ ] Check hook log files are created
- [ ] Verify tool calls are logged
- [ ] Verify responses are logged

### Validation
- [ ] `tool_call_log.jsonl` contains entries
- [ ] `response_log.jsonl` contains entries
- [ ] Log entries have correct structure
- [ ] Log entries have timestamps
- [ ] Log entries link to workflow steps

**Expected Result:** Hooks execute and log all tool calls and responses

---

## Test 3: Optimization Dashboard with Real Data

**Goal:** Test optimization dashboard with real audit logs

### Setup
- [ ] Run multiple workflow executions
- [ ] Ensure `audit_trace.jsonl` files are generated
- [ ] Collect audit logs from different workflow runs

### Execution
- [ ] Run `optimization-dashboard` CLI tool
- [ ] Point to workspace with audit logs
- [ ] Generate analysis report

### Validation
- [ ] Dashboard reads audit logs correctly
- [ ] Cost analysis is accurate
- [ ] Model usage is tracked
- [ ] Error patterns are identified
- [ ] Recommendations are generated
- [ ] Report is readable and actionable

**Expected Result:** Dashboard successfully analyzes real audit data and provides insights

---

## Test 4: Credential Checks in Various Environments

**Goal:** Validate credential checks work in different environments

### Test Scenarios
- [ ] **All credentials available**
  - [ ] All checks pass
  - [ ] Workflow continues normally

- [ ] **Missing GitHub CLI**
  - [ ] Check fails early
  - [ ] Error message is clear
  - [ ] Workflow fails gracefully

- [ ] **Missing Claude CLI**
  - [ ] Check fails early
  - [ ] Error message is clear
  - [ ] Workflow fails gracefully

- [ ] **Missing NPM**
  - [ ] Check fails early
  - [ ] Error message is clear
  - [ ] Workflow fails gracefully

- [ ] **Partial credentials**
  - [ ] Only available credentials are checked
  - [ ] Missing credentials are reported
  - [ ] Workflow behavior is appropriate

**Expected Result:** Credential checks fail fast with clear error messages

---

## Test 5: Parallel Workflow Execution

**Goal:** Test parallel build workflow with real packages

### Setup
- [ ] Create test package with multiple independent modules
- [ ] Define parallel tasks (e.g., types, core, tests)
- [ ] Set up test repository

### Execution
- [ ] Run `ParallelBuildWorkflow` with multiple tasks
- [ ] Verify worktrees are created
- [ ] Verify parallel execution occurs
- [ ] Verify each worktree completes independently
- [ ] Verify merge succeeds
- [ ] Verify final validation passes

### Validation
- [ ] All worktrees are isolated
- [ ] No file conflicts occur
- [ ] Merge combines all changes correctly
- [ ] Final code compiles and passes tests
- [ ] Worktrees are cleaned up

**Expected Result:** Parallel workflow successfully builds package with multiple tasks

---

## Test 6: Model Selection and Routing

**Goal:** Verify model selection works correctly

### Test Scenarios
- [ ] **Architecture phase**
  - [ ] Uses Opus with extended thinking
  - [ ] Plan mode is enabled
  - [ ] No files are modified

- [ ] **Scaffolding phase**
  - [ ] Uses Sonnet
  - [ ] Files are created correctly

- [ ] **Implementation phase**
  - [ ] Uses Sonnet
  - [ ] Code is generated correctly

- [ ] **Repair phase - ESLint errors**
  - [ ] Uses Haiku
  - [ ] Fixes are applied correctly

- [ ] **Repair phase - Cross-file issues**
  - [ ] Uses Opus with thinking
  - [ ] Architectural fixes are applied

**Expected Result:** Correct model is selected for each phase

---

## Test 7: Session Management

**Goal:** Verify Claude session continuity works

### Execution
- [ ] Run workflow with multiple steps
- [ ] Verify session ID is captured
- [ ] Verify session is resumed in next step
- [ ] Verify Claude remembers previous context

### Validation
- [ ] Session ID is consistent across steps
- [ ] Claude references previous work
- [ ] No redundant context is sent
- [ ] Conversation flows naturally

**Expected Result:** Session management maintains context across workflow steps

---

## Test 8: Error Handling and Recovery

**Goal:** Verify error handling works correctly

### Test Scenarios
- [ ] **CLI execution failure**
  - [ ] Error is caught
  - [ ] Error message is clear
  - [ ] Workflow fails gracefully

- [ ] **Compliance check failure**
  - [ ] Repair loop is triggered
  - [ ] Repair attempts are logged
  - [ ] Max attempts are respected

- [ ] **Git operation failure**
  - [ ] Error is caught
  - [ ] Error message is clear
  - [ ] Workflow fails gracefully

- [ ] **Merge conflict**
  - [ ] Conflict is detected
  - [ ] Error is reported
  - [ ] Workflow fails gracefully

**Expected Result:** All errors are handled gracefully with clear messages

---

## Test 9: Audit Logging

**Goal:** Verify audit logging captures all necessary data

### Validation
- [ ] Audit entries are created for each step
- [ ] Cost is tracked accurately
- [ ] Model usage is tracked
- [ ] Validation status is tracked
- [ ] Error information is captured
- [ ] Timestamps are accurate
- [ ] Workflow run ID links entries

**Expected Result:** Complete audit trail is generated for analysis

---

## Test 10: Cleanup and Resource Management

**Goal:** Verify cleanup happens correctly

### Validation
- [ ] Workspaces are cleaned up after completion
- [ ] Worktrees are removed after merge
- [ ] Temporary files are deleted
- [ ] No orphaned processes remain
- [ ] No disk space leaks

**Expected Result:** All resources are cleaned up properly

---

## Success Criteria

All integration tests pass when:
- [ ] All 10 test scenarios complete successfully
- [ ] No critical errors occur
- [ ] All features work as expected
- [ ] Performance is acceptable
- [ ] Error messages are clear and actionable
- [ ] Audit logs are complete and accurate

---

## Test Execution Log

Use this section to track test execution:

| Test | Date | Status | Notes |
|------|------|--------|-------|
| Test 1: E2E Package Build | | ⏸️ | |
| Test 2: Hook Execution | | ⏸️ | |
| Test 3: Optimization Dashboard | | ⏸️ | |
| Test 4: Credential Checks | | ⏸️ | |
| Test 5: Parallel Workflow | | ⏸️ | |
| Test 6: Model Selection | | ⏸️ | |
| Test 7: Session Management | | ⏸️ | |
| Test 8: Error Handling | | ⏸️ | |
| Test 9: Audit Logging | | ⏸️ | |
| Test 10: Cleanup | | ⏸️ | |

---

## Issues Found

Document any issues discovered during testing:

### Issue 1: [Title]
- **Description:**
- **Severity:** Critical / High / Medium / Low
- **Steps to Reproduce:**
- **Expected Behavior:**
- **Actual Behavior:**
- **Status:** Open / Fixed / Deferred

---

## Next Steps After Integration Testing

Once integration testing is complete:

1. **Fix any issues found**
   - Prioritize critical issues
   - Document fixes
   - Re-test affected scenarios

2. **Enhance Hook Logging**
   - Add token tracking
   - Add file modification tracking
   - Add execution time tracking

3. **Enhance Optimization Dashboard**
   - Add visualization
   - Create web UI
   - Add trend analysis

4. **Production Deployment**
   - Final validation
   - Performance testing
   - Documentation review

