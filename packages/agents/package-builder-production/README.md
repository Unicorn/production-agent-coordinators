# Production Package Builder Agent

AI-powered package generation using Temporal workflows with Gemini 2.0 Flash.

## Quick Start

### Prerequisites

1. **Environment Variables** - Create a `.env` file in the monorepo root:

```bash
# Required for Gemini-based package generation
GEMINI_API_KEY=your-gemini-api-key

# Required for publishing (optional for generation only)
NPM_TOKEN=npm_xxxxx

# Where packages will be generated (your tools monorepo)
WORKSPACE_ROOT=/Users/mattbernier/projects/tools

# Temporal settings (defaults shown)
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
```

2. **Build the project**:

```bash
# From monorepo root
yarn install
yarn build
```

---

## Running the Workflow

### Step 1: Start Temporal Infrastructure

```bash
# From monorepo root - starts Temporal, PostgreSQL, Redis, and Temporal UI
yarn infra:up

# Verify Temporal is running (wait ~30 seconds for healthy status)
docker ps | grep temporal

# View logs if needed
yarn infra:logs
```

**Temporal UI**: http://localhost:8080

### Step 2: Start the Worker

```bash
# From monorepo root
cd packages/agents/package-builder-production

# Build first (if not already built)
yarn build

# Start the worker (runs both 'engine' and 'turn-based-coding' queues)
yarn start:worker
```

You should see:
```
🔨 Package Builder Workers starting (multi-queue mode)...

✅ Engine Worker ready
   Task Queue: engine
   Max Concurrent Activities: 5
   Max Concurrent Workflow Tasks: 10
✅ Turn-Based Coding Worker ready
   Task Queue: turn-based-coding
   Max Concurrent Activities: 1 (Gemini API rate limit control)
   Max Concurrent Workflow Tasks: 1

   Namespace: default
   Ready to execute all workflow types
```

### Step 3: Start a Package Build Workflow

```bash
# From monorepo root
yarn build:package /path/to/your/plan.md

# Example with full path:
yarn build:package ~/projects/tools/plans/packages/core/data-validator.md
```

**Alternative - Run directly with tsx:**
```bash
npx tsx production/scripts/build-package.ts /path/to/plan.md
```

---

## Plan File Format

The workflow reads a markdown plan file to understand what package to build. Example:

```markdown
# @bernierllc/my-package

**Package:** `@bernierllc/my-package`
**Type:** utility
**Status:** Planning

## Overview

A brief description of what this package does.

## Requirements

### Core Features
- Feature 1
- Feature 2

## Dependencies

- `@bernierllc/logger`: For logging (if needed)

## Package Structure

\`\`\`
@bernierllc/my-package/
├── src/
│   ├── index.ts
│   └── types.ts
├── tests/
│   └── index.test.ts
├── package.json
└── README.md
\`\`\`

## API Design

\`\`\`typescript
export function myFunction(): void;
\`\`\`
```

See `test-harness/fixtures/sample-plan.md` for a complete example.

---

## Workflow Architecture

### Gemini Turn-Based Agent (Active)

The workflow uses **Gemini 2.0 Flash** in a turn-based loop:

1. **AI decides next action** - Gemini analyzes current state and chooses a command
2. **Execute command** - Apply code changes, run linting, run tests, etc.
3. **Update context** - Record results in action history
4. **Repeat** - Up to 40 iterations until package is complete

**Commands the AI can choose:**
- `APPLY_CODE_CHANGES` - Create/modify files with git commit
- `RUN_LINT_CHECK` - Run linting and report errors
- `RUN_UNIT_TESTS` - Run tests and report coverage
- `CHECK_LICENSE_HEADERS` - Validate license headers
- `VALIDATE_PACKAGE_JSON` - Validate package.json structure
- `PUBLISH_PACKAGE` - Publish to npm
- `DONE` - Mark workflow complete
- `REQUEST_HUMAN_INTERVENTION` - Ask for help when stuck

### Task Queues

- **`engine`** - Parent coordinator workflow (PackageBuildWorkflow)
- **`turn-based-coding`** - Gemini agent child workflows (rate-limited to 1 concurrent)

---

## Monitoring

### Temporal UI

Open http://localhost:8080 to:
- View running/completed workflows
- See workflow history and events
- Inspect activity inputs/outputs
- Debug failures

### Console Output

The worker logs all activity to stdout:
```
[Gemini] Iteration 1/40
[Gemini] AI chose command: APPLY_CODE_CHANGES
[Gemini] Files modified: src/index.ts, src/types.ts
[Gemini] Iteration 2/40
[Gemini] AI chose command: RUN_LINT_CHECK
[Gemini] Lint passed!
...
```

---

## Stopping Everything

```bash
# Stop the worker
Ctrl+C in the worker terminal

# Stop Temporal infrastructure
yarn infra:down
```

---

## Troubleshooting

### "GEMINI_API_KEY not found"
```bash
# Make sure .env is in monorepo root with:
GEMINI_API_KEY=your-key
```

### "Connection refused to localhost:7233"
```bash
# Temporal isn't running. Start it:
yarn infra:up

# Wait for healthy status:
docker ps | grep temporal
```

### "Worker not picking up workflows"
```bash
# Make sure worker is running on correct queue
# Check that build completed: yarn build
# Restart worker: yarn start:worker
```

### "Workflow timed out"
- Check Temporal UI for error details
- Gemini API rate limits may have been hit
- Try running again (workflow state is checkpointed)

---

## Configuration Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | (required) | Google Gemini API key |
| `NPM_TOKEN` | (required for publish) | npm authentication token |
| `WORKSPACE_ROOT` | (required) | Where packages are generated |
| `TEMPORAL_ADDRESS` | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_TASK_QUEUE` | (multi-queue) | Override to single queue mode |
| `MAX_CONCURRENT_ACTIVITY_EXECUTIONS` | `5` | Activity concurrency limit |
| `MAX_CONCURRENT_WORKFLOW_EXECUTIONS` | `10` | Workflow concurrency limit |
| `DRY_RUN` | `false` | Skip actual npm publish |

### Single Queue Mode (Advanced)

To run only one task queue:
```bash
TEMPORAL_TASK_QUEUE=engine yarn start:worker
# or
TEMPORAL_TASK_QUEUE=turn-based-coding yarn start:worker
```

---

## Development

### Running Tests
```bash
cd packages/agents/package-builder-production
yarn test          # Run all tests
yarn test gemini   # Run only Gemini-related tests
```

### Test Harness
```bash
# Test file operations without running full workflow
npx tsx test-harness/test-file-operations.ts
```

---

## Related Documentation

- [Turn-Based Architecture](./docs/architecture/turn-based-generation.md)
- [Operator Guide](./docs/guides/turn-based-generation-guide.md)
- [Migration Guide](./docs/guides/migrating-to-turn-based.md)
