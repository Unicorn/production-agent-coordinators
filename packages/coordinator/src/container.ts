import type {
  ISpecFactory,
  IAgentFactory,
  IStorage,
  ILogger,
  SpecContext,
  AgentContext,
} from "@coordinator/contracts";

/**
 * Dependency Injection Container
 *
 * Central registry for:
 * - Spec factories (by name)
 * - Agent factories (by name and work kind)
 * - Singleton services (storage, logger)
 * - Configuration values
 *
 * Responsibilities:
 * - Factory registration and resolution
 * - Context creation for specs and agents
 * - Configuration management
 */
export class Container {
  // Factory registries
  private specFactories = new Map<string, ISpecFactory>();
  private agentFactories = new Map<string, IAgentFactory>();

  // Singleton services
  private storage: IStorage | undefined;
  private logger: ILogger | undefined;

  // Configuration store
  private config = new Map<string, unknown>();

  /**
   * Register a spec factory by name
   */
  registerSpecFactory(factory: ISpecFactory): void {
    if (this.specFactories.has(factory.name)) {
      throw new Error(`Spec factory "${factory.name}" already registered`);
    }
    this.specFactories.set(factory.name, factory);
  }

  /**
   * Resolve a spec factory by name
   */
  resolveSpecFactory(name: string): ISpecFactory {
    const factory = this.specFactories.get(name);
    if (!factory) {
      throw new Error(`Spec factory "${name}" not registered`);
    }
    return factory;
  }

  /**
   * List all registered spec factories
   */
  listSpecFactories(): Array<{ name: string; version: string }> {
    return Array.from(this.specFactories.values()).map((factory) => ({
      name: factory.name,
      version: factory.version,
    }));
  }

  /**
   * Register an agent factory with a unique name
   */
  registerAgentFactory(name: string, factory: IAgentFactory): void {
    if (this.agentFactories.has(name)) {
      throw new Error(`Agent factory "${name}" already registered`);
    }
    this.agentFactories.set(name, factory);
  }

  /**
   * Resolve an agent factory by name
   */
  resolveAgentFactory(name: string): IAgentFactory {
    const factory = this.agentFactories.get(name);
    if (!factory) {
      throw new Error(`Agent factory "${name}" not registered`);
    }
    return factory;
  }

  /**
   * Resolve an agent factory that supports a specific work kind
   */
  resolveAgentFactoryByWorkKind(workKind: string): IAgentFactory {
    for (const factory of this.agentFactories.values()) {
      if (factory.supportedWorkKinds.includes(workKind)) {
        return factory;
      }
    }
    throw new Error(
      `No agent factory found supporting work kind "${workKind}"`
    );
  }

  /**
   * List all registered agent factories
   */
  listAgentFactories(): Array<{ name: string; factory: IAgentFactory }> {
    return Array.from(this.agentFactories.entries()).map(([name, factory]) => ({
      name,
      factory,
    }));
  }

  /**
   * Register storage singleton
   */
  registerStorage(storage: IStorage): void {
    if (this.storage) {
      throw new Error("Storage already registered");
    }
    this.storage = storage;
  }

  /**
   * Resolve storage singleton
   */
  resolveStorage(): IStorage {
    if (!this.storage) {
      throw new Error("Storage not registered");
    }
    return this.storage;
  }

  /**
   * Register logger singleton
   */
  registerLogger(logger: ILogger): void {
    if (this.logger) {
      throw new Error("Logger already registered");
    }
    this.logger = logger;
  }

  /**
   * Resolve logger singleton
   */
  resolveLogger(): ILogger {
    if (!this.logger) {
      throw new Error("Logger not registered");
    }
    return this.logger;
  }

  /**
   * Set a configuration value
   */
  setConfig(key: string, value: unknown): void {
    this.config.set(key, value);
  }

  /**
   * Get a configuration value
   */
  getConfig(key: string): unknown {
    return this.config.get(key);
  }

  /**
   * Get all configuration as a plain object
   */
  getAllConfig(): Record<string, unknown> {
    return Object.fromEntries(this.config.entries());
  }

  /**
   * Create a SpecContext with registered dependencies
   */
  createSpecContext(config: Record<string, unknown>): SpecContext {
    return {
      storage: this.resolveStorage(),
      logger: this.resolveLogger(),
      config,
    };
  }

  /**
   * Create an AgentContext with registered dependencies
   */
  createAgentContext(
    apiKeys: Record<string, string>,
    config: Record<string, unknown>
  ): AgentContext {
    return {
      storage: this.resolveStorage(),
      logger: this.resolveLogger(),
      apiKeys,
      config,
    };
  }
}
