/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

/**
 * Standard interface for operation results across the package.
 * @template T - The type of data returned on success. Defaults to unknown.
 */
export interface PackageResult<T = unknown> {
  /** Indicates whether the operation was successful. */
  success: boolean;
  /** The data returned by the operation on success, if any. */
  data?: T;
  /** An error message explaining the failure, if any. */
  error?: string;
}

/**
 * Represents an agent managed by the coordinator.
 */
export interface Agent {
  /** Unique identifier for the agent. */
  id: string;
  /** Name of the agent. */
  name: string;
  /** Current status of the agent. */
  status: 'online' | 'offline' | 'busy';
  /** List of capabilities the agent possesses. */
  capabilities: string[];
}

/**
 * Represents a task to be coordinated and executed by an agent.
 */
export interface Task {
  /** Unique identifier for the task. */
  id: string;
  /** Name of the task. */
  name: string;
  /** Detailed description of the task. */
  description: string;
  /** The ID of the agent currently assigned to the task, or null if unassigned. */
  assignedAgentId: string | null;
  /** Current status of the task. */
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  /** Priority level of the task. */
  priority: 'low' | 'medium' | 'high';
}

/**
 * Configuration options for the ProductionAgentCoordinator.
 */
export interface CoordinatorConfig {
  /** The file path to the plan file that guides the coordinator's operations. */
  planFilePath: string;
  /** The maximum number of tasks that can be processed concurrently. */
  maxConcurrentTasks: number;
}