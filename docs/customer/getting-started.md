# Getting Started with Agent Coordinator

Welcome to Agent Coordinator! This guide will help you set up and run your first AI-powered workflow in minutes.

## What is Agent Coordinator?

Agent Coordinator is a workflow orchestration platform that helps you build multi-agent AI systems. It provides:

- **Deterministic workflows** - Predictable, testable agent behavior
- **Pluggable agents** - Use Claude, custom tools, or mock agents
- **Flexible specifications** - Define custom workflow logic
- **Type-safe** - Built with TypeScript for reliability

## Quick Start

### Prerequisites

Before you begin, make sure you have:

- Node.js 18 or higher
- Yarn 1.22 or higher
- Docker Desktop (for infrastructure services)

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/bernierllc/agent-coordinator.git
cd agent-coordinator
```

2. **Install dependencies:**

```bash
yarn install
```

3. **Build the project:**

```bash
yarn build
```

This will compile all packages. You should see output indicating successful compilation of each package (contracts, engine, coordinator, specs, agents, cli).

### Start Infrastructure Services

Agent Coordinator uses Docker to run supporting services:

```bash
yarn infra:up
```

This starts:
- PostgreSQL (database)
- Redis (caching)
- Temporal (workflow orchestration)

Wait about 30 seconds for services to fully initialize.

**Verify services are running:**

```bash
docker compose -f docker/docker-compose.yml ps
```

You should see all services with "Up" status.

### Run Your First Workflow

Let's run the "Hello" workflow, which demonstrates a simple single-step workflow:

```bash
cd packages/cli
node dist/cli.js run hello
```

**Expected output:**

```
Loading configuration...
Configuration loaded
Executing workflow...
Workflow completed successfully

Output:
{
  "greeting": {
    "message": "Hello! I'm ready to help."
  }
}
```

Congratulations! You just ran your first agent workflow.

## Understanding What Happened

The Hello workflow demonstrates the core concepts:

1. **Workflow Specification (Spec)** - The HelloSpec defines the workflow logic
2. **Agent** - The MockAgent executes the work requested by the spec
3. **Engine** - Orchestrates state transitions between spec and agent
4. **Artifacts** - The greeting is stored as workflow output

```
┌─────────────┐      ┌──────────┐      ┌─────────┐
│  HelloSpec  │─────▶│  Engine  │─────▶│  Agent  │
│ (workflow)  │      │ (state)  │      │(executor)│
└─────────────┘      └──────────┘      └─────────┘
        ▲                                    │
        │                                    │
        └────────────────────────────────────┘
              Agent responds, spec decides next step
```

## Next Steps

Now that you have Agent Coordinator running, you can:

1. **Try the Todo workflow** - A multi-step example that creates tasks
   ```bash
   node dist/cli.js run todo
   ```

2. **Explore available specs and agents**
   ```bash
   node dist/cli.js list-specs
   node dist/cli.js list-agents
   ```

3. **Configure API keys** - To use Claude agents, set up your API key:
   ```bash
   export ANTHROPIC_API_KEY="your-api-key-here"
   ```

4. **Learn to create custom workflows** - See [Create Custom Workflow](how-to/create-custom-workflow.md)

## Common Setup Issues

### Port Conflicts

If you get "port already in use" errors:

```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :7233  # Temporal

# Stop conflicting services or change ports in docker/.env
```

### Build Errors

If you encounter build errors:

```bash
# Clean and rebuild
yarn clean
yarn install
yarn build
```

### Docker Services Not Starting

If Docker services won't start:

```bash
# View logs
yarn infra:logs

# Stop and restart
yarn infra:down
yarn infra:up
```

## Learning Path

We recommend following this learning path:

1. **Getting Started** (you are here)
2. [Run Hello Workflow](how-to/run-hello-workflow.md) - Understand the basics
3. [Run Todo Workflow](how-to/run-todo-workflow.md) - Multi-step workflows
4. [Use CLI](how-to/use-cli.md) - Master the command-line interface
5. [Configure Agents](how-to/configure-agents.md) - Set up Claude and custom agents
6. [Create Custom Workflow](how-to/create-custom-workflow.md) - Build your own

## Getting Help

- **Documentation** - Browse the [use cases](use-cases/) and [reference](reference/) docs
- **Troubleshooting** - See [common issues](troubleshooting.md)
- **FAQ** - Check the [frequently asked questions](faq.md)
- **GitHub Issues** - Report bugs or request features
- **Examples** - Explore `packages/cli/src/examples/` for code samples

Ready to dive deeper? Let's explore the [Hello workflow in detail](how-to/run-hello-workflow.md).
