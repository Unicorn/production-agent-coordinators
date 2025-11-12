import semver from 'semver';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { VersionBumpInput, VersionBumpResult, PublishInput, PublishToNpmResult } from '../types/index';

const execAsync = promisify(exec);

export async function determineVersionBump(input: VersionBumpInput): Promise<VersionBumpResult> {
  // Input validation
  if (!input.currentVersion || input.currentVersion.trim() === '') {
    throw new Error('currentVersion cannot be empty');
  }

  if (!['major', 'minor', 'patch'].includes(input.changeType)) {
    throw new Error(`Invalid changeType: ${input.changeType}`);
  }

  // Parse and validate version
  const currentSemver = semver.parse(input.currentVersion);
  if (!currentSemver) {
    throw new Error(`Invalid semver version: ${input.currentVersion}`);
  }

  // Calculate new version
  const newVersion = semver.inc(input.currentVersion, input.changeType);
  if (!newVersion) {
    throw new Error(`Failed to increment version: ${input.currentVersion}`);
  }

  return {
    newVersion,
    previousVersion: input.currentVersion,
    changeType: input.changeType
  };
}

export async function publishToNpm(input: PublishInput): Promise<PublishToNpmResult> {
  // Input validation
  if (!input.packagePath || input.packagePath.trim() === '') {
    throw new Error('packagePath cannot be empty');
  }

  if (!input.version || input.version.trim() === '') {
    throw new Error('version cannot be empty');
  }

  // Read package.json
  const packageJsonPath = path.join(input.packagePath, 'package.json');
  const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonContent);

  // Update version in package.json
  packageJson.version = input.version;
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

  // Build npm publish command
  const accessFlag = input.isPublic ? '--access=public' : '--access=restricted';
  const dryRunFlag = input.dryRun ? '--dry-run' : '';
  const command = `npm publish ${accessFlag} ${dryRunFlag}`.trim();

  try {
    const { stdout } = await execAsync(command, { cwd: input.packagePath });

    // Extract registry URL from stdout if present
    const registryUrlMatch = stdout.match(/(https?:\/\/[^\s]+)/);
    const registryUrl = registryUrlMatch ? registryUrlMatch[1] : undefined;

    return {
      success: true,
      publishedVersion: input.version,
      packageName: packageJson.name,
      registryUrl
    };
  } catch (error: any) {
    return {
      success: false,
      publishedVersion: input.version,
      packageName: packageJson.name,
      error: error.message
    };
  }
}
