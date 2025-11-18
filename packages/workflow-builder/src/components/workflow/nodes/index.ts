/**
 * Export all custom node types
 */

import { ActivityNode as ActivityNodeComponent } from './ActivityNode';
import { AgentNode as AgentNodeComponent } from './AgentNode';
import { SignalNode as SignalNodeComponent } from './SignalNode';
import { TriggerNode as TriggerNodeComponent } from './TriggerNode';
import { ChildWorkflowNode as ChildWorkflowNodeComponent } from './ChildWorkflowNode';

export { ActivityNodeComponent as ActivityNode };
export { AgentNodeComponent as AgentNode };
export { SignalNodeComponent as SignalNode };
export { TriggerNodeComponent as TriggerNode };
export { ChildWorkflowNodeComponent as ChildWorkflowNode };
export { ApiEndpointNode } from './ApiEndpointNode';

// Node type registry for React Flow
export const nodeTypes = {
  activity: ActivityNodeComponent,
  agent: AgentNodeComponent,
  signal: SignalNodeComponent,
  trigger: TriggerNodeComponent,
  'child-workflow': ChildWorkflowNodeComponent,
  'api-endpoint': ApiEndpointNode,
};

