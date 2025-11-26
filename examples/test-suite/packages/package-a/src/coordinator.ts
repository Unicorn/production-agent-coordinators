/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { IAgent, ICoordinator, ITask } from './interfaces';
import { AgentId, CoordinatorId, PackageResult, TaskId } from './types';

export class Coordinator implements ICoordinator {
  public id: CoordinatorId;
  public name: string;
  private agents: Map<AgentId, IAgent>;
  private tasks: Map<TaskId, ITask>;

  constructor(id: CoordinatorId, name: string) {
    this.id = id;
    this.name = name;
    this.agents = new Map<AgentId, IAgent>();
    this.tasks = new Map<TaskId, ITask>();
  }

  public manageAgent(agent: IAgent): PackageResult<IAgent> {
    if (this.agents.has(agent.id)) {
      return { success: false, error: `Agent ${agent.id} already managed by coordinator ${this.id}.` };
    }
    this.agents.set(agent.id, agent);
    return { success: true, data: agent };
  }

  public removeAgent(agentId: AgentId): PackageResult<void> {
    if (!this.agents.has(agentId)) {
      return { success: false, error: `Agent ${agentId} not found for removal.` };
    }
    this.agents.delete(agentId);
    return { success: true };
  }

  public manageTask(task: ITask): PackageResult<ITask> {
    if (this.tasks.has(task.id)) {
      return { success: false, error: `Task ${task.id} already managed by coordinator ${this.id}.` };
    }
    this.tasks.set(task.id, task);
    return { success: true, data: task };
  }

  public removeTask(taskId: TaskId): PackageResult<void> {
    if (!this.tasks.has(taskId)) {
      return { success: false, error: `Task ${taskId} not found for removal.` };
    }
    this.tasks.delete(taskId);
    return { success: true };
  }

  public async assignTaskToAgent(taskId: TaskId, agentId: AgentId): Promise<PackageResult<ITask>> {
    const agent: IAgent | undefined = this.agents.get(agentId);
    const task: ITask | undefined = this.tasks.get(taskId);

    if (!agent) {
      return { success: false, error: `Agent ${agentId} not found.` };
    }
    if (!task) {
      return { success: false, error: `Task ${taskId} not found.` };
    }
    if (task.assignedAgentId) {
      return { success: false, error: `Task ${taskId} is already assigned to agent ${task.assignedAgentId}.` };
    }
    if (agent.status === 'offline') {
      return { success: false, error: `Agent ${agentId} is offline and cannot be assigned tasks.` };
    }

    const assignResult: PackageResult<ITask> = await agent.assignTask(task);
    if (assignResult.success && assignResult.data) {
      task.assignedAgentId = agentId;
      task.status = 'in-progress';
      task.updatedAt = new Date();
      this.tasks.set(taskId, task); // Update task in coordinator's store
      return { success: true, data: task };
    } else {
      return { success: false, error: assignResult.error ?? `Failed to assign task ${taskId} to agent ${agentId}.` };
    }
  }

  public async getAvailableAgents(capabilities: string[]): Promise<PackageResult<IAgent[]>> {
    const availableAgents: IAgent[] = Array.from(this.agents.values()).filter(
      (agent: IAgent) => agent.status === 'available' && capabilities.every(cap => agent.capabilities.includes(cap))
    );
    return { success: true, data: availableAgents };
  }

  public async getAgentById(agentId: AgentId): Promise<PackageResult<IAgent>> {
    const agent: IAgent | undefined = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent ${agentId} not found.` };
    }
    return { success: true, data: agent };
  }

  public async getTaskById(taskId: TaskId): Promise<PackageResult<ITask>> {
    const task: ITask | undefined = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task ${taskId} not found.` };
    }
    return { success: true, data: task };
  }

  // Internal methods for AgentCoordinator to manage state
  public async internalUpdateAgentStatus(agentId: AgentId, status: IAgent['status']): Promise<PackageResult<IAgent>> {
    const agent: IAgent | undefined = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent ${agentId} not found.` };
    }
    agent.status = status;
    return { success: true, data: agent };
  }

  public async internalRemoveAssignedTask(agentId: AgentId, taskId: TaskId): Promise<PackageResult<IAgent>> {
    const agent: IAgent | undefined = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent ${agentId} not found.` };
    }
    const taskIndex: number = agent.assignedTasks.indexOf(taskId);
    if (taskIndex !== -1) {
      agent.assignedTasks.splice(taskIndex, 1);
    }
    agent.status = agent.assignedTasks.length > 0 ? 'busy' : 'available';
    return { success: true, data: agent };
  }

  public async internalUpdateTaskStatus(taskId: TaskId, status: ITask['status'], result?: unknown, error?: string): Promise<PackageResult<ITask>> {
    const task: ITask | undefined = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task ${taskId} not found.` };
    }
    task.status = status;
    task.updatedAt = new Date();
    console.log(`Task ${taskId} updated to status ${status}`);
    return { success: true, data: task };
  }

  public async listAllAgents(): Promise<PackageResult<IAgent[]>> {
    return { success: true, data: Array.from(this.agents.values()) };
  }

  public async listAllTasks(): Promise<PackageResult<ITask[]>> {
    return { success: true, data: Array.from(this.tasks.values()) };
  }
}