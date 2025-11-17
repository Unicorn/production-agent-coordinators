# Adding Component Types

Guide to adding new component types to the system.

## Overview

Component types define the kinds of components available in the workflow builder. To add a new type:

1. Add to database (`component_types` table)
2. Create custom node component
3. Add to node registry
4. Update workflow compiler

## Steps

### 1. Add to Database

Add new type to `component_types` table:

```sql
INSERT INTO component_types (name, description, icon) VALUES
  ('new-type', 'Description of new type', 'icon-name');
```

Or create a migration:

```sql
-- Migration: Add new component type
INSERT INTO component_types (name, description, icon)
VALUES ('new-type', 'New component type', 'icon-name');
```

### 2. Create Node Component

Create custom node component in `src/components/workflow/nodes/`:

```typescript
// NewTypeNode.tsx
import { NodeProps } from 'react-flow-renderer';

export function NewTypeNode({ data, selected }: NodeProps) {
  return (
    <div className={`node new-type-node ${selected ? 'selected' : ''}`}>
      <div className="node-header">
        <Icon name="new-type" />
        <span>{data.label}</span>
      </div>
      <div className="node-body">
        {/* Node content */}
      </div>
    </div>
  );
}
```

### 3. Add to Node Registry

Update `src/components/workflow/nodes/index.ts`:

```typescript
export { NewTypeNode } from './NewTypeNode';

export const nodeTypes = {
  activity: ActivityNode,
  agent: AgentNode,
  signal: SignalNode,
  trigger: TriggerNode,
  'new-type': NewTypeNode, // Add here
};
```

### 4. Update Workflow Compiler

Update `src/lib/workflow-compiler/compiler.ts` to handle new type:

```typescript
function generateNodeCode(node: WorkflowNode): string {
  switch (node.type) {
    case 'new-type':
      return generateNewTypeCode(node);
    // ... other cases
  }
}
```

## Related Documentation

- [Components](../user-guide/components.md) - User guide
- [Workflow Compiler](../architecture/temporal-integration.md) - Compiler details

