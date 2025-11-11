# Coordinator Package Architecture

**Package:** `@coordinator/coordinator`
**Location:** `/Users/mattbernier/projects/coordinator/packages/coordinator/`
**Dependencies:** `@coordinator/contracts`, `@coordinator/engine`
**Status:** Core Package - Stable API

## Purpose

The Coordinator package implements dependency injection and high-level orchestration for the agent-coordinator system. It provides the Container (service locator), Coordinator (factory orchestrator), and infrastructure implementations (logger).

## Design Philosophy

### WHY Dependency Injection

Dependency injection provides:

1. **Testability:** Easy to mock dependencies for unit tests
2. **Modularity:** Swap implementations without changing consuming code
3. **Configuration:** Centralized configuration management
4. **Lifecycle Management:** Control when and how components are created

### WHY Factory Pattern

Factory pattern enables:

1. **Late Binding:** Decide which implementation to use at runtime
2. **Configuration Validation:** Validate config before creating instances
3. **Metadata Access:** Query capabilities without instantiation
4. **Dynamic Loading:** Future support for plugin-based specs/agents

## Architecture

### File Structure

```
packages/coordinator/src/
├── container.ts           # Service locator and registry
├── coordinator.ts         # High-level orchestration API
├── logger.ts             # Logger implementations
├── index.ts              # Public exports
├── container.test.ts     # Container tests
├── coordinator.test.ts   # Coordinator tests
└── logger.test.ts        # Logger tests
```

### Core Components

#### 1. Container (Service Locator)

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/container.ts:24-198`

**RESPONSIBILITIES:**
- Register and resolve spec factories
- Register and resolve agent factories
- Manage singleton services (storage, logger)
- Store configuration values
- Create contexts for specs and agents

**KEY METHODS:**

```typescript
class Container {
  // Spec factory management
  registerSpecFactory(factory: ISpecFactory): void
  resolveSpecFactory(name: string): ISpecFactory
  listSpecFactories(): Array<{ name: string; version: string }>

  // Agent factory management
  registerAgentFactory(name: string, factory: IAgentFactory): void
  resolveAgentFactory(name: string): IAgentFactory
  resolveAgentFactoryByWorkKind(workKind: string): IAgentFactory
  listAgentFactories(): Array<{ name: string; factory: IAgentFactory }>

  // Service management
  registerStorage(storage: IStorage): void
  resolveStorage(): IStorage
  registerLogger(logger: ILogger): void
  resolveLogger(): ILogger

  // Configuration
  setConfig(key: string, value: unknown): void
  getConfig(key: string): unknown
  getAllConfig(): Record<string, unknown>

  // Context creation
  createSpecContext(config: Record<string, unknown>): SpecContext
  createAgentContext(apiKeys: Record<string, string>, config: Record<string, unknown>): AgentContext
}
```

#### 2. Coordinator (Orchestration)

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/coordinator.ts`

**RESPONSIBILITIES:**
- Provide high-level API over Container
- Simplify spec and agent registration
- Create spec and agent instances with injected dependencies

**KEY METHODS:**

```typescript
class Coordinator {
  constructor(container: Container)

  // Factory registration
  registerSpec(factory: ISpecFactory): void
  registerAgent(name: string, factory: IAgentFactory): void

  // Instance creation
  createSpec(name: string, config: Record<string, unknown>): ISpec
  createAgent(
    name: string,
    apiKeys: Record<string, string>,
    config: Record<string, unknown>
  ): IAgent

  // Introspection
  listSpecs(): Array<{ name: string; version: string }>
  listAgents(): Array<{ name: string; factory: IAgentFactory }>
}
```

#### 3. ConsoleLogger (Implementation)

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/logger.ts`

**RESPONSIBILITIES:**
- Implement ILogger interface
- Provide structured console logging
- Support log levels (debug, info, warn, error)

## Dependency Injection

### Service Registration

Services are registered as singletons:

```typescript
const container = new Container();

// Register storage (singleton)
container.registerStorage(new LocalFileStorage('./output'));

// Register logger (singleton)
container.registerLogger(new ConsoleLogger('APP'));
```

**LOCATION:** Example usage in CLI and E2E tests

**WHY SINGLETON:**
- Storage: Shared file system access, consistent base directory
- Logger: Shared output stream, consistent formatting

### Factory Registration

Factories are registered by name:

```typescript
const coordinator = new Coordinator(container);

// Register spec factory
coordinator.registerSpec(new HelloSpecFactory());

// Register agent factory with name
coordinator.registerAgent('mock', new MockAgentFactory(['HELLO']));
coordinator.registerAgent('anthropic', new AnthropicAgentFactory());
```

**LOCATION:** Example usage in CLI

**WHY BY NAME:**
- Multiple implementations of same interface
- Runtime selection based on configuration
- Future plugin loading by name

### Instance Creation

Factories create instances with injected contexts:

```typescript
// Create spec with config
const spec = coordinator.createSpec('hello', {
  workKind: 'HELLO',
  greeting: 'Hello, World!'
});

// Create agent with API keys and config
const agent = coordinator.createAgent('anthropic', {
  ANTHROPIC_API_KEY: 'sk-ant-...'
}, {
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4096
});
```

**INTERNAL FLOW:**

```
1. coordinator.createSpec('hello', config)
   │
   ├─> container.resolveSpecFactory('hello')
   │   └─> Returns HelloSpecFactory
   │
   ├─> container.createSpecContext(config)
   │   └─> Returns { storage, logger, config }
   │
   ├─> factory.create(context)
   │   └─> Returns HelloSpec instance
   │
   └─> Return spec
```

## Context Objects

### SpecContext

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`

```typescript
interface SpecContext {
  storage: IStorage;                   // Artifact storage
  logger: ILogger;                     // Logging service
  config: Record<string, unknown>;     // Spec-specific configuration
}
```

**CREATED BY:** `Container.createSpecContext()`

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/container.ts:176-182`

**USAGE IN SPEC:**

```typescript
class HelloSpec implements ISpec {
  constructor(private context: SpecContext) {}

  async onSomeEvent() {
    // Access injected dependencies
    await this.context.storage.write('output.txt', 'Hello!');
    this.context.logger.info('Written greeting');

    // Access configuration
    const workKind = this.context.config.workKind as string;
  }
}
```

### AgentContext

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`

```typescript
interface AgentContext {
  storage: IStorage;                     // Artifact storage
  logger: ILogger;                       // Logging service
  apiKeys: Record<string, string>;       // API credentials (never logged)
  config: Record<string, unknown>;       // Agent-specific configuration
}
```

**CREATED BY:** `Container.createAgentContext()`

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/container.ts:187-197`

**USAGE IN AGENT:**

```typescript
class AnthropicAgent implements IAgent {
  constructor(private context: AgentContext) {}

  async execute(workKind: string, payload: unknown) {
    // Access API keys
    const apiKey = this.context.apiKeys['ANTHROPIC_API_KEY'];

    // Access configuration
    const model = this.context.config.model as string ?? 'claude-3-5-sonnet-20241022';
    const maxTokens = this.context.config.maxTokens as number ?? 4096;

    // Use storage for artifacts
    const outputPath = await this.context.storage.write('result.json', JSON.stringify(result));

    // Log activity
    this.context.logger.info('Agent completed', { workKind, outputPath });
  }
}
```

## Factory Pattern Implementation

### ISpecFactory Interface

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`

```typescript
interface ISpecFactory {
  readonly name: string;
  readonly version: string;

  create(context: SpecContext): ISpec;
  describe(): SpecDescriptor;
}
```

**EXAMPLE IMPLEMENTATION:**

```typescript
export class HelloSpecFactory implements ISpecFactory {
  readonly name = 'hello';
  readonly version = '1.0.0';

  create(context: SpecContext): ISpec {
    return new HelloSpec(context);
  }

  describe(): SpecDescriptor {
    return {
      name: this.name,
      version: this.version,
      description: 'Simple greeting workflow',
      requiredWorkKinds: ['HELLO'],
      configSchema: {
        workKind: { type: 'string', required: true },
        greeting: { type: 'string', required: false },
      },
    };
  }
}
```

**LOCATION:** Example from `packages/specs/hello/src/hello-spec.ts`

### IAgentFactory Interface

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`

```typescript
interface IAgentFactory {
  readonly supportedWorkKinds: string[];

  create(context: AgentContext): IAgent;
  describe(): AgentDescriptor;
}
```

**EXAMPLE IMPLEMENTATION:**

```typescript
export class MockAgentFactory implements IAgentFactory {
  readonly supportedWorkKinds: string[];

  constructor(workKinds: string[]) {
    this.supportedWorkKinds = workKinds;
  }

  create(context: AgentContext): IAgent {
    return new MockAgent(context, this.supportedWorkKinds);
  }

  describe(): AgentDescriptor {
    return {
      name: 'mock-agent',
      version: '1.0.0',
      description: 'Deterministic mock agent for testing',
      supportedWorkKinds: this.supportedWorkKinds,
      capabilities: {
        streaming: false,
        functionCalling: false,
      },
    };
  }
}
```

**LOCATION:** Example from `packages/agents/mock/src/mock-agent.ts`

## Container Registry Implementation

### Spec Factory Registry

**DATA STRUCTURE:**

```typescript
private specFactories = new Map<string, ISpecFactory>();
```

**REGISTRATION:**

```typescript
registerSpecFactory(factory: ISpecFactory): void {
  if (this.specFactories.has(factory.name)) {
    throw new Error(`Spec factory "${factory.name}" already registered`);
  }
  this.specFactories.set(factory.name, factory);
}
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/container.ts:39-44`

**WHY MAP:**
- O(1) lookup by name
- Prevents duplicate registrations
- Easy to list all registered factories

### Agent Factory Registry

**DATA STRUCTURE:**

```typescript
private agentFactories = new Map<string, IAgentFactory>();
```

**REGISTRATION:**

```typescript
registerAgentFactory(name: string, factory: IAgentFactory): void {
  if (this.agentFactories.has(name)) {
    throw new Error(`Agent factory "${name}" already registered`);
  }
  this.agentFactories.set(name, factory);
}
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/container.ts:70-75`

**WORK KIND RESOLUTION:**

```typescript
resolveAgentFactoryByWorkKind(workKind: string): IAgentFactory {
  for (const factory of this.agentFactories.values()) {
    if (factory.supportedWorkKinds.includes(workKind)) {
      return factory;
    }
  }
  throw new Error(`No agent factory found supporting work kind "${workKind}"`);
}
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/container.ts:91-100`

**WHY ITERATION:**
- Agents support multiple work kinds
- First match wins (allows priority ordering)
- Future: implement priority/ranking system

## Configuration Management

### Configuration Storage

**DATA STRUCTURE:**

```typescript
private config = new Map<string, unknown>();
```

**OPERATIONS:**

```typescript
setConfig(key: string, value: unknown): void {
  this.config.set(key, value);
}

getConfig(key: string): unknown {
  return this.config.get(key);
}

getAllConfig(): Record<string, unknown> {
  return Object.fromEntries(this.config.entries());
}
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/container.ts:155-171`

**USAGE PATTERN:**

```typescript
// Set global configuration
container.setConfig('environment', 'production');
container.setConfig('maxConcurrentAgents', 5);

// Retrieve in factory
const env = container.getConfig('environment');
```

**FUTURE:** Type-safe configuration with validation schema

## Logger Implementation

### ConsoleLogger

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/logger.ts`

**IMPLEMENTATION:**

```typescript
export class ConsoleLogger implements ILogger {
  constructor(private prefix: string) {}

  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(`[${this.prefix}] DEBUG: ${message}`, meta || '');
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(`[${this.prefix}] INFO: ${message}`, meta || '');
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[${this.prefix}] WARN: ${message}`, meta || '');
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[${this.prefix}] ERROR: ${message}`, meta || '');
  }
}
```

**FEATURES:**
- Prefix for component identification
- Structured metadata support
- Standard log levels (debug, info, warn, error)

**FUTURE ENHANCEMENTS:**
- JSON structured logging
- Log level filtering
- OpenTelemetry integration
- File/stream output

## Error Handling

### Registration Errors

**Duplicate Registration:**

```typescript
registerSpecFactory(factory: ISpecFactory): void {
  if (this.specFactories.has(factory.name)) {
    throw new Error(`Spec factory "${factory.name}" already registered`);
  }
  // ...
}
```

**WHY THROW:**
- Prevents silent overwrites
- Detects configuration errors early
- Forces explicit handling

### Resolution Errors

**Not Found:**

```typescript
resolveSpecFactory(name: string): ISpecFactory {
  const factory = this.specFactories.get(name);
  if (!factory) {
    throw new Error(`Spec factory "${name}" not registered`);
  }
  return factory;
}
```

**WHY THROW:**
- Fail fast on misconfiguration
- Clear error messages
- Prevents null reference errors

### Missing Services

**Unregistered Service:**

```typescript
resolveStorage(): IStorage {
  if (!this.storage) {
    throw new Error("Storage not registered");
  }
  return this.storage;
}
```

**WHY THROW:**
- Enforces required dependencies
- Detects setup errors early
- Provides actionable error message

## Testing Strategy

### Unit Tests

Test Container in isolation:

```typescript
describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it('should register and resolve spec factory', () => {
    const factory = new HelloSpecFactory();
    container.registerSpecFactory(factory);

    const resolved = container.resolveSpecFactory('hello');
    expect(resolved).toBe(factory);
  });

  it('should throw on duplicate spec registration', () => {
    const factory = new HelloSpecFactory();
    container.registerSpecFactory(factory);

    expect(() => container.registerSpecFactory(factory)).toThrow();
  });
});
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/container.test.ts`

### Integration Tests

Test Coordinator with real factories:

```typescript
describe('Coordinator', () => {
  it('should create spec with injected dependencies', () => {
    const container = new Container();
    container.registerStorage(new LocalFileStorage('./test-output'));
    container.registerLogger(new ConsoleLogger('TEST'));

    const coordinator = new Coordinator(container);
    coordinator.registerSpec(new HelloSpecFactory());

    const spec = coordinator.createSpec('hello', { workKind: 'HELLO' });

    expect(spec).toBeDefined();
    expect(spec.name).toBe('hello');
  });
});
```

**LOCATION:** `/Users/mattbernier/projects/coordinator/packages/coordinator/src/coordinator.test.ts`

## Future Enhancements

### Plugin Loading

**FUTURE:** Dynamic loading of spec/agent packages

```typescript
async loadPlugin(packageName: string): Promise<void> {
  const module = await import(packageName);

  if (module.specFactory) {
    this.registerSpecFactory(module.specFactory);
  }

  if (module.agentFactory) {
    this.registerAgentFactory(module.agentFactory.name, module.agentFactory);
  }
}
```

### Configuration Validation

**FUTURE:** JSON Schema validation for configuration

```typescript
setConfig(key: string, value: unknown, schema?: JSONSchema): void {
  if (schema) {
    validate(value, schema);  // Throws on validation error
  }
  this.config.set(key, value);
}
```

### Factory Metadata

**FUTURE:** Enhanced factory introspection

```typescript
listSpecs(): Array<SpecDescriptor & { installed: boolean; enabled: boolean }> {
  return Array.from(this.specFactories.values()).map(factory => ({
    ...factory.describe(),
    installed: true,
    enabled: this.isEnabled(factory.name),
  }));
}
```

## Related Documentation

- [Overview](./overview.md) - System architecture
- [Engine](./engine.md) - Workflow execution
- [Specs](./specs.md) - Specification interface
- [Agents](./agents.md) - Agent interface
- [API: Coordinator API](../api/coordinator-api.md) - Public API reference
- [Development: Setup](../development/setup.md) - Development environment

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-09 | Internal Docs Agent | Initial creation |
