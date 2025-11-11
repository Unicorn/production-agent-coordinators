# Agent Coordinator - Running Demos

This directory contains runnable examples demonstrating the agent coordinator system in action.

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.22.0
- All packages built (`yarn build`)

### Running the Hello World Demo

The simplest way to see the agent coordinator working:

```bash
# From the project root
npx tsx examples/demo-hello-world.ts
```

**What this demonstrates:**
1. **Dependency Injection** - Container wires up Storage, Logger, Specs, and Agents
2. **Component Orchestration** - Coordinator manages all components
3. **Deterministic Workflow** - Engine executes workflow with pure state transitions
4. **Workflow Logic** - HelloSpec defines the greeting workflow
5. **Agent Execution** - MockAgent executes the greeting task
6. **State Management** - EngineState tracks workflow progress
7. **Storage Abstraction** - LocalFileStorage persists artifacts

### Expected Output

```
╔════════════════════════════════════════════════════════════╗
║      Agent Coordinator - Hello World Demo                 ║
╚════════════════════════════════════════════════════════════╝

📦 Step 1: Setting up Container (Dependency Injection)
   - Registering LocalFileStorage
   - Registering ConsoleLogger

🎯 Step 2: Creating Coordinator
   - Wiring up components

📋 Step 3: Registering Spec and Agent Factories
   - HelloSpec: Simple greeting workflow
   - MockAgent: Deterministic test agent

🏗️  Step 4: Creating Spec and Agent Instances
   ✅ Spec created: hello
   ✅ Agent created: MockAgent

⚙️  Step 5: Initializing Engine State
   Goal ID: demo-goal-001
   Status: RUNNING

🚀 Step 6: Running Workflow
════════════════════════════════════════════════════════════

[DEMO] Requesting greeting work

🤖 Agent executing step: step-xxxx
   Work kind: greet
   Payload: {
  "message": "Say hello"
}
   ✅ Agent response: OK
   Content: {
  "message": "Mock agent executed successfully"
}

════════════════════════════════════════════════════════════
🎉 Workflow Complete!

📊 Final State:
   Status: COMPLETED
   Total steps: 1

   Steps executed:
   1. step-xxxx (greet)
      Status: DONE

   Artifacts created:
   - greeting: { message: 'Mock agent executed successfully' }

✨ Demo complete! The agent coordinator system is working.

   You just witnessed:
   ✓ Dependency injection (Container)
   ✓ Component orchestration (Coordinator)
   ✓ Deterministic workflow execution (Engine)
   ✓ Workflow logic (HelloSpec)
   ✓ Agent execution (MockAgent)
   ✓ State management (EngineState)
   ✓ Storage abstraction (LocalFileStorage)
```

## What's Happening Under the Hood

### 1. Container Setup
The `Container` class provides dependency injection:
- Registers `LocalFileStorage` for artifact persistence
- Registers `ConsoleLogger` for debug output
- Provides singleton access to shared services

### 2. Coordinator Wiring
The `Coordinator` manages all components:
- Registers spec factories (HelloSpecFactory)
- Registers agent factories (MockAgentFactory)
- Creates spec and agent instances with injected dependencies

### 3. Engine Execution
The `Engine` runs the deterministic workflow:
- Starts with initial state (RUNNING, no steps)
- Calls spec function to get decisions
- Executes agent work based on decisions
- Updates state through pure state transitions
- Continues until workflow is COMPLETED

### 4. HelloSpec Workflow
The `HelloSpec` defines workflow logic:
- **First call**: Returns REQUEST_WORK decision for "greet" work
- **After agent completes**: Annotates greeting artifact and finalizes

### 5. MockAgent Execution
The `MockAgent` executes work deterministically:
- Receives work kind and payload
- Returns pre-configured response (no real LLM calls)
- Provides consistent behavior for testing

## Next Steps

After running the demo, you can:

1. **Explore the code**: Open `examples/demo-hello-world.ts` to see the full implementation
2. **Read the docs**: Check `docs/customer/getting-started.md` for more details
3. **Run the tests**: Execute `yarn test:e2e` to see E2E tests
4. **Try with Claude**: Configure an Anthropic API key and use `AnthropicAgent`
5. **Build custom workflows**: Create your own specs following the HelloSpec pattern

## Troubleshooting

### "Cannot find module" errors
Make sure you've built all packages first:
```bash
yarn build
```

### "Engine validation failed"
The Engine requires a valid initial state. Check that your state has:
- `goalId` (string)
- `status` ("RUNNING" | "AWAITING_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED")
- `openSteps` (Record<string, StepState>)
- `artifacts` (Record<string, unknown>)
- `log` (Array<{ at: number; event: string; data: unknown }>)

### Demo hangs or times out
The demo has a 30-second timeout. If it hangs:
- Check that all dependencies are installed
- Ensure `yarn build` completed successfully
- Review console output for error messages

## Running with Real Claude API

To see the agent coordinator with REAL Claude API integration:

```bash
# Make sure you have your Anthropic API key
export ANTHROPIC_API_KEY=sk-your-key-here

# Or add it to .env file
echo "ANTHROPIC_API_KEY=sk-your-key-here" > .env

# Run the Claude demo
npx tsx examples/demo-with-claude.ts
```

**What this demonstrates:**
- Real Claude API calls (claude-sonnet-4-20250514)
- Token usage tracking
- Cost calculation
- Latency metrics
- Error handling (rate limits, context exceeded)

## Running with Temporal

To see the agent coordinator with durable Temporal workflows:

### Prerequisites
- Docker and Docker Compose installed
- Temporal infrastructure running

### Setup

```bash
# 1. Start Temporal infrastructure (Temporal server, PostgreSQL, Redis)
yarn infra:up

# 2. Build the Temporal worker bundle
yarn workspace @coordinator/temporal-coordinator build:worker

# 3. Start the worker (in a separate terminal)
yarn workspace @coordinator/temporal-coordinator start:worker

# 4. Run the demo (in another terminal)
npx tsx examples/demo-with-temporal.ts
```

### What's Happening

The Temporal integration uses a **bundler approach** to solve ES module issues:

1. **esbuild bundler** (`build-worker.js`) compiles TypeScript source directly
2. **Custom tsconfig** (`tsconfig.bundle.json`) redirects package imports to source files
3. **Bundled worker** (`dist/worker.bundle.js`) runs with proper ESM syntax

**What this demonstrates:**
- Durable workflow execution
- Automatic retries on failures
- State persistence across restarts
- Activity-based side effects
- Temporal Web UI integration (http://localhost:8233)

### Temporal Infrastructure

To manage Temporal infrastructure:

```bash
# Start all services
yarn infra:up

# Stop all services
yarn infra:down

# View logs
yarn infra:logs

# Restart services
yarn infra:restart
```

## Additional Examples

More examples coming soon:
- TodoSpec multi-step workflow
- Custom spec creation
- Error handling and retries

For now, explore the E2E tests in `tests/e2e/` for more comprehensive examples.
