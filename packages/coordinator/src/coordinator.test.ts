import { describe, it, expect, beforeEach } from "vitest";
import { Coordinator } from "./coordinator";
import { Container } from "./container";
import type {
  ISpecFactory,
  IAgentFactory,
  IStorage,
  ILogger,
  SpecContext,
  AgentContext,
  ISpec,
  IAgent,
  SpecDescriptor,
  AgentDescriptor,
  EngineState,
  AgentResponse,
  EngineDecision,
  SpecExecutionContext,
  AgentExecutionContext,
  AgentResult,
} from "@coordinator/contracts";

// Mock implementations
class TestSpecFactory implements ISpecFactory {
  readonly name = "test-spec";
  readonly version = "1.0.0";
  createCallCount = 0;

  create(_context: SpecContext): ISpec {
    this.createCallCount++;
    return {
      name: this.name,
      onAgentCompleted: (
        state: EngineState,
        _resp: AgentResponse,
        _context: SpecExecutionContext
      ): EngineDecision => ({
        decisionId: `decision-${state.goalId}`,
        actions: [],
        finalize: true,
      }),
    };
  }

  describe(): SpecDescriptor {
    return {
      name: this.name,
      version: this.version,
      description: "Test spec for coordinator tests",
      requiredWorkKinds: ["test-work"],
      configSchema: {},
    };
  }

  validate(): boolean {
    return true;
  }
}

class TestAgentFactory implements IAgentFactory {
  readonly supportedWorkKinds = ["test-work"];
  createCallCount = 0;

  create(_context: AgentContext): IAgent {
    this.createCallCount++;
    return {
      execute: async (
        _workKind: string,
        _payload: unknown,
        _context: AgentExecutionContext
      ): Promise<AgentResult> => ({
        status: "OK",
        content: { message: "test response" },
      }),
    };
  }

  describe(): AgentDescriptor {
    return {
      name: "TestAgent",
      version: "1.0.0",
      description: "Test agent for coordinator tests",
      supportedWorkKinds: this.supportedWorkKinds,
      capabilities: {
        streaming: false,
        functionCalling: false,
      },
    };
  }
}

class TestStorage implements IStorage {
  private store = new Map<string, Buffer>();

  async write(key: string, data: Buffer | string): Promise<string> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    this.store.set(key, buffer);
    return `test://${key}`;
  }

  async read(key: string): Promise<Buffer> {
    const data = this.store.get(key);
    if (!data) throw new Error(`Key not found: ${key}`);
    return data;
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }
}

class TestLogger implements ILogger {
  logs: Array<{ level: string; message: string; meta?: Record<string, unknown> }> = [];

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "debug", message, meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "info", message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "warn", message, meta });
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    this.logs.push({ level: "error", message, meta: { ...meta, error } });
  }
}

describe("Coordinator", () => {
  let container: Container;
  let storage: TestStorage;
  let logger: TestLogger;

  beforeEach(() => {
    container = new Container();
    storage = new TestStorage();
    logger = new TestLogger();

    // Register core services
    container.registerStorage(storage);
    container.registerLogger(logger);
  });

  describe("Construction and Configuration", () => {
    it("should create coordinator with container", () => {
      const coordinator = new Coordinator(container);
      expect(coordinator).toBeInstanceOf(Coordinator);
    });

    it("should create coordinator with default configuration", () => {
      const coordinator = new Coordinator(container);
      const config = coordinator.getConfiguration();
      expect(config).toEqual({});
    });

    it("should create coordinator with custom configuration", () => {
      const config = { apiKey: "test-key", model: "gpt-4" };
      const coordinator = new Coordinator(container, config);
      const retrievedConfig = coordinator.getConfiguration();
      expect(retrievedConfig).toEqual(config);
    });

    it("should update configuration after creation", () => {
      const coordinator = new Coordinator(container);
      coordinator.configure({ newKey: "newValue" });
      const config = coordinator.getConfiguration();
      expect(config.newKey).toBe("newValue");
    });
  });

  describe("Spec Factory Management", () => {
    it("should register spec factory through coordinator", () => {
      const coordinator = new Coordinator(container);
      const specFactory = new TestSpecFactory();

      coordinator.registerSpec(specFactory);
      const factories = coordinator.listSpecs();

      expect(factories).toHaveLength(1);
      expect(factories[0].name).toBe("test-spec");
    });

    it("should create spec instance with proper context", () => {
      const coordinator = new Coordinator(container);
      const specFactory = new TestSpecFactory();
      coordinator.registerSpec(specFactory);

      const specConfig = { timeout: 5000 };
      const spec = coordinator.createSpec("test-spec", specConfig);

      expect(spec).toBeDefined();
      expect(spec.name).toBe("test-spec");
      expect(specFactory.createCallCount).toBe(1);
    });

    it("should throw error when creating spec with unregistered factory", () => {
      const coordinator = new Coordinator(container);

      expect(() => coordinator.createSpec("unknown-spec")).toThrow(
        'Spec factory "unknown-spec" not registered'
      );
    });

    it("should pass configuration to spec context", () => {
      const coordinator = new Coordinator(container);
      const specFactory = new TestSpecFactory();

      // Intercept context creation to verify config
      let capturedContext: SpecContext | undefined;
      const originalCreate = specFactory.create.bind(specFactory);
      specFactory.create = (context: SpecContext) => {
        capturedContext = context;
        return originalCreate(context);
      };

      coordinator.registerSpec(specFactory);
      const specConfig = { timeout: 5000 };
      coordinator.createSpec("test-spec", specConfig);

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.config).toEqual(specConfig);
      expect(capturedContext?.storage).toBe(storage);
      expect(capturedContext?.logger).toBe(logger);
    });
  });

  describe("Agent Factory Management", () => {
    it("should register agent factory through coordinator", () => {
      const coordinator = new Coordinator(container);
      const agentFactory = new TestAgentFactory();

      coordinator.registerAgent("test-agent", agentFactory);
      const factories = coordinator.listAgents();

      expect(factories).toHaveLength(1);
      expect(factories[0].name).toBe("test-agent");
    });

    it("should create agent instance with proper context", () => {
      const coordinator = new Coordinator(container);
      const agentFactory = new TestAgentFactory();
      coordinator.registerAgent("test-agent", agentFactory);

      const agentConfig = { model: "gpt-4" };
      const apiKeys = { openai: "test-key" };
      const agent = coordinator.createAgent("test-agent", apiKeys, agentConfig);

      expect(agent).toBeDefined();
      expect(agentFactory.createCallCount).toBe(1);
    });

    it("should throw error when creating agent with unregistered factory", () => {
      const coordinator = new Coordinator(container);

      expect(() => coordinator.createAgent("unknown-agent", {}, {})).toThrow(
        'Agent factory "unknown-agent" not registered'
      );
    });

    it("should resolve agent by work kind", () => {
      const coordinator = new Coordinator(container);
      const agentFactory = new TestAgentFactory();
      coordinator.registerAgent("test-agent", agentFactory);

      const agent = coordinator.createAgentForWorkKind("test-work", {}, {});
      expect(agent).toBeDefined();
    });

    it("should throw error when no agent supports work kind", () => {
      const coordinator = new Coordinator(container);

      expect(() => coordinator.createAgentForWorkKind("unknown-work", {}, {})).toThrow(
        'No agent factory found supporting work kind "unknown-work"'
      );
    });

    it("should pass configuration to agent context", () => {
      const coordinator = new Coordinator(container);
      const agentFactory = new TestAgentFactory();

      // Intercept context creation to verify config
      let capturedContext: AgentContext | undefined;
      const originalCreate = agentFactory.create.bind(agentFactory);
      agentFactory.create = (context: AgentContext) => {
        capturedContext = context;
        return originalCreate(context);
      };

      coordinator.registerAgent("test-agent", agentFactory);
      const agentConfig = { model: "gpt-4" };
      const apiKeys = { openai: "test-key" };
      coordinator.createAgent("test-agent", apiKeys, agentConfig);

      expect(capturedContext).toBeDefined();
      expect(capturedContext?.config).toEqual(agentConfig);
      expect(capturedContext?.apiKeys).toEqual(apiKeys);
      expect(capturedContext?.storage).toBe(storage);
      expect(capturedContext?.logger).toBe(logger);
    });
  });

  describe("Service Access", () => {
    it("should provide access to storage", () => {
      const coordinator = new Coordinator(container);
      const coordinatorStorage = coordinator.getStorage();
      expect(coordinatorStorage).toBe(storage);
    });

    it("should provide access to logger", () => {
      const coordinator = new Coordinator(container);
      const coordinatorLogger = coordinator.getLogger();
      expect(coordinatorLogger).toBe(logger);
    });
  });

  describe("Full Integration Workflow", () => {
    it("should wire together complete workflow system", async () => {
      // Setup coordinator with all components
      const coordinator = new Coordinator(container, {
        timeout: 10000,
        maxRetries: 3,
      });

      const specFactory = new TestSpecFactory();
      const agentFactory = new TestAgentFactory();

      coordinator.registerSpec(specFactory);
      coordinator.registerAgent("test-agent", agentFactory);

      // Create spec and agent instances
      const spec = coordinator.createSpec("test-spec", { workKind: "test-work" });
      const agent = coordinator.createAgent("test-agent", { openai: "key" }, {});

      // Verify components are created
      expect(spec).toBeDefined();
      expect(agent).toBeDefined();
      expect(specFactory.createCallCount).toBe(1);
      expect(agentFactory.createCallCount).toBe(1);

      // Verify agent can execute work
      const result = await agent.execute("test-work", { input: "test" }, {
        goalId: "goal-1",
        workflowId: "workflow-1",
        stepId: "step-1",
        runId: "run-1",
        agentRole: "test-agent",
      });

      expect(result.status).toBe("OK");
      expect(result.content).toEqual({ message: "test response" });
    });

    it("should support multiple specs and agents", () => {
      const coordinator = new Coordinator(container);

      const specFactory1 = new TestSpecFactory();
      const specFactory2 = { ...new TestSpecFactory(), name: "spec-2" };
      const agentFactory1 = new TestAgentFactory();
      const agentFactory2 = new TestAgentFactory();

      coordinator.registerSpec(specFactory1);
      coordinator.registerSpec(specFactory2 as ISpecFactory);
      coordinator.registerAgent("agent-1", agentFactory1);
      coordinator.registerAgent("agent-2", agentFactory2);

      const specs = coordinator.listSpecs();
      const agents = coordinator.listAgents();

      expect(specs).toHaveLength(2);
      expect(agents).toHaveLength(2);
    });
  });
});
