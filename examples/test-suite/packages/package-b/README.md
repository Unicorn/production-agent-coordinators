# Package A - Foundation Package

## Overview

This is the foundation package with no external dependencies. It provides core utilities, basic TypeScript types and interfaces, helper functions, and shared constants for other packages in the Bernier LLC test suite.

## Package Information

- **Name**: `package-a`
- **Version**: 0.1.0
- **Dependencies**: None (foundation layer)

## Features

### 1. Utility Functions (`src/utils.ts`)

- `isNil`: Checks if a value is `null` or `undefined`.
- `capitalizeFirstLetter`: Capitalizes the first letter of a string.
- `reverseString`: Reverses a given string.
- `uniqueArrayBy`: Removes duplicate elements from an array based on a key selector.
- `toCamelCase`: Converts a string to camelCase format.
- `generateRandomAlphanumeric`: Generates a random alphanumeric string of a specified length.
- `safeJsonParse`: Safely parses a JSON string, returning a `PackageResult`.

### 2. Type Definitions (`src/types.ts`)

- `PackageResult<T>`: Standard interface for operation results (success/data/error).
- `BaseEntity`: An example base interface for entities with `id`, `createdAt`, `updatedAt`.
- `UUID`: A branded type for UUID strings to enhance type safety.
- `isBaseEntity`: Type guard for `BaseEntity`.
- `createUUID`: Function to create a branded `UUID` type.

### 3. Constants (`src/constants.ts`)

- `STATUS_CODES`: Common HTTP-like status codes.
- `ERROR_MESSAGES`: Standardized error messages.
- `APP_CONFIG`: Application-wide configuration defaults like timeouts and log levels.

## Installation

```bash
npm install package-a
```

## Usage

```typescript
import {
  capitalizeFirstLetter,
  isNil,
  STATUS_CODES,
  ERROR_MESSAGES,
  createUUID,
  safeJsonParse,
  PackageResult,
  type UUID
} from 'package-a';

console.log(capitalizeFirstLetter('hello')); // "Hello"
console.log(isNil(null)); // true
console.log(STATUS_CODES.SUCCESS); // 200

const myUuid: UUID = createUUID('a1b2c3d4-e5f6-7890-1234-567890abcdef');

interface MyData {
  name: string;
  age: number;
}

const jsonResult: PackageResult<MyData> = safeJsonParse<MyData>('{"name": "Alice", "age": 30}');

if (jsonResult.success) {
  console.log(jsonResult.data?.name); // "Alice"
} else {
  console.error(jsonResult.error);
}
```

## Contributing

Please refer to the project's main repository for contribution guidelines.

## License

UNLICENSED (Proprietary to Bernier LLC)
```