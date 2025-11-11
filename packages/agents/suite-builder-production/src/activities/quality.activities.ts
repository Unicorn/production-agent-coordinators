import * as fs from 'fs';
import * as path from 'path';
import type { StructureResult } from '../types';

export async function validatePackageStructure(input: {
  packagePath: string;
}): Promise<StructureResult> {
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
    if (!fs.existsSync(path.join(input.packagePath, file))) {
      missingFiles.push(file);
    }
  }

  // Validate package.json fields
  const packageJsonPath = path.join(input.packagePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const requiredFields = ['name', 'version', 'description', 'main', 'types', 'author', 'license'];
    for (const field of requiredFields) {
      if (!packageJson[field]) {
        invalidFields.push(field);
      }
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
