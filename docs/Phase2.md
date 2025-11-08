Only do this after Phase 1


# File: package.json (root)
{
  "name": "agent-coordinator-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "yarn workspaces run build",
    "dev:worker": "yarn workspace engine start:worker",
    "dev:coord": "yarn workspace coordinator start",
    "dev:hello": "yarn workspace cli start:hello",
    "state": "yarn workspace cli state"
  }
}

# File: .gitignore
node_modules
.dist
*.log
.env
out/

# File: .env.example
ANTHROPIC_API_KEY=sk-ant-...
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default

# File: docker/temporal/docker-compose.yml
version: '3.8'
services:
  temporal:
    image: temporalio/auto-setup:1.23
    ports:
      - "7233:7233"
    environment:
      - DB=sqlite
      - DEFAULT_NAMESPACE=default
    healthcheck:
      test: ["CMD", "temporal", "--address", "127.0.0.1:7233", "operator", "search-attribute", "list"]
      interval: 5s
      timeout: 3s
      retries: 30

# File: packages/engine/package.json
{
  "name": "engine",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "scripts": {
    "build": "tsc -b",
    "start:worker": "ts-node --esm src/worker.ts"
  },
  "dependencies": {
    "@temporalio/client": "^1.10.0",
    "@temporalio/worker": "^1.10.0",
    "@temporalio/workflow": "^1.10.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.6.3",
    "@types/node": "^22.7.5"
  }
}

# File: packages/engine/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "target": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "Node",
    "types": ["node"],
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}

# File: tsconfig.base.json (root)
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}

# File: packages/engine/src/shared/contracts.ts
export type AgentResponse = {
  goalId: string;
  workflowId: string;
  stepId: string;
  runId: string;
  agentRole: string;
  status: "OK" | "PARTIAL" | "FAIL";
  content?: any;
  artifacts?: Array<{ type: string; url?: string; ref?: string; meta?: any }>;
  metrics?: { tokens?: { prompt: number; completion: number }; costUsd?: number };
  errors?: any;
};

export type EngineAction =
  | { type: "REQUEST_WORK"; workKind: string; payload?: any; stepId?: string }
  | { type: "REQUEST_APPROVAL"; payload?: any; stepId?: string }
  | { type: "ANNOTATE"; key: string; value: any };

export type EngineDecision = {
  decisionId: string;
  basedOn?: { stepId?: string; runId?: string };
  actions: EngineAction[];
  finalize?: boolean;
};

export type StepState = {
  kind: string;
  status: "WAITING" | "IN_PROGRESS" | "DONE" | "FAILED" | "BLOCKED";
  requestedAt: number;
  updatedAt: number;
  payload?: any;
};

export type EngineState = {
  goalId: string;
  status: "RUNNING" | "AWAITING_APPROVAL" | "COMPLETED" | "FAILED" | "CANCELLED";
  openSteps: Record<string, StepState>;
  artifacts: Record<string, any>;
  log: Array<{ at: number; event: string; data: any }>;
};

# File: packages/engine/src/engine/spec.ts
import type { AgentResponse, EngineDecision, EngineState } from "../shared/contracts";

export interface EngineSpec {
  name: string;
  onAgentCompleted(state: EngineState, resp: AgentResponse): EngineDecision;
  onCustomEvent?(state: EngineState, eventType: string, payload: any): EngineDecision | void;
  postApply?(state: EngineState): void;
}

# File: packages/engine/src/engine/workflow.ts
import {
  defineSignal,
  defineQuery,
  setHandler,
  condition,
  uuid4,
  upsertSearchAttributes,
} from "@temporalio/workflow";
import type { AgentResponse, EngineDecision, EngineState, StepState } from "../shared/contracts";
import type { EngineSpec } from "./spec";

const agentCompleted = defineSignal<[string, AgentResponse]>("agentCompleted");
const applyDecision = defineSignal<[EngineDecision]>("applyDecision");
const approve = defineSignal<[string]>("approve");
const cancel = defineSignal<[string]>("cancel");
const custom = defineSignal<[string, any]>("custom");

const currentState = defineQuery<EngineState>("currentState");

// Minimal in-workflow registry (kept static for determinism)
const SPECS: Record<string, EngineSpec> = {};
export function __registerSpec(spec: EngineSpec) {
  // This function is evaluated inside workflow code at start-up time only.
  // In practice, ensure specs are imported by the worker so they're bundled deterministically.
  SPECS[spec.name] = spec;
}

export type EngineArgs = { goalId: string; specName: string; bootDecision?: EngineDecision };

export async function EngineWorkflow(args: EngineArgs): Promise<void> {
  const spec = SPECS[args.specName];
  if (!spec) throw new Error(`Unknown spec: ${args.specName}`);

  const state: EngineState = {
    goalId: args.goalId,
    status: "RUNNING",
    openSteps: {},
    artifacts: {},
    log: [],
  };

  setHandler(currentState, () => state);

  const upsert = (stepId: string, mut: Partial<StepState>) => {
    const now = Date.now();
    const prev =
      state.openSteps[stepId] ?? ({ kind: "unknown", status: "WAITING", requestedAt: now, updatedAt: now } as StepState);
    state.openSteps[stepId] = { ...prev, ...mut, updatedAt: now, requestedAt: prev.requestedAt ?? now };
  };

  const apply = (decision: EngineDecision) => {
    state.log.push({ at: Date.now(), event: "APPLY_DECISION", data: decision });
    for (const a of decision.actions) {
      if (a.type === "REQUEST_WORK") {
        const id = a.stepId ?? `${a.workKind}-${uuid4()}`;
        state.openSteps[id] = {
          kind: a.workKind,
          status: "WAITING",
          requestedAt: Date.now(),
          updatedAt: Date.now(),
          payload: a.payload,
        };
      } else if (a.type === "REQUEST_APPROVAL") {
        const id = a.stepId ?? `approval-${uuid4()}`;
        state.openSteps[id] = { kind: "APPROVAL", status: "WAITING", requestedAt: Date.now(), updatedAt: Date.now(), payload: a.payload };
        state.status = "AWAITING_APPROVAL";
      } else if (a.type === "ANNOTATE") {
        state.artifacts[a.key] = a.value;
      }
    }
    if (decision.finalize) {
      state.status = "COMPLETED";
      state.log.push({ at: Date.now(), event: "FINALIZED", data: {} });
    }
    spec.postApply?.(state);
  };

  setHandler(applyDecision, (decision) => apply(decision));

  setHandler(agentCompleted, (stepId, resp) => {
    state.log.push({ at: Date.now(), event: "AGENT_COMPLETED", data: { stepId, resp } });
    upsert(stepId, { status: resp.status === "OK" ? "DONE" : resp.status === "FAIL" ? "FAILED" : "IN_PROGRESS" });
    resp.artifacts?.forEach((a) => (state.artifacts[`${a.type}:${a.ref ?? uuid4()}`] = a));
    const decision = spec.onAgentCompleted(state, resp);
    apply(decision);
  });

  setHandler(custom, (eventType, payload) => {
    const dec = spec.onCustomEvent?.(state, eventType, payload);
    if (dec) apply(dec);
  });

  setHandler(approve, (stepId) => {
    if (state.openSteps[stepId]) {
      state.openSteps[stepId].status = "DONE";
      if (state.status === "AWAITING_APPROVAL") state.status = "RUNNING";
    }
  });

  setHandler(cancel, (reason) => {
    state.status = "CANCELLED";
    state.log.push({ at: Date.now(), event: "CANCELLED", data: { reason } });
  });

  upsertSearchAttributes({ Keyword: { goalId: state.goalId }, KeywordList: { spec: [args.specName] } });

  if (args.bootDecision) apply(args.bootDecision);

  while (true) {
    await condition(() => false, "7 days");
  }
}

# File: packages/engine/src/worker.ts
import { Worker } from "@temporalio/worker";
import * as path from "node:path";

export async function run() {
  const workflowsPath = path.join(__dirname, "./");
  const worker = await Worker.create({
    workflowsPath,
    taskQueue: "engine",
  });
  await worker.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

# File: packages/specs/hello/package.json
{
  "name": "specs-hello",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "scripts": {
    "build": "tsc -b"
  },
  "dependencies": {
    "@temporalio/workflow": "^1.10.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.7.5"
  }
}

# File: packages/specs/hello/tsconfig.json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "target": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "Node",
    "types": ["node"],
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}

# File: packages/specs/hello/src/hello.spec.ts
import type { EngineSpec } from "../../../engine/src/engine/spec";
import type { EngineState, AgentResponse, EngineDecision } from "../../../engine/src/shared/contracts";
import { __registerSpec } from "../../../engine/src/engine/workflow";

export const HelloSpec: EngineSpec = {
  name: "hello",
  onAgentCompleted(state: EngineState, resp: AgentResponse): EngineDecision {
    // After any HELLO step returns OK, finalize
    const finalize = resp.status === "OK";
    return {
      decisionId: `dec-${Date.now()}`,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions: [],
      finalize,
    };
  },
};

// Register at import-time so the workflow sees it deterministically
__registerSpec(HelloSpec);

# File: packages/coordinator/package.json
{
  "name": "coordinator",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -b",
    "start": "ts-node --esm src/server.ts"
  },
  "dependencies": {
    "@temporalio/client": "^1.10.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.6.3",
    "@types/node": "^22.7.5"
  }
}

# File: packages/coordinator/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "target": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "Node",
    "types": ["node"],
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}

# File: packages/coordinator/src/server.ts
import { Connection, Client } from "@temporalio/client";
import * as dotenv from "dotenv";
dotenv.config();

// Minimal dispatcher for Phase 1: finds WAITING steps and immediately returns a HELLO response

async function main() {
  const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || "localhost:7233" });
  const client = new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE || "default" });

  const workflowId = process.env.WORKFLOW_ID || "hello-1";
  const handle = client.workflow.getHandle(workflowId);

  const state: any = await handle.query("currentState");
  const waiting = Object.entries(state.openSteps).filter(([, s]: any) => s.status === "WAITING");

  for (const [stepId, s] of waiting) {
    if (s.kind !== "HELLO") continue;
    // Fake agent response
    const resp = {
      goalId: state.goalId,
      workflowId,
      stepId,
      runId: `${Date.now()}`,
      agentRole: "hello-agent",
      status: "OK",
      content: { message: "Hello from agent" },
    };
    await handle.signal("agentCompleted", stepId, resp);
    console.log(`[coord] signaled agentCompleted for ${stepId}`);
  }

  console.log(`[coord] dispatch complete for ${workflowId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

# File: packages/cli/package.json
{
  "name": "cli",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -b",
    "start:hello": "ts-node --esm src/start-hello.ts",
    "state": "ts-node --esm src/state.ts"
  },
  "dependencies": {
    "@temporalio/client": "^1.10.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.6.3",
    "@types/node": "^22.7.5"
  }
}

# File: packages/cli/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "target": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "Node",
    "types": ["node"],
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}

# File: packages/cli/src/start-hello.ts
import { Connection, Client } from "@temporalio/client";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || "localhost:7233" });
  const client = new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE || "default" });

  const { EngineWorkflow } = await import("../../engine/src/engine/workflow");
  await import("../../specs/hello/src/hello.spec"); // registers the spec

  const workflowId = process.env.WORKFLOW_ID || "hello-1";

  const bootDecision = {
    decisionId: "boot",
    actions: [
      { type: "REQUEST_WORK", workKind: "HELLO", payload: { prompt: "Say hello" }, stepId: "HELLO-1" },
    ],
  } as any;

  const handle = await client.workflow.start(EngineWorkflow, {
    workflowId,
    taskQueue: "engine",
    args: [{ goalId: "goal-hello", specName: "hello", bootDecision }],
  });

  console.log(`[cli] started hello workflow ${workflowId} (runId ${await handle.firstExecutionRunId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

# File: packages/cli/src/state.ts
import { Connection, Client } from "@temporalio/client";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || "localhost:7233" });
  const client = new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE || "default" });
  const workflowId = process.env.WORKFLOW_ID || process.argv[2] || "hello-1";
  const handle = client.workflow.getHandle(workflowId);
  const state = await handle.query("currentState");
  console.log(JSON.stringify(state, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

# ===== Phase 2: Todo App Generator Spec & Wiring =====

# File: packages/specs/todo/package.json
{
  "name": "specs-todo",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "scripts": {
    "build": "tsc -b"
  },
  "dependencies": {
    "@temporalio/workflow": "^1.10.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.7.5"
  }
}

# File: packages/specs/todo/tsconfig.json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "ESNext",
    "target": "ES2020",
    "lib": ["ES2020"],
    "moduleResolution": "Node",
    "types": ["node"],
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}

# File: packages/specs/todo/src/todo.spec.ts
import type { EngineSpec } from "../../../engine/src/engine/spec";
import type { EngineState, AgentResponse, EngineDecision } from "../../../engine/src/shared/contracts";
import { __registerSpec } from "../../../engine/src/engine/workflow";
import { randomUUID as uuid } from "crypto";

/**
 * Work kinds used by the Todo generator
 * - REQUIREMENTS_TODO: draft a brief spec for a simple Todo app
 * - GENERATE_TODO_APP: produce a minimal app skeleton (files map)
 * - WRITE_README: write a README tailored to the scaffold
 * - BASIC_TESTS: generate 1–2 simple tests
 * - PR_REVIEW (optional): quick pass over the code
 */

const K = {
  REQ: "REQUIREMENTS_TODO",
  GEN: "GENERATE_TODO_APP",
  DOC: "WRITE_README",
  TEST: "BASIC_TESTS",
  REVIEW: "PR_REVIEW",
} as const;

export const TodoSpec: EngineSpec = {
  name: "todo",

  onAgentCompleted(state: EngineState, resp: AgentResponse): EngineDecision {
    const actions: EngineDecision["actions"] = [];

    // 1) After requirements, request generation
    if (resp.stepId.startsWith(K.REQ) && resp.status === "OK") {
      const title = state.artifacts["title"] ?? "Simple Todo App";
      actions.push({ type: "REQUEST_WORK", workKind: K.GEN, payload: { title, req: resp.content } });
    }

    // 2) After generation, request README + tests (+ optional review)
    if (resp.stepId.startsWith(K.GEN) && resp.status === "OK") {
      actions.push(
        { type: "REQUEST_WORK", workKind: K.DOC, payload: { files: resp.content?.files } },
        { type: "REQUEST_WORK", workKind: K.TEST, payload: { files: resp.content?.files } },
      );
      // Optional review pass if coordinator provides an agent for it
      actions.push({ type: "REQUEST_WORK", workKind: K.REVIEW, payload: { files: resp.content?.files } });
    }

    // 3) Finalize when GEN, DOC, TEST are DONE (review is optional)
    const done = (kind: string) => Object.values(state.openSteps).some(s => s.kind === kind && s.status === "DONE");
    const finalize = done(K.GEN) && done(K.DOC) && done(K.TEST);

    return {
      decisionId: `dec-${uuid()}`,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions,
      finalize,
    };
  },
};

__registerSpec(TodoSpec);

# File: packages/coordinator/src/agents/todo.ts
import * as fs from "node:fs";
import * as path from "node:path";

// In Phase 2 you can swap these with real calls to bernierllc/agency-agents
// For now, we simulate outputs and write to ./out/<workflowId>/

export async function runRequirementsTodo(payload: any) {
  return {
    status: "OK",
    content: {
      summary: "A minimal Todo web app with add, list, toggle, and delete.",
      acceptance: [
        "Users can add a todo with a text label",
        "Users can toggle completed state",
        "Users can delete a todo",
        "State persists in localStorage"
      ],
    },
  };
}

export async function runGenerateTodoApp(workflowId: string, payload: any) {
  const base = path.join(process.cwd(), "out", workflowId);
  fs.mkdirSync(base, { recursive: true });
  const files: Record<string, string> = {
    "index.html": `<!doctype html><html><head><meta charset=\"utf-8\"><title>${payload.title}</title></head><body><div id=\"app\"></div><script type=\"module\" src=\"main.js\"></script></body></html>`,
    "main.js": `const key='todos';
const load=()=>JSON.parse(localStorage.getItem(key)||'[]');
const save=(x)=>localStorage.setItem(key,JSON.stringify(x));
let todos=load();
const app=document.getElementById('app');
function render(){app.innerHTML=\`<h1>${payload.title}</h1>
<form id=f><input id=t placeholder=\"Add todo\"/><button>Add</button></form>
<ul>\${todos.map((x,i)=>\`<li>
<label><input type=checkbox data-i=\"\${i}\" \${x.done?'checked':''}/>\${x.text}</label>
<button data-del=\"\${i}\">x</button></li>\`).join('')}</ul>\`;
  document.getElementById('f').onsubmit=(e)=>{e.preventDefault();const v=document.getElementById('t').value.trim();if(!v) return;todos.push({text:v,done:false});save(todos);render();};
  app.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.onchange=()=>{const i=+cb.dataset.i; todos[i].done=cb.checked; save(todos);});
  app.querySelectorAll('button[data-del]').forEach(b=>b.onclick=()=>{const i=+b.dataset.del; todos.splice(i,1); save(todos); render();});
}
render();`,
    "README.md": `# ${payload.title}

Open index.html in a browser. No build step. Data persists in localStorage.`,
    "tests.md": `Manual test: add, toggle, delete. Refresh persists.`
  };
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(base, rel);
    fs.writeFileSync(p, content, "utf8");
  }
  return { status: "OK", content: { files: Object.keys(files) }, artifacts: [{ type: "FOLDER", url: base }] };
}

export async function runWriteReadme(workflowId: string, payload: any) {
  // Already created in generation; ensure presence
  return { status: "OK", content: { updated: true } };
}

export async function runBasicTests(workflowId: string, payload: any) {
  const base = path.join(process.cwd(), "out", workflowId);
  const p = path.join(base, "tests.md");
  if (!fs.existsSync(p)) fs.writeFileSync(p, "Manual test: add, toggle, delete.");
  return { status: "OK", content: { file: "tests.md" } };
}

export async function runPrReview(payload: any) {
  // Placeholder review that always passes
  return { status: "OK", content: { notes: "LGTM" } };
}

# File: packages/coordinator/src/server.ts (updated to dispatch Phase 1 & 2)
import { Connection, Client } from "@temporalio/client";
import * as dotenv from "dotenv";
dotenv.config();
import { runRequirementsTodo, runGenerateTodoApp, runWriteReadme, runBasicTests, runPrReview } from "./agents/todo";

const HANDLERS: Record<string, (workflowId: string, payload: any) => Promise<any>> = {
  // Phase 1
  HELLO: async (_id, _p) => ({ status: "OK", content: { message: "Hello from agent" } }),

  // Phase 2
  REQUIREMENTS_TODO: async (_id, p) => runRequirementsTodo(p),
  GENERATE_TODO_APP: async (id, p) => runGenerateTodoApp(id, p),
  WRITE_README: async (id, p) => runWriteReadme(id, p),
  BASIC_TESTS: async (id, p) => runBasicTests(id, p),
  PR_REVIEW: async (_id, p) => runPrReview(p),
};

async function main() {
  const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || "localhost:7233" });
  const client = new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE || "default" });

  const workflowId = process.env.WORKFLOW_ID || "hello-1"; // override per run
  const handle = client.workflow.getHandle(workflowId);

  const state: any = await handle.query("currentState");
  const waiting = Object.entries(state.openSteps).filter(([, s]: any) => s.status === "WAITING");

  for (const [stepId, s] of waiting) {
    const fn = HANDLERS[s.kind];
    if (!fn) {
      console.warn(`[coord] no handler for kind ${s.kind}, skipping`);
      continue;
    }
    const resp = await fn(workflowId, s.payload);
    const envelope = {
      goalId: state.goalId,
      workflowId,
      stepId,
      runId: `${Date.now()}`,
      agentRole: `${s.kind.toLowerCase()}-agent`,
      status: resp.status || "OK",
      content: resp.content,
      artifacts: resp.artifacts,
    };
    await handle.signal("agentCompleted", stepId, envelope);
    console.log(`[coord] completed ${s.kind} for ${workflowId}`);
  }

  console.log(`[coord] dispatch complete for ${workflowId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

# File: packages/cli/src/start-todo.ts
import { Connection, Client } from "@temporalio/client";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const connection = await Connection.connect({ address: process.env.TEMPORAL_ADDRESS || "localhost:7233" });
  const client = new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE || "default" });

  const { EngineWorkflow } = await import("../../engine/src/engine/workflow");
  await import("../../specs/todo/src/todo.spec"); // registers the spec

  const workflowId = process.env.WORKFLOW_ID || "todo-1";
  const title = process.env.TODO_TITLE || "Minimal Todo App";

  const bootDecision = {
    decisionId: "boot-todo",
    actions: [
      { type: "ANNOTATE", key: "title", value: title },
      { type: "REQUEST_WORK", workKind: "REQUIREMENTS_TODO", payload: { title }, stepId: "REQUIREMENTS_TODO-1" },
    ],
  } as any;

  const handle = await client.workflow.start(EngineWorkflow, {
    workflowId,
    taskQueue: "engine",
    args: [{ goalId: `goal-${workflowId}`, specName: "todo", bootDecision }],
  });

  console.log(`[cli] started todo workflow ${workflowId} (runId ${await handle.firstExecutionRunId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

# File: packages/cli/package.json (append scripts)
// add these scripts to existing scripts
// "start:todo": "ts-node --esm src/start-todo.ts"

