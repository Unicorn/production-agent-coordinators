Great questions. I’ll answer each directly, then give you a small but real TypeScript setup:

1. why not call agents directly from the workflow
2. how to generalize into a reusable “engine” you can subclass/plug
3. a concrete codegen workflow that extends the generic engine with its own signals/logic

---

## 1) Why the workflow doesn’t call agents directly from signals

You can make the workflow call an agent via an Activity, but there are strong reasons to keep the workflow “pure” and let a coordinator (or a small dispatcher worker) do it:

* Determinism and history size: every LLM/tool call returns big payloads and varies on retries. If you stuff those into the workflow loop, your history explodes, and patch/versioning gets harder. Keeping the workflow’s job to “record intent + accept results via signals” keeps histories lean and upgrades easy.
* Async and webhooks: many agent/tool runs are asynchronous, batchy, or callback-based (PR creation, CI pipelines). Workflows can’t wait on webhooks directly; signals are the right bridge.
* Idempotency at boundaries: at-least-once delivery of signals + a coordinator’s idempotency key makes duplicate suppression simpler than encoding this across many Activities.
* Fan-out/fan-in across workflows: the coordinator can route one agent’s response to multiple workflows (e.g., PR workflow, QA workflow) cleanly without coupling those domains in a single workflow.
* Policy agility: changing “what to do next” is easier in a stateless coordinator/policy module than shipping a new workflow binary every time you tweak rules, SLAs, or rate limits.
* Backpressure and fairness: the coordinator can apply queues, priorities, and tenant quotas before it kicks agents, which is awkward inside a workflow.

When is “workflow calls agent” fine?
If a step is short, synchronous, and you want strict in-line retries/timeout, call it via an Activity (e.g., “render markdown to HTML”). For anything long, tooly, UI-in-the-loop, or webhooky, keep it outside and use signals.

---

## 2) Generalizing to a reusable engine you can subclass/plug

Temporal TS supports class-style workflows, but most teams use “function workflows.” We can still write a reusable “Engine” with:

* a fixed, small set of generic signals and queries
* a pluggable “Spec” interface for domain rules and optional extra signals
* a registry of action handlers so a UI builder can wire arbitrary agents/prompts

Pattern:

* **Engine workflow** owns durable state: goal, steps, artifacts, event log.
* **Generic signals**:

  * `agentCompleted(stepId, response)`
  * `applyDecision(decision)` (batch of actions, optional finalize)
  * `approve(stepId)`
  * `cancel(reason)`
* **Spec plugin** (policy): pure functions that tell the engine how to translate responses into next actions and when to finalize.
* **Optional custom signals**: a Spec can add handlers (e.g., `qaGatePassed`, `prMerged`) by name. The engine exposes a generic `custom(eventType, payload)` signal so you don’t have to recompile the engine for every new signal name.

That gives you one binary “EngineWorkflow” that can run any use case. The coordinator and/or a “UI workflow builder” can:

* register tools/agents
* define prompts
* define guardrails
* feed responses back
* switch specs without redeploying the engine

---

## 3) Concrete code: generic Engine + Codegen specialization

Below is compact but working-quality TypeScript that you can paste into a repo. It shows:

* A generic engine workflow (not codegen-specific)
* A pluggable Spec
* A codegen Spec with its own semantics
* A dispatcher (tiny “coordinator”) that converts engine state into actual agent runs
* How to add a custom, use-case-specific signal while still using the generic engine

### Shared contracts

```ts
// shared/contracts.ts
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
```

### Spec interface (policy plug-in)

```ts
// engine/spec.ts
import type { AgentResponse, EngineDecision, EngineState } from "../shared/contracts";

export interface EngineSpec {
  name: string;

  // Decide next actions when an agent completes work
  onAgentCompleted(state: EngineState, resp: AgentResponse): EngineDecision;

  // Optional: decide next actions when a custom event arrives
  onCustomEvent?(state: EngineState, eventType: string, payload: any): EngineDecision;

  // Optional: run after applyDecision for normalization (e.g., collapse duplicates)
  postApply?(state: EngineState): void;
}
```

### Generic Engine workflow

```ts
// engine/workflow.ts
import {
  defineSignal, defineQuery, setHandler, condition, uuid4, upsertSearchAttributes,
} from "@temporalio/workflow";
import type { AgentResponse, EngineDecision, EngineState, StepState } from "../shared/contracts";
import type { EngineSpec } from "./spec";

const agentCompleted = defineSignal<[string, AgentResponse]>("agentCompleted");
const applyDecision = defineSignal<[EngineDecision]>("applyDecision");
const approve = defineSignal<[string]>("approve");
const cancel = defineSignal<[string]>("cancel");
const custom = defineSignal<[string, any]>("custom"); // (eventType, payload)

const currentState = defineQuery<EngineState>("currentState");

export type EngineArgs = { goalId: string; specName: string; bootDecision?: EngineDecision };

// Spec registry (resolved at workflow start; keep deterministic)
const SPECS: Record<string, EngineSpec> = {}; // Populated via patch markers or static import in real code

export function registerSpec(spec: EngineSpec) {
  // This is only to illustrate; in real code you'd import the spec file directly
  // so it's bundled and deterministic. Keeping here for clarity.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  SPECS[spec.name] = spec;
}

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
    const prev = state.openSteps[stepId] ?? { kind: "unknown", status: "WAITING", requestedAt: now, updatedAt: now };
    state.openSteps[stepId] = {
      ...prev,
      ...mut,
      updatedAt: now,
      requestedAt: prev.requestedAt ?? now,
    };
  };

  setHandler(agentCompleted, (stepId, resp) => {
    state.log.push({ at: Date.now(), event: "AGENT_COMPLETED", data: { stepId, resp } });
    // Update step
    upsert(stepId, { status: resp.status === "OK" ? "DONE" : resp.status === "FAIL" ? "FAILED" : "IN_PROGRESS" });
    // Stash artifacts
    resp.artifacts?.forEach(a => { state.artifacts[`${a.type}:${a.ref ?? uuid4()}`] = a; });

    const decision = spec.onAgentCompleted(state, resp);
    apply(decision);
  });

  const apply = (decision: EngineDecision) => {
    state.log.push({ at: Date.now(), event: "APPLY_DECISION", data: decision });
    for (const a of decision.actions) {
      if (a.type === "REQUEST_WORK") {
        const id = a.stepId ?? `${a.workKind}-${uuid4()}`;
        state.openSteps[id] = {
          kind: a.workKind, status: "WAITING", requestedAt: Date.now(), updatedAt: Date.now(), payload: a.payload,
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
```

### A generic dispatcher (“coordinator-lite”)

This pulls `WAITING` steps from the engine and kicks agents. In production you’d do this with a queue and backpressure; here it’s simple.

```ts
// dispatcher/worker.ts
import { Connection, Client } from "@temporalio/client";
import type { EngineState } from "../shared/contracts";

export async function dispatch(workflowId: string, runAgent: (workKind: string, payload: any) => Promise<any>) {
  const conn = await Connection.connect();
  const client = new Client({ connection: conn });
  const handle = client.workflow.getHandle(workflowId);

  // naive polling loop; replace with signals/webhooks/queues in prod
  const state = await handle.query<EngineState>("currentState");
  const entries = Object.entries(state.openSteps).filter(([, s]) => s.status === "WAITING");

  for (const [stepId, s] of entries) {
    // Mark as in progress via a synthetic decision (optional)
    await handle.signal("applyDecision", {
      decisionId: `start-${stepId}`,
      actions: [{ type: "ANNOTATE", key: `started:${stepId}`, value: Date.now() }],
    });

    const resp = await runAgent(s.kind, s.payload);
    await handle.signal("agentCompleted", stepId, resp);
  }
}
```

### Codegen Spec (domain rules) + an extra custom signal

We keep using the **generic engine** but add codegen-specific semantics with a Spec. We also show a custom domain event `custom("ciStatusChanged", {...})` without touching the engine’s core signals.

```ts
// specs/codegen.ts
import type { EngineSpec } from "../engine/spec";
import type { AgentResponse, EngineDecision, EngineState } from "../shared/contracts";
import { randomUUID as uuid } from "crypto";

export const CodegenSpec: EngineSpec = {
  name: "codegen",

  onAgentCompleted(state: EngineState, resp: AgentResponse): EngineDecision {
    const actions: EngineDecision["actions"] = [];

    // When requirements are done, request acceptance criteria and ticket creation
    if (resp.stepId.startsWith("requirements") && resp.status === "OK") {
      actions.push(
        { type: "REQUEST_WORK", workKind: "ACCEPTANCE_CRITERIA", payload: { reqDoc: artifactUrl(state, "REQ") } },
        { type: "REQUEST_WORK", workKind: "CREATE_TICKET", payload: { title: state.artifacts["title"], body: "From requirements" } },
        { type: "REQUEST_WORK", workKind: "IMPLEMENTATION", payload: { branch: `feat/${uuid().slice(0,8)}` } },
      );
    }

    // When implementation done, ask for PR, QA, Docs
    if (resp.stepId.startsWith("IMPLEMENTATION") && resp.status === "OK") {
      const branch = resp.content?.branch;
      actions.push(
        { type: "REQUEST_WORK", workKind: "OPEN_PR", payload: { branch } },
        { type: "REQUEST_WORK", workKind: "RUN_QA", payload: { branch } },
        { type: "REQUEST_WORK", workKind: "WRITE_DOCS", payload: { branch } },
      );
    }

    // When PR opened, wait for CI and review
    if (resp.stepId.startsWith("OPEN_PR") && resp.status === "OK") {
      const prUrl = resp.artifacts?.find(a => a.type === "PR")?.url;
      actions.push(
        { type: "ANNOTATE", key: "prUrl", value: prUrl },
        { type: "REQUEST_WORK", workKind: "PR_REVIEW", payload: { prUrl } },
      );
    }

    // If PR review fails, request rework
    if (resp.stepId.startsWith("PR_REVIEW") && resp.status === "FAIL") {
      actions.push({ type: "REQUEST_WORK", workKind: "REWORK", payload: { reason: resp.errors, target: "IMPLEMENTATION" } });
    }

    // If PR review OK + QA OK + Docs OK and CI is green → finalize
    const allGood =
      isDone(state, "PR_REVIEW") &&
      isDone(state, "RUN_QA") &&
      isDone(state, "WRITE_DOCS") &&
      state.artifacts["ciStatus"] === "SUCCESS";

    return {
      decisionId: `dec-${uuid()}`,
      basedOn: { stepId: resp.stepId, runId: resp.runId },
      actions,
      finalize: allGood,
    };
  },

  onCustomEvent(state, eventType, payload) {
    if (eventType === "ciStatusChanged") {
      return {
        decisionId: `dec-ci-${Date.now()}`,
        actions: [{ type: "ANNOTATE", key: "ciStatus", value: payload.status }],
        finalize:
          payload.status === "SUCCESS" &&
          isDone(state, "PR_REVIEW") &&
          isDone(state, "RUN_QA") &&
          isDone(state, "WRITE_DOCS"),
      };
    }
    return { decisionId: `dec-noop-${Date.now()}`, actions: [] };
  },
};

function isDone(state: EngineState, kind: string) {
  return Object.values(state.openSteps).some(s => s.kind === kind && s.status === "DONE");
}
function artifactUrl(state: EngineState, type: string) {
  const k = Object.keys(state.artifacts).find(k => k.startsWith(`${type}:`));
  return k ? state.artifacts[k]?.url : undefined;
}
```

### Using a custom, use-case-specific signal in the engine

Your CI listener can signal the engine without adding new core signals:

```ts
// somewhere in your CI webhook handler
await engineHandle.signal("custom", "ciStatusChanged", { status: "SUCCESS" });
```

### A “specific workflow” feel without forking the engine

If you still want a codegen-named workflow for observability and task queues, create a thin wrapper that just picks the Spec and seeds the first decision:

```ts
// workflows/codegen.ts
import { EngineWorkflow } from "../engine/workflow";
import { CodegenSpec } from "../specs/codegen";
// Import-time registration to keep determinism
import { registerSpec } from "../engine/workflow";
registerSpec(CodegenSpec);

export { EngineWorkflow as CodegenWorkflow };
```

Boot it with a codegen-specific initial decision:

```ts
// when starting the workflow
client.workflow.start(CodegenWorkflow, {
  workflowId: "codegen-abc",
  taskQueue: "codegen",
  args: [{
    goalId: "goal-123",
    specName: "codegen",
    bootDecision: {
      decisionId: "boot",
      actions: [
        { type: "ANNOTATE", key: "title", value: "Implement feature X" },
        { type: "REQUEST_WORK", workKind: "REQUIREMENTS", payload: { prompt: "Write requirements for feature X" } },
      ],
    },
  }],
});
```

---

## What this gives you

* A single, reusable **EngineWorkflow** you can put behind a “UI workflow builder.”
* A simple **Spec** interface to encode domain rules, prompts, and finalize conditions.
* The ability to add **custom domain events** without changing the engine (via the `custom` signal).
* A clear place for a coordinator/dispatcher to live. You can keep it tiny at first or grow it into a policy service.
* A codegen **specific workflow** look-and-feel without duplicating engine logic.

If you want, I can package these snippets into a runnable repo with a minimal worker, a fake agent runner, and a CLI to start workflows, send signals, and simulate CI/PR/QA responses.
