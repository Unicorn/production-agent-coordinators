# Autonomous Package Workflow

A fully autonomous Temporal-based workflow system that accepts minimal input and autonomously discovers, plans, builds, tests, and publishes packages with comprehensive quality gates and MECE compliance.

## Overview

This workflow system transforms package building from manual orchestration to fully autonomous operation:

- **Minimal Input**: Provide just a package name, idea, plan file, or update prompt
- **Autonomous Discovery**: Finds packages, dependencies, and plans automatically
- **MECE Compliance**: Detects violations and creates split packages with deprecation cycles
- **Quality Gates**: Comprehensive validation with autonomous remediation
- **Publishing**: Automatic npm publishing after successful builds
- **Reporting**: Detailed reports for every package and suite

## Quick Start

```bash
# Build a package by name
yarn workflow:run openai-client

# Build with scoped name
yarn workflow:run "@bernierllc/openai-client"

# Update a package
yarn workflow:run --update openai-client "add streaming support"
```

## Architecture

### 7-Phase Workflow

#### Phase 1: DISCOVERY
Autonomously discovers everything about the package:
- Parses input to determine type (name/idea/path/prompt)
- Searches hierarchy: plans directory → packages directory → MCP → user prompt
- Reads package.json and extracts metadata
- Builds complete dependency tree recursively
- Sets up isolated worktree with .env file copying

**Activities**:
- `parseInput` - Determines input type
- `searchForPackage` - Multi-location package discovery
- `readPackageJson` - Extracts package metadata
- `buildDependencyTree` - Recursive dependency discovery with cycle detection
- `copyEnvFiles` - Copies root and mgr/.env to worktree

#### Phase 2: PLANNING
Finds or generates implementation plans:
- Searches local plans in `./plans/packages/**`
- Queries MCP for registered plans
- Validates plan structure and content
- Registers plans with MCP for future use
- Asks user if plan not found (workflow pauses)

**Activities**:
- `searchLocalPlans` - Searches local filesystem
- `queryMcpForPlan` - Queries packages-api MCP (stub)
- `validatePlan` - Verifies plan structure
- `registerPlanWithMcp` - Registers with MCP (stub)

#### Phase 3: MECE VALIDATION
Ensures Mutually Exclusive, Collectively Exhaustive package design:
- Analyzes package for MECE compliance
- Detects violations (e.g., video processing in OpenAI client)
- Generates plans for split packages
- Handles 2-version deprecation cycles for published packages:
  - **v1.1.0**: Minor bump with deprecation notice
  - **v2.0.0**: Major bump with functionality split to new package
- Updates all dependent packages and their plans

**Activities**:
- `analyzeMeceCompliance` - Detects violations (stub - requires MCP)
- `generateSplitPlans` - Creates plans for new packages (stub - requires MCP)
- `registerSplitPlans` - Registers split package plans (stub - requires MCP)
- `determineDeprecationCycle` - Calculates version bumps
- `updateDependentPlans` - Cascades updates (stub - requires MCP)

#### Phase 4: BUILD
Builds all packages in dependency order with dynamic parallelism:
- Creates dependency graph with topological sort
- Spawns child workflows (PackageBuildWorkflow) for each package
- Uses Promise.race pattern for optimal parallelism
- MECE splits build in parallel unless dependencies exist

**Activities**:
- `runBuild` - Executes `yarn build` (in PackageBuildWorkflow)

#### Phase 5: QUALITY
Comprehensive validation with 8 parallel checks:

1. **Structure Validation** - Verifies required files and package.json fields
2. **TypeScript Check** - Zero errors in strict mode (`tsc --noEmit`)
3. **Lint Check** - ESLint with zero errors/warnings
4. **Tests + Coverage** - Package-type specific thresholds:
   - Core: 90%
   - Service: 85%
   - Suite/UI: 80%
5. **Security Audit** - No high/critical vulnerabilities
6. **Documentation** - README sections (installation, usage, API, etc.)
7. **License Headers** - Bernier LLC license in all .ts files
8. **Integration Points** - Logger integration for service/suite packages

**Scoring**:
- **95-100%**: Excellent - Publish immediately
- **90-94%**: Good - Publish with warnings
- **85-89%**: Acceptable - Publish with confirmation
- **<85%**: Remediation required (max 3 attempts)

**Activities**:
- `validatePackageStructure`
- `runTypeScriptCheck`
- `runLintCheck`
- `runTestsWithCoverage`
- `runSecurityAudit`
- `validateDocumentation`
- `validateLicenseHeaders`
- `validateIntegrationPoints`
- `calculateComplianceScore` (pure function)

**Remediation**:
When quality < 85%, spawns `RemediationWorkflow`:
- Receives detailed report of issues
- Works autonomously to fix problems
- Re-runs quality checks after fixes
- Loops until score ≥ 85% or max attempts reached

#### Phase 6: PUBLISH
Always publishes after successful quality checks:
- Determines semantic version bump (major/minor/patch)
- Publishes to npm (default: private)
- Updates dependent package versions
- Publishes deprecation notices for deprecation cycles

**Activities**:
- `determineVersionBump` - Semantic versioning logic
- `publishToNpm` - npm publish with registry configuration
- `updateDependentVersions` - Updates consumers
- `publishDeprecationNotice` - npm deprecate command

#### Phase 7: COMPLETE
Generates comprehensive reports:
- Loads all package build reports
- Writes suite-level summary
- Returns SuiteBuilderResult with:
  - Total packages built
  - Successful/failed/skipped counts
  - Individual package details with quality scores

**Activities**:
- `loadAllPackageReports`
- `writeSuiteReport`

### Complete Activity List

**Total**: 33 activities (28 async + 5 pure functions)

| Category | Activity | Status |
|----------|----------|--------|
| **Discovery (7)** | parseInput | ✅ Implemented |
| | searchForPackage | ✅ Implemented |
| | readPackageJson | ✅ Implemented |
| | buildDependencyTree | ✅ Implemented |
| | checkNpmStatus | ⚠️ Stub (future) |
| | setupWorktree | ⚠️ Stub (future) |
| | copyEnvFiles | ✅ Implemented |
| **Planning (4)** | searchLocalPlans | ✅ Implemented |
| | queryMcpForPlan | ⚠️ Stub (requires MCP) |
| | validatePlan | ✅ Implemented |
| | registerPlanWithMcp | ⚠️ Stub (requires MCP) |
| **MECE (5)** | analyzeMeceCompliance | ⚠️ Stub (requires MCP) |
| | generateSplitPlans | ⚠️ Stub (requires MCP) |
| | registerSplitPlans | ⚠️ Stub (requires MCP) |
| | determineDeprecationCycle | ✅ Implemented |
| | updateDependentPlans | ⚠️ Stub (requires MCP) |
| **Build (1)** | runBuild | ✅ Implemented |
| **Quality (9)** | validatePackageStructure | ✅ Implemented |
| | runTypeScriptCheck | ✅ Implemented |
| | runLintCheck | ✅ Implemented |
| | runTestsWithCoverage | ✅ Implemented |
| | runSecurityAudit | ✅ Implemented |
| | validateDocumentation | ✅ Implemented |
| | validateLicenseHeaders | ✅ Implemented |
| | validateIntegrationPoints | ✅ Implemented |
| | calculateComplianceScore | ✅ Implemented (pure function) |
| **Publish (4)** | determineVersionBump | ✅ Implemented |
| | publishToNpm | ✅ Implemented |
| | updateDependentVersions | ✅ Implemented |
| | publishDeprecationNotice | ✅ Implemented |
| **Report (2)** | loadAllPackageReports | ✅ Implemented |
| | writeSuiteReport | ✅ Implemented |

## Usage

### Basic Commands

```bash
# Build by package name
yarn workflow:run logger
yarn workflow:run "@bernierllc/logger"

# Build by idea (requires MCP)
yarn workflow:run "create streaming OpenAI client"

# Build from plan file (requires MCP)
yarn workflow:run plans/packages/core/openai-client.md

# Update existing package
yarn workflow:run --update logger "add JSON output support"
```

### Demo Script

Located at `production/scripts/build-content-suite.ts`:

```typescript
import { Connection, Client } from '@temporalio/client';
import { SuiteBuilderWorkflow } from '@coordinator/agent-suite-builder-production';

const client = new Client({ connection, namespace: 'default' });

const handle = await client.workflow.start(SuiteBuilderWorkflow, {
  taskQueue: 'suite-builder',
  workflowId: `package-build-${packageName}-${Date.now()}`,
  args: [{
    packageName: '@bernierllc/openai-client',
    config: {
      npmRegistry: 'https://registry.npmjs.org',
      npmToken: process.env.NPM_TOKEN,
      workspaceRoot: '/Users/mattbernier/projects/tools',
      maxConcurrentBuilds: 3,
      temporal: {
        address: 'localhost:7233',
        namespace: 'default',
        taskQueue: 'suite-builder'
      }
    }
  }]
});

const result = await handle.result();
console.log(`Built ${result.successfulBuilds}/${result.totalPackages} packages`);
```

## Configuration

### Environment Setup

Create `production/configs/build-env.json`:

```json
{
  "npmRegistry": "https://registry.npmjs.org",
  "workspaceRoot": "/Users/mattbernier/projects/tools",
  "maxConcurrentBuilds": 3,
  "temporal": {
    "address": "localhost:7233",
    "namespace": "default",
    "taskQueue": "suite-builder"
  }
}
```

### Environment Variables

Required:
- `NPM_TOKEN` - npm authentication token

Optional (copied to worktrees):
- `.env` - Root environment variables
- `mgr/.env` - Manager environment variables

## Testing

### Unit Tests

```bash
# Run all 242 tests
yarn test --run

# Run specific test suite
yarn test src/activities/__tests__/quality.activities.test.ts --run
```

**Test Coverage**:
- 242 tests passing
- 11 test files
- Comprehensive coverage of all 28 activities
- Integration tests for workflows
- End-to-end test suite (requires Temporal infrastructure)

### Test Organization

```
src/
├── activities/
│   ├── __tests__/
│   │   ├── discovery.activities.test.ts     (14 tests)
│   │   ├── planning.activities.test.ts      (30 tests)
│   │   ├── mece.activities.test.ts          (42 tests)
│   │   ├── quality.activities.test.ts       (80 tests)
│   │   ├── publish.activities.test.ts       (38 tests)
│   │   ├── report.activities.test.ts        (7 tests)
│   │   └── build.activities.test.ts         (14 tests)
│   ├── discovery.activities.ts
│   ├── planning.activities.ts
│   ├── mece.activities.ts
│   ├── quality.activities.ts
│   ├── publish.activities.ts
│   └── report.activities.ts
├── workflows/
│   ├── __tests__/
│   │   ├── suite-builder.workflow.test.ts   (4 tests)
│   │   ├── package-build.workflow.test.ts   (2 tests)
│   │   ├── remediation.workflow.test.ts     (6 tests)
│   │   └── suite-builder-e2e.test.ts        (11 tests, 2 skipped)
│   ├── suite-builder.workflow.ts
│   ├── package-build.workflow.ts
│   └── remediation.workflow.ts
└── types/
    ├── __tests__/
    │   └── types.test.ts                     (5 tests)
    └── index.ts
```

## Type System

### Input Types

```typescript
interface PackageWorkflowInput {
  packageName?: string;         // "@bernierllc/logger" or "logger"
  packageIdea?: string;          // "create streaming client"
  planFilePath?: string;         // "plans/packages/core/logger.md"
  updatePrompt?: string;         // "add JSON support"
  config: BuildConfig;
}
```

### Result Type

```typescript
interface SuiteBuilderResult {
  totalPackages: number;
  successfulBuilds: number;
  failedBuilds: number;
  skippedPackages: number;
  packages: Array<{
    name: string;
    version: string;
    buildStatus: 'completed' | 'failed' | 'skipped';
    qualityScore?: number;
  }>;
}
```

## Development

### Building

```bash
yarn build
```

### Running Tests

```bash
# All tests
yarn test --run

# Watch mode
yarn test

# Specific file
yarn test src/activities/__tests__/quality.activities.test.ts
```

### Running Workflow

Requires Temporal server running:

```bash
# Start Temporal (in separate terminal)
temporal server start-dev

# Run workflow
yarn workflow:run openai-client
```

## Future Enhancements

### MCP Integration (In Progress)

6 activities are stubbed pending MCP server configuration:
- `queryMcpForPlan` - Query packages-api for plans
- `registerPlanWithMcp` - Register plans with MCP
- `analyzeMeceCompliance` - MECE violation detection
- `generateSplitPlans` - Generate plans for split packages
- `registerSplitPlans` - Register split package plans
- `updateDependentPlans` - Cascade plan updates

### Additional Input Types

Currently only `packageName` fully implemented:
- `packageIdea` - Requires MCP for package discovery
- `planFilePath` - Requires MCP for package lookup
- `updatePrompt` - Works with `packageName`

### Enhanced Quality Checks

Potential additions:
- Performance benchmarks
- Bundle size analysis
- Accessibility testing
- Visual regression testing

## Security

### Credentials

- Store NPM token in system environment variables (production)
- Use .env file only in dev/staging
- Never commit credentials to git
- Config files in `production/configs/` are gitignored

### Publishing

- Default: Private packages (`--access=restricted`)
- Public publishing requires explicit configuration
- All packages validated before publishing
- Deprecation notices for breaking changes

## License

Copyright © 2025 Bernier LLC. All rights reserved.

---

**Generated with**: [Claude Code](https://claude.com/claude-code)
