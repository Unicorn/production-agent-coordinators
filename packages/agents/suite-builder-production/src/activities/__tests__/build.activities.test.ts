import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBuild, runTests, runQualityChecks, publishPackage } from '../build.activities';
import * as child_process from 'child_process';

// Mock child_process module
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

describe('Build Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runBuild', () => {
    it('should execute yarn build successfully', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(null, { stdout: 'Build successful', stderr: '' });
        return {} as any;
      });

      const result = await runBuild({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(child_process.exec).toHaveBeenCalled();
    });

    it('should handle build failures', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        const error: any = new Error('Build failed');
        error.stdout = '';
        error.stderr = 'Error';
        callback(error);
        return {} as any;
      });

      const result = await runBuild({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Error');
    });

    it('should use cwd option instead of cd command (security fix)', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        // Verify that the command doesn't contain 'cd' and that cwd is set in options
        expect(cmd).toBe('yarn build');
        expect(options).toHaveProperty('cwd');
        expect(options.cwd).toBe('/test/workspace/packages/core/test-package');
        callback(null, { stdout: 'Build successful', stderr: '' });
        return {} as any;
      });

      await runBuild({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(child_process.exec).toHaveBeenCalledWith(
        'yarn build',
        { cwd: '/test/workspace/packages/core/test-package' },
        expect.any(Function)
      );
    });
  });

  describe('runTests', () => {
    it('should execute yarn test with coverage', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(null, {
          stdout: 'Tests passed\nCoverage: 85%',
          stderr: ''
        });
        return {} as any;
      });

      const result = await runTests({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(result.success).toBe(true);
      expect(result.coverage).toBe(85);
      expect(child_process.exec).toHaveBeenCalled();
    });

    it('should use cwd option instead of cd command (security fix)', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        // Verify that the command doesn't contain 'cd' and that cwd is set in options
        expect(cmd).toBe('yarn test --run --coverage');
        expect(options).toHaveProperty('cwd');
        expect(options.cwd).toBe('/test/workspace/packages/core/test-package');
        callback(null, {
          stdout: 'Tests passed\nCoverage: 85%',
          stderr: ''
        });
        return {} as any;
      });

      await runTests({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(child_process.exec).toHaveBeenCalledWith(
        'yarn test --run --coverage',
        { cwd: '/test/workspace/packages/core/test-package' },
        expect.any(Function)
      );
    });
  });

  describe('runQualityChecks', () => {
    it('should execute quality validation successfully', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(null, {
          stdout: 'All checks passed',
          stderr: ''
        });
        return {} as any;
      });

      const result = await runQualityChecks({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should parse quality failures from output', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        const error: any = new Error('Validation failed');
        error.stdout = 'LINT ERROR: src/index.ts:10 - Missing semicolon';
        error.stderr = '';
        callback(error);
        return {} as any;
      });

      const result = await runQualityChecks({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
    });

    it('should use cwd option instead of cd command (security fix)', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        // Verify that the command doesn't contain 'cd' and that cwd is set in options
        expect(cmd).toBe('./manager validate-requirements');
        expect(options).toHaveProperty('cwd');
        expect(options.cwd).toBe('/test/workspace/packages/core/test-package');
        callback(null, {
          stdout: 'All checks passed',
          stderr: ''
        });
        return {} as any;
      });

      await runQualityChecks({
        workspaceRoot: '/test/workspace',
        packagePath: 'packages/core/test-package'
      });

      expect(child_process.exec).toHaveBeenCalledWith(
        './manager validate-requirements',
        { cwd: '/test/workspace/packages/core/test-package' },
        expect.any(Function)
      );
    });
  });

  describe('publishPackage', () => {
    it('should publish package with npm token', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(null, {
          stdout: '+ @bernierllc/test-package@0.1.0',
          stderr: ''
        });
        return {} as any;
      });

      const result = await publishPackage({
        packageName: '@bernierllc/test-package',
        packagePath: 'packages/core/test-package',
        config: {
          npmToken: 'test-token',
          workspaceRoot: '/test/workspace'
        } as any
      });

      expect(result.success).toBe(true);
    });

    it('should use cwd option instead of cd command (security fix)', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, options: any, callback: any) => {
        // Verify that the command doesn't contain 'cd' and that cwd is set in options
        expect(cmd).toBe('npm publish --access restricted');
        expect(options).toHaveProperty('cwd');
        expect(options.cwd).toBe('/test/workspace/packages/core/test-package');
        expect(options).toHaveProperty('env');
        expect(options.env?.NPM_TOKEN).toBe('test-token');
        callback(null, {
          stdout: '+ @bernierllc/test-package@0.1.0',
          stderr: ''
        });
        return {} as any;
      });

      await publishPackage({
        packageName: '@bernierllc/test-package',
        packagePath: 'packages/core/test-package',
        config: {
          npmToken: 'test-token',
          workspaceRoot: '/test/workspace'
        } as any
      });

      expect(child_process.exec).toHaveBeenCalledWith(
        'npm publish --access restricted',
        {
          cwd: '/test/workspace/packages/core/test-package',
          env: expect.objectContaining({ NPM_TOKEN: 'test-token' })
        },
        expect.any(Function)
      );
    });
  });
});
