/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { type PackageResult } from './types';

// Define the shape of your application configuration
export interface AppConfig {
  agentName: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  agentId: string;
  [key: string]: unknown; // Allow for flexible configuration extensions
}

const DEFAULT_CONFIG_PATH = 'config.json';

/**
 * Loads the application configuration from a JSON file.
 * @param configPath The path to the configuration file. Defaults to 'config.json'.
 * @returns A PackageResult containing the loaded configuration or an error.
 */
export async function loadConfig(configPath?: string): Promise<PackageResult<AppConfig>> {
  const filePath = configPath ? path.resolve(configPath) : path.resolve(process.cwd(), DEFAULT_CONFIG_PATH);

  try {
    const fileContent = await fs.readFile(filePath, { encoding: 'utf-8' });
    const config = JSON.parse(fileContent) as AppConfig;

    // Basic validation for required fields
    if (!config.agentName) {
      return { success: false, error: 'Configuration missing "agentName" field.' };
    }
    if (!config.agentId) {
      return { success: false, error: 'Configuration missing "agentId" field.' };
    }
    if (!config.logLevel || !['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
      config.logLevel = 'info'; // Default if missing or invalid
    }

    return { success: true, data: config };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { success: false, error: `Failed to load or parse configuration from ${filePath}: ${error.message}` };
    }
    return { success: false, error: `An unknown error occurred while loading configuration from ${filePath}.` };
  }
}

/**
 * Validates a given AppConfig object.
 * This can be used for runtime validation or before saving.
 * @param config The AppConfig object to validate.
 * @returns A PackageResult indicating validation success or failure.
 */
export function validateConfig(config: AppConfig): PackageResult<boolean> {
  if (!config.agentName || typeof config.agentName !== 'string') {
    return { success: false, error: 'Configuration requires a valid "agentName" string.' };
  }
  if (!config.agentId || typeof config.agentId !== 'string') {
    return { success: false, error: 'Configuration requires a valid "agentId" string.' };
  }
  if (!config.logLevel || !['debug', 'info', 'warn', 'error'].includes(config.logLevel)) {
    return { success: false, error: 'Configuration "logLevel" must be one of "debug", "info", "warn", "error".' };
  }
  // Add more specific validation rules as needed
  return { success: true, data: true };
}