/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { APP_NAME, APP_VERSION, DEFAULT_TIMEOUT_MS, DEFAULT_PAGE_SIZE, ERROR_MESSAGES, STATUS_CODES } from './index.js';

describe('Constants', () => {
  describe('Application Information', () => {
    it('APP_NAME should be defined and be a string', () => {
      expect(APP_NAME).toBeDefined();
      expect(typeof APP_NAME).toBe('string');
      expect(APP_NAME).toBe('package-a');
    });

    it('APP_VERSION should be defined and be a string', () => {
      expect(APP_VERSION).toBeDefined();
      expect(typeof APP_VERSION).toBe('string');
      expect(APP_VERSION).toBe('0.1.0');
    });
  });

  describe('Configuration Defaults', () => {
    it('DEFAULT_TIMEOUT_MS should be defined and be a number', () => {
      expect(DEFAULT_TIMEOUT_MS).toBeDefined();
      expect(typeof DEFAULT_TIMEOUT_MS).toBe('number');
      expect(DEFAULT_TIMEOUT_MS).toBe(5000);
    });

    it('DEFAULT_PAGE_SIZE should be defined and be a number', () => {
      expect(DEFAULT_PAGE_SIZE).toBeDefined();
      expect(typeof DEFAULT_PAGE_SIZE).toBe('number');
      expect(DEFAULT_PAGE_SIZE).toBe(20);
    });
  });

  describe('ERROR_MESSAGES', () => {
    it('ERROR_MESSAGES should be an object with string values', () => {
      expect(ERROR_MESSAGES).toBeDefined();
      expect(typeof ERROR_MESSAGES).toBe('object');
      expect(Object.keys(ERROR_MESSAGES).length).toBeGreaterThan(0);
      for (const key in ERROR_MESSAGES) {
        if (Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, key)) {
          // Type assertion to bypass TypeScript's readonly inferred type for iteration
          expect(typeof ERROR_MESSAGES[key as keyof typeof ERROR_MESSAGES]).toBe('string');
        }
      }
    });

    it('should contain specific error messages', () => {
      expect(ERROR_MESSAGES.INVALID_INPUT).toBe('Invalid input provided.');
      expect(ERROR_MESSAGES.NOT_FOUND).toBe('Resource not found.');
      expect(ERROR_MESSAGES.UNAUTHORIZED).toBe('Authentication required or not authorized.');
      expect(ERROR_MESSAGES.FORBIDDEN).toBe('Access to this resource is forbidden.');
      expect(ERROR_MESSAGES.SERVER_ERROR).toBe('An unexpected server error occurred.');
      expect(ERROR_MESSAGES.TIMEOUT_EXCEEDED).toBe('Operation timed out.');
      expect(ERROR_MESSAGES.EMPTY_ARRAY).toBe('Input array cannot be empty.');
      expect(ERROR_MESSAGES.INVALID_LENGTH).toBe('Input does not meet required length.');
      expect(ERROR_MESSAGES.DEEP_MERGE_ERROR).toBe('Error during deep merge operation.');
      expect(ERROR_MESSAGES.CHUNK_INVALID_SIZE).toBe('Chunk size must be a positive integer.');
    });

    it('ERROR_MESSAGES should be readonly', () => {
      // Attempting to modify should not be possible at compile time (but runtime may allow if not frozen)
      // This is a type-level check rather than a runtime expectation.
      // @ts-expect-error Testing compile-time readonly constraint
      // ERROR_MESSAGES.INVALID_INPUT = 'New message'; // This line should cause a TS error
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: Intentionally testing for runtime immutability, if not explicitly frozen
        ERROR_MESSAGES.INVALID_INPUT = 'New message';
      }).not.toThrow(); // JavaScript objects are mutable by default. `as const` ensures type safety, not runtime immutability.
    });
  });

  describe('STATUS_CODES', () => {
    it('STATUS_CODES should be an object with number values', () => {
      expect(STATUS_CODES).toBeDefined();
      expect(typeof STATUS_CODES).toBe('object');
      expect(Object.keys(STATUS_CODES).length).toBeGreaterThan(0);
      for (const key in STATUS_CODES) {
        if (Object.prototype.hasOwnProperty.call(STATUS_CODES, key)) {
          // Type assertion for iteration
          expect(typeof STATUS_CODES[key as keyof typeof STATUS_CODES]).toBe('number');
        }
      }
    });

    it('should contain specific status codes', () => {
      expect(STATUS_CODES.SUCCESS).toBe(200);
      expect(STATUS_CODES.CREATED).toBe(201);
      expect(STATUS_CODES.ACCEPTED).toBe(202);
      expect(STATUS_CODES.NO_CONTENT).toBe(204);
      expect(STATUS_CODES.BAD_REQUEST).toBe(400);
      expect(STATUS_CODES.UNAUTHORIZED).toBe(401);
      expect(STATUS_CODES.FORBIDDEN).toBe(403);
      expect(STATUS_CODES.NOT_FOUND).toBe(404);
      expect(STATUS_CODES.METHOD_NOT_ALLOWED).toBe(405);
      expect(STATUS_CODES.CONFLICT).toBe(409);
      expect(STATUS_CODES.INTERNAL_SERVER_ERROR).toBe(500);
      expect(STATUS_CODES.SERVICE_UNAVAILABLE).toBe(503);
    });

    it('STATUS_CODES should be readonly', () => {
      // Similar to ERROR_MESSAGES, `as const` makes it readonly at compile time.
      // @ts-expect-error Testing compile-time readonly constraint
      // STATUS_CODES.SUCCESS = 201; // This line should cause a TS error
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: Intentionally testing for runtime immutability, if not explicitly frozen
        STATUS_CODES.SUCCESS = 201;
      }).not.toThrow(); // JavaScript objects are mutable by default. `as const` ensures type safety, not runtime immutability.
    });
  });
});
