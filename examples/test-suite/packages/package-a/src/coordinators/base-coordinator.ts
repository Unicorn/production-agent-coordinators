/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { Agent, Task, PackageResult, CoordinatorEvent } from '../types';

export abstract class BaseCoordinator {
  protected constructor() {
    // Protected constructor to prevent direct instantiation
  }

  // Agent Management
  public abstract registerAgent(agent: Omit<Agent, 'status' | 'lastHeartbeat'>): Promise<PackageResult<Agent>>;
  public abstract getAgent(agentId: string): Promise<PackageResult<Agent>>;
  public abstract updateAgentStatus(agentId: string, status: Agent['status']): Promise<PackageResult<Agent>>;
  public abstract updateAgentHeartbeat(agentId: string): Promise<PackageResult<Agent>>;
  public abstract deregisterAgent(agentId: string): Promise<PackageResult<string>>;
  public abstract listAgents(status?: Agent['status'], capabilities?: string[]): Promise<PackageResult<Agent[]>>;

  // Task Management
  public abstract createTask(task: Omit<Task, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'result' | 'error'>): Promise<PackageResult<Task>>;
  public abstract getTask(taskId: string): Promise<PackageResult<Task>>;
  public abstract assignTask(taskId: string, agentId: string): Promise<PackageResult<Task>>;
  public abstract updateTaskStatus(taskId: string, status: Task['status'], result?: Record<string, unknown>, error?: string): Promise<PackageResult<Task>>;
  public abstract listTasks(agentId?: string, status?: Task['status']): Promise<PackageResult<Task[]>>;

  // Event Broadcasting (simplified for now, actual implementation might involve a pub-sub)
  public abstract emitEvent<T>(event: CoordinatorEvent<T>): Promise<PackageResult<boolean>>;
}