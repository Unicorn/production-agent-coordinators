/**
 * Export all custom node types
 */

import { ActivityNode as ActivityNodeComponent } from './ActivityNode';
import { AgentNode as AgentNodeComponent } from './AgentNode';
import { SignalNode as SignalNodeComponent } from './SignalNode';
import { TriggerNode as TriggerNodeComponent } from './TriggerNode';
import { ChildWorkflowNode as ChildWorkflowNodeComponent } from './ChildWorkflowNode';
import { ConditionNode as ConditionNodeComponent } from './ConditionNode';
import { PhaseNode as PhaseNodeComponent } from './PhaseNode';
import { RetryNode as RetryNodeComponent } from './RetryNode';
import { StateVariableNode as StateVariableNodeComponent } from './StateVariableNode';

export { ActivityNodeComponent as ActivityNode };
export { AgentNodeComponent as AgentNode };
export { SignalNodeComponent as SignalNode };
export { TriggerNodeComponent as TriggerNode };
export { ChildWorkflowNodeComponent as ChildWorkflowNode };
export { ApiEndpointNode } from './ApiEndpointNode';
export { ConditionNodeComponent as ConditionNode };
export { PhaseNodeComponent as PhaseNode };
export { RetryNodeComponent as RetryNode };
export { StateVariableNodeComponent as StateVariable };

// Node type registry for React Flow
export const nodeTypes = {
  activity: ActivityNodeComponent,
  agent: AgentNodeComponent,
  signal: SignalNodeComponent,
  trigger: TriggerNodeComponent,
  'child-workflow': ChildWorkflowNodeComponent,
  'api-endpoint': ApiEndpointNode,
  condition: ConditionNodeComponent,
  phase: PhaseNodeComponent,
  retry: RetryNodeComponent,
  'state-variable': StateVariableNodeComponent,
};

