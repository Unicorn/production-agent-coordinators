import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import the selectRepairModel function (pure function - doesn't need mocking)
import {
  selectRepairModel,
  type ClaudeComplianceResult,
  type ClaudeModel,
} from '../claude-activities';

describe('Claude Activities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Note: setupClaudeWorkspace and logClaudeAuditEntry tests are skipped
  // because they require complex fs mocking. The workflow integration tests
  // cover these activities through mocked activity proxies.

  describe('selectRepairModel', () => {
    it('should return haiku for ESLint errors (mechanical fixes)', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: 'Error: Unexpected console statement',
        commandsRun: ['npm run lint'],
        failedCommand: 'npm run lint',
        errorType: 'ESLINT_ERROR',
      };

      expect(selectRepairModel(validation)).toBe('haiku');
    });

    it('should return opus for circular dependency issues', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: 'Error: circular dependency detected between moduleA and moduleB',
        commandsRun: ['npm run build'],
        failedCommand: 'npm run build',
        errorType: 'TSC_ERROR',
      };

      expect(selectRepairModel(validation)).toBe('opus');
    });

    it('should return opus for module type mismatch issues', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: 'Error: module type mismatch in exports',
        commandsRun: ['npm run build'],
        failedCommand: 'npm run build',
        errorType: 'TSC_ERROR',
      };

      expect(selectRepairModel(validation)).toBe('opus');
    });

    it('should return opus for design inconsistency issues', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: 'Warning: design inconsistency in interface definitions',
        commandsRun: ['npm run build'],
        failedCommand: 'npm run build',
        errorType: 'TSC_ERROR',
      };

      expect(selectRepairModel(validation)).toBe('opus');
    });

    it('should return opus when module alignment constraint pattern is detected', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: 'Module UserService no longer aligns with Repository constraints',
        commandsRun: ['npm run build'],
        failedCommand: 'npm run build',
        errorType: 'TSC_ERROR',
      };

      expect(selectRepairModel(validation)).toBe('opus');
    });

    it('should return haiku for single-file TypeScript errors', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: "error TS2322: Type 'string' is not assignable to type 'number'",
        commandsRun: ['npm run build'],
        failedCommand: 'npm run build',
        errorType: 'TSC_ERROR',
      };

      expect(selectRepairModel(validation)).toBe('haiku');
    });

    it('should return sonnet for complex multi-file TypeScript errors', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: "error TS2322 in multiple files: Type mismatch\nerror in src/a.ts\nerror in src/b.ts",
        commandsRun: ['npm run build'],
        failedCommand: 'npm run build',
        errorType: 'TSC_ERROR',
      };

      // Contains "multiple files" but not architectural keywords, so sonnet
      expect(selectRepairModel(validation)).toBe('sonnet');
    });

    it('should return sonnet for test failures (complex logic fixes)', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: 'FAIL src/__tests__/utils.test.ts\nExpected: 42\nReceived: undefined',
        commandsRun: ['npm test'],
        failedCommand: 'npm test',
        errorType: 'JEST_FAILURE',
      };

      expect(selectRepairModel(validation)).toBe('sonnet');
    });

    it('should return sonnet for npm install failures', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: 'npm ERR! ERESOLVE unable to resolve dependency tree',
        commandsRun: ['npm install'],
        failedCommand: 'npm install',
        errorType: 'NPM_INSTALL',
      };

      expect(selectRepairModel(validation)).toBe('sonnet');
    });

    it('should return sonnet as default for unrecognized errors', () => {
      const validation: ClaudeComplianceResult = {
        success: false,
        output: 'Unknown error occurred',
        commandsRun: ['npm run something'],
        failedCommand: 'npm run something',
      };

      expect(selectRepairModel(validation)).toBe('sonnet');
    });
  });

  describe('Model selection cost implications', () => {
    const modelCostEstimates: Record<ClaudeModel, number> = {
      haiku: 0.01,
      sonnet: 0.05,
      opus: 0.50,
    };

    it('should optimize cost by using cheapest model for mechanical fixes', () => {
      const lintError: ClaudeComplianceResult = {
        success: false,
        output: 'Unexpected console statement',
        commandsRun: ['npm run lint'],
        errorType: 'ESLINT_ERROR',
      };

      const model = selectRepairModel(lintError);
      expect(modelCostEstimates[model]).toBe(0.01); // Haiku is cheapest
    });

    it('should use most capable model for architectural issues (worth the cost)', () => {
      const architecturalError: ClaudeComplianceResult = {
        success: false,
        output: 'circular dependency between core modules',
        commandsRun: ['npm run build'],
        errorType: 'TSC_ERROR',
      };

      const model = selectRepairModel(architecturalError);
      expect(modelCostEstimates[model]).toBe(0.50); // Opus is most expensive but necessary
    });
  });
});

