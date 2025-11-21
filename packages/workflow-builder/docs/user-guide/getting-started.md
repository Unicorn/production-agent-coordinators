# Getting Started with Workflow Builder

Welcome to Workflow Builder! This guide will help you create and execute your first workflow in just 5-10 minutes.

## What You'll Build

In this guide, you'll create a simple 3-activity workflow that demonstrates the core capabilities of the platform:
- Visual workflow design with drag-and-drop
- Activity configuration
- Deployment to Temporal
- Execution monitoring

## Prerequisites

Before you begin, ensure you have:
- Access to the Workflow Builder web interface
- A user account (sign up if needed)
- Basic understanding of workflows and activities

No coding required for this guide!

## Step 1: Create a Project (2 minutes)

Projects group related workflows and provide organizational structure.

1. Navigate to the Workflow Builder homepage at http://localhost:3010
2. Click on **Projects** in the left sidebar
3. Click **New Project** button
4. Fill in the project details:
   - **Name**: "My First Project"
   - **Description**: "Learning workflow builder basics"
   - **Task Queue**: Leave as auto-generated (e.g., `my-first-project-queue`)
5. Click **Create Project**

**What just happened?**
- A new project was created in the database
- A dedicated Temporal task queue was configured
- You're now ready to create workflows!

## Step 2: Create Your First Workflow (3 minutes)

Now let's create a simple workflow to orchestrate three activities.

### Create the Workflow

1. Click on your newly created project
2. Click the **Workflows** tab
3. Click **New Workflow** button
4. Fill in the workflow details:
   - **Name**: "My First Workflow"
   - **Description**: "A simple 3-step workflow"
   - **Kebab Name**: (auto-generated: `my-first-workflow`)
5. Click **Create Workflow**

### Open the Visual Editor

1. Click **Edit** button to open the workflow canvas
2. You'll see three main areas:
   - **Component Palette** (left): Draggable components
   - **Canvas** (center): Design workspace
   - **Property Panel** (right): Configuration panel

## Step 3: Design Your Workflow (3 minutes)

Let's build a workflow with a trigger and three activities.

### Add a Trigger Node

Every workflow needs a starting point:

1. In the Component Palette, find the **Trigger** section
2. Drag the **Trigger** node onto the canvas
3. Drop it near the left side of the canvas
4. Click on the trigger node to select it
5. In the Property Panel on the right, configure:
   - **Label**: "Start Workflow"
   - **Trigger Type**: "Manual" (default)

### Add Activity Nodes

Now add three activity nodes:

#### Activity 1: Fetch Data
1. In the Component Palette, find **Activity Node**
2. Drag an **Activity** node onto the canvas (to the right of the trigger)
3. Click on the activity node
4. In the Property Panel:
   - **Label**: "Fetch User Data"
   - **Timeout**: "30s" (default)
   - **Retry Policy**: "Exponential Backoff"
   - **Max Attempts**: 3

#### Activity 2: Process Data
1. Drag another **Activity** node onto the canvas
2. Position it to the right of "Fetch User Data"
3. Configure in Property Panel:
   - **Label**: "Process Data"
   - **Timeout**: "1m"
   - **Retry Policy**: "Fail After 2 Attempts"

#### Activity 3: Save Results
1. Drag a third **Activity** node onto the canvas
2. Position it to the right of "Process Data"
3. Configure in Property Panel:
   - **Label**: "Save Results"
   - **Timeout**: "30s"
   - **Retry Policy**: "Exponential Backoff"
   - **Max Attempts**: 5

### Connect the Nodes

Connect the nodes to create a linear flow:

1. Hover over the **Trigger** node
2. You'll see a small handle on the right side
3. Click and drag from this handle to the **Fetch User Data** node
4. An edge (connection line) will appear
5. Repeat to connect:
   - **Fetch User Data** → **Process Data**
   - **Process Data** → **Save Results**

Your workflow should look like this:
```
[Start Workflow] → [Fetch User Data] → [Process Data] → [Save Results]
```

### Save Your Workflow

The workflow auto-saves every 2 seconds, but you can manually save:
1. Click **Save** button in the toolbar
2. Wait for the "Saved" confirmation

## Step 4: Deploy Your Workflow (2 minutes)

Before you can execute a workflow, you need to deploy it. Deployment compiles your visual workflow into executable TypeScript code and registers it with Temporal.

### Build the Workflow

1. In the workflow editor, click **Build Workflow** button in the toolbar
2. A build modal will appear showing progress:
   - Validating workflow definition
   - Compiling to TypeScript
   - Registering with Temporal worker
3. Wait for the build to complete (usually 5-10 seconds)
4. You'll see a success message: "Workflow built successfully!"

**What just happened?**
- Your visual workflow was compiled to TypeScript code
- The code was stored in the database
- A Temporal worker was started for your project
- Your workflow is now registered and ready to execute

### Verify Deployment

Check that your workflow is active:
1. Look for the **Status** indicator in the toolbar
2. It should show: **Active** (green badge)
3. Check the **Worker Status** indicator
4. It should show: **Running** (green dot)

**Troubleshooting:**
- If status shows "Draft", click **Build Workflow** again
- If worker shows "Stopped", check the console for errors
- See [Troubleshooting Guide](troubleshooting.md) for more help

## Step 5: Execute Your Workflow (1 minute)

Now let's run your workflow and watch it execute!

### Start Execution

1. In the workflow detail page, click **Execute** button
2. An execution modal appears
3. For this simple workflow, leave inputs empty (or provide JSON if needed)
4. Click **Start Execution**

### Monitor Execution

Watch your workflow execute in real-time:

1. You'll be redirected to the **Execution History** tab
2. Find your execution at the top of the list
3. Click on the execution to see details
4. The **Execution Detail View** shows:
   - Overall execution status (Running → Completed)
   - Each component execution with status
   - Start/end times for each activity
   - Inputs and outputs for each step

**What to expect:**
- Status changes from "Running" to "Completed" (usually in seconds)
- Each activity shows as "Completed" with a green checkmark
- The entire flow completes successfully

### View Results

1. In the execution detail view, expand each component:
   - **Input**: Data passed to the component
   - **Output**: Data returned by the component
   - **Duration**: How long the component took
   - **Retries**: Number of retry attempts (should be 0 for success)

2. Scroll to the bottom to see the final workflow output

## Next Steps

Congratulations! You've successfully:
- Created a project
- Designed a visual workflow
- Deployed the workflow to Temporal
- Executed and monitored the workflow

### Learn More

Now that you've mastered the basics, explore these guides:

- **[Workflow Canvas Guide](workflow-canvas.md)** - Master drag-and-drop workflow design
- **[Deployment Guide](deployment.md)** - Deep dive into deployment process
- **[Execution Monitoring](execution-monitoring.md)** - Advanced monitoring techniques
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

### Try These Examples

The platform includes pre-built example workflows:
1. Go to **Projects** → **Demo Workflows**
2. Explore the example workflows:
   - API Data Orchestration (simple)
   - ETL Data Pipeline (advanced)
   - Incident Notification Chain
   - E-Commerce Order Fulfillment
3. See [Demo Workflows Guide](demo-workflows.md) for details

### Build Real Workflows

Ready to build production workflows? Check out:
- **[Custom Activities](custom-activities.md)** - Create domain-specific activities
- **[Advanced Workflows](advanced-workflows.md)** - Conditional logic, loops, signals
- **[Workflow APIs](workflow-apis.md)** - Trigger workflows via HTTP/API

## Quick Reference

### Common Tasks

| Task | Steps |
|------|-------|
| Create workflow | Projects → Select Project → Workflows → New Workflow |
| Edit workflow | Workflows → Select Workflow → Edit |
| Deploy workflow | Workflow Editor → Build Workflow |
| Execute workflow | Workflow Detail → Execute |
| View executions | Workflow Detail → Execution History |
| View statistics | Workflow Detail → Statistics |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save workflow |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Y` | Redo |
| `Delete` | Delete selected node |
| `Ctrl/Cmd + D` | Duplicate node |

## Need Help?

- Check the [Troubleshooting Guide](troubleshooting.md)
- Review [Common Errors](../troubleshooting/common-errors.md)
- Watch the [Video Walkthrough](video-walkthrough-script.md)
- Contact support or check documentation

Happy workflow building!
