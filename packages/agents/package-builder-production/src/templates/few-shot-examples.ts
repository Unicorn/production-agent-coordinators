/**
 * Few-Shot Examples Template
 *
 * Provides task-specific examples to guide Claude's code generation.
 * Examples are selected based on the task type to improve output quality.
 */

import type { TaskType } from '../types/index.js';

/**
 * Example for package scaffolding tasks
 */
const PACKAGE_SCAFFOLDING_EXAMPLE = `
## Example: Package Scaffolding

**Task:** Create a simple utility package for array operations

**Input Plan:**
\`\`\`markdown
# @test/array-utils

**Package:** \`@test/array-utils\`
**Type:** utility

## Overview
Utility functions for common array operations (chunk, unique, flatten).

## Requirements
- TypeScript strict mode
- ES modules
- Vitest tests with 80%+ coverage

## API Design
\`\`\`typescript
export function chunk<T>(array: T[], size: number): T[][];
export function unique<T>(array: T[]): T[];
export function flatten<T>(array: T[][]): T[];
\`\`\`
\`\`\`

**Expected Output:**
\`\`\`json
{
  "files": [
    {
      "path": "package.json",
      "operation": "create",
      "content": "{\\n  \\"name\\": \\"@test/array-utils\\",\\n  \\"version\\": \\"1.0.0\\",\\n  \\"type\\": \\"module\\",\\n  \\"exports\\": {\\n    \\".\\": {\\n      \\"types\\": \\"./dist/index.d.ts\\",\\n      \\"default\\": \\"./dist/index.js\\"\\n    }\\n  },\\n  \\"scripts\\": {\\n    \\"build\\": \\"tsc\\",\\n    \\"test\\": \\"vitest run\\",\\n    \\"test:watch\\": \\"vitest\\"\\n  }\\n}"
    },
    {
      "path": "tsconfig.json",
      "operation": "create",
      "content": "{\\n  \\"extends\\": \\"../../../tsconfig.base.json\\",\\n  \\"compilerOptions\\": {\\n    \\"outDir\\": \\"./dist\\",\\n    \\"rootDir\\": \\"./src\\",\\n    \\"strict\\": true\\n  },\\n  \\"include\\": [\\"src/**/*\\"]\\n}"
    },
    {
      "path": "src/index.ts",
      "operation": "create",
      "content": "export { chunk } from './chunk.js';\\nexport { unique } from './unique.js';\\nexport { flatten } from './flatten.js';"
    },
    {
      "path": "src/chunk.ts",
      "operation": "create",
      "content": "/**\\n * Split array into chunks of specified size\\n * @param array - Array to chunk\\n * @param size - Size of each chunk\\n * @returns Array of chunks\\n */\\nexport function chunk<T>(array: T[], size: number): T[][] {\\n  if (size <= 0) throw new Error('Chunk size must be positive');\\n  const result: T[][] = [];\\n  for (let i = 0; i < array.length; i += size) {\\n    result.push(array.slice(i, i + size));\\n  }\\n  return result;\\n}"
    },
    {
      "path": "tests/chunk.test.ts",
      "operation": "create",
      "content": "import { describe, it, expect } from 'vitest';\\nimport { chunk } from '../src/chunk.js';\\n\\ndescribe('chunk', () => {\\n  it('splits array into chunks of specified size', () => {\\n    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);\\n  });\\n\\n  it('throws error for invalid chunk size', () => {\\n    expect(() => chunk([1, 2, 3], 0)).toThrow('Chunk size must be positive');\\n  });\\n});"
    }
  ],
  "summary": "Created array-utils package with chunk, unique, and flatten functions. All functions are fully typed, tested with Vitest, and follow strict TypeScript configuration.",
  "qualityChecklist": {
    "strictModeEnabled": true,
    "noAnyTypes": true,
    "testCoverageAbove80": true,
    "allPublicFunctionsDocumented": true,
    "errorHandlingComplete": true
  }
}
\`\`\`
`;

/**
 * Example for feature implementation tasks
 */
const FEATURE_IMPLEMENTATION_EXAMPLE = `
## Example: Feature Implementation

**Task:** Add caching support to existing HTTP client package

**Context:** Package @test/http-client exists with basic fetch functionality

**Expected Output:**
\`\`\`json
{
  "files": [
    {
      "path": "src/cache.ts",
      "operation": "create",
      "content": "import type { CacheOptions } from './types.js';\\n\\n/**\\n * Simple in-memory cache for HTTP responses\\n */\\nexport class ResponseCache {\\n  private cache = new Map<string, { data: unknown; expires: number }>();\\n\\n  get(key: string): unknown | null {\\n    const entry = this.cache.get(key);\\n    if (!entry) return null;\\n    if (Date.now() > entry.expires) {\\n      this.cache.delete(key);\\n      return null;\\n    }\\n    return entry.data;\\n  }\\n\\n  set(key: string, data: unknown, ttl: number): void {\\n    this.cache.set(key, { data, expires: Date.now() + ttl });\\n  }\\n}"
    },
    {
      "path": "src/client.ts",
      "operation": "update",
      "content": "import { ResponseCache } from './cache.js';\\n\\nexport class HttpClient {\\n  private cache = new ResponseCache();\\n\\n  async get(url: string, options?: RequestOptions): Promise<Response> {\\n    // Check cache first\\n    if (options?.cache) {\\n      const cached = this.cache.get(url);\\n      if (cached) return cached as Response;\\n    }\\n\\n    const response = await fetch(url, options);\\n    \\n    if (options?.cache) {\\n      this.cache.set(url, response, options.cacheTtl || 60000);\\n    }\\n\\n    return response;\\n  }\\n}"
    }
  ],
  "summary": "Added response caching to HttpClient with configurable TTL",
  "questions": [
    {
      "question": "Should we support cache invalidation patterns?",
      "context": "Currently cache only expires based on TTL",
      "suggestedAnswer": "Add manual cache.clear() method in follow-up"
    }
  ]
}
\`\`\`
`;

/**
 * Example for bug fix tasks
 */
const BUG_FIX_EXAMPLE = `
## Example: Bug Fix

**Task:** Fix race condition in async queue processing

**Context:** Queue sometimes processes items out of order

**Expected Output:**
\`\`\`json
{
  "files": [
    {
      "path": "src/queue.ts",
      "operation": "update",
      "content": "export class AsyncQueue<T> {\\n  private processing = false;\\n  private queue: T[] = [];\\n\\n  async add(item: T): Promise<void> {\\n    this.queue.push(item);\\n    if (!this.processing) {\\n      await this.processQueue();\\n    }\\n  }\\n\\n  private async processQueue(): Promise<void> {\\n    this.processing = true;\\n    while (this.queue.length > 0) {\\n      const item = this.queue.shift();\\n      if (item) {\\n        await this.handler(item);\\n      }\\n    }\\n    this.processing = false;\\n  }\\n}"
    },
    {
      "path": "tests/queue.test.ts",
      "operation": "update",
      "content": "it('processes items in order', async () => {\\n  const results: number[] = [];\\n  const queue = new AsyncQueue((n: number) => {\\n    results.push(n);\\n  });\\n\\n  await Promise.all([\\n    queue.add(1),\\n    queue.add(2),\\n    queue.add(3)\\n  ]);\\n\\n  expect(results).toEqual([1, 2, 3]);\\n});"
    }
  ],
  "summary": "Fixed race condition by ensuring sequential processing with processing flag",
  "qualityChecklist": {
    "strictModeEnabled": true,
    "noAnyTypes": true,
    "testCoverageAbove80": true,
    "allPublicFunctionsDocumented": true,
    "errorHandlingComplete": true
  }
}
\`\`\`
`;

/**
 * Example map by task type
 */
const EXAMPLES_BY_TASK_TYPE: Record<TaskType, string> = {
  PACKAGE_SCAFFOLDING: PACKAGE_SCAFFOLDING_EXAMPLE,
  FEATURE_IMPLEMENTATION: FEATURE_IMPLEMENTATION_EXAMPLE,
  BUG_FIX: BUG_FIX_EXAMPLE,
  REFACTORING: FEATURE_IMPLEMENTATION_EXAMPLE, // Reuse similar pattern
  DOCUMENTATION: PACKAGE_SCAFFOLDING_EXAMPLE, // Reuse scaffolding pattern
  TESTING: BUG_FIX_EXAMPLE // Reuse test-focused example
};

/**
 * Get few-shot example for a specific task type
 */
export function getFewShotExample(taskType: TaskType): string {
  return EXAMPLES_BY_TASK_TYPE[taskType] || PACKAGE_SCAFFOLDING_EXAMPLE;
}

/**
 * Get all few-shot examples (for comprehensive prompts)
 */
export function getAllExamples(): string {
  return `
# Few-Shot Examples

These examples demonstrate the expected output format and quality standards.

${PACKAGE_SCAFFOLDING_EXAMPLE}

${FEATURE_IMPLEMENTATION_EXAMPLE}

${BUG_FIX_EXAMPLE}

## Key Patterns to Follow:

1. **Complete File Content**: Always provide full file content, not diffs or partial code
2. **JSON Format**: Response must be valid JSON with files array and summary
3. **Quality Checklist**: Include the qualityChecklist object to verify standards
4. **JSDoc Comments**: All functions documented with JSDoc
5. **Tests Required**: Every new function must have corresponding tests
6. **Error Handling**: All error cases handled with clear messages
7. **Type Safety**: No \`any\` types, all parameters and returns typed
8. **ES Modules**: All imports use \`.js\` extension
`;
}
