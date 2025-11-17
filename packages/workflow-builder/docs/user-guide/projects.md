# Projects

Projects organize workflows and provide isolation between different workflow sets.

## Overview

Projects are containers for organizing related workflows. Each project:
- Has its own task queue (isolated from other projects)
- Gets its own Temporal worker
- Provides natural boundaries for workflow management

## Creating a Project

1. Navigate to **Projects** in the sidebar
2. Click **New Project**
3. Fill in:
   - **Name**: Project name (e.g., "Email Automation")
   - **Description**: Optional description
4. Click **Create Project**

The system automatically:
- Generates a unique task queue name
- Creates the project in the database
- Makes it available for workflows

## Project Settings

### Task Queue

Each project has a unique task queue name:
- Format: `{user_id}-{project_id}`
- Automatically generated
- Used by Temporal for work distribution

### Worker Management

Workers are automatically managed:
- Started when first workflow is built
- Stopped when project is deleted
- Restarted when workflows are updated

## Managing Projects

### Viewing Projects

The projects list shows:
- Project name and description
- Number of workflows
- Worker status
- Last execution time

### Editing Projects

1. Click on a project
2. Edit name or description
3. Save changes

### Deleting Projects

1. Open project details
2. Click **Delete Project**
3. Confirm deletion

**Warning**: Deleting a project also deletes all workflows in that project.

## Project Workflows

All workflows in a project:
- Share the same task queue
- Are handled by the same worker
- Are isolated from other projects

## Related Documentation

- [Building Workflows](building-workflows.md) - Creating workflows in projects
- [Deploying Workflows](deploying-workflows.md) - Deploying project workflows

