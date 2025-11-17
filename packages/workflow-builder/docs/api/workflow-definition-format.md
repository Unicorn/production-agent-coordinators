# Workflow Definition Format

JSON structure for workflow definitions.

## Overview

Workflow definitions are stored as JSONB in the `workflows.definition` column. The structure represents the visual workflow graph.

## Structure

```typescript
interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata?: WorkflowMetadata;
}
```

## Nodes

```typescript
interface WorkflowNode {
  id: string;                    // Unique node ID
  type: NodeType;               // Node type
  position: {                    // Canvas position
    x: number;
    y: number;
  };
  data: {
    label: string;               // Display label
    componentId?: string;        // Component ID (if using component)
    componentName?: string;      // Component name
    config?: Record<string, any>; // Node configuration
  };
}

type NodeType = 
  | 'activity' 
  | 'agent' 
  | 'signal' 
  | 'trigger' 
  | 'condition' 
  | 'end';
```

## Edges

```typescript
interface WorkflowEdge {
  id: string;                    // Unique edge ID
  source: string;                 // Source node ID
  target: string;                 // Target node ID
  sourceHandle?: string;         // Source handle ID
  targetHandle?: string;         // Target handle ID
  label?: string;                // Edge label
  type?: string;                 // Edge type
}
```

## Metadata

```typescript
interface WorkflowMetadata {
  timeout?: string;              // Workflow timeout
  retryPolicy?: {                // Retry policy
    initialInterval?: string;
    backoffCoefficient?: number;
    maximumInterval?: string;
    maximumAttempts?: number;
  };
  description?: string;          // Workflow description
}
```

## Example

```json
{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "Start",
        "config": {}
      }
    },
    {
      "id": "activity-1",
      "type": "activity",
      "position": { "x": 300, "y": 100 },
      "data": {
        "label": "Send Email",
        "componentId": "comp-123",
        "componentName": "sendEmail",
        "config": {
          "to": "user@example.com",
          "subject": "Hello",
          "body": "World"
        }
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "trigger-1",
      "target": "activity-1",
      "type": "default"
    }
  ],
  "metadata": {
    "timeout": "1h",
    "description": "Simple email workflow"
  }
}
```

## Validation Rules

### Required Nodes
- At least one trigger node (entry point)

### Node Connections
- Nodes must be connected via edges
- Source and target nodes must exist
- No circular dependencies (validated during compilation)

### Configuration
- Node config must match component schema (if using component)
- Required fields must be provided
- Types must match schema

## Related Documentation

- [Building Workflows](../user-guide/building-workflows.md) - Creating workflows
- [Database Types](database-types.md) - Type definitions

