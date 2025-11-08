import type {
  IAgent,
  IAgentFactory,
  AgentContext,
  AgentExecutionContext,
  AgentResult,
  AgentDescriptor,
} from "@coordinator/contracts";

/**
 * Configuration for MockAgent responses
 */
export interface MockAgentConfig {
  /** Default response to return for any work kind */
  defaultResponse?: AgentResult;
  /** Delay in milliseconds before returning response (for testing async behavior) */
  delayMs?: number;
  /** Map of work kinds to specific responses */
  responseByWorkKind?: Record<string, AgentResult>;
}

/**
 * MockAgent - A deterministic agent implementation for testing
 *
 * This agent does not make any actual LLM calls. It returns pre-configured
 * responses based on the work kind, making it ideal for:
 * - Unit testing specs and coordinators
 * - Integration testing without LLM costs
 * - Deterministic test scenarios
 * - Simulating various agent behaviors (success, failure, rate limits, etc.)
 */
export class MockAgent<TInput = unknown, TOutput = unknown>
  implements IAgent<TInput, TOutput>
{
  private config: MockAgentConfig;

  constructor(config: MockAgentConfig = {}) {
    this.config = {
      defaultResponse: {
        status: "OK",
        content: { message: "Mock agent executed successfully" } as TOutput,
      },
      delayMs: 0,
      responseByWorkKind: {},
      ...config,
    };
  }

  async execute(
    workKind: string,
    _payload: TInput,
    _context: AgentExecutionContext
  ): Promise<AgentResult<TOutput>> {
    // Simulate processing delay if configured
    if (this.config.delayMs && this.config.delayMs > 0) {
      await this.delay(this.config.delayMs);
    }

    // Return work-kind-specific response or fall back to default
    const response =
      this.config.responseByWorkKind?.[workKind] || this.config.defaultResponse;

    // Return a deep copy to prevent mutation
    return this.deepClone(response as AgentResult<TOutput>);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

/**
 * MockAgentFactory - Factory for creating MockAgent instances
 *
 * This factory follows the IAgentFactory interface and creates MockAgent
 * instances with configuration from the AgentContext.
 */
export class MockAgentFactory implements IAgentFactory {
  readonly supportedWorkKinds: readonly string[];
  private version = "0.1.0";

  constructor(supportedWorkKinds: string[] = []) {
    this.supportedWorkKinds = [...supportedWorkKinds];
  }

  create(context: AgentContext): IAgent {
    // Extract MockAgentConfig from context.config if provided
    const mockConfig = context.config as MockAgentConfig | undefined;
    return new MockAgent(mockConfig || {});
  }

  describe(): AgentDescriptor {
    return {
      name: "MockAgent",
      version: this.version,
      description:
        "A mock agent for testing that returns deterministic responses without making LLM calls",
      supportedWorkKinds: [...this.supportedWorkKinds],
      capabilities: {
        streaming: false,
        functionCalling: false,
      },
    };
  }
}
