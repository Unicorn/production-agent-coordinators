/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { AgentId, AgentInfo, AgentStatus, IncomingConnection } from './types';
import { PackageResult } from './interfaces';
import { BernierError } from './errors';

interface AgentRecord extends AgentInfo {
  connection: IncomingConnection;
}

/**
 * Manages the state and connections of agents connected to the coordinator.
 */
export class AgentManager {
  // Map of agentId to AgentRecord
  private readonly connectedAgents: Map<AgentId, AgentRecord> = new Map();
  // Map of connectionId (from AgentServer) to agentId for reverse lookup
  private readonly connectionIdToAgentId: Map<string, AgentId> = new Map();
  // Map of connectionId to IncomingConnection for connections awaiting registration
  private readonly pendingConnections: Map<string, IncomingConnection> = new Map();

  /**
   * Adds a new incoming connection to the pending list, awaiting agent registration.
   * @param connection The incoming connection object.
   */
  public addPendingConnection(connection: IncomingConnection): void {
    if (this.pendingConnections.has(connection.id)) {
      console.warn(`Pending connection ID ${connection.id} already exists. Overwriting.`);
    }
    this.pendingConnections.set(connection.id, connection);
  }

  /**
   * Retrieves a pending connection by its ID.
   * @param connectionId The ID of the pending connection.
   * @returns The IncomingConnection if found, otherwise undefined.
   */
  public getPendingConnection(connectionId: string): IncomingConnection | undefined {
    return this.pendingConnections.get(connectionId);
  }

  /**
   * Removes a pending connection by its ID.
   * @param connectionId The ID of the pending connection to remove.
   */
  public removePendingConnection(connectionId: string): void {
    this.pendingConnections.delete(connectionId);
  }

  /**
   * Registers a pending connection as a connected agent.
   * @param agentId The unique ID of the agent.
   * @param connection The incoming connection associated with this agent.
   * @returns A PackageResult indicating success or failure.
   */
  public registerAgent(agentId: AgentId, connection: IncomingConnection): PackageResult<boolean> {
    if (this.connectedAgents.has(agentId)) {
      // If agent already exists, this might be a reconnect or duplicate registration.
      // In a real system, you'd handle this more gracefully (e.g., close old connection).
      return { success: false, error: `Agent ${agentId} is already registered.` };
    }
    if (this.connectionIdToAgentId.has(connection.id)) {
      return { success: false, error: `Connection ID ${connection.id} is already registered.` };
    }

    const agentRecord: AgentRecord = {
      id: agentId,
      status: AgentStatus.Online, // Assumed online upon successful registration
      lastSeen: Date.now(),
      connection: connection,
    };

    this.connectedAgents.set(agentId, agentRecord);
    this.connectionIdToAgentId.set(connection.id, agentId);
    console.log(`Agent ${agentId} registered with connection ID ${connection.id}.`);
    this.removePendingConnection(connection.id); // Remove from pending list
    return { success: true, data: true };
  }

  /**
   * Removes a connected agent by its ID.
   * @param agentId The ID of the agent to remove.
   * @returns A PackageResult indicating success or failure.
   */
  public removeAgent(agentId: AgentId): PackageResult<boolean> {
    const agentRecord = this.connectedAgents.get(agentId);
    if (!agentRecord) {
      return { success: false, error: `Agent ${agentId} not found.` };
    }

    this.connectedAgents.delete(agentId);
    this.connectionIdToAgentId.delete(agentRecord.connection.id);
    console.log(`Agent ${agentId} removed. Connection ID ${agentRecord.connection.id}.`);
    return { success: true, data: true };
  }

  /**
   * Checks if an agent is currently registered.
   * @param agentId The ID of the agent.
   * @returns True if the agent is registered, false otherwise.
   */
  public isAgentRegistered(agentId: AgentId): boolean {
    return this.connectedAgents.has(agentId);
  }

  /**
   * Retrieves the connection object for a given agent ID.
   * @param agentId The ID of the agent.
   * @returns The IncomingConnection object if found, otherwise undefined.
   */
  public getConnection(agentId: AgentId): IncomingConnection | undefined {
    return this.connectedAgents.get(agentId)?.connection;
  }

  /**
   * Retrieves the AgentRecord for a given agent ID.
   * @param agentId The ID of the agent.
   * @returns The AgentRecord if found, otherwise undefined.
   */
  public getAgentInfo(agentId: AgentId): AgentInfo | undefined {
    const record = this.connectedAgents.get(agentId);
    if (record) {
      // Return a copy or subset to prevent external modification of internal connection object
      const { connection, ...info } = record;
      return info;
    }
    return undefined;
  }

  /**
   * Retrieves the agent ID associated with a given connection ID.
   * @param connectionId The ID of the connection.
   * @returns The AgentId if found, otherwise undefined.
   */
  public getAgentIdByConnectionId(connectionId: string): AgentId | undefined {
    return this.connectionIdToAgentId.get(connectionId);
  }

  /**
   * Updates the status of an agent.
   * @param agentId The ID of the agent.
   * @param status The new status.
   * @returns A PackageResult indicating success or failure.
   */
  public updateAgentStatus(agentId: AgentId, status: AgentStatus): PackageResult<boolean> {
    const agentRecord = this.connectedAgents.get(agentId);
    if (!agentRecord) {
      return { success: false, error: `Agent ${agentId} not found.` };
    }
    agentRecord.status = status;
    agentRecord.lastSeen = Date.now(); // Status update implies recent activity
    return { success: true, data: true };
  }

  /**
   * Updates the last seen timestamp for an agent.
   * @param agentId The ID of the agent.
   * @returns A PackageResult indicating success or failure.
   */
  public updateAgentLastSeen(agentId: AgentId): PackageResult<boolean> {
    const agentRecord = this.connectedAgents.get(agentId);
    if (!agentRecord) {
      return { success: false, error: `Agent ${agentId} not found.` };
    }
    agentRecord.lastSeen = Date.now();
    return { success: true, data: true };
  }

  /**
   * Returns an array of all connected agent IDs.
   * @returns An array of AgentIds.
   */
  public getAllConnectedAgentIds(): AgentId[] {
    return Array.from(this.connectedAgents.keys());
  }

  /**
   * Returns the count of currently connected agents.
   * @returns The number of connected agents.
   */
  public getConnectedAgentsCount(): number {
    return this.connectedAgents.size;
  }

  /**
   * Retrieves a connection by its connection ID.
   * This is primarily for internal use by the coordinator when handling messages from raw connections.
   * @param connectionId The ID of the connection.
   * @returns The IncomingConnection if found, otherwise undefined.
   */
  public getConnectionByConnId(connectionId: string): IncomingConnection | undefined {
    const agentId = this.connectionIdToAgentId.get(connectionId);
    if (agentId) {
      return this.connectedAgents.get(agentId)?.connection;
    }
    return this.pendingConnections.get(connectionId);
  }
}