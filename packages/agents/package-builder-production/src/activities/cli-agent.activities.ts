/**
 * CLI Agent Activities - Unified Interface for Gemini and Claude CLIs
 *
 * This module provides a unified abstraction over Gemini CLI and Claude Code CLI,
 * allowing workflows to use either provider without knowing the implementation details.
 *
 * Key Features:
 * - Provider abstraction (Gemini/Claude)
 * - Automatic fallback on errors
 * - Credit/rate limit checking
 * - Unified result format
 */

import type { GeminiAgentInput } from '@coordinator/temporal-coordinator/activities';
import type { ExecuteClaudeAgentInput, ClaudeModel } from '@coordinator/temporal-coordinator/claude-activities';
import { selectClaudeModel, buildClaudeInstruction, type ModelSelection } from './model-selector.js';

// ─────────────────────────────────────────────────────────────────────────────
// Unified Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supported CLI providers
 */
export type CLIProviderName = 'gemini' | 'claude';

/**
 * Task type for provider selection
 */
export type BuildTask = 'scaffold' | 'implement' | 'fix' | 'test' | 'document';

/**
 * Credit status for provider selection
 */
export interface CreditStatus {
  gemini: {
    available: boolean;
    creditsRemaining?: number;
    rateLimited: boolean;
  };
  claude: {
    available: boolean;
    creditsRemaining?: number;
    rateLimited: boolean;
  };
}

/**
 * Unified parameters for CLI agent execution
 */
export interface CLIAgentParams {
  /** The instruction/prompt to send to the agent */
  instruction: string;
  /** Working directory for CLI execution */
  workingDir: string;
  /** Context content (for Gemini: GEMINI.md content, for Claude: prompt context) */
  contextContent?: string;
  /** Session ID (for Claude: resume session, for Gemini: not used) */
  sessionId?: string;
  /** Model selection (for Claude: opus/sonnet/haiku, for Gemini: not used) */
  model?: string;
  /** Allowed tools (for Claude only) */
  allowedTools?: string[];
  /** Permission mode (for Claude only) */
  permissionMode?: string;
  /** Task type for provider selection */
  task?: BuildTask;
}

/**
 * Unified result from CLI agent execution
 */
export interface CLIAgentResult {
  success: boolean;
  result: string;
  cost_usd: number;
  duration_ms: number;
  /** Session ID (for Claude: use in next call, for Gemini: empty) */
  session_id?: string;
  /** Provider used */
  provider: CLIProviderName;
  /** Error if execution failed */
  error?: string;
  /** Raw output if JSON parsing failed */
  raw_output?: string;
}

/**
 * Workspace setup parameters
 */
export interface WorkspaceSetupParams {
  basePath: string;
  requirementsContent: string;
  provider?: CLIProviderName;
}

/**
 * Compliance check result
 */
export interface ComplianceResult {
  success: boolean;
  output: string;
  commandsRun: string[];
  failedCommand?: string;
  errorType?: 'NPM_INSTALL' | 'TSC_ERROR' | 'ESLINT_ERROR' | 'JEST_FAILURE';
}

/**
 * Audit entry for optimization tracking
 */
export interface AuditEntry {
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
  provider?: CLIProviderName;
  model?: string;
  session_id?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abstract interface for CLI providers
 */
export interface CLIAgentProvider {
  name: CLIProviderName;
  
  /**
   * Execute the CLI agent with given parameters
   */
  executeAgent(params: CLIAgentParams): Promise<CLIAgentResult>;
  
  /**
   * Set up a workspace for the provider
   */
  setupWorkspace(params: WorkspaceSetupParams): Promise<string>;
  
  /**
   * Run compliance checks on the workspace
   */
  runComplianceChecks(workingDir: string): Promise<ComplianceResult>;
  
  /**
   * Log an audit entry
   */
  logAuditEntry(workingDir: string, entry: AuditEntry): Promise<void>;
  
  /**
   * Check if provider is available (credits, rate limits, etc.)
   */
  checkAvailability(): Promise<{ available: boolean; reason?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Implementations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gemini CLI Provider
 * Wraps the existing Gemini CLI activities from temporal-coordinator
 */
export class GeminiCLIProvider implements CLIAgentProvider {
  name: CLIProviderName = 'gemini';
  
  // Import activities dynamically to avoid circular dependencies
  private async getGeminiActivities() {
    const { executeGeminiAgent, setupWorkspace, runComplianceChecks, logAuditEntry } = 
      await import('@coordinator/temporal-coordinator/activities');
    return { executeGeminiAgent, setupWorkspace, runComplianceChecks, logAuditEntry };
  }
  
  async executeAgent(params: CLIAgentParams): Promise<CLIAgentResult> {
    const { executeGeminiAgent } = await this.getGeminiActivities();
    
    const geminiInput: GeminiAgentInput = {
      instruction: params.instruction,
      workingDir: params.workingDir,
      contextContent: params.contextContent,
    };
    
    try {
      const result = await executeGeminiAgent(geminiInput);
      
      // Convert Gemini result to unified format
      return {
        success: result.success,
        result: result.agentResponse?.result || result.rawOutput || '',
        cost_usd: result.agentResponse?.cost_usd || 0, // Gemini CLI may not provide this
        duration_ms: result.agentResponse?.duration_ms || 0,
        session_id: undefined, // Gemini doesn't use sessions
        provider: 'gemini',
        raw_output: result.rawOutput,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        result: '',
        cost_usd: 0,
        duration_ms: 0,
        provider: 'gemini',
        error: errorMessage,
      };
    }
  }
  
  async setupWorkspace(params: WorkspaceSetupParams): Promise<string> {
    const { setupWorkspace } = await this.getGeminiActivities();
    const basePath = params.basePath || '/tmp/gemini-builds';
    return setupWorkspace(basePath);
  }
  
  async runComplianceChecks(workingDir: string): Promise<ComplianceResult> {
    const { runComplianceChecks } = await this.getGeminiActivities();
    const result = await runComplianceChecks(workingDir);
    
      // Map Gemini's ComplianceCheckResult to our unified ComplianceResult
      const firstError = result.errors?.[0];
      let errorType: ComplianceResult['errorType'] | undefined;
      if (firstError) {
        if (firstError.type.includes('npm install')) errorType = 'NPM_INSTALL';
        else if (firstError.type.includes('build')) errorType = 'TSC_ERROR';
        else if (firstError.type.includes('lint')) errorType = 'ESLINT_ERROR';
        else if (firstError.type.includes('test')) errorType = 'JEST_FAILURE';
      }
      
      return {
        success: result.success,
        output: result.output,
        commandsRun: result.commandsRun || [],
        failedCommand: firstError?.message,
        errorType,
      };
  }
  
  async logAuditEntry(workingDir: string, entry: AuditEntry): Promise<void> {
    const { logAuditEntry } = await this.getGeminiActivities();
    await logAuditEntry(workingDir, entry);
  }
  
  async checkAvailability(): Promise<{ available: boolean; reason?: string }> {
    // Check if Gemini CLI is installed
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execPromise = promisify(exec);
      
      // Check if gemini command exists
      await execPromise('which gemini');
      
      // Check if API key is configured (CLI will handle auth, but we can check env)
      // The CLI tool handles authentication, so if it's installed, assume available
      return { available: true };
    } catch (error) {
      return { 
        available: false, 
        reason: 'Gemini CLI not found or not in PATH. Install with: npm install -g @google/generative-ai-cli' 
      };
    }
  }
}

/**
 * Claude CLI Provider
 * Wraps the existing Claude CLI activities from temporal-coordinator
 */
export class ClaudeCLIProvider implements CLIAgentProvider {
  name: CLIProviderName = 'claude';
  
  // Import activities dynamically to avoid circular dependencies
  private async getClaudeActivities() {
    const { 
      executeClaudeAgent, 
      setupClaudeWorkspace, 
      runClaudeComplianceChecks, 
      logClaudeAuditEntry 
    } = await import('@coordinator/temporal-coordinator/claude-activities');
    return { 
      executeClaudeAgent, 
      setupClaudeWorkspace, 
      runClaudeComplianceChecks, 
      logClaudeAuditEntry 
    };
  }
  
  async executeAgent(params: CLIAgentParams): Promise<CLIAgentResult> {
    const { executeClaudeAgent } = await this.getClaudeActivities();
    
    // Select model based on task type if not explicitly provided
    let modelSelection: ModelSelection;
    let instruction = params.instruction;
    
    if (params.model) {
      // Use explicitly provided model
      modelSelection = {
        model: params.model as ClaudeModel,
        permissionMode: (params.permissionMode as 'plan' | 'acceptEdits' | 'full') || 'acceptEdits',
      };
    } else if (params.task) {
      // Auto-select model based on task
      // Extract error type from instruction if this is a fix task
      const errorType = params.task === 'fix' ? this.extractErrorType(params.instruction) : undefined;
      modelSelection = selectClaudeModel(params.task, errorType);
      // Add thinking keyword if needed
      instruction = buildClaudeInstruction(params.instruction, modelSelection);
    } else {
      // Default to Sonnet
      modelSelection = {
        model: 'sonnet',
        permissionMode: 'acceptEdits',
      };
    }
    
    const claudeInput: ExecuteClaudeAgentInput = {
      instruction,
      workingDir: params.workingDir,
      sessionId: params.sessionId,
      model: modelSelection.model,
      allowedTools: params.allowedTools as string[] | undefined,
      permissionMode: modelSelection.permissionMode || 'acceptEdits',
    };
    
    try {
      const result = await executeClaudeAgent(claudeInput);
      
      // Convert Claude result to unified format
      return {
        success: result.success,
        result: result.result,
        cost_usd: result.cost_usd,
        duration_ms: result.duration_ms,
        session_id: result.session_id,
        provider: 'claude',
        error: result.error,
        raw_output: result.raw_output,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        result: '',
        cost_usd: 0,
        duration_ms: 0,
        provider: 'claude',
        error: errorMessage,
      };
    }
  }
  
  async setupWorkspace(params: WorkspaceSetupParams): Promise<string> {
    const { setupClaudeWorkspace } = await this.getClaudeActivities();
    return setupClaudeWorkspace({
      basePath: params.basePath || '/tmp/claude-builds',
      requirementsContent: params.requirementsContent,
    });
  }
  
  async runComplianceChecks(workingDir: string): Promise<ComplianceResult> {
    const { runClaudeComplianceChecks } = await this.getClaudeActivities();
    const result = await runClaudeComplianceChecks(workingDir);
    
    return {
      success: result.success,
      output: result.output,
      commandsRun: result.commandsRun,
      failedCommand: result.failedCommand,
      errorType: result.errorType,
    };
  }
  
  async logAuditEntry(workingDir: string, entry: AuditEntry): Promise<void> {
    const { logClaudeAuditEntry } = await this.getClaudeActivities();
    await logClaudeAuditEntry(workingDir, {
      workflow_run_id: entry.workflow_run_id,
      step_name: entry.step_name,
      timestamp: entry.timestamp,
      cost_usd: entry.cost_usd,
      session_id: entry.session_id,
      model: entry.model as ClaudeModel | undefined,
      validation_status: entry.validation_status,
      validation_error_type: entry.validation_error_type,
      error_log_size_chars: entry.error_log_size_chars,
    });
  }
  
  /**
   * Extract error type from instruction for model selection
   */
  private extractErrorType(instruction: string): string | undefined {
    // Check for common error patterns in instruction
    if (instruction.includes('ESLINT_ERROR') || instruction.includes('lint')) {
      return 'ESLINT_ERROR';
    }
    if (instruction.includes('TSC_ERROR') || instruction.includes('TypeScript')) {
      return 'TSC_ERROR';
    }
    if (instruction.includes('circular dependency')) {
      return 'circular dependency';
    }
    if (instruction.includes('module type mismatch')) {
      return 'module type mismatch';
    }
    if (instruction.includes('design inconsistency')) {
      return 'design inconsistency';
    }
    return undefined;
  }
  
  async checkAvailability(): Promise<{ available: boolean; reason?: string }> {
    // Check if Claude CLI is installed
    try {
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execPromise = promisify(exec);
      
      // Check if claude command exists
      await execPromise('which claude');
      
      // Check if API key is configured (CLI will handle auth, but we can check env)
      // The CLI tool handles authentication, so if it's installed, assume available
      return { available: true };
    } catch (error) {
      return { 
        available: false, 
        reason: 'Claude CLI not found or not in PATH. Install with: npm install -g @anthropic-ai/claude-code' 
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Factory for creating and selecting CLI providers
 */
export class ProviderFactory {
  private geminiProvider: GeminiCLIProvider;
  private claudeProvider: ClaudeCLIProvider;
  
  constructor() {
    this.geminiProvider = new GeminiCLIProvider();
    this.claudeProvider = new ClaudeCLIProvider();
  }
  
  /**
   * Get a provider by name
   */
  getProvider(name: CLIProviderName): CLIAgentProvider {
    return name === 'gemini' ? this.geminiProvider : this.claudeProvider;
  }
  
  /**
   * Select the best provider based on task and credit status
   * 
   * Strategy:
   * - Prefer Gemini (cheaper) if available
   * - Fallback to Claude if Gemini unavailable
   * - Use Claude for complex tasks that benefit from model selection
   */
  async selectProvider(
    _task: BuildTask,
    creditStatus?: CreditStatus,
    preferredProvider?: CLIProviderName
  ): Promise<CLIAgentProvider> {
    // If preferred provider specified and available, use it
    if (preferredProvider) {
      const provider = this.getProvider(preferredProvider);
      const availability = await provider.checkAvailability();
      if (availability.available) {
        return provider;
      }
    }
    
    // Check credit status if provided
    if (creditStatus) {
      // Prefer Gemini if available and not rate limited
      if (creditStatus.gemini.available && !creditStatus.gemini.rateLimited) {
        return this.geminiProvider;
      }
      
      // Fallback to Claude if Gemini unavailable
      if (creditStatus.claude.available && !creditStatus.claude.rateLimited) {
        return this.claudeProvider;
      }
    }
    
    // Default: Try Gemini first, then Claude
    const geminiAvailable = await this.geminiProvider.checkAvailability();
    if (geminiAvailable.available) {
      return this.geminiProvider;
    }
    
    const claudeAvailable = await this.claudeProvider.checkAvailability();
    if (claudeAvailable.available) {
      return this.claudeProvider;
    }
    
    // If neither available, throw error
    throw new Error('No CLI providers available. Check credits and rate limits.');
  }
  
  /**
   * Execute with automatic fallback on failure
   */
  async executeWithFallback(
    params: CLIAgentParams,
    preferredProvider?: CLIProviderName
  ): Promise<CLIAgentResult> {
    const creditStatus = await this.checkCredits();
    let currentProvider = await this.selectProvider(
      params.task || 'implement',
      creditStatus,
      preferredProvider
    );
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        const result = await currentProvider.executeAgent(params);
        
        // If successful, return result
        if (result.success) {
          return result;
        }
        
        // If failed but might be recoverable, try fallback
        if (this.shouldFallback(result.error, currentProvider.name)) {
          currentProvider = this.getFallbackProvider(currentProvider.name);
          attempts++;
          continue;
        }
        
        // Non-recoverable error - include full error details
        const errorDetails = result.error 
          ? `Provider: ${currentProvider.name}, Error: ${result.error}`
          : 'CLI execution failed';
        throw new Error(errorDetails);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Check if we should fallback
        if (this.shouldFallback(errorMessage, currentProvider.name) && attempts < maxAttempts - 1) {
          currentProvider = this.getFallbackProvider(currentProvider.name);
          attempts++;
          continue;
        }
        // Include provider context in error
        const enhancedError = error instanceof Error 
          ? new Error(`Provider: ${currentProvider.name}, ${errorMessage}`)
          : error;
        throw enhancedError;
      }
    }
    
    throw new Error('All providers exhausted');
  }
  
  /**
   * Check if we should fallback to another provider
   */
  private shouldFallback(error: string | undefined, _currentProvider: CLIProviderName): boolean {
    if (!error) return false;
    
    // Don't fallback on interruption errors - they're not recoverable
    const interruptionTriggers = [
      'interrupted',
      'incomplete',
      'timed out',
      'unexpected end of json',
      'end of data',
    ];
    const errorLower = error.toLowerCase();
    if (interruptionTriggers.some(trigger => errorLower.includes(trigger))) {
      return false;
    }
    
    const fallbackTriggers = [
      'rate limit',
      'rate limited',
      'quota exceeded',
      'exhausted your capacity',
      'quota will reset',
      'credits',
      'authentication',
      'unauthorized',
      'capacity',
    ];
    
    return fallbackTriggers.some(trigger => errorLower.includes(trigger));
  }
  
  /**
   * Get fallback provider
   */
  private getFallbackProvider(currentProvider: CLIProviderName): CLIAgentProvider {
    return currentProvider === 'gemini' ? this.claudeProvider : this.geminiProvider;
  }
  
  /**
   * Check credit status for both providers
   * 
   * Note: Since we're using CLIs, the CLI tools themselves handle rate limiting.
   * This method checks if the tools are available and configured.
   * Actual rate limit errors will be caught during execution and trigger fallback.
   */
  async checkCredits(): Promise<CreditStatus> {
    const [geminiStatus, claudeStatus] = await Promise.all([
      this.geminiProvider.checkAvailability(),
      this.claudeProvider.checkAvailability(),
    ]);
    
    return {
      gemini: {
        available: geminiStatus.available,
        rateLimited: false, // CLI handles rate limits, we'll detect during execution
      },
      claude: {
        available: claudeStatus.available,
        rateLimited: false, // CLI handles rate limits, we'll detect during execution
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activities (for Temporal)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Singleton factory instance
 */
const providerFactory = new ProviderFactory();

/**
 * Activity: Execute CLI agent with automatic provider selection
 */
export async function executeCLIAgent(
  params: CLIAgentParams,
  preferredProvider?: CLIProviderName
): Promise<CLIAgentResult> {
  return providerFactory.executeWithFallback(params, preferredProvider);
}

/**
 * Activity: Set up workspace for CLI provider
 */
export async function setupCLIWorkspace(params: WorkspaceSetupParams): Promise<string> {
  const provider = providerFactory.getProvider(params.provider || 'gemini');
  return provider.setupWorkspace(params);
}

/**
 * Activity: Run compliance checks
 */
export async function runCLIComplianceChecks(
  workingDir: string,
  provider?: CLIProviderName
): Promise<ComplianceResult> {
  const cliProvider = providerFactory.getProvider(provider || 'gemini');
  return cliProvider.runComplianceChecks(workingDir);
}

/**
 * Activity: Log audit entry
 */
export async function logCLIAuditEntry(
  workingDir: string,
  entry: AuditEntry
): Promise<void> {
  const provider = providerFactory.getProvider(entry.provider || 'gemini');
  return provider.logAuditEntry(workingDir, entry);
}

/**
 * Activity: Check credit status
 */
export async function checkCLICredits(): Promise<CreditStatus> {
  return providerFactory.checkCredits();
}

/**
 * Activity: Select provider for a task
 */
export async function selectCLIProvider(
  task: BuildTask,
  preferredProvider?: CLIProviderName
): Promise<CLIAgentProvider> {
  const creditStatus = await providerFactory.checkCredits();
  return providerFactory.selectProvider(task, creditStatus, preferredProvider);
}

/**
 * Activity: Read plan file content
 */
export async function readPlanFileContent(
  workspaceRoot: string,
  planPath: string
): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const fullPath = path.join(workspaceRoot, planPath);
  return fs.readFile(fullPath, 'utf-8');
}

/**
 * Activity: Read requirements file content
 */
export async function readRequirementsContent(
  workspaceRoot: string,
  requirementsPath?: string
): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Default path if not provided
  const defaultPath = path.join(workspaceRoot, 'packages/temporal-coordinator/src/requirements/PACKAGE_REQUIREMENTS.md');
  const fullPath = requirementsPath ? path.join(workspaceRoot, requirementsPath) : defaultPath;
  
  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch {
    // Fallback: return default requirements template
    return `# BernierLLC Package Requirements

## TypeScript & Code Quality
- Zero TypeScript Errors (Strict Mode)
- Zero ESLint Errors
- No \`any\` types
- JSDoc comments on all public APIs
- License header in every .ts file

## Testing
- Minimum 80% test coverage
- Tests in __tests__/ directory

## Build
- package.json with required scripts (build, test, lint)
- tsconfig.json with strict mode
- dist/ directory with compiled output

## Verification Commands
- npm install
- npm run build
- npm run lint
- npm test`;
  }
}

