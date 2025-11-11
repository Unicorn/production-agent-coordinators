Got it. Here’s a concrete, shippable pattern for a “Coordinator-first” setup on Temporal where agents do work, the coordinator interprets their responses, and then drives the rest of the workflow via signals.

# Architecture at a glance

* Temporal Workflows hold durable state and expose a small, stable set of signals and queries.
* A Coordinator service (outside Temporal) receives agent responses, understands the overall goal, decides what should happen next, and signals the relevant workflow(s).
* Agents are stateless workers that produce responses and artifacts. They never talk to workflows directly; they talk to the Coordinator, which then signals workflows.
* Optionally, the Coordinator can also signal/launch sibling workflows (QA, Docs, PR, etc.) and fan in their results back to the primary workflow.

# Contract-first design

## Common identifiers and envelopes

* goalId: stable id for the end-to-end job.
* workflowId: the primary orchestration workflow id for this goal.
* stepId: stable id for a requested unit of work, derived from workflowId + logical step name.
* runId: unique per attempt of a step (for idempotency).
* correlationId: unique per request/response round trip; the Coordinator uses it to dedupe signals.

### AgentResponse (from agents to Coordinator)

```json
{
  "goalId": "goal-123",
  "workflowId": "codegen-abc",
  "stepId": "write-impl-1",
  "runId": "run-xyz",
  "agentRole": "builder",
  "status": "OK | PARTIAL | FAIL",
  "content": { "summary": "...", "diffUrl": "...", "branch": "feature/x" },
  "artifacts": [{ "type": "PR", "url": "...", "ref": "..." }],
  "metrics": { "tokens": { "prompt": 1000, "completion": 2200 }, "costUsd": 0.35 },
  "errors": null
}
```

### CoordinatorDecision (from Coordinator logic to workflows)

```json
{
  "decisionId": "dec-456",
  "basedOn": { "stepId": "write-impl-1", "runId": "run-xyz" },
  "actions": [
    { "type": "REQUEST_QA", "payload": { "branch": "feature/x" } },
    { "type": "REQUEST_PR_REVIEW", "payload": { "prUrl": "..." } }
  ],
  "finalize": false
}
```

# Temporal side (primary orchestration workflow)

Expose a tiny, explicit signal surface that the Coordinator can rely on across workflow versions:

* signals

  * `agentCompleted(stepId, responseEnvelope)`
  * `requestWork(kind, payload, stepId)` for Coordinator-initiated work within the same workflow (optional)
  * `applyDecision(decisionEnvelope)` for bulk action handling
  * `childCompleted(childKind, resultEnvelope)`
  * `cancelGoal(reason)`
* queries

  * `currentState()`
  * `openSteps()`
  * `history()` summarized

State model in the workflow:

* goal: description, constraints, acceptance criteria
* plan: the currently expected graph of steps (with edges to QA/Review/Docs)
* openSteps: map stepId → { kind, status, requestedAt, due, children }
* artifacts: PR refs, doc links, compiled assets
* completion: { done: boolean, reason, at }

Minimal TypeScript workflow skeleton:

```ts
// workflows/codegen.ts
import {
  defineSignal, defineQuery, setHandler, condition, uuid4,
} from "@temporalio/workflow";
import type { AgentResponse, CoordinatorDecision } from "../shared/contracts";

export type CodegenState = {
  goalId: string;
  status: "RUNNING" | "BLOCKED" | "COMPLETED" | "FAILED" | "CANCELLED";
  openSteps: Record<string, { kind: string; status: "WAITING"|"IN_PROGRESS"|"DONE"|"FAILED" }>;
  artifacts: Record<string, any>;
  log: Array<{ at: number; event: string; data: any }>;
};

const agentCompleted = defineSignal<[string, AgentResponse]>("agentCompleted");
const applyDecision = defineSignal<[CoordinatorDecision]>("applyDecision");
const cancelGoal = defineSignal<[string]>("cancelGoal");

const currentState = defineQuery<CodegenState>("currentState");

export async function CodegenWorkflow(args: { goalId: string; initialPlan: any }): Promise<void> {
  const state: CodegenState = {
    goalId: args.goalId,
    status: "RUNNING",
    openSteps: {}, artifacts: {}, log: [],
  };

  setHandler(currentState, () => state);

  setHandler(agentCompleted, (stepId, resp) => {
    state.log.push({ at: Date.now(), event: "AGENT_COMPLETED", data: { stepId, resp } });
    // Update step status and stash artifacts
    state.openSteps[stepId] = { kind: state.openSteps[stepId]?.kind ?? "unknown", status: resp.status === "OK" ? "DONE" : "FAILED" };
    if (resp.artifacts) resp.artifacts.forEach(a => state.artifacts[`${a.type}:${a.ref ?? uuid4()}`] = a);
  });

  setHandler(applyDecision, (decision) => {
    state.log.push({ at: Date.now(), event: "APPLY_DECISION", data: decision });
    for (const a of decision.actions) {
      // Represent new requests as WAITING steps so the Coordinator can see them via query
      const id = a.payload?.stepId ?? `${a.type}-${uuid4()}`;
      state.openSteps[id] = { kind: a.type, status: "WAITING" };
    }
    if (decision.finalize) {
      state.status = "COMPLETED";
      state.log.push({ at: Date.now(), event: "FINALIZED", data: {} });
    }
  });

  setHandler(cancelGoal, (reason) => {
    state.status = "CANCELLED";
    state.log.push({ at: Date.now(), event: "CANCELLED", data: { reason } });
  });

  // Idle loop: sleep by awaiting conditions that never fire unless signaled
  // This keeps the workflow parked until a signal arrives
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await condition(() => false, "7 days");
    // Optionally continue-as-new periodically to cap history
  }
}
```

Notes

* The workflow doesn’t make network calls. It only mutates state on signals and exposes queries for UI/ops.
* New “requests” created by a Coordinator decision are entered into `openSteps` as `WAITING`. The Coordinator polls `currentState` and kicks off the appropriate agents or child workflows.

# Coordinator service

Responsibilities

1. Receive AgentResponse webhooks or consume them from a queue.
2. Fetch the workflow’s state (query).
3. Apply policy to choose next actions (QA, code review, docs, PR, rework).
4. Signal the workflow with a single `applyDecision(decision)` to keep histories tight.
5. For parallel branches, either signal the same workflow with multiple requested steps or spawn separate purpose-built workflows (QAWorkflow, DocsWorkflow) and remember their handles. When those complete, they will call the Coordinator again, which can then signal `childCompleted(...)`.

Stateless service sketch in TypeScript:

```ts
// coordinator/server.ts
import express from "express";
import { Connection, Client } from "@temporalio/client";
import { evaluateNextActions } from "./policy";
import { z } from "zod";

const AgentResponseSchema = z.object({
  goalId: z.string(), workflowId: z.string(),
  stepId: z.string(), runId: z.string(),
  agentRole: z.string(), status: z.enum(["OK", "PARTIAL", "FAIL"]),
  content: z.any(), artifacts: z.array(z.any()).optional(),
  metrics: z.any().optional(), errors: z.any().optional(),
});

async function getClient() {
  const connection = await Connection.connect();
  return new Client({ connection });
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/agent/callback", async (req, res) => {
  const parsed = AgentResponseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const resp = parsed.data;

  const client = await getClient();
  const handle = client.workflow.getHandle(resp.workflowId);
  // Dedupe by correlation key
  const idempotencyKey = `${resp.stepId}:${resp.runId}`;
  // Optionally store this in a KV/DB before signaling to avoid dupes on retries

  // 1) Tell the workflow an agent finished
  await handle.signal("agentCompleted", resp.stepId, resp);

  // 2) Pull fresh state and evaluate policy
  const state = await handle.query("currentState");
  const decision = evaluateNextActions(state, resp);

  // 3) Apply decision
  await handle.signal("applyDecision", decision);

  return res.json({ ok: true, applied: decision });
});

app.listen(3000, () => console.log("Coordinator listening on 3000"));
```

Policy module to encode your domain rules:

```ts
// coordinator/policy.ts
import type { CodegenState } from "../workflows/codegen";
import { v4 as uuid } from "uuid";

export function evaluateNextActions(state: CodegenState, resp: any) {
  const actions = [];

  // Example: when implementation step is OK, request PR review and QA
  if (resp.stepId.startsWith("write-impl") && resp.status === "OK") {
    actions.push({ type: "REQUEST_PR_REVIEW", payload: { prUrl: resp.artifacts?.find(a => a.type === "PR")?.url } });
    actions.push({ type: "REQUEST_QA", payload: { branch: resp.content?.branch } });
  }

  // Example: when PR review FAILS, request rework
  if (resp.stepId.startsWith("pr-review") && resp.status === "FAIL") {
    actions.push({ type: "REQUEST_REWORK", payload: { reason: resp.errors, targetStepId: "write-impl-1" } });
  }

  // Finalization rule: if no open steps remain in DONE/WAITING except docs, and docs are DONE, finalize
  const openKinds = Object.values(state.openSteps).map(s => s.kind);
  const done = Object.values(state.openSteps).every(s => s.status === "DONE");
  const finalize = done || (openKinds.length === 0);

  return {
    decisionId: `dec-${uuid()}`,
    basedOn: { stepId: resp.stepId, runId: resp.runId },
    actions,
    finalize,
  };
}
```

# How the coordinator triggers other workflows

Two options, both valid:

1. Single primary workflow, everything represented as steps. The Coordinator never starts other workflows directly. It only signals the primary to add “requests”; a separate worker/service observes those requests (via query or TaskQueue pull) and starts agents or child workflows. Simple, easy to reason about.

2. Hybrid. The Coordinator starts sibling workflows for QA/Docs/PR using the Temporal client, remembers their workflowIds, and signals the primary via `childCompleted` when they finish. Lower latency and clearer boundaries for specialized teams.

Pick 1 for your first version. You can add 2 later without breaking the primary contract.

# Example: Code generation flow

1. You start `CodegenWorkflow(workflowId=codegen-abc, goalId=goal-123)`.
2. Coordinator signals `applyDecision` with a first action `REQUEST_REQUIREMENTS` and `REQUEST_ACCEPTANCE_CRITERIA`.
3. An “author” agent completes requirements. Coordinator receives the response, signals `agentCompleted`, then `applyDecision` to add `REQUEST_TICKET_CREATION` and `REQUEST_IMPLEMENTATION`.
4. Builder agent finishes implementation with a PR link. Coordinator signals `agentCompleted`, then `applyDecision` with `REQUEST_PR_REVIEW` and `REQUEST_QA`.
5. PR reviewer agent returns OK, QA returns OK, Coordinator signals both completions, then sends `applyDecision` with `REQUEST_DOCS`.
6. Docs agent returns OK, Coordinator sends `applyDecision` with `finalize=true`. Workflow status becomes COMPLETED.

# Practical details you’ll care about

* Idempotency

  * Coordinator stores `correlationId = stepId:runId` and ignores duplicates when signaling.
  * Use Temporal retry on the Coordinator signaling calls. Signals are at-least-once; your workflow handlers should be idempotent.

* Search & observability

  * Upsert search attributes on the workflow: goalId, status, repo, branch, prNumber, tenant.
  * Log prompt/response metrics in the Coordinator, not the Workflow.

* Human-in-the-loop

  * Add a `REQUEST_APPROVAL` action. The workflow exposes `approve(stepId)` signal. The Coordinator only advances after approval arrives.

* Timeouts and escalations

  * For each requested step, the Coordinator tracks “due by.” If overdue, it evaluates rules: remind, replace agent, or mark FAIL and request rework.

* Schema validation

  * Validate AgentResponse against zod/JSON schema before deciding. If invalid, signal `agentCompleted` with status FAIL + reason to keep the audit trail consistent.

* Multi-tenant safety

  * Namespaces per environment. Prefix workflowIds with tenant. Enforce RBAC at the Coordinator boundary.

# Thin UI hooks

* Poll `currentState()` for display. Show open steps, artifacts, and event log.
* Buttons call Coordinator endpoints to inject approvals, overrides, or to nudge agents.

# Minimal backlog to get this running

1. Create the `CodegenWorkflow` with `agentCompleted`, `applyDecision`, `currentState` as shown.
2. Ship the Coordinator service with `/agent/callback` and the policy function.
3. Implement one agent (e.g., “builder”) that posts to `/agent/callback`.
4. Manually trigger decisions from the Coordinator at first, then automate policy.
5. Add QA and PR review agents.
6. Add finalize rule and smoke-test end-to-end.

If you want, I can adapt these snippets into a small repo layout with package.json, worker bootstrap, and a stub agent so you can run the full loop locally.
