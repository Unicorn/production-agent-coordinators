/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Base custom error class for the Agent Coordinator package.
 */
export class AgentCoordinatorError extends Error {
  /**
   * Constructs an AgentCoordinatorError.
   * @param message - The error message.
   */
  constructor(message: string) {
    super(message);
    this.name = 'AgentCoordinatorError';
    Object.setPrototypeOf(this, AgentCoordinatorError.prototype);
  }
}

/**
 * Represents an error specifically related to network or API communication issues.
 */
export class NetworkError extends AgentCoordinatorError {
  /** The HTTP status code if available. */
  public readonly statusCode?: number;

  /**
   * Constructs a NetworkError.
   * @param message - The error message.
   * @param statusCode - Optional HTTP status code.
   */
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Represents an error where a required resource (e.g., agent, message) was not found.
 */
export class NotFoundError extends AgentCoordinatorError {
  /**
   * Constructs a NotFoundError.
   * @param message - The error message.
   */
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Represents an error due to invalid input or request parameters.
 */
export class ValidationError extends AgentCoordinatorError {
  /**
   * Constructs a ValidationError.
   * @param message - The error message.
   */
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Represents an error due to authentication or authorization issues.
 */
export class AuthenticationError extends AgentCoordinatorError {
  /**
   * Constructs an AuthenticationError.
   * @param message - The error message.
   */
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Represents a generic unknown or unexpected error.
 */
export class UnknownError extends AgentCoordinatorError {
  /** The original error object, if available. */
  public readonly originalError?: unknown;

  /**
   * Constructs an UnknownError.
   * @param message - The error message.
   * @param originalError - The original error object that caused this unknown error.
   */
  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'UnknownError';
    this.originalError = originalError;
    Object.setPrototypeOf(this, UnknownError.prototype);
  }
}