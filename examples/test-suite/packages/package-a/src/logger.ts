/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { type PackageResult } from './types';

/**
 * Interface for a generic logger.
 * This allows for flexible logging implementations (e.g., console, winston, pino).
 */
export interface ILogger {
  debug: (message: string, ...meta: unknown[]) => void;
  info: (message: string, ...meta: unknown[]) => void;
  warn: (message: string, ...meta: unknown[]) => void;
  error: (message: string, ...meta: unknown[]) => void;
}

/**
 * A basic console logger implementation conforming to ILogger.
 */
export class ConsoleLogger implements ILogger {
  public debug(message: string, ...meta: unknown[]): void {
    console.debug(`[DEBUG] ${message}`, ...meta);
  }

  public info(message: string, ...meta: unknown[]): void {
    console.info(`[INFO] ${message}`, ...meta);
  }

  public warn(message: string, ...meta: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...meta);
  }

  public error(message: string, ...meta: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...meta);
  }
}

/**
 * Creates a logger instance based on the provided configuration or defaults to ConsoleLogger.
 * @returns An instance of ILogger.
 */
export function createLogger(): ILogger {
  // In a real application, this might load configuration
  // and return a more sophisticated logger (e.g., Winston, Pino)
  // For now, it simply returns the ConsoleLogger.
  return new ConsoleLogger();
}