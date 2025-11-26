/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import WebSocket from 'ws';
import { AgentServer } from './server';
import { AgentManager } from './manager';
import { AgentId, AgentMessage, CoordinatorConfig, IncomingConnection } from './types';
import { PackageResult } from './interfaces';
import { BernierError, NetworkError, ValidationError } from './errors';
import { safeJsonParse, safeJsonStringify } from './utils';

export class AgentCoordinator {
  private readonly config: CoordinatorConfig;
  private agentServer: AgentServer | null = null;
  private agentManager: AgentManager;

  constructor(config: CoordinatorConfig) {
    this.config = {
      port: config.port,
      host: config.host,
      maxAgents: config.maxAgents ?? 100, // Default to 100 max agents
    };
    this.agentManager = new AgentManager();
    console.log(`AgentCoordinator initialized on ${this.config.host}:${this.config.port} with maxAgents: ${this.config.maxAgents}`);
  }

  /**
   * Starts the agent coordinator server.
   * @returns A PackageResult indicating the success or failure of starting the server.
   */
  public async start(): Promise<PackageResult<boolean>> {
    if (this.agentServer && this.agentServer.isListening()) {
      return { success: false, error: 'Coordinator is already running.' };
    }

    try {
      this.agentServer = new AgentServer(this.config);
      this.agentServer.onConnection(this.handleNewConnection.bind(this));
      this.agentServer.onMessage(this.handleIncomingMessage.bind(this));
      this.agentServer.onClose(this.handleConnectionClose.bind(this));
      this.agentServer.onError(this.handleServerError.bind(this));

      const result = await this.agentServer.start();
      if (result.success) {
        console.log(`AgentCoordinator listening on ${this.config.host}:${this.config.port}`);
      }
      return result;
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { success: false, error: new NetworkError(`Failed to start coordinator: ${err.message}`).message };
      }
      return { success: false, error: new NetworkError('Failed to start coordinator: Unknown error').message };
    }
  }

  /**
   * Stops the agent coordinator server.
   * @returns A PackageResult indicating the success or failure of stopping the server.
   */
  public async stop(): Promise<PackageResult<boolean>> {
    if (!this.agentServer || !this.agentServer.isListening()) {
      return { success: false, error: 'Coordinator is not running.' };
    }

    try {
      // Disconnect all managed agents gracefully
      this.agentManager.getAllConnectedAgentIds().forEach(agentId => {
        const disconnectResult = this.disconnectAgent(agentId);
        if (!disconnectResult.success) {
          console.warn(`Failed to disconnect agent ${agentId} during shutdown: ${disconnectResult.error}`);
        }
      });

      const result = await this.agentServer.stop();
      if (result.success) {
        console.log('AgentCoordinator stopped successfully.');
      }
      return result;
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { success: false, error: new BernierError(`Failed to stop coordinator: ${err.message}`).message };
      }
      return { success: false, error: new BernierError('Failed to stop coordinator: Unknown error').message };
    }
  }

  /**
   * Sends a message to a specific agent.
   * @param agentId The ID of the recipient agent.
   * @param message The message to send.
   * @returns A PackageResult indicating the success or failure of sending the message.
   */
  public async sendMessageToAgent(agentId: AgentId, message: AgentMessage): Promise<PackageResult<boolean>> {
    const agentConnection = this.agentManager.getConnection(agentId);
    if (!agentConnection) {
      return { success: false, error: `Agent ${agentId} is not connected.` };
    }

    const stringifyResult = safeJsonStringify(message);
    if (!stringifyResult.success || !stringifyResult.data) {
      return { success: false, error: `Failed to serialize message: ${stringifyResult.error || 'Unknown stringify error'}` };
    }

    try {
      agentConnection.socket.send(stringifyResult.data);
      return { success: true, data: true };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { success: false, error: new NetworkError(`Failed to send message to agent ${agentId}: ${err.message}`).message };
      }
      return { success: false, error: new NetworkError(`Failed to send message to agent ${agentId}: Unknown error`).message };
    }
  }

  /**
   * Disconnects a specific agent.
   * @param agentId The ID of the agent to disconnect.
   * @returns A PackageResult indicating the success or failure of the disconnection.
   */
  public disconnectAgent(agentId: AgentId): PackageResult<boolean> {
    const agentConnection = this.agentManager.getConnection(agentId);
    if (!agentConnection) {
      return { success: false, error: `Agent ${agentId} is not connected.` };
    }
    try {
      agentConnection.socket.close(1000, 'Coordinator initiated disconnect');
      this.agentManager.removeAgent(agentId);
      console.log(`Agent ${agentId} disconnected by coordinator.`);
      return { success: true, data: true };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { success: false, error: new NetworkError(`Failed to disconnect agent ${agentId}: ${err.message}`).message };
      }
      return { success: false, error: new NetworkError(`Failed to disconnect agent ${agentId}: Unknown error`).message };
    }
  }

  // --- Private Event Handlers for AgentServer ---
  private handleNewConnection(connection: IncomingConnection): void {
    console.log(`New incoming connection from ${connection.ipAddress}. Connection ID: ${connection.id}`);
    // Temporarily store connection, waiting for 'agent-register' message
    this.agentManager.addPendingConnection(connection);
    // Optionally, implement a timeout for registration
  }

  private handleIncomingMessage(connectionId: string, message: string): void {
    const parseResult = safeJsonParse<AgentMessage>(message);
    if (!parseResult.success || !parseResult.data) {
      console.warn(`Invalid message received from connection ${connectionId}: ${parseResult.error}`);
      this.agentManager.getConnectionByConnId(connectionId)?.socket.close(4000, 'Invalid message format');
      return;
    }

    const agentMessage = parseResult.data;
    const { type, payload, senderId } = agentMessage;

    // Handle agent registration
    if (type === 'agent-register') {
      if (!senderId) {
        console.warn(`Registration message from ${connectionId} missing senderId.`);
        this.agentManager.getConnectionByConnId(connectionId)?.socket.close(4001, 'Missing Agent ID in registration');
        return;
      }
      if (this.agentManager.isAgentRegistered(senderId)) {
        console.warn(`Agent ${senderId} already registered. Closing old connection or new one.`);
        // Decide whether to close old connection or new one. For simplicity, close new one.
        this.agentManager.getConnectionByConnId(connectionId)?.socket.close(4002, 'Agent ID already in use');
        return;
      }
      if (this.agentManager.getConnectedAgentsCount() >= (this.config.maxAgents || Infinity)) {
        console.warn(`Max agents reached (${this.config.maxAgents}). Rejecting agent ${senderId}.`);
        this.agentManager.getConnectionByConnId(connectionId)?.socket.close(4003, 'Max agents reached');
        return;
      }

      const pendingConn = this.agentManager.getPendingConnection(connectionId);
      if (pendingConn) {
        this.agentManager.registerAgent(senderId, pendingConn);
        console.log(`Agent ${senderId} registered and connected. Total agents: ${this.agentManager.getConnectedAgentsCount()}`);
        this.agentManager.removePendingConnection(connectionId);
        // Send a registration acknowledgement back to the agent
        const ackMessage: AgentMessage = {
          type: 'register-ack',
          payload: { success: true, agentId: senderId },
          timestamp: Date.now(),
          recipientId: senderId,
          senderId: 'coordinator',
        };
        this.sendMessageToAgent(senderId, ackMessage).catch(err =>
          console.error(`Failed to send registration ACK to agent ${senderId}: ${err.error || err}`)
        );
      } else {
        console.error(`Attempt to register agent ${senderId} from unknown pending connection ID ${connectionId}`);
        this.agentManager.getConnectionByConnId(connectionId)?.socket.close(4004, 'Unknown connection for registration');
      }
      return;
    }

    // For non-registration messages, senderId must be known and registered
    if (!senderId || !this.agentManager.isAgentRegistered(senderId)) {
      console.warn(`Message from unknown or unregistered agent connection ID ${connectionId}. SenderId: ${senderId || 'N/A'}`);
      this.agentManager.getConnectionByConnId(connectionId)?.socket.close(4005, 'Unregistered agent');
      return;
    }

    // Update agent's last seen timestamp
    this.agentManager.updateAgentLastSeen(senderId);

    // Handle other message types
    switch (type) {
      case 'ping':
        console.debug(`Received ping from agent ${senderId}. Sending pong.`);
        const pongMessage: AgentMessage = {
          type: 'ping-response',
          payload: {},
          timestamp: Date.now(),
          recipientId: senderId,
          senderId: 'coordinator',
          correlationId: agentMessage.correlationId, // Reflect correlation ID if present
        };
        this.sendMessageToAgent(senderId, pongMessage).catch(err =>
          console.error(`Failed to send ping response to ${senderId}: ${err.error || err}`)
        );
        break;
      case 'agent-status':
        console.log(`Agent ${senderId} status update: ${payload.status}`);
        if (typeof payload.status === 'string') {
          this.agentManager.updateAgentStatus(senderId, payload.status as any); // Type assertion needed here
        }
        break;
      case 'data':
        console.log(`Received data from agent ${senderId}: ${JSON.stringify(payload)}`);
        // Process data, potentially forward to other services/agents
        break;
      default:
        console.warn(`Unknown message type "${type}" from agent ${senderId}.`);
    }
  }

  private handleConnectionClose(connectionId: string, code: number, reason: string): void {
    console.log(`Connection ${connectionId} closed. Code: ${code}, Reason: ${reason}`);
    const agentId = this.agentManager.getAgentIdByConnectionId(connectionId);
    if (agentId) {
      this.agentManager.removeAgent(agentId);
      console.log(`Agent ${agentId} disconnected. Total agents: ${this.agentManager.getConnectedAgentsCount()}`);
    } else {
      this.agentManager.removePendingConnection(connectionId);
      console.log(`Pending connection ${connectionId} removed.`);
    }
  }

  private handleServerError(error: Error): void {
    console.error(`Coordinator Server Error: ${error.message}`);
    // Potentially attempt to restart the server or notify administrators
  }

  /**
   * Returns a list of all currently connected agent IDs.
   * @returns An array of AgentIds.
   */
  public getConnectedAgents(): AgentId[] {
    return this.agentManager.getAllConnectedAgentIds();
  }

  /**
   * Get information about a specific agent.
   * @param agentId The ID of the agent.
   * @returns A PackageResult containing AgentInfo or an error.
   */
  public getAgentInfo(agentId: AgentId): PackageResult<AgentId> { // Corrected return type for getAgentInfo
    const agentInfo = this.agentManager.getAgentInfo(agentId);
    if (agentInfo) {
      return { success: true, data: agentInfo.id }; // Return the agent ID, or more detailed info if AgentInfo was returned.
    }
    return { success: false, error: `Agent ${agentId} not found.` };
  }
}
```