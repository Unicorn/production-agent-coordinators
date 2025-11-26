/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult } from './interfaces';

/**
 * Base custom error for the package.
 */
export class BernierError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'BERNIER_ERROR') {
    super(message);
    this.name = 'BernierError';
    this.code = code;
    Object.setPrototypeOf(this, BernierError.prototype);
  }

  /**
   * Creates a PackageResult indicating failure from this error.
   * @param data Optional data to include in the error result.
   * @returns A failed PackageResult.
   */
  public toPackageResult<T = unknown>(data?: T): PackageResult<T> {
    return {
      success: false,
      error: this.message,
      data: data,
    };
  }
}

/**
 * Error specifically for network or communication issues.
 */
export class NetworkError extends BernierError {
  constructor(message: string, code: string = 'NETWORK_ERROR') {
    super(message, code);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Error for invalid input or arguments.
 */
export class ValidationError extends BernierError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, code);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Error for authentication or authorization failures.
 */
export class AuthError extends BernierError {
  constructor(message: string, code: string = 'AUTH_ERROR') {
    super(message, code);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Error for when a resource is not found.
 */
export class NotFoundError extends BernierError {
  constructor(message: string, code: string = 'NOT_FOUND_ERROR') {
    super(message, code);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Error for when an operation times out.
 */
export class TimeoutError extends BernierError {
  constructor(message: string, code: string = 'TIMEOUT_ERROR') {
    super(message, code);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
```