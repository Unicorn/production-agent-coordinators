import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  StructureResult,
  TypeScriptResult,
  LintResult,
  TestResult,
  SecurityResult,
  DocumentationResult,
  LicenseResult,
  IntegrationResult,
  ComplianceScore
} from '../types';

const execAsync = promisify(exec);

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

export async function runTypeScriptCheck(input: {
  packagePath: string;
}): Promise<TypeScriptResult> {
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

  // Check if tsconfig.json exists
  const tsconfigPath = path.join(input.packagePath, 'tsconfig.json');
  try {
    await fs.promises.access(tsconfigPath);
  } catch (error) {
    throw new Error(`tsconfig.json not found in ${input.packagePath}`);
  }

  try {
    // Use local tsc from node_modules, falling back to npx if not found
    let tscCommand = 'npx tsc --noEmit';

    // Try to find tsc in the package's node_modules
    const localTscPath = path.join(input.packagePath, 'node_modules', '.bin', 'tsc');
    try {
      await fs.promises.access(localTscPath);
      tscCommand = `"${localTscPath}" --noEmit`;
    } catch {
      // Fall back to npx
      tscCommand = 'npx tsc --noEmit';
    }

    await execAsync(tscCommand, { cwd: input.packagePath });

    return {
      passed: true,
      errors: [],
      details: { errors: [] }
    };
  } catch (error: any) {
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';
    // TypeScript errors can appear in stdout, not just stderr
    const combinedOutput = stderr + '\n' + stdout;
    const errors = parseTypeScriptErrors(combinedOutput);

    return {
      passed: false,
      errors,
      details: { errors }
    };
  }
}

function parseTypeScriptErrors(stderr: string): Array<{ file: string; line: number; message: string }> {
  const errors: Array<{ file: string; line: number; message: string }> = [];

  // Parse TypeScript error format: "file.ts(line,col): error TS1234: message"
  const errorRegex = /([^(]+)\((\d+),\d+\):\s*error\s+TS\d+:\s*(.+)/g;
  let match;

  while ((match = errorRegex.exec(stderr)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      message: match[3]
    });
  }

  // Fallback: if no structured errors were parsed but stderr is not empty, include it as a generic error
  // Filter out npm warnings which are not TypeScript errors
  if (errors.length === 0 && stderr.trim()) {
    // Only treat as error if it's not just npm warnings
    const isOnlyNpmWarnings = stderr.trim().split('\n').every(line =>
      line.includes('npm warn') || line.trim() === ''
    );

    if (!isOnlyNpmWarnings) {
      errors.push({
        file: 'unknown',
        line: 0,
        message: stderr.trim()
      });
    }
  }

  return errors;
}

export async function calculateComplianceScore(input: {
  structure: StructureResult;
  typescript: TypeScriptResult;
  lint: LintResult;
  tests: TestResult;
  security: SecurityResult;
  documentation: DocumentationResult;
  license: LicenseResult;
  integration: IntegrationResult;
}): Promise<ComplianceScore> {
  // Define weights for each check (must sum to 100)
  const weights = {
    structure: 10,
    typescript: 20,
    lint: 15,
    tests: 25,
    security: 15,
    documentation: 5,
    license: 5,
    integration: 5
  };

  // Calculate weighted score
  let score = 0;

  if (input.structure.passed) score += weights.structure;
  if (input.typescript.passed) score += weights.typescript;
  if (input.lint.passed) score += weights.lint;
  if (input.tests.passed) score += weights.tests;
  if (input.security.passed) score += weights.security;
  if (input.documentation.passed) score += weights.documentation;
  if (input.license.passed) score += weights.license;
  if (input.integration.passed) score += weights.integration;

  // Determine compliance level based on score
  let level: 'excellent' | 'good' | 'acceptable' | 'blocked';

  if (score >= 95) {
    level = 'excellent';
  } else if (score >= 90) {
    level = 'good';
  } else if (score >= 85) {
    level = 'acceptable';
  } else {
    level = 'blocked';
  }

  return {
    score,
    level
  };
}
