import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBuild, runTests, runQualityChecks, publishPackage, buildDependencyGraph } from '../build.activities';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';

// Mock child_process module
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock fs/promises module
vi.mock('fs/promises');

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

  describe('buildDependencyGraph', () => {
    it('should parse audit report and create dependency graph', async () => {
      const mockReport = {
        packageName: '@bernierllc/suite',
        checks: {
          packageDependencies: [
            '@bernierllc/core-a',
            '@bernierllc/service-b'
          ]
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockReport));

      const result = await buildDependencyGraph('/tmp/test-audit-report.json');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('category');
      expect(result[0]).toHaveProperty('layer');
      expect(result[0]).toHaveProperty('dependencies');
      expect(result[0]).toHaveProperty('buildStatus');
    });

    it('should categorize packages correctly', async () => {
      const mockReport = {
        packageName: '@bernierllc/content-management-suite',
        checks: {
          packageDependencies: [
            '@bernierllc/validator-base',
            '@bernierllc/core-types',
            '@bernierllc/util-helpers',
            '@bernierllc/service-api',
            '@bernierllc/ui-components'
          ]
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockReport));

      const result = await buildDependencyGraph('/tmp/test-audit-report.json');

      // Find packages by category
      const validator = result.find(p => p.category === 'validator');
      const core = result.find(p => p.category === 'core');
      const utility = result.find(p => p.category === 'utility');
      const service = result.find(p => p.category === 'service');
      const ui = result.find(p => p.category === 'ui');
      const suite = result.find(p => p.category === 'suite');

      expect(validator).toBeDefined();
      expect(core).toBeDefined();
      expect(utility).toBeDefined();
      expect(service).toBeDefined();
      expect(ui).toBeDefined();
      expect(suite).toBeDefined();
    });

    it('should assign layers based on category', async () => {
      const mockReport = {
        packageName: '@bernierllc/suite',
        checks: {
          packageDependencies: [
            '@bernierllc/validator-base',
            '@bernierllc/core-types'
          ]
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockReport));

      const result = await buildDependencyGraph('/tmp/test-audit-report.json');

      // Validators should be layer 0
      const validator = result.find(p => p.name.includes('validator'));
      expect(validator?.layer).toBe(0);

      // Core should be layer 1
      const core = result.find(p => p.name.includes('core'));
      expect(core?.layer).toBe(1);

      // Suite should be layer 5
      const suite = result.find(p => p.name.includes('suite'));
      expect(suite?.layer).toBe(5);

      // Should be sorted by layer (ascending)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].layer).toBeGreaterThanOrEqual(result[i - 1].layer);
      }
    });

    it('should set initial buildStatus to pending', async () => {
      const mockReport = {
        packageName: '@bernierllc/test-package',
        checks: {
          packageDependencies: ['@bernierllc/dep-1']
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockReport));

      const result = await buildDependencyGraph('/tmp/test-audit-report.json');

      result.forEach(pkg => {
        expect(pkg.buildStatus).toBe('pending');
      });
    });
  });
});
