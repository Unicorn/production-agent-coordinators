import type {
  EngineState,
  AgentResponse,
  EngineDecision,
  AgentResult,
  AgentExecutionContext,
  SpecExecutionContext,
  SpecDescriptor,
  AgentDescriptor,
} from "./types";

// Storage interface
export interface IStorage {
  write(key: string, data: Buffer | string): Promise<string>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

// Logger interface
export interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
}

// Spec context and interfaces
export interface SpecContext {
  readonly logger: ILogger;
  readonly storage: IStorage;
  readonly config: Record<string, unknown>;
}

export interface ISpec {
  readonly name: string;

  onAgentCompleted(
    state: EngineState,
    resp: AgentResponse,
    context: SpecExecutionContext
  ): EngineDecision;

  onAgentError?(
    state: EngineState,
    workKind: string,
    error: unknown,
    attemptNumber: number
  ): EngineDecision;

  onCustomEvent?(
    state: EngineState,
    eventType: string,
    payload: unknown
  ): EngineDecision | void;

  postApply?(state: EngineState): void;
}

export interface ISpecFactory {
  readonly name: string;
  readonly version: string;

  create(context: SpecContext): ISpec;
  describe(): SpecDescriptor;
  validate?(config: unknown): boolean;
}

// Agent context and interfaces
export interface AgentContext {
  readonly logger: ILogger;
  readonly storage: IStorage;
  readonly apiKeys: Record<string, string>;
  readonly config: Record<string, unknown>;
}

export interface IAgent<TInput = unknown, TOutput = unknown> {
  execute(
    workKind: string,
    payload: TInput,
    context: AgentExecutionContext
  ): Promise<AgentResult<TOutput>>;
}

export interface IAgentFactory<TInput = unknown, TOutput = unknown> {
  readonly supportedWorkKinds: readonly string[];

  create(context: AgentContext): IAgent<TInput, TOutput>;
  describe(): AgentDescriptor;
}
