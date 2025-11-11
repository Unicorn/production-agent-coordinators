# @coordinator/coordinator

Dependency injection container and coordinator for the agent-coordinator system.

## Overview

This package provides:

- **Container**: Low-level DI container for factory registration and resolution
- **Coordinator**: High-level facade for wiring components together
- **ConsoleLogger**: Simple console-based logger implementation

## Architecture

The coordinator package implements the **Service Locator** pattern with **Factory Registration** for dependency injection:

```
┌─────────────────────────────────────────────────────────┐
│                      Coordinator                        │
│  (High-level API for component wiring)                 │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                      Container                          │
│  • Spec Factory Registry                               │
│  • Agent Factory Registry                              │
│  • Singleton Services (Storage, Logger)                │
│  • Configuration Store                                 │
│  • Context Creation                                    │
└─────────────────────────────────────────────────────────┘
```

## Usage

### Basic Setup

```typescript
import { Container, Coordinator, ConsoleLogger } from "@coordinator/coordinator";
import { LocalFileStorage } from "@coordinator/storage";
import { HelloSpecFactory } from "@coordinator/specs-hello";
import { MockAgentFactory } from "@coordinator/agents-mock";

// Create container and register core services
const container = new Container();
container.registerStorage(new LocalFileStorage("./data"));
container.registerLogger(new ConsoleLogger("APP"));

// Create coordinator
const coordinator = new Coordinator(container, {
  timeout: 10000,
  maxRetries: 3,
});

// Register specs and agents
coordinator.registerSpec(new HelloSpecFactory());
coordinator.registerAgent("mock-agent", new MockAgentFactory(["greet"]));

// Create spec and agent instances
const spec = coordinator.createSpec("hello", { workKind: "greet" });
const agent = coordinator.createAgent("mock-agent", {}, {
  defaultResponse: {
    status: "OK",
    content: { message: "Hello, World!" },
  },
});
```

### Container API

The `Container` class provides low-level dependency injection:

```typescript
// Factory registration
container.registerSpecFactory(specFactory);
container.registerAgentFactory("agent-name", agentFactory);

// Factory resolution
const specFactory = container.resolveSpecFactory("spec-name");
const agentFactory = container.resolveAgentFactory("agent-name");
const agentFactory = container.resolveAgentFactoryByWorkKind("work-kind");

// Singleton services
container.registerStorage(storage);
container.registerLogger(logger);
const storage = container.resolveStorage();
const logger = container.resolveLogger();

// Configuration
container.setConfig("key", value);
const value = container.getConfig("key");
const allConfig = container.getAllConfig();

// Context creation
const specContext = container.createSpecContext({ custom: "config" });
const agentContext = container.createAgentContext({ apiKey: "key" }, { model: "gpt-4" });
```

### Coordinator API

The `Coordinator` class provides a high-level facade:

```typescript
// Configuration
coordinator.configure({ apiTimeout: 5000 });
const config = coordinator.getConfiguration();

// Spec management
coordinator.registerSpec(specFactory);
const specs = coordinator.listSpecs();
const spec = coordinator.createSpec("spec-name", { custom: "config" });

// Agent management
coordinator.registerAgent("agent-name", agentFactory);
const agents = coordinator.listAgents();
const agent = coordinator.createAgent("agent-name", { apiKey: "key" }, { model: "gpt-4" });
const agentByWork = coordinator.createAgentForWorkKind("work-kind", {}, {});

// Service access
const storage = coordinator.getStorage();
const logger = coordinator.getLogger();
const container = coordinator.getContainer();
```

### ConsoleLogger

Simple console-based logger:

```typescript
const logger = new ConsoleLogger("APP");

logger.debug("Debug message", { meta: "data" });
logger.info("Info message", { meta: "data" });
logger.warn("Warning message", { meta: "data" });
logger.error("Error message", new Error("test"), { meta: "data" });
```

## Design Principles

### Dependency Injection

All components receive their dependencies through constructor injection via contexts:

- **SpecContext**: Provides `storage`, `logger`, and `config` to specs
- **AgentContext**: Provides `storage`, `logger`, `apiKeys`, and `config` to agents

### Factory Pattern

Specs and agents are created through factories, enabling:

- Configuration validation before instantiation
- Versioning and metadata
- Dependency injection at creation time
- Easy testing with mock factories

### Service Locator

The Container acts as a central registry for:

- Spec factories (by name)
- Agent factories (by name and work kind)
- Singleton services (storage, logger)
- Application configuration

### Immutability

Configuration is immutable once passed to instances. Updates to coordinator configuration don't affect already-created instances.

## Testing

The package includes comprehensive test coverage:

```bash
# Run coordinator tests
yarn test packages/coordinator

# Expected output:
# ✓ container.test.ts (25 tests)
# ✓ coordinator.test.ts (18 tests)
# ✓ logger.test.ts (17 tests)
```

## Integration with Other Packages

### With Engine

```typescript
import { Engine } from "@coordinator/engine";

const spec = coordinator.createSpec("hello");
const agent = coordinator.createAgent("mock-agent");

const engine = new Engine(initialState);

// Spec function adapter
const specFunction = (state) => spec.onAgentCompleted(state, lastResponse, context);

// Agent executor adapter
const agentExecutor = async (stepId, step) => {
  const result = await agent.execute(step.kind, step.payload, {
    goalId: state.goalId,
    workflowId: "workflow-1",
    stepId,
    runId: "run-1",
    agentRole: "agent-1",
  });
  // Convert AgentResult to AgentResponse
  return {
    goalId: state.goalId,
    workflowId: "workflow-1",
    stepId,
    runId: "run-1",
    agentRole: "agent-1",
    status: result.status === "OK" ? "COMPLETE" : "FAIL",
    content: result.content,
    errors: result.errors,
  };
};

await engine.runWorkflow(specFunction, agentExecutor);
```

## License

MIT
