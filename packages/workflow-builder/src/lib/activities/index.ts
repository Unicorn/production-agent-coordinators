/**
 * Activity Registry
 *
 * Export activity registry service and helpers
 */

export {
  ActivityRegistry,
  createActivityRegistry,
  type RegisterActivityInput,
  type ListActivitiesFilters,
} from './activity-registry';

/**
 * File System Activities
 *
 * Export file system operations for UI and Compiler components
 */

export {
  findFiles,
  readFile,
  writeFile,
  searchFileContent,
  listDirectory,
  batchReadFiles,
  batchWriteFiles,
  type FindFilesInput,
  type FindFilesResult,
  type ReadFileInput,
  type ReadFileResult,
  type WriteFileInput,
  type WriteFileResult,
  type SearchFileContentInput,
  type SearchFileContentResult,
  type ListDirectoryInput,
  type ListDirectoryResult,
  type BatchReadFilesInput,
  type BatchReadFilesResult,
  type BatchWriteFilesInput,
  type BatchWriteFilesResult,
} from './file-system.activities';

/**
 * Command Execution Activities
 *
 * Export command execution operations for Compiler component validation
 */

export {
  executeCommand,
  runBuildCommand,
  runTestCommand,
  runLintCommand,
  logCommandExecution,
  validateCommand,
  type ExecuteCommandInput,
  type ExecuteCommandResult,
  type BuildCommandInput,
  type BuildCommandResult,
  type BuildError,
  type TestCommandInput,
  type TestCommandResult,
  type TestResults,
  type Coverage,
  type TestFailure,
  type LintCommandInput,
  type LintCommandResult,
  type LintIssue,
  type LintResults,
  type CommandLogEntry,
} from './command-execution.activities';

/**
 * Git Activities
 *
 * Export git operations for Compiler component version control
 */

export {
  gitStatus,
  gitDiff,
  createTag,
  listBranches,
  type GitStatusInput,
  type GitStatusResult,
  type GitDiffInput,
  type GitDiffResult,
  type FileStat,
  type CreateTagInput,
  type CreateTagResult,
  type ListBranchesInput,
  type ListBranchesResult,
  type BranchInfo,
} from './git.activities';
