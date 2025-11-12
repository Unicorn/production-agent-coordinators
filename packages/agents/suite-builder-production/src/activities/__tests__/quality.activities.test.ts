import { describe, it, expect } from 'vitest';
import { validatePackageStructure, runTypeScriptCheck, runLintCheck, calculateComplianceScore, runTestsWithCoverage, runSecurityAudit, validateDocumentation, validateLicenseHeaders } from '../quality.activities';
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

  describe('runLintCheck', () => {
    it('should pass for package with no lint errors', async () => {
      const tempDir = '/tmp/valid-lint-package';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });

      // Create a minimal package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
          scripts: {
            lint: 'eslint .'
          },
          devDependencies: {
            eslint: '*'
          }
        })
      );

      // Link to workspace eslint
      const eslintPath = '/Users/mattbernier/projects/production-agent-coordinators/.worktrees/production-suite-builder/.worktrees/autonomous-workflow/node_modules/eslint';
      const targetNodeModules = path.join(tempDir, 'node_modules/eslint');
      if (fs.existsSync(eslintPath)) {
        fs.symlinkSync(eslintPath, targetNodeModules, 'dir');
      }

      // Create .bin directory and symlink eslint
      const binDir = path.join(tempDir, 'node_modules', '.bin');
      fs.mkdirSync(binDir, { recursive: true });
      const eslintBinSource = path.join(eslintPath, 'bin', 'eslint.js');
      const eslintBinTarget = path.join(binDir, 'eslint');
      if (fs.existsSync(eslintBinSource)) {
        fs.symlinkSync(eslintBinSource, eslintBinTarget, 'file');
      }

      // Create a simple .eslintrc.js config
      fs.writeFileSync(
        path.join(tempDir, '.eslintrc.js'),
        `module.exports = {
          env: { node: true, es2021: true },
          extends: 'eslint:recommended',
          parserOptions: { ecmaVersion: 12 }
        };`
      );

      // Write valid JavaScript code
      fs.writeFileSync(
        path.join(tempDir, 'src/index.js'),
        'const x = 1;\nconsole.log(x);\n'
      );

      const result = await runLintCheck({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for package with lint errors', async () => {
      const tempDir = '/tmp/invalid-lint-package';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });

      // Create a minimal package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
          scripts: {
            lint: 'eslint .'
          },
          devDependencies: {
            eslint: '*'
          }
        })
      );

      // Link to workspace eslint
      const eslintPath = '/Users/mattbernier/projects/production-agent-coordinators/.worktrees/production-suite-builder/.worktrees/autonomous-workflow/node_modules/eslint';
      const targetNodeModules = path.join(tempDir, 'node_modules/eslint');
      if (fs.existsSync(eslintPath)) {
        fs.symlinkSync(eslintPath, targetNodeModules, 'dir');
      }

      // Create .bin directory and symlink eslint
      const binDir = path.join(tempDir, 'node_modules', '.bin');
      fs.mkdirSync(binDir, { recursive: true });
      const eslintBinSource = path.join(eslintPath, 'bin', 'eslint.js');
      const eslintBinTarget = path.join(binDir, 'eslint');
      if (fs.existsSync(eslintBinSource)) {
        fs.symlinkSync(eslintBinSource, eslintBinTarget, 'file');
      }

      // Create a simple .eslintrc.js config with strict rules
      fs.writeFileSync(
        path.join(tempDir, '.eslintrc.js'),
        `module.exports = {
          env: { node: true, es2021: true },
          extends: 'eslint:recommended',
          parserOptions: { ecmaVersion: 12 },
          rules: { 'no-unused-vars': 'error', 'no-undef': 'error' }
        };`
      );

      // Write invalid JavaScript code (unused variable and undefined variable)
      fs.writeFileSync(
        path.join(tempDir, 'src/index.js'),
        'const unused = 1;\nconsole.log(undefinedVar);\n'
      );

      const result = await runLintCheck({ packagePath: tempDir });

      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.message.includes('unused') || e.message.includes('undef'))).toBe(true);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should pass with warnings only (warnings are acceptable)', async () => {
      const tempDir = '/tmp/warning-lint-package';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });

      // Create a minimal package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-package',
          version: '1.0.0',
          scripts: {
            lint: 'eslint .'
          },
          devDependencies: {
            eslint: '*'
          }
        })
      );

      // Link to workspace eslint
      const eslintPath = '/Users/mattbernier/projects/production-agent-coordinators/.worktrees/production-suite-builder/.worktrees/autonomous-workflow/node_modules/eslint';
      const targetNodeModules = path.join(tempDir, 'node_modules/eslint');
      if (fs.existsSync(eslintPath)) {
        fs.symlinkSync(eslintPath, targetNodeModules, 'dir');
      }

      // Create .bin directory and symlink eslint
      const binDir = path.join(tempDir, 'node_modules', '.bin');
      fs.mkdirSync(binDir, { recursive: true });
      const eslintBinSource = path.join(eslintPath, 'bin', 'eslint.js');
      const eslintBinTarget = path.join(binDir, 'eslint');
      if (fs.existsSync(eslintBinSource)) {
        fs.symlinkSync(eslintBinSource, eslintBinTarget, 'file');
      }

      // Create .eslintrc.js with warning-level rule
      fs.writeFileSync(
        path.join(tempDir, '.eslintrc.js'),
        `module.exports = {
          env: { node: true, es2021: true },
          extends: 'eslint:recommended',
          parserOptions: { ecmaVersion: 12 },
          rules: { 'no-console': 'warn' }
        };`
      );

      // Write code that triggers warning
      fs.writeFileSync(
        path.join(tempDir, 'src/index.js'),
        'const x = 1;\nconsole.log(x);\n'
      );

      const result = await runLintCheck({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for missing package.json', async () => {
      const tempDir = '/tmp/no-package-json-lint';
      fs.mkdirSync(tempDir, { recursive: true });

      await expect(runLintCheck({ packagePath: tempDir }))
        .rejects.toThrow('package.json not found in');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for empty packagePath', async () => {
      await expect(runLintCheck({ packagePath: '' }))
        .rejects.toThrow('packagePath cannot be empty');
    });

    it('should throw error for non-existent packagePath', async () => {
      await expect(runLintCheck({ packagePath: '/tmp/does-not-exist-lint-xyz' }))
        .rejects.toThrow('packagePath does not exist');
    });

    it('should throw error if packagePath is not a directory', async () => {
      const tempFile = '/tmp/test-file-lint.txt';
      fs.writeFileSync(tempFile, 'test');

      await expect(runLintCheck({ packagePath: tempFile }))
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

  describe('runTestsWithCoverage', () => {
    it('should pass for core package with 95% coverage (above 90% threshold)', async () => {
      const tempDir = '/tmp/core-package-good-coverage';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'packages/core/auth'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'packages/core/auth/coverage'), { recursive: true });

      const packageDir = path.join(tempDir, 'packages/core/auth');

      fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/core-auth',
          version: '1.0.0',
          scripts: { 'test:coverage': 'vitest run --coverage' }
        })
      );

      // Mock coverage summary
      fs.writeFileSync(
        path.join(packageDir, 'coverage/coverage-summary.json'),
        JSON.stringify({
          total: {
            lines: { total: 100, covered: 95, pct: 95 },
            statements: { total: 100, covered: 95, pct: 95 },
            functions: { total: 20, covered: 19, pct: 95 },
            branches: { total: 40, covered: 38, pct: 95 }
          }
        })
      );

      const result = await runTestsWithCoverage({ packagePath: packageDir });

      expect(result.passed).toBe(true);
      expect(result.details.testsPassed).toBe(true);
      expect(result.details.coveragePassed).toBe(true);
      expect(result.coverage.total).toBe(95);
      expect(result.requiredCoverage).toBe(90);
      expect(result.failures).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for core package with 85% coverage (below 90% threshold)', async () => {
      const tempDir = '/tmp/core-package-low-coverage';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'packages/core/auth'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'packages/core/auth/coverage'), { recursive: true });

      const packageDir = path.join(tempDir, 'packages/core/auth');

      fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/core-auth',
          version: '1.0.0',
          scripts: { 'test:coverage': 'vitest run --coverage' }
        })
      );

      fs.writeFileSync(
        path.join(packageDir, 'coverage/coverage-summary.json'),
        JSON.stringify({
          total: {
            lines: { total: 100, covered: 85, pct: 85 },
            statements: { total: 100, covered: 85, pct: 85 },
            functions: { total: 20, covered: 17, pct: 85 },
            branches: { total: 40, covered: 34, pct: 85 }
          }
        })
      );

      const result = await runTestsWithCoverage({ packagePath: packageDir });

      expect(result.passed).toBe(false);
      expect(result.details.testsPassed).toBe(true);
      expect(result.details.coveragePassed).toBe(false);
      expect(result.coverage.total).toBe(85);
      expect(result.requiredCoverage).toBe(90);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should pass for service package with 87% coverage (above 85% threshold)', async () => {
      const tempDir = '/tmp/service-package-good-coverage';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'packages/services/api'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'packages/services/api/coverage'), { recursive: true });

      const packageDir = path.join(tempDir, 'packages/services/api');

      fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/service-api',
          version: '1.0.0',
          scripts: { 'test:coverage': 'vitest run --coverage' }
        })
      );

      fs.writeFileSync(
        path.join(packageDir, 'coverage/coverage-summary.json'),
        JSON.stringify({
          total: {
            lines: { total: 100, covered: 87, pct: 87 },
            statements: { total: 100, covered: 87, pct: 87 },
            functions: { total: 20, covered: 17, pct: 87 },
            branches: { total: 40, covered: 35, pct: 87 }
          }
        })
      );

      const result = await runTestsWithCoverage({ packagePath: packageDir });

      expect(result.passed).toBe(true);
      expect(result.details.testsPassed).toBe(true);
      expect(result.details.coveragePassed).toBe(true);
      expect(result.coverage.total).toBe(87);
      expect(result.requiredCoverage).toBe(85);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for service package with 80% coverage (below 85% threshold)', async () => {
      const tempDir = '/tmp/service-package-low-coverage';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'packages/services/api'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'packages/services/api/coverage'), { recursive: true });

      const packageDir = path.join(tempDir, 'packages/services/api');

      fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/service-api',
          version: '1.0.0',
          scripts: { 'test:coverage': 'vitest run --coverage' }
        })
      );

      fs.writeFileSync(
        path.join(packageDir, 'coverage/coverage-summary.json'),
        JSON.stringify({
          total: {
            lines: { total: 100, covered: 80, pct: 80 },
            statements: { total: 100, covered: 80, pct: 80 },
            functions: { total: 20, covered: 16, pct: 80 },
            branches: { total: 40, covered: 32, pct: 80 }
          }
        })
      );

      const result = await runTestsWithCoverage({ packagePath: packageDir });

      expect(result.passed).toBe(false);
      expect(result.details.testsPassed).toBe(true);
      expect(result.details.coveragePassed).toBe(false);
      expect(result.coverage.total).toBe(80);
      expect(result.requiredCoverage).toBe(85);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should pass for suite package with 82% coverage (above 80% threshold)', async () => {
      const tempDir = '/tmp/suite-package-good-coverage';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'packages/suites/dashboard'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'packages/suites/dashboard/coverage'), { recursive: true });

      const packageDir = path.join(tempDir, 'packages/suites/dashboard');

      fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/suite-dashboard',
          version: '1.0.0',
          scripts: { 'test:coverage': 'vitest run --coverage' }
        })
      );

      fs.writeFileSync(
        path.join(packageDir, 'coverage/coverage-summary.json'),
        JSON.stringify({
          total: {
            lines: { total: 100, covered: 82, pct: 82 },
            statements: { total: 100, covered: 82, pct: 82 },
            functions: { total: 20, covered: 16, pct: 82 },
            branches: { total: 40, covered: 33, pct: 82 }
          }
        })
      );

      const result = await runTestsWithCoverage({ packagePath: packageDir });

      expect(result.passed).toBe(true);
      expect(result.details.testsPassed).toBe(true);
      expect(result.details.coveragePassed).toBe(true);
      expect(result.coverage.total).toBe(82);
      expect(result.requiredCoverage).toBe(80);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for suite package with 75% coverage (below 80% threshold)', async () => {
      const tempDir = '/tmp/suite-package-low-coverage';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'packages/suites/dashboard'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'packages/suites/dashboard/coverage'), { recursive: true });

      const packageDir = path.join(tempDir, 'packages/suites/dashboard');

      fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/suite-dashboard',
          version: '1.0.0',
          scripts: { 'test:coverage': 'vitest run --coverage' }
        })
      );

      fs.writeFileSync(
        path.join(packageDir, 'coverage/coverage-summary.json'),
        JSON.stringify({
          total: {
            lines: { total: 100, covered: 75, pct: 75 },
            statements: { total: 100, covered: 75, pct: 75 },
            functions: { total: 20, covered: 15, pct: 75 },
            branches: { total: 40, covered: 30, pct: 75 }
          }
        })
      );

      const result = await runTestsWithCoverage({ packagePath: packageDir });

      expect(result.passed).toBe(false);
      expect(result.details.testsPassed).toBe(true);
      expect(result.details.coveragePassed).toBe(false);
      expect(result.coverage.total).toBe(75);
      expect(result.requiredCoverage).toBe(80);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should pass for ui package with 82% coverage (above 80% threshold)', async () => {
      const tempDir = '/tmp/ui-package-good-coverage';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'packages/ui/components'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'packages/ui/components/coverage'), { recursive: true });

      const packageDir = path.join(tempDir, 'packages/ui/components');

      fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/ui-components',
          version: '1.0.0',
          scripts: { 'test:coverage': 'vitest run --coverage' }
        })
      );

      fs.writeFileSync(
        path.join(packageDir, 'coverage/coverage-summary.json'),
        JSON.stringify({
          total: {
            lines: { total: 100, covered: 82, pct: 82 },
            statements: { total: 100, covered: 82, pct: 82 },
            functions: { total: 20, covered: 16, pct: 82 },
            branches: { total: 40, covered: 33, pct: 82 }
          }
        })
      );

      const result = await runTestsWithCoverage({ packagePath: packageDir });

      expect(result.passed).toBe(true);
      expect(result.details.testsPassed).toBe(true);
      expect(result.details.coveragePassed).toBe(true);
      expect(result.coverage.total).toBe(82);
      expect(result.requiredCoverage).toBe(80);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for package with test failures', async () => {
      const tempDir = '/tmp/package-test-failures';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'packages/core/auth'), { recursive: true });

      const packageDir = path.join(tempDir, 'packages/core/auth');

      fs.writeFileSync(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/core-auth',
          version: '1.0.0',
          scripts: { 'test:coverage': 'exit 1' } // Simulate test failure
        })
      );

      const result = await runTestsWithCoverage({ packagePath: packageDir });

      expect(result.passed).toBe(false);
      expect(result.details.testsPassed).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);

      fs.rmSync(tempDir, { recursive: true });
    }, 10000);

    it('should throw error for missing package.json', async () => {
      const tempDir = '/tmp/no-package-json-test';
      fs.mkdirSync(tempDir, { recursive: true });

      await expect(runTestsWithCoverage({ packagePath: tempDir }))
        .rejects.toThrow('package.json not found in');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for empty packagePath', async () => {
      await expect(runTestsWithCoverage({ packagePath: '' }))
        .rejects.toThrow('packagePath cannot be empty');
    });

    it('should throw error for non-existent packagePath', async () => {
      await expect(runTestsWithCoverage({ packagePath: '/tmp/does-not-exist-test-xyz' }))
        .rejects.toThrow('packagePath does not exist');
    });

    it('should throw error if packagePath is not a directory', async () => {
      const tempFile = '/tmp/test-file-test.txt';
      fs.writeFileSync(tempFile, 'test');

      await expect(runTestsWithCoverage({ packagePath: tempFile }))
        .rejects.toThrow('packagePath is not a directory');

      fs.rmSync(tempFile);
    });
  });

  describe('validateDocumentation', () => {
    it('should pass for package with complete README', async () => {
      const tempDir = '/tmp/complete-docs-package';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // Write README with all required sections
      fs.writeFileSync(
        path.join(tempDir, 'README.md'),
        `# Test Package

## Installation
Install the package via npm.

## Usage
Here's how to use the package.

## API Reference
Complete API documentation.

## Configuration
Configuration options.

## Examples
Example code snippets.

## Integration Status
Current integration status.
`
      );

      const result = await validateDocumentation({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.missing).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for package with missing sections', async () => {
      const tempDir = '/tmp/incomplete-docs-package';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // Write README with only some sections (missing Usage and Integration Status)
      fs.writeFileSync(
        path.join(tempDir, 'README.md'),
        `# Test Package

## Installation
Install the package via npm.

## API
Complete API documentation.

## Configuration
Configuration options.

## Examples
Example code snippets.
`
      );

      const result = await validateDocumentation({ packagePath: tempDir });

      expect(result.passed).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain('Usage');
      expect(result.missing).toContain('Integration Status');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for package with no README.md', async () => {
      const tempDir = '/tmp/no-readme-package';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      const result = await validateDocumentation({ packagePath: tempDir });

      expect(result.passed).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for missing package.json', async () => {
      const tempDir = '/tmp/no-package-json-docs';
      fs.mkdirSync(tempDir, { recursive: true });

      await expect(validateDocumentation({ packagePath: tempDir }))
        .rejects.toThrow('package.json not found in');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for empty packagePath', async () => {
      await expect(validateDocumentation({ packagePath: '' }))
        .rejects.toThrow('packagePath cannot be empty');
    });

    it('should throw error for non-existent packagePath', async () => {
      await expect(validateDocumentation({ packagePath: '/tmp/does-not-exist-docs-xyz' }))
        .rejects.toThrow('packagePath does not exist');
    });

    it('should throw error if packagePath is not a directory', async () => {
      const tempFile = '/tmp/test-file-docs.txt';
      fs.writeFileSync(tempFile, 'test');

      await expect(validateDocumentation({ packagePath: tempFile }))
        .rejects.toThrow('packagePath is not a directory');

      fs.rmSync(tempFile);
    });

    it('should match sections case-insensitively', async () => {
      const tempDir = '/tmp/case-insensitive-docs';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // Write README with lowercase section names
      fs.writeFileSync(
        path.join(tempDir, 'README.md'),
        `# Test Package

## installation
Install the package via npm.

## usage
Here's how to use the package.

## api reference
Complete API documentation.

## config
Configuration options.

## examples
Example code snippets.

## status
Current integration status.
`
      );

      const result = await validateDocumentation({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.missing).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should accept section variations (e.g., API vs API Reference)', async () => {
      const tempDir = '/tmp/variation-docs';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // Write README with section variations
      fs.writeFileSync(
        path.join(tempDir, 'README.md'),
        `# Test Package

## Installation
Install the package via npm.

## Usage
Here's how to use the package.

### API
Complete API documentation.

## Config
Configuration options.

## Examples
Example code snippets.

### Integration Status
Current integration status.
`
      );

      const result = await validateDocumentation({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.missing).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('runSecurityAudit', () => {
    it('should pass for package with no vulnerabilities', async () => {
      const tempDir = '/tmp/secure-package';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Create package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'secure-package',
          version: '1.0.0',
          dependencies: {}
        })
      );

      // Mock npm audit output with no vulnerabilities
      fs.mkdirSync(path.join(tempDir, '.audit-mock'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.audit-mock', 'audit-output.json'),
        JSON.stringify({
          vulnerabilities: {},
          metadata: {
            vulnerabilities: {
              critical: 0,
              high: 0,
              moderate: 0,
              low: 0,
              info: 0,
              total: 0
            }
          }
        })
      );

      const result = await runSecurityAudit({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.vulnerabilities).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should pass with warnings for package with low/moderate vulnerabilities', async () => {
      const tempDir = '/tmp/low-vuln-package';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Create package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'low-vuln-package',
          version: '1.0.0',
          dependencies: { 'some-package': '1.0.0' }
        })
      );

      // Mock npm audit output with low/moderate vulnerabilities
      fs.mkdirSync(path.join(tempDir, '.audit-mock'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.audit-mock', 'audit-output.json'),
        JSON.stringify({
          vulnerabilities: {
            'some-package': {
              name: 'some-package',
              severity: 'low',
              via: ['test vulnerability'],
              range: '<=1.0.0',
              nodes: ['node_modules/some-package'],
              fixAvailable: true
            },
            'another-package': {
              name: 'another-package',
              severity: 'moderate',
              via: ['test vulnerability 2'],
              range: '<=2.0.0',
              nodes: ['node_modules/another-package'],
              fixAvailable: false
            }
          },
          metadata: {
            vulnerabilities: {
              critical: 0,
              high: 0,
              moderate: 1,
              low: 1,
              info: 0,
              total: 2
            }
          }
        })
      );

      const result = await runSecurityAudit({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities.some(v => v.severity === 'low')).toBe(true);
      expect(result.vulnerabilities.some(v => v.severity === 'moderate')).toBe(true);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for package with high/critical vulnerabilities', async () => {
      const tempDir = '/tmp/high-vuln-package';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });

      // Create package.json
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'high-vuln-package',
          version: '1.0.0',
          dependencies: { 'vulnerable-package': '1.0.0' }
        })
      );

      // Mock npm audit output with high/critical vulnerabilities
      fs.mkdirSync(path.join(tempDir, '.audit-mock'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, '.audit-mock', 'audit-output.json'),
        JSON.stringify({
          vulnerabilities: {
            'vulnerable-package': {
              name: 'vulnerable-package',
              severity: 'high',
              via: ['critical security issue'],
              range: '<=1.0.0',
              nodes: ['node_modules/vulnerable-package'],
              fixAvailable: true
            },
            'critical-package': {
              name: 'critical-package',
              severity: 'critical',
              via: ['remote code execution'],
              range: '<=1.0.0',
              nodes: ['node_modules/critical-package'],
              fixAvailable: true
            }
          },
          metadata: {
            vulnerabilities: {
              critical: 1,
              high: 1,
              moderate: 0,
              low: 0,
              info: 0,
              total: 2
            }
          }
        })
      );

      const result = await runSecurityAudit({ packagePath: tempDir });

      expect(result.passed).toBe(false);
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.vulnerabilities.some(v => v.severity === 'high' || v.severity === 'critical')).toBe(true);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for missing package.json', async () => {
      const tempDir = '/tmp/no-package-json-security';
      fs.mkdirSync(tempDir, { recursive: true });

      await expect(runSecurityAudit({ packagePath: tempDir }))
        .rejects.toThrow('package.json not found in');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for empty packagePath', async () => {
      await expect(runSecurityAudit({ packagePath: '' }))
        .rejects.toThrow('packagePath cannot be empty');
    });

    it('should throw error for non-existent packagePath', async () => {
      await expect(runSecurityAudit({ packagePath: '/tmp/does-not-exist-security-xyz' }))
        .rejects.toThrow('packagePath does not exist');
    });

    it('should throw error if packagePath is not a directory', async () => {
      const tempFile = '/tmp/test-file-security.txt';
      fs.writeFileSync(tempFile, 'test');

      await expect(runSecurityAudit({ packagePath: tempFile }))
        .rejects.toThrow('packagePath is not a directory');

      fs.rmSync(tempFile);
    });
  });

  describe('validateLicenseHeaders', () => {
    it('should pass for package with all .ts files having license headers', async () => {
      const tempDir = '/tmp/license-headers-all-good';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // Create .ts files with license headers
      fs.writeFileSync(
        path.join(tempDir, 'src/index.ts'),
        `/**
 * Copyright (c) Bernier LLC
 * Licensed under MIT
 */

export function hello() {
  return "world";
}`
      );

      fs.writeFileSync(
        path.join(tempDir, 'src/utils.ts'),
        `/**
 * Copyright (c) Bernier LLC
 * Licensed under MIT
 */

export const util = () => {};`
      );

      const result = await validateLicenseHeaders({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.filesWithoutLicense).toHaveLength(0);
      expect(result.details.totalFiles).toBe(2);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should fail for package with some .ts files missing license headers', async () => {
      const tempDir = '/tmp/license-headers-some-missing';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // File with license header
      fs.writeFileSync(
        path.join(tempDir, 'src/index.ts'),
        `/**
 * Copyright (c) Bernier LLC
 * Licensed under MIT
 */

export function hello() {
  return "world";
}`
      );

      // File without license header
      fs.writeFileSync(
        path.join(tempDir, 'src/missing.ts'),
        `export const badFile = () => {
  console.log("no license header");
};`
      );

      const result = await validateLicenseHeaders({ packagePath: tempDir });

      expect(result.passed).toBe(false);
      expect(result.filesWithoutLicense.length).toBeGreaterThan(0);
      expect(result.filesWithoutLicense.some(f => f.includes('missing.ts'))).toBe(true);
      expect(result.details.totalFiles).toBe(2);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should pass for package with no .ts files (only .js, .json, etc.)', async () => {
      const tempDir = '/tmp/license-headers-no-ts';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // Create only non-.ts files
      fs.writeFileSync(
        path.join(tempDir, 'src/index.js'),
        'console.log("no TypeScript files");'
      );

      fs.writeFileSync(
        path.join(tempDir, 'src/config.json'),
        '{ "key": "value" }'
      );

      const result = await validateLicenseHeaders({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.filesWithoutLicense).toHaveLength(0);
      expect(result.details.totalFiles).toBe(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for missing package.json', async () => {
      const tempDir = '/tmp/no-package-json-license';
      fs.mkdirSync(tempDir, { recursive: true });

      await expect(validateLicenseHeaders({ packagePath: tempDir }))
        .rejects.toThrow('package.json not found in');

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should throw error for empty packagePath', async () => {
      await expect(validateLicenseHeaders({ packagePath: '' }))
        .rejects.toThrow('packagePath cannot be empty');
    });

    it('should throw error for non-existent packagePath', async () => {
      await expect(validateLicenseHeaders({ packagePath: '/tmp/does-not-exist-license-xyz' }))
        .rejects.toThrow('packagePath does not exist');
    });

    it('should throw error if packagePath is not a directory', async () => {
      const tempFile = '/tmp/test-file-license.txt';
      fs.writeFileSync(tempFile, 'test');

      await expect(validateLicenseHeaders({ packagePath: tempFile }))
        .rejects.toThrow('packagePath is not a directory');

      fs.rmSync(tempFile);
    });

    it('should skip node_modules, dist, build, coverage directories', async () => {
      const tempDir = '/tmp/license-headers-skip-dirs';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'build'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'coverage'), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // Create .ts file with license header in src
      fs.writeFileSync(
        path.join(tempDir, 'src/index.ts'),
        `/**
 * Copyright (c) Bernier LLC
 * Licensed under MIT
 */

export const main = () => {};`
      );

      // Create .ts files without license headers in excluded directories
      fs.writeFileSync(
        path.join(tempDir, 'node_modules/test.ts'),
        'export const nodeModule = () => {};'
      );

      fs.writeFileSync(
        path.join(tempDir, 'dist/test.ts'),
        'export const distFile = () => {};'
      );

      fs.writeFileSync(
        path.join(tempDir, 'build/test.ts'),
        'export const buildFile = () => {};'
      );

      fs.writeFileSync(
        path.join(tempDir, 'coverage/test.ts'),
        'export const coverageFile = () => {};'
      );

      const result = await validateLicenseHeaders({ packagePath: tempDir });

      // Should only check src/index.ts, not files in excluded directories
      expect(result.passed).toBe(true);
      expect(result.details.totalFiles).toBe(1);
      expect(result.filesWithoutLicense).toHaveLength(0);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should detect license headers case-insensitively', async () => {
      const tempDir = '/tmp/license-headers-case-insensitive';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // File with lowercase copyright
      fs.writeFileSync(
        path.join(tempDir, 'src/lowercase.ts'),
        `/**
 * copyright (c) bernier llc
 * licensed under mit
 */

export const test1 = () => {};`
      );

      // File with uppercase COPYRIGHT
      fs.writeFileSync(
        path.join(tempDir, 'src/uppercase.ts'),
        `/**
 * COPYRIGHT (C) BERNIER LLC
 * LICENSED UNDER MIT
 */

export const test2 = () => {};`
      );

      const result = await validateLicenseHeaders({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.filesWithoutLicense).toHaveLength(0);
      expect(result.details.totalFiles).toBe(2);

      fs.rmSync(tempDir, { recursive: true });
    });

    it('should accept various comment styles (// and /* and /**)', async () => {
      const tempDir = '/tmp/license-headers-comment-styles';
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: '@bernierllc/test-package',
          version: '1.0.0'
        })
      );

      // File with // comment style
      fs.writeFileSync(
        path.join(tempDir, 'src/single-line.ts'),
        `// Copyright (c) Bernier LLC
// Licensed under MIT

export const test1 = () => {};`
      );

      // File with /* */ comment style
      fs.writeFileSync(
        path.join(tempDir, 'src/multi-line.ts'),
        `/*
 * Copyright (c) Bernier LLC
 * Licensed under MIT
 */

export const test2 = () => {};`
      );

      // File with /** */ JSDoc style
      fs.writeFileSync(
        path.join(tempDir, 'src/jsdoc.ts'),
        `/**
 * Copyright (c) Bernier LLC
 * Licensed under MIT
 */

export const test3 = () => {};`
      );

      const result = await validateLicenseHeaders({ packagePath: tempDir });

      expect(result.passed).toBe(true);
      expect(result.filesWithoutLicense).toHaveLength(0);
      expect(result.details.totalFiles).toBe(3);

      fs.rmSync(tempDir, { recursive: true });
    });
  });
});
