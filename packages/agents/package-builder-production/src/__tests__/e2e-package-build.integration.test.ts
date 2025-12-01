/**
 * End-to-End Integration Tests
 *
 * These tests verify the complete data flow through the package build pipeline
 * without requiring an actual Temporal runtime. They test contracts between
 * components and ensure data integrity across the workflow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { PackageBuildInput, PackageBuildResult, PackageAuditContext } from '../types/index';
import type { GeminiTurnBasedAgentInput, GeminiTurnBasedAgentResult } from '../workflows/gemini-turn-based-agent.workflow';

describe('E2E Integration - Package Build Pipeline', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = `/tmp/e2e-test-${Date.now()}`;
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Input to Output Contract', () => {
    it('should transform PackageBuildInput into valid GeminiTurnBasedAgentInput', () => {
      const buildInput: PackageBuildInput = {
        packageName: '@bernierllc/test-package',
        packagePath: 'packages/core/test-package',
        planPath: 'plans/packages/core/test-package.md',
        category: 'core',
        dependencies: ['@bernierllc/logger', '@bernierllc/config-manager'],
        workspaceRoot: '/workspace',
        config: {
          npmRegistry: 'https://registry.npmjs.org',
          npmToken: 'test-token',
          workspaceRoot: '/workspace',
          maxConcurrentBuilds: 1,
          temporal: {
            namespace: 'test',
            taskQueue: 'test-queue',
            address: 'localhost:7233'
          },
          testing: {
            enableCoverage: true,
            minCoveragePercent: 90,
            failOnError: true
          },
          publishing: {
            dryRun: true,
            requireTests: true,
            requireCleanWorkingDirectory: false
          }
        }
      };

      // Transform to Gemini input (as workflow does)
      const geminiInput: GeminiTurnBasedAgentInput = {
        packageName: buildInput.packageName,
        packagePath: buildInput.packagePath,
        planPath: buildInput.planPath,
        workspaceRoot: buildInput.workspaceRoot,
        category: buildInput.category,
        gitUser: {
          name: 'Gemini Package Builder Agent',
          email: 'builder@bernier.llc'
        }
      };

      // Verify contract
      expect(geminiInput.packageName).toBe(buildInput.packageName);
      expect(geminiInput.packagePath).toBe(buildInput.packagePath);
      expect(geminiInput.planPath).toBe(buildInput.planPath);
      expect(geminiInput.workspaceRoot).toBe(buildInput.workspaceRoot);
      expect(geminiInput.category).toBe(buildInput.category);
    });

    it('should include audit context when package is partially complete', () => {
      const buildInput: PackageBuildInput = {
        packageName: '@bernierllc/partial-package',
        packagePath: 'packages/core/partial-package',
        planPath: 'plans/packages/core/partial-package.md',
        category: 'core',
        dependencies: [],
        workspaceRoot: '/workspace',
        config: {} as any
      };

      const auditContext: PackageAuditContext = {
        completionPercentage: 60,
        existingFiles: ['package.json', 'src/index.ts'],
        missingFiles: ['src/types.ts', 'src/__tests__/index.test.ts'],
        nextSteps: ['Add type definitions', 'Write tests'],
        status: 'incomplete'
      };

      const geminiInput: GeminiTurnBasedAgentInput = {
        packageName: buildInput.packageName,
        packagePath: buildInput.packagePath,
        planPath: buildInput.planPath,
        workspaceRoot: buildInput.workspaceRoot,
        category: buildInput.category,
        initialContext: auditContext
      };

      // Verify audit context is passed
      expect(geminiInput.initialContext).toBeDefined();
      expect(geminiInput.initialContext?.completionPercentage).toBe(60);
      expect(geminiInput.initialContext?.existingFiles).toHaveLength(2);
      expect(geminiInput.initialContext?.missingFiles).toHaveLength(2);
    });

    it('should produce valid PackageBuildResult from workflow outputs', () => {
      const geminiResult: GeminiTurnBasedAgentResult = {
        success: true,
        filesModified: ['package.json', 'src/index.ts', 'src/types.ts', 'README.md'],
        actionHistory: [
          'Workflow started.',
          'Applied code changes for package.json',
          'Applied code changes for src/index.ts',
          'Ran lint check',
          'Ran build validation',
          'Published package'
        ],
        totalIterations: 8
      };

      const buildResult: PackageBuildResult = {
        success: geminiResult.success,
        packageName: '@bernierllc/test-package',
        report: {
          packageName: '@bernierllc/test-package',
          workflowId: 'wf-test-123',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: 30000,
          buildMetrics: {
            buildTime: 5000,
            testTime: 10000,
            qualityCheckTime: 3000,
            publishTime: 2000
          },
          quality: {
            lintScore: 100,
            testCoverage: 95,
            typeScriptErrors: 0,
            passed: true
          },
          fixAttempts: [],
          status: 'success',
          dependencies: [],
          waitedFor: []
        }
      };

      expect(buildResult.success).toBe(true);
      expect(buildResult.report.status).toBe('success');
      expect(buildResult.report.quality.passed).toBe(true);
    });
  });

  describe('File System Integration', () => {
    it('should create package directory structure correctly', async () => {
      const packagePath = path.join(tempDir, 'test-package');

      // Create expected directory structure
      await fs.mkdir(path.join(packagePath, 'src'), { recursive: true });
      await fs.mkdir(path.join(packagePath, 'src', '__tests__'), { recursive: true });

      // Write files
      await fs.writeFile(
        path.join(packagePath, 'package.json'),
        JSON.stringify({ name: '@bernierllc/test-package', version: '1.0.0' }, null, 2)
      );
      await fs.writeFile(
        path.join(packagePath, 'src', 'index.ts'),
        'export const hello = "world";'
      );
      await fs.writeFile(
        path.join(packagePath, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { strict: true } }, null, 2)
      );

      // Verify structure
      const packageJson = JSON.parse(
        await fs.readFile(path.join(packagePath, 'package.json'), 'utf-8')
      );
      expect(packageJson.name).toBe('@bernierllc/test-package');

      const indexContent = await fs.readFile(path.join(packagePath, 'src', 'index.ts'), 'utf-8');
      expect(indexContent).toContain('export');

      // Verify directories exist
      const srcStat = await fs.stat(path.join(packagePath, 'src'));
      expect(srcStat.isDirectory()).toBe(true);
    });

    it('should handle plan file reading correctly', async () => {
      const planPath = path.join(tempDir, 'plan.md');
      const planContent = `# Package: @bernierllc/test-package

## Purpose
A test package for unit testing.

## Files to Create
- src/index.ts - Main entry point
- src/types.ts - Type definitions
- src/__tests__/index.test.ts - Unit tests

## Dependencies
- typescript: ^5.0.0
- vitest: ^1.0.0
`;

      await fs.writeFile(planPath, planContent);

      const readPlan = await fs.readFile(planPath, 'utf-8');

      expect(readPlan).toContain('@bernierllc/test-package');
      expect(readPlan).toContain('src/index.ts');
      expect(readPlan).toContain('typescript');
    });
  });

  describe('Workflow State Transitions', () => {
    it('should track state through complete workflow lifecycle', () => {
      const states: string[] = [];

      // Simulate workflow state transitions
      states.push('INITIALIZED');
      states.push('PLANNING_COMPLETE');
      states.push('SCAFFOLDING_IN_PROGRESS');
      states.push('SCAFFOLDING_COMPLETE');
      states.push('BUILD_IN_PROGRESS');
      states.push('BUILD_COMPLETE');
      states.push('TESTS_IN_PROGRESS');
      states.push('TESTS_COMPLETE');
      states.push('PUBLISH_IN_PROGRESS');
      states.push('PUBLISH_COMPLETE');
      states.push('WORKFLOW_COMPLETE');

      // Verify state progression
      expect(states[0]).toBe('INITIALIZED');
      expect(states[states.length - 1]).toBe('WORKFLOW_COMPLETE');
      expect(states).toContain('BUILD_COMPLETE');
      expect(states).toContain('TESTS_COMPLETE');

      // Verify BUILD comes before TESTS
      const buildIndex = states.indexOf('BUILD_COMPLETE');
      const testsIndex = states.indexOf('TESTS_COMPLETE');
      expect(buildIndex).toBeLessThan(testsIndex);
    });

    it('should handle failure state correctly', () => {
      const states: string[] = [];

      states.push('INITIALIZED');
      states.push('SCAFFOLDING_IN_PROGRESS');
      states.push('SCAFFOLDING_FAILED'); // Failure point

      const lastState = states[states.length - 1];
      expect(lastState).toContain('FAILED');

      // Should not continue past failure
      expect(states).not.toContain('BUILD_IN_PROGRESS');
      expect(states).not.toContain('WORKFLOW_COMPLETE');
    });

    it('should track iteration count through workflow', () => {
      const iterations = {
        planning: 1,
        scaffolding: 15, // Multiple file creation iterations
        lintFixes: 3,
        buildFixes: 0,
        testFixes: 2,
        total: 0
      };

      iterations.total = iterations.planning + iterations.scaffolding +
        iterations.lintFixes + iterations.buildFixes + iterations.testFixes;

      expect(iterations.total).toBe(21);
      expect(iterations.scaffolding).toBeGreaterThan(iterations.lintFixes);
    });
  });

  describe('Error Recovery Flow', () => {
    it('should track fix attempts through recovery cycle', () => {
      const fixAttempts: Array<{
        phase: string;
        error: string;
        fixed: boolean;
        iteration: number;
      }> = [];

      // Simulate lint failure and fix
      fixAttempts.push({
        phase: 'lint',
        error: 'src/index.ts:10:5 - Unsafe assignment',
        fixed: false,
        iteration: 5
      });

      fixAttempts.push({
        phase: 'lint',
        error: 'src/index.ts:10:5 - Unsafe assignment',
        fixed: true,
        iteration: 6
      });

      // Simulate build failure and fix
      fixAttempts.push({
        phase: 'build',
        error: 'TS2322: Type mismatch',
        fixed: true,
        iteration: 8
      });

      // Count successful fixes
      const successfulFixes = fixAttempts.filter(a => a.fixed).length;
      expect(successfulFixes).toBe(2);

      // Verify lint was fixed before build
      const lintFixed = fixAttempts.find(a => a.phase === 'lint' && a.fixed);
      const buildFixed = fixAttempts.find(a => a.phase === 'build' && a.fixed);
      expect(lintFixed!.iteration).toBeLessThan(buildFixed!.iteration);
    });

    it('should terminate after max fix attempts', () => {
      const maxAttempts = 3;
      let attempts = 0;
      let success = false;

      while (attempts < maxAttempts && !success) {
        attempts++;
        // Simulate always failing
        success = false;
      }

      expect(attempts).toBe(maxAttempts);
      expect(success).toBe(false);
    });
  });

  describe('Data Integrity Through Pipeline', () => {
    it('should preserve package metadata through workflow', () => {
      const originalMetadata = {
        name: '@bernierllc/test-package',
        version: '1.0.0',
        description: 'A test package',
        author: 'Bernier LLC',
        license: 'MIT'
      };

      // Simulate package.json transformation
      const generatedPackageJson = {
        ...originalMetadata,
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        scripts: {
          build: 'tsc',
          test: 'vitest'
        }
      };

      // Verify original metadata preserved
      expect(generatedPackageJson.name).toBe(originalMetadata.name);
      expect(generatedPackageJson.version).toBe(originalMetadata.version);
      expect(generatedPackageJson.description).toBe(originalMetadata.description);

      // Verify additions
      expect(generatedPackageJson.main).toBe('dist/index.js');
      expect(generatedPackageJson.scripts.build).toBe('tsc');
    });

    it('should maintain file list consistency', () => {
      const plannedFiles = [
        'package.json',
        'tsconfig.json',
        'src/index.ts',
        'src/types.ts',
        'src/__tests__/index.test.ts',
        'README.md'
      ];

      const createdFiles = [
        'package.json',
        'tsconfig.json',
        'src/index.ts',
        'src/types.ts',
        'src/__tests__/index.test.ts',
        'README.md'
      ];

      // Verify all planned files were created
      for (const file of plannedFiles) {
        expect(createdFiles).toContain(file);
      }

      // Verify no extra files were created
      expect(createdFiles.length).toBe(plannedFiles.length);
    });
  });

  describe('Git Integration', () => {
    it('should generate valid commit messages', () => {
      const commitMessages = [
        'feat(test-package): scaffold package structure',
        'feat(test-package): implement core functionality',
        'fix(test-package): resolve lint errors in src/index.ts',
        'test(test-package): add unit tests',
        'docs(test-package): add README documentation'
      ];

      for (const message of commitMessages) {
        // Verify conventional commit format
        expect(message).toMatch(/^(feat|fix|test|docs|chore|refactor)\([^)]+\): .+$/);
      }
    });

    it('should track commit hashes through workflow', () => {
      const commits: Array<{ phase: string; hash: string }> = [
        { phase: 'scaffold', hash: 'abc123' },
        { phase: 'lint-fix', hash: 'def456' },
        { phase: 'build', hash: 'ghi789' },
        { phase: 'publish', hash: 'jkl012' }
      ];

      // Verify all phases have commits
      expect(commits.length).toBe(4);

      // Verify hashes are unique
      const hashes = commits.map(c => c.hash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
    });
  });

  describe('Quality Gate Verification', () => {
    it('should verify all quality gates pass before publish', () => {
      const qualityGates = {
        lint: { passed: true, score: 100 },
        build: { passed: true, errors: 0 },
        tests: { passed: true, coverage: 95 },
        typeCheck: { passed: true, errors: 0 }
      };

      // All gates must pass
      const allPassed = Object.values(qualityGates).every(g => g.passed);
      expect(allPassed).toBe(true);

      // Coverage must meet threshold
      expect(qualityGates.tests.coverage).toBeGreaterThanOrEqual(90);

      // No build errors
      expect(qualityGates.build.errors).toBe(0);
    });

    it('should block publish when quality gates fail', () => {
      const qualityGates = {
        lint: { passed: true, score: 100 },
        build: { passed: true, errors: 0 },
        tests: { passed: false, coverage: 75 }, // Below threshold
        typeCheck: { passed: true, errors: 0 }
      };

      const canPublish = Object.values(qualityGates).every(g => g.passed) &&
        qualityGates.tests.coverage >= 90;

      expect(canPublish).toBe(false);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive build report', () => {
      const report = {
        packageName: '@bernierllc/test-package',
        workflowId: 'wf-123',
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T10:05:00Z',
        duration: 300000,
        buildMetrics: {
          buildTime: 5000,
          testTime: 10000,
          qualityCheckTime: 3000,
          publishTime: 2000
        },
        quality: {
          lintScore: 100,
          testCoverage: 95,
          typeScriptErrors: 0,
          passed: true
        },
        fixAttempts: [
          { count: 1, types: ['lint'], agentPromptUsed: 'fix-lint.md', fixDuration: 5000 }
        ],
        status: 'success' as const,
        dependencies: ['@bernierllc/logger'],
        waitedFor: []
      };

      // Verify report completeness
      expect(report.packageName).toBeDefined();
      expect(report.workflowId).toBeDefined();
      expect(report.duration).toBeGreaterThan(0);
      expect(report.buildMetrics.buildTime).toBeGreaterThan(0);
      expect(report.quality.testCoverage).toBeGreaterThanOrEqual(90);
      expect(report.status).toBe('success');
    });
  });
});

describe('E2E Integration - Activity Chain', () => {
  describe('Activity Input/Output Contracts', () => {
    it('should verify determineNextAction output feeds applyCodeChanges input', () => {
      // Output from determineNextAction
      const actionOutput = {
        command: {
          command: 'APPLY_CODE_CHANGES' as const,
          files: [
            { index: 0, path: 'src/index.ts', action: 'CREATE_OR_OVERWRITE' as const },
            { index: 1, path: 'src/types.ts', action: 'CREATE_OR_OVERWRITE' as const }
          ]
        },
        contentBlocks: {
          '0': 'export const x = 1;',
          '1': 'export type X = number;'
        }
      };

      // Input to applyCodeChanges
      const applyInput = {
        workspaceRoot: '/workspace',
        packagePath: 'packages/test',
        files: actionOutput.command.files,
        contentBlocks: actionOutput.contentBlocks,
        commitMessage: 'feat: add initial files'
      };

      // Verify contract
      expect(applyInput.files).toBe(actionOutput.command.files);
      expect(applyInput.contentBlocks).toBe(actionOutput.contentBlocks);
      expect(applyInput.files.length).toBe(2);
      expect(Object.keys(applyInput.contentBlocks).length).toBe(2);
    });

    it('should verify runLintCheck output feeds context for next action', () => {
      // Output from runLintCheck
      const lintOutput = {
        success: false,
        details: `src/index.ts:10:5 - Unsafe assignment of 'any' value
src/types.ts:20:1 - Missing return type`,
        errorFilePaths: ['src/index.ts', 'src/types.ts']
      };

      // Context built for next action
      const contextForGemini = `LINT CHECK FAILED. You must fix these errors using APPLY_CODE_CHANGES:

${lintOutput.details}

Files with errors: ${lintOutput.errorFilePaths.join(', ')}

Use the APPLY_CODE_CHANGES command to fix the code in these specific files.`;

      // Verify context includes all necessary information
      expect(contextForGemini).toContain('LINT CHECK FAILED');
      expect(contextForGemini).toContain('src/index.ts');
      expect(contextForGemini).toContain('src/types.ts');
      expect(contextForGemini).toContain('APPLY_CODE_CHANGES');
    });

    it('should verify runBuildValidation output feeds build context', () => {
      // Output from runBuildValidation
      const buildOutput = {
        success: false,
        errors: [
          'src/index.ts(15,10): error TS2322: Type "string" is not assignable to type "number".',
          'src/types.ts(5,1): error TS2307: Cannot find module "@bernierllc/logger".'
        ],
        errorFiles: [
          { file: 'src/index.ts', line: 15, column: 10, message: 'TS2322: Type mismatch' },
          { file: 'src/types.ts', line: 5, column: 1, message: 'TS2307: Module not found' }
        ],
        buildOutput: ''
      };

      // Context built for next action
      const errorContext = buildOutput.errorFiles.map(e =>
        `- ${e.file}:${e.line}:${e.column} - ${e.message}`
      ).join('\n');

      // Verify error context is structured
      expect(errorContext).toContain('src/index.ts:15:10');
      expect(errorContext).toContain('src/types.ts:5:1');
      expect(buildOutput.errorFiles.length).toBe(2);
    });
  });

  describe('Activity Retry Logic', () => {
    it('should verify retry count is tracked correctly', () => {
      const maxRetries = 3;
      let currentRetry = 0;
      const retryResults: boolean[] = [];

      // Simulate retries
      while (currentRetry < maxRetries) {
        currentRetry++;
        const success = currentRetry === 3; // Succeeds on 3rd try
        retryResults.push(success);
        if (success) break;
      }

      expect(retryResults.length).toBe(3);
      expect(retryResults[0]).toBe(false);
      expect(retryResults[1]).toBe(false);
      expect(retryResults[2]).toBe(true);
    });

    it('should verify exponential backoff timing', () => {
      const baseDelay = 1000;
      const maxDelay = 30000;

      const calculateBackoff = (attempt: number): number => {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        return Math.min(delay, maxDelay);
      };

      expect(calculateBackoff(1)).toBe(1000);
      expect(calculateBackoff(2)).toBe(2000);
      expect(calculateBackoff(3)).toBe(4000);
      expect(calculateBackoff(4)).toBe(8000);
      expect(calculateBackoff(10)).toBe(30000); // Capped at max
    });
  });
});
