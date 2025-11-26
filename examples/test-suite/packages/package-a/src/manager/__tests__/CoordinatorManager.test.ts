/*
Copyright (c) 2025 Bernier LLC

This file is licensed to the client under a limited-use license.
The client may use and modify this code *only within the scope of the project it was delivered for*.
Redistribution or use in other products or commercial offerings is not permitted without written consent from Bernier LLC.
*/

import { CoordinatorManager } from '../CoordinatorManager';
import { ICoordinatorRegistry } from '../../registry/ICoordinatorRegistry';
import { ICoordinator } from '../../coordinator/ICoordinator';
import { PackageResult } from '../../interfaces';
import { CoordinatorError } from '../../errors';

describe('CoordinatorManager', () => {
  let manager: CoordinatorManager;
  let mockRegistry: jest.Mocked<ICoordinatorRegistry>;
  let mockCoordinator: ICoordinator<Record<string, Function>>;
  let mockCoordinatorWithTasks: ICoordinator<{ testTask: (payload: string) => Promise<string>, anotherTask: () => Promise<string> }>;

  beforeEach(() => {
    mockRegistry = {
      add: jest.fn(),
      remove: jest.fn(),
      has: jest.fn(),
      get: jest.fn(),
      listNames: jest.fn(),
    };
    manager = new CoordinatorManager(mockRegistry);

    mockCoordinator = {
      name: 'test-coord',
      tasks: {}, // Empty tasks object
      init: jest.fn().mockResolvedValue({ success: true }),
    };

    mockCoordinatorWithTasks = {
      name: 'test-coord-tasks',
      tasks: {
        testTask: jest.fn((payload: string) => Promise.resolve(`Processed: ${payload}`)),
        anotherTask: jest.fn(() => Promise.resolve('Done')),
      },
      init: jest.fn().mockResolvedValue({ success: true }),
    };
  });

  // registerCoordinator
  describe('registerCoordinator', () => {
    it('should register a coordinator successfully', async () => {
      mockRegistry.has.mockReturnValue(false);
      const result = await manager.registerCoordinator(mockCoordinator);
      expect(result.success).toBe(true);
      expect(mockRegistry.add).toHaveBeenCalledWith(mockCoordinator.name, mockCoordinator);
    });

    it('should return an error if coordinator is already registered', async () => {
      mockRegistry.has.mockReturnValue(true);
      const result = await manager.registerCoordinator(mockCoordinator);
      expect(result.success).toBe(false);
      expect(result.error).toBe(CoordinatorError.AlreadyRegistered);
      expect(mockRegistry.add).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors during registration', async () => {
      const errorMessage = 'Registry error';
      mockRegistry.has.mockReturnValue(false);
      mockRegistry.add.mockImplementation(() => { throw new Error(errorMessage); }); // Simulate an error during add
      const result = await manager.registerCoordinator(mockCoordinator);
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  // unregisterCoordinator
  describe('unregisterCoordinator', () => {
    it('should unregister a coordinator successfully', async () => {
      mockRegistry.has.mockReturnValue(true);
      const result = await manager.unregisterCoordinator(mockCoordinator.name);
      expect(result.success).toBe(true);
      expect(mockRegistry.remove).toHaveBeenCalledWith(mockCoordinator.name);
    });

    it('should return an error if coordinator is not found during unregistration', async () => {
      mockRegistry.has.mockReturnValue(false);
      const result = await manager.unregisterCoordinator('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toBe(CoordinatorError.NotFound);
      expect(mockRegistry.remove).not.toHaveBeenCalled();
    });

    it('should handle unexpected errors during unregistration', async () => {
      const errorMessage = 'Registry remove error';
      mockRegistry.has.mockReturnValue(true);
      mockRegistry.remove.mockImplementation(() => { throw new Error(errorMessage); });
      const result = await manager.unregisterCoordinator(mockCoordinator.name);
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  // getCoordinator
  describe('getCoordinator', () => {
    it('should retrieve a registered coordinator', async () => {
      mockRegistry.get.mockReturnValue(mockCoordinator);
      const result: PackageResult<ICoordinator<Record<string, Function>>> = await manager.getCoordinator(mockCoordinator.name);
      expect(result.success).toBe(true);
      expect(result.data).toBe(mockCoordinator);
    });

    it('should return an error if coordinator is not found during retrieval', async () => {
      mockRegistry.get.mockReturnValue(undefined);
      const result = await manager.getCoordinator('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toBe(CoordinatorError.NotFound);
      expect(result.data).toBeUndefined();
    });

    it('should handle unexpected errors during retrieval', async () => {
      const errorMessage = 'Registry get error';
      mockRegistry.get.mockImplementation(() => { throw new Error(errorMessage); });
      const result = await manager.getCoordinator(mockCoordinator.name);
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  // executeCoordinatorTask
  describe('executeCoordinatorTask', () => {
    it('should execute a task on a coordinator successfully', async () => {
      mockRegistry.get.mockReturnValue(mockCoordinatorWithTasks);
      const taskName = 'testTask';
      const payload = 'some input';
      const result = await manager.executeCoordinatorTask(mockCoordinatorWithTasks.name, taskName, payload);
      expect(result.success).toBe(true);
      expect(result.data).toBe('Processed: some input');
      expect(mockCoordinatorWithTasks.tasks[taskName]).toHaveBeenCalledWith(payload);
    });

    it('should return an error if coordinator is not found for task execution', async () => {
      mockRegistry.get.mockReturnValue(undefined);
      const result = await manager.executeCoordinatorTask('non-existent', 'someTask', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe(CoordinatorError.NotFound);
    });

    it('should return an error if the task is not found on the coordinator', async () => {
      mockRegistry.get.mockReturnValue(mockCoordinator); // Coordinator without tasks
      const result = await manager.executeCoordinatorTask(mockCoordinator.name, 'nonExistentTask', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe(CoordinatorError.TaskNotFound);
    });

    it('should return an error if the task property is not a function', async () => {
      // Create a coordinator with an invalid task type for testing runtime check
      const badCoordinator: ICoordinator<Record<string, unknown>> = { // Use Record<string, unknown> to allow non-function properties
        name: 'bad-coord',
        tasks: {
          notAFunction: 'this is not a function', // This is allowed by Record<string, unknown>
        },
        init: jest.fn(),
      };
      mockRegistry.get.mockReturnValue(badCoordinator);
      const result = await manager.executeCoordinatorTask(badCoordinator.name, 'notAFunction', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe(CoordinatorError.InvalidTaskType);
    });

    it('should handle unexpected errors during task execution', async () => {
      const errorMessage = 'Task execution failed';
      mockRegistry.get.mockReturnValue({
        name: 'error-coord',
        tasks: {
          errorTask: jest.fn(() => Promise.reject(new Error(errorMessage))),
        },
        init: jest.fn(),
      });
      const result = await manager.executeCoordinatorTask('error-coord', 'errorTask', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });

  // listCoordinators
  describe('listCoordinators', () => {
    it('should return a list of registered coordinator names', async () => {
      const names = ['coord1', 'coord2'];
      mockRegistry.listNames.mockReturnValue(names[Symbol.iterator]());
      const result = await manager.listCoordinators();
      expect(result.success).toBe(true);
      expect(result.data).toEqual(names);
    });

    it('should return an empty array if no coordinators are registered', async () => {
      mockRegistry.listNames.mockReturnValue([][Symbol.iterator]());
      const result = await manager.listCoordinators();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle unexpected errors during listing', async () => {
      const errorMessage = 'Listing error';
      mockRegistry.listNames.mockImplementation(() => { throw new Error(errorMessage); });
      const result = await manager.listCoordinators();
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });
  });
});