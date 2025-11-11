import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBuild, runTests } from '../build.activities';
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
});
