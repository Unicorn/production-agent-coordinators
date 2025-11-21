import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../src/logger.js';
import type { LogLevel } from '../src/types.js';

describe('Logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a logger with default timestamp', () => {
    const logger = createLogger({ level: 'info' });
    expect(logger).toBeDefined();
    expect(logger.debug).toBeTypeOf('function');
    expect(logger.info).toBeTypeOf('function');
    expect(logger.warn).toBeTypeOf('function');
    expect(logger.error).toBeTypeOf('function');
  });

  it('should log info messages when level is info', () => {
    const logger = createLogger({ level: 'info', timestamp: false });
    logger.info('test message');
    expect(consoleInfoSpy).toHaveBeenCalledWith('test message');
  });

  it('should not log debug messages when level is info', () => {
    const logger = createLogger({ level: 'info', timestamp: false });
    logger.debug('debug message');
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should include timestamps when enabled', () => {
    const logger = createLogger({ level: 'info', timestamp: true });
    logger.info('test');
    const call = consoleInfoSpy.mock.calls[0][0] as string;
    expect(call).toMatch(/^\[\d{4}-\d{2}-\d{2}T.*\] test$/);
  });

  it('should handle error objects', () => {
    const logger = createLogger({ level: 'error', timestamp: false });
    const error = new Error('test error');
    logger.error('An error occurred', error);
    expect(consoleErrorSpy).toHaveBeenCalledWith('An error occurred', error);
  });

  it('should filter by log level correctly', () => {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    
    levels.forEach((level) => {
      const logger = createLogger({ level, timestamp: false });
      
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      const debugCalled = consoleLogSpy.mock.calls.length > 0;
      const infoCalled = consoleInfoSpy.mock.calls.length > 0;
      const warnCalled = consoleWarnSpy.mock.calls.length > 0;
      const errorCalled = consoleErrorSpy.mock.calls.length > 0;

      if (level === 'debug') {
        expect(debugCalled).toBe(true);
        expect(infoCalled).toBe(true);
        expect(warnCalled).toBe(true);
        expect(errorCalled).toBe(true);
      } else if (level === 'info') {
        expect(debugCalled).toBe(false);
        expect(infoCalled).toBe(true);
        expect(warnCalled).toBe(true);
        expect(errorCalled).toBe(true);
      } else if (level === 'warn') {
        expect(debugCalled).toBe(false);
        expect(infoCalled).toBe(false);
        expect(warnCalled).toBe(true);
        expect(errorCalled).toBe(true);
      } else if (level === 'error') {
        expect(debugCalled).toBe(false);
        expect(infoCalled).toBe(false);
        expect(warnCalled).toBe(false);
        expect(errorCalled).toBe(true);
      }

      vi.clearAllMocks();
    });
  });
});
