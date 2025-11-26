/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { IAgent, IAgentCoordinator, ICoordinator, ITask } from './interfaces';
import { Coordinator } from './coordinator';
import { AgentCoordinatorId, AgentId, PackageResult, TaskId } from './types';
import { v4 as uuidv4 } from 'uuid';

export class AgentCoordinator implements IAgentCoordinator {
  private coordinator: ICoordinator;
  public id: AgentCoordinatorId;

  constructor(id: AgentCoordinatorId = uuidv4(), coordinatorName: string = 'DefaultCoordinator') {
    this.id = id;
    this.coordinator = new Coordinator(uuidv4(), coordinatorName);
  }

  public async registerAgent(agent: IAgent): Promise<PackageResult<IAgent>> {
    return this.coordinator.manageAgent(agent);
  }

  public async deregisterAgent(agentId: AgentId): Promise<PackageResult<void>> {
    const agentResult: PackageResult<IAgent> = await this.coordinator.getAgentById(agentId);
    if (!agentResult.success || !agentResult.data) {
      return { success: false, error: agentResult.error ?? `Agent ${agentId} not found for deregistration.` };
    }

    const agent: IAgent = agentResult.data;

    // Clear any assigned tasks for the deregistered agent by resetting their status and unassigning them.
    for (const taskId of agent.assignedTasks) {
      const taskResult: PackageResult<ITask> = await this.coordinator.getTaskById(taskId);
      if (taskResult.success && taskResult.data) {
        taskResult.data.assignedAgentId = undefined; // Unassign task
        taskResult.data.status = 'pending'; // Reset task status
        await this.coordinator.internalUpdateTaskStatus(taskId, 'pending');
      }
    }

    // Now, remove the agent from the coordinator's management
    const removeAgentResult: PackageResult<void> = this.coordinator.removeAgent(agentId);
    if (!removeAgentResult.success) {
      return { success: false, error: removeAgentResult.error };
    }

    return { success: true };
  }

  public async createTask(description: string, capabilities: string[] = []): Promise<PackageResult<ITask>> {
    const newTask: ITask = {
      id: uuidv4(),
      description,
      status: 'pending',
      requiredCapabilities: capabilities.length > 0 ? capabilities : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result: PackageResult<ITask> = this.coordinator.manageTask(newTask);
    if (result.success) {
      return { success: true, data: newTask };
    }
    return result;
  }

  public async dispatchTask(taskId: TaskId): Promise<PackageResult<ITask>> {
    const taskResult: PackageResult<ITask> = await this.coordinator.getTaskById(taskId);
    if (!taskResult.success || !taskResult.data) {
      return { success: false, error: taskResult.error ?? `Task ${taskId} not found.` };
    }

    const task: ITask = taskResult.data;

    if (task.status !== 'pending') {
      return { success: false, error: `Task ${taskId} is not in a 'pending' state.` };
    }

    const requiredCaps: string[] = task.requiredCapabilities ?? [];
    const availableAgentsResult: PackageResult<IAgent[]> = await this.coordinator.getAvailableAgents(requiredCaps);
    if (!availableAgentsResult.success || !availableAgentsResult.data || availableAgentsResult.data.length === 0) {
      return { success: false, error: `No available agents found for task ${taskId} with required capabilities: ${requiredCaps.join(', ')}.` };
    }

    // Simple dispatch: pick the first available agent
    const agentToAssign: IAgent = availableAgentsResult.data[0];
    const assignResult: PackageResult<ITask> = await this.coordinator.assignTaskToAgent(task.id, agentToAssign.id);

    if (assignResult.success && assignResult.data) {
      return { success: true, data: assignResult.data };
    } else {
      return { success: false, error: assignResult.error ?? `Failed to dispatch task ${taskId}.` };
    }
  }

  public async getAgent(agentId: AgentId): Promise<PackageResult<IAgent>> {
    return this.coordinator.getAgentById(agentId);
  }

  public async getTask(taskId: TaskId): Promise<PackageResult<ITask>> {
    return this.coordinator.getTaskById(taskId);
  }

  public async listAgents(): Promise<PackageResult<IAgent[]>> {
    return this.coordinator.listAllAgents();
  }

  public async listTasks(): Promise<PackageResult<ITask[]>> {
    return this.coordinator.listAllTasks();
  }

  public async updateTaskStatus(taskId: TaskId, status: ITask['status'], result?: unknown, error?: string): Promise<PackageResult<ITask>> {
    const taskResult: PackageResult<ITask> = await this.coordinator.getTaskById(taskId);
    if (!taskResult.success || !taskResult.data) {
      return { success: false, error: taskResult.error ?? `Task ${taskId} not found.` };
    }

    const task: ITask = taskResult.data;
    task.status = status;
    task.updatedAt = new Date();

    const updateCoordTaskStatusResult: PackageResult<ITask> = await this.coordinator.internalUpdateTaskStatus(taskId, status, result, error);

    if (!updateCoordTaskStatusResult.success) {
      return { success: false, error: updateCoordTaskStatusResult.error };
    }

    // If task is completed or failed, update agent status if it was assigned to an agent
    if ((status === 'completed' || status === 'failed') && task.assignedAgentId) {
      const agentResult: PackageResult<IAgent> = await this.coordinator.getAgentById(task.assignedAgentId);
      if (agentResult.success && agentResult.data) {
        const agent: IAgent = agentResult.data;
        const completeTaskResult: PackageResult<ITask> = await agent.completeTask(taskId, status === 'completed', result, error);
        if (!completeTaskResult.success) {
          console.error(`Error updating agent's task list for agent ${agent.id}: ${completeTaskResult.error}`);
        }
        await this.coordinator.internalRemoveAssignedTask(agent.id, taskId); // Ensure coordinator's view of agent's tasks is updated
      }
    }

    return { success: true, data: task };
  }
}