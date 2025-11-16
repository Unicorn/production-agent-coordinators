# Plan Writer Service - Quick Start

Get the Plan Writer Service running in 5 minutes.

## Prerequisites

✅ Temporal Server running (http://localhost:8233)
✅ Node.js 18+ installed
✅ MCP API credentials

## Step 1: Start Temporal Server

If you don't have Temporal running:

```bash
# Option 1: Docker (recommended)
docker run --rm -p 7233:7233 -p 8233:8233 temporalio/auto-setup:latest

# Option 2: Temporal CLI
temporal server start-dev
```

Verify: http://localhost:8233 should show Temporal UI

## Step 2: Configure Environment

```bash
cd packages/agents/plan-writer-service

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

Required configuration:
```bash
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
MBERNIER_API_URL=https://api.mbernier.com
MBERNIER_API_KEY=your-actual-api-key
```

## Step 3: Install & Build

```bash
# From project root
npm install

# Build the package
cd packages/agents/plan-writer-service
npm run build
```

## Step 4: Start Worker

```bash
# In one terminal
npm run worker
```

You should see:
```
╔════════════════════════════════════════════════════════════╗
║   Temporal Worker - Plan Writer Service                   ║
╚════════════════════════════════════════════════════════════╝

🔌 Connecting to Temporal server...
   ✅ Connected to Temporal at: localhost:7233

📦 Creating worker...
🚀 Worker is ready!
   Waiting for workflows...
```

## Step 5: Start Service

```bash
# In another terminal
cd packages/agents/plan-writer-service
npm run client:start-service
```

Output:
```
🚀 Starting Plan Writer Service workflow...
✅ Service started with ID: plan-writer-service
📊 View in Temporal UI: http://localhost:8233
```

## Step 6: Start Scanner (Optional)

```bash
npm run client:start-scanner
```

This starts the hourly cron that automatically discovers packages needing plans.

## Step 7: Test It

### Option A: Trigger Manual Scan

```bash
npm run client:trigger-scan
```

This scans MCP immediately for packages without plans.

### Option B: Request Specific Package

```bash
npm run client -- request-plan @bernierllc/my-package "Testing the service" high
```

### Option C: Check Status

```bash
npm run client:status
```

## What Happens Next

1. **Scanner** discovers packages without plans (every hour, or on-demand)
2. **Service** receives signals and queues packages
3. **Package workflows** spawn for each package
4. **Plans** are generated, committed, and registered with MCP

## Monitor Progress

**Temporal UI:** http://localhost:8233
- View running workflows
- Check workflow history
- Monitor activity execution

**Worker Logs:**
- Activity execution logs
- Workflow state changes
- Error messages

## Common Issues

### "Connection refused"
→ Temporal server not running. Start it with Docker or Temporal CLI.

### "MCP API error: 401"
→ Check MBERNIER_API_KEY in .env

### "Workflow already running"
→ Service uses stable ID. Terminate existing via Temporal UI first.

## Development Mode

Auto-restart worker on code changes:

```bash
npm run worker:dev
```

## Next Steps

- Review [README.md](packages/agents/plan-writer-service/README.md) for full documentation
- Check [Design Doc](docs/plans/2025-11-16-plan-writer-service-enhancements-design.md) for architecture
- View Temporal UI to monitor workflows

## Production Deployment

For production:
1. Configure Temporal Cloud or self-hosted cluster
2. Update TEMPORAL_ADDRESS in .env
3. Run multiple workers for redundancy
4. Set up monitoring and alerting
5. Configure continue-as-new thresholds if needed

---

**Need Help?**
- Temporal Docs: https://docs.temporal.io
- Check worker logs for errors
- Review Temporal UI workflow history
