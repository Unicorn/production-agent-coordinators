import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { determineVersionBump, publishToNpm, updateDependentVersions, publishDeprecationNotice } from '../publish.activities';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

const execAsync = promisify(exec);

describe('Publishing Activities', () => {
  describe('determineVersionBump', () => {
    it('should bump major version for breaking changes', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.0.0',
        changeType: 'major'
      });

      expect(result.newVersion).toBe('2.0.0');
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.changeType).toBe('major');
    });

    it('should bump minor version for new features', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.0.0',
        changeType: 'minor'
      });

      expect(result.newVersion).toBe('1.1.0');
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.changeType).toBe('minor');
    });

    it('should bump patch version for bug fixes', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.0.0',
        changeType: 'patch'
      });

      expect(result.newVersion).toBe('1.0.1');
      expect(result.previousVersion).toBe('1.0.0');
      expect(result.changeType).toBe('patch');
    });

    it('should handle first version bump', async () => {
      const result = await determineVersionBump({
        currentVersion: '0.0.0',
        changeType: 'major'
      });

      expect(result.newVersion).toBe('1.0.0');
      expect(result.previousVersion).toBe('0.0.0');
      expect(result.changeType).toBe('major');
    });

    it('should handle pre-release versions', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.0.0-alpha.1',
        changeType: 'patch'
      });

      expect(result.newVersion).toBe('1.0.0');
      expect(result.previousVersion).toBe('1.0.0-alpha.1');
      expect(result.changeType).toBe('patch');
    });

    it('should throw error for empty currentVersion', async () => {
      await expect(
        determineVersionBump({
          currentVersion: '',
          changeType: 'major'
        })
      ).rejects.toThrow('currentVersion cannot be empty');
    });

    it('should throw error for invalid changeType', async () => {
      await expect(
        determineVersionBump({
          currentVersion: '1.0.0',
          changeType: 'invalid' as any
        })
      ).rejects.toThrow('Invalid changeType: invalid');
    });

    it('should throw error for invalid semver version', async () => {
      await expect(
        determineVersionBump({
          currentVersion: 'not-a-version',
          changeType: 'major'
        })
      ).rejects.toThrow('Invalid semver version: not-a-version');
    });

    it('should handle complex version numbers', async () => {
      const result = await determineVersionBump({
        currentVersion: '2.5.7',
        changeType: 'minor'
      });

      expect(result.newVersion).toBe('2.6.0');
      expect(result.previousVersion).toBe('2.5.7');
    });

    it('should reset minor and patch when bumping major', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.5.7',
        changeType: 'major'
      });

      expect(result.newVersion).toBe('2.0.0');
      expect(result.previousVersion).toBe('1.5.7');
    });

    it('should reset patch when bumping minor', async () => {
      const result = await determineVersionBump({
        currentVersion: '1.5.7',
        changeType: 'minor'
      });

      expect(result.newVersion).toBe('1.6.0');
      expect(result.previousVersion).toBe('1.5.7');
    });
  });

  describe('publishToNpm', () => {
    const tempDir = '/tmp/test-publish-package';
    const mockPackageJson = {
      name: '@bernierllc/test-package',
      version: '1.0.0',
      description: 'Test package'
    };

    beforeEach(async () => {
      // Create temp directory and package.json
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(mockPackageJson, null, 2)
      );
    });

    afterEach(async () => {
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
      vi.clearAllMocks();
    });

    it('should successfully publish to npm with default private access', async () => {
      // Mock successful npm publish
      vi.mocked(exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(null, { stdout: '+ @bernierllc/test-package@1.5.0', stderr: '' });
        return {} as any;
      });

      const result = await publishToNpm({
        packagePath: tempDir,
        version: '1.5.0'
      });

      expect(result.success).toBe(true);
      expect(result.publishedVersion).toBe('1.5.0');
      expect(result.packageName).toBe('@bernierllc/test-package');
      expect(result.error).toBeUndefined();

      // Verify package.json was updated
      const updatedPackageJson = JSON.parse(
        await fs.readFile(path.join(tempDir, 'package.json'), 'utf-8')
      );
      expect(updatedPackageJson.version).toBe('1.5.0');

      // Verify npm publish command was called with --access=restricted
      expect(exec).toHaveBeenCalledWith(
        'npm publish --access=restricted',
        { cwd: tempDir },
        expect.any(Function)
      );
    });

    it('should successfully publish to npm with explicit public access', async () => {
      // Mock successful npm publish
      vi.mocked(exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(null, { stdout: '+ @bernierllc/test-package@2.0.0', stderr: '' });
        return {} as any;
      });

      const result = await publishToNpm({
        packagePath: tempDir,
        version: '2.0.0',
        isPublic: true
      });

      expect(result.success).toBe(true);
      expect(result.publishedVersion).toBe('2.0.0');
      expect(result.packageName).toBe('@bernierllc/test-package');

      // Verify npm publish command was called with --access=public
      expect(exec).toHaveBeenCalledWith(
        'npm publish --access=public',
        { cwd: tempDir },
        expect.any(Function)
      );
    });

    it('should handle failed publish with npm error', async () => {
      // Mock failed npm publish
      vi.mocked(exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(new Error('npm ERR! 403 Forbidden'), { stdout: '', stderr: 'npm ERR! 403 Forbidden' });
        return {} as any;
      });

      const result = await publishToNpm({
        packagePath: tempDir,
        version: '1.5.0'
      });

      expect(result.success).toBe(false);
      expect(result.publishedVersion).toBe('1.5.0');
      expect(result.packageName).toBe('@bernierllc/test-package');
      expect(result.error).toContain('npm ERR! 403 Forbidden');
    });

    it('should throw error for empty packagePath', async () => {
      await expect(
        publishToNpm({
          packagePath: '',
          version: '1.0.0'
        })
      ).rejects.toThrow('packagePath cannot be empty');
    });

    it('should throw error for empty version', async () => {
      await expect(
        publishToNpm({
          packagePath: tempDir,
          version: ''
        })
      ).rejects.toThrow('version cannot be empty');
    });

    it('should support dry run mode', async () => {
      // Mock successful npm publish with dry-run
      vi.mocked(exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(null, { stdout: '+ @bernierllc/test-package@1.5.0 (dry-run)', stderr: '' });
        return {} as any;
      });

      const result = await publishToNpm({
        packagePath: tempDir,
        version: '1.5.0',
        dryRun: true
      });

      expect(result.success).toBe(true);

      // Verify npm publish command was called with --dry-run
      expect(exec).toHaveBeenCalledWith(
        'npm publish --access=restricted --dry-run',
        { cwd: tempDir },
        expect.any(Function)
      );
    });

    it('should extract registry URL from npm output', async () => {
      // Mock successful npm publish with registry URL
      vi.mocked(exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(null, {
          stdout: '+ @bernierllc/test-package@1.5.0\nhttps://registry.npmjs.org/@bernierllc/test-package',
          stderr: ''
        });
        return {} as any;
      });

      const result = await publishToNpm({
        packagePath: tempDir,
        version: '1.5.0'
      });

      expect(result.success).toBe(true);
      expect(result.registryUrl).toBeDefined();
    });

    it('should update package.json version before publishing', async () => {
      // Mock successful npm publish
      vi.mocked(exec).mockImplementation((cmd: any, options: any, callback: any) => {
        callback(null, { stdout: '+ @bernierllc/test-package@2.0.0', stderr: '' });
        return {} as any;
      });

      await publishToNpm({
        packagePath: tempDir,
        version: '2.0.0'
      });

      // Verify package.json was updated with new version
      const updatedPackageJson = JSON.parse(
        await fs.readFile(path.join(tempDir, 'package.json'), 'utf-8')
      );
      expect(updatedPackageJson.version).toBe('2.0.0');
    });
  });

  describe('updateDependentVersions', () => {
    let tempWorkspaceRoot: string;

    beforeEach(async () => {
      // Create temporary workspace structure
      tempWorkspaceRoot = '/tmp/test-workspace-' + Date.now();
      const packagesDir = path.join(tempWorkspaceRoot, 'packages');

      await fs.mkdir(packagesDir, { recursive: true });

      // Create package A (the one being updated)
      const pkgAPath = path.join(packagesDir, 'package-a');
      await fs.mkdir(pkgAPath, { recursive: true });
      await fs.writeFile(
        path.join(pkgAPath, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/package-a',
          version: '1.0.0'
        }, null, 2)
      );

      // Create package B (depends on A)
      const pkgBPath = path.join(packagesDir, 'package-b');
      await fs.mkdir(pkgBPath, { recursive: true });
      await fs.writeFile(
        path.join(pkgBPath, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/package-b',
          version: '1.0.0',
          dependencies: {
            '@bernierllc/package-a': '^1.0.0'
          }
        }, null, 2)
      );

      // Create package C (depends on A in devDependencies)
      const pkgCPath = path.join(packagesDir, 'package-c');
      await fs.mkdir(pkgCPath, { recursive: true });
      await fs.writeFile(
        path.join(pkgCPath, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/package-c',
          version: '1.0.0',
          devDependencies: {
            '@bernierllc/package-a': '^1.0.0'
          }
        }, null, 2)
      );

      // Create package D (depends on A in both dependencies and devDependencies)
      const pkgDPath = path.join(packagesDir, 'package-d');
      await fs.mkdir(pkgDPath, { recursive: true });
      await fs.writeFile(
        path.join(pkgDPath, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/package-d',
          version: '1.0.0',
          dependencies: {
            '@bernierllc/package-a': '^1.0.0'
          },
          devDependencies: {
            '@bernierllc/package-a': '^1.0.0'
          }
        }, null, 2)
      );

      // Create package E (does not depend on A)
      const pkgEPath = path.join(packagesDir, 'package-e');
      await fs.mkdir(pkgEPath, { recursive: true });
      await fs.writeFile(
        path.join(pkgEPath, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/package-e',
          version: '1.0.0',
          dependencies: {
            '@bernierllc/package-b': '^1.0.0'
          }
        }, null, 2)
      );
    });

    afterEach(async () => {
      // Clean up temporary workspace
      await fs.rm(tempWorkspaceRoot, { recursive: true, force: true });
    });

    it('should update single dependent package', async () => {
      const result = await updateDependentVersions({
        packageName: '@bernierllc/package-a',
        newVersion: '^2.0.0',
        workspaceRoot: tempWorkspaceRoot
      });

      expect(result.updatedPackages).toHaveLength(3); // B, C, D

      // Verify package B was updated
      const pkgBJson = JSON.parse(
        await fs.readFile(
          path.join(tempWorkspaceRoot, 'packages/package-b/package.json'),
          'utf-8'
        )
      );
      expect(pkgBJson.dependencies['@bernierllc/package-a']).toBe('^2.0.0');
    });

    it('should update multiple dependent packages', async () => {
      const result = await updateDependentVersions({
        packageName: '@bernierllc/package-a',
        newVersion: '^2.0.0',
        workspaceRoot: tempWorkspaceRoot
      });

      expect(result.updatedPackages).toHaveLength(3);

      const packageNames = result.updatedPackages.map(p => p.packageName);
      expect(packageNames).toContain('@bernierllc/package-b');
      expect(packageNames).toContain('@bernierllc/package-c');
      expect(packageNames).toContain('@bernierllc/package-d');
    });

    it('should return empty array when no dependents exist', async () => {
      const result = await updateDependentVersions({
        packageName: '@bernierllc/package-e',
        newVersion: '^2.0.0',
        workspaceRoot: tempWorkspaceRoot
      });

      expect(result.updatedPackages).toHaveLength(0);
    });

    it('should throw error for empty packageName', async () => {
      await expect(
        updateDependentVersions({
          packageName: '',
          newVersion: '^2.0.0',
          workspaceRoot: tempWorkspaceRoot
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error for empty newVersion', async () => {
      await expect(
        updateDependentVersions({
          packageName: '@bernierllc/package-a',
          newVersion: '',
          workspaceRoot: tempWorkspaceRoot
        })
      ).rejects.toThrow('newVersion cannot be empty');
    });

    it('should throw error for empty workspaceRoot', async () => {
      await expect(
        updateDependentVersions({
          packageName: '@bernierllc/package-a',
          newVersion: '^2.0.0',
          workspaceRoot: ''
        })
      ).rejects.toThrow('workspaceRoot cannot be empty');
    });

    it('should update both dependencies and devDependencies', async () => {
      const result = await updateDependentVersions({
        packageName: '@bernierllc/package-a',
        newVersion: '^2.0.0',
        workspaceRoot: tempWorkspaceRoot
      });

      // Find package D in results
      const pkgDUpdate = result.updatedPackages.find(
        p => p.packageName === '@bernierllc/package-d'
      );
      expect(pkgDUpdate).toBeDefined();

      // Verify package D's package.json was updated in both sections
      const pkgDJson = JSON.parse(
        await fs.readFile(
          path.join(tempWorkspaceRoot, 'packages/package-d/package.json'),
          'utf-8'
        )
      );
      expect(pkgDJson.dependencies['@bernierllc/package-a']).toBe('^2.0.0');
      expect(pkgDJson.devDependencies['@bernierllc/package-a']).toBe('^2.0.0');
    });

    it('should skip packages that do not depend on the updated package', async () => {
      const result = await updateDependentVersions({
        packageName: '@bernierllc/package-a',
        newVersion: '^2.0.0',
        workspaceRoot: tempWorkspaceRoot
      });

      // Package E should not be in the results
      const pkgEUpdate = result.updatedPackages.find(
        p => p.packageName === '@bernierllc/package-e'
      );
      expect(pkgEUpdate).toBeUndefined();

      // Verify package E was not modified
      const pkgEJson = JSON.parse(
        await fs.readFile(
          path.join(tempWorkspaceRoot, 'packages/package-e/package.json'),
          'utf-8'
        )
      );
      expect(pkgEJson.dependencies['@bernierllc/package-a']).toBeUndefined();
    });

    it('should include previousVersion in results', async () => {
      const result = await updateDependentVersions({
        packageName: '@bernierllc/package-a',
        newVersion: '^2.0.0',
        workspaceRoot: tempWorkspaceRoot
      });

      const pkgBUpdate = result.updatedPackages.find(
        p => p.packageName === '@bernierllc/package-b'
      );
      expect(pkgBUpdate?.previousVersion).toBe('^1.0.0');
      expect(pkgBUpdate?.newVersion).toBe('^2.0.0');
    });

    it('should include packagePath in results', async () => {
      const result = await updateDependentVersions({
        packageName: '@bernierllc/package-a',
        newVersion: '^2.0.0',
        workspaceRoot: tempWorkspaceRoot
      });

      const pkgBUpdate = result.updatedPackages.find(
        p => p.packageName === '@bernierllc/package-b'
      );
      expect(pkgBUpdate?.packagePath).toContain('packages/package-b');
    });
  });

  describe('publishDeprecationNotice', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should successfully publish deprecation notice', async () => {
      // Mock successful npm deprecate
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'deprecated @bernierllc/test-package@1.x', stderr: '' });
        return {} as any;
      });

      const result = await publishDeprecationNotice({
        packageName: '@bernierllc/test-package',
        version: '1.x',
        message: 'Please use version 2.0.0 or higher'
      });

      expect(result.success).toBe(true);
      expect(result.packageName).toBe('@bernierllc/test-package');
      expect(result.version).toBe('1.x');
      expect(result.message).toBe('Please use version 2.0.0 or higher');
      expect(result.error).toBeUndefined();

      // Verify npm deprecate command was called correctly
      expect(exec).toHaveBeenCalledWith(
        'npm deprecate @bernierllc/test-package@1.x "Please use version 2.0.0 or higher"',
        expect.any(Function)
      );
    });

    it('should successfully publish deprecation notice with migration message', async () => {
      // Mock successful npm deprecate
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'deprecated @bernierllc/openai-client@1.x', stderr: '' });
        return {} as any;
      });

      const result = await publishDeprecationNotice({
        packageName: '@bernierllc/openai-client',
        version: '1.x',
        message: 'Video processing functionality moved to @bernierllc/video-processor in 2.0.0'
      });

      expect(result.success).toBe(true);
      expect(result.packageName).toBe('@bernierllc/openai-client');
      expect(result.version).toBe('1.x');
      expect(result.message).toBe('Video processing functionality moved to @bernierllc/video-processor in 2.0.0');

      // Verify npm deprecate command was called with migration message
      expect(exec).toHaveBeenCalledWith(
        'npm deprecate @bernierllc/openai-client@1.x "Video processing functionality moved to @bernierllc/video-processor in 2.0.0"',
        expect.any(Function)
      );
    });

    it('should handle failed deprecation with npm error', async () => {
      // Mock failed npm deprecate
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(new Error('npm ERR! 404 Not Found - PUT https://registry.npmjs.org/@bernierllc/test-package'), { stdout: '', stderr: 'npm ERR! 404 Not Found' });
        return {} as any;
      });

      const result = await publishDeprecationNotice({
        packageName: '@bernierllc/test-package',
        version: '1.x',
        message: 'Please use version 2.0.0 or higher'
      });

      expect(result.success).toBe(false);
      expect(result.packageName).toBe('@bernierllc/test-package');
      expect(result.version).toBe('1.x');
      expect(result.message).toBe('Please use version 2.0.0 or higher');
      expect(result.error).toContain('npm ERR! 404 Not Found');
    });

    it('should throw error for empty packageName', async () => {
      await expect(
        publishDeprecationNotice({
          packageName: '',
          version: '1.x',
          message: 'Please use version 2.0.0 or higher'
        })
      ).rejects.toThrow('packageName cannot be empty');
    });

    it('should throw error for empty version', async () => {
      await expect(
        publishDeprecationNotice({
          packageName: '@bernierllc/test-package',
          version: '',
          message: 'Please use version 2.0.0 or higher'
        })
      ).rejects.toThrow('version cannot be empty');
    });

    it('should throw error for empty message', async () => {
      await expect(
        publishDeprecationNotice({
          packageName: '@bernierllc/test-package',
          version: '1.x',
          message: ''
        })
      ).rejects.toThrow('message cannot be empty');
    });

    it('should support dry run mode without actual deprecation', async () => {
      // Mock successful dry run (echo command)
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'DRY RUN: npm deprecate @bernierllc/test-package@1.x \'Please use version 2.0.0 or higher\'', stderr: '' });
        return {} as any;
      });

      const result = await publishDeprecationNotice({
        packageName: '@bernierllc/test-package',
        version: '1.x',
        message: 'Please use version 2.0.0 or higher',
        dryRun: true
      });

      expect(result.success).toBe(true);

      // Verify echo command was called instead of actual npm deprecate
      expect(exec).toHaveBeenCalledWith(
        'echo "DRY RUN: npm deprecate @bernierllc/test-package@1.x \'Please use version 2.0.0 or higher\'"',
        expect.any(Function)
      );
    });

    it('should handle specific version deprecation', async () => {
      // Mock successful npm deprecate
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'deprecated @bernierllc/test-package@1.5.0', stderr: '' });
        return {} as any;
      });

      const result = await publishDeprecationNotice({
        packageName: '@bernierllc/test-package',
        version: '1.5.0',
        message: 'Security vulnerability fixed in 1.6.0'
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe('1.5.0');

      // Verify npm deprecate command was called with specific version
      expect(exec).toHaveBeenCalledWith(
        'npm deprecate @bernierllc/test-package@1.5.0 "Security vulnerability fixed in 1.6.0"',
        expect.any(Function)
      );
    });

    it('should handle version range deprecation', async () => {
      // Mock successful npm deprecate
      vi.mocked(exec).mockImplementation((cmd: any, callback: any) => {
        callback(null, { stdout: 'deprecated @bernierllc/test-package@<2.0.0', stderr: '' });
        return {} as any;
      });

      const result = await publishDeprecationNotice({
        packageName: '@bernierllc/test-package',
        version: '<2.0.0',
        message: 'Breaking changes in 2.0.0'
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe('<2.0.0');

      // Verify npm deprecate command was called with version range
      expect(exec).toHaveBeenCalledWith(
        'npm deprecate @bernierllc/test-package@<2.0.0 "Breaking changes in 2.0.0"',
        expect.any(Function)
      );
    });
  });
});
