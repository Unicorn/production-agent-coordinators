import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockAgent, MockAgentFactory, type MockAgentConfig } from "./mock-agent";
import type {
  AgentContext,
  AgentExecutionContext,
  ILogger,
  IStorage,
} from "@coordinator/contracts";

describe("MockAgent", () => {
  let mockLogger: ILogger;
  let mockStorage: IStorage;
  let agentContext: AgentContext;
  let executionContext: AgentExecutionContext;

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

    agentContext = {
      logger: mockLogger,
      storage: mockStorage,
      apiKeys: {},
      config: {},
    };

    executionContext = {
      runId: "test-run-123",
      goalId: "test-goal-456",
      workflowType: "test-workflow",
      stepNumber: 1,
      traceId: "trace-789",
      spanId: "span-abc",
    };
  });

  describe("MockAgent - Basic Functionality", () => {
    it("should return deterministic success response", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "OK",
          content: { message: "Test successful" },
        },
      });

      const result = await agent.execute(
        "test-work",
        { input: "test" },
        executionContext
      );

      expect(result.status).toBe("OK");
      expect(result.content).toEqual({ message: "Test successful" });
    });

    it("should support configurable delays", async () => {
      const delay = 100;
      const agent = new MockAgent({
        delayMs: delay,
        defaultResponse: {
          status: "OK",
          content: { delayed: true },
        },
      });

      const startTime = Date.now();
      const result = await agent.execute(
        "test-work",
        {},
        executionContext
      );
      const elapsed = Date.now() - startTime;

      expect(result.status).toBe("OK");
      expect(elapsed).toBeGreaterThanOrEqual(delay - 10); // Allow small variance
    });

    it("should return different responses based on work kind", async () => {
      const agent = new MockAgent({
        responseByWorkKind: {
          "code-review": {
            status: "OK",
            content: { review: "Looks good" },
          },
          "code-generation": {
            status: "OK",
            content: { code: "console.log('hello')" },
          },
        },
      });

      const reviewResult = await agent.execute(
        "code-review",
        {},
        executionContext
      );
      expect(reviewResult.content).toEqual({ review: "Looks good" });

      const genResult = await agent.execute(
        "code-generation",
        {},
        executionContext
      );
      expect(genResult.content).toEqual({ code: "console.log('hello')" });
    });

    it("should fall back to default response for unknown work kinds", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "OK",
          content: { fallback: true },
        },
        responseByWorkKind: {
          "known-work": {
            status: "OK",
            content: { specific: true },
          },
        },
      });

      const result = await agent.execute(
        "unknown-work",
        {},
        executionContext
      );

      expect(result.content).toEqual({ fallback: true });
    });
  });

  describe("MockAgent - Error Simulation", () => {
    it("should simulate failure status", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "FAIL",
          errors: [
            {
              type: "PROVIDER_ERROR",
              message: "Simulated failure",
              retryable: true,
            },
          ],
        },
      });

      const result = await agent.execute(
        "test-work",
        {},
        executionContext
      );

      expect(result.status).toBe("FAIL");
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].message).toBe("Simulated failure");
    });

    it("should simulate rate limiting", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "RATE_LIMITED",
          errors: [
            {
              type: "RATE_LIMIT",
              message: "Rate limit exceeded",
              retryable: true,
              retryAfterMs: 5000,
            },
          ],
        },
      });

      const result = await agent.execute(
        "test-work",
        {},
        executionContext
      );

      expect(result.status).toBe("RATE_LIMITED");
      expect(result.errors?.[0].type).toBe("RATE_LIMIT");
      expect(result.errors?.[0].retryAfterMs).toBe(5000);
    });

    it("should simulate context exceeded", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "CONTEXT_EXCEEDED",
          errors: [
            {
              type: "CONTEXT_EXCEEDED",
              message: "Input too large",
              retryable: false,
            },
          ],
        },
      });

      const result = await agent.execute(
        "test-work",
        {},
        executionContext
      );

      expect(result.status).toBe("CONTEXT_EXCEEDED");
      expect(result.errors?.[0].retryable).toBe(false);
    });
  });

  describe("MockAgent - Metrics and Metadata", () => {
    it("should include metrics in response", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "OK",
          content: { data: "test" },
          metrics: {
            tokens: {
              prompt: 100,
              completion: 50,
              cached: 10,
            },
            costUsd: 0.001,
            latencyMs: 250,
            modelName: "mock-model-1",
          },
        },
      });

      const result = await agent.execute(
        "test-work",
        {},
        executionContext
      );

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.tokens?.prompt).toBe(100);
      expect(result.metrics?.costUsd).toBe(0.001);
      expect(result.metrics?.latencyMs).toBe(250);
    });

    it("should include LLM metadata", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "OK",
          content: { data: "test" },
          llmMetadata: {
            modelId: "mock-gpt-4",
            temperature: 0.7,
            maxTokens: 1000,
            stopReason: "end_turn",
          },
        },
      });

      const result = await agent.execute(
        "test-work",
        {},
        executionContext
      );

      expect(result.llmMetadata?.modelId).toBe("mock-gpt-4");
      expect(result.llmMetadata?.temperature).toBe(0.7);
      expect(result.llmMetadata?.stopReason).toBe("end_turn");
    });

    it("should include confidence scores", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "OK",
          content: { data: "test" },
          confidence: {
            score: 0.95,
            reasoning: "High confidence based on clear input",
            requiresHumanReview: false,
          },
        },
      });

      const result = await agent.execute(
        "test-work",
        {},
        executionContext
      );

      expect(result.confidence?.score).toBe(0.95);
      expect(result.confidence?.requiresHumanReview).toBe(false);
    });

    it("should include artifacts", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "OK",
          content: { data: "test" },
          artifacts: [
            {
              type: "code",
              url: "s3://bucket/code.ts",
              size: 1024,
              checksum: "abc123",
            },
            {
              type: "diagram",
              ref: "diagram-1",
              meta: { format: "mermaid" },
            },
          ],
        },
      });

      const result = await agent.execute(
        "test-work",
        {},
        executionContext
      );

      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts?.[0].type).toBe("code");
      expect(result.artifacts?.[1].type).toBe("diagram");
    });
  });

  describe("MockAgent - No LLM Calls", () => {
    it("should execute without making any external calls", async () => {
      const agent = new MockAgent({
        defaultResponse: {
          status: "OK",
          content: { test: "data" },
        },
      });

      // No network monitoring needed - just verify it completes quickly
      const startTime = Date.now();
      await agent.execute("test-work", {}, executionContext);
      const elapsed = Date.now() - startTime;

      // Should complete nearly instantly (< 10ms) without delay configured
      expect(elapsed).toBeLessThan(10);
    });

    it("should be deterministic with same config", async () => {
      const config: MockAgentConfig = {
        defaultResponse: {
          status: "OK",
          content: { value: 42 },
        },
      };

      const agent1 = new MockAgent(config);
      const agent2 = new MockAgent(config);

      const result1 = await agent1.execute("test", {}, executionContext);
      const result2 = await agent2.execute("test", {}, executionContext);

      expect(result1).toEqual(result2);
    });
  });

  describe("MockAgentFactory", () => {
    it("should create MockAgent instances", () => {
      const factory = new MockAgentFactory(["code-review", "code-generation"]);
      const agent = factory.create(agentContext);

      expect(agent).toBeInstanceOf(MockAgent);
    });

    it("should expose supported work kinds", () => {
      const workKinds = ["work-a", "work-b", "work-c"];
      const factory = new MockAgentFactory(workKinds);

      expect(factory.supportedWorkKinds).toEqual(workKinds);
    });

    it("should provide agent descriptor", () => {
      const factory = new MockAgentFactory(["test-work"]);
      const descriptor = factory.describe();

      expect(descriptor.name).toBe("MockAgent");
      expect(descriptor.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(descriptor.supportedWorkKinds).toEqual(["test-work"]);
      expect(descriptor.capabilities).toBeDefined();
    });

    it("should pass config to created agent", () => {
      const config: MockAgentConfig = {
        defaultResponse: {
          status: "OK",
          content: { configured: true },
        },
      };

      const contextWithConfig: AgentContext = {
        ...agentContext,
        config,
      };

      const factory = new MockAgentFactory(["test"]);
      const agent = factory.create(contextWithConfig);

      // Agent should use the config from context
      expect(agent).toBeInstanceOf(MockAgent);
    });
  });
});
