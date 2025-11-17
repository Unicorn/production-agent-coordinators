# Building Workflows

Guide to using the visual workflow editor.

## Overview

The visual workflow editor lets you compose workflows by dragging components onto a canvas and connecting them.

## Opening the Editor

1. Navigate to **Workflows** in the sidebar
2. Click **New Workflow** or open an existing workflow
3. Click **Edit** to open the visual editor

## Canvas Interface

The editor has three main areas:

### Component Palette (Left)
Shows all available components organized by type. Drag components from here onto the canvas.

### Canvas (Center)
The main workspace where you design your workflow. Drag components here and connect them.

### Property Panel (Right)
Configuration panel for the selected node. Configure component properties, inputs, and behavior.

## Building a Workflow

### 1. Add a Trigger

Every workflow needs a starting point:
1. Find "Trigger" in the component palette
2. Drag it onto the canvas
3. This is your workflow's entry point

### 2. Add Components

1. Find components in the palette
2. Drag them onto the canvas
3. Position them as needed

### 3. Connect Nodes

1. Hover over a node
2. Click and drag from the output handle (right side)
3. Connect to the input handle (left side) of another node
4. A connection line appears

### 4. Configure Nodes

1. Click on a node to select it
2. The property panel shows configuration options
3. Fill in required fields
4. Set optional parameters

### 5. Save

- Changes auto-save every 2 seconds
- Or click **Save** to manually save
- You'll see a "Saved" confirmation

## Workflow Validation

The system validates workflows:
- Ensures at least one trigger node
- Checks node connections are valid
- Verifies required configuration is provided
- Shows validation errors in the property panel

## Workflow Patterns

### Linear Flow
Simple sequential execution:
```
Trigger → Activity 1 → Activity 2 → Activity 3
```

### Parallel Execution
Multiple branches:
```
Trigger → Activity 1 ──→ Activity 2
       └─→ Activity 3 └─→ Activity 4
```

### Conditional Flow
Decision points:
```
Trigger → Condition → [True] → Activity A
                    └─ [False] → Activity B
```

## Tips

### Organization
- Use descriptive node labels
- Group related nodes together
- Keep workflows focused and manageable

### Performance
- Avoid too many nodes (can cause lag)
- Use child workflows for complex processes
- Consider workflow size and complexity

### Best Practices
- Start with a trigger
- Connect nodes logically
- Test workflows before deploying
- Document complex workflows

## Related Documentation

- [Deploying Workflows](deploying-workflows.md) - Making workflows executable
- [Advanced Workflows](advanced-workflows.md) - Advanced patterns
- [Components](components.md) - Component reference

