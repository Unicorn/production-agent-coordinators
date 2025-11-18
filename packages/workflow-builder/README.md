# Workflow Builder

Visual workflow builder for Temporal coordinators. Build and deploy workflows by composing reusable components.

## Quick Start

### Prerequisites

- Node.js >= 18
- Yarn
- Docker Desktop (for infrastructure services)
- Supabase CLI (for local Supabase)

### Option 1: Docker Setup (Recommended)

Start everything with one command:

```bash
cd packages/workflow-builder
./scripts/start-all.sh
```

This starts:
- ✅ Kong API Gateway
- ✅ Temporal
- ✅ Supabase (via CLI)
- ✅ Creates/updates `.env.local`
- ✅ Optionally starts Next.js

Then visit: http://localhost:3010

**Stop services:**
```bash
# Stop Next.js (if running)
./scripts/stop-nextjs.sh

# Stop infrastructure (Kong, Temporal)
./scripts/stop-infrastructure.sh

# Stop Supabase
supabase stop
```

See [Docker Setup Guide](./docs/development/docker-setup.md) for details.

### Option 2: Manual Setup

1. **Install dependencies**:
```bash
cd packages/workflow-builder
yarn install
```

2. **Start infrastructure**:
```bash
# Start Kong and Temporal
./scripts/start-infrastructure.sh

# Start Supabase
supabase start
```

3. **Configure environment**:
```bash
# .env.local is auto-created by start-all.sh
# Or manually copy from .env.local.example
```

4. **Start development server**:
```bash
yarn dev
```

5. **Visit**: http://localhost:3010

## Project Structure

```
packages/workflow-builder/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── auth/              # Authentication pages
│   │   ├── workflows/         # Workflow management
│   │   ├── components/        # Component library
│   │   └── agents/            # Agent prompts
│   ├── components/            # React components
│   │   ├── workflow/          # Workflow canvas & editor
│   │   └── shared/            # Shared UI components
│   ├── lib/                   # Utilities
│   │   ├── supabase/          # Supabase clients
│   │   ├── trpc/              # tRPC client
│   │   └── tamagui/           # Tamagui config
│   ├── server/                # Backend
│   │   └── api/               # tRPC routers
│   └── types/                 # TypeScript types
├── supabase/
│   └── migrations/            # Database migrations
└── AGENTINFO.md              # AI agent instructions
```

## Features

### Phase 1 (Current)
- ✅ User authentication (Supabase Auth)
- ✅ Component registry
- ✅ Agent prompt management
- ✅ Task queue configuration
- ✅ Basic UI with Tamagui

### Phase 2 (Next)
- 🚧 Visual workflow builder
- 🚧 Component palette (drag-and-drop)
- 🚧 Property panel
- 🚧 Workflow CRUD operations

### Phase 3 (Planned)
- 📝 Dynamic worker generation
- 📝 Workflow deployment
- 📝 Temporal integration

### Phase 4 (Planned)
- 📝 Workflow execution monitoring
- 📝 Real-time updates
- 📝 Workflow history

## Development

### Commands

```bash
# Development server
yarn dev

# Build for production
yarn build

# Start production server
yarn start

# Type checking
yarn typecheck

# Generate Supabase types
yarn gen:types
```

### Database

Create/modify migrations in `supabase/migrations/`.

Run migrations:
```bash
npx supabase db push
```

Generate types after schema changes:
```bash
yarn gen:types
```

## Documentation

- **Design Doc**: `../../docs/plans/2025-11-14-workflow-builder-system-design.md`
- **Component Standards**: `../../docs/standards/component-discoverability-and-reusability.md`
- **AI Agent Guide**: `AGENTINFO.md`

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tamagui
- **Backend**: tRPC, Next.js API Routes
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Workflow Engine**: Temporal
- **Language**: TypeScript (strict mode)

## License

MIT

