# Architecture

System architecture and design documentation for the Workflow Builder.

## Overview

The Workflow Builder is a visual tool for composing Temporal workflows from reusable components. It provides a complete system for designing, compiling, deploying, and executing workflows.

## Architecture Sections

- **[System Design](system-design.md)** - High-level architecture and component relationships
- **[Database Schema](database-schema.md)** - Complete database structure and design decisions
- **[Temporal Integration](temporal-integration.md)** - How workflows execute via Temporal
- **[Security](security.md)** - Authentication, authorization, and security patterns
- **[Advanced Patterns](advanced-patterns.md)** - Cron schedules, signals, queries, child workflows
- **[Human-in-the-Loop Patterns](human-in-the-loop-patterns.md)** - Workflows with human interaction (agent tester)

## System Components

### Frontend
- **Next.js 14** - React framework with App Router
- **Tamagui** - UI component library
- **React Flow** - Visual workflow canvas
- **tRPC Client** - Type-safe API communication

### Backend
- **tRPC** - Type-safe RPC framework
- **Next.js API Routes** - Server-side endpoints
- **Supabase** - PostgreSQL database + Auth + RLS

### Workflow Engine
- **Temporal** - Workflow orchestration
- **Worker Manager** - Dynamic worker lifecycle
- **Workflow Compiler** - JSON to TypeScript compilation

## Key Design Principles

1. **Type Safety** - End-to-end TypeScript with tRPC
2. **Security** - Row-Level Security on all tables
3. **Isolation** - One worker per project (user+project = task queue)
4. **Code Storage** - Compiled code in database, not filesystem
5. **No Enums** - Lookup tables instead of PostgreSQL enums

## Data Flow

```
User → UI → tRPC → Supabase → Database
                    ↓
              Workflow Compiler
                    ↓
              Code Storage (DB)
                    ↓
              Worker Manager
                    ↓
              Temporal Worker
                    ↓
              Workflow Execution
```

## Related Documentation

- [Getting Started](../getting-started/README.md) - Setup and installation
- [User Guide](../user-guide/README.md) - Using the system
- [API Reference](../api/README.md) - API documentation
- [Development Guide](../development/README.md) - Contributing

