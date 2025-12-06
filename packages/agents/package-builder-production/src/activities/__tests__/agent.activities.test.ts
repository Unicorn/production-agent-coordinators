import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnFixAgent, verifyDependencies } from '../agent.activities';
import * as cliAgentActivities from '../cli-agent.activities';

// Mock CLI agent activities
vi.mock('../cli-agent.activities', () => ({
  executeCLIAgent: vi.fn(),
  selectCLIProvider: vi.fn(),
}));

describe('Agent Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('spawnFixAgent', () => {
    it('should categorize and format failures correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(cliAgentActivities.selectCLIProvider).mockResolvedValue({
        name: 'gemini',
        available: true,
      } as any);

      vi.mocked(cliAgentActivities.executeCLIAgent).mockResolvedValue({
        success: true,
        result: 'Fix complete',
        cost_usd: 0.01,
        provider: 'gemini',
      } as any);

      await spawnFixAgent({
        packagePath: 'packages/core/test-package',
        planPath: 'plans/packages/core/test-package.md',
        failures: [
          { type: 'lint', message: 'Missing semicolon', file: 'src/index.ts', line: 10 },
          { type: 'type', message: 'Type error', file: 'src/types.ts', line: 5 },
          { type: 'build', message: 'Build failed' }
        ]
      });

      // Verify provider was selected
      expect(cliAgentActivities.selectCLIProvider).toHaveBeenCalledWith('fix', 'gemini');

      // Verify CLI agent was called with correct instruction
      expect(cliAgentActivities.executeCLIAgent).toHaveBeenCalled();
      const executeCall = vi.mocked(cliAgentActivities.executeCLIAgent).mock.calls[0];
      expect(executeCall[0].instruction).toContain('Fix the following quality issues');
      expect(executeCall[0].instruction).toContain('LINT: src/index.ts:10 - Missing semicolon');
      expect(executeCall[0].instruction).toContain('TYPE: src/types.ts:5 - Type error');
      expect(executeCall[0].instruction).toContain('BUILD: Build failed');
      expect(executeCall[0].task).toBe('fix');

      // Verify console logs
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FixAgent] Using gemini CLI to fix')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FixAgent] Package:')
      );

      consoleSpy.mockRestore();
    });

    it('should handle failures without file/line information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(cliAgentActivities.selectCLIProvider).mockResolvedValue({
        name: 'claude',
        available: true,
      } as any);

      vi.mocked(cliAgentActivities.executeCLIAgent).mockResolvedValue({
        success: true,
        result: 'Fix complete',
        cost_usd: 0.02,
        provider: 'claude',
      } as any);

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [
          { type: 'build', message: 'Compilation failed' }
        ]
      });

      // Verify instruction contains formatted failure without file/line
      const executeCall = vi.mocked(cliAgentActivities.executeCLIAgent).mock.calls[0];
      expect(executeCall[0].instruction).toContain('BUILD: Compilation failed');
      expect(executeCall[0].instruction).not.toContain(':undefined');

      consoleSpy.mockRestore();
    });

    it('should format multiple failure types correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(cliAgentActivities.selectCLIProvider).mockResolvedValue({
        name: 'gemini',
        available: true,
      } as any);

      vi.mocked(cliAgentActivities.executeCLIAgent).mockResolvedValue({
        success: true,
        result: 'Fix complete',
        cost_usd: 0.01,
        provider: 'gemini',
      } as any);

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [
          { type: 'build', message: 'Error' },
          { type: 'lint', message: 'Error' }
        ]
      });

      // Verify instruction contains both failure types
      const executeCall = vi.mocked(cliAgentActivities.executeCLIAgent).mock.calls[0];
      expect(executeCall[0].instruction).toContain('BUILD: Error');
      expect(executeCall[0].instruction).toContain('LINT: Error');

      // Verify it logged the number of issue types
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FixAgent] Using gemini CLI to fix 2 issue types')
      );

      consoleSpy.mockRestore();
    });

    it('should handle unknown failure types', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(cliAgentActivities.selectCLIProvider).mockResolvedValue({
        name: 'gemini',
        available: true,
      } as any);

      vi.mocked(cliAgentActivities.executeCLIAgent).mockResolvedValue({
        success: true,
        result: 'Fix complete',
        cost_usd: 0.01,
        provider: 'gemini',
      } as any);

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [
          { type: 'unknown', message: 'Unknown error' }
        ]
      });

      // Verify instruction contains the unknown failure type
      const executeCall = vi.mocked(cliAgentActivities.executeCLIAgent).mock.calls[0];
      expect(executeCall[0].instruction).toContain('UNKNOWN: Unknown error');

      consoleSpy.mockRestore();
    });

    it('should throw error if CLI agent fails', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(cliAgentActivities.selectCLIProvider).mockResolvedValue({
        name: 'gemini',
        available: true,
      } as any);

      vi.mocked(cliAgentActivities.executeCLIAgent).mockResolvedValue({
        success: false,
        result: '',
        error: 'CLI execution failed',
        cost_usd: 0,
        provider: 'gemini',
      } as any);

      await expect(
        spawnFixAgent({
          packagePath: 'packages/core/test',
          planPath: 'plans/packages/core/test.md',
          failures: [{ type: 'test', message: 'Test failed' }]
        })
      ).rejects.toThrow('Fix agent failed: CLI execution failed');

      consoleSpy.mockRestore();
    });

    it('should log completion with cost and provider', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(cliAgentActivities.selectCLIProvider).mockResolvedValue({
        name: 'claude',
        available: true,
      } as any);

      vi.mocked(cliAgentActivities.executeCLIAgent).mockResolvedValue({
        success: true,
        result: 'Fix complete',
        cost_usd: 0.05,
        provider: 'claude',
      } as any);

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [{ type: 'quality', message: 'Quality issue' }]
      });

      // Verify completion log includes cost and provider
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FixAgent] Fix complete (cost: $0.05, provider: claude)')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('verifyDependencies', () => {
    it('should handle empty dependency list without logging', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await verifyDependencies([]);

      // Empty array doesn't log anything (only logs if length > 0)
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle non-array dependencies', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await verifyDependencies('invalid' as any);

      expect(consoleSpy).toHaveBeenCalledWith('No dependencies to verify');

      consoleSpy.mockRestore();
    });

    it('should handle null dependencies', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await verifyDependencies(null as any);

      expect(consoleSpy).toHaveBeenCalledWith('No dependencies to verify');

      consoleSpy.mockRestore();
    });

    it('should log count of dependencies to verify', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await verifyDependencies([
        '@bernierllc/core-types',
        '@bernierllc/validator-base',
        '@bernierllc/util-helpers'
      ]);

      expect(consoleSpy).toHaveBeenCalledWith('Verifying 3 dependencies...');

      consoleSpy.mockRestore();
    });

    it('should handle non-array input gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await verifyDependencies('invalid' as any);

      expect(consoleSpy).toHaveBeenCalledWith('No dependencies to verify');

      consoleSpy.mockRestore();
    });
  });
});
