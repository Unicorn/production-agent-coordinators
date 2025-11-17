# Components

Components are reusable building blocks for workflows.

## Component Types

### Activity
A Temporal activity that performs a specific unit of work (e.g., send email, fetch data).

**Use Cases**:
- External API calls
- Database operations
- File processing
- Notifications

### Agent
An AI-powered component that makes decisions or analyzes content.

**Use Cases**:
- Content analysis
- Decision making
- Text generation
- Data extraction

### Signal
A signal handler for receiving events from external systems or other workflows.

**Use Cases**:
- User input
- External events
- Work queue items
- Parent workflow communication

### Trigger
The entry point that starts a workflow. Every workflow must have at least one trigger.

**Use Cases**:
- Workflow start conditions
- Scheduled triggers
- Event triggers

## Creating a Component

1. Navigate to **Components** in the sidebar
2. Click **New Component**
3. Fill in:
   - **Name**: Component identifier (camelCase, no spaces)
   - **Display Name**: User-friendly name
   - **Description**: What the component does
   - **Component Type**: Select type (activity, agent, signal, trigger)
   - **Version**: Version number (e.g., "1.0.0")
   - **Capabilities**: Comma-separated capabilities
   - **Tags**: Optional tags for organization
4. Click **Create Component**

## Component Visibility

Components can have different visibility levels:

### Private
Only you can see and use the component.

### Public
All users can see and use the component.

### Organization
Organization members can see and use the component (future feature).

## Component Configuration

### Config Schema
Define the configuration schema for the component:
- Input fields
- Validation rules
- Default values

### Input/Output Schemas
Define the data structures:
- Input schema: What data the component accepts
- Output schema: What data the component returns

## Using Components in Workflows

1. Open a workflow in the visual editor
2. Find the component in the component palette (left side)
3. Drag it onto the canvas
4. Configure it in the property panel (right side)

## Related Documentation

- [Building Workflows](building-workflows.md) - Using components in workflows
- [Agent Prompts](agent-prompts.md) - Creating agent components

