# Quick Tutorial

A 5-minute walkthrough to build and execute your first workflow.

## Prerequisites

- System installed and running (see [Installation](installation.md))
- Development server started: `yarn dev`
- Logged in to http://localhost:3010

## Step 1: Create a Component (2 minutes)

Components are reusable building blocks for workflows.

1. **Navigate to Components**
   - Click "Components" in the sidebar
   - Click "New Component" button

2. **Fill in Component Details**
   - **Name**: `sendEmail` (camelCase, no spaces)
   - **Display Name**: `Send Email`
   - **Description**: `Sends an email notification`
   - **Component Type**: Select `activity`
   - **Version**: `1.0.0`
   - **Capabilities**: `email, notification` (comma-separated)

3. **Create Component**
   - Click "Create Component"
   - You should see a success message

## Step 2: Create a Workflow (1 minute)

Workflows orchestrate components to perform complex tasks.

1. **Navigate to Workflows**
   - Click "Workflows" in the sidebar
   - Click "New Workflow" button

2. **Fill in Workflow Details**
   - **Name**: `email-notification` (kebab-case)
   - **Display Name**: `Email Notification Workflow`
   - **Task Queue**: Select `default-queue`
   - **Visibility**: `private`

3. **Create and Edit**
   - Click "Create & Edit"
   - You'll be taken to the visual workflow editor

## Step 3: Design the Workflow (2 minutes)

The visual editor lets you drag and connect components.

1. **Add a Trigger**
   - In the component palette (left side), find "Trigger" or "Start"
   - Drag it onto the canvas
   - This is the entry point of your workflow

2. **Add Your Component**
   - Find your `Send Email` component in the palette
   - Drag it onto the canvas, to the right of the trigger

3. **Connect the Nodes**
   - Hover over the trigger node
   - Click and drag from the output handle (right side)
   - Connect to the input handle (left side) of the `Send Email` node
   - You should see a connection line

4. **Configure the Component**
   - Click on the `Send Email` node
   - The property panel (right side) will show configuration options
   - Add any required inputs (e.g., `to`, `subject`, `body`)

5. **Save the Workflow**
   - Changes auto-save every 2 seconds
   - Or click "Save" to manually save
   - You should see a "Saved" confirmation

## Step 4: Deploy the Workflow (Optional)

Deploying makes the workflow available for execution.

1. **Click "Deploy"**
   - In the workflow toolbar
   - This changes the workflow status to "active"

2. **Verify Deployment**
   - Check the workflow status indicator
   - Should show "Active" status

## Step 5: Execute the Workflow (Optional, requires Temporal)

If Temporal is running, you can execute the workflow.

1. **Start Temporal** (if not running)
   ```bash
   temporal server start-dev
   ```

2. **Build the Workflow**
   - In the workflow editor, click "Build Workflow"
   - This compiles the workflow to executable code
   - Starts a worker for the project
   - Registers the workflow with Temporal

3. **Execute**
   - Click "Execute" or "Run"
   - Provide any required input parameters
   - Monitor execution in the UI

4. **View Execution**
   - Check Temporal Web UI: http://localhost:8233
   - Or view execution history in the workflow detail page

## What You've Learned

- ✅ Created a reusable component
- ✅ Built a workflow using the visual editor
- ✅ Connected nodes to define execution flow
- ✅ Configured component properties
- ✅ Deployed a workflow (optional)
- ✅ Executed a workflow (optional)

## Next Steps

### Explore More Features

- **[Components Guide](../user-guide/components.md)** - Learn about component types
- **[Building Workflows](../user-guide/building-workflows.md)** - Advanced workflow patterns
- **[Agent Prompts](../user-guide/agent-prompts.md)** - Create AI-powered components

### Advanced Patterns

- **[Advanced Workflows](../user-guide/advanced-workflows.md)** - Scheduled workflows, signals, child workflows
- **[Projects](../user-guide/projects.md)** - Organize workflows into projects

### Development

- **[Architecture](../architecture/README.md)** - Understand the system design
- **[API Reference](../api/README.md)** - Explore the API
- **[Development Guide](../development/README.md)** - Contribute to the codebase

## Common Issues

**"Component not found in palette"**
- Refresh the page
- Verify component was created successfully
- Check component visibility settings

**"Cannot connect nodes"**
- Ensure both nodes are on the canvas
- Check node types are compatible
- Try dragging from output to input handle

**"Workflow won't save"**
- Check browser console for errors
- Verify you're logged in
- Check network connection

**"Build failed"**
- Ensure Temporal is running
- Check workflow has at least one trigger node
- Verify all nodes are properly configured

## Related Documentation

- [User Guide](../user-guide/README.md) - Complete user documentation
- [Building Workflows](../user-guide/building-workflows.md) - Detailed workflow guide
- [Troubleshooting](../troubleshooting.md) - Common issues and solutions

