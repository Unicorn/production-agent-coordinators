import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnFixAgent, verifyDependencies } from '../agent.activities';
<<<<<<< HEAD
import * as cliAgentActivities from '../cli-agent.activities';

// Mock CLI agent activities
vi.mock('../cli-agent.activities', () => ({
  executeCLIAgent: vi.fn(),
  selectCLIProvider: vi.fn(),
=======
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
}));

describe('Agent Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('spawnFixAgent', () => {
    it('should categorize and format failures correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

<<<<<<< HEAD
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
=======
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('Generic prompt template');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      await spawnFixAgent({
        packagePath: 'packages/core/test-package',
        planPath: 'plans/packages/core/test-package.md',
        failures: [
          { type: 'lint', message: 'Missing semicolon', file: 'src/index.ts', line: 10 },
          { type: 'type', message: 'Type error', file: 'src/types.ts', line: 5 },
          { type: 'build', message: 'Build failed' }
        ]
      });

<<<<<<< HEAD
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
=======
      // Verify failure types were extracted
      expect(consoleSpy).toHaveBeenCalledWith('Would spawn agent with prompt:');
      expect(consoleSpy).toHaveBeenCalledWith('Package: packages/core/test-package');
      expect(consoleSpy).toHaveBeenCalledWith('Plan: plans/packages/core/test-package.md');

      // Verify failures were formatted correctly
      const failuresCall = consoleSpy.mock.calls.find(call =>
        call[0]?.toString().includes('Failures:')
      );
      expect(failuresCall).toBeDefined();
      const formattedFailures = failuresCall?.[0]?.split('\n')[1];
      expect(formattedFailures).toContain('LINT: src/index.ts:10 - Missing semicolon');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      consoleSpy.mockRestore();
    });

    it('should handle failures without file/line information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

<<<<<<< HEAD
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
=======
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('Generic prompt');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [
          { type: 'build', message: 'Compilation failed' }
        ]
      });

<<<<<<< HEAD
      // Verify instruction contains formatted failure without file/line
      const executeCall = vi.mocked(cliAgentActivities.executeCLIAgent).mock.calls[0];
      expect(executeCall[0].instruction).toContain('BUILD: Compilation failed');
      expect(executeCall[0].instruction).not.toContain(':undefined');
=======
      const failuresCall = consoleSpy.mock.calls.find(call =>
        call[0]?.toString().includes('Failures:')
      );
      const formattedFailures = failuresCall?.[0]?.split('\n')[1];
      expect(formattedFailures).toContain('BUILD: Compilation failed');
      expect(formattedFailures).not.toContain(':undefined');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      consoleSpy.mockRestore();
    });

<<<<<<< HEAD
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
=======
    it('should use specific prompt when available', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock specific prompt exists
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return filePath.toString().includes('build-lint.md');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('Specific build-lint prompt');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [
          { type: 'build', message: 'Error' },
          { type: 'lint', message: 'Error' }
        ]
      });

<<<<<<< HEAD
      // Verify instruction contains both failure types
      const executeCall = vi.mocked(cliAgentActivities.executeCLIAgent).mock.calls[0];
      expect(executeCall[0].instruction).toContain('BUILD: Error');
      expect(executeCall[0].instruction).toContain('LINT: Error');

      // Verify it logged the number of issue types
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FixAgent] Using gemini CLI to fix 2 issue types')
      );
=======
      expect(consoleSpy).toHaveBeenCalledWith('Prompt template: Specific build-lint prompt');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      consoleSpy.mockRestore();
    });

<<<<<<< HEAD
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
=======
    it('should fall back to generic prompt when specific does not exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return filePath.toString().includes('generic-developer.md');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('Generic developer prompt');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [
          { type: 'unknown', message: 'Unknown error' }
        ]
      });

<<<<<<< HEAD
      // Verify instruction contains the unknown failure type
      const executeCall = vi.mocked(cliAgentActivities.executeCLIAgent).mock.calls[0];
      expect(executeCall[0].instruction).toContain('UNKNOWN: Unknown error');
=======
      expect(consoleSpy).toHaveBeenCalledWith('Prompt template: Generic developer prompt');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      consoleSpy.mockRestore();
    });

<<<<<<< HEAD
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
=======
    it('should create generic prompt from template if not exists', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Generic prompt doesn't exist, template does
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        return pathStr.includes('package-development-agent.md');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('Template prompt content');

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [{ type: 'test', message: 'Test failed' }]
      });

      expect(fs.mkdirSync).toHaveBeenCalledWith('.claude/agents/fix-prompts', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalled();
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      consoleSpy.mockRestore();
    });

<<<<<<< HEAD
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
=======
    it('should create minimal fallback prompt if template not found', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Nothing exists
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('generic-developer.md')) {
          return 'You are a package development agent. Fix the reported quality issues.';
        }
        throw new Error('File not found');
      });
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [{ type: 'quality', message: 'Quality issue' }]
      });

<<<<<<< HEAD
      // Verify completion log includes cost and provider
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[FixAgent] Fix complete (cost: $0.05, provider: claude)')
=======
      expect(fs.mkdirSync).toHaveBeenCalledWith('.claude/agents/fix-prompts', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('generic-developer.md'),
        'You are a package development agent. Fix the reported quality issues.'
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('verifyDependencies', () => {
<<<<<<< HEAD
    it('should handle empty dependency list without logging', async () => {
=======
    it('should handle empty dependency list', async () => {
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await verifyDependencies([]);

<<<<<<< HEAD
      // Empty array doesn't log anything (only logs if length > 0)
      expect(consoleSpy).not.toHaveBeenCalled();
=======
      expect(consoleSpy).toHaveBeenCalledWith('Verifying 0 dependencies...');
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

      consoleSpy.mockRestore();
    });

<<<<<<< HEAD
    it('should handle non-array dependencies', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await verifyDependencies('invalid' as any);
=======
    it('should handle undefined dependencies', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await verifyDependencies(undefined);
>>>>>>> 60f2dcf (chore: commit worktree changes from Cursor IDE)

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
