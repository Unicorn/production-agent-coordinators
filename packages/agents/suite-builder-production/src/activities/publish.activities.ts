import semver from 'semver';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import type {
  VersionBumpInput,
  VersionBumpResult,
  PublishInput,
  PublishToNpmResult,
  UpdateDependentVersionsInput,
  UpdateDependentVersionsResult,
  UpdatedPackage
} from '../types/index';

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

export async function updateDependentVersions(
  input: UpdateDependentVersionsInput
): Promise<UpdateDependentVersionsResult> {
  // Input validation
  if (!input.packageName || input.packageName.trim() === '') {
    throw new Error('packageName cannot be empty');
  }

  if (!input.newVersion || input.newVersion.trim() === '') {
    throw new Error('newVersion cannot be empty');
  }

  if (!input.workspaceRoot || input.workspaceRoot.trim() === '') {
    throw new Error('workspaceRoot cannot be empty');
  }

  const updatedPackages: UpdatedPackage[] = [];

  // Find all package.json files in workspace
  const packagesDir = path.join(input.workspaceRoot, 'packages');
  const packageJsonFiles = await glob('**/package.json', {
    cwd: packagesDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  // Check each package for dependencies on the updated package
  for (const packageJsonPath of packageJsonFiles) {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    let updated = false;
    let previousVersion: string | undefined;

    // Check dependencies
    if (packageJson.dependencies?.[input.packageName]) {
      previousVersion = packageJson.dependencies[input.packageName];
      packageJson.dependencies[input.packageName] = input.newVersion;
      updated = true;
    }

    // Check devDependencies
    if (packageJson.devDependencies?.[input.packageName]) {
      if (!previousVersion) {
        previousVersion = packageJson.devDependencies[input.packageName];
      }
      packageJson.devDependencies[input.packageName] = input.newVersion;
      updated = true;
    }

    if (updated) {
      // Write updated package.json
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

      updatedPackages.push({
        packageName: packageJson.name,
        packagePath: path.dirname(packageJsonPath),
        previousVersion: previousVersion!,
        newVersion: input.newVersion
      });
    }
  }

  return { updatedPackages };
}
