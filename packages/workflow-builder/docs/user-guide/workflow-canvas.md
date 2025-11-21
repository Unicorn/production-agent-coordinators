# Workflow Canvas User Guide

Complete guide to using the visual workflow editor to design, configure, and manage workflows.

## Canvas Overview

The workflow canvas is your visual workspace for designing workflows. It provides a drag-and-drop interface that makes workflow creation intuitive and accessible to both technical and non-technical users.

### Interface Layout

The canvas interface has three main sections:

```
┌────────────────────────────────────────────────────────────────┐
│  Toolbar (top)                                                  │
├──────────────┬──────────────────────────────────┬──────────────┤
│   Component  │                                  │   Property   │
│    Palette   │        Canvas                    │     Panel    │
│    (left)    │       (center)                   │    (right)   │
│              │                                  │              │
│   [Nodes]    │   [Visual Workflow Design]       │   [Config]   │
│   [Types]    │   [Drag & Drop]                  │   [Settings] │
│              │   [Connections]                  │              │
└──────────────┴──────────────────────────────────┴──────────────┘
```

### Toolbar (Top)

The toolbar provides workflow-level actions:

- **Save**: Manually save workflow (auto-saves every 2 seconds)
- **Build Workflow**: Deploy/compile the workflow
- **View Code**: Preview generated TypeScript code
- **Execute**: Run the workflow
- **Zoom Controls**: Zoom in/out, fit to screen
- **Status Indicators**: Workflow status, worker status

### Component Palette (Left)

Browse and drag components onto the canvas:

- **Triggers**: Workflow entry points
  - Manual Trigger
  - API Endpoint
  - Scheduled Trigger
  - Signal Trigger
- **Activities**: Reusable work units
  - Activity Nodes (linked to components)
- **Control Flow**: Logic and flow control
  - Condition Nodes
  - Signal Nodes
  - End Nodes
- **Advanced**: Complex patterns
  - Child Workflow Nodes
  - Retry Nodes
  - State Variable Nodes
  - Phase Nodes

### Canvas (Center)

The main design workspace where you:
- Drag and drop nodes
- Connect nodes with edges
- Arrange workflow layout
- Select and configure nodes

### Property Panel (Right)

Configure the selected node:
- Node properties (name, label, timeout)
- Component selection
- Retry policies
- Input/output mapping
- Validation errors and warnings

## Working with Nodes

### Adding Nodes to Canvas

#### Method 1: Drag and Drop (Recommended)

1. Find the desired node type in Component Palette
2. Click and hold on the node type
3. Drag it onto the canvas
4. Release to drop it at the desired position
5. The node appears and is automatically selected

#### Method 2: Double-Click (Quick Add)

1. Double-click on a node type in the Component Palette
2. The node is automatically added to the center of the canvas
3. Drag it to the desired position

### Selecting Nodes

Click on a node to select it:
- Selected node has a blue outline
- Property Panel updates with node configuration
- You can configure the selected node

**Multi-Select:**
- Hold `Shift` and click multiple nodes
- Or drag a selection box around multiple nodes
- Useful for moving multiple nodes together

### Moving Nodes

**Move Single Node:**
1. Click and hold on a node
2. Drag to the new position
3. Release to drop

**Move Multiple Nodes:**
1. Select multiple nodes (Shift + click)
2. Drag any selected node
3. All selected nodes move together

**Align Nodes:**
- Use grid snapping (enabled by default)
- Nodes snap to grid positions for neat alignment

### Deleting Nodes

**Method 1: Keyboard**
1. Select the node
2. Press `Delete` or `Backspace`

**Method 2: Property Panel**
1. Select the node
2. Click **Delete Node** button at bottom of Property Panel

**Method 3: Context Menu**
1. Right-click on the node
2. Select **Delete** from context menu

**Delete Multiple Nodes:**
1. Select multiple nodes
2. Press `Delete` to remove all selected nodes

### Duplicating Nodes

**Keyboard Shortcut:**
1. Select a node
2. Press `Ctrl/Cmd + D`
3. A duplicate appears slightly offset

**Copy/Paste:**
1. Select a node
2. Press `Ctrl/Cmd + C` to copy
3. Press `Ctrl/Cmd + V` to paste
4. Duplicate appears with new ID

## Connecting Nodes

Connections (edges) define the execution flow of your workflow.

### Creating Connections

#### Method 1: Drag from Handle

1. Hover over a node
2. You'll see a connection handle on the right side
3. Click and drag from the handle
4. Drag to the target node
5. Hover over the target node's left handle
6. Release to create the connection

#### Method 2: Click Handles

1. Click the output handle (right side) of the source node
2. Click the input handle (left side) of the target node
3. Connection is created automatically

### Connection Rules

The canvas enforces validation rules:

- **One Trigger**: Workflows must have exactly one trigger/start node
- **No Cycles**: Cannot create circular connections (except with Loop nodes)
- **Valid Types**: Only compatible node types can connect
- **Single Input**: Most nodes can have only one incoming connection
- **Multiple Outputs**: Condition nodes can have multiple outputs

**Validation Feedback:**
- Invalid connections show a red indicator
- Error message appears in Property Panel
- Fix the issue before deployment

### Deleting Connections

**Method 1: Click Edge**
1. Click on the connection line
2. Press `Delete`

**Method 2: Edge Context Menu**
1. Right-click on the connection line
2. Select **Delete** from context menu

### Reconnecting Edges

To change a connection:
1. Delete the old connection
2. Create a new connection
3. Or drag the edge handle to a new target

## Node Types and Configuration

### Trigger Nodes

Every workflow starts with a trigger.

#### Manual Trigger
- **Purpose**: Start workflow manually via UI or API
- **Configuration**:
  - **Label**: Display name
  - **Description**: What this trigger does
- **Use Cases**: On-demand workflows, testing

#### API Endpoint Trigger
- **Purpose**: Start workflow via HTTP API call
- **Configuration**:
  - **Label**: Endpoint description
  - **Path**: API endpoint path (e.g., `/api/orders`)
  - **Method**: HTTP method (GET, POST, PUT, DELETE)
- **Use Cases**: Webhooks, external integrations

#### Scheduled Trigger
- **Purpose**: Start workflow on a schedule
- **Configuration**:
  - **Label**: Schedule description
  - **Cron Expression**: When to run (e.g., `0 2 * * *` for daily at 2 AM)
- **Use Cases**: Daily reports, batch processing, cleanup jobs

#### Signal Trigger
- **Purpose**: Start workflow when a signal is received
- **Configuration**:
  - **Label**: Signal description
  - **Signal Name**: Name of the signal to wait for
- **Use Cases**: Event-driven workflows, cross-workflow communication

### Activity Nodes

Activities are the building blocks of your workflow.

#### Configuration Options

1. **Component Selection**:
   - Click **Select Component** button
   - Choose from available components
   - Or create a new component

2. **Basic Settings**:
   - **Label**: Display name for this activity
   - **Node ID**: Unique identifier (auto-generated)
   - **Timeout**: Maximum execution time (e.g., `30s`, `5m`, `1h`)

3. **Retry Policy**:
   - **No Retries**: Fail immediately on error
   - **Fail After X Attempts**: Retry up to X times, then fail
   - **Exponential Backoff**: Retry with increasing delays
   - **Keep Trying**: Retry indefinitely until success

4. **Advanced Settings**:
   - **Heartbeat Timeout**: For long-running activities
   - **Start-to-Close Timeout**: Total allowed duration
   - **Schedule-to-Close Timeout**: Including queue time

### Condition Nodes

Branch workflow based on conditions.

#### Configuration

- **Label**: Condition description
- **Condition Expression**: JavaScript expression
- **True Path**: Where to go if condition is true
- **False Path**: Where to go if condition is false

#### Example Conditions
```javascript
// Check if user is admin
data.user.role === 'admin'

// Check if amount exceeds threshold
data.orderTotal > 100

// Check if array has items
data.items.length > 0

// Complex condition
data.status === 'active' && data.lastLogin > Date.now() - 86400000
```

### Signal Nodes

Wait for or send signals during workflow execution.

#### Wait for Signal Configuration
- **Signal Name**: Name of signal to wait for
- **Timeout**: How long to wait before proceeding

#### Send Signal Configuration
- **Target Workflow**: Workflow to send signal to
- **Signal Name**: Name of signal
- **Signal Data**: Data to include with signal

### End Nodes

Mark the end of a workflow path.

- **Label**: End state description
- **Status**: Success, Failure, or Custom
- **Output**: Final workflow output data

**Best Practice**: Add End nodes to clearly mark workflow completion points.

## Canvas Controls

### Zoom and Pan

**Zoom In/Out:**
- Click zoom buttons in toolbar: `+` / `-`
- Keyboard: `Ctrl/Cmd + +` / `Ctrl/Cmd + -`
- Mouse wheel: Scroll up/down while holding `Ctrl/Cmd`

**Fit to Screen:**
- Click **Fit View** button in toolbar
- Keyboard: `Ctrl/Cmd + 0`
- Automatically centers and scales workflow

**Pan Canvas:**
- Click and drag on empty canvas area
- Or hold `Space` and drag
- Or use minimap (bottom-right corner)

### Minimap

Small overview in bottom-right corner:
- Shows entire workflow at a glance
- Current viewport highlighted
- Click to jump to different area
- Drag viewport rectangle to pan

Toggle minimap: Click **Minimap** button in toolbar

### Grid and Snapping

**Grid Display:**
- Visible dots show alignment grid
- Toggle: Click **Grid** button in toolbar

**Snap to Grid:**
- Nodes automatically snap to grid positions
- Ensures neat alignment
- Toggle: Click **Snap** button in toolbar

## Workflow Validation

The canvas validates your workflow in real-time.

### Validation Rules

1. **Must have a trigger**: At least one trigger/start node
2. **No orphaned nodes**: All nodes must be connected
3. **No cycles**: Cannot create loops (except with Loop nodes)
4. **Activities have components**: All activity nodes must reference a component
5. **Valid connections**: Only compatible node types can connect
6. **Unique node IDs**: No duplicate node identifiers

### Validation Feedback

**Visual Indicators:**
- Red border on invalid nodes
- Red edge for invalid connections
- Warning icon in Property Panel

**Error Messages:**
- Hover over error icon to see details
- Property Panel shows full error description
- Toolbar shows overall validation status

**Fix Errors:**
1. Click on the invalid node
2. Read error message in Property Panel
3. Fix the configuration issue
4. Validation updates automatically

### Pre-Deployment Validation

Before building a workflow:
1. Click **Build Workflow** button
2. System performs comprehensive validation
3. If errors found, build fails with detailed messages
4. Fix all errors and try again

## Auto-Save and Undo/Redo

### Auto-Save

- Workflow auto-saves every 2 seconds
- "Saving..." indicator appears in toolbar
- "Saved" confirmation when complete
- No action needed from you

**Manual Save:**
- Click **Save** button in toolbar
- Keyboard: `Ctrl/Cmd + S`

### Undo/Redo

**Undo:**
- Click **Undo** button in toolbar
- Keyboard: `Ctrl/Cmd + Z`
- Reverts last change

**Redo:**
- Click **Redo** button in toolbar
- Keyboard: `Ctrl/Cmd + Y` or `Ctrl/Cmd + Shift + Z`
- Reapplies undone change

**Undo History:**
- Supports up to 50 undo levels
- Clears when page is refreshed
- Save important changes frequently

## Best Practices

### Workflow Design

1. **Start with Trigger**: Always begin with a trigger node
2. **Left to Right Flow**: Arrange nodes left to right for readability
3. **Label Everything**: Use descriptive labels for all nodes
4. **Group Related Nodes**: Keep related activities close together
5. **Add End Nodes**: Clearly mark workflow completion points
6. **Use Comments**: Document complex logic (coming in future releases)

### Node Configuration

1. **Set Timeouts**: Configure appropriate timeout values
2. **Configure Retries**: Set retry policies for external calls
3. **Validate Inputs**: Use condition nodes to validate data
4. **Handle Errors**: Add error handling paths
5. **Test Incrementally**: Test after adding each major section

### Performance

1. **Limit Workflow Size**: Keep workflows under 20-30 nodes
2. **Use Child Workflows**: Break complex workflows into smaller pieces
3. **Optimize Activity Duration**: Keep activities short and focused
4. **Avoid Deep Nesting**: Keep workflow depth manageable

### Organization

1. **Consistent Naming**: Use clear, consistent node labels
2. **Logical Flow**: Organize nodes in execution order
3. **Visual Clarity**: Leave space between nodes
4. **Minimize Crossing Edges**: Rearrange nodes to reduce edge crossings

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save workflow |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + Shift + Z` | Redo (alternative) |
| `Ctrl/Cmd + D` | Duplicate selected node |
| `Ctrl/Cmd + C` | Copy selected node(s) |
| `Ctrl/Cmd + V` | Paste node(s) |
| `Delete` / `Backspace` | Delete selected node(s) |
| `Ctrl/Cmd + A` | Select all nodes |
| `Ctrl/Cmd + +` | Zoom in |
| `Ctrl/Cmd + -` | Zoom out |
| `Ctrl/Cmd + 0` | Fit to screen |
| `Space + Drag` | Pan canvas |
| `Shift + Click` | Multi-select nodes |

## Troubleshooting

### Common Issues

**Cannot connect nodes**
- Check that node types are compatible
- Ensure not creating a cycle
- Verify target node doesn't already have an input

**Node won't delete**
- Ensure node is selected (blue outline)
- Check if it's the only trigger (must have one trigger)
- Try using Delete button in Property Panel

**Canvas is laggy**
- Too many nodes (optimize or split workflow)
- Close other browser tabs
- Refresh the page
- Try a different browser (Chrome recommended)

**Auto-save not working**
- Check internet connection
- Look for error messages in console
- Try manual save (Ctrl/Cmd + S)
- Refresh and try again

**Changes not persisting**
- Ensure workflow saves successfully
- Check for validation errors
- Verify you're editing the correct workflow
- Try manual save before closing

### Getting Help

- See [Troubleshooting Guide](troubleshooting.md) for more issues
- Check [Common Errors](../troubleshooting/common-errors.md)
- Watch [Video Walkthrough](video-walkthrough-script.md)

## Next Steps

Now that you're familiar with the canvas:

- **[Deployment Guide](deployment.md)** - Deploy your workflow
- **[Execution Monitoring](execution-monitoring.md)** - Monitor workflow runs
- **[Advanced Workflows](advanced-workflows.md)** - Build complex patterns
- **[Custom Activities](custom-activities.md)** - Create custom components

Happy workflow building!
