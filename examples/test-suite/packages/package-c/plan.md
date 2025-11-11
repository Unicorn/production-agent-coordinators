# Package C - Application Layer Package

## Overview

Top-level package providing the application layer, API endpoints, and UI components that consume package-b services.

## Package Information

- **Name**: package-c
- **Version**: 0.1.0
- **Dependencies**:
  - package-b (business logic and services)
  - Transitively depends on package-a through package-b

## Description

This package builds on package-b to provide:

- Application-level orchestration
- REST API endpoints
- UI components and views
- Integration with external systems

## Structure

```
package-c/
├── src/
│   ├── index.ts          # Main exports
│   ├── api/
│   │   ├── routes/
│   │   │   ├── users.ts
│   │   │   ├── products.ts
│   │   │   └── orders.ts
│   │   └── middleware/
│   │       └── auth.ts
│   ├── ui/
│   │   ├── UserList.tsx
│   │   ├── ProductCatalog.tsx
│   │   └── OrderDashboard.tsx
│   └── integrations/
│       ├── payment.ts
│       └── notifications.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Features

### 1. REST API

API endpoints using package-b services:
- User management endpoints (GET/POST/PUT/DELETE /users)
- Product catalog endpoints (GET/POST/PUT/DELETE /products)
- Order processing endpoints (GET/POST /orders)
- Authentication and authorization middleware

### 2. UI Components

React/Vue components consuming package-b services:
- UserList component for user management
- ProductCatalog for browsing products
- OrderDashboard for order tracking
- Form validation using package-b validators

### 3. External Integrations

Integration modules leveraging package-b services:
- Payment gateway integration
- Email/SMS notification service
- Analytics and tracking
- Third-party API clients

## Dependencies

### package-b

Required for:
- Business service implementations
- Data models and validation
- Domain logic and rules
- Error handling

### Transitive: package-a

Inherited through package-b:
- Base utilities and types
- Helper functions
- Constants and configuration

## Build Process

1. Ensure package-b is built first (dependency requirement)
2. Ensure package-a is built (transitive dependency)
3. TypeScript compilation with package-b types
4. Type declaration generation
5. ESM output to dist/
6. Optional: Bundle for browser/deployment

## Testing

- Unit tests for API routes and UI components
- Integration tests with package-b services
- E2E tests for complete user flows
- API contract tests
- Component snapshot tests

## Success Criteria

- All TypeScript types compile without errors
- All unit tests pass
- Integration with package-b works correctly
- API endpoints respond correctly
- UI components render without errors
- Code coverage > 70%
- No linting errors
- Generated type declarations are valid

## Notes

This package represents the application layer and should only depend on package-b (and transitively package-a). It demonstrates how a complete application can be built on top of business logic and foundation layers, following clean architecture principles.

This is the final package in the dependency chain and should not be depended upon by any other packages in the suite.
