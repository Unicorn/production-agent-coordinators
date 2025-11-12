import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { determineVersionBump, publishToNpm } from '../publish.activities';
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
});
