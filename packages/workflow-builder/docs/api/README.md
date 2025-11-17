# API Reference

Complete API documentation for the Workflow Builder system.

## Overview

The system uses tRPC for type-safe API communication. All endpoints are organized into routers by domain.

## API Routers

- **[tRPC Routers](trpc-routers.md)** - Complete endpoint reference
- **[Database Types](database-types.md)** - TypeScript type definitions
- **[Workflow Definition Format](workflow-definition-format.md)** - JSON structure

## Quick Reference

### Authentication
All endpoints require authentication except public procedures.

### Type Safety
All endpoints are fully type-safe with TypeScript and Zod validation.

### Error Handling
Errors follow tRPC error format with appropriate error codes.

## Related Documentation

- [Architecture](../architecture/system-design.md) - System design
- [Development Guide](../development/README.md) - Contributing

