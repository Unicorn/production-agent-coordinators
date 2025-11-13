/**
 * Workflow-safe utility functions
 *
 * These functions contain no Node.js imports and are safe to bundle with workflows.
 */

import type {
  PackageWorkflowInput,
  StructureResult,
  TypeScriptResult,
  LintResult,
  TestResult,
  SecurityResult,
  DocumentationResult,
  LicenseResult,
  IntegrationResult,
  ComplianceScore
} from '../types/index';

export interface ParsedInput {
  type: 'packageName' | 'packageIdea' | 'planFilePath' | 'updatePrompt';
  value: string;
}

export function parseInput(input: PackageWorkflowInput): ParsedInput {
  if (input.packageName) {
    return { type: 'packageName', value: input.packageName };
  }
  if (input.packageIdea) {
    return { type: 'packageIdea', value: input.packageIdea };
  }
  if (input.planFilePath) {
    return { type: 'planFilePath', value: input.planFilePath };
  }
  if (input.updatePrompt) {
    return { type: 'updatePrompt', value: input.updatePrompt };
  }
  throw new Error('No input provided. Must provide one of: packageName, packageIdea, planFilePath, updatePrompt');
}

/**
 * Calculate compliance score from quality check results
 *
 * This is a pure function with no Node.js dependencies, safe for workflow use.
 */
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
