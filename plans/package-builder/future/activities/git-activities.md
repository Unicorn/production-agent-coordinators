# Future Git Activities Plan

This document outlines additional git activities that can be added to enhance the package builder workflows, ranked from highest to lowest benefit.

## Priority Ranking Rationale

Activities are ranked based on:
- **Frequency of use** in automated package building workflows
- **Impact on workflow efficiency** and reliability
- **Complexity vs. value** tradeoff
- **Integration with existing PR/commit automation**

---

## High Priority (Implement Soon)

### 1. Git Tag Creation for Releases
**Benefit:** Critical for version management and release tracking

**Use Cases:**
- Tag successful package builds with version numbers
- Mark release milestones
- Enable semantic versioning automation

**Implementation:**
```typescript
export interface CreateTagInput {
  workspacePath: string;
  tagName: string;
  message?: string;
  commitHash?: string; // Default: HEAD
  annotated?: boolean; // Default: true
}

export interface CreateTagResult {
  success: boolean;
  tagName: string;
  stdout: string;
  stderr?: string;
}
```

**Workflow Integration:**
- After successful package build and PR creation
- Before publishing to npm
- Enables automated release workflows

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

### 2. Git Status and Change Detection
**Benefit:** Essential for workflow decision-making

**Use Cases:**
- Check if there are uncommitted changes before operations
- Detect if workspace is clean before starting new build
- Verify changes exist before committing
- Check branch status before PR creation

**Implementation:**
```typescript
export interface GitStatusInput {
  workspacePath: string;
  short?: boolean; // Use --short format
}

export interface GitStatusResult {
  success: boolean;
  isClean: boolean;
  hasChanges: boolean;
  stagedFiles: string[];
  unstagedFiles: string[];
  untrackedFiles: string[];
  stdout: string;
}
```

**Workflow Integration:**
- Pre-commit validation
- Pre-PR creation checks
- Workspace cleanup verification

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

### 3. Branch Management Operations
**Benefit:** Critical for multi-branch workflows and cleanup

**Use Cases:**
- List all branches (local and remote)
- Delete merged branches after PR merge
- Check if branch exists before creating
- Get current branch name
- Switch branches safely

**Implementation:**
```typescript
export interface ListBranchesInput {
  workspacePath: string;
  remote?: boolean;
  merged?: boolean; // Only show merged branches
}

export interface ListBranchesResult {
  success: boolean;
  branches: Array<{
    name: string;
    isCurrent: boolean;
    isRemote: boolean;
    lastCommit: string;
  }>;
}

export interface DeleteBranchInput {
  workspacePath: string;
  branchName: string;
  force?: boolean;
  remote?: boolean;
}
```

**Workflow Integration:**
- Post-PR merge cleanup
- Workspace maintenance
- Branch existence checks before operations

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

### 4. Git Diff Viewing
**Benefit:** Useful for debugging and validation

**Use Cases:**
- Review changes before committing
- Generate change summaries for PR descriptions
- Validate that only expected files changed
- Debug build failures by seeing what changed

**Implementation:**
```typescript
export interface GitDiffInput {
  workspacePath: string;
  commit1?: string; // Default: HEAD
  commit2?: string; // Default: working directory
  filePath?: string; // Specific file
  stat?: boolean; // Only show stats
}

export interface GitDiffResult {
  success: boolean;
  diff: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  fileStats: Array<{
    file: string;
    insertions: number;
    deletions: number;
  }>;
}
```

**Workflow Integration:**
- Pre-commit validation
- PR description generation
- Build failure analysis

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

## Medium Priority (Implement When Needed)

### 5. Git Log and History Analysis
**Benefit:** Useful for audit trails and debugging

**Use Cases:**
- View commit history for a package
- Find when a file was last modified
- Generate changelog from commits
- Analyze commit patterns

**Implementation:**
```typescript
export interface GitLogInput {
  workspacePath: string;
  since?: string; // Date or commit
  until?: string;
  author?: string;
  filePath?: string;
  maxCount?: number;
  format?: 'short' | 'full' | 'oneline';
}

export interface GitLogResult {
  success: boolean;
  commits: Array<{
    hash: string;
    author: string;
    date: string;
    message: string;
    filesChanged: number;
  }>;
}
```

**Workflow Integration:**
- Audit trail generation
- Changelog creation
- Debugging historical issues

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 6. Git Stash Operations
**Benefit:** Useful for temporary state management

**Use Cases:**
- Save uncommitted changes before switching branches
- Temporarily store work in progress
- Clean workspace for operations

**Implementation:**
```typescript
export interface GitStashInput {
  workspacePath: string;
  message?: string;
}

export interface GitStashResult {
  success: boolean;
  stashId?: string;
  stdout: string;
}

export interface GitStashPopInput {
  workspacePath: string;
  stashId?: string; // Default: most recent
}
```

**Workflow Integration:**
- Workspace cleanup before operations
- Temporary state saving

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 7. Git Remote Management
**Benefit:** Useful for multi-remote scenarios

**Use Cases:**
- Add/remove remotes
- List remotes
- Update remote URLs
- Fetch from specific remotes

**Implementation:**
```typescript
export interface ListRemotesInput {
  workspacePath: string;
}

export interface ListRemotesResult {
  success: boolean;
  remotes: Array<{
    name: string;
    url: string;
    fetch: string;
    push: string;
  }>;
}

export interface AddRemoteInput {
  workspacePath: string;
  name: string;
  url: string;
}
```

**Workflow Integration:**
- Multi-repository workflows
- Fork management
- Backup remote configuration

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 8. Git Blame for Attribution
**Benefit:** Useful for code ownership and debugging

**Use Cases:**
- Find who last modified a line
- Generate attribution reports
- Debug when issues were introduced

**Implementation:**
```typescript
export interface GitBlameInput {
  workspacePath: string;
  filePath: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface GitBlameResult {
  success: boolean;
  lines: Array<{
    lineNumber: number;
    commitHash: string;
    author: string;
    date: string;
    content: string;
  }>;
}
```

**Workflow Integration:**
- Code ownership tracking
- Attribution in generated code
- Historical analysis

**Estimated Value:** ⭐⭐ (2/5)

---

## Lower Priority (Advanced Operations)

### 9. Git Merge Operations
**Benefit:** Useful for branch integration workflows

**Use Cases:**
- Merge feature branches
- Merge upstream changes
- Handle merge conflicts programmatically

**Implementation:**
```typescript
export interface GitMergeInput {
  workspacePath: string;
  branch: string;
  noFF?: boolean; // Create merge commit
  strategy?: 'ours' | 'theirs' | 'recursive';
}

export interface GitMergeResult {
  success: boolean;
  hasConflicts: boolean;
  conflicts?: string[]; // List of conflicted files
  stdout: string;
  stderr?: string;
}
```

**Note:** Merge conflicts require human intervention in most cases, limiting automation value.

**Estimated Value:** ⭐⭐ (2/5)

---

### 10. Git Rebase Operations
**Benefit:** Advanced workflow optimization

**Use Cases:**
- Rebase feature branch onto main
- Interactive rebase for commit cleanup
- Linear history maintenance

**Implementation:**
```typescript
export interface GitRebaseInput {
  workspacePath: string;
  baseBranch: string;
  interactive?: boolean;
  onto?: string;
}

export interface GitRebaseResult {
  success: boolean;
  hasConflicts: boolean;
  conflicts?: string[];
  stdout: string;
}
```

**Note:** Rebase is complex and often requires manual conflict resolution. Lower priority for automated workflows.

**Estimated Value:** ⭐ (1/5)

---

### 11. Git Cherry-Pick Operations
**Benefit:** Selective commit application

**Use Cases:**
- Apply specific commits to different branches
- Backport fixes
- Selective feature application

**Implementation:**
```typescript
export interface GitCherryPickInput {
  workspacePath: string;
  commitHash: string;
  noCommit?: boolean; // Stage changes only
}

export interface GitCherryPickResult {
  success: boolean;
  hasConflicts: boolean;
  stdout: string;
}
```

**Estimated Value:** ⭐ (1/5)

---

### 12. Git Submodule Operations
**Benefit:** Useful if using submodules (currently not in use)

**Use Cases:**
- Initialize submodules
- Update submodule references
- Sync submodule versions

**Note:** Only needed if the project adopts git submodules.

**Estimated Value:** ⭐ (1/5) - Not currently needed

---

## Implementation Recommendations

### Phase 1: High Priority (Next Sprint)
1. ✅ Git Tag Creation
2. ✅ Git Status and Change Detection
3. ✅ Branch Management Operations
4. ✅ Git Diff Viewing

### Phase 2: Medium Priority (When Needed)
5. Git Log and History Analysis
6. Git Stash Operations
7. Git Remote Management
8. Git Blame for Attribution

### Phase 3: Advanced (Low Priority)
9. Git Merge Operations
10. Git Rebase Operations
11. Git Cherry-Pick Operations
12. Git Submodule Operations

---

## Integration Points

### With Existing Workflows

**Package Build Workflow:**
- Use `gitStatus` before starting build (verify clean state)
- Use `gitTag` after successful build (version tagging)
- Use `gitDiff` for PR description generation
- Use `listBranches` for cleanup operations

**PR Creation Workflow:**
- Use `gitStatus` to verify changes exist
- Use `gitDiff` to generate PR description
- Use `deleteBranch` after PR merge

**Release Workflow:**
- Use `gitTag` for version tags
- Use `gitLog` for changelog generation
- Use `gitBlame` for attribution

---

## Error Handling Considerations

All git activities should handle:
- **Not a git repository:** Return clear error
- **No changes to commit:** Return success with `isClean: true`
- **Authentication failures:** Surface clearly
- **Network issues:** Retry logic for remote operations
- **Conflicts:** Detect and report, don't auto-resolve

---

## Testing Strategy

For each new git activity:
1. **Unit tests:** Mock git commands, test parsing
2. **Integration tests:** Real git repository in temp directory
3. **Edge cases:** Empty repo, no changes, conflicts, etc.
4. **Error scenarios:** Missing git, auth failures, network issues

---

## Notes

- All activities should be **provider-agnostic** (work with both Gemini and Claude workflows)
- Activities should follow the same pattern as existing `git.activities.ts`
- Consider using `simple-git` library for more robust git operations (already in dependencies)
- Some operations (rebase, merge with conflicts) may require human intervention - design accordingly

