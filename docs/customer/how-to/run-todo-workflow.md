# How to Run the Todo Workflow

The Todo workflow demonstrates a multi-step workflow pattern with stateful progression. It shows how agents can work together across multiple stages to accomplish a complex task.

## What You'll Learn

- How to build multi-step workflows
- How to manage state across workflow stages
- How to pass data between workflow steps
- How to handle workflow errors and retries

## Prerequisites

- Agent Coordinator installed and built
- Infrastructure services running
- Completed the [Hello workflow guide](run-hello-workflow.md)

## Workflow Overview

The Todo workflow has three stages:

```
┌──────────────────────┐
│ 1. Gather            │
│    Requirements      │
│    "What needs to    │
│     be done?"        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 2. Create Tasks      │
│    Break down        │
│    requirements      │
│    into tasks        │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ 3. Confirm           │
│    Completion        │
│    Verify all        │
│    tasks created     │
└──────────────────────┘
```

**Key Differences from Hello:**
- Multiple agent interactions (3 vs 1)
- State persisted across steps (requirements, tasks)
- Conditional logic based on workflow progress
- Error handling with retry logic

## Step 1: Run the Basic Workflow

```bash
cd packages/cli
node dist/cli.js run todo
```

The workflow will execute all three stages automatically.

## Step 2: Understand the Output

**Stage 1 Output:**

```json
{
  "requirements": {
    "goal": "Build a simple todo application",
    "details": "User wants CRUD operations for tasks",
    "estimatedTasks": 5
  }
}
```

**Stage 2 Output:**

```json
{
  "requirements": { ... },
  "tasks": [
    {
      "id": 1,
      "title": "Create database schema",
      "description": "Design tables for tasks and users",
      "priority": "high",
      "estimatedHours": 2
    },
    {
      "id": 2,
      "title": "Build REST API endpoints",
      "description": "Create CRUD endpoints",
      "priority": "high",
      "estimatedHours": 4
    },
    // ... more tasks
  ]
}
```

**Final Output:**

```json
{
  "requirements": { ... },
  "tasks": [ ... ],
  "confirmation": {
    "status": "completed",
    "taskCount": 5,
    "timestamp": "2025-11-09T10:30:00Z"
  }
}
```

## Step 3: Run with Custom Requirements

Create a configuration to customize the workflow:

```bash
# Create config file
node dist/cli.js init-config

# Edit .coordinatorrc to add spec config
```

**Example configuration:**

```json
{
  "defaultAgent": "mock",
  "specs": {
    "todo": {
      "maxTasks": 3,
      "requirements": {
        "goal": "Build a REST API for user authentication"
      }
    }
  }
}
```

Run with custom config:

```bash
node dist/cli.js run todo --config .coordinatorrc
```

## Step 4: Track Workflow Progress

Enable detailed logging to see each stage:

```bash
DEBUG=coordinator:* node dist/cli.js run todo
```

**Progress indicators:**

```
coordinator:spec Starting todo workflow - requesting requirements
coordinator:engine Step status: WAITING -> IN_PROGRESS
coordinator:agent Executing work kind=gather_requirements
coordinator:spec Requirements gathered successfully
coordinator:engine Annotating artifact key=requirements

coordinator:spec Creating tasks from requirements
coordinator:agent Executing work kind=create_tasks
coordinator:spec Tasks created successfully taskCount=5
coordinator:engine Annotating artifact key=tasks

coordinator:spec Confirming completion
coordinator:agent Executing work kind=confirm_completion
coordinator:spec Todo workflow completed successfully
coordinator:engine Workflow finalized status=COMPLETED
```

## Understanding Workflow State

### State Progression

**Initial State:**

```typescript
{
  goalId: "todo-workflow-1",
  status: "RUNNING",
  openSteps: {},
  artifacts: {}
}
```

**After Requirements Gathered:**

```typescript
{
  goalId: "todo-workflow-1",
  status: "RUNNING",
  openSteps: {
    "step-2": {
      kind: "create_tasks",
      status: "WAITING",
      payload: { requirements: {...} }
    }
  },
  artifacts: {
    "requirements": {...}
  }
}
```

**After Tasks Created:**

```typescript
{
  goalId: "todo-workflow-1",
  status: "RUNNING",
  openSteps: {
    "step-3": {
      kind: "confirm_completion",
      status: "WAITING",
      payload: { requirements: {...}, tasks: [...] }
    }
  },
  artifacts: {
    "requirements": {...},
    "tasks": [...]
  }
}
```

**Final State:**

```typescript
{
  goalId: "todo-workflow-1",
  status: "COMPLETED",
  openSteps: {},
  artifacts: {
    "requirements": {...},
    "tasks": [...],
    "confirmation": {...}
  }
}
```

## Advanced Usage

### Using Claude for Better Task Generation

Claude provides more realistic task breakdowns:

```bash
export ANTHROPIC_API_KEY="your-api-key"
node dist/cli.js run todo --agent anthropic
```

**Benefits:**
- More detailed task descriptions
- Better task prioritization
- Realistic time estimates
- Natural language understanding

### Handling Workflow Errors

TodoSpec includes retry logic for failures:

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (attemptNumber < 3) {
    // Retry with error context
    return {
      actions: [{
        type: 'REQUEST_WORK',
        workKind,
        payload: {
          retry: true,
          previousError: error.message
        }
      }],
      finalize: false
    };
  }

  // Max retries exceeded - fail gracefully
  return {
    actions: [{
      type: 'ANNOTATE',
      key: 'error',
      value: { workKind, error: error.message }
    }],
    finalize: true
  };
}
```

**Test retry behavior:**

```bash
# Simulate failure (requires code modification)
# Edit TodoSpec to throw error on first attempt
DEBUG=coordinator:* node dist/cli.js run todo
```

## Understanding the Code

### TodoSpec Stage Detection

The spec uses artifact presence to determine stage:

```typescript
onAgentCompleted(state, resp, context): EngineDecision {
  const hasRequirements = "requirements" in state.artifacts;
  const hasTasks = "tasks" in state.artifacts;
  const hasConfirmation = "confirmation" in state.artifacts;

  // Stage 1: Gather requirements
  if (!hasRequirements) {
    if (resp.content?.requirements) {
      return {
        actions: [
          { type: 'ANNOTATE', key: 'requirements', value: resp.content.requirements },
          { type: 'REQUEST_WORK', workKind: 'create_tasks', payload: {...} }
        ],
        finalize: false
      };
    }
    // Request requirements gathering...
  }

  // Stage 2: Create tasks
  if (hasRequirements && !hasTasks) {
    // Create tasks...
  }

  // Stage 3: Confirm completion
  if (hasRequirements && hasTasks && !hasConfirmation) {
    // Finalize...
  }
}
```

### Data Flow Between Stages

Each stage passes data to the next:

```typescript
// Stage 1 → Stage 2
{
  type: 'REQUEST_WORK',
  workKind: 'create_tasks',
  payload: {
    requirements: state.artifacts.requirements  // From Stage 1
  }
}

// Stage 2 → Stage 3
{
  type: 'REQUEST_WORK',
  workKind: 'confirm_completion',
  payload: {
    requirements: state.artifacts.requirements,  // From Stage 1
    tasks: state.artifacts.tasks                 // From Stage 2
  }
}
```

## Common Issues

### "Workflow stuck in RUNNING state"

One of the stages didn't complete. Check debug logs:

```bash
DEBUG=coordinator:* node dist/cli.js run todo
```

Look for which stage is active and what response was received.

### "Invalid requirements format"

The agent returned unexpected data. This can happen with:
- Custom agents that don't follow the schema
- API errors that return error objects instead of data

**Solution:** Validate agent responses match expected format.

### "Tasks not created"

The `create_tasks` stage failed. Check:
1. Agent has capacity (not rate limited)
2. Requirements are valid
3. No timeout issues

## Customization Ideas

### 1. Add a Review Stage

Modify TodoSpec to add a human review step:

```typescript
if (hasTasks && !hasReview) {
  return {
    actions: [{
      type: 'REQUEST_WORK',
      workKind: 'request_review',
      payload: { tasks: state.artifacts.tasks }
    }],
    finalize: false
  };
}
```

### 2. Limit Task Count

Add configuration validation:

```typescript
validate(config): boolean {
  const cfg = config as { maxTasks?: number };
  return !cfg.maxTasks || (cfg.maxTasks > 0 && cfg.maxTasks <= 20);
}
```

### 3. Add Task Priorities

Enhance the task creation payload:

```typescript
{
  type: 'REQUEST_WORK',
  workKind: 'create_tasks',
  payload: {
    requirements: state.artifacts.requirements,
    priorityLevels: ['critical', 'high', 'medium', 'low']
  }
}
```

## Performance Tips

### Parallel Execution

For independent tasks, the engine can execute steps in parallel:

```typescript
// These can run in parallel
return {
  actions: [
    { type: 'REQUEST_WORK', workKind: 'create_docs', payload: {...} },
    { type: 'REQUEST_WORK', workKind: 'create_tests', payload: {...} }
  ],
  finalize: false
};
```

### Optimize Agent Calls

- Use mock agents during development
- Cache repeated requirements
- Batch similar work kinds

## Next Steps

- [Create your own multi-step workflow](create-custom-workflow.md)
- [Learn about error handling patterns](../use-cases/multi-step-workflows.md)
- [Explore agent configuration](configure-agents.md)
- [Integrate with LLMs](../use-cases/integrating-llms.md)

## Related Documentation

- [Workflow Specs Reference](../reference/workflow-specs.md)
- [Multi-Step Workflows Use Case](../use-cases/multi-step-workflows.md)
- [Configuration Reference](../reference/configuration.md)
