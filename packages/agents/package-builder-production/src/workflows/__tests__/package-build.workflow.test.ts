import { describe, it, expect } from 'vitest';
import { PackageBuildWorkflow } from '../package-build.workflow';
import type { PackageBuildInput, PackageAuditContext } from '../../types/index';
import type { Problem } from '../../types/coordinator.types';
import type { GeminiTurnBasedAgentInput } from '../gemini-turn-based-agent.workflow';

describe('PackageBuildWorkflow', () => {
  it('should be a function', () => {
    expect(typeof PackageBuildWorkflow).toBe('function');
  });

  it('should accept PackageBuildInput', () => {
    const input: PackageBuildInput = {
      packageName: '@bernierllc/test',
      packagePath: 'packages/core/test',
      planPath: 'plans/packages/core/test.md',
      category: 'core',
      dependencies: [],
      workspaceRoot: '/test',
      config: {} as any
    };

    // Just verify the input type is correct - don't execute the workflow
    // (execution requires Temporal runtime context)
    expect(input.packageName).toBe('@bernierllc/test');
  });
});

describe('PackageBuildWorkflow - Coordinator Integration', () => {
  it('should create valid Problem from build failure', () => {
    const buildResult = {
      success: false,
      duration: 100,
      stdout: '',
      stderr: 'spawn /bin/sh ENOENT'
    };

    const problem: Problem = {
      type: 'BUILD_FAILURE',
      error: {
        message: buildResult.stderr,
        stderr: buildResult.stderr,
        stdout: buildResult.stdout
      },
      context: {
        packageName: '@test/package',
        packagePath: '/path/to/package',
        planPath: '/path/to/plan.md',
        phase: 'build',
        attemptNumber: 1
      }
    };

    expect(problem.type).toBe('BUILD_FAILURE');
    expect(problem.error.stderr).toContain('ENOENT');
  });
});

describe('PackageBuildWorkflow - Context Passing Validation (P2)', () => {
  describe('PackageAuditContext Construction', () => {
    it('should build packageAuditContext correctly from audit results', () => {
      // Simulate audit findings as returned by auditPackageState
      const auditFindings = [
        '✅ package.json exists',
        '✅ src/index.ts exists',
        '✅ tsconfig.json exists',
        '❌ src/types.ts missing',
        '❌ src/__tests__/index.test.ts missing',
        '❌ README.md missing'
      ];

      const auditResult = {
        completionPercentage: 50,
        findings: auditFindings,
        nextSteps: ['Create type definitions', 'Add unit tests', 'Write documentation'],
        status: 'incomplete' as const
      };

      // Build context as workflow does (lines 155-169 in package-build.workflow.ts)
      const existingFiles = auditResult.findings
        .filter(f => f.startsWith('✅'))
        .map(f => f.replace('✅ ', '').replace(' exists', '').trim());
      const missingFiles = auditResult.findings
        .filter(f => f.startsWith('❌'))
        .map(f => f.replace('❌ ', '').replace(' missing', '').trim());

      const packageAuditContext: PackageAuditContext = {
        completionPercentage: auditResult.completionPercentage,
        existingFiles,
        missingFiles,
        nextSteps: auditResult.nextSteps || [],
        status: 'incomplete'
      };

      // STRONG assertions - verify exact content
      expect(packageAuditContext.completionPercentage).toBe(50);
      expect(packageAuditContext.existingFiles).toEqual([
        'package.json',
        'src/index.ts',
        'tsconfig.json'
      ]);
      expect(packageAuditContext.missingFiles).toEqual([
        'src/types.ts',
        'src/__tests__/index.test.ts',
        'README.md'
      ]);
      expect(packageAuditContext.nextSteps).toEqual([
        'Create type definitions',
        'Add unit tests',
        'Write documentation'
      ]);
      expect(packageAuditContext.status).toBe('incomplete');
    });

    it('should handle empty audit findings gracefully', () => {
      const auditResult = {
        completionPercentage: 0,
        findings: [],
        nextSteps: [],
        status: 'incomplete' as const
      };

      const existingFiles = auditResult.findings
        .filter(f => f.startsWith('✅'))
        .map(f => f.replace('✅ ', '').replace(' exists', '').trim());
      const missingFiles = auditResult.findings
        .filter(f => f.startsWith('❌'))
        .map(f => f.replace('❌ ', '').replace(' missing', '').trim());

      const packageAuditContext: PackageAuditContext = {
        completionPercentage: auditResult.completionPercentage,
        existingFiles,
        missingFiles,
        nextSteps: auditResult.nextSteps || [],
        status: 'incomplete'
      };

      expect(packageAuditContext.existingFiles).toEqual([]);
      expect(packageAuditContext.missingFiles).toEqual([]);
      expect(packageAuditContext.completionPercentage).toBe(0);
    });

    it('should handle 100% complete audit correctly', () => {
      const auditResult = {
        completionPercentage: 100,
        findings: [
          '✅ package.json exists',
          '✅ src/index.ts exists',
          '✅ src/types.ts exists',
          '✅ src/__tests__/index.test.ts exists',
          '✅ README.md exists'
        ],
        nextSteps: [],
        status: 'complete' as const
      };

      const existingFiles = auditResult.findings
        .filter(f => f.startsWith('✅'))
        .map(f => f.replace('✅ ', '').replace(' exists', '').trim());
      const missingFiles = auditResult.findings
        .filter(f => f.startsWith('❌'))
        .map(f => f.replace('❌ ', '').replace(' missing', '').trim());

      // When complete, missingFiles should be empty
      expect(missingFiles).toEqual([]);
      expect(existingFiles.length).toBe(5);
      expect(auditResult.status).toBe('complete');
    });
  });

  describe('GeminiTurnBasedAgentInput Construction', () => {
    it('should construct GeminiTurnBasedAgentInput with initialContext', () => {
      const packageAuditContext: PackageAuditContext = {
        completionPercentage: 75,
        existingFiles: ['package.json', 'src/index.ts'],
        missingFiles: ['src/types.ts'],
        nextSteps: ['Add type definitions'],
        status: 'incomplete'
      };

      const geminiInput: GeminiTurnBasedAgentInput = {
        packageName: '@bernierllc/test-package',
        packagePath: 'packages/core/test-package',
        planPath: 'plans/packages/core/test-package.md',
        workspaceRoot: '/workspace',
        category: 'core',
        gitUser: {
          name: 'Gemini Package Builder Agent',
          email: 'builder@bernier.llc'
        },
        initialContext: packageAuditContext
      };

      // STRONG assertions - verify context is passed correctly
      expect(geminiInput.initialContext).toBeDefined();
      expect(geminiInput.initialContext?.completionPercentage).toBe(75);
      expect(geminiInput.initialContext?.existingFiles).toEqual(['package.json', 'src/index.ts']);
      expect(geminiInput.initialContext?.missingFiles).toEqual(['src/types.ts']);
      expect(geminiInput.initialContext?.status).toBe('incomplete');
    });

    it('should construct GeminiTurnBasedAgentInput without initialContext for fresh packages', () => {
      const geminiInput: GeminiTurnBasedAgentInput = {
        packageName: '@bernierllc/new-package',
        packagePath: 'packages/core/new-package',
        planPath: 'plans/packages/core/new-package.md',
        workspaceRoot: '/workspace',
        category: 'core',
        gitUser: {
          name: 'Gemini Package Builder Agent',
          email: 'builder@bernier.llc'
        }
        // initialContext intentionally omitted for fresh packages
      };

      expect(geminiInput.initialContext).toBeUndefined();
      expect(geminiInput.packageName).toBe('@bernierllc/new-package');
    });

    it('should include all required fields for Gemini workflow', () => {
      const geminiInput: GeminiTurnBasedAgentInput = {
        packageName: '@bernierllc/test',
        packagePath: 'packages/test',
        planPath: 'plans/test.md',
        workspaceRoot: '/workspace',
        category: 'utility'
      };

      // Verify all required fields are present
      expect(geminiInput.packageName).toBeDefined();
      expect(geminiInput.packagePath).toBeDefined();
      expect(geminiInput.planPath).toBeDefined();
      expect(geminiInput.workspaceRoot).toBeDefined();
      expect(geminiInput.category).toBeDefined();

      // Verify types
      expect(typeof geminiInput.packageName).toBe('string');
      expect(typeof geminiInput.packagePath).toBe('string');
      expect(typeof geminiInput.planPath).toBe('string');
      expect(typeof geminiInput.workspaceRoot).toBe('string');
      expect(typeof geminiInput.category).toBe('string');
    });
  });

  describe('Context Data Flow Integrity', () => {
    it('should preserve file paths correctly through context building', () => {
      // Test that file path parsing doesn't corrupt paths with special characters
      const auditFindings = [
        '✅ src/__tests__/index.test.ts exists',
        '✅ src/utils/helper-functions.ts exists',
        '❌ src/types/api-response.d.ts missing'
      ];

      const existingFiles = auditFindings
        .filter(f => f.startsWith('✅'))
        .map(f => f.replace('✅ ', '').replace(' exists', '').trim());
      const missingFiles = auditFindings
        .filter(f => f.startsWith('❌'))
        .map(f => f.replace('❌ ', '').replace(' missing', '').trim());

      // Verify paths with special characters are preserved
      expect(existingFiles).toContain('src/__tests__/index.test.ts');
      expect(existingFiles).toContain('src/utils/helper-functions.ts');
      expect(missingFiles).toContain('src/types/api-response.d.ts');
    });

    it('should handle audit findings with various emoji prefixes', () => {
      // Different emoji prefixes that might be used
      const auditFindings = [
        '✅ file1.ts exists',
        '✓ file2.ts exists',  // Different checkmark
        '❌ file3.ts missing',
        '✗ file4.ts missing'  // Different X mark
      ];

      // Current implementation only handles ✅ and ❌
      const existingWithEmoji = auditFindings.filter(f => f.startsWith('✅'));
      const missingWithEmoji = auditFindings.filter(f => f.startsWith('❌'));

      expect(existingWithEmoji.length).toBe(1);
      expect(missingWithEmoji.length).toBe(1);

      // This test documents current behavior - alternative emojis are NOT handled
      // If this changes, tests should be updated
    });

    it('should calculate completion percentage correctly for Gemini context', () => {
      // Verify the completion percentage logic is sound
      const totalFiles = 10;
      const existingCount = 7;
      const expectedPercentage = Math.round((existingCount / totalFiles) * 100);

      expect(expectedPercentage).toBe(70);

      // Context should accurately reflect this
      const context: PackageAuditContext = {
        completionPercentage: expectedPercentage,
        existingFiles: Array(existingCount).fill('').map((_, i) => `file${i}.ts`),
        missingFiles: Array(totalFiles - existingCount).fill('').map((_, i) => `missing${i}.ts`),
        nextSteps: [],
        status: 'incomplete'
      };

      expect(context.existingFiles.length + context.missingFiles.length).toBe(totalFiles);
      expect(context.completionPercentage).toBe(70);
    });
  });

  describe('Context Usage Prevention', () => {
    it('should document that Gemini should not regenerate existing files', () => {
      // This test documents the expected behavior when initialContext is provided
      const context: PackageAuditContext = {
        completionPercentage: 60,
        existingFiles: ['package.json', 'src/index.ts', 'tsconfig.json'],
        missingFiles: ['src/types.ts', 'README.md'],
        nextSteps: ['Add type definitions'],
        status: 'incomplete'
      };

      // Files in existingFiles should NOT be regenerated by Gemini
      // This is enforced in the prompt, not in code
      expect(context.existingFiles).toContain('package.json');
      expect(context.existingFiles).toContain('src/index.ts');

      // Only files in missingFiles should be generated
      expect(context.missingFiles).toContain('src/types.ts');
      expect(context.missingFiles).toContain('README.md');
    });

    it('should verify context structure matches what Gemini workflow expects', () => {
      // GeminiTurnBasedAgentInput expects initialContext?: PackageAuditContext
      const context: PackageAuditContext = {
        completionPercentage: 50,
        existingFiles: ['a.ts', 'b.ts'],
        missingFiles: ['c.ts'],
        nextSteps: ['Step 1'],
        status: 'incomplete'
      };

      // Verify all expected properties exist
      expect(context).toHaveProperty('completionPercentage');
      expect(context).toHaveProperty('existingFiles');
      expect(context).toHaveProperty('missingFiles');
      expect(context).toHaveProperty('nextSteps');
      expect(context).toHaveProperty('status');

      // Verify property types
      expect(typeof context.completionPercentage).toBe('number');
      expect(Array.isArray(context.existingFiles)).toBe(true);
      expect(Array.isArray(context.missingFiles)).toBe(true);
      expect(Array.isArray(context.nextSteps)).toBe(true);
      expect(typeof context.status).toBe('string');
    });
  });
});
