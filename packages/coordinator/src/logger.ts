import type { ILogger } from "@coordinator/contracts";

/**
 * ConsoleLogger - Simple console-based logger implementation
 *
 * Logs all messages to console with appropriate levels.
 * Suitable for development and simple production use cases.
 */
export class ConsoleLogger implements ILogger {
  constructor(private readonly prefix: string = "") {}

  debug(message: string, meta?: Record<string, unknown>): void {
    const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
    if (meta && Object.keys(meta).length > 0) {
      console.debug(prefixedMessage, meta);
    } else {
      console.debug(prefixedMessage);
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
    if (meta && Object.keys(meta).length > 0) {
      console.info(prefixedMessage, meta);
    } else {
      console.info(prefixedMessage);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
    if (meta && Object.keys(meta).length > 0) {
      console.warn(prefixedMessage, meta);
    } else {
      console.warn(prefixedMessage);
    }
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    const prefixedMessage = this.prefix ? `[${this.prefix}] ${message}` : message;
    const combinedMeta = { ...meta, error: error ? error.message : undefined, stack: error?.stack };

    if (error || (meta && Object.keys(meta).length > 0)) {
      console.error(prefixedMessage, combinedMeta);
    } else {
      console.error(prefixedMessage);
    }
  }
}
