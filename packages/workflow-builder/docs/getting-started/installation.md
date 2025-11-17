# Installation

Complete installation guide for the Workflow Builder system.

## Prerequisites

Before installing, ensure you have:

- **Node.js** >= 18 (check with `node --version`)
- **Yarn** >= 1.22 (check with `yarn --version`)
- **Git** (for cloning the repository)
- **Docker Desktop** (for local Supabase, optional)
- **Temporal CLI** (for workflow execution, optional)

### Installing Prerequisites

#### Node.js
```bash
# Using Homebrew (macOS)
brew install node

# Or download from https://nodejs.org/
```

#### Yarn
```bash
# Using npm
npm install -g yarn

# Or using Homebrew (macOS)
brew install yarn
```

#### Docker Desktop
```bash
# Download from https://www.docker.com/products/docker-desktop
# Or using Homebrew (macOS)
brew install --cask docker
```

#### Temporal CLI
```bash
# Using Homebrew (macOS)
brew install temporal

# Or download from https://docs.temporal.io/cli
```

## Installation Steps

### 1. Clone the Repository

If you haven't already:

```bash
cd /Users/mattbernier/projects/production-agent-coordinators
```

### 2. Install Dependencies

From the monorepo root:

```bash
yarn install
```

This installs dependencies for all packages, including the workflow-builder.

### 3. Set Up Supabase

Choose one of the following options:

#### Option A: Supabase Cloud (Recommended for Production)

1. Go to https://supabase.com and create a new project
2. Wait for project initialization (~2 minutes)
3. Go to Project Settings → API
4. Copy your project URL and anon key

#### Option B: Local Supabase (Recommended for Development)

See [Local Development](local-development.md) for detailed instructions.

### 4. Configure Environment Variables

Create `.env.local` in `packages/workflow-builder/`:

```bash
cd packages/workflow-builder
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_PROJECT_ID=xxxxx

# Temporal
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3010
NODE_ENV=development
```

### 5. Run Database Migrations

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
npx supabase start
npx supabase db push
```

### 6. Generate TypeScript Types

After migrations:

```bash
cd packages/workflow-builder
yarn gen:types
```

This generates TypeScript types from your database schema.

## Verification

### 1. Start Development Server

```bash
cd packages/workflow-builder
yarn dev
```

The server should start on http://localhost:3010

### 2. Create Test Account

1. Visit http://localhost:3010
2. Click "Sign Up"
3. Enter email, password, and display name
4. You should be automatically signed in

### 3. Verify Database Connection

Check that you can see the dashboard with workflow/component counts.

## Troubleshooting

### Installation Issues

**"Command not found: yarn"**
- Install Yarn: `npm install -g yarn`

**"Cannot find module" errors**
- Run `yarn install` from monorepo root
- Clear node_modules and reinstall: `rm -rf node_modules && yarn install`

**"Port 3010 already in use"**
- Kill the process: `lsof -ti:3010 | xargs kill -9`
- Or change port in `package.json`

### Database Issues

**"Migration failed"**
- Check Supabase connection in `.env.local`
- Verify migrations exist in `supabase/migrations/`
- Try resetting: `npx supabase db reset` (⚠️ deletes data)

**"Table does not exist"**
- Run migrations: `npx supabase db push`
- Check migration status: `npx supabase migration list`

### Environment Issues

**"Invalid API key"**
- Verify `.env.local` has correct Supabase credentials
- Restart dev server after changing `.env.local`

**"Cannot connect to Supabase"**
- Check `NEXT_PUBLIC_SUPABASE_URL` is correct
- Verify network connection
- For local Supabase, ensure Docker is running

## Next Steps

After successful installation:

1. **[Local Development](local-development.md)** - Set up your development environment
2. **[Quick Tutorial](quick-tutorial.md)** - Build your first workflow
3. **[User Guide](../user-guide/README.md)** - Learn the system features

## Related Documentation

- [Local Development](local-development.md) - Detailed local setup
- [Environment Variables](../reference/environment-variables.md) - Complete env var reference
- [Troubleshooting](../troubleshooting.md) - Common issues and solutions

