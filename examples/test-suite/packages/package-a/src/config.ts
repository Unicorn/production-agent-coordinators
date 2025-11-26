/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { ClientConfig, PackageResult } from './types';
import { ValidationError, AgentCoordinatorError } from './errors';

/**
 * Validates a given client configuration object.
 * Checks for the presence and valid format of required fields like `baseUrl` and `apiKey`.
 * @param config - The client configuration object to validate.
 * @returns A `PackageResult` indicating success or failure with an error message.
 */
export function validateConfig(config: ClientConfig): PackageResult<true> {
  if (!config) {
    return { success: false, error: new ValidationError('Client configuration object is required.').message };
  }
  if (typeof config.baseUrl !== 'string' || config.baseUrl.trim() === '') {
    return { success: false, error: new ValidationError('`baseUrl` is required and must be a non-empty string.').message };
  }
  try {
    // eslint-disable-next-line no-new
    new URL(config.baseUrl); // Validate URL format
  } catch (e: unknown) {
    return { success: false, error: new ValidationError(`\`baseUrl\` is not a valid URL: ${(e as Error).message}`).message };
  }
  if (typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
    return { success: false, error: new ValidationError('`apiKey` is required and must be a non-empty string.').message };
  }
  if (config.timeoutMs !== undefined && (typeof config.timeoutMs !== 'number' || config.timeoutMs < 0)) {
    return { success: false, error: new ValidationError('`timeoutMs` must be a non-negative number if provided.').message };
  }

  return { success: true, data: true };
}

/**
 * Applies default values to a client configuration.
 * @param config - The client configuration object.
 * @returns A `ClientConfig` object with default values applied where missing.
 */
export function applyConfigDefaults(config: ClientConfig): ClientConfig {
  return {
    ...config,
    timeoutMs: config.timeoutMs !== undefined ? config.timeoutMs : 30000, // Default to 30 seconds
  };
}

/**
 * Initializes the client configuration.
 * This function validates the provided configuration and applies default values.
 * @param config - The raw client configuration.
 * @returns A `PackageResult` containing the validated and defaulted configuration or an error.
 */
export function initializeConfig(config: ClientConfig): PackageResult<ClientConfig> {
  const validationResult = validateConfig(config);
  if (!validationResult.success) {
    return { success: false, error: validationResult.error };
  }
  const fullConfig = applyConfigDefaults(config);
  return { success: true, data: fullConfig };
}

/**
 * Retrieves an environment variable.
 * @param key - The name of the environment variable.
 * @returns The value of the environment variable, or `undefined` if not set.
 */
export function getEnvVariable(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

/**
 * Loads configuration from environment variables.
 * @returns A `ClientConfig` object populated from environment variables, or an empty object if not found.
 */
export function loadConfigFromEnv(): Partial<ClientConfig> {
  const config: Partial<ClientConfig> = {};
  const baseUrl = getEnvVariable('AGENT_COORDINATOR_BASE_URL');
  const apiKey = getEnvVariable('AGENT_COORDINATOR_API_KEY');
  const timeout = getEnvVariable('AGENT_COORDINATOR_TIMEOUT_MS');

  if (baseUrl) {
    config.baseUrl = baseUrl;
  }
  if (apiKey) {
    config.apiKey = apiKey;
  }
  if (timeout) {
    const parsedTimeout = parseInt(timeout, 10);
    if (!isNaN(parsedTimeout) && parsedTimeout >= 0) {
      config.timeoutMs = parsedTimeout;
    } else {
      console.warn(`Invalid AGENT_COORDINATOR_TIMEOUT_MS environment variable: ${timeout}. Must be a non-negative number.`);
    }
  }

  return config;
}

/**
 * Creates a configuration object, prioritizing explicit config, then environment variables, then defaults.
 * @param userConfig - Optional user-provided configuration.
 * @returns A `PackageResult` with the final validated configuration or an error.
 */
export function createConfig(userConfig?: Partial<ClientConfig>): PackageResult<ClientConfig> {
  const envConfig = loadConfigFromEnv();

  const finalConfig: ClientConfig = {
    baseUrl: userConfig?.baseUrl ?? envConfig.baseUrl ?? '',
    apiKey: userConfig?.apiKey ?? envConfig.apiKey ?? '',
    timeoutMs: userConfig?.timeoutMs ?? envConfig.timeoutMs,
  };

  if (finalConfig.baseUrl === '' || finalConfig.apiKey === '') {
    return {
      success: false,
      error: new AgentCoordinatorError('Missing required configuration: `baseUrl` and `apiKey` must be provided either directly or via environment variables (AGENT_COORDINATOR_BASE_URL, AGENT_COORDINATOR_API_KEY).').message,
    };
  }

  return initializeConfig(finalConfig);
}