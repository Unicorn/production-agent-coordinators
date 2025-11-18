/**
 * Workflow types for canvas and execution
 */

export interface WorkflowNode {
  id: string;
  type: 'activity' | 'agent' | 'signal' | 'trigger' | 'condition' | 'end' | 'api-endpoint';
  position: { x: number; y: number };
  data: {
    label: string;
    componentId?: string;
    componentName?: string;
    config?: Record<string, any>;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: {
    timeout?: string;
    retryPolicy?: Record<string, any>;
    description?: string;
  };
}

export interface WorkflowExecutionContext {
  workflowId: string;
  runId: string;
  inputs: Record<string, any>;
  results: Map<string, any>;
}

