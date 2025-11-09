# How to Run the Hello Workflow

The Hello workflow is the simplest workflow in Agent Coordinator. It demonstrates the fundamental concepts of specs, agents, and workflow execution in a single-step process.

## What You'll Learn

- How workflow specs request work from agents
- How agents execute work and return results
- How the engine orchestrates state transitions
- How to view workflow output

## Prerequisites

- Agent Coordinator installed and built
- Infrastructure services running (`yarn infra:up`)
- Basic understanding of the [Getting Started](../getting-started.md) guide

## Step 1: Understand the Workflow

The Hello workflow follows this simple flow:

```
1. HelloSpec requests a "greet" task
2. Agent receives request and generates greeting
3. Agent returns greeting to spec
4. Spec stores greeting in artifacts
5. Workflow completes
```

**Workflow State:**

```typescript
Initial State:
{
  goalId: "hello-workflow-1",
  status: "RUNNING",
  openSteps: {},
  artifacts: {}
}

After Agent Responds:
{
  goalId: "hello-workflow-1",
  status: "COMPLETED",
  openSteps: {},
  artifacts: {
    "greeting": { message: "Hello! I'm ready to help." }
  }
}
```

## Step 2: Run the Workflow

From the project root:

```bash
cd packages/cli
node dist/cli.js run hello
```

**What happens behind the scenes:**

1. CLI loads configuration (looks for `.coordinatorrc` or uses defaults)
2. Creates a Container with storage and logger services
3. Registers HelloSpec factory
4. Registers MockAgent factory (or your configured agent)
5. Creates engine with initial state
6. Runs workflow until finalized

## Step 3: View the Output

The CLI displays the workflow result:

```json
{
  "greeting": {
    "message": "Hello! I'm ready to help."
  }
}
```

**Output explanation:**

- `greeting` - The artifact key set by HelloSpec
- `message` - The content returned by the agent

## Step 4: Run with Different Agents

### Using Mock Agent (Default)

Mock agents return predefined responses for testing:

```bash
node dist/cli.js run hello --agent mock
```

**Mock agent behavior:**
- Deterministic responses
- No external API calls
- Instant execution
- Perfect for testing and development

### Using Claude Agent

To use Anthropic's Claude:

```bash
# Set your API key
export ANTHROPIC_API_KEY="your-api-key-here"

# Run with Claude
node dist/cli.js run hello --agent anthropic
```

**Claude agent behavior:**
- Real AI-generated responses
- Requires valid API key
- Subject to rate limits
- More natural, varied output

**Expected Claude output:**

```json
{
  "greeting": {
    "message": "Hello! I'm Claude, an AI assistant. How can I help you today?"
  }
}
```

## Step 5: Inspect Workflow State (Advanced)

To see the complete workflow state including logs:

```bash
# Enable debug logging
export DEBUG=coordinator:*

# Run workflow
node dist/cli.js run hello
```

**Debug output shows:**

```
coordinator:engine Initializing workflow goalId=hello-workflow-123
coordinator:spec Requesting greeting work
coordinator:engine Applying REQUEST_WORK action stepId=step-1
coordinator:agent Executing work kind=greet
coordinator:engine Applying AGENT_RESPONSE stepId=step-1 status=OK
coordinator:spec Greeting completed, finalizing workflow
coordinator:engine Workflow finalized status=COMPLETED
```

## Understanding the Code

### HelloSpec Decision Logic

The spec uses simple conditional logic:

```typescript
onAgentCompleted(state, resp, context): EngineDecision {
  // Check if we need to request work
  const hasGreetStep = Object.values(state.openSteps)
    .some(step => step.kind === 'greet');

  if (!hasGreetStep) {
    // Request greeting work
    return {
      actions: [{
        type: 'REQUEST_WORK',
        workKind: 'greet',
        payload: { message: 'Say hello' }
      }],
      finalize: false
    };
  }

  // Store result and complete
  return {
    actions: [{
      type: 'ANNOTATE',
      key: 'greeting',
      value: resp.content
    }],
    finalize: true
  };
}
```

### Key Concepts

**Actions:**
- `REQUEST_WORK` - Ask agent to execute a task
- `ANNOTATE` - Store data in workflow artifacts

**Finalization:**
- `finalize: false` - Workflow continues
- `finalize: true` - Workflow completes

**State Transitions:**
All state changes are deterministic and pure - the same inputs always produce the same outputs.

## Common Issues

### "No such spec: hello"

The HelloSpec isn't registered. Check:

```bash
node dist/cli.js list-specs
```

If hello isn't listed, ensure packages are built:

```bash
yarn build
```

### "Agent not available"

The specified agent isn't registered. View available agents:

```bash
node dist/cli.js list-agents
```

### "Workflow failed to complete"

Check debug logs:

```bash
DEBUG=coordinator:* node dist/cli.js run hello
```

Look for error messages in the output.

## Customization

### Modify the Greeting Prompt

Edit the HelloSpec payload in `packages/specs/hello/src/HelloSpec.ts`:

```typescript
{
  type: 'REQUEST_WORK',
  workKind: 'greet',
  payload: { message: 'Say hello in Spanish' }  // Changed
}
```

Rebuild and run:

```bash
yarn workspace @coordinator/specs-hello build
cd packages/cli
node dist/cli.js run hello
```

### Create a Configuration File

Save custom settings:

```bash
node dist/cli.js init-config
```

Edit `.coordinatorrc`:

```json
{
  "defaultAgent": "anthropic",
  "defaultSpec": "hello",
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

Now `run hello` uses your configured agent automatically.

## Next Steps

- [Run the Todo workflow](run-todo-workflow.md) for a multi-step example
- [Create your own custom workflow](create-custom-workflow.md)
- [Configure different agents](configure-agents.md)
- [Learn CLI commands](use-cli.md)

## Related Documentation

- [CLI Commands Reference](../reference/cli-commands.md)
- [Workflow Specs Reference](../reference/workflow-specs.md)
- [Simple Automation Use Case](../use-cases/simple-automation.md)
