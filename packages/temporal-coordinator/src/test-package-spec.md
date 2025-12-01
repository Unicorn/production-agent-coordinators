# Test Package: @bernierllc/integration-test-utils

## Package Overview

A simple utility package for integration testing. This package provides basic utility functions to validate the complete workflow.

## Package Information

- **Name**: `@bernierllc/integration-test-utils`
- **Version**: `0.1.0`
- **Description**: Simple utility package for integration testing
- **Type**: Core Package (utility functions)

## Structure

```
integration-test-utils/
├── src/
│   ├── index.ts          # Main exports
│   └── utils.ts          # Utility functions
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
└── README.md
```

## Features

### Utility Functions

1. **formatString** - Format a string with placeholders
   - Input: `formatString("Hello {name}", { name: "World" })`
   - Output: `"Hello World"`

2. **capitalize** - Capitalize first letter of a string
   - Input: `capitalize("hello")`
   - Output: `"Hello"`

3. **reverseString** - Reverse a string
   - Input: `reverseString("hello")`
   - Output: `"olleh"`

## TypeScript Types

```typescript
export interface FormatOptions {
  [key: string]: string | number;
}

export function formatString(template: string, options: FormatOptions): string;
export function capitalize(str: string): string;
export function reverseString(str: string): string;
```

## Dependencies

None - this is a standalone utility package.

## Testing

- Unit tests for all utility functions
- Edge case testing
- Type safety validation

## Success Criteria

- All TypeScript types compile without errors
- All unit tests pass
- Code coverage > 80%
- No linting errors
- All public exports have TSDoc comments

