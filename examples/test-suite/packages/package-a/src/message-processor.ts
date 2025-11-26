/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/
import { DataStore } from './data-store';
import { TaskOrchestrator } from './task-orchestrator';
import { WebSocketHandler } from './websocket-handler';
import {
  AgentCoordinatorMessage,
  AgentCoordinatorEventType,
  InitiateTaskPayload,
  TaskStatusUpdatePayload,
  AgentHeartbeatPayload,
  PackageResult,
  ClientWebSocket
} from './shared-types';
import { createPackageResult } from './utils';

export class MessageProcessor {
  private _dataStore: DataStore;
  private _taskOrchestrator: TaskOrchestrator;
  private _webSocketHandler: WebSocketHandler;

  constructor(dataStore: DataStore, taskOrchestrator: TaskOrchestrator, webSocketHandler: WebSocketHandler) {
    this._dataStore = dataStore;
    this._taskOrchestrator = taskOrchestrator;
    this._webSocketHandler = webSocketHandler;
  }

  public async processIncomingMessage(
    message: AgentCoordinatorMessage,
    client: ClientWebSocket
  ): Promise<PackageResult> {
    const { type, payload } = message;
    const agentId = client.id;

    if (!agentId) {
      return createPackageResult(false, undefined, 'Client is not registered with an agent ID.');
    }

    switch (type) {
      case AgentCoordinatorEventType.INITIATE_TASK: {
        const initiateTaskPayload = payload as InitiateTaskPayload;
        // The orchestrator methods are synchronous and return PackageResult directly
        const assignResult = this._taskOrchestrator.assignTaskToAgent(initiateTaskPayload.agentId, initiateTaskPayload.task);
        if (!assignResult.success) {
          return assignResult;
        }
        return createPackageResult(true);
      }
      case AgentCoordinatorEventType.TASK_STATUS_UPDATE: {
        const statusUpdatePayload = payload as TaskStatusUpdatePayload;
        // The orchestrator methods are synchronous and return PackageResult directly
        const updateResult = this._taskOrchestrator.updateTaskStatus(
          statusUpdatePayload.taskId,
          statusUpdatePayload.status,
          statusUpdatePayload.result
        );
        if (!updateResult.success) {
          return updateResult;
        }
        return createPackageResult(true);
      }
      case AgentCoordinatorEventType.AGENT_HEARTBEAT: {
        const heartbeatPayload = payload as AgentHeartbeatPayload;
        // The orchestrator methods are synchronous and return PackageResult directly
        const heartbeatResult = this._taskOrchestrator.handleAgentHeartbeat(
          agentId,
          heartbeatPayload.capabilities
        );
        if (!heartbeatResult.success) {
          return heartbeatResult;
        }
        return createPackageResult(true);
      }
      default:
        return createPackageResult(false, undefined, `Unknown message type: ${type}`);
    }
  }
}