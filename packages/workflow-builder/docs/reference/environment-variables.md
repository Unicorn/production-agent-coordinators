# Environment Variables

Complete reference for all environment variables.

## Required Variables

### Supabase

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_PROJECT_ID=xxxxx
```

**Description**:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key (safe to expose)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (server-side only)
- `SUPABASE_PROJECT_ID`: Supabase project ID

### Temporal

```bash
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
```

**Description**:
- `TEMPORAL_ADDRESS`: Temporal server address
- `TEMPORAL_NAMESPACE`: Temporal namespace

### Application

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3010
NODE_ENV=development
```

**Description**:
- `NEXT_PUBLIC_APP_URL`: Application URL
- `NODE_ENV`: Environment (development, production)

## Optional Variables

### Database

```bash
DATABASE_URL=postgresql://user:pass@host:port/db
```

**Description**: Direct database connection URL (for migrations)

## Local Development

For local Supabase:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start>
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

## Related Documentation

- [Local Development](../getting-started/local-development.md) - Setup guide
- [Installation](../getting-started/installation.md) - Installation

