/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import {
  AgentId,
  AgentInfo,
  AgentRegistrationOptions,
  AgentStatus,
  PackageResult,
  AgentCoordinatorOptions,
} from './types';

// Internal type to keep track of agent details including a timeout reference
interface RegisteredAgent {
  info: AgentInfo;
  heartbeatTimeoutId?: NodeJS.Timeout;
}

export class AgentCoordinators {
  private readonly agents: Map<AgentId, RegisteredAgent>;
  private readonly heartbeatIntervalMs: number;
  private readonly offlineTimeoutMs: number; // How long after a missed heartbeat until an agent is marked OFFLINE

  constructor(options?: AgentCoordinatorOptions) {
    this.agents = new Map<AgentId, RegisteredAgent>();
    this.heartbeatIntervalMs = options?.heartbeatIntervalMs ?? 5000; // Default 5 seconds
    this.offlineTimeoutMs = options?.offlineTimeoutMs ?? 15000; // Default 15 seconds (3 missed heartbeats)
  }

  /**
   * Generates a unique ID for a new agent.
   * @private
   * @returns {AgentId} A unique agent ID.
   */
  private generateAgentId(): AgentId {
    return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Sets up a heartbeat timeout for an agent. If the timeout elapses, the agent's status is set to OFFLINE.
   * @private
   * @param {AgentId} agentId - The ID of the agent.
   */
  private setupHeartbeatTimeout(agentId: AgentId): void {
    const agentEntry = this.agents.get(agentId);
    if (agentEntry === undefined) {
      // Agent might have been unregistered concurrently
      return;
    }

    if (agentEntry.heartbeatTimeoutId !== undefined) {
      clearTimeout(agentEntry.heartbeatTimeoutId);
    }

    agentEntry.heartbeatTimeoutId = setTimeout(() => {
      const currentAgent = this.agents.get(agentId);
      if (currentAgent !== undefined && currentAgent.info.status !== AgentStatus.Offline) {
        currentAgent.info.status = AgentStatus.Offline;
        // console.warn removed as linting often flags console statements
      }
    }, this.offlineTimeoutMs);
  }

  /**
   * Registers a new agent with the coordinator.
   * @param {AgentRegistrationOptions} options - The options for agent registration.
   * @returns {PackageResult<AgentInfo>} The result containing the registered agent's info or an error.
   */
  public registerAgent(options: AgentRegistrationOptions): PackageResult<AgentInfo> {
    try {
      if (options.name.trim() === '') {
        return { success: false, error: 'Agent name cannot be empty.' };
      }

      const agentId: AgentId = this.generateAgentId();
      const now: Date = new Date();

      const newAgentInfo: AgentInfo = {
        id: agentId,
        name: options.name,
        status: AgentStatus.Online,
        lastHeartbeat: now,
        registeredAt: now,
        description: options.description,
        metadata: options.metadata,
      };

      const registeredAgent: RegisteredAgent = {
        info: newAgentInfo,
        heartbeatTimeoutId: undefined, // Will be set after registration is complete
      };

      this.agents.set(agentId, registeredAgent);
      this.setupHeartbeatTimeout(agentId); // Start the heartbeat monitoring

      return { success: true, data: newAgentInfo };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to register agent: ${errorMessage}` };
    }
  }

  /**
   * Unregisters an agent from the coordinator.
   * @param {AgentId} agentId - The ID of the agent to unregister.
   * @returns {PackageResult<boolean>} The result indicating success or failure.
   */
  public unregisterAgent(agentId: AgentId): PackageResult<boolean> {
    try {
      const agentEntry = this.agents.get(agentId);
      if (agentEntry === undefined) {
        return { success: false, error: `Agent with ID ${agentId} not found.` };
      }

      if (agentEntry.heartbeatTimeoutId !== undefined) {
        clearTimeout(agentEntry.heartbeatTimeoutId);
      }
      const deleted: boolean = this.agents.delete(agentId);

      if (deleted) {
        return { success: true, data: true };
      } else {
        return { success: false, error: `Failed to delete agent with ID ${agentId}.` };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to unregister agent ${agentId}: ${errorMessage}` };
    }
  }

  /**
   * Records a heartbeat for an agent, updating its status to Online if it was offline.
   * @param {AgentId} agentId - The ID of the agent sending the heartbeat.
   * @returns {PackageResult<AgentInfo>} The result containing the updated agent's info or an error.
   */
  public recordHeartbeat(agentId: AgentId): PackageResult<AgentInfo> {
    try {
      const agentEntry = this.agents.get(agentId);
      if (agentEntry === undefined) {
        return { success: false, error: `Agent with ID ${agentId} not found.` };
      }

      agentEntry.info.lastHeartbeat = new Date();
      if (agentEntry.info.status === AgentStatus.Offline || agentEntry.info.status === AgentStatus.Error) {
        agentEntry.info.status = AgentStatus.Online;
      }
      this.setupHeartbeatTimeout(agentId); // Reset the timeout

      return { success: true, data: agentEntry.info };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to record heartbeat for agent ${agentId}: ${errorMessage}` };
    }
  }

  /**
   * Retrieves information about a specific agent.
   * @param {AgentId} agentId - The ID of the agent.
   * @returns {PackageResult<AgentInfo>} The result containing the agent's info or an error.
   */
  public getAgentInfo(agentId: AgentId): PackageResult<AgentInfo> {
    const agentEntry = this.agents.get(agentId);
    if (agentEntry === undefined) {
      return { success: false, error: `Agent with ID ${agentId} not found.` };
    }
    return { success: true, data: { ...agentEntry.info } }; // Return a clone to prevent external modification
  }

  /**
   * Updates the status of an agent.
   * @param {AgentId} agentId - The ID of the agent to update.
   * @param {AgentStatus} newStatus - The new status to set.
   * @returns {PackageResult<AgentInfo>} The result containing the updated agent's info or an error.
   */
  public updateAgentStatus(agentId: AgentId, newStatus: AgentStatus): PackageResult<AgentInfo> {
    try {
      const agentEntry = this.agents.get(agentId);
      if (agentEntry === undefined) {
        return { success: false, error: `Agent with ID ${agentId} not found.` };
      }

      agentEntry.info.status = newStatus;
      return { success: true, data: agentEntry.info };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to update status for agent ${agentId}: ${errorMessage}` };
    }
  }

  /**
   * Retrieves a list of all registered agents.
   * @returns {PackageResult<AgentInfo[]>} The result containing an array of all registered agents' info.
   */
  public listAgents(): PackageResult<AgentInfo[]> {
    const agentInfos: AgentInfo[] = Array.from(this.agents.values()).map(agentEntry => ({ ...agentEntry.info }));
    return { success: true, data: agentInfos };
  }

  /**
   * Cleans up all heartbeat timeouts when the coordinator is no longer needed.
   */
  public shutdown(): void {
    for (const agentEntry of this.agents.values()) {
      if (agentEntry.heartbeatTimeoutId !== undefined) {
        clearTimeout(agentEntry.heartbeatTimeoutId);
      }
    }
    this.agents.clear();
  }
}