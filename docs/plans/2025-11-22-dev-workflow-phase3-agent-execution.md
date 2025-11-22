# Dev Workflow Phase 3: AI-Powered Agent Execution - Design Document

**Date:** 2025-11-22
**Author:** Claude (AI Assistant)
**Status:** Design In Progress

**Related Documents:**
- [Phase 1: Foundation](/docs/plans/2025-11-21-dev-workflow-phase1-foundation.md)
- [Phase 2: Slack Integration](/docs/plans/2025-11-21-dev-workflow-phase2-slack-integration.md)
- [Turn-Based Coding Architecture](/packages/agents/package-builder-production/docs/architecture/turn-based-generation.md)

---

## Executive Summary

Phase 3 adds AI-powered task breakdown and code generation to dev-workflow, replacing Phase 2's mock tasks and simulated execution with real Claude-powered implementation. The system uses the existing turn-based coding workflow from `package-builder-production` for reliable, phase-by-phase code generation with automatic error recovery.

**Key Capabilities:**
- AI-powered task breakdown from user requirements
- Real code generation via turn-based Claude API calls
- Automatic test execution and error recovery
- Git feature branch workflow with automatic PR creation
- Slack milestone updates throughout execution

**Scope:** Full end-to-end automation from `/dev-workflow` command to ready-for-review Pull Request

---

## Requirements (Phase 1: Understanding)

### Core Requirements

1. **AI Integration**
   - Use turn-based coding workflow from `packages/agents/package-builder-production`
   - Workflow handles both task breakdown AND task execution
   - Being tested and finalized - stub out integration for now

2. **Architecture**
   - **Task Breakdown**: Single turn-based workflow run to analyze feature request and create intelligent task list
   - **Task Execution**: Separate turn-based workflow per task for code generation
   - **Orchestration**: New coordinator workflow to manage the entire process

3. **Git Workflow**
   - **Strategy**: Feature branch per workflow run
   - Branch naming: `feature/<feature-name>` (e.g., `feature/add-oauth2`)
   - All task commits go to feature branch
   - Automatic PR creation at completion

4. **Testing & Validation**
   - **When**: Run tests after each task completion
   - **On Failure**: Auto-retry with error feedback to Claude (max 3 retries)
   - **Test Suite**: Run full npm test for the repository
   - **Validation**: Each task must pass tests before proceeding to next

5. **Slack Integration**
   - **Update Frequency**: Milestone updates only (not every phase)
   - **Milestones**:
     - Workflow started
     - Task breakdown complete (with task count)
     - Each task started
     - Each task completed (with test results)
     - PR created (with link)
     - Workflow complete
   - **Error Notifications**: Send to Slack when tasks fail after retries

6. **Error Handling**
   - **Strategy**: Auto-retry with error feedback to Claude
   - **Retry Limit**: 3 attempts per task
   - **Feedback Loop**: Send test failures/errors back to Claude in conversation
   - **Escalation**: If task fails after 3 retries, notify user in Slack and pause workflow

7. **Scope Boundary**
   - **Phase 3 Delivers**: Full end-to-end automation
   - **Complete When**: Pull Request created and ready for human review
   - **Includes**: Planning → Code Generation → Testing → Auto-fix → PR Creation
   - **Excludes**: Auto-merge (requires human approval)

---

## Architectural Decision (Phase 2: Exploration)

### Chosen Approach: Orchestrator Pattern

**Decision**: Create new `DevWorkflowCoordinator` workflow that orchestrates specialized sub-workflows.

**Rationale:**
- Clean separation of concerns (planning, breakdown, execution)
- Each workflow testable independently
- Better observability (separate workflow IDs for each phase)
- Follows Temporal best practices for workflow composition
- Easier to add new capabilities later (e.g., code review, documentation)

**Rejected Alternatives:**

1. **Monolithic Workflow**: Extending `FeaturePlanningWorkflow` to include everything
   - ❌ Couples planning to execution
   - ❌ Harder to test pieces independently
   - ❌ Single failure point for entire flow

2. **Activity Delegation**: Call turn-based as long-running activities
   - ❌ Activities have timeout limits (max 10 minutes in Temporal)
   - ❌ Turn-based can take 25-35 minutes per run
   - ❌ Less flexibility for pause/resume/recovery

---

## Design (Phase 3: Design Presentation)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Slack Bot Server                              │
│         (Phase 2 - already implemented)                          │
│  - Receives /dev-workflow command                                │
│  - Starts DevWorkflowCoordinator                                 │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              DevWorkflowCoordinator (NEW)                        │
│                  Main orchestration workflow                     │
│                                                                  │
│  Step 1: Conversational Planning                                │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Call FeaturePlanningWorkflow                      │         │
│  │  - Slack Q&A with user                             │         │
│  │  - Plan approval                                   │         │
│  │  - Returns: refinedRequirement                     │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 2: Git Setup                                               │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Create feature branch                             │         │
│  │  - Branch: feature/<slugified-feature-name>        │         │
│  │  - Checkout branch                                 │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 3: AI Task Breakdown                                       │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Call TurnBasedCodingAgent                         │         │
│  │  - task: "breakdown-feature"                       │         │
│  │  - prompt: refinedRequirement                      │         │
│  │  - Returns: intelligentTaskList[]                  │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 4: Task Execution Loop                                     │
│  ┌────────────────────────────────────────────────────┐         │
│  │  FOR EACH task in intelligentTaskList:             │         │
│  │                                                     │         │
│  │    4a. Send Slack: "Starting task X: <name>"       │         │
│  │                                                     │         │
│  │    4b. Call TurnBasedCodingAgent                   │         │
│  │        - task: "implement-task"                    │         │
│  │        - prompt: task description                  │         │
│  │        - 15 phases execute internally              │         │
│  │        - Returns: filesModified[]                  │         │
│  │                                                     │         │
│  │    4c. Run Tests                                   │         │
│  │        - npm test (or repo-specific command)       │         │
│  │                                                     │         │
│  │    4d. Handle Test Results                         │         │
│  │        IF tests fail:                              │         │
│  │          - Retry with error feedback (max 3x)      │         │
│  │          - If still failing: notify Slack, pause   │         │
│  │        ELSE:                                        │         │
│  │          - Send Slack: "Task X complete ✅"        │         │
│  │                                                     │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 5: PR Creation                                             │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Create Pull Request                               │         │
│  │  - Title: from feature request                     │         │
│  │  - Body: task summary + results                    │         │
│  │  - Base: main (or current branch)                  │         │
│  │  - Head: feature branch                            │         │
│  └────────────────────────────────────────────────────┘         │
│                     │                                            │
│  Step 6: Completion                                              │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Send Slack: PR link + summary                     │         │
│  │  Return success with PR URL                        │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                     │
                     │ delegates to
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│           TurnBasedCodingAgentWorkflow                           │
│    (Existing - from package-builder-production)                  │
│                                                                  │
│  Used in two modes:                                              │
│                                                                  │
│  MODE 1: Task Breakdown (called once)                            │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Input: { task: "breakdown-feature",               │         │
│  │          prompt: refinedRequirement }              │         │
│  │  Output: intelligentTaskList[]                     │         │
│  │                                                     │         │
│  │  Phases executed:                                  │         │
│  │  - PLANNING: Analyze requirements                  │         │
│  │  - FOUNDATION: Define task structure               │         │
│  │  - TYPES: Define task metadata                     │         │
│  │  - CORE_IMPLEMENTATION: Generate task list         │         │
│  │  - (remaining phases skipped for breakdown)        │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
│  MODE 2: Task Implementation (called per task)                   │
│  ┌────────────────────────────────────────────────────┐         │
│  │  Input: { task: "implement-task",                  │         │
│  │          prompt: taskDescription }                 │         │
│  │  Output: { filesModified[], commits[] }            │         │
│  │                                                     │         │
│  │  All 15 phases executed:                           │         │
│  │  - PLANNING → FOUNDATION → TYPES →                 │         │
│  │  - CORE_IMPLEMENTATION → ENTRY_POINT →             │         │
│  │  - UTILITIES → ERROR_HANDLING → TESTING →          │         │
│  │  - DOCUMENTATION → EXAMPLES →                      │         │
│  │  - INTEGRATION_REVIEW → CRITICAL_FIXES →           │         │
│  │  - BUILD_VALIDATION → FINAL_POLISH                 │         │
│  └────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Interactions

**Sequence Diagram:**

```
User          SlackBot       DevWorkflowCoordinator    FeaturePlanningWF    TurnBasedCodingAgent
 │                │                    │                       │                    │
 │ /dev-workflow  │                    │                       │                    │
 │───────────────>│                    │                       │                    │
 │                │                    │                       │                    │
 │                │  start()           │                       │                    │
 │                │───────────────────>│                       │                    │
 │                │                    │                       │                    │
 │                │                    │  startChildWorkflow   │                    │
 │                │                    │──────────────────────>│                    │
 │                │                    │                       │                    │
 │                │                    │   (Slack Q&A)         │                    │
 │<───────────────────────────────────────────────────────────│                    │
 │  Questions     │                    │                       │                    │
 │───────────────────────────────────────────────────────────>│                    │
 │  Answers       │                    │                       │                    │
 │                │                    │                       │                    │
 │                │                    │  refinedRequirement   │                    │
 │                │                    │<──────────────────────│                    │
 │                │                    │                       │                    │
 │                │                    │  createFeatureBranch()│                    │
 │                │                    │───────────┐           │                    │
 │                │                    │           │           │                    │
 │                │                    │<──────────┘           │                    │
 │                │                    │                       │                    │
 │                │                    │  startChildWorkflow(breakdown-feature)     │
 │                │                    │───────────────────────────────────────────>│
 │                │                    │                       │                    │
 │                │                    │                       │  (15 phases...)    │
 │                │                    │                       │                    │
 │                │                    │  taskList[]           │                    │
 │                │                    │<───────────────────────────────────────────│
 │                │                    │                       │                    │
 │<───Slack: "Task breakdown complete: 5 tasks"───────────────────────────────────│
 │                │                    │                       │                    │
 │                │                    │  FOR EACH task:       │                    │
 │                │                    │    startChildWorkflow(implement-task)      │
 │                │                    │───────────────────────────────────────────>│
 │<───Slack: "Starting task 1"────────────────────────────────│                    │
 │                │                    │                       │  (15 phases...)    │
 │                │                    │  filesModified[]      │                    │
 │                │                    │<───────────────────────────────────────────│
 │                │                    │                       │                    │
 │                │                    │  runTests()           │                    │
 │                │                    │───────────┐           │                    │
 │                │                    │           │           │                    │
 │                │                    │<──────────┘           │                    │
 │<───Slack: "Task 1 complete ✅"─────────────────────────────│                    │
 │                │                    │                       │                    │
 │                │                    │  (repeat for all tasks)                    │
 │                │                    │                       │                    │
 │                │                    │  createPullRequest()  │                    │
 │                │                    │───────────┐           │                    │
 │                │                    │           │           │                    │
 │                │                    │<──────────┘           │                    │
 │                │                    │                       │                    │
 │<───Slack: "PR created: <link>"─────────────────────────────│                    │
 │                │                    │                       │                    │
```

---

## Component Details (To Be Completed)

### 1. DevWorkflowCoordinator Workflow

**File:** `packages/dev-workflow/src/workflows/dev-workflow-coordinator.workflow.ts`

*[Section to be completed in next design iteration]*

### 2. Turn-Based Integration Activities

**File:** `packages/dev-workflow/src/activities/turn-based-integration.activities.ts`

*[Section to be completed in next design iteration]*

### 3. Git Operations Activities

**File:** `packages/dev-workflow/src/activities/git-operations.activities.ts`

*[Section to be completed in next design iteration]*

### 4. Test Execution Activities

**File:** `packages/dev-workflow/src/activities/test-execution.activities.ts`

*[Section to be completed in next design iteration]*

---

## Data Flow (To Be Completed)

*[Section to be completed in next design iteration]*

---

## Error Handling (To Be Completed)

*[Section to be completed in next design iteration]*

---

## Testing Strategy (To Be Completed)

*[Section to be completed in next design iteration]*

---

## Implementation Notes

### Dependencies

**New Dependencies:**
- None - reuses existing `TurnBasedCodingAgentWorkflow` from `package-builder-production`

**Internal Dependencies:**
- `packages/agents/package-builder-production` (turn-based workflow)
- `packages/dev-workflow` (Phase 1 & 2 foundation)
- `@slack/bolt`, `@slack/web-api` (Phase 2 Slack integration)

### Configuration

**Environment Variables:**
```bash
# Existing (from Phase 1 & 2)
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
DEV_WORKFLOW_TASK_QUEUE=dev-workflow
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# New for Phase 3
ANTHROPIC_API_KEY=sk-ant-...           # Claude API key
GH_TOKEN=ghp_...                        # GitHub token for PR creation
DEFAULT_BASE_BRANCH=main                # Base branch for PRs
MAX_TASK_RETRIES=3                      # Max retries per task
```

---

## Success Criteria

Phase 3 is complete when:

- [ ] `/dev-workflow` command triggers full automation
- [ ] AI generates intelligent task breakdown from requirements
- [ ] Each task's code is generated via turn-based workflow
- [ ] Tests run after each task
- [ ] Failed tests trigger auto-fix with error feedback
- [ ] All tasks complete successfully
- [ ] Feature branch created with all commits
- [ ] Pull Request created automatically
- [ ] Slack updates sent at all milestones
- [ ] Full test coverage for new components
- [ ] Integration tests validate end-to-end flow

---

## Next Steps

1. **Complete Design Presentation**: Finish remaining component details, data flow, error handling, testing
2. **Design Documentation**: Finalize this document with complete sections
3. **Worktree Setup**: Create isolated workspace for Phase 3 development
4. **Implementation Plan**: Create detailed task breakdown with TDD approach

---

**Document Status:** Section 1 (Architecture Overview) complete, remaining sections in progress
