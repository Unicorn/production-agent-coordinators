# BernierLLC Package Minimum Requirements

## Overview
All @bernierllc packages must meet these minimum requirements before publishing.

---

## 1. TypeScript & Code Quality

### Zero Tolerance Policy
- **Zero TypeScript Errors** - Strict mode enabled, `tsc --noEmit` must pass
- **Zero ESLint Errors** - All linting rules must pass
- **No `any` types** - Use `unknown` or proper generics instead
- **Explicit return types** - All exported functions must have explicit return types

### Code Documentation
- **JSDoc comments** on all public APIs (`@param`, `@returns`, `@example`)
- **License header** in every `.ts` file:
```typescript
/**
 * Copyright (c) 2025 Bernier LLC
 * All rights reserved.
 */
```

---

## 2. Testing Requirements

### Coverage Thresholds by Category
| Category | Minimum Coverage |
|----------|------------------|
| Core     | 90%              |
| Utility  | 85%              |
| Service  | 80%              |
| UI       | 75%              |
| Suite    | 70%              |

### Test Standards
- Tests must be deterministic (no flaky tests)
- Test files named `*.test.ts` or `*.spec.ts`
- Use Vitest as the test runner
- Integration tests should be clearly marked

---

## 3. Build Requirements

### Package.json Required Fields
```json
{
  "name": "@bernierllc/package-name",
  "version": "X.Y.Z",
  "description": "Clear, concise description",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "author": "Bernier LLC",
  "license": "SEE LICENSE IN LICENSE",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src --ext .ts"
  }
}
```

### Build Output
- `dist/` directory must contain compiled JavaScript
- `.d.ts` type definition files must be generated
- Source maps optional but recommended

---

## 4. Verification Commands

These commands MUST pass before publishing:

```bash
# 1. Install dependencies
npm install

# 2. Build the package
npm run build

# 3. Run linting
npm run lint

# 4. Run tests with coverage
npm test -- --coverage
```

### Exit Codes
- All commands must exit with code 0
- Non-zero exit codes indicate failure

---

## 5. Directory Structure

```
package-name/
├── src/
│   ├── index.ts           # Main exports
│   ├── *.ts               # Source files
│   └── __tests__/         # Test files
├── dist/                  # Build output (generated)
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

---

## 6. Documentation Requirements

### README.md Must Include
- Package name and description
- Installation instructions
- Quick start / usage example
- API reference or link to docs
- License information

---

## 7. Error Handling (Runtime Packages)

For packages with runtime code:

```typescript
// Use structured error responses
export interface PackageResult<T> {
  success: boolean;
  data?: T;
  error?: PackageError;
}

export interface PackageError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

---

## 8. Integration Status (if applicable)

Packages should declare their integration status:

```json
{
  "bernierllc": {
    "integration": {
      "logger": "integrated" | "not-applicable",
      "neverhub": "integrated" | "not-applicable",
      "docs-suite": "ready" | "pending"
    }
  }
}
```

---

## Checklist for Compliance

- [ ] TypeScript compiles with zero errors
- [ ] ESLint passes with zero errors
- [ ] Test coverage meets category threshold
- [ ] All tests pass
- [ ] License headers in all source files
- [ ] JSDoc comments on public APIs
- [ ] README.md complete
- [ ] package.json has required fields
- [ ] Build produces dist/ with types
