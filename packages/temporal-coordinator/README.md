# Temporal Coordinator

Temporal integration for the Agent Coordinator system, providing durable workflow execution with automatic retries, failure handling, and observability.

## Overview

This package wraps the existing agent-coordinator system (Engine, Coordinator, Specs, Agents) in Temporal workflows and activities to provide:

- **Durability**: Workflows survive process crashes and restarts
- **Reliability**: Automatic retries with exponential backoff
- **Observability**: Full workflow history and execution tracking
- **Scalability**: Distribute work across multiple worker processes

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Temporal Server                          │
│              (localhost:7233 via Docker)                    │
└─────────────────────────────────────────────────────────────┘
                       ▲              ▲
                       │              │
                       │              │
          ┌────────────┘              └────────────┐
          │                                        │
    ┌─────▼──────┐                         ┌──────▼─────┐
    │   Worker   │                         │   Client   │
    │  Process   │                         │  Process   │
    │            │                         │            │
    │ - Workflows│                         │ - Starts   │
    │ - Activities│                        │   workflows│
    │            │                         │ - Queries  │
    └────────────┘                         │   status   │
         │                                 └────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│   Agent Coordinator Components        │
│                                        │
│  ┌──────────┐  ┌──────────┐          │
│  │  Engine  │  │Coordinator│          │
│  └──────────┘  └──────────┘          │
│                                        │
│  ┌──────────┐  ┌──────────┐          │
│  │  Specs   │  │  Agents  │          │
│  └──────────┘  └──────────┘          │
└────────────────────────────────────────┘
```

## Components

### Activities (`activities.ts`)
Activities perform side effects and can fail/retry:
- `initializeWorkflow` - Create initial workflow state
- `executeSpecDecision` - Get decision from spec and update state
- `executeAgentStep` - Execute work with an agent
- `processAgentResponse` - Process agent response and update state
- `storeArtifact` - Save artifacts to storage

Activities wrap existing Engine, Coordinator, and Agent components.

### Workflows (`workflows.ts`)
Workflows define orchestration logic (must be deterministic):
- `helloWorkflow` - Simple greeting workflow using HelloSpec
- `multiStepWorkflow` - Multi-step workflow (future expansion)

Workflows call activities to perform work and manage state transitions.

### Worker (`worker.ts`)
Worker process that executes workflows and activities:
- Connects to Temporal server
- Registers workflows and activities
- Processes tasks from queue

## Quick Start

### 1. Start Temporal Server

```bash
# Start Temporal in Docker
yarn infra:up

# Verify it's running
docker ps | grep temporal
```

Temporal Web UI will be available at http://localhost:8233

### 2. Build the Package

```bash
# Build all packages (from project root)
yarn build

# Or build just temporal-coordinator
cd packages/temporal-coordinator
yarn build
```

### 3. Start the Worker

The worker must be running to execute workflows:

```bash
# From project root
npx tsx packages/temporal-coordinator/src/worker.ts

# Or with environment variables
TEMPORAL_ADDRESS=localhost:7233 \
TEMPORAL_TASK_QUEUE=agent-coordinator-queue \
npx tsx packages/temporal-coordinator/src/worker.ts
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║   Temporal Worker - Agent Coordinator                     ║
╚════════════════════════════════════════════════════════════╝

🔌 Connecting to Temporal server...
   ✅ Connected to Temporal at: localhost:7233

📦 Creating worker...
   Task Queue: agent-coordinator-queue
   ...

🚀 Worker is ready!
   Waiting for workflows...
```

### 4. Run the Demo

In a separate terminal:

```bash
# Using MockAgent (no API key required)
npx tsx examples/demo-with-temporal.ts

# Using AnthropicAgent (requires ANTHROPIC_API_KEY in .env)
npx tsx examples/demo-with-temporal.ts --real-agent
```

## Configuration

### Environment Variables

- `TEMPORAL_ADDRESS` - Temporal server address (default: `localhost:7233`)
- `TEMPORAL_NAMESPACE` - Temporal namespace (default: `default`)
- `TEMPORAL_TASK_QUEUE` - Task queue name (default: `agent-coordinator-queue`)
- `ANTHROPIC_API_KEY` - API key for AnthropicAgent (optional)

### Workflow Configuration

```typescript
import type { HelloWorkflowConfig } from '@coordinator/temporal-coordinator/workflows';

const config: HelloWorkflowConfig = {
  goalId: 'my-goal-123',
  specType: 'hello',
  specConfig: {
    workKind: 'greet',
  },
  agentType: 'mock-agent', // or 'anthropic-agent'
  agentConfig: {},
  agentApiKey: process.env.ANTHROPIC_API_KEY,
  maxIterations: 10,
};
```

## Usage Examples

### Start a Workflow

```typescript
import { Connection, Client } from '@temporalio/client';

const connection = await Connection.connect({
  address: 'localhost:7233',
});

const client = new Client({ connection });

const handle = await client.workflow.start('helloWorkflow', {
  taskQueue: 'agent-coordinator-queue',
  workflowId: `hello-${Date.now()}`,
  args: [config],
});

const result = await handle.result();
console.log('Workflow completed:', result.status);
```

### Query Workflow Status

```typescript
// Get workflow handle
const handle = client.workflow.getHandle('hello-1234567890');

// Get current result (throws if still running)
try {
  const result = await handle.result();
  console.log('Completed:', result);
} catch (error) {
  console.log('Still running or failed');
}

// Describe workflow
const description = await handle.describe();
console.log('Status:', description.status.name);
```

### Signal a Workflow (Future)

```typescript
// Signal workflows for dynamic behavior
await handle.signal('pause');
await handle.signal('resume');
await handle.signal('cancel');
```

## Development

### Project Structure

```
packages/temporal-coordinator/
├── src/
│   ├── activities.ts     # Temporal activities (side effects)
│   ├── workflows.ts      # Temporal workflows (orchestration)
│   ├── worker.ts         # Worker process
│   └── index.ts          # Main exports
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Workflows

1. Define workflow in `workflows.ts`:
```typescript
export async function myWorkflow(config: MyConfig): Promise<Result> {
  // Deterministic orchestration logic
  const state = await initializeWorkflow(config.goalId, ...);
  // ... more logic
  return state;
}
```

2. Register in worker (automatic if exported from workflows.ts)

3. Call from client:
```typescript
const handle = await client.workflow.start('myWorkflow', {
  taskQueue: 'agent-coordinator-queue',
  workflowId: `my-workflow-${Date.now()}`,
  args: [config],
});
```

### Adding New Activities

1. Define activity in `activities.ts`:
```typescript
export async function myActivity(param: string): Promise<Result> {
  // Non-deterministic operations allowed here
  // - I/O operations
  // - External API calls
  // - Database access
  return result;
}
```

2. Add proxy in workflows.ts:
```typescript
const { myActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
});
```

3. Call from workflow:
```typescript
const result = await myActivity('param');
```

### Testing

```bash
# Run unit tests (from project root)
yarn test

# Run with worker
yarn build
npx tsx packages/temporal-coordinator/src/worker.ts &
npx tsx examples/demo-with-temporal.ts
```

## Troubleshooting

### Worker won't start

**Error**: `Connection refused`
- Ensure Temporal is running: `yarn infra:up`
- Check Docker: `docker ps | grep temporal`
- Verify port 7233 is accessible

**Error**: `Cannot find module`
- Build the package: `yarn build`
- Check tsconfig references

### Workflow fails immediately

**Error**: `Workflow not found`
- Ensure worker is running
- Check worker logs for registration errors
- Verify workflow name matches

**Error**: `Activity timeout`
- Increase activity timeout in workflow
- Check activity logs for errors
- Verify dependencies are installed

### Agent execution fails

**Error**: `Agent not found`
- Verify agent type in config
- Check agent factory registration
- Ensure dependencies are available

**Error**: `API key missing`
- Add ANTHROPIC_API_KEY to .env
- Use mock-agent for testing

## Temporal Web UI

Access the Temporal Web UI at http://localhost:8233 to:
- View workflow execution history
- See activity retry attempts
- Debug failed workflows
- Monitor worker status
- Query workflow state

## Advanced Topics

### Retry Policies

Activities have default retry policies:
```typescript
{
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '30s',
  maximumAttempts: 3,
}
```

Customize per activity:
```typescript
const { myActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 5,
    initialInterval: '2s',
  },
});
```

### Timeouts

Configure timeouts to prevent hung workflows:
```typescript
await client.workflow.start('helloWorkflow', {
  workflowExecutionTimeout: '1 hour',
  workflowRunTimeout: '30 minutes',
  workflowTaskTimeout: '10 seconds',
});
```

### Workflow Versioning

Use versioning for backward compatibility:
```typescript
import { patched, deprecatePatch } from '@temporalio/workflow';

export async function myWorkflow() {
  if (patched('fix-2024-01')) {
    // New behavior
  } else {
    // Old behavior
  }
}
```

## Resources

- [Temporal Documentation](https://docs.temporal.io/)
- [Temporal TypeScript SDK](https://docs.temporal.io/dev-guide/typescript)
- [Agent Coordinator Docs](../../README.md)
- [Temporal Web UI](http://localhost:8233)

## License

MIT
