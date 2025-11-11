# Remaining Implementation Tasks

**Note:** This document continues from `/docs/plans/2025-11-07-agent-coordinator-implementation.md`

Tasks 1-4 are complete (Monorepo, Contracts, Storage, Engine). The following tasks complete the Phase 1 and Phase 2 implementation.

---

## Task 5: Coordinator Package with Dependency Injection

**Pattern:** Follow TDD approach from Task 3 (Storage)

**Key Files:**
- `packages/coordinator/src/builder.ts` - CoordinatorBuilder class
- `packages/coordinator/src/coordinator.ts` - Main coordinator with dispatch logic
- `packages/coordinator/src/logger.ts` - ConsoleLogger implementation
- `packages/coordinator/src/coordinator.test.ts` - Tests

**Implementation Steps:**
1. Write test for CoordinatorBuilder fluent API
2. Implement CoordinatorBuilder with validation
3. Write test for Coordinator.dispatchOnce()
4. Implement dispatcher with error signaling (not silent failures)
5. Implement ConsoleLogger with JSON structured output
6. Commit

---

## Task 6: HelloSpec (Phase 1)

**Key Files:**
- `packages/specs/hello/src/factory.ts` - HelloSpecFactory
- `packages/specs/hello/src/hello.spec.test.ts` - Unit tests

**Decision Logic:**
- Boot: Request `HELLO` work
- On `HELLO` OK: Finalize
- On error: Don't retry, finalize

**Implementation Steps:**
1. Write test for HelloSpec decision logic with fixture EngineState
2. Implement HelloSpecFactory and HelloSpec
3. Test with mock AgentResponse
4. Commit

---

## Task 7: TodoSpec (Phase 2)

**Key Files:**
- `packages/specs/todo/src/factory.ts` - TodoSpecFactory
- `packages/specs/todo/src/todo.spec.test.ts` - Unit tests

**Decision Logic:**
- Boot: Request `REQUIREMENTS_TODO`
- After requirements OK: Request `GENERATE_TODO_APP`
- After generation OK: Request `WRITE_README`, `BASIC_TESTS`, `PR_REVIEW` (parallel)
- Finalize when GEN, DOC, TEST all DONE

**Implementation Steps:**
1. Write test for TodoSpec sequential flow
2. Write test for TodoSpec parallel requests
3. Implement TodoSpec with all work kinds
4. Test retry logic for errors
5. Commit

---

## Task 8: MockAgent

**Key Files:**
- `packages/agents/mock/src/factory.ts` - MockAgentFactory
- `packages/agents/mock/src/mock.agent.test.ts` - Tests

**Supported Work Kinds:**
- `HELLO`, `REQUIREMENTS_TODO`, `GENERATE_TODO_APP`, `WRITE_README`, `BASIC_TESTS`, `PR_REVIEW`

**Implementation Steps:**
1. Write test verifying mock returns valid AgentResult schema
2. Implement MockAgent with deterministic responses
3. Add metrics (tokens, cost, latency) to responses
4. Test all supported work kinds
5. Commit

---

## Task 9: AnthropicAgent (Stub)

**Key Files:**
- `packages/agents/anthropic/src/factory.ts` - AnthropicAgentFactory
- `packages/agents/anthropic/src/anthropic.agent.test.ts` - Tests (mocked API)

**Implementation Steps:**
1. Add `@anthropic-ai/sdk` dependency
2. Write test with mocked Anthropic client
3. Implement AnthropicAgent with error mapping (429 → RATE_LIMITED, etc.)
4. Add circuit breaker placeholder (future)
5. Implement cost calculation based on token usage
6. Commit

---

## Task 10: CLI Tools

**Key Files:**
- `packages/cli/src/start-hello.ts` - Start Phase 1 workflow
- `packages/cli/src/start-todo.ts` - Start Phase 2 workflow
- `packages/cli/src/state.ts` - Query workflow state

**Implementation Steps:**
1. Implement start-hello.ts with bootDecision
2. Implement start-todo.ts with title annotation
3. Implement state.ts to query currentState
4. Add scripts to CLI package.json
5. Test locally with Temporal
6. Commit

---

## Task 11: Docker Compose Infrastructure

**Key Files:**
- `docker/docker-compose.yml` - Temporal Server + UI
- `docker/temporal/dynamicconfig/development.yaml` - Temporal config

**Implementation Steps:**
1. Create docker-compose.yml with Temporal + Temporal UI
2. Add health checks for Temporal server
3. Test `yarn infra:up` and verify UI at http://localhost:8080
4. Document access in README
5. Commit

---

## Task 12: End-to-End Test (Phase 1 Hello World)

**Test Flow:**
1. Start Temporal via Docker Compose
2. Start engine worker: `yarn workspace @coordinator/engine start:worker`
3. Start coordinator in dispatch mode
4. Run CLI: `yarn workspace @coordinator/cli start:hello`
5. Verify workflow completes with `COMPLETED` status
6. Verify Temporal UI shows workflow history

**Implementation:**
- Create `test/e2e/hello-world.test.ts`
- Use real Temporal (not TestWorkflowEnvironment)
- Verify end-to-end with MockAgent
- Document in README

---

## Task 13: End-to-End Test (Phase 2 Todo App)

**Test Flow:**
1. Same infrastructure as Task 12
2. Run CLI: `yarn workspace @coordinator/cli start:todo --title "My Todo App"`
3. Verify coordinator dispatches all agents (REQ, GEN, DOC, TEST, REVIEW)
4. Verify artifacts written to `./out/todo-1/`
5. Verify workflow finalizes correctly

**Implementation:**
- Create `test/e2e/todo-app.test.ts`
- Verify parallel work requests
- Verify artifact storage
- Document in README

---

## Task 14: Documentation

**Key Files:**
- `README.md` - Project overview, quickstart, development workflow
- `docs/DEVELOPMENT.md` - Detailed developer guide
- `docs/ARCHITECTURE.md` - Link to design document

**Content:**
- Prerequisites (Node.js, Docker, Yarn)
- Quick start (5-minute setup)
- Development workflow
- Testing strategy
- Troubleshooting common issues
- Link to design doc and expert reviews

---

## Execution Recommendations

**Total Estimated Time:** 12-16 hours for Tasks 5-14

**Suggested Approach:**
1. **Tasks 5-9 (Core Implementation):** 6-8 hours
   - Use TDD pattern established in Tasks 1-4
   - Frequent commits after each task

2. **Tasks 10-11 (CLI & Infrastructure):** 2-3 hours
   - Simple implementations, well-documented in design doc

3. **Tasks 12-13 (E2E Testing):** 3-4 hours
   - Critical for validating full system
   - May reveal integration issues

4. **Task 14 (Documentation):** 1 hour
   - Final polish for new developers

**Quality Gates:**
- All tests passing before commits
- TypeScript strict mode with zero errors
- ESLint clean
- Each task independently reviewable

**Next Steps:**
Review the detailed plan in `2025-11-07-agent-coordinator-implementation.md` for Tasks 1-4, then implement Tasks 5-14 following the same TDD pattern.
