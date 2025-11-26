/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import {
  Agent,
  Coordinator,
  NewAgentData,
  NewCoordinatorData,
  UpdateAgentData,
  UpdateCoordinatorData,
  PackageResult,
} from './types';
import {
  agentSchema,
  coordinatorSchema,
  newAgentDataSchema,
  updateAgentDataSchema,
  newCoordinatorDataSchema,
  updateCoordinatorDataSchema,
} from './schemas';
import { ValidationError, NotFoundError, AgentError, CoordinatorError } from './errors';

/**
 * A simple in-memory store for demonstration purposes.
 * In a real application, this would interact with a database or persistent storage.
 */
interface InMemoryStore {
  agents: Map<string, Agent>;
  coordinators: Map<string, Coordinator>;
}

/**
 * Client for managing production agents and their coordinators for Bernier LLC.
 * Provides CRUD operations with in-memory storage for demonstration.
 */
export class BernierCoordinatorsClient {
  private readonly store: InMemoryStore;

  constructor() {
    this.store = {
      agents: new Map<string, Agent>(),
      coordinators: new Map<string, Coordinator>(),
    };
  }

  // --- Agent Management ---

  /**
   * Creates a new agent.
   * @param data - The data for the new agent.
   * @returns A PackageResult containing the new Agent or an error.
   */
  public async createAgent(data: NewAgentData): Promise<PackageResult<Agent>> {
    try {
      const validatedData = newAgentDataSchema.parse(data);
      const newAgent: Agent = {
        id: uuidv4(),
        ...validatedData,
        lastHeartbeat: new Date(),
        metadata: validatedData.metadata ?? {},
      };
      this.store.agents.set(newAgent.id, newAgent);
      return { success: true, data: newAgent };
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return { success: false, error: new ValidationError(`Invalid agent data: ${error.message}`).message };
      }
      return { success: false, error: new AgentError(`Failed to create agent: ${(error as Error).message}`).message };
    }
  }

  /**
   * Retrieves an agent by ID.
   * @param id - The ID of the agent.
   * @returns A PackageResult containing the Agent or an error.
   */
  public async getAgent(id: string): Promise<PackageResult<Agent>> {
    try {
      z.string().uuid('Invalid agent ID format.').parse(id); // Validate ID format
      const agent = this.store.agents.get(id);
      if (!agent) {
        return { success: false, error: new NotFoundError(`Agent with ID ${id} not found.`).message };
      }
      return { success: true, data: agent };
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return { success: false, error: new ValidationError(`Invalid agent ID: ${error.message}`).message };
      }
      return { success: false, error: new AgentError(`Failed to retrieve agent: ${(error as Error).message}`).message };
    }
  }

  /**
   * Lists all agents.
   * @returns A PackageResult containing an array of Agents or an error.
   */
  public async listAgents(): Promise<PackageResult<Agent[]>> {
    try {
      const agents = Array.from(this.store.agents.values());
      return { success: true, data: agents };
    } catch (error: unknown) {
      return { success: false, error: new AgentError(`Failed to list agents: ${(error as Error).message}`).message };
    }
  }

  /**
   * Updates an existing agent.
   * @param id - The ID of the agent to update.
   * @param data - The update data for the agent.
   * @returns A PackageResult containing the updated Agent or an error.
   */
  public async updateAgent(id: string, data: UpdateAgentData): Promise<PackageResult<Agent>> {
    try {
      z.string().uuid('Invalid agent ID format.').parse(id); // Validate ID format
      const validatedData = updateAgentDataSchema.parse(data);

      const agent = this.store.agents.get(id);
      if (!agent) {
        return { success: false, error: new NotFoundError(`Agent with ID ${id} not found.`).message };
      }

      const updatedAgent: Agent = {
        ...agent,
        ...validatedData,
        lastHeartbeat: validatedData.lastHeartbeat ?? agent.lastHeartbeat,
        metadata: validatedData.metadata ?? agent.metadata,
      };

      // Ensure that agentSchema parsing happens *after* the update to validate the final object
      agentSchema.parse(updatedAgent);

      this.store.agents.set(id, updatedAgent);
      return { success: true, data: updatedAgent };
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return { success: false, error: new ValidationError(`Invalid agent data: ${error.message}`).message };
      }
      return { success: false, error: new AgentError(`Failed to update agent: ${(error as Error).message}`).message };
    }
  }

  /**
   * Deletes an agent by ID.
   * @param id - The ID of the agent to delete.
   * @returns A PackageResult indicating success or an error.
   */
  public async deleteAgent(id: string): Promise<PackageResult<void>> {
    try {
      z.string().uuid('Invalid agent ID format.').parse(id); // Validate ID format
      const agentExists = this.store.agents.has(id);
      if (!agentExists) {
        return { success: false, error: new NotFoundError(`Agent with ID ${id} not found.`).message };
      }
      this.store.agents.delete(id);

      // Also remove agent from any coordinators
      this.store.coordinators.forEach((coord) => {
        const index = coord.agentIds.indexOf(id);
        if (index > -1) {
          coord.agentIds.splice(index, 1);
        }
      });

      return { success: true };
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return { success: false, error: new ValidationError(`Invalid agent ID: ${error.message}`).message };
      }
      return { success: false, error: new AgentError(`Failed to delete agent: ${(error as Error).message}`).message };
    }
  }

  // --- Coordinator Management ---

  /**
   * Creates a new coordinator.
   * @param data - The data for the new coordinator.
   * @returns A PackageResult containing the new Coordinator or an error.
   */
  public async createCoordinator(data: NewCoordinatorData): Promise<PackageResult<Coordinator>> {
    try {
      const validatedData = newCoordinatorDataSchema.parse(data);

      // Validate agentIds
      if (validatedData.agentIds && validatedData.agentIds.length > 0) {
        const invalidAgentIds = validatedData.agentIds.filter((agentId: string) => !this.store.agents.has(agentId));
        if (invalidAgentIds.length > 0) {
          return {
            success: false,
            error: new ValidationError(`Invalid agent IDs provided: ${invalidAgentIds.join(', ')}.`).message,
          };
        }
      }

      const now = new Date();
      const newCoordinator: Coordinator = {
        id: uuidv4(),
        ...validatedData,
        status: 'inactive', // Default status
        agentIds: validatedData.agentIds ?? [],
        config: validatedData.config ?? {},
        createdAt: now,
        updatedAt: now,
      };
      this.store.coordinators.set(newCoordinator.id, newCoordinator);
      return { success: true, data: newCoordinator };
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return { success: false, error: new ValidationError(`Invalid coordinator data: ${error.message}`).message };
      }
      return { success: false, error: new CoordinatorError(`Failed to create coordinator: ${(error as Error).message}`).message };
    }
  }

  /**
   * Retrieves a coordinator by ID.
   * @param id - The ID of the coordinator.
   * @returns A PackageResult containing the Coordinator or an error.
   */
  public async getCoordinator(id: string): Promise<PackageResult<Coordinator>> {
    try {
      z.string().uuid('Invalid coordinator ID format.').parse(id); // Validate ID format
      const coordinator = this.store.coordinators.get(id);
      if (!coordinator) {
        return { success: false, error: new NotFoundError(`Coordinator with ID ${id} not found.`).message };
      }
      return { success: true, data: coordinator };
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return { success: false, error: new ValidationError(`Invalid coordinator ID: ${error.message}`).message };
      }
      return { success: false, error: new CoordinatorError(`Failed to retrieve coordinator: ${(error as Error).message}`).message };
    }
  }

  /**
   * Lists all coordinators.
   * @returns A PackageResult containing an array of Coordinators or an error.
   */
  public async listCoordinators(): Promise<PackageResult<Coordinator[]>> {
    try {
      const coordinators = Array.from(this.store.coordinators.values());
      return { success: true, data: coordinators };
    } catch (error: unknown) {
      return { success: false, error: new CoordinatorError(`Failed to list coordinators: ${(error as Error).message}`).message };
    }
  }

  /**
   * Updates an existing coordinator.
   * @param id - The ID of the coordinator to update.
   * @param data - The update data for the coordinator.
   * @returns A PackageResult containing the updated Coordinator or an error.
   */
  public async updateCoordinator(id: string, data: UpdateCoordinatorData): Promise<PackageResult<Coordinator>> {
    try {
      z.string().uuid('Invalid coordinator ID format.').parse(id); // Validate ID format
      const validatedData = updateCoordinatorDataSchema.parse(data);

      const coordinator = this.store.coordinators.get(id);
      if (!coordinator) {
        return { success: false, error: new NotFoundError(`Coordinator with ID ${id} not found.`).message };
      }

      // Validate agentIds if provided
      if (validatedData.agentIds) {
        const invalidAgentIds = validatedData.agentIds.filter((agentId: string) => !this.store.agents.has(agentId));
        if (invalidAgentIds.length > 0) {
          return {
            success: false,
            error: new ValidationError(`Invalid agent IDs provided: ${invalidAgentIds.join(', ')}.`).message,
          };
        }
      }

      const updatedCoordinator: Coordinator = {
        ...coordinator,
        ...validatedData,
        agentIds: validatedData.agentIds ?? coordinator.agentIds,
        config: validatedData.config ?? coordinator.config,
        updatedAt: new Date(),
      };

      // Ensure that coordinatorSchema parsing happens *after* the update to validate the final object
      coordinatorSchema.parse(updatedCoordinator);

      this.store.coordinators.set(id, updatedCoordinator);
      return { success: true, data: updatedCoordinator };
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return { success: false, error: new ValidationError(`Invalid coordinator data: ${error.message}`).message };
      }
      return { success: false, error: new CoordinatorError(`Failed to update coordinator: ${(error as Error).message}`).message };
    }
  }

  /**
   * Deletes a coordinator by ID.
   * @param id - The ID of the coordinator to delete.
   * @returns A PackageResult indicating success or an error.
   */
  public async deleteCoordinator(id: string): Promise<PackageResult<void>> {
    try {
      z.string().uuid('Invalid coordinator ID format.').parse(id); // Validate ID format
      const coordinatorExists = this.store.coordinators.has(id);
      if (!coordinatorExists) {
        return { success: false, error: new NotFoundError(`Coordinator with ID ${id} not found.`).message };
      }
      this.store.coordinators.delete(id);
      return { success: true };
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return { success: false, error: new ValidationError(`Invalid coordinator ID: ${error.message}`).message };
      }
      return { success: false, error: new CoordinatorError(`Failed to delete coordinator: ${(error as Error).message}`).message };
    }
  }
}