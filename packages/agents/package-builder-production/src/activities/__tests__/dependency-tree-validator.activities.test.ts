import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validatePackagePublishStatus,
<<<<<<< HEAD
  validateDependencyTreePublishStatus
=======
  validateDependencyTreePublishStatus,
  type PackagePublishStatus,
  type DependencyTreeValidation
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
} from '../dependency-tree-validator.activities';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';

// Mock child_process module
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

// Mock fs/promises module
vi.mock('fs/promises');

describe('Dependency Tree Validator Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePackagePublishStatus', () => {
    describe('Published packages (exist on npm)', () => {
      it('should identify published package with matching version as "already published"', async () => {
        // Mock npm view to return version 1.0.1
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view')) {
            callback(null, { stdout: '1.0.1', stderr: '' });
          }
          return {} as any;
        });

        // Mock local package.json to return same version
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ version: '1.0.1' })
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/logger',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/logger',
          planPath: 'plans/packages/core/logger.md'
        });

        expect(result.isPublished).toBe(true);
        expect(result.isNew).toBe(false);
        expect(result.npmVersion).toBe('1.0.1');
        expect(result.localVersion).toBe('1.0.1');
        expect(result.needsPublish).toBe(false);
        expect(result.needsVersionBump).toBe(false);
        expect(result.reason).toContain('Already published at v1.0.1');
      });

      it('should identify published package with newer local version', async () => {
        // Mock npm view to return version 1.0.1
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view')) {
            callback(null, { stdout: '1.0.1', stderr: '' });
          }
          return {} as any;
        });

        // Mock local package.json to return newer version
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ version: '1.0.2' })
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/logger',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/logger',
          planPath: 'plans/packages/core/logger.md'
        });

        expect(result.isPublished).toBe(true);
        expect(result.isNew).toBe(false);
        expect(result.npmVersion).toBe('1.0.1');
        expect(result.localVersion).toBe('1.0.2');
        expect(result.needsPublish).toBe(true);
        expect(result.needsVersionBump).toBe(false);
        expect(result.reason).toContain('1.0.1 → 1.0.2');
      });

      it('should detect update plan with same version (needs version bump)', async () => {
        // Mock npm view to return version 1.0.1
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view')) {
            callback(null, { stdout: '1.0.1', stderr: '' });
          }
          return {} as any;
        });

        // Mock local package.json to return same version
        vi.mocked(fs.readFile).mockResolvedValueOnce(
          JSON.stringify({ version: '1.0.1' })
        );

        // Mock plan file to indicate update
        vi.mocked(fs.readFile).mockResolvedValueOnce(
          'Update the logger package to add new features'
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/logger',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/logger',
          planPath: 'plans/packages/core/logger.md'
        });

        expect(result.isPublished).toBe(true);
        expect(result.isNew).toBe(false);
        expect(result.isUpdate).toBe(true);
        expect(result.needsPublish).toBe(false);
        expect(result.needsVersionBump).toBe(true);
        expect(result.reason).toContain('Update plan detected but version not bumped');
      });

      it('should identify already-published dependency (no local source)', async () => {
        // Mock npm view to return version 1.0.1
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view')) {
            callback(null, { stdout: '1.0.1', stderr: '' });
          }
          return {} as any;
        });

        // Mock local package.json to throw (no local source)
        vi.mocked(fs.readFile).mockRejectedValue(
          new Error('ENOENT: no such file or directory')
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/logger',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/logger',
          planPath: 'plans/packages/core/logger.md'
        });

        expect(result.isPublished).toBe(true);
        expect(result.isNew).toBe(false);
        expect(result.npmVersion).toBe('1.0.1');
        expect(result.localVersion).toBe('1.0.1'); // Uses npm version as local
        expect(result.needsPublish).toBe(false);
        expect(result.needsVersionBump).toBe(false);
        expect(result.reason).toContain('Already published dependency');
      });
    });

    describe('Unpublished packages (new packages)', () => {
      it('should identify new package with 404 error', async () => {
        // Mock npm view to return 404 error
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view')) {
            const error: any = new Error('npm ERR! code E404');
            error.message = 'npm ERR! 404 Not Found - GET https://registry.npmjs.org/@bernierllc%2fnew-package - Not found';
            callback(error);
          }
          return {} as any;
        });

        // Mock local package.json to return version 0.1.0
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ version: '0.1.0' })
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/new-package',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/new-package',
          planPath: 'plans/packages/core/new-package.md'
        });

        expect(result.isPublished).toBe(false);
        expect(result.isNew).toBe(true);
        expect(result.npmVersion).toBe(null);
        expect(result.localVersion).toBe('0.1.0');
        expect(result.needsPublish).toBe(true);
        expect(result.needsVersionBump).toBe(false);
        expect(result.reason).toContain('New package - never published to npm');
      });

      it('should identify new package with E404 error format', async () => {
        // Mock npm view to return E404 error (alternative format)
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view')) {
            const error: any = new Error('E404');
            callback(error);
          }
          return {} as any;
        });

        // Mock local package.json to return version 0.1.0
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ version: '0.1.0' })
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/another-new-package',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/another-new-package',
          planPath: 'plans/packages/core/another-new-package.md'
        });

        expect(result.isPublished).toBe(false);
        expect(result.isNew).toBe(true);
        expect(result.needsPublish).toBe(true);
        expect(result.reason).toContain('New package - never published to npm');
      });
    });

    describe('Real-world npm packages (verify actual packages)', () => {
      it('should correctly identify @bernierllc/logger as published', async () => {
        // Mock npm view to return actual version from npm
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view @bernierllc/logger')) {
            callback(null, { stdout: '1.0.1', stderr: '' });
          }
          return {} as any;
        });

        // Mock local package.json to return same version
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ version: '1.0.1' })
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/logger',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/logger',
          planPath: 'plans/packages/core/logger.md'
        });

        expect(result.isPublished).toBe(true);
        expect(result.isNew).toBe(false);
        expect(result.needsPublish).toBe(false);
      });

      it('should correctly identify @bernierllc/markdown-renderer as published', async () => {
        // Mock npm view to return actual version from npm
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view @bernierllc/markdown-renderer')) {
            callback(null, { stdout: '0.2.2', stderr: '' });
          }
          return {} as any;
        });

        // Mock local package.json to return same version
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ version: '0.2.2' })
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/markdown-renderer',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/markdown-renderer',
          planPath: 'plans/packages/core/markdown-renderer.md'
        });

        expect(result.isPublished).toBe(true);
        expect(result.isNew).toBe(false);
        expect(result.needsPublish).toBe(false);
      });

      it('should correctly identify @bernierllc/template-engine as published', async () => {
        // Mock npm view to return actual version from npm
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view @bernierllc/template-engine')) {
            callback(null, { stdout: '0.1.2', stderr: '' });
          }
          return {} as any;
        });

        // Mock local package.json to return same version
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ version: '0.1.2' })
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/template-engine',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/template-engine',
          planPath: 'plans/packages/core/template-engine.md'
        });

        expect(result.isPublished).toBe(true);
        expect(result.isNew).toBe(false);
        expect(result.needsPublish).toBe(false);
      });

      it('should correctly identify @bernierllc/config-manager as published', async () => {
        // Mock npm view to return actual version from npm
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view @bernierllc/config-manager')) {
            callback(null, { stdout: '1.0.3', stderr: '' });
          }
          return {} as any;
        });

        // Mock local package.json to return same version
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ version: '1.0.3' })
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/config-manager',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/config-manager',
          planPath: 'plans/packages/core/config-manager.md'
        });

        expect(result.isPublished).toBe(true);
        expect(result.isNew).toBe(false);
        expect(result.needsPublish).toBe(false);
      });

      it('should correctly identify @bernierllc/content-transformer as published', async () => {
        // Mock npm view to return actual version from npm
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view @bernierllc/content-transformer')) {
            callback(null, { stdout: '1.0.1', stderr: '' });
          }
          return {} as any;
        });

        // Mock local package.json to return same version
        vi.mocked(fs.readFile).mockResolvedValue(
          JSON.stringify({ version: '1.0.1' })
        );

        const result = await validatePackagePublishStatus({
          packageName: '@bernierllc/content-transformer',
          workspaceRoot: '/test/workspace',
          packagePath: 'packages/core/content-transformer',
          planPath: 'plans/packages/core/content-transformer.md'
        });

        expect(result.isPublished).toBe(true);
        expect(result.isNew).toBe(false);
        expect(result.needsPublish).toBe(false);
      });
    });

    describe('Error handling', () => {
      it('should throw error for package not found locally or on npm', async () => {
        // Mock npm view to return 404
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view')) {
            const error: any = new Error('E404');
            callback(error);
          }
          return {} as any;
        });

        // Mock local package.json to throw
        vi.mocked(fs.readFile).mockRejectedValue(
          new Error('ENOENT: no such file or directory')
        );

        await expect(
          validatePackagePublishStatus({
            packageName: '@bernierllc/nonexistent',
            workspaceRoot: '/test/workspace',
            packagePath: 'packages/core/nonexistent',
            planPath: 'plans/packages/core/nonexistent.md'
          })
        ).rejects.toThrow('Package @bernierllc/nonexistent not found locally or on npm');
      });

      it('should throw error for unexpected npm view errors', async () => {
        // Mock npm view to return unexpected error
        vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
          if (cmd.includes('npm view')) {
            const error: any = new Error('Network error');
            callback(error);
          }
          return {} as any;
        });

        await expect(
          validatePackagePublishStatus({
            packageName: '@bernierllc/test',
            workspaceRoot: '/test/workspace',
            packagePath: 'packages/core/test',
            planPath: 'plans/packages/core/test.md'
          })
        ).rejects.toThrow('Network error');
      });
    });
  });

  describe('validateDependencyTreePublishStatus', () => {
    it('should validate entire dependency tree and categorize packages', async () => {
      // Mock npm view calls
      vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('npm view @bernierllc/published-package')) {
          callback(null, { stdout: '1.0.0', stderr: '' });
        } else if (cmd.includes('npm view @bernierllc/new-package')) {
          const error: any = new Error('E404');
          callback(error);
        } else if (cmd.includes('npm view @bernierllc/needs-bump')) {
          callback(null, { stdout: '1.0.0', stderr: '' });
        }
        return {} as any;
      });

      // Mock package.json and plan file reads in sequence
      // NOTE: ALL packages read plan files (even new ones), so sequence is:
      // Call 1: published-package package.json
      // Call 2: published-package plan file
      // Call 3: new-package package.json
      // Call 4: new-package plan file (NEW packages DO read plan files!)
      // Call 5: needs-bump package.json
      // Call 6: needs-bump plan file
      let fileCallCount = 0;
<<<<<<< HEAD
      vi.mocked(fs.readFile).mockImplementation(async (_path: any, _encoding?: any) => {
=======
      vi.mocked(fs.readFile).mockImplementation(async (path: any, encoding?: any) => {
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
        fileCallCount++;

        if (fileCallCount === 1) {
          return JSON.stringify({ version: '1.0.0' }) as any; // published-package package.json
        } else if (fileCallCount === 2) {
          return 'Build a new published package' as any; // published-package plan file (not an update)
        } else if (fileCallCount === 3) {
          return JSON.stringify({ version: '0.1.0' }) as any; // new-package package.json
        } else if (fileCallCount === 4) {
          return 'Build a new package' as any; // new-package plan file (not an update)
        } else if (fileCallCount === 5) {
          return JSON.stringify({ version: '1.0.0' }) as any; // needs-bump package.json
        } else if (fileCallCount === 6) {
          return 'Update the existing package to add features' as any; // needs-bump plan file (IS an update)
        }

        throw new Error(`Unexpected file read (call ${fileCallCount}): ${path}`);
      });

      const result = await validateDependencyTreePublishStatus({
        packages: [
          {
            packageName: '@bernierllc/published-package',
            packagePath: 'packages/core/published-package',
            planPath: 'plans/packages/core/published-package.md',
            category: 'core'
          },
          {
            packageName: '@bernierllc/new-package',
            packagePath: 'packages/core/new-package',
            planPath: 'plans/packages/core/new-package.md',
            category: 'core'
          },
          {
            packageName: '@bernierllc/needs-bump',
            packagePath: 'packages/core/needs-bump',
            planPath: 'plans/packages/core/needs-bump.md',
            category: 'core'
          }
        ],
        workspaceRoot: '/test/workspace'
      });

      expect(result.packagesToPublish).toContain('@bernierllc/new-package');
      expect(result.packagesToSkip).toContain('@bernierllc/published-package');
      expect(result.packagesNeedingVersionBump).toContain('@bernierllc/needs-bump');
      expect(result.validationErrors).toHaveLength(0);
      expect(result.allPackagesValid).toBe(false); // Has version bumps needed
      expect(result.packageStatuses).toHaveLength(3);
    });

    it('should skip already-published packages', async () => {
      // Mock npm view to return versions for all packages
      vi.mocked(child_process.exec).mockImplementation((cmd: any, callback: any) => {
        if (cmd.includes('npm view @bernierllc/package-1')) {
          callback(null, { stdout: '1.0.0', stderr: '' });
        } else if (cmd.includes('npm view @bernierllc/package-2')) {
          callback(null, { stdout: '2.0.0', stderr: '' });
        }
        return {} as any;
      });

      // Mock package.json reads (same versions as npm)
      let callCount = 0;
<<<<<<< HEAD
      vi.mocked(fs.readFile).mockImplementation(async (_path: any) => {
=======
      vi.mocked(fs.readFile).mockImplementation(async (path: any) => {
>>>>>>> 9a45c12 (chore: commit worktree changes from Cursor IDE)
        callCount++;
        if (callCount === 1) {
          return JSON.stringify({ version: '1.0.0' });
        } else if (callCount === 2) {
          return JSON.stringify({ version: '2.0.0' });
        } else if (callCount === 3 || callCount === 4) {
          // Plan files - not updates
          return 'Build the package';
        }
        throw new Error('Unexpected file read');
      });

      const result = await validateDependencyTreePublishStatus({
        packages: [
          {
            packageName: '@bernierllc/package-1',
            packagePath: 'packages/core/package-1',
            planPath: 'plans/packages/core/package-1.md',
            category: 'core'
          },
          {
            packageName: '@bernierllc/package-2',
            packagePath: 'packages/core/package-2',
            planPath: 'plans/packages/core/package-2.md',
            category: 'core'
          }
        ],
        workspaceRoot: '/test/workspace'
      });

      expect(result.packagesToSkip).toHaveLength(2);
      expect(result.packagesToPublish).toHaveLength(0);
      expect(result.allPackagesValid).toBe(true);
    });
  });
});
