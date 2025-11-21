import { describe, it, expect } from 'vitest';
import { buildDependencyTree, updateTaskReadiness } from './dependency-tree.activities';
import { TaskInput } from '../types/task.types';
import { TaskStatus } from '../types/dependency-tree.types';

describe('Dependency Tree Activities', () => {
  describe('buildDependencyTree', () => {
    it('should build tree with no dependencies (layer 0)', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'First task',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Second task',
          tags: ['DEV'],
          dependencies: []
        }
      ];

      const tree = buildDependencyTree('req-123', tasks);

      expect(tree.reqId).toBe('req-123');
      expect(tree.tasks.size).toBe(2);
      expect(tree.layers).toHaveLength(1);
      expect(tree.layers[0]).toHaveLength(2);

      const task1 = tree.tasks.get('task-1');
      expect(task1?.layer).toBe(0);
      expect(task1?.status).toBe(TaskStatus.READY);
    });

    it('should build tree with dependencies (multiple layers)', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'Layer 0',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Layer 1',
          tags: ['DEV'],
          dependencies: ['task-1']
        },
        {
          id: 'task-3',
          reqId: 'req-123',
          name: 'Task 3',
          description: 'Layer 1',
          tags: ['TEST'],
          dependencies: ['task-1']
        },
        {
          id: 'task-4',
          reqId: 'req-123',
          name: 'Task 4',
          description: 'Layer 2',
          tags: ['TEST'],
          dependencies: ['task-2', 'task-3']
        }
      ];

      const tree = buildDependencyTree('req-123', tasks);

      expect(tree.layers).toHaveLength(3);
      expect(tree.layers[0]).toHaveLength(1); // task-1
      expect(tree.layers[1]).toHaveLength(2); // task-2, task-3
      expect(tree.layers[2]).toHaveLength(1); // task-4

      const task1 = tree.tasks.get('task-1');
      expect(task1?.layer).toBe(0);
      expect(task1?.status).toBe(TaskStatus.READY);
      expect(task1?.dependents).toEqual(['task-2', 'task-3']);

      const task4 = tree.tasks.get('task-4');
      expect(task4?.layer).toBe(2);
      expect(task4?.status).toBe(TaskStatus.BLOCKED);
      expect(task4?.dependencies).toEqual(['task-2', 'task-3']);
    });

    it('should detect circular dependencies', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'Circular',
          tags: ['DEV'],
          dependencies: ['task-2']
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Circular',
          tags: ['DEV'],
          dependencies: ['task-1']
        }
      ];

      expect(() => buildDependencyTree('req-123', tasks)).toThrow('Circular dependency detected');
    });
  });

  describe('updateTaskReadiness', () => {
    it('should mark dependent tasks as ready when dependency completes', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'Layer 0',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Layer 1',
          tags: ['DEV'],
          dependencies: ['task-1']
        }
      ];

      const tree = buildDependencyTree('req-123', tasks);

      // Initially task-2 is blocked
      expect(tree.tasks.get('task-2')?.status).toBe(TaskStatus.BLOCKED);

      // Complete task-1
      const nowReady = updateTaskReadiness(tree, 'task-1');

      expect(nowReady).toEqual(['task-2']);
      expect(tree.tasks.get('task-1')?.status).toBe(TaskStatus.COMPLETED);
      expect(tree.tasks.get('task-2')?.status).toBe(TaskStatus.READY);
    });

    it('should not mark task ready if other dependencies incomplete', () => {
      const tasks: TaskInput[] = [
        {
          id: 'task-1',
          reqId: 'req-123',
          name: 'Task 1',
          description: 'Dep 1',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-2',
          reqId: 'req-123',
          name: 'Task 2',
          description: 'Dep 2',
          tags: ['DEV'],
          dependencies: []
        },
        {
          id: 'task-3',
          reqId: 'req-123',
          name: 'Task 3',
          description: 'Depends on both',
          tags: ['TEST'],
          dependencies: ['task-1', 'task-2']
        }
      ];

      const tree = buildDependencyTree('req-123', tasks);

      // Complete only task-1
      const nowReady = updateTaskReadiness(tree, 'task-1');

      expect(nowReady).toEqual([]);
      expect(tree.tasks.get('task-3')?.status).toBe(TaskStatus.BLOCKED);

      // Complete task-2
      const nowReady2 = updateTaskReadiness(tree, 'task-2');

      expect(nowReady2).toEqual(['task-3']);
      expect(tree.tasks.get('task-3')?.status).toBe(TaskStatus.READY);
    });
  });
});
