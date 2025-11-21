# @test/logger

Simple, typed logger utility for Node.js applications.

## Installation

```bash
npm install @test/logger
```

## Usage

```typescript
import { createLogger } from '@test/logger';

// Create a logger with info level
const logger = createLogger({ 
  level: 'info',
  timestamp: true 
});

// Log messages
logger.debug('This will not be shown');
logger.info('Application started');
logger.warn('This is a warning');
logger.error('An error occurred', new Error('Something went wrong'));
```

## API

### `createLogger(options: LoggerOptions): Logger`

Create a new logger instance.

**Options:**
- `level` (required): Minimum log level to output (`'debug'` | `'info'` | `'warn'` | `'error'`)
- `timestamp` (optional): Include timestamps in output (default: `true`)

**Returns:** Logger instance with methods:
- `debug(message: string, ...args: unknown[]): void`
- `info(message: string, ...args: unknown[]): void`
- `warn(message: string, ...args: unknown[]): void`
- `error(message: string, error?: Error, ...args: unknown[]): void`

## Log Levels

Log levels in order of severity:
1. `debug` - Detailed debug information
2. `info` - Informational messages
3. `warn` - Warning messages
4. `error` - Error messages

When you set a log level, only messages at that level or higher will be output.

## License

MIT
