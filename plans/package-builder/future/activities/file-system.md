# File System Activities Plan

This document outlines enhanced file system activities beyond basic create/update/delete operations, ranked from highest to lowest benefit for package builder workflows.

## Current State Analysis

### What We Have
- ✅ `applyFileChanges` - Basic file create/update/delete with security validation
- ✅ `verifyFileCreated` - Verify file existence and content
- ✅ `normalizeContent` - Content normalization
- ✅ `cleanWorkspace` - Workspace cleanup

### What's Missing
- ❌ File search and discovery
- ❌ Directory operations (list, tree, stats)
- ❌ File content operations (read, search, grep)
- ❌ File watching and monitoring
- ❌ Batch file operations
- ❌ File metadata operations
- ❌ Path operations and validation

---

## High Priority (Implement Soon)

### 1. File Search and Discovery
**Benefit:** Essential for code analysis and workflow operations

**Use Cases:**
- Find files by pattern (glob, regex)
- Search for files by content
- Discover package structure
- Find configuration files
- Locate test files

**Implementation:**
```typescript
export interface FindFilesInput {
  directory: string;
  pattern?: string; // Glob pattern (e.g., '**/*.ts')
  regex?: string; // Regex pattern
  includeDirs?: boolean;
  excludeDirs?: string[]; // e.g., ['node_modules', '.git']
  maxDepth?: number;
}

export interface FindFilesResult {
  success: boolean;
  files: Array<{
    path: string;
    relativePath: string;
    size: number;
    modified: Date;
    isDirectory: boolean;
  }>;
  total: number;
}

export async function findFiles(
  input: FindFilesInput
): Promise<FindFilesResult>;
```

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

### 2. File Content Search (Grep)
**Benefit:** Critical for code analysis and debugging

**Use Cases:**
- Search for code patterns
- Find function definitions
- Locate imports/exports
- Search for TODO comments
- Find error messages

**Implementation:**
```typescript
export interface SearchFileContentInput {
  directory: string;
  pattern: string; // Regex pattern
  filePattern?: string; // File filter (glob)
  caseSensitive?: boolean;
  multiline?: boolean;
  excludeDirs?: string[];
}

export interface SearchMatch {
  file: string;
  line: number;
  column: number;
  match: string;
  context?: string; // Surrounding lines
}

export interface SearchFileContentResult {
  success: boolean;
  matches: SearchMatch[];
  total: number;
  filesSearched: number;
}

export async function searchFileContent(
  input: SearchFileContentInput
): Promise<SearchFileContentResult>;
```

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

### 3. Directory Operations
**Benefit:** Essential for workspace management

**Use Cases:**
- List directory contents
- Get directory tree structure
- Calculate directory sizes
- Check directory existence
- Create nested directory structures

**Implementation:**
```typescript
export interface ListDirectoryInput {
  directory: string;
  recursive?: boolean;
  includeHidden?: boolean;
  filter?: (entry: { name: string; isDirectory: boolean }) => boolean;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
  children?: DirectoryEntry[];
}

export interface ListDirectoryResult {
  success: boolean;
  entries: DirectoryEntry[];
  total: number;
  totalSize: number;
}

export interface GetDirectoryTreeInput {
  directory: string;
  maxDepth?: number;
  excludeDirs?: string[];
}

export interface DirectoryTree {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size: number;
  children?: DirectoryTree[];
}

export async function listDirectory(
  input: ListDirectoryInput
): Promise<ListDirectoryResult>;

export async function getDirectoryTree(
  input: GetDirectoryTreeInput
): Promise<DirectoryTree>;
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

### 4. Batch File Operations
**Benefit:** Efficient bulk operations

**Use Cases:**
- Read multiple files at once
- Write multiple files atomically
- Delete multiple files
- Copy/move multiple files
- Batch file updates

**Implementation:**
```typescript
export interface BatchReadFilesInput {
  files: string[];
  baseDir: string;
  encoding?: string; // Default: 'utf-8'
}

export interface FileContent {
  path: string;
  content: string;
  error?: string;
}

export interface BatchReadFilesResult {
  success: boolean;
  files: FileContent[];
  failed: number;
}

export interface BatchWriteFilesInput {
  operations: Array<{
    path: string;
    content: string;
    operation: 'create' | 'update';
  }>;
  baseDir: string;
  atomic?: boolean; // All succeed or all fail
}

export interface BatchWriteFilesResult {
  success: boolean;
  written: string[];
  failed: Array<{ path: string; error: string }>;
}

export async function batchReadFiles(
  input: BatchReadFilesInput
): Promise<BatchReadFilesResult>;

export async function batchWriteFiles(
  input: BatchWriteFilesInput
): Promise<BatchWriteFilesResult>;
```

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

## Medium Priority (Implement When Needed)

### 5. File Metadata Operations
**Benefit:** File information and statistics

**Use Cases:**
- Get file stats (size, modified date, permissions)
- Check file types
- Calculate checksums
- Get file encoding
- Check file permissions

**Implementation:**
```typescript
export interface GetFileMetadataInput {
  filePath: string;
  includeContent?: boolean;
  calculateChecksum?: boolean; // MD5, SHA256
}

export interface FileMetadata {
  path: string;
  size: number;
  modified: Date;
  created: Date;
  permissions: string;
  type: string; // MIME type
  encoding?: string;
  checksum?: {
    md5: string;
    sha256: string;
  };
  content?: string; // If includeContent=true
}

export async function getFileMetadata(
  input: GetFileMetadataInput
): Promise<FileMetadata>;
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 6. File Watching and Monitoring
**Benefit:** Real-time file change detection

**Use Cases:**
- Watch for file changes during builds
- Monitor workspace for modifications
- Detect when files are ready
- Trigger actions on file changes

**Implementation:**
```typescript
export interface WatchFilesInput {
  directory: string;
  pattern?: string; // Glob pattern
  events?: ('create' | 'update' | 'delete')[];
  timeout?: number; // Stop watching after timeout
}

export interface FileChangeEvent {
  type: 'create' | 'update' | 'delete';
  path: string;
  timestamp: Date;
}

export interface WatchFilesResult {
  events: FileChangeEvent[];
  stopped: boolean; // True if timeout reached
}

export async function watchFiles(
  input: WatchFilesInput
): Promise<WatchFilesResult>;
```

**Note:** File watching can be resource-intensive. Use sparingly.

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### 7. Path Operations and Validation
**Benefit:** Safe path manipulation and validation

**Use Cases:**
- Resolve relative paths
- Validate path safety
- Normalize paths
- Check path existence
- Get relative paths between files

**Implementation:**
```typescript
export interface ResolvePathInput {
  path: string;
  baseDir: string;
  mustExist?: boolean;
}

export interface ResolvePathResult {
  success: boolean;
  absolutePath: string;
  relativePath: string;
  exists: boolean;
  isDirectory: boolean;
  isFile: boolean;
}

export interface GetRelativePathInput {
  from: string;
  to: string;
}

export async function resolvePath(
  input: ResolvePathInput
): Promise<ResolvePathResult>;

export async function getRelativePath(
  input: GetRelativePathInput
): Promise<string>;

export async function validatePathSafety(
  path: string,
  allowedBase?: string
): Promise<{ safe: boolean; reason?: string }>;
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

## Lower Priority (Advanced Features)

### 8. File Compression and Archiving
**Benefit:** Package distribution and backups

**Use Cases:**
- Create tarballs
- Extract archives
- Compress files
- Create zip files

**Estimated Value:** ⭐⭐ (2/5) - npm handles this for packages

---

### 9. File Diff and Comparison
**Benefit:** Change analysis

**Use Cases:**
- Compare file versions
- Generate diffs
- Detect changes
- Merge conflicts

**Estimated Value:** ⭐⭐ (2/5) - Git handles this better

---

### 10. File Permissions Management
**Benefit:** Security and access control

**Use Cases:**
- Set file permissions
- Check permissions
- Manage ownership

**Note:** Usually handled by OS/git, rarely needed in workflows.

**Estimated Value:** ⭐ (1/5)

---

## Implementation Strategy

### Phase 1: High Priority (Next Sprint)
1. ✅ File Search and Discovery
2. ✅ File Content Search (Grep)
3. ✅ Directory Operations
4. ✅ Batch File Operations

### Phase 2: Medium Priority (When Needed)
5. File Metadata Operations
6. File Watching and Monitoring
7. Path Operations and Validation

### Phase 3: Advanced (Lower Priority)
8. File Compression and Archiving
9. File Diff and Comparison
10. File Permissions Management

---

## Integration with Workflows

### Package Build Workflow
- Use `findFiles` to discover package structure
- Use `searchFileContent` to find imports/exports
- Use `getDirectoryTree` for workspace analysis
- Use `batchReadFiles` to load multiple source files

### Code Analysis
- Use `searchFileContent` to find patterns
- Use `findFiles` to locate test files
- Use `getFileMetadata` for file statistics

---

## Performance Considerations

### Large File Handling
- Stream large files instead of loading into memory
- Use pagination for large directory listings
- Limit search depth for performance
- Cache file metadata when possible

### Resource Limits
- Limit concurrent file operations
- Set maximum file size limits
- Timeout for long-running searches
- Memory limits for batch operations

---

## Security Considerations

### Path Traversal Prevention
- Always validate paths
- Resolve to absolute paths
- Check paths are within allowed directories
- Sanitize user-provided paths

### File Content Validation
- Validate file encodings
- Check file sizes before reading
- Sanitize file content when needed
- Prevent reading sensitive files

---

## Dependencies Needed

```json
{
  "fast-glob": "^3.3.0",  // Fast file globbing
  "chokidar": "^3.6.0",  // File watching
  "node:fs/promises": "built-in",  // File operations
  "crypto": "built-in"  // Checksums
}
```

---

## Notes

- All file operations should be **provider-agnostic**
- Use async/await for all I/O operations
- Handle large files with streaming when possible
- Implement proper error handling for file system errors
- Support both relative and absolute paths
- Respect .gitignore patterns when searching

