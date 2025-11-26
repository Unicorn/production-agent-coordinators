/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { type AgentId, type AgentMessage, type AgentState, AgentStatusCode, type AgentTask, type CoordinatorSettings, type PackageResult, TaskStatusCode } from './types';
import { type ILogger } from './logger';
import { type IAgent, type IMessageQueue, type IStorageProvider } from './interfaces';
import { generateAgentId, calculateExponentialBackoff } from './utils';

/**
 * Handles the registration of new agents, ensuring their state is properly initialized.
 * @param agentId The ID of the agent to register.
 * @param storageProvider The storage provider to persist agent state.
 * @param logger The logger instance.
 * @returns A PackageResult indicating success or failure, with the initialized AgentState on success.
 */
export async function registerAgent(
  agentId: AgentId,
  storageProvider: IStorageProvider,
  logger: ILogger,
): Promise<PackageResult<AgentState>> {
  try {
    const existingAgent = await storageProvider.getAgentState(agentId);
    if (existingAgent !== null) {
      logger.warn(`Agent ${agentId} already registered.`);
      return { success: true, data: existingAgent };
    }

    const newAgentState: AgentState = {
      agentId,
      status: AgentStatusCode.Idle,
      lastHeartbeat: Date.now(),
      registeredAt: Date.now(),
      lastTaskAttempt: null,
      taskHistory: [],
      retryCount: 0,
    };

    const saveResult = await storageProvider.saveAgentState(newAgentState);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    logger.info(`Agent ${agentId} registered successfully.`);
    return { success: true, data: newAgentState };
  } catch (error: unknown) {
    logger.error(`Error registering agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: `Failed to register agent: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Manages the heartbeat mechanism for agents, updating their last active time and checking for staleness.
 * @param agentId The ID of the agent sending the heartbeat.
 * @param storageProvider The storage provider to update agent state.
 * @param coordinatorSettings Coordinator configuration for heartbeat timeout.
 * @param logger The logger instance.
 * @returns A PackageResult indicating success or failure.
 */
export async function handleAgentHeartbeat(
  agentId: AgentId,
  storageProvider: IStorageProvider,
  coordinatorSettings: CoordinatorSettings,
  logger: ILogger,
): Promise<PackageResult<AgentState>> {
  try {
    const agentStateResult = await storageProvider.getAgentState(agentId);
    if (agentStateResult === null) {
      logger.warn(`Heartbeat received for unregistered agent ${agentId}.`);
      return { success: false, error: `Agent ${agentId} is not registered.` };
    }

    const updatedState: AgentState = {
      ...agentStateResult,
      lastHeartbeat: Date.now(),
      status: AgentStatusCode.Idle, // Reset to idle on heartbeat, unless actively working
      retryCount: 0, // Reset retry count on successful heartbeat
    };

    const saveResult = await storageProvider.saveAgentState(updatedState);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    logger.debug(`Heartbeat from agent ${agentId} processed.`);
    return { success: true, data: updatedState };
  } catch (error: unknown) {
    logger.error(`Error processing heartbeat for agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: `Failed to process heartbeat: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Assigns a task to an agent, updating its state and sending the task via the message queue.
 * @param agentId The ID of the agent to assign the task to.
 * @param task The task to be assigned.
 * @param storageProvider The storage provider to update agent state.
 * @param messageQueue The message queue to send the task.
 * @param logger The logger instance.
 * @returns A PackageResult indicating success or failure.
 */
export async function assignTaskToAgent(
  agentId: AgentId,
  task: AgentTask,
  storageProvider: IStorageProvider,
  messageQueue: IMessageQueue,
  logger: ILogger,
): Promise<PackageResult> {
  try {
    const agentState = await storageProvider.getAgentState(agentId);
    if (agentState === null) {
      return { success: false, error: `Agent ${agentId} not found.` };
    }

    if (agentState.status === AgentStatusCode.Busy) {
      return { success: false, error: `Agent ${agentId} is currently busy.` };
    }

    const updatedState: AgentState = {
      ...agentState,
      status: AgentStatusCode.Busy,
      lastTaskAttempt: Date.now(),
      taskHistory: [...agentState.taskHistory, { taskId: task.id, status: TaskStatusCode.Assigned, timestamp: Date.now() }],
      retryCount: 0, // Reset retry count on new task assignment
    };

    const saveResult = await storageProvider.saveAgentState(updatedState);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    const message: AgentMessage = {
      type: 'ASSIGN_TASK',
      agentId,
      payload: task,
    };
    const publishResult = await messageQueue.publish(agentId, message);

    if (!publishResult.success) {
      // Revert agent state if message publishing fails
      const revertState: AgentState = {
        ...updatedState,
        status: AgentStatusCode.Idle,
        taskHistory: updatedState.taskHistory.slice(0, updatedState.taskHistory.length - 1),
      };
      await storageProvider.saveAgentState(revertState); // Log but don't fail assignment if revert fails
      logger.error(`Failed to publish task to agent ${agentId}: ${publishResult.error}. Agent state reverted.`);
      return { success: false, error: `Failed to publish task to agent: ${publishResult.error}` };
    }

    logger.info(`Task ${task.id} assigned to agent ${agentId}.`);
    return { success: true };
  } catch (error: unknown) {
    logger.error(`Error assigning task to agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: `Failed to assign task: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Handles updates from agents regarding their task status.
 * @param agentId The ID of the agent reporting the update.
 * @param taskId The ID of the task being updated.
 * @param newStatus The new status of the task.
 * @param storageProvider The storage provider to update agent state.
 * @param logger The logger instance.
 * @returns A PackageResult indicating success or failure.
 */
export async function handleTaskStatusUpdate(
  agentId: AgentId,
  taskId: string,
  newStatus: TaskStatusCode,
  storageProvider: IStorageProvider,
  logger: ILogger,
): Promise<PackageResult> {
  try {
    const agentState = await storageProvider.getAgentState(agentId);
    if (agentState === null) {
      return { success: false, error: `Agent ${agentId} not found.` };
    }

    const taskIndex = agentState.taskHistory.findIndex((t) => t.taskId === taskId);
    if (taskIndex === -1) {
      logger.warn(`Task ${taskId} not found in history for agent ${agentId}.`);
      return { success: false, error: `Task ${taskId} not found for agent ${agentId}.` };
    }

    // Update task status in history
    const updatedTaskHistory = [...agentState.taskHistory];
    updatedTaskHistory[taskIndex] = { ...updatedTaskHistory[taskIndex], status: newStatus, timestamp: Date.now() };

    const updatedState: AgentState = {
      ...agentState,
      taskHistory: updatedTaskHistory,
      status: (newStatus === TaskStatusCode.Completed || newStatus === TaskStatusCode.Failed)
        ? AgentStatusCode.Idle
        : AgentStatusCode.Busy, // Agent becomes idle if task is completed or failed
      lastHeartbeat: Date.now(), // Consider task update as a form of heartbeat
      retryCount: 0, // Reset retry count if task status update is successful
    };

    const saveResult = await storageProvider.saveAgentState(updatedState);
    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    logger.info(`Task ${taskId} for agent ${agentId} updated to status: ${newStatus}.`);
    return { success: true };
  } catch (error: unknown) {
    logger.error(`Error updating task status for agent ${agentId}, task ${taskId}: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: `Failed to update task status: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Periodically checks for stale agents (agents not sending heartbeats).
 * Stale agents might be marked for retry or considered offline.
 * @param storageProvider The storage provider to check and update agent states.
 * @param coordinatorSettings Coordinator configuration for heartbeat timeout.
 * @param logger The logger instance.
 * @returns A PackageResult containing an array of IDs of stale agents found.
 */
export async function checkStaleAgents(
  storageProvider: IStorageProvider,
  coordinatorSettings: CoordinatorSettings,
  logger: ILogger,
): Promise<PackageResult<AgentId[]>> {
  try {
    const allAgentsResult = await storageProvider.getAllAgentStates();
    if (!allAgentsResult.success || allAgentsResult.data === undefined) {
      return { success: false, error: allAgentsResult.error ?? 'Failed to retrieve all agent states.' };
    }

    const now = Date.now();
    const staleAgents: AgentId[] = [];
    const updatePromises: Array<Promise<PackageResult>> = [];

    for (const agentState of allAgentsResult.data) {
      const heartbeatTimeout = coordinatorSettings.heartbeatTimeoutMs;
      if (now - agentState.lastHeartbeat > heartbeatTimeout) {
        staleAgents.push(agentState.agentId);

        let updatedStatus: AgentStatusCode = agentState.status;
        let retryCount = agentState.retryCount;

        // Implement a basic retry logic for tasks if agent goes stale while busy
        if (agentState.status === AgentStatusCode.Busy) {
          retryCount++;
          if (retryCount <= coordinatorSettings.maxTaskRetries) {
            updatedStatus = AgentStatusCode.AwaitingRetry;
            logger.warn(`Agent ${agentState.agentId} is stale and task might need retry. Retry count: ${retryCount}`);
          } else {
            updatedStatus = AgentStatusCode.Offline;
            logger.error(`Agent ${agentState.agentId} is offline after max retries.`);
          }
        } else if (agentState.status !== AgentStatusCode.Offline) {
          updatedStatus = AgentStatusCode.Offline;
          logger.warn(`Agent ${agentState.agentId} is stale and marked as offline.`);
        }

        const updatedState: AgentState = {
          ...agentState,
          status: updatedStatus,
          retryCount,
          lastHeartbeat: now, // Update heartbeat to prevent immediate re-detection
        };
        updatePromises.push(storageProvider.saveAgentState(updatedState));
      }
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    if (staleAgents.length > 0) {
      logger.warn(`Found ${staleAgents.length} stale agents: ${staleAgents.join(', ')}`);
    } else {
      logger.debug('No stale agents found.');
    }

    return { success: true, data: staleAgents };
  } catch (error: unknown) {
    logger.error(`Error checking stale agents: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, error: `Failed to check stale agents: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * The main coordinator class that orchestrates agents, tasks, and communication.
 */
export class AgentCoordinator {
  private readonly storageProvider: IStorageProvider;
  private readonly messageQueue: IMessageQueue;
  private readonly logger: ILogger;
  private readonly settings: CoordinatorSettings;
  private heartbeatInterval: NodeJS.Timeout | undefined;
  private staleAgentCheckInterval: NodeJS.Timeout | undefined;

  /**
   * Constructs an AgentCoordinator instance.
   * @param storageProvider The storage provider for persisting agent states.
   * @param messageQueue The message queue for inter-agent communication.
   * @param settings Configuration settings for the coordinator.
   * @param logger An optional logger instance. If not provided, a default console logger is used.
   */
  constructor(
    storageProvider: IStorageProvider,
    messageQueue: IMessageQueue,
    settings: CoordinatorSettings,
    logger?: ILogger,
  ) {
    this.storageProvider = storageProvider;
    this.messageQueue = messageQueue;
    this.settings = settings;
    this.logger = logger ?? console; // Use console as fallback logger
  }

  /**
   * Initializes the coordinator, starting background tasks like heartbeat monitoring and stale agent checks.
   * @returns A Promise that resolves when initialization is complete.
   */
  public async initialize(): Promise<PackageResult> {
    try {
      this.logger.info('Initializing AgentCoordinator...');

      // Ensure storage and message queue are initialized
      const storageInitResult = await this.storageProvider.initialize();
      if (!storageInitResult.success) {
        return { success: false, error: `Failed to initialize storage provider: ${storageInitResult.error}` };
      }

      const mqInitResult = await this.messageQueue.initialize();
      if (!mqInitResult.success) {
        return { success: false, error: `Failed to initialize message queue: ${mqInitResult.error}` };
      }

      this.startBackgroundTasks();

      this.logger.info('AgentCoordinator initialized successfully.');
      return { success: true };
    } catch (error: unknown) {
      this.logger.error(`Failed to initialize AgentCoordinator: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: `Initialization failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Shuts down the coordinator, stopping all background tasks and cleaning up resources.
   * @returns A Promise that resolves when shutdown is complete.
   */
  public async shutdown(): Promise<PackageResult> {
    try {
      this.logger.info('Shutting down AgentCoordinator...');
      this.stopBackgroundTasks();

      const storageShutdownResult = await this.storageProvider.shutdown();
      if (!storageShutdownResult.success) {
        this.logger.error(`Error during storage provider shutdown: ${storageShutdownResult.error}`);
      }

      const mqShutdownResult = await this.messageQueue.shutdown();
      if (!mqShutdownResult.success) {
        this.logger.error(`Error during message queue shutdown: ${mqShutdownResult.error}`);
      }

      this.logger.info('AgentCoordinator shut down successfully.');
      return { success: true };
    } catch (error: unknown) {
      this.logger.error(`Failed to shut down AgentCoordinator: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: `Shutdown failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Registers a new agent with the coordinator.
   * If agentId is not provided, a new one will be generated.
   * @param agentId Optional, the ID of the agent to register.
   * @returns A PackageResult containing the AgentState on success.
   */
  public async registerAgent(agentId?: AgentId): Promise<PackageResult<AgentState>> {
    const idToRegister = agentId ?? generateAgentId();
    return await registerAgent(idToRegister, this.storageProvider, this.logger);
  }

  /**
   * Processes a heartbeat from an agent.
   * @param agentId The ID of the agent sending the heartbeat.
   * @returns A PackageResult indicating success or failure.
   */
  public async handleHeartbeat(agentId: AgentId): Promise<PackageResult<AgentState>> {
    return await handleAgentHeartbeat(agentId, this.storageProvider, this.settings, this.logger);
  }

  /**
   * Dispatches a task to an available or specified agent.
   * @param task The task to dispatch.
   * @param targetAgentId Optional, the specific agent to dispatch the task to. If not provided,
   *                      the coordinator will attempt to find an available agent.
   * @returns A PackageResult indicating success or failure.
   */
  public async dispatchTask(task: AgentTask, targetAgentId?: AgentId): Promise<PackageResult> {
    try {
      let agentToAssign: AgentId | undefined = targetAgentId;

      if (agentToAssign === undefined) {
        const availableAgentsResult = await this.getAvailableAgents();
        if (!availableAgentsResult.success || availableAgentsResult.data === undefined || availableAgentsResult.data.length === 0) {
          this.logger.warn('No available agents to dispatch task.');
          return { success: false, error: 'No available agents.' };
        }
        // For now, pick the first available agent. Future: more sophisticated scheduling.
        agentToAssign = availableAgentsResult.data[0].agentId;
      }

      if (agentToAssign === undefined) {
        return { success: false, error: 'Could not determine an agent to assign the task.' };
      }

      return await assignTaskToAgent(agentToAssign, task, this.storageProvider, this.messageQueue, this.logger);
    } catch (error: unknown) {
      this.logger.error(`Error dispatching task ${task.id}: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: `Failed to dispatch task: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Reports the status of a task from an agent.
   * @param agentId The ID of the agent.
   * @param taskId The ID of the task.
   * @param status The new status of the task.
   * @returns A PackageResult indicating success or failure.
   */
  public async reportTaskStatus(agentId: AgentId, taskId: string, status: TaskStatusCode): Promise<PackageResult> {
    return await handleTaskStatusUpdate(agentId, taskId, status, this.storageProvider, this.logger);
  }

  /**
   * Retrieves the current state of a specific agent.
   * @param agentId The ID of the agent.
   * @returns A PackageResult containing the AgentState on success.
   */
  public async getAgentState(agentId: AgentId): Promise<PackageResult<AgentState>> {
    try {
      const agentState = await this.storageProvider.getAgentState(agentId);
      if (agentState === null) {
        return { success: false, error: `Agent ${agentId} not found.` };
      }
      return { success: true, data: agentState };
    } catch (error: unknown) {
      this.logger.error(`Error retrieving state for agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: `Failed to retrieve agent state: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Retrieves the states of all registered agents.
   * @returns A PackageResult containing an array of AgentState objects on success.
   */
  public async getAllAgentStates(): Promise<PackageResult<AgentState[]>> {
    return await this.storageProvider.getAllAgentStates();
  }

  /**
   * Retrieves a list of agents currently considered available (Idle).
   * @returns A PackageResult containing an array of available AgentState objects.
   */
  public async getAvailableAgents(): Promise<PackageResult<AgentState[]>> {
    try {
      const allStatesResult = await this.storageProvider.getAllAgentStates();
      if (!allStatesResult.success || allStatesResult.data === undefined) {
        return { success: false, error: allStatesResult.error ?? 'Failed to retrieve all agent states.' };
      }

      const availableAgents = allStatesResult.data.filter((agent) => agent.status === AgentStatusCode.Idle);
      return { success: true, data: availableAgents };
    } catch (error: unknown) {
      this.logger.error(`Error getting available agents: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: `Failed to get available agents: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Retries a failed or awaiting-retry task for a specific agent.
   * This logic should be expanded based on specific retry policies (e.g., exponential backoff).
   * @param agentId The ID of the agent whose task needs to be retried.
   * @param taskId The ID of the task to retry.
   * @returns A PackageResult indicating success or failure.
   */
  public async retryTaskForAgent(agentId: AgentId, taskId: string): Promise<PackageResult> {
    try {
      const agentState = await this.storageProvider.getAgentState(agentId);
      if (agentState === null) {
        return { success: false, error: `Agent ${agentId} not found.` };
      }

      const taskEntry = agentState.taskHistory.find((t) => t.taskId === taskId);
      if (taskEntry === undefined) {
        return { success: false, error: `Task ${taskId} not found for agent ${agentId}.` };
      }

      // Check retry conditions, e.g., if it's failed or awaiting retry
      if (taskEntry.status !== TaskStatusCode.Failed && taskEntry.status !== TaskStatusCode.AwaitingRetry) {
        return { success: false, error: `Task ${taskId} for agent ${agentId} is not in a retryable state (${taskEntry.status}).` };
      }

      // Implement backoff logic
      const currentRetryCount = agentState.retryCount;
      const backoffDelay = calculateExponentialBackoff(currentRetryCount, this.settings.baseRetryDelayMs);

      if (currentRetryCount >= this.settings.maxTaskRetries) {
        this.logger.warn(`Max retries reached for task ${taskId} on agent ${agentId}. Not retrying.`);
        return { success: false, error: `Max retries reached for task ${taskId}.` };
      }

      this.logger.info(`Retrying task ${taskId} for agent ${agentId} after a ${backoffDelay}ms delay.`);

      // Update agent state for retry
      const updatedState: AgentState = {
        ...agentState,
        status: AgentStatusCode.Busy, // Mark as busy while retrying
        lastTaskAttempt: Date.now(),
        retryCount: currentRetryCount + 1,
      };

      const saveResult = await this.storageProvider.saveAgentState(updatedState);
      if (!saveResult.success) {
        return { success: false, error: saveResult.error };
      }

      // In a real scenario, this would involve re-queuing the task for the agent.
      // For this example, we'll simulate by updating its status to assigned.
      // Need to retrieve the full task details to send it again.
      // For now, assume task details are stored or can be reconstructed.
      // This is a simplification; a full implementation would involve re-fetching task payload.
      const simulatedTask: AgentTask = { id: taskId, type: 'retry', payload: {} }; // Placeholder
      const dispatchResult = await assignTaskToAgent(agentId, simulatedTask, this.storageProvider, this.messageQueue, this.logger);

      if (!dispatchResult.success) {
        // Revert retry count if dispatch fails
        const revertState: AgentState = { ...updatedState, status: AgentStatusCode.AwaitingRetry, retryCount: currentRetryCount };
        await this.storageProvider.saveAgentState(revertState);
        return { success: false, error: `Failed to re-dispatch task ${taskId}: ${dispatchResult.error}` };
      }

      this.logger.info(`Task ${taskId} re-dispatched for agent ${agentId}.`);
      return { success: true };
    } catch (error: unknown) {
      this.logger.error(`Error retrying task ${taskId} for agent ${agentId}: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, error: `Failed to retry task: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Starts periodic background tasks for the coordinator.
   */
  private startBackgroundTasks(): void {
    this.stopBackgroundTasks(); // Ensure any existing intervals are cleared first

    this.staleAgentCheckInterval = setInterval(() => {
      void this.performStaleAgentCheck();
    }, this.settings.staleAgentCheckIntervalMs);

    this.logger.info('Background tasks started.');
  }

  /**
   * Stops all periodic background tasks.
   */
  private stopBackgroundTasks(): void {
    if (this.heartbeatInterval !== undefined) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    if (this.staleAgentCheckInterval !== undefined) {
      clearInterval(this.staleAgentCheckInterval);
      this.staleAgentCheckInterval = undefined;
    }
    this.logger.info('Background tasks stopped.');
  }

  /**
   * Performs the periodic check for stale agents.
   */
  private async performStaleAgentCheck(): Promise<void> {
    this.logger.debug('Running stale agent check...');
    const result = await checkStaleAgents(this.storageProvider, this.settings, this.logger);
    if (!result.success) {
      this.logger.error(`Stale agent check failed: ${result.error}`);
    } else if (result.data !== undefined && result.data.length > 0) {
      this.logger.warn(`Stale agents detected: ${result.data.join(', ')}`);
    } else {
      this.logger.debug('No stale agents found in this check.');
    }
  }
}