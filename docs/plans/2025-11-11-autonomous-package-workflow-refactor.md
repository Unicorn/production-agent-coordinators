# Autonomous Package Workflow Refactor

**Date**: 2025-11-11
**Status**: Design In Progress

## Overview

Refactor the package builder workflow to accept minimal input and autonomously discover, plan, build, test, and publish packages with full MECE compliance handling.

## Current State

The workflow requires:
- Pre-created master-plan JSON file with all package details
- Manual dependency tree discovery
- Hardcoded build/test commands
- No plan management
- No MECE validation

## Target State

The workflow accepts **minimal input**:
- Package name: `"@bernierllc/openai-client"` or `"openai-client"`
- Package idea: `"create streaming OpenAI client"`
- Plan file path: `"plans/packages/core/openai-client.md"`
- Update prompt: `"add streaming support to openai-client"`

Then autonomously handles:
- Package discovery (local, plans, MCP, npm)
- Dependency tree building
- Plan management (find, generate, validate, register)
- MECE violation detection and resolution
- Worktree creation with .env copying
- Build orchestration in dependency order
- Publishing with version management
- Deprecation cycles for breaking changes

## Requirements Gathered

### Package Discovery
1. Check `./plans/packages/**` for plan files
2. Check `./packages/**` for package directories
3. Query packages-api MCP if not found locally
4. If still not found, ask user for confirmation/branch switch
5. Always work in worktrees
6. **Copy .env files**: Root `.env` and `mgr/.env` to every worktree

### Plan Management
1. Search locally in `./plans/packages/**`
2. Check packages-api MCP for registered plans
3. If not found and not provided:
   - Tell user workflow can't proceed without plan
   - Ask user to provide plan or cancel
   - Handle response accordingly

### MECE Compliance
When MECE violation detected:
1. Identify the problem and solution
2. Determine new packages needed to resolve violation
3. For published packages with MECE violations:
   - **First bump**: Minor version with deprecation notice + docs
   - **Second bump**: Major version with features split to new packages
4. For renames: Update all dependents and version bump them
5. Cascade all plan updates and register with MCP
6. **Fully autonomous**: Generate plans, create packages, build/test/publish all

### Build & Publish
- Always publish after successful build
- Default to private publish unless specified public
- Build commands standardized for tools repo: `yarn build`
- Test commands standardized: `yarn test:run`

### Workflow Architecture
- Main workflow coordinates the suite
- Child workflows for each package (main, dependencies, MECE splits)
- MECE violation packages treated like parallel packages
- May or may not become dependencies (situation-dependent)
- Dependency graph determines build order
- MECE splits can build in parallel unless there's a dependency

## Complete Design

### Workflow Input
```typescript
interface PackageWorkflowInput {
  // User provides ONE of these:
  packageName?: string;        // "@bernierllc/openai-client" or "openai-client"
  packageIdea?: string;         // "create streaming OpenAI client"
  planFilePath?: string;        // "plans/packages/core/openai-client.md"
  updatePrompt?: string;        // "add streaming support to openai-client"

  config: BuildConfig;           // Environment configuration (same as current)
}
```

**Demo Script Usage:**
```bash
yarn workflow:run openai-client
yarn workflow:run "add streaming to openai-client"
yarn workflow:run plans/packages/core/openai-client.md
```

### Workflow Phases

#### Phase 1: DISCOVERY
Discovers everything about the package without manual setup.

**Activities**:
- `parseInput(input)` - Determine if input is name/idea/path/prompt
- `searchForPackage(input)` - Search hierarchy:
  1. `./plans/packages/**/*.md` for plan files
  2. `./packages/**/package.json` for package directories
  3. packages-api MCP for registered packages
  4. If not found: Ask user if package name is correct / suggest branch switch
- `readPackageJson(path)` - Extract name, version, dependencies, scripts
- `buildDependencyTree(packageName)` - Recursively discover all workspace dependencies
- `checkNpmStatus(packageName)` - Query npm registry via MCP
- `setupWorktree(packageName)` - Create isolated workspace
- `copyEnvFiles(worktreePath)` - **Copy root `.env` and `mgr/.env` to worktree**

**Critical .env Handling:**
```typescript
async function copyEnvFiles(input: { worktreePath: string }): Promise<void> {
  const sourceRoot = '/Users/mattbernier/projects/tools';
  const files = [
    path.join(sourceRoot, '.env'),
    path.join(sourceRoot, 'mgr', '.env')
  ];

  for (const file of files) {
    if (fs.existsSync(file)) {
      const relativePath = path.relative(sourceRoot, file);
      const target = path.join(input.worktreePath, relativePath);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.copyFile(file, target);
    }
  }
}
```

**Output**: Package manifest with dependencies, worktree path

#### Phase 2: PLANNING
Finds or generates plans for all packages.

**Activities**:
- `searchLocalPlans(packageName)` - Look in `./plans/packages/**`
- `queryMcpForPlan(packageName)` - Ask packages-api MCP
- **If no plan found:**
  - Stop workflow
  - Report: "Cannot proceed without plan for {packageName}"
  - Ask user: "Please provide plan file path or cancel workflow"
  - Wait for user response (pause workflow)
  - If user provides path: Load plan and continue
  - If user cancels: End workflow gracefully
- `validatePlan(planPath)` - Verify plan has required sections
- `registerPlanWithMcp(plan)` - Register plan with packages-api MCP

**Output**: Validated plan for each package

#### Phase 3: MECE VALIDATION
Detects MECE violations and autonomously creates new packages.

**Activities**:
1. `analyzeMeceCompliance(packageName, updatePrompt)` - Detect violations
   - For updates: Check if new functionality violates MECE
   - Query packages-api MCP with context
   - Returns: `{ isCompliant: boolean, violation?: MeceViolation }`

2. **If violation detected:**
   ```typescript
   {
     violation: "Adding video processing violates single-responsibility",
     solution: "Split into @bernierllc/video-processor package",
     affectedFunctionality: ["processVideo", "encodeVideo"],
     mainPackageStillUsesIt: true  // Creates dependency relationship
   }
   ```

3. `generateSplitPlans(violation)` - Create plans for new packages via MCP
4. `registerSplitPlans(plans)` - Register with MCP

5. **For published packages with MECE violations** - Deprecation cycle:
   ```typescript
   // First bump: Minor version with deprecation notice
   packages.push({
     name: "@bernierllc/openai-client",
     version: "1.1.0",
     changes: ["Add deprecation notice for processVideo"],
     updateDocs: "processVideo moving to @bernierllc/video-processor in 2.0.0"
   });

   // Second bump: Major version with split
   packages.push({
     name: "@bernierllc/openai-client",
     version: "2.0.0",
     changes: ["Remove processVideo", "Add dependency on @bernierllc/video-processor"]
   });

   // New package
   packages.push({
     name: "@bernierllc/video-processor",
     version: "1.0.0",
     changes: ["Initial release with processVideo"]
   });
   ```

6. **For renames:**
   - Find all packages that depend on renamed package
   - Generate update plans for each dependent
   - Queue all dependents as part of suite

**Output**: Complete package suite (main + dependencies + MECE splits + updated dependents)

**Key Insight**: MECE split packages are just additional packages in the suite that may or may not have dependency relationships. The dependency graph determines build order.

#### Phase 4: BUILD
Dynamic parallelism respecting dependency constraints.

**Process**:
- Create dependency graph with topological sort
- Spawn child workflows (PackageBuildWorkflow) for each package
- Use Promise.race pattern for dynamic parallelism
- MECE splits can build in parallel unless there's a dependency

**Child Workflow: PackageBuildWorkflow**
Each package gets its own child workflow:
1. **Build** - `runBuild(packagePath)` - Always: `yarn build`
2. **Quality** - Run comprehensive quality checks (see below)
3. **Remediation** - If quality fails, delegate to agent
4. **Publish** - If quality passes, publish to npm

#### Phase 4.1: QUALITY CHECKS (Inside PackageBuildWorkflow)
Breaking down ./manager CLI into individual activities:

**Quality Activities** (run in parallel):
```typescript
// 1. Structure validation
validatePackageStructure(packagePath)
// Check: package.json, tsconfig.json, jest.config.js, .eslintrc.js
// Verify: all required fields, build script exists, produces dist/

// 2. TypeScript strict mode
runTypeScriptCheck(packagePath)
// Run: tsc --noEmit
// Verify: Zero TypeScript errors in strict mode

// 3. Linting
runLintCheck(packagePath)
// Run: yarn lint
// Verify: Zero ESLint errors or warnings

// 4. Tests with coverage
runTestsWithCoverage(packagePath, packageType)
// Run: yarn test:coverage
// Check thresholds: core=90%, service=85%, suite/ui=80%

// 5. Security audit
runSecurityAudit(packagePath)
// Run: npm audit
// Verify: No high/critical vulnerabilities

// 6. Documentation
validateDocumentation(packagePath)
// Check README.md sections: installation, usage, API, config, examples, integration status

// 7. License headers
validateLicenseHeaders(packagePath)
// Check all .ts files have Bernier LLC license header

// 8. Integration points
validateIntegrationPoints(packagePath, packageType)
// Verify: logger integration (service/suite), NeverHub evaluation, PackageResult pattern

// 9. Compliance scoring
calculateComplianceScore(allResults)
// Calculate weighted score: 95-100% = Excellent, 90-94% = Good, 85-89% = Acceptable, <85% = Blocked
```

**Quality Loop with Agent Remediation:**
```typescript
async function qualityPhase(packageInfo: PackageInfo): Promise<QualityReport> {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    // Run all quality checks in parallel
    const checks = await Promise.all([/* all 8 checks */]);
    const compliance = await calculateComplianceScore(checks);

    // If quality is acceptable, proceed
    if (compliance.score >= 85) {
      return { compliance, checks };
    }

    // Generate remediation tasks
    const remediationTasks = buildRemediationReport(checks);

    // Delegate to remediation agent
    await startChild(RemediationWorkflow, {
      workflowId: `remediate-${packageInfo.name}-attempt-${attempts}`,
      args: [{ packagePath, tasks: remediationTasks }]
    });

    attempts++;
  }

  // After max attempts, skip publishing but continue suite
  throw new Error(`Quality remediation failed after ${maxAttempts} attempts`);
}
```

**Remediation Task Structure:**
```typescript
interface RemediationTask {
  category: 'structure' | 'typescript' | 'lint' | 'tests' | 'security' | 'documentation' | 'license' | 'integration';
  priority: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  details: string[];  // Specific errors/issues
  suggestedFix?: string;
}
```

**Remediation Agent:**
- Receives detailed report of what's wrong
- Works autonomously to fix issues
- After remediation, quality checks re-run automatically
- Loop continues until score ≥ 85% or max attempts

#### Phase 5: PUBLISH
Always publish after successful quality checks.

**Activities**:
- `determineVersionBump(packageName, changeType)` - Semantic versioning
- `publishToNpm(packagePath, version, isPublic)` - npm publish
  - Default: private publish
  - Set `--access=public` only if explicitly requested
- `updateDependentVersions(packageName, newVersion)` - Update package.json in consumers
- `publishDeprecationNotice(packageName, message)` - For deprecation cycles (npm deprecate)

**Publishing Rules:**
- **95-100% score**: Publish immediately with "Excellent" badge
- **90-94% score**: Publish with warnings logged
- **85-89% score**: Publish with confirmation
- **Below 85%**: Package skipped (not published), suite continues

#### Phase 6: COMPLETE
Generate comprehensive reports.

**Activities**:
- `loadAllPackageReports(buildId)` - Gather all package build results
- `writeBuildReport(buildId, packages)` - Generate suite-level report
- Final report includes:
  - All packages built
  - Quality scores for each
  - Remediation attempts
  - MECE violations resolved
  - New packages created
  - Deprecation cycles initiated

### Architecture Summary

```
Input (minimal) → DISCOVERY → PLANNING → MECE VALIDATION → BUILD → PUBLISH → COMPLETE
                      ↓           ↓              ↓              ↓         ↓
                   Package    Validate      Generate      Child      Version
                   Manifest   Plans         Suite         Workflows  Bumps
                   + Deps     + Register    + Splits      + Quality  + npm
                   + Worktree               + Deprecate   + Remediate
```

**Key Architectural Principles:**
1. **Minimal input** - User provides package name/idea/path/prompt
2. **Autonomous discovery** - Workflow finds everything (packages, deps, plans)
3. **MECE compliance** - Automatically detects violations and creates new packages
4. **Agent remediation** - Quality failures trigger autonomous fixes
5. **Parallel execution** - Dependencies determine build order, everything else parallel
6. **Always publish** - Default behavior after quality gates pass

## Implementation Status

- [x] Design validated and approved
- [ ] Create detailed implementation plan
- [ ] Implement discovery activities
- [ ] Implement planning activities
- [ ] Implement MECE validation activities
- [ ] Implement comprehensive quality check activities
- [ ] Implement remediation workflow
- [ ] Refactor main workflow with new phases
- [ ] Update demo script to accept minimal input
- [ ] Test with real package (openai-client)

## Next Steps

1. Set up worktree for implementation
2. Create detailed implementation plan (bite-sized tasks)
3. Execute implementation using subagent-driven-development
4. Test with openai-client package
5. Iterate and refine based on real-world usage
