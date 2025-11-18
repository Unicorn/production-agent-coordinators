# Loop Nodes - Implementation Example

## Quick Start: Adding Loop Support

Here's a concrete example of implementing loop nodes to make the Agent Conversation Demo smarter.

## 1. Type Definitions

### Extended Node Types

```typescript
// packages/workflow-builder/src/types/workflow.ts

export type WorkflowNodeType = 
  | 'activity' 
  | 'agent' 
  | 'signal' 
  | 'trigger' 
  | 'condition' 
  | 'loop'        // NEW
  | 'counter'     // NEW
  | 'variable'    // NEW
  | 'end';

export interface LoopNodeConfig {
  maxIterations: number;
  condition: {
    type: 'count' | 'variable' | 'custom';
    variable?: string;
    operator?: '<' | '>' | '==' | '!=' | '>=' | '<=';
    value?: number | string;
    expression?: string;  // For custom conditions
  };
  loopVariable: string;  // e.g., 'i', 'iteration'
  childNodeIds?: string[];  // Nodes to execute in loop
}

export interface CounterNodeConfig {
  name: string;
  start: number;
  step: number;
  max?: number;
}

export interface VariableNodeConfig {
  operation: 'set' | 'increment' | 'decrement' | 'append' | 'get';
  variable: string;
  value?: any;
  scope: 'workflow' | 'loop';
}
```

## 2. React Component (Loop Node)

```typescript
// packages/workflow-builder/src/components/workflow/nodes/LoopNode.tsx

import { Handle, Position, NodeProps } from 'react-flow-renderer';
import { RepeatIcon } from '@radix-ui/react-icons';
import { YStack, XStack, Text } from 'tamagui';
import type { LoopNodeConfig } from '@/types/workflow';

export function LoopNodeComponent({ data, selected }: NodeProps) {
  const config = data.config as LoopNodeConfig;
  
  return (
    <YStack
      className={`loop-node ${selected ? 'selected' : ''}`}
      borderWidth={2}
      borderColor="$blue8"
      borderRadius="$4"
      padding="$4"
      backgroundColor="$blue2"
      minWidth={300}
      minHeight={200}
    >
      {/* Header */}
      <XStack alignItems="center" gap="$2" marginBottom="$3">
        <RepeatIcon width={20} height={20} />
        <Text fontWeight="bold" fontSize="$5">
          {data.label}
        </Text>
      </XStack>
      
      {/* Condition Display */}
      <XStack
        backgroundColor="$blue3"
        padding="$2"
        borderRadius="$2"
        marginBottom="$3"
      >
        <Text fontSize="$3" fontFamily="$mono">
          while ({config.condition.variable || config.loopVariable} {config.condition.operator} {config.condition.value})
        </Text>
      </XStack>
      
      {/* Child Nodes Preview */}
      <YStack flex={1} backgroundColor="$blue1" borderRadius="$2" padding="$2">
        <Text fontSize="$2" color="$gray11">
          {config.childNodeIds?.length || 0} nodes in loop
        </Text>
        {/* Child nodes would render here in nested view */}
      </YStack>
      
      {/* Max Iterations Badge */}
      <XStack position="absolute" top="$2" right="$2">
        <Text
          fontSize="$2"
          backgroundColor="$blue6"
          color="white"
          paddingHorizontal="$2"
          paddingVertical="$1"
          borderRadius="$3"
        >
          max: {config.maxIterations}
        </Text>
      </XStack>
      
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="entry"
        style={{ background: '#3b82f6' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="exit"
        style={{ background: '#3b82f6', top: '30%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="loop-body"
        style={{ background: '#3b82f6' }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="loop-return"
        style={{ background: '#3b82f6', left: '70%' }}
      />
    </YStack>
  );
}
```

## 3. Property Panel

```typescript
// packages/workflow-builder/src/components/workflow-builder/NodePropertyPanel.tsx

function LoopNodeProperties({ properties, onChange }: any) {
  const [conditionType, setConditionType] = useState(properties.condition?.type || 'count');
  
  return (
    <YStack gap="$4">
      <Text fontSize="$6" fontWeight="bold">Loop Configuration</Text>
      
      {/* Max Iterations */}
      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="500">Max Iterations</Text>
        <Input
          type="number"
          value={properties.maxIterations || 10}
          onChangeText={(value) => onChange({ 
            ...properties, 
            maxIterations: parseInt(value) 
          })}
          placeholder="10"
        />
        <Text fontSize="$2" color="$gray11">
          Safety limit to prevent infinite loops
        </Text>
      </YStack>
      
      {/* Loop Variable Name */}
      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="500">Loop Variable</Text>
        <Input
          value={properties.loopVariable || 'i'}
          onChangeText={(value) => onChange({ 
            ...properties, 
            loopVariable: value 
          })}
          placeholder="i"
        />
      </YStack>
      
      {/* Condition Type */}
      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="500">Condition Type</Text>
        <Select
          value={conditionType}
          onValueChange={(value) => {
            setConditionType(value);
            onChange({
              ...properties,
              condition: { ...properties.condition, type: value }
            });
          }}
        >
          <Select.Item value="count">Iteration Count</Select.Item>
          <Select.Item value="variable">Variable Comparison</Select.Item>
          <Select.Item value="custom">Custom Expression</Select.Item>
        </Select>
      </YStack>
      
      {/* Condition Details */}
      {conditionType === 'variable' && (
        <>
          <Input
            placeholder="Variable name (e.g., messageCount)"
            value={properties.condition?.variable}
            onChangeText={(value) => onChange({
              ...properties,
              condition: { ...properties.condition, variable: value }
            })}
          />
          
          <Select
            value={properties.condition?.operator || '<'}
            onValueChange={(value) => onChange({
              ...properties,
              condition: { ...properties.condition, operator: value }
            })}
          >
            <Select.Item value="<">Less Than (&lt;)</Select.Item>
            <Select.Item value=">">Greater Than (&gt;)</Select.Item>
            <Select.Item value="==">Equals (==)</Select.Item>
            <Select.Item value="!=">Not Equals (!=)</Select.Item>
            <Select.Item value=">=">Greater or Equal (>=)</Select.Item>
            <Select.Item value="<=">Less or Equal (<=)</Select.Item>
          </Select>
          
          <Input
            placeholder="Value"
            value={properties.condition?.value}
            onChangeText={(value) => onChange({
              ...properties,
              condition: { ...properties.condition, value }
            })}
          />
        </>
      )}
      
      {conditionType === 'custom' && (
        <TextArea
          placeholder="Enter custom condition expression..."
          value={properties.condition?.expression}
          onChangeText={(value) => onChange({
            ...properties,
            condition: { ...properties.condition, expression: value }
          })}
          rows={3}
        />
      )}
    </YStack>
  );
}
```

## 4. Compiler Integration

```typescript
// packages/workflow-builder/src/lib/workflow-compiler/loop-compiler.ts

import type { TemporalWorkflow, WorkflowNode } from '@/types';
import { generateNodeCode } from './node-compiler';

export function compileLoopNode(
  node: WorkflowNode,
  workflow: TemporalWorkflow,
  includeComments: boolean
): string {
  const config = node.data.config as LoopNodeConfig;
  const childNodes = getChildNodes(node, workflow);
  
  // Generate condition expression
  const condition = generateConditionExpression(config.condition);
  
  // Generate child node code
  const childCode = childNodes
    .map(child => generateNodeCode(child, workflow, includeComments))
    .join('\n    ');
  
  return `
  ${includeComments ? `// Loop: ${node.data.label}` : ''}
  let ${config.loopVariable} = 0;
  const maxIterations_${node.id} = ${config.maxIterations};
  
  while (${condition} && ${config.loopVariable} < maxIterations_${node.id}) {
    ${includeComments ? `// Iteration ${config.loopVariable}` : ''}
    ${childCode}
    
    ${config.loopVariable}++;
  }
  
  ${includeComments ? `// Loop completed` : ''}
  `;
}

function generateConditionExpression(condition: LoopCondition): string {
  switch (condition.type) {
    case 'count':
      return `${condition.variable || 'i'} ${condition.operator} ${condition.value}`;
      
    case 'variable':
      return `workflowState.${condition.variable} ${condition.operator} ${condition.value}`;
      
    case 'custom':
      return condition.expression || 'true';
      
    default:
      return 'true';
  }
}

function getChildNodes(loopNode: WorkflowNode, workflow: TemporalWorkflow): WorkflowNode[] {
  // Get nodes that are children of this loop
  return workflow.stages
    .filter(stage => stage.metadata?.parentNodeId === loopNode.id)
    .sort((a, b) => (a.metadata?.executionOrder || 0) - (b.metadata?.executionOrder || 0));
}
```

## 5. Database Migration

```sql
-- Add loop support to workflow_nodes table

ALTER TABLE workflow_nodes
ADD COLUMN parent_node_id UUID REFERENCES workflow_nodes(id) ON DELETE CASCADE,
ADD COLUMN execution_order INTEGER DEFAULT 0,
ADD COLUMN loop_config JSONB,
ADD COLUMN variable_config JSONB;

-- Create index for parent-child relationships
CREATE INDEX idx_workflow_nodes_parent ON workflow_nodes(parent_node_id);

-- Add comment
COMMENT ON COLUMN workflow_nodes.parent_node_id IS 'For nested nodes (e.g., nodes inside a loop)';
COMMENT ON COLUMN workflow_nodes.execution_order IS 'Order of execution within parent container';
COMMENT ON COLUMN workflow_nodes.loop_config IS 'Configuration for loop nodes';
COMMENT ON COLUMN workflow_nodes.variable_config IS 'Configuration for variable/counter nodes';
```

## 6. Smart Agent Conversation Example

### Workflow Definition

```typescript
// Smart conversation with 2 agent nodes (not 4!)
const smartConversation = {
  nodes: [
    {
      id: 'start',
      type: 'trigger',
      position: { x: 50, y: 200 },
      data: { label: 'Start Conversation' }
    },
    {
      id: 'init-counter',
      type: 'counter',
      position: { x: 200, y: 200 },
      data: {
        label: 'Message Counter',
        config: {
          name: 'messageCount',
          start: 0,
          step: 1
        }
      }
    },
    {
      id: 'conversation-loop',
      type: 'loop',
      position: { x: 400, y: 150 },
      data: {
        label: 'Conversation Loop',
        config: {
          maxIterations: 20,
          condition: {
            type: 'variable',
            variable: 'messageCount',
            operator: '<',
            value: 4
          },
          loopVariable: 'turn',
          childNodeIds: ['speaker-condition', 'alice', 'bob', 'increment']
        }
      }
    },
    {
      id: 'speaker-condition',
      type: 'condition',
      parentNodeId: 'conversation-loop',
      data: {
        label: 'Who Speaks?',
        config: {
          conditions: [{
            variable: 'messageCount',
            operator: '%',
            value: 2
          }]
        }
      }
    },
    {
      id: 'alice',
      type: 'agent',
      parentNodeId: 'conversation-loop',
      data: {
        label: 'Alice',
        config: {
          componentName: 'MockAgent',
          workKind: 'converse',
          payload: {
            agent: 'Alice',
            prompt: 'Talk about programming languages'
          }
        }
      }
    },
    {
      id: 'bob',
      type: 'agent',
      parentNodeId: 'conversation-loop',
      data: {
        label: 'Bob',
        config: {
          componentName: 'MockAgent',
          workKind: 'converse',
          payload: {
            agent: 'Bob',
            prompt: 'Respond about programming languages'
          }
        }
      }
    },
    {
      id: 'increment',
      type: 'variable',
      parentNodeId: 'conversation-loop',
      data: {
        label: 'Count Message',
        config: {
          operation: 'increment',
          variable: 'messageCount'
        }
      }
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 700, y: 200 },
      data: { label: 'Complete' }
    }
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'init-counter' },
    { id: 'e2', source: 'init-counter', target: 'conversation-loop' },
    { id: 'e3', source: 'conversation-loop', target: 'speaker-condition', sourceHandle: 'loop-body' },
    { id: 'e4', source: 'speaker-condition', target: 'alice', label: 'even' },
    { id: 'e5', source: 'speaker-condition', target: 'bob', label: 'odd' },
    { id: 'e6', source: 'alice', target: 'increment' },
    { id: 'e7', source: 'bob', target: 'increment' },
    { id: 'e8', source: 'increment', target: 'conversation-loop', targetHandle: 'loop-return' },
    { id: 'e9', source: 'conversation-loop', target: 'end', sourceHandle: 'exit' }
  ]
};
```

### Compiled Temporal Code

```typescript
export async function smartConversationWorkflow(input: any): Promise<any> {
  // Initialize workflow state
  const workflowState = {
    messageCount: 0,
    conversationHistory: [],
  };
  
  // Counter: Message Counter
  workflowState.messageCount = 0;
  
  // Loop: Conversation Loop
  let turn = 0;
  const maxIterations_conversationLoop = 20;
  
  while (workflowState.messageCount < 4 && turn < maxIterations_conversationLoop) {
    // Condition: Who Speaks?
    if (workflowState.messageCount % 2 === 0) {
      // Agent: Alice
      const aliceResponse = await proxyActivities.converseMockAgent({
        agent: 'Alice',
        prompt: 'Talk about programming languages',
        history: workflowState.conversationHistory,
      });
      
      workflowState.conversationHistory.push({
        speaker: 'Alice',
        message: aliceResponse.message,
        turn: turn,
      });
    } else {
      // Agent: Bob
      const bobResponse = await proxyActivities.converseMockAgent({
        agent: 'Bob',
        prompt: 'Respond about programming languages',
        history: workflowState.conversationHistory,
      });
      
      workflowState.conversationHistory.push({
        speaker: 'Bob',
        message: bobResponse.message,
        turn: turn,
      });
    }
    
    // Variable: Count Message
    workflowState.messageCount++;
    
    turn++;
  }
  
  // Loop completed
  return {
    conversationHistory: workflowState.conversationHistory,
    totalMessages: workflowState.messageCount,
    turnsCompleted: turn,
  };
}
```

## 7. Usage Example

```typescript
// Create a smart conversation workflow
const workflow = await api.workflows.create.mutate({
  kebabName: 'smart-agent-conversation',
  displayName: 'Smart Agent Conversation',
  description: 'Two agents chatting with loop-based control flow',
  projectId: demoProjectId,
  visibility: 'public',
  definition: smartConversation,
});

// Execute it
const execution = await api.execution.build.mutate({
  workflowId: workflow.id,
  input: {
    topic: 'Programming Languages',
    maxMessages: 4,
  },
});

// Query state during execution
const state = await temporal.getWorkflowHandle(execution.workflowId)
  .query('getWorkflowState');

console.log(`Current turn: ${state.turn}`);
console.log(`Messages so far: ${state.messageCount}`);
```

## Benefits Demonstrated

### Before (Linear):
- **4 agent nodes** for 4 messages
- **5 edges** connecting them
- Hard to change conversation length
- Cluttered canvas

### After (Loop-based):
- **2 agent nodes** for unlimited messages  
- **9 edges total** (but reusable)
- Change `value: 4` to `value: 100` for longer conversations
- Clean, hierarchical canvas

### Temporal Features Used:
- ✅ Durable workflow state (`workflowState`)
- ✅ Queries for inspecting state
- ✅ Restart safety (loop picks up where it left off)
- ✅ Deterministic replay

---

This implementation transforms static workflows into **dynamic, programmable processes** that scale beautifully! 🎯

