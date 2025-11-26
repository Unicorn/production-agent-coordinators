/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult } from './errorHandling';
import { AgentConfig, ValidatorFunction } from './interfaces';
import { validateAgentConfigSchema } from './validators';

/**
 * Validates an agent configuration against a predefined schema.
 *
 * @param {AgentConfig} config - The agent configuration object to validate.
 * @returns {PackageResult<AgentConfig>} A result object indicating success or failure,
 *                                       with the validated config or an error message.
 */
export function validateAgentConfig(config: AgentConfig): PackageResult<AgentConfig> {
  return validateAgentConfigSchema(config);
}

/**
 * Registers a custom validator function for the agent configuration.
 * This allows extending the validation logic beyond the base schema.
 *
 * @param {string} _validatorName - A unique name for the validator.
 * @param {ValidatorFunction} _validatorFn - The custom validator function.
 * @returns {PackageResult<boolean>} A result object indicating success or failure.
 */
export function registerCustomValidator(
  _validatorName: string,
  _validatorFn: ValidatorFunction
): PackageResult<boolean> {
  // In a real scenario, this would involve storing the validator
  // and integrating it into the validation flow. For now, it's a placeholder.
  return { success: true, data: true };
}

/**
 * Re-exports core types and interfaces for convenience.
 */
export { AgentConfig, PackageResult, ValidatorFunction };
```