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

export async function runLintCheck(input: {
  packagePath: string;
}): Promise<LintResult> {
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

  // Check if package.json exists
  const packageJsonPath = path.join(input.packagePath, 'package.json');
  try {
    await fs.promises.access(packageJsonPath);
  } catch (error) {
    throw new Error(`package.json not found in ${input.packagePath}`);
  }

  // Use local eslint from node_modules, falling back to yarn lint
  let eslintCommand = 'yarn lint';
  let useJsonFormat = false;

  // Try to find eslint in the package's node_modules
  const localEslintPath = path.join(input.packagePath, 'node_modules', '.bin', 'eslint');
  try {
    await fs.promises.access(localEslintPath);
    // Use JSON format for easier parsing
    eslintCommand = `"${localEslintPath}" --format json .`;
    useJsonFormat = true;
  } catch {
    // Fall back to yarn lint
    eslintCommand = 'yarn lint';
  }

  try {
    const { stdout, stderr } = await execAsync(eslintCommand, { cwd: input.packagePath });

    // Even on success, check for warnings in the output
    if (useJsonFormat && stdout) {
      const eslintWarnings: Array<{ file: string; line: number; rule: string; message: string }> = [];

      try {
        const results = JSON.parse(stdout);

        // Parse ESLint JSON output for warnings
        for (const file of results) {
          if (file.messages && Array.isArray(file.messages)) {
            for (const message of file.messages) {
              if (message.severity === 1) {
                eslintWarnings.push({
                  file: file.filePath || 'unknown',
                  line: message.line || 0,
                  rule: message.ruleId || 'unknown',
                  message: message.message || ''
                });
              }
            }
          }
        }
      } catch (parseError) {
        // Ignore parse errors on success
      }

      // No errors, possibly warnings
      return {
        passed: true,
        errors: [],
        warnings: eslintWarnings,
        details: { errors: [], warnings: eslintWarnings }
      };
    }

    // No errors or warnings
    return {
      passed: true,
      errors: [],
      warnings: [],
      details: { errors: [], warnings: [] }
    };
  } catch (error: any) {
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';
    // ESLint output can appear in stdout
    const combinedOutput = stdout + '\n' + stderr;

    // Try to parse as JSON first (if we used --format json)
    let eslintErrors: Array<{ file: string; line: number; rule: string; message: string }> = [];
    let eslintWarnings: Array<{ file: string; line: number; rule: string; message: string }> = [];

    try {
      // Try to extract JSON from output
      const jsonMatch = combinedOutput.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]);

        // Parse ESLint JSON output
        for (const file of results) {
          if (file.messages && Array.isArray(file.messages)) {
            for (const message of file.messages) {
              const lintMessage = {
                file: file.filePath || 'unknown',
                line: message.line || 0,
                rule: message.ruleId || 'unknown',
                message: message.message || ''
              };

              if (message.severity === 2) {
                eslintErrors.push(lintMessage);
              } else if (message.severity === 1) {
                eslintWarnings.push(lintMessage);
              }
            }
          }
        }
      }
    } catch (parseError) {
      // If JSON parsing fails, try text format parsing
      const lines = combinedOutput.split('\n');

      for (const line of lines) {
        // Parse text format: "  line:col  error/warning  message  rule"
        const match = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([a-z-]+)$/i);
        if (match) {
          const lintMessage = {
            file: 'unknown', // Text format doesn't include file in each line
            line: parseInt(match[1], 10),
            rule: match[5],
            message: match[4]
          };

          if (match[3].toLowerCase() === 'error') {
            eslintErrors.push(lintMessage);
          } else if (match[3].toLowerCase() === 'warning') {
            eslintWarnings.push(lintMessage);
          }
        }
      }
    }

    // If we still have no parsed errors but got an error exit code, treat as generic error
    if (eslintErrors.length === 0 && eslintWarnings.length === 0 && combinedOutput.trim()) {
      // Check if it's actually a real error or just warnings
      const hasErrorKeyword = combinedOutput.toLowerCase().includes('error');

      if (hasErrorKeyword) {
        eslintErrors.push({
          file: 'unknown',
          line: 0,
          rule: 'unknown',
          message: combinedOutput.trim()
        });
      }
    }

    // passed = true if no errors (warnings are OK)
    const passed = eslintErrors.length === 0;

    return {
      passed,
      errors: eslintErrors,
      warnings: eslintWarnings,
      details: { errors: eslintErrors, warnings: eslintWarnings }
    };
  }
}

export function calculateComplianceScore(input: {
  structure: StructureResult;
  typescript: TypeScriptResult;
  lint: LintResult;
  tests: TestResult;
  security: SecurityResult;
  documentation: DocumentationResult;
  license: LicenseResult;
  integration: IntegrationResult;
}): ComplianceScore {
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
  // Test scoring is proportional to coverage
  score += weights.tests * (input.tests.coverage.total / 100);
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
