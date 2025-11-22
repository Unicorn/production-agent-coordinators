import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnFixAgent, verifyDependencies } from '../agent.activities';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('Agent Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('spawnFixAgent', () => {
    it('should categorize and format failures correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('Generic prompt template');

      await spawnFixAgent({
        packagePath: 'packages/core/test-package',
        planPath: 'plans/packages/core/test-package.md',
        failures: [
          { type: 'lint', message: 'Missing semicolon', file: 'src/index.ts', line: 10 },
          { type: 'type', message: 'Type error', file: 'src/types.ts', line: 5 },
          { type: 'build', message: 'Build failed' }
        ]
      });

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

      consoleSpy.mockRestore();
    });

    it('should handle failures without file/line information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.readFileSync).mockReturnValue('Generic prompt');

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [
          { type: 'build', message: 'Compilation failed' }
        ]
      });

      const failuresCall = consoleSpy.mock.calls.find(call =>
        call[0]?.toString().includes('Failures:')
      );
      const formattedFailures = failuresCall?.[0]?.split('\n')[1];
      expect(formattedFailures).toContain('BUILD: Compilation failed');
      expect(formattedFailures).not.toContain(':undefined');

      consoleSpy.mockRestore();
    });

    it('should use specific prompt when available', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock specific prompt exists
      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return filePath.toString().includes('build-lint.md');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('Specific build-lint prompt');

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [
          { type: 'build', message: 'Error' },
          { type: 'lint', message: 'Error' }
        ]
      });

      expect(consoleSpy).toHaveBeenCalledWith('Prompt template: Specific build-lint prompt');

      consoleSpy.mockRestore();
    });

    it('should fall back to generic prompt when specific does not exist', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(fs.existsSync).mockImplementation((filePath) => {
        return filePath.toString().includes('generic-developer.md');
      });
      vi.mocked(fs.readFileSync).mockReturnValue('Generic developer prompt');

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [
          { type: 'unknown', message: 'Unknown error' }
        ]
      });

      expect(consoleSpy).toHaveBeenCalledWith('Prompt template: Generic developer prompt');

      consoleSpy.mockRestore();
    });

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

      consoleSpy.mockRestore();
    });

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

      await spawnFixAgent({
        packagePath: 'packages/core/test',
        planPath: 'plans/packages/core/test.md',
        failures: [{ type: 'quality', message: 'Quality issue' }]
      });

      expect(fs.mkdirSync).toHaveBeenCalledWith('.claude/agents/fix-prompts', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('generic-developer.md'),
        'You are a package development agent. Fix the reported quality issues.'
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
