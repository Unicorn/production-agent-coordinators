# File Structure

Project directory structure and key files.

## Directory Structure

```
packages/workflow-builder/
├── docs/                    # Documentation
├── src/
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components
│   ├── lib/                # Utilities
│   ├── server/             # Backend (tRPC)
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── supabase/
│   └── migrations/         # Database migrations
├── tests/                  # Test files
└── package.json
```

## Key Files

### Configuration

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `next.config.cjs` - Next.js configuration
- `.env.local` - Environment variables

### Backend

- `src/server/api/root.ts` - Root tRPC router
- `src/server/api/trpc.ts` - tRPC setup
- `src/server/api/routers/` - API routers

### Frontend

- `src/app/layout.tsx` - Root layout
- `src/components/workflow/WorkflowCanvas.tsx` - Visual editor
- `src/lib/trpc/Provider.tsx` - tRPC provider

### Database

- `supabase/migrations/` - Migration files
- `src/types/database.ts` - Generated types

## Related Documentation

- [Architecture](../architecture/system-design.md) - System design
- [Contributing](../development/contributing.md) - Code organization

