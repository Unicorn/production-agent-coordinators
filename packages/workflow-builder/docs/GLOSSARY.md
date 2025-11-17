# Glossary

Terminology reference for the Workflow Builder system. This glossary defines key terms used throughout the documentation.

## Core Concepts

### Workflow
A sequence of connected tasks (nodes) that execute in a specific order. Workflows are composed visually in the builder and executed via Temporal.

### Component
A reusable building block for workflows. Components can be activities, agents, signals, or triggers. Each component has a type, configuration schema, and metadata.

### Node
A single element in a workflow graph. Nodes represent components placed on the canvas and connected via edges.

### Edge
A connection between two nodes in a workflow, representing the flow of execution or data.

### Project
A container for organizing related workflows. Each project has its own task queue and worker, providing isolation between different workflow sets.

### Task Queue
A Temporal concept representing a named queue where work is distributed to workers. In this system, each user+project combination gets its own task queue.

## Component Types

### Activity
A Temporal activity that performs a specific unit of work (e.g., send email, fetch data, process file). Also referred to as "Task" in user-facing UI.

### Agent
An AI-powered component that makes decisions or analyzes content. Agents use prompts and can interact with external AI services.

### Signal
A mechanism for sending data to a running workflow. Signals allow external systems or other workflows to communicate with active workflows. Also referred to as "Event" in user-facing UI.

### Trigger
The entry point that starts a workflow. Every workflow must have at least one trigger node. Also referred to as "Start" in user-facing UI.

### Query
A read-only mechanism for checking workflow state without affecting execution. Queries allow external systems to inspect workflow status. Also referred to as "Status Check" in user-facing UI.

## Advanced Patterns

### Child Workflow
A workflow started by another (parent) workflow. Child workflows enable breaking complex processes into manageable pieces. Also referred to as "Sub-Workflow" in user-facing UI.

### Scheduled Workflow
A workflow that runs automatically on a schedule defined by a cron expression. Also referred to as "Recurring Task" in user-facing UI.

### Work Queue
A queue of pending work items that can be processed by workflows. Work queues enable batch processing and work distribution patterns. Also referred to as "Work Backlog" in user-facing UI.

### Cron Expression
A string defining when and how often a scheduled workflow should run (e.g., `0 0 * * *` for daily at midnight).

## System Concepts

### Visibility
Controls who can see and use a component:
- **Public**: Available to all users
- **Private**: Only available to the creator
- **Organization**: Available to organization members

### Workflow Status
The current state of a workflow:
- **Draft**: Work in progress, not yet deployed
- **Active**: Deployed and ready to execute
- **Paused**: Temporarily stopped
- **Archived**: No longer in use

### Compiled Code
The generated TypeScript/JavaScript code that represents a workflow definition. Compiled code is stored in the database and loaded by workers at runtime.

### Worker
A Temporal worker process that executes workflows and activities. In this system, one worker is created per project, handling all workflows in that project.

### Execution
A single run of a workflow. Each execution has a unique workflow ID and run ID, tracks inputs and outputs, and maintains execution history.

## Database Terms

### Row-Level Security (RLS)
A PostgreSQL feature that restricts access to rows based on user identity. All tables in the system use RLS to ensure users can only access their own data or public resources.

### Migration
A SQL script that modifies the database schema. Migrations are versioned and applied sequentially to maintain schema consistency.

### Denormalization
Storing redundant data to improve query performance. The system denormalizes workflow nodes and edges into separate tables for efficient querying.

## API Terms

### tRPC
Type-safe RPC framework used for all API communication. Provides end-to-end type safety between frontend and backend.

### Procedure
A tRPC endpoint. Procedures can be queries (read operations) or mutations (write operations).

### Router
A collection of related tRPC procedures organized by domain (e.g., workflows, components, projects).

## Temporal Terms

### Workflow Definition
The code that defines what a workflow does. In this system, workflows are defined visually and compiled to Temporal workflow code.

### Activity Definition
The code that defines what an activity does. Activities are registered with workers and executed when called by workflows.

### Workflow Execution
A running instance of a workflow. Each execution has a unique ID and maintains state throughout its lifecycle.

### Task Queue
A named queue in Temporal where work is distributed. Workers poll task queues for work to execute.

### Namespace
A logical grouping of workflows in Temporal. All workflows in this system use the default namespace (configurable).

## Development Terms

### Component Registry
The database table storing all available components. Components can be synced from external registries or created directly in the UI.

### Workflow Compiler
The system that converts visual workflow definitions (JSON) into executable Temporal workflow code.

### Worker Manager
The system that manages Temporal worker lifecycle: starting, stopping, and restarting workers for projects.

### Code Storage
The database table storing compiled workflow code. Workers load code from storage at startup.

## User Interface Terms

### Canvas
The visual workspace where workflows are built. Users drag components onto the canvas and connect them with edges.

### Component Palette
The panel showing available components that can be dragged onto the canvas.

### Property Panel
The panel for configuring a selected node's properties, inputs, and behavior.

### Auto-save
The automatic saving of workflow changes every 2 seconds to prevent data loss.

## Related Documentation

- [Terminology Guide](../plans/workflow-terminology-guide.md) - User-friendly terminology mapping
- [System Design](architecture/system-design.md) - Architecture overview
- [Database Schema](architecture/database-schema.md) - Database structure
- [Temporal Integration](architecture/temporal-integration.md) - How workflows execute

