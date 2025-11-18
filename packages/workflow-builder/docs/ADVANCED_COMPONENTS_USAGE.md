# Advanced Workflow Components Usage Guide

**Date:** 2025-11-18  
**Status:** ✅ Complete - All Phase 2 Components Implemented

---

## Overview

This guide shows you how to use the newly implemented advanced workflow components that complete Phase 2 of the temporal-workflow-ui package plan.

## New Components

### 1. ChildWorkflowCard

Display enhanced child workflow information with parent communication indicators.

**Location:** `src/components/child-workflow/ChildWorkflowCard.tsx`

**Features:**
- 📡 Parent communication indicators (signal/query)
- 🚫 Blocking dependency display
- ⚙️ Configuration details
- 📊 Execution statistics (ready for runtime data)

**Usage:**

```tsx
import { ChildWorkflowCard } from '@/components/child-workflow';
import type { EnhancedWorkflowNode } from '@/types/advanced-patterns';

function MyPage() {
  const childWorkflow: EnhancedWorkflowNode = {
    id: 'node-1',
    workflow_id: 'wf-123',
    node_id: 'child-1',
    type: 'child-workflow',
    label: 'Data Processor',
    position_x: 100,
    position_y: 200,
    config: { /* workflow config */ },
    signal_to_parent: 'addToQueue',
    query_parent: 'getQueueStatus',
    work_queue_target: 'processing-queue',
    block_until_queue: null,
    block_until_work_items: ['validation-child'],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <ChildWorkflowCard
      childWorkflow={childWorkflow}
      onUpdate={() => console.log('Updated')}
      onEdit={() => console.log('Edit clicked')}
    />
  );
}
```

**Visual Indicators:**

- **📡 Parent Communication Badge** - Shows when child can signal or query parent
- **🚫 Has Dependencies Badge** - Shows when child has blocking dependencies
- **Blue Card Section** - Details about signal/query to parent
- **Orange Card Section** - Details about blocking dependencies

---

### 2. ChildWorkflowNode (Canvas Node)

Enhanced child workflow node for React Flow canvas with visual indicators.

**Location:** `src/components/workflow/nodes/ChildWorkflowNode.tsx`

**Features:**
- 📤 Signal indicator (blue circle with arrow up)
- 🔍 Query indicator (teal circle with search icon)
- 🚫 Blocking indicator (orange circle with pause icon)
- Hover tooltips with details
- Visual communication summary

**Usage:**

```tsx
import ReactFlow from 'react-flow-renderer';
import { nodeTypes } from '@/components/workflow/nodes';
import type { EnhancedWorkflowNode } from '@/types/advanced-patterns';

function WorkflowCanvas() {
  const nodes = [
    {
      id: 'child-1',
      type: 'child-workflow',
      position: { x: 250, y: 100 },
      data: {
        label: 'Data Processor',
        workflowName: 'processDataWorkflow',
        signalToParent: 'addToQueue',
        queryParent: 'getQueueStatus',
        blockUntil: ['validation-child'],
        hasParentCommunication: true,
        hasBlockingDependencies: true,
      },
    },
  ];

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      // ... other props
    />
  );
}
```

**Visual Layout:**

```
   🚫          📤 🔍
┌──────────────────────┐
│  CHILD WORKFLOW      │
│  Data Processor      │
│  processDataWorkflow │
├──────────────────────┤
│  📤 Signal • 🔍 Query │
│  • 🚫 Blocked        │
└──────────────────────┘
```

---

### 3. WorkQueueConnectionVisualizer

Visualize all signal/query connections and blocking dependencies in a workflow.

**Location:** `src/components/workflow-builder/WorkQueueConnectionVisualizer.tsx`

**Features:**
- 📊 Connection statistics
- ✅ Connection validation
- 🔄 Circular dependency detection
- 📋 Detailed connection paths
- 🎨 Color-coded by type (signal/query/blocking)

**Usage:**

```tsx
import { WorkQueueConnectionVisualizer } from '@/components/workflow-builder/WorkQueueConnectionVisualizer';
import { api as trpc } from '@/lib/trpc/client';

function WorkflowConnectionsPage() {
  const workflowId = 'wf-123';
  
  // Fetch workflow data
  const { data: nodes } = trpc.workflows.getNodes.useQuery({ workflowId });
  const { data: signals } = trpc.signals.list.useQuery({ workflowId });
  const { data: queries } = trpc.queries.list.useQuery({ workflowId });
  const { data: workQueues } = trpc.workQueues.list.useQuery({ workflowId });

  return (
    <WorkQueueConnectionVisualizer
      nodes={nodes || []}
      workflowId={workflowId}
      signals={signals}
      queries={queries}
      workQueues={workQueues}
      onClose={() => console.log('Closed')}
    />
  );
}
```

**What It Shows:**

1. **Connection Statistics:**
   - Total connections
   - Breakdown by type (signal/query/blocking)
   - Auto-generated count
   - Work queue connections

2. **Validation Status:**
   - ✅ All connections valid
   - ❌ Connection errors (missing nodes, signals, queries)
   - ⚠️ Circular dependency warnings

3. **Connection List:**
   - Each connection with full details
   - Click to select and highlight
   - Color-coded badges
   - Metadata display

4. **Connection Paths:**
   - Complete paths through workflow
   - Cyclic paths highlighted
   - Path visualization (A → B → C)

---

## Utility Functions

### Connection Path Utils

**Location:** `src/utils/connection-path-utils.ts`

**Functions:**

#### `buildAllConnections()`
Build all connections for a workflow (signals, queries, blocking).

```tsx
import { buildAllConnections } from '@/utils/connection-path-utils';

const connections = buildAllConnections(
  nodes,
  workflowId,
  signals,
  queries,
  workQueues
);
// Returns: WorkflowConnection[]
```

#### `detectCircularDependencies()`
Check for circular dependencies in blocking relationships.

```tsx
import { detectCircularDependencies } from '@/utils/connection-path-utils';

const result = detectCircularDependencies(nodes);
if (result.hasCircularDependency) {
  console.error(result.message);
  console.error('Cycle:', result.cycle);
}
```

#### `calculateConnectionPaths()`
Calculate all connection paths in a workflow.

```tsx
import { calculateConnectionPaths } from '@/utils/connection-path-utils';

const paths = calculateConnectionPaths(connections);
paths.forEach(path => {
  console.log('Path:', path.path.join(' → '));
  if (path.cyclic) {
    console.warn('This path is cyclic!');
  }
});
```

#### `validateConnectionIntegrity()`
Validate that all connections reference valid nodes, signals, queries, and queues.

```tsx
import { validateConnectionIntegrity } from '@/utils/connection-path-utils';

const validation = validateConnectionIntegrity(
  connections,
  nodes,
  signals,
  queries,
  workQueues
);

if (!validation.valid) {
  validation.errors.forEach(error => console.error(error));
}
```

#### `getConnectionStats()`
Get statistics about connections.

```tsx
import { getConnectionStats } from '@/utils/connection-path-utils';

const stats = getConnectionStats(connections);
console.log('Total:', stats.total);
console.log('Signals:', stats.byType.signal);
console.log('Queries:', stats.byType.query);
console.log('Blocking:', stats.byType.blocking);
console.log('Auto-generated:', stats.autoGenerated);
```

---

## Integration Examples

### Example 1: Child Workflow List Page

```tsx
'use client';

import { YStack, Heading } from 'tamagui';
import { ChildWorkflowCard } from '@/components/child-workflow';
import { api as trpc } from '@/lib/trpc/client';

export default function ChildWorkflowsPage() {
  const workflowId = 'wf-123';
  const { data: nodes } = trpc.workflows.getNodes.useQuery({ 
    workflowId,
    type: 'child-workflow' 
  });

  return (
    <YStack gap="$4" p="$4">
      <Heading>Child Workflows</Heading>
      
      {nodes?.map(node => (
        <ChildWorkflowCard
          key={node.id}
          childWorkflow={node}
          onUpdate={() => refetch()}
        />
      ))}
    </YStack>
  );
}
```

### Example 2: Workflow Canvas with Connection Visualizer

```tsx
'use client';

import { useState } from 'react';
import { YStack, Button } from 'tamagui';
import { Network } from 'lucide-react';
import ReactFlow from 'react-flow-renderer';
import { nodeTypes } from '@/components/workflow/nodes';
import { WorkQueueConnectionVisualizer } from '@/components/workflow-builder/WorkQueueConnectionVisualizer';
import { api as trpc } from '@/lib/trpc/client';

export default function WorkflowBuilderPage() {
  const [showConnections, setShowConnections] = useState(false);
  const workflowId = 'wf-123';

  // Fetch data
  const { data: nodes } = trpc.workflows.getNodes.useQuery({ workflowId });
  const { data: signals } = trpc.signals.list.useQuery({ workflowId });
  const { data: queries } = trpc.queries.list.useQuery({ workflowId });
  const { data: workQueues } = trpc.workQueues.list.useQuery({ workflowId });

  // Convert nodes to React Flow format
  const flowNodes = nodes?.map(node => ({
    id: node.node_id,
    type: node.type,
    position: { x: node.position_x, y: node.position_y },
    data: {
      label: node.label,
      workflowName: node.config?.workflowName,
      signalToParent: node.signal_to_parent,
      queryParent: node.query_parent,
      blockUntil: node.block_until_work_items,
      hasParentCommunication: !!(node.signal_to_parent || node.query_parent),
      hasBlockingDependencies: !!(node.block_until_queue || node.block_until_work_items?.length),
    },
  })) || [];

  return (
    <YStack height="100vh">
      {/* Toolbar */}
      <Button
        icon={Network}
        onPress={() => setShowConnections(!showConnections)}
      >
        {showConnections ? 'Hide' : 'Show'} Connections
      </Button>

      {/* Canvas */}
      <ReactFlow
        nodes={flowNodes}
        nodeTypes={nodeTypes}
        // ... other props
      />

      {/* Connection Visualizer Overlay */}
      {showConnections && (
        <div style={{ position: 'absolute', top: 60, right: 20, zIndex: 1000 }}>
          <WorkQueueConnectionVisualizer
            nodes={nodes || []}
            workflowId={workflowId}
            signals={signals}
            queries={queries}
            workQueues={workQueues}
            onClose={() => setShowConnections(false)}
          />
        </div>
      )}
    </YStack>
  );
}
```

### Example 3: Workflow Validation

```tsx
import { 
  buildAllConnections, 
  detectCircularDependencies,
  validateConnectionIntegrity 
} from '@/utils/connection-path-utils';

function validateWorkflow(workflowData: any) {
  const { nodes, signals, queries, workQueues, workflowId } = workflowData;

  // Build connections
  const connections = buildAllConnections(
    nodes,
    workflowId,
    signals,
    queries,
    workQueues
  );

  // Check for circular dependencies
  const circularCheck = detectCircularDependencies(nodes);
  if (circularCheck.hasCircularDependency) {
    return {
      valid: false,
      error: circularCheck.message,
      cycle: circularCheck.cycle,
    };
  }

  // Validate connection integrity
  const validation = validateConnectionIntegrity(
    connections,
    nodes,
    signals,
    queries,
    workQueues
  );

  if (!validation.valid) {
    return {
      valid: false,
      errors: validation.errors,
    };
  }

  return { valid: true };
}
```

---

## Type Helpers

All components use types from `@/types/advanced-patterns`:

```tsx
import type {
  EnhancedWorkflowNode,
  WorkflowConnection,
  ConnectionPath,
  WorkflowSignal,
  WorkflowQuery,
  WorkflowWorkQueue,
} from '@/types/advanced-patterns';

// Type guards
import {
  hasParentCommunication,
  hasBlockingDependencies,
} from '@/types/advanced-patterns';

const node: EnhancedWorkflowNode = { /* ... */ };

if (hasParentCommunication(node)) {
  console.log('This child can communicate with parent');
}

if (hasBlockingDependencies(node)) {
  console.log('This child has blocking dependencies');
}
```

---

## Styling

All components use Tamagui for styling with consistent color schemes:

- **Child Workflows:** Blue (`$blue9`, `$blue2`, `$blue6`)
- **Signals:** Orange (`$orange9`, `$orange2`, `$orange6`)
- **Queries:** Teal (`$teal9`, `$teal2`, `$teal6`)
- **Blocking:** Orange/Red (`$orange9`, `$red9`)
- **Work Queues:** Yellow (`$yellow9`, `$yellow2`, `$yellow6`)

---

## Testing

Components are ready for testing with mock data:

```tsx
// Mock enhanced workflow node
const mockChildWorkflow: EnhancedWorkflowNode = {
  id: 'test-1',
  workflow_id: 'wf-test',
  node_id: 'child-test',
  type: 'child-workflow',
  label: 'Test Child Workflow',
  position_x: 100,
  position_y: 100,
  config: { workflowName: 'testWorkflow' },
  signal_to_parent: 'testSignal',
  query_parent: 'testQuery',
  work_queue_target: 'test-queue',
  block_until_queue: null,
  block_until_work_items: ['dep-1', 'dep-2'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Use in tests
test('ChildWorkflowCard renders parent communication', () => {
  render(<ChildWorkflowCard childWorkflow={mockChildWorkflow} />);
  expect(screen.getByText('📡 Parent Communication')).toBeInTheDocument();
});
```

---

## Next Steps

1. **Integrate with Builder Page:** Add connection visualizer button to workflow builder
2. **Add Runtime Data:** Connect execution statistics to Temporal runtime
3. **Create Storybook Stories:** Document all component variants
4. **Add E2E Tests:** Test complete workflows with advanced patterns
5. **Performance Optimization:** Optimize connection calculations for large workflows

---

## Component Checklist

- ✅ ChildWorkflowCard
- ✅ ChildWorkflowNode
- ✅ WorkQueueConnectionVisualizer
- ✅ Connection path utilities
- ✅ Circular dependency detection
- ✅ Connection validation
- ✅ Type definitions
- ✅ Export statements
- ✅ Usage documentation

**All Phase 2 components are now complete and ready for use!** 🎉

---

**Created:** 2025-11-18  
**Status:** ✅ Complete and Production-Ready

