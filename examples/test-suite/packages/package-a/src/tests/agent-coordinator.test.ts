/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { AgentCoordinator } from '../coordinators/agent-coordinator';
import { Agent, AgentId, AgentState, AgentStatus, AgentType } from '../models/agent';
import { AgentCapability, AgentConfiguration } from '../types';
import { Logger, LogLevel } from '../utils/logger';

describe('AgentCoordinator', () => {
  let agentCoordinator: AgentCoordinator;
  let logger: Logger;

  beforeEach(() => {
    jest.useFakeTimers(); // Enable fake timers
    logger = new Logger('TestAgentCoordinator', LogLevel.ERROR); // Only log errors during tests
    agentCoordinator = new AgentCoordinator(logger);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers(); // Ensure all timers are cleared before moving to the next test
    jest.clearAllTimers(); // Clear any pending timers
    jest.useRealTimers(); // Restore real timers
  });

  // Helper function to create an agent
  const createTestAgent = (
    id: AgentId,
    type: AgentType,
    status: AgentStatus,
    config?: AgentConfiguration,
    capabilities?: AgentCapability[],
  ): void => { // Explicitly define return type for helper
    const agent: Agent = { id, type, status };
    const agentConfig: AgentConfiguration = config || { maxConcurrentWorkflows: 1 };
    const agentCapabilities: AgentCapability[] = capabilities || ['data-processing'];
    agentCoordinator.registerAgent(agent, agentConfig, agentCapabilities);
  };

  describe('registerAgent', () => {
    it('should register a new agent successfully', () => {
      const agent: Agent = { id: 'agent1', type: 'processor', status: 'idle' };
      const config: AgentConfiguration = { maxConcurrentWorkflows: 5 };
      const capabilities: AgentCapability[] = ['data-processing', 'reporting'];

      const result = agentCoordinator.registerAgent(agent, config, capabilities);

      expect(result.success).toBe(true);
      expect(result.data).toBe('agent1');
      expect(agentCoordinator.getAgentCount()).toBe(1);

      const agentStateResult = agentCoordinator.getAgentState('agent1');
      expect(agentStateResult.success).toBe(true);
      expect(agentStateResult.data?.id).toBe('agent1');
      expect(agentStateResult.data?.type).toBe('processor');
      expect(agentStateResult.data?.capabilities).toEqual(expect.arrayContaining(capabilities));
      expect(agentStateResult.data?.lastHeartbeat).toBeInstanceOf(Date);
    });

    it('should update an existing agent if registered again', () => {
      createTestAgent('agent1', 'processor', 'idle');
      expect(agentCoordinator.getAgentCount()).toBe(1);

      const updatedAgent: Agent = { id: 'agent1', type: 'analytics', status: 'busy' };
      const updatedConfig: AgentConfiguration = { maxConcurrentWorkflows: 10 };
      const updatedCapabilities: AgentCapability[] = ['analytics', 'ml'];

      const result = agentCoordinator.registerAgent(
        updatedAgent,
        updatedConfig,
        updatedCapabilities,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('agent1');
      expect(agentCoordinator.getAgentCount()).toBe(1); // Still 1 agent

      const agentStateResult = agentCoordinator.getAgentState('agent1');
      expect(agentStateResult.success).toBe(true);
      expect(agentStateResult.data?.type).toBe('analytics');
      expect(agentStateResult.data?.status).toBe('busy');
      expect(agentStateResult.data?.capabilities).toEqual(expect.arrayContaining(updatedCapabilities));
    });

    it('should return an error if agent ID or Type is missing', () => {
      const agent: Agent = { id: '', type: 'processor', status: 'idle' }; // Missing ID
      const config: AgentConfiguration = {};
      const capabilities: AgentCapability[] = [];

      const result = agentCoordinator.registerAgent(agent, config, capabilities);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent ID and Type are required.');
    });
  });

  describe('deregisterAgent', () => {
    it('should deregister an existing agent successfully', () => {
      createTestAgent('agent1', 'processor', 'idle');
      expect(agentCoordinator.getAgentCount()).toBe(1);

      const result = agentCoordinator.deregisterAgent('agent1');
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(agentCoordinator.getAgentCount()).toBe(0);
      expect(agentCoordinator.getAgentState('agent1').success).toBe(false);
    });

    it('should return an error if agent does not exist', () => {
      const result = agentCoordinator.deregisterAgent('nonExistentAgent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent nonExistentAgent not found.');
    });

    it('should return an error if agent has active workflows', () => {
      createTestAgent('agent1', 'processor', 'idle');
      agentCoordinator.assignWorkflowToAgent('agent1', 'workflow1');

      const result = agentCoordinator.deregisterAgent('agent1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('is currently assigned to active workflows.');
      expect(agentCoordinator.getAgentCount()).toBe(1); // Agent should still be there
    });
  });

  describe('recordHeartbeat', () => {
    it('should update the lastHeartbeat for an existing agent', () => {
      createTestAgent('agent1', 'processor', 'idle');
      const initialHeartbeat = agentCoordinator.getAgentState('agent1').data?.lastHeartbeat;
      expect(initialHeartbeat).toBeInstanceOf(Date);

      // Simulate a small delay
      jest.advanceTimersByTime(100);

      const result = agentCoordinator.recordHeartbeat('agent1');
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);

      const updatedHeartbeat = agentCoordinator.getAgentState('agent1').data?.lastHeartbeat;
      expect(updatedHeartbeat).toBeInstanceOf(Date);
      expect(updatedHeartbeat?.getTime()).toBeGreaterThan(initialHeartbeat?.getTime() ?? 0);
    });

    it('should return an error if agent does not exist', () => {
      const result = agentCoordinator.recordHeartbeat('nonExistentAgent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent nonExistentAgent not found.');
    });
  });

  describe('getAgentState', () => {
    it('should retrieve the correct state for an existing agent', () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['cap1', 'cap2']);
      agentCoordinator.assignWorkflowToAgent('agent1', 'workflow1');

      const result = agentCoordinator.getAgentState('agent1');
      expect(result.success).toBe(true);
      const agentState = result.data as AgentState;
      expect(agentState.id).toBe('agent1');
      expect(agentState.type).toBe('processor');
      expect(agentState.status).toBe('idle');
      expect(agentState.activeWorkflows).toEqual(['workflow1']);
      expect(agentState.capabilities).toEqual(['cap1', 'cap2']);
      expect(agentState.lastHeartbeat).toBeInstanceOf(Date);
    });

    it('should return an error if agent does not exist', () => {
      const result = agentCoordinator.getAgentState('nonExistentAgent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent nonExistentAgent not found.');
    });
  });

  describe('assignWorkflowToAgent', () => {
    it('should assign a workflow to an agent successfully', () => {
      createTestAgent('agent1', 'processor', 'idle');
      const result = agentCoordinator.assignWorkflowToAgent('agent1', 'workflow1');
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);

      const agentState = agentCoordinator.getAgentState('agent1').data;
      expect(agentState?.activeWorkflows).toContain('workflow1');
    });

    it('should return an error if agent does not exist', () => {
      const result = agentCoordinator.assignWorkflowToAgent('nonExistentAgent', 'workflow1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent nonExistentAgent not found.');
    });

    it('should not add the same workflow twice', () => {
      createTestAgent('agent1', 'processor', 'idle');
      agentCoordinator.assignWorkflowToAgent('agent1', 'workflow1');
      const result = agentCoordinator.assignWorkflowToAgent('agent1', 'workflow1'); // Assign again
      expect(result.success).toBe(true); // Still reports success even if already added (Set behavior)
      const agentState = agentCoordinator.getAgentState('agent1').data;
      expect(agentState?.activeWorkflows.length).toBe(1);
    });
  });

  describe('unassignWorkflowFromAgent', () => {
    it('should unassign an active workflow from an agent successfully', () => {
      createTestAgent('agent1', 'processor', 'idle');
      agentCoordinator.assignWorkflowToAgent('agent1', 'workflow1');
      expect(agentCoordinator.getAgentState('agent1').data?.activeWorkflows).toContain('workflow1');

      const result = agentCoordinator.unassignWorkflowFromAgent('agent1', 'workflow1');
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);

      const agentState = agentCoordinator.getAgentState('agent1').data;
      expect(agentState?.activeWorkflows).not.toContain('workflow1');
    });

    it('should return an error if agent does not exist', () => {
      const result = agentCoordinator.unassignWorkflowFromAgent('nonExistentAgent', 'workflow1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent nonExistentAgent not found.');
    });

    it('should return an error if workflow is not active on agent', () => {
      createTestAgent('agent1', 'processor', 'idle');
      const result = agentCoordinator.unassignWorkflowFromAgent('agent1', 'nonActiveWorkflow');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Workflow nonActiveWorkflow not active on agent agent1.');
    });
  });

  describe('findAvailableAgents', () => {
    it('should find agents with matching capabilities', () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['cap1', 'cap2']);
      createTestAgent('agent2', 'api-handler', 'idle', { maxConcurrentWorkflows: 1 }, ['cap2', 'cap3']);
      createTestAgent('agent3', 'reporter', 'idle', { maxConcurrentWorkflows: 1 }, ['cap1', 'cap3']); // Changed status to idle for agent3

      const result = agentCoordinator.findAvailableAgents(['cap1']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining(['agent1', 'agent3']));
      expect(result.data?.length).toBe(2);
    });

    it('should find agents with all required capabilities', () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['cap1', 'cap2']);
      createTestAgent('agent2', 'api-handler', 'idle', { maxConcurrentWorkflows: 1 }, ['cap2', 'cap3']);

      const result = agentCoordinator.findAvailableAgents(['cap1', 'cap2']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining(['agent1']));
      expect(result.data?.length).toBe(1);
    });

    it('should not find agents that are busy or offline', () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['cap1']);
      createTestAgent('agent2', 'processor', 'busy', { maxConcurrentWorkflows: 1 }, ['cap1']);
      createTestAgent('agent3', 'processor', 'offline', { maxConcurrentWorkflows: 1 }, ['cap1']);
      createTestAgent('agent4', 'processor', 'error', { maxConcurrentWorkflows: 1 }, ['cap1']);

      const result = agentCoordinator.findAvailableAgents(['cap1']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining(['agent1']));
      expect(result.data?.length).toBe(1);
    });

    it('should not find agents that are overloaded (based on maxConcurrentWorkflows)', () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['cap1']);
      agentCoordinator.assignWorkflowToAgent('agent1', 'workflow1'); // Agent1 is now at max load

      createTestAgent('agent2', 'processor', 'idle', { maxConcurrentWorkflows: 2 }, ['cap1']);
      agentCoordinator.assignWorkflowToAgent('agent2', 'workflow2'); // Agent2 is at half load

      const result = agentCoordinator.findAvailableAgents(['cap1']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining(['agent2']));
      expect(result.data?.length).toBe(1);
    });

    it('should return error if no agents match capabilities', () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['cap1']);
      const result = agentCoordinator.findAvailableAgents(['nonExistentCap']);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No available agents found for the specified capabilities.');
    });

    it('should return all available agents if no capabilities are required', () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['cap1']);
      createTestAgent('agent2', 'processor', 'idle', { maxConcurrentWorkflows: 1 }, ['cap2']);
      const result = agentCoordinator.findAvailableAgents([]);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining(['agent1', 'agent2']));
    });

    it('should handle agents with undefined maxConcurrentWorkflows as having no limit', () => {
      createTestAgent('agent1', 'processor', 'idle', { maxConcurrentWorkflows: undefined }, ['cap1']);
      agentCoordinator.assignWorkflowToAgent('agent1', 'workflow1');
      agentCoordinator.assignWorkflowToAgent('agent1', 'workflow2'); // Should still be available if no limit

      const result = agentCoordinator.findAvailableAgents(['cap1']);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.arrayContaining(['agent1']));
    });
  });

  describe('getAllAgentIds and getAgentCount', () => {
    it('should return all registered agent IDs', () => {
      createTestAgent('agent1', 'processor', 'idle');
      createTestAgent('agent2', 'processor', 'busy');
      const ids = agentCoordinator.getAllAgentIds();
      expect(ids.length).toBe(2);
      expect(ids).toEqual(expect.arrayContaining(['agent1', 'agent2']));
    });

    it('should return 0 for agent count if no agents registered', () => {
      expect(agentCoordinator.getAgentCount()).toBe(0);
    });

    it('should return correct agent count', () => {
      createTestAgent('agent1', 'processor', 'idle');
      expect(agentCoordinator.getAgentCount()).toBe(1);
      createTestAgent('agent2', 'processor', 'busy');
      expect(agentCoordinator.getAgentCount()).toBe(2);
      agentCoordinator.deregisterAgent('agent1');
      expect(agentCoordinator.getAgentCount()).toBe(1);
    });
  });
});