# Integration Testing Cleanup Guide

## Overview

All integration tests include comprehensive cleanup mechanisms to prevent resource leaks, CPU/RAM issues, and orphaned workflows.

## Cleanup Mechanisms

### 1. Automatic Cleanup in Tests

**Unit/Integration Tests:**
- `afterEach` hooks clean up test workspaces
- `afterAll` hooks ensure final cleanup
- Temporary directories are automatically removed

**E2E Test Script:**
- Automatic cleanup on success (unless `KEEP_WORKSPACE=true`)
- Cleanup on error (workflows cancelled, workspaces removed)
- Signal handlers (SIGINT, SIGTERM) trigger cleanup
- Uncaught exception handler triggers cleanup

### 2. Cleanup Utilities

**Location:** `packages/temporal-coordinator/src/test-cleanup-utils.ts`

**Functions:**
- `cancelWorkflows()` - Cancel running Temporal workflows
- `removeWorkspaces()` - Remove workspace directories
- `killProcesses()` - Kill processes matching patterns
- `cleanupTestResources()` - Comprehensive cleanup
- `cleanupTestWorkflowsByPattern()` - Cleanup workflows by pattern
- `cleanupOldWorkspaces()` - Remove old workspace directories

### 3. Cleanup Script

**Location:** `packages/temporal-coordinator/scripts/cleanup-test-resources.sh`

**Usage:**
```bash
# Cleanup test workflows and workspaces
./packages/temporal-coordinator/scripts/cleanup-test-resources.sh

# Also check for orphaned processes
./packages/temporal-coordinator/scripts/cleanup-test-resources.sh --kill-processes
```

## What Gets Cleaned Up

### Workflows
- Running workflows matching test patterns:
  - `integration-test-*`
  - `claude-build-*`
  - `test-e2e-*`
- Workflows are cancelled (not terminated) to allow graceful shutdown

### Workspaces
- Workspace directories in `/tmp/claude-builds/`
- Old workspaces (>24 hours) are automatically removed
- Workspaces are removed recursively with force flag

### Processes
- Optional: Processes matching patterns (use with caution)
- Patterns: `claude`, `node.*worker`
- Uses TERM signal first, then KILL if needed

## Running Tests with Cleanup

### Automated Test Runner
```bash
# Runs tests 1-2 with automatic cleanup
./packages/temporal-coordinator/scripts/run-integration-tests-with-cleanup.sh
```

### Manual E2E Test
```bash
# Run with automatic cleanup
cd packages/temporal-coordinator
npm run test:integration:e2e -p src/test-package-spec.md

# Keep workspace for inspection
KEEP_WORKSPACE=true npm run test:integration:e2e -p src/test-package-spec.md
```

### Individual Tests
```bash
# Run with automatic cleanup
cd packages/agents/package-builder-production
npm test -- integration-test-1-credentials.test.ts
npm test -- integration-test-2-hooks.test.ts
```

## Cleanup Behavior

### On Success
- Workflows: Not cancelled (already completed)
- Workspaces: Removed (unless `KEEP_WORKSPACE=true`)
- Processes: Not killed (should be stopped naturally)

### On Error/Timeout
- Workflows: Cancelled immediately
- Workspaces: Removed
- Processes: Not killed (manual intervention may be needed)

### On Interrupt (Ctrl+C)
- Workflows: Cancelled
- Workspaces: Removed
- Processes: Not killed
- Connection: Closed gracefully

## Monitoring Resource Usage

### Check Running Workflows
```bash
temporal workflow list --status RUNNING
```

### Check Workspace Usage
```bash
du -sh /tmp/claude-builds/*
```

### Check Process Usage
```bash
# Node processes
ps aux | grep node

# Claude CLI processes
ps aux | grep claude
```

## Manual Cleanup

If automatic cleanup fails, use manual cleanup:

```bash
# Cancel specific workflow
temporal workflow cancel --workflow-id <workflow-id>

# Remove workspace
rm -rf /tmp/claude-builds/build-*

# Kill specific process
kill -TERM <pid>
# If still running after 5 seconds:
kill -KILL <pid>
```

## Best Practices

1. **Always run tests with cleanup enabled**
   - Use the test runner scripts
   - Don't skip cleanup hooks

2. **Monitor resource usage**
   - Check workflows after tests
   - Monitor disk space in `/tmp`
   - Watch CPU/RAM usage

3. **Keep workspaces for debugging**
   - Set `KEEP_WORKSPACE=true` when debugging
   - Manually clean up after inspection

4. **Handle timeouts gracefully**
   - E2E tests have 30-minute timeout
   - Cleanup runs automatically on timeout

5. **Clean up old resources regularly**
   - Run cleanup script daily
   - Remove workspaces older than 24 hours

## Troubleshooting

### Workflows Not Cancelling
- Check if workflow is in a state that allows cancellation
- Verify Temporal connection
- Try manual cancellation: `temporal workflow cancel --workflow-id <id>`

### Workspaces Not Removing
- Check file permissions
- Verify workspace path exists
- Try manual removal: `rm -rf <workspace-path>`

### Processes Still Running
- Check process status: `ps aux | grep <pattern>`
- Kill manually if needed
- Check for zombie processes

### High CPU/RAM Usage
- Check for orphaned workflows: `temporal workflow list --status RUNNING`
- Check for large workspaces: `du -sh /tmp/claude-builds/*`
- Check for stuck processes: `top` or `htop`
- Run cleanup script: `./scripts/cleanup-test-resources.sh`

