# Command-Line Execution Activities Plan

This document outlines the strategy for handling command-line execution from CLI agents (Gemini and Claude), addressing resource management, timeout handling, specialized command handlers, and optimization logging.

## Current State Analysis

### How We Currently Execute Commands

**Current Implementation:**
- **Gemini CLI:** Uses `execPromise` (promisified `exec`) with basic timeout handling
- **Claude CLI:** Uses `spawn` with timeout option (10 minutes default)
- **Compliance Checks:** Uses `execPromise` with 5-minute timeout per command
- **Build/Test Activities:** Use `execAsync` (promisified `exec`) with basic error handling

**Current Limitations:**
1. ❌ **No PID tracking** - Can't kill processes on timeout
2. ❌ **No resource monitoring** - CPU/RAM usage not tracked
3. ❌ **Basic timeout handling** - Timeout kills process but doesn't clean up properly
4. ❌ **No command logging** - Commands not captured for optimization analysis
5. ❌ **Generic error handling** - All commands treated the same
6. ❌ **No specialized handlers** - Same execution pattern for all command types

**Current Workaround:**
- Agents (Claude/Gemini) execute commands directly via their CLI tools (`--yolo` / `--permission-mode acceptEdits`)
- Workflows call specific activities (`runBuild`, `runTests`, `runComplianceChecks`) rather than generic command execution
- This works but limits flexibility and optimization opportunities

---

## Requirements

### Core Requirements

1. **Resource Management**
   - Monitor CPU and RAM usage
   - Prevent resource exhaustion
   - Kill processes cleanly on timeout
   - Track process PIDs for cleanup

2. **Timing Management**
   - Configurable timeouts per command type
   - Long enough for tests, lints, builds
   - Short enough to fail fast on errors
   - Graceful timeout handling with cleanup

3. **Input/Output Handling**
   - Capture stdout and stderr separately
   - Handle streaming output for long-running commands
   - Support stdin input when needed
   - Parse structured output (JSON, YAML) automatically

4. **Logging and Optimization**
   - Log all commands executed
   - Capture command, arguments, duration, success/failure
   - Link to workflow run and step
   - Enable optimization analysis

5. **Specialized Command Handlers**
   - Different handling for different command types
   - Custom parsing for known tools (npm, tsc, eslint, jest)
   - Error pattern recognition
   - Retry logic for transient failures

---

## Future Command-Line Activities

### High Priority (Implement First)

#### 1. Generic Command Execution Activity
**Benefit:** Foundation for all other command execution

**Purpose:**
- Execute arbitrary shell commands safely
- Handle timeouts, resource limits, and cleanup
- Capture output and errors
- Log for optimization

**Implementation:**
```typescript
export interface ExecuteCommandInput {
  command: string;
  args?: string[];
  workingDir: string;
  timeout?: number; // milliseconds, default based on command type
  env?: Record<string, string>;
  stdin?: string;
  resourceLimits?: {
    maxCpuPercent?: number;
    maxMemoryMB?: number;
  };
  captureOutput?: boolean; // Default: true
  streamOutput?: boolean; // Stream to logs in real-time
}

export interface ExecuteCommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  pid?: number;
  resourceUsage?: {
    cpuPercent: number;
    memoryMB: number;
  };
  error?: string;
  commandId: string; // For logging/optimization
}
```

**Key Features:**
- PID tracking for cleanup
- Resource monitoring (CPU/RAM)
- Automatic timeout with process kill
- Command logging with unique ID
- Streaming output support

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

#### 2. Specialized Build Command Handler
**Benefit:** Optimized for build operations (npm, yarn, tsc, etc.)

**Purpose:**
- Specialized handling for build commands
- Longer timeouts (10-15 minutes)
- Parse build output for errors
- Detect common build failure patterns

**Implementation:**
```typescript
export interface BuildCommandInput {
  command: 'npm' | 'yarn' | 'pnpm';
  subcommand: 'install' | 'build' | 'run';
  args?: string[];
  workingDir: string;
  timeout?: number; // Default: 15 minutes for builds
}

export interface BuildCommandResult extends ExecuteCommandResult {
  buildErrors?: Array<{
    file: string;
    line: number;
    message: string;
    type: 'error' | 'warning';
  }>;
  buildWarnings?: number;
  buildTime?: number;
}
```

**Specialized Features:**
- Parse TypeScript compiler errors
- Extract file/line information
- Categorize errors (type errors, lint errors, etc.)
- Longer default timeout
- Resource limits for build processes

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

#### 3. Specialized Test Command Handler
**Benefit:** Optimized for test execution (jest, vitest, mocha, etc.)

**Purpose:**
- Handle test commands with appropriate timeouts
- Parse test results (pass/fail counts, coverage)
- Extract failing test information
- Support test filtering and patterns

**Implementation:**
```typescript
export interface TestCommandInput {
  command: 'npm' | 'yarn' | 'pnpm' | 'jest' | 'vitest';
  testPattern?: string;
  workingDir: string;
  timeout?: number; // Default: 30 minutes for full test suites
  coverage?: boolean;
  watch?: boolean; // Default: false for CI
}

export interface TestCommandResult extends ExecuteCommandResult {
  testResults?: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    duration: number;
  };
  coverage?: {
    lines: number;
    statements: number;
    functions: number;
    branches: number;
  };
  failures?: Array<{
    test: string;
    file: string;
    error: string;
  }>;
}
```

**Specialized Features:**
- Parse test output (Jest JSON reporter, etc.)
- Extract coverage information
- Identify failing tests
- Longer timeout for full test suites
- Support for test filtering

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

#### 4. Specialized Lint Command Handler
**Benefit:** Optimized for linting operations (eslint, tslint, etc.)

**Purpose:**
- Handle lint commands efficiently
- Parse lint errors and warnings
- Extract fixable issues
- Support auto-fix mode

**Implementation:**
```typescript
export interface LintCommandInput {
  command: 'npm' | 'yarn' | 'pnpm' | 'eslint';
  files?: string[];
  workingDir: string;
  fix?: boolean; // Auto-fix issues
  timeout?: number; // Default: 5 minutes
  format?: 'json' | 'stylish' | 'compact';
}

export interface LintCommandResult extends ExecuteCommandResult {
  lintResults?: {
    errors: number;
    warnings: number;
    fixable: number;
  };
  issues?: Array<{
    file: string;
    line: number;
    column: number;
    rule: string;
    severity: 'error' | 'warning';
    message: string;
    fixable: boolean;
  }>;
}
```

**Specialized Features:**
- Parse ESLint JSON output
- Extract rule violations
- Identify fixable issues
- Support auto-fix mode
- Faster timeout (linting is usually quick)

**Estimated Value:** ⭐⭐⭐⭐ (4/5)

---

#### 5. Command Execution Logger
**Benefit:** Critical for optimization analysis

**Purpose:**
- Log all command executions
- Link to workflow runs and steps
- Capture performance metrics
- Enable optimization analysis

**Implementation:**
```typescript
export interface CommandLogEntry {
  commandId: string;
  workflowRunId: string;
  stepName: string;
  timestamp: string;
  command: string;
  args: string[];
  workingDir: string;
  duration: number;
  success: boolean;
  exitCode: number;
  resourceUsage?: {
    cpuPercent: number;
    memoryMB: number;
  };
  outputSize: number; // bytes
  errorType?: string;
  retryCount?: number;
}

export async function logCommandExecution(
  workspacePath: string,
  entry: CommandLogEntry
): Promise<void> {
  // Append to command_execution_log.jsonl
}
```

**Integration:**
- Called automatically by all command execution activities
- Stored in workspace for optimization analysis
- Linked to audit_trace.jsonl entries

**Estimated Value:** ⭐⭐⭐⭐⭐ (5/5)

---

### Medium Priority (Implement When Needed)

#### 6. Process Manager Activity
**Benefit:** Advanced process lifecycle management

**Purpose:**
- Track all running processes
- Kill processes by PID
- Monitor resource usage across processes
- Cleanup orphaned processes

**Implementation:**
```typescript
export interface ProcessInfo {
  pid: number;
  command: string;
  startTime: Date;
  resourceUsage: {
    cpuPercent: number;
    memoryMB: number;
  };
}

export async function listRunningProcesses(
  workspacePath: string
): Promise<ProcessInfo[]>;

export async function killProcess(pid: number, signal?: string): Promise<void>;

export async function cleanupOrphanedProcesses(
  workspacePath: string
): Promise<number>; // Returns count of cleaned processes
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 7. Command Retry Handler
**Benefit:** Handle transient failures automatically

**Purpose:**
- Retry failed commands with exponential backoff
- Detect transient vs. permanent failures
- Limit retry attempts
- Log retry attempts

**Implementation:**
```typescript
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors?: string[]; // Error patterns to retry
}

export async function executeCommandWithRetry(
  input: ExecuteCommandInput,
  retryConfig: RetryConfig
): Promise<ExecuteCommandResult>;
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 8. Streaming Command Output Handler
**Benefit:** Real-time output for long-running commands

**Purpose:**
- Stream output as it arrives
- Support progress monitoring
- Handle large output efficiently
- Real-time logging

**Implementation:**
```typescript
export interface StreamCommandInput extends ExecuteCommandInput {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onProgress?: (progress: number) => void; // 0-100
}

export async function executeCommandStreaming(
  input: StreamCommandInput
): Promise<ExecuteCommandResult>;
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

#### 9. Command Validation and Sanitization
**Benefit:** Security and safety

**Purpose:**
- Validate commands before execution
- Sanitize arguments
- Block dangerous commands
- Whitelist/blacklist support

**Implementation:**
```typescript
export interface CommandValidationResult {
  allowed: boolean;
  reason?: string;
  sanitizedCommand?: string;
  sanitizedArgs?: string[];
}

export async function validateCommand(
  command: string,
  args: string[]
): Promise<CommandValidationResult>;

// Dangerous commands to block
const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'format',
  'dd if=',
  'mkfs',
  // ... etc
];
```

**Estimated Value:** ⭐⭐⭐ (3/5)

---

### Lower Priority (Advanced Features)

#### 10. Parallel Command Execution
**Benefit:** Execute multiple commands concurrently

**Purpose:**
- Run independent commands in parallel
- Manage resource limits across parallel commands
- Aggregate results

**Implementation:**
```typescript
export interface ParallelCommandInput {
  commands: ExecuteCommandInput[];
  maxConcurrent?: number; // Default: 4
  sharedResourceLimit?: {
    maxTotalCpuPercent: number;
    maxTotalMemoryMB: number;
  };
}

export async function executeCommandsParallel(
  input: ParallelCommandInput
): Promise<ExecuteCommandResult[]>;
```

**Estimated Value:** ⭐⭐ (2/5)

---

#### 11. Command Dependency Graph Execution
**Benefit:** Execute commands in dependency order

**Purpose:**
- Define command dependencies
- Execute in correct order
- Handle dependency failures
- Parallelize independent commands

**Implementation:**
```typescript
export interface CommandDependency {
  command: string;
  dependsOn?: string[]; // Other command IDs
}

export async function executeCommandsWithDependencies(
  commands: Array<ExecuteCommandInput & { id: string }>,
  dependencies: CommandDependency[]
): Promise<Map<string, ExecuteCommandResult>>;
```

**Estimated Value:** ⭐⭐ (2/5)

---

#### 12. Interactive Command Handler
**Benefit:** Support interactive commands (lower priority for automation)

**Purpose:**
- Handle commands requiring user input
- Support prompts and responses
- Interactive debugging support

**Note:** Lower priority since most automation should be non-interactive.

**Estimated Value:** ⭐ (1/5)

---

## Implementation Strategy

### Phase 1: Foundation (High Priority)
1. ✅ Generic Command Execution Activity with PID tracking and resource monitoring
2. ✅ Command Execution Logger
3. ✅ Specialized Build Command Handler
4. ✅ Specialized Test Command Handler
5. ✅ Specialized Lint Command Handler

### Phase 2: Enhancement (Medium Priority)
6. Process Manager Activity
7. Command Retry Handler
8. Streaming Command Output Handler
9. Command Validation and Sanitization

### Phase 3: Advanced (Lower Priority)
10. Parallel Command Execution
11. Command Dependency Graph Execution
12. Interactive Command Handler

---

## Resource Management Strategy

### CPU Limits
- **Default:** 80% CPU per command
- **Build commands:** 90% CPU (can use more)
- **Test commands:** 70% CPU (leave headroom)
- **Lint commands:** 50% CPU (usually quick)

### Memory Limits
- **Default:** 2GB per command
- **Build commands:** 4GB (TypeScript compilation can be memory-intensive)
- **Test commands:** 2GB (sufficient for most test suites)
- **Lint commands:** 512MB (lightweight)

### Timeout Strategy
- **Build commands:** 15 minutes (TypeScript compilation can be slow)
- **Test commands:** 30 minutes (full test suites can take time)
- **Lint commands:** 5 minutes (usually quick)
- **Generic commands:** 10 minutes (default)
- **Configurable per command type**

### Process Cleanup
- **On timeout:** Send SIGTERM, wait 5 seconds, then SIGKILL
- **On error:** Clean up process and child processes
- **On workflow cancellation:** Kill all associated processes
- **Track PIDs:** Maintain PID registry for cleanup

---

## Logging and Optimization

### Command Log Structure
```json
{
  "commandId": "cmd-2025-01-15-abc123",
  "workflowRunId": "wf-xyz789",
  "stepName": "build_phase",
  "timestamp": "2025-01-15T10:30:00Z",
  "command": "npm",
  "args": ["run", "build"],
  "workingDir": "/tmp/build-123",
  "duration": 45000,
  "success": true,
  "exitCode": 0,
  "resourceUsage": {
    "cpuPercent": 65.2,
    "memoryMB": 1024
  },
  "outputSize": 524288,
  "retryCount": 0
}
```

### Optimization Analysis
- **Identify slow commands:** Average duration analysis
- **Resource hogs:** High CPU/memory usage detection
- **Failure patterns:** Common command failures
- **Timeout optimization:** Adjust timeouts based on actual usage
- **Retry effectiveness:** Measure retry success rates

---

## Integration with Agent Workflows

### Current Flow
1. Agent (Claude/Gemini) executes commands via CLI (`--yolo` / `--permission-mode acceptEdits`)
2. Workflow calls specific activities (`runBuild`, `runTests`)
3. Activities use basic `exec` with timeouts

### Proposed Flow
1. Agent requests command execution via workflow
2. Workflow calls `executeCommand` or specialized handler
3. Activity executes with resource limits, monitoring, logging
4. Results returned to workflow
5. Command logged for optimization

### Agent Command Request Format
```typescript
interface AgentCommandRequest {
  command: string;
  args: string[];
  type: 'build' | 'test' | 'lint' | 'generic';
  workingDir: string;
  timeout?: number;
}
```

---

## Error Handling

### Error Categories
1. **Timeout Errors:** Command exceeded timeout
2. **Resource Errors:** Exceeded CPU/memory limits
3. **Execution Errors:** Command failed (non-zero exit)
4. **Parse Errors:** Failed to parse output
5. **Permission Errors:** Insufficient permissions
6. **Network Errors:** Network-related failures (for remote commands)

### Error Response
```typescript
interface CommandError {
  type: string;
  message: string;
  command: string;
  exitCode?: number;
  stderr?: string;
  resourceExceeded?: boolean;
  retryable: boolean;
}
```

---

## Testing Strategy

### Unit Tests
- Mock process execution
- Test timeout handling
- Test resource limit enforcement
- Test PID tracking and cleanup
- Test output parsing

### Integration Tests
- Real command execution in temp directories
- Test actual timeouts
- Test resource monitoring
- Test process cleanup
- Test logging

### Performance Tests
- Measure overhead of monitoring
- Test resource limit enforcement
- Test concurrent command execution
- Test cleanup performance

---

## Security Considerations

### Command Validation
- Whitelist allowed commands
- Block dangerous commands (`rm -rf`, `format`, etc.)
- Sanitize arguments
- Validate working directory paths

### Permission Management
- Run commands with minimal permissions
- Isolate command execution
- Prevent access to sensitive files
- Audit command execution

### Input Sanitization
- Escape shell metacharacters
- Validate file paths
- Sanitize environment variables
- Prevent command injection

---

## Notes

- **Use `spawn` over `exec`:** Better control over process lifecycle
- **Consider `execa` library:** More robust than raw `spawn`/`exec`
- **Process groups:** Use process groups for cleanup of child processes
- **Resource monitoring:** Use `pidusage` or similar for CPU/memory tracking
- **Logging:** Store in `command_execution_log.jsonl` alongside `audit_trace.jsonl`
- **Optimization:** Link command logs to workflow steps for analysis

---

## Dependencies Needed

```json
{
  "execa": "^8.0.0",  // Better process execution
  "pidusage": "^3.0.0",  // Resource monitoring
  "tree-kill": "^1.2.2"  // Kill process trees
}
```
