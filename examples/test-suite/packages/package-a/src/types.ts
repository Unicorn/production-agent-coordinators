/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard result pattern for all package operations.
 * @template T The type of data returned on success. Defaults to `unknown`.
 */
export interface PackageResult<T = unknown> {
  /** Indicates if the operation was successful. */
  success: boolean;
  /** The data returned by the operation on success. Optional. */
  data?: T;
  /** An error message if the operation failed. Optional. */
  error?: string;
}

/**
 * Configuration interface for an individual agent.
 */
export interface AgentConfig {
  /** Unique identifier for the agent. */
  id: string;
  /** Display name of the agent. */
  name: string;
  /** Maximum number of tasks the agent can handle concurrently. */
  maxTasks: number;
  /** Indicates if the agent is currently available for new tasks. */
  available: boolean;
}

/**
 * Interface for a task to be processed by an agent.
 */
export interface Task {
  /** Unique identifier for the task. */
  id: string;
  /** Name or description of the task. */
  name: string;
  /** Current status of the task. */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** The ID of the agent currently assigned to this task, if any. */
  assignedAgentId?: string;
}

/**
 * Configuration interface for the Agent Coordinator.
 */
export interface CoordinatorConfig {
  /** Unique identifier for the coordinator. */
  id: string;
  /** Display name of the coordinator. */
  name: string;
  /** Maximum number of agents this coordinator can manage (for future use/scaling). */
  maxAgents: number;
}