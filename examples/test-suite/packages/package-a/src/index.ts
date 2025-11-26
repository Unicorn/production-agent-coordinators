/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { PackageResult, AgentConfig, Task, CoordinatorConfig } from './types';

/**
 * Manages a pool of agents and coordinates task assignments.
 * Adheres to strict TypeScript and Bernier LLC coding standards.
 */
export class AgentCoordinator {
  private coordinatorId: string;
  private agents: Map<string, AgentConfig>;
  private tasks: Map<string, Task>;

  /**
   * Creates an instance of AgentCoordinator.
   * @param config Configuration for the coordinator.
   */
  constructor(config: CoordinatorConfig) {
    this.coordinatorId = config.id;
    this.agents = new Map<string, AgentConfig>();
    this.tasks = new Map<string, Task>();
    // eslint-disable-next-line no-console
    console.log(`Coordinator ${this.coordinatorId} initialized with name: ${config.name}.`);
  }

  /**
   * Registers a new agent with the coordinator.
   * @param agentConfig Configuration details for the agent.
   * @returns A `PackageResult` indicating success or failure of registration.
   */
  public registerAgent(agentConfig: AgentConfig): PackageResult<AgentConfig> {
    if (this.agents.has(agentConfig.id)) {
      return { success: false, error: `Agent with ID '${agentConfig.id}' already registered.` };
    }
    this.agents.set(agentConfig.id, agentConfig);
    // eslint-disable-next-line no-console
    console.log(`Agent '${agentConfig.name}' (${agentConfig.id}) registered.`);
    return { success: true, data: agentConfig };
  }

  /**
   * Retrieves an agent's configuration by its ID.
   * @param agentId The ID of the agent to retrieve.
   * @returns A `PackageResult` containing the agent's configuration or an error.
   */
  public getAgent(agentId: string): PackageResult<AgentConfig> {
    const agent: AgentConfig | undefined = this.agents.get(agentId);
    if (!agent) {
      return { success: false, error: `Agent with ID '${agentId}' not found.` };
    }
    return { success: true, data: agent };
  }

  /**
   * Submits a new task to the coordinator for assignment and processing.
   * @param task The task to be submitted.
   * @returns A `Promise` resolving to a `PackageResult` with the updated task status or an error.
   */
  public async submitTask(task: Task): Promise<PackageResult<Task>> {
    if (this.tasks.has(task.id)) {
      return { success: false, error: `Task with ID '${task.id}' already exists.` };
    }
    const initialTask: Task = { ...task, status: 'pending' };
    this.tasks.set(task.id, initialTask);
    // eslint-disable-next-line no-console
    console.log(`Task '${task.name}' (${task.id}) submitted as pending.`);

    // Simulate task assignment and processing
    const assignedTaskResult: PackageResult<Task> = await this.assignTask(task.id);
    if (!assignedTaskResult.success) {
      this.tasks.set(task.id, { ...initialTask, status: 'failed' }); // Mark task as failed if assignment fails
      return { success: false, error: `Failed to assign task '${task.name}': ${assignedTaskResult.error ?? 'Unknown reason'}` };
    }

    const finalTask: Task | undefined = this.tasks.get(task.id);
    if (finalTask === undefined) {
      // This should ideally not happen if assignTask updated it.
      return { success: false, error: `Submitted task '${task.id}' disappeared after assignment.` };
    }

    return { success: true, data: finalTask };
  }

  /**
   * Attempts to assign a task to an available agent.
   * This is a private method called internally by `submitTask`.
   * @param taskId The ID of the task to assign.
   * @returns A `Promise` resolving to a `PackageResult` indicating success or failure of assignment.
   */
  private async assignTask(taskId: string): Promise<PackageResult<Task>> {
    const task: Task | undefined = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task with ID '${taskId}' not found for assignment.` };
    }

    const availableAgents: AgentConfig[] = Array.from(this.agents.values()).filter(
      (agent: AgentConfig) => agent.available && this.getAgentAssignedTaskCount(agent.id) < agent.maxTasks
    );

    if (availableAgents.length === 0) {
      return { success: false, error: 'No agents available to assign task.' };
    }

    // Simple assignment: pick the first available agent
    const chosenAgent: AgentConfig = availableAgents[0];
    const updatedTask: Task = { ...task, assignedAgentId: chosenAgent.id, status: 'running' };
    this.tasks.set(taskId, updatedTask);

    // eslint-disable-next-line no-console
    console.log(`Task '${updatedTask.name}' assigned to agent '${chosenAgent.name}' (${chosenAgent.id}). Status: running.`);

    // Simulate async processing
    await new Promise((resolve: (value: unknown) => void) => setTimeout(resolve, 100)); // Simulate work with 100ms delay

    // Update task status to completed after simulation
    const completedTask: Task = { ...updatedTask, status: 'completed' };
    this.tasks.set(taskId, completedTask);
    // eslint-disable-next-line no-console
    console.log(`Task '${completedTask.name}' completed by agent '${chosenAgent.name}'. Status: completed.`);

    return { success: true, data: completedTask };
  }

  /**
   * Counts the number of pending or running tasks currently assigned to a specific agent.
   * @param agentId The ID of the agent.
   * @returns The count of active tasks for the agent.
   */
  private getAgentAssignedTaskCount(agentId: string): number {
    let count: number = 0;
    for (const task of this.tasks.values()) {
      if (task.assignedAgentId === agentId && (task.status === 'pending' || task.status === 'running')) {
        count++;
      }
    }
    return count;
  }

  /**
   * Retrieves the current status of the coordinator, including agent and task counts.
   * @returns A `PackageResult` containing the coordinator's status.
   */
  public getCoordinatorStatus(): PackageResult<{ coordinatorId: string; agentCount: number; taskCount: number; pendingTasks: number }> {
    const pendingTasks: number = Array.from(this.tasks.values()).filter(task => task.status === 'pending' || task.status === 'running').length;
    return {
      success: true,
      data: {
        coordinatorId: this.coordinatorId,
        agentCount: this.agents.size,
        taskCount: this.tasks.size,
        pendingTasks: pendingTasks,
      },
    };
  }

  /**
   * Lists all registered agents.
   * @returns A `PackageResult` containing an array of all `AgentConfig` objects.
   */
  public listAgents(): PackageResult<AgentConfig[]> {
    return { success: true, data: Array.from(this.agents.values()) };
  }

  /**
   * Lists all submitted tasks.
   * @returns A `PackageResult` containing an array of all `Task` objects.
   */
  public listTasks(): PackageResult<Task[]> {
    return { success: true, data: Array.from(this.tasks.values()) };
  }
}