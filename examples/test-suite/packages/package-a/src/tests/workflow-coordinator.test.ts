/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { AgentCoordinator } from '../coordinators/agent-coordinator';
import { WorkflowCoordinator } from '../coordinators/workflow-coordinator';
import { DataService } from '../services/data-service';
import { Logger, LogLevel } from '../utils/logger';
import { Agent, AgentId, AgentStatus, AgentType } from '../models/agent';
import { AgentCapability, AgentConfiguration, WorkflowExecutionResult } from '../types';
import { WorkflowDefinition, WorkflowId, WorkflowState, WorkflowStatus } from '../models/workflow';

describe('WorkflowCoordinator', () => {
  let agentCoordinator: AgentCoordinator;
  let dataService: DataService;
  let workflowCoordinator: WorkflowCoordinator;
  let logger: Logger;

  beforeEach(() => {
    jest.useFakeTimers();
    logger = new Logger('TestWorkflowCoordinator', LogLevel.ERROR); // Only log errors during tests
    agentCoordinator = new AgentCoordinator(logger);
    dataService = new DataService(logger);
    workflowCoordinator = new WorkflowCoordinator(agentCoordinator, dataService, logger);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // Helper to create a test agent
  const createTestAgent = (
    id: AgentId,
    type: AgentType,
    status: AgentStatus,
    config?: AgentConfiguration,
    capabilities?: AgentCapability[],
  ): void => {
    const agent: Agent = { id, type, status };
    const agentConfig: AgentConfiguration = config || { maxConcurrentWorkflows: 1 };
    const agentCapabilities: AgentCapability[] = capabilities || ['data-processing'];
    agentCoordinator.registerAgent(agent, agentConfig, agentCapabilities);
  };

  // Helper to create a test workflow definition
  const createTestWorkflowDefinition = (
    id: WorkflowId,
    name: string,
    requiredCapabilities: AgentCapability[] = ['data-processing'],
  ): WorkflowDefinition => ({
    id,
    name,
    description: `Description for ${name}`,
    steps: [{ id: 'step1', name: 'process', requiredCapabilities }],
    requiredCapabilities,
  });

  describe('registerWorkflowDefinition', () => {
    it('should register a new workflow definition successfully', async () => {
      const definition = createTestWorkflowDefinition('wf1', 'Test Workflow 1');
      const result = await workflowCoordinator.registerWorkflowDefinition(definition);

      expect(result.success).toBe(true);
      expect(result.data).toBe('wf1');

      const workflowStateResult = await workflowCoordinator.getWorkflowState('wf1');
      expect(workflowStateResult.success).toBe(true);
      expect(workflowStateResult.data?.id).toBe('wf1');
      expect(workflowStateResult.data?.status).toBe('defined');
    });

    it('should update an existing workflow definition if registered again', async () => {
      const definition1 = createTestWorkflowDefinition('wf1', 'Test Workflow 1');
      await workflowCoordinator.registerWorkflowDefinition(definition1);

      const updatedDefinition = { ...definition1, name: 'Updated Workflow 1' };
      const result = await workflowCoordinator.registerWorkflowDefinition(updatedDefinition);

      expect(result.success).toBe(true);
      expect(result.data).toBe('wf1');

      const workflowStateResult = await workflowCoordinator.getWorkflowState('wf1');
      expect(workflowStateResult.success).toBe(true);
      expect(workflowStateResult.data?.definition.name).toBe('Updated Workflow 1');
    });

    it('should fail if data service fails to save initial state', async () => {
      // Mock DataService to simulate failure
      jest.spyOn(dataService, 'saveWorkflowState').mockImplementationOnce(async () => {
        return await Promise.resolve({ success: false, error: 'Storage error' });
      });

      const definition = createTestWorkflowDefinition('wf-fail', 'Failing Workflow');
      const result = await workflowCoordinator.registerWorkflowDefinition(definition);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to save workflow definition');
    });
  });

  describe('startWorkflow', () => {
    it('should start a workflow and assign it to an available agent', async () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['data-processing']);
      const definition = createTestWorkflowDefinition('wf1', 'Test Workflow 1', ['data-processing']);
      await workflowCoordinator.registerWorkflowDefinition(definition);

      const result = await workflowCoordinator.startWorkflow('wf1', ['data-processing']);

      expect(result.success).toBe(true);
      expect(result.data?.assignedAgentId).toBe('agent1');

      const workflowStateResult = await workflowCoordinator.getWorkflowState('wf1');
      expect(workflowStateResult.success).toBe(true);
      expect(workflowStateResult.data?.status).toBe('running');
      expect(workflowStateResult.data?.assignedAgentId).toBe('agent1');

      const agentStateResult = agentCoordinator.getAgentState('agent1');
      expect(agentStateResult.success).toBe(true);
      expect(agentStateResult.data?.activeWorkflows).toContain('wf1');
    });

    it('should return an error if workflow definition not found', async () => {
      const result = await workflowCoordinator.startWorkflow('nonExistentWf', ['data-processing']);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Workflow definition nonExistentWf not found.');
    });

    it('should return an error if no available agents match capabilities', async () => {
      const definition = createTestWorkflowDefinition('wf1', 'Test Workflow 1', ['unmatched-capability']);
      await workflowCoordinator.registerWorkflowDefinition(definition);

      const result = await workflowCoordinator.startWorkflow('wf1', ['unmatched-capability']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No available agents');

      // Workflow status should be 'failed'
      const workflowStateResult = await workflowCoordinator.getWorkflowState('wf1');
      expect(workflowStateResult.success).toBe(true);
      expect(workflowStateResult.data?.status).toBe('failed');
    });

    it('should return an error if agent coordinator fails to assign workflow', async () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 0 }, ['data-processing']); // Agent cannot take workflows
      const definition = createTestWorkflowDefinition('wf1', 'Test Workflow 1', ['data-processing']);
      await workflowCoordinator.registerWorkflowDefinition(definition);

      const result = await workflowCoordinator.startWorkflow('wf1', ['data-processing']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to assign workflow to agent');

      // Workflow status should be 'failed'
      const workflowStateResult = await workflowCoordinator.getWorkflowState('wf1');
      expect(workflowStateResult.success).toBe(true);
      expect(workflowStateResult.data?.status).toBe('failed');
    });

    it('should return an error if workflow is already running or paused', async () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['data-processing']);
      const definition = createTestWorkflowDefinition('wf1', 'Test Workflow 1', ['data-processing']);
      await workflowCoordinator.registerWorkflowDefinition(definition);
      await workflowCoordinator.startWorkflow('wf1', ['data-processing']); // Start it once

      const result = await workflowCoordinator.startWorkflow('wf1', ['data-processing']); // Try to start again
      expect(result.success).toBe(false);
      expect(result.error).toContain('Workflow wf1 is already running.');
    });

    it('should persist state changes when starting a workflow', async () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['data-processing']);
      const definition = createTestWorkflowDefinition('wf-persist', 'Persist Workflow', ['data-processing']);
      await workflowCoordinator.registerWorkflowDefinition(definition);

      const initialSaveSpy = jest.spyOn(dataService, 'saveWorkflowState');
      await workflowCoordinator.startWorkflow('wf-persist', ['data-processing']);
      expect(initialSaveSpy).toHaveBeenCalledTimes(2); // One for register, one for start
    });
  });

  describe('reportWorkflowCompletion', () => {
    it('should mark a workflow as completed successfully', async () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['data-processing']);
      const definition = createTestWorkflowDefinition('wf1', 'Test Workflow 1', ['data-processing']);
      await workflowCoordinator.registerWorkflowDefinition(definition);
      await workflowCoordinator.startWorkflow('wf1', ['data-processing']);

      const completionResult: WorkflowExecutionResult = { success: true, output: { status: 'done' } };
      const reportResult = await workflowCoordinator.reportWorkflowCompletion('wf1', completionResult);

      expect(reportResult.success).toBe(true);
      expect(reportResult.data).toBe(true);

      const workflowStateResult = await workflowCoordinator.getWorkflowState('wf1');
      expect(workflowStateResult.success).toBe(true);
      expect(workflowStateResult.data?.status).toBe('completed');
      expect(workflowStateResult.data?.assignedAgentId).toBeNull(); // Should be unassigned
      expect(workflowStateResult.data?.endTime).toBeDefined();

      const agentStateResult = agentCoordinator.getAgentState('agent1');
      expect(agentStateResult.success).toBe(true);
      expect(agentStateResult.data?.activeWorkflows).not.toContain('wf1');
    });

    it('should mark a workflow as failed', async () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['data-processing']);
      const definition = createTestWorkflowDefinition('wf1', 'Test Workflow 1', ['data-processing']);
      await workflowCoordinator.registerWorkflowDefinition(definition);
      await workflowCoordinator.startWorkflow('wf1', ['data-processing']);

      const failureResult: WorkflowExecutionResult = { success: false, error: 'Processing error' };
      const reportResult = await workflowCoordinator.reportWorkflowCompletion('wf1', failureResult);

      expect(reportResult.success).toBe(true);
      expect(reportResult.data).toBe(true);

      const workflowStateResult = await workflowCoordinator.getWorkflowState('wf1');
      expect(workflowStateResult.success).toBe(true);
      expect(workflowStateResult.data?.status).toBe('failed');
      expect(workflowStateResult.data?.assignedAgentId).toBeNull();
      expect(workflowStateResult.data?.endTime).toBeDefined();
      expect(workflowStateResult.data?.executionLog).toContain('Error: Processing error');
    });

    it('should return an error if workflow not found', async () => {
      const completionResult: WorkflowExecutionResult = { success: true };
      const reportResult = await workflowCoordinator.reportWorkflowCompletion(
        'nonExistentWf',
        completionResult,
      );
      expect(reportResult.success).toBe(false);
      expect(reportResult.error).toBe('Workflow nonExistentWf not found.');
    });

    it('should handle agent unassignment failure gracefully', async () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['data-processing']);
      const definition = createTestWorkflowDefinition('wf1', 'Test Workflow 1', ['data-processing']);
      await workflowCoordinator.registerWorkflowDefinition(definition);
      await workflowCoordinator.startWorkflow('wf1', ['data-processing']);

      // Simulate agent coordinator failing to unassign
      jest.spyOn(agentCoordinator, 'unassignWorkflowFromAgent').mockImplementationOnce(() => ({
        success: false,
        error: 'Unassignment failed',
      }));

      const completionResult: WorkflowExecutionResult = { success: true };
      const reportResult = await workflowCoordinator.reportWorkflowCompletion('wf1', completionResult);

      expect(reportResult.success).toBe(true); // Workflow completion still reported success
      const workflowStateResult = await workflowCoordinator.getWorkflowState('wf1');
      expect(workflowStateResult.success).toBe(true);
      expect(workflowStateResult.data?.status).toBe('completed');
      // Agent should still technically be assigned in agentCoordinator, but workflow state updated
    });

    it('should persist state changes when reporting completion', async () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['data-processing']);
      const definition = createTestWorkflowDefinition('wf-persist-complete', 'Persist Complete', ['data-processing']);
      await workflowCoordinator.registerWorkflowDefinition(definition);
      await workflowCoordinator.startWorkflow('wf-persist-complete', ['data-processing']);

      const saveSpy = jest.spyOn(dataService, 'saveWorkflowState');
      saveSpy.mockClear(); // Clear previous calls from start and register
      await workflowCoordinator.reportWorkflowCompletion('wf-persist-complete', { success: true });
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getWorkflowState', () => {
    it('should retrieve existing workflow state from memory', async () => {
      const definition = createTestWorkflowDefinition('wf-get-mem', 'Get From Memory');
      await workflowCoordinator.registerWorkflowDefinition(definition);

      const result = await workflowCoordinator.getWorkflowState('wf-get-mem');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('wf-get-mem');
    });

    it('should load workflow state from data service if not in memory', async () => {
      const definition = createTestWorkflowDefinition('wf-get-load', 'Get From Load');
      // Register, so it's saved to dataService, but not 'running' in coordinator's memory
      await workflowCoordinator.registerWorkflowDefinition(definition);

      // Create a new coordinator instance to simulate fresh start without in-memory state
      const newWorkflowCoordinator = new WorkflowCoordinator(agentCoordinator, dataService, logger);

      const result = await newWorkflowCoordinator.getWorkflowState('wf-get-load');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('wf-get-load');
      expect(result.data?.status).toBe('defined'); // Loaded state
    });

    it('should return an error if workflow state not found in memory or data service', async () => {
      const result = await workflowCoordinator.getWorkflowState('wf-nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Workflow wf-nonexistent not found.');
    });

    it('should return an error if data service fails to load state', async () => {
      jest.spyOn(dataService, 'loadWorkflowState').mockImplementationOnce(async () => {
        return await Promise.resolve({ success: false, error: 'Load error' });
      });

      // Ensure it's not in memory first
      const newWorkflowCoordinator = new WorkflowCoordinator(agentCoordinator, dataService, logger);

      const result = await newWorkflowCoordinator.getWorkflowState('some-workflow-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Workflow some-workflow-id not found.'); // The error message from `getWorkflowState` is generic if not found
    });
  });

  describe('mapInternalToExternalState and mapExternalToInternalState', () => {
    it('should correctly map between internal and external workflow states', () => {
      const internalState: InternalWorkflowState = {
        workflowId: 'wf-map',
        definition: createTestWorkflowDefinition('wf-map', 'Mapping Workflow'),
        status: 'running',
        assignedAgentId: 'agent-map',
        startTime: new Date('2024-01-01T10:00:00Z'),
        endTime: new Date('2024-01-01T10:30:00Z'),
        currentStepIndex: 1,
        executionLog: ['started', 'step1 done'],
      };

      const externalState = workflowCoordinator['mapInternalToExternalState'](internalState);

      expect(externalState.id).toBe('wf-map');
      expect(externalState.status).toBe('running');
      expect(externalState.startTime).toBe('2024-01-01T10:00:00.000Z');
      expect(externalState.endTime).toBe('2024-01-01T10:30:00.000Z');

      const remappedInternalState = workflowCoordinator['mapExternalToInternalState'](externalState);

      expect(remappedInternalState.workflowId).toBe('wf-map');
      expect(remappedInternalState.status).toBe('running');
      expect(remappedInternalState.startTime.toISOString()).toBe('2024-01-01T10:00:00.000Z');
      expect(remappedInternalState.endTime?.toISOString()).toBe('2024-01-01T10:30:00.000Z');
    });

    it('should handle undefined endTime correctly during mapping', () => {
      const internalState: InternalWorkflowState = {
        workflowId: 'wf-map-no-end',
        definition: createTestWorkflowDefinition('wf-map-no-end', 'No End Time'),
        status: 'running',
        assignedAgentId: 'agent-map',
        startTime: new Date('2024-01-01T10:00:00Z'),
        currentStepIndex: 0,
        executionLog: ['started'],
      };

      const externalState = workflowCoordinator['mapInternalToExternalState'](internalState);
      expect(externalState.endTime).toBeUndefined();

      const remappedInternalState = workflowCoordinator['mapExternalToInternalState'](externalState);
      expect(remappedInternalState.endTime).toBeUndefined();
    });
  });
});

// Define InternalWorkflowState outside the test scope for white-box testing of private methods
interface InternalWorkflowState {
  workflowId: WorkflowId;
  definition: WorkflowDefinition;
  status: WorkflowStatus;
  assignedAgentId: string | null;
  startTime: Date;
  endTime?: Date;
  currentStepIndex: number;
  executionLog: string[];
}
