/**
 * Phase Executor Activities
 *
 * Execute individual phases of turn-based package generation.
 * Each phase makes focused Claude API calls and commits results.
 */

import { buildAgentPrompt } from './prompt-builder.activities.js';
import { executeAgentWithClaude } from './agent-execution.activities.js';
import { parseAgentResponse } from './response-parser.activities.js';
import { applyFileChanges } from './file-operations.activities.js';
import type {
  GenerationContext,
  PhaseExecutionResult,
  GenerationStep
} from '../types/index.js';

/**
 * Execute PLANNING phase
 *
 * Creates package plan and validates with MECE criteria.
 * Generates architecture blueprint.
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executePlanningPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[PlanningPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    // Step 1.1: Create package plan with MECE validation
    const prompt = await buildAgentPrompt({
      agentName: 'package-planning-agent',
      taskType: 'PACKAGE_SCAFFOLDING',
      instructions: `Create a comprehensive package plan for ${context.packageName}.

The plan should include:
1. Package purpose and scope (clear boundaries)
2. Core interfaces and types
3. Main implementation files
4. Dependencies and integration points
5. Testing strategy (target: ${context.requirements.testCoverageTarget}%)
6. MECE validation (Mutually Exclusive, Collectively Exhaustive)

Integration requirements:
- Logger: ${context.requirements.loggerIntegration}
- Neverhub: ${context.requirements.neverhubIntegration}
- Docs Suite: ${context.requirements.docsSuiteIntegration}

Generate an architecture blueprint document at docs/architecture.md`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: true,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxTokens: 5000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'PLANNING',
      description: 'Created package plan and architecture blueprint',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'PLANNING',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'PLANNING',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute FOUNDATION phase
 *
 * Generates configuration files: package.json, tsconfig.json, etc.
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeFoundationPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[FoundationPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    // Step 2.1: Generate configuration files
    const prompt = await buildFoundationPrompt(context);

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxTokens: 3000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'FOUNDATION',
      description: 'Generated configuration files',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'FOUNDATION',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'FOUNDATION',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Build prompt for foundation phase
 *
 * @param context - Generation context
 * @returns Formatted prompt
 */
async function buildFoundationPrompt(context: GenerationContext): Promise<string> {
  return buildAgentPrompt({
    agentName: 'package-foundation-agent',
    taskType: 'PACKAGE_SCAFFOLDING',
    instructions: `Generate configuration files (package.json, tsconfig.json, .eslintrc.json, .gitignore, jest.config.cjs) for ${context.packageName}.

Based on the plan at ${context.planPath}, create:
1. package.json with all required fields
2. tsconfig.json with strict mode
3. .eslintrc.json for TypeScript
4. .gitignore
5. jest.config.cjs with coverage thresholds (${context.requirements.testCoverageTarget}%)`,
    packagePath: context.packagePath,
    planPath: context.planPath,
    workspaceRoot: context.workspaceRoot,
    includeQualityStandards: true,
    includeFewShotExamples: false,
    includeValidationChecklist: true
  });
}

/**
 * Execute TYPES phase
 *
 * Generates src/types/index.ts with core interfaces and type definitions
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeTypesPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[TypesPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'types-generation-agent',
      taskType: 'PACKAGE_SCAFFOLDING',
      instructions: `Generate TypeScript type definitions at src/types/index.ts for ${context.packageName}.

Based on the architecture blueprint at docs/architecture.md, create:
1. Core interfaces that define the public API
2. Type aliases for common patterns
3. Enums for fixed value sets
4. Utility types if needed
5. Complete JSDoc comments for all exports

All types must:
- Use strict TypeScript (no any types)
- Include comprehensive JSDoc
- Follow naming conventions (PascalCase for types/interfaces)
- Be exported for package consumers`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: false,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxTokens: 4000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'TYPES',
      description: 'Generated type definitions',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'TYPES',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'TYPES',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute CORE_IMPLEMENTATION phase
 *
 * Generates main implementation files for package functionality
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeCoreImplementationPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[CoreImplementationPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'core-implementation-agent',
      taskType: 'FEATURE_IMPLEMENTATION',
      instructions: `Implement core functionality for ${context.packageName}.

Based on the architecture blueprint and type definitions, create:
1. Main implementation files in src/
2. Business logic and algorithms
3. Integration with types from src/types/
4. Proper error handling (throw typed errors)
5. Logger integration (${context.requirements.loggerIntegration})
6. Neverhub integration (${context.requirements.neverhubIntegration})

Quality requirements:
- All functions must have JSDoc comments
- Use strict TypeScript (no any types)
- Include input validation
- Handle edge cases
- Use .js extensions in imports (ES modules)`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: true,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxTokens: 8000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'CORE_IMPLEMENTATION',
      description: 'Implemented core functionality',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'CORE_IMPLEMENTATION',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'CORE_IMPLEMENTATION',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute ENTRY_POINT phase
 *
 * Generates src/index.ts barrel file for package exports
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeEntryPointPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[EntryPointPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'entry-point-agent',
      taskType: 'PACKAGE_SCAFFOLDING',
      instructions: `Generate src/index.ts barrel file for ${context.packageName}.

Review all files in src/ and create a clean public API by:
1. Exporting all public types from src/types/
2. Exporting main functions from implementation files
3. Re-exporting in logical groups
4. Adding JSDoc header for package
5. Using .js extensions in all imports (ES modules)

Do NOT export:
- Internal utilities (if marked private)
- Test files
- Implementation details that should stay internal`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: false,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.2,
      maxTokens: 2000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'ENTRY_POINT',
      description: 'Generated entry point barrel file',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'ENTRY_POINT',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'ENTRY_POINT',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute UTILITIES phase
 *
 * Generates utility and helper functions
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeUtilitiesPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[UtilitiesPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'utilities-agent',
      taskType: 'FEATURE_IMPLEMENTATION',
      instructions: `Generate utility functions for ${context.packageName}.

Based on the core implementation, create helper utilities in src/utils/:
1. Common data transformations
2. Validation helpers
3. Formatting functions
4. Constant definitions
5. Reusable pure functions

Each utility should:
- Have complete JSDoc
- Include examples in comments
- Be fully typed (no any)
- Be pure functions where possible
- Include basic input validation`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: true,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxTokens: 4000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'UTILITIES',
      description: 'Generated utility functions',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'UTILITIES',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'UTILITIES',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute ERROR_HANDLING phase
 *
 * Generates error classes and error handling utilities
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeErrorHandlingPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[ErrorHandlingPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'error-handling-agent',
      taskType: 'FEATURE_IMPLEMENTATION',
      instructions: `Generate error handling infrastructure for ${context.packageName}.

Create in src/errors/:
1. Custom error classes extending Error
2. Error codes/types enum
3. Error factory functions
4. Error serialization helpers

Each error class should:
- Extend Error with proper prototype chain
- Include error code/type property
- Capture context information
- Have clear JSDoc explaining when it's thrown
- Support error chaining (cause property)

Common error types to consider:
- Validation errors
- Configuration errors
- Operation failures
- Integration errors`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: true,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxTokens: 3000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'ERROR_HANDLING',
      description: 'Generated error classes and handlers',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'ERROR_HANDLING',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'ERROR_HANDLING',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute TESTING phase
 *
 * Generates test files with comprehensive coverage
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeTestingPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[TestingPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'testing-agent',
      taskType: 'TESTING',
      instructions: `Generate comprehensive tests for ${context.packageName}.

Coverage target: ${context.requirements.testCoverageTarget}%

Create test files using Vitest:
1. Unit tests for all public functions
2. Integration tests for workflows
3. Edge case testing
4. Error condition testing
5. Mock external dependencies (logger, neverhub)

Test file structure:
- Place in src/__tests__/ directory
- Name as <module>.test.ts
- Use describe/it blocks
- Include beforeEach/afterEach as needed
- Mock external dependencies

Quality requirements:
- Clear test descriptions
- Arrange-Act-Assert pattern
- Test both success and failure cases
- Verify error messages
- Test boundary conditions`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: true,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxTokens: 6000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'TESTING',
      description: 'Generated test files',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'TESTING',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'TESTING',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute DOCUMENTATION phase
 *
 * Generates README.md and updates JSDoc comments
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeDocumentationPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[DocumentationPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'documentation-agent',
      taskType: 'DOCUMENTATION',
      instructions: `Generate comprehensive documentation for ${context.packageName}.

Create:
1. README.md with:
   - Package description and purpose
   - Installation instructions
   - Quick start guide
   - API reference
   - Configuration options
   - Examples section (link to examples/)
   - License and contributing info

2. Update JSDoc comments in source files:
   - Ensure all public APIs have JSDoc
   - Add @example tags with code samples
   - Document all parameters and return types
   - Include @throws documentation

Style:
- Clear and concise
- Code examples that actually work
- Markdown formatting
- Professional tone`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: false,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.4,
      maxTokens: 3000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'DOCUMENTATION',
      description: 'Generated documentation',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'DOCUMENTATION',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'DOCUMENTATION',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute EXAMPLES phase
 *
 * Generates examples/ directory with usage examples
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeExamplesPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[ExamplesPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'examples-agent',
      taskType: 'DOCUMENTATION',
      instructions: `Generate usage examples for ${context.packageName}.

Create in examples/ directory:
1. basic.ts - Simple getting started example
2. advanced.ts - Complex usage patterns
3. error-handling.ts - How to handle errors
4. integration.ts - Integration with other packages (if applicable)
5. README.md - Guide to running examples

Each example should:
- Import from the package (not relative paths)
- Include comments explaining what's happening
- Be runnable with tsx/ts-node
- Show realistic use cases
- Demonstrate best practices
- Handle errors properly

Examples must be:
- Self-contained and runnable
- Well-commented
- Demonstrate key features
- Show common patterns`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: false,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.4,
      maxTokens: 4000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'EXAMPLES',
      description: 'Generated usage examples',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'EXAMPLES',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'EXAMPLES',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute INTEGRATION_REVIEW phase
 *
 * Reviews integration points (logger, neverhub) and suggests improvements
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeIntegrationReviewPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[IntegrationReviewPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'integration-review-agent',
      taskType: 'REFACTORING',
      instructions: `Review integration points for ${context.packageName}.

Integration status:
- Logger: ${context.requirements.loggerIntegration}
- Neverhub: ${context.requirements.neverhubIntegration}
- Docs Suite: ${context.requirements.docsSuiteIntegration}

Review and validate:
1. Logger usage - proper log levels, structured logging
2. Neverhub integration - correct event publishing
3. Error propagation - errors surface correctly
4. Type safety - all integrations properly typed
5. Configuration - integration config is flexible
6. Testing - integrations have mocks/stubs

Generate a review report as INTEGRATION_REVIEW.md including:
- What was reviewed
- Issues found (if any)
- Recommendations for improvement
- Integration checklist status

If issues found, include suggestions for fixes in the response.`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: false,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxTokens: 4000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'INTEGRATION_REVIEW',
      description: 'Reviewed integration points',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'INTEGRATION_REVIEW',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'INTEGRATION_REVIEW',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute CRITICAL_FIXES phase
 *
 * Applies critical fixes identified in integration review
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeCriticalFixesPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[CriticalFixesPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'critical-fixes-agent',
      taskType: 'BUG_FIX',
      instructions: `Apply critical fixes for ${context.packageName}.

Review INTEGRATION_REVIEW.md for issues that need fixing.

Priority fixes:
1. Type safety issues (any types, missing types)
2. Error handling gaps
3. Missing input validation
4. Integration issues (logger, neverhub)
5. Security concerns

For each fix:
- Update the affected file
- Add tests for the fix
- Document what was changed
- Ensure no regressions

Only fix critical issues - don't refactor or optimize unnecessarily.`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: false,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxTokens: 5000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'CRITICAL_FIXES',
      description: 'Applied critical fixes',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'CRITICAL_FIXES',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'CRITICAL_FIXES',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute BUILD_VALIDATION phase
 *
 * Runs build, tests, and lint - fixes issues if found
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeBuildValidationPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[BuildValidationPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'build-validation-agent',
      taskType: 'REFACTORING',
      instructions: `Validate build for ${context.packageName}.

Run these validations:
1. TypeScript compilation (yarn build)
2. Test suite (yarn test)
3. Linting (yarn lint)
4. Type checking (yarn type-check)

Review the codebase and identify any issues that would cause:
- Build failures (import errors, type errors)
- Test failures (incorrect test setup, missing mocks)
- Lint errors (formatting, unused vars)

If you find issues, fix them. Generate:
1. Fixed source files
2. BUILD_VALIDATION.md report with:
   - What was validated
   - Issues found and fixed
   - Commands to run validation
   - Expected output

Validation must pass:
- All tests passing
- Coverage >= ${context.requirements.testCoverageTarget}%
- Zero TypeScript errors
- Zero lint errors`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: false,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxTokens: 4000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'BUILD_VALIDATION',
      description: 'Validated build and fixed issues',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'BUILD_VALIDATION',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'BUILD_VALIDATION',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Execute FINAL_POLISH phase
 *
 * Final quality pass before merge
 *
 * @param context - Generation context
 * @returns Phase execution result
 */
export async function executeFinalPolishPhase(
  context: GenerationContext
): Promise<PhaseExecutionResult> {
  console.log(`[FinalPolishPhase] Starting for ${context.packageName}`);

  const steps: GenerationStep[] = [];
  const filesModified: string[] = [];

  try {
    const prompt = await buildAgentPrompt({
      agentName: 'final-polish-agent',
      taskType: 'REFACTORING',
      instructions: `Final quality pass for ${context.packageName}.

Review entire codebase for:
1. Code quality - clean, readable, well-structured
2. Comments - JSDoc complete and accurate
3. Naming - consistent and descriptive
4. Error messages - helpful and clear
5. README - accurate and complete
6. Examples - working and illustrative
7. Tests - comprehensive and clear

Polish:
- Remove TODO comments
- Fix typos in comments and docs
- Ensure consistent code style
- Verify all imports use .js extensions
- Check package.json metadata is complete
- Ensure no console.log in production code

Generate FINAL_CHECKLIST.md with:
- Quality checklist (all items must be true)
- What was reviewed
- Changes made
- Package ready for merge

This is the last step before merge - everything must be perfect.`,
      packagePath: context.packagePath,
      planPath: context.planPath,
      workspaceRoot: context.workspaceRoot,
      includeQualityStandards: true,
      includeFewShotExamples: false,
      includeValidationChecklist: true
    });

    const claudeResponse = await executeAgentWithClaude({
      prompt,
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.3,
      maxTokens: 3000
    });

    const parsed = await parseAgentResponse({
      responseText: claudeResponse,
      packagePath: context.packagePath
    });

    const fileResult = await applyFileChanges({
      operations: parsed.files,
      packagePath: context.packagePath,
      workspaceRoot: context.workspaceRoot
    });

    filesModified.push(...fileResult.modifiedFiles);

    steps.push({
      stepNumber: context.currentStepNumber + 1,
      phase: 'FINAL_POLISH',
      description: 'Completed final quality pass',
      files: fileResult.modifiedFiles,
      timestamp: Date.now()
    });

    return {
      success: true,
      phase: 'FINAL_POLISH',
      steps,
      filesModified
    };
  } catch (error) {
    return {
      success: false,
      phase: 'FINAL_POLISH',
      steps,
      filesModified,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
