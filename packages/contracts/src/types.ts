// Core workflow state types
export interface EngineState {
  goalId: string;
  status: "RUNNING" | "AWAITING_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED";
  openSteps: Record<string, StepState>;
  artifacts: Record<string, unknown>;
  log: Array<{ at: number; event: string; data: unknown }>;
}

export interface StepState {
  kind: string;
  status: "WAITING" | "IN_PROGRESS" | "DONE" | "FAILED" | "BLOCKED";
  requestedAt: number;
  updatedAt: number;
  payload?: unknown;
}

// Engine decision types
export type EngineAction =
  | { type: "REQUEST_WORK"; workKind: string; payload?: unknown; stepId?: string }
  | { type: "REQUEST_APPROVAL"; payload?: unknown; stepId?: string }
  | { type: "ANNOTATE"; key: string; value: unknown };

export interface EngineDecision {
  decisionId: string;
  basedOn?: { stepId?: string; runId?: string };
  actions: EngineAction[];
  finalize?: boolean;
}

// Agent response types (enhanced with AI Engineer feedback)
export interface AgentResponse {
  goalId: string;
  workflowId: string;
  stepId: string;
  runId: string;
  agentRole: string;
  status: "OK" | "PARTIAL" | "FAIL" | "RATE_LIMITED" | "CONTEXT_EXCEEDED";
  content?: unknown;
  artifacts?: Array<{
    type: string;
    url?: string;
    ref?: string;
    meta?: unknown;
    size?: number;
    checksum?: string;
  }>;
  metrics?: {
    tokens?: {
      prompt: number;
      completion: number;
      cached?: number;
    };
    costUsd?: number;
    latencyMs?: number;
    modelName?: string;
  };
  llmMetadata?: {
    modelId: string;
    temperature?: number;
    maxTokens?: number;
    stopReason?: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  };
  confidence?: {
    score?: number;
    reasoning?: string;
    requiresHumanReview?: boolean;
  };
  errors?: Array<{
    type: "RATE_LIMIT" | "CONTEXT_EXCEEDED" | "INVALID_REQUEST" |
          "PROVIDER_ERROR" | "VALIDATION_ERROR" | "TIMEOUT";
    message: string;
    retryable: boolean;
    retryAfterMs?: number;
    details?: unknown;
  }>;
  provenance?: {
    agentId: string;
    agentVersion: string;
    executionId: string;
    timestamp: string;
  };
}

// Agent result type (what agents return)
export interface AgentResult<T = unknown> {
  status: "OK" | "PARTIAL" | "FAIL" | "RATE_LIMITED" | "CONTEXT_EXCEEDED";
  content?: T;
  artifacts?: AgentResponse["artifacts"];
  metrics?: AgentResponse["metrics"];
  llmMetadata?: AgentResponse["llmMetadata"];
  confidence?: AgentResponse["confidence"];
  errors?: AgentResponse["errors"];
  provenance?: AgentResponse["provenance"];
}

// Agent execution context (AI Engineer enhancement)
export interface AgentExecutionContext {
  runId: string;
  goalId: string;
  workflowType: string;
  stepNumber: number;
  totalSteps?: number;
  previousSteps?: Array<{
    workKind: string;
    status: string;
    summary?: string;
  }>;
  annotations?: Record<string, unknown>;
  constraints?: {
    maxTokens?: number;
    maxCostUsd?: number;
    timeoutMs?: number;
    modelPreference?: string;
  };
  traceId: string;
  spanId: string;
  cacheContext?: {
    systemPromptHash?: string;
    conversationId?: string;
  };
}

// Spec execution context (deterministic)
export interface SpecExecutionContext {
  readonly now: number;
  readonly random: () => number;
}

// Descriptor types for UI/database integration
export interface SpecDescriptor {
  name: string;
  version: string;
  description: string;
  requiredWorkKinds: string[];
  configSchema: Record<string, unknown>;
}

export interface AgentDescriptor {
  name: string;
  version: string;
  description: string;
  supportedWorkKinds: string[];
  capabilities: {
    streaming?: boolean;
    functionCalling?: boolean;
  };
}
