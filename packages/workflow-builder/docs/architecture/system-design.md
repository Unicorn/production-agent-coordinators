# System Design

High-level architecture and design of the Workflow Builder system.

## Overview

The Workflow Builder is a full-stack application that enables users to visually compose Temporal workflows from reusable components. The system provides a complete workflow lifecycle: design, compile, deploy, and execute.

## Architecture Layers

### Frontend Layer

**Technology**: Next.js 14 (App Router), React 18, Tamagui

**Key Components**:
- **Pages** (`src/app/`) - Next.js App Router pages
- **Components** (`src/components/`) - Reusable React components
- **Workflow Canvas** - Visual editor using React Flow
- **tRPC Client** - Type-safe API communication

**Key Features**:
- Server-side rendering (SSR) for initial load
- Client-side routing and state management
- Real-time auto-save (2-second debounce)
- Drag-and-drop workflow composition

### Backend Layer

**Technology**: tRPC, Next.js API Routes, Supabase

**Key Components**:
- **tRPC Routers** (`src/server/api/routers/`) - API endpoints
- **tRPC Setup** (`src/server/api/trpc.ts`) - Context and middleware
- **Workflow Compiler** (`src/lib/workflow-compiler/`) - JSON to TypeScript
- **Worker Manager** (`src/lib/temporal/worker-manager.ts`) - Temporal worker lifecycle

**Key Features**:
- Type-safe RPC between frontend and backend
- Authentication via Supabase Auth
- Authorization via Row-Level Security
- Workflow compilation and code generation

### Database Layer

**Technology**: Supabase (PostgreSQL 15)

**Key Features**:
- Row-Level Security (RLS) for multi-tenant isolation
- Lookup tables instead of enums (flexibility)
- Denormalized tables for performance (workflow_nodes, workflow_edges)
- JSONB columns for flexible schemas

See [Database Schema](database-schema.md) for detailed structure.

### Workflow Engine Layer

**Technology**: Temporal

**Key Components**:
- **Temporal Client** (`src/lib/temporal/connection.ts`) - Connection management
- **Worker Manager** - One worker per project
- **Code Storage** - Compiled code in database
- **Statistics** (`src/lib/temporal/statistics.ts`) - Performance tracking

**Key Features**:
- Dynamic worker startup per project
- Database-backed code loading
- Workflow execution tracking
- Activity performance metrics

See [Temporal Integration](temporal-integration.md) for details.

## Data Flow

### Workflow Creation Flow

```
1. User designs workflow in UI
   ↓
2. Auto-save to database (every 2 seconds)
   ↓
3. User clicks "Build Workflow"
   ↓
4. Compiler generates TypeScript code
   ↓
5. Code stored in workflow_compiled_code table
   ↓
6. Worker manager starts worker for project
   ↓
7. Worker loads code from database
   ↓
8. Workflow registered with Temporal
   ↓
9. Ready for execution
```

### Workflow Execution Flow

```
1. User triggers execution via UI
   ↓
2. tRPC endpoint receives request
   ↓
3. Verify worker is running
   ↓
4. Start workflow execution via Temporal client
   ↓
5. Temporal distributes work to worker
   ↓
6. Worker executes workflow code
   ↓
7. Activities execute (external calls)
   ↓
8. Results stored in workflow_executions table
   ↓
9. Statistics updated in activity_statistics table
```

## Component Relationships

### Frontend Components

```
WorkflowCanvas
  ├── ComponentPalette (drag source)
  ├── React Flow Canvas (nodes & edges)
  ├── PropertyPanel (node configuration)
  └── WorkflowToolbar (save, deploy, execute)
```

### Backend Routers

```
appRouter (root)
  ├── users (authentication, profiles)
  ├── components (CRUD operations)
  ├── agentPrompts (AI prompt management)
  ├── workflows (workflow CRUD)
  ├── projects (project management)
  ├── compiler (workflow compilation)
  ├── execution (workflow execution)
  └── workQueues (work queue management)
```

### Database Tables

```
users
  ├── user_roles (FK)
  └── projects (1:N)
      └── workflows (1:N)
          ├── workflow_nodes (denormalized)
          ├── workflow_edges (denormalized)
          └── workflow_compiled_code (1:N)
              └── workflow_workers (1:1)
components
  ├── component_types (FK)
  ├── component_visibility (FK)
  └── agent_prompts (FK, optional)
```

## Design Decisions

### 1. One Worker Per Project

**Decision**: Each user+project combination gets its own Temporal worker.

**Rationale**:
- Natural isolation boundary
- Easy to scale (add workers as users add projects)
- Simple to reason about and debug
- Aligns with user mental model

**Implementation**: Task queue name = `{user_id}-{project_id}`

### 2. Database Code Storage

**Decision**: Store compiled workflow code in database, not filesystem.

**Rationale**:
- Better for distributed systems
- No file system sandboxing concerns
- Easy to version and rollback
- Works with serverless deployments

**Implementation**: `workflow_compiled_code` table stores all code as TEXT.

### 3. No PostgreSQL Enums

**Decision**: Use lookup tables instead of PostgreSQL enums.

**Rationale**:
- More flexible (can add types without migrations)
- Easier to query and filter
- Better for RLS policies
- Supports metadata (icons, descriptions)

**Implementation**: Tables like `component_types`, `workflow_statuses` with foreign keys.

### 4. Denormalized Nodes/Edges

**Decision**: Store workflow nodes and edges in separate tables.

**Rationale**:
- Faster queries (no JSON parsing)
- Easier to query and filter
- Better for RLS policies
- Supports efficient graph operations

**Implementation**: `workflow_nodes` and `workflow_edges` tables.

### 5. Type-Safe RPC

**Decision**: Use tRPC for all API communication.

**Rationale**:
- End-to-end type safety
- No API documentation needed
- Automatic client generation
- Great developer experience

**Implementation**: tRPC routers with Zod validation.

## Technology Choices

### Frontend: Next.js 14

**Why**: 
- Server-side rendering for performance
- App Router for modern React patterns
- Built-in API routes
- Excellent TypeScript support

### UI: Tamagui

**Why**:
- Cross-platform (web, mobile)
- Type-safe styling
- Good performance
- Consistent design system

### Backend: tRPC

**Why**:
- Type-safe RPC
- No code generation needed
- Great DX with TypeScript
- Automatic client generation

### Database: Supabase

**Why**:
- PostgreSQL with great tooling
- Built-in authentication
- Row-Level Security
- Real-time subscriptions (future)

### Workflow Engine: Temporal

**Why**:
- Industry-standard workflow orchestration
- Durable execution
- Built-in retries and timeouts
- Excellent observability

## Scalability Considerations

### Horizontal Scaling

- **Frontend**: Stateless, can scale horizontally
- **Backend**: Stateless API, can scale horizontally
- **Database**: Supabase handles scaling
- **Workers**: One per project, scales with projects

### Performance Optimizations

- **Denormalization**: Nodes/edges for fast queries
- **Indexing**: Strategic indexes on foreign keys
- **Caching**: React Query for API responses
- **Code Bundling**: Temporal bundles code efficiently

### Future Enhancements

- **CDN**: Static assets via Vercel CDN
- **Database Replication**: Supabase read replicas
- **Worker Pooling**: Shared workers for small projects
- **Caching Layer**: Redis for frequently accessed data

## Security Architecture

See [Security](security.md) for detailed security documentation.

**Key Points**:
- Row-Level Security on all tables
- Authentication via Supabase Auth
- Authorization checks in tRPC procedures
- Input validation via Zod schemas

## Related Documentation

- [Database Schema](database-schema.md) - Database structure
- [Temporal Integration](temporal-integration.md) - Workflow execution
- [Security](security.md) - Security patterns
- [API Reference](../api/README.md) - API documentation

