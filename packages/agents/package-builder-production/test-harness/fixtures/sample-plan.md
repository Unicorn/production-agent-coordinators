# @test/logger

**Package:** `@test/logger`
**Type:** utility
**Status:** Planning

## Overview

A simple, typed logger utility for Node.js applications with support for different log levels and transports.

## Requirements

### Core Features
- Support log levels: debug, info, warn, error
- Console transport (default)
- Typed logger interface with TypeScript
- Configurable log formatting
- Timestamp support

### Code Quality
- Strict TypeScript mode
- 100% test coverage
- ES module exports
- Proper error handling

## Dependencies

This package has no external dependencies.

## Package Structure

```
@test/logger/
├── src/
│   ├── index.ts              # Public API
│   ├── logger.ts             # Logger implementation
│   └── types.ts              # TypeScript types
├── tests/
│   └── logger.test.ts        # Unit tests
├── package.json
├── tsconfig.json
└── README.md
```

## API Design

```typescript
export interface LoggerOptions {
  level: 'debug' | 'info' | 'warn' | 'error';
  timestamp?: boolean;
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: Error, ...args: unknown[]): void;
}

export function createLogger(options: LoggerOptions): Logger;
```

## Usage Example

```typescript
import { createLogger } from '@test/logger';

const logger = createLogger({ level: 'info', timestamp: true });

logger.info('Application started');
logger.warn('This is a warning');
logger.error('An error occurred', new Error('Something went wrong'));
```

## Implementation Notes

1. Use console methods under the hood (console.log, console.warn, console.error)
2. Filter messages based on configured log level
3. Add timestamps when enabled
4. Format error objects nicely

## Testing Requirements

- Test all log levels
- Test level filtering (e.g., when level='info', debug messages should not appear)
- Test timestamp formatting
- Test error object formatting
- Use Vitest for testing
- Mock console methods to verify output
