/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard result pattern for all package operations to indicate success or failure.
 * @template T The type of data returned on success. Defaults to `unknown`.
 */
export interface PackageResult<T = unknown> {
  /** Indicates whether the operation was successful. */
  success: boolean;
  /** The data returned on success. Present only if `success` is `true`. */
  data?: T;
  /** An error message explaining the failure. Present only if `success` is `false`. */
  error?: string;
}

/** Defines the possible statuses for an Agent. */
export type AgentStatus = 'online' | 'offline' | 'busy' | 'unavailable';

/** Represents an individual agent managed by the system. */
export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  lastHeartbeat: Date;
  metadata?: Record<string, unknown>;
}

/** Defines the possible statuses for a Coordinator. */
export type CoordinatorStatus = 'active' | 'inactive' | 'error';

/** Represents a coordinator that manages a set of agents. */
export interface Coordinator {
  id: string;
  name: string;
  status: CoordinatorStatus;
  agentIds: string[];
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/** Data required to create a new agent. */
export interface NewAgentData {
  name: string;
  status?: AgentStatus;
  metadata?: Record<string, unknown>;
}

/** Data to update an existing agent. All fields are optional. */
export interface UpdateAgentData {
  name?: string;
  status?: AgentStatus;
  lastHeartbeat?: Date;
  metadata?: Record<string, unknown>;
}

/** Data required to create a new coordinator. */
export interface NewCoordinatorData {
  name: string;
  agentIds?: string[];
  config?: Record<string, unknown>;
}

/** Data to update an existing coordinator. All fields are optional. */
export interface UpdateCoordinatorData {
  name?: string;
  status?: CoordinatorStatus;
  agentIds?: string[];
  config?: Record<string, unknown>;
}