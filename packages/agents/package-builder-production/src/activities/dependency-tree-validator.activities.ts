import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * Dependency Tree Publish Validator
 *
 * Validates the publish status of all packages in a dependency tree before publishing.
 * Ensures:
 * - All dependencies are published before dependents
 * - New packages are identified and ready to publish
 * - Updated packages have version bumps
 * - Already-published packages at current version are skipped
 */

export interface PackagePublishStatus {
  packageName: string;
  localVersion: string;
  npmVersion: string | null;
  isPublished: boolean;
  isNew: boolean;
  isUpdate: boolean;
  needsPublish: boolean;
  needsVersionBump: boolean;
  reason: string;
}

export interface DependencyTreeValidation {
  allPackagesValid: boolean;
  packagesToPublish: string[];
  packagesToSkip: string[];
  packagesNeedingVersionBump: string[];
  validationErrors: string[];
  packageStatuses: PackagePublishStatus[];
}

/**
 * Check npm publish status for a single package
 */
async function checkNpmPackageVersion(packageName: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`npm view ${packageName} version`);
    return stdout.trim() || null;
  } catch (error: any) {
    // Package doesn't exist on npm
    if (error.message.includes('404') || error.message.includes('E404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Get local package version from package.json
 */
async function getLocalPackageVersion(
  workspaceRoot: string,
  packagePath: string
): Promise<string> {
  const packageJsonPath = path.join(workspaceRoot, packagePath, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

/**
 * Check if plan indicates this is an update/modification
 */
async function isUpdatePlan(
  workspaceRoot: string,
  planPath: string
): Promise<boolean> {
  try {
    const fullPlanPath = path.join(workspaceRoot, planPath);
    const planContent = await fs.readFile(fullPlanPath, 'utf-8');

    // Look for keywords indicating update/modification
    const updateKeywords = [
      'update',
      'modify',
      'enhance',
      'upgrade',
      'refactor',
      'improve',
      'fix',
      'patch',
      'version'
    ];

    const lowerContent = planContent.toLowerCase();
    return updateKeywords.some(keyword =>
      lowerContent.includes(keyword) &&
      (lowerContent.includes(`${keyword} existing`) ||
       lowerContent.includes(`${keyword} the`))
    );
  } catch (error) {
    // If we can't read the plan, assume it's not an update
    return false;
  }
}

/**
 * Compare semantic versions
 */
function isVersionGreater(version1: string, version2: string): boolean {
  const parts1 = version1.split('.').map(Number);
  const parts2 = version2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return true;
    if (parts1[i] < parts2[i]) return false;
  }

  return false;
}

/**
 * Validate publish status for a single package
 */
export async function validatePackagePublishStatus(input: {
  packageName: string;
  workspaceRoot: string;
  packagePath: string;
  planPath: string;
}): Promise<PackagePublishStatus> {
  console.log(`[DependencyTreeValidator] Checking publish status for ${input.packageName}...`);

  // Get local version
  const localVersion = await getLocalPackageVersion(
    input.workspaceRoot,
    input.packagePath
  );

  // Get npm version
  const npmVersion = await checkNpmPackageVersion(input.packageName);

  // Check if this is an update plan
  const isUpdate = await isUpdatePlan(input.workspaceRoot, input.planPath);

  const isPublished = npmVersion !== null;
  const isNew = !isPublished;

  let needsPublish = false;
  let needsVersionBump = false;
  let reason = '';

  if (isNew) {
    // NEW PACKAGE: Never published before
    needsPublish = true;
    reason = `New package - never published to npm`;
  } else if (isUpdate) {
    // UPDATE PLAN: Package exists, this is a modification
    if (localVersion === npmVersion) {
      // Same version - needs version bump
      needsVersionBump = true;
      needsPublish = false;
      reason = `Update plan detected but version not bumped (current: ${npmVersion})`;
    } else if (isVersionGreater(localVersion, npmVersion)) {
      // Version bumped - needs publish
      needsPublish = true;
      reason = `Update with version bump (${npmVersion} → ${localVersion})`;
    } else {
      // Version went backwards?
      needsPublish = false;
      reason = `Error: Local version (${localVersion}) is less than npm version (${npmVersion})`;
    }
  } else {
    // NOT UPDATE PLAN: Package exists, not marked as update
    if (localVersion === npmVersion) {
      // Already published at this version - skip
      needsPublish = false;
      reason = `Already published at v${npmVersion}`;
    } else if (isVersionGreater(localVersion, npmVersion)) {
      // Version changed without update plan - still publish
      needsPublish = true;
      reason = `Version bumped (${npmVersion} → ${localVersion}) without explicit update plan`;
    } else {
      needsPublish = false;
      reason = `Error: Local version (${localVersion}) is less than npm version (${npmVersion})`;
    }
  }

  console.log(`[DependencyTreeValidator] ${input.packageName}: ${reason}`);

  return {
    packageName: input.packageName,
    localVersion,
    npmVersion,
    isPublished,
    isNew,
    isUpdate,
    needsPublish,
    needsVersionBump,
    reason
  };
}

/**
 * Validate entire dependency tree publish status
 */
export async function validateDependencyTreePublishStatus(input: {
  packages: Array<{
    packageName: string;
    packagePath: string;
    planPath: string;
    category: string;
  }>;
  workspaceRoot: string;
}): Promise<DependencyTreeValidation> {
  console.log(`\n[DependencyTreeValidator] ════════════════════════════════════════════`);
  console.log(`[DependencyTreeValidator] Validating publish status for ${input.packages.length} packages`);
  console.log(`[DependencyTreeValidator] ════════════════════════════════════════════\n`);

  const packageStatuses: PackagePublishStatus[] = [];
  const validationErrors: string[] = [];

  // Check each package
  for (const pkg of input.packages) {
    try {
      const status = await validatePackagePublishStatus({
        packageName: pkg.packageName,
        workspaceRoot: input.workspaceRoot,
        packagePath: pkg.packagePath,
        planPath: pkg.planPath
      });

      packageStatuses.push(status);

      // Collect errors
      if (status.reason.startsWith('Error:')) {
        validationErrors.push(`${pkg.packageName}: ${status.reason}`);
      }
    } catch (error: any) {
      const errorMsg = `Failed to validate ${pkg.packageName}: ${error.message}`;
      validationErrors.push(errorMsg);
      console.error(`[DependencyTreeValidator] ${errorMsg}`);
    }
  }

  // Categorize packages
  const packagesToPublish = packageStatuses
    .filter(s => s.needsPublish && !s.needsVersionBump)
    .map(s => s.packageName);

  const packagesToSkip = packageStatuses
    .filter(s => !s.needsPublish && !s.needsVersionBump)
    .map(s => s.packageName);

  const packagesNeedingVersionBump = packageStatuses
    .filter(s => s.needsVersionBump)
    .map(s => s.packageName);

  const allPackagesValid = validationErrors.length === 0 &&
                           packagesNeedingVersionBump.length === 0;

  // Print summary
  console.log(`\n[DependencyTreeValidator] ════════════════════════════════════════════`);
  console.log(`[DependencyTreeValidator] Validation Summary:`);
  console.log(`[DependencyTreeValidator] ════════════════════════════════════════════`);
  console.log(`[DependencyTreeValidator] ✅ To Publish: ${packagesToPublish.length} packages`);
  packagesToPublish.forEach(name => {
    const status = packageStatuses.find(s => s.packageName === name)!;
    console.log(`[DependencyTreeValidator]    - ${name} (${status.reason})`);
  });

  console.log(`[DependencyTreeValidator] ⏭️  To Skip: ${packagesToSkip.length} packages`);
  packagesToSkip.forEach(name => {
    const status = packageStatuses.find(s => s.packageName === name)!;
    console.log(`[DependencyTreeValidator]    - ${name} (${status.reason})`);
  });

  if (packagesNeedingVersionBump.length > 0) {
    console.log(`[DependencyTreeValidator] ⚠️  Need Version Bump: ${packagesNeedingVersionBump.length} packages`);
    packagesNeedingVersionBump.forEach(name => {
      const status = packageStatuses.find(s => s.packageName === name)!;
      console.log(`[DependencyTreeValidator]    - ${name} (${status.reason})`);
    });
  }

  if (validationErrors.length > 0) {
    console.log(`[DependencyTreeValidator] ❌ Errors: ${validationErrors.length}`);
    validationErrors.forEach(err => console.log(`[DependencyTreeValidator]    - ${err}`));
  }

  console.log(`[DependencyTreeValidator] ════════════════════════════════════════════\n`);

  return {
    allPackagesValid,
    packagesToPublish,
    packagesToSkip,
    packagesNeedingVersionBump,
    validationErrors,
    packageStatuses
  };
}
