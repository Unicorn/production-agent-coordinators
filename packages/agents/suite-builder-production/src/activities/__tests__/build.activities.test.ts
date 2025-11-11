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
      vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
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
      vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
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
  });

  describe('runTests', () => {
    it('should execute yarn test with coverage', async () => {
      vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
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
  });
});
