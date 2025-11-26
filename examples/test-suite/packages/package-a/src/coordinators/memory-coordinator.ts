/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { BaseCoordinator } from './base-coordinator';
import { Agent, Task, PackageResult, CoordinatorEvent } from '../types';

export class MemoryCoordinator extends BaseCoordinator {
  private agents: Map<string, Agent> = new Map();
  private tasks: Map<string, Task> = new Map();

  constructor() {
    super();
  }

  // Helper for generating IDs (for simplicity, using a basic counter or UUID)
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Agent Management
  public async registerAgent(agentData: Omit<Agent, 'status' | 'lastHeartbeat'>): Promise<PackageResult<Agent>> {
    const newAgent: Agent = {
      ...agentData,
      id: agentData.id || this.generateId(), // Allow pre-defined ID or generate
      status: 'idle',
      lastHeartbeat: Date.now(),
    };

    if (this.agents.has(newAgent.id)) {
      return { success: false, error: `Agent with ID ${newAgent.id} already exists.` };
    }

    this.agents.set(newAgent.id, newAgent);
    return { success: true, data: newAgent };
  }

  public async getAgent(agentId: string): Promise<PackageResult<Agent>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent with ID ${agentId} not found.` };
    }
    return { success: true, data: agent };
  }

  public async updateAgentStatus(agentId: string, status: Agent['status']): Promise<PackageResult<Agent>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent with ID ${agentId} not found.` };
    }
    agent.status = status;
    this.agents.set(agentId, agent);
    return { success: true, data: agent };
  }

  public async updateAgentHeartbeat(agentId: string): Promise<PackageResult<Agent>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent with ID ${agentId} not found.` };
    }
    agent.lastHeartbeat = Date.now();
    this.agents.set(agentId, agent);
    return { success: true, data: agent };
  }

  public async deregisterAgent(agentId: string): Promise<PackageResult<string>> {
    if (!this.agents.delete(agentId)) {
      return { success: false, error: `Agent with ID ${agentId} not found.` };
    }
    return { success: true, data: agentId };
  }

  public async listAgents(statusFilter?: Agent['status'], capabilitiesFilter?: string[]): Promise<PackageResult<Agent[]>> {
    let agentsArray = Array.from(this.agents.values());

    if (statusFilter) {
      agentsArray = agentsArray.filter(agent => agent.status === statusFilter);
    }

    if (capabilitiesFilter && capabilitiesFilter.length > 0) {
      agentsArray = agentsArray.filter(agent =>
        capabilitiesFilter.every(cap => agent.capabilities.includes(cap))
      );
    }

    return { success: true, data: agentsArray };
  }

  // Task Management
  public async createTask(taskData: Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'result' | 'error'>): Promise<PackageResult<Task>> {
    const now = Date.now();
    const newTask: Task = {
      ...taskData,
      id: this.generateId(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(newTask.id, newTask);
    return { success: true, data: newTask };
  }

  public async getTask(taskId: string): Promise<PackageResult<Task>> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task with ID ${taskId} not found.` };
    }
    return { success: true, data: task };
  }

  public async assignTask(taskId: string, agentId: string): Promise<PackageResult<Task>> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task with ID ${taskId} not found.` };
    }
    const agentResult = await this.getAgent(agentId);
    if (!agentResult.success || !agentResult.data) {
        return { success: false, error: `Agent with ID ${agentId} not found for assignment.` };
    }

    // Optional: Check agent status, capabilities etc.
    if (agentResult.data.status === 'offline') {
        return { success: false, error: `Agent ${agentId} is offline and cannot be assigned tasks.` };
    }

    task.agentId = agentId;
    task.status = 'assigned';
    task.updatedAt = Date.now();
    this.tasks.set(taskId, task);
    return { success: true, data: task };
  }

  public async updateTaskStatus(taskId: string, status: Task['status'], result?: Record<string, unknown>, error?: string): Promise<PackageResult<Task>> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task with ID ${taskId} not found.` };
    }
    task.status = status;
    task.updatedAt = Date.now();
    if (result) {
      task.result = result;
    }
    if (error) {
      task.error = error;
    }
    this.tasks.set(taskId, task);
    return { success: true, data: task };
  }

  public async listTasks(agentIdFilter?: string, statusFilter?: Task['status']): Promise<PackageResult<Task[]>> {
    let tasksArray = Array.from(this.tasks.values());

    if (agentIdFilter) {
      tasksArray = tasksArray.filter(task => task.agentId === agentIdFilter);
    }
    if (statusFilter) {
      tasksArray = tasksArray.filter(task => task.status === statusFilter);
    }

    return { success: true, data: tasksArray };
  }

  // Event Broadcasting
  // For MemoryCoordinator, this is a no-op or can be used for internal logging
  // In a real-world scenario, this would integrate with an event bus (e.g., EventEmitter, Kafka, Redis Pub/Sub)
  public async emitEvent<T>(event: CoordinatorEvent<T>): Promise<PackageResult<boolean>> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _event = event; // Marked as unused for linting purposes if not used internally
    return { success: true, data: true };
  }
}