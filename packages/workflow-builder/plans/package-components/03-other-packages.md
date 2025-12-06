# Other Packages Components Plan

**Date:** 2025-01-20  
**Status:** Planning  
**Related:** [Component Planning Guide](../../../docs/standards/component-planning-guide.md), [Overview](./00-overview.md)

---

## Overview

This plan covers creating workflow components from other packages in the codebase (non-@bernierllc npm packages). These packages provide valuable functionality that could be exposed as reusable workflow components for building applications, workflows, systems, and services.

---

## Package Analysis

### High Priority Components

#### 1. @bernierllc/braingrid-cli-wrapper

**Component Potential**: ✅✅ Very High  
**Component Type**: `activity`  
**Category**: `connect-services` or `core-actions`

**Analysis**:
- Type-safe wrapper for BrainGrid CLI
- Provides project management, requirement creation, task management
- Very useful for development workflows and project management automation

**Available Commands**:
- `createIdea(prompt, projectId)` - Create new requirement/idea
- `listProjects()` - List all BrainGrid projects
- `createTask(reqId, options)` - Create task for requirement
- `updateTaskStatus(taskId, options)` - Update task status
- `listTasks(options)` - List tasks with filters

**Component Candidates**:

##### BrainGrid Create Requirement
- **Name**: `braingrid-create-requirement`
- **Display Name**: "Create BrainGrid Requirement"
- **Type**: `activity`
- **Purpose**: Create a new requirement/idea in BrainGrid

**Configuration**:
```typescript
interface BrainGridCreateRequirementConfig {
  prompt: string; // Requirement description
  projectId?: string; // Optional project ID
}
```

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "prompt": { "type": "string" },
    "projectId": { "type": "string" }
  },
  "required": ["prompt"]
}
```

**Output Schema**:
```json
{
  "type": "object",
  "properties": {
    "requirementId": { "type": "string" },
    "name": { "type": "string" },
    "status": { "type": "string" }
  },
  "required": ["requirementId"]
}
```

##### BrainGrid List Projects
- **Name**: `braingrid-list-projects`
- **Display Name**: "List BrainGrid Projects"
- **Type**: `activity`
- **Purpose**: List all BrainGrid projects

**Configuration**:
```typescript
interface BrainGridListProjectsConfig {
  // No configuration needed
}
```

##### BrainGrid Create Task
- **Name**: `braingrid-create-task`
- **Display Name**: "Create BrainGrid Task"
- **Type**: `activity`
- **Purpose**: Create a task for a requirement

**Configuration**:
```typescript
interface BrainGridCreateTaskConfig {
  requirementId: string;
  title: string;
  content?: string;
  dependencies?: string[];
}
```

##### BrainGrid Update Task Status
- **Name**: `braingrid-update-task-status`
- **Display Name**: "Update BrainGrid Task Status"
- **Type**: `activity`
- **Purpose**: Update task status (PLANNED, IN_PROGRESS, COMPLETED, etc.)

**Configuration**:
```typescript
interface BrainGridUpdateTaskStatusConfig {
  taskId: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  metadata?: Record<string, unknown>;
}
```

##### BrainGrid List Tasks
- **Name**: `braingrid-list-tasks`
- **Display Name**: "List BrainGrid Tasks"
- **Type**: `activity`
- **Purpose**: List tasks with optional filters

**Configuration**:
```typescript
interface BrainGridListTasksConfig {
  requirementId?: string;
  status?: string[];
  tags?: string[];
}
```

**Implementation Checklist**:
- [ ] Review `@bernierllc/braingrid-cli-wrapper` package API
- [ ] Create `@bernierllc/braingrid-activities` package
- [ ] Implement all BrainGrid activity functions
- [ ] Create connector type for BrainGrid (API token/credentials)
- [ ] Create component definitions in database
- [ ] Create UI components for property panels
- [ ] Add tests for BrainGrid activities
- [ ] Document BrainGrid component usage

---

#### 2. Package Builder Production Activities

**Component Potential**: ✅✅ Very High  
**Component Type**: `activity`  
**Category**: `core-actions` or `connect-services`

**Analysis**:
- Rich set of activities for package building, git operations, file operations
- Many activities are reusable for general workflows
- Git operations, file operations, build/test operations are universally useful

**Key Activity Categories**:

##### Git Operations
- `gitCommit` - Commit changes
- `gitPush` - Push to remote
- `gitCreateBranch` - Create feature branch
- `gitCreatePR` - Create pull request
- `createWorktree` - Create git worktree
- `mergeWorktrees` - Merge worktrees
- `cleanupWorktrees` - Cleanup worktrees

##### File Operations
- `applyFileChanges` - Apply file changes (create, update, delete)
- `getFileContent` - Read file content
- `listPackageFiles` - List files in package

##### Build/Test Operations
- `runBuild` - Run package build
- `runTests` - Run tests
- `runQualityChecks` - Run linting/quality checks
- `publishPackage` - Publish to npm

##### Credential Checks
- `checkGitHubCLI` - Check GitHub CLI credentials
- `checkNPM` - Check NPM credentials
- `checkGit` - Check Git credentials
- `checkClaudeCLI` - Check Claude CLI
- `checkGeminiCLI` - Check Gemini CLI

**Component Candidates**:

##### Git Commit
- **Name**: `git-commit`
- **Display Name**: "Git Commit"
- **Type**: `activity`
- **Purpose**: Commit changes to git repository

**Configuration**:
```typescript
interface GitCommitConfig {
  workspacePath: string; // Path to git repository
  message: string; // Commit message
  gitUser?: {
    name: string;
    email: string;
  };
}
```

##### Git Push
- **Name**: `git-push`
- **Display Name**: "Git Push"
- **Type**: `activity`
- **Purpose**: Push commits to remote repository

**Configuration**:
```typescript
interface GitPushConfig {
  workspacePath: string;
  remote?: string; // Default: 'origin'
  branch?: string; // Default: current branch
  force?: boolean; // Default: false
}
```

##### Git Create Branch
- **Name**: `git-create-branch`
- **Display Name**: "Create Git Branch"
- **Type**: `activity`
- **Purpose**: Create a new git branch

**Configuration**:
```typescript
interface GitCreateBranchConfig {
  workspacePath: string;
  branchName: string;
  baseBranch?: string; // Default: 'main' or 'master'
}
```

##### Git Create Pull Request
- **Name**: `git-create-pr`
- **Display Name**: "Create Pull Request"
- **Type**: `activity`
- **Purpose**: Create a GitHub pull request

**Configuration**:
```typescript
interface GitCreatePRConfig {
  workspacePath: string;
  branch: string;
  title: string;
  body: string;
  baseBranch?: string;
  draft?: boolean;
  labels?: string[];
}
```

##### File Operations
- **Name**: `file-operations`
- **Display Name**: "File Operations"
- **Type**: `activity`
- **Purpose**: Create, update, or delete files

**Configuration**:
```typescript
interface FileOperationsConfig {
  workspacePath: string;
  operations: Array<{
    operation: 'create' | 'update' | 'delete';
    path: string;
    content?: string; // Required for create/update
  }>;
}
```

##### Run Build
- **Name**: `run-build`
- **Display Name**: "Run Build"
- **Type**: `activity`
- **Purpose**: Run package build command

**Configuration**:
```typescript
interface RunBuildConfig {
  workspacePath: string;
  packagePath?: string; // Optional, defaults to workspace root
  buildCommand?: string; // Optional, defaults to 'npm run build'
}
```

##### Run Tests
- **Name**: `run-tests`
- **Display Name**: "Run Tests"
- **Type**: `activity`
- **Purpose**: Run test suite

**Configuration**:
```typescript
interface RunTestsConfig {
  workspacePath: string;
  packagePath?: string;
  testCommand?: string; // Optional, defaults to 'npm test'
}
```

##### Check Credentials
- **Name**: `check-credentials`
- **Display Name**: "Check Credentials"
- **Type**: `activity`
- **Purpose**: Check if required credentials/tools are available

**Configuration**:
```typescript
interface CheckCredentialsConfig {
  checks: Array<'github' | 'npm' | 'git' | 'claude' | 'gemini'>;
}
```

**Implementation Checklist**:
- [ ] Review package-builder-production activities
- [ ] Identify which activities are reusable vs. package-builder-specific
- [ ] Create `@bernierllc/git-activities` package for git operations
- [ ] Create `@bernierllc/file-activities` package for file operations
- [ ] Create `@bernierllc/build-activities` package for build/test operations
- [ ] Create component definitions in database
- [ ] Create UI components for property panels
- [ ] Add tests for all activities
- [ ] Document component usage

---

#### 3. @coordinator/storage

**Component Potential**: ✅ High  
**Component Type**: `activity`  
**Category**: `core-actions` or new `storage` category

**Analysis**:
- Already covered in [Storage Connectors Plan](./01-storage-connectors.md)
- Provides `IStorage` interface with local file storage implementation
- Can be wrapped as activities for workflow use

**Component Candidates**:
- **Storage Write** - Write data to storage
- **Storage Read** - Read data from storage
- **Storage Delete** - Delete from storage
- **Storage Exists** - Check if key exists
- **Storage List** - List keys with prefix

**Note**: See [Storage Connectors Plan](./01-storage-connectors.md) for detailed implementation.

---

### Medium Priority Components

#### 4. @bernierllc/dev-workflow Activities

**Component Potential**: ✅ Medium  
**Component Type**: `activity`  
**Category**: `connect-services` or `core-actions`

**Analysis**:
- Development workflow activities (BrainGrid integration, dependency tree building)
- May be too specific to development workflows
- Some activities could be useful for general workflows

**Key Activities**:
- BrainGrid integration activities
- Dependency tree building
- Task polling and claiming

**Component Candidates**:
- **Poll for Task** - Poll BrainGrid for available tasks
- **Claim Task** - Claim a task for execution
- **Update Task Progress** - Update task progress
- **Complete Task** - Mark task as complete

**Implementation Checklist**:
- [ ] Review dev-workflow activities
- [ ] Identify which are reusable vs. dev-workflow-specific
- [ ] Create components for reusable activities
- [ ] Document usage

---

#### 5. @coordinator/package-queue-orchestrator

**Component Potential**: ⚠️ Low-Medium  
**Component Type**: `activity` or `trigger`  
**Category**: `connect-services`

**Analysis**:
- Package build orchestration system
- May be too specific to package building
- MCP integration activities could be useful

**Key Activities**:
- `queryMCPForPackages` - Query MCP for available packages
- `updateMCPPackageStatus` - Update package status in MCP

**Component Candidates**:
- **Query MCP Packages** - Query MCP for packages (if MCP integration is exposed)
- **Update MCP Status** - Update status in MCP system

**Implementation Checklist**:
- [ ] Review package-queue-orchestrator activities
- [ ] Determine if MCP integration should be exposed as components
- [ ] Create components if valuable
- [ ] Document usage

---

### Low Priority / Infrastructure Packages

#### 6. @coordinator/contracts

**Component Potential**: ❌ None  
**Analysis**: Type definitions and interfaces only - not a component candidate

#### 7. @coordinator/coordinator

**Component Potential**: ⚠️ Very Low  
**Analysis**: Core coordinator logic - too low-level for components

#### 8. @coordinator/engine

**Component Potential**: ⚠️ Very Low  
**Analysis**: Engine logic - too low-level for components

#### 9. @coordinator/cli

**Component Potential**: ❌ None  
**Analysis**: CLI tool - not a component candidate

#### 10. @workflow-builder/worker-service

**Component Potential**: ❌ None  
**Analysis**: Infrastructure/worker service - not a component candidate

#### 11. @coordinator/temporal-coordinator

**Component Potential**: ⚠️ Low  
**Analysis**: Temporal activities for agent coordination - may be too specific

---

## Implementation Priority

### Phase 1: High Priority (Immediate Value)
1. **BrainGrid Components** - All BrainGrid CLI wrapper activities
2. **Git Operations** - Commit, push, create branch, create PR
3. **File Operations** - Create, update, delete files

### Phase 2: Medium Priority (High Value)
1. **Build/Test Operations** - Run build, run tests, quality checks
2. **Credential Checks** - Check credentials for various tools
3. **Storage Operations** - Storage read/write/delete (see storage connectors plan)

### Phase 3: Lower Priority (Specific Use Cases)
1. **Dev Workflow Activities** - Task polling, claiming (if reusable)
2. **MCP Integration** - MCP package queries (if exposed)

---

## Package Organization Strategy

### New NPM Packages to Create

1. **@bernierllc/braingrid-activities**
   - BrainGrid CLI wrapper activities
   - Components: create-requirement, list-projects, create-task, update-task-status, list-tasks

2. **@bernierllc/git-activities**
   - Git operations activities
   - Components: commit, push, create-branch, create-pr, worktree operations

3. **@bernierllc/file-activities**
   - File operations activities
   - Components: file-operations (create/update/delete), read-file, list-files

4. **@bernierllc/build-activities**
   - Build and test operations
   - Components: run-build, run-tests, run-quality-checks, publish-package

5. **@bernierllc/credential-activities**
   - Credential checking activities
   - Components: check-credentials (multi-check), check-github, check-npm, check-git

---

## Component Planning Process

For each component, follow the [Component Planning Guide](../../../docs/standards/component-planning-guide.md):

### 1. Classification
- [ ] Determine component type (activity, agent, signal, trigger, data-in, data-out)
- [ ] Determine category
- [ ] Choose component name and display name

### 2. Package Management
- [ ] Identify or create @bernierllc npm package
- [ ] Define activity metadata
- [ ] Plan package structure

### 3. Configuration
- [ ] Define component configuration schema
- [ ] Define input/output schemas
- [ ] Plan property panel fields

### 4. Connectors
- [ ] Determine connector requirements (if any)
- [ ] Identify or create connector type
- [ ] Define connector configuration schema

### 5. Implementation
- [ ] Implement activity code
- [ ] Create component definition in database
- [ ] Create UI component for property panel
- [ ] Add tests (unit, integration, E2E)
- [ ] Write documentation

---

## Testing Requirements

### Unit Tests
- [ ] Test each activity independently
- [ ] Test error handling
- [ ] Test input validation
- [ ] Test output schema validation

### Integration Tests
- [ ] Test with actual services (BrainGrid, GitHub, etc.)
- [ ] Test component execution in workflow context
- [ ] Test connector integration (if applicable)

### E2E Tests
- [ ] Test complete workflow with component
- [ ] Test error scenarios
- [ ] Test performance

---

## Documentation Requirements

- [ ] Component usage guides
- [ ] Package integration documentation
- [ ] Examples for common use cases
- [ ] API reference for each component
- [ ] Troubleshooting guides
- [ ] Credential setup guides (for BrainGrid, GitHub, etc.)

---

## Security Considerations

### Credential Management
- [ ] BrainGrid API tokens - Store in connectors
- [ ] GitHub tokens - Store in connectors
- [ ] NPM tokens - Store in connectors
- [ ] Git credentials - Store in connectors

### File Operations Security
- [ ] Path traversal protection (already implemented in file-operations)
- [ ] Workspace path validation
- [ ] File permission checks

### Git Operations Security
- [ ] Repository path validation
- [ ] Branch name validation
- [ ] Force push protection (configurable)

---

## References

- [Component Planning Guide](../../../docs/standards/component-planning-guide.md)
- [Overview](./00-overview.md)
- [Storage Connectors Plan](./01-storage-connectors.md)
- [@bernierllc Packages Plan](./02-bernierllc-packages.md)
- [Services/Components/Connectors Refactor Plan](../2025-01-20-services-components-connectors-refactor.md)

