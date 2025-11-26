/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { AgentConfig, AgentStatus, PackageResult } from './types';

/**
 * Validates an AgentConfig object.
 * @param config The agent configuration to validate.
 * @returns A PackageResult indicating success or failure with an error message.
 */
const validateConfig = (config: AgentConfig): PackageResult<void> => {
  if (!config.id || config.id.trim() === '') {
    return { success: false, error: 'Agent ID cannot be empty.' };
  }
  if (!config.name || config.name.trim() === '') {
    return { success: false, error: 'Agent name cannot be empty.' };
  }
  return { success: true };
};

/**
 * Initializes a new agent with the given configuration.
 * Simulates an asynchronous operation.
 * @param config The configuration for the agent to initialize.
 * @returns A Promise resolving to a PackageResult containing the initialized AgentStatus or an error.
 */
export async function initializeAgent(config: AgentConfig): Promise<PackageResult<AgentStatus>> {
  const validationResult: PackageResult<void> = validateConfig(config);
  if (!validationResult.success) {
    return { success: false, error: validationResult.error };
  }

  try {
    // Simulate async initialization
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

    const status: AgentStatus = {
      id: config.id,
      status: 'online',
      lastPing: new Date(),
    };
    return { success: true, data: status };
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to initialize agent: ${errorMessage}` };
  }
}

/**
 * Retrieves the current status of a specific agent.
 * Simulates an asynchronous operation.
 * @param agentId The unique identifier of the agent.
 * @returns A Promise resolving to a PackageResult containing the AgentStatus or an error.
 */
export async function getAgentStatus(agentId: string): Promise<PackageResult<AgentStatus>> {
  if (!agentId || agentId.trim() === '') {
    return { success: false, error: 'Agent ID cannot be empty.' };
  }

  try {
    // Simulate async fetch
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
    const mockStatus: AgentStatus = {
      id: agentId,
      status: 'online',
      lastPing: new Date(),
    };
    return { success: true, data: mockStatus };
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Failed to get status for agent ${agentId}: ${errorMessage}` };
  }
}

/**
 * Creates a new agent configuration object. This is a synchronous operation.
 * @param id The unique ID for the agent.
 * @param name The name of the agent.
 * @param enabled Whether the agent should be enabled.
 * @returns A PackageResult containing the created AgentConfig or an error.
 */
export function createAgentConfig(id: string, name: string, enabled: boolean): PackageResult<AgentConfig> {
  if (!id || id.trim() === '') {
    return { success: false, error: 'ID is required to create agent config.' };
  }
  if (!name || name.trim() === '') {
    return { success: false, error: 'Name is required to create agent config.' };
  }

  const config: AgentConfig = { id, name, enabled };
  return { success: true, data: config };
}