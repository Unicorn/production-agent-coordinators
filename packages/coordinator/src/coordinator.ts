import type {
  ISpecFactory,
  IAgentFactory,
  ISpec,
  IAgent,
  IStorage,
  ILogger,
} from "@coordinator/contracts";
import { Container } from "./container.js";

/**
 * Coordinator - High-level orchestration layer
 *
 * Responsibilities:
 * - Provides simplified API for wiring components together
 * - Manages application-level configuration
 * - Creates spec and agent instances with proper dependencies
 * - Delegates factory registration and resolution to Container
 *
 * This class provides a facade over the Container, offering:
 * - Intuitive configuration management
 * - Simplified component registration
 * - Convenient instance creation with dependency injection
 */
export class Coordinator {
  private configuration: Record<string, unknown>;

  constructor(
    private readonly container: Container,
    configuration: Record<string, unknown> = {}
  ) {
    this.configuration = { ...configuration };
  }

  /**
   * Get current configuration
   */
  getConfiguration(): Record<string, unknown> {
    return { ...this.configuration };
  }

  /**
   * Update configuration (merges with existing)
   */
  configure(config: Record<string, unknown>): void {
    this.configuration = { ...this.configuration, ...config };
    // Update container config as well
    for (const [key, value] of Object.entries(config)) {
      this.container.setConfig(key, value);
    }
  }

  /**
   * Register a spec factory
   */
  registerSpec(factory: ISpecFactory): void {
    this.container.registerSpecFactory(factory);
  }

  /**
   * List all registered spec factories
   */
  listSpecs(): Array<{ name: string; version: string }> {
    return this.container.listSpecFactories();
  }

  /**
   * Create a spec instance with configuration
   */
  createSpec(name: string, config: Record<string, unknown> = {}): ISpec {
    const factory = this.container.resolveSpecFactory(name);
    const context = this.container.createSpecContext(config);
    return factory.create(context);
  }

  /**
   * Register an agent factory with a unique name
   */
  registerAgent(name: string, factory: IAgentFactory): void {
    this.container.registerAgentFactory(name, factory);
  }

  /**
   * List all registered agent factories
   */
  listAgents(): Array<{ name: string; factory: IAgentFactory }> {
    return this.container.listAgentFactories();
  }

  /**
   * Create an agent instance with configuration
   */
  createAgent(
    name: string,
    apiKeys: Record<string, string> = {},
    config: Record<string, unknown> = {}
  ): IAgent {
    const factory = this.container.resolveAgentFactory(name);
    const context = this.container.createAgentContext(apiKeys, config);
    return factory.create(context);
  }

  /**
   * Create an agent instance that supports a specific work kind
   */
  createAgentForWorkKind(
    workKind: string,
    apiKeys: Record<string, string> = {},
    config: Record<string, unknown> = {}
  ): IAgent {
    const factory = this.container.resolveAgentFactoryByWorkKind(workKind);
    const context = this.container.createAgentContext(apiKeys, config);
    return factory.create(context);
  }

  /**
   * Get storage service
   */
  getStorage(): IStorage {
    return this.container.resolveStorage();
  }

  /**
   * Get logger service
   */
  getLogger(): ILogger {
    return this.container.resolveLogger();
  }

  /**
   * Get the underlying container (for advanced use cases)
   */
  getContainer(): Container {
    return this.container;
  }
}
