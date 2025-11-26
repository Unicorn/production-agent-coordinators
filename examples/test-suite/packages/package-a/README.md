# package-a - Foundation Package

## Overview

This is the foundation package for Bernier LLC projects, providing core utilities, types, and helper functions. It is designed to be a stable base layer with no external dependencies.

## Package Information

- **Name**: `package-a`
- **Version**: `0.1.0`
- **Description**: A foundation package providing core utility functions, basic TypeScript types and interfaces, helper functions, and shared constants.
- **Dependencies**: None

## Structure

```
package-a/
├── src/
│   ├── index.ts          # Main exports
│   ├── utils.ts          # Utility functions
│   ├── types.ts          # TypeScript types and interfaces
│   └── constants.ts      # Shared constants and configuration defaults
├── package.json          # Package metadata and scripts
├── tsconfig.json         # TypeScript compiler configuration
├── jest.config.js        # Jest test runner configuration
├── .eslintrc.json        # ESLint configuration
└── README.md             # This document
```

## Features

### 1. Utility Functions (`src/utils.ts`)

Provides a set of general-purpose utility functions for common tasks:

- **String Manipulation**: `capitalizeFirstLetter`, `reverseString`
- **Array Processing**: `removeDuplicates`, `chunkArray`
- **Object Transformation**: `deepMerge`, `pickKeys`
- **Date/Time Helpers**: `formatDate`, `addDays`

All utility functions adhere to the `PackageResult` pattern for consistent error handling.

### 2. Type Definitions (`src/types.ts`)

Contains core TypeScript type definitions and interfaces to enhance type safety and code readability:

- `PackageResult<T>`: Standardized result type for all operations.
- `Identifiable`: Interface for entities with an `id`.
- `Primitive`: Union type for primitive JavaScript values.
- `KeyOf<T>`: Extracts keys of an object as a union of string literals.
- `DeepPartial<T>`: Utility type to make all properties of an object (and nested objects) optional.
- `Branded<T, Brand>`: Branded type for compile-time differentiation.

### 3. Constants (`src/constants.ts`)

Defines shared constants and configuration defaults:

- `APP_NAME`, `APP_VERSION`: Basic application information.
- `DEFAULT_TIMEOUT_MS`, `DEFAULT_PAGE_SIZE`: Configuration defaults.
- `ERROR_MESSAGES`: Standardized error messages for consistent error reporting.
- `STATUS_CODES`: Common status codes.

## Installation

```bash
npm install package-a
```

## Usage

```typescript
import {
  capitalizeFirstLetter,
  removeDuplicates,
  deepMerge,
  formatDate,
  ERROR_MESSAGES,
  PackageResult
} from 'package-a';

// Example: Using a utility function
const result: PackageResult<string> = capitalizeFirstLetter('hello world');
if (result.success && result.data) {
  console.log(result.data); // Output: Hello world
} else {
  console.error(result.error);
}

// Example: Using constants
console.log(ERROR_MESSAGES.INVALID_INPUT);
```

## Development

### Build

To compile the TypeScript source files into JavaScript and generate type declarations:

```bash
npm run build
```

### Test

To run unit tests and check code coverage:

```bash
npm run test
```

### Lint

To lint the source code and automatically fix issues where possible:

```bash
npm run lint
```

## Contributing

For any contributions, please adhere to Bernier LLC coding standards and ensure all tests pass with adequate coverage.

## License

This package is licensed under a limited-use license by Bernier LLC. Please refer to the `LICENSE` file for more details.