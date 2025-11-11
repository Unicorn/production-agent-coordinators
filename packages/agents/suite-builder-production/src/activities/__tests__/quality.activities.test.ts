import { describe, it, expect } from 'vitest';
import { validatePackageStructure, runTypeScriptCheck, calculateComplianceScore } from '../quality.activities';
import * as fs from 'fs';
import * as path from 'path';
import type {
  StructureResult,
  TypeScriptResult,
  LintResult,
  TestResult,
  SecurityResult,
  DocumentationResult,
  LicenseResult,
  IntegrationResult
} from '../types';

describe('Quality Activities', () => {
  describe('validatePackageStructure', () => {
    it('should pass for valid package structure', async () => {
      const tempDir = '/tmp/valid-package';
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test',
          version: '1.0.0',
          description: 'Test package',
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
          author: 'Bernier LLC',
          license: 'MIT'
        })
      );

      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'jest.config.js'), '');
      fs.writeFileSync(path.join(tempDir, '.eslintrc.js'), '');

      const result = await validatePackageStructure({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.missingFiles).toHaveLength(0);
      expect(result.invalidFields).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for missing required files', async () => {
      const tempDir = '/tmp/invalid-package';
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: '@bernierllc/test' })
      );

      const result = await validatePackageStructure({ packagePath: tempDir });

      expect(result.passed).toBe(false);
      expect(result.missingFiles).toContain('tsconfig.json');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for empty packagePath', async () => {
      await expect(validatePackageStructure({ packagePath: '' }))
        .rejects.toThrow('packagePath cannot be empty');
    });

    it('should throw error for non-existent packagePath', async () => {
      await expect(validatePackageStructure({ packagePath: '/tmp/does-not-exist-xyz' }))
        .rejects.toThrow('packagePath does not exist');
    });

    it('should throw error if packagePath is not a directory', async () => {
      const tempFile = '/tmp/test-file.txt';
      fs.writeFileSync(tempFile, 'test');

      await expect(validatePackageStructure({ packagePath: tempFile }))
        .rejects.toThrow('packagePath is not a directory');

      fs.rmSync(tempFile);
    });

    it('should throw error for malformed package.json', async () => {
      const tempDir = '/tmp/malformed-json-package';
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(path.join(tempDir, 'package.json'), 'invalid json {');
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'jest.config.js'), '');
      fs.writeFileSync(path.join(tempDir, '.eslintrc.js'), '');

      await expect(validatePackageStructure({ packagePath: tempDir }))
        .rejects.toThrow('Failed to parse package.json');

      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('runTypeScriptCheck', () => {
    it('should pass for valid TypeScript', async () => {
      const tempDir = '/tmp/valid-ts-package';
      // Clean up if it exists from previous run
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });

      // Create a minimal package.json with typescript as a dependency
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          dependencies: {
            typescript: '*'
          }
        })
      );

      // Link to the workspace root node_modules to access typescript
      // Find the workspace root by looking for node_modules/typescript
      const typescriptPath = '/Users/mattbernier/projects/production-agent-coordinators/.worktrees/production-suite-builder/.worktrees/autonomous-workflow/node_modules/typescript';
      const targetNodeModules = path.join(tempDir, 'node_modules/typescript');
      if (fs.existsSync(typescriptPath)) {
        fs.symlinkSync(typescriptPath, targetNodeModules, 'dir');
      }

      // Also create .bin directory and symlink tsc
      const binDir = path.join(tempDir, 'node_modules', '.bin');
      fs.mkdirSync(binDir, { recursive: true });
      const tscSource = path.join(typescriptPath, 'bin', 'tsc');
      const tscTarget = path.join(binDir, 'tsc');
      if (fs.existsSync(tscSource)) {
        fs.symlinkSync(tscSource, tscTarget, 'file');
      }

      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: 'ES2020',
            module: 'commonjs'
          }
        })
      );

      fs.writeFileSync(
        path.join(tempDir, 'src/index.ts'),
        'export function test(x: number): number { return x + 1; }'
      );

      const result = await runTypeScriptCheck({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for TypeScript compilation errors', async () => {
      const tempDir = '/tmp/invalid-ts-package';
      // Clean up if it exists from previous run
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });

      // Create a minimal package.json with typescript as a dependency
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          dependencies: {
            typescript: '*'
          }
        })
      );

      // Link to the workspace root node_modules to access typescript
      // Find the workspace root by looking for node_modules/typescript
      const typescriptPath = '/Users/mattbernier/projects/production-agent-coordinators/.worktrees/production-suite-builder/.worktrees/autonomous-workflow/node_modules/typescript';
      const targetNodeModules = path.join(tempDir, 'node_modules/typescript');
      if (fs.existsSync(typescriptPath)) {
        fs.symlinkSync(typescriptPath, targetNodeModules, 'dir');
      }

      // Also create .bin directory and symlink tsc
      const binDir = path.join(tempDir, 'node_modules', '.bin');
      fs.mkdirSync(binDir, { recursive: true });
      const tscSource = path.join(typescriptPath, 'bin', 'tsc');
      const tscTarget = path.join(binDir, 'tsc');
      if (fs.existsSync(tscSource)) {
        fs.symlinkSync(tscSource, tscTarget, 'file');
      }

      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
            target: 'ES2020',
            module: 'commonjs'
          }
        })
      );

      // Write invalid TypeScript code (type error)
      fs.writeFileSync(
        path.join(tempDir, 'src/index.ts'),
        'export function test(x: number): number { return "string"; }'
      );

      const result = await runTypeScriptCheck({ packagePath: tempDir });

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for missing tsconfig.json', async () => {
      const tempDir = '/tmp/no-tsconfig-package';
      fs.mkdirSync(tempDir, { recursive: true });

      await expect(runTypeScriptCheck({ packagePath: tempDir }))
        .rejects.toThrow('tsconfig.json not found in');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for empty packagePath', async () => {
      await expect(runTypeScriptCheck({ packagePath: '' }))
        .rejects.toThrow('packagePath cannot be empty');
    });

    it('should throw error for non-existent packagePath', async () => {
      await expect(runTypeScriptCheck({ packagePath: '/tmp/does-not-exist-xyz-ts' }))
        .rejects.toThrow('packagePath does not exist');
    });

    it('should throw error if packagePath is not a directory', async () => {
      const tempFile = '/tmp/test-file-ts.txt';
      fs.writeFileSync(tempFile, 'test');

      await expect(runTypeScriptCheck({ packagePath: tempFile }))
        .rejects.toThrow('packagePath is not a directory');

      fs.rmSync(tempFile);
    });
  });

  describe('calculateComplianceScore', () => {
    it('should return 100% excellent for all passing checks', () => {
      const input = {
        structure: { passed: true, details: {}, missingFiles: [], invalidFields: [] } as StructureResult,
        typescript: { passed: true, details: {}, errors: [] } as TypeScriptResult,
        lint: { passed: true, details: {}, errors: [], warnings: [] } as LintResult,
        tests: {
          passed: true,
          details: {},
          coverage: { branches: 100, functions: 100, lines: 100, statements: 100, total: 100 },
          requiredCoverage: 80,
          failures: []
        } as TestResult,
        security: { passed: true, details: {}, vulnerabilities: [] } as SecurityResult,
        documentation: { passed: true, details: {}, missing: [] } as DocumentationResult,
        license: { passed: true, details: {}, filesWithoutLicense: [] } as LicenseResult,
        integration: { passed: true, details: {}, issues: [] } as IntegrationResult
      };

      const result = calculateComplianceScore(input);

      expect(result.score).toBe(100);
      expect(result.level).toBe('excellent');
    });

    it('should calculate correct weighted score for mixed results', () => {
      const input = {
        structure: { passed: true, details: {}, missingFiles: [], invalidFields: [] } as StructureResult, // 10%
        typescript: { passed: true, details: {}, errors: [] } as TypeScriptResult, // 20%
        lint: { passed: false, details: {}, errors: [], warnings: [] } as LintResult, // 0% (15% lost)
        tests: {
          passed: true,
          details: {},
          coverage: { branches: 100, functions: 100, lines: 100, statements: 100, total: 100 },
          requiredCoverage: 80,
          failures: []
        } as TestResult, // 25%
        security: { passed: true, details: {}, vulnerabilities: [] } as SecurityResult, // 15%
        documentation: { passed: false, details: {}, missing: [] } as DocumentationResult, // 0% (5% lost)
        license: { passed: true, details: {}, filesWithoutLicense: [] } as LicenseResult, // 5%
        integration: { passed: true, details: {}, issues: [] } as IntegrationResult // 5%
      };

      const result = calculateComplianceScore(input);

      // 10 + 20 + 0 + 25 + 15 + 0 + 5 + 5 = 80%
      expect(result.score).toBe(80);
      expect(result.level).toBe('blocked'); // <85
    });

    it('should return 0% blocked for all failing checks', () => {
      const input = {
        structure: { passed: false, details: {}, missingFiles: [], invalidFields: [] } as StructureResult,
        typescript: { passed: false, details: {}, errors: [] } as TypeScriptResult,
        lint: { passed: false, details: {}, errors: [], warnings: [] } as LintResult,
        tests: {
          passed: false,
          details: {},
          coverage: { branches: 0, functions: 0, lines: 0, statements: 0, total: 0 },
          requiredCoverage: 80,
          failures: []
        } as TestResult,
        security: { passed: false, details: {}, vulnerabilities: [] } as SecurityResult,
        documentation: { passed: false, details: {}, missing: [] } as DocumentationResult,
        license: { passed: false, details: {}, filesWithoutLicense: [] } as LicenseResult,
        integration: { passed: false, details: {}, issues: [] } as IntegrationResult
      };

      const result = calculateComplianceScore(input);

      expect(result.score).toBe(0);
      expect(result.level).toBe('blocked');
    });

    it('should return excellent at 95% threshold boundary', () => {
      const input = {
        structure: { passed: true, details: {}, missingFiles: [], invalidFields: [] } as StructureResult, // 10%
        typescript: { passed: true, details: {}, errors: [] } as TypeScriptResult, // 20%
        lint: { passed: true, details: {}, errors: [], warnings: [] } as LintResult, // 15%
        tests: {
          passed: true,
          details: {},
          coverage: { branches: 100, functions: 100, lines: 100, statements: 100, total: 100 },
          requiredCoverage: 80,
          failures: []
        } as TestResult, // 25%
        security: { passed: true, details: {}, vulnerabilities: [] } as SecurityResult, // 15%
        documentation: { passed: true, details: {}, missing: [] } as DocumentationResult, // 5%
        license: { passed: false, details: {}, filesWithoutLicense: [] } as LicenseResult, // 0% (5% lost)
        integration: { passed: true, details: {}, issues: [] } as IntegrationResult // 5%
      };

      const result = calculateComplianceScore(input);

      // 10 + 20 + 15 + 25 + 15 + 5 + 0 + 5 = 95%
      expect(result.score).toBe(95);
      expect(result.level).toBe('excellent');
    });

    it('should return good at 90% threshold boundary', () => {
      const input = {
        structure: { passed: true, details: {}, missingFiles: [], invalidFields: [] } as StructureResult, // 10%
        typescript: { passed: true, details: {}, errors: [] } as TypeScriptResult, // 20%
        lint: { passed: true, details: {}, errors: [], warnings: [] } as LintResult, // 15%
        tests: {
          passed: true,
          details: {},
          coverage: { branches: 100, functions: 100, lines: 100, statements: 100, total: 100 },
          requiredCoverage: 80,
          failures: []
        } as TestResult, // 25%
        security: { passed: true, details: {}, vulnerabilities: [] } as SecurityResult, // 15%
        documentation: { passed: false, details: {}, missing: [] } as DocumentationResult, // 0% (5% lost)
        license: { passed: false, details: {}, filesWithoutLicense: [] } as LicenseResult, // 0% (5% lost)
        integration: { passed: true, details: {}, issues: [] } as IntegrationResult // 5%
      };

      const result = calculateComplianceScore(input);

      // 10 + 20 + 15 + 25 + 15 + 0 + 0 + 5 = 90%
      expect(result.score).toBe(90);
      expect(result.level).toBe('good');
    });

    it('should return acceptable at 85% threshold boundary', () => {
      const input = {
        structure: { passed: true, details: {}, missingFiles: [], invalidFields: [] } as StructureResult, // 10%
        typescript: { passed: true, details: {}, errors: [] } as TypeScriptResult, // 20%
        lint: { passed: false, details: {}, errors: [], warnings: [] } as LintResult, // 0% (15% lost)
        tests: {
          passed: true,
          details: {},
          coverage: { branches: 100, functions: 100, lines: 100, statements: 100, total: 100 },
          requiredCoverage: 80,
          failures: []
        } as TestResult, // 25%
        security: { passed: true, details: {}, vulnerabilities: [] } as SecurityResult, // 15%
        documentation: { passed: true, details: {}, missing: [] } as DocumentationResult, // 5%
        license: { passed: true, details: {}, filesWithoutLicense: [] } as LicenseResult, // 5%
        integration: { passed: true, details: {}, issues: [] } as IntegrationResult // 5%
      };

      const result = calculateComplianceScore(input);

      // 10 + 20 + 0 + 25 + 15 + 5 + 5 + 5 = 85%
      expect(result.score).toBe(85);
      expect(result.level).toBe('acceptable');
    });

    it('should return blocked at 84% (just below acceptable threshold)', () => {
      const input = {
        structure: { passed: true, details: {}, missingFiles: [], invalidFields: [] } as StructureResult, // 10%
        typescript: { passed: true, details: {}, errors: [] } as TypeScriptResult, // 20%
        lint: { passed: false, details: {}, errors: [], warnings: [] } as LintResult, // 0% (15% lost)
        tests: {
          passed: true,
          details: {},
          coverage: { branches: 100, functions: 100, lines: 100, statements: 100, total: 100 },
          requiredCoverage: 80,
          failures: []
        } as TestResult, // 25%
        security: { passed: true, details: {}, vulnerabilities: [] } as SecurityResult, // 15%
        documentation: { passed: true, details: {}, missing: [] } as DocumentationResult, // 5%
        license: { passed: false, details: {}, filesWithoutLicense: [] } as LicenseResult, // 0% (5% lost)
        integration: { passed: true, details: {}, issues: [] } as IntegrationResult // 5%
      };

      const result = calculateComplianceScore(input);

      // 10 + 20 + 0 + 25 + 15 + 5 + 0 + 5 = 80%
      expect(result.score).toBe(80);
      expect(result.level).toBe('blocked');
    });

    it('should apply proportional test scoring for 80% coverage', () => {
      const input = {
        structure: { passed: true, details: {}, missingFiles: [], invalidFields: [] } as StructureResult, // 10%
        typescript: { passed: true, details: {}, errors: [] } as TypeScriptResult, // 20%
        lint: { passed: true, details: {}, errors: [], warnings: [] } as LintResult, // 15%
        tests: {
          passed: true,
          details: {},
          coverage: { branches: 80, functions: 80, lines: 80, statements: 80, total: 80 },
          requiredCoverage: 80,
          failures: []
        } as TestResult, // 25% * 0.80 = 20%
        security: { passed: true, details: {}, vulnerabilities: [] } as SecurityResult, // 15%
        documentation: { passed: true, details: {}, missing: [] } as DocumentationResult, // 5%
        license: { passed: true, details: {}, filesWithoutLicense: [] } as LicenseResult, // 5%
        integration: { passed: true, details: {}, issues: [] } as IntegrationResult // 5%
      };

      const result = calculateComplianceScore(input);

      // 10 + 20 + 15 + 20 + 15 + 5 + 5 + 5 = 95%
      expect(result.score).toBe(95);
      expect(result.level).toBe('excellent');
    });

    it('should apply proportional test scoring for 50% coverage', () => {
      const input = {
        structure: { passed: true, details: {}, missingFiles: [], invalidFields: [] } as StructureResult, // 10%
        typescript: { passed: true, details: {}, errors: [] } as TypeScriptResult, // 20%
        lint: { passed: true, details: {}, errors: [], warnings: [] } as LintResult, // 15%
        tests: {
          passed: false,
          details: {},
          coverage: { branches: 50, functions: 50, lines: 50, statements: 50, total: 50 },
          requiredCoverage: 80,
          failures: []
        } as TestResult, // 25% * 0.50 = 12.5%
        security: { passed: true, details: {}, vulnerabilities: [] } as SecurityResult, // 15%
        documentation: { passed: true, details: {}, missing: [] } as DocumentationResult, // 5%
        license: { passed: true, details: {}, filesWithoutLicense: [] } as LicenseResult, // 5%
        integration: { passed: true, details: {}, issues: [] } as IntegrationResult // 5%
      };

      const result = calculateComplianceScore(input);

      // 10 + 20 + 15 + 12.5 + 15 + 5 + 5 + 5 = 87.5%
      expect(result.score).toBe(87.5);
      expect(result.level).toBe('acceptable');
    });

    it('should apply proportional test scoring for 0% coverage', () => {
      const input = {
        structure: { passed: true, details: {}, missingFiles: [], invalidFields: [] } as StructureResult, // 10%
        typescript: { passed: true, details: {}, errors: [] } as TypeScriptResult, // 20%
        lint: { passed: true, details: {}, errors: [], warnings: [] } as LintResult, // 15%
        tests: {
          passed: false,
          details: {},
          coverage: { branches: 0, functions: 0, lines: 0, statements: 0, total: 0 },
          requiredCoverage: 80,
          failures: []
        } as TestResult, // 25% * 0 = 0%
        security: { passed: true, details: {}, vulnerabilities: [] } as SecurityResult, // 15%
        documentation: { passed: true, details: {}, missing: [] } as DocumentationResult, // 5%
        license: { passed: true, details: {}, filesWithoutLicense: [] } as LicenseResult, // 5%
        integration: { passed: true, details: {}, issues: [] } as IntegrationResult // 5%
      };

      const result = calculateComplianceScore(input);

      // 10 + 20 + 15 + 0 + 15 + 5 + 5 + 5 = 75%
      expect(result.score).toBe(75);
      expect(result.level).toBe('blocked');
    });
  });
});
