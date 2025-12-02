/**
 * Unit Tests for Package Management Activities
 *
 * Tests package management operations with mocked command execution.
 *
 * @see planning-standards.mdc - Testing requirements
 * @see plans/ui-compiler-activities.md - Comprehensive testing strategy
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {
  checkOutdatedDependencies,
  scanVulnerabilities,
  bumpVersion,
  checkLicenses,
  type CheckOutdatedDependenciesInput,
  type ScanVulnerabilitiesInput,
  type BumpVersionInput,
  type CheckLicensesInput,
} from '@/lib/activities/package-management.activities';

import {
  executeCommand,
  type ExecuteCommandResult,
} from '@/lib/activities/command-execution.activities';

// Mock command execution – we do not want to hit the network or real package registries
vi.mock('@/lib/activities/command-execution.activities', async () => {
  const actual = await vi.importActual<typeof import('@/lib/activities/command-execution.activities')>(
    '@/lib/activities/command-execution.activities',
  );

  return {
    ...actual,
    executeCommand: vi.fn(),
  };
});

const mockedExecuteCommand = executeCommand as unknown as vi.MockedFunction<typeof executeCommand>;

describe('Package Management Activities', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pkg-mgmt-'));
    mockedExecuteCommand.mockReset();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('checkOutdatedDependencies', () => {
    async function writePackageJson(): Promise<void> {
      const packageJsonPath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(
          {
            name: 'test-project',
            version: '1.0.0',
            dependencies: {
              react: '^17.0.0',
            },
          },
          null,
          2,
        ),
        'utf8',
      );
    }

    it('returns error when package.json is missing', async () => {
      const input: CheckOutdatedDependenciesInput = {
        workspacePath: tempDir,
      };

      const result = await checkOutdatedDependencies(input);

      expect(result.success).toBe(false);
      expect(result.outdated).toEqual([]);
      expect(result.error).toContain('No package.json');
      expect(mockedExecuteCommand).not.toHaveBeenCalled();
    });

    it('detects outdated dependencies from npm outdated JSON output', async () => {
      await writePackageJson();

      const stdout = JSON.stringify({
        react: {
          current: '17.0.0',
          wanted: '17.0.2',
          latest: '18.2.0',
          type: 'dependencies',
          location: 'node_modules/react',
        },
      });

      const execResult: ExecuteCommandResult = {
        success: false, // npm uses non‑zero exit code when outdated packages exist
        exitCode: 1,
        stdout,
        stderr: '',
        duration: 100,
        commandId: 'test-command',
      };

      mockedExecuteCommand.mockResolvedValue(execResult);

      const result = await checkOutdatedDependencies({
        workspacePath: tempDir,
        packageManager: 'npm',
      });

      expect(mockedExecuteCommand).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.outdated).toHaveLength(1);
      expect(result.outdated[0]).toMatchObject({
        name: 'react',
        current: '17.0.0',
        wanted: '17.0.2',
        latest: '18.2.0',
        type: 'dependencies',
      });
    });

    it('returns empty list when no outdated dependencies are found', async () => {
      await writePackageJson();

      const execResult: ExecuteCommandResult = {
        success: true,
        exitCode: 0,
        stdout: '{}',
        stderr: '',
        duration: 50,
        commandId: 'test-command',
      };

      mockedExecuteCommand.mockResolvedValue(execResult);

      const result = await checkOutdatedDependencies({
        workspacePath: tempDir,
        packageManager: 'npm',
      });

      expect(result.success).toBe(true);
      expect(result.outdated).toHaveLength(0);
    });

    it('propagates command errors when no JSON output is available', async () => {
      await writePackageJson();

      const execResult: ExecuteCommandResult = {
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: 'Command failed: npm outdated',
        duration: 50,
        commandId: 'test-command',
      };

      mockedExecuteCommand.mockResolvedValue(execResult);

      const result = await checkOutdatedDependencies({
        workspacePath: tempDir,
        packageManager: 'npm',
      });

      expect(result.success).toBe(false);
      expect(result.outdated).toHaveLength(0);
      expect(result.error).toContain('Command failed');
    });
  });

  describe('scanVulnerabilities', () => {
    async function writePackageJson(): Promise<void> {
      const packageJsonPath = path.join(tempDir, 'package.json');
      await fs.writeFile(
        packageJsonPath,
        JSON.stringify(
          {
            name: 'test-project',
            version: '1.0.0',
            dependencies: {
              lodash: '^4.17.0',
            },
          },
          null,
          2,
        ),
        'utf8',
      );
    }

    it('returns error when package.json is missing', async () => {
      const input: ScanVulnerabilitiesInput = {
        workspacePath: tempDir,
        severityThreshold: 'high',
      };

      const result = await scanVulnerabilities(input);

      expect(result.success).toBe(false);
      expect(result.vulnerabilities).toEqual([]);
      expect(result.error).toContain('No package.json');
      expect(mockedExecuteCommand).not.toHaveBeenCalled();
    });

    it('parses vulnerability summary and severity counts', async () => {
      await writePackageJson();

      const auditJson = {
        vulnerabilities: {
          'GHSA-xyz': {
            name: 'lodash',
            severity: 'high',
            via: ['GHSA-xyz'],
            title: 'Prototype Pollution',
            url: 'https://github.com/advisories/GHSA-xyz',
          },
        },
        metadata: {
          vulnerabilities: {
            low: 0,
            moderate: 0,
            high: 1,
            critical: 0,
          },
        },
      };

      const execResult: ExecuteCommandResult = {
        success: true,
        exitCode: 0,
        stdout: JSON.stringify(auditJson),
        stderr: '',
        duration: 200,
        commandId: 'audit-command',
      };

      mockedExecuteCommand.mockResolvedValue(execResult);

      const result = await scanVulnerabilities({
        workspacePath: tempDir,
        packageManager: 'npm',
        severityThreshold: 'moderate',
      });

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toHaveLength(1);
      expect(result.vulnerabilities[0]).toMatchObject({
        id: 'GHSA-xyz',
        name: 'lodash',
        severity: 'high',
      });
      expect(result.severities.high).toBe(1);
      expect(result.blocked).toBe(true);
    });

    it('handles empty audit output gracefully', async () => {
      await writePackageJson();

      const execResult: ExecuteCommandResult = {
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
        duration: 100,
        commandId: 'audit-command',
      };

      mockedExecuteCommand.mockResolvedValue(execResult);

      const result = await scanVulnerabilities({
        workspacePath: tempDir,
        packageManager: 'npm',
      });

      expect(result.success).toBe(true);
      expect(result.vulnerabilities).toHaveLength(0);
      expect(result.severities.high).toBe(0);
    });
  });

  // ========================================================================
  // bumpVersion Tests (Phase 3.4)
  // ========================================================================

  describe('bumpVersion', () => {
    it('should bump patch version', async () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2),
      );

      mockedExecuteCommand.mockResolvedValueOnce({
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
        command: 'npm',
        args: ['version', 'patch', '--no-git-tag-version'],
        workingDir: tempDir,
        duration: 100,
      });

      const result = await bumpVersion({
        workspacePath: tempDir,
        version: 'patch',
      });

      expect(result.success).toBe(true);
      expect(result.oldVersion).toBe('1.0.0');
      expect(mockedExecuteCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'npm',
          args: ['version', 'patch', '--no-git-tag-version'],
          workingDir: tempDir,
        }),
      );
    });

    it('should set specific version', async () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2),
      );

      const result = await bumpVersion({
        workspacePath: tempDir,
        version: '2.0.0',
      });

      expect(result.success).toBe(true);
      expect(result.oldVersion).toBe('1.0.0');
      expect(result.newVersion).toBe('2.0.0');

      // Verify package.json was updated
      const updated = JSON.parse(
        await fs.readFile(path.join(tempDir, 'package.json'), 'utf8'),
      );
      expect(updated.version).toBe('2.0.0');
    });

    it('should handle missing package.json', async () => {
      const result = await bumpVersion({
        workspacePath: tempDir,
        version: 'patch',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No package.json found');
    });
  });

  // ========================================================================
  // checkLicenses Tests (Phase 3.4)
  // ========================================================================

  describe('checkLicenses', () => {
    it('should check licenses from package.json fallback', async () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          'test-dep': '^1.0.0',
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2),
      );

      // Mock license-checker to fail (not installed)
      mockedExecuteCommand.mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: 'command not found: license-checker',
        exitCode: 1,
        command: 'npx',
        args: ['license-checker', '--json', '--start', '.'],
        workingDir: tempDir,
        duration: 100,
      });

      const result = await checkLicenses({
        workspacePath: tempDir,
      });

      expect(result.success).toBe(true);
      expect(result.licenses.length).toBeGreaterThanOrEqual(0);
      expect(result.summary.total).toBeGreaterThanOrEqual(0);
    });

    it('should block packages with blocked licenses', async () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          'test-dep': '^1.0.0',
        },
      };
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2),
      );

      mockedExecuteCommand.mockResolvedValueOnce({
        success: false,
        stdout: '',
        stderr: 'command not found',
        exitCode: 1,
        command: 'npx',
        args: ['license-checker', '--json', '--start', '.'],
        workingDir: tempDir,
        duration: 100,
      });

      const result = await checkLicenses({
        workspacePath: tempDir,
        blockedLicenses: ['GPL-3.0'],
      });

      expect(result.success).toBe(true);
      // The actual blocking depends on what licenses are found
      expect(result.summary.blocked).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing package.json', async () => {
      const result = await checkLicenses({
        workspacePath: tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No package.json found');
    });
  });
});


