/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import WebSocket from 'ws';
import { AgentClientConfig, AgentId, AgentMessage, AgentStatus } from './types';
import { PackageResult } from './interfaces';
import { BernierError, NetworkError } from './errors';
import { delay, safeJsonParse, safeJsonStringify } from './utils';

export class AgentClient {
  private ws: WebSocket | null = null;
  private readonly config: AgentClientConfig;
  private status: AgentStatus = AgentStatus.Offline;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS: number = 10;
  private readonly RECONNECT_DELAY_MS: number = 5000;
  private readonly PING_INTERVAL_MS: number = 30000; // 30 seconds
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(config: AgentClientConfig) {
    this.config = config;
    // Ensure agentId is always present in config
    if (!config.agentId) {
      throw new BernierError('AgentClientConfig must include an agentId', 'CLIENT_CONFIG_ERROR');
    }
    console.log(`AgentClient created for ID: ${config.agentId}`);
  }

  public getAgentId(): AgentId {
    return this.config.agentId;
  }

  public getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Connects the agent client to the coordinator.
   * Handles initial connection and manages reconnection logic.
   * @returns A PackageResult indicating the success or failure of the connection attempt.
   */
  public async connect(): Promise<PackageResult<boolean>> {
    if (this.status === AgentStatus.Connecting || this.status === AgentStatus.Online) {
      return { success: true, data: true, error: 'Already connecting or online.' };
    }

    this.status = AgentStatus.Connecting;
    console.log(`Agent ${this.config.agentId} attempting to connect to ws://${this.config.coordinatorHost}:${this.config.coordinatorPort}`);

    try {
      this.ws = new WebSocket(`ws://${this.config.coordinatorHost}:${this.config.coordinatorPort}`);

      // Setup event listeners
      this.ws.onopen = () => this.handleOpen();
      this.ws.onmessage = (event: WebSocket.MessageEvent) => this.handleMessage(event);
      this.ws.onerror = (event: WebSocket.ErrorEvent) => this.handleError(event);
      this.ws.onclose = (event: WebSocket.CloseEvent) => this.handleClose(event);

      // Await connection or error
      return new Promise((resolve) => {
        const onOpen = (): void => {
          this.cleanupConnectionListeners();
          resolve({ success: true, data: true });
        };
        const onError = (errorEvent: WebSocket.ErrorEvent): void => {
          this.cleanupConnectionListeners();
          resolve({ success: false, error: new NetworkError(`Failed to connect: ${errorEvent.message || 'Unknown network error'}`).message });
        };

        // Add temporary listeners for initial connection outcome
        this.ws?.addEventListener('open', onOpen, { once: true });
        this.ws?.addEventListener('error', onError, { once: true });
      });

    } catch (err: unknown) {
      this.status = AgentStatus.Offline;
      if (err instanceof Error) {
        return { success: false, error: new NetworkError(`Failed to initiate WebSocket connection: ${err.message}`).message };
      }
      return { success: false, error: new NetworkError('Failed to initiate WebSocket connection: Unknown error').message };
    }
  }

  /**
   * Disconnects the agent client from the coordinator.
   * @returns A PackageResult indicating the success or failure of the disconnection.
   */
  public disconnect(): PackageResult<boolean> {
    if (this.ws && (this.status === AgentStatus.Online || this.status === AgentStatus.Connecting)) {
      this.stopPing();
      this.ws.close(1000, 'Client initiated disconnect');
      this.status = AgentStatus.Offline;
      console.log(`Agent ${this.config.agentId} disconnected.`);
      return { success: true, data: true };
    }
    return { success: false, error: 'Agent not connected or already disconnecting.' };
  }

  /**
   * Sends a message to the connected coordinator.
   * @param message The AgentMessage to send.
   * @returns A PackageResult indicating the success or failure of sending the message.
   */
  public async sendMessage(message: AgentMessage): Promise<PackageResult<boolean>> {
    if (this.status !== AgentStatus.Online || !this.ws) {
      return { success: false, error: 'Agent is not online. Cannot send message.' };
    }

    const stringifyResult = safeJsonStringify(message);
    if (!stringifyResult.success || !stringifyResult.data) {
      return { success: false, error: `Failed to serialize message: ${stringifyResult.error || 'Unknown stringify error'}` };
    }

    try {
      this.ws.send(stringifyResult.data);
      return { success: true, data: true };
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { success: false, error: new NetworkError(`Failed to send message: ${err.message}`).message };
      }
      return { success: false, error: new NetworkError('Failed to send message: Unknown error').message };
    }
  }

  private cleanupConnectionListeners(): void {
    if (this.ws) {
      this.ws.removeEventListener('open', this.handleOpen);
      this.ws.removeEventListener('error', this.handleError);
    }
  }

  private handleOpen(): void {
    this.status = AgentStatus.Online;
    this.reconnectAttempts = 0; // Reset attempts on successful connection
    console.log(`Agent ${this.config.agentId} connected to coordinator.`);
    this.startPing(); // Start sending pings
    this.sendRegistrationMessage().catch(err => {
      console.error(`Error sending registration message for agent ${this.config.agentId}: ${err.error || err}`);
    });
  }

  private async sendRegistrationMessage(): Promise<PackageResult<boolean>> {
    const registrationMessage: AgentMessage = {
      type: 'agent-register',
      payload: { agentId: this.config.agentId },
      timestamp: Date.now(),
      senderId: this.config.agentId,
    };
    return await this.sendMessage(registrationMessage);
  }

  private handleMessage(event: WebSocket.MessageEvent): void {
    const data = event.data;
    if (typeof data !== 'string') {
      console.warn(`Agent ${this.config.agentId} received non-string message, ignoring.`);
      return;
    }
    console.log(`Agent ${this.config.agentId} received message: ${data}`);
    const parseResult = safeJsonParse<AgentMessage>(data);

    if (parseResult.success && parseResult.data) {
      this.processIncomingMessage(parseResult.data);
    } else {
      console.error(`Agent ${this.config.agentId} failed to parse incoming message: ${parseResult.error}`);
    }
  }

  private processIncomingMessage(message: AgentMessage): void {
    console.log(`Agent ${this.config.agentId} processing message type: ${message.type}`);
    // Implement agent-specific message handling logic
    switch (message.type) {
      case 'ping-response':
        // Acknowledged by coordinator, reset watchdog or similar if implemented
        console.debug(`Agent ${this.config.agentId} received ping response.`);
        break;
      case 'command':
        // Example: Execute a command
        console.log(`Executing command: ${message.payload.command}`);
        // Add specific command execution logic here
        break;
      case 'status-request':
        // Example: Respond with current status
        this.sendStatusUpdate().catch(err => console.error(`Failed to send status update: ${err.error || err}`));
        break;
      default:
        console.warn(`Unknown message type received by agent: ${message.type}`);
    }
  }

  private async sendStatusUpdate(): Promise<PackageResult<boolean>> {
    const statusMessage: AgentMessage = {
      type: 'agent-status',
      payload: { status: this.status },
      timestamp: Date.now(),
      senderId: this.config.agentId,
    };
    return await this.sendMessage(statusMessage);
  }

  private handleError(event: WebSocket.ErrorEvent): void {
    console.error(`Agent ${this.config.agentId} WebSocket error: ${event.message || event}`);
    this.status = AgentStatus.Error;
    this.stopPing();
    // Attempt reconnection if not already trying
    this.reconnect().catch(err => console.error(`Failed to initiate reconnection after error: ${err.error || err}`));
  }

  private handleClose(event: WebSocket.CloseEvent): void {
    console.warn(`Agent ${this.config.agentId} WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
    this.status = AgentStatus.Offline;
    this.stopPing();
    if (!event.wasClean) {
      // Unclean close, attempt reconnect
      this.reconnect().catch(err => console.error(`Failed to initiate reconnection after unclean close: ${err.error || err}`));
    }
  }

  private async reconnect(): Promise<PackageResult<boolean>> {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error(`Agent ${this.config.agentId}: Max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
      this.status = AgentStatus.Offline; // Ensure status reflects failure
      return { success: false, error: 'Max reconnect attempts reached.' };
    }

    this.reconnectAttempts++;
    console.log(`Agent ${this.config.agentId}: Attempting reconnect ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${this.RECONNECT_DELAY_MS}ms...`);
    await delay(this.RECONNECT_DELAY_MS);

    const connectResult = await this.connect();
    if (connectResult.success) {
      console.log(`Agent ${this.config.agentId}: Reconnected successfully.`);
      return { success: true, data: true };
    } else {
      console.error(`Agent ${this.config.agentId}: Reconnect attempt failed: ${connectResult.error}`);
      // Recursive call, will eventually hit MAX_RECONNECT_ATTEMPTS or succeed
      return this.reconnect();
    }
  }

  private startPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = setInterval(() => {
      this.sendPing().catch(err => console.error(`Failed to send ping: ${err.error || err}`));
    }, this.PING_INTERVAL_MS);
    console.log(`Agent ${this.config.agentId}: Started ping interval.`);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      console.log(`Agent ${this.config.agentId}: Stopped ping interval.`);
    }
  }

  private async sendPing(): Promise<PackageResult<boolean>> {
    const pingMessage: AgentMessage = {
      type: 'ping',
      payload: {},
      timestamp: Date.now(),
      senderId: this.config.agentId,
    };
    return await this.sendMessage(pingMessage);
  }
}
```