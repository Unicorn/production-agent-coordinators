# Plan Writer Service

Temporal-based service for automated package plan generation with intelligent discovery and resilient retry.

## Features

- **Automated MCP Scanning** - Hourly cron workflow discovers packages without plans
- **On-Demand Scanning** - Manual trigger for immediate package discovery
- **Indefinite Retry** - Fibonacci backoff ensures child packages wait for parent plans
- **Continue-as-New** - Unbounded service lifespan without workflow history overflow
- **Smart Signaling** - Children automatically notify service when discovering work

## Architecture

### Workflow Hierarchy

```
PlanWriterServiceWorkflow (main coordinator)
├── MCPScannerWorkflow (cron @hourly)
│   └── signals service with discoveries
└── PlanWriterPackageWorkflow (child, per package)
    ├── signals service when finding packages
    └── retries indefinitely with Fibonacci backoff
```

### Signal Flow

- **Scanner → Service**: Discovered packages needing plans
- **Child → Service**: Parent/sibling packages discovered during execution
- **Manual → Service**: On-demand requests from client

## Prerequisites

1. **Temporal Server** running locally or accessible
2. **Node.js** 18+ with npm/yarn
3. **Environment Variables** configured (see Configuration)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# MCP API Configuration
MBERNIER_API_URL=https://api.mbernier.com
MBERNIER_API_KEY=your-api-key-here

# Plan File Configuration (optional)
PLAN_OUTPUT_DIR=plans/packages
PLAN_GIT_BRANCH_PREFIX=feature/
```

### 3. Build

```bash
npm run build
```

### 4. Start Worker

```bash
npm run worker
```

Worker output:
```
╔════════════════════════════════════════════════════════════╗
║   Temporal Worker - Plan Writer Service                   ║
╚════════════════════════════════════════════════════════════╝

🔌 Connecting to Temporal server...
   ✅ Connected to Temporal at: localhost:7233

📦 Creating worker...
   Task Queue: plan-writer-service
   Workflows: dist/workflows.js
   Activities: Plan + MCP activities

🚀 Worker is ready!
   Waiting for workflows...

   📊 Temporal UI: http://localhost:8233
   Press Ctrl+C to shutdown
```

### 5. Start Service (in another terminal)

```bash
npm run client:start-service
```

Output:
```
🚀 Starting Plan Writer Service workflow...
✅ Service started with ID: plan-writer-service
📊 View in Temporal UI: http://localhost:8233
```

### 6. Start MCP Scanner (optional - auto-starts with cron)

```bash
npm run client:start-scanner
```

## Usage

### Check Service Status

```bash
npm run client:status
```

### Trigger Manual MCP Scan

```bash
npm run client:trigger-scan
```

Triggers immediate scan without waiting for hourly cron.

### Request Plan for Specific Package

```bash
npm run client -- request-plan @bernierllc/my-package "New feature needed" high
```

Arguments:
- `packageId` (required): Package to create plan for
- `reason` (optional): Why the plan is needed
- `priority` (optional): `high`, `normal`, or `low` (default: `normal`)

### Development Mode (auto-restart on changes)

```bash
npm run worker:dev
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run clean` | Remove build artifacts |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run worker` | Start Temporal worker |
| `npm run worker:dev` | Start worker with auto-restart |
| `npm run client` | Run client CLI |
| `npm run client:start-service` | Start main service workflow |
| `npm run client:start-scanner` | Start MCP scanner cron |
| `npm run client:trigger-scan` | Trigger manual scan |
| `npm run client:status` | Get service status |

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TEMPORAL_ADDRESS` | Yes | `localhost:7233` | Temporal server address |
| `TEMPORAL_NAMESPACE` | No | `default` | Temporal namespace |
| `MBERNIER_API_URL` | Yes | - | MCP API base URL |
| `MBERNIER_API_KEY` | Yes | - | MCP API authentication key |
| `PLAN_OUTPUT_DIR` | No | `plans/packages` | Directory for plan files |
| `PLAN_GIT_BRANCH_PREFIX` | No | `feature/` | Git branch prefix for plans |

### Workflow Configuration

**Service Workflow:**
- Workflow ID: `plan-writer-service`
- Task Queue: `plan-writer-service`
- Continue-as-new threshold: 37,500 events (3/4 of Temporal limit)

**Scanner Workflow:**
- Workflow ID: `mcp-scanner`
- Schedule: `@hourly`
- Task Queue: `plan-writer-service`

**Package Workflow:**
- Workflow ID: `plan-writer-package-{packageId}`
- Task Queue: `plan-writer-service`
- Fibonacci backoff: 1m → 1m → 2m → 3m → 5m → 8m → 13m → 21m → 30m (cap)

## Monitoring

### Temporal UI

View workflows, activities, and history:
```
http://localhost:8233
```

### Service Metrics

The service tracks:
- Total requests received
- Plans completed
- Plans failed
- Child workflows spawned
- History length (for continue-as-new monitoring)

Check metrics via Temporal UI or workflow query handlers.

## Troubleshooting

### Worker won't start

**Error:** `Connection refused`
```
✓ Check Temporal server is running: http://localhost:8233
✓ Verify TEMPORAL_ADDRESS in .env
```

**Error:** `Cannot find module`
```
✓ Run: npm install
✓ Run: npm run build
```

### Service workflow fails to start

**Error:** `Workflow already running`
```
The service workflow uses a stable ID. Terminate the existing workflow first:
- Temporal UI → Workflows → plan-writer-service → Terminate
```

### MCP API errors

**Error:** `MCP API error: 401`
```
✓ Check MBERNIER_API_KEY is correct
✓ Verify API key has necessary permissions
```

**Error:** `MCP API error: 404`
```
✓ Verify MBERNIER_API_URL is correct
✓ Check MCP API is accessible
```

### Plans not being generated

**Check service is running:**
```bash
npm run client:status
```

**Check worker is running:**
```
Worker should show "Waiting for workflows..." message
```

**Manually trigger scan:**
```bash
npm run client:trigger-scan
```

**Check Temporal UI:**
```
http://localhost:8233 → Workflows
Look for plan-writer-package-* workflows
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Specific test file
npm test -- src/workflows/__tests__/plan-writer-service.workflow.test.ts
```

### Adding New Activities

1. Add activity function to `src/activities/*.activities.ts`
2. Export activity from file
3. Activity will be auto-registered in worker (imported via spread operator)
4. Add tests in `src/activities/__tests__/*.test.ts`

### Adding New Workflows

1. Create workflow in `src/workflows/*.workflow.ts`
2. Export workflow from `src/workflows.ts`
3. Workflow will be auto-loaded by worker (via workflowsPath)
4. Add tests in `src/workflows/__tests__/*.test.ts`

### Code Organization

```
src/
├── activities/           # Temporal activities (external I/O)
│   ├── plan.activities.ts       # Plan writing activities
│   ├── mcp.activities.ts        # MCP API activities
│   └── __tests__/              # Activity tests
├── workflows/            # Temporal workflows (orchestration)
│   ├── plan-writer-service.workflow.ts   # Main coordinator
│   ├── mcp-scanner.workflow.ts          # Hourly scanner
│   ├── plan-writer-package.workflow.ts  # Per-package executor
│   └── __tests__/              # Workflow tests
├── types/                # TypeScript type definitions
├── utils/                # Utility functions
│   └── backoff.ts              # Fibonacci backoff generator
├── worker.ts             # Temporal worker (executes workflows)
├── client.ts             # Temporal client (starts workflows)
└── workflows.ts          # Workflow exports (for worker)
```

## Production Deployment

### Scaling Workers

Run multiple workers for higher throughput:

```bash
# Terminal 1
npm run worker

# Terminal 2
npm run worker

# Terminal 3
npm run worker
```

Workers will automatically distribute work via Temporal task queue.

### Health Checks

Monitor worker health:
- Worker logs should show "Waiting for workflows..."
- Temporal UI shows connected workers
- No error messages in logs

### Continue-as-New Monitoring

Service workflow automatically continues-as-new at 37,500 events. Monitor:
- Check history length via `npm run client:status`
- Watch for continue-as-new logs in worker
- Verify child workflows reconnect after continuation

### Backup & Recovery

The service is stateless - all state is in Temporal. To recover:
1. Ensure Temporal server is backed up
2. Start worker
3. Workflows resume automatically

## Architecture Details

See design documents:
- [Plan Writer Service Enhancements Design](../../../docs/plans/2025-11-16-plan-writer-service-enhancements-design.md)
- [Implementation Plan](../../../docs/plans/2025-11-16-plan-writer-service-enhancements.md)

## License

Proprietary - Internal use only
