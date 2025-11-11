# Production Suite Builder

Temporal-based workflow system for building and publishing BernierLLC package suites.

## Prerequisites

- Temporal server running (see framework repo: `yarn infra:up`)
- Node.js 22+
- Yarn
- npm token with publish access to @bernierllc scope

## Setup

1. **Create configuration file:**

```bash
cp production/configs/example-build-env.json production/configs/build-env.json
```

2. **Edit build-env.json with your credentials:**

- Add your npm token
- Verify workspace root path
- Adjust concurrent builds if needed

3. **Ensure Temporal is running:**

```bash
cd ../agent-coordinators
yarn infra:up
```

## Running the Suite Builder

Build a suite from an audit report:

```bash
yarn demo:suite-builder
```

This will:
- Parse the audit report
- Build dependency graph
- Build packages in correct order (validators → core → utilities → services → UI → suites)
- Run quality checks for each package
- Automatically fix quality issues with agents
- Publish packages to npm
- Generate comprehensive reports

## Reports

After a build completes, find reports at:

```
production/reports/{YYYY-MM-DD}/
  @bernierllc-package-name.json     # Individual package reports
  suite-summary.json                 # Aggregate suite report
```

### Report Contents

**Package Reports:**
- Build/test/quality/publish metrics
- Fix attempts and agent prompts used
- Dependency wait times

**Suite Report:**
- Overall success/failure counts
- Total duration
- Slowest packages
- Packages requiring most fixes
- Full aggregated data

## Architecture

- **Main Workflow:** Orchestrates 5 phases (INITIALIZE → PLAN → BUILD → VERIFY → COMPLETE)
- **Child Workflows:** One per package, keeps history manageable
- **Dynamic Parallelism:** Respects dependencies, maximizes concurrency
- **Agent-Based Fixes:** Quality failures spawn agents to fix issues automatically
- **Comprehensive Reporting:** JSON reports enable data-driven improvements

## Configuration

See `production/configs/example-build-env.json` for all options.

Key settings:
- `maxConcurrentBuilds`: How many packages to build in parallel (default: 4)
- `testing.minCoveragePercent`: Minimum test coverage required (default: 80%)
- `publishing.dryRun`: Test without actually publishing (default: false)

## Troubleshooting

**"Temporal connection failed"**
- Ensure Temporal server is running: `yarn infra:up`

**"npm publish failed"**
- Verify npm token in build-env.json
- Check token has publish access to @bernierllc scope

**"Quality checks failed after 3 attempts"**
- Review package reports for specific failures
- Check agent prompts were created correctly
- Manual fixes may be needed

## Development

Build the suite builder package:

```bash
cd packages/agents/suite-builder-production
yarn build
yarn test
```
