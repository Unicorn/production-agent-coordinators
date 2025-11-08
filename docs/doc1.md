Great target. Here’s a concrete design for a general “agent-aware” workflow coordinator on Temporal that you can ship and evolve. I’ll give you the architecture, core patterns that make it robust, and a minimal TypeScript reference you can extend.

# What we’re building (at a glance)

A Temporal-based coordinator that:

* Orchestrates one or more AI agents to complete goals.
* Treats every LLM/tool step as an Activity (safe, retryable, observable).
* Uses Workflows for state, plans, budgets, and human-in-the-loop.
* Supports external tools, callbacks/webhooks, and long-running tasks.
* Stays deterministic while giving you streaming/progress and cancellation.

# Core concepts and contracts

## Top-level objects

* Goal: user intent and constraints.
* Plan: sequence/graph of steps produced by a planner agent or supplied by user.
* Step: a single action by an agent (LLM call, tool use, sub-workflow, approval).
* Turn: loop iteration where agents observe -> decide -> act -> reflect.
* Budget: tokens, cost ceiling, wall-clock deadline.

## Temporal types

* Workflows

  * OrchestrationWorkflow: owns the goal, manages plan/turns, budgets.
  * AgentTurnWorkflow (child): optional isolation per turn/agent.
  * ToolRunWorkflow (child): optional isolation for long tools and sagas.
* Activities

  * callLLMActivity: model invocation (chat/completions) + tracing.
  * runToolActivity: tool execution (HTTP, DB, code) with idempotency keys.
  * validateOutputActivity: schema/guardrails check.
  * persistMemoryActivity: write observations to memory store.
  * notifyActivity: Slack/Email/etc.
* Signals (to OrchestrationWorkflow)

  * userMessage(input), approveStep(stepId), cancel(), toolCallback(stepId, result), overridePlan(newPlan).
* Queries

  * currentState(), getTranscript(), getPlan(), getBudget(), getMetrics().

## Determinism rules (Temporal-friendly agents)

* No network I/O inside workflows. All LLM and tool calls are Activities.
* Use stable IDs for steps (derived from workflowId + turn + index) so retries dedupe.
* For long histories, use continueAsNew every N turns or M events.
* Record and re-use model prompts and responses in workflow state; Activities return immutable artifacts that become part of history.
* External callbacks land as Signals that unblock waiting conditions.

## Multi-agent pattern

* Planner agent: creates/updates a Plan given a Goal and observations.
* Worker agents: execute plan steps (tool use, research, drafting).
* Arbiter: validates outputs against schema and budget; triggers replanning on failure.
* Each agent is an Activity (LLM call) wrapped with validation and cost tracking.

## Budgeting and guardrails

* Track token usage, $ cost, and wall time in workflow state.
* Deny or pause when budget exceeded; require approveStep to continue.
* validateOutputActivity enforces JSON schema and safety filters.
* Retry policies per Activity; DLQ or escalation to human after max attempts.

## Observability & search

* Upsert search attributes: goalId, status, tenant, assignee, cost, deadline.
* Structured logs from Activities (prompt, response ids, token counts).
* Query handlers to fetch live plan/transcript for UI.

## Tools contract (for “agent tools”)

* Tool metadata: name, version, inputSchema, outputSchema, idempotencyKey, timeout, compensation (for saga).
* Each tool implemented as a Temporal Activity function.
* For tools that respond via webhook: start ToolRunWorkflow and complete by Signal.

# Minimal TypeScript reference (Temporal v1+)

## Types

```ts
// shared/types.ts
export type Goal = {
  goalId: string;
  title: string;
  description: string;
  inputs?: Record<string, any>;
  deadlineEpochMs?: number;
  maxCostUsd?: number;
  maxTurns?: number;
};

export type PlanStep =
  | { kind: "LLM_CALL"; agent: string; prompt: string; stepId: string }
  | { kind: "TOOL_CALL"; tool: string; input: any; stepId: string }
  | { kind: "APPROVAL"; message: string; stepId: string }
  | { kind: "SUBGOAL"; title: string; stepId: string };

export type Plan = {
  planId: string;
  steps: PlanStep[];
  cursor: number; // index of next step
};

export type AgentResult = {
  stepId: string;
  ok: boolean;
  content?: any;
  tokens?: { prompt: number; completion: number; totalCostUsd: number };
  error?: string;
};

export type OrchestrationState = {
  goal: Goal;
  plan: Plan;
  transcript: Array<{ stepId: string; role: "agent" | "tool" | "system"; content: any }>;
  costUsd: number;
  turn: number;
  status: "RUNNING" | "AWAITING_APPROVAL" | "BLOCKED" | "COMPLETED" | "CANCELLED" | "FAILED";
};
```

## Activities

```ts
// activities/index.ts
import type { AgentResult } from "../shared/types";

export async function callLLMActivity(args: {
  agent: string;
  prompt: string;
  stepId: string;
  idempotencyKey: string;
}): Promise<AgentResult> {
  // Call your LLM provider here. Add tracing, retries happen via Temporal.
  // Return a fully materialized result (no streaming to the workflow).
  // Include token usage and computed cost for budgeting.
  return {
    stepId: args.stepId,
    ok: true,
    content: { message: "draft or tool decision here" },
    tokens: { prompt: 100, completion: 300, totalCostUsd: 0.002 },
  };
}

export async function runToolActivity(args: {
  tool: string;
  input: any;
  stepId: string;
  idempotencyKey: string;
}): Promise<AgentResult> {
  // Call HTTP/database/sdk; ensure idempotency by deduping on idempotencyKey.
  return { stepId: args.stepId, ok: true, content: { result: "tool-output" } };
}

export async function validateOutputActivity(args: {
  stepId: string;
  content: any;
  schemaName: string;
}): Promise<AgentResult> {
  // Validate against JSON schema or custom rules.
  return { stepId: args.stepId, ok: true, content: args.content };
}

export async function persistMemoryActivity(args: {
  goalId: string;
  observation: any;
}) {
  // Write to your memory store / vector DB.
  return true;
}

export async function notifyActivity(args: { channel: string; message: string }) {
  // Slack/email/etc.
  return true;
}
```

## Workflow

```ts
// workflows/orchestration.ts
import { proxyActivities, defineSignal, defineQuery, condition, sleep, continueAsNew, uuid4, setHandler, upsertSearchAttributes } from "@temporalio/workflow";
import type { Goal, Plan, OrchestrationState, PlanStep, AgentResult } from "../shared/types";

const { callLLMActivity, runToolActivity, validateOutputActivity, persistMemoryActivity, notifyActivity } = proxyActivities<{
  callLLMActivity: typeof import("../activities").callLLMActivity;
  runToolActivity: typeof import("../activities").runToolActivity;
  validateOutputActivity: typeof import("../activities").validateOutputActivity;
  persistMemoryActivity: typeof import("../activities").persistMemoryActivity;
  notifyActivity: typeof import("../activities").notifyActivity;
}>({
  startToCloseTimeout: "10 minutes",
  retry: { maximumAttempts: 3 },
});

export type OrchestrationArgs = { goal: Goal; initialPlan?: Plan };

const userMessage = defineSignal<[string]>("userMessage");
const approveStep = defineSignal<[string]>("approveStep");
const toolCallback = defineSignal<[string, any]>("toolCallback");
const cancel = defineSignal<[]>("cancel");

const currentState = defineQuery<OrchestrationState>("currentState");
const getPlan = defineQuery<Plan>("getPlan");

export async function OrchestrationWorkflow(args: OrchestrationArgs): Promise<OrchestrationState> {
  let state: OrchestrationState = {
    goal: args.goal,
    plan: args.initialPlan ?? { planId: uuid4(), steps: [], cursor: 0 },
    transcript: [],
    costUsd: 0,
    turn: 0,
    status: "RUNNING",
  };

  // Signal handlers
  setHandler(userMessage, (msg) => {
    state.transcript.push({ stepId: `user-${uuid4()}`, role: "system", content: { user: msg } });
  });
  setHandler(approveStep, (stepId) => {
    if (state.status === "AWAITING_APPROVAL" && state.plan.steps[state.plan.cursor]?.stepId === stepId) {
      state.status = "RUNNING";
    }
  });
  setHandler(toolCallback, (stepId, result) => {
    state.transcript.push({ stepId, role: "tool", content: result });
  });
  setHandler(cancel, () => { state.status = "CANCELLED"; });

  setHandler(currentState, () => state);
  setHandler(getPlan, () => state.plan);

  // Index for search / dashboards
  upsertSearchAttributes({ Keyword: { goalId: state.goal.goalId }, Text: { title: state.goal.title }, KeywordList: { status: [state.status] } });

  // If no plan, have a planner agent produce one
  if (state.plan.steps.length === 0) {
    const planStepId = `plan-${uuid4()}`;
    const planDraft = await callLLMActivity({
      agent: "planner",
      prompt: JSON.stringify({ goal: state.goal }),
      stepId: planStepId,
      idempotencyKey: `${state.goal.goalId}:${planStepId}`,
    });
    // Convert model output to Plan
    state.plan = {
      planId: uuid4(),
      steps: synthesizePlanFromAgentOutput(planDraft.content),
      cursor: 0,
    };
    await persistMemoryActivity({ goalId: state.goal.goalId, observation: { event: "PLANNED", plan: state.plan } });
  }

  // Main loop
  while (state.status === "RUNNING") {
    if (state.goal.maxTurns && state.turn >= state.goal.maxTurns) { state.status = "FAILED"; break; }
    if (state.goal.deadlineEpochMs && Date.now() > state.goal.deadlineEpochMs) { state.status = "FAILED"; break; }
    if (state.plan.cursor >= state.plan.steps.length) { state.status = "COMPLETED"; break; }

    const step = state.plan.steps[state.plan.cursor];
    state.turn++;

    // Budget check
    if (state.goal.maxCostUsd && state.costUsd >= state.goal.maxCostUsd) {
      state.status = "AWAITING_APPROVAL";
      await notifyActivity({ channel: "ops", message: `Budget reached for ${state.goal.goalId}. Approve step ${step.stepId}?` });
      await condition(() => state.status === "RUNNING", 24 * 60 * 60 * 1000);
    }
    if (state.status !== "RUNNING") break;

    let result: AgentResult;
    if (step.kind === "LLM_CALL") {
      result = await callLLMActivity({
        agent: step.agent,
        prompt: step.prompt,
        stepId: step.stepId,
        idempotencyKey: `${args.goal.goalId}:${step.stepId}`,
      });
    } else if (step.kind === "TOOL_CALL") {
      result = await runToolActivity({
        tool: step.tool,
        input: step.input,
        stepId: step.stepId,
        idempotencyKey: `${args.goal.goalId}:${step.stepId}`,
      });
    } else if (step.kind === "APPROVAL") {
      state.status = "AWAITING_APPROVAL";
      await notifyActivity({ channel: "ops", message: step.message });
      await condition(() => state.status === "RUNNING", 7 * 24 * 60 * 60 * 1000);
      continue;
    } else if (step.kind === "SUBGOAL") {
      // Optionally spawn a child workflow for subgoals
      // const child = yield startChild(OrchestrationWorkflow, { args: [{ goal: subGoalFrom(step) }], ... });
      // const childState = yield child.result();
      result = { stepId: step.stepId, ok: true, content: { status: "SUBGOAL_DONE" } };
    } else {
      result = { stepId: step.stepId, ok: false, error: "Unknown step" };
    }

    // Accounting and transcript
    if (result.tokens?.totalCostUsd) state.costUsd += result.tokens.totalCostUsd;
    state.transcript.push({ stepId: step.stepId, role: step.kind === "TOOL_CALL" ? "tool" : "agent", content: result });

    // Validate and advance/replan
    const validated = await validateOutputActivity({ stepId: step.stepId, content: result.content, schemaName: kindToSchema(step.kind) });
    if (!validated.ok) {
      // Ask arbiter to replan or fix
      const arbiter = await callLLMActivity({
        agent: "arbiter",
        prompt: JSON.stringify({ failureAt: step, result, plan: state.plan }),
        stepId: `arbiter-${uuid4()}`,
        idempotencyKey: `${args.goal.goalId}:arbiter:${state.turn}`,
      });
      const newPlan = synthesizePlanFromAgentOutput(arbiter.content);
      state.plan = { ...newPlan, planId: uuid4(), cursor: 0 };
      continue;
    }

    state.plan.cursor++;

    // Continue-as-new to cap history
    if (state.turn % 20 === 0) {
      await persistMemoryActivity({ goalId: state.goal.goalId, observation: { checkpoint: true, state } });
      return await continueAsNew<typeof OrchestrationWorkflow>({ goal: state.goal, initialPlan: state.plan });
    }

    // Optional pacing to be nice to providers
    await sleep(500);
  }

  return state;
}

// Pure helper: lives inside workflow file to keep determinism
function synthesizePlanFromAgentOutput(content: any): Plan {
  // Parse and sanitize model output; fallback to trivial single step
  const steps: PlanStep[] = Array.isArray(content?.steps) ? content.steps : [{
    kind: "LLM_CALL", agent: "writer", prompt: "Draft result", stepId: `step-${uuid4()}`,
  }];
  // Ensure stepId presence
  steps.forEach(s => { if (!("stepId" in s)) (s as any).stepId = `step-${uuid4()}`; });
  return { planId: uuid4(), steps, cursor: 0 };
}

function kindToSchema(kind: PlanStep["kind"]): string {
  switch (kind) {
    case "LLM_CALL": return "AgentMessage";
    case "TOOL_CALL": return "ToolResult";
    case "APPROVAL": return "ApprovalAck";
    default: return "Generic";
  }
}
```

# How external callbacks fit

Some tools can’t finish synchronously. Pattern:

1. Start ToolRunWorkflow child with input and a timeout.
2. Expose a webhook endpoint that, when called by the tool, sends toolCallback(stepId, result) to the child.
3. Child waits on condition for the signal, then returns to parent.
4. Parent advances the plan. This maintains determinism and resilience.

# Human-in-the-loop

* Approval steps pause the workflow by switching status to AWAITING_APPROVAL and waiting on a Signal.
* You can wire a simple UI to Query currentState() and send approveStep(stepId).
* For edits, overridePlan(newPlan) can replace the plan on the fly.

# Versioning and rollout

* Use a versioned Task Queue per tenant or per “agent pack.”
* Gate new agent prompts with Temporal versioning (patch markers) and configuration from a KV store.
* Keep Activities idempotent. Use idempotencyKey in downstream calls and storage to dedupe retries.

# Security and tenancy

* One Temporal Namespace per environment. Tag workflows with tenantId in search attributes.
* Encrypt prompts/results at rest in your Activity layer if needed.
* Tools should enforce RBAC and audit each invocation with workflowId, stepId, userId.

# Minimal backlog to get this running

1. Bootstrap Temporal (server + TS worker). Create OrchestrationWorkflow + Activities above.
2. Wire one LLM provider into callLLMActivity and return token/cost metrics.
3. Implement a single Tool as runToolActivity such as “HTTP_GET”.
4. Add a tiny HTTP UI (or CLI) to start workflows, Query currentState, and send approveStep/cancel.
5. Add continueAsNew after 20 turns and a basic budget check.
6. Add validateOutputActivity with a JSON schema for tool results.
7. Add memory persistence activity (start with Postgres table) and store transcript/observations.

If you want, I can drop a ready-to-run repo scaffold next with package.json, worker bootstrap, and a stub UI server so you can start a workflow, watch state, and signal approvals.
