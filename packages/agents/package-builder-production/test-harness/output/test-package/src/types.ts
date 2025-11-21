/**
 * Log level type
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level: LogLevel;
  /** Whether to include timestamps in output */
  timestamp?: boolean;
}

/**
 * Logger interface
 */
export interface Logger {
  /**
   * Log a debug message
   */
  debug(message: string, ...args: unknown[]): void;

  /**
   * Log an info message
   */
  info(message: string, ...args: unknown[]): void;

  /**
   * Log a warning message
   */
  warn(message: string, ...args: unknown[]): void;

  /**
   * Log an error message
   */
  error(message: string, error?: Error, ...args: unknown[]): void;
}
