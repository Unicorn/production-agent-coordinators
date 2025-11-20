# Real Agent Execution Implementation Design

**Date:** 2025-11-20
**Author:** Claude (AI Assistant)
**Status:** Design Complete, Ready for Implementation
**Related Documents:**
- [PACKAGE_BUILDER_WORKFLOW_ANALYSIS.md](/PACKAGE_BUILDER_WORKFLOW_ANALYSIS.md)
- [2025-11-14-agentic-coordinator-workflow-design.md](/docs/plans/2025-11-14-agentic-coordinator-workflow-design.md)

---

## Executive Summary

This design implements real agent execution for the Package Builder workflow system. Currently, the `AgentExecutorWorkflow` returns simulated success without actually generating code. This design enhances the existing workflow to perform real code generation via Claude AI, transforming the system from a proof-of-concept orchestrator into a functional autonomous package builder.

**Key Metrics:**
- Current State: 70% orchestration implemented, 0% agent execution implemented
- Target State: 100% functional end-to-end package building
- Implementation Complexity: Medium (4-5 days)
- Risk Level: Low (enhances existing components, no breaking changes)

---

## Problem Statement

### Current Behavior (Simulation)

The `executeAgentTask()` activity in `src/activities/agent-execution.activities.ts` currently:

```typescript
export async function executeAgentTask(
  agent: string,
  taskType: string,
  instructions: string,
  packagePath: string
): Promise<AgentExecutionResult> {
  console.log(`[AgentExecution] Agent: ${agent}`)
  console.log(`[AgentExecution] Task: ${taskType}`)
  console.log(`[AgentExecution] Instructions: ${instructions}`)
  console.log(`[AgentExecution] Package Path: ${packagePath}`)

  // For PoC, return success with explanation
  // Phase 2 will actually execute agent and modify files at packagePath
  return {
    success: true,
    changes: [`Simulated fix by ${agent}`],
    output: `Agent ${agent} analyzed the task: ${taskType}\n\nThis is a PoC stub...`
  }
}
```

**Impact:** The workflow completes successfully but generates no code, builds, or tests nothing.

### Required Behavior (Real Execution)

The enhanced system must:
1. Build context-rich prompts with plan content and existing code
2. Call Claude AI to generate/fix code based on instructions
3. Parse structured responses (JSON format with file operations)
4. Apply file changes (create/update/delete) to the package directory
5. Return actual results indicating what was modified

---

## Architectural Decision

### Approach Selection

**Chosen Approach:** Enhanced Workflow Pattern (Approach 2)

**Rationale:**
- Leverages existing `AgentExecutorWorkflow` infrastructure
- Mirrors proven pattern from coordinator (which successfully uses Anthropic SDK)
- Separation of concerns via focused activities
- Properly handles long-running AI operations with Temporal timeouts
- No changes required to parent workflows or coordinator
- Testable at every layer

**Rejected Approaches:**
- Direct SDK Integration (Approach 1): Long-running activities, poor separation of concerns
- Template Hybrid (Approach 3): Still has long-running activity issues, mixed concerns

---

## Detailed Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CoordinatorWorkflow (unchanged)                              │
│  - Analyzes problem                                          │
│  - Selects appropriate agent                                 │
│  - Builds instructions                                       │
└───────────────────┬─────────────────────────────────────────┘
                    │ delegates to
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ AgentExecutorWorkflow (ENHANCED)                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 1. buildAgentPrompt(agent, task, instructions)     │    │
│  │    - Load plan file                                │    │
│  │    - Read existing package files                   │    │
│  │    - Construct context-rich prompt                 │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │ 2. executeAgentWithClaude(prompt, config)          │    │
│  │    - Call Anthropic SDK                            │    │
│  │    - Handle retries, rate limits                   │    │
│  │    - Return structured JSON response               │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │ 3. parseAgentResponse(response)                    │    │
│  │    - Strip markdown code blocks                    │    │
│  │    - Parse JSON structure                          │    │
│  │    - Validate file operations                      │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │ 4. applyFileChanges(operations, packagePath)       │    │
│  │    - Create directories                            │    │
│  │    - Write/update/delete files                     │    │
│  │    - Validate security (no path traversal)         │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│                   ▼                                          │
│              Return AgentExecutionResult                     │
└─────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. buildAgentPrompt Activity

**File:** `src/activities/prompt-builder.activities.ts` (new)

**Input:**
```typescript
interface BuildPromptInput {
  agentName: string;
  taskType: string;
  instructions: string;
  packagePath: string;
  planPath: string;
  workspaceRoot: string;
}
```

**Logic:**
1. Read plan file from `planPath`
2. Check if package exists at `packagePath`
3. If exists: read package.json, src/ files (up to 10 files, max 100KB total)
4. Build file tree representation
5. Construct prompt with format:

```
You are the {agentName} agent specializing in {skills from registry}.

TASK TYPE: {taskType}

CONTEXT:
Package: {packageName}
Path: {packagePath}

PLAN:
{planContent}

EXISTING CODE (if any):
{fileTree}

TASK INSTRUCTIONS:
{instructions}

OUTPUT FORMAT (JSON only, no markdown):
{
  "files": [
    {
      "path": "relative/path/to/file.ts",
      "operation": "create" | "update" | "delete",
      "content": "file contents (for create/update)"
    }
  ],
  "summary": "Brief description of changes made"
}

IMPORTANT:
- All file paths must be relative to package root
- Use ONLY the JSON format specified above
- For operation "create": file must not exist
- For operation "update": file must exist
- For operation "delete": only provide path, no content
```

**Output:** `string` (formatted prompt)

**Activity Timeout:** 2 minutes (file reading)

---

#### 2. executeAgentWithClaude Activity

**File:** `src/activities/agent-execution.activities.ts` (replace existing)

**Input:**
```typescript
interface ExecuteAgentInput {
  prompt: string;
  model?: string;  // defaults to env ANTHROPIC_MODEL
  temperature?: number;  // defaults to 0.2
  maxTokens?: number;  // defaults to 8000
}
```

**Logic:**
1. Initialize Anthropic SDK (reuse pattern from coordinator.activities.ts)
2. Call `anthropic.messages.create()` with prompt
3. Extract response text
4. Return raw response (parsing happens in separate activity)

**Error Handling:**
- 429 Rate Limit: Retry with exponential backoff (Temporal handles automatically)
- 500 Server Error: Retry up to 3 times
- 401 Auth Error: Fail immediately (configuration issue)
- Timeout: Fail after 10 minutes

**Output:** `string` (Claude's response text)

**Activity Timeout:** 10 minutes (AI generation can be slow)

---

#### 3. parseAgentResponse Activity

**File:** `src/activities/response-parser.activities.ts` (new)

**Input:**
```typescript
interface ParseResponseInput {
  responseText: string;
  packagePath: string;  // for security validation
}
```

**Logic:**
1. Strip markdown code blocks (reuse from agentic-plan-parser.activities.ts):
   ```typescript
   responseText = responseText.trim();
   if (responseText.startsWith('```')) {
     responseText = responseText.replace(/^```(?:json)?\s*\n/, '');
     responseText = responseText.replace(/\n```\s*$/, '');
   }
   ```

2. Parse JSON
3. Validate structure:
   - `files` array exists and has >= 1 item
   - Each file has: `path`, `operation`, (`content` if not delete)
   - `summary` string exists

4. Security validation:
   - Reject paths with `..` (path traversal attack)
   - Reject absolute paths (must be relative)
   - Reject paths outside package directory

5. Return parsed structure

**Output:**
```typescript
interface FileOperation {
  path: string;
  operation: 'create' | 'update' | 'delete';
  content?: string;
}

interface ParsedAgentResponse {
  files: FileOperation[];
  summary: string;
}
```

**Activity Timeout:** 30 seconds (pure parsing)

---

#### 4. applyFileChanges Activity

**File:** `src/activities/file-operations.activities.ts` (new)

**Input:**
```typescript
interface ApplyChangesInput {
  operations: FileOperation[];
  packagePath: string;
  workspaceRoot: string;
}
```

**Logic:**
1. For each operation:
   - Resolve full path: `path.join(workspaceRoot, packagePath, operation.path)`
   - Verify path is within package directory (double-check security)
   - Execute operation:
     - **create:** Check file doesn't exist, create parent dirs, write file
     - **update:** Check file exists, backup, write new content
     - **delete:** Check file exists, delete file
   - Track success/failure for each operation

2. Return list of actually modified files

**Error Handling:**
- Permission denied: Fail with clear error
- Disk full: Fail (non-retryable)
- Directory creation failed: Fail with path details
- File already exists (for create): Fail with error
- File doesn't exist (for update/delete): Fail with error

**Output:**
```typescript
interface ApplyChangesResult {
  modifiedFiles: string[];
  failedOperations: Array<{ path: string; operation: string; error: string }>;
}
```

**Activity Timeout:** 5 minutes (could be many files)

---

### Enhanced AgentExecutorWorkflow

**File:** `src/workflows/agent-executor.workflow.ts` (enhance existing)

**Current Implementation:**
```typescript
export async function AgentExecutorWorkflow(input: AgentExecutorInput) {
  console.log(`[AgentExecutor] Starting agent: ${input.agent}`);
  console.log(`[AgentExecutor] Task type: ${input.taskType}`);

  // SIMULATED - just calls stubbed activity
  const result = await executeAgentTask(
    input.agent,
    input.taskType,
    input.instructions,
    input.packagePath
  );

  console.log(`[AgentExecutor] Result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
  return result;
}
```

**Enhanced Implementation:**
```typescript
const { buildAgentPrompt } = proxyActivities<typeof promptBuilderActivities>({
  startToCloseTimeout: '2 minutes'
});

const { executeAgentWithClaude } = proxyActivities<typeof agentExecutionActivities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    initialInterval: '10s',
    backoffCoefficient: 2,
    maximumAttempts: 3
  }
});

const { parseAgentResponse } = proxyActivities<typeof responseParserActivities>({
  startToCloseTimeout: '30 seconds'
});

const { applyFileChanges } = proxyActivities<typeof fileOperationsActivities>({
  startToCloseTimeout: '5 minutes'
});

export async function AgentExecutorWorkflow(input: AgentExecutorInput) {
  console.log(`[AgentExecutor] Starting agent: ${input.agent}`);
  console.log(`[AgentExecutor] Task type: ${input.taskType}`);

  try {
    // Step 1: Build prompt with context
    console.log('[AgentExecutor] Building prompt...');
    const prompt = await buildAgentPrompt({
      agentName: input.agent,
      taskType: input.taskType,
      instructions: input.instructions,
      packagePath: input.packagePath,
      planPath: input.planPath || `plans/${input.packagePath}.md`,
      workspaceRoot: input.workspaceRoot
    });

    // Step 2: Execute agent with Claude
    console.log('[AgentExecutor] Calling Claude...');
    const responseText = await executeAgentWithClaude({
      prompt,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxTokens: 8000
    });

    // Step 3: Parse response
    console.log('[AgentExecutor] Parsing response...');
    const parsed = await parseAgentResponse({
      responseText,
      packagePath: input.packagePath
    });

    // Step 4: Apply file changes
    console.log(`[AgentExecutor] Applying ${parsed.files.length} file operations...`);
    const applyResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: input.packagePath,
      workspaceRoot: input.workspaceRoot
    });

    // Check for failures
    if (applyResult.failedOperations.length > 0) {
      console.log(`[AgentExecutor] ${applyResult.failedOperations.length} operations failed`);
      return {
        success: false,
        changes: applyResult.modifiedFiles,
        output: parsed.summary,
        errors: applyResult.failedOperations.map(f => `${f.operation} ${f.path}: ${f.error}`)
      };
    }

    console.log(`[AgentExecutor] SUCCESS - Modified ${applyResult.modifiedFiles.length} files`);
    return {
      success: true,
      changes: applyResult.modifiedFiles,
      output: parsed.summary
    };

  } catch (error) {
    console.error('[AgentExecutor] Error:', error);
    return {
      success: false,
      changes: [],
      output: `Agent execution failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
```

---

## Data Formats

### Prompt Format

```markdown
You are the package-development-agent agent specializing in typescript, testing, documentation, package-implementation.

TASK TYPE: PACKAGE_SCAFFOLDING

CONTEXT:
Package: @bernierllc/logger
Path: packages/utility/logger

PLAN:
# Logger Package

**Package:** `@bernierllc/logger`
**Type:** utility
**Description:** Centralized logging utility with multiple transports

## Dependencies
- None (no dependencies)

## Exports
- `createLogger(options)` - Create logger instance
...

EXISTING CODE:
No existing code found (fresh scaffolding)

TASK INSTRUCTIONS:
Scaffold the @bernierllc/logger package according to the plan at plans/packages/utility/logger.md. Create the package structure at packages/utility/logger including:
1. package.json with correct name, version, and dependencies
2. tsconfig.json for TypeScript configuration
3. src/ directory with initial implementation files
4. tests/ directory with test setup
5. README.md with package documentation

OUTPUT FORMAT (JSON only, no markdown):
{
  "files": [
    {
      "path": "package.json",
      "operation": "create",
      "content": "..."
    }
  ],
  "summary": "Created logger package with ..."
}
```

### Response Format

```json
{
  "files": [
    {
      "path": "package.json",
      "operation": "create",
      "content": "{\n  \"name\": \"@bernierllc/logger\",\n  \"version\": \"1.0.0\",\n  ..."
    },
    {
      "path": "tsconfig.json",
      "operation": "create",
      "content": "{\n  \"compilerOptions\": {\n    \"target\": \"ES2020\",\n    ..."
    },
    {
      "path": "src/index.ts",
      "operation": "create",
      "content": "export interface LoggerOptions {\n  level: 'debug' | 'info' | 'warn' | 'error';\n  ..."
    },
    {
      "path": "tests/logger.test.ts",
      "operation": "create",
      "content": "import { describe, it, expect } from 'vitest';\nimport { createLogger } from '../src';\n\n..."
    },
    {
      "path": "README.md",
      "operation": "create",
      "content": "# @bernierllc/logger\n\nCentralized logging utility...\n\n## Installation\n..."
    }
  ],
  "summary": "Created logger package structure with package.json, TypeScript configuration, main source file with logger interface and implementation, test setup with Vitest, and comprehensive README documentation."
}
```

---

## Error Handling Strategy

### 1. Prompt Building Errors

**Scenarios:**
- Plan file doesn't exist
- Package path inaccessible
- File read permission denied

**Handling:**
- Fail activity with clear error message
- Coordinator receives failure and can:
  - Retry with different instructions
  - Delegate to different agent
  - Fail after 3 attempts

### 2. Claude API Errors

**Scenarios:**
- 429 Rate Limit
- 500 Server Error
- 401 Authentication Error
- Network timeout

**Handling:**
```typescript
retry: {
  initialInterval: '10s',
  backoffCoefficient: 2,
  maximumAttempts: 3,
  nonRetryableErrorTypes: ['AuthenticationError']
}
```

- Rate limits and server errors: Auto-retry with backoff
- Auth errors: Fail immediately (configuration issue)
- After 3 retries: Fail and bubble to coordinator

### 3. Response Parsing Errors

**Scenarios:**
- Invalid JSON
- Missing required fields
- Security violation (path traversal)

**Handling:**
- Invalid JSON: Fail with response preview (first 500 chars)
- Missing fields: Fail with validation error details
- Security violation: Fail immediately, log security event

### 4. File Operation Errors

**Scenarios:**
- Permission denied
- Disk full
- File already exists (for create)
- File doesn't exist (for update/delete)

**Handling:**
- Return partial success (some files modified, some failed)
- Include `failedOperations` in result
- Coordinator sees partial failure and decides:
  - Retry with modified instructions
  - Manual intervention required
  - Fail the build

---

## Security Considerations

### Path Traversal Prevention

**Validation:**
```typescript
function validatePath(filePath: string, packagePath: string): void {
  // Reject paths with ..
  if (filePath.includes('..')) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }

  // Reject absolute paths
  if (path.isAbsolute(filePath)) {
    throw new Error(`Absolute paths not allowed: ${filePath}`);
  }

  // Verify resolved path is within package
  const fullPath = path.join(workspaceRoot, packagePath, filePath);
  const packageRoot = path.join(workspaceRoot, packagePath);

  if (!fullPath.startsWith(packageRoot)) {
    throw new Error(`Path outside package directory: ${filePath}`);
  }
}
```

**Where Applied:**
- In `parseAgentResponse` activity (first validation)
- In `applyFileChanges` activity (second validation before writing)

### Prompt Injection Prevention

**Risk:** Malicious plan files could inject instructions to generate harmful code

**Mitigation:**
- Plan files are trusted (part of codebase)
- No user-provided content in prompts
- Claude's safety guidelines apply automatically
- File operations limited to package directory

### API Key Protection

**Current:** API keys in `.env` file (correct)

**Best Practices:**
- Never log prompts/responses (may contain sensitive data from plan files)
- Use environment variables for all secrets
- Rotate API keys regularly

---

## Testing Strategy

### Unit Tests

**Test File:** `tests/activities/prompt-builder.test.ts`
```typescript
describe('buildAgentPrompt', () => {
  it('should build prompt with plan content', async () => {
    const prompt = await buildAgentPrompt({
      agentName: 'package-development-agent',
      taskType: 'PACKAGE_SCAFFOLDING',
      instructions: 'Create logger package',
      packagePath: 'packages/utility/logger',
      planPath: 'plans/packages/utility/logger.md',
      workspaceRoot: '/test/workspace'
    });

    expect(prompt).toContain('package-development-agent');
    expect(prompt).toContain('PACKAGE_SCAFFOLDING');
    expect(prompt).toContain('OUTPUT FORMAT');
  });
});
```

**Test File:** `tests/activities/response-parser.test.ts`
```typescript
describe('parseAgentResponse', () => {
  it('should parse valid JSON response', async () => {
    const response = `{ "files": [...], "summary": "..." }`;
    const parsed = await parseAgentResponse({
      responseText: response,
      packagePath: 'packages/utility/logger'
    });
    expect(parsed.files).toHaveLength(5);
    expect(parsed.summary).toBeDefined();
  });

  it('should strip markdown code blocks', async () => {
    const response = '```json\n{ "files": [], "summary": "" }\n```';
    const parsed = await parseAgentResponse({
      responseText: response,
      packagePath: 'packages/utility/logger'
    });
    expect(parsed.files).toEqual([]);
  });

  it('should reject path traversal attacks', async () => {
    const response = `{ "files": [{"path": "../../../etc/passwd", "operation": "create"}], "summary": "" }`;
    await expect(parseAgentResponse({
      responseText: response,
      packagePath: 'packages/utility/logger'
    })).rejects.toThrow('Path traversal');
  });
});
```

**Test File:** `tests/activities/file-operations.test.ts`
```typescript
describe('applyFileChanges', () => {
  beforeEach(() => {
    // Setup test workspace
  });

  it('should create new files', async () => {
    const result = await applyFileChanges({
      operations: [{
        path: 'src/index.ts',
        operation: 'create',
        content: 'export const hello = "world";'
      }],
      packagePath: 'packages/test',
      workspaceRoot: '/tmp/test-workspace'
    });

    expect(result.modifiedFiles).toContain('src/index.ts');
    expect(fs.readFileSync('/tmp/test-workspace/packages/test/src/index.ts', 'utf-8'))
      .toBe('export const hello = "world";');
  });
});
```

### Integration Tests

**Test File:** `tests/workflows/agent-executor.integration.test.ts`
```typescript
describe('AgentExecutorWorkflow Integration', () => {
  it('should scaffold a package with mocked Claude response', async () => {
    // Mock Anthropic SDK
    const mockResponse = {
      files: [
        { path: 'package.json', operation: 'create', content: '{"name": "test"}' },
        { path: 'src/index.ts', operation: 'create', content: 'export {}' }
      ],
      summary: 'Created test package'
    };

    mockAnthropicSDK.messages.create.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(mockResponse) }]
    });

    // Execute workflow
    const result = await testEnv.executeWorkflow(AgentExecutorWorkflow, {
      agent: 'package-development-agent',
      taskType: 'PACKAGE_SCAFFOLDING',
      instructions: 'Create test package',
      packagePath: 'packages/test',
      workspaceRoot: '/tmp/test'
    });

    expect(result.success).toBe(true);
    expect(result.changes).toContain('package.json');
    expect(result.changes).toContain('src/index.ts');
  });
});
```

### End-to-End Tests

**Test:** Scaffold real package with real Claude API

```typescript
describe('E2E: Package Scaffolding', () => {
  it('should scaffold logger package from plan', async () => {
    const workflowHandle = await client.workflow.start(PackageBuildWorkflow, {
      taskQueue: 'engine',
      args: [{
        packageName: '@test/logger',
        packagePath: 'packages/test/logger',
        planPath: 'plans/test/logger.md',
        category: 'utility',
        dependencies: [],
        workspaceRoot: '/tmp/e2e-test',
        config: { maxConcurrentBuilds: 1, skipTests: false }
      }]
    });

    const result = await workflowHandle.result();

    expect(result.success).toBe(true);
    expect(fs.existsSync('/tmp/e2e-test/packages/test/logger/package.json')).toBe(true);
    expect(fs.existsSync('/tmp/e2e-test/packages/test/logger/src/index.ts')).toBe(true);

    // Verify package actually builds
    execSync('yarn build', { cwd: '/tmp/e2e-test/packages/test/logger' });
  });
});
```

---

## Implementation Plan

### Phase 1: Foundation (Day 1)
- [ ] Create `src/activities/prompt-builder.activities.ts`
- [ ] Implement `buildAgentPrompt()` with plan reading and file tree generation
- [ ] Write unit tests for prompt builder
- [ ] Create `src/activities/response-parser.activities.ts`
- [ ] Implement `parseAgentResponse()` with security validation
- [ ] Write unit tests for response parser (including security tests)

### Phase 2: Execution (Day 2)
- [ ] Update `src/activities/agent-execution.activities.ts`
- [ ] Implement `executeAgentWithClaude()` (reuse coordinator pattern)
- [ ] Configure retry policies and timeouts
- [ ] Write unit tests with mocked Anthropic SDK
- [ ] Create `src/activities/file-operations.activities.ts`
- [ ] Implement `applyFileChanges()` with atomic operations
- [ ] Write unit tests for file operations

### Phase 3: Integration (Day 3)
- [ ] Update `src/workflows/agent-executor.workflow.ts`
- [ ] Add activity orchestration (4 steps)
- [ ] Add error handling and logging
- [ ] Update activity exports in `src/activities/index.ts`
- [ ] Write integration tests with mocked responses
- [ ] Verify no changes needed to coordinator or parent workflows

### Phase 4: Testing (Day 4)
- [ ] Run unit tests (should all pass)
- [ ] Run integration tests (verify file operations work)
- [ ] Manual test: Scaffold simple package (logger)
- [ ] Manual test: Fix build error (coordinator → agent → fix)
- [ ] Manual test: Security test (attempt path traversal)
- [ ] Review error handling paths

### Phase 5: Production Deployment (Day 5)
- [ ] Deploy to staging environment
- [ ] Run E2E test with real Claude API
- [ ] Monitor Temporal workflows for errors
- [ ] Test full package build workflow (11 packages)
- [ ] Performance profiling (AI call duration, file operations)
- [ ] Deploy to production
- [ ] Update documentation

---

## Monitoring & Observability

### Key Metrics to Track

1. **Activity Duration:**
   - `buildAgentPrompt`: Should be < 10s (file reading)
   - `executeAgentWithClaude`: 30s - 5min (AI generation)
   - `parseAgentResponse`: < 1s (JSON parsing)
   - `applyFileChanges`: < 30s (file writing)

2. **Success Rates:**
   - % of agent executions that succeed
   - % of parsing failures (indicates prompt issues)
   - % of file operation failures

3. **Security Events:**
   - Path traversal attempts
   - Invalid file operations
   - Absolute path rejections

### Logging Strategy

```typescript
// At workflow level
console.log('[AgentExecutor] Starting:', { agent, taskType, packagePath });
console.log('[AgentExecutor] Prompt built:', { promptLength: prompt.length });
console.log('[AgentExecutor] Claude responded:', { responseLength: response.length });
console.log('[AgentExecutor] Parsed:', { fileCount: parsed.files.length });
console.log('[AgentExecutor] Applied:', { modified: result.modifiedFiles.length });

// At activity level
console.log('[PromptBuilder] Loading plan:', { planPath });
console.log('[PromptBuilder] Existing files found:', { count: files.length });
console.log('[ClaudeExecution] Calling API:', { model, maxTokens });
console.log('[FileOps] Creating file:', { path, size: content.length });
```

### Alerts

- Alert if > 20% of agent executions fail
- Alert if security violations detected
- Alert if Claude API quota exceeded
- Alert if activity durations > 2x normal

---

## Migration Path

### Backward Compatibility

**Current System:**
- Coordinator calls `AgentExecutorWorkflow`
- `AgentExecutorWorkflow` calls `executeAgentTask()` (stub)
- Returns `AgentExecutionResult`

**Enhanced System:**
- Coordinator calls `AgentExecutorWorkflow` ← **NO CHANGE**
- `AgentExecutorWorkflow` calls 4 new activities ← **INTERNAL CHANGE**
- Returns `AgentExecutionResult` ← **NO CHANGE**

**Conclusion:** Zero breaking changes. Enhanced system is drop-in replacement.

### Deployment Strategy

1. Deploy new activities to worker
2. Deploy enhanced workflow to worker
3. Worker automatically picks up new workflow definition
4. Next workflow execution uses new implementation
5. No downtime required

---

## Success Criteria

### Definition of Done

- [ ] All unit tests pass (100% coverage for new activities)
- [ ] All integration tests pass
- [ ] E2E test scaffolds package and builds successfully
- [ ] Security tests pass (path traversal blocked)
- [ ] Manual test: Build logger package from scratch
- [ ] Manual test: Coordinator delegates to agent and receives real results
- [ ] No errors in production after 24 hours
- [ ] Performance: Average agent execution < 2 minutes

### Acceptance Criteria

1. **Functional:** Agent execution generates real code that builds successfully
2. **Quality:** Generated code passes linting and tests
3. **Security:** Path validation prevents directory traversal
4. **Reliability:** Handles API errors gracefully with retries
5. **Performance:** Agent execution completes within 10 minutes
6. **Observability:** All key events logged to Temporal

---

## Open Questions

None. Design is complete and ready for implementation.

---

## Related Work

- **AI Plan Parser:** Already implemented and working (extracts 11 packages from plan)
- **Coordinator Workflow:** Already implemented and working (selects correct agent)
- **Build/Test/Publish Pipeline:** Already implemented and working (real activities)
- **This Design:** Fills the critical gap between coordinator decision-making and package building

---

## Appendix: File Modifications Required

### New Files
1. `src/activities/prompt-builder.activities.ts`
2. `src/activities/response-parser.activities.ts`
3. `src/activities/file-operations.activities.ts`
4. `tests/activities/prompt-builder.test.ts`
5. `tests/activities/response-parser.test.ts`
6. `tests/activities/file-operations.test.ts`
7. `tests/workflows/agent-executor.integration.test.ts`

### Modified Files
1. `src/workflows/agent-executor.workflow.ts` - Add activity orchestration
2. `src/activities/agent-execution.activities.ts` - Replace stub with real execution
3. `src/activities/index.ts` - Export new activities
4. `src/types/index.ts` - Add new types (if needed)

### Total Scope
- **New files:** 7 (4 implementation + 3 test)
- **Modified files:** 4
- **Lines of code (estimated):** ~800 LOC implementation, ~600 LOC tests
- **Complexity:** Medium
- **Risk:** Low (enhances existing, no breaking changes)
