# AI Agent Guide

Documentation for AI agents working with the Workflow Builder codebase.

## Overview

This guide helps AI agents understand the architecture, patterns, and common tasks in the Workflow Builder system.

## Sections

- **[Architecture Principles](architecture-principles.md)** - Design patterns and conventions
- **[Common Tasks](common-tasks.md)** - Step-by-step guides for common operations
- **[Troubleshooting](troubleshooting.md)** - Common errors and fixes

## Key Principles

1. **Type Safety**: All code is type-safe with TypeScript strict mode
2. **Security**: RLS on all tables, authorization checks in tRPC
3. **Isolation**: One worker per project (user+project = task queue)
4. **Code Storage**: Compiled code in database, not filesystem
5. **No Enums**: Lookup tables instead of PostgreSQL enums

## Quick Reference

- **Database**: See [Database Schema](../architecture/database-schema.md)
- **API**: See [API Reference](../api/README.md)
- **Architecture**: See [System Design](../architecture/system-design.md)

## Related Documentation

- [AGENTINFO.md](../../AGENTINFO.md) - Original agent guide
- [Architecture](../architecture/README.md) - System design

