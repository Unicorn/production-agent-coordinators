import { DependencyTree, TaskNode, TaskStatus } from '../types/dependency-tree.types';
import { TaskInput } from '../types/task.types';

/**
 * Build dependency tree from task list
 */
export function buildDependencyTree(
  reqId: string,
  tasks: TaskInput[]
): DependencyTree {
  const tree: DependencyTree = {
    reqId,
    tasks: new Map(),
    layers: [],
    lastUpdated: new Date().toISOString()
  };

  // Create task nodes
  for (const task of tasks) {
    tree.tasks.set(task.id, {
      taskId: task.id,
      name: task.name,
      description: task.description,
      tags: task.tags,
      dependencies: task.dependencies || [],
      dependents: [],
      status: TaskStatus.BLOCKED,
      layer: -1,
      estimatedHours: task.estimatedHours
    });
  }

  // Build dependent relationships (reverse edges)
  for (const [taskId, node] of tree.tasks) {
    for (const depId of node.dependencies) {
      const depNode = tree.tasks.get(depId);
      if (depNode) {
        depNode.dependents.push(taskId);
      }
    }
  }

  // Topological sort to create layers
  // Layer assignment: max(dependencies' layers) + 1
  const visited = new Set<string>();
  let maxIterations = tree.tasks.size + 1;
  let iterations = 0;

  while (visited.size < tree.tasks.size) {
    iterations++;
    if (iterations > maxIterations) {
      throw new Error('Circular dependency detected');
    }

    let assignedAny = false;

    for (const [taskId, node] of tree.tasks) {
      if (visited.has(taskId)) continue;

      // Check if all dependencies have been assigned a layer
      const allDepsAssigned = node.dependencies.every(depId => {
        const depNode = tree.tasks.get(depId);
        return depNode && depNode.layer >= 0;
      });

      if (allDepsAssigned) {
        // Calculate layer based on dependencies
        if (node.dependencies.length === 0) {
          node.layer = 0;
          node.status = TaskStatus.READY;
        } else {
          const maxDepLayer = Math.max(
            ...node.dependencies.map(depId => {
              const depNode = tree.tasks.get(depId);
              return depNode?.layer ?? -1;
            })
          );
          node.layer = maxDepLayer + 1;
          node.status = TaskStatus.BLOCKED;
        }
        visited.add(taskId);
        assignedAny = true;
      }
    }

    if (!assignedAny && visited.size < tree.tasks.size) {
      throw new Error('Circular dependency detected');
    }
  }

  // Now build layers array
  const maxLayer = Math.max(...Array.from(tree.tasks.values()).map(n => n.layer));
  const layers: TaskNode[][] = [];
  for (let i = 0; i <= maxLayer; i++) {
    const layerNodes = Array.from(tree.tasks.values())
      .filter(node => node.layer === i);
    if (layerNodes.length > 0) {
      layers.push(layerNodes);
    }
  }

  tree.layers = layers;
  return tree;
}

/**
 * Update task readiness when a task completes
 * Returns list of task IDs that became ready
 */
export function updateTaskReadiness(
  tree: DependencyTree,
  completedTaskId: string
): string[] {
  const completedNode = tree.tasks.get(completedTaskId);
  if (!completedNode) return [];

  completedNode.status = TaskStatus.COMPLETED;
  completedNode.completedAt = new Date().toISOString();

  const nowReady: string[] = [];

  // Check each dependent task
  for (const dependentId of completedNode.dependents) {
    const dependentNode = tree.tasks.get(dependentId);
    if (!dependentNode) continue;

    // Check if all dependencies are complete
    const allDepsComplete = dependentNode.dependencies.every(depId => {
      const dep = tree.tasks.get(depId);
      return dep?.status === TaskStatus.COMPLETED;
    });

    if (allDepsComplete && dependentNode.status === TaskStatus.BLOCKED) {
      dependentNode.status = TaskStatus.READY;
      nowReady.push(dependentId);
    }
  }

  tree.lastUpdated = new Date().toISOString();
  return nowReady;
}
