/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

// Agent Status Enum
export enum AgentStatus {
  Offline = 'offline',
  Connecting = 'connecting',
  Online = 'online',
  Idle = 'idle',
  Busy = 'busy',
  Error = 'error',
}

// Type Aliases
export type AgentId = string;
export type AgentPayload = Record<string, unknown>;

// Configuration Interfaces
export interface CoordinatorConfig {
  port: number;
  host: string;
  maxAgents?: number; // Optional, default to a reasonable number
}

export interface AgentClientConfig {
  coordinatorHost: string;
  coordinatorPort: number;
  agentId: AgentId;
}

// Message Interfaces
export interface AgentMessage {
  type: string;
  payload: AgentPayload;
  timestamp: number;
  senderId?: AgentId;
  recipientId?: AgentId;
  correlationId?: string; // For request-response patterns
}

export interface AgentInfo {
  id: AgentId;
  status: AgentStatus;
  lastSeen: number;
  // Add more agent-specific metadata as needed
}

export interface IncomingConnection {
  id: string; // Unique ID for this connection instance
  socket: WebSocket;
  ipAddress: string;
}
```