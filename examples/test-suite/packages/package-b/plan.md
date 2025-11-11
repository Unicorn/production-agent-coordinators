# Package B - Business Logic Package

## Overview

Intermediate package providing business logic, data models, and services that build on package-a utilities.

## Package Information

- **Name**: package-b
- **Version**: 0.1.0
- **Dependencies**:
  - package-a (foundation utilities)

## Description

This package builds on package-a to provide:

- Business logic implementations
- Data models and entities
- Service layer abstractions
- Domain-specific utilities

## Structure

```
package-b/
├── src/
│   ├── index.ts          # Main exports
│   ├── models/
│   │   ├── User.ts       # User model
│   │   ├── Product.ts    # Product model
│   │   └── Order.ts      # Order model
│   ├── services/
│   │   ├── UserService.ts
│   │   ├── ProductService.ts
│   │   └── OrderService.ts
│   └── validators/
│       └── validators.ts  # Input validation
├── package.json
├── tsconfig.json
└── README.md
```

## Features

### 1. Data Models

Uses package-a types and utilities to define:
- User entity with validation
- Product catalog models
- Order processing models
- Relationship mappings

### 2. Service Layer

Business services that leverage package-a utilities:
- UserService for user management
- ProductService for catalog operations
- OrderService for order processing
- Transaction management

### 3. Validation

Input validation using package-a helpers:
- Schema validation
- Business rule enforcement
- Data integrity checks
- Error handling with package-a error types

## Dependencies

### package-a

Required for:
- Base type definitions
- Utility functions for data transformation
- Constants and configuration
- Error types and handlers

## Build Process

1. Ensure package-a is built first (dependency requirement)
2. TypeScript compilation with package-a types
3. Type declaration generation
4. ESM output to dist/

## Testing

- Unit tests for all models and services
- Integration tests with package-a utilities
- Mock tests for external dependencies
- Type tests for model definitions

## Success Criteria

- All TypeScript types compile without errors
- All unit tests pass
- Integration with package-a works correctly
- Code coverage > 75%
- No linting errors
- Generated type declarations are valid

## Notes

This package demonstrates how business logic can be built on top of foundational utilities. It should only depend on package-a and avoid circular dependencies with package-c.
