import Anthropic from "@anthropic-ai/sdk";
import type {
  IAgent,
  IAgentFactory,
  AgentContext,
  AgentExecutionContext,
  AgentResult,
  AgentDescriptor,
} from "@coordinator/contracts";

const VERSION = "0.1.0";

/**
 * Rate limiting configuration and state
 * Ready for Anthropic SDK integration
 */
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxRequestsPerDay: number;
}

interface RateLimitState {
  requestsThisMinute: number;
  tokensThisMinute: number;
  requestsToday: number;
  windowStart: number;
  dailyWindowStart: number;
}

/**
 * Anthropic-specific payload types
 */
interface ChatPayload {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  _forceRateLimit?: boolean; // Test-only flag
  _forceContextExceeded?: boolean; // Test-only flag
}

interface CompletionPayload {
  prompt: string;
  model?: string;
  max_tokens?: number;
  _forceRateLimit?: boolean; // Test-only flag
  _forceContextExceeded?: boolean; // Test-only flag
}

/**
 * AnthropicAgent - Stub implementation ready for SDK integration
 *
 * This stub provides the complete structure for:
 * - Rate limiting (ready for production limits)
 * - Error handling (all Anthropic error types)
 * - Metrics tracking (tokens, latency, costs)
 * - Provenance tracking
 *
 * When integrating the real Anthropic SDK:
 * 1. Add @anthropic-ai/sdk dependency
 * 2. Replace stub responses with actual API calls
 * 3. Wire up real rate limiting enforcement
 * 4. Add retry logic with exponential backoff
 */
export class AnthropicAgent implements IAgent {
  private rateLimitConfig: RateLimitConfig;
  private rateLimitState: RateLimitState;
  private client: Anthropic;

  constructor(private context: AgentContext) {
    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: context.apiKeys.ANTHROPIC_API_KEY,
    });

    // Default rate limits (align with Anthropic tier)
    this.rateLimitConfig = {
      maxRequestsPerMinute: 50,
      maxTokensPerMinute: 40000,
      maxRequestsPerDay: 1000,
    };

    this.rateLimitState = {
      requestsThisMinute: 0,
      tokensThisMinute: 0,
      requestsToday: 0,
      windowStart: Date.now(),
      dailyWindowStart: Date.now(),
    };

    // Override from config if provided
    if (context.config.rateLimits) {
      this.rateLimitConfig = {
        ...this.rateLimitConfig,
        ...(context.config.rateLimits as Partial<RateLimitConfig>),
      };
    }
  }

  async execute(
    workKind: string,
    payload: unknown,
    context: AgentExecutionContext
  ): Promise<AgentResult> {
    const startTime = Date.now();

    this.context.logger.info("Executing Anthropic agent", {
      workKind,
      runId: context.runId,
      goalId: context.goalId,
    });

    // Validate work kind
    if (!this.isSupported(workKind)) {
      throw new Error(`Unsupported work kind: ${workKind}`);
    }

    // Validate API key
    if (!this.context.apiKeys.ANTHROPIC_API_KEY) {
      return this.createErrorResult("INVALID_REQUEST", "Missing Anthropic API key");
    }

    // Update rate limit state
    this.updateRateLimitState();

    // Check rate limits (stub - ready for real enforcement)
    const rateLimitCheck = this.checkRateLimit();
    if (rateLimitCheck) {
      this.context.logger.warn("Rate limit would be exceeded", rateLimitCheck);
    }

    // Route to appropriate handler
    let result: AgentResult;
    try {
      if (workKind === "anthropic.chat") {
        result = await this.executeChat(payload as ChatPayload, context);
      } else if (workKind === "anthropic.completion") {
        result = await this.executeCompletion(payload as CompletionPayload, context);
      } else {
        throw new Error(`Unsupported work kind: ${workKind}`);
      }
    } catch (error) {
      this.context.logger.error("Execution failed", error as Error);
      return this.createErrorResult(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    const latencyMs = Date.now() - startTime;

    this.context.logger.info("Anthropic agent completed", {
      workKind,
      runId: context.runId,
      status: result.status,
      latencyMs,
    });

    return result;
  }

  private async executeChat(
    payload: ChatPayload,
    context: AgentExecutionContext
  ): Promise<AgentResult> {
    // Validate payload
    if (!payload.messages || !Array.isArray(payload.messages)) {
      return this.createErrorResult("VALIDATION_ERROR", "Invalid payload: missing 'messages' array");
    }

    // Test-only: Force rate limit error
    if (payload._forceRateLimit) {
      return {
        status: "RATE_LIMITED",
        errors: [
          {
            type: "RATE_LIMIT",
            message: "Rate limit exceeded",
            retryable: true,
            retryAfterMs: 60000,
          },
        ],
      };
    }

    // Test-only: Force context exceeded error
    if (payload._forceContextExceeded) {
      return {
        status: "CONTEXT_EXCEEDED",
        errors: [
          {
            type: "CONTEXT_EXCEEDED",
            message: "Context length exceeded",
            retryable: false,
          },
        ],
      };
    }

    const startTime = Date.now();

    try {
      // Real Anthropic API call
      const response = await this.client.messages.create({
        model: (payload.model as string) || (this.context.config.model as string) || "claude-3-5-sonnet-20241022",
        max_tokens: payload.max_tokens || 4096,
        temperature: payload.temperature,
        messages: payload.messages as Anthropic.MessageParam[],
      });

      const latencyMs = Date.now() - startTime;

      // Extract token usage from response
      const tokens = {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
      };

      this.rateLimitState.tokensThisMinute += tokens.prompt + tokens.completion;

      // Extract text content from response
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      return {
        status: "OK",
        content: {
          role: "assistant",
          content: textContent,
          id: response.id,
        },
        metrics: {
          tokens,
          latencyMs,
          costUsd: this.calculateCost(tokens),
          modelName: response.model,
        },
        llmMetadata: {
          modelId: response.model,
          temperature: payload.temperature,
          maxTokens: payload.max_tokens || 4096,
          stopReason: response.stop_reason === 'end_turn' ? 'end_turn' :
                      response.stop_reason === 'max_tokens' ? 'max_tokens' :
                      response.stop_reason === 'stop_sequence' ? 'stop_sequence' : 'end_turn',
        },
        provenance: {
          agentId: "anthropic",
          agentVersion: VERSION,
          executionId: context.runId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      // Handle Anthropic-specific errors
      if (error instanceof Anthropic.APIError) {
        if (error.status === 429) {
          return {
            status: "RATE_LIMITED",
            errors: [{
              type: "RATE_LIMIT",
              message: error.message,
              retryable: true,
              retryAfterMs: 60000,
            }],
          };
        }

        if (error.status === 400 && error.message.includes('context_length')) {
          return {
            status: "CONTEXT_EXCEEDED",
            errors: [{
              type: "CONTEXT_EXCEEDED",
              message: error.message,
              retryable: false,
            }],
          };
        }

        return this.createErrorResult("PROVIDER_ERROR", `Anthropic API error: ${error.message}`);
      }

      throw error;
    }
  }

  private async executeCompletion(
    payload: CompletionPayload,
    context: AgentExecutionContext
  ): Promise<AgentResult> {
    // Validate payload
    if (!payload.prompt) {
      return this.createErrorResult("VALIDATION_ERROR", "Invalid payload: missing 'prompt'");
    }

    // Test-only flags
    if (payload._forceRateLimit) {
      return {
        status: "RATE_LIMITED",
        errors: [
          {
            type: "RATE_LIMIT",
            message: "Rate limit exceeded",
            retryable: true,
            retryAfterMs: 60000,
          },
        ],
      };
    }

    if (payload._forceContextExceeded) {
      return {
        status: "CONTEXT_EXCEEDED",
        errors: [
          {
            type: "CONTEXT_EXCEEDED",
            message: "Context length exceeded",
            retryable: false,
          },
        ],
      };
    }

    // STUB: Return mock response
    const stubTokens = {
      prompt: 30,
      completion: 70,
    };

    this.rateLimitState.tokensThisMinute += stubTokens.prompt + stubTokens.completion;

    return {
      status: "OK",
      content: {
        completion: "[STUB] Mock completion response. SDK integration pending.",
      },
      metrics: {
        tokens: stubTokens,
        latencyMs: 120,
        costUsd: this.calculateCost(stubTokens),
        modelName: (payload.model as string) || "claude-3-5-sonnet-20241022",
      },
      llmMetadata: {
        modelId: (payload.model as string) || "claude-3-5-sonnet-20241022",
        maxTokens: payload.max_tokens || 4096,
        stopReason: "end_turn",
      },
      provenance: {
        agentId: "anthropic",
        agentVersion: VERSION,
        executionId: context.runId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private isSupported(workKind: string): boolean {
    return workKind === "anthropic.chat" || workKind === "anthropic.completion";
  }

  private updateRateLimitState(): void {
    const now = Date.now();
    const minuteInMs = 60 * 1000;
    const dayInMs = 24 * 60 * 60 * 1000;

    // Reset minute window if expired
    if (now - this.rateLimitState.windowStart >= minuteInMs) {
      this.rateLimitState.requestsThisMinute = 0;
      this.rateLimitState.tokensThisMinute = 0;
      this.rateLimitState.windowStart = now;
    }

    // Reset daily window if expired
    if (now - this.rateLimitState.dailyWindowStart >= dayInMs) {
      this.rateLimitState.requestsToday = 0;
      this.rateLimitState.dailyWindowStart = now;
    }

    // Increment request counts
    this.rateLimitState.requestsThisMinute++;
    this.rateLimitState.requestsToday++;

    this.context.logger.debug("Rate limit state updated", {
      requestsThisMinute: this.rateLimitState.requestsThisMinute,
      requestsToday: this.rateLimitState.requestsToday,
    });
  }

  private checkRateLimit(): { exceeded: boolean; reason?: string } | null {
    // STUB: Structure ready for enforcement
    // In production, this would return rate limit errors
    if (this.rateLimitState.requestsThisMinute >= this.rateLimitConfig.maxRequestsPerMinute) {
      return {
        exceeded: true,
        reason: "Requests per minute exceeded",
      };
    }

    if (this.rateLimitState.tokensThisMinute >= this.rateLimitConfig.maxTokensPerMinute) {
      return {
        exceeded: true,
        reason: "Tokens per minute exceeded",
      };
    }

    if (this.rateLimitState.requestsToday >= this.rateLimitConfig.maxRequestsPerDay) {
      return {
        exceeded: true,
        reason: "Daily requests exceeded",
      };
    }

    return null;
  }

  private calculateCost(tokens: { prompt: number; completion: number }): number {
    // STUB: Approximate costs for Claude 3.5 Sonnet
    // Update with actual pricing when SDK is integrated
    const promptCostPer1k = 0.003;
    const completionCostPer1k = 0.015;

    return (
      (tokens.prompt / 1000) * promptCostPer1k +
      (tokens.completion / 1000) * completionCostPer1k
    );
  }

  private createErrorResult(
    errorType: "RATE_LIMIT" | "CONTEXT_EXCEEDED" | "INVALID_REQUEST" | "PROVIDER_ERROR" | "VALIDATION_ERROR" | "TIMEOUT",
    message: string
  ): AgentResult {
    return {
      status: "FAIL",
      errors: [
        {
          type: errorType,
          message,
          retryable: errorType === "RATE_LIMIT" || errorType === "TIMEOUT",
        },
      ],
    };
  }
}

/**
 * Factory for creating AnthropicAgent instances
 */
export class AnthropicAgentFactory implements IAgentFactory {
  readonly supportedWorkKinds = ["anthropic.chat", "anthropic.completion"] as const;

  create(context: AgentContext): IAgent {
    return new AnthropicAgent(context);
  }

  describe(): AgentDescriptor {
    return {
      name: "anthropic",
      version: VERSION,
      description: "Anthropic Claude API integration with real-time execution",
      supportedWorkKinds: [...this.supportedWorkKinds],
      capabilities: {
        streaming: false, // Can be enabled in future versions
        functionCalling: false, // Can be enabled with tool use in future versions
      },
    };
  }
}
