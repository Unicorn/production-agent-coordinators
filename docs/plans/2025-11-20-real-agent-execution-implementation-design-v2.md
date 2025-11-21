# Real Agent Execution Implementation Design v2

**Date:** 2025-11-20
**Author:** Claude (AI Assistant)
**Status:** Design Complete, Ready for Implementation
**Version:** 2.0 (Enhanced with GitHub Integration, Testing Harness, and Dynamic Activities)

**Related Documents:**
- [PACKAGE_BUILDER_WORKFLOW_ANALYSIS.md](/PACKAGE_BUILDER_WORKFLOW_ANALYSIS.md)
- [2025-11-14-agentic-coordinator-workflow-design.md](/docs/plans/2025-11-14-agentic-coordinator-workflow-design.md)
- [Version 1.0](/docs/plans/2025-11-20-real-agent-execution-implementation-design.md) (superseded)

---

## Changelog from v1.0

- **GitHub Integration:** Moved from Phase 2 to Phase 1 (included from start)
- **Testing Harness:** Added standalone test harness for testing Claude integration independently
- **Dynamic Activities:** Added meta-agent pattern for processing extra fields from Claude responses
- **Enhanced Prompts:** Added quality standards, few-shot examples, and validation checklists
- **Gotcha Documentation:** Added common failure modes and mitigations

---

## Executive Summary

This design implements real agent execution for the Package Builder workflow system with GitHub integration, standalone testing capabilities, and self-improving meta-agent patterns.

**Key Enhancements:**
1. **GitHub Integration (Phase 1):** Claude can access entire repository for broader context
2. **Testing Harness:** Standalone CLI tools to test each activity independently
3. **Meta-Agent Pattern:** Claude can suggest additional activities based on discoveries
4. **Prompt Optimization:** Quality standards, few-shot examples, validation checklists

**Key Metrics:**
- Current State: 70% orchestration, 0% agent execution
- Target State: 100% functional with self-improvement capabilities
- Implementation Complexity: Medium (5-6 days with testing harness)
- Risk Level: Low (enhances existing, no breaking changes)

---

## Problem Statement

### Current Behavior (Simulation)

The `executeAgentTask()` activity currently returns fake success without generating code.

### Required Behavior (Real Execution)

The enhanced system must:
1. Build context-rich prompts with **GitHub repository access**
2. Call Claude AI to generate/fix code
3. Parse structured responses **including extra fields for dynamic activities**
4. Apply file changes atomically
5. **Process Claude's suggestions for additional work**
6. Return actual results

---

## Architectural Decision

### Chosen Approach: Enhanced Workflow Pattern with GitHub Integration

**Rationale:**
- Full repository access from day 1 (fewer rework loops)
- Testable independently of Temporal (faster iteration)
- Self-improving via meta-agent pattern
- Separation of concerns
- Minimal changes to parent workflows

---

## Detailed Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ CoordinatorWorkflow (unchanged)                              │
│  - Analyzes problem                                          │
│  - Selects appropriate agent                                 │
│  - Builds instructions                                       │
└───────────────────┬─────────────────────────────────────────┘
                    │ delegates to
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ AgentExecutorWorkflow (ENHANCED)                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 1. buildAgentPrompt(...)                           │    │
│  │    - Load plan file                                │    │
│  │    - Build GitHub context (token, repo, branch)    │ ←NEW
│  │    - Include quality standards + examples          │ ←NEW
│  │    - Add validation checklist                      │ ←NEW
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │ 2. executeAgentWithClaude(prompt, config)          │    │
│  │    - Call Anthropic SDK                            │    │
│  │    - Handle retries, rate limits                   │    │
│  │    - Return full JSON response (with extra fields) │ ←NEW
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │ 3. parseAgentResponse(response)                    │    │
│  │    - Parse required fields (files, summary)        │    │
│  │    - Extract extra fields (questions, suggestions) │ ←NEW
│  │    - Validate file operations                      │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │ 4. processExtraFields(extraFields, context)        │ ←NEW
│  │    - Evaluate questions (ask coordinator)          │    │
│  │    - Evaluate suggestions (create follow-up tasks) │    │
│  │    - Return enriched context for file operations   │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │ 5. applyFileChanges(operations, packagePath)       │    │
│  │    - Create directories                            │    │
│  │    - Write/update/delete files                     │    │
│  │    - Validate security                             │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│                   ▼                                          │
│              Return AgentExecutionResult                     │
│              (including suggested follow-up tasks)       ←NEW
└─────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. buildAgentPrompt Activity (Enhanced with GitHub)

**File:** `src/activities/prompt-builder.activities.ts`

**Input:**
```typescript
interface BuildPromptInput {
  agentName: string;
  taskType: string;
  instructions: string;
  packagePath: string;
  planPath: string;
  workspaceRoot: string;

  // NEW: GitHub integration
  githubContext?: {
    token: string;
    repo: string;      // "owner/repo"
    branch: string;    // "main"
    commitSha?: string;
  };

  // NEW: Quality configuration
  includeQualityStandards?: boolean;
  includeFewShotExamples?: boolean;
  includeValidationChecklist?: boolean;
}
```

**Enhanced Prompt Template:**
```markdown
You are the {agentName} agent specializing in {skills from registry}.

{QUALITY_STANDARDS}

TASK TYPE: {taskType}

CONTEXT:
Package: {packageName}
Path: {packagePath}
Repository: https://github.com/{owner}/{repo}/tree/{branch}
GitHub Token: {token} (use to fetch additional files via API)

NOTE: You can fetch additional context from the repository using:
GET https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}
Authorization: token {token}

PLAN:
{planContent}

CRITICAL FILES (always included):
{package.json, tsconfig.json, src/index.ts}

TASK INSTRUCTIONS:
{instructions}

{LEARNED_IMPROVEMENTS for this task type}

{FEW_SHOT_EXAMPLE}

{PRE_VALIDATION_CHECKLIST}

OUTPUT FORMAT (JSON only):
{
  "files": [
    {"path": "...", "operation": "create|update|delete", "content": "..."}
  ],
  "summary": "Brief description of changes",
  "qualityChecklist": {
    "strictModeEnabled": boolean,
    "noAnyTypes": boolean,
    "testCoverageAbove80": boolean,
    "allPublicFunctionsDocumented": boolean,
    "errorHandlingComplete": boolean
  },

  // OPTIONAL: Extra fields for meta-agent pattern
  "questions": [
    {
      "question": "Should the logger support custom transports?",
      "context": "The plan mentions 'extensible', but doesn't specify custom transports",
      "suggestedAnswer": "Yes, based on similar packages in monorepo"
    }
  ],
  "suggestions": [
    {
      "type": "ADDITIONAL_DEPENDENCY",
      "description": "Package needs @types/node for file system types",
      "priority": "high",
      "autoExecute": true
    }
  ],
  "filesToFetch": [
    {
      "path": "packages/core/logger/src/transports.ts",
      "reason": "Need to understand transport interface for compatibility"
    }
  ]
}
```

**Quality Standards Template:**
```typescript
const QUALITY_STANDARDS = `
QUALITY REQUIREMENTS (Your output MUST meet these standards):

1. TypeScript:
   - Strict mode enabled in tsconfig.json
   - No 'any' types (use 'unknown' or specific types)
   - Proper JSDoc comments on exported functions
   - Import from '@/' for internal modules

2. Testing:
   - Use Vitest (not Jest)
   - Test file pattern: *.test.ts
   - Minimum 80% code coverage
   - Test both happy path and error cases
   - Mock external dependencies

3. Package Structure:
   - src/ for source files
   - tests/ for test files
   - dist/ for compiled output (gitignored)
   - README.md with usage examples
   - package.json with correct 'exports' field

4. Code Style:
   - Use ES modules (not CommonJS)
   - Prefer async/await over promises.then()
   - Use descriptive variable names
   - Max function length: 50 lines
   - No console.log (use proper logger)

5. Error Handling:
   - All public functions validate inputs
   - Throw descriptive errors with Error classes
   - Never swallow errors silently
   - Include error context (what was being attempted)

6. Dependencies:
   - Only use dependencies from: ${APPROVED_DEPS.join(', ')}
   - Match versions from workspace root package.json
   - Avoid unnecessary dependencies
   - Document why each dependency is needed
`;

const FEW_SHOT_SCAFFOLDING_EXAMPLE = `
EXAMPLE OF CORRECT SCAFFOLDING OUTPUT:

{
  "files": [
    {
      "path": "package.json",
      "operation": "create",
      "content": "{\n  \"name\": \"@scope/logger\",\n  \"version\": \"1.0.0\",\n  \"type\": \"module\",\n  \"exports\": {\n    \".\": {\n      \"types\": \"./dist/index.d.ts\",\n      \"import\": \"./dist/index.js\"\n    }\n  },\n  \"scripts\": {\n    \"build\": \"tsc\",\n    \"test\": \"vitest run --coverage\"\n  }\n}"
    },
    {
      "path": "src/index.ts",
      "operation": "create",
      "content": "/**\n * Logger utility\n */\nexport interface LoggerOptions {\n  level: 'debug' | 'info' | 'warn' | 'error';\n}\n\nexport function createLogger(options: LoggerOptions) {\n  // Implementation\n}\n"
    },
    {
      "path": "tests/logger.test.ts",
      "operation": "create",
      "content": "import { describe, it, expect } from 'vitest';\nimport { createLogger } from '../src';\n\ndescribe('Logger', () => {\ n  it('should create logger with options', () => {\n    const logger = createLogger({ level: 'info' });\n    expect(logger).toBeDefined();\n  });\n});\n"
    }
  ],
  "summary": "Created logger package with strict TypeScript, Vitest tests, and ES module exports",
  "qualityChecklist": {
    "strictModeEnabled": true,
    "noAnyTypes": true,
    "testCoverageAbove80": true,
    "allPublicFunctionsDocumented": true,
    "errorHandlingComplete": true
  }
}

YOUR OUTPUT MUST FOLLOW THIS STRUCTURE.
`;

const PRE_VALIDATION_CHECKLIST = `
BEFORE RETURNING YOUR RESPONSE, VERIFY:

□ package.json includes ALL required fields:
  - "name", "version", "type": "module"
  - "exports" field with proper structure
  - "scripts" for build and test
  - Correct dependency versions matching workspace

□ tsconfig.json:
  - "strict": true
  - Extends workspace root config
  - Proper outDir and rootDir

□ All source files:
  - Use ES module imports (not require)
  - Have proper TypeScript types (no 'any')
  - Include JSDoc comments
  - Handle errors properly

□ Test files:
  - Use Vitest framework
  - Cover both success and error cases
  - Follow naming pattern: *.test.ts
  - Mock external dependencies

□ README.md includes:
  - Installation instructions
  - Usage examples with code
  - API documentation

IF ANY CHECKBOX IS UNCHECKED, FIX IT BEFORE RETURNING.
`;
```

**Logic:**
1. Load plan file from `planPath`
2. Build GitHub context (if token provided)
3. Read critical files (package.json, tsconfig.json, src/index.ts)
4. Include quality standards template
5. Include task-specific instructions
6. Include few-shot example for task type
7. Include pre-validation checklist
8. Include learned improvements from past failures

**Output:** `string` (enhanced prompt with all templates)

**Activity Timeout:** 3 minutes (GitHub API calls)

---

### 2. executeAgentWithClaude Activity (Unchanged)

**File:** `src/activities/agent-execution.activities.ts`

Same as v1.0 - calls Anthropic SDK and returns full response.

---

### 3. parseAgentResponse Activity (Enhanced for Extra Fields)

**File:** `src/activities/response-parser.activities.ts`

**Input:**
```typescript
interface ParseResponseInput {
  responseText: string;
  packagePath: string;
}
```

**Output (Enhanced):**
```typescript
interface ParsedAgentResponse {
  // Required fields
  files: FileOperation[];
  summary: string;

  // Optional quality checklist
  qualityChecklist?: {
    strictModeEnabled: boolean;
    noAnyTypes: boolean;
    testCoverageAbove80: boolean;
    allPublicFunctionsDocumented: boolean;
    errorHandlingComplete: boolean;
  };

  // NEW: Extra fields for meta-agent pattern
  questions?: Array<{
    question: string;
    context: string;
    suggestedAnswer?: string;
  }>;

  suggestions?: Array<{
    type: 'ADDITIONAL_DEPENDENCY' | 'ADDITIONAL_FILE' | 'FOLLOW_UP_TASK';
    description: string;
    priority: 'low' | 'medium' | 'high';
    autoExecute: boolean;
  }>;

  filesToFetch?: Array<{
    path: string;
    reason: string;
  }>;

  // Catch-all for any other fields
  [key: string]: unknown;
}
```

**Logic (Enhanced):**
1. Strip markdown code blocks
2. Parse JSON
3. Validate **required** fields only (files, summary)
4. Extract optional fields (questions, suggestions, etc.)
5. **DO NOT fail** if extra fields are present
6. Return full parsed structure with all fields

---

### 4. processExtraFields Activity (NEW)

**File:** `src/activities/meta-agent.activities.ts`

**Input:**
```typescript
interface ProcessExtraFieldsInput {
  parsedResponse: ParsedAgentResponse;
  taskContext: {
    packageName: string;
    planPath: string;
    parentPackage?: string;  // For asking coordinator
  };
}
```

**Logic:**

```typescript
export async function processExtraFields(
  input: ProcessExtraFieldsInput
): Promise<ExtraFieldsResult> {
  const result: ExtraFieldsResult = {
    answeredQuestions: [],
    approvedSuggestions: [],
    rejectedSuggestions: [],
    fetchedFiles: []
  };

  // 1. Process questions
  if (input.parsedResponse.questions) {
    for (const q of input.parsedResponse.questions) {
      // Check if coordinator can answer (from parent package context)
      const answer = await attemptToAnswerQuestion(q, input.taskContext);

      if (answer) {
        result.answeredQuestions.push({
          question: q.question,
          answer,
          source: 'coordinator-context'
        });
      } else {
        // Can't answer - log for manual review
        console.log(`[MetaAgent] Question needs manual review: ${q.question}`);
        result.answeredQuestions.push({
          question: q.question,
          answer: q.suggestedAnswer || 'Use default behavior',
          source: 'suggested-default'
        });
      }
    }
  }

  // 2. Process suggestions
  if (input.parsedResponse.suggestions) {
    for (const s of input.parsedResponse.suggestions) {
      // Evaluate suggestion safety and relevance
      const evaluation = evaluateSuggestion(s, input.taskContext);

      if (evaluation.approve && s.autoExecute) {
        result.approvedSuggestions.push(s);

        // Execute suggestion immediately
        switch (s.type) {
          case 'ADDITIONAL_DEPENDENCY':
            // Add to package.json modifications
            break;
          case 'ADDITIONAL_FILE':
            // Queue for creation after main files
            break;
          case 'FOLLOW_UP_TASK':
            // Return to coordinator for scheduling
            break;
        }
      } else {
        result.rejectedSuggestions.push({
          suggestion: s,
          reason: evaluation.reason
        });
      }
    }
  }

  // 3. Fetch additional files if requested
  if (input.parsedResponse.filesToFetch) {
    for (const fileRequest of input.parsedResponse.filesToFetch) {
      try {
        const content = await fetchFileFromGitHub(
          fileRequest.path,
          input.taskContext.githubContext
        );

        result.fetchedFiles.push({
          path: fileRequest.path,
          content,
          reason: fileRequest.reason
        });
      } catch (error) {
        console.warn(`[MetaAgent] Failed to fetch ${fileRequest.path}:`, error);
      }
    }
  }

  return result;
}

function evaluateSuggestion(
  suggestion: Suggestion,
  context: TaskContext
): EvaluationResult {
  // Safety checks
  if (suggestion.type === 'ADDITIONAL_DEPENDENCY') {
    // Check if dependency is in approved list
    if (!APPROVED_DEPENDENCIES.includes(extractPackageName(suggestion.description))) {
      return {
        approve: false,
        reason: 'Dependency not in approved list'
      };
    }
  }

  if (suggestion.type === 'FOLLOW_UP_TASK') {
    // Only approve if priority is high and description is specific
    if (suggestion.priority !== 'high') {
      return {
        approve: false,
        reason: 'Follow-up tasks must be high priority to auto-execute'
      };
    }
  }

  return { approve: true };
}
```

**Output:**
```typescript
interface ExtraFieldsResult {
  answeredQuestions: Array<{
    question: string;
    answer: string;
    source: 'coordinator-context' | 'suggested-default' | 'manual-review';
  }>;

  approvedSuggestions: Suggestion[];
  rejectedSuggestions: Array<{
    suggestion: Suggestion;
    reason: string;
  }>;

  fetchedFiles: Array<{
    path: string;
    content: string;
    reason: string;
  }>;
}
```

**Activity Timeout:** 5 minutes (may make multiple GitHub API calls)

---

### 5. applyFileChanges Activity (Enhanced with Normalization)

**File:** `src/activities/file-operations.activities.ts`

**Enhanced Logic:**
1. For each operation (same as v1.0)
2. **NEW:** Normalize content before writing:
   - Convert line endings to Unix (`\r\n` → `\n`)
   - Validate UTF-8 encoding
   - Normalize dependency versions to match workspace
3. Apply file changes atomically
4. Return modified files

**Normalization Function:**
```typescript
async function normalizePackageJson(
  content: string,
  workspaceRoot: string
): Promise<string> {
  const packageJson = JSON.parse(content);
  const rootPackageJson = await readJSON(`${workspaceRoot}/package.json`);

  // Normalize dependency versions to match workspace
  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (packageJson[depType] && rootPackageJson[depType]) {
      for (const [dep, version] of Object.entries(packageJson[depType])) {
        if (rootPackageJson[depType][dep]) {
          packageJson[depType][dep] = rootPackageJson[depType][dep];
          console.log(`[Normalize] ${dep}: ${version} → ${rootPackageJson[depType][dep]}`);
        }
      }
    }
  }

  return JSON.stringify(packageJson, null, 2);
}

async function normalizeContent(
  content: string,
  filePath: string,
  workspaceRoot: string
): Promise<string> {
  // Unix line endings
  let normalized = content.replace(/\r\n/g, '\n');

  // Validate UTF-8
  if (!isValidUTF8(normalized)) {
    throw new Error(`Invalid UTF-8 encoding in ${filePath}`);
  }

  // Special handling for package.json
  if (filePath.endsWith('package.json')) {
    normalized = await normalizePackageJson(normalized, workspaceRoot);
  }

  return normalized;
}
```

---

## Standalone Testing Harness

### Overview

Before integrating with Temporal, test each activity independently using CLI tools.

### Test Harness Structure

```
packages/agents/package-builder-production/
  test-harness/
    test-prompt-builder.ts          # Test prompt generation
    test-claude-execution.ts        # Test Claude API integration
    test-response-parser.ts         # Test JSON parsing
    test-file-operations.ts         # Test file I/O
    test-end-to-end.ts              # Full pipeline test
    fixtures/
      sample-plan.md
      sample-response.json
      expected-files/
```

### Test 1: Prompt Builder

**File:** `test-harness/test-prompt-builder.ts`

```typescript
#!/usr/bin/env tsx

import { buildAgentPrompt } from '../src/activities/prompt-builder.activities';
import * as fs from 'fs/promises';

async function main() {
  console.log('Testing Prompt Builder...\n');

  const result = await buildAgentPrompt({
    agentName: 'package-development-agent',
    taskType: 'PACKAGE_SCAFFOLDING',
    instructions: 'Create logger package from plan',
    packagePath: 'packages/utility/logger',
    planPath: 'test-harness/fixtures/sample-plan.md',
    workspaceRoot: process.cwd(),
    githubContext: {
      token: process.env.GITHUB_TOKEN!,
      repo: 'your-org/production-agent-coordinators',
      branch: 'main'
    },
    includeQualityStandards: true,
    includeFewShotExamples: true,
    includeValidationChecklist: true
  });

  console.log('Generated Prompt:');
  console.log('─'.repeat(80));
  console.log(result);
  console.log('─'.repeat(80));
  console.log(`\nPrompt Length: ${result.length} chars (~${Math.ceil(result.length / 4)} tokens)`);

  // Save for inspection
  await fs.writeFile('test-harness/output/prompt.txt', result, 'utf-8');
  console.log('\n✅ Prompt saved to test-harness/output/prompt.txt');
}

main().catch(console.error);
```

**Run:** `npx tsx test-harness/test-prompt-builder.ts`

---

### Test 2: Claude Execution

**File:** `test-harness/test-claude-execution.ts`

```typescript
#!/usr/bin/env tsx

import { executeAgentWithClaude } from '../src/activities/agent-execution.activities';
import { buildAgentPrompt } from '../src/activities/prompt-builder.activities';
import * as fs from 'fs/promises';

async function main() {
  console.log('Testing Claude Execution...\n');

  // Build prompt
  const prompt = await buildAgentPrompt({
    agentName: 'package-development-agent',
    taskType: 'PACKAGE_SCAFFOLDING',
    instructions: 'Create simple logger package',
    packagePath: 'packages/utility/logger',
    planPath: 'test-harness/fixtures/sample-plan.md',
    workspaceRoot: process.cwd(),
    githubContext: {
      token: process.env.GITHUB_TOKEN!,
      repo: 'your-org/production-agent-coordinators',
      branch: 'main'
    },
    includeQualityStandards: true,
    includeFewShotExamples: true
  });

  console.log('Calling Claude...');
  const start = Date.now();

  const response = await executeAgentWithClaude({
    prompt,
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
    temperature: 0.2,
    maxTokens: 8000
  });

  const duration = Date.now() - start;

  console.log(`\n✅ Claude responded in ${duration}ms`);
  console.log(`Response Length: ${response.length} chars\n`);

  console.log('Response Preview:');
  console.log('─'.repeat(80));
  console.log(response.substring(0, 500) + '...');
  console.log('─'.repeat(80));

  // Save full response
  await fs.writeFile('test-harness/output/claude-response.txt', response, 'utf-8');
  console.log('\n✅ Full response saved to test-harness/output/claude-response.txt');
}

main().catch(console.error);
```

**Run:** `npx tsx test-harness/test-claude-execution.ts`

---

### Test 3: Response Parser

**File:** `test-harness/test-response-parser.ts`

```typescript
#!/usr/bin/env tsx

import { parseAgentResponse } from '../src/activities/response-parser.activities';
import * as fs from 'fs/promises';

async function main() {
  console.log('Testing Response Parser...\n');

  // Load sample response (from previous test or fixture)
  const responseText = await fs.readFile('test-harness/output/claude-response.txt', 'utf-8');

  console.log('Parsing response...');
  const parsed = await parseAgentResponse({
    responseText,
    packagePath: 'packages/utility/logger'
  });

  console.log('\n✅ Parsed successfully!\n');

  console.log('Files to create/update:');
  parsed.files.forEach(f => {
    console.log(`  ${f.operation.toUpperCase()}: ${f.path} (${f.content?.length || 0} bytes)`);
  });

  console.log(`\nSummary: ${parsed.summary}`);

  if (parsed.qualityChecklist) {
    console.log('\nQuality Checklist:');
    Object.entries(parsed.qualityChecklist).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}`);
    });
  }

  if (parsed.questions) {
    console.log(`\nQuestions: ${parsed.questions.length}`);
    parsed.questions.forEach(q => {
      console.log(`  Q: ${q.question}`);
      console.log(`     Context: ${q.context}`);
      console.log(`     Suggested: ${q.suggestedAnswer || 'none'}`);
    });
  }

  if (parsed.suggestions) {
    console.log(`\nSuggestions: ${parsed.suggestions.length}`);
    parsed.suggestions.forEach(s => {
      console.log(`  [${s.priority}] ${s.type}: ${s.description}`);
      console.log(`     Auto-execute: ${s.autoExecute}`);
    });
  }

  // Save parsed structure
  await fs.writeFile(
    'test-harness/output/parsed-response.json',
    JSON.stringify(parsed, null, 2),
    'utf-8'
  );
  console.log('\n✅ Parsed structure saved to test-harness/output/parsed-response.json');
}

main().catch(console.error);
```

**Run:** `npx tsx test-harness/test-response-parser.ts`

---

### Test 4: File Operations

**File:** `test-harness/test-file-operations.ts`

```typescript
#!/usr/bin/env tsx

import { applyFileChanges } from '../src/activities/file-operations.activities';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('Testing File Operations...\n');

  // Load parsed response
  const parsed = JSON.parse(
    await fs.readFile('test-harness/output/parsed-response.json', 'utf-8')
  );

  // Create test workspace
  const testWorkspace = path.join(process.cwd(), 'test-harness/output/test-package');
  await fs.rm(testWorkspace, { recursive: true, force: true });
  await fs.mkdir(testWorkspace, { recursive: true });

  console.log(`Test workspace: ${testWorkspace}\n`);

  console.log('Applying file changes...');
  const result = await applyFileChanges({
    operations: parsed.files,
    packagePath: '.',  // Relative to test workspace
    workspaceRoot: testWorkspace
  });

  console.log(`\n✅ Applied ${result.modifiedFiles.length} file operations`);

  if (result.failedOperations.length > 0) {
    console.log(`\n❌ ${result.failedOperations.length} operations failed:`);
    result.failedOperations.forEach(f => {
      console.log(`  ${f.operation} ${f.path}: ${f.error}`);
    });
  }

  console.log('\nCreated files:');
  result.modifiedFiles.forEach(f => {
    console.log(`  ✓ ${f}`);
  });

  console.log(`\n📁 Test package created at: ${testWorkspace}`);
  console.log('   You can inspect the generated files manually.');

  // Verify package builds
  console.log('\nAttempting to build package...');
  try {
    const { execSync } = require('child_process');
    execSync('npx tsc --noEmit', {
      cwd: testWorkspace,
      stdio: 'inherit'
    });
    console.log('✅ TypeScript compilation succeeded!');
  } catch (error) {
    console.log('❌ TypeScript compilation failed (expected for incomplete package)');
  }
}

main().catch(console.error);
```

**Run:** `npx tsx test-harness/test-file-operations.ts`

---

### Test 5: End-to-End

**File:** `test-harness/test-end-to-end.ts`

```typescript
#!/usr/bin/env tsx

import { buildAgentPrompt } from '../src/activities/prompt-builder.activities';
import { executeAgentWithClaude } from '../src/activities/agent-execution.activities';
import { parseAgentResponse } from '../src/activities/response-parser.activities';
import { processExtraFields } from '../src/activities/meta-agent.activities';
import { applyFileChanges } from '../src/activities/file-operations.activities';
import * as fs from 'fs/promises';
import * as path from 'path';

async function main() {
  console.log('🧪 End-to-End Test: Package Scaffolding\n');

  const testWorkspace = path.join(process.cwd(), 'test-harness/output/e2e-test');
  await fs.rm(testWorkspace, { recursive: true, force: true });
  await fs.mkdir(testWorkspace, { recursive: true });

  // Step 1: Build Prompt
  console.log('[1/5] Building prompt...');
  const prompt = await buildAgentPrompt({
    agentName: 'package-development-agent',
    taskType: 'PACKAGE_SCAFFOLDING',
    instructions: 'Create logger package with file transports',
    packagePath: 'packages/utility/logger',
    planPath: 'test-harness/fixtures/logger-plan.md',
    workspaceRoot: testWorkspace,
    githubContext: {
      token: process.env.GITHUB_TOKEN!,
      repo: 'your-org/production-agent-coordinators',
      branch: 'main'
    },
    includeQualityStandards: true,
    includeFewShotExamples: true,
    includeValidationChecklist: true
  });
  console.log(`✓ Prompt built (${prompt.length} chars)\n`);

  // Step 2: Execute with Claude
  console.log('[2/5] Calling Claude...');
  const start = Date.now();
  const response = await executeAgentWithClaude({
    prompt,
    model: 'claude-sonnet-4-5-20250929',
    temperature: 0.2,
    maxTokens: 8000
  });
  console.log(`✓ Claude responded in ${Date.now() - start}ms\n`);

  // Step 3: Parse Response
  console.log('[3/5] Parsing response...');
  const parsed = await parseAgentResponse({
    responseText: response,
    packagePath: 'packages/utility/logger'
  });
  console.log(`✓ Parsed: ${parsed.files.length} files, ${parsed.questions?.length || 0} questions, ${parsed.suggestions?.length || 0} suggestions\n`);

  // Step 4: Process Extra Fields
  console.log('[4/5] Processing extra fields...');
  const extraFieldsResult = await processExtraFields({
    parsedResponse: parsed,
    taskContext: {
      packageName: '@test/logger',
      planPath: 'test-harness/fixtures/logger-plan.md'
    }
  });
  console.log(`✓ Answered ${extraFieldsResult.answeredQuestions.length} questions`);
  console.log(`✓ Approved ${extraFieldsResult.approvedSuggestions.length} suggestions`);
  console.log(`✓ Rejected ${extraFieldsResult.rejectedSuggestions.length} suggestions\n`);

  // Step 5: Apply File Changes
  console.log('[5/5] Applying file changes...');
  const result = await applyFileChanges({
    operations: parsed.files,
    packagePath: 'packages/utility/logger',
    workspaceRoot: testWorkspace
  });
  console.log(`✓ Created ${result.modifiedFiles.length} files\n`);

  // Summary
  console.log('─'.repeat(80));
  console.log('✅ End-to-End Test Complete!\n');
  console.log(`Total Time: ${Date.now() - start}ms`);
  console.log(`Files Created: ${result.modifiedFiles.length}`);
  console.log(`Questions Answered: ${extraFieldsResult.answeredQuestions.length}`);
  console.log(`Suggestions Processed: ${extraFieldsResult.approvedSuggestions.length + extraFieldsResult.rejectedSuggestions.length}`);
  console.log(`\n📁 Test package: ${path.join(testWorkspace, 'packages/utility/logger')}`);
  console.log('─'.repeat(80));

  // Verify
  console.log('\n🔍 Verification:\n');

  const packageJsonPath = path.join(testWorkspace, 'packages/utility/logger/package.json');
  if (await fileExists(packageJsonPath)) {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    console.log(`  ✓ package.json: ${packageJson.name}@${packageJson.version}`);
    console.log(`  ✓ Type: ${packageJson.type}`);
    console.log(`  ✓ Exports: ${Object.keys(packageJson.exports || {}).length} entry points`);
  }

  const tsconfigPath = path.join(testWorkspace, 'packages/utility/logger/tsconfig.json');
  if (await fileExists(tsconfigPath)) {
    const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf-8'));
    console.log(`  ✓ tsconfig.json: strict=${tsconfig.compilerOptions?.strict}`);
  }

  const srcPath = path.join(testWorkspace, 'packages/utility/logger/src');
  const srcFiles = await fs.readdir(srcPath).catch(() => []);
  console.log(`  ✓ src/ directory: ${srcFiles.length} files`);

  const testsPath = path.join(testWorkspace, 'packages/utility/logger/tests');
  const testFiles = await fs.readdir(testsPath).catch(() => []);
  console.log(`  ✓ tests/ directory: ${testFiles.length} files`);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

main().catch(console.error);
```

**Run:** `npx tsx test-harness/test-end-to-end.ts`

---

## Dynamic Activity Generation (Meta-Agent Pattern)

### Use Case: Claude Suggests Follow-Up Work

**Scenario:** Claude generates a package but realizes additional work is needed:

```json
{
  "files": [...],
  "summary": "Created logger package with console transport",
  "suggestions": [
    {
      "type": "FOLLOW_UP_TASK",
      "description": "Create file transport (depends on fs-extra package)",
      "priority": "high",
      "autoExecute": false,
      "reason": "Plan mentions file transport but it requires additional dependency that needs approval"
    },
    {
      "type": "ADDITIONAL_DEPENDENCY",
      "description": "Add fs-extra@^11.0.0 for file transport",
      "priority": "high",
      "autoExecute": true
    }
  ]
}
```

**Processing:**

1. **Coordinator receives** `AgentExecutionResult` with `suggestedFollowUpTasks`
2. **Coordinator evaluates** each suggestion:
   - Check if dependency is approved → Yes, add to package.json
   - Check if follow-up task is safe → No, requires manual approval
3. **Coordinator decides:**
   - Auto-approve dependency addition
   - Queue follow-up task for next iteration
4. **Coordinator logs decision** for observability

### Implementation in Coordinator

**File:** `src/workflows/coordinator.workflow.ts` (enhancement)

```typescript
async function handleAgentResult(
  result: AgentExecutionResult,
  problem: Problem
): Promise<CoordinatorAction> {
  // Process suggested follow-up tasks
  if (result.suggestedFollowUpTasks && result.suggestedFollowUpTasks.length > 0) {
    console.log(`[Coordinator] Agent suggested ${result.suggestedFollowUpTasks.length} follow-up tasks`);

    for (const task of result.suggestedFollowUpTasks) {
      const evaluation = evaluateFollowUpTask(task, problem);

      if (evaluation.approve) {
        console.log(`[Coordinator] Auto-approving: ${task.description}`);

        // Queue for immediate execution
        await executeChild(AgentExecutorWorkflow, {
          agent: selectAgentForTask(task.type),
          taskType: task.type,
          instructions: task.description,
          packagePath: problem.context.packagePath,
          planPath: problem.context.planPath,
          workspaceRoot: problem.context.workspaceRoot
        });
      } else {
        console.log(`[Coordinator] Rejecting: ${task.description} (${evaluation.reason})`);
      }
    }
  }

  // Return normal action
  if (result.success) {
    return { decision: 'RETRY', instructions: 'Previous fix applied, retry build' };
  } else {
    return { decision: 'FAIL', reason: result.output };
  }
}

function evaluateFollowUpTask(
  task: FollowUpTask,
  context: Problem
): { approve: boolean; reason?: string } {
  // Safety checks
  if (task.type === 'ADDITIONAL_DEPENDENCY') {
    const packageName = extractPackageName(task.description);
    if (!APPROVED_DEPENDENCIES.includes(packageName)) {
      return {
        approve: false,
        reason: `Dependency ${packageName} not in approved list`
      };
    }
  }

  // Auto-approve only high-priority tasks
  if (task.priority !== 'high') {
    return {
      approve: false,
      reason: 'Only high-priority tasks are auto-approved'
    };
  }

  // Require autoExecute flag
  if (!task.autoExecute) {
    return {
      approve: false,
      reason: 'Task requires manual approval (autoExecute=false)'
    };
  }

  return { approve: true };
}
```

---

## Enhanced Implementation Plan

### Phase 0: Testing Harness Setup (Day 1)
- [ ] Create `test-harness/` directory structure
- [ ] Create fixture files (sample plans, responses)
- [ ] Implement `test-prompt-builder.ts`
- [ ] Implement `test-claude-execution.ts`
- [ ] Implement `test-response-parser.ts`
- [ ] Implement `test-file-operations.ts`
- [ ] Implement `test-end-to-end.ts`
- [ ] Test all harness scripts independently
- [ ] Document testing workflow

### Phase 1: Prompt Builder with GitHub (Day 2)
- [ ] Implement `buildAgentPrompt()` with GitHub context
- [ ] Add quality standards template
- [ ] Add few-shot examples for each task type
- [ ] Add validation checklist
- [ ] Add learned improvements database
- [ ] Test with harness: `npx tsx test-harness/test-prompt-builder.ts`
- [ ] Verify prompt quality manually

### Phase 2: Enhanced Response Parser (Day 3)
- [ ] Implement lenient JSON parsing (allow extra fields)
- [ ] Extract optional fields (questions, suggestions, filesToFetch)
- [ ] Add security validation (path traversal)
- [ ] Test with harness: `npx tsx test-harness/test-response-parser.ts`
- [ ] Test with various response formats (valid, invalid, extra fields)

### Phase 3: Meta-Agent Activities (Day 4)
- [ ] Implement `processExtraFields()` activity
- [ ] Implement question answering logic
- [ ] Implement suggestion evaluation logic
- [ ] Implement GitHub file fetching
- [ ] Test with harness: `npx tsx test-harness/test-end-to-end.ts`
- [ ] Verify meta-agent decisions are safe

### Phase 4: File Operations with Normalization (Day 5)
- [ ] Implement enhanced `applyFileChanges()`
- [ ] Add content normalization (line endings, encoding)
- [ ] Add package.json dependency version normalization
- [ ] Add atomic file operations
- [ ] Test with harness: `npx tsx test-harness/test-file-operations.ts`
- [ ] Verify files are created correctly

### Phase 5: Temporal Integration (Day 6)
- [ ] Update `AgentExecutorWorkflow` to use new activities
- [ ] Add meta-agent step to workflow
- [ ] Update coordinator to handle suggested follow-up tasks
- [ ] Update activity exports
- [ ] Write Temporal integration tests
- [ ] Deploy to staging

### Phase 6: Production Validation (Day 7)
- [ ] Run E2E tests with real Temporal workflows
- [ ] Test scaffolding from scratch (logger package)
- [ ] Test build fixing with meta-agent suggestions
- [ ] Monitor for security violations
- [ ] Performance profiling
- [ ] Deploy to production

---

## Success Criteria (Enhanced)

### Definition of Done

- [ ] **Testing Harness:**
  - [ ] All 5 test scripts run successfully
  - [ ] Can test entire pipeline without Temporal
  - [ ] Generate human-readable reports

- [ ] **GitHub Integration:**
  - [ ] Can fetch files from private repository
  - [ ] Claude uses fetched context appropriately
  - [ ] GitHub API errors handled gracefully

- [ ] **Meta-Agent Pattern:**
  - [ ] Claude's questions are answered automatically when possible
  - [ ] Suggestions are evaluated safely (no unapproved deps)
  - [ ] Follow-up tasks are queued correctly
  - [ ] Rejected suggestions are logged with reasons

- [ ] **Quality:**
  - [ ] Generated code meets quality standards (>80% of time)
  - [ ] Generated code compiles on first try (>70% of time)
  - [ ] Tests pass on first try (>60% of time)
  - [ ] Rework loops reduced by 50% vs naive prompts

- [ ] **Security:**
  - [ ] Path traversal attacks blocked (100%)
  - [ ] Unapproved dependencies rejected (100%)
  - [ ] GitHub token never logged or exposed

---

## Appendix A: GitHub Integration Details

### GitHub API Usage

**Fetching File Contents:**
```typescript
async function fetchFileFromGitHub(
  filePath: string,
  githubContext: GitHubContext
): Promise<string> {
  const url = `https://api.github.com/repos/${githubContext.repo}/contents/${filePath}?ref=${githubContext.branch}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${githubContext.token}`,
      'Accept': 'application/vnd.github.v3.raw'  // Get raw content
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}
```

### Rate Limits

- **Authenticated:** 5,000 requests/hour
- **Our Usage:** ~10 requests per package build (plan + critical files)
- **Headroom:** 500 package builds per hour

### Security

- Token stored in `.env` file (never committed)
- Token passed only to trusted activities (never to Claude directly)
- All API calls logged for audit

---

## Appendix B: Common Gotchas and Mitigations

### Gotcha 1: Claude Returns Extra Fields

**Problem:** Claude returns helpful extra fields that break strict parsing

**Solution:** Lenient parsing - validate only required fields, preserve extras

**Benefit:** Claude can evolve its responses without breaking our code

### Gotcha 2: Dependency Version Conflicts

**Problem:** Claude specifies `@types/node@^18.0.0` but workspace uses `^20.0.0`

**Solution:** Post-generation normalization in `applyFileChanges`

### Gotcha 3: Incomplete Scaffolding

**Problem:** Claude creates package.json and src/ but forgets tests/

**Solution:** Pre-validation checklist in prompt + post-generation validation

### Gotcha 4: File Encoding Issues

**Problem:** Windows line endings or invalid UTF-8

**Solution:** Content normalization before writing

### Gotcha 5: Token Limit Exceeded

**Problem:** Large plan + large codebase > 200K tokens

**Solution:** Intelligent file selection + token estimation + truncation

---

## Appendix C: File Modifications Required

### New Files (v2.0)
1. `src/activities/prompt-builder.activities.ts` - Enhanced with GitHub
2. `src/activities/response-parser.activities.ts` - Lenient parsing
3. `src/activities/file-operations.activities.ts` - With normalization
4. `src/activities/meta-agent.activities.ts` - NEW: Process extra fields
5. `src/templates/quality-standards.ts` - NEW: Reusable prompt templates
6. `src/templates/few-shot-examples.ts` - NEW: Example responses
7. `test-harness/test-prompt-builder.ts` - NEW: Testing harness
8. `test-harness/test-claude-execution.ts` - NEW
9. `test-harness/test-response-parser.ts` - NEW
10. `test-harness/test-file-operations.ts` - NEW
11. `test-harness/test-end-to-end.ts` - NEW
12. `test-harness/fixtures/sample-plan.md` - NEW
13. `tests/activities/*.test.ts` - Unit tests

### Modified Files
1. `src/workflows/agent-executor.workflow.ts` - Add meta-agent step
2. `src/workflows/coordinator.workflow.ts` - Handle follow-up tasks
3. `src/activities/index.ts` - Export new activities
4. `src/types/index.ts` - Add new types

### Total Scope (v2.0)
- **New files:** 20+ (activities + templates + test harness + tests)
- **Modified files:** 4
- **Lines of code:** ~1,500 LOC implementation, ~1,000 LOC tests, ~500 LOC test harness
- **Complexity:** Medium-High
- **Risk:** Low (incremental enhancement, extensive testing)

---

## Summary of Enhancements

| Feature | v1.0 | v2.0 |
|---------|------|------|
| GitHub Integration | Phase 2 (future) | ✅ Phase 1 (included) |
| Testing Harness | None | ✅ 5 standalone CLI tools |
| Extra Fields Support | Strict parsing (fails) | ✅ Lenient parsing (preserves) |
| Meta-Agent Pattern | No | ✅ Questions, suggestions, follow-ups |
| Quality Standards | No | ✅ Included in every prompt |
| Few-Shot Examples | No | ✅ Task-specific examples |
| Content Normalization | No | ✅ Line endings, encoding, deps |
| Learned Improvements | No | ✅ Feedback loop database |
| Development Speed | Slow (deploy to Temporal each test) | ✅ Fast (test locally first) |

**Ready for implementation with GitHub integration, comprehensive testing, and self-improvement capabilities!**
