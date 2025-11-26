/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Base custom error for the Bernier LLC package.
 */
export class BernierError extends Error {
  /**
   * Creates an instance of BernierError.
   * @param message The error message.
   * @param options Additional options for the error.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BernierError';
    Object.setPrototypeOf(this, BernierError.prototype);
  }
}

/**
 * Error specifically for validation failures.
 */
export class ValidationError extends BernierError {
  /**
   * Creates an instance of ValidationError.
   * @param message The error message.
   * @param options Additional options for the error.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}