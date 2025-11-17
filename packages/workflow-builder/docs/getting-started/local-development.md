# Local Development Setup

Complete guide for setting up a local development environment with Supabase and Temporal.

## Overview

Local development uses:
- **Local Supabase** - Docker-based PostgreSQL + Auth
- **Temporal Dev Server** - Local Temporal instance
- **Next.js Dev Server** - Hot-reload development

## Prerequisites

- Docker Desktop installed and running
- Node.js >= 18
- Yarn >= 1.22

## Step-by-Step Setup

### 1. Start Local Supabase

```bash
cd packages/workflow-builder
supabase start
```

This will:
- Pull Docker images (first time only, ~2-3 minutes)
- Start all Supabase services
- Output connection details

**Save the output values** - you'll need them for `.env.local`:

```
API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
anon key: eyJhbGc...
service_role key: eyJhbGc...
```

### 2. Configure Environment Variables

Create/update `.env.local`:

```bash
# Local Supabase
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>

# Local Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3010
NODE_ENV=development
```

### 3. Verify Migrations

Migrations are automatically applied when Supabase starts. Verify:

```bash
supabase migration list
```

Should show all migrations applied.

### 4. Create Test User

#### Via Supabase Studio (Recommended):

1. Open http://localhost:54323
2. Go to "Authentication" → "Users"
3. Click "Add user"
4. Email: `test@example.com`
5. Password: `testpassword123`
6. Click "Create user"

#### Via SQL:

```bash
supabase db execute --sql "
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  crypt('testpassword123', gen_salt('bf')),
  NOW(), NOW(), NOW()
);
"
```

### 5. Start Development Server

```bash
cd packages/workflow-builder
yarn dev
```

Server should start on http://localhost:3010

### 6. Start Temporal (Optional, for Execution)

In a separate terminal:

```bash
temporal server start-dev
```

This starts:
- Temporal server on `localhost:7233`
- Temporal Web UI on http://localhost:8233

### 7. Test Login

1. Visit http://localhost:3010
2. Sign in with: `test@example.com` / `testpassword123`
3. Should redirect to dashboard

## Development Workflow

### Daily Startup

```bash
# Terminal 1: Start Supabase
cd packages/workflow-builder
supabase start

# Terminal 2: Start Next.js
cd packages/workflow-builder
yarn dev

# Terminal 3: Start Temporal (if testing execution)
temporal server start-dev
```

### Making Changes

- **Frontend**: Changes auto-reload via Next.js hot reload
- **Backend**: Restart dev server after tRPC/router changes
- **Database**: Run new migrations: `npx supabase db push`
- **Types**: Regenerate after schema changes: `yarn gen:types`

### Viewing Data

- **Supabase Studio**: http://localhost:54323
- **Temporal Web UI**: http://localhost:8233
- **Application**: http://localhost:3010

## Useful Commands

### Supabase Management

```bash
# Check status
supabase status

# View logs
supabase logs

# Stop Supabase
supabase stop

# Reset database (⚠️ deletes all data)
supabase db reset

# Open Studio
open http://localhost:54323
```

### Database Operations

```bash
# Run migrations
npx supabase db push

# List migrations
npx supabase migration list

# Execute SQL
supabase db execute --sql "SELECT * FROM users;"
```

### Type Generation

```bash
# Generate types after schema changes
yarn gen:types
```

## Troubleshooting

### Supabase Issues

**"Cannot connect to Docker daemon"**
- Start Docker Desktop
- Wait for it to fully start
- Verify: `docker ps` works

**"Port already in use"**
- Check: `lsof -i:54321`
- Stop existing instance: `supabase stop`
- Or change ports in `supabase/config.toml`

**"Migrations not applied"**
- Check: `supabase migration list`
- Manually apply: `npx supabase db push`
- Or reset: `supabase db reset` (⚠️ deletes data)

### Next.js Issues

**"Invalid API key"**
- Verify `.env.local` has correct values from `supabase start`
- Restart dev server after changing `.env.local`

**"Cannot connect to Supabase"**
- Check Supabase is running: `supabase status`
- Verify `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`

### Temporal Issues

**"Cannot connect to Temporal"**
- Start Temporal: `temporal server start-dev`
- Verify it's running: Check http://localhost:8233
- Check `TEMPORAL_ADDRESS` in `.env.local`

## Development Tips

### Hot Reload

Next.js automatically reloads on file changes. No need to restart unless:
- Changing environment variables
- Modifying tRPC setup
- Changing database schema

### Debugging

**tRPC Errors:**
- Check browser console for error messages
- Add logging in `src/server/api/trpc.ts`

**Database Queries:**
- Use Supabase Studio SQL editor
- Check RLS policies if queries return empty

**Workflow Execution:**
- Check Temporal Web UI for execution status
- View worker logs in terminal
- Check `workflow_executions` table in Supabase

### Testing

**Manual Testing:**
- Create workflows in UI
- Test compilation
- Execute workflows (requires Temporal)

**E2E Testing:**
- See [Testing Guide](../development/testing.md)
- Run Playwright tests: `yarn test:e2e`

## Switching Between Local and Cloud

### Use Local Supabase:
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
```

### Use Cloud Supabase:
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

Just restart Next.js server after changing!

## Next Steps

After local setup is working:

1. **[Quick Tutorial](quick-tutorial.md)** - Build your first workflow
2. **[User Guide](../user-guide/README.md)** - Learn system features
3. **[Development Guide](../development/README.md)** - Contribute to the codebase

## Related Documentation

- [Installation](installation.md) - Initial setup
- [Environment Variables](../reference/environment-variables.md) - Complete env var reference
- [Troubleshooting](../troubleshooting.md) - Common issues

