/**
 * Export all custom node types
 */

import { ActivityNode as ActivityNodeComponent } from './ActivityNode';
import { AgentNode as AgentNodeComponent } from './AgentNode';
import { SignalNode as SignalNodeComponent } from './SignalNode';
import { TriggerNode as TriggerNodeComponent } from './TriggerNode';

export { ActivityNodeComponent as ActivityNode };
export { AgentNodeComponent as AgentNode };
export { SignalNodeComponent as SignalNode };
export { TriggerNodeComponent as TriggerNode };

// Node type registry for React Flow
export const nodeTypes = {
  activity: ActivityNodeComponent,
  agent: AgentNodeComponent,
  signal: SignalNodeComponent,
  trigger: TriggerNodeComponent,
};

