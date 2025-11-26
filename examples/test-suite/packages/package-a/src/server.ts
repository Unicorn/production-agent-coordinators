/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { WebSocket, WebSocketServer } from 'ws';
import * as http from 'http'; // For HTTP server
import { CoordinatorConfig, IncomingConnection } from './types';
import { PackageResult } from './interfaces';
import { NetworkError, BernierError } from './errors';
import { generateUuid } from './utils';

// Define event listener types for clarity
type ConnectionHandler = (connection: IncomingConnection) => void;
type MessageHandler = (connectionId: string, message: string) => void;
type CloseHandler = (connectionId: string, code: number, reason: string) => void;
type ErrorHandler = (error: Error) => void;

/**
 * Abstraction layer for a WebSocket server, handling raw connections and message events.
 */
export class AgentServer {
  private wss: WebSocketServer | null = null;
  private httpServer: http.Server | null = null;
  private readonly config: CoordinatorConfig;
  private listening: boolean = false;

  // Event handlers
  private _onConnection: ConnectionHandler | null = null;
  private _onMessage: MessageHandler | null = null;
  private _onClose: CloseHandler | null = null;
  private _onError: ErrorHandler | null = null;

  // Map to store active connections by a unique internal ID
  private readonly activeConnections: Map<string, WebSocket> = new Map();

  constructor(config: CoordinatorConfig) {
    this.config = config;
  }

  /**
   * Sets the handler for new WebSocket connections.
   * @param handler The function to call when a new connection is established.
   */
  public onConnection(handler: ConnectionHandler): void {
    this._onConnection = handler;
  }

  /**
   * Sets the handler for incoming messages from WebSocket connections.
   * @param handler The function to call when a message is received.
   */
  public onMessage(handler: MessageHandler): void {
    this._onMessage = handler;
  }

  /**
   * Sets the handler for WebSocket connection closures.
   * @param handler The function to call when a connection is closed.
   */
  public onClose(handler: CloseHandler): void {
    this._onClose = handler;
  }

  /**
   * Sets the handler for errors occurring on the WebSocket server.
   * @param handler The function to call when a server error occurs.
   */
  public onError(handler: ErrorHandler): void {
    this._onError = handler;
  }

  /**
   * Starts the WebSocket server.
   * @returns A PackageResult indicating the success or failure of starting the server.
   */
  public async start(): Promise<PackageResult<boolean>> {
    if (this.listening) {
      return { success: false, error: 'Server is already listening.' };
    }

    try {
      this.httpServer = http.createServer();
      this.wss = new WebSocketServer({ server: this.httpServer });

      this.wss.on('connection', this.handleWsConnection.bind(this));
      this.wss.on('error', this.handleWsServerError.bind(this));
      this.wss.on('close', this.handleWsServerClose.bind(this));

      return new Promise((resolve) => {
        this.httpServer?.listen(this.config.port, this.config.host, () => {
          this.listening = true;
          console.log(`WebSocket server started on ws://${this.config.host}:${this.config.port}`);
          resolve({ success: true, data: true });
        });
        this.httpServer?.on('error', (err: Error) => {
          this.listening = false; // Ensure listening flag is reset on error
          console.error(`HTTP Server error: ${err.message}`);
          resolve({ success: false, error: new NetworkError(`HTTP server failed to start: ${err.message}`).message });
        });
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        return { success: false, error: new NetworkError(`Failed to initialize WebSocket server: ${err.message}`).message };
      }
      return { success: false, error: new NetworkError('Failed to initialize WebSocket server: Unknown error').message };
    }
  }

  /**
   * Stops the WebSocket server and closes all active connections.
   * @returns A PackageResult indicating the success or failure of stopping the server.
   */
  public async stop(): Promise<PackageResult<boolean>> {
    if (!this.listening || !this.wss || !this.httpServer) {
      return { success: false, error: 'Server is not running.' };
    }

    try {
      // Close all client connections gracefully
      this.activeConnections.forEach((ws, connId) => {
        try {
          ws.close(1001, 'Server shutting down'); // 1001: Going Away
        } catch (error: unknown) {
          console.error(`Error closing client connection ${connId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });
      this.activeConnections.clear(); // Clear the map after attempting to close all

      await new Promise<void>((resolve, reject) => {
        this.wss?.close((err) => {
          if (err) {
            return reject(new NetworkError(`Error closing WebSocket server: ${err.message}`));
          }
          this.httpServer?.close((httpErr) => {
            if (httpErr) {
              return reject(new NetworkError(`Error closing HTTP server: ${httpErr.message}`));
            }
            resolve();
          });
        });
      });

      this.listening = false;
      this.wss = null;
      this.httpServer = null;
      console.log('WebSocket server stopped successfully.');
      return { success: true, data: true };
    } catch (err: unknown) {
      if (err instanceof BernierError) {
        return { success: false, error: err.message };
      }
      if (err instanceof Error) {
        return { success: false, error: new BernierError(`Failed to stop WebSocket server: ${err.message}`).message };
      }
      return { success: false, error: new BernierError('Failed to stop WebSocket server: Unknown error').message };
    }
  }

  /**
   * Checks if the WebSocket server is currently listening for connections.
   * @returns True if listening, false otherwise.
   */
  public isListening(): boolean {
    return this.listening;
  }

  // --- Private WebSocket Event Handlers ---
  private handleWsConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const connectionId = generateUuid(); // Generate a unique ID for this specific connection
    this.activeConnections.set(connectionId, ws);

    const ipAddress = req.socket.remoteAddress || 'unknown';
    const incomingConnection: IncomingConnection = { id: connectionId, socket: ws, ipAddress };

    this._onConnection?.(incomingConnection);

    ws.on('message', (message: WebSocket.RawData) => this.handleWsMessage(connectionId, message));
    ws.on('close', (code: number, reason: Buffer) => this.handleWsClose(connectionId, code, reason));
    ws.on('error', (error: Error) => this.handleWsError(connectionId, error));
  }

  private handleWsMessage(connectionId: string, message: WebSocket.RawData): void {
    if (typeof message === 'string' || Buffer.isBuffer(message)) {
      this._onMessage?.(connectionId, message.toString());
    } else {
      console.warn(`Non-string/buffer message received from connection ${connectionId}, ignoring.`);
    }
  }

  private handleWsClose(connectionId: string, code: number, reason: Buffer): void {
    this.activeConnections.delete(connectionId);
    this._onClose?.(connectionId, code, reason.toString());
  }

  private handleWsError(connectionId: string, error: Error): void {
    console.error(`WebSocket error on connection ${connectionId}: ${error.message}`);
    // No need to delete from activeConnections here, handleWsClose will be called subsequently.
    // If the error happens before close, ensure to still propagate if generic server error needs to be handled
    this._onError?.(error); // This onError is for server-wide errors, not client connection specific
  }

  private handleWsServerError(error: Error): void {
    console.error(`WebSocket server internal error: ${error.message}`);
    this._onError?.(error);
  }

  private handleWsServerClose(): void {
    console.log('WebSocket server internally closed.');
    this.listening = false;
  }
}