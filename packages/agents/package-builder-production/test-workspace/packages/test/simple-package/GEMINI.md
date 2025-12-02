# BernierLLC Package Requirements

# BernierLLC Package Requirements

## TypeScript & Code Quality
- Zero TypeScript Errors (Strict Mode)
- Zero ESLint Errors
- No `any` types
- JSDoc comments on all public APIs
- License header in every .ts file

## Testing
- Minimum 80% test coverage
- Tests in __tests__/ directory

## Build
- package.json with required scripts (build, test, lint)
- tsconfig.json with strict mode
- dist/ directory with compiled output

## Verification Commands
- npm install
- npm run build
- npm run lint
- npm test

---

# Package Specification

# Test Package Plan

## Package Overview
- Name: [PACKAGE_NAME]
- Description: A simple test package for CLI integration testing
- Version: 0.1.0

## Architecture
- Single entry point: src/index.ts
- Export a simple function: `greet(name: string): string`

## Implementation
Create a simple greeting function that returns "Hello, {name}!"


---

# IMPORTANT: Package Name Sanitization

The package name "@test/simple-package" has been replaced with "[PACKAGE_NAME]" in this context to prevent import errors.
DO NOT try to import or reference the package by name. Work directly in the current directory using relative paths only.