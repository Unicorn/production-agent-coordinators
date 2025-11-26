/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { IAgent, ITask } from './interfaces';
import { AgentId, PackageResult, TaskId } from './types';

export class Agent implements IAgent {
  public id: AgentId;
  public name: string;
  public status: 'available' | 'busy' | 'offline';
  public capabilities: string[];
  public assignedTasks: TaskId[];

  constructor(id: AgentId, name: string, capabilities: string[] = []) {
    this.id = id;
    this.name = name;
    this.status = 'available';
    this.capabilities = capabilities;
    this.assignedTasks = [];
  }

  public async assignTask(task: ITask): Promise<PackageResult<ITask>> {
    if (this.status === 'offline') {
      return { success: false, error: `Agent ${this.id} is offline and cannot accept tasks.` };
    }
    this.status = 'busy';
    this.assignedTasks.push(task.id);
    console.log(`Agent ${this.id} assigned task ${task.id}`);
    return { success: true, data: task };
  }

  public async completeTask(taskId: TaskId, success: boolean, result?: unknown, error?: string): Promise<PackageResult<ITask>> {
    const taskIndex: number = this.assignedTasks.indexOf(taskId);
    if (taskIndex === -1) {
      return { success: false, error: `Task ${taskId} not assigned to agent ${this.id}.` };
    }

    this.assignedTasks.splice(taskIndex, 1);
    this.status = this.assignedTasks.length > 0 ? 'busy' : 'available';

    const completedTask: ITask = {
      id: taskId,
      description: `Task ${taskId} completed by agent ${this.id}`, // Placeholder, real task object would be retrieved
      status: success ? 'completed' : 'failed',
      assignedAgentId: this.id,
      createdAt: new Date(), // Placeholder
      updatedAt: new Date(),
      // In a real scenario, we'd fetch the task and update its properties
    };

    if (!success) {
      return { success: false, error: error ?? `Task ${taskId} failed for agent ${this.id}.` };
    }

    console.log(`Agent ${this.id} completed task ${taskId} with success: ${success}`);
    return { success: true, data: completedTask };
  }

  public async reportStatus(): Promise<PackageResult<{ id: AgentId; status: string }>> {
    return { success: true, data: { id: this.id, status: this.status } };
  }
}