# Local Supabase Setup Guide

**Goal**: Run Supabase locally with Docker for development

---

## Step 1: Start Docker Desktop

Docker needs to be running for local Supabase.

### Check if Docker is running:
```bash
docker ps
```

### If not running:
1. Open Docker Desktop application
2. Wait for it to start (icon in menu bar will be solid)
3. Verify: `docker ps` should return without error

---

## Step 2: Start Local Supabase

Once Docker is running:

```bash
cd /Users/mattbernier/projects/production-agent-coordinators/packages/workflow-builder
supabase start
```

This will:
- Pull Docker images (first time only, ~2-3 minutes)
- Start Postgres, Auth, Storage, Realtime, etc.
- Create a local database
- Output connection details

**Expected Output**:
```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ SAVE THESE VALUES!** You'll need them for `.env.local`

---

## Step 3: Apply All Migrations

Migrations are automatically applied when you start Supabase! All files in `supabase/migrations/` are run in order.

This includes:
- ✅ `20251114000001_initial_schema.sql`
- ✅ `20251114000002_seed_default_task_queue.sql`
- ✅ `20251114000003_fix_user_trigger.sql`
- ✅ `20251117000001_phase2_temporal_integration.sql`
- ✅ `20251117000002_seed_build_workflow_components.sql`

### Verify migrations:
```bash
supabase migration list
```

Should show all migrations applied.

---

## Step 4: Update Environment Variables

Create/update `.env.local` with the local Supabase values:

```bash
# Local Supabase (from `supabase start` output)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start output>

# Local Database (for direct access)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Temporal (unchanged)
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# App
NEXT_PUBLIC_APP_URL=http://localhost:3010
NODE_ENV=development
```

---

## Step 5: Create Test User

Local Supabase starts with no users. Create one:

### Via Supabase Studio (Easy):
1. Open: http://localhost:54323 (Studio)
2. Go to "Authentication" → "Users"
3. Click "Add user"
4. Email: `test@example.com`
5. Password: `testpassword123`
6. Click "Create user"

### Via SQL (Alternative):
```bash
supabase db execute --sql "
INSERT INTO auth.users (
  id, 
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'test@example.com',
  crypt('testpassword123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);
"
```

---

## Step 6: Restart Next.js Server

```bash
# Stop current server (Ctrl+C)
# Restart with new env vars
yarn dev
```

---

## Step 7: Test Login

1. Go to http://localhost:3010
2. Sign in with: `test@example.com` / `testpassword123`
3. Should work!

---

## Useful Commands

### Check Status
```bash
supabase status
```

### Stop Local Supabase
```bash
supabase stop
```

### Reset Database (⚠️ Deletes all data)
```bash
supabase db reset
```

### View Logs
```bash
supabase logs
```

### Open Studio (Database UI)
```bash
open http://localhost:54323
```

---

## Troubleshooting

### "Cannot connect to Docker daemon"
- Start Docker Desktop
- Wait for it to fully start
- Try again

### "Port already in use"
- Another Supabase instance might be running
- Run: `supabase stop`
- Or check what's using the port: `lsof -i:54321`

### Migrations not applied
- Check: `supabase migration list`
- Manually apply: `supabase db reset` (⚠️ resets DB)

### Can't create user
- Make sure migrations ran (creates `users` table and trigger)
- Check: `supabase status` (all services should be "healthy")

---

## Benefits of Local Supabase

1. **Full control** - Reset/rebuild anytime
2. **Fast development** - No network latency
3. **Offline work** - No internet required
4. **Easy testing** - Destructive tests OK
5. **Seeded data** - Start fresh anytime
6. **Free** - No cloud costs

---

## Switching Between Local & Cloud

### Use Local:
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key>
```

### Use Cloud:
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cloud anon key>
```

Just restart Next.js server after changing!

---

## Next Steps After Setup

1. ✅ Local Supabase running
2. ✅ Migrations applied
3. ✅ Test user created
4. ✅ Next.js connected to local Supabase
5. 🚀 **Ready to test Phase 2!**

Then:
- Start Temporal: `temporal server start-dev`
- Test workflow building
- Test worker startup
- Test execution

**Let's go! 🎉**

