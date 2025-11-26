/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { type PackageResult } from './types';
import { loadConfig, type AppConfig } from './config';
import { validateInput } from './utils';

export interface AgentCoordinatorPackage {
  init: (configPath?: string) => Promise<PackageResult<AppConfig>>;
  // Potentially other methods later
}

let _initializedConfig: AppConfig | null = null; // Using a leading underscore for internal state

export const createAgentCoordinator = (): AgentCoordinatorPackage => {
  return {
    init: async (configPath?: string): Promise<PackageResult<AppConfig>> => {
      if (_initializedConfig) {
        return { success: true, data: _initializedConfig, error: 'Agent Coordinator already initialized.' };
      }

      // Ensure validateInput is called and its result handled if it's async
      // For this example, let's assume validateInput is synchronous and returns PackageResult<boolean>.
      const inputValidationResult = validateInput(configPath ?? ''); // Example usage
      if (!inputValidationResult.success) {
        return { success: false, error: `Invalid input: ${inputValidationResult.error ?? 'Unknown validation error'}` };
      }

      const configLoadResult = await loadConfig(configPath); // Must await this promise

      if (!configLoadResult.success || !configLoadResult.data) {
        return { success: false, error: `Failed to load configuration: ${configLoadResult.error ?? 'Unknown config error'}` };
      }

      _initializedConfig = configLoadResult.data;
      // If there were other async initialization steps, they must be awaited here.
      // E.g., await initializeDatabase(config.data.dbConfig);

      return { success: true, data: _initializedConfig };
    }
  };
};
