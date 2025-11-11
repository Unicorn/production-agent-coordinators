# Autonomous Package Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the suite builder workflow from requiring manual setup (master-plan JSON files, pre-discovered dependencies) to accepting minimal input (package name/idea/path/prompt) and autonomously discovering everything, validating MECE compliance, handling quality remediation, and publishing packages.

**Architecture:** Add three new workflow phases (DISCOVERY, PLANNING, MECE VALIDATION) before the existing BUILD phase. Break down ./manager CLI quality checks into individual activities. Add RemediationWorkflow for autonomous quality fixes. Main workflow coordinates, child workflows handle individual packages, remediation workflows fix quality issues.

**Tech Stack:** TypeScript, Temporal SDK (@temporalio/workflow, @temporalio/activity), Vitest

---

## Task 1: Update Types for New Workflow Input

**Files:**
- Modify: `packages/agents/suite-builder-production/src/types/index.ts`
- Test: `packages/agents/suite-builder-production/src/types/__tests__/types.test.ts` (create)

**Step 1: Write failing test for new input types**

Create test file:

```typescript
import { describe, it, expect } from 'vitest';
import type { PackageWorkflowInput, DiscoveryResult, PlanningResult, MeceValidationResult } from '../index';

describe('Type Definitions', () => {
  describe('PackageWorkflowInput', () => {
    it('should accept package name', () => {
      const input: PackageWorkflowInput = {
        packageName: '@bernierllc/openai-client',
        config: {
          workspaceRoot: '/path/to/workspace',
          npmRegistry: 'https://registry.npmjs.org/',
          maxConcurrentBuilds: 4,
          temporal: {
            address: 'localhost:7233',
            namespace: 'default',
            taskQueue: 'queue'
          }
        }
      };
      expect(input.packageName).toBe('@bernierllc/openai-client');
    });

    it('should accept package idea', () => {
      const input: PackageWorkflowInput = {
        packageIdea: 'create streaming OpenAI client',
        config: {} as any
      };
      expect(input.packageIdea).toBeDefined();
    });

    it('should accept plan file path', () => {
      const input: PackageWorkflowInput = {
        planFilePath: 'plans/packages/core/openai-client.md',
        config: {} as any
      };
      expect(input.planFilePath).toBeDefined();
    });

    it('should accept update prompt', () => {
      const input: PackageWorkflowInput = {
        updatePrompt: 'add streaming support',
        config: {} as any
      };
      expect(input.updatePrompt).toBeDefined();
    });
  });

  describe('DiscoveryResult', () => {
    it('should have required fields', () => {
      const result: DiscoveryResult = {
        packageName: '@bernierllc/openai-client',
        packagePath: 'packages/core/openai-client',
        version: '1.0.3',
        dependencies: ['@bernierllc/logger'],
        isPublished: true,
        npmVersion: '1.0.3',
        worktreePath: '/path/to/worktree'
      };
      expect(result.packageName).toBeDefined();
      expect(result.worktreePath).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/agents/suite-builder-production/src/types/__tests__/types.test.ts`
Expected: FAIL with "Cannot find module '../index'" or type errors

**Step 3: Add new types to index.ts**

Add to `packages/agents/suite-builder-production/src/types/index.ts`:

```typescript
// New workflow input type
export interface PackageWorkflowInput {
  // User provides ONE of these:
  packageName?: string;
  packageIdea?: string;
  planFilePath?: string;
  updatePrompt?: string;

  // Configuration (reuse existing BuildConfig)
  config: BuildConfig;
}

// Discovery phase result
export interface DiscoveryResult {
  packageName: string;
  packagePath: string;
  version: string;
  dependencies: string[];
  isPublished: boolean;
  npmVersion: string | null;
  worktreePath: string;
}

// Planning phase result
export interface PlanningResult {
  packageName: string;
  planPath: string;
  planContent: string;
  registeredWithMcp: boolean;
}

// MECE validation result
export interface MeceViolation {
  violation: string;
  solution: string;
  affectedFunctionality: string[];
  mainPackageStillUsesIt: boolean;
  newPackages: string[];
}

export interface MeceValidationResult {
  isCompliant: boolean;
  violation?: MeceViolation;
  additionalPackages: PackageNode[];
}

// Quality check types
export interface QualityCheckResult {
  passed: boolean;
  details: any;
}

export interface StructureResult extends QualityCheckResult {
  missingFiles: string[];
  invalidFields: string[];
}

export interface TypeScriptResult extends QualityCheckResult {
  errors: Array<{
    file: string;
    line: number;
    message: string;
  }>;
}

export interface LintResult extends QualityCheckResult {
  errors: Array<{
    file: string;
    line: number;
    rule: string;
    message: string;
  }>;
  warnings: Array<{
    file: string;
    line: number;
    rule: string;
    message: string;
  }>;
}

export interface TestResult extends QualityCheckResult {
  coverage: {
    branches: number;
    functions: number;
    lines: number;
    statements: number;
    total: number;
  };
  requiredCoverage: number;
  failures: Array<{
    test: string;
    message: string;
  }>;
}

export interface SecurityResult extends QualityCheckResult {
  vulnerabilities: Array<{
    severity: 'low' | 'moderate' | 'high' | 'critical';
    package: string;
    description: string;
  }>;
}

export interface DocumentationResult extends QualityCheckResult {
  missing: string[];
}

export interface LicenseResult extends QualityCheckResult {
  filesWithoutLicense: string[];
}

export interface IntegrationResult extends QualityCheckResult {
  issues: string[];
}

export interface ComplianceScore {
  score: number;
  level: 'excellent' | 'good' | 'acceptable' | 'blocked';
}

// Remediation types
export interface RemediationTask {
  category: 'structure' | 'typescript' | 'lint' | 'tests' | 'security' | 'documentation' | 'license' | 'integration';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  details: string[];
  suggestedFix?: string;
}

export interface RemediationInput {
  packagePath: string;
  packageName: string;
  currentScore: number;
  targetScore: number;
  tasks: RemediationTask[];
}

export interface RemediationResult {
  completed: boolean;
  tasksAttempted: number;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test packages/agents/suite-builder-production/src/types/__tests__/types.test.ts`
Expected: PASS (all tests passing)

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/types/
git commit -m "feat: add types for autonomous workflow (discovery, planning, MECE, quality, remediation)"
```

---

## Task 2: Implement parseInput Discovery Activity

**Files:**
- Create: `packages/agents/suite-builder-production/src/activities/discovery.activities.ts`
- Test: `packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { parseInput } from '../discovery.activities';

describe('Discovery Activities', () => {
  describe('parseInput', () => {
    it('should identify package name input', () => {
      const result = parseInput({
        packageName: '@bernierllc/openai-client',
        config: {} as any
      });
      expect(result.type).toBe('packageName');
      expect(result.value).toBe('@bernierllc/openai-client');
    });

    it('should identify package idea input', () => {
      const result = parseInput({
        packageIdea: 'create streaming client',
        config: {} as any
      });
      expect(result.type).toBe('packageIdea');
      expect(result.value).toBe('create streaming client');
    });

    it('should identify plan file path input', () => {
      const result = parseInput({
        planFilePath: 'plans/packages/core/test.md',
        config: {} as any
      });
      expect(result.type).toBe('planFilePath');
      expect(result.value).toBe('plans/packages/core/test.md');
    });

    it('should identify update prompt input', () => {
      const result = parseInput({
        updatePrompt: 'add streaming support',
        config: {} as any
      });
      expect(result.type).toBe('updatePrompt');
      expect(result.value).toBe('add streaming support');
    });

    it('should throw error if no input provided', () => {
      expect(() => parseInput({ config: {} as any })).toThrow('No input provided');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement parseInput activity**

Create `packages/agents/suite-builder-production/src/activities/discovery.activities.ts`:

```typescript
import type { PackageWorkflowInput } from '../types';

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
```

**Step 4: Run test to verify it passes**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/discovery.activities.ts packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts
git commit -m "feat: add parseInput discovery activity"
```

---

## Task 3: Implement searchForPackage Discovery Activity

**Files:**
- Modify: `packages/agents/suite-builder-production/src/activities/discovery.activities.ts`
- Modify: `packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts`

**Step 1: Write failing test**

Add to test file:

```typescript
import { searchForPackage } from '../discovery.activities';
import * as fs from 'fs';
import * as path from 'path';

describe('searchForPackage', () => {
  it('should find package by plan file', async () => {
    const result = await searchForPackage({
      searchQuery: 'openai-client',
      workspaceRoot: '/test/workspace'
    });

    expect(result.found).toBe(true);
    expect(result.packagePath).toBeDefined();
  });

  it('should return not found if package does not exist', async () => {
    const result = await searchForPackage({
      searchQuery: 'non-existent-package',
      workspaceRoot: '/test/workspace'
    });

    expect(result.found).toBe(false);
    expect(result.searchedLocations).toContain('plans/packages/**');
    expect(result.searchedLocations).toContain('packages/**');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts -t searchForPackage`
Expected: FAIL with "Cannot find name 'searchForPackage'"

**Step 3: Implement searchForPackage activity**

Add to `discovery.activities.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface SearchResult {
  found: boolean;
  packagePath?: string;
  packageName?: string;
  searchedLocations: string[];
}

export async function searchForPackage(input: {
  searchQuery: string;
  workspaceRoot: string;
}): Promise<SearchResult> {
  const searchedLocations: string[] = [];

  // 1. Search in plans directory
  searchedLocations.push('plans/packages/**');
  const planFiles = await glob('plans/packages/**/*.md', {
    cwd: input.workspaceRoot,
    absolute: true
  });

  for (const planFile of planFiles) {
    const content = fs.readFileSync(planFile, 'utf-8');
    if (content.includes(input.searchQuery)) {
      // Extract package path from plan file
      const packagePathMatch = content.match(/Package Path:\s*`([^`]+)`/);
      if (packagePathMatch) {
        return {
          found: true,
          packagePath: packagePathMatch[1],
          packageName: input.searchQuery,
          searchedLocations
        };
      }
    }
  }

  // 2. Search in packages directory
  searchedLocations.push('packages/**');
  const packageJsonFiles = await glob('packages/**/package.json', {
    cwd: input.workspaceRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  for (const packageJsonFile of packageJsonFiles) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));
    const packageName = packageJson.name;

    if (packageName === input.searchQuery ||
        packageName.includes(input.searchQuery) ||
        path.dirname(packageJsonFile).includes(input.searchQuery)) {
      return {
        found: true,
        packagePath: path.relative(input.workspaceRoot, path.dirname(packageJsonFile)),
        packageName: packageJson.name,
        searchedLocations
      };
    }
  }

  // 3. TODO: Query packages-api MCP (stub for now)
  searchedLocations.push('packages-api MCP');

  return {
    found: false,
    searchedLocations
  };
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts -t searchForPackage`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/discovery.activities.ts packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts
git commit -m "feat: add searchForPackage discovery activity"
```

---

## Task 4: Implement readPackageJson Discovery Activity

**Files:**
- Modify: `packages/agents/suite-builder-production/src/activities/discovery.activities.ts`
- Modify: `packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts`

**Step 1: Write failing test**

Add to test file:

```typescript
import { readPackageJson } from '../discovery.activities';

describe('readPackageJson', () => {
  it('should read package.json and extract metadata', async () => {
    // Create temp package.json for testing
    const tempDir = '/tmp/test-package';
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: '@bernierllc/test-package',
        version: '1.0.0',
        dependencies: {
          '@bernierllc/logger': '^1.0.0'
        }
      })
    );

    const result = await readPackageJson({
      packagePath: tempDir
    });

    expect(result.name).toBe('@bernierllc/test-package');
    expect(result.version).toBe('1.0.0');
    expect(result.dependencies).toContain('@bernierllc/logger');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true });
  });

  it('should filter out non-workspace dependencies', async () => {
    const tempDir = '/tmp/test-package-2';
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({
        name: '@bernierllc/test-package',
        version: '1.0.0',
        dependencies: {
          '@bernierllc/logger': '^1.0.0',
          'axios': '^1.0.0'
        }
      })
    );

    const result = await readPackageJson({
      packagePath: tempDir
    });

    expect(result.dependencies).toContain('@bernierllc/logger');
    expect(result.dependencies).not.toContain('axios');

    fs.rmSync(tempDir, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts -t readPackageJson`
Expected: FAIL

**Step 3: Implement readPackageJson activity**

Add to `discovery.activities.ts`:

```typescript
export interface PackageMetadata {
  name: string;
  version: string;
  dependencies: string[];
  scripts: Record<string, string>;
}

export async function readPackageJson(input: {
  packagePath: string;
}): Promise<PackageMetadata> {
  const packageJsonPath = path.join(input.packagePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at ${packageJsonPath}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Extract workspace dependencies (those starting with @bernierllc/)
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  const workspaceDeps = Object.keys(allDeps)
    .filter(dep => dep.startsWith('@bernierllc/'));

  return {
    name: packageJson.name,
    version: packageJson.version,
    dependencies: workspaceDeps,
    scripts: packageJson.scripts || {}
  };
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts -t readPackageJson`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/discovery.activities.ts packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts
git commit -m "feat: add readPackageJson discovery activity"
```

---

## Task 5: Implement buildDependencyTree Discovery Activity

**Files:**
- Modify: `packages/agents/suite-builder-production/src/activities/discovery.activities.ts`
- Modify: `packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts`

**Step 1: Write failing test**

Add to test file:

```typescript
import { buildDependencyTree } from '../discovery.activities';

describe('buildDependencyTree', () => {
  it('should build complete dependency tree', async () => {
    // Setup test packages
    const workspace = '/tmp/test-workspace';
    fs.mkdirSync(path.join(workspace, 'packages/core/logger'), { recursive: true });
    fs.mkdirSync(path.join(workspace, 'packages/core/openai-client'), { recursive: true });

    fs.writeFileSync(
      path.join(workspace, 'packages/core/logger/package.json'),
      JSON.stringify({ name: '@bernierllc/logger', version: '1.0.0', dependencies: {} })
    );

    fs.writeFileSync(
      path.join(workspace, 'packages/core/openai-client/package.json'),
      JSON.stringify({
        name: '@bernierllc/openai-client',
        version: '1.0.0',
        dependencies: { '@bernierllc/logger': '^1.0.0' }
      })
    );

    const result = await buildDependencyTree({
      packageName: '@bernierllc/openai-client',
      workspaceRoot: workspace
    });

    expect(result.packages).toHaveLength(2);
    expect(result.packages.map(p => p.name)).toContain('@bernierllc/logger');
    expect(result.packages.map(p => p.name)).toContain('@bernierllc/openai-client');

    const clientPkg = result.packages.find(p => p.name === '@bernierllc/openai-client');
    expect(clientPkg?.dependencies).toContain('@bernierllc/logger');

    fs.rmSync(workspace, { recursive: true });
  });

  it('should handle packages with no dependencies', async () => {
    const workspace = '/tmp/test-workspace-2';
    fs.mkdirSync(path.join(workspace, 'packages/core/logger'), { recursive: true });

    fs.writeFileSync(
      path.join(workspace, 'packages/core/logger/package.json'),
      JSON.stringify({ name: '@bernierllc/logger', version: '1.0.0', dependencies: {} })
    );

    const result = await buildDependencyTree({
      packageName: '@bernierllc/logger',
      workspaceRoot: workspace
    });

    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].dependencies).toHaveLength(0);

    fs.rmSync(workspace, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts -t buildDependencyTree`
Expected: FAIL

**Step 3: Implement buildDependencyTree activity**

Add to `discovery.activities.ts`:

```typescript
import type { PackageNode } from '../types';

export interface DependencyTree {
  packages: PackageNode[];
}

export async function buildDependencyTree(input: {
  packageName: string;
  workspaceRoot: string;
}): Promise<DependencyTree> {
  const visited = new Set<string>();
  const packages: PackageNode[] = [];

  async function discoverPackage(packageName: string) {
    if (visited.has(packageName)) {
      return;
    }
    visited.add(packageName);

    // Find package in workspace
    const searchResult = await searchForPackage({
      searchQuery: packageName,
      workspaceRoot: input.workspaceRoot
    });

    if (!searchResult.found || !searchResult.packagePath) {
      throw new Error(`Package ${packageName} not found in workspace`);
    }

    // Read package.json
    const metadata = await readPackageJson({
      packagePath: path.join(input.workspaceRoot, searchResult.packagePath)
    });

    // Create package node
    const packageNode: PackageNode = {
      name: metadata.name,
      path: searchResult.packagePath,
      version: metadata.version,
      dependencies: metadata.dependencies,
      buildCommand: metadata.scripts.build || 'yarn build',
      testCommand: metadata.scripts['test:run'] || metadata.scripts.test || 'yarn test',
      buildStatus: 'pending',
      testStatus: 'pending'
    };

    packages.push(packageNode);

    // Recursively discover dependencies
    for (const dep of metadata.dependencies) {
      await discoverPackage(dep);
    }
  }

  await discoverPackage(input.packageName);

  return { packages };
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts -t buildDependencyTree`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/discovery.activities.ts packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts
git commit -m "feat: add buildDependencyTree discovery activity with recursive traversal"
```

---

## Task 6: Implement copyEnvFiles Discovery Activity

**Files:**
- Modify: `packages/agents/suite-builder-production/src/activities/discovery.activities.ts`
- Modify: `packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts`

**Step 1: Write failing test**

Add to test file:

```typescript
import { copyEnvFiles } from '../discovery.activities';

describe('copyEnvFiles', () => {
  it('should copy .env and mgr/.env to worktree', async () => {
    const sourceRoot = '/tmp/source-workspace';
    const worktreePath = '/tmp/worktree-workspace';

    // Setup source .env files
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.mkdirSync(path.join(sourceRoot, 'mgr'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, '.env'), 'NPM_TOKEN=test123');
    fs.writeFileSync(path.join(sourceRoot, 'mgr', '.env'), 'MGR_TOKEN=mgr456');

    // Create worktree directory
    fs.mkdirSync(worktreePath, { recursive: true });

    await copyEnvFiles({
      sourceRoot,
      worktreePath
    });

    // Verify files copied
    expect(fs.existsSync(path.join(worktreePath, '.env'))).toBe(true);
    expect(fs.existsSync(path.join(worktreePath, 'mgr', '.env'))).toBe(true);

    const rootEnv = fs.readFileSync(path.join(worktreePath, '.env'), 'utf-8');
    expect(rootEnv).toBe('NPM_TOKEN=test123');

    // Cleanup
    fs.rmSync(sourceRoot, { recursive: true });
    fs.rmSync(worktreePath, { recursive: true });
  });

  it('should handle missing .env files gracefully', async () => {
    const sourceRoot = '/tmp/source-no-env';
    const worktreePath = '/tmp/worktree-no-env';

    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.mkdirSync(worktreePath, { recursive: true });

    await expect(
      copyEnvFiles({ sourceRoot, worktreePath })
    ).resolves.not.toThrow();

    fs.rmSync(sourceRoot, { recursive: true });
    fs.rmSync(worktreePath, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts -t copyEnvFiles`
Expected: FAIL

**Step 3: Implement copyEnvFiles activity**

Add to `discovery.activities.ts`:

```typescript
export async function copyEnvFiles(input: {
  sourceRoot: string;
  worktreePath: string;
}): Promise<void> {
  const files = [
    path.join(input.sourceRoot, '.env'),
    path.join(input.sourceRoot, 'mgr', '.env')
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      const relativePath = path.relative(input.sourceRoot, file);
      const target = path.join(input.worktreePath, relativePath);

      // Create target directory if needed
      await fs.promises.mkdir(path.dirname(target), { recursive: true });

      // Copy file
      await fs.promises.copyFile(file, target);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts -t copyEnvFiles`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/discovery.activities.ts packages/agents/suite-builder-production/src/activities/__tests__/discovery.activities.test.ts
git commit -m "feat: add copyEnvFiles discovery activity for worktree .env setup"
```

---

## Task 7: Implement Quality Check Activities (Structure)

**Files:**
- Create: `packages/agents/suite-builder-production/src/activities/quality.activities.ts`
- Create: `packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts`

**Step 1: Write failing test**

Create test file:

```typescript
import { describe, it, expect } from 'vitest';
import { validatePackageStructure } from '../quality.activities';
import * as fs from 'fs';
import * as path from 'path';

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
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts`
Expected: FAIL

**Step 3: Implement validatePackageStructure activity**

Create `packages/agents/suite-builder-production/src/activities/quality.activities.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import type { StructureResult } from '../types';

export async function validatePackageStructure(input: {
  packagePath: string;
}): Promise<StructureResult> {
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
    if (!fs.existsSync(path.join(input.packagePath, file))) {
      missingFiles.push(file);
    }
  }

  // Validate package.json fields
  const packageJsonPath = path.join(input.packagePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const requiredFields = ['name', 'version', 'description', 'main', 'types', 'author', 'license'];
    for (const field of requiredFields) {
      if (!packageJson[field]) {
        invalidFields.push(field);
      }
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
```

**Step 4: Run test to verify it passes**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/quality.activities.ts packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts
git commit -m "feat: add validatePackageStructure quality check activity"
```

---

## Task 8: Implement runTypeScriptCheck Quality Activity

**Files:**
- Modify: `packages/agents/suite-builder-production/src/activities/quality.activities.ts`
- Modify: `packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts`

**Step 1: Write failing test**

Add to test file:

```typescript
import { runTypeScriptCheck } from '../quality.activities';
import { execAsync } from '../build.activities';

describe('runTypeScriptCheck', () => {
  it('should pass for valid TypeScript', async () => {
    const tempDir = '/tmp/valid-ts-package';
    fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });

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

  // Note: Testing actual TypeScript errors requires tsc to be run
  // For unit tests, we can mock execAsync to simulate errors
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts -t runTypeScriptCheck`
Expected: FAIL

**Step 3: Implement runTypeScriptCheck activity**

Add to `quality.activities.ts`:

```typescript
import { execAsync } from './build.activities';
import type { TypeScriptResult } from '../types';

export async function runTypeScriptCheck(input: {
  packagePath: string;
}): Promise<TypeScriptResult> {
  try {
    await execAsync('tsc --noEmit', { cwd: input.packagePath });

    return {
      passed: true,
      errors: [],
      details: { errors: [] }
    };
  } catch (error: any) {
    const stderr = error.stderr || '';
    const errors = parseTypeScriptErrors(stderr);

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

  return errors;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts -t runTypeScriptCheck`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/quality.activities.ts packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts
git commit -m "feat: add runTypeScriptCheck quality activity"
```

---

## Task 9: Implement calculateComplianceScore Quality Activity

**Files:**
- Modify: `packages/agents/suite-builder-production/src/activities/quality.activities.ts`
- Modify: `packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts`

**Step 1: Write failing test**

Add to test file:

```typescript
import { calculateComplianceScore } from '../quality.activities';

describe('calculateComplianceScore', () => {
  it('should return excellent for perfect scores', () => {
    const score = calculateComplianceScore({
      structureResult: { passed: true } as any,
      typeScriptResult: { passed: true } as any,
      lintResult: { passed: true } as any,
      testResult: { passed: true, coverage: { total: 95 } } as any,
      securityResult: { passed: true } as any,
      documentationResult: { passed: true } as any,
      licenseResult: { passed: true } as any,
      integrationResult: { passed: true } as any
    });

    expect(score.score).toBeGreaterThanOrEqual(95);
    expect(score.level).toBe('excellent');
  });

  it('should return blocked for low scores', () => {
    const score = calculateComplianceScore({
      structureResult: { passed: false } as any,
      typeScriptResult: { passed: false } as any,
      lintResult: { passed: false } as any,
      testResult: { passed: false, coverage: { total: 40 } } as any,
      securityResult: { passed: false } as any,
      documentationResult: { passed: false } as any,
      licenseResult: { passed: false } as any,
      integrationResult: { passed: false } as any
    });

    expect(score.score).toBeLessThan(85);
    expect(score.level).toBe('blocked');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts -t calculateComplianceScore`
Expected: FAIL

**Step 3: Implement calculateComplianceScore activity**

Add to `quality.activities.ts`:

```typescript
import type {
  ComplianceScore,
  StructureResult,
  TypeScriptResult,
  LintResult,
  TestResult,
  SecurityResult,
  DocumentationResult,
  LicenseResult,
  IntegrationResult
} from '../types';

export function calculateComplianceScore(input: {
  structureResult: StructureResult;
  typeScriptResult: TypeScriptResult;
  lintResult: LintResult;
  testResult: TestResult;
  securityResult: SecurityResult;
  documentationResult: DocumentationResult;
  licenseResult: LicenseResult;
  integrationResult: IntegrationResult;
}): ComplianceScore {
  // Weighted scoring
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

  let totalScore = 0;

  // Structure (10 points)
  totalScore += input.structureResult.passed ? weights.structure : 0;

  // TypeScript (20 points)
  totalScore += input.typeScriptResult.passed ? weights.typescript : 0;

  // Lint (15 points)
  totalScore += input.lintResult.passed ? weights.lint : 0;

  // Tests (25 points) - proportional to coverage
  if (input.testResult.passed) {
    const coverageRatio = input.testResult.coverage.total / 100;
    totalScore += weights.tests * coverageRatio;
  }

  // Security (15 points)
  totalScore += input.securityResult.passed ? weights.security : 0;

  // Documentation (5 points)
  totalScore += input.documentationResult.passed ? weights.documentation : 0;

  // License (5 points)
  totalScore += input.licenseResult.passed ? weights.license : 0;

  // Integration (5 points)
  totalScore += input.integrationResult.passed ? weights.integration : 0;

  // Determine level
  let level: 'excellent' | 'good' | 'acceptable' | 'blocked';
  if (totalScore >= 95) {
    level = 'excellent';
  } else if (totalScore >= 90) {
    level = 'good';
  } else if (totalScore >= 85) {
    level = 'acceptable';
  } else {
    level = 'blocked';
  }

  return {
    score: Math.round(totalScore),
    level
  };
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts -t calculateComplianceScore`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/agents/suite-builder-production/src/activities/quality.activities.ts packages/agents/suite-builder-production/src/activities/__tests__/quality.activities.test.ts
git commit -m "feat: add calculateComplianceScore quality activity with weighted scoring"
```

---

## Summary

This plan provides the first 9 tasks out of approximately 30-40 total tasks needed for the complete implementation. The remaining tasks would follow this same TDD pattern for:

- Remaining quality check activities (lint, tests, security, documentation, license, integration)
- Planning activities (searchLocalPlans, queryMcpForPlan, validatePlan, registerPlanWithMcp)
- MECE validation activities (analyzeMeceCompliance, generateSplitPlans, etc.)
- RemediationWorkflow implementation
- Main workflow refactor to add new phases
- Demo script updates
- Integration testing
- End-to-end testing

**Each task follows the pattern:**
1. Write failing test
2. Run test to verify failure
3. Implement minimal code
4. Run test to verify pass
5. Commit

**File naming conventions:**
- Activities: `packages/agents/suite-builder-production/src/activities/*.activities.ts`
- Tests: `packages/agents/suite-builder-production/src/activities/__tests__/*.activities.test.ts`
- Workflows: `packages/agents/suite-builder-production/src/workflows/*.workflow.ts`
- Types: `packages/agents/suite-builder-production/src/types/index.ts`

**Testing commands:**
- Run all tests: `yarn test`
- Run specific test file: `yarn test <path-to-test>`
- Run specific test: `yarn test <path-to-test> -t "<test-name>"`
- Watch mode: `yarn test:watch`

**Build command:**
- `yarn build` (compiles TypeScript)
