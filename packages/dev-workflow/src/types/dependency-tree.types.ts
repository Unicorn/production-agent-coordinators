export enum TaskStatus {
  BLOCKED = 'blocked',
  READY = 'ready',
  CLAIMED = 'claimed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}

export interface TaskNode {
  taskId: string;
  name: string;
  description: string;
  tags: string[];
  dependencies: string[];
  dependents: string[];
  status: TaskStatus;
  layer: number;
  estimatedHours?: number;
  assignedTo?: string;
  claimedAt?: string;
  completedAt?: string;
}

export interface DependencyTree {
  reqId: string;
  tasks: Map<string, TaskNode>;
  layers: TaskNode[][];
  lastUpdated: string;
}

export interface DependencyStatus {
  taskId: string;
  status: TaskStatus;
  dependencies: Array<{
    taskId: string;
    status: TaskStatus | undefined;
  }>;
  blockedBy: string[];
}
