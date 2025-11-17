# CLI Commands

Available commands for development and operations.

## Development

```bash
# Start development server
yarn dev

# Build for production
yarn build

# Start production server
yarn start

# Type checking
yarn typecheck

# Linting
yarn lint
```

## Database

```bash
# Generate TypeScript types
yarn gen:types

# Run migrations (local)
npx supabase db push

# Run migrations (cloud)
npx supabase db push --linked

# Reset database (⚠️ deletes all data)
npx supabase db reset

# Check migration status
npx supabase migration list
```

## Supabase

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Check status
supabase status

# View logs
supabase logs
```

## Temporal

```bash
# Start Temporal dev server
temporal server start-dev

# Check Temporal status
temporal operator cluster describe
```

## Testing

```bash
# Run unit tests
yarn test

# Run E2E tests
yarn test:e2e

# Run all tests
yarn test:all
```

## Related Documentation

- [Local Development](../getting-started/local-development.md) - Setup guide
- [Database Migrations](../development/database-migrations.md) - Migrations

