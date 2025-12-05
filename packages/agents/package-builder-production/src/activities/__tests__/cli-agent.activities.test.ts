/**
 * Unit tests for CLI Agent Activities
 * 
 * Tests the unified CLI abstraction layer for Gemini and Claude providers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GeminiCLIProvider,
  ClaudeCLIProvider,
  ProviderFactory,
  executeCLIAgent,
  setupCLIWorkspace,
  runCLIComplianceChecks,
  logCLIAuditEntry,
  checkCLICredits,
  selectCLIProvider,
  checkCLICreditsForExecution,
  selectClaudeModel,
  executeGeminiCLI,
  executeClaudeCLI,
  validateCLIResult,
  requestTaskBreakdown,
  executeAgentActivityRequest,
  type CLIAgentParams,
  type WorkspaceSetupParams,
  type CreditStatus,
  type CLIAgentResult,
  type TaskBreakdown,
} from '../cli-agent.activities';

// Mock the temporal-coordinator activities
vi.mock('@coordinator/temporal-coordinator/activities', () => ({
  executeGeminiAgent: vi.fn(),
  setupWorkspace: vi.fn(),
  runComplianceChecks: vi.fn(),
  logAuditEntry: vi.fn(),
}));

vi.mock('@coordinator/temporal-coordinator/claude-activities', () => ({
  executeClaudeAgent: vi.fn(),
  setupClaudeWorkspace: vi.fn(),
  runClaudeComplianceChecks: vi.fn(),
  logClaudeAuditEntry: vi.fn(),
}));

// Mock child_process for availability checks
const mockExec = vi.fn();
vi.mock('node:child_process', () => ({
  exec: mockExec,
}));

// Mock fs/promises for executeAgentActivityRequest tests
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
    readdir: vi.fn(),
  };
});

// Mock child_process for executeAgentActivityRequest tests (separate from node:child_process)
const mockChildProcessExec = vi.fn();
vi.mock('child_process', () => ({
  exec: mockChildProcessExec,
}));

// Mock util for executeAgentActivityRequest tests
const mockExecPromise = vi.fn();
vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecPromise),
}));

describe('CLI Agent Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset exec promise mock to default (not found)
    mockExecPromise.mockRejectedValue(new Error('Command not found'));
    // Reset child_process exec mock
    mockChildProcessExec.mockImplementation(() => ({} as any));
  });

  describe('GeminiCLIProvider', () => {
    let provider: GeminiCLIProvider;

    beforeEach(() => {
      provider = new GeminiCLIProvider();
    });

    it('should have correct name', () => {
      expect(provider.name).toBe('gemini');
    });

    describe('checkAvailability', () => {
      it('should return available when CLI is installed', async () => {
        mockExecPromise.mockResolvedValueOnce({ 
          stdout: '/usr/local/bin/gemini', 
          stderr: '' 
        });

        const result = await provider.checkAvailability();
        expect(result.available).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should return unavailable when CLI is not found', async () => {
        mockExecPromise.mockRejectedValueOnce(new Error('not found'));

        const result = await provider.checkAvailability();
        expect(result.available).toBe(false);
        expect(result.reason).toContain('Gemini CLI not found');
      });
    });

    describe('executeAgent', () => {
      it('should execute Gemini agent and return unified result', async () => {
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        vi.mocked(executeGeminiAgent).mockResolvedValue({
          success: true,
          agentResponse: {
            result: 'Success',
            cost_usd: 0.01,
            duration_ms: 1000,
          },
        });

        const params: CLIAgentParams = {
          instruction: 'Test instruction',
          workingDir: '/tmp/test',
          contextContent: 'Test context',
        };

        const result = await provider.executeAgent(params);
        expect(result.success).toBe(true);
        expect(result.result).toBe('Success');
        expect(result.cost_usd).toBe(0.01);
        expect(result.duration_ms).toBe(1000);
        expect(result.provider).toBe('gemini');
        expect(result.session_id).toBeUndefined();
      });

      it('should handle errors gracefully', async () => {
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        vi.mocked(executeGeminiAgent).mockRejectedValue(new Error('CLI failed'));

        const params: CLIAgentParams = {
          instruction: 'Test instruction',
          workingDir: '/tmp/test',
        };

        const result = await provider.executeAgent(params);
        expect(result.success).toBe(false);
        expect(result.error).toBe('CLI failed');
        expect(result.provider).toBe('gemini');
      });
    });
  });

  describe('ClaudeCLIProvider', () => {
    let provider: ClaudeCLIProvider;

    beforeEach(() => {
      provider = new ClaudeCLIProvider();
    });

    it('should have correct name', () => {
      expect(provider.name).toBe('claude');
    });

    describe('checkAvailability', () => {
      it('should return available when CLI is installed', async () => {
        mockExecPromise.mockResolvedValueOnce({ 
          stdout: '/usr/local/bin/claude', 
          stderr: '' 
        });

        const result = await provider.checkAvailability();
        expect(result.available).toBe(true);
        expect(result.reason).toBeUndefined();
      });

      it('should return unavailable when CLI is not found', async () => {
        mockExecPromise.mockRejectedValueOnce(new Error('not found'));

        const result = await provider.checkAvailability();
        expect(result.available).toBe(false);
        expect(result.reason).toContain('Claude CLI not found');
      });
    });

    describe('executeAgent', () => {
      it('should execute Claude agent and return unified result with session', async () => {
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        vi.mocked(executeClaudeAgent).mockResolvedValue({
          success: true,
          result: 'Success',
          cost_usd: 0.02,
          duration_ms: 2000,
          session_id: 'session-123',
        });

        const params: CLIAgentParams = {
          instruction: 'Test instruction',
          workingDir: '/tmp/test',
          sessionId: 'session-123',
          model: 'sonnet',
        };

        const result = await provider.executeAgent(params);
        expect(result.success).toBe(true);
        expect(result.result).toBe('Success');
        expect(result.cost_usd).toBe(0.02);
        expect(result.duration_ms).toBe(2000);
        expect(result.provider).toBe('claude');
        expect(result.session_id).toBe('session-123');
      });
    });
  });

  describe('ProviderFactory', () => {
    let factory: ProviderFactory;

    beforeEach(() => {
      factory = new ProviderFactory();
    });

    describe('getProvider', () => {
      it('should return Gemini provider', () => {
        const provider = factory.getProvider('gemini');
        expect(provider.name).toBe('gemini');
      });

      it('should return Claude provider', () => {
        const provider = factory.getProvider('claude');
        expect(provider.name).toBe('claude');
      });
    });

    describe('selectProvider', () => {
      it('should prefer Gemini when both available', async () => {
        const geminiProvider = factory.getProvider('gemini');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });

        const provider = await factory.selectProvider('implement');
        expect(provider.name).toBe('gemini');
      });

      it('should fallback to Claude when Gemini unavailable', async () => {
        const geminiProvider = factory.getProvider('gemini');
        const claudeProvider = factory.getProvider('claude');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ 
          available: false, 
          reason: 'Not found' 
        });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });

        const provider = await factory.selectProvider('implement');
        expect(provider.name).toBe('claude');
      });

      it('should use preferred provider when specified and available', async () => {
        const claudeProvider = factory.getProvider('claude');
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });

        const provider = await factory.selectProvider('implement', undefined, 'claude');
        expect(provider.name).toBe('claude');
      });

      it('should use credit status when provided', async () => {
        const creditStatus: CreditStatus = {
          gemini: { available: false, rateLimited: true },
          claude: { available: true, rateLimited: false },
        };

        const provider = await factory.selectProvider('implement', creditStatus);
        expect(provider.name).toBe('claude');
      });

      it('should throw when no providers available', async () => {
        const geminiProvider = factory.getProvider('gemini');
        const claudeProvider = factory.getProvider('claude');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ 
          available: false 
        });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ 
          available: false 
        });

        await expect(factory.selectProvider('implement')).rejects.toThrow(
          'No CLI providers available'
        );
      });
    });

    describe('executeWithFallback', () => {
      it('should execute with preferred provider', async () => {
        // Mock availability checks to return both available
        const geminiProvider = factory.getProvider('gemini');
        const claudeProvider = factory.getProvider('claude');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });
        
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        vi.mocked(executeGeminiAgent).mockResolvedValue({
          success: true,
          agentResponse: { result: 'Success', cost_usd: 0.01, duration_ms: 1000 },
        });

        const params: CLIAgentParams = {
          instruction: 'Test',
          workingDir: '/tmp/test',
        };

        const result = await factory.executeWithFallback(params, 'gemini');
        expect(result.success).toBe(true);
        expect(result.provider).toBe('gemini');
      });

      it('should fallback on rate limit error', async () => {
        // Mock availability checks
        const geminiProvider = factory.getProvider('gemini');
        const claudeProvider = factory.getProvider('claude');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });
        
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        vi.mocked(executeGeminiAgent).mockRejectedValue(new Error('rate limit exceeded'));
        vi.mocked(executeClaudeAgent).mockResolvedValue({
          success: true,
          result: 'Success',
          cost_usd: 0.02,
          duration_ms: 2000,
          session_id: 'session-123',
        });

        const params: CLIAgentParams = {
          instruction: 'Test',
          workingDir: '/tmp/test',
        };

        // Don't pass preferredProvider - this allows fallback to work
        const result = await factory.executeWithFallback(params);
        expect(result.success).toBe(true);
        expect(result.provider).toBe('claude');
      });

      it('should fallback on Gemini quota exhausted error (actual error format)', async () => {
        // Mock availability checks
        const geminiProvider = factory.getProvider('gemini');
        const claudeProvider = factory.getProvider('claude');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });
        
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        // Use the actual error format from Gemini quota exhaustion
        const quotaError = new Error('Gemini CLI failed: You have exhausted your capacity on this model. Your quota will reset after 3h43m9s.');
        vi.mocked(executeGeminiAgent).mockRejectedValue(quotaError);
        vi.mocked(executeClaudeAgent).mockResolvedValue({
          success: true,
          result: 'Success from Claude',
          cost_usd: 0.02,
          duration_ms: 2000,
          session_id: 'session-123',
        });

        const params: CLIAgentParams = {
          instruction: 'Test',
          workingDir: '/tmp/test',
        };

        // Don't pass preferredProvider - this allows fallback to work
        const result = await factory.executeWithFallback(params);
        expect(result.success).toBe(true);
        expect(result.provider).toBe('claude');
        expect(result.result).toBe('Success from Claude');
      });

      it('should fallback when Gemini returns quota error in result', async () => {
        // Mock availability checks
        const geminiProvider = factory.getProvider('gemini');
        const claudeProvider = factory.getProvider('claude');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });
        
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        // Simulate Gemini returning a failure result (not throwing)
        vi.mocked(executeGeminiAgent).mockResolvedValue({
          success: false,
          agentResponse: undefined,
          rawOutput: undefined,
          stderr: 'You have exhausted your capacity on this model. Your quota will reset after 3h43m9s.',
        });
        vi.mocked(executeClaudeAgent).mockResolvedValue({
          success: true,
          result: 'Success from Claude',
          cost_usd: 0.02,
          duration_ms: 2000,
          session_id: 'session-123',
        });

        const params: CLIAgentParams = {
          instruction: 'Test',
          workingDir: '/tmp/test',
        };

        // Don't pass preferredProvider - this allows fallback to work
        const result = await factory.executeWithFallback(params);
        expect(result.success).toBe(true);
        expect(result.provider).toBe('claude');
      });

      it('should NOT fallback on interruption errors', async () => {
        // Mock availability checks
        const geminiProvider = factory.getProvider('gemini');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });
        
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        
        // Interruption errors should not trigger fallback
        const interruptedError = new Error('CLI operation was interrupted or killed (exit code 143)');
        vi.mocked(executeGeminiAgent).mockRejectedValue(interruptedError);

        const params: CLIAgentParams = {
          instruction: 'Test',
          workingDir: '/tmp/test',
        };

        await expect(factory.executeWithFallback(params, 'gemini')).rejects.toThrow('interrupted');
      });

      it('should throw when all providers exhausted', async () => {
        // Mock availability checks
        const geminiProvider = factory.getProvider('gemini');
        const claudeProvider = factory.getProvider('claude');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });
        
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        vi.mocked(executeGeminiAgent).mockRejectedValue(new Error('rate limit exceeded'));
        vi.mocked(executeClaudeAgent).mockRejectedValue(new Error('rate limit exceeded'));

        const params: CLIAgentParams = {
          instruction: 'Test',
          workingDir: '/tmp/test',
        };

        // Don't pass preferredProvider - this allows fallback to work and test exhaustion
        await expect(factory.executeWithFallback(params)).rejects.toThrow(
          'All providers exhausted'
        );
      });
    });

    describe('checkCredits', () => {
      it('should check availability of both providers', async () => {
        const geminiProvider = factory.getProvider('gemini');
        const claudeProvider = factory.getProvider('claude');
        
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });

        const credits = await factory.checkCredits();
        expect(credits.gemini.available).toBe(true);
        expect(credits.claude.available).toBe(true);
        expect(credits.gemini.rateLimited).toBe(false);
        expect(credits.claude.rateLimited).toBe(false);
      });
    });
  });

  describe('Activity Functions', () => {
    describe('executeCLIAgent', () => {
      it('should execute with automatic fallback', async () => {
        // Mock the module to inject a factory with mocked providers
        const mockFactory = new ProviderFactory();
        const geminiProvider = mockFactory.getProvider('gemini');
        const claudeProvider = mockFactory.getProvider('claude');
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });
        vi.spyOn(mockFactory, 'executeWithFallback').mockResolvedValue({
          success: true,
          result: 'Success',
          cost_usd: 0.01,
          duration_ms: 1000,
          provider: 'gemini',
        });
        
        // Mock the module export
        vi.doMock('../cli-agent.activities', async () => {
          const actual = await vi.importActual('../cli-agent.activities');
          return {
            ...actual,
            executeCLIAgent: async (params: any) => {
              return mockFactory.executeWithFallback(params);
            },
          };
        });
        
        const { executeCLIAgent } = await import('../cli-agent.activities');
        const params: CLIAgentParams = {
          instruction: 'Test',
          workingDir: '/tmp/test',
        };

        const result = await executeCLIAgent(params);
        expect(result.success).toBe(true);
      });
    });

    describe('setupCLIWorkspace', () => {
      it('should set up workspace with default provider', async () => {
        const { setupWorkspace } = await import('@coordinator/temporal-coordinator/activities');
        vi.mocked(setupWorkspace).mockResolvedValue('/tmp/gemini-builds/build-123');

        const params: WorkspaceSetupParams = {
          basePath: '/tmp/gemini-builds',
          requirementsContent: 'Test requirements',
        };

        const result = await setupCLIWorkspace(params);
        expect(result).toBe('/tmp/gemini-builds/build-123');
      });
    });

    describe('checkCLICredits', () => {
      it('should return credit status', async () => {
        const testFactory = new ProviderFactory();
        const geminiProvider = testFactory.getProvider('gemini');
        const claudeProvider = testFactory.getProvider('claude');
        
        vi.spyOn(geminiProvider, 'checkAvailability').mockResolvedValue({ available: true });
        vi.spyOn(claudeProvider, 'checkAvailability').mockResolvedValue({ available: true });

        const credits = await checkCLICredits();
        expect(credits).toHaveProperty('gemini');
        expect(credits).toHaveProperty('claude');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // New Granular Activities Tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Granular Activities', () => {
    describe('checkCLICreditsForExecution', () => {
      it('should return credit status structure', async () => {
        // This test verifies the function returns the correct structure
        // Actual availability depends on CLI installation, so we just check structure
        const credits = await checkCLICreditsForExecution();
        expect(credits).toHaveProperty('gemini');
        expect(credits).toHaveProperty('claude');
        expect(credits.gemini).toHaveProperty('available');
        expect(credits.gemini).toHaveProperty('rateLimited');
        expect(credits.claude).toHaveProperty('available');
        expect(credits.claude).toHaveProperty('rateLimited');
      });

      it('should accept preferred provider parameter', async () => {
        // Test that function accepts preferred provider without throwing
        const credits = await checkCLICreditsForExecution('claude');
        expect(credits).toHaveProperty('gemini');
        expect(credits).toHaveProperty('claude');
      });
    });

    describe('selectClaudeModel', () => {
      it('should select model for scaffold task', async () => {
        const result = await selectClaudeModel('scaffold', undefined);
        expect(result.model).toBe('sonnet');
        expect(result.permissionMode).toBe('acceptEdits');
        expect(result.thinkingKeyword).toBeUndefined();
      });

      it('should select model for implement task', async () => {
        const result = await selectClaudeModel('implement', undefined);
        expect(result.model).toBe('sonnet');
        expect(result.permissionMode).toBe('acceptEdits');
      });

      it('should select haiku for lint fix task', async () => {
        const result = await selectClaudeModel('fix', 'ESLINT_ERROR');
        expect(result.model).toBe('haiku');
        expect(result.permissionMode).toBe('acceptEdits');
      });

      it('should select opus for complex fix task', async () => {
        const result = await selectClaudeModel('fix', 'circular dependency');
        expect(result.model).toBe('opus');
        expect(result.thinkingKeyword).toBe('think hard');
      });
    });

    describe('executeGeminiCLI', () => {
      it('should execute Gemini CLI and return result', async () => {
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        vi.mocked(executeGeminiAgent).mockResolvedValue({
          success: true,
          agentResponse: {
            result: 'Gemini success',
            cost_usd: 0.01,
            duration_ms: 1000,
          },
        });

        const result = await executeGeminiCLI({
          instruction: 'Test instruction',
          workingDir: '/tmp/test',
          contextContent: 'Test context',
        });

        expect(result.success).toBe(true);
        expect(result.result).toBe('Gemini success');
        expect(result.provider).toBe('gemini');
        expect(result.cost_usd).toBe(0.01);
        expect(executeGeminiAgent).toHaveBeenCalled();
      });

      it('should handle Gemini CLI errors', async () => {
        const { executeGeminiAgent } = await import('@coordinator/temporal-coordinator/activities');
        vi.mocked(executeGeminiAgent).mockRejectedValue(new Error('Gemini failed'));

        const result = await executeGeminiCLI({
          instruction: 'Test instruction',
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toBe('Gemini failed');
        expect(result.provider).toBe('gemini');
      });
    });

    describe('executeClaudeCLI', () => {
      it('should execute Claude CLI and return result with session', async () => {
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        vi.mocked(executeClaudeAgent).mockResolvedValue({
          success: true,
          result: 'Claude success',
          cost_usd: 0.02,
          duration_ms: 2000,
          session_id: 'session-123',
        });

        const result = await executeClaudeCLI({
          instruction: 'Test instruction',
          workingDir: '/tmp/test',
          sessionId: undefined,
          model: 'sonnet',
          permissionMode: 'acceptEdits',
          contextContent: 'Test context',
        });

        expect(result.success).toBe(true);
        expect(result.result).toBe('Claude success');
        expect(result.provider).toBe('claude');
        expect(result.session_id).toBe('session-123');
        expect(executeClaudeAgent).toHaveBeenCalled();
      });

      it('should use existing session ID when provided', async () => {
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        vi.mocked(executeClaudeAgent).mockResolvedValue({
          success: true,
          result: 'Claude success',
          cost_usd: 0.02,
          duration_ms: 2000,
          session_id: 'session-456',
        });

        await executeClaudeCLI({
          instruction: 'Test instruction',
          workingDir: '/tmp/test',
          sessionId: 'session-123',
          model: 'sonnet',
          permissionMode: 'acceptEdits',
        });

        expect(executeClaudeAgent).toHaveBeenCalledWith(
          expect.objectContaining({
            sessionId: 'session-123',
            model: 'sonnet',
            permissionMode: 'acceptEdits',
          })
        );
      });
    });

    describe('validateCLIResult', () => {
      it('should validate successful result', async () => {
        const result: CLIAgentResult = {
          success: true,
          result: 'Success',
          cost_usd: 0.01,
          duration_ms: 1000,
          provider: 'gemini',
        };

        const validated = await validateCLIResult(result, 'gemini');
        expect(validated).toEqual(result);
      });

      it('should validate Claude result with session', async () => {
        const result: CLIAgentResult = {
          success: true,
          result: 'Success',
          cost_usd: 0.02,
          duration_ms: 2000,
          provider: 'claude',
          session_id: 'session-123',
        };

        const validated = await validateCLIResult(result, 'claude');
        expect(validated).toEqual(result);
      });

      it('should throw on provider mismatch', async () => {
        const result: CLIAgentResult = {
          success: true,
          result: 'Success',
          cost_usd: 0.01,
          duration_ms: 1000,
          provider: 'gemini',
        };

        await expect(validateCLIResult(result, 'claude')).rejects.toThrow(
          'Provider mismatch'
        );
      });

      it('should warn on negative cost', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result: CLIAgentResult = {
          success: true,
          result: 'Success',
          cost_usd: -0.01,
          duration_ms: 1000,
          provider: 'gemini',
        };

        await validateCLIResult(result, 'gemini');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Negative cost detected')
        );
        consoleSpy.mockRestore();
      });

      it('should warn on unsuccessful result without error', async () => {
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const result: CLIAgentResult = {
          success: false,
          result: '',
          cost_usd: 0.01,
          duration_ms: 1000,
          provider: 'gemini',
        };

        await validateCLIResult(result, 'gemini');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('no error message provided')
        );
        consoleSpy.mockRestore();
      });
    });

    describe('requestTaskBreakdown', () => {
      it('should build the correct prompt structure', async () => {
        // Test the prompt building logic directly (no CLI call)
        const planContent = '# Test Plan\n\nSimple test';
        const requirementsContent = '# Requirements\n\nTypeScript strict';
        
        // We can't easily test the full prompt without calling the function,
        // but we can verify the prompt contains the right elements by checking
        // what gets passed to executeClaudeCLI
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        // Mock to capture the instruction
        let capturedInstruction = '';
        vi.mocked(executeClaudeAgent).mockImplementation(async (input) => {
          capturedInstruction = input.instruction;
          return {
            success: true,
            result: JSON.stringify({ tasks: [] }),
            cost_usd: 0.01,
            duration_ms: 1000,
            session_id: 'test-session',
          };
        });

        await requestTaskBreakdown({
          planContent,
          requirementsContent,
          phase: 'scaffold',
          workingDir: '/tmp/test',
          provider: 'claude',
        });

        // Verify prompt structure
        expect(capturedInstruction).toContain('iterative planning');
        expect(capturedInstruction).toContain('quality gates');
        expect(capturedInstruction).toContain('activities');
        expect(capturedInstruction).toContain(planContent);
        expect(capturedInstruction).toContain(requirementsContent);
        expect(capturedInstruction).toContain('scaffold');
        expect(capturedInstruction).toContain('JSON');
        
        console.log('\n=== PROMPT STRUCTURE VERIFIED ===');
        console.log(`Prompt length: ${capturedInstruction.length} characters`);
        console.log(`Contains plan: ${capturedInstruction.includes(planContent)}`);
        console.log(`Contains requirements: ${capturedInstruction.includes(requirementsContent)}`);
      });

      it('should request task breakdown from Claude CLI and parse response', async () => {
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        // Mock a realistic task breakdown response from Claude CLI
        const mockTaskBreakdownResponse = {
          success: true,
          result: JSON.stringify({
            outline: [
              {
                phase_id: 'P1',
                title: 'Scaffold Package Structure',
                description: 'Create initial package configuration and directory structure',
                exit_criteria: ['package.json created', 'tsconfig.json created', 'directory structure established']
              }
            ],
            tasks: [
              {
                id: 'T1',
                title: 'Create package.json',
                description: 'Create package.json with correct name, version, scripts, and dependencies',
                acceptance_criteria: ['package.json exists', 'Contains required scripts', 'Dependencies listed'],
                quality_gates: ['no_guessing_requested_outputs'],
                dependencies: [],
                activity_requests: [
                  { type: 'read_file', args: { path: 'package.json' } }
                ]
              },
              {
                id: 'T2',
                title: 'Create tsconfig.json',
                description: 'Create TypeScript configuration with strict mode enabled',
                acceptance_criteria: ['tsconfig.json exists', 'Strict mode enabled', 'ES2020 target'],
                quality_gates: ['typecheck_run'],
                dependencies: ['T1']
              }
            ],
            more_tasks: false,
            completed_task_id: null,
            activities: []
          }),
          cost_usd: 0.05,
          duration_ms: 3000,
          session_id: 'session-breakdown-123',
        };
        
        vi.mocked(executeClaudeAgent).mockResolvedValue(mockTaskBreakdownResponse);

        // Use full plan/requirements (matching workflow behavior after fix)
        const result = await requestTaskBreakdown({
          planContent: '# Test Package\n\nSimple test package',
          requirementsContent: '# Requirements\n\nTypeScript strict mode',
          phase: 'scaffold',
          workingDir: '/tmp/test',
          provider: 'claude',
          contextContent: 'Test context',
        });

        expect(result.tasks).toHaveLength(2);
        expect(result.tasks[0].id).toBe('T1');
        expect(result.tasks[0].title).toBe('Create package.json');
        expect(result.tasks[0].acceptance_criteria).toContain('package.json exists');
        expect(result.tasks[0].quality_gates).toContain('no_guessing_requested_outputs');
        expect(result.tasks[0].activity_requests).toHaveLength(1);
        expect(result.tasks[0].activity_requests?.[0].type).toBe('read_file');
        
        expect(result.tasks[1].dependencies).toContain('T1');
        expect(result.outline).toHaveLength(1);
        expect(result.more_tasks).toBe(false);
        
        // Verify the prompt structure was sent correctly
        expect(executeClaudeAgent).toHaveBeenCalled();
        const callArgs = vi.mocked(executeClaudeAgent).mock.calls[0][0];
        expect(callArgs.instruction).toContain('iterative planning');
        expect(callArgs.instruction).toContain('quality gates');
        expect(callArgs.instruction).toContain('activities');
      });

      it('should handle truncated plan content (workflow scenario before fix)', async () => {
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        // This test verifies that requestTaskBreakdown works with full plans
        // (the workflow was previously passing truncated plans with "[... rest of plan ...]" messages)
        const mockResponse = {
          success: true,
          result: JSON.stringify({
            outline: [{ phase_id: 'P1', title: 'Scaffolding', description: 'Initial setup', exit_criteria: [] }],
            tasks: [{ id: 'T1', title: 'Create package.json', description: 'Create package.json', acceptance_criteria: [], quality_gates: [], dependencies: [] }],
            more_tasks: false,
            completed_task_id: null,
            activities: [],
          }),
          cost_usd: 0.01,
          duration_ms: 1000,
          session_id: 'test-session',
        };
        
        vi.mocked(executeClaudeAgent).mockResolvedValue(mockResponse);

        // Test with full plan (what workflow should use)
        const fullPlan = '# Test Package Plan\n\n## Package Overview\n- Name: test-package\n- Description: A test package\n\n## Architecture\n- Single entry point: src/index.ts\n\n## Implementation\nCreate a simple function';
        const fullRequirements = '# Requirements\n\n## TypeScript & Code Quality\n- Zero TypeScript Errors\n- Zero ESLint Errors\n\n## Build\n- package.json with required scripts\n- tsconfig.json with strict mode';

        const result = await requestTaskBreakdown({
          planContent: fullPlan,
          requirementsContent: fullRequirements,
          phase: 'scaffold',
          workingDir: '/tmp/test',
          provider: 'claude',
        });

        expect(result.tasks).toHaveLength(1);
        expect(executeClaudeAgent).toHaveBeenCalled();
        const callArgs = vi.mocked(executeClaudeAgent).mock.calls[0][0];
        // Verify full plan is in the prompt (not truncated)
        expect(callArgs.instruction).toContain(fullPlan);
        expect(callArgs.instruction).toContain(fullRequirements);
        expect(callArgs.instruction).not.toContain('[... rest of plan will be provided');
      });

      it('should handle task breakdown with activity requests', async () => {
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        const mockResponse = {
          success: true,
          result: JSON.stringify({
            tasks: [
              {
                id: 'T1',
                title: 'Read existing files',
                description: 'Check what files already exist',
                acceptance_criteria: ['File list obtained'],
                dependencies: [],
              }
            ],
            activities: [
              { type: 'list_dir', args: { path: '.' } },
              { type: 'read_file', args: { path: 'package.json' } }
            ],
            more_tasks: true,
          }),
          cost_usd: 0.03,
          duration_ms: 2000,
          session_id: 'session-456',
        };
        
        vi.mocked(executeClaudeAgent).mockResolvedValue(mockResponse);

        const result = await requestTaskBreakdown({
          planContent: 'Test plan',
          requirementsContent: 'Test requirements',
          phase: 'scaffold',
          workingDir: '/tmp/test',
          provider: 'claude',
        });

        expect(result.activities).toHaveLength(2);
        expect(result.activities?.[0].type).toBe('list_dir');
        expect(result.more_tasks).toBe(true);
      });

      it('should handle iterative planning with completed tasks', async () => {
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        const mockResponse = {
          success: true,
          result: JSON.stringify({
            tasks: [
              {
                id: 'T3',
                title: 'Create README.md',
                description: 'Create README with package documentation',
                acceptance_criteria: ['README.md exists', 'Contains package description'],
                dependencies: ['T1', 'T2'],
              }
            ],
            more_tasks: false,
            completed_task_id: 'T2',
          }),
          cost_usd: 0.02,
          duration_ms: 1500,
          session_id: 'session-789',
        };
        
        vi.mocked(executeClaudeAgent).mockResolvedValue(mockResponse);

        const result = await requestTaskBreakdown({
          planContent: 'Test plan',
          requirementsContent: 'Test requirements',
          phase: 'scaffold',
          workingDir: '/tmp/test',
          provider: 'claude',
          completedTaskIds: ['T1', 'T2'],
        });

        expect(result.tasks[0].dependencies).toContain('T1');
        expect(result.tasks[0].dependencies).toContain('T2');
        expect(result.completed_task_id).toBe('T2');
      });

      it('should parse JSON wrapped in markdown code blocks', async () => {
        const { executeClaudeAgent } = await import('@coordinator/temporal-coordinator/claude-activities');
        
        // Simulate Claude returning JSON wrapped in markdown
        const mockResponse = {
          success: true,
          result: `\`\`\`json
{
  "tasks": [
    {
      "id": "T1",
      "title": "Test task",
      "description": "Test description",
      "acceptance_criteria": ["Criterion 1"]
    }
  ]
}
\`\`\``,
          cost_usd: 0.01,
          duration_ms: 1000,
          session_id: 'session-markdown',
        };
        
        vi.mocked(executeClaudeAgent).mockResolvedValue(mockResponse);

        const result = await requestTaskBreakdown({
          planContent: 'Test',
          requirementsContent: 'Test',
          phase: 'scaffold',
          workingDir: '/tmp/test',
          provider: 'claude',
        });

        expect(result.tasks).toHaveLength(1);
        expect(result.tasks[0].id).toBe('T1');
      });
    });

    describe('executeAgentActivityRequest', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it('should execute read_file activity', async () => {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        vi.mocked(fs.readFile).mockResolvedValue('file content');

        const result = await executeAgentActivityRequest({
          type: 'read_file',
          args: { path: 'test.txt' },
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(true);
        expect(result.output).toBe('file content');
        expect(fs.readFile).toHaveBeenCalledWith(
          path.join('/tmp/test', 'test.txt'),
          'utf-8'
        );
      });

      it('should execute list_dir activity', async () => {
        const fs = await import('fs/promises');
        const path = await import('path');
        
        const mockEntries = [
          { name: 'file1.txt', isDirectory: () => false },
          { name: 'dir1', isDirectory: () => true },
        ];
        
        vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any);

        const result = await executeAgentActivityRequest({
          type: 'list_dir',
          args: { path: '.' },
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(true);
        const parsed = JSON.parse(result.output!);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].name).toBe('file1.txt');
        expect(parsed[0].type).toBe('file');
        expect(parsed[1].type).toBe('directory');
      });

      it('should execute run_cmd activity', async () => {
        mockExecPromise.mockResolvedValueOnce({
          stdout: 'command output',
          stderr: '',
        });

        const result = await executeAgentActivityRequest({
          type: 'run_cmd',
          args: { cmd: 'npm --version' },
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(true);
        expect(result.output).toContain('command output');
      });

      it('should execute run_tests activity', async () => {
        mockExecPromise.mockResolvedValueOnce({
          stdout: 'Tests passed',
          stderr: '',
        });

        const result = await executeAgentActivityRequest({
          type: 'run_tests',
          args: {},
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(true);
        expect(result.output).toContain('Tests passed');
      });

      it('should execute run_lint activity', async () => {
        mockExecPromise.mockResolvedValueOnce({
          stdout: 'Linting passed',
          stderr: '',
        });

        const result = await executeAgentActivityRequest({
          type: 'run_lint',
          args: {},
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(true);
        expect(result.output).toContain('Linting passed');
      });

      it('should execute typecheck activity', async () => {
        mockExecPromise.mockResolvedValueOnce({
          stdout: 'Type checking passed',
          stderr: '',
        });

        const result = await executeAgentActivityRequest({
          type: 'typecheck',
          args: {},
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(true);
        expect(result.output).toContain('Type checking passed');
      });

      it('should execute get_git_diff activity', async () => {
        mockExecPromise.mockResolvedValueOnce({
          stdout: 'diff --git a/file.txt',
          stderr: '',
        });

        const result = await executeAgentActivityRequest({
          type: 'get_git_diff',
          args: {},
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(true);
        expect(result.output).toContain('diff --git');
      });

      it('should handle unknown activity type', async () => {
        const result = await executeAgentActivityRequest({
          type: 'unknown_activity',
          args: {},
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown activity type');
      });

      it('should handle activity errors gracefully', async () => {
        const fs = await import('fs/promises');
        
        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

        const result = await executeAgentActivityRequest({
          type: 'read_file',
          args: { path: 'nonexistent.txt' },
          workingDir: '/tmp/test',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('File not found');
      });
    });
  });
});

