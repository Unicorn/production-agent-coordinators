import semver from 'semver';
import type { VersionBumpInput, VersionBumpResult } from '../types/index';

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
