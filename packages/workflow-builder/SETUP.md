# Workflow Builder Setup Guide

Complete setup guide for running the Workflow Builder locally.

## Prerequisites

- Node.js >= 18
- Yarn >= 1.22
- Supabase account (or local Supabase CLI)
- Temporal dev server

## Step-by-Step Setup

### 1. Install Dependencies

From the monorepo root:

```bash
cd /Users/mattbernier/projects/production-agent-coordinators
yarn install
```

### 2. Set Up Supabase

#### Option A: Supabase Cloud (Recommended for POC)

1. Go to https://supabase.com and create a new project
2. Wait for project to initialize (~2 minutes)
3. Go to Project Settings → API
4. Copy your project URL and anon key

#### Option B: Local Supabase

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase
npx supabase start

# Note the API URL and anon key from output
```

### 3. Configure Environment

```bash
cd packages/workflow-builder
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
SUPABASE_PROJECT_ID=xxxxx

TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

NEXT_PUBLIC_APP_URL=http://localhost:3010
```

### 4. Run Database Migrations

#### For Supabase Cloud:

```bash
cd packages/workflow-builder

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_ID

# Push migrations
npx supabase db push
```

#### For Local Supabase:

```bash
cd packages/workflow-builder
npx supabase db push
```

### 5. Start Development Server

```bash
cd packages/workflow-builder
yarn dev
```

Visit: http://localhost:3010

### 6. Start Temporal (Separate Terminal)

```bash
# From monorepo root
yarn infra:up

# Or use Temporal CLI directly
temporal server start-dev
```

Temporal UI: http://localhost:8233

## First-Time Usage

### 1. Create Account

1. Visit http://localhost:3010
2. Click "Sign Up"
3. Enter email, password, display name
4. You'll be auto-signed in and redirected to dashboard

### 2. Create Your First Component

1. Go to Components → New Component
2. Fill in:
   - Name: `myFirstActivity`
   - Display Name: `My First Activity`
   - Component Type: `activity`
   - Version: `1.0.0`
   - Capabilities: `test-capability`
3. Click "Create Component"

### 3. Create Your First Workflow

1. Go to Workflows → New Workflow
2. Fill in:
   - Name: `test-workflow`
   - Display Name: `Test Workflow`
   - Task Queue: `default-queue`
3. Click "Create & Edit"
4. You'll be taken to the visual editor

### 4. Design the Workflow

1. Drag your component from the left palette onto the canvas
2. Click the node to configure it in the right panel
3. Changes auto-save every 2 seconds
4. Click "Save" to manually save
5. Click "Deploy" when ready

## Troubleshooting

### "Migration failed" error

**Problem**: Database tables already exist

**Solution**: 
```bash
# Reset database (WARNING: deletes all data)
npx supabase db reset

# Then push again
npx supabase db push
```

### "Task queue not found" error

**Problem**: Default task queue wasn't created

**Solution**:
1. Sign in as first user (triggers queue creation)
2. Or manually insert via Supabase dashboard:

```sql
INSERT INTO task_queues (name, description, created_by, is_system_queue)
VALUES (
  'default-queue',
  'Default task queue',
  (SELECT id FROM users LIMIT 1),
  TRUE
);
```

### Port 3010 already in use

**Solution**:
```bash
# Kill process on port 3010
lsof -ti:3010 | xargs kill -9

# Or change port in package.json scripts
```

### React Hook errors

**Problem**: Multiple React instances

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules
yarn install
```

### Tamagui build errors

**Problem**: Missing Tamagui configuration

**Solution**: Verify `next.config.js` has Tamagui transpilation:
```javascript
transpilePackages: [
  'tamagui',
  '@tamagui/core',
  // ... other tamagui packages
]
```

## Database Management

### View Data in Supabase

1. Go to your Supabase project dashboard
2. Click "Table Editor"
3. Browse: `users`, `components`, `workflows`, etc.

### Run SQL Queries

```sql
-- View all components
SELECT c.*, ct.name as type
FROM components c
JOIN component_types ct ON c.component_type_id = ct.id;

-- View all workflows with status
SELECT w.*, ws.name as status
FROM workflows w
JOIN workflow_statuses ws ON w.status_id = ws.id;
```

### Reset Database

```bash
# WARNING: Deletes all data
npx supabase db reset
npx supabase db push
```

## Development Tips

### Hot Reload

Next.js dev server watches for changes. Save any file to trigger reload.

### Type Generation

After schema changes, regenerate types:

```bash
cd packages/workflow-builder
yarn gen:types
```

### Debugging tRPC

Add logging in `src/server/api/trpc.ts`:

```typescript
onError: ({ path, error }) => {
  console.error(`tRPC failed on ${path}:`, error);
}
```

### Debugging Supabase

Check RLS policies if queries return empty:

```sql
-- Temporarily disable RLS for debugging
ALTER TABLE components DISABLE ROW LEVEL SECURITY;

-- Re-enable when done
ALTER TABLE components ENABLE ROW LEVEL SECURITY;
```

## Next Steps

After POC is working:

1. **Phase 4**: Worker generation and Temporal integration
2. **Phase 5**: Workflow execution monitoring
3. Deploy to production (Vercel + Supabase Cloud)

## Support

- **Design Doc**: `../../docs/plans/2025-11-14-workflow-builder-system-design.md`
- **AGENTINFO**: `AGENTINFO.md`
- **Component Standards**: `../../docs/standards/component-discoverability-and-reusability.md`

