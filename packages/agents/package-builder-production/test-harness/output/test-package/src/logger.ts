import type { Logger, LoggerOptions, LogLevel } from './types.js';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Create a logger instance with the specified options
 */
export function createLogger(options: LoggerOptions): Logger {
  const minLevel = LOG_LEVELS[options.level];
  const includeTimestamp = options.timestamp ?? true;

  function formatMessage(message: string): string {
    if (includeTimestamp) {
      const timestamp = new Date().toISOString();
      return `[${timestamp}] ${message}`;
    }
    return message;
  }

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= minLevel;
  }

  return {
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog('debug')) {
        console.log(formatMessage(message), ...args);
      }
    },

    info(message: string, ...args: unknown[]): void {
      if (shouldLog('info')) {
        console.info(formatMessage(message), ...args);
      }
    },

    warn(message: string, ...args: unknown[]): void {
      if (shouldLog('warn')) {
        console.warn(formatMessage(message), ...args);
      }
    },

    error(message: string, error?: Error, ...args: unknown[]): void {
      if (shouldLog('error')) {
        if (error) {
          console.error(formatMessage(message), error, ...args);
        } else {
          console.error(formatMessage(message), ...args);
        }
      }
    }
  };
}
