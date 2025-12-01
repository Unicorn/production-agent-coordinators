/**
 * Claude CLI Activities for Temporal Workflows
 *
 * These activities wrap the Claude Code CLI for headless execution within Temporal workflows.
 * Key differences from Gemini CLI activities:
 * - Session management via `--resume <session_id>` for conversation continuity
 * - Model selection via `--model` for cost optimization (opus/sonnet/haiku)
 * - Static CLAUDE.md (written once at setup, not rewritten per step)
 * - Extended thinking triggers for architectural reasoning
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';
export type PermissionMode = 'acceptEdits' | 'plan' | 'full';

export interface ExecuteClaudeAgentInput {
  /** The instruction/prompt to send to Claude */
  instruction: string;
  /** Working directory for CLI execution */
  workingDir: string;

  // Session management (choose one or neither for new session)
  /** Resume a specific session by ID */
  sessionId?: string;
  /** Continue the most recent session */
  continueRecent?: boolean;

  // Tool control
  /** Tools the agent is allowed to use (default: Read, Write, Edit, Bash) */
  allowedTools?: string[];
  /** Permission mode for tool execution (default: acceptEdits) */
  permissionMode?: PermissionMode;

  // Model selection
  /** Which Claude model to use (default: sonnet) */
  model?: ClaudeModel;

  // Optional enhancements
  /** Additional system prompt to append */
  systemPromptAppend?: string;
  /** Timeout in milliseconds (default: 600000 = 10 minutes) */
  timeoutMs?: number;
}

export interface ClaudeAgentResult {
  success: boolean;
  result: string;
  cost_usd: number;
  duration_ms: number;
  /** Session ID to use for `--resume` in subsequent calls */
  session_id: string;
  /** Number of conversation turns */
  num_turns?: number;
  error?: string;
  raw_output?: string;
}

export interface SetupClaudeWorkspaceInput {
  /** Base path where workspace directories are created */
  basePath: string;
  /** Static requirements content for CLAUDE.md */
  requirementsContent: string;
}

export interface ClaudeComplianceResult {
  success: boolean;
  output: string;
  commandsRun: string[];
  failedCommand?: string;
  errorType?: 'NPM_INSTALL' | 'TSC_ERROR' | 'ESLINT_ERROR' | 'JEST_FAILURE';
}

export interface ClaudeAuditEntry {
  workflow_run_id: string;
  step_name: string;
  timestamp: string;
  cost_usd: number;
  session_id?: string;
  model?: ClaudeModel;
  validation_status: 'pass' | 'fail' | 'N/A';
  validation_error_type?: string;
  error_log_size_chars?: number;
  duration_ms?: number;
  num_turns?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Activities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute the Claude Code CLI in headless mode.
 *
 * Key differences from Gemini activity:
 * - Uses `--resume <session_id>` for conversation continuity (vs. rewriting context file)
 * - Uses `--model` for cost-optimized model selection
 * - Captures session_id from output for subsequent calls
 */
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
    model = 'sonnet',
    systemPromptAppend,
    timeoutMs = 600000, // 10 minutes
  } = input;

  console.log(`[ClaudeActivity] Executing Claude CLI in ${workingDir}`);
  console.log(`[ClaudeActivity] Model: ${model}, Permission: ${permissionMode}`);
  console.log(`[ClaudeActivity] Instruction: ${instruction.substring(0, 100)}...`);

  // Build command arguments
  // IMPORTANT: Claude CLI uses -p/--print as a FLAG for non-interactive mode
  // The prompt is passed as a POSITIONAL argument at the end
  const args: string[] = [];

  // Session management: resume, continue, or new session
  if (sessionId) {
    args.push('--resume', sessionId);
    console.log(`[ClaudeActivity] Resuming session: ${sessionId}`);
  } else if (continueRecent) {
    args.push('--continue');
    console.log(`[ClaudeActivity] Continuing most recent session`);
  }

  // Core flags
  args.push('--print'); // -p/--print is a FLAG for non-interactive mode
  args.push('--output-format', 'json');
  args.push('--permission-mode', permissionMode);
  args.push('--allowedTools', allowedTools.join(','));
  args.push('--model', model);

  if (systemPromptAppend) {
    args.push('--append-system-prompt', systemPromptAppend);
  }

  // Prompt goes LAST as a positional argument
  args.push(instruction);

  // Execute CLI
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const startTime = Date.now();

    const proc = spawn('claude', args, {
      cwd: workingDir,
      timeout: timeoutMs,
      env: { ...process.env },
    });

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number | null) => {
      const duration = Date.now() - startTime;

      if (code !== 0) {
        console.error(`[ClaudeActivity] CLI exited with code ${code}`);
        console.error(`[ClaudeActivity] stderr: ${stderr.substring(0, 500)}`);
        resolve({
          success: false,
          result: '',
          cost_usd: 0,
          duration_ms: duration,
          session_id: '',
          error: `CLI exited with code ${code}: ${stderr}`,
          raw_output: stdout,
        });
        return;
      }

      try {
        // Parse JSON output from Claude CLI
        const parsed = JSON.parse(stdout);
        console.log(`[ClaudeActivity] Success - Cost: $${parsed.cost_usd || 0}, Duration: ${parsed.duration_ms || duration}ms`);

        resolve({
          success: true,
          result: parsed.result || '',
          cost_usd: parsed.cost_usd || 0,
          duration_ms: parsed.duration_ms || duration,
          session_id: parsed.session_id || '', // Capture for next step
          num_turns: parsed.num_turns,
        });
      } catch (parseError) {
        console.warn(`[ClaudeActivity] Failed to parse JSON output`);
        console.warn(`[ClaudeActivity] Raw output: ${stdout.substring(0, 500)}...`);

        // Try to extract session_id even if full parse fails
        const sessionMatch = stdout.match(/"session_id"\s*:\s*"([^"]+)"/);

        resolve({
          success: false,
          result: '',
          cost_usd: 0,
          duration_ms: duration,
          session_id: sessionMatch?.[1] || '',
          error: `Failed to parse JSON output: ${parseError}`,
          raw_output: stdout,
        });
      }
    });

    proc.on('error', (err: Error) => {
      console.error(`[ClaudeActivity] Process error: ${err.message}`);
      resolve({
        success: false,
        result: '',
        cost_usd: 0,
        duration_ms: Date.now() - startTime,
        session_id: '',
        error: `Process error: ${err.message}`,
      });
    });
  });
}

/**
 * Set up a clean workspace with static CLAUDE.md and .claude configuration.
 *
 * Key difference from Gemini:
 * - CLAUDE.md is written ONCE here with static requirements
 * - NOT updated during the workflow (session management handles continuity)
 * - Copies .claude directory with subagents and commands for Claude CLI
 */
export async function setupClaudeWorkspace(
  input: SetupClaudeWorkspaceInput
): Promise<string> {
  const { basePath, requirementsContent } = input;

  // Create unique workspace
  const workspaceId = randomUUID();
  const workspacePath = path.join(basePath, `claude-build-${workspaceId}`);
  await fs.mkdir(workspacePath, { recursive: true });

  console.log(`[ClaudeActivity] Created workspace: ${workspacePath}`);

  // Write static CLAUDE.md - this is the ONLY time we write it
  const claudeMdContent = `# Project Instructions

${requirementsContent}

---

*These are static project requirements. The package specification and
step-specific context will be provided in conversation prompts.*
`;

  await fs.writeFile(
    path.join(workspacePath, 'CLAUDE.md'),
    claudeMdContent,
    'utf-8'
  );

  console.log(`[ClaudeActivity] Wrote CLAUDE.md to ${workspacePath}`);

  // Copy .claude directory with subagents and commands
  // Source: packages/agents/package-builder-production/.claude
  // Target: workspace/.claude
  try {
    const sourceClaudeDir = path.resolve(
      __dirname,
      '../../agents/package-builder-production/.claude'
    );
    const targetClaudeDir = path.join(workspacePath, '.claude');

    // Check if source directory exists
    try {
      await fs.access(sourceClaudeDir);
      
      // Copy directory recursively
      await copyDirectory(sourceClaudeDir, targetClaudeDir);
      console.log(`[ClaudeActivity] Copied .claude directory to ${targetClaudeDir}`);
      
      // Ensure scripts directory exists and is executable
      const scriptsDir = path.join(targetClaudeDir, 'scripts');
      try {
        await fs.access(scriptsDir);
        // Make scripts executable
        const scriptFiles = await fs.readdir(scriptsDir);
        for (const file of scriptFiles) {
          if (file.endsWith('.js')) {
            const scriptPath = path.join(scriptsDir, file);
            try {
              await fs.chmod(scriptPath, 0o755); // Make executable
            } catch {
              // chmod may fail on Windows, that's okay
            }
          }
        }
      } catch {
        // Scripts directory doesn't exist, create it
        await fs.mkdir(scriptsDir, { recursive: true });
        console.log(`[ClaudeActivity] Created scripts directory`);
      }
      
      // Ensure settings.json exists (create default if missing)
      const settingsPath = path.join(targetClaudeDir, 'settings.json');
      try {
        await fs.access(settingsPath);
      } catch {
        // Create default settings.json if it doesn't exist
        const defaultSettings = {
          hooks: {
            afterToolCall: {
              command: "node scripts/log-tool-call.js",
              timeout: 5000
            },
            afterResponse: {
              command: "node scripts/log-response.js",
              timeout: 5000
            }
          },
          defaultModel: "sonnet",
          defaultPermissionMode: "acceptEdits"
        };
        await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
        console.log(`[ClaudeActivity] Created default settings.json`);
      }
    } catch (error) {
      console.warn(
        `[ClaudeActivity] Source .claude directory not found at ${sourceClaudeDir}, skipping copy`
      );
    }
  } catch (error) {
    console.warn(
      `[ClaudeActivity] Failed to copy .claude directory: ${error instanceof Error ? error.message : String(error)}`
    );
    // Non-fatal: workspace will still work without .claude files
  }

  return workspacePath;
}

/**
 * Recursively copy a directory
 */
async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });

  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

/**
 * Run compliance checks against the workspace.
 * Same as Gemini version - runs npm install, build, lint, test.
 */
export async function runClaudeComplianceChecks(
  workingDir: string
): Promise<ClaudeComplianceResult> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execPromise = promisify(exec);

  console.log(`[ClaudeActivity] Running compliance checks in: ${workingDir}`);

  const COMPLIANCE_COMMANDS = [
    { cmd: 'npm install', errorType: 'NPM_INSTALL' as const },
    { cmd: 'npm run build', errorType: 'TSC_ERROR' as const },
    { cmd: 'npm run lint', errorType: 'ESLINT_ERROR' as const },
    { cmd: 'npm test', errorType: 'JEST_FAILURE' as const },
  ];

  const commandsRun: string[] = [];
  let output = '';

  for (const { cmd, errorType } of COMPLIANCE_COMMANDS) {
    commandsRun.push(cmd);
    console.log(`[ClaudeActivity] Executing: ${cmd}`);

    try {
      const { stdout, stderr } = await execPromise(cmd, {
        cwd: workingDir,
        timeout: 300000, // 5 minutes per command
      });
      output += `\n=== ${cmd} ===\n${stdout}`;
      if (stderr) {
        output += `\nSTDERR:\n${stderr}`;
      }
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; message?: string };
      const errorOutput = (execError.stdout || '') + (execError.stderr || execError.message || '');
      output += `\n=== ${cmd} (FAILED) ===\n${errorOutput}`;

      console.error(`[ClaudeActivity] Compliance check failed: ${cmd}`);

      return {
        success: false,
        output,
        commandsRun,
        failedCommand: cmd,
        errorType,
      };
    }
  }

  console.log(`[ClaudeActivity] All compliance checks passed`);

  return {
    success: true,
    output,
    commandsRun,
  };
}

/**
 * Log an audit entry to audit_trace.jsonl.
 */
export async function logClaudeAuditEntry(
  workingDir: string,
  entry: ClaudeAuditEntry
): Promise<void> {
  const logPath = path.join(workingDir, 'audit_trace.jsonl');
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
  await fs.appendFile(logPath, line);

  console.log(`[ClaudeActivity] Logged audit entry: ${entry.step_name}`);
}

/**
 * Select the appropriate model based on error type.
 *
 * Model selection rules:
 * - Haiku: Mechanical fixes (lint errors, simple type fixes)
 * - Opus: Cross-file architectural issues
 * - Sonnet: Everything else (default, best cost-to-quality)
 */
export function selectRepairModel(validation: ClaudeComplianceResult): ClaudeModel {
  // Rule 1: Mechanical fixes -> Haiku
  if (validation.errorType === 'ESLINT_ERROR') {
    return 'haiku';
  }

  // Rule 2: Cross-file architectural issues -> Opus
  const hasCrossFileIssues =
    validation.output.includes('circular dependency') ||
    validation.output.includes('module type mismatch') ||
    validation.output.includes('design inconsistency') ||
    /Module .+ no longer aligns with .+ constraints/i.test(validation.output);

  if (hasCrossFileIssues) {
    return 'opus';
  }

  // Rule 3: Single-file type/interface issues -> Haiku
  if (validation.errorType === 'TSC_ERROR' &&
      !validation.output.includes('multiple files')) {
    return 'haiku';
  }

  // Rule 4: Complex logic/implementation fixes -> Sonnet
  return 'sonnet';
}
