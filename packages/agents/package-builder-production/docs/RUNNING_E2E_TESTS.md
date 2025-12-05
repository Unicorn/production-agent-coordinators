# Running E2E Tests

This guide explains how to start the Temporal worker and run end-to-end tests.

## Prerequisites

1. **Temporal Server Running**
   ```bash
   # From monorepo root
   yarn infra:up
   
   # Or if using docker-compose directly
   docker-compose up -d temporal
   
   # Verify it's running
   curl http://localhost:7233/health
   ```

2. **CLI Tools Installed and Authenticated**
   - Claude CLI: `claude --version` should work
   - Gemini CLI: `gemini --version` should work

3. **Build the Project**
   ```bash
   cd packages/agents/package-builder-production
   npm run build
   ```

## Step 1: Start the Worker

The E2E tests use the `engine-cli-e2e` task queue. You need to start a worker on that queue.

### Option A: Start Worker with Specific Task Queue (Recommended for E2E)

```bash
cd packages/agents/package-builder-production

# Set the task queue environment variable
TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker
```

This will start a single worker on the `engine-cli-e2e` queue.

### Option B: Start Default Worker (Multiple Queues)

```bash
cd packages/agents/package-builder-production
npm run start:worker
```

This starts workers on both `engine` and `turn-based-coding` queues. The E2E tests won't work with this unless you modify the test to use one of these queues.

### Option C: Start Worker in Background

```bash
cd packages/agents/package-builder-production
TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker > worker.log 2>&1 &
```

Check the worker is running:
```bash
tail -f worker.log
```

## Step 2: Run E2E Tests

### Run All E2E Tests

```bash
cd packages/agents/package-builder-production
npm run test:cli
```

This runs `cli-integration.e2e.test.ts` which includes:
- Claude CLI E2E tests (if Claude has credits)
- Gemini CLI E2E tests (if Gemini has credits)

### Run Specific E2E Test File

```bash
cd packages/agents/package-builder-production
npm test -- src/__tests__/cli-integration.e2e.test.ts
```

### Run with Bail (Stop at First Failure)

```bash
cd packages/agents/package-builder-production
npm test -- --bail src/__tests__/cli-integration.e2e.test.ts
```

## Environment Variables

You can customize the Temporal connection:

```bash
TEMPORAL_ADDRESS=localhost:7233 \
TEMPORAL_NAMESPACE=default \
TEMPORAL_TASK_QUEUE=engine-cli-e2e \
npm run start:worker
```

## Quick Start Script

Here's a complete script to start everything:

```bash
#!/bin/bash
# Start worker and run E2E tests

cd packages/agents/package-builder-production

# Build first
echo "📦 Building..."
npm run build

# Start worker in background
echo "🚀 Starting worker..."
TEMPORAL_TASK_QUEUE=engine-cli-e2e npm run start:worker > worker.log 2>&1 &
WORKER_PID=$!

# Wait for worker to be ready
echo "⏳ Waiting for worker to be ready..."
sleep 5

# Run tests
echo "🧪 Running E2E tests..."
npm run test:cli

# Cleanup
echo "🛑 Stopping worker..."
kill $WORKER_PID
```

## Troubleshooting

### Worker Not Connecting

- Check Temporal is running: `curl http://localhost:7233/health`
- Check worker logs for connection errors
- Verify `TEMPORAL_ADDRESS` environment variable

### Tests Timing Out

- E2E tests can take 10-30 minutes (real CLI calls)
- Increase timeout in test file if needed
- Check worker is processing tasks in Temporal UI

### Worker Not Processing Tasks

- Verify worker is on the correct task queue (`engine-cli-e2e`)
- Check Temporal UI: http://localhost:8080
- Look for workflow execution errors in Temporal UI

## Temporal UI

View workflow execution in real-time:
- URL: http://localhost:8080
- Navigate to "Workflows" to see running workflows
- Click on a workflow to see activity execution details

## What the E2E Tests Do

1. **Create a test package** in `test-workspace/`
2. **Run the full PackageBuildWorkflow** with real CLI calls
3. **Verify the package is built** correctly
4. **Check all validation steps** pass
5. **Clean up** test workspace

The tests use the new task activity loop pattern, so you'll see:
- `executeTaskWithCLI` activities (one per task iteration)
- `runTaskValidations` activities (one per task)
- `executeFixWithCLI` activities (if validation errors occur)

Each activity appears separately in Temporal UI for full visibility.

