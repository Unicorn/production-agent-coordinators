/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { AgentId, CoordinatorId, PackageResult, TaskId } from './types';

// Define the basic task structure
export interface ITask {
  id: TaskId;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  assignedAgentId?: AgentId;
  requiredCapabilities?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Interface for an Agent
export interface IAgent {
  id: AgentId;
  name: string;
  status: 'available' | 'busy' | 'offline';
  capabilities: string[];
  assignedTasks: TaskId[];
  assignTask(task: ITask): Promise<PackageResult<ITask>>;
  completeTask(taskId: TaskId, success: boolean, result?: unknown, error?: string): Promise<PackageResult<ITask>>;
  reportStatus(): Promise<PackageResult<{ id: AgentId; status: string }>>;
}

// Interface for a Coordinator
export interface ICoordinator {
  id: CoordinatorId;
  name: string;
  manageAgent(agent: IAgent): PackageResult<IAgent>;
  removeAgent(agentId: AgentId): PackageResult<void>;
  manageTask(task: ITask): PackageResult<ITask>;
  removeTask(taskId: TaskId): PackageResult<void>;
  assignTaskToAgent(taskId: TaskId, agentId: AgentId): Promise<PackageResult<ITask>>;
  getAvailableAgents(capabilities: string[]): Promise<PackageResult<IAgent[]>>;
  getAgentById(agentId: AgentId): Promise<PackageResult<IAgent>>;
  getTaskById(taskId: TaskId): Promise<PackageResult<ITask>>;
  internalUpdateAgentStatus(agentId: AgentId, status: IAgent['status']): Promise<PackageResult<IAgent>>;
  internalRemoveAssignedTask(agentId: AgentId, taskId: TaskId): Promise<PackageResult<IAgent>>;
  internalUpdateTaskStatus(taskId: TaskId, status: ITask['status'], result?: unknown, error?: string): Promise<PackageResult<ITask>>;
  listAllAgents(): Promise<PackageResult<IAgent[]>>;
  listAllTasks(): Promise<PackageResult<ITask[]>>;
}

// Interface for the AgentCoordinator service
export interface IAgentCoordinator {
  registerAgent(agent: IAgent): Promise<PackageResult<IAgent>>;
  deregisterAgent(agentId: AgentId): Promise<PackageResult<void>>;
  createTask(description: string, capabilities: string[]): Promise<PackageResult<ITask>>;
  dispatchTask(taskId: TaskId): Promise<PackageResult<ITask>>;
  getAgent(agentId: AgentId): Promise<PackageResult<IAgent>>;
  getTask(taskId: TaskId): Promise<PackageResult<ITask>>;
  listAgents(): Promise<PackageResult<IAgent[]>>;
  listTasks(): Promise<PackageResult<ITask[]>>;
  updateTaskStatus(taskId: TaskId, status: ITask['status'], result?: unknown, error?: string): Promise<PackageResult<ITask>>;
}