export interface TaskInput {
  id: string;
  reqId: string;
  name: string;
  description: string;
  tags: string[];
  dependencies?: string[];
  estimatedHours?: number;
}

export interface PollTaskParams {
  tags: string[];
  status: string[];
}

export interface TaskExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
}
