# Agent Coordinator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a general-purpose AI agent coordination platform on Temporal workflows with TypeScript strict mode, supporting pluggable specs and agents via dependency injection.

**Architecture:** Monorepo with packages (contracts, engine, coordinator, specs, agents, storage, cli). Generic EngineWorkflow orchestrates multi-agent workflows using pluggable Specs for decision logic. Coordinator polls workflows and dispatches to agents with DI pattern. Deterministic workflow execution with WorkflowDate.now() and continueAsNew.

**Tech Stack:** TypeScript 5.6+, Temporal 1.23+, Node.js 18+, Yarn workspaces, Anthropic SDK, Vitest, Docker Compose

**Module System:** ESM (ES Modules) throughout - all packages use `"type": "module"`, `"module": "ESNext"` in tsconfig, and `import.meta.url` for module detection. This matches Phase1.md and ensures compatibility with Temporal's workflow bundler.

---

## Task 1: Initialize Monorepo Structure

**Files:**
- Create: `/Users/mattbernier/projects/coordinator/package.json`
- Create: `/Users/mattbernier/projects/coordinator/tsconfig.base.json`
- Create: `/Users/mattbernier/projects/coordinator/tsconfig.json`
- Create: `/Users/mattbernier/projects/coordinator/.gitignore`
- Create: `/Users/mattbernier/projects/coordinator/.env.example`

**Step 1: Create root package.json with workspaces**

```json
{
  "name": "agent-coordinator-monorepo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/contracts",
    "packages/engine",
    "packages/coordinator",
    "packages/specs/*",
    "packages/agents/*",
    "packages/storage",
    "packages/cli"
  ],
  "scripts": {
    "build": "tsc -b",
    "build:watch": "tsc -b --watch",
    "clean": "yarn workspaces run clean && rm -rf node_modules",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint packages --ext .ts",
    "typecheck": "tsc -b --noEmit",
    "infra:up": "docker compose -f docker/docker-compose.yml up -d",
    "infra:down": "docker compose -f docker/docker-compose.yml down",
    "infra:logs": "docker compose -f docker/docker-compose.yml logs -f"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.57.0",
    "typescript": "^5.6.3",
    "vitest": "^1.6.0",
    "@vitest/ui": "^1.6.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "yarn": ">=1.22.0"
  }
}
```

**Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

**Step 3: Create root tsconfig.json with project references**

```json
{
  "files": [],
  "references": [
    { "path": "./packages/contracts" },
    { "path": "./packages/engine" },
    { "path": "./packages/coordinator" },
    { "path": "./packages/specs/hello" },
    { "path": "./packages/specs/todo" },
    { "path": "./packages/agents/mock" },
    { "path": "./packages/agents/anthropic" },
    { "path": "./packages/storage" },
    { "path": "./packages/cli" }
  ]
}
```

**Step 4: Create .gitignore**

```
# Dependencies
node_modules/

# Build outputs
dist/
*.tsbuildinfo

# Environment
.env
.env.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Test coverage
coverage/

# Output
out/

# Temporal
.temporal/
```

**Step 5: Create .env.example**

```
# Temporal Configuration
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=engine

# AI Provider Configuration
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
ANTHROPIC_MAX_TOKENS=4096

# Storage Configuration
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./out

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Coordinator Configuration
COORDINATOR_POLL_INTERVAL_MS=5000
COORDINATOR_MAX_CONCURRENT_AGENTS=5
COORDINATOR_RETRY_ATTEMPTS=3

# Budget Constraints
MAX_COST_PER_WORKFLOW_USD=5.00
MAX_TOKENS_PER_WORKFLOW=100000

# Development
NODE_ENV=development
```

**Step 6: Initialize Git repository**

Run:
```bash
cd /Users/mattbernier/projects/coordinator
git init
git add package.json tsconfig.base.json tsconfig.json .gitignore .env.example
git commit -m "chore: initialize monorepo structure

- Yarn workspaces for packages
- TypeScript strict mode configuration
- Git ignore for build artifacts
- Environment variable template"
```

Expected: Git repository initialized with initial commit

---

## Task 2: Create Contracts Package (Pure Types)

**Files:**
- Create: `/Users/mattbernier/projects/coordinator/packages/contracts/package.json`
- Create: `/Users/mattbernier/projects/coordinator/packages/contracts/tsconfig.json`
- Create: `/Users/mattbernier/projects/coordinator/packages/contracts/src/types.ts`
- Create: `/Users/mattbernier/projects/coordinator/packages/contracts/src/interfaces.ts`
- Create: `/Users/mattbernier/projects/coordinator/packages/contracts/src/index.ts`

**Step 1: Create contracts package.json**

```json
{
  "name": "@coordinator/contracts",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist tsconfig.tsbuildinfo"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
```

**Step 2: Create contracts tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Write types.ts with core types**

```typescript
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
```

**Step 4: Write interfaces.ts with factory interfaces**

```typescript
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

export interface ISpec<TPayload = unknown, TResult = unknown> {
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

export interface ISpecFactory<TPayload = unknown, TResult = unknown> {
  readonly name: string;
  readonly version: string;

  create(context: SpecContext): ISpec<TPayload, TResult>;
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
```

**Step 5: Create index.ts barrel export**

```typescript
// Re-export all types and interfaces
export * from "./types";
export * from "./interfaces";
```

**Step 6: Build contracts package**

Run:
```bash
cd /Users/mattbernier/projects/coordinator
yarn install
yarn workspace @coordinator/contracts build
```

Expected: TypeScript compilation succeeds, dist/ directory created

**Step 7: Commit contracts package**

Run:
```bash
git add packages/contracts
git commit -m "feat(contracts): add core types and interfaces

- Pure types package with zero dependencies
- Enhanced AgentResult with LLM-specific metadata
- AgentExecutionContext with previous steps and annotations
- SpecExecutionContext for deterministic workflow logic
- Storage and Logger interfaces for dependency injection"
```

---

## Task 3: Create Storage Package

**Files:**
- Create: `/Users/mattbernier/projects/coordinator/packages/storage/package.json`
- Create: `/Users/mattbernier/projects/coordinator/packages/storage/tsconfig.json`
- Create: `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts`
- Create: `/Users/mattbernier/projects/coordinator/packages/storage/src/index.ts`
- Create: `/Users/mattbernier/projects/coordinator/packages/storage/src/local.test.ts`

**Step 1: Write failing test for LocalFileStorage**

Create: `/Users/mattbernier/projects/coordinator/packages/storage/src/local.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { LocalFileStorage } from "./local";

describe("LocalFileStorage", () => {
  const testDir = path.join(__dirname, "../test-storage");
  let storage: LocalFileStorage;

  beforeEach(async () => {
    storage = new LocalFileStorage(testDir);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should write and read data", async () => {
    const key = "test/file.txt";
    const data = "Hello, World!";

    const url = await storage.write(key, data);
    const readData = await storage.read(key);

    expect(url).toContain("file://");
    expect(readData.toString()).toBe(data);
  });

  it("should check if file exists", async () => {
    const key = "test/exists.txt";

    const beforeWrite = await storage.exists(key);
    await storage.write(key, "data");
    const afterWrite = await storage.exists(key);

    expect(beforeWrite).toBe(false);
    expect(afterWrite).toBe(true);
  });

  it("should list files with prefix", async () => {
    await storage.write("workflows/wf1/file1.txt", "data1");
    await storage.write("workflows/wf1/file2.txt", "data2");
    await storage.write("workflows/wf2/file3.txt", "data3");

    const files = await storage.list("workflows/wf1");

    expect(files).toHaveLength(2);
    expect(files).toContain("workflows/wf1/file1.txt");
    expect(files).toContain("workflows/wf1/file2.txt");
  });

  it("should prevent directory traversal attacks", async () => {
    const maliciousKey = "../../../etc/passwd";

    await storage.write(maliciousKey, "hacker");

    // Should write inside base directory, not escape it
    const files = await fs.readdir(testDir, { recursive: true });
    expect(files.some((f: string) => f.includes("etc"))).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
yarn workspace @coordinator/storage test
```

Expected: FAIL - LocalFileStorage not defined

**Step 3: Create storage package.json**

```json
{
  "name": "@coordinator/storage",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist tsconfig.tsbuildinfo",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@coordinator/contracts": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "typescript": "^5.6.3",
    "vitest": "^1.6.0"
  }
}
```

**Step 4: Create storage tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../contracts" }
  ]
}
```

**Step 5: Implement LocalFileStorage**

Create: `/Users/mattbernier/projects/coordinator/packages/storage/src/local.ts`

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { IStorage } from "@coordinator/contracts";

export class LocalFileStorage implements IStorage {
  constructor(private baseDir: string) {}

  async write(key: string, data: Buffer | string): Promise<string> {
    const filePath = this.resolvePath(key);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, data, "utf8");

    return `file://${filePath}`;
  }

  async read(key: string): Promise<Buffer> {
    const filePath = this.resolvePath(key);
    return await fs.readFile(filePath);
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await fs.unlink(filePath);
  }

  async list(prefix: string): Promise<string[]> {
    const dirPath = this.resolvePath(prefix);

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(prefix, entry.name));
    } catch {
      return [];
    }
  }

  private resolvePath(key: string): string {
    // Prevent directory traversal attacks
    const normalized = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    return path.join(this.baseDir, normalized);
  }
}
```

**Step 6: Create index.ts barrel export**

Create: `/Users/mattbernier/projects/coordinator/packages/storage/src/index.ts`

```typescript
export * from "./local";
```

**Step 7: Run tests to verify they pass**

Run:
```bash
yarn workspace @coordinator/storage build
yarn workspace @coordinator/storage test
```

Expected: All tests PASS

**Step 8: Commit storage package**

Run:
```bash
git add packages/storage
git commit -m "feat(storage): add LocalFileStorage implementation

- IStorage interface implementation for local filesystem
- Path normalization to prevent directory traversal
- Comprehensive test coverage
- Returns file:// URLs for consistency with future S3 storage"
```

---

## Task 4: Create Engine Package with Deterministic Workflow

**Files:**
- Create: `/Users/mattbernier/projects/coordinator/packages/engine/package.json`
- Create: `/Users/mattbernier/projects/coordinator/packages/engine/tsconfig.json`
- Create: `/Users/mattbernier/projects/coordinator/packages/engine/src/workflow.ts`
- Create: `/Users/mattbernier/projects/coordinator/packages/engine/src/worker.ts`
- Create: `/Users/mattbernier/projects/coordinator/packages/engine/src/index.ts`
- Create: `/Users/mattbernier/projects/coordinator/packages/engine/src/workflow.test.ts`

**Step 1: Create engine package.json**

```json
{
  "name": "@coordinator/engine",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist tsconfig.tsbuildinfo",
    "start:worker": "node dist/worker.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@coordinator/contracts": "workspace:*",
    "@temporalio/client": "^1.10.0",
    "@temporalio/worker": "^1.10.0",
    "@temporalio/workflow": "^1.10.0"
  },
  "devDependencies": {
    "@temporalio/testing": "^1.10.0",
    "@types/node": "^22.7.5",
    "typescript": "^5.6.3",
    "vitest": "^1.6.0"
  }
}
```

**Step 2: Create engine tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../contracts" }
  ]
}
```

**Step 3: Implement deterministic EngineWorkflow**

Create: `/Users/mattbernier/projects/coordinator/packages/engine/src/workflow.ts`

```typescript
import {
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  uuid4,
  upsertSearchAttributes,
  continueAsNew,
  Date as WorkflowDate,
} from "@temporalio/workflow";
import type {
  AgentResponse,
  EngineDecision,
  EngineState,
  StepState,
} from "@coordinator/contracts";

// Signals
export const agentCompleted = defineSignal<[string, AgentResponse]>("agentCompleted");
export const applyDecision = defineSignal<[EngineDecision]>("applyDecision");
export const approve = defineSignal<[string]>("approve");
export const cancel = defineSignal<[string]>("cancel");
export const custom = defineSignal<[string, unknown]>("custom");

// Queries
export const currentState = defineQuery<EngineState>("currentState");

export interface EngineArgs {
  goalId: string;
  specName: string;
  specVersion: string;
  specConfig: unknown;
  bootDecision?: EngineDecision;
  maxEventsBeforeContinue?: number;
}

export async function EngineWorkflow(args: EngineArgs): Promise<void> {
  const MAX_EVENTS = args.maxEventsBeforeContinue ?? 1000;

  const state: EngineState = {
    goalId: args.goalId,
    status: "RUNNING",
    openSteps: {},
    artifacts: {},
    log: [],
  };

  // Deterministic PRNG for specs
  let seed = 12345;
  const deterministicRandom = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  setHandler(currentState, () => state);

  const upsert = (stepId: string, mut: Partial<StepState>) => {
    const now = WorkflowDate.now();
    const prev = state.openSteps[stepId] ?? ({
      kind: "unknown",
      status: "WAITING",
      requestedAt: now,
      updatedAt: now,
    } as StepState);

    state.openSteps[stepId] = {
      ...prev,
      ...mut,
      updatedAt: now,
      requestedAt: prev.requestedAt ?? now,
    };
  };

  const apply = (decision: EngineDecision) => {
    state.log.push({
      at: WorkflowDate.now(),
      event: "APPLY_DECISION",
      data: decision,
    });

    for (const action of decision.actions) {
      if (action.type === "REQUEST_WORK") {
        const id = action.stepId ?? `${action.workKind}-${uuid4()}`;
        state.openSteps[id] = {
          kind: action.workKind,
          status: "WAITING",
          requestedAt: WorkflowDate.now(),
          updatedAt: WorkflowDate.now(),
          payload: action.payload,
        };
      } else if (action.type === "REQUEST_APPROVAL") {
        const id = action.stepId ?? `approval-${uuid4()}`;
        state.openSteps[id] = {
          kind: "APPROVAL",
          status: "WAITING",
          requestedAt: WorkflowDate.now(),
          updatedAt: WorkflowDate.now(),
          payload: action.payload,
        };
        state.status = "AWAITING_APPROVAL";
      } else if (action.type === "ANNOTATE") {
        state.artifacts[action.key] = action.value;
      }
    }

    if (decision.finalize) {
      state.status = "COMPLETED";
      state.log.push({
        at: WorkflowDate.now(),
        event: "FINALIZED",
        data: {},
      });
    }
  };

  setHandler(applyDecision, (decision) => apply(decision));

  setHandler(agentCompleted, (stepId, resp) => {
    state.log.push({
      at: WorkflowDate.now(),
      event: "AGENT_COMPLETED",
      data: { stepId, resp },
    });

    upsert(stepId, {
      status:
        resp.status === "OK"
          ? "DONE"
          : resp.status === "FAIL"
            ? "FAILED"
            : "IN_PROGRESS",
    });

    resp.artifacts?.forEach((artifact) => {
      const key = `${artifact.type}:${artifact.ref ?? uuid4()}`;
      state.artifacts[key] = artifact;
    });
  });

  setHandler(custom, (eventType, payload) => {
    state.log.push({
      at: WorkflowDate.now(),
      event: "CUSTOM_EVENT",
      data: { eventType, payload },
    });
  });

  setHandler(approve, (stepId) => {
    if (state.openSteps[stepId]) {
      state.openSteps[stepId].status = "DONE";
      if (state.status === "AWAITING_APPROVAL") {
        state.status = "RUNNING";
      }
    }
  });

  setHandler(cancel, (reason) => {
    state.status = "CANCELLED";
    state.log.push({
      at: WorkflowDate.now(),
      event: "CANCELLED",
      data: { reason },
    });
  });

  upsertSearchAttributes({
    Keyword: { goalId: state.goalId },
    KeywordList: { spec: [args.specName] },
  });

  if (args.bootDecision) {
    apply(args.bootDecision);
  }

  while (true) {
    // Check if we need continueAsNew to prevent unbounded history
    if (state.log.length >= MAX_EVENTS) {
      await continueAsNew<typeof EngineWorkflow>({
        ...args,
        bootDecision: {
          decisionId: `continue-${WorkflowDate.now()}`,
          actions: [
            {
              type: "ANNOTATE",
              key: "_continuedFrom",
              value: state.log.length,
            },
          ],
        },
      });
    }

    await condition(() => false, "7 days");
  }
}
```

**Step 4: Implement Temporal worker**

Create: `/Users/mattbernier/projects/coordinator/packages/engine/src/worker.ts`

```typescript
import { Worker } from "@temporalio/worker";
import * as path from "node:path";

export async function run() {
  const workflowsPath = new URL("./workflow.js", import.meta.url).pathname;

  const worker = await Worker.create({
    workflowsPath,
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || "engine",
  });

  console.log("[engine] Worker started on task queue:", process.env.TEMPORAL_TASK_QUEUE || "engine");

  await worker.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error("[engine] Worker failed:", err);
    process.exit(1);
  });
}
```

**Step 5: Create index.ts barrel export**

Create: `/Users/mattbernier/projects/coordinator/packages/engine/src/index.ts`

```typescript
export * from "./workflow";
export * from "./worker";
```

**Step 6: Write integration test with TestWorkflowEnvironment**

Create: `/Users/mattbernier/projects/coordinator/packages/engine/src/workflow.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { EngineWorkflow, agentCompleted, applyDecision } from "./workflow";
import type { EngineState, AgentResponse, EngineDecision } from "@coordinator/contracts";

describe("EngineWorkflow", () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  it("should initialize with RUNNING status", async () => {
    const { client } = testEnv;

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: "test",
      workflowsPath: require.resolve("./workflow"),
    });

    await worker.runUntil(async () => {
      const handle = await client.workflow.start(EngineWorkflow, {
        workflowId: "test-init",
        taskQueue: "test",
        args: [{
          goalId: "goal-test",
          specName: "test-spec",
          specVersion: "1.0.0",
          specConfig: {},
        }],
      });

      const state = await handle.query<EngineState>("currentState");

      expect(state.goalId).toBe("goal-test");
      expect(state.status).toBe("RUNNING");
      expect(state.openSteps).toEqual({});
    });
  });

  it("should apply boot decision", async () => {
    const { client } = testEnv;

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: "test",
      workflowsPath: require.resolve("./workflow"),
    });

    await worker.runUntil(async () => {
      const bootDecision: EngineDecision = {
        decisionId: "boot",
        actions: [
          {
            type: "REQUEST_WORK",
            workKind: "TEST_WORK",
            payload: { test: true },
            stepId: "step-1",
          },
        ],
      };

      const handle = await client.workflow.start(EngineWorkflow, {
        workflowId: "test-boot",
        taskQueue: "test",
        args: [{
          goalId: "goal-test",
          specName: "test-spec",
          specVersion: "1.0.0",
          specConfig: {},
          bootDecision,
        }],
      });

      const state = await handle.query<EngineState>("currentState");

      expect(state.openSteps["step-1"]).toBeDefined();
      expect(state.openSteps["step-1"].kind).toBe("TEST_WORK");
      expect(state.openSteps["step-1"].status).toBe("WAITING");
    });
  });

  it("should handle agent completion and finalization", async () => {
    const { client } = testEnv;

    const worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue: "test",
      workflowsPath: require.resolve("./workflow"),
    });

    await worker.runUntil(async () => {
      const bootDecision: EngineDecision = {
        decisionId: "boot",
        actions: [
          { type: "REQUEST_WORK", workKind: "HELLO", stepId: "HELLO-1" },
        ],
      };

      const handle = await client.workflow.start(EngineWorkflow, {
        workflowId: "test-complete",
        taskQueue: "test",
        args: [{
          goalId: "goal-hello",
          specName: "hello",
          specVersion: "1.0.0",
          specConfig: {},
          bootDecision,
        }],
      });

      // Verify initial state
      let state = await handle.query<EngineState>("currentState");
      expect(state.openSteps["HELLO-1"].status).toBe("WAITING");

      // Signal agent completion
      const response: AgentResponse = {
        goalId: "goal-hello",
        workflowId: "test-complete",
        stepId: "HELLO-1",
        runId: "run-1",
        agentRole: "hello-agent",
        status: "OK",
        content: { message: "Hello" },
      };

      await handle.signal(agentCompleted, "HELLO-1", response);

      // Verify step marked as DONE
      state = await handle.query<EngineState>("currentState");
      expect(state.openSteps["HELLO-1"].status).toBe("DONE");

      // Apply finalization decision
      const finalDecision: EngineDecision = {
        decisionId: "final",
        actions: [],
        finalize: true,
      };

      await handle.signal(applyDecision, finalDecision);

      // Verify workflow finalized
      state = await handle.query<EngineState>("currentState");
      expect(state.status).toBe("COMPLETED");
    });
  });
});
```

**Step 7: Build and test engine package**

Run:
```bash
yarn workspace @coordinator/engine build
yarn workspace @coordinator/engine test
```

Expected: All tests PASS

**Step 8: Commit engine package**

Run:
```bash
git add packages/engine
git commit -m "feat(engine): add deterministic EngineWorkflow

- Generic workflow with signals/queries
- Deterministic timestamps with WorkflowDate.now()
- Deterministic PRNG for specs
- continueAsNew to prevent unbounded history
- Comprehensive integration tests with TestWorkflowEnvironment"
```

---

_[Continue with remaining tasks in next message due to length...]_

Would you like me to continue with the remaining tasks (Coordinator, Specs, Agents, CLI, Infrastructure)?
