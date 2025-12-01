# @examples/package-b

A small TypeScript utility package with common helper functions for testing the Gemini workflow.

## Package Info

- **Name**: @examples/package-b
- **Version**: 1.0.0
- **License**: MIT (limited use)

## Required Functions

### 1. isNil
Check if a value is null or undefined.

```typescript
function isNil(value: unknown): value is null | undefined
```

### 2. capitalizeFirstLetter
Capitalize the first letter of a string.

```typescript
function capitalizeFirstLetter(str: string | null | undefined): string
```

### 3. reverseString
Reverse a string.

```typescript
function reverseString(str: string | null | undefined): string
```

### 4. uniqueArrayBy
Remove duplicates from an array based on a key selector.

```typescript
function uniqueArrayBy<T>(array: T[], keySelector: (item: T) => string | number): T[]
```

### 5. toCamelCase
Convert a string to camelCase (handle spaces, hyphens, underscores).

```typescript
function toCamelCase(str: string | null | undefined): string
```

### 6. generateRandomAlphanumeric
Generate a random alphanumeric string of specified length.

```typescript
function generateRandomAlphanumeric(length: number): string
```

### 7. safeJsonParse
Safely parse JSON with error handling.

```typescript
interface PackageResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

function safeJsonParse<T>(jsonString: string): PackageResult<T>
```

## Requirements

1. All functions must handle null/undefined inputs gracefully
2. Full TypeScript strict mode compliance
3. Comprehensive test coverage with Jest
4. All ESLint rules must pass
5. Export types and functions from index.ts barrel file
