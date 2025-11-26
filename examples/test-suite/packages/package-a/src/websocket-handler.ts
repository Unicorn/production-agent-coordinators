/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/
import WebSocket from 'ws';
import { ClientWebSocket, PackageResult, AgentCoordinatorEventType, AgentCoordinatorMessage } from './shared-types';
import { createPackageResult } from './utils';

export class WebSocketHandler {
  private _connectedClients: Map<string, ClientWebSocket>;

  constructor() {
    this._connectedClients = new Map<string, ClientWebSocket>();
  }

  public handleNewConnection(ws: WebSocket, agentId: string): PackageResult<ClientWebSocket> {
    if (this._connectedClients.has(agentId)) {
      return createPackageResult(false, undefined, `Agent with ID ${agentId} is already connected.`);
    }

    const client = ws as ClientWebSocket;
    client.id = agentId;
    this._connectedClients.set(agentId, client);

    return createPackageResult(true, client);
  }

  public sendMessage(agentId: string, message: AgentCoordinatorMessage): PackageResult {
    const client = this._connectedClients.get(agentId);
    if (!client) {
      return createPackageResult(false, undefined, `Agent ${agentId} not found.`);
    }
    try {
      client.send(JSON.stringify(message));
      return createPackageResult(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createPackageResult(false, undefined, `Failed to send message to agent ${agentId}: ${errorMessage}`);
    }
  }

  public broadcastMessage(message: AgentCoordinatorMessage, excludeAgentId?: string): PackageResult {
    try {
      const messageString = JSON.stringify(message);
      let success = true;
      let errorMessage = '';

      this._connectedClients.forEach((client, agentId) => {
        if (excludeAgentId && agentId === excludeAgentId) {
          return;
        }
        try {
          client.send(messageString);
        } catch (error: unknown) {
          success = false;
          const currentErrorMessage = error instanceof Error ? error.message : String(error);
          errorMessage += `Failed to send message to agent ${agentId}: ${currentErrorMessage}. `;
        }
      });
      return createPackageResult(success, undefined, errorMessage || undefined);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createPackageResult(false, undefined, `Failed to stringify message for broadcast: ${errorMessage}`);
    }
  }

  public removeClient(agentId: string): PackageResult {
    if (!this._connectedClients.has(agentId)) {
      return createPackageResult(false, undefined, `Agent ${agentId} not found.`);
    }
    this._connectedClients.delete(agentId);
    return createPackageResult(true);
  }

  public getClient(agentId: string): ClientWebSocket | undefined {
    return this._connectedClients.get(agentId);
  }

  public getConnectedClients(): Map<string, ClientWebSocket> {
    return new Map(this._connectedClients); // Return a clone to prevent external modification
  }
}