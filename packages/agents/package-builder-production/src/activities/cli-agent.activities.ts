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
import type { ExecuteClaudeAgentInput, ClaudeModel, PermissionMode } from '@coordinator/temporal-coordinator/claude-activities';
import { selectClaudeModel as selectClaudeModelFn, buildClaudeInstruction, type ModelSelection } from './model-selector.js';

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
 * Task breakdown result from CLI agent with quality gates and activity requests
 */
export interface TaskBreakdown {
  outline?: Array<{
    phase_id: string;
    title: string;
    description: string;
    exit_criteria: string[];
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    acceptance_criteria: string[];
    quality_gates?: string[];
    validation_steps?: string[]; // How to verify task completion (e.g., "file_exists:src/index.ts", "tests_pass", "lint_passes")
    dependencies?: string[];
    activity_requests?: Array<{
      type: string;
      args: Record<string, unknown>;
    }>;
  }>;
  more_tasks?: boolean;
  completed_task_id?: string | null;
  activities?: Array<{
    type: string;
    args: Record<string, unknown>;
  }>;
}

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
  /** Timeout in milliseconds (optional, default: 10 minutes in executeClaudeAgent) */
  timeoutMs?: number;
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
    console.log(`[GeminiCLIProvider] executeAgent called - this should NOT be called when preferred provider is 'claude'`);
    const { executeGeminiAgent } = await this.getGeminiActivities();
    
    const geminiInput: GeminiAgentInput = {
      instruction: params.instruction,
      workingDir: params.workingDir,
      contextContent: params.contextContent,
    };
    
    try {
      const result = await executeGeminiAgent(geminiInput);
      
      // If Gemini returns a failure, extract error message for fallback detection
      // Note: executeGeminiAgent throws on error, so this path is unlikely but kept for safety
      if (!result.success) {
        // Extract error from stderr or error report if available
        // The error message should contain quota/rate limit info for fallback detection
        const errorMessage = result.stderr || 'Gemini CLI execution failed';
        return {
          success: false,
          result: '',
          cost_usd: 0,
          duration_ms: 0,
          provider: 'gemini',
          error: errorMessage,
          raw_output: result.rawOutput,
        };
      }
      
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
    console.log(`[ClaudeCLIProvider] executeAgent called - this is the correct provider for preferred 'claude'`);
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
      modelSelection = selectClaudeModelFn(params.task, errorType);
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
      timeoutMs: params.timeoutMs, // Pass through timeout if provided
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
    if (name !== 'gemini' && name !== 'claude') {
      throw new Error(`Invalid provider name: '${name}'. Must be 'gemini' or 'claude'.`);
    }
    
    const provider = name === 'gemini' ? this.geminiProvider : this.claudeProvider;
    
    // Validate the provider name matches
    if (provider.name !== name) {
      throw new Error(
        `CRITICAL BUG: getProvider('${name}') returned provider with name '${provider.name}'. ` +
        `This should never happen.`
      );
    }
    
    return provider;
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
    // If preferred provider specified, use it (for testing/forcing a specific provider)
    // We still check availability, but if it fails, we'll throw an error rather than silently falling back
    if (preferredProvider) {
      console.log(`[selectProvider] Preferred provider requested: '${preferredProvider}'`);
      const provider = this.getProvider(preferredProvider);
      console.log(`[selectProvider] Retrieved provider: ${provider.name} (expected: ${preferredProvider})`);
      
      if (provider.name !== preferredProvider) {
        throw new Error(
          `CRITICAL BUG: getProvider('${preferredProvider}') returned provider with name '${provider.name}'. ` +
          `This should never happen.`
        );
      }
      
      const availability = await provider.checkAvailability();
      console.log(`[selectProvider] Provider '${provider.name}' availability: ${availability.available}`);
      
      if (availability.available) {
        console.log(`[selectProvider] Returning provider: ${provider.name}`);
        return provider;
      } else {
        // Preferred provider was specified but not available - throw error
        throw new Error(
          `Preferred provider '${preferredProvider}' is not available. ${availability.reason || 'CLI not installed or not in PATH.'}`
        );
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
   * 
   * Note: If preferredProvider is specified, fallback is disabled to ensure
   * the exact provider is used (useful for testing).
   */
  async executeWithFallback(
    params: CLIAgentParams,
    preferredProvider?: CLIProviderName
  ): Promise<CLIAgentResult> {
    // Validate preferred provider if specified
    if (preferredProvider && preferredProvider !== 'claude' && preferredProvider !== 'gemini') {
      throw new Error(`Invalid preferred provider: ${preferredProvider}. Must be 'claude' or 'gemini'.`);
    }
    
    const creditStatus = await this.checkCredits();
    let currentProvider = await this.selectProvider(
      params.task || 'implement',
      creditStatus,
      preferredProvider
    );
    
    // Validate that the selected provider matches the preferred provider if specified
    if (preferredProvider && currentProvider.name !== preferredProvider) {
      throw new Error(
        `Provider mismatch: preferred '${preferredProvider}' but selected '${currentProvider.name}'. ` +
        `This should never happen - there's a bug in provider selection.`
      );
    }
    
    // If preferred provider is specified, don't allow fallback
    // This ensures tests can force a specific provider
    if (preferredProvider) {
      console.log(`[executeWithFallback] Preferred provider '${preferredProvider}' specified - fallback disabled`);
      console.log(`[executeWithFallback] Selected provider: ${currentProvider.name} (validating match...)`);
      
      // Double-check we're using the right provider
      if (currentProvider.name !== preferredProvider) {
        throw new Error(
          `CRITICAL: Provider mismatch detected! Preferred: '${preferredProvider}', ` +
          `but executing: '${currentProvider.name}'. This is a bug.`
        );
      }
      
      const result = await currentProvider.executeAgent(params);
      
      // Validate result provider matches
      if (result.provider !== preferredProvider) {
        throw new Error(
          `CRITICAL: Result provider '${result.provider}' does not match preferred '${preferredProvider}'. ` +
          `This indicates a bug in the provider implementation.`
        );
      }
      
      if (!result.success) {
        const errorDetails = result.error 
          ? `Provider: ${currentProvider.name}, Error: ${result.error}`
          : 'CLI execution failed';
        throw new Error(errorDetails);
      }
      
      return result;
    }
    
    // No preferred provider - allow fallback behavior
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
      'exited with code 143', // SIGTERM - process killed
      'exited with code 130', // SIGINT - Ctrl+C
      'was interrupted or killed',
      'was cancelled',
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
  console.log(`[executeCLIAgent] Called with preferredProvider: '${preferredProvider || 'none'}'`);
  
  if (preferredProvider && preferredProvider !== 'claude' && preferredProvider !== 'gemini') {
    throw new Error(`Invalid preferredProvider: '${preferredProvider}'. Must be 'claude' or 'gemini'.`);
  }
  
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
 * Activity: Check credits for execution (explicit check before execution)
 */
export async function checkCLICreditsForExecution(
  preferredProvider?: CLIProviderName
): Promise<CreditStatus> {
  console.log(`[checkCLICreditsForExecution] Checking credits for preferred provider: '${preferredProvider || 'none'}'`);
  const creditStatus = await providerFactory.checkCredits();
  
  // If preferred provider specified, validate it's available
  if (preferredProvider) {
    const providerStatus = creditStatus[preferredProvider];
    if (!providerStatus.available) {
      console.warn(`[checkCLICreditsForExecution] Preferred provider '${preferredProvider}' is not available`);
    }
  }
  
  return creditStatus;
}

/**
 * Activity: Select Claude model for a task
 */
export async function selectClaudeModel(
  task: BuildTask,
  errorType?: string
): Promise<{ model: ClaudeModel; permissionMode: PermissionMode; thinkingKeyword?: string }> {
  console.log(`[selectClaudeModel] Selecting model for task: '${task}', errorType: '${errorType || 'none'}'`);
  const modelSelection = selectClaudeModelFn(task, errorType);
  
  return {
    model: modelSelection.model,
    permissionMode: (modelSelection.permissionMode || 'acceptEdits') as PermissionMode,
    thinkingKeyword: modelSelection.thinkingKeyword,
  };
}

/**
 * Activity: Execute Gemini CLI directly
 */
export async function executeGeminiCLI(
  params: {
    instruction: string;
    workingDir: string;
    contextContent?: string;
  }
): Promise<CLIAgentResult> {
  console.log(`[executeGeminiCLI] Executing Gemini CLI in ${params.workingDir}`);
  const provider = providerFactory.getProvider('gemini');
  
  const result = await provider.executeAgent({
    instruction: params.instruction,
    workingDir: params.workingDir,
    contextContent: params.contextContent,
    task: 'implement', // Default task type
  });
  
  console.log(`[executeGeminiCLI] Result: success=${result.success}, cost=$${result.cost_usd}`);
  return result;
}

/**
 * Activity: Execute Claude CLI directly
 */
export async function executeClaudeCLI(
  params: {
    instruction: string;
    workingDir: string;
    sessionId?: string;
    model: ClaudeModel;
    permissionMode: 'plan' | 'acceptEdits' | 'full';
    contextContent?: string;
    timeoutMs?: number; // Optional timeout override (default: 10 minutes in executeClaudeAgent)
  }
): Promise<CLIAgentResult> {
  console.log(`[executeClaudeCLI] Executing Claude CLI in ${params.workingDir}`);
  console.log(`[executeClaudeCLI] Model: ${params.model}, Permission: ${params.permissionMode}, Session: ${params.sessionId || 'new'}`);
  const provider = providerFactory.getProvider('claude');
  
  const result = await provider.executeAgent({
    instruction: params.instruction,
    workingDir: params.workingDir,
    sessionId: params.sessionId,
    model: params.model,
    permissionMode: params.permissionMode,
    contextContent: params.contextContent,
    task: 'implement', // Default task type
    timeoutMs: params.timeoutMs, // Pass through timeout if provided
  });
  
  console.log(`[executeClaudeCLI] Result: success=${result.success}, cost=$${result.cost_usd}, sessionId=${result.session_id || 'none'}`);
  return result;
}

/**
 * Activity: Validate CLI result
 */
export async function validateCLIResult(
  result: CLIAgentResult,
  expectedProvider: CLIProviderName
): Promise<CLIAgentResult> {
  console.log(`[validateCLIResult] Validating result from provider: ${result.provider}, expected: ${expectedProvider}`);
  
  // Validate provider matches
  if (result.provider !== expectedProvider) {
    throw new Error(
      `Provider mismatch: result provider '${result.provider}' does not match expected '${expectedProvider}'. ` +
      `This indicates a bug in the provider implementation.`
    );
  }
  
  // Validate success status
  if (!result.success && !result.error) {
    console.warn(`[validateCLIResult] Result marked as unsuccessful but no error message provided`);
  }
  
  // Validate cost is non-negative
  if (result.cost_usd < 0) {
    console.warn(`[validateCLIResult] Negative cost detected: $${result.cost_usd}`);
  }
  
  // Validate duration is non-negative
  if (result.duration_ms < 0) {
    console.warn(`[validateCLIResult] Negative duration detected: ${result.duration_ms}ms`);
  }
  
  console.log(`[validateCLIResult] Validation passed`);
  return result;
}

/**
 * Activity: Request task breakdown from CLI agent
 * 
 * Uses the full Temporal task planner system prompt with quality gates, activity requests, and signals.
 * Supports iterative planning, not big-bang breakdown.
 */
export async function requestTaskBreakdown(params: {
  planContent: string;
  requirementsContent: string;
  phase: 'scaffold' | 'implement';
  workingDir: string;
  provider: CLIProviderName;
  contextContent?: string;
  completedTaskIds?: string[]; // For iterative planning
}): Promise<TaskBreakdown> {
  // Import Context for heartbeat (only available in Temporal activity context)
  let activityContext: any = null;
  try {
    const { Context } = await import('@temporalio/activity');
    activityContext = Context.current();
  } catch {
    // Not in Temporal context, that's fine for direct calls
  }

  console.log(`[requestTaskBreakdown] Step 1: Starting task breakdown for phase: '${params.phase}'`);
  if (activityContext) {
    try {
      activityContext.heartbeat('Step 1: Starting task breakdown');
    } catch {
      // Heartbeat might fail if not in proper activity context
    }
  }
  
  // Build the full system prompt based on the user's specification
  const breakdownPrompt = `You are an autonomous headless CLI agent invoked by a Temporal.io workflow. Your job is to (1) read a project plan file and repository context, (2) produce an outline and a small "next slice" of tasks, (3) continuously re-plan based on completed work and new information, and (4) keep quality and safety top-of-mind through explicit quality gates.

## Operating mode: iterative planning, not big-bang

* Do **not** break down the entire project into tasks at once unless explicitly instructed.
* First produce a **high-level outline** (epics/phases) and a short list of **next tasks** (typically 3–8) that logically follow from current state.
* After tasks are completed, re-evaluate what changed and generate the **next tasks** with updated context.
* You must support "injecting new tasks" when new info is discovered, risks appear, or scope changes.

## Quality-first rules (non-negotiable)

For any code changes:
* Prefer small, verifiable increments.
* Every implementation slice must include appropriate tests (unit/integration/e2e as relevant).
* Add or update documentation when behavior, configuration, or developer workflows change.
* Use quality gates as tasks, not vibes:
  * lint/format checks
  * static analysis (typecheck, etc.)
  * tests (targeted → full)
  * review/self-review checklist
  * smoke tests / minimal runtime verification
* If you cannot run something yourself, request a workflow activity to run it and return results.

## Required response signals

In every response, you may include any of the following explicit signals:
1. \`"more_tasks": true\` if additional tasks remain beyond what you returned.
2. \`"completed_task_id": "<id>"\` when you're reporting a task completion.
3. \`"activities": [...]\` to request workflow actions (command line or other).

## Your available workflow "Activities"

You can request activities that the workflow can perform for you to save tokens and gather truth:
* \`read_file(path)\` - Read a file from the repository
* \`write_file(path, contents)\` - Write a file (use sparingly, prefer CLI edits)
* \`list_dir(path)\` - List directory contents
* \`run_cmd(cmd, cwd?, env?)\` - Run a shell command and return output
* \`run_tests(scope?)\` - Run tests (unit/integration/e2e)
* \`run_lint()\` - Run linting checks
* \`typecheck()\` - Run TypeScript type checking
* \`get_git_diff()\` - Get current git diff
* \`get_git_status()\` - Get git status

If you need information, request an activity rather than guessing.

## Task design constraints

Every task you create must:
* be **discrete and actionable**
* be completable in **a single CLI interaction**
* have **clear acceptance criteria**
* include **quality gates** where appropriate
* specify **dependencies** via task IDs when ordering matters

## Task lifecycle

* Tasks have stable IDs.
* A task can be in: \`todo | doing | blocked | done\`.
* When a task is completed, emit \`completed_task_id\`.
* If new tasks need to be added, set \`more_tasks: true\` and include them.

## Current Context

**Phase**: ${params.phase}
${params.completedTaskIds && params.completedTaskIds.length > 0 
  ? `**Completed Tasks**: ${params.completedTaskIds.join(', ')}` 
  : '**Status**: Starting fresh'}

# Package Requirements

${params.requirementsContent}

---

# Package Plan

${params.planContent}

---

## Output format (STRICT)

Return **ONLY** valid JSON matching this schema—no prose, no markdown.

\`\`\`json
{
  "outline": [
    { "phase_id": "P1", "title": "...", "description": "...", "exit_criteria": ["..."] }
  ],
  "tasks": [
    {
      "id": "T1",
      "title": "...",
      "description": "...",
      "acceptance_criteria": ["..."],
      "quality_gates": ["tests_added_or_updated", "tests_run", "lint_run", "typecheck_run", "docs_updated"],
      "dependencies": ["T0"],
      "activity_requests": [
        { "type": "run_cmd", "args": { "cmd": "..." } }
      ]
    }
  ],
  "more_tasks": true,
  "completed_task_id": null,
  "activities": [
    { "type": "read_file", "args": { "path": "package.json" } }
  ]
}
\`\`\`

## Planning algorithm

1. Request the plan file + minimal repo context (tree, existing docs, tests, build tooling).
2. Produce an outline + the next 3–8 tasks.
3. Ensure at least one early task is a **verification baseline** (e.g., run tests/lint, confirm build).
4. Ensure tasks include **test-first or test-with** steps, not "tests later".
5. As results come back (command outputs, diffs, CI), update the plan and add/remove tasks.
6. If blocked, create a task to resolve the blocker and request the needed activity output.

## Safety / correctness

* If requirements are ambiguous, add a task to clarify by reading docs/config or requesting a decision.
* If changes are risky, introduce a spike task and/or feature flag task.
* Never fabricate command outputs or file contents.

Begin by analyzing the plan and producing an outline + the first 3–8 tasks for the ${params.phase} phase.`;

  // Log the prompt for inspection (when DEBUG_CLI_PROMPTS is set)
  if (process.env.DEBUG_CLI_PROMPTS === 'true') {
    console.log('\n=== CLI PROMPT BEING SENT ===');
    console.log(breakdownPrompt);
    console.log('=== END PROMPT ===\n');
  }

  console.log(`[requestTaskBreakdown] Step 2: Selecting model for provider: ${params.provider}`);
  if (activityContext) {
    try {
      activityContext.heartbeat('Step 2: Selecting model');
    } catch {}
  }

  // Execute with the appropriate provider
  let result: CLIAgentResult;
  
  if (params.provider === 'claude') {
    // For Claude, select model and build instruction
    console.log(`[requestTaskBreakdown] Step 3: Calling selectClaudeModel for phase: ${params.phase}`);
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 3: Calling selectClaudeModel');
      } catch {}
    }
    
    const modelConfig = await selectClaudeModel(params.phase === 'scaffold' ? 'scaffold' : 'implement');
    console.log(`[requestTaskBreakdown] Step 4: Model selected: ${modelConfig.model}, Permission: ${modelConfig.permissionMode}`);
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 4: Model selected, building instruction');
      } catch {}
    }
    
    const modelSelection: ModelSelection = {
      model: modelConfig.model,
      permissionMode: modelConfig.permissionMode,
    };
    const instruction = buildClaudeInstruction(breakdownPrompt, modelSelection);
    
    console.log(`[requestTaskBreakdown] Step 5: Calling executeClaudeCLI (instruction length: ${instruction.length} chars)`);
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 5: Calling executeClaudeCLI');
      } catch {}
    }
    
    result = await executeClaudeCLI({
      instruction,
      workingDir: params.workingDir,
      sessionId: undefined, // New session for breakdown
      model: modelConfig.model,
      permissionMode: modelConfig.permissionMode,
      contextContent: params.contextContent,
      timeoutMs: 600000, // 10 minutes timeout for task breakdown (matching default in executeClaudeAgent)
    });
    
    console.log(`[requestTaskBreakdown] Step 6: executeClaudeCLI completed (success: ${result.success})`);
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 6: executeClaudeCLI completed, parsing result');
      } catch {}
    }
  } else {
    // For Gemini
    console.log(`[requestTaskBreakdown] Step 3: Calling executeGeminiCLI`);
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 3: Calling executeGeminiCLI');
      } catch {}
    }
    
    result = await executeGeminiCLI({
      instruction: breakdownPrompt,
      workingDir: params.workingDir,
      contextContent: params.contextContent,
    });
    
    console.log(`[requestTaskBreakdown] Step 4: executeGeminiCLI completed (success: ${result.success})`);
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 4: executeGeminiCLI completed, parsing result');
      } catch {}
    }
  }
  
  if (!result.success) {
    console.error(`[requestTaskBreakdown] Step 7: CLI call failed: ${result.error || 'Unknown error'}`);
    throw new Error(`Failed to get task breakdown: ${result.error || 'Unknown error'}`);
  }
  
  console.log(`[requestTaskBreakdown] Step 7: CLI call succeeded, parsing JSON response (${result.result.length} chars)`);
  if (activityContext) {
    try {
      activityContext.heartbeat('Step 7: Parsing JSON response');
    } catch {}
  }
  
  // Log the raw response for inspection (when DEBUG_CLI_PROMPTS is set)
  if (process.env.DEBUG_CLI_PROMPTS === 'true') {
    console.log('\n=== CLI RAW RESPONSE ===');
    console.log(result.result.substring(0, 2000)); // First 2000 chars
    if (result.result.length > 2000) {
      console.log(`... (${result.result.length - 2000} more characters)`);
    }
    console.log('=== END RESPONSE ===\n');
  }
  
  // Parse the JSON response
  console.log(`[requestTaskBreakdown] Step 8: Extracting JSON from response`);
  if (activityContext) {
    try {
      activityContext.heartbeat('Step 8: Extracting JSON');
    } catch {}
  }
  
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks or have prose before it)
    let jsonText = result.result.trim();
    
    // Look for JSON code block anywhere in the response (handles prose before/after)
    const jsonBlockRegex = /```(?:json|JSON)?\s*\n([\s\S]*?)\n```/;
    const jsonBlockMatch = jsonText.match(jsonBlockRegex);
    
    if (jsonBlockMatch) {
      // Extract JSON from code block
      jsonText = jsonBlockMatch[1].trim();
    } else if (jsonText.startsWith('```')) {
      // Fallback: handle code block at start (old behavior)
      const firstBlockEnd = jsonText.indexOf('```', 3);
      if (firstBlockEnd !== -1) {
        let blockContent = jsonText.substring(3, firstBlockEnd).trim();
        // Remove language identifier
        if (blockContent.startsWith('json') || blockContent.startsWith('JSON')) {
          blockContent = blockContent.substring(4).trim();
        }
        jsonText = blockContent;
      }
    } else {
      // Try to find JSON object/array in the response (might be embedded in prose)
      const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
      const jsonArrayMatch = jsonText.match(/\[[\s\S]*\]/);
      
      if (jsonObjectMatch) {
        jsonText = jsonObjectMatch[0];
      } else if (jsonArrayMatch) {
        jsonText = jsonArrayMatch[0];
      }
      // If no JSON found, will fail with parse error below
    }
    
    console.log(`[requestTaskBreakdown] Step 9: Parsing JSON (${jsonText.length} chars)`);
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 9: Parsing JSON');
      } catch {}
    }
    
    const parsed = JSON.parse(jsonText) as TaskBreakdown;
    
    console.log(`[requestTaskBreakdown] Step 10: Validating structure`);
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 10: Validating structure');
      } catch {}
    }
    
    // Validate structure
    if (!Array.isArray(parsed.tasks)) {
      throw new Error('Task breakdown response missing "tasks" array');
    }
    
    console.log(`[requestTaskBreakdown] Step 11: Sorting tasks by dependencies`);
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 11: Sorting tasks');
      } catch {}
    }
    
    // Sort tasks by dependencies (dependencies first)
    const sortedTasks = [...parsed.tasks];
    const taskMap = new Map(sortedTasks.map(t => [t.id, t]));
    const sorted: typeof sortedTasks = [];
    const visited = new Set<string>();
    
    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      const task = taskMap.get(taskId);
      if (!task) return;
      
      // Visit dependencies first
      if (task.dependencies) {
        for (const depId of task.dependencies) {
          visit(depId);
        }
      }
      
      if (!sorted.find(t => t.id === taskId)) {
        sorted.push(task);
        visited.add(taskId);
      }
    };
    
    // Visit all tasks
    for (const task of sortedTasks) {
      visit(task.id);
    }
    
    parsed.tasks = sorted;
    
    console.log(`[requestTaskBreakdown] Step 12: Task breakdown complete`);
    console.log(`[requestTaskBreakdown] Received ${parsed.tasks.length} tasks`);
    if (parsed.outline) {
      console.log(`[requestTaskBreakdown] Received ${parsed.outline.length} outline phases`);
    }
    if (parsed.activities && parsed.activities.length > 0) {
      console.log(`[requestTaskBreakdown] Agent requested ${parsed.activities.length} activities`);
    }
    if (parsed.more_tasks) {
      console.log(`[requestTaskBreakdown] Agent indicates more tasks are available`);
    }
    
    if (activityContext) {
      try {
        activityContext.heartbeat('Step 12: Task breakdown complete');
      } catch {}
    }
    
    return parsed;
  } catch (parseError) {
    console.error(`[requestTaskBreakdown] Failed to parse task breakdown JSON`);
    console.error(`[requestTaskBreakdown] Raw response: ${result.result.substring(0, 500)}...`);
    throw new Error(
      `Failed to parse task breakdown response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
    );
  }
}

/**
 * Activity: Execute workflow activity requested by CLI agent
 * 
 * Handles activity requests from the agent (read_file, run_cmd, etc.)
 */
export async function executeAgentActivityRequest(params: {
  type: string;
  args: Record<string, unknown>;
  workingDir: string;
}): Promise<{ success: boolean; output?: string; error?: string }> {
  console.log(`[executeAgentActivityRequest] Executing activity: ${params.type}`);
  
  const { type, args, workingDir } = params;
  const fs = await import('fs/promises');
  const path = await import('path');
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execPromise = promisify(exec);
  
  try {
    switch (type) {
      case 'read_file': {
        const filePath = args.path as string;
        if (!filePath) {
          return { success: false, error: 'Missing "path" argument' };
        }
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workingDir, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        return { success: true, output: content };
      }
      
      case 'list_dir': {
        const dirPath = (args.path as string) || workingDir;
        const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(workingDir, dirPath);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const result = entries.map(entry => ({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
        }));
        return { success: true, output: JSON.stringify(result, null, 2) };
      }
      
      case 'run_cmd': {
        const cmd = args.cmd as string;
        if (!cmd) {
          return { success: false, error: 'Missing "cmd" argument' };
        }
        const cwd = (args.cwd as string) || workingDir;
        const env = (args.env as Record<string, string>) || undefined;
        const { stdout, stderr } = await execPromise(cmd, { cwd, env });
        return { 
          success: true, 
          output: stdout || stderr || '',
        };
      }
      
      case 'run_tests': {
        const scope = args.scope as string | undefined;
        const cmd = scope ? `npm test -- ${scope}` : 'npm test';
        const { stdout, stderr } = await execPromise(cmd, { cwd: workingDir });
        return { 
          success: true, 
          output: stdout || stderr || '',
        };
      }
      
      case 'run_lint': {
        const { stdout, stderr } = await execPromise('npm run lint', { cwd: workingDir });
        return { 
          success: true, 
          output: stdout || stderr || '',
        };
      }
      
      case 'typecheck': {
        const { stdout, stderr } = await execPromise('npx tsc --noEmit', { cwd: workingDir });
        return { 
          success: true, 
          output: stdout || stderr || '',
        };
      }
      
      case 'get_git_diff': {
        try {
          const { stdout } = await execPromise('git diff', { cwd: workingDir });
          return { success: true, output: stdout };
        } catch {
          return { success: true, output: '' }; // No diff or not a git repo
        }
      }
      
      case 'get_git_status': {
        try {
          const { stdout } = await execPromise('git status --porcelain', { cwd: workingDir });
          return { success: true, output: stdout };
        } catch {
          return { success: true, output: '' }; // Not a git repo
        }
      }
      
      default:
        return { success: false, error: `Unknown activity type: ${type}` };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[executeAgentActivityRequest] Error executing ${type}: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * Activity: Select provider for a task
 */
export async function selectCLIProvider(
  task: BuildTask,
  preferredProvider?: CLIProviderName
): Promise<CLIAgentProvider> {
  console.log(`[selectCLIProvider] Called with task: '${task}', preferredProvider: '${preferredProvider || 'none'}'`);
  
  if (preferredProvider) {
    if (preferredProvider !== 'claude' && preferredProvider !== 'gemini') {
      throw new Error(`Invalid preferredProvider: '${preferredProvider}'. Must be 'claude' or 'gemini'.`);
    }
    console.log(`[selectCLIProvider] Preferred provider requested: ${preferredProvider}`);
  }
  
  const creditStatus = await providerFactory.checkCredits();
  const provider = await providerFactory.selectProvider(task, creditStatus, preferredProvider);
  
  console.log(`[selectCLIProvider] Selected provider: ${provider.name}`);
  
  if (preferredProvider && provider.name !== preferredProvider) {
    throw new Error(
      `CRITICAL: selectCLIProvider returned '${provider.name}' but preferred was '${preferredProvider}'. ` +
      `This is a bug in provider selection.`
    );
  }
  
  return provider;
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

// ─────────────────────────────────────────────────────────────────────────────
// Task Activity Loop Activities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validation error structure
 */
export interface ValidationError {
  type: 'file_missing' | 'test_failure' | 'lint_error' | 'typecheck_error' | 'build_error' | 'other';
  message: string;
  target: string; // File path, test name, or other identifier
}

/**
 * Activity: Execute task with CLI (with task completion loop)
 * 
 * Executes a task using the CLI, looping until the agent signals completion.
 * Uses efficient file-based communication (no JSON serialization of file contents).
 * 
 * @param params - Task execution parameters
 * @returns Deterministic result with log file path, session ID, and completion status
 */
export async function executeTaskWithCLI(params: {
  task: TaskBreakdown['tasks'][0];
  sessionId?: string;
  workingDir: string;
  workflowId: string;
  sequenceNumber: number;
  continueTask?: boolean;
  previousLogFilePath?: string;
  contextContent?: string;
  provider: CLIProviderName;
  model?: ClaudeModel;
  permissionMode?: PermissionMode;
}): Promise<{
  success: boolean;
  logFilePath: string; // ← Deterministic file path
  sessionId?: string;   // ← Deterministic session ID
  taskComplete: boolean; // ← Agent's completion signal
  cost_usd: number;
  duration_ms: number;
  error?: string;
}> {
  const { task, sessionId, workingDir, workflowId, sequenceNumber, continueTask, previousLogFilePath, contextContent, provider, model, permissionMode } = params;
  
  console.log(`[executeTaskWithCLI] Executing task: ${task.id} (${task.title})`);
  console.log(`[executeTaskWithCLI] Continue task: ${continueTask || false}, Sequence: ${sequenceNumber}`);
  
  // Generate deterministic log file path
  const fs = await import('fs/promises');
  const path = await import('path');
  const logFileName = `${workflowId}-task-${task.id}-${sequenceNumber}.jsonl`;
  const logDir = path.join(workingDir, '.claude', 'logs');
  await fs.mkdir(logDir, { recursive: true });
  const logFilePath = path.join(logDir, logFileName);
  
  // Build instruction
  const instruction = continueTask
    ? `Continue working on task: ${task.title}

Task ID: ${task.id}
Task Description: ${task.description}

${previousLogFilePath ? `Previous attempt log: ${previousLogFilePath}\nReview what was done and continue until this task is complete.` : 'Continue from where you left off.'}

When you have completed this task, you MUST respond with:
\`\`\`json
{
  "task_complete": true,
  "verification_method": "file_exists|tests_pass|lint_passes|etc",
  "verification_target": "path/to/file or test name"
}
\`\`\`

If you need more turns to complete the task, respond with:
\`\`\`json
{
  "task_complete": false,
  "next_action": "description of what you'll do next"
}
\`\`\``
    : `Complete this task: ${task.title}

Task ID: ${task.id}
Description: ${task.description}

Acceptance Criteria:
${task.acceptance_criteria.map(c => `- ${c}`).join('\n')}

${task.validation_steps && task.validation_steps.length > 0
  ? `Validation Steps (you will need to verify these):
${task.validation_steps.map(s => `- ${s}`).join('\n')}\n`
  : ''}

When you have completed this task, you MUST respond with:
\`\`\`json
{
  "task_complete": true,
  "verification_method": "file_exists|tests_pass|lint_passes|etc",
  "verification_target": "path/to/file or test name"
}
\`\`\`

If you need more turns to complete the task, respond with:
\`\`\`json
{
  "task_complete": false,
  "next_action": "description of what you'll do next"
}
\`\`\``;
  
  // Execute CLI
  let cliResult: CLIAgentResult;
  if (provider === 'gemini') {
    const geminiProvider = providerFactory.getProvider('gemini');
    cliResult = await geminiProvider.executeAgent({
      instruction,
      workingDir,
      contextContent,
    });
  } else {
    // Claude
    const claudeProvider = providerFactory.getProvider('claude');
    cliResult = await claudeProvider.executeAgent({
      instruction,
      workingDir,
      sessionId,
      model: model || 'sonnet',
      permissionMode: permissionMode || 'acceptEdits',
      contextContent,
    });
  }
  
  // Write log file (deterministic path)
  const logEntry = {
    timestamp: new Date().toISOString(),
    workflowId,
    taskId: task.id,
    sequenceNumber,
    instruction,
    sessionId: cliResult.session_id,
    result: cliResult.result,
    cost_usd: cliResult.cost_usd,
    duration_ms: cliResult.duration_ms,
    success: cliResult.success,
    continueTask,
    previousLogFilePath,
  };
  await fs.writeFile(logFilePath, JSON.stringify(logEntry, null, 2), 'utf-8');
  
  // Parse agent response for task_complete signal
  let taskComplete = false;
  try {
    // Extract JSON from response (may be in markdown code block)
    const jsonMatch = cliResult.result.match(/```(?:json|JSON)?\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      taskComplete = parsed.task_complete === true;
    } else {
      // Try to find JSON object/array in response
      const jsonObjMatch = cliResult.result.match(/\{[\s\S]*"task_complete"[\s\S]*\}/);
      if (jsonObjMatch) {
        const parsed = JSON.parse(jsonObjMatch[0]);
        taskComplete = parsed.task_complete === true;
      }
    }
  } catch {
    // If parsing fails, assume not complete (agent will clarify in next turn)
    taskComplete = false;
  }
  
  return {
    success: cliResult.success,
    logFilePath, // ← Deterministic
    sessionId: cliResult.session_id, // ← Deterministic
    taskComplete, // ← Agent's signal
    cost_usd: cliResult.cost_usd,
    duration_ms: cliResult.duration_ms,
    error: cliResult.error,
  };
}

/**
 * Activity: Run task validations
 * 
 * Runs validation steps for a task and writes errors to a deterministic file path.
 * Uses efficient file-based communication (no JSON serialization in workflow).
 * 
 * @param params - Validation parameters
 * @returns Deterministic result with validation errors file path
 */
export async function runTaskValidations(params: {
  task: TaskBreakdown['tasks'][0];
  workingDir: string;
  workflowId: string;
}): Promise<{
  success: boolean;
  validationErrorsFilePath: string; // ← Deterministic file path
  allPassed: boolean;
  errors: ValidationError[];
}> {
  const { task, workingDir, workflowId } = params;
  
  console.log(`[runTaskValidations] Running validations for task: ${task.id}`);
  
  const fs = await import('fs/promises');
  const path = await import('path');
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execPromise = promisify(exec);
  
  const errors: ValidationError[] = [];
  
  // Run each validation step
  for (const validationStep of task.validation_steps || []) {
    try {
      if (validationStep.startsWith('file_exists:')) {
        const filePath = validationStep.replace('file_exists:', '').trim();
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workingDir, filePath);
        try {
          await fs.access(fullPath);
          // File exists, validation passes
        } catch {
          errors.push({
            type: 'file_missing',
            message: `Required file does not exist: ${filePath}`,
            target: filePath,
          });
        }
      } else if (validationStep === 'tests_pass' || validationStep === 'test_pass') {
        try {
          const { stdout, stderr } = await execPromise('npm test', { cwd: workingDir, timeout: 300000 });
          // If command succeeds, tests passed
          if (stderr && !stdout) {
            // Some test runners output to stderr
            const hasFailures = stderr.includes('FAIL') || stderr.includes('failing') || stderr.includes('Error:');
            if (hasFailures) {
              errors.push({
                type: 'test_failure',
                message: stderr.substring(0, 1000), // Truncate long output
                target: 'test suite',
              });
            }
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            type: 'test_failure',
            message: errorMessage.substring(0, 1000),
            target: 'test suite',
          });
        }
      } else if (validationStep === 'lint_passes' || validationStep === 'lint_pass') {
        try {
          const { stderr } = await execPromise('npm run lint', { cwd: workingDir, timeout: 120000 });
          // If command succeeds, lint passed
          if (stderr && stderr.trim().length > 0) {
            errors.push({
              type: 'lint_error',
              message: stderr.substring(0, 1000),
              target: 'lint check',
            });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            type: 'lint_error',
            message: errorMessage.substring(0, 1000),
            target: 'lint check',
          });
        }
      } else if (validationStep === 'typecheck_passes' || validationStep === 'typecheck_pass') {
        try {
          const { stderr } = await execPromise('npx tsc --noEmit', { cwd: workingDir, timeout: 120000 });
          // If command succeeds, typecheck passed
          if (stderr && stderr.trim().length > 0) {
            errors.push({
              type: 'typecheck_error',
              message: stderr.substring(0, 1000),
              target: 'typecheck',
            });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            type: 'typecheck_error',
            message: errorMessage.substring(0, 1000),
            target: 'typecheck',
          });
        }
      } else if (validationStep === 'build_passes' || validationStep === 'build_pass') {
        try {
          const { stderr } = await execPromise('npm run build', { cwd: workingDir, timeout: 300000 });
          // If command succeeds, build passed
          if (stderr && stderr.trim().length > 0 && !stderr.includes('warning')) {
            errors.push({
              type: 'build_error',
              message: stderr.substring(0, 1000),
              target: 'build',
            });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push({
            type: 'build_error',
            message: errorMessage.substring(0, 1000),
            target: 'build',
          });
        }
      } else {
        // Unknown validation step
        console.warn(`[runTaskValidations] Unknown validation step: ${validationStep}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[runTaskValidations] Error running validation step ${validationStep}: ${errorMessage}`);
      errors.push({
        type: 'other',
        message: `Error running validation: ${errorMessage}`,
        target: validationStep,
      });
    }
  }
  
  // Write errors to deterministic file path
  const errorsDir = path.join(workingDir, '.claude', 'validation-errors');
  await fs.mkdir(errorsDir, { recursive: true });
  const errorsFileName = `${workflowId}-task-${task.id}-errors.json`;
  const errorsFilePath = path.join(errorsDir, errorsFileName);
  
  await fs.writeFile(errorsFilePath, JSON.stringify(errors, null, 2), 'utf-8');
  
  console.log(`[runTaskValidations] Validations complete: ${errors.length} errors found`);
  if (errors.length > 0) {
    console.log(`[runTaskValidations] Errors written to: ${errorsFilePath}`);
  }
  
  return {
    success: true,
    validationErrorsFilePath: errorsFilePath, // ← Deterministic
    allPassed: errors.length === 0,
    errors,
  };
}

/**
 * Activity: Execute fix with CLI (reads validation errors from file)
 * 
 * Fixes validation errors using the CLI. Reads errors from a deterministic file path
 * and passes the file path (not contents) in the prompt for efficient communication.
 * 
 * @param params - Fix execution parameters
 * @returns Deterministic result with log file path and fix status
 */
export async function executeFixWithCLI(params: {
  task: TaskBreakdown['tasks'][0];
  validationErrorsFilePath: string; // ← Deterministic file path
  sessionId?: string;
  workingDir: string;
  workflowId: string;
  sequenceNumber: number;
  provider: CLIProviderName;
  model?: ClaudeModel;
  permissionMode?: PermissionMode;
  contextContent?: string;
}): Promise<{
  success: boolean;
  logFilePath: string; // ← Deterministic file path
  sessionId?: string;   // ← Deterministic session ID
  fixed: boolean;       // ← Agent's fix signal
  cost_usd: number;
  duration_ms: number;
  error?: string;
}> {
  const { task, validationErrorsFilePath, sessionId, workingDir, workflowId, sequenceNumber, provider, model, permissionMode, contextContent } = params;
  
  console.log(`[executeFixWithCLI] Fixing validation errors for task: ${task.id}`);
  console.log(`[executeFixWithCLI] Errors file: ${validationErrorsFilePath}`);
  
  // Generate deterministic log file path
  const fs = await import('fs/promises');
  const path = await import('path');
  const logFileName = `${workflowId}-fix-${task.id}-${sequenceNumber}.jsonl`;
  const logDir = path.join(workingDir, '.claude', 'logs');
  await fs.mkdir(logDir, { recursive: true });
  const logFilePath = path.join(logDir, logFileName);
  
  // Build fix instruction - pass file path, not contents (efficient!)
  const instruction = `Fix the validation errors for task: ${task.title}

Task ID: ${task.id}

Validation errors are in: ${validationErrorsFilePath}
Read that file to see what needs fixing.

Review the errors and fix them. When you have applied fixes, respond with:
\`\`\`json
{
  "fixed": true,
  "fixes_applied": ["description of fixes"]
}
\`\`\`

If you need more information or cannot fix, respond with:
\`\`\`json
{
  "fixed": false,
  "reason": "explanation"
}
\`\`\``;
  
  // Execute CLI
  let cliResult: CLIAgentResult;
  if (provider === 'gemini') {
    const geminiProvider = providerFactory.getProvider('gemini');
    cliResult = await geminiProvider.executeAgent({
      instruction,
      workingDir,
      contextContent,
    });
  } else {
    // Claude
    const claudeProvider = providerFactory.getProvider('claude');
    cliResult = await claudeProvider.executeAgent({
      instruction,
      workingDir,
      sessionId,
      model: model || 'sonnet',
      permissionMode: permissionMode || 'acceptEdits',
      contextContent,
    });
  }
  
  // Write log file (deterministic path)
  const logEntry = {
    timestamp: new Date().toISOString(),
    workflowId,
    taskId: task.id,
    sequenceNumber,
    instruction,
    validationErrorsFilePath, // ← Deterministic reference
    sessionId: cliResult.session_id,
    result: cliResult.result,
    cost_usd: cliResult.cost_usd,
    duration_ms: cliResult.duration_ms,
    success: cliResult.success,
  };
  await fs.writeFile(logFilePath, JSON.stringify(logEntry, null, 2), 'utf-8');
  
  // Parse agent response for fixed signal
  let fixed = false;
  try {
    // Extract JSON from response (may be in markdown code block)
    const jsonMatch = cliResult.result.match(/```(?:json|JSON)?\s*\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      fixed = parsed.fixed === true;
    } else {
      // Try to find JSON object in response
      const jsonObjMatch = cliResult.result.match(/\{[\s\S]*"fixed"[\s\S]*\}/);
      if (jsonObjMatch) {
        const parsed = JSON.parse(jsonObjMatch[0]);
        fixed = parsed.fixed === true;
      }
    }
  } catch {
    // If parsing fails, assume not fixed
    fixed = false;
  }
  
  return {
    success: cliResult.success,
    logFilePath, // ← Deterministic
    sessionId: cliResult.session_id, // ← Deterministic
    fixed, // ← Agent's signal
    cost_usd: cliResult.cost_usd,
    duration_ms: cliResult.duration_ms,
    error: cliResult.error,
  };
}

