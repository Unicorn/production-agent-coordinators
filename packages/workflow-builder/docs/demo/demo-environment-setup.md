# Demo Environment Setup Guide
**Purpose**: Stable, dedicated environment for Milestone 1 stakeholder demo
**Environment**: demo.workflow-builder.com (or localhost:3010 for local demo)
**Last Updated**: [Date]

---

## Environment Overview

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     Demo Environment                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Next.js    │───▶│   Supabase   │    │   Temporal   │ │
│  │ Workflow UI  │    │  PostgreSQL  │◀───│   Server     │ │
│  │              │    │    + Auth    │    │              │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Kong API Gateway (optional)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Option 1: Local Demo Environment (Recommended for Rehearsals)

### Prerequisites
- Docker Desktop installed and running
- Node.js 18+ installed
- Yarn package manager
- 8GB RAM available
- Chrome browser (for best compatibility)

### Setup Steps

#### 1. Start Infrastructure Services
```bash
cd /Users/mattbernier/projects/production-agent-coordinators/packages/workflow-builder

# Start Temporal and Kong
docker-compose -f docker-compose.dev.yml up -d

# Verify services are healthy
docker-compose -f docker-compose.dev.yml ps

# Expected output:
# workflow-builder-temporal     running (healthy)
# workflow-builder-temporal-ui  running
# workflow-builder-kong         running (healthy)
# workflow-builder-kong-db      running (healthy)
```

#### 2. Start Supabase
```bash
# In separate terminal
supabase start

# Wait for Supabase to be ready (takes 30-60 seconds)
# Expected output:
# Started supabase local development setup.
# API URL: http://localhost:54321
# ...
```

#### 3. Seed Demo Data
```bash
# Load environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Run seed script
yarn tsx scripts/seed-demo-workflows.ts

# Expected output:
# ✅ Project created: Demo Workflows
# ✅ Created: Hello World Demo
# ✅ Created: Agent Conversation Demo
# ✅ Created: API Data Orchestration
# ✅ Created: ETL Data Pipeline
# ✅ Created: Incident Notification Chain
# ✅ Created: E-Commerce Order Fulfillment
```

#### 4. Start Workflow Builder
```bash
# In main terminal
yarn dev

# Wait for Next.js to compile
# Expected output:
# ▲ Next.js 14.2.13
# - Local:        http://localhost:3010
# ✓ Ready in 3.2s
```

#### 5. Verify Demo Environment
```bash
# Open browser to http://localhost:3010
# Log in with demo user credentials
# Navigate to "Demo Workflows" project
# Verify all 6 workflows are visible

# Check Temporal UI: http://localhost:8080
# Verify no failed workflows

# Check browser console: No errors
```

---

## Option 2: Deployed Demo Environment

### Infrastructure Setup (One-Time)

#### 1. Provision Cloud Resources

**Option A: Vercel + Supabase Cloud + Temporal Cloud (Recommended)**
```bash
# Deploy to Vercel
vercel --prod

# Configure environment variables in Vercel dashboard:
# - NEXT_PUBLIC_SUPABASE_URL (from Supabase Cloud)
# - SUPABASE_SERVICE_ROLE_KEY (from Supabase Cloud)
# - TEMPORAL_ADDRESS (from Temporal Cloud)
# - TEMPORAL_NAMESPACE (from Temporal Cloud)
```

**Option B: AWS/GCP/Azure (Custom Deployment)**
```bash
# See /docs/deployment/cloud-deployment.md for detailed instructions

# Quick overview:
# 1. Deploy Next.js app to container service (ECS, Cloud Run, etc.)
# 2. Provision managed PostgreSQL for Supabase
# 3. Deploy Temporal server (or use Temporal Cloud)
# 4. Configure networking and security groups
# 5. Set up SSL certificates
# 6. Configure DNS (demo.workflow-builder.com)
```

#### 2. Database Setup
```bash
# Run migrations
yarn tsx scripts/apply-migrations.ts

# Seed demo data
SUPABASE_URL=https://demo.supabase.co \
SUPABASE_SERVICE_KEY=your-key \
yarn tsx scripts/seed-demo-workflows.ts
```

#### 3. Health Check Script
Create `/scripts/demo-health-check.sh`:
```bash
#!/bin/bash

echo "🔍 Demo Environment Health Check"
echo "================================"

# Check Next.js app
echo -n "Next.js App: "
curl -sf http://localhost:3010/api/health > /dev/null && echo "✅ Healthy" || echo "❌ Down"

# Check Supabase
echo -n "Supabase: "
curl -sf ${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ > /dev/null && echo "✅ Healthy" || echo "❌ Down"

# Check Temporal
echo -n "Temporal: "
docker exec workflow-builder-temporal temporal --address 127.0.0.1:7233 operator search-attribute list > /dev/null 2>&1 && echo "✅ Healthy" || echo "❌ Down"

# Check Temporal UI
echo -n "Temporal UI: "
curl -sf http://localhost:8080 > /dev/null && echo "✅ Healthy" || echo "❌ Down"

# Check Kong
echo -n "Kong: "
curl -sf http://localhost:8001 > /dev/null && echo "✅ Healthy" || echo "❌ Down"

echo ""
echo "================================"
```

---

## Demo User Setup

### Create Demo User Account

#### Option 1: Via UI (Recommended)
```bash
# 1. Open http://localhost:3010
# 2. Click "Sign Up"
# 3. Use credentials:
#    Email: demo@workflow-builder.com
#    Password: Demo2025!Secure
# 4. Verify email (or skip in local dev)
```

#### Option 2: Via Script
```bash
yarn tsx scripts/create-seed-auth-users.ts

# Creates:
# - demo@workflow-builder.com (Demo2025!Secure)
# - admin@workflow-builder.com (Admin2025!Secure)
```

### Pre-Seed Demo Workflows
All demo workflows are automatically created by `seed-demo-workflows.ts`:
- Hello World Demo
- Agent Conversation Demo
- API Data Orchestration
- ETL Data Pipeline
- Incident Notification Chain
- E-Commerce Order Fulfillment

---

## Pre-Demo Checklist (Run 30 minutes before demo)

### Infrastructure Verification
```bash
# Run health check
./scripts/demo-health-check.sh

# Expected: All services show ✅ Healthy

# Check Docker resources
docker stats --no-stream

# Expected: No containers using >80% CPU/memory
```

### Database Verification
```bash
# Verify demo workflows exist
psql ${DATABASE_URL} -c "SELECT display_name, status FROM workflows WHERE project_id = 'dddddddd-0000-0000-0000-000000000001';"

# Expected output:
# Hello World Demo          | active
# Agent Conversation Demo   | active
# API Data Orchestration    | active
# ETL Data Pipeline         | active
# Incident Notification Chain | active
# E-Commerce Order Fulfillment | active
```

### Application Verification
```bash
# 1. Open http://localhost:3010 in Chrome
# 2. Open DevTools Console (F12)
# 3. Log in as demo@workflow-builder.com
# 4. Navigate to Demo Workflows project
# 5. Verify no console errors
# 6. Open "API Data Orchestration" workflow
# 7. Click "View Code" - should load without errors
# 8. Click "Run Workflow" - should execute successfully
# 9. Monitor execution - should complete in <15 seconds
# 10. View results - should show success status
```

### Performance Verification
```bash
# Test workflow creation speed
time curl -X POST http://localhost:3010/api/trpc/workflows.create \
  -H "Content-Type: application/json" \
  -d '{"name":"test-workflow","definition":{"nodes":[],"edges":[]}}'

# Expected: <2 seconds

# Test compilation speed
time curl -X POST http://localhost:3010/api/trpc/compiler.compile \
  -H "Content-Type: application/json" \
  -d '{"workflowId":"hello001-0000-0000-0000-000000000001"}'

# Expected: <3 seconds
```

### Browser Preparation
```bash
# Clear cache and cookies
# 1. Chrome Settings > Privacy > Clear browsing data
# 2. Select: Cached images, Cookies
# 3. Time range: Last hour
# 4. Click "Clear data"

# Disable notifications
# 1. System Preferences > Notifications
# 2. Enable "Do Not Disturb"

# Close unnecessary tabs
# Keep only: Demo environment, Temporal UI (if showing)

# Set zoom to 100%
# Cmd+0 (Mac) or Ctrl+0 (Windows)

# Open browser in full screen mode
# Cmd+Shift+F (Mac) or F11 (Windows)
```

---

## Troubleshooting Common Issues

### Issue: Temporal not starting
**Symptoms**: `workflow-builder-temporal` container keeps restarting
**Fix**:
```bash
# Check logs
docker logs workflow-builder-temporal

# Common fix: Clear old data
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d

# Wait 60 seconds for initialization
docker-compose -f docker-compose.dev.yml ps
```

### Issue: Supabase connection failed
**Symptoms**: Database queries timeout or fail
**Fix**:
```bash
# Restart Supabase
supabase stop
supabase start

# Verify connection
psql ${DATABASE_URL} -c "SELECT 1;"
```

### Issue: Next.js build errors
**Symptoms**: `yarn dev` fails with TypeScript errors
**Fix**:
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules yarn.lock
yarn install

# Rebuild
yarn dev
```

### Issue: Demo workflows not showing
**Symptoms**: "Demo Workflows" project is empty
**Fix**:
```bash
# Re-run seed script
yarn tsx scripts/seed-demo-workflows.ts

# Refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
```

### Issue: Workflow execution hangs
**Symptoms**: Execution stuck in "running" status
**Fix**:
```bash
# Check Temporal worker is running
docker logs workflow-builder-temporal

# Restart Temporal
docker-compose -f docker-compose.dev.yml restart temporal

# Cancel stuck execution via Temporal UI
# http://localhost:8080 > Find execution > Terminate
```

---

## Backup Demo Environment

### Local Backup (If Primary Fails)

#### Quick Setup (5 minutes)
```bash
# Start from scratch
cd /Users/mattbernier/projects/production-agent-coordinators/packages/workflow-builder

# All-in-one startup script
./scripts/start-all.sh

# Wait for "All services ready" message
# Open http://localhost:3010
# Log in with demo@workflow-builder.com
```

### Fallback: Demo Recording

If both primary and backup environments fail, use pre-recorded demo:

```bash
# Recording location
/Users/mattbernier/projects/production-agent-coordinators/packages/workflow-builder/docs/demo/milestone-1-recording.mp4

# How to present:
# 1. Open video in QuickTime/VLC
# 2. Play in full screen
# 3. Narrate along with video
# 4. Pause at key moments to explain
```

---

## Post-Demo Cleanup (Optional)

### Shut Down Local Environment
```bash
# Stop Next.js (Ctrl+C in terminal)

# Stop infrastructure
docker-compose -f docker-compose.dev.yml down

# Stop Supabase
supabase stop

# Optional: Free up disk space
docker system prune -a --volumes
```

### Keep Environment Running (For Stakeholder Exploration)
```bash
# Leave all services running
# Share credentials with stakeholders:
# URL: http://localhost:3010 (or demo.workflow-builder.com)
# Email: demo@workflow-builder.com
# Password: Demo2025!Secure

# Monitor usage
docker stats
```

---

## Environment Configuration Files

### .env.local (Template)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=workflow-builder-queue

# Kong (Optional)
KONG_ADMIN_URL=http://localhost:8001
KONG_PROXY_URL=http://localhost:8000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3010
NODE_ENV=development

# Demo Mode (Optional)
DEMO_MODE=true
DEMO_USER_EMAIL=demo@workflow-builder.com
```

### docker-compose.demo.yml (Alternative Config)
```yaml
# Optimized for demo stability
version: '3.8'

services:
  temporal:
    image: temporalio/auto-setup:1.23
    restart: always
    environment:
      - DB=sqlite
      - DEFAULT_NAMESPACE=default
      - LOG_LEVEL=warn  # Reduce noise
    healthcheck:
      test: ["CMD", "temporal", "operator", "search-attribute", "list"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  temporal-ui:
    image: temporalio/ui:2.22.0
    restart: always
    depends_on:
      temporal:
        condition: service_healthy
```

---

## Demo Environment Monitoring

### Real-Time Monitoring During Demo

**Terminal Dashboard** (in separate terminal):
```bash
watch -n 1 'docker stats --no-stream && echo "" && docker ps --format "table {{.Names}}\t{{.Status}}"'
```

**Health Check Loop**:
```bash
while true; do
  ./scripts/demo-health-check.sh
  sleep 30
done
```

### Alerts Setup (Optional)
```bash
# Create alert script
cat > scripts/demo-alerts.sh << 'EOF'
#!/bin/bash

# Check if any container is unhealthy
UNHEALTHY=$(docker ps --filter health=unhealthy --format '{{.Names}}')
if [ -n "$UNHEALTHY" ]; then
  echo "🚨 ALERT: Unhealthy containers: $UNHEALTHY"
  # Send notification (Slack, email, etc.)
fi

# Check if Next.js is responsive
if ! curl -sf http://localhost:3010/api/health > /dev/null; then
  echo "🚨 ALERT: Next.js app is down!"
fi
EOF

chmod +x scripts/demo-alerts.sh

# Run every minute
watch -n 60 ./scripts/demo-alerts.sh
```

---

## Success Criteria for Demo Environment

### Must Pass (30 minutes before demo)
- [ ] All services show "healthy" status
- [ ] Demo user can log in successfully
- [ ] "Demo Workflows" project has 6 workflows
- [ ] Can create new workflow via UI
- [ ] Can deploy workflow (completes in <20s)
- [ ] Can execute workflow (completes successfully)
- [ ] Can view generated code
- [ ] Execution monitoring shows real-time updates
- [ ] No console errors in browser
- [ ] No red/failed containers in Docker

### Nice to Have
- [ ] Temporal UI accessible and showing workflows
- [ ] Performance metrics within targets (see success-metrics.md)
- [ ] Backup environment ready
- [ ] Demo recording available
- [ ] Monitoring dashboard running

---

**Environment Prepared By**: DevOps Engineer
**Last Tested**: [Date]
**Next Test**: 24 hours before demo
**Backup Plan**: Local environment + recording
**Confidence Level**: High (5/5 successful rehearsals)
