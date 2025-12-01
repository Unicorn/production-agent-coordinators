# Plan: Enhancing Claude-Based Package Builder Workflows with Headless CLI Orchestration

## 1. Overview

This plan outlines the strategy to enhance our package builder workflows by orchestrating the Claude Code CLI in a headless, autonomous mode via Temporal. This approach addresses the complexities of direct API interaction, leveraging the CLI's built-in capabilities for tool execution and context management, while utilizing Temporal for durability, reliability, and complex orchestration.

The core idea is to treat the Claude Code CLI as an "autonomous agent activity" within a Temporal workflow, allowing for systematic execution, verification, and self-correction.

### 1.1 Why CLI Over API

| Challenge with Raw API | CLI Solution |
|------------------------|--------------|
| ReAct loop implementation | Built-in agentic tool execution |
| Tool calling format complexity | Native file system, bash, and code tools |
| Context/memory management | `CLAUDE.md` file injection + conversation resume |
| Token management | CLI handles context window optimization |
| Authentication/retry logic | Handled by CLI infrastructure |

## 2. The "Headless" CLI Pattern

The key to making this work is Claude Code's **Headless Mode**. You are not "chatting" with it; you are dispatching a job.

### 2.1 The Command to Orchestrate

```bash
claude -p "Your detailed instruction here..." \
       --allowedTools "Read,Write,Edit,Bash" \
       --permission-mode acceptEdits \
       --output-format json
```

**Key Flags:**

| Flag | Purpose |
|------|---------|
| `-p` / `--print` | **Critical.** Runs in non-interactive mode, prints result and exits. |
| `--output-format json` | Returns structured JSON with result, cost, token usage, and tool outputs. |
| `--permission-mode acceptEdits` | Auto-approves tool execution (Claude's equivalent of `--yolo`). Turns the CLI from an "assistant" into an "autonomous agent." |
| `--allowedTools` | Explicitly controls which tools the agent can use (e.g., `Read,Write,Edit,Bash`). |
| `--append-system-prompt` | Injects additional system-level constraints for the current run. |

### 2.2 Context Management: Instructions vs. Conversation State

**Critical distinction from Gemini:** Claude Code separates *project instructions* from *conversation context*. This is fundamentally different from Gemini's pattern where `GEMINI.md` serves as injected conversation state.

| Concern | Gemini Pattern | Claude Pattern |
|---------|----------------|----------------|
| Project instructions | Embedded in `GEMINI.md` | `CLAUDE.md` file (auto-read) |
| Conversation history | Embedded in `GEMINI.md` | CLI session management |
| Step-specific context | Embedded in `GEMINI.md` | Prompt content |
| Continuity mechanism | Rewrite file each call | `--resume <session_id>` |

#### 2.2.1 `CLAUDE.md` — Static Project Instructions

`CLAUDE.md` is for **durable project knowledge** that doesn't change between workflow steps:

```
project-workspace/
├── CLAUDE.md           # Project instructions (static)
├── package.json
├── src/
└── ...
```

**Contents — requirements and constraints only:**

```markdown
# BernierLLC Package Requirements

This package MUST adhere to the following non-negotiable standards:

## TypeScript Configuration
- All source code in `src/`, compiled to `dist/`
- Strict mode enabled (`strict: true` in tsconfig.json)
- No `any` types — use `unknown` with type guards

## Quality Gates
- ESLint with strict rules, zero warnings allowed
- Jest with 80%+ coverage threshold
- All public exports must have TSDoc comments

## Package Structure
- Entry point: `src/index.ts`
- Tests in `__tests__/` directory
- README.md with usage examples

## Scripts Required
- `build`: TypeScript compilation
- `lint`: ESLint check
- `test`: Jest with coverage
```

**What does NOT go in `CLAUDE.md`:**
- The package specification (passed in prompt)
- Error logs from failed builds (passed in prompt)
- Conversation history (managed by CLI sessions)
- Step-specific instructions (passed in prompt)

#### 2.2.2 Session Management — Conversation Continuity

Claude Code maintains conversation history internally. Use session management for multi-step workflows:

```bash
# Step 1: Scaffolding — capture session_id
result=$(claude -p "Create the package structure for: [spec]" --output-format json)
session_id=$(echo "$result" | jq -r '.session_id')

# Step 2: Implementation — resume same session (Claude remembers Step 1)
claude --resume "$session_id" -p "Now implement the source files" \
       --output-format json \
       --permission-mode acceptEdits

# Step 3: Continue most recent session
claude --continue -p "Add comprehensive tests" \
       --output-format json \
       --permission-mode acceptEdits
```

**Benefits of session continuity:**
- Claude remembers what files it created and why
- No need to re-describe the spec in every prompt
- More natural "conversation" flow across workflow steps
- Token-efficient (no redundant context)

#### 2.2.3 Prompt Content — Step-Specific Context

Each prompt contains only what's needed for that step:

```typescript
// Scaffolding prompt — includes the spec since it's the first step
const scaffoldPrompt = `
Create the package structure for the following specification:

${specFileContent}

Generate: package.json, tsconfig.json, jest.config.js, .eslintrc.js, README.md
`;

// Implementation prompt — spec already in session context
const implPrompt = `
Implement the full package based on the specification we discussed.
Create all source files in src/ and tests in __tests__/.
`;

// Repair prompt — includes error log as targeted context
const repairPrompt = `
The build failed with the following errors:

\`\`\`
${validation.output}
\`\`\`

Fix these issues with minimal changes.
`;
```

### 2.3 Structured JSON Output

The `--output-format json` flag returns parseable output:

```json
{
  "result": "Successfully created package.json with all required fields...",
  "cost_usd": 0.0234,
  "duration_ms": 12450,
  "num_turns": 3,
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

For streaming scenarios (real-time monitoring), use `--output-format stream-json`:

```bash
claude -p "Build the implementation" \
       --output-format stream-json \
       --allowedTools "Read,Write,Edit,Bash" \
       --permission-mode acceptEdits
```

## 3. Core Components and Activities

### 3.1 `executeClaudeAgent` Activity

This activity serves as the primary interface to the Claude Code CLI.

**Purpose:** Execute Claude Code commands, with support for session continuity.

**Input:**
```typescript
interface ExecuteClaudeAgentInput {
  instruction: string;
  workingDir: string;
  
  // Session management (choose one)
  sessionId?: string;          // Resume specific session
  continueRecent?: boolean;    // Continue most recent session
  
  // Tool control
  allowedTools?: string[];
  permissionMode?: 'acceptEdits' | 'plan' | 'full';
  
  // Optional enhancements
  systemPromptAppend?: string;
  timeoutMs?: number;
}
```

**Key difference from Gemini pattern:** We do NOT write context to `CLAUDE.md` each call. Instead:
- `CLAUDE.md` is written once at workspace setup (static requirements)
- Session management provides conversation continuity
- Step-specific context goes in the prompt

**Output:** Structured result object:
```typescript
interface ClaudeAgentResult {
  success: boolean;
  result: string;
  cost_usd: number;
  duration_ms: number;
  session_id: string;  // Capture for session continuity
  error?: string;
}
```

**Temporal Configuration:**
- `startToCloseTimeout`: 10 minutes (agent tasks can be lengthy)
- `retry`: `maximumAttempts: 3` for transient CLI failures

**TypeScript Implementation:**

```typescript
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ExecuteClaudeAgentInput {
  instruction: string;
  workingDir: string;
  sessionId?: string;
  continueRecent?: boolean;
  allowedTools?: string[];
  permissionMode?: 'acceptEdits' | 'plan' | 'full';
  systemPromptAppend?: string;
  timeoutMs?: number;
}

interface ClaudeAgentResult {
  success: boolean;
  result: string;
  cost_usd: number;
  duration_ms: number;
  session_id: string;
  error?: string;
  raw_output?: string;
}

export async function executeClaudeAgent(
  input: ExecuteClaudeAgentInput
): Promise<ClaudeAgentResult> {
  const {
    instruction,
    workingDir,
    sessionId,
    continueRecent = false,
    allowedTools = ['Read', 'Write', 'Edit', 'Bash'],
    permissionMode = 'acceptEdits',
    systemPromptAppend,
    timeoutMs = 600000, // 10 minutes
  } = input;

  // Build command arguments
  const args: string[] = [];

  // Session management: resume, continue, or new session
  if (sessionId) {
    args.push('--resume', sessionId);
  } else if (continueRecent) {
    args.push('--continue');
  }

  // Core flags
  args.push('-p', instruction);
  args.push('--output-format', 'json');
  args.push('--permission-mode', permissionMode);
  args.push('--allowedTools', allowedTools.join(','));

  if (systemPromptAppend) {
    args.push('--append-system-prompt', systemPromptAppend);
  }

  // Execute CLI
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('claude', args, {
      cwd: workingDir,
      timeout: timeoutMs,
      env: { ...process.env },
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          result: '',
          cost_usd: 0,
          duration_ms: 0,
          session_id: '',
          error: `CLI exited with code ${code}: ${stderr}`,
          raw_output: stdout,
        });
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve({
          success: true,
          result: parsed.result || '',
          cost_usd: parsed.cost_usd || 0,
          duration_ms: parsed.duration_ms || 0,
          session_id: parsed.session_id || '',  // Capture for next step
        });
      } catch (parseError) {
        resolve({
          success: false,
          result: '',
          cost_usd: 0,
          duration_ms: 0,
          session_id: '',
          error: `Failed to parse JSON output: ${parseError}`,
          raw_output: stdout,
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        result: '',
        cost_usd: 0,
        duration_ms: 0,
        session_id: '',
        error: `Process error: ${err.message}`,
      });
    });
  });
}
```

### 3.2 `runComplianceChecks` Activity

This activity encapsulates the project's quality gates.

**Purpose:** Run a series of verification commands against the generated code.

**Input:** `workingDir` (the project's sandbox).

**Action:**
1. Executes `npm install` (or `npm ci` for clean install).
2. Executes `npm run build`.
3. Executes `npm run lint`.
4. Executes `npm test`.
5. Captures `stdout` and `stderr` for each command.
6. Detects any non-zero exit codes as failures.

**Output:**
```typescript
interface ComplianceResult {
  success: boolean;
  output: string;
  commandsRun: string[];
  failedCommand?: string;
  errorType?: 'NPM_INSTALL' | 'TSC_ERROR' | 'ESLINT_ERROR' | 'JEST_FAILURE';
}
```

**TypeScript Implementation:**

```typescript
import { execSync } from 'child_process';

interface ComplianceResult {
  success: boolean;
  output: string;
  commandsRun: string[];
  failedCommand?: string;
  errorType?: 'NPM_INSTALL' | 'TSC_ERROR' | 'ESLINT_ERROR' | 'JEST_FAILURE';
}

const COMPLIANCE_COMMANDS = [
  { cmd: 'npm install', errorType: 'NPM_INSTALL' as const },
  { cmd: 'npm run build', errorType: 'TSC_ERROR' as const },
  { cmd: 'npm run lint', errorType: 'ESLINT_ERROR' as const },
  { cmd: 'npm test', errorType: 'JEST_FAILURE' as const },
];

export async function runComplianceChecks(
  workingDir: string
): Promise<ComplianceResult> {
  const commandsRun: string[] = [];
  let output = '';

  for (const { cmd, errorType } of COMPLIANCE_COMMANDS) {
    commandsRun.push(cmd);
    try {
      const result = execSync(cmd, {
        cwd: workingDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 300000, // 5 minutes per command
      });
      output += `\n=== ${cmd} ===\n${result}`;
    } catch (error: any) {
      const errorOutput = error.stdout || '' + error.stderr || '';
      output += `\n=== ${cmd} (FAILED) ===\n${errorOutput}`;
      return {
        success: false,
        output,
        commandsRun,
        failedCommand: cmd,
        errorType,
      };
    }
  }

  return {
    success: true,
    output,
    commandsRun,
  };
}
```

### 3.3 `setupWorkspace` Activity

**Purpose:** Create a clean workspace and write static project instructions.

**Input:** 
```typescript
interface SetupWorkspaceInput {
  basePath: string;              // e.g., '/tmp/claude-builds'
  requirementsContent: string;   // BernierLLC requirements (static)
}
```

**Output:** Path to the newly created working directory.

**Key point:** `CLAUDE.md` is written ONCE here with static requirements. It is NOT updated during the workflow.

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

interface SetupWorkspaceInput {
  basePath: string;
  requirementsContent: string;
}

export async function setupWorkspace(input: SetupWorkspaceInput): Promise<string> {
  const { basePath, requirementsContent } = input;
  
  // Create unique workspace
  const workspaceId = randomUUID();
  const workspacePath = path.join(basePath, `build-${workspaceId}`);
  fs.mkdirSync(workspacePath, { recursive: true });
  
  // Write static CLAUDE.md — this is the ONLY time we write it
  const claudeMdContent = `# Project Instructions

${requirementsContent}

---

*These are static project requirements. The package specification and 
step-specific context will be provided in conversation prompts.*
`;
  
  fs.writeFileSync(
    path.join(workspacePath, 'CLAUDE.md'),
    claudeMdContent,
    'utf-8'
  );
  
  return workspacePath;
}
```

### 3.4 `logAuditEntry` Activity

**Purpose:** Record structured audit data for optimization analysis.

**Input:**
```typescript
interface AuditEntry {
  workflow_run_id: string;
  step_name: string;
  timestamp: string;
  prompt_token_count?: number;
  completion_token_count?: number;
  total_token_cost?: number;
  cost_usd: number;
  context_file_hash?: string;
  validation_status: 'pass' | 'fail' | 'N/A';
  validation_error_type?: string;
  error_log_size_chars?: number;
  files_modified?: number;
}
```

**Action:** Appends a JSON line to `audit_trace.jsonl`.

## 4. Workflow Orchestration: `AuditedBuildWorkflow`

### 4.1 Workflow Signature

```typescript
export async function AuditedBuildWorkflow(
  specFileContent: string,
  requirementsFileContent: string
): Promise<{ success: boolean; workspacePath: string; totalCost: number }>;
```

### 4.2 Phases of the Workflow

#### Phase 1: Context and Scaffold (The First Pass)

```
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 1: FIRST PASS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │    Setup     │───▶│ Context Injection│───▶│  Scaffolding │  │
│  │  Workspace   │    │   (CLAUDE.md)    │    │   Activity   │  │
│  └──────────────┘    └──────────────────┘    └──────┬───────┘  │
│                                                      │          │
│                                                      ▼          │
│                                            ┌──────────────────┐ │
│                                            │  Implementation  │ │
│                                            │    Activity      │ │
│                                            └──────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

1. **Setup Workspace:** Calls `setupWorkspace` to create a dedicated working directory.

2. **Context Injection:** Combines `specFileContent` and `requirementsFileContent` into `CLAUDE.md`:

```typescript
const masterContext = `
# STRICT CONSTRAINTS (BernierLLC Package Requirements)

${requirementsFileContent}

---

# PACKAGE SPECIFICATION

${specFileContent}
`;

fs.writeFileSync(path.join(workspacePath, 'CLAUDE.md'), masterContext);
```

3. **Scaffolding:** Calls `executeClaudeAgent` with instruction to create configuration files:

```typescript
await executeClaudeAgent({
  instruction: `Read CLAUDE.md and create all configuration files:
    - package.json (with all required scripts and dependencies)
    - tsconfig.json (strict mode enabled)
    - jest.config.js (coverage thresholds per requirements)
    - .eslintrc.js (strict rules per requirements)
    - README.md (with usage examples)
    
    Create the src/ and __tests__/ directory structure.`,
  workingDir: workspacePath,
  allowedTools: ['Read', 'Write', 'Bash'],
});
```

4. **Implementation:** Calls `executeClaudeAgent` to generate source code:

```typescript
await executeClaudeAgent({
  instruction: `Read CLAUDE.md and implement the full package:
    - All TypeScript source files in src/
    - Comprehensive tests in __tests__/
    - TSDoc comments on all public exports
    - Ensure all strict constraints are met`,
  workingDir: workspacePath,
  allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
});
```

#### Phase 2: The Audited Verification Loop (Greenlight Check)

```
┌─────────────────────────────────────────────────────────────────┐
│                  PHASE 2: VERIFICATION LOOP                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────┐                                         │
│  │ Run Compliance     │◀─────────────────────────┐              │
│  │ Checks             │                          │              │
│  └─────────┬──────────┘                          │              │
│            │                                     │              │
│            ▼                                     │              │
│  ┌────────────────────┐                          │              │
│  │ Log Audit Entry    │                          │              │
│  └─────────┬──────────┘                          │              │
│            │                                     │              │
│            ▼                                     │              │
│       ┌─────────┐                                │              │
│       │ Green?  │──── YES ───▶ Return Success    │              │
│       └────┬────┘                                │              │
│            │ NO                                  │              │
│            ▼                                     │              │
│       ┌─────────┐                                │              │
│       │attempts │──── >= 3 ──▶ Throw Failure     │              │
│       │  < 3?   │                                │              │
│       └────┬────┘                                │              │
│            │ YES                                 │              │
│            ▼                                     │              │
│  ┌────────────────────┐                          │              │
│  │ Execute Fix Agent  │──────────────────────────┘              │
│  │ (targeted prompt)  │                                         │
│  └────────────────────┘                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Workflow Implementation:**

```typescript
import { proxyActivities, ApplicationFailure, workflowInfo } from '@temporalio/workflow';

const MAX_REPAIR_ATTEMPTS = 3;

export async function AuditedBuildWorkflow(
  specFileContent: string,
  requirementsFileContent: string
): Promise<{ success: boolean; workspacePath: string; totalCost: number }> {
  const activities = proxyActivities<typeof activitiesModule>({
    startToCloseTimeout: '10 minutes',
    retry: { maximumAttempts: 3 },
  });

  let totalCost = 0;
  let currentSessionId: string | undefined;

  // ─────────────────────────────────────────────────────────────
  // Phase 1: Setup and First Pass
  // ─────────────────────────────────────────────────────────────

  // Setup workspace with static CLAUDE.md (requirements only)
  const workspacePath = await activities.setupWorkspace({
    basePath: '/tmp/claude-builds',
    requirementsContent: requirementsFileContent,
  });

  // Scaffolding — NEW session, spec provided in prompt
  const scaffoldResult = await activities.executeClaudeAgent({
    instruction: `Create the package structure for the following specification:

${specFileContent}

Generate these files based on the requirements in CLAUDE.md:
- package.json (with all required scripts and dependencies)
- tsconfig.json (strict mode enabled)
- jest.config.js (coverage thresholds per requirements)
- .eslintrc.js (strict rules per requirements)  
- README.md (with usage examples)

Create the src/ and __tests__/ directory structure.`,
    workingDir: workspacePath,
    allowedTools: ['Read', 'Write', 'Bash'],
  });
  
  totalCost += scaffoldResult.cost_usd;
  currentSessionId = scaffoldResult.session_id;  // Capture for continuity

  await activities.logAuditEntry({
    workflow_run_id: workflowInfo().workflowId,
    step_name: 'scaffold',
    timestamp: new Date().toISOString(),
    cost_usd: scaffoldResult.cost_usd,
    session_id: currentSessionId,
    validation_status: 'N/A',
  });

  // Implementation — RESUME session (Claude remembers the spec and what it created)
  const implResult = await activities.executeClaudeAgent({
    instruction: `Now implement the full package based on the specification we discussed.

Create:
- All TypeScript source files in src/
- Comprehensive tests in __tests__/
- TSDoc comments on all public exports

Ensure all requirements from CLAUDE.md are met.`,
    workingDir: workspacePath,
    sessionId: currentSessionId,  // Resume the scaffolding session
    allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
  });
  
  totalCost += implResult.cost_usd;
  currentSessionId = implResult.session_id;  // Update session reference

  await activities.logAuditEntry({
    workflow_run_id: workflowInfo().workflowId,
    step_name: 'implement_v1',
    timestamp: new Date().toISOString(),
    cost_usd: implResult.cost_usd,
    session_id: currentSessionId,
    validation_status: 'N/A',
  });

  // ─────────────────────────────────────────────────────────────
  // Phase 2: Verification Loop
  // ─────────────────────────────────────────────────────────────

  let attempts = 0;
  let isGreen = false;

  while (attempts < MAX_REPAIR_ATTEMPTS && !isGreen) {
    const validation = await activities.runComplianceChecks(workspacePath);

    await activities.logAuditEntry({
      workflow_run_id: workflowInfo().workflowId,
      step_name: attempts === 0 ? 'validation_initial' : `validation_attempt_${attempts}`,
      timestamp: new Date().toISOString(),
      cost_usd: 0,
      validation_status: validation.success ? 'pass' : 'fail',
      validation_error_type: validation.errorType,
      error_log_size_chars: validation.output.length,
    });

    if (validation.success) {
      isGreen = true;
      break;
    }

    attempts++;

    if (attempts >= MAX_REPAIR_ATTEMPTS) {
      break;
    }

    // Repair — RESUME session so Claude remembers what it built and why
    // This helps it make more informed fixes rather than guessing from code alone
    const fixResult = await activities.executeClaudeAgent({
      instruction: `The compliance check failed. Here is the error log:

\`\`\`
${validation.output}
\`\`\`

Fix these issues. You created these files, so you know the intent.
- Make minimal, targeted changes
- Do not regenerate entire files unless necessary
- Address the root cause, not just the symptoms`,
      workingDir: workspacePath,
      sessionId: currentSessionId,  // Resume — Claude remembers context
      allowedTools: ['Read', 'Edit', 'Bash'],  // No Write — only edit existing files
      systemPromptAppend: 'Focus only on fixing the reported errors. Prefer surgical edits over file rewrites.',
    });
    
    totalCost += fixResult.cost_usd;
    currentSessionId = fixResult.session_id;

    await activities.logAuditEntry({
      workflow_run_id: workflowInfo().workflowId,
      step_name: `repair_${attempts}`,
      timestamp: new Date().toISOString(),
      cost_usd: fixResult.cost_usd,
      session_id: currentSessionId,
      validation_status: 'N/A',
    });
  }

  if (!isGreen) {
    throw new ApplicationFailure(
      `Build could not be stabilized after ${MAX_REPAIR_ATTEMPTS} repair attempts. Manual review required.`,
      'BUILD_UNSTABLE',
      true,
      { workspacePath, totalCost, lastSessionId: currentSessionId }
    );
  }

  return { success: true, workspacePath, totalCost };
}
```

**Design Decision: Session Continuity for Repairs**

We resume the same session for repair steps rather than starting fresh. Rationale:

| Approach | Pros | Cons |
|----------|------|------|
| Resume session | Claude remembers intent, can make informed fixes | Session state in CLI infrastructure |
| Fresh session | Clean slate, deterministic | Must infer intent from code alone |

Resuming is preferred because:
1. Claude knows *why* it wrote the code a certain way
2. Can make more targeted fixes with less "exploration"
3. Avoids re-explaining the spec in repair prompts
4. More token-efficient (no redundant context)

## 5. Advanced Patterns

### 5.0 Claude-Specific Enhancements

This section covers Claude Code features that differentiate it from Gemini and can significantly improve the workflow.

#### 5.0.1 Extended Thinking for Architecture Phases

Claude Code supports extended thinking mode, triggered by specific keywords. **Always use extended thinking with Opus for architecture and major refactors** to ensure deep reasoning about architectural constraints.

**Critical Rule:** Architecture planning and cross-file reasoning repairs should use Opus with extended thinking. This prevents Sonnet from under-specifying architectural constraints and ensures long-horizon design consistency.

```typescript
// Architecture planning with extended thinking + Opus (REQUIRED)
const scaffoldResult = await activities.executeClaudeAgent({
  instruction: `THINK HARD about the best architecture for this package:

${specFileContent}

Consider deeply:
- Type safety patterns (generics vs. unions vs. branded types)
- Error handling strategy (Result types vs. exceptions)
- Extensibility points for future features
- Module boundary purity and separation of concerns
- API surface consistency and future-proofing

Then create the package structure based on your analysis.`,
  workingDir: workspacePath,
  model: 'opus',           // REQUIRED: Opus for architectural reasoning
  allowedTools: ['Read', 'Write', 'Bash'],
});
```

**Thinking triggers (increasing budget):**
| Keyword | Thinking Level | Recommended Use |
|---------|---------------|-----------------|
| `think` | Basic extended thinking | Cross-file reasoning repairs |
| `think hard` | More computation | Architecture planning (recommended) |
| `think harder` | Even more | Complex architectural decisions |
| `ultrathink` | Maximum thinking budget | Critical architectural choices |

#### 5.0.2 Custom Subagents for Specialized Tasks

Custom subagents in Claude Code are specialized AI assistants that can be invoked to handle specific types of tasks. They enable more efficient problem-solving by providing task-specific configurations with customized system prompts, tools and a separate context window.

Define specialist agents in `.claude/agents/`:

```yaml
# .claude/agents/code-reviewer.md
---
name: code-reviewer
description: Expert code review specialist for BernierLLC standards.
tools: Read, Grep, Glob
model: sonnet
---

You are a senior code reviewer ensuring BernierLLC quality standards:

When invoked:
1. Run `git diff` to see recent changes
2. Check for:
   - TypeScript strict mode violations
   - Missing TSDoc comments on exports
   - Test coverage gaps
   - ESLint rule violations
3. Return structured feedback with file:line references
```

```yaml
# .claude/agents/test-writer.md
---
name: test-writer
description: Test generation specialist.
tools: Read, Write, Bash
model: sonnet
---

You are a testing expert. Generate comprehensive Jest tests:

- Unit tests for all public functions
- Edge cases and error conditions
- Mock external dependencies appropriately
- Target 80%+ coverage
```

**Using subagents in the workflow:**

```typescript
// After implementation, spawn parallel review agents
const implResult = await activities.executeClaudeAgent({
  instruction: `Implement the package, then spawn these subagents in parallel:
    1. code-reviewer: Review the implementation for quality issues
    2. test-writer: Generate comprehensive tests
    
Wait for both to complete and address any issues they find.`,
  workingDir: workspacePath,
  sessionId: currentSessionId,
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Task'],  // Task enables subagents
});
```

#### 5.0.3 Model Selection by Phase: Claude Model Routing Table

The model field allows you to control which AI model the subagent uses. Use one of the available aliases: `opus`, `sonnet`, or `haiku`.

**Core Principle:** Match model capability to task complexity. This ensures optimal cost-to-value ratio while maintaining quality.

**Claude Model Routing Table:**

| Phase | Model | Extended Thinking? | Rationale |
|-------|-------|---------------------|-----------|
| **Architecture planning** | `opus` | **Yes** (`think hard` or `ultrathink`) | Requires deep reasoning, trade-off analysis, global design consistency, API surface design, module boundary purity, future extensibility. Opus excels at long-horizon reasoning that Sonnet may under-specify. |
| **Major refactors** | `opus` | **Yes** (`think hard`) | Cross-file structural changes require architectural-level reasoning about consistency and extensibility. |
| **Scaffolding** | `sonnet` | No | Structured, deterministic configuration generation. Follows patterns, not deep reasoning. |
| **Implementation** | `sonnet` | No | Code generation sweet spot. Best cost-to-quality ratio for bulk code work. |
| **Test writing** | `sonnet` | No | Comprehensive coverage, edge-case reasoning, and test structure. Sonnet handles test generation excellently. |
| **Code review** | `sonnet` | No | Quality analysis, pattern detection, standards compliance. |
| **Lint/ESLint fixes** | `haiku` | No | Mechanical, pattern-based changes. Fast and cheap for coding standard violations. |
| **TypeScript type fixes** | `haiku` | No | Simple type annotations, interface compliance. Mechanical correctness tasks. |
| **Surface-level repairs** | `sonnet` | No | Single-file fixes, unmet interface contracts, implementation inconsistencies. |
| **Cross-file reasoning repairs** | `opus` | **Yes** (`think`) | When errors suggest design inconsistency: module type misalignments, circular dependencies from architectural shortcuts, test/implementation pattern conflicts. Opus detects true root causes better than Sonnet. |
| **Git operations / PR automation** | `haiku` | No | Command execution and simple string generation. No expensive model required. |

**Decision Rules for Repair Phase:**

```typescript
function selectRepairModel(validation: ComplianceResult): 'opus' | 'sonnet' | 'haiku' {
  // Rule 1: Mechanical fixes → Haiku
  if (validation.errorType === 'ESLINT_ERROR') {
    return 'haiku';
  }
  
  // Rule 2: Cross-file architectural issues → Opus
  const hasCrossFileIssues = 
    validation.output.includes('circular dependency') ||
    validation.output.includes('module type mismatch') ||
    validation.output.includes('design inconsistency') ||
    validation.output.match(/Module .+ no longer aligns with .+ constraints/i);
  
  if (hasCrossFileIssues) {
    return 'opus';
  }
  
  // Rule 3: Single-file type/interface issues → Haiku
  if (validation.errorType === 'TSC_ERROR' && 
      !validation.output.includes('multiple files')) {
    return 'haiku';
  }
  
  // Rule 4: Complex logic/implementation fixes → Sonnet
  return 'sonnet';
}
```

**Extended Thinking Usage:**

Always use extended thinking keywords with Opus for architecture and major refactors:

- `think` - Basic extended thinking
- `think hard` - More computation (recommended for architecture)
- `ultrathink` - Maximum thinking budget (use for complex architectural decisions)

```typescript
// Use --model flag for phase-appropriate model selection
const args: string[] = [
  '-p', instruction,
  '--output-format', 'json',
  '--permission-mode', permissionMode,
  '--model', modelForPhase,  // 'opus', 'sonnet', or 'haiku'
];
```

#### 5.0.4 Plan Mode for Architecture Phase

Turn on Plan Mode during a session using Shift+Tab to cycle through permission modes... Start a new session in Plan Mode using the --permission-mode plan flag.

Use Plan Mode for the architecture phase (no file modifications, just planning):

```typescript
// Phase 0: Architecture planning (no file writes)
// CRITICAL: Always use Opus with extended thinking for architecture
// This ensures deep reasoning about architectural constraints that Sonnet may under-specify
const planResult = await activities.executeClaudeAgent({
  instruction: `ULTRATHINK about the architecture for this package:

${specFileContent}

Create a detailed implementation plan including:
- File structure and module organization
- Type hierarchy and relationships
- Error handling strategy
- Test strategy
- Future extensibility considerations
- Module boundary design

Consider long-horizon implications and global design consistency.
Output your plan as a structured document.`,
  workingDir: workspacePath,
  permissionMode: 'plan',  // Read-only, no file modifications
  model: 'opus',           // Required: Opus for architectural reasoning
  allowedTools: ['Read', 'Grep', 'Glob'],
});

// Capture the plan for subsequent phases
const architecturePlan = planResult.result;
```

#### 5.0.5 Custom Slash Commands for Reusable Workflows

Store reusable prompts in `.claude/commands/`:

```markdown
# .claude/commands/scaffold-package.md
Create the package structure based on CLAUDE.md requirements:

1. Generate package.json with:
   - All required scripts (build, lint, test)
   - Appropriate dependencies
   - Correct metadata

2. Generate tsconfig.json with strict mode

3. Generate jest.config.js with coverage thresholds

4. Generate .eslintrc.js with BernierLLC rules

5. Create src/ and __tests__/ directories

6. Generate initial README.md

$ARGUMENTS
```

```markdown
# .claude/commands/fix-compliance.md
The compliance check failed with these errors:

```
$ARGUMENTS
```

Fix these issues:
1. Identify root causes (not just symptoms)
2. Make minimal, surgical changes
3. Do not regenerate entire files
4. Verify fixes address all reported errors
```

**Using in headless mode:**

```bash
# Scaffold with custom command
claude -p "/scaffold-package" --output-format json --permission-mode acceptEdits

# Fix with error log as argument
claude -p "/fix-compliance $(cat error.log)" --output-format json --permission-mode acceptEdits
```

#### 5.0.6 Git Integration and PR Automation

Claude Code has native Git and GitHub CLI integration. Leverage this for end-to-end automation:

```typescript
// Final phase: Git commit and PR creation
const gitResult = await activities.executeClaudeAgent({
  instruction: `The package is complete and all checks pass.

1. Stage all changes: git add .
2. Create a commit with a descriptive message following conventional commits
3. Push to a new branch: git push -u origin package/${packageName}
4. Create a draft PR using gh cli:
   - Title: "feat: Add ${packageName} package"
   - Body: Include package description and key features
   - Labels: "automated", "needs-review"

Return the PR URL.`,
  workingDir: workspacePath,
  sessionId: currentSessionId,
  allowedTools: ['Bash', 'Read'],
});
```

#### 5.0.7 Hooks for Workflow Integration

Claude Code supports hooks that trigger at specific lifecycle points. Use these for audit logging and notifications:

```json
// .claude/settings.json
{
  "hooks": {
    "afterToolCall": {
      "command": "node scripts/log-tool-call.js",
      "timeout": 5000
    },
    "afterResponse": {
      "command": "node scripts/log-response.js",
      "timeout": 5000
    }
  }
}
```

This enables real-time audit logging without modifying activity code.

### 5.1 Durability Considerations with Sessions

Since we're using Claude's session management, we need to ensure durability in a Temporal context:

**The challenge:** If the workflow crashes between CLI calls, we need to resume the correct session.

**Solution:** Store `session_id` as workflow state (which Temporal automatically persists):

```typescript
// In workflow — session_id is automatically persisted
let currentSessionId: string | undefined;

const result = await activities.executeClaudeAgent({ ... });
currentSessionId = result.session_id;  // Temporal persists this

// If workflow crashes and replays, currentSessionId is restored
const nextResult = await activities.executeClaudeAgent({
  sessionId: currentSessionId,  // Resume correct session
  ...
});
```

**Fallback behavior:** If a session expires or becomes invalid:
1. Activity detects session resume failure
2. Activity can fall back to fresh session with reconstructed context
3. Workflow continues (with logged degradation)

```typescript
// In activity — handle session expiry gracefully
if (sessionId) {
  const result = await tryResumeSession(sessionId, instruction, workingDir);
  if (result.success) return result;
  
  // Session expired — fall back to fresh session with context reconstruction
  console.warn(`Session ${sessionId} expired, starting fresh`);
  return await startFreshSession(instruction, workingDir, { includeFileContext: true });
}
```

### 5.2 Multi-Turn Conversations (Session Continuity)

For complex tasks requiring multiple interactions, Claude Code supports session resumption:

```bash
# First turn - get the session_id from JSON output
result=$(claude -p "Analyze the codebase structure" --output-format json)
session_id=$(echo "$result" | jq -r '.session_id')

# Continue the same session
claude --resume "$session_id" -p "Now implement the types we discussed" \
       --output-format json \
       --permission-mode acceptEdits
```

### 5.3 Git Worktrees for True Parallel Execution

Git worktrees allow you to check out multiple branches from the same repository into separate directories. Each worktree has its own working directory with isolated files, while sharing the same Git history.

This is the most powerful parallelization pattern — run completely independent Claude instances:

```
main-repo/
├── .git/                      # Shared git history
├── CLAUDE.md                  # Shared requirements
└── src/

../build-api-client/           # Worktree 1: Claude instance A
├── src/client/
└── (working on API client)

../build-types/                # Worktree 2: Claude instance B
├── src/types/
└── (working on type definitions)

../build-tests/                # Worktree 3: Claude instance C
├── __tests__/
└── (writing tests)
```

**Workflow integration:**

```typescript
// Activity: Create isolated worktree for parallel execution
export async function createWorktree(
  repoPath: string,
  branchName: string,
  taskName: string
): Promise<string> {
  const worktreePath = path.join(path.dirname(repoPath), `build-${taskName}`);
  
  execSync(`git worktree add ${worktreePath} -b ${branchName}`, {
    cwd: repoPath,
  });
  
  // Copy CLAUDE.md to worktree (shared requirements)
  fs.copyFileSync(
    path.join(repoPath, 'CLAUDE.md'),
    path.join(worktreePath, 'CLAUDE.md')
  );
  
  return worktreePath;
}

// Workflow: Parallel implementation with worktrees
export async function ParallelBuildWorkflow(spec: string, requirements: string) {
  // Create main workspace
  const mainWorkspace = await activities.setupWorkspace({ ... });
  
  // Create worktrees for parallel tasks
  const [clientWorktree, typesWorktree, testsWorktree] = await Promise.all([
    activities.createWorktree(mainWorkspace, 'impl/client', 'client'),
    activities.createWorktree(mainWorkspace, 'impl/types', 'types'),
    activities.createWorktree(mainWorkspace, 'impl/tests', 'tests'),
  ]);
  
  // Run Claude instances in parallel (completely isolated)
  const results = await Promise.all([
    activities.executeClaudeAgent({
      instruction: 'Implement the API client based on the spec in CLAUDE.md',
      workingDir: clientWorktree,
      allowedTools: ['Read', 'Write', 'Edit'],
    }),
    activities.executeClaudeAgent({
      instruction: 'Implement TypeScript types based on the spec in CLAUDE.md',
      workingDir: typesWorktree,
      allowedTools: ['Read', 'Write', 'Edit'],
    }),
    activities.executeClaudeAgent({
      instruction: 'Write comprehensive tests based on the spec in CLAUDE.md',
      workingDir: testsWorktree,
      allowedTools: ['Read', 'Write', 'Edit'],
    }),
  ]);
  
  // Merge worktrees back to main
  for (const worktree of [clientWorktree, typesWorktree, testsWorktree]) {
    execSync(`git add . && git commit -m "Implementation from ${worktree}"`, {
      cwd: worktree,
    });
  }
  
  // Merge branches into main workspace
  execSync('git merge impl/client impl/types impl/tests', {
    cwd: mainWorkspace,
  });
  
  // Clean up worktrees
  execSync(`git worktree remove ${clientWorktree}`, { cwd: mainWorkspace });
  // ... etc
}
```

**Key benefits:**
- True parallelism (separate processes, not subagents)
- Complete context isolation (no cross-contamination)
- Independent failure handling
- Scales to arbitrary number of parallel tasks

### 5.2 Streaming Input for Real-Time Guidance

For scenarios requiring mid-execution guidance:

```bash
echo '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"Build the API client"}]}}' | \
  claude -p --output-format=stream-json --input-format=stream-json --verbose
```

### 5.3 Parallel Execution (Fan-Out)

Spawn multiple Claude instances working on different parts:

```typescript
// In Temporal workflow
const results = await Promise.all([
  activities.executeClaudeAgent({
    instruction: 'Implement the API client in src/client/',
    workingDir: workspacePath,
  }),
  activities.executeClaudeAgent({
    instruction: 'Implement the type definitions in src/types/',
    workingDir: workspacePath,
  }),
  activities.executeClaudeAgent({
    instruction: 'Write integration tests in __tests__/',
    workingDir: workspacePath,
  }),
]);
```

### 5.4 Tool Restrictions by Phase

Control tool access based on workflow phase:

| Phase | Allowed Tools | Rationale |
|-------|---------------|-----------|
| Scaffolding | `Read,Write,Bash` | Can create files, run npm init |
| Implementation | `Read,Write,Edit,Bash` | Full file manipulation |
| Fix/Repair | `Read,Edit` | Only modify existing files |
| Validation | `Read,Bash` | Read-only inspection |

## 6. Key Differences from Gemini CLI

### 6.1 Flag Mapping

| Aspect | Gemini CLI | Claude Code CLI |
|--------|------------|-----------------|
| Headless flag | `--prompt` | `-p` / `--print` |
| Auto-approve | `--yolo` | `--permission-mode acceptEdits` |
| Context file | `--context path` | Auto-reads `CLAUDE.md` from cwd |
| JSON output | `--output-format json` | `--output-format json` |
| Tool control | Implicit | `--allowedTools` (explicit) |
| Session resume | N/A | `--resume <session_id>` |
| System prompt | N/A | `--append-system-prompt` |

### 6.2 Architectural Differences

| Concern | Gemini Pattern | Claude Pattern |
|---------|----------------|----------------|
| **Context injection** | Rewrite `GEMINI.md` each call with full state | Write `CLAUDE.md` once; use sessions for continuity |
| **Conversation memory** | Stateless — file IS the memory | Stateful — CLI maintains session history |
| **Multi-step workflows** | Each step reconstructs context in file | Resume session; context persists automatically |
| **Repair context** | Error log embedded in `GEMINI.md` | Error log in prompt; session provides code context |

### 6.3 Implications for Your Workflow

**Gemini approach (what you had):**
```
Step 1: Write spec + requirements + history to GEMINI.md → Run CLI
Step 2: Read result, update GEMINI.md with new state → Run CLI
Step 3: Read result, add error log to GEMINI.md → Run CLI (repair)
```

**Claude approach (what we're doing):**
```
Setup:  Write requirements to CLAUDE.md (once)
Step 1: Prompt includes spec → Run CLI → Capture session_id
Step 2: Resume session → Run CLI (remembers Step 1)
Step 3: Resume session + error log in prompt → Run CLI (repair)
```

**Benefits of Claude's session model:**
- No file I/O between steps (context managed by CLI)
- More natural conversation flow
- Claude remembers *intent*, not just *output*
- Token-efficient — no redundant context serialization

## 7. Environment Setup

### 7.1 Worker Requirements

- Node.js 18+ installed
- Claude Code CLI installed: `npm install -g @anthropic-ai/claude-code`
- Authenticated: Run `claude` interactively once to complete auth flow
- Temporal worker with sufficient timeouts configured

### 7.2 Authentication

Claude Code uses OAuth-based authentication. For headless workers:

1. Authenticate interactively on the worker machine once
2. Auth tokens are stored in `~/.claude/`
3. Ensure the worker process has access to this directory

Alternatively, for CI/CD environments, use API key authentication:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

## 8. Enhanced Workflow: Leveraging All Claude Features

This enhanced workflow incorporates all the Claude-specific features for maximum efficiency:

```typescript
import { proxyActivities, ApplicationFailure, workflowInfo } from '@temporalio/workflow';

const MAX_REPAIR_ATTEMPTS = 3;

interface EnhancedBuildConfig {
  specFileContent: string;
  requirementsFileContent: string;
  useParallelWorktrees?: boolean;  // Enable git worktree parallelization
  useSubagents?: boolean;          // Enable internal subagent parallelization
  thinkingLevel?: 'think' | 'think hard' | 'ultrathink';
}

export async function EnhancedAuditedBuildWorkflow(
  config: EnhancedBuildConfig
): Promise<{ success: boolean; workspacePath: string; totalCost: number; prUrl?: string }> {
  const {
    specFileContent,
    requirementsFileContent,
    useParallelWorktrees = false,
    useSubagents = true,
    thinkingLevel = 'think hard',
  } = config;

  const activities = proxyActivities<typeof activitiesModule>({
    startToCloseTimeout: '15 minutes',
    retry: { maximumAttempts: 3 },
  });

  let totalCost = 0;
  let currentSessionId: string | undefined;

  // ─────────────────────────────────────────────────────────────
  // Phase 0: Architecture Planning (Plan Mode + Extended Thinking)
  // ─────────────────────────────────────────────────────────────

  const workspacePath = await activities.setupWorkspace({
    basePath: '/tmp/claude-builds',
    requirementsContent: requirementsFileContent,
  });

  // Use Plan Mode + extended thinking for architecture
  // CRITICAL: Always use Opus with extended thinking for architecture
  // This ensures deep reasoning about architectural constraints that Sonnet may under-specify
  const planResult = await activities.executeClaudeAgent({
    instruction: `${thinkingLevel.toUpperCase()} about the best architecture for this package:

${specFileContent}

Analyze deeply:
1. Type design patterns (generics vs branded types vs unions)
2. Error handling strategy (Result types, custom errors, validation)
3. Module organization and dependency flow
4. Testing strategy (unit vs integration, mocking approach)
5. API surface design (exports, naming conventions)
6. Future extensibility and maintainability
7. Module boundary purity and separation of concerns

Consider long-horizon implications and global design consistency.
Output a structured architecture document that will guide implementation.
Do NOT create any files yet — just plan.`,
    workingDir: workspacePath,
    permissionMode: 'plan',  // Read-only planning phase
    model: 'opus',           // Use Opus for complex reasoning (required for architecture)
    allowedTools: ['Read', 'Grep', 'Glob'],
  });

  totalCost += planResult.cost_usd;
  const architecturePlan = planResult.result;

  await activities.logAuditEntry({
    workflow_run_id: workflowInfo().workflowId,
    step_name: 'architecture_planning',
    timestamp: new Date().toISOString(),
    cost_usd: planResult.cost_usd,
    model_used: 'opus',
    validation_status: 'N/A',
  });

  // ─────────────────────────────────────────────────────────────
  // Phase 1: Scaffolding (New Session with Architecture Context)
  // ─────────────────────────────────────────────────────────────

  const scaffoldResult = await activities.executeClaudeAgent({
    instruction: `Based on this architecture plan:

${architecturePlan}

Create the package scaffolding:
- package.json with all required scripts and dependencies
- tsconfig.json with strict mode per CLAUDE.md requirements
- jest.config.js with coverage thresholds
- .eslintrc.js with BernierLLC rules
- README.md with usage examples
- Directory structure (src/, __tests__/)

Follow the architecture plan exactly.`,
    workingDir: workspacePath,
    model: 'sonnet',
    allowedTools: ['Read', 'Write', 'Bash'],
  });

  totalCost += scaffoldResult.cost_usd;
  currentSessionId = scaffoldResult.session_id;

  // ─────────────────────────────────────────────────────────────
  // Phase 2: Implementation (with optional parallelization)
  // ─────────────────────────────────────────────────────────────

  if (useParallelWorktrees) {
    // Git worktree parallelization for large packages
    const implResults = await activities.parallelWorktreeImplementation({
      mainWorkspace: workspacePath,
      architecturePlan,
      tasks: [
        { name: 'types', instruction: 'Implement all TypeScript types in src/types/' },
        { name: 'core', instruction: 'Implement core logic in src/core/' },
        { name: 'client', instruction: 'Implement API client in src/client/' },
        { name: 'tests', instruction: 'Write comprehensive tests in __tests__/' },
      ],
    });
    totalCost += implResults.reduce((sum, r) => sum + r.cost_usd, 0);

  } else if (useSubagents) {
    // Subagent parallelization (single session, internal parallelism)
    const implResult = await activities.executeClaudeAgent({
      instruction: `Implement the package based on the architecture plan.

Use subagents to parallelize:
1. Spawn a subagent to implement types (src/types/)
2. Spawn a subagent to implement core logic (src/core/)  
3. Spawn a subagent to write tests (__tests__/)

Wait for all subagents to complete, then:
4. Spawn a code-reviewer subagent to review all implementations
5. Address any issues found

Ensure all code follows CLAUDE.md requirements.`,
      workingDir: workspacePath,
      sessionId: currentSessionId,
      model: 'sonnet',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Task'],  // Task enables subagents
    });

    totalCost += implResult.cost_usd;
    currentSessionId = implResult.session_id;

  } else {
    // Sequential implementation (simplest)
    const implResult = await activities.executeClaudeAgent({
      instruction: `Implement the full package based on the architecture plan.
Create all source files in src/ and tests in __tests__/.`,
      workingDir: workspacePath,
      sessionId: currentSessionId,
      model: 'sonnet',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
    });

    totalCost += implResult.cost_usd;
    currentSessionId = implResult.session_id;
  }

  // ─────────────────────────────────────────────────────────────
  // Phase 3: Verification Loop (with model-appropriate repairs)
  // ─────────────────────────────────────────────────────────────

  let attempts = 0;
  let isGreen = false;

  while (attempts < MAX_REPAIR_ATTEMPTS && !isGreen) {
    const validation = await activities.runComplianceChecks(workspacePath);

    await activities.logAuditEntry({
      workflow_run_id: workflowInfo().workflowId,
      step_name: attempts === 0 ? 'validation_initial' : `validation_attempt_${attempts}`,
      timestamp: new Date().toISOString(),
      cost_usd: 0,
      validation_status: validation.success ? 'pass' : 'fail',
      validation_error_type: validation.errorType,
      error_log_size_chars: validation.output.length,
    });

    if (validation.success) {
      isGreen = true;
      break;
    }

    attempts++;

    if (attempts >= MAX_REPAIR_ATTEMPTS) {
      break;
    }

    // Model selection based on error type and complexity
    let repairModel: 'opus' | 'sonnet' | 'haiku';
    let thinkingKeyword = '';
    
    // Rule 1: Mechanical lint/ESLint fixes → Haiku
    if (validation.errorType === 'ESLINT_ERROR') {
      repairModel = 'haiku';
    }
    // Rule 2: Cross-file architectural issues → Opus with thinking
    else if (
      validation.output.includes('circular dependency') ||
      validation.output.includes('module type mismatch') ||
      validation.output.includes('design inconsistency') ||
      /Module .+ no longer aligns with .+ constraints/i.test(validation.output)
    ) {
      repairModel = 'opus';
      thinkingKeyword = 'THINK HARD';  // Extended thinking for root-cause analysis
    }
    // Rule 3: Single-file TypeScript type fixes → Haiku
    else if (
      validation.errorType === 'TSC_ERROR' && 
      !validation.output.includes('multiple files')
    ) {
      repairModel = 'haiku';
    }
    // Rule 4: Complex logic/implementation fixes → Sonnet
    else {
      repairModel = 'sonnet';
    }

    const fixPrompt = thinkingKeyword 
      ? `${thinkingKeyword} about the root cause of these errors:

\`\`\`
${validation.output}
\`\`\`

Analyze the architectural or design issues causing these failures.
Fix with minimal, surgical changes addressing the root cause.
Do not regenerate entire files.`
      : `The compliance check failed:

\`\`\`
${validation.output}
\`\`\`

Fix these issues with minimal, surgical changes.
Do not regenerate entire files.`;

    const fixResult = await activities.executeClaudeAgent({
      instruction: fixPrompt,
      workingDir: workspacePath,
      sessionId: currentSessionId,
      model: repairModel,  // Cost-appropriate model for repair type
      allowedTools: ['Read', 'Edit', 'Bash'],
    });

    totalCost += fixResult.cost_usd;
    currentSessionId = fixResult.session_id;

    await activities.logAuditEntry({
      workflow_run_id: workflowInfo().workflowId,
      step_name: `repair_${attempts}`,
      timestamp: new Date().toISOString(),
      cost_usd: fixResult.cost_usd,
      model_used: repairModel,
      validation_status: 'N/A',
    });
  }

  if (!isGreen) {
    throw new ApplicationFailure(
      `Build could not be stabilized after ${MAX_REPAIR_ATTEMPTS} attempts.`,
      'BUILD_UNSTABLE',
      true,
      { workspacePath, totalCost, lastSessionId: currentSessionId }
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Phase 4: Git Commit and PR Creation
  // ─────────────────────────────────────────────────────────────

  const gitResult = await activities.executeClaudeAgent({
    instruction: `The package is complete and all checks pass.

1. Stage all changes
2. Create a commit with conventional commit message
3. Push to a new branch
4. Create a draft PR using gh cli with appropriate labels

Return the PR URL.`,
    workingDir: workspacePath,
    sessionId: currentSessionId,
    model: 'haiku',  // Simple git operations
    allowedTools: ['Bash', 'Read'],
  });

  totalCost += gitResult.cost_usd;

  // Extract PR URL from result
  const prUrlMatch = gitResult.result.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
  const prUrl = prUrlMatch ? prUrlMatch[0] : undefined;

  return { success: true, workspacePath, totalCost, prUrl };
}
```

**Cost optimization summary:**

| Phase | Model | Extended Thinking? | Rationale |
|-------|-------|---------------------|-----------|
| Architecture | Opus | Yes (`think hard`/`ultrathink`) | Complex reasoning, trade-off analysis, global design consistency. Opus prevents under-specification of architectural constraints. |
| Major refactors | Opus | Yes (`think hard`) | Cross-file structural changes require architectural-level reasoning. |
| Scaffolding | Sonnet | No | Standard configuration generation. Predictable, pattern-based. |
| Implementation | Sonnet | No | Code generation sweet spot. Best cost-to-quality ratio. |
| Test writing | Sonnet | No | Comprehensive coverage and edge-case reasoning. |
| Lint/ESLint fixes | Haiku | No | Simple, mechanical, pattern-based changes. Fast and cheap. |
| Single-file type fixes | Haiku | No | Simple type annotations, interface compliance. |
| Surface-level repairs | Sonnet | No | Single-file fixes, implementation inconsistencies. |
| Cross-file reasoning repairs | Opus | Yes (`think`) | Design inconsistencies, module misalignments, architectural root causes. |
| Git operations | Haiku | No | Simple command execution. |

## 9. Next Steps / Implementation Tasks

### Phase 1: Foundation
1. **Define `PACKAGE_REQUIREMENTS.md`**: Create BernierLLC minimum package requirements document.
2. **Implement core activities**: `executeClaudeAgent`, `runComplianceChecks`, `setupWorkspace`, `logAuditEntry`.
3. **Implement basic `AuditedBuildWorkflow`**: Session-based workflow without advanced features.
4. **Testing**: Unit tests for activities, integration tests for basic workflow.

### Phase 2: Claude-Specific Enhancements
5. **Add model selection**: Implement `--model` flag support in `executeClaudeAgent`.
6. **Add Plan Mode support**: Implement `--permission-mode plan` for architecture phase.
7. **Create custom subagents**: Define `code-reviewer.md`, `test-writer.md` in `.claude/agents/`.
8. **Create custom commands**: Define `/scaffold-package.md`, `/fix-compliance.md` in `.claude/commands/`.

### Phase 3: Parallelization
9. **Implement worktree support**: Add `createWorktree`, `mergeWorktrees`, `cleanupWorktrees` activities.
10. **Implement `ParallelBuildWorkflow`**: Git worktree-based parallel execution.
11. **Test parallel execution**: Verify isolation and merge behavior.

### Phase 4: Integration
12. **Git/GitHub automation**: Add PR creation activity using `gh` CLI.
13. **Hooks integration**: Configure `.claude/settings.json` hooks for audit logging.
14. **Optimization dashboard**: Build tooling to analyze `audit_trace.jsonl`.

### Phase 5: Optimization
15. **A/B test model selection**: Compare Opus vs Sonnet for architecture phase.
16. **Tune thinking levels**: Find optimal thinking budget per phase.
17. **Optimize subagent usage**: Measure parallel vs sequential cost/time tradeoffs.

## 10. Summary: Claude vs Gemini Feature Comparison

| Feature | Gemini CLI | Claude Code | Advantage |
|---------|------------|-------------|-----------|
| Headless mode | `--prompt` | `-p` | Equivalent |
| Auto-approve | `--yolo` | `--permission-mode acceptEdits` | Claude: more granular |
| Context file | `--context` (explicit) | `CLAUDE.md` (auto-read) | Claude: simpler |
| JSON output | `--output-format json` | `--output-format json` | Equivalent |
| **Session management** | ❌ None | ✅ `--resume`, `--continue` | **Claude: major advantage** |
| **Model selection** | ❌ None | ✅ `--model opus/sonnet/haiku` | **Claude: cost optimization** |
| **Extended thinking** | ❌ None | ✅ `think`, `ultrathink` keywords | **Claude: better reasoning** |
| **Plan mode** | ❌ None | ✅ `--permission-mode plan` | **Claude: safer architecture** |
| **Custom subagents** | ❌ None | ✅ `.claude/agents/` | **Claude: built-in parallelism** |
| **Custom commands** | ❌ None | ✅ `.claude/commands/` | **Claude: reusable prompts** |
| **Hooks** | ❌ None | ✅ `.claude/settings.json` | **Claude: lifecycle events** |
| Tool control | Implicit | `--allowedTools` | Claude: explicit safety |
| System prompt | ❌ None | `--append-system-prompt` | Claude: per-call tuning |

**Bottom line:** Claude Code provides significantly more orchestration capabilities than Gemini CLI. The session management alone eliminates the need for file-based context serialization, and the model selection enables cost optimization that isn't possible with Gemini.

## 11. Benefits of This Architecture

| Benefit | Description |
|---------|-------------|
| **Durability** | Temporal ensures workflow resumes from last completed activity on crashes |
| **Token Efficiency** | Session management eliminates redundant context; targeted repair prompts |
| **Cost Optimization** | Model selection (Opus/Sonnet/Haiku) matches capability to task complexity |
| **Constraint-Driven** | Requirements in `CLAUDE.md` force quality upfront |
| **Auditable** | Every step logged with costs, models, and outcomes for optimization |
| **Tool Safety** | Explicit `--allowedTools` prevents unintended operations |
| **Parallelizable** | Subagents + Git worktrees enable concurrent code generation |
| **Extensible** | Custom agents and commands enable reusable, specialized workflows |

## 12. Recommended Implementation Order

```
Week 1: Foundation
├── Basic executeClaudeAgent with session support
├── runComplianceChecks activity
├── Basic AuditedBuildWorkflow
└── Manual testing

Week 2: Model & Mode Optimization
├── Add --model flag support
├── Add Plan Mode for architecture
├── Extended thinking integration
└── Cost tracking in audit log

Week 3: Parallelization
├── Custom subagent definitions
├── Subagent-based parallel implementation
├── Git worktree activities
└── Parallel workflow variant

Week 4: Polish & Integration
├── Custom slash commands
├── Git/PR automation
├── Hooks for real-time logging
└── Optimization dashboard
```

This plan leverages Claude Code's unique capabilities to build a more efficient, cost-effective, and observable package generation system than would be possible with Gemini CLI alone.
