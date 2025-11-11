import { describe, it, expect, beforeEach } from "vitest";
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
  AgentExecutionContext,
  AgentResult,
} from "@coordinator/contracts";

// Mock implementations for testing
class MockSpecFactory implements ISpecFactory {
  readonly name = "test-spec";
  readonly version = "1.0.0";

  create(_context: SpecContext): ISpec {
    return {
      name: this.name,
      onAgentCompleted: () => ({ decisionId: "test", actions: [], finalize: false }),
    };
  }

  describe(): SpecDescriptor {
    return {
      name: this.name,
      version: this.version,
      description: "Test spec",
      requiredWorkKinds: [],
      configSchema: {},
    };
  }

  validate(): boolean {
    return true;
  }
}

class MockAgentFactory implements IAgentFactory {
  readonly supportedWorkKinds = ["test-work"];

  create(_context: AgentContext): IAgent {
    return {
      execute: async (
        _workKind: string,
        _payload: unknown,
        _context: AgentExecutionContext
      ): Promise<AgentResult> => ({
        status: "OK",
        content: { message: "test" },
      }),
    };
  }

  describe(): AgentDescriptor {
    return {
      name: "MockAgent",
      version: "1.0.0",
      description: "Test agent",
      supportedWorkKinds: this.supportedWorkKinds,
      capabilities: {
        streaming: false,
        functionCalling: false,
      },
    };
  }
}

class MockStorage implements IStorage {
  async write(): Promise<string> {
    return "mock://file";
  }
  async read(): Promise<Buffer> {
    return Buffer.from("test");
  }
  async exists(): Promise<boolean> {
    return true;
  }
  async delete(): Promise<void> {}
  async list(): Promise<string[]> {
    return [];
  }
}

class MockLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe("Container", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe("Spec Factory Registration and Resolution", () => {
    it("should register and resolve a spec factory", () => {
      const factory = new MockSpecFactory();
      container.registerSpecFactory(factory);

      const resolved = container.resolveSpecFactory("test-spec");
      expect(resolved).toBe(factory);
    });

    it("should throw error when resolving unregistered spec factory", () => {
      expect(() => container.resolveSpecFactory("unknown")).toThrow(
        'Spec factory "unknown" not registered'
      );
    });

    it("should list all registered spec factories", () => {
      const factory1 = new MockSpecFactory();
      const factory2 = { ...new MockSpecFactory(), name: "test-spec-2" };

      container.registerSpecFactory(factory1);
      container.registerSpecFactory(factory2 as ISpecFactory);

      const factories = container.listSpecFactories();
      expect(factories).toHaveLength(2);
      expect(factories.map(f => f.name)).toContain("test-spec");
      expect(factories.map(f => f.name)).toContain("test-spec-2");
    });

    it("should not allow duplicate spec factory registration", () => {
      const factory = new MockSpecFactory();
      container.registerSpecFactory(factory);

      expect(() => container.registerSpecFactory(factory)).toThrow(
        'Spec factory "test-spec" already registered'
      );
    });
  });

  describe("Agent Factory Registration and Resolution", () => {
    it("should register and resolve an agent factory", () => {
      const factory = new MockAgentFactory();
      container.registerAgentFactory("test-agent", factory);

      const resolved = container.resolveAgentFactory("test-agent");
      expect(resolved).toBe(factory);
    });

    it("should throw error when resolving unregistered agent factory", () => {
      expect(() => container.resolveAgentFactory("unknown")).toThrow(
        'Agent factory "unknown" not registered'
      );
    });

    it("should list all registered agent factories", () => {
      const factory1 = new MockAgentFactory();
      const factory2 = new MockAgentFactory();

      container.registerAgentFactory("agent-1", factory1);
      container.registerAgentFactory("agent-2", factory2);

      const factories = container.listAgentFactories();
      expect(factories).toHaveLength(2);
      expect(factories.map(f => f.name)).toContain("agent-1");
      expect(factories.map(f => f.name)).toContain("agent-2");
    });

    it("should not allow duplicate agent factory registration", () => {
      const factory = new MockAgentFactory();
      container.registerAgentFactory("test-agent", factory);

      expect(() => container.registerAgentFactory("test-agent", factory)).toThrow(
        'Agent factory "test-agent" already registered'
      );
    });

    it("should resolve agent factory by work kind", () => {
      const factory = new MockAgentFactory();
      container.registerAgentFactory("test-agent", factory);

      const resolved = container.resolveAgentFactoryByWorkKind("test-work");
      expect(resolved).toBe(factory);
    });

    it("should throw error when no agent supports work kind", () => {
      expect(() => container.resolveAgentFactoryByWorkKind("unknown-work")).toThrow(
        'No agent factory found supporting work kind "unknown-work"'
      );
    });
  });

  describe("Singleton Service Registration", () => {
    it("should register and resolve storage singleton", () => {
      const storage = new MockStorage();
      container.registerStorage(storage);

      const resolved = container.resolveStorage();
      expect(resolved).toBe(storage);
    });

    it("should throw error when storage not registered", () => {
      expect(() => container.resolveStorage()).toThrow("Storage not registered");
    });

    it("should register and resolve logger singleton", () => {
      const logger = new MockLogger();
      container.registerLogger(logger);

      const resolved = container.resolveLogger();
      expect(resolved).toBe(logger);
    });

    it("should throw error when logger not registered", () => {
      expect(() => container.resolveLogger()).toThrow("Logger not registered");
    });

    it("should not allow duplicate storage registration", () => {
      const storage = new MockStorage();
      container.registerStorage(storage);

      expect(() => container.registerStorage(storage)).toThrow(
        "Storage already registered"
      );
    });

    it("should not allow duplicate logger registration", () => {
      const logger = new MockLogger();
      container.registerLogger(logger);

      expect(() => container.registerLogger(logger)).toThrow(
        "Logger already registered"
      );
    });
  });

  describe("Context Creation", () => {
    beforeEach(() => {
      container.registerStorage(new MockStorage());
      container.registerLogger(new MockLogger());
    });

    it("should create spec context with required dependencies", () => {
      const config = { key: "value" };
      const context = container.createSpecContext(config);

      expect(context.storage).toBeInstanceOf(MockStorage);
      expect(context.logger).toBeInstanceOf(MockLogger);
      expect(context.config).toEqual(config);
    });

    it("should create agent context with required dependencies", () => {
      const apiKeys = { openai: "test-key" };
      const config = { model: "gpt-4" };
      const context = container.createAgentContext(apiKeys, config);

      expect(context.storage).toBeInstanceOf(MockStorage);
      expect(context.logger).toBeInstanceOf(MockLogger);
      expect(context.apiKeys).toEqual(apiKeys);
      expect(context.config).toEqual(config);
    });

    it("should throw error creating spec context without storage", () => {
      const newContainer = new Container();
      newContainer.registerLogger(new MockLogger());

      expect(() => newContainer.createSpecContext({})).toThrow("Storage not registered");
    });

    it("should throw error creating spec context without logger", () => {
      const newContainer = new Container();
      newContainer.registerStorage(new MockStorage());

      expect(() => newContainer.createSpecContext({})).toThrow("Logger not registered");
    });
  });

  describe("Configuration Management", () => {
    it("should set and get configuration values", () => {
      container.setConfig("key1", "value1");
      container.setConfig("key2", { nested: "value" });

      expect(container.getConfig("key1")).toBe("value1");
      expect(container.getConfig("key2")).toEqual({ nested: "value" });
    });

    it("should return undefined for non-existent config key", () => {
      expect(container.getConfig("unknown")).toBeUndefined();
    });

    it("should return all configuration", () => {
      container.setConfig("key1", "value1");
      container.setConfig("key2", "value2");

      const allConfig = container.getAllConfig();
      expect(allConfig).toEqual({
        key1: "value1",
        key2: "value2",
      });
    });

    it("should overwrite existing configuration values", () => {
      container.setConfig("key", "original");
      container.setConfig("key", "updated");

      expect(container.getConfig("key")).toBe("updated");
    });
  });

  describe("Full Integration", () => {
    it("should wire together all components", () => {
      // Register all components
      const storage = new MockStorage();
      const logger = new MockLogger();
      const specFactory = new MockSpecFactory();
      const agentFactory = new MockAgentFactory();

      container.registerStorage(storage);
      container.registerLogger(logger);
      container.registerSpecFactory(specFactory);
      container.registerAgentFactory("test-agent", agentFactory);
      container.setConfig("test", "config");

      // Verify all components are wired
      expect(container.resolveStorage()).toBe(storage);
      expect(container.resolveLogger()).toBe(logger);
      expect(container.resolveSpecFactory("test-spec")).toBe(specFactory);
      expect(container.resolveAgentFactory("test-agent")).toBe(agentFactory);
      expect(container.getConfig("test")).toBe("config");

      // Verify contexts can be created
      const specContext = container.createSpecContext({});
      expect(specContext.storage).toBe(storage);
      expect(specContext.logger).toBe(logger);

      const agentContext = container.createAgentContext({}, {});
      expect(agentContext.storage).toBe(storage);
      expect(agentContext.logger).toBe(logger);
    });
  });
});
