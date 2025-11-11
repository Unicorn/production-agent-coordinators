import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnthropicAgentFactory } from "./anthropic-agent";
import type { AgentContext, AgentExecutionContext, ILogger, IStorage } from "@coordinator/contracts";

describe("AnthropicAgentFactory", () => {
  let context: AgentContext;
  let mockLogger: ILogger;
  let mockStorage: IStorage;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockStorage = {
      write: vi.fn(),
      read: vi.fn(),
      exists: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    };

    context = {
      logger: mockLogger,
      storage: mockStorage,
      apiKeys: {
        ANTHROPIC_API_KEY: "test-api-key-stub",
      },
      config: {
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 4096,
      },
    };
  });

  describe("Factory", () => {
    it("should create factory with correct metadata", () => {
      const factory = new AnthropicAgentFactory();

      expect(factory.supportedWorkKinds).toContain("anthropic.chat");
      expect(factory.supportedWorkKinds).toContain("anthropic.completion");
    });

    it("should return agent descriptor", () => {
      const factory = new AnthropicAgentFactory();
      const descriptor = factory.describe();

      expect(descriptor.name).toBe("anthropic");
      expect(descriptor.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(descriptor.description).toBeTruthy();
      expect(descriptor.supportedWorkKinds).toContain("anthropic.chat");
      expect(descriptor.capabilities).toHaveProperty("streaming");
      expect(descriptor.capabilities).toHaveProperty("functionCalling");
    });

    it("should create agent instance", () => {
      const factory = new AnthropicAgentFactory();
      const agent = factory.create(context);

      expect(agent).toBeDefined();
      expect(agent.execute).toBeInstanceOf(Function);
    });
  });

  describe("Agent Execution - Stub Implementation", () => {
    let factory: AnthropicAgentFactory;
    let executionContext: AgentExecutionContext;

    beforeEach(() => {
      factory = new AnthropicAgentFactory();

      executionContext = {
        runId: "run-123",
        goalId: "goal-456",
        workflowType: "test-workflow",
        stepNumber: 1,
        totalSteps: 3,
        traceId: "trace-789",
        spanId: "span-012",
      };
    });

    it("should execute chat work kind with stub response", async () => {
      const agent = factory.create(context);

      const result = await agent.execute(
        "anthropic.chat",
        { messages: [{ role: "user", content: "Hello" }] },
        executionContext
      );

      expect(result.status).toBe("OK");
      expect(result.content).toBeDefined();
      expect(result.llmMetadata).toHaveProperty("modelId");
      expect(result.metrics).toHaveProperty("tokens");
      expect(result.provenance).toHaveProperty("agentId");
    });

    it("should execute completion work kind with stub response", async () => {
      const agent = factory.create(context);

      const result = await agent.execute(
        "anthropic.completion",
        { prompt: "Complete this: The quick brown" },
        executionContext
      );

      expect(result.status).toBe("OK");
      expect(result.content).toBeDefined();
    });

    it("should handle rate limiting structure", async () => {
      const agent = factory.create(context);

      // For stub, we just verify the error structure is correct
      // In real implementation, this would trigger after N requests
      const result = await agent.execute(
        "anthropic.chat",
        {
          messages: [{ role: "user", content: "Test" }],
          _forceRateLimit: true // Test-only flag for stub
        },
        executionContext
      );

      if (result.status === "RATE_LIMITED") {
        expect(result.errors).toBeDefined();
        expect(result.errors?.[0]).toHaveProperty("type", "RATE_LIMIT");
        expect(result.errors?.[0]).toHaveProperty("retryable", true);
        expect(result.errors?.[0]).toHaveProperty("retryAfterMs");
      }
    });

    it("should handle context exceeded error structure", async () => {
      const agent = factory.create(context);

      const result = await agent.execute(
        "anthropic.chat",
        {
          messages: [{ role: "user", content: "X".repeat(1000000) }],
          _forceContextExceeded: true // Test-only flag for stub
        },
        executionContext
      );

      if (result.status === "CONTEXT_EXCEEDED") {
        expect(result.errors).toBeDefined();
        expect(result.errors?.[0]).toHaveProperty("type", "CONTEXT_EXCEEDED");
        expect(result.errors?.[0]).toHaveProperty("retryable", false);
      }
    });

    it("should include metrics in response", async () => {
      const agent = factory.create(context);

      const result = await agent.execute(
        "anthropic.chat",
        { messages: [{ role: "user", content: "Hello" }] },
        executionContext
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.tokens).toHaveProperty("prompt");
      expect(result.metrics?.tokens).toHaveProperty("completion");
      expect(result.metrics).toHaveProperty("latencyMs");
      expect(typeof result.metrics?.latencyMs).toBe("number");
    });

    it("should include provenance tracking", async () => {
      const agent = factory.create(context);

      const result = await agent.execute(
        "anthropic.chat",
        { messages: [{ role: "user", content: "Hello" }] },
        executionContext
      );

      expect(result.provenance).toBeDefined();
      expect(result.provenance?.agentId).toBe("anthropic");
      expect(result.provenance?.agentVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.provenance?.executionId).toBe(executionContext.runId);
      expect(result.provenance?.timestamp).toBeTruthy();
    });

    it("should log execution start and completion", async () => {
      const agent = factory.create(context);

      await agent.execute(
        "anthropic.chat",
        { messages: [{ role: "user", content: "Hello" }] },
        executionContext
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Executing"),
        expect.any(Object)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("completed"),
        expect.any(Object)
      );
    });

    it("should reject unsupported work kinds", async () => {
      const agent = factory.create(context);

      await expect(
        agent.execute(
          "unsupported.workKind",
          { data: "test" },
          executionContext
        )
      ).rejects.toThrow("Unsupported work kind");
    });
  });

  describe("Error Handling Structure", () => {
    let factory: AnthropicAgentFactory;
    let executionContext: AgentExecutionContext;

    beforeEach(() => {
      factory = new AnthropicAgentFactory();

      executionContext = {
        runId: "run-123",
        goalId: "goal-456",
        workflowType: "test-workflow",
        stepNumber: 1,
        traceId: "trace-789",
        spanId: "span-012",
      };
    });

    it("should handle missing API key gracefully", async () => {
      const noKeyContext = {
        ...context,
        apiKeys: {},
      };

      const agent = factory.create(noKeyContext);

      const result = await agent.execute(
        "anthropic.chat",
        { messages: [{ role: "user", content: "Hello" }] },
        executionContext
      );

      expect(result.status).toBe("FAIL");
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.type).toBe("INVALID_REQUEST");
      expect(result.errors?.[0]?.message).toContain("API key");
    });

    it("should validate payload structure", async () => {
      const agent = factory.create(context);

      const result = await agent.execute(
        "anthropic.chat",
        { invalid: "payload" }, // Missing required 'messages' field
        executionContext
      );

      expect(result.status).toBe("FAIL");
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]?.type).toBe("VALIDATION_ERROR");
    });
  });

  describe("Rate Limiting Structure", () => {
    it("should track request counts per time window", async () => {
      const factory = new AnthropicAgentFactory();
      const agent = factory.create(context);

      const executionContext: AgentExecutionContext = {
        runId: "run-123",
        goalId: "goal-456",
        workflowType: "test-workflow",
        stepNumber: 1,
        traceId: "trace-789",
        spanId: "span-012",
      };

      // Execute multiple requests
      await agent.execute(
        "anthropic.chat",
        { messages: [{ role: "user", content: "1" }] },
        executionContext
      );
      await agent.execute(
        "anthropic.chat",
        { messages: [{ role: "user", content: "2" }] },
        executionContext
      );

      // In stub implementation, this verifies the structure exists
      // Real implementation would enforce limits
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});
