/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard result interface for package operations, ensuring consistent error handling.
 * @template T The type of data returned on success. Defaults to unknown.
 */
export interface PackageResult<T = unknown> {
  /** Indicates whether the operation was successful. */
  success: boolean;
  /** The data returned on successful operations. Optional. */
  data?: T;
  /** An error message returned on failed operations. Optional. */
  error?: string;
}

/**
 * Represents the configuration structure for an agent.
 */
export interface AgentConfig {
  /** Unique identifier for the agent. */
  id: string;
  /** Human-readable name of the agent. */
  name: string;
  /** Flag indicating if the agent is enabled. */
  enabled: boolean;
}

/**
 * Represents the current status of an agent.
 */
export interface AgentStatus {
  /** Unique identifier for the agent. */
  id: string;
  /** Current operational status of the agent. */
  status: 'online' | 'offline' | 'error' | 'initializing';
  /** Timestamp of the last successful communication with the agent. */
  lastPing: Date;
}