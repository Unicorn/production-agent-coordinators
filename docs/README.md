Here you go—one README you can drop into `./docs/README.md`, plus a concrete task list to take you from zero to Phase 1 (hello world) and Phase 2 (simple todo app generator using your agents).

# README.md (place this in `./docs/README.md`)

# Generic Agent Coordinator on Temporal

This project implements a generic, agent-aware workflow “engine” on Temporal. Agents do the work; the coordinator interprets their responses and drives the workflow via signals. The same engine powers many use-cases by swapping a “Spec” (policy module), so you can put it behind a UI workflow builder.

## Core ideas

* Workflows are deterministic state machines. They never call LLMs or external services directly.
* Agents and tools are invoked outside the workflow (by a coordinator/dispatcher). Results come back via signals.
* A generic Engine workflow exposes a small, stable set of signals/queries. Domain rules live in pluggable Specs.
* You can layer specific workflows (e.g., codegen) by picking a Spec and seeding an initial decision.

## High-level architecture

* `EngineWorkflow` (Temporal): durable state for goal, open steps, artifacts, and event log.
* Signals:

  * `agentCompleted(stepId, response)`
  * `applyDecision(decision)`
  * `approve(stepId)`
  * `cancel(reason)`
  * `custom(eventType, payload)` for domain events without changing core signals
* Queries:

  * `currentState()`
* Coordinator/Dispatcher: polls `currentState`, starts agents for `WAITING` steps, sends `agentCompleted` when done.
* Specs: pure policy modules. Example: `codegen` decides when to request requirements, PR review, QA, docs, and when to finalize.

## What you can run

* Phase 1: Hello World

  * A trivial Spec that requests one unit of work (“HELLO”), an agent echoes a string, the engine finalizes.
* Phase 2: Simple Todo App Generator

  * Uses agents from `bernierllc/agency-agents` to:

    * draft a tiny requirements doc
    * generate a simple TODO web app skeleton
    * produce a README and basic tests
    * optionally request a “code review” agent pass
  * Still goes through the same generic Engine and signals.

## Prerequisites

* Node.js 18+
* Docker (for Temporal dev stack)
* Yarn or npm
* Temporal CLI (optional), or use docker-compose
* API keys:

  * Anthropic (for Claude) via `ANTHROPIC_API_KEY`
* Recommended: create a `.env` at repo root

## Environment variables

```
# .env
ANTHROPIC_API_KEY=sk-ant-...
# Temporal (defaults are fine for local dev)
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
```

## Project layout (suggested)

```
.
├─ docs/
│  └─ README.md
├─ packages/
│  ├─ engine/                 # Temporal workflow + shared contracts
│  │  ├─ src/engine/workflow.ts
│  │  ├─ src/engine/spec.ts
│  │  ├─ src/shared/contracts.ts
│  │  └─ src/worker.ts        # Temporal worker registration
│  ├─ coordinator/            # Express or queue-based dispatcher
│  │  ├─ src/server.ts
│  │  └─ src/runner.ts        # runAgent(fn) + Claude client
│  ├─ specs/
│  │  ├─ hello/hello.spec.ts  # Phase 1 Spec
│  │  └─ codegen/codegen.spec.ts  # Phase 2 Spec
│  └─ cli/                    # Dev utilities to start/query/signal
│     └─ src/cli.ts
├─ docker/
│  └─ temporal/docker-compose.yml
└─ package.json (or a root workspace)
```

## Development quickstart

1. Start Temporal locally:

```
docker compose -f docker/temporal/docker-compose.yml up -d
```

2. Install packages and build:

```
yarn install
yarn build
```

3. Run the Temporal worker (EngineWorkflow):

```
yarn workspace engine start:worker
```

4. Start the coordinator/dispatcher:

```
yarn workspace coordinator start
```

5. Launch Phase 1 workflow (Hello World):

```
yarn workspace cli start:hello --workflow-id hello-1
```

This seeds an initial decision that requests `HELLO` work. The coordinator sees the `WAITING` step, calls the “hello agent” (Claude or a fake), and posts `agentCompleted`. The engine finalizes.

6. Inspect state:

```
yarn workspace cli state --workflow-id hello-1
```

## Signals used (contract)

* `applyDecision(decision)`

  * Adds requested work items to `openSteps` and may finalize the workflow.
* `agentCompleted(stepId, response)`

  * Marks a step `DONE` or `FAILED`, stores artifacts, and lets the Spec decide next actions.
* `approve(stepId)`

  * Marks an approval step as `DONE`.
* `custom(eventType, payload)`

  * Domain events (e.g., “ciStatusChanged”) without new core signal names.

## How the coordinator works

* Polls or queries `currentState()` for `WAITING` steps.
* For each `WAITING` step:

  * translates `workKind` + `payload` to a call into an agent
  * posts back `agentCompleted(stepId, response)` with idempotency keys
* In production, use a queue and backpressure; the simple dev coordinator is fine for local runs.

## Testing and dev loops

* Specs are pure functions; unit test them with fixture `EngineState` and `AgentResponse`.
* End-to-end: start Temporal, worker, coordinator, then trigger workflows and watch logs.
* Use `continueAsNew` in the engine once you exceed long histories (not usually needed for dev).

## Troubleshooting

* Signals not arriving: check you’re signaling the correct `workflowId` and the worker is running the same task queue.
* History too large: reduce artifacts logged in signals; offload big blobs to storage and store references.
* Non-determinism: do not perform any network I/O inside workflows; keep all side effects in coordinator/agents.

---

# Task list: empty folder → Phase 1 → Phase 2

The steps are grouped and sequenced. You can paste this into an issue tracker and check them off.

## 0. Bootstrap the repo

* [ ] Initialize workspace

  * `git init`
  * `yarn init -y` (or npm)
  * Configure Yarn workspaces or npm workspaces for `packages/*`
* [ ] Add TypeScript, ts-node, and basic tooling in each package

  * `yarn add -D typescript ts-node @types/node` (per package)
  * `npx tsc --init` in each package
* [ ] Create `docker/temporal/docker-compose.yml` using `temporalio/auto-setup`
* [ ] Add root `README` and this `docs/README.md`
* [ ] Add `.env.example` and `.gitignore`

## 1. Temporal engine package

* [ ] `packages/engine` with deps:

  * `@temporalio/worker @temporalio/client @temporalio/workflow zod`
* [ ] Implement `src/shared/contracts.ts` (AgentResponse, EngineDecision, EngineState, etc.)
* [ ] Implement `src/engine/spec.ts` (Spec interface)
* [ ] Implement `src/engine/workflow.ts` (EngineWorkflow with signals/queries)
* [ ] Implement `src/worker.ts` to register the workflow on a task queue, e.g. `engine`
* [ ] Scripts:

  * `start:worker`: runs the worker with ts-node
  * `build`: tsc build

## 2. Coordinator/dispatcher package

* [ ] `packages/coordinator` with deps:

  * `express axios zod @temporalio/client dotenv`
* [ ] `src/runner.ts`: `runAgent(kind, payload)` with a fake implementation returning `{ status: "OK", content: ... }`
* [ ] `src/server.ts`: polls `currentState()` and drives `agentCompleted`, or expose `/agent/callback` and a simple in-process loop
* [ ] Script:

  * `start`: starts coordinator on `http://localhost:3000`

## 3. CLI package for dev

* [ ] `packages/cli` with deps:

  * `@temporalio/client yargs dotenv`
* [ ] Commands:

  * `start:hello`: starts EngineWorkflow with `specName=hello` and a boot decision that requests `HELLO`
  * `state`: prints `currentState()` for a workflowId
  * `signal:custom`: send `custom(eventType, payload)`

## 4. Phase 1: Hello World Spec

* [ ] `packages/specs/hello/hello.spec.ts`:

  * On boot, request `HELLO` work
  * On `agentCompleted(HELLO, OK)`, set `finalize=true`
* [ ] Register the Spec with the Engine on import
* [ ] Coordinator’s `runAgent("HELLO")` returns an echo, e.g. `"Hello from Claude"`
* [ ] End-to-end test:

  * Start Temporal via docker
  * Run the worker
  * Run the coordinator
  * `yarn workspace cli start:hello --workflow-id hello-1`
  * Verify engine finalizes; `state` shows `COMPLETED`

## 5. Phase 2: integrate `agency-agents` and build Todo App generator

Assumptions: the agents in `bernierllc/agency-agents` are available locally or via a service you can call. You’re using Claude via `ANTHROPIC_API_KEY`.

* [ ] Bring in agents

  * Option A: add as a Git submodule under `external/agency-agents`
  * Option B: consume as a dependency if it’s packaged
* [ ] Create a Claude client helper in `coordinator`:

  * `src/llm/anthropic.ts` with `callClaude(messages, options)`
* [ ] Implement agent wrappers in `coordinator/src/agents/*.ts` that map `workKind` to specific agent prompts/tooling:

  * `REQUIREMENTS_TODO`
  * `GENERATE_TODO_APP` (outputs a small web app or repo plan)
  * `WRITE_README`
  * `BASIC_TESTS`
  * `REVIEW_PASS` (optional)
* [ ] Extend `runAgent(kind, payload)` to dispatch to these wrappers
* [ ] Create `packages/specs/codegen/codegen.spec.ts` (or `todo.spec.ts`) with minimal rules:

  * Boot actions:

    * `REQUEST_WORK: REQUIREMENTS_TODO` with a short prompt
  * On `REQUIREMENTS_TODO OK`:

    * `REQUEST_WORK: GENERATE_TODO_APP` (expects artifact links or file map)
  * On `GENERATE_TODO_APP OK`:

    * `REQUEST_WORK: WRITE_README`
    * `REQUEST_WORK: BASIC_TESTS`
  * Finalize when all three are `DONE`
* [ ] Add a thin “specific workflow” export:

  * `CodegenWorkflow` that simply re-exports `EngineWorkflow` with `specName="todo"`
* [ ] Wire artifacts storage

  * For dev, write generated files to `./out/<workflowId>/...` and store paths as artifacts on `agentCompleted`
* [ ] CLI commands:

  * `start:todo --workflow-id todo-1 --title "Build TODO app"`
  * `open:out --workflow-id todo-1` (optional convenience to open the output folder)

## 6. Hardening and polish

* [ ] Idempotency: coordinator stores `correlationId = stepId:runId` to ignore duplicate callbacks
* [ ] Search attributes: upsert `goalId`, `specName`, `status`
* [ ] Logging: structured logs in coordinator for prompts/responses and costs
* [ ] Basic unit tests for Spec transitions
* [ ] Optional: replace polling with a queue that receives “step requested” events

## 7. Run Phase 2 end-to-end

* [ ] Start Temporal, worker, coordinator
* [ ] `yarn workspace cli start:todo --workflow-id todo-1`
* [ ] Observe:

  * `REQUIREMENTS_TODO` requested → agent returns requirements
  * `GENERATE_TODO_APP` requested → agent writes scaffold into `./out/todo-1`
  * `WRITE_README`, `BASIC_TESTS` requested → agents produce docs/tests
  * Engine finalizes; CLI `state` shows `COMPLETED`
* [ ] Manually inspect generated app and README in `./out/todo-1`

## 8. Nice-to-have (later)

* [ ] Replace file artifacts with S3/GCS and store only references in workflow state
* [ ] Add `approve(stepId)` and a simple web UI to approve or override plan
* [ ] Add `custom("ciStatusChanged")` hook if you introduce CI in later phases
* [ ] Introduce `continueAsNew` every N events to cap history

If you want, I can also generate the initial package scaffolding and example code files so you can copy them in and run Phase 1 immediately.
