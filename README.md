# Agent Coordinator

A general-purpose AI agent orchestration platform built on deterministic workflows, enabling complex multi-agent interactions with pluggable specifications and agent implementations.

## Overview

The Agent Coordinator is a TypeScript-based monorepo that provides a robust framework for orchestrating AI agents to complete complex tasks. It combines deterministic workflow execution with flexible agent implementations, allowing you to build sophisticated multi-agent systems.

### Key Features

- **Deterministic Workflow Engine**: Pure state transitions with deterministic execution
- **Pluggable Specifications**: Define custom workflow logic through Spec interfaces
- **Agent Abstraction**: Support for multiple agent types (LLM-based, tool-based, etc.)
- **Dependency Injection**: Clean architecture with factory-based component creation
- **Type-Safe**: Built with TypeScript in strict mode
- **Docker Infrastructure**: Pre-configured PostgreSQL, Redis, and Temporal setup
- **Comprehensive Testing**: Unit tests, integration tests, and E2E test coverage

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI / UI                            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Coordinator                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Container   │  │   Storage    │  │   Logger     │      │
│  │  (DI)        │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                         Engine                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  State Transitions (Pure Functions)                  │   │
│  │  • applyRequestWork  • applyAnnotate                 │   │
│  │  • applyAgentResponse  • finalizeState               │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────┬─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│              Specs & Agents (Pluggable)                     │
│  ┌────────────────┐         ┌────────────────┐             │
│  │ HelloSpec      │         │ MockAgent      │             │
│  │ TodoSpec       │         │ AnthropicAgent │             │
│  │ CustomSpecs... │         │ CustomAgents...│             │
│  └────────────────┘         └────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.22.0
- Docker and Docker Compose (for infrastructure)

### Installation

```bash
# Clone the repository
git clone https://github.com/bernierllc/agent-coordinator.git
cd agent-coordinator

# Install dependencies
yarn install

# Build all packages
yarn build
```

### Start Infrastructure

```bash
# Start PostgreSQL, Redis, and Temporal
yarn infra:up

# Verify services are running
docker compose -f docker/docker-compose.yml ps
```

### Run Your First Workflow

```bash
# Run the Hello World example
cd packages/cli
yarn build
node dist/examples/hello-example.js
```

### Run Tests

```bash
# Run all unit tests
yarn test

# Run E2E tests
yarn test:e2e

# Run with watch mode
yarn test:watch
```

## Project Structure

```
agent-coordinator/
├── packages/
│   ├── contracts/         # Pure TypeScript interfaces and types
│   ├── engine/           # Deterministic workflow execution engine
│   ├── coordinator/      # DI container and orchestration
│   ├── storage/          # Storage implementations (local, S3, etc.)
│   ├── cli/              # Command-line interface
│   ├── specs/            # Workflow specifications
│   │   ├── hello/        # Hello World spec
│   │   └── todo/         # Todo app generator spec
│   └── agents/           # Agent implementations
│       ├── mock/         # Mock agents for testing
│       └── anthropic/    # Claude-powered agents
├── docker/               # Infrastructure (PostgreSQL, Redis, Temporal)
├── tests/
│   └── e2e/             # End-to-end tests
└── docs/                # Additional documentation
```

### Package Dependencies

The monorepo follows strict dependency rules to prevent circular dependencies:

- **contracts**: Zero dependencies (pure interfaces)
- **engine**: Depends on contracts only
- **coordinator**: Depends on contracts and engine
- **storage**: Depends on contracts only
- **specs/\***: Depends on contracts ONLY (never engine!)
- **agents/\***: Depends on contracts ONLY (never engine!)
- **cli**: Depends on all packages for integration

## Creating Custom Specs

Specs define the decision logic for workflows. Here's a simple example:

```typescript
import type { ISpec, ISpecFactory, EngineState, EngineDecision } from '@coordinator/contracts';

export class MySpecFactory implements ISpecFactory {
  readonly name = 'my-spec';
  readonly version = '1.0.0';

  create(context: SpecContext): ISpec {
    return new MySpec(context);
  }

  describe() {
    return {
      name: this.name,
      version: this.version,
      description: 'My custom workflow specification',
    };
  }
}

class MySpec implements ISpec {
  readonly name = 'my-spec';

  constructor(private context: SpecContext) {}

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    execContext: SpecExecutionContext
  ): EngineDecision {
    // Define your workflow logic here
    const finalize = resp.status === 'OK';

    return {
      decisionId: `dec-${execContext.now}`,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize,
    };
  }
}
```

See [packages/specs/hello](packages/specs/hello) for a complete example.

## Creating Custom Agents

Agents execute work requested by specs. Here's a basic example:

```typescript
import type { IAgent, IAgentFactory, AgentResult } from '@coordinator/contracts';

export class MyAgentFactory implements IAgentFactory {
  readonly supportedWorkKinds = ['my-work-kind'];

  create(context: AgentContext): IAgent {
    return new MyAgent(context);
  }

  describe() {
    return {
      name: 'my-agent',
      version: '1.0.0',
      supportedWorkKinds: this.supportedWorkKinds,
    };
  }
}

class MyAgent implements IAgent {
  constructor(private context: AgentContext) {}

  async execute(
    workKind: string,
    payload: unknown,
    context: AgentExecutionContext
  ): Promise<AgentResult> {
    // Implement your agent logic here
    return {
      status: 'OK',
      content: { result: 'Work completed!' },
    };
  }
}
```

See [packages/agents/mock](packages/agents/mock) for a complete example.

## Development Guide

### Build Commands

```bash
# Build all packages
yarn build

# Build in watch mode
yarn build:watch

# Clean all build artifacts
yarn clean
```

### Testing

```bash
# Run all unit tests (without watch)
yarn test

# Run tests in watch mode
yarn test:watch

# Run E2E tests
yarn test:e2e

# Run linting
yarn lint

# Type checking
yarn typecheck
```

### Infrastructure Commands

```bash
# Start all services (PostgreSQL, Redis, Temporal)
yarn infra:up

# Stop all services
yarn infra:down

# View logs
yarn infra:logs

# View specific service logs
docker compose -f docker/docker-compose.yml logs -f postgres
```

### Working with Docker Services

**PostgreSQL** (Port 5432):
```bash
# Connect to database
docker exec -it coordinator-postgres psql -U coordinator -d coordinator
```

**Redis** (Port 6379):
```bash
# Connect to Redis CLI
docker exec -it coordinator-redis redis-cli -a redis_dev
```

**Temporal UI** (Port 8080):
- Open http://localhost:8080 in your browser

See [docker/README.md](docker/README.md) for detailed infrastructure documentation.

## Testing Strategy

The project uses a comprehensive multi-layer testing approach:

### Unit Tests

- Test individual functions and classes in isolation
- Located alongside source files (`*.test.ts`)
- Focus on pure state transitions and business logic
- Run with `yarn test`

### Integration Tests

- Test component interactions
- Validate container DI and factory patterns
- Verify spec and agent integration
- Run with `yarn test` (included in unit tests)

### E2E Tests

- Test complete workflows end-to-end
- Validate real component integration
- Located in `tests/e2e/`
- Run with `yarn test:e2e`

### Mock Validation

Per CLAUDE.md guidelines, all mocks must be validated:
- Mock agents must match real agent behavior
- Tests verify mock responses against real schemas
- Regular re-recording of mock responses

## Examples

### Hello World Workflow

The simplest workflow demonstrates basic coordination:

```typescript
import { Container, Coordinator } from '@coordinator/coordinator';
import { LocalFileStorage } from '@coordinator/storage';
import { HelloSpecFactory } from '@coordinator/specs-hello';
import { MockAgentFactory } from '@coordinator/agents-mock';
import { Engine } from '@coordinator/engine';

// Setup
const container = new Container();
container.registerStorage(new LocalFileStorage('./output'));
container.registerLogger(new ConsoleLogger('HELLO'));

const coordinator = new Coordinator(container);
coordinator.registerSpec(new HelloSpecFactory());
coordinator.registerAgent('mock', new MockAgentFactory(['HELLO']));

// Create instances
const spec = coordinator.createSpec('hello', { workKind: 'HELLO' });
const agent = coordinator.createAgent('mock', {}, {});

// Run workflow
const engine = new Engine(initialState);
const finalState = await engine.runWorkflow(
  (state) => spec.onAgentCompleted(state, lastResponse, context),
  async (stepId, step) => {
    const result = await agent.execute(step.kind, step.payload, {
      goalId: state.goalId,
      workflowId: 'hello-1',
      stepId,
      runId: 'run-1',
      agentRole: 'greeter',
    });
    return convertToAgentResponse(result, stepId);
  }
);

console.log('Final status:', finalState.status);
```

See [packages/cli/src/examples](packages/cli/src/examples) for more examples.

## Troubleshooting

### Common Issues

**Build Errors**
```bash
# Clean and rebuild
yarn clean
yarn install
yarn build
```

**Test Failures**
- Ensure all dependencies are installed: `yarn install`
- Check that Docker services are running: `yarn infra:up`
- Clear test artifacts: `rm -rf ./output ./data`

**Port Conflicts**
- Modify ports in `docker/.env`
- Default ports: PostgreSQL (5432), Redis (6379), Temporal (7233), Temporal UI (8080)

**TypeScript Errors**
- Ensure you're using TypeScript 5.6.3+: `yarn why typescript`
- Run type checking: `yarn typecheck`

### Getting Help

- Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Check [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines
- Review package-specific READMEs in `packages/*/README.md`
- Check existing issues on GitHub

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development workflow
- Code style guidelines
- Testing requirements
- Commit conventions
- Pull request process

## Architecture Documentation

For detailed architecture information, see:

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design and patterns
- [docs/plans/2025-11-07-agent-coordinator-architecture-design.md](docs/plans/2025-11-07-agent-coordinator-architecture-design.md) - Original design document
- [packages/engine/README.md](packages/engine/README.md) - Engine architecture
- [packages/coordinator/README.md](packages/coordinator/README.md) - DI and coordination
- [docker/README.md](docker/README.md) - Infrastructure setup

## Roadmap

### Current Phase (v0.1.0)
- ✅ Deterministic workflow engine
- ✅ Hello World specification
- ✅ Todo app generator specification
- ✅ Mock and Anthropic agents
- ✅ Local file storage
- ✅ Docker infrastructure
- ✅ Comprehensive test coverage

### Future Enhancements
- [ ] Database-backed state persistence
- [ ] Workflow state projection for UI
- [ ] Queue-based coordinator dispatch
- [ ] Advanced agent patterns (map-reduce, critic-executor)
- [ ] Streaming support for long-running generations
- [ ] Rate limiting and cost tracking
- [ ] Web UI for workflow management
- [ ] Multi-agent communication protocols

## License

MIT

## Acknowledgments

Built with:
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vitest](https://vitest.dev/) - Unit testing framework
- [Docker](https://www.docker.com/) - Containerization
- [Anthropic Claude](https://www.anthropic.com/) - AI agent capabilities
