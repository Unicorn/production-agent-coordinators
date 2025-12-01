# UI and Compiler Activities Plan

This document outlines activities needed for the Workflow Builder's UI and Compiler components, based on the comprehensive activity plans in `plans/package-builder/future/activities/`.

## Overview

The Workflow Builder has two main components that require activity support:

1. **UI Component** - Visual workflow editor that needs file operations, notifications, and workspace management
2. **Compiler Component** - Code generation system that needs file operations, command execution, and validation

This plan maps the activity categories from the package-builder plans to specific UI and Compiler use cases.

---

## UI Activities

The UI component needs activities for:
- File system operations (loading/saving workflows, component definitions)
- Notifications (user feedback, error alerts)
- Workspace management (project structure, file discovery)
- Git operations (version control, change tracking)

### High Priority UI Activities

#### 1. File System Activities for Workflow Management

**Purpose:** Load, save, and manage workflow definitions and component files

**Activities Needed:**
- `findFiles` - Discover workflow files, component definitions
- `readFile` - Load workflow JSON, component schemas
- `writeFile` - Save workflow definitions, component updates
- `batchReadFiles` - Load multiple workflows/components at once
- `listDirectory` - Browse workflow directories, component libraries

**Use Cases:**
- Loading workflow definitions from disk
- Saving workflow changes
- Discovering available components
- Loading component schemas for palette
- Batch loading workflows for dashboard

**Implementation Priority:** ⭐⭐⭐⭐⭐ (5/5)

**Source:** Based on `file-system.md` activities

---

#### 2. Notification Activities for User Feedback

**Purpose:** Provide real-time feedback to users about workflow operations

**Activities Needed:**
- `sendSlackNotification` - Team notifications for workflow deployments
- `updateWorkflowStatus` - Real-time status updates in UI
- `sendErrorAlert` - Alert on compilation errors, validation failures
- `sendProgressUpdate` - Progress bars for long operations (compilation, deployment)

**Use Cases:**
- Notify team when workflow is deployed
- Show compilation progress in UI
- Alert on validation errors
- Update workflow execution status
- Notify on save/load operations

**Implementation Priority:** ⭐⭐⭐⭐⭐ (5/5)

**Source:** Based on `notification-communication.md` activities

---

#### 3. Git Activities for Version Control

**Purpose:** Track workflow changes, manage versions, create PRs

**Activities Needed:**
- `gitStatus` - Check if workflow has uncommitted changes
- `gitDiff` - Show changes before saving
- `createTag` - Tag workflow versions
- `listBranches` - Manage workflow branches

**Use Cases:**
- Show "unsaved changes" indicator
- Generate change summaries
- Version workflow releases
- Branch management for workflow variants

**Implementation Priority:** ⭐⭐⭐⭐ (4/5)

**Source:** Based on `git-activities.md` activities

---

#### 4. File Search Activities for Component Discovery

**Purpose:** Help users find and discover components

**Activities Needed:**
- `findFiles` - Search for component files by pattern
- `searchFileContent` - Search component code for patterns
- `getDirectoryTree` - Show component library structure

**Use Cases:**
- Component palette search
- Finding components by functionality
- Discovering available activities
- Component library browsing

**Implementation Priority:** ⭐⭐⭐⭐ (4/5)

**Source:** Based on `file-system.md` activities

---

### Medium Priority UI Activities

#### 5. Workspace Management Activities

**Purpose:** Manage workflow project structure

**Activities Needed:**
- `listDirectory` - Browse project structure
- `getDirectoryTree` - Show full project tree
- `resolvePath` - Validate file paths
- `getFileMetadata` - Get file info (size, modified date)

**Use Cases:**
- Project explorer sidebar
- File navigation
- Workspace validation
- File metadata display

**Implementation Priority:** ⭐⭐⭐ (3/5)

---

#### 6. Batch File Operations for Performance

**Purpose:** Efficient loading of multiple files

**Activities Needed:**
- `batchReadFiles` - Load multiple workflows/components
- `batchWriteFiles` - Save multiple files atomically

**Use Cases:**
- Initial app load (load all workflows)
- Bulk component updates
- Workspace synchronization

**Implementation Priority:** ⭐⭐⭐ (3/5)

---

## Compiler Activities

The Compiler component needs activities for:
- File system operations (writing generated code)
- Command execution (validation, testing)
- Package management (npm operations)
- Git operations (committing generated code)

### High Priority Compiler Activities

#### 1. File System Activities for Code Generation

**Purpose:** Write generated workflow code to disk

**Activities Needed:**
- `writeFile` - Write generated workflow.ts, activities.ts, worker.ts
- `batchWriteFiles` - Write all generated files atomically
- `getFileMetadata` - Verify files were written correctly
- `listDirectory` - Verify generated project structure

**Use Cases:**
- Writing compiled workflow code
- Generating package.json, tsconfig.json
- Creating project structure
- Verifying compilation output

**Implementation Priority:** ⭐⭐⭐⭐⭐ (5/5)

**Source:** Based on `file-system.md` activities

---

#### 2. Command Execution Activities for Validation

**Purpose:** Validate generated code, run tests, check compilation

**Activities Needed:**
- `executeCommand` - Run TypeScript compiler (tsc)
- `runBuildCommand` - Execute npm build
- `runTestCommand` - Run test suite
- `runLintCommand` - Check code quality

**Use Cases:**
- Validate generated TypeScript compiles
- Run tests on generated code
- Check linting rules
- Verify package builds correctly

**Implementation Priority:** ⭐⭐⭐⭐⭐ (5/5)

**Source:** Based on `command-line.md` activities

---

#### 3. Package Management Activities for Project Setup

**Purpose:** Manage npm packages for generated workflows

**Activities Needed:**
- `checkOutdatedDependencies` - Check for dependency updates
- `scanVulnerabilities` - Security scanning
- `bumpVersion` - Version management for generated packages
- `checkLicenses` - License compliance

**Use Cases:**
- Setting up generated workflow projects
- Managing dependencies
- Security validation
- Version management

**Implementation Priority:** ⭐⭐⭐⭐ (4/5)

**Source:** Based on `package-management.md` activities

---

#### 4. Git Activities for Generated Code

**Purpose:** Commit and manage generated workflow code

**Activities Needed:**
- `gitStatus` - Check generated code status
- `gitDiff` - Review generated changes
- `createTag` - Tag workflow versions
- `listBranches` - Manage workflow branches

**Use Cases:**
- Committing generated code
- Creating PRs for workflow deployments
- Version tagging
- Branch management

**Implementation Priority:** ⭐⭐⭐⭐ (4/5)

**Source:** Based on `git-activities.md` activities

---

#### 5. File Search Activities for Code Analysis

**Purpose:** Analyze generated code, find patterns, validate structure

**Activities Needed:**
- `searchFileContent` - Search generated code for patterns
- `findFiles` - Find all generated files
- `getDirectoryTree` - Verify project structure

**Use Cases:**
- Validating generated code structure
- Finding imports/exports
- Checking code patterns
- Verifying file organization

**Implementation Priority:** ⭐⭐⭐ (3/5)

**Source:** Based on `file-system.md` activities

---

### Medium Priority Compiler Activities

#### 6. Command Execution Logging

**Purpose:** Track compilation and validation operations

**Activities Needed:**
- `logCommandExecution` - Log all command executions
- Track compilation times
- Record validation results

**Use Cases:**
- Performance optimization
- Debugging compilation issues
- Audit trail

**Implementation Priority:** ⭐⭐⭐ (3/5)

---

#### 7. Process Management for Long Operations

**Purpose:** Manage long-running compilation/validation processes

**Activities Needed:**
- `listRunningProcesses` - Track active processes
- `killProcess` - Cleanup on timeout
- `cleanupOrphanedProcesses` - Cleanup failed processes

**Use Cases:**
- Handling compilation timeouts
- Process cleanup
- Resource management

**Implementation Priority:** ⭐⭐⭐ (3/5)

---

## Activity Implementation Matrix

| Activity Category | UI Priority | Compiler Priority | Shared? |
|------------------|-------------|-------------------|---------|
| File System (Read/Write) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Yes |
| File Search/Discovery | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ Yes |
| Notifications | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ No (UI only) |
| Git Operations | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Yes |
| Command Execution | ⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ No (Compiler only) |
| Package Management | ⭐ | ⭐⭐⭐⭐ | ❌ No (Compiler only) |
| Batch Operations | ⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ Yes |
| Workspace Management | ⭐⭐⭐ | ⭐⭐⭐ | ✅ Yes |

---

## Implementation Strategy

### Phase 1: Foundation (High Priority)

**UI Activities:**
1. ✅ File System Read/Write (`readFile`, `writeFile`)
2. ✅ File Search (`findFiles`, `searchFileContent`)
3. ✅ Notification System (`sendSlackNotification`, `updateWorkflowStatus`)
4. ✅ Git Status/Diff (`gitStatus`, `gitDiff`)

**Compiler Activities:**
1. ✅ File System Write (`writeFile`, `batchWriteFiles`)
2. ✅ Command Execution (`executeCommand`, `runBuildCommand`)
3. ✅ Validation (`runTestCommand`, `runLintCommand`)
4. ✅ Git Operations (`gitStatus`, `createTag`)

**Timeline:** Next Sprint

---

### Phase 2: Enhancement (Medium Priority)

**UI Activities:**
5. Workspace Management (`listDirectory`, `getDirectoryTree`)
6. Batch Operations (`batchReadFiles`, `batchWriteFiles`)
7. Git Branch Management (`listBranches`, `deleteBranch`)

**Compiler Activities:**
5. Package Management (`checkOutdatedDependencies`, `scanVulnerabilities`)
6. Command Logging (`logCommandExecution`)
7. Process Management (`listRunningProcesses`, `killProcess`)

**Timeline:** Following Sprint

---

### Phase 3: Advanced (Lower Priority)

**UI Activities:**
8. File Watching (`watchFiles`) - Real-time updates
9. File Metadata (`getFileMetadata`) - Advanced info
10. Path Operations (`resolvePath`, `validatePathSafety`)

**Compiler Activities:**
8. Advanced Package Management (`bumpVersion`, `checkLicenses`)
9. Code Analysis (`searchFileContent` with patterns)
10. Performance Optimization (caching, parallel operations)

**Timeline:** As Needed

---

## Detailed Implementation Phases

### Phase 1.1: File System Activities ✅
**Status:** Complete
- Implemented: `readFile`, `writeFile`, `findFiles`, `searchFileContent`, `listDirectory`, `batchReadFiles`, `batchWriteFiles`
- Tests: Unit + Integration tests passing
- Location: `src/lib/activities/file-system.activities.ts`

### Phase 1.2: Command Execution Activities ✅
**Status:** Complete
- Implemented: `executeCommand`, `runBuildCommand`, `runTestCommand`, `runLintCommand`
- Tests: Unit + Integration tests passing
- Location: `src/lib/activities/command-execution.activities.ts`

### Phase 1.3: Git Activities ✅
**Status:** Complete
- Implemented: `createTag`, `gitStatus`, `listBranches`, `gitDiff`
- Tests: Unit + Integration tests passing
- Location: `src/lib/activities/git.activities.ts`

### Phase 1.4: Notification Activities ✅
**Status:** Complete
- Implemented: `sendSlackNotification`, `updateWorkflowStatus`, `sendErrorAlert`, `sendProgressUpdate`
- Tests: Unit + Integration tests passing (with real Slack webhook)
- Location: `src/lib/activities/notifications.activities.ts`

### Phase 1.5: Activity Registration ✅
**Status:** Complete
- Registered all 19 activities in the activity registry database
- Created registration script: `scripts/register-activities.ts`
- All activities discoverable via `activities.ts` tRPC router
- Location: `src/lib/activities/activity-registry.ts`

### Phase 1.6: tRPC Integration ✅
**Status:** Complete
- Verified `activities.ts` router (334 lines) handles all registry operations
- Activities are executed within Temporal workflows, not via tRPC
- No new routers needed for activity execution
- Documentation: `docs/architecture/trpc-router-organization.md`

### Phase 1.6.5: Router Refactoring (Large Router Splitting) ✅
**Status:** Complete
**Priority:** High (Code Quality)

### Phase 1.7: UI Integration ✅
**Status:** Complete
- Created `file-operations.ts` tRPC router wrapping file system activities for UI use
- Created `notifications.ts` tRPC router wrapping notification activities for UI use
- Updated `WorkflowCanvas` component to use notification activities for user feedback
- Updated `WorkflowBuilderPage` to use notification activities for save/build/compile operations
- Added optional file operations support to `ComponentPalette` for component discovery
- All routers registered in `root.ts`
- Location: `src/server/api/routers/file-operations.ts`, `src/server/api/routers/notifications.ts`

**Problem Statement:**
Several tRPC routers have grown beyond recommended size limits:
- `execution.ts`: 819 lines (should be < 600)
- `projects.ts`: 705 lines (should be < 600)
- `workflows.ts`: 595 lines (monitoring threshold)

**Goals:**
1. Split large routers into focused, maintainable sub-routers
2. Maintain backward compatibility (no breaking API changes)
3. Follow domain-based organization principles
4. Keep routers between 200-400 lines (target size)

**Implementation Plan:**

#### 1. Split `execution.ts` (819 lines)

**Current Structure:**
- Core execution operations (build, start, status)
- Monitoring operations (history, statistics)
- Results handling (outputs, errors)

**Proposed Split:**

**1.1 Create `execution-core.ts`** (~300 lines)
- `build` - Build and execute workflow
- `start` - Start workflow execution
- `getStatus` - Get execution status
- `cancel` - Cancel execution
- `retry` - Retry failed execution
- Core execution logic and Temporal client operations

**1.2 Create `execution-monitoring.ts`** (~250 lines)
- `getHistory` - Get execution history
- `getStatistics` - Get execution statistics
- `listExecutions` - List executions with filters
- `getExecutionTimeline` - Get detailed timeline
- Monitoring and history operations

**1.3 Create `execution-results.ts`** (~200 lines)
- `getOutput` - Get execution output
- `getErrors` - Get execution errors
- `getLogs` - Get execution logs
- `downloadArtifacts` - Download execution artifacts
- Results and output handling

**1.4 Update `execution.ts`** (~70 lines)
- Re-export all procedures from sub-routers
- Maintain backward compatibility
- Single entry point for execution operations

**Files to Create:**
- `src/server/api/routers/execution-core.ts`
- `src/server/api/routers/execution-monitoring.ts`
- `src/server/api/routers/execution-results.ts`

**Files to Update:**
- `src/server/api/routers/execution.ts` (refactor to re-export)
- `src/server/api/root.ts` (update imports if needed)

**Testing Requirements:**
- ✅ All existing tRPC calls continue to work
- ✅ No breaking changes to API surface
- ✅ All tests pass
- ✅ Type safety maintained

#### 2. Split `projects.ts` (705 lines)

**Current Structure:**
- Project CRUD operations
- Project settings and configuration
- Worker management
- Project statistics

**Proposed Split:**

**2.1 Create `projects-core.ts`** (~300 lines)
- `list` - List projects
- `get` - Get project by ID
- `create` - Create project
- `update` - Update project
- `delete` - Delete project
- Core CRUD operations

**2.2 Create `project-settings.ts`** (~250 lines)
- `updateSettings` - Update project settings
- `getSettings` - Get project settings
- `updateTaskQueue` - Update task queue
- `getTaskQueue` - Get task queue info
- Settings and configuration operations

**2.3 Create `project-workers.ts`** (~150 lines)
- `startWorker` - Start project worker
- `stopWorker` - Stop project worker
- `getWorkerStatus` - Get worker status
- `getWorkerHealth` - Get worker health
- Worker management operations

**2.4 Update `projects.ts`** (~50 lines)
- Re-export all procedures from sub-routers
- Maintain backward compatibility

**Files to Create:**
- `src/server/api/routers/projects-core.ts`
- `src/server/api/routers/project-settings.ts`
- `src/server/api/routers/project-workers.ts`

**Files to Update:**
- `src/server/api/routers/projects.ts` (refactor to re-export)
- `src/server/api/root.ts` (update imports if needed)

#### 3. Monitor `workflows.ts` (595 lines)

**Current Status:** Approaching threshold but acceptable
**Action:** Monitor and split if it grows beyond 650 lines

**Future Split (if needed):**
- `workflows-core.ts` - CRUD operations
- `workflow-deployment.ts` - Deployment operations

**Implementation Steps:**

1. **Create sub-routers** for each domain
2. **Move procedures** from main router to sub-routers
3. **Update main router** to re-export from sub-routers
4. **Update root router** imports (if needed)
5. **Run tests** to verify no breaking changes
6. **Update documentation** with new structure

**Backward Compatibility Strategy:**

```typescript
// execution.ts - Re-export pattern
import { executionCoreRouter } from './execution-core';
import { executionMonitoringRouter } from './execution-monitoring';
import { executionResultsRouter } from './execution-results';

export const executionRouter = createTRPCRouter({
  // Re-export all procedures for backward compatibility
  ...executionCoreRouter._def.procedures,
  ...executionMonitoringRouter._def.procedures,
  ...executionResultsRouter._def.procedures,
});
```

**Testing Checklist:**
- [ ] All existing tRPC calls work without changes
- [ ] TypeScript types remain compatible
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No breaking changes to API surface
- [ ] Documentation updated

**Timeline:** 1-2 days
**Dependencies:** None (can be done independently)

**Deliverables:**
- Split routers created and tested
- Backward compatibility maintained
- Documentation updated
- All tests passing

---

## Integration Points

### UI Integration

**Workflow Editor:**
```typescript
// Load workflow
const workflow = await activities.readFile({
  path: `workflows/${workflowId}.json`
});

// Save workflow
await activities.writeFile({
  path: `workflows/${workflowId}.json`,
  content: JSON.stringify(workflow, null, 2)
});

// Check for unsaved changes
const status = await activities.gitStatus({
  workspacePath: projectPath
});
if (!status.isClean) {
  showUnsavedChangesIndicator();
}
```

**Component Palette:**
```typescript
// Discover components
const components = await activities.findFiles({
  directory: 'components',
  pattern: '**/*.ts'
});

// Load component schemas
const schemas = await activities.batchReadFiles({
  files: components.map(c => c.path),
  baseDir: projectPath
});
```

**Notifications:**
```typescript
// Workflow deployed
await activities.sendSlackNotification({
  message: `Workflow "${workflowName}" deployed successfully`,
  attachments: [{
    title: 'Deployment Details',
    fields: [
      { title: 'Workflow ID', value: workflowId },
      { title: 'Version', value: version }
    ]
  }]
});
```

---

### Compiler Integration

**Code Generation:**
```typescript
// Generate workflow files
const result = compiler.compile(workflowDefinition);

// Write generated code
await activities.batchWriteFiles({
  operations: [
    { path: 'workflow.ts', content: result.workflowCode, operation: 'create' },
    { path: 'activities.ts', content: result.activitiesCode, operation: 'create' },
    { path: 'worker.ts', content: result.workerCode, operation: 'create' },
    { path: 'package.json', content: result.packageJson, operation: 'create' },
    { path: 'tsconfig.json', content: result.tsConfig, operation: 'create' }
  ],
  baseDir: outputPath,
  atomic: true
});
```

**Validation:**
```typescript
// Validate generated code
const validation = await activities.runBuildCommand({
  command: 'npm',
  subcommand: 'run',
  args: ['build'],
  workingDir: outputPath
});

if (!validation.success) {
  await activities.sendErrorAlert({
    error: new Error('Compilation failed'),
    severity: 'high',
    context: {
      workflowRunId: workflowId,
      stepName: 'compilation'
    }
  });
}
```

**Git Integration:**
```typescript
// Commit generated code
const status = await activities.gitStatus({
  workspacePath: outputPath
});

if (status.hasChanges) {
  await activities.gitCommit({
    workspacePath: outputPath,
    message: `feat: Generated workflow code for ${workflowName}`,
    files: status.stagedFiles
  });
}
```

---

## Error Handling

### UI Error Handling

**File Operations:**
- Handle file not found gracefully
- Show user-friendly error messages
- Retry transient failures
- Log errors for debugging

**Notifications:**
- Non-blocking (don't block UI on notification failures)
- Fallback to in-app notifications if Slack fails
- Retry logic for transient failures

**Git Operations:**
- Handle "not a git repo" gracefully
- Show clear messages for auth failures
- Handle network issues with retries

---

### Compiler Error Handling

**Code Generation:**
- Validate workflow before compilation
- Handle compilation errors gracefully
- Provide detailed error messages
- Suggest fixes for common errors

**Command Execution:**
- Timeout handling for long operations
- Resource limit enforcement
- Process cleanup on failures
- Clear error messages with context

**File Operations:**
- Atomic writes to prevent partial files
- Verify files written correctly
- Handle disk space issues
- Cleanup on failures

---

## Security Considerations

### Path Validation

All file operations must:
- Validate paths are within allowed directories
- Prevent path traversal attacks
- Sanitize user-provided paths
- Resolve to absolute paths before operations

### Command Execution

All command execution must:
- Validate commands against whitelist
- Sanitize arguments
- Run with minimal permissions
- Log all command executions

### Git Operations

All git operations must:
- Validate repository paths
- Handle authentication securely
- Prevent command injection
- Audit all git operations

---

## Comprehensive Testing Strategy

This section outlines comprehensive testing for all three layers: **Backend Activities**, **Frontend Components**, and **Generated Code Validation**.

---

### 1. Backend Activity Testing

#### 1.1 Unit Tests for Activities

**Location:** `tests/unit/activities/`

**Purpose:** Test individual activity functions in isolation

**Test Coverage:**

**File System Activities:**
```typescript
describe('File System Activities', () => {
  describe('readFile', () => {
    it('should read file content successfully');
    it('should handle file not found errors');
    it('should validate path safety');
    it('should handle permission errors');
    it('should handle large files');
  });

  describe('writeFile', () => {
    it('should write file successfully');
    it('should create directory if missing');
    it('should handle disk space errors');
    it('should validate path safety');
    it('should handle concurrent writes');
  });

  describe('findFiles', () => {
    it('should find files by glob pattern');
    it('should respect exclude patterns');
    it('should handle large directory trees');
    it('should return correct file metadata');
  });

  describe('searchFileContent', () => {
    it('should find matches in file content');
    it('should handle regex patterns');
    it('should return line numbers and context');
    it('should handle binary files gracefully');
  });

  describe('batchReadFiles', () => {
    it('should read multiple files atomically');
    it('should handle partial failures');
    it('should return error details for failed files');
  });

  describe('batchWriteFiles', () => {
    it('should write multiple files atomically');
    it('should rollback on failure if atomic=true');
    it('should handle partial failures gracefully');
  });
});
```

**Command Execution Activities:**
```typescript
describe('Command Execution Activities', () => {
  describe('executeCommand', () => {
    it('should execute command successfully');
    it('should capture stdout and stderr');
    it('should handle command timeouts');
    it('should track process PID');
    it('should monitor resource usage');
    it('should kill process on timeout');
    it('should handle command not found');
    it('should validate command whitelist');
  });

  describe('runBuildCommand', () => {
    it('should execute npm build');
    it('should parse TypeScript errors');
    it('should extract file/line information');
    it('should handle build failures');
    it('should respect timeout limits');
  });

  describe('runTestCommand', () => {
    it('should execute test suite');
    it('should parse test results');
    it('should extract coverage information');
    it('should identify failing tests');
    it('should handle test timeouts');
  });

  describe('runLintCommand', () => {
    it('should execute linting');
    it('should parse lint errors');
    it('should identify fixable issues');
    it('should support auto-fix mode');
  });
});
```

**Git Activities:**
```typescript
describe('Git Activities', () => {
  describe('gitStatus', () => {
    it('should detect clean repository');
    it('should detect uncommitted changes');
    it('should list staged files');
    it('should list unstaged files');
    it('should handle not a git repo error');
  });

  describe('gitDiff', () => {
    it('should generate diff for changes');
    it('should calculate file stats');
    it('should handle no changes');
    it('should support specific file diff');
  });

  describe('createTag', () => {
    it('should create annotated tag');
    it('should create lightweight tag');
    it('should handle tag conflicts');
    it('should validate tag names');
  });
});
```

**Notification Activities:**
```typescript
describe('Notification Activities', () => {
  describe('sendSlackNotification', () => {
    it('should send message successfully');
    it('should handle Slack API errors');
    it('should support attachments');
    it('should support threading');
    it('should retry on transient failures');
  });

  describe('updateWorkflowStatus', () => {
    it('should update status in database');
    it('should handle concurrent updates');
    it('should track progress percentage');
  });
});
```

**Package Management Activities:**
```typescript
describe('Package Management Activities', () => {
  describe('checkOutdatedDependencies', () => {
    it('should detect outdated packages');
    it('should check transitive dependencies');
    it('should handle missing package.json');
  });

  describe('scanVulnerabilities', () => {
    it('should detect vulnerabilities');
    it('should categorize by severity');
    it('should identify fixable issues');
    it('should block on critical vulnerabilities');
  });
});
```

**Testing Requirements:**
- ✅ Mock file system operations (use `memfs` or `mock-fs`)
- ✅ Mock command execution (use `execa` mocks)
- ✅ Mock git operations (use `simple-git` mocks)
- ✅ Test all error paths
- ✅ Test edge cases (empty files, large files, etc.)
- ✅ Test concurrent operations
- ✅ Test timeout handling
- ✅ Test resource limits

**Commands:**
```bash
yarn test:unit tests/unit/activities/
```

---

#### 1.2 Integration Tests for Activities

**Location:** `tests/integration/activities/`

**Purpose:** Test activities with real file system, commands, and git operations

**Test Coverage:**

**File System Integration:**
```typescript
describe('File System Activities Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should perform real file operations', async () => {
    const result = await readFile({ path: path.join(tempDir, 'test.txt') });
    // Verify with real file system
  });

  it('should handle real directory operations', async () => {
    const result = await listDirectory({ directory: tempDir });
    // Verify with real file system
  });
});
```

**Command Execution Integration:**
```typescript
describe('Command Execution Integration', () => {
  it('should execute real commands in isolated environment', async () => {
    const result = await executeCommand({
      command: 'echo',
      args: ['test'],
      workingDir: tempDir,
      timeout: 5000
    });
    expect(result.stdout).toBe('test\n');
  });

  it('should handle real command timeouts', async () => {
    const result = await executeCommand({
      command: 'sleep',
      args: ['10'],
      workingDir: tempDir,
      timeout: 1000
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });
});
```

**Git Integration:**
```typescript
describe('Git Activities Integration', () => {
  let gitRepo: string;

  beforeEach(async () => {
    gitRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
    await execa('git', ['init'], { cwd: gitRepo });
  });

  afterEach(() => {
    fs.rmSync(gitRepo, { recursive: true, force: true });
  });

  it('should perform real git operations', async () => {
    await writeFile({ path: path.join(gitRepo, 'test.txt'), content: 'test' });
    const status = await gitStatus({ workspacePath: gitRepo });
    expect(status.hasChanges).toBe(true);
  });
});
```

**Testing Requirements:**
- ✅ Use real file system (temp directories)
- ✅ Use real command execution (isolated)
- ✅ Use real git operations (test repos)
- ✅ Clean up after each test
- ✅ Test error scenarios with real failures
- ✅ Test timeout handling with real long-running commands
- ✅ Test resource monitoring with real processes

**Commands:**
```bash
yarn test:integration tests/integration/activities/
```

---

### 2. Frontend Component Testing

#### 2.1 UI Component Tests

**Location:** `tests/ui/components/`

**Purpose:** Test React components that use activities

**Test Coverage:**

**Workflow Editor Components:**
```typescript
describe('WorkflowEditor', () => {
  it('should render workflow canvas');
  it('should load workflow from file system activity');
  it('should save workflow using writeFile activity');
  it('should show unsaved changes indicator');
  it('should handle save errors gracefully');
  it('should display file system errors to user');
});

describe('ComponentPalette', () => {
  it('should load components using findFiles activity');
  it('should search components using searchFileContent activity');
  it('should display component metadata');
  it('should handle component loading errors');
});

describe('PropertyPanel', () => {
  it('should display node properties');
  it('should update workflow on property change');
  it('should validate property inputs');
  it('should show validation errors');
});
```

**Notification Components:**
```typescript
describe('NotificationSystem', () => {
  it('should display Slack notifications');
  it('should show workflow status updates');
  it('should handle notification errors gracefully');
  it('should retry failed notifications');
});
```

**Testing Requirements:**
- ✅ Use React Testing Library
- ✅ Mock activity calls (use `vi.mock` for activity modules)
- ✅ Test user interactions (clicks, form inputs)
- ✅ Test error states and error handling
- ✅ Test loading states
- ✅ Test accessibility (ARIA labels, keyboard navigation)
- ✅ Use test helpers with providers (tRPC, Tamagui)

**Commands:**
```bash
yarn test:unit tests/ui/components/
```

---

#### 2.2 E2E Tests for UI

**Location:** `tests/e2e/ui/`

**Purpose:** Test complete user flows through the UI

**Test Coverage:**

**Workflow Management Flow:**
```typescript
describe('Workflow Management E2E', () => {
  it('should create new workflow', async () => {
    // 1. Navigate to workflows page
    // 2. Click "New Workflow"
    // 3. Fill in workflow details
    // 4. Save workflow (triggers writeFile activity)
    // 5. Verify workflow appears in list
  });

  it('should load existing workflow', async () => {
    // 1. Navigate to workflows page
    // 2. Click on existing workflow
    // 3. Verify workflow loads (triggers readFile activity)
    // 4. Verify canvas displays correctly
  });

  it('should save workflow changes', async () => {
    // 1. Load workflow
    // 2. Make changes to workflow
    // 3. Wait for auto-save (or click save)
    // 4. Verify writeFile activity called
    // 5. Verify success notification
  });

  it('should handle save errors', async () => {
    // 1. Load workflow
    // 2. Make changes
    // 3. Mock writeFile to fail
    // 4. Attempt to save
    // 5. Verify error message displayed
  });
});
```

**Component Discovery Flow:**
```typescript
describe('Component Discovery E2E', () => {
  it('should discover and display components', async () => {
    // 1. Open component palette
    // 2. Verify findFiles activity called
    // 3. Verify components displayed
    // 4. Search for component
    // 5. Verify searchFileContent activity called
  });
});
```

**Compilation Flow:**
```typescript
describe('Workflow Compilation E2E', () => {
  it('should compile workflow from UI', async () => {
    // 1. Load workflow in editor
    // 2. Click "Compile" button
    // 3. Verify compilation starts
    // 4. Verify progress updates displayed
    // 5. Verify generated code written (batchWriteFiles)
    // 6. Verify success notification
  });

  it('should validate compiled code', async () => {
    // 1. Compile workflow
    // 2. Verify runBuildCommand activity called
    // 3. Verify validation results displayed
    // 4. If errors, verify error details shown
  });
});
```

**Testing Requirements:**
- ✅ Use Playwright for browser automation
- ✅ Run in headless mode by default
- ✅ Require dev server running (`yarn dev`)
- ✅ Use page objects for maintainability
- ✅ Test error scenarios
- ✅ Test loading states
- ✅ Test notifications
- ✅ Clean up test data after tests

**Commands:**
```bash
# Start dev server first
yarn dev

# Run E2E tests
yarn test:e2e tests/e2e/ui/
```

---

### 3. Generated Code Validation Testing

#### 3.1 Compiler Output Validation

**Location:** `tests/integration/compiler-output/`

**Purpose:** Test that generated code is valid, compiles, and executes correctly

**Test Coverage:**

**Code Generation Tests:**
```typescript
describe('Generated Code Validation', () => {
  it('should generate valid TypeScript code', async () => {
    const workflow = createTestWorkflow();
    const result = compiler.compile(workflow);
    
    expect(result.success).toBe(true);
    expect(result.workflowCode).toBeTruthy();
    expect(result.activitiesCode).toBeTruthy();
    expect(result.workerCode).toBeTruthy();
    
    // Verify code syntax
    expect(() => {
      ts.transpile(result.workflowCode);
    }).not.toThrow();
  });

  it('should generate code that compiles without errors', async () => {
    const result = compiler.compile(workflow);
    const tempDir = await setupTempProject(result);
    
    // Run TypeScript compiler
    const compileResult = await executeCommand({
      command: 'npx',
      args: ['tsc', '--noEmit'],
      workingDir: tempDir
    });
    
    expect(compileResult.success).toBe(true);
    expect(compileResult.stderr).toBe('');
  });

  it('should generate code with correct imports', async () => {
    const result = compiler.compile(workflow);
    
    // Verify Temporal imports
    expect(result.workflowCode).toContain('@temporalio/workflow');
    expect(result.workflowCode).toContain('proxyActivities');
    
    // Verify activity imports
    expect(result.workflowCode).toContain("import type * as activities from './activities'");
  });

  it('should generate code with correct type safety', async () => {
    const result = compiler.compile(workflow);
    
    // Verify type annotations
    expect(result.workflowCode).toMatch(/:\s*Promise</);
    expect(result.workflowCode).not.toContain('any');
  });
});
```

**Generated Code Execution Tests:**
```typescript
describe('Generated Code Execution', () => {
  it('should execute generated workflow in Temporal', async () => {
    const result = compiler.compile(workflow);
    const { worker, client } = await setupTemporalTest(result);
    
    // Register and execute workflow
    const workflowId = 'test-workflow';
    const handle = await client.workflow.start(workflow.name, {
      workflowId,
      taskQueue: 'test-queue',
      args: [testInput]
    });
    
    const result = await handle.result();
    expect(result).toBeDefined();
  });

  it('should handle activity calls correctly', async () => {
    // Verify generated code calls activities correctly
    // Verify activity proxies are set up correctly
    // Verify activity timeouts are respected
  });

  it('should handle errors in generated code', async () => {
    // Test error handling in generated workflows
    // Verify errors are propagated correctly
    // Verify retry logic works
  });
});
```

**Package Structure Validation:**
```typescript
describe('Generated Package Structure', () => {
  it('should generate correct package.json', async () => {
    const result = compiler.compile(workflow);
    const packageJson = JSON.parse(result.packageJson);
    
    expect(packageJson.name).toBe(workflow.name);
    expect(packageJson.dependencies).toHaveProperty('@temporalio/workflow');
    expect(packageJson.scripts).toHaveProperty('build');
    expect(packageJson.scripts).toHaveProperty('test');
  });

  it('should generate correct tsconfig.json', async () => {
    const result = compiler.compile(workflow);
    const tsConfig = JSON.parse(result.tsConfig);
    
    expect(tsConfig.compilerOptions.strict).toBe(true);
    expect(tsConfig.compilerOptions.target).toBe('ES2020');
  });

  it('should generate all required files', async () => {
    const result = compiler.compile(workflow);
    const files = await listDirectory({ directory: outputDir });
    
    expect(files.entries).toContainEqual(
      expect.objectContaining({ name: 'workflow.ts' })
    );
    expect(files.entries).toContainEqual(
      expect.objectContaining({ name: 'activities.ts' })
    );
    expect(files.entries).toContainEqual(
      expect.objectContaining({ name: 'worker.ts' })
    );
    expect(files.entries).toContainEqual(
      expect.objectContaining({ name: 'package.json' })
    );
  });
});
```

**Testing Requirements:**
- ✅ Test code generation for all workflow types
- ✅ Test TypeScript compilation of generated code
- ✅ Test execution in real Temporal instance
- ✅ Test error handling in generated code
- ✅ Test package structure and dependencies
- ✅ Use snapshot tests for code generation
- ✅ Test edge cases (empty workflows, complex workflows)

**Commands:**
```bash
# Requires Temporal running
yarn infra:up
yarn test:integration tests/integration/compiler-output/
```

---

#### 3.2 Generated Code Integration Tests

**Location:** `tests/integration/compiler-execution/` (existing)

**Purpose:** Test full compilation → execution pipeline

**Test Coverage:**

**Full Pipeline Tests:**
```typescript
describe('Full Compilation and Execution Pipeline', () => {
  it('should compile, write files, validate, and execute', async () => {
    // 1. Compile workflow
    const result = compiler.compile(workflow);
    
    // 2. Write generated files (using batchWriteFiles activity)
    await batchWriteFiles({
      operations: [
        { path: 'workflow.ts', content: result.workflowCode, operation: 'create' },
        { path: 'activities.ts', content: result.activitiesCode, operation: 'create' },
        { path: 'worker.ts', content: result.workerCode, operation: 'create' },
        { path: 'package.json', content: result.packageJson, operation: 'create' },
        { path: 'tsconfig.json', content: result.tsConfig, operation: 'create' }
      ],
      baseDir: outputDir,
      atomic: true
    });
    
    // 3. Validate code (using runBuildCommand activity)
    const validation = await runBuildCommand({
      command: 'npm',
      subcommand: 'run',
      args: ['build'],
      workingDir: outputDir
    });
    expect(validation.success).toBe(true);
    
    // 4. Execute in Temporal
    const execution = await executeWorkflowInTemporal(outputDir);
    expect(execution.success).toBe(true);
  });

  it('should handle compilation errors gracefully', async () => {
    // Test invalid workflow compilation
    // Verify errors are reported correctly
    // Verify no files are written on failure
  });

  it('should handle validation errors gracefully', async () => {
    // Test workflow that compiles but fails validation
    // Verify validation errors are reported
    // Verify user can fix and re-compile
  });
});
```

**Testing Requirements:**
- ✅ Test complete workflow from UI → Compilation → Execution
- ✅ Test error handling at each stage
- ✅ Test recovery from errors
- ✅ Test concurrent compilations
- ✅ Test large/complex workflows

**Commands:**
```bash
yarn test:integration tests/integration/compiler-execution/
```

---

### 4. Test Coverage Requirements

#### 4.1 Coverage Targets

**Backend Activities:**
- ✅ **Unit Tests:** 90%+ coverage for all activity functions
- ✅ **Integration Tests:** 100% coverage for critical paths
- ✅ **Error Handling:** 100% coverage for all error paths

**Frontend Components:**
- ✅ **Component Tests:** 80%+ coverage for UI components
- ✅ **E2E Tests:** 100% coverage for critical user flows
- ✅ **Accessibility:** 100% coverage for ARIA attributes

**Generated Code:**
- ✅ **Code Generation:** 100% coverage for all workflow types
- ✅ **Code Validation:** 100% coverage for validation logic
- ✅ **Execution Tests:** 100% coverage for all workflow patterns

---

#### 4.2 Test Organization

```
tests/
├── unit/
│   ├── activities/           # Backend activity unit tests
│   │   ├── file-system.test.ts
│   │   ├── command-execution.test.ts
│   │   ├── git.test.ts
│   │   ├── notifications.test.ts
│   │   └── package-management.test.ts
│   └── compiler/            # Compiler unit tests (existing)
│
├── integration/
│   ├── activities/          # Backend activity integration tests
│   │   ├── file-system.integration.test.ts
│   │   ├── command-execution.integration.test.ts
│   │   └── git.integration.test.ts
│   ├── compiler-output/     # Generated code validation
│   │   ├── code-generation.test.ts
│   │   ├── code-execution.test.ts
│   │   └── package-structure.test.ts
│   └── compiler-execution/  # Full pipeline tests (existing)
│
├── ui/
│   └── components/          # Frontend component tests
│       ├── workflow-editor.test.tsx
│       ├── component-palette.test.tsx
│       └── property-panel.test.tsx
│
└── e2e/
    └── ui/                  # E2E tests for UI flows
        ├── workflow-management.spec.ts
        ├── compilation.spec.ts
        └── component-discovery.spec.ts
```

---

### 5. Test Execution Strategy

#### 5.1 Pre-Commit Testing

**Required Before Commit:**
```bash
# Run fast unit tests
yarn test:unit

# Run linter
yarn lint

# Type check
yarn typecheck
```

#### 5.2 Pre-Push Testing

**Required Before Push:**
```bash
# Run all unit tests
yarn test:unit

# Run integration tests (if Temporal available)
yarn test:integration

# Run E2E tests (if dev server available)
yarn test:e2e
```

#### 5.3 CI/CD Pipeline Testing

**Full Test Suite:**
```bash
# 1. Start infrastructure
yarn infra:up

# 2. Start dev server
yarn dev &

# 3. Run all tests
yarn test:unit
yarn test:integration
yarn test:e2e

# 4. Generate coverage report
yarn test:coverage
```

---

### 6. Debugging and Troubleshooting

#### 6.1 Debug Mode

**Environment Variable:** `WORKFLOW_BUILDER_TEST_DEBUG=1`

**What it enables:**
- Preserves test artifacts (generated code, temp directories)
- Dumps activity execution logs
- Saves generated code to `tests/_artifacts/`
- Enables verbose logging

**Usage:**
```bash
WORKFLOW_BUILDER_TEST_DEBUG=1 yarn test:integration
```

#### 6.2 Common Test Issues

**"Failed to connect to Temporal"**
- **Solution:** Run `yarn infra:up` before integration tests

**"Activity timeout"**
- **Solution:** Increase timeout in test configuration
- **Solution:** Check Temporal worker is running

**"File system errors"**
- **Solution:** Check temp directory permissions
- **Solution:** Clean up temp directories manually

**"Generated code doesn't compile"**
- **Solution:** Enable debug mode to see generated code
- **Solution:** Check TypeScript version compatibility
- **Solution:** Verify all dependencies are installed

---

### 7. Test Data Management

#### 7.1 Test Fixtures

**Location:** `tests/fixtures/`

**Purpose:** Reusable test data for workflows, components, etc.

```typescript
// tests/fixtures/workflows.ts
export const simpleWorkflow = {
  id: 'test-workflow',
  name: 'TestWorkflow',
  nodes: [...],
  edges: [...]
};

export const complexWorkflow = {
  // Complex workflow definition
};
```

#### 7.2 Test Helpers

**Location:** `tests/helpers/`

**Purpose:** Reusable test utilities

```typescript
// tests/helpers/activity-test-helpers.ts
export async function setupTempWorkspace(): Promise<string>;
export async function cleanupTempWorkspace(path: string): Promise<void>;
export function mockFileSystem(): void;
export function mockCommandExecution(): void;
```

---

### 8. Continuous Improvement

#### 8.1 Test Metrics

**Track:**
- Test coverage percentage
- Test execution time
- Flaky test rate
- Test failure rate

#### 8.2 Test Maintenance

**Regular Tasks:**
- Update tests when activities change
- Add tests for new features
- Fix flaky tests
- Update snapshots when code generation changes
- Review and improve test coverage

---

## Summary

This comprehensive testing strategy ensures:

1. ✅ **Backend Activities** are thoroughly tested (unit + integration)
2. ✅ **Frontend Components** are tested (component + E2E)
3. ✅ **Generated Code** is validated (compilation + execution)
4. ✅ **Full Pipeline** is tested end-to-end
5. ✅ **Error Handling** is tested at all levels
6. ✅ **Performance** is monitored and optimized

All tests follow the existing patterns in the codebase and integrate with the current testing infrastructure.

---

## Dependencies

### Required Packages

```json
{
  "execa": "^8.0.0",  // Command execution
  "fast-glob": "^3.3.0",  // File globbing
  "pidusage": "^3.0.0",  // Resource monitoring
  "tree-kill": "^1.2.2",  // Process cleanup
  "@slack/webhook": "^7.0.0",  // Slack notifications
  "simple-git": "^3.20.0",  // Git operations
  "semver": "^7.5.0"  // Version management
}
```

---

## Notes

- All activities should be **provider-agnostic** (work with both Gemini and Claude workflows if applicable)
- Activities should follow the same pattern as existing activities in the codebase
- File operations should use async/await for all I/O
- Command execution should have proper timeout and resource limits
- All operations should be logged for optimization analysis
- Error handling should be graceful and user-friendly
- Security should be built-in, not an afterthought

---

## Related Documentation

- [File System Activities Plan](../../plans/package-builder/future/activities/file-system.md)
- [Command-Line Activities Plan](../../plans/package-builder/future/activities/command-line.md)
- [Git Activities Plan](../../plans/package-builder/future/activities/git-activities.md)
- [Notification Activities Plan](../../plans/package-builder/future/activities/notification-communication.md)
- [Package Management Activities Plan](../../plans/package-builder/future/activities/package-management.md)
- [Workflow Builder System Design](./2025-11-14-workflow-builder-system-design.md)
- [Compiler Architecture](../../docs/architecture/compiler.md)

