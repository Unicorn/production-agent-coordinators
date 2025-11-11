import * as fs from 'fs';
import * as path from 'path';
import type { StructureResult } from '../types';

export async function validatePackageStructure(input: {
  packagePath: string;
}): Promise<StructureResult> {
  // Input validation
  if (!input.packagePath || input.packagePath.trim() === '') {
    throw new Error('packagePath cannot be empty');
  }

  // Check if packagePath exists
  try {
    await fs.promises.access(input.packagePath);
  } catch (error) {
    throw new Error(`packagePath does not exist: ${input.packagePath}`);
  }

  // Check if packagePath is a directory
  const stats = await fs.promises.stat(input.packagePath);
  if (!stats.isDirectory()) {
    throw new Error(`packagePath is not a directory: ${input.packagePath}`);
  }

  const missingFiles: string[] = [];
  const invalidFields: string[] = [];

  // Check required files
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'jest.config.js',
    '.eslintrc.js'
  ];

  for (const file of requiredFiles) {
    try {
      await fs.promises.access(path.join(input.packagePath, file));
    } catch {
      missingFiles.push(file);
    }
  }

  // Validate package.json fields
  const packageJsonPath = path.join(input.packagePath, 'package.json');
  try {
    await fs.promises.access(packageJsonPath);
    const content = await fs.promises.readFile(packageJsonPath, 'utf-8');

    let packageJson;
    try {
      packageJson = JSON.parse(content);
    } catch (parseError) {
      throw new Error(`Failed to parse package.json at ${packageJsonPath}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    const requiredFields = ['name', 'version', 'description', 'main', 'types', 'author', 'license'];
    for (const field of requiredFields) {
      if (!packageJson[field]) {
        invalidFields.push(field);
      }
    }
  } catch (error) {
    // If package.json doesn't exist, it's already in missingFiles
    // Re-throw parse errors
    if (error instanceof Error && error.message.includes('Failed to parse')) {
      throw error;
    }
  }

  const passed = missingFiles.length === 0 && invalidFields.length === 0;

  return {
    passed,
    missingFiles,
    invalidFields,
    details: { missingFiles, invalidFields }
  };
}
