/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { STATUS_CODES, ERROR_MESSAGES, APP_CONFIG } from './constants';

describe('STATUS_CODES', () => {
  it('should export correct HTTP-like status codes', () => {
    expect(STATUS_CODES.SUCCESS).toBe(200);
    expect(STATUS_CODES.CREATED).toBe(201);
    expect(STATUS_CODES.NO_CONTENT).toBe(204);
    expect(STATUS_CODES.BAD_REQUEST).toBe(400);
    expect(STATUS_CODES.UNAUTHORIZED).toBe(401);
    expect(STATUS_CODES.FORBIDDEN).toBe(403);
    expect(STATUS_CODES.NOT_FOUND).toBe(404);
    expect(STATUS_CODES.CONFLICT).toBe(409);
    expect(STATUS_CODES.INTERNAL_SERVER_ERROR).toBe(500);
    expect(STATUS_CODES.SERVICE_UNAVAILABLE).toBe(503);
  });

  it('should be a read-only object', () => {
    // Attempting to modify should ideally be a compile-time error for `as const`
    // At runtime, it might throw in strict mode or just not change for primitives
    const codes: { readonly [key: string]: number } = STATUS_CODES;
    // @ts-expect-error - Expected to be read-only
    codes.NEW_CODE = 999;
    expect(codes).not.toHaveProperty('NEW_CODE'); // Runtime check
  });
});

describe('ERROR_MESSAGES', () => {
  it('should export correct error messages', () => {
    expect(ERROR_MESSAGES.INVALID_INPUT).toBe('Invalid input provided.');
    expect(ERROR_MESSAGES.NOT_FOUND).toBe('Resource not found.');
    expect(ERROR_MESSAGES.UNAUTHORIZED_ACCESS).toBe('Unauthorized access.');
    expect(ERROR_MESSAGES.INTERNAL_SERVER_ERROR).toBe('An unexpected internal server error occurred.');
    expect(ERROR_MESSAGES.PERMISSION_DENIED).toBe('Permission denied.');
    expect(ERROR_MESSAGES.OPERATION_FAILED).toBe('The requested operation could not be completed.');
  });

  it('should be a read-only object', () => {
    const messages: { readonly [key: string]: string } = ERROR_MESSAGES;
    // @ts-expect-error - Expected to be read-only
    messages.NEW_MESSAGE = 'New Error';
    expect(messages).not.toHaveProperty('NEW_MESSAGE');
  });
});

describe('APP_CONFIG', () => {
  it('should export correct application configuration defaults', () => {
    expect(APP_CONFIG.DEFAULT_TIMEOUT_MS).toBe(5000);
    expect(APP_CONFIG.MAX_RETRIES).toBe(3);
    expect(APP_CONFIG.LOG_LEVEL).toBe('info');
    expect(APP_CONFIG.DATE_FORMAT).toBe('YYYY-MM-DD HH:mm:ss');
  });

  it('should be a read-only object', () => {
    const config: { readonly [key: string]: string | number } = APP_CONFIG;
    // @ts-expect-error - Expected to be read-only
    config.NEW_SETTING = 'value';
    expect(config).not.toHaveProperty('NEW_SETTING');
  });
});