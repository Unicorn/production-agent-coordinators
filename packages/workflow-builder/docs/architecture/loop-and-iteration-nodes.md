# Loop and Iteration Nodes Design

## Problem Statement

Currently, the Agent Conversation Demo requires **4 separate agent nodes** (Alice, Bob, Alice, Bob) to create a 4-message conversation. This approach:

- ❌ Doesn't scale (10 messages = 10 nodes)
- ❌ Can't handle dynamic conversation lengths
- ❌ Doesn't leverage Temporal's state management
- ❌ Makes the canvas cluttered

## Proposed Solution: Control Flow Nodes

Add new node types that compile to Temporal's powerful state management and loop capabilities:

### 1. **Loop Node** (`loop`)

A container node that executes child nodes repeatedly until a condition is met.

```typescript
type: 'loop'
config: {
  maxIterations: number;      // Safety limit
  condition: {
    type: 'count' | 'custom';  // Built-in or custom condition
    variable: string;          // Variable to check
    operator: '<' | '>' | '==' | '!=';
    value: number | string;
  };
  loopVariable: string;        // Name of iteration counter (e.g., 'i')
}
```

**Visual Representation:**
```
┌─────────────────────┐
│   Loop (i < 4)      │
│  ┌───────────────┐  │
│  │ Agent: Alice  │  │
│  └───────┬───────┘  │
│          │          │
│  ┌───────▼───────┐  │
│  │ Agent: Bob    │  │
│  └───────────────┘  │
└─────────────────────┘
```

### 2. **Variable Node** (`variable`)

Manages workflow state variables (counters, flags, data).

```typescript
type: 'variable'
config: {
  operation: 'set' | 'increment' | 'decrement' | 'append';
  variable: string;          // Variable name (e.g., 'messageCount')
  value?: any;               // Initial/set value
  scope: 'workflow' | 'loop'; // Lifetime
}
```

**Use Cases:**
- Track message counts
- Store conversation history
- Maintain session state

### 3. **Condition Node** (Enhanced)

Make decisions based on workflow state.

```typescript
type: 'condition'
config: {
  conditions: Array<{
    variable: string;
    operator: '<' | '>' | '==' | '!=' | 'contains';
    value: any;
  }>;
  operator: 'AND' | 'OR';  // Combine multiple conditions
}
```

**Visual Representation:**
```
     ┌───────────┐
     │ Condition │
     └─────┬─────┘
           │
     ┌─────┴─────┐
     │           │
 [true]      [false]
     │           │
     ▼           ▼
```

### 4. **Counter Node** (`counter`)

Specialized variable node for counting (syntactic sugar).

```typescript
type: 'counter'
config: {
  name: string;              // Counter name
  start: number;             // Initial value
  step: number;              // Increment amount
  max?: number;              // Optional limit
}
```

## Smart Agent Conversation Demo (Refactored)

### Current Approach (4 nodes):
```
Start → Alice-1 → Bob-1 → Alice-2 → Bob-2 → End
```

### Smart Approach (Loop-based):
```
                ┌────────────────────────────────┐
Start → Counter │ Loop (messageCount < 4)        │ → End
         │      │   ┌──────────────────────┐     │
         │      │   │ Condition            │     │
         │      │   │ (messageCount % 2)   │     │
         │      │   └────┬────────────┬────┘     │
         │      │  [Alice│    [Bob]   │          │
         │      │   ┌────▼───┐   ┌────▼───┐     │
         │      │   │ Alice  │   │  Bob   │     │
         │      │   │ Speak  │   │ Speak  │     │
         │      │   └────────┘   └────────┘     │
         │      │        │            │          │
         │      │   ┌────▼────────────▼────┐    │
         │      │   │ Increment counter    │    │
         │      │   └──────────────────────┘    │
         └──────┴────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Database Schema

Add loop/container support to workflow nodes:

```sql
ALTER TABLE workflow_nodes
ADD COLUMN parent_node_id UUID REFERENCES workflow_nodes(id),
ADD COLUMN loop_config JSONB,
ADD COLUMN variable_config JSONB,
ADD COLUMN condition_config JSONB;

-- Add node ordering within loops
ADD COLUMN execution_order INTEGER DEFAULT 0;
```

### Phase 2: UI Components

#### A. Loop Node Component

```typescript
// packages/workflow-builder/src/components/workflow/nodes/LoopNode.tsx
export function LoopNodeComponent({ data }: NodeProps) {
  return (
    <NodeContainer type="loop">
      <NodeHeader>
        <LoopIcon />
        <span>{data.label}</span>
      </NodeHeader>
      <NodeBody>
        <LoopCondition>
          {data.config.condition.variable} {data.config.condition.operator} {data.config.condition.value}
        </LoopCondition>
        <ChildNodesPreview>
          {data.config.childNodes?.length || 0} nodes
        </ChildNodesPreview>
      </NodeBody>
      <NodeHandles>
        <Handle type="target" position="left" />
        <Handle type="source" position="right" id="exit" label="Exit" />
        <Handle type="source" position="bottom" id="loop" label="Loop" />
      </NodeHandles>
    </NodeContainer>
  );
}
```

#### B. Variable/Counter Panel

Add to property panel for configuring state variables:

```typescript
function LoopProperties({ properties, onChange }: any) {
  return (
    <PropertySection title="Loop Configuration">
      <Input
        label="Max Iterations"
        type="number"
        value={properties.maxIterations}
        onChange={(e) => onChange({ ...properties, maxIterations: e.target.value })}
      />
      
      <Select
        label="Condition Type"
        value={properties.condition?.type}
        options={[
          { value: 'count', label: 'Iteration Count' },
          { value: 'variable', label: 'Variable Comparison' },
          { value: 'custom', label: 'Custom Expression' }
        ]}
      />
      
      {properties.condition?.type === 'variable' && (
        <>
          <Input label="Variable Name" />
          <Select label="Operator" options={['<', '>', '==', '!=']} />
          <Input label="Value" />
        </>
      )}
      
      <ArrayInput
        label="Child Nodes"
        description="Nodes to execute in each iteration"
      />
    </PropertySection>
  );
}
```

### Phase 3: Compiler Updates

Generate Temporal workflow code with loops and state:

```typescript
// packages/workflow-builder/src/lib/workflow-compiler/loop-compiler.ts

function compileLoopNode(node: WorkflowNode, workflow: TemporalWorkflow): string {
  const config = node.data.config;
  const childNodes = workflow.stages.filter(s => s.metadata?.parentNodeId === node.id);
  
  return `
  // Loop: ${node.data.label}
  let ${config.loopVariable} = 0;
  const maxIterations = ${config.maxIterations};
  
  while (${generateCondition(config.condition)} && ${config.loopVariable} < maxIterations) {
    ${childNodes.map(child => compileNode(child, workflow)).join('\n    ')}
    
    ${config.loopVariable}++;
  }
  `;
}

function generateCondition(condition: LoopCondition): string {
  switch (condition.type) {
    case 'count':
      return `${condition.variable} ${condition.operator} ${condition.value}`;
    case 'variable':
      return `workflowState.${condition.variable} ${condition.operator} ${condition.value}`;
    case 'custom':
      return condition.expression;
  }
}
```

**Compiled Output Example:**

```typescript
export async function agentConversationWorkflow(input: any): Promise<any> {
  // Workflow state
  const workflowState = {
    messageCount: 0,
    conversationHistory: [],
  };
  
  // Loop: Conversation
  let i = 0;
  const maxIterations = 10;
  
  while (workflowState.messageCount < 4 && i < maxIterations) {
    // Condition: Alternate speakers
    if (workflowState.messageCount % 2 === 0) {
      // Alice speaks
      const aliceMessage = await activities.sendAgentMessage({
        agent: 'Alice',
        prompt: 'Continue the conversation about programming languages',
        history: workflowState.conversationHistory,
      });
      
      workflowState.conversationHistory.push(aliceMessage);
    } else {
      // Bob speaks
      const bobMessage = await activities.sendAgentMessage({
        agent: 'Bob',
        prompt: 'Respond to Alice about programming languages',
        history: workflowState.conversationHistory,
      });
      
      workflowState.conversationHistory.push(bobMessage);
    }
    
    // Increment counter
    workflowState.messageCount++;
    i++;
  }
  
  return {
    conversationHistory: workflowState.conversationHistory,
    totalMessages: workflowState.messageCount,
  };
}
```

### Phase 4: Canvas Interactions

#### Loop Container Behavior

1. **Visual Nesting**: Child nodes appear "inside" the loop node
2. **Drag & Drop**: Can drag nodes into/out of loops
3. **Execution Preview**: Show which iteration is currently executing
4. **State Inspector**: View current variable values during execution

```typescript
// Loop container styling
.loop-node {
  min-width: 400px;
  min-height: 300px;
  border: 2px dashed $loop-color;
  border-radius: 8px;
  padding: 20px;
  background: rgba($loop-color, 0.05);
  
  &.executing {
    border-style: solid;
    box-shadow: 0 0 20px rgba($loop-color, 0.3);
  }
}

.loop-iteration-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: $loop-color;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
}
```

## Example: Smart Agent Conversation

### Workflow Definition (JSON)

```json
{
  "nodes": [
    {
      "id": "start-1",
      "type": "trigger",
      "position": { "x": 50, "y": 200 },
      "data": { "label": "Start" }
    },
    {
      "id": "counter-1",
      "type": "counter",
      "position": { "x": 200, "y": 200 },
      "data": {
        "label": "Message Counter",
        "config": {
          "name": "messageCount",
          "start": 0,
          "step": 1
        }
      }
    },
    {
      "id": "loop-1",
      "type": "loop",
      "position": { "x": 350, "y": 100 },
      "data": {
        "label": "Conversation Loop",
        "config": {
          "maxIterations": 10,
          "condition": {
            "type": "variable",
            "variable": "messageCount",
            "operator": "<",
            "value": 4
          },
          "loopVariable": "i"
        }
      }
    },
    {
      "id": "condition-1",
      "type": "condition",
      "position": { "x": 400, "y": 150 },
      "parentNodeId": "loop-1",
      "data": {
        "label": "Alternate Speakers",
        "config": {
          "conditions": [{
            "variable": "messageCount",
            "operator": "%",
            "value": 2
          }]
        }
      }
    },
    {
      "id": "agent-alice",
      "type": "agent",
      "position": { "x": 300, "y": 250 },
      "parentNodeId": "loop-1",
      "data": {
        "label": "Alice",
        "config": {
          "componentName": "MockAgent",
          "workKind": "converse",
          "payload": {
            "agent": "Alice",
            "topic": "programming languages"
          }
        }
      }
    },
    {
      "id": "agent-bob",
      "type": "agent",
      "position": { "x": 500, "y": 250 },
      "parentNodeId": "loop-1",
      "data": {
        "label": "Bob",
        "config": {
          "componentName": "MockAgent",
          "workKind": "converse",
          "payload": {
            "agent": "Bob",
            "topic": "programming languages"
          }
        }
      }
    },
    {
      "id": "increment-1",
      "type": "variable",
      "position": { "x": 400, "y": 350 },
      "parentNodeId": "loop-1",
      "data": {
        "label": "Increment Counter",
        "config": {
          "operation": "increment",
          "variable": "messageCount"
        }
      }
    },
    {
      "id": "end-1",
      "type": "end",
      "position": { "x": 700, "y": 200 },
      "data": { "label": "Complete" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "start-1", "target": "counter-1" },
    { "id": "e2", "source": "counter-1", "target": "loop-1" },
    { "id": "e3", "source": "loop-1", "target": "condition-1", "sourceHandle": "loop" },
    { "id": "e4", "source": "condition-1", "target": "agent-alice", "label": "even" },
    { "id": "e5", "source": "condition-1", "target": "agent-bob", "label": "odd" },
    { "id": "e6", "source": "agent-alice", "target": "increment-1" },
    { "id": "e7", "source": "agent-bob", "target": "increment-1" },
    { "id": "e8", "source": "increment-1", "target": "loop-1", "targetHandle": "loop" },
    { "id": "e9", "source": "loop-1", "target": "end-1", "sourceHandle": "exit" }
  ]
}
```

## Benefits

### ✅ Scalability
- 2 agent nodes handle unlimited messages (vs 4+ nodes before)
- Easy to adjust conversation length (change `value: 4` to `value: 10`)

### ✅ Temporal State Management
- Leverage Temporal's durable state
- Workflow survives restarts mid-conversation
- Can query state during execution

### ✅ Dynamic Behavior
- Conditions can change based on agent responses
- Can exit early if conversation reaches conclusion
- Can branch based on conversation topics

### ✅ Better UX
- Cleaner canvas (fewer nodes)
- Easier to understand flow
- Visual hierarchy (loops contain child nodes)

## Advanced Features

### 1. **Nested Loops**

```
Loop (topics)
  └─ Loop (messages per topic)
       ├─ Agent Alice
       └─ Agent Bob
```

### 2. **Break/Continue**

Add special edges that:
- **Break**: Exit loop early
- **Continue**: Skip to next iteration

### 3. **Loop State Queries**

Query current loop state from outside:

```typescript
// In another workflow or UI
const state = await workflow.query('getLoopState', { loopId: 'loop-1' });
// Returns: { iteration: 2, variables: { messageCount: 2 } }
```

### 4. **Parallel Loops**

Multiple loops running concurrently:

```
     ┌─ Loop A (Alice & Bob)
Start┤
     └─ Loop B (Carol & Dave)
```

## Migration Path

### Existing Workflows

Automatically convert linear agent chains to loops:

```typescript
// Detection pattern
if (hasRepeatingNodePattern(workflow)) {
  suggestLoopRefactor(workflow);
}

// One-click refactor
function convertToLoop(nodes: WorkflowNode[]): WorkflowNode {
  return {
    type: 'loop',
    data: {
      config: {
        maxIterations: nodes.length,
        condition: { type: 'count', variable: 'i', operator: '<', value: nodes.length }
      }
    },
    childNodes: nodes
  };
}
```

## Timeline

- **Week 1**: Database schema + basic loop node UI
- **Week 2**: Compiler support for loops
- **Week 3**: Variable/counter nodes
- **Week 4**: Enhanced condition nodes
- **Week 5**: Canvas interactions (nesting, drag-drop)
- **Week 6**: Testing, docs, migration tools

## Success Metrics

- ✅ Agent Conversation Demo uses **2 nodes** instead of 4
- ✅ Workflows compile to valid Temporal code
- ✅ Can handle conversations of any length (1-100+ messages)
- ✅ State persists across workflow restarts
- ✅ UI feels intuitive for non-programmers

---

This design transforms the workflow builder from a **static flow diagram** into a **programmable state machine** that fully leverages Temporal's capabilities! 🚀

