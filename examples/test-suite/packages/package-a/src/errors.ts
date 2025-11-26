/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Base custom error for coordinator-related operations.
 */
export class CoordinatorError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'COORDINATOR_ERROR') {
    super(message);
    this.name = 'CoordinatorError';
    this.code = code;
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, CoordinatorError.prototype);
  }
}

/**
 * Custom error for agent-related operations.
 */
export class AgentError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'AGENT_ERROR') {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    Object.setPrototypeOf(this, AgentError.prototype);
  }
}

/**
 * Custom error for validation failures (e.g., Zod schema validation).
 * Extends CoordinatorError as validation often applies to coordinator or agent data.
 */
export class ValidationError extends CoordinatorError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Custom error for when a requested resource is not found.
 * Extends CoordinatorError as it can apply to agents or coordinators.
 */
export class NotFoundError extends CoordinatorError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}