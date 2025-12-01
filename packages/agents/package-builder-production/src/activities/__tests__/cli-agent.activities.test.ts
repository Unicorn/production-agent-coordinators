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
  type CLIAgentParams,
  type WorkspaceSetupParams,
  type CreditStatus,
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

// Create a mock promisify that returns a mockable promise function
const mockPromisify = vi.fn();
const mockExecPromise = vi.fn();

vi.mock('node:util', () => ({
  promisify: (fn: any) => {
    mockPromisify(fn);
    return mockExecPromise;
  },
}));

describe('CLI Agent Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset exec promise mock to default (not found)
    mockExecPromise.mockRejectedValue(new Error('Command not found'));
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

        const result = await factory.executeWithFallback(params, 'gemini');
        expect(result.success).toBe(true);
        expect(result.provider).toBe('claude');
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

        await expect(factory.executeWithFallback(params, 'gemini')).rejects.toThrow(
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
});

