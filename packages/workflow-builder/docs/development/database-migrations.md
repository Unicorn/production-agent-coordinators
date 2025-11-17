# Database Migrations

Creating and managing database migrations.

## Overview

Migrations are SQL files in `supabase/migrations/` that modify the database schema. They are applied sequentially in alphabetical order.

## Creating a Migration

### 1. Create Migration File

```bash
# Format: YYYYMMDDHHMMSS_description.sql
touch supabase/migrations/20251118000001_add_new_feature.sql
```

### 2. Write Migration SQL

```sql
-- Migration: Add new feature
-- Created: 2025-11-18

BEGIN;

-- Add new table
CREATE TABLE IF NOT EXISTS public.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add RLS
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own records"
  ON public.new_table FOR SELECT
  USING (auth.uid() IN (
    SELECT auth_user_id FROM public.users WHERE id = created_by
  ));

COMMIT;
```

### 3. Apply Migration

```bash
# Local Supabase
npx supabase db push

# Cloud Supabase
npx supabase db push --linked
```

## Migration Best Practices

### 1. Use Transactions

Wrap migrations in `BEGIN;` and `COMMIT;`:

```sql
BEGIN;
-- Migration code
COMMIT;
```

### 2. Idempotent Migrations

Use `IF NOT EXISTS` and `IF EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
DROP TABLE IF EXISTS ...
```

### 3. Add RLS Policies

All new tables need RLS:

```sql
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Policy name"
  ON public.table_name FOR SELECT
  USING (/* policy condition */);
```

### 4. Add Indexes

Index foreign keys and frequently queried columns:

```sql
CREATE INDEX idx_table_name_column ON public.table_name(column_name);
```

### 5. Update Types

After migration, regenerate types:

```bash
yarn gen:types
```

## Migration Naming

Format: `YYYYMMDDHHMMSS_description.sql`

Examples:
- `20251114000001_initial_schema.sql`
- `20251117000001_phase2_temporal_integration.sql`

## Running Migrations

### Local Development

```bash
# Apply all pending migrations
npx supabase db push

# Reset database (⚠️ deletes all data)
npx supabase db reset
```

### Production

```bash
# Link to project
npx supabase link --project-ref YOUR_PROJECT_ID

# Push migrations
npx supabase db push
```

## Verifying Migrations

```sql
-- Check migration status
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;

-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

## Related Documentation

- [Database Schema](../architecture/database-schema.md) - Schema structure
- [Contributing](contributing.md) - Code standards

