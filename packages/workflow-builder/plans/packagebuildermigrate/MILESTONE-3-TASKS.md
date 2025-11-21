# Milestone 3: AI Self-Healing - Detailed Task Breakdown

**Goal**: Ship self-healing workflows with AI remediation, prompt templates, context configuration, and decision routing within 6 weeks.

**Timeline**: Weeks 13-18
**Target Demo Date**: End of Week 18

---

## Executive Summary

### Critical Path (Longest Dependencies)
```
Database Schema (4h)
  → Backend AI Pattern (16h)
    → Context Builder (14h)
      → Prompt Template Engine (12h)
        → Decision Router (12h)
          → Frontend AI Toggle (14h)
            → E2E Testing (16h)

Total Critical Path: ~88 hours = ~2.5 weeks (with buffer)
```

### Team Structure
- **Backend Engineer 1**: AI remediation pattern, context builder, CoordinatorWorkflow integration
- **Backend Engineer 2**: Prompt template engine, decision routing, retry attempt tracking
- **Frontend Engineer 1**: AI toggle UI, prompt editor, context configuration UI
- **DevOps Engineer (0.5 FTE)**: Infrastructure support, AI service integration, monitoring
- **QA Engineer (0.5 FTE)**: Testing AI flows, validation, demo prep

### Parallelization Strategy
- **Week 13**: All teams work in parallel on foundations (build on M1+M2)
- **Week 14-15**: Frontend and backend converge on AI integration
- **Week 16**: Integration testing and AI flow validation
- **Week 17**: Demo preparation and documentation
- **Week 18**: Buffer for issues and final polish

---

## Phase 1: Foundation (Week 13)
**Goal**: Extend M2 foundations to support AI remediation, prompt templates, and context management

### Database Schema Tasks

#### M3-T001: Extend activity schema for AI remediation
**Owner**: Backend Engineer 2
**Dependencies**: M2 complete
**Parallel with**: M3-T010, M3-T020, M3-T030, M3-T040
**Estimate**: 4 hours

**Description**:
Extend the activity node schema to support AI remediation configuration: enabled flag, prompt template reference, context configuration, max retry attempts with AI.

**Acceptance Criteria**:
- [ ] Activity nodes can have `aiRemediation` field (enabled, promptTemplateId, contextConfig)
- [ ] `contextConfig` stores what to include (errorDetails, logs, code, environment)
- [ ] `maxAiRetries` field (default 3) limits AI remediation attempts
- [ ] Schema supports `remediationHistory` JSONB field (past AI fixes)
- [ ] Migration script created and tested locally
- [ ] TypeScript types updated in `src/types/database.ts`
- [ ] Can create activity with AI remediation enabled via SQL

**Testing Requirements**:
- [ ] Unit tests for schema validation
- [ ] Integration test: Create activity with AI remediation config
- [ ] Integration test: Query activities by AI enabled status
- [ ] Test migration rollback works

**Completion Requirements**:
- [ ] Code committed to feature branch `feature/milestone-3`
- [ ] All tests passing
- [ ] Type checking passes
- [ ] Documentation updated in `docs/database-schema.md`

**Deliverables**:
- `supabase/migrations/YYYYMMDD_extend_activity_ai_remediation.sql`
- `src/types/database.ts` (updated TypeScript types)
- `tests/integration/database/ai-remediation-schema.test.ts`
- `docs/database-schema.md` (schema documentation update)

---

#### M3-T002: Create prompt_templates table
**Owner**: Backend Engineer 2
**Dependencies**: M3-T001
**Parallel with**: M3-T011, M3-T021
**Estimate**: 3 hours

**Description**:
Create a new `prompt_templates` table to store reusable prompt templates for AI remediation.

**Acceptance Criteria**:
- [ ] Table has: id, name, description, template, variables, created_by, is_public
- [ ] `template` field stores prompt with variable placeholders ({{errorMessage}}, {{code}})
- [ ] `variables` JSONB stores metadata for available placeholders
- [ ] Index on name and created_by
- [ ] Can store default system prompt templates
- [ ] TypeScript types generated
- [ ] Validation for template syntax (no SQL injection, XSS)

**Testing Requirements**:
- [ ] Integration test: Create prompt template
- [ ] Integration test: Query templates by user
- [ ] Integration test: Validate template variables
- [ ] Test template rendering with sample data
- [ ] Test security: malicious template is rejected

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Documentation updated

**Deliverables**:
- `supabase/migrations/YYYYMMDD_create_prompt_templates.sql`
- `src/types/database.ts` (updated)
- `tests/integration/database/prompt-templates.test.ts`
- `docs/database-schema.md` (updated)

---

#### M3-T003: Create remediation_attempts table
**Owner**: Backend Engineer 2
**Dependencies**: M3-T001, M3-T002
**Parallel with**: M3-T012, M3-T022
**Estimate**: 3 hours

**Description**:
Create table to track AI remediation attempts: what was tried, what worked, what failed.

**Acceptance Criteria**:
- [ ] Table has: id, execution_id, activity_id, attempt_number, prompt_used, context_sent, ai_response, decision, success, created_at
- [ ] Foreign keys to executions and activities tables
- [ ] Index on execution_id and attempt_number
- [ ] Can store AI response (JSON) with suggested fix
- [ ] `decision` field (RETRY, FAIL, ESCALATE)
- [ ] Stores timing data (how long AI took to respond)
- [ ] Retention policy (delete after 30 days)

**Testing Requirements**:
- [ ] Integration test: Create remediation attempt record
- [ ] Integration test: Query attempts by execution_id
- [ ] Integration test: Update attempt with AI response
- [ ] Test retention policy (old attempts deleted)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Documentation updated

**Deliverables**:
- `supabase/migrations/YYYYMMDD_create_remediation_attempts.sql`
- `src/types/database.ts` (updated)
- `tests/integration/database/remediation-attempts.test.ts`

---

### Backend API Foundation Tasks

#### M3-T010: Enhance tRPC for AI remediation config
**Owner**: Backend Engineer 2
**Dependencies**: M3-T001
**Parallel with**: M3-T001, M3-T020, M3-T030
**Estimate**: 6 hours

**Description**:
Extend existing tRPC workflows router to support configuring AI remediation on activities.

**Acceptance Criteria**:
- [ ] `activities.enableAiRemediation` endpoint toggles AI for activity
- [ ] `activities.configureAi` endpoint sets prompt template and context config
- [ ] `activities.getAiConfig` endpoint retrieves current AI settings
- [ ] Input validation with Zod schemas for AI config
- [ ] Error handling for invalid prompt template references
- [ ] API returns detailed validation errors

**Testing Requirements**:
- [ ] Unit tests for AI config validation
- [ ] Integration test: Enable AI remediation on activity
- [ ] Integration test: Configure prompt template
- [ ] Test validation errors return 400 with details

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documentation updated

**Deliverables**:
- `src/server/api/routers/activities.ts` (enhanced)
- `src/server/api/schemas/ai-remediation.schemas.ts` (Zod schemas)
- `tests/integration/api/activities/ai-config.test.ts`
- `docs/api/activities.md` (updated)

---

#### M3-T011: Create prompt templates API endpoints
**Owner**: Backend Engineer 2
**Dependencies**: M3-T002, M3-T010
**Parallel with**: M3-T012, M3-T021, M3-T031
**Estimate**: 8 hours

**Description**:
Create tRPC endpoints for managing prompt templates: create, update, delete, list, get, render.

**Acceptance Criteria**:
- [ ] `promptTemplates.create` endpoint creates new template
- [ ] `promptTemplates.update` endpoint updates template content
- [ ] `promptTemplates.delete` endpoint removes template (soft delete)
- [ ] `promptTemplates.list` endpoint lists templates (user's + public)
- [ ] `promptTemplates.get` endpoint retrieves single template
- [ ] `promptTemplates.render` endpoint renders template with data (for preview)
- [ ] Validation for template variables and syntax
- [ ] Security: sanitize templates, prevent code injection

**Testing Requirements**:
- [ ] Unit tests for each endpoint
- [ ] Integration tests with Supabase
- [ ] Test template rendering with various inputs
- [ ] Security test: malicious template rejected
- [ ] Test public vs. private template access

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documentation complete

**Deliverables**:
- `src/server/api/routers/prompt-templates.ts`
- `src/server/api/schemas/prompt-template.schemas.ts`
- `tests/integration/api/prompt-templates/endpoints.test.ts`
- `docs/api/prompt-templates.md`

---

#### M3-T012: Create remediation history API endpoints
**Owner**: Backend Engineer 2
**Dependencies**: M3-T003, M3-T010
**Parallel with**: M3-T011, M3-T021, M3-T031
**Estimate**: 6 hours

**Description**:
Create tRPC endpoints to query and track AI remediation attempts and history.

**Acceptance Criteria**:
- [ ] `remediation.listAttempts` endpoint lists attempts for execution
- [ ] `remediation.getAttempt` endpoint retrieves single attempt details
- [ ] `remediation.getHistory` endpoint retrieves history for activity
- [ ] Returns AI response, decision, timing data
- [ ] Can filter by decision type (RETRY/FAIL/ESCALATE)
- [ ] Pagination support for large histories

**Testing Requirements**:
- [ ] Unit tests for each endpoint
- [ ] Integration test: Query remediation history
- [ ] Integration test: Filter by decision type
- [ ] Test pagination works correctly

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] API documentation complete

**Deliverables**:
- `src/server/api/routers/remediation.ts`
- `src/server/api/schemas/remediation.schemas.ts`
- `tests/integration/api/remediation/endpoints.test.ts`
- `docs/api/remediation.md`

---

### Pattern Compiler Tasks

#### M3-T020: Build AI remediation pattern compiler
**Owner**: Backend Engineer 1
**Dependencies**: M1-T021 (code generator), M2-T022 (retry pattern)
**Parallel with**: M3-T001, M3-T010, M3-T030
**Estimate**: 16 hours

**Description**:
Create new compiler pattern for generating AI remediation code that spawns CoordinatorWorkflow on activity failures. This is the CORE of M3.

**Acceptance Criteria**:
- [ ] Compiles AI-enabled activity to TypeScript with error handling
- [ ] Generates code to spawn CoordinatorWorkflow child workflow on failure
- [ ] Passes error context, code, logs to CoordinatorWorkflow
- [ ] Generates code to wait for CoordinatorWorkflow decision (RETRY/FAIL/ESCALATE)
- [ ] Handles RETRY decision: re-execute activity with AI-suggested fix
- [ ] Handles FAIL decision: propagate error to parent workflow
- [ ] Handles ESCALATE decision: send notification, then fail
- [ ] Produces TypeScript that passes `tsc --noEmit`
- [ ] Generated code follows Temporal best practices (child workflows, signals)
- [ ] Includes proper error handling (CoordinatorWorkflow itself can fail)

**Testing Requirements**:
- [ ] Unit test: Compile AI-enabled activity (simple)
- [ ] Unit test: Compile AI-enabled activity (with nested error handling)
- [ ] Unit test: Generated code spawns child workflow on failure
- [ ] Test generated code compiles with TypeScript
- [ ] Integration test: Execute generated code, force failure, verify CoordinatorWorkflow spawned

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Compiler generates production-ready code

**Deliverables**:
- `src/lib/workflow-compiler/patterns/ai-remediation-pattern.ts`
- `src/lib/workflow-compiler/coordinator-integration.ts`
- `tests/unit/compiler/ai-remediation-pattern.test.ts`
- `tests/integration/compiler/ai-remediation-execution.test.ts`

---

#### M3-T021: Implement context builder
**Owner**: Backend Engineer 1
**Dependencies**: M3-T020
**Parallel with**: M3-T011, M3-T031, M3-T041
**Estimate**: 14 hours

**Description**:
Build context builder that collects relevant information (error, logs, code, environment) to send to AI for remediation.

**Acceptance Criteria**:
- [ ] Collects error details: message, stack trace, error type
- [ ] Collects activity logs: last N log lines (configurable, default 100)
- [ ] Collects relevant code: activity function source, workflow context
- [ ] Collects environment: Temporal version, Node version, dependencies
- [ ] Supports context configuration: choose what to include/exclude
- [ ] Limits context size (max 50KB to avoid AI token limits)
- [ ] Sanitizes sensitive data (passwords, API keys) before sending
- [ ] Formats context as JSON for AI consumption
- [ ] Generates helpful context summary for AI prompt

**Testing Requirements**:
- [ ] Unit test: Build context from error (each component)
- [ ] Unit test: Context size limits enforced
- [ ] Unit test: Sensitive data sanitized (regex for API keys, passwords)
- [ ] Integration test: Build context from real failed activity
- [ ] Test context is valid JSON and under size limit

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Context builder is production-ready

**Deliverables**:
- `src/lib/ai/context-builder.ts`
- `src/lib/ai/context-sanitizer.ts`
- `src/lib/ai/context-formatter.ts`
- `tests/unit/ai/context-builder.test.ts`
- `tests/integration/ai/context-integration.test.ts`

---

#### M3-T022: Implement prompt template engine
**Owner**: Backend Engineer 2
**Dependencies**: M3-T021, M3-T011
**Parallel with**: M3-T032, M3-T042
**Estimate**: 12 hours

**Description**:
Create prompt template engine that renders templates with context variables for AI prompts.

**Acceptance Criteria**:
- [ ] Renders templates with variable placeholders ({{varName}})
- [ ] Supports all context variables: {{errorMessage}}, {{stackTrace}}, {{code}}, {{logs}}, {{environment}}
- [ ] Supports conditionals: {{#if varName}}...{{/if}}
- [ ] Supports loops: {{#each array}}...{{/each}}
- [ ] Validates template syntax before rendering
- [ ] Escapes special characters to prevent injection
- [ ] Provides helpful error messages for invalid templates
- [ ] Supports default system prompt (fallback if no template specified)
- [ ] Optimizes prompt length (trim if too long for AI model)

**Testing Requirements**:
- [ ] Unit test: Render simple template with variables
- [ ] Unit test: Render template with conditionals
- [ ] Unit test: Render template with loops
- [ ] Unit test: Invalid template syntax shows error
- [ ] Unit test: Injection attempt is blocked
- [ ] Integration test: Render with real context from failed activity

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Template engine is production-ready

**Deliverables**:
- `src/lib/ai/prompt-template-engine.ts`
- `src/lib/ai/template-validator.ts`
- `src/lib/ai/template-helpers.ts` (conditional, loop helpers)
- `tests/unit/ai/prompt-template-engine.test.ts`
- `tests/integration/ai/template-rendering.test.ts`

---

### CoordinatorWorkflow Integration Tasks

#### M3-T030: Integrate with existing CoordinatorWorkflow
**Owner**: Backend Engineer 1
**Dependencies**: M3-T020
**Parallel with**: M3-T001, M3-T010, M3-T040
**Estimate**: 12 hours

**Description**:
Review and integrate with existing CoordinatorWorkflow at `packages/temporal-coordinator/` to ensure spawning from workflow-builder workflows works correctly.

**Acceptance Criteria**:
- [ ] Can spawn CoordinatorWorkflow as child workflow from compiled workflows
- [ ] Passes error context, prompt, configuration to CoordinatorWorkflow
- [ ] CoordinatorWorkflow returns decision (RETRY, FAIL, ESCALATE) via result
- [ ] Parent workflow receives decision and acts accordingly
- [ ] Can monitor CoordinatorWorkflow execution from parent
- [ ] Handles CoordinatorWorkflow failure gracefully (timeout, error)
- [ ] Supports custom AI model configuration (model name, temperature, max tokens)
- [ ] Logs all CoordinatorWorkflow interactions for debugging

**Testing Requirements**:
- [ ] Integration test: Spawn CoordinatorWorkflow from test workflow
- [ ] Integration test: CoordinatorWorkflow returns RETRY, parent retries
- [ ] Integration test: CoordinatorWorkflow returns FAIL, parent fails
- [ ] Integration test: CoordinatorWorkflow returns ESCALATE, parent escalates
- [ ] Integration test: CoordinatorWorkflow timeout handled
- [ ] Test monitoring CoordinatorWorkflow from parent workflow

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Integration is production-ready

**Deliverables**:
- `src/lib/temporal/coordinator-client.ts`
- `src/lib/temporal/coordinator-integration.ts`
- `tests/integration/temporal/coordinator-spawning.test.ts`
- `docs/architecture/coordinator-integration.md`

---

#### M3-T031: Implement decision routing logic
**Owner**: Backend Engineer 2
**Dependencies**: M3-T030, M3-T022
**Parallel with**: M3-T011, M3-T021, M3-T041
**Estimate**: 12 hours

**Description**:
Create decision routing logic that handles CoordinatorWorkflow decisions: RETRY, FAIL, ESCALATE.

**Acceptance Criteria**:
- [ ] RETRY decision: re-execute activity with AI-suggested fix (apply code patch)
- [ ] FAIL decision: propagate error to parent workflow (with AI context)
- [ ] ESCALATE decision: send notification (Slack, email) then fail
- [ ] Tracks decision routing in execution history
- [ ] Logs all decisions and actions taken
- [ ] Handles invalid decisions (default to FAIL)
- [ ] Supports custom decision handlers (extensible)
- [ ] Enforces max retry limit (prevents infinite loops)

**Testing Requirements**:
- [ ] Unit test: Route RETRY decision correctly
- [ ] Unit test: Route FAIL decision correctly
- [ ] Unit test: Route ESCALATE decision correctly
- [ ] Integration test: Execute workflow, RETRY works
- [ ] Integration test: Execute workflow, FAIL works
- [ ] Integration test: Execute workflow, ESCALATE sends notification
- [ ] Test max retry limit enforced

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Decision routing is production-ready

**Deliverables**:
- `src/lib/ai/decision-router.ts`
- `src/lib/ai/retry-handler.ts`
- `src/lib/ai/escalation-handler.ts`
- `tests/unit/ai/decision-router.test.ts`
- `tests/integration/ai/decision-routing.test.ts`
- `docs/architecture/decision-routing.md`

---

### DevOps Foundation Tasks

#### M3-T032: Set up AI service integration
**Owner**: DevOps Engineer
**Dependencies**: M3-T022
**Parallel with**: M3-T022, M3-T042
**Estimate**: 8 hours

**Description**:
Set up integration with AI service (OpenAI, Claude, or similar) for AI remediation. Configure API keys, rate limits, monitoring.

**Acceptance Criteria**:
- [ ] AI service API keys configured securely (environment variables)
- [ ] Rate limiting configured (prevent API abuse)
- [ ] Timeout configuration (default 30s for AI response)
- [ ] Retry logic for AI service failures (exponential backoff)
- [ ] Cost tracking enabled (log API usage)
- [ ] Can switch AI models via configuration (GPT-4, Claude, etc.)
- [ ] Health check endpoint for AI service availability
- [ ] Monitoring alerts for AI service failures

**Testing Requirements**:
- [ ] Test: AI service call succeeds
- [ ] Test: AI service call timeout handled
- [ ] Test: AI service failure retries correctly
- [ ] Test: Rate limiting prevents abuse
- [ ] Test: Cost tracking logs usage

**Completion Requirements**:
- [ ] AI service integrated
- [ ] Monitoring configured
- [ ] Documentation updated

**Deliverables**:
- `src/lib/ai/ai-service-client.ts`
- `config/ai-service.config.ts`
- `monitoring/dashboards/ai-service.json` (Grafana dashboard)
- `docs/deployment/ai-service-setup.md`

---

#### M3-T033: Enhance monitoring for AI remediation
**Owner**: DevOps Engineer
**Dependencies**: M3-T032
**Parallel with**: M3-T031, M3-T041
**Estimate**: 6 hours

**Description**:
Enhance Temporal monitoring and logging to track AI remediation attempts, decisions, and success rates.

**Acceptance Criteria**:
- [ ] Temporal Web UI shows AI remediation attempts
- [ ] Logs include AI prompt sent, response received, decision made
- [ ] Dashboards show AI success rate (% of failures fixed by AI)
- [ ] Dashboards show AI decision distribution (RETRY/FAIL/ESCALATE %)
- [ ] Dashboards show AI response time (average, p95, p99)
- [ ] Alerting on low AI success rate (<50%)
- [ ] Cost tracking dashboard (AI API usage $)

**Testing Requirements**:
- [ ] Test: Execute workflow with AI, verify attempt shown in UI
- [ ] Test: AI decision logged correctly
- [ ] Test: Dashboard shows AI metrics
- [ ] Test: Alerts fire on low success rate

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Monitoring dashboards deployed
- [ ] Documentation updated

**Deliverables**:
- `docker/temporal/ai-monitoring.yaml` (custom metrics)
- `monitoring/dashboards/ai-remediation.json` (Grafana dashboard)
- `docs/monitoring/ai-remediation.md`

---

### Frontend Foundation Tasks

#### M3-T040: Design and implement AI remediation toggle
**Owner**: Frontend Engineer 1
**Dependencies**: M1-T042 (property panel)
**Parallel with**: M3-T001, M3-T010, M3-T020, M3-T030
**Estimate**: 14 hours

**Description**:
Create UI for enabling/disabling AI remediation on activity nodes in PropertyPanel.

**Acceptance Criteria**:
- [ ] PropertyPanel shows "AI Remediation" section for activities
- [ ] Toggle switch to enable/disable AI remediation
- [ ] When enabled, shows additional configuration options
- [ ] Dropdown to select prompt template (user's + public templates)
- [ ] Preview button shows rendered prompt with sample error data
- [ ] Context configuration: checkboxes for what to include (error, logs, code, env)
- [ ] Max AI retries slider (1-5, default 3)
- [ ] Shows estimated AI cost per attempt (based on context size)
- [ ] Inline help text explaining AI remediation
- [ ] Changes auto-save (debounced)
- [ ] Visual indicator on node when AI is enabled (badge, icon)

**Testing Requirements**:
- [ ] Unit tests for toggle component
- [ ] E2E test: Enable AI remediation on activity
- [ ] E2E test: Select prompt template
- [ ] E2E test: Configure context options
- [ ] E2E test: Preview prompt renders correctly
- [ ] Visual regression test: AI toggle appearance

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/PropertyPanel.tsx` (enhanced)
- `src/components/workflow/forms/AiRemediationConfigForm.tsx`
- `src/components/workflow/AiPreviewModal.tsx`
- `tests/e2e/workflow-canvas/ai-remediation-toggle.spec.ts`
- `tests/unit/workflow/ai-remediation-config.test.tsx`

---

#### M3-T041: Create prompt template editor
**Owner**: Frontend Engineer 1
**Dependencies**: M3-T040, M3-T011
**Parallel with**: M3-T021, M3-T031, M3-T051
**Estimate**: 16 hours

**Description**:
Create UI for creating, editing, and managing prompt templates for AI remediation.

**Acceptance Criteria**:
- [ ] Template editor with syntax highlighting (Handlebars-style)
- [ ] Variable autocomplete (suggests available context variables)
- [ ] Template validation (shows errors in real-time)
- [ ] Preview panel (renders template with sample data)
- [ ] List of user's templates (sortable, filterable)
- [ ] List of public/system templates (read-only)
- [ ] Create new template button
- [ ] Edit template (saves to database)
- [ ] Delete template (with confirmation)
- [ ] Duplicate template (copy existing to create new)
- [ ] Template metadata: name, description, tags
- [ ] Template version history (optional - nice to have)
- [ ] Share template (make public) with confirmation

**Testing Requirements**:
- [ ] Unit tests for template editor component
- [ ] E2E test: Create new template
- [ ] E2E test: Edit template, verify saves
- [ ] E2E test: Delete template, verify confirmation
- [ ] E2E test: Preview renders correctly
- [ ] E2E test: Validation shows errors for invalid syntax

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/ai/PromptTemplateEditor.tsx`
- `src/components/ai/PromptTemplateList.tsx`
- `src/components/ai/PromptPreviewPanel.tsx`
- `src/lib/ai/template-syntax-highlighter.ts`
- `tests/e2e/ai/prompt-template-editor.spec.ts`
- `tests/unit/ai/prompt-template-editor.test.tsx`

---

#### M3-T042: Create context configuration UI
**Owner**: Frontend Engineer 1
**Dependencies**: M3-T040
**Parallel with**: M3-T022, M3-T052
**Estimate**: 10 hours

**Description**:
Create UI for configuring what context to include when sending to AI for remediation.

**Acceptance Criteria**:
- [ ] Checkboxes for context components: Error Details, Stack Trace, Logs, Code, Environment
- [ ] Each checkbox has description (what it includes, why useful)
- [ ] Log lines slider (how many log lines to include, 10-1000)
- [ ] Code context dropdown (none, activity only, activity + workflow, full codebase)
- [ ] Environment details checkboxes (Node version, dependencies, Temporal version)
- [ ] Shows estimated context size (bytes, MB) as you configure
- [ ] Warning if context size exceeds AI model limits (e.g., >100KB)
- [ ] Preset buttons: "Minimal", "Standard", "Comprehensive"
- [ ] Changes auto-save
- [ ] Inline help text for each option

**Testing Requirements**:
- [ ] Unit tests for context config form
- [ ] E2E test: Configure context options
- [ ] E2E test: Use preset (Minimal, Standard, Comprehensive)
- [ ] E2E test: Warning shows when context too large
- [ ] Test context size calculation is accurate

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow/forms/ContextConfigForm.tsx`
- `src/components/workflow/ContextSizeEstimator.tsx`
- `tests/e2e/workflow-canvas/context-config.spec.ts`
- `tests/unit/workflow/context-config-form.test.tsx`

---

## Phase 2: Integration (Weeks 14-15)
**Goal**: Connect frontend and backend for AI self-healing workflows

### Frontend Integration Tasks

#### M3-T050: Implement retry attempt visualization
**Owner**: Frontend Engineer 1
**Dependencies**: M3-T042, M3-T040, M3-T012
**Parallel with**: M3-T051, M3-T061
**Estimate**: 16 hours

**Description**:
Enhance execution monitoring UI to visualize AI remediation attempts: what was tried, what worked, what failed.

**Acceptance Criteria**:
- [ ] Execution panel shows AI remediation attempts (expandable timeline)
- [ ] Each attempt shows: attempt number, prompt used, AI response summary, decision made
- [ ] Can expand attempt to see full AI response (JSON)
- [ ] Shows timing: when attempt started, how long AI took, when decision made
- [ ] Visual indicators: success (green check), failure (red X), pending (spinner)
- [ ] Shows which attempt succeeded (if any)
- [ ] Can view full context sent to AI (button to expand modal)
- [ ] Can view full AI response (raw JSON in modal)
- [ ] Timeline visualization (horizontal or vertical)
- [ ] Filtering: show only AI attempts, show only manual retries

**Testing Requirements**:
- [ ] E2E test: Execute workflow with AI, verify attempts shown
- [ ] E2E test: Expand attempt, view full AI response
- [ ] E2E test: View context sent to AI
- [ ] E2E test: Timeline shows correct order
- [ ] E2E test: Filtering works (AI only, manual only)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is production-ready

**Deliverables**:
- `src/components/workflow-execution/AiRemediationTimeline.tsx`
- `src/components/workflow-execution/AiAttemptCard.tsx`
- `src/components/workflow-execution/AiResponseModal.tsx`
- `tests/e2e/execution/ai-remediation-visualization.spec.ts`

---

#### M3-T051: Build AI decision display
**Owner**: Frontend Engineer 1
**Dependencies**: M3-T050
**Parallel with**: M3-T061
**Estimate**: 10 hours

**Description**:
Create UI components to display AI decision routing: RETRY, FAIL, ESCALATE with explanations.

**Acceptance Criteria**:
- [ ] Decision badge shows decision type (RETRY in green, FAIL in red, ESCALATE in yellow)
- [ ] Each decision has icon and label
- [ ] Displays AI explanation (why this decision was made)
- [ ] For RETRY: shows what AI suggested fixing (code diff preview)
- [ ] For FAIL: shows error details and why AI couldn't fix
- [ ] For ESCALATE: shows who was notified and when
- [ ] Decision details are expandable (see full reasoning)
- [ ] Can provide feedback on AI decision (thumbs up/down - optional)
- [ ] Links to remediation attempt that made decision

**Testing Requirements**:
- [ ] E2E test: View RETRY decision with fix suggestion
- [ ] E2E test: View FAIL decision with explanation
- [ ] E2E test: View ESCALATE decision with notification details
- [ ] E2E test: Expand decision to see full reasoning
- [ ] Visual regression test: Decision badges

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Component is production-ready

**Deliverables**:
- `src/components/workflow-execution/AiDecisionBadge.tsx`
- `src/components/workflow-execution/AiDecisionDetails.tsx`
- `src/components/workflow-execution/FixSuggestionPreview.tsx`
- `tests/e2e/execution/ai-decision-display.spec.ts`

---

### Backend Integration Tasks

#### M3-T060: Build AI remediation execution service
**Owner**: Backend Engineer 1
**Dependencies**: M3-T031, M3-T030
**Parallel with**: M3-T050, M3-T061
**Estimate**: 16 hours

**Description**:
Create service layer that manages AI remediation execution lifecycle: collect context, call AI, route decision.

**Acceptance Criteria**:
- [ ] Service orchestrates full AI remediation flow
- [ ] Collects context using context builder
- [ ] Renders prompt using template engine
- [ ] Calls AI service (OpenAI, Claude) with prompt
- [ ] Parses AI response (extracts decision and reasoning)
- [ ] Routes decision using decision router
- [ ] Stores remediation attempt in database
- [ ] Handles AI service failures gracefully (timeout, error, rate limit)
- [ ] Enforces max retry limit
- [ ] Returns result to parent workflow

**Testing Requirements**:
- [ ] Unit tests for remediation service
- [ ] Integration test: Execute remediation flow end-to-end (mock AI)
- [ ] Integration test: AI returns RETRY, verify activity retried
- [ ] Integration test: AI returns FAIL, verify workflow fails
- [ ] Integration test: AI service timeout handled
- [ ] Test max retry limit enforced

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Service is production-ready

**Deliverables**:
- `src/lib/ai/remediation-service.ts`
- `src/lib/ai/ai-response-parser.ts`
- `tests/integration/ai/remediation-service.test.ts`
- `docs/architecture/ai-remediation-flow.md`

---

#### M3-T061: Implement AI retry orchestration
**Owner**: Backend Engineer 2
**Dependencies**: M3-T060, M3-T031
**Parallel with**: M3-T050, M3-T051
**Estimate**: 14 hours

**Description**:
Implement orchestration logic that coordinates AI remediation attempts with workflow execution.

**Acceptance Criteria**:
- [ ] Detects activity failure automatically
- [ ] Triggers AI remediation if enabled on activity
- [ ] Waits for AI decision (with timeout)
- [ ] Applies AI-suggested fix if decision is RETRY
- [ ] Re-executes activity with fix applied
- [ ] Tracks all attempts in execution history
- [ ] Handles multiple sequential attempts (attempt 1 fails, AI tries again)
- [ ] Stops after max attempts reached
- [ ] Falls back to standard error handling if AI disabled

**Testing Requirements**:
- [ ] Integration test: Activity fails, AI remediates, activity succeeds on retry
- [ ] Integration test: Activity fails 3 times, AI gives up, workflow fails
- [ ] Integration test: AI disabled, falls back to standard retry
- [ ] Integration test: Multiple activities with AI in same workflow
- [ ] Test concurrent AI remediation (multiple activities failing)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Orchestration is production-ready

**Deliverables**:
- `src/lib/ai/retry-orchestrator.ts`
- `src/lib/ai/fix-applicator.ts` (applies AI-suggested fixes)
- `tests/integration/ai/retry-orchestration.test.ts`
- `docs/architecture/ai-retry-orchestration.md`

---

### Deployment Integration Tasks

#### M3-T070: Enhance deployment pipeline for AI workflows
**Owner**: Backend Engineer 1
**Dependencies**: M3-T061, M3-T051
**Parallel with**: M3-T071
**Estimate**: 10 hours

**Description**:
Extend deployment pipeline to validate AI-enabled workflows, compile AI patterns, and register with worker.

**Acceptance Criteria**:
- [ ] Validates AI configuration before deployment
- [ ] Validates prompt template exists and is valid
- [ ] Validates context configuration is reasonable (not too large)
- [ ] Compiles AI remediation patterns into workflow code
- [ ] Deployment fails gracefully with detailed validation errors
- [ ] Can deploy workflow with multiple AI-enabled activities
- [ ] Rollback works if deployment fails
- [ ] Logs AI configuration for deployed workflows

**Testing Requirements**:
- [ ] Integration test: Deploy valid AI workflow succeeds
- [ ] Integration test: Deploy invalid workflow (bad template) fails with error
- [ ] Integration test: Deploy workflow with AI, execute successfully
- [ ] Integration test: Rollback on failure cleans up artifacts
- [ ] Test multiple AI activities in single workflow

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Deployment is production-ready

**Deliverables**:
- `src/lib/workflow-compiler/deployment.ts` (enhanced)
- `src/lib/workflow-compiler/ai-validator.ts`
- `tests/integration/deployment/ai-workflows.test.ts`
- `docs/architecture/ai-deployment.md`

---

#### M3-T071: Enhance execution monitoring for AI workflows
**Owner**: Frontend Engineer 1
**Dependencies**: M3-T061, M3-T050
**Parallel with**: M3-T070
**Estimate**: 12 hours

**Description**:
Final polish on execution monitoring UI for AI workflows: real-time updates, performance, UX.

**Acceptance Criteria**:
- [ ] Real-time updates as AI attempts occur (polling every 2 seconds)
- [ ] Shows current status: "AI analyzing error...", "AI suggested fix...", "Retrying with fix..."
- [ ] Progress indicator for AI response (waiting for AI can take 10-30s)
- [ ] Smooth animations for attempt timeline updates
- [ ] Performance: handles 10+ AI attempts without lag
- [ ] Error states: AI service down, timeout, rate limit exceeded
- [ ] Can refresh attempt list manually (refresh button)
- [ ] Attempt details load on demand (not all at once)

**Testing Requirements**:
- [ ] E2E test: Monitor workflow with AI in real-time
- [ ] E2E test: Real-time updates appear correctly
- [ ] E2E test: Progress indicator shows during AI wait
- [ ] E2E test: Error states display correctly
- [ ] Performance test: 10 AI attempts render without lag

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] UI is production-ready

**Deliverables**:
- `src/components/workflow-execution/WorkflowExecutionPanel.tsx` (enhanced for AI)
- `src/hooks/useAiAttempts.ts` (real-time polling)
- `tests/e2e/execution/ai-monitoring-realtime.spec.ts`

---

## Phase 3: Testing & Polish (Week 16)
**Goal**: Comprehensive testing, bug fixes, polish UI/UX for AI features

### Integration Testing Tasks

#### M3-T080: End-to-end AI self-healing test suite
**Owner**: QA Engineer
**Dependencies**: M3-T071, M3-T070
**Parallel with**: M3-T081, M3-T082
**Estimate**: 16 hours

**Description**:
Create comprehensive E2E test suite covering AI self-healing workflow creation, deployment, and execution.

**Acceptance Criteria**:
- [ ] Test: Create workflow with AI-enabled activity, deploy, execute, force failure, verify AI remediates
- [ ] Test: AI returns RETRY, verify activity retries with fix
- [ ] Test: AI returns FAIL, verify workflow fails gracefully
- [ ] Test: AI returns ESCALATE, verify notification sent
- [ ] Test: Create custom prompt template, use in workflow, verify works
- [ ] Test: Configure context options, verify correct context sent to AI
- [ ] Test: Max AI retries reached, verify fallback to standard error handling
- [ ] Test: View AI attempt visualization, verify all data shown correctly
- [ ] All tests pass consistently (no flakiness)

**Testing Requirements**:
- [ ] Tests use Playwright with page object pattern
- [ ] Tests mock AI service (predictable responses)
- [ ] Tests clean up after themselves (delete test workflows, templates)
- [ ] Tests are isolated (can run in parallel)
- [ ] Tests have proper waits (no arbitrary sleeps)
- [ ] Tests verify both UI and backend state

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing in CI
- [ ] Test coverage report shows >80%

**Deliverables**:
- `tests/e2e/workflows/ai-self-healing.spec.ts`
- `tests/e2e/ai/prompt-templates.spec.ts`
- `tests/e2e/ai/context-configuration.spec.ts`
- `tests/e2e/workflows/page-objects/AiWorkflowBuilder.ts`
- `tests/e2e/mocks/ai-service-mock.ts`

---

#### M3-T081: Integration test suite for AI remediation engine
**Owner**: Backend Engineer 1
**Dependencies**: M3-T060, M3-T061
**Parallel with**: M3-T080, M3-T082
**Estimate**: 12 hours

**Description**:
Create integration tests that verify AI remediation engine works correctly end-to-end with real Temporal workflows.

**Acceptance Criteria**:
- [ ] Test: Execute workflow, activity fails, AI remediates, activity succeeds
- [ ] Test: Execute workflow, AI returns RETRY, verify retry occurs with fix
- [ ] Test: Execute workflow, AI returns FAIL, verify workflow fails
- [ ] Test: Execute workflow, AI returns ESCALATE, verify escalation occurs
- [ ] Test: Execute workflow, max AI retries reached, verify stops
- [ ] Test: Execute workflow with multiple AI-enabled activities
- [ ] Test: AI service timeout handled gracefully
- [ ] Test: Context builder collects correct information
- [ ] Test: Prompt template renders correctly with real context

**Testing Requirements**:
- [ ] Tests use real Temporal instance (from docker-compose)
- [ ] Tests mock AI service (deterministic responses)
- [ ] Tests have proper cleanup (unregister workflows)
- [ ] Tests verify actual Temporal execution (not mocked)
- [ ] Tests measure AI response time

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Tests run in CI environment

**Deliverables**:
- `tests/integration/ai/remediation-engine.test.ts`
- `tests/integration/ai/decision-routing.test.ts`
- `tests/integration/ai/context-building.test.ts`
- `tests/integration/ai/fixtures/` (test workflows, templates)
- `tests/integration/ai/mocks/ai-service.mock.ts`

---

#### M3-T082: Performance testing for AI workflows
**Owner**: QA Engineer
**Dependencies**: M3-T080, M3-T081
**Parallel with**: M3-T083
**Estimate**: 10 hours

**Description**:
Create performance tests to verify AI workflows meet performance requirements and don't degrade under load.

**Acceptance Criteria**:
- [ ] Test: Create 10 AI workflows simultaneously (via API)
- [ ] Test: Deploy 10 AI workflows simultaneously
- [ ] Test: Execute 20 AI workflows simultaneously (with failures)
- [ ] Test: AI service response time <30 seconds (95th percentile)
- [ ] Test: Context builder collects context in <5 seconds
- [ ] Test: Prompt template rendering <100ms
- [ ] Test: Decision routing <1 second
- [ ] All operations complete within acceptable time
- [ ] No memory leaks during extended test run (1 hour)
- [ ] AI service rate limiting prevents abuse

**Testing Requirements**:
- [ ] Use k6 or Artillery for load testing
- [ ] Tests generate performance report (response times, throughput)
- [ ] Tests identify bottlenecks if any
- [ ] Tests run in CI (with performance thresholds)
- [ ] Test AI cost tracking (mock AI service usage)

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Performance benchmarks documented
- [ ] No critical performance issues found

**Deliverables**:
- `tests/performance/ai-workflows.k6.js`
- `tests/performance/ai-remediation.k6.js`
- `tests/performance/prompt-templates.k6.js`
- `docs/testing/performance-benchmarks-m3.md`

---

### Polish Tasks

#### M3-T083: UI/UX polish for AI features
**Owner**: Frontend Engineer 1
**Dependencies**: M3-T071
**Parallel with**: M3-T082, M3-T084
**Estimate**: 16 hours

**Description**:
Polish UI/UX for AI remediation features based on internal testing feedback, ensure excellent user experience.

**Acceptance Criteria**:
- [ ] AI toggle is prominent and easy to find in PropertyPanel
- [ ] Prompt template editor has smooth syntax highlighting
- [ ] Context configuration is intuitive (clear labels, help text)
- [ ] AI attempt timeline has smooth animations
- [ ] Decision badges are clear and color-coded (accessible colors)
- [ ] Loading states during AI wait (spinner, progress bar)
- [ ] Success states have clear visual feedback (confetti, checkmark)
- [ ] Error states have helpful recovery actions
- [ ] All interactive elements have focus states
- [ ] Keyboard navigation works (tab through all controls)
- [ ] ARIA labels on all AI-specific elements
- [ ] No console errors or warnings

**Testing Requirements**:
- [ ] Accessibility audit with axe-core (0 violations)
- [ ] Manual keyboard navigation test
- [ ] Test on Chrome, Firefox, Safari
- [ ] Visual regression tests for all new components
- [ ] Colorblind simulation testing

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Accessibility audit passes
- [ ] Cross-browser testing passes
- [ ] Design review approved

**Deliverables**:
- UI components updated with polish
- `tests/e2e/accessibility/ai-workflows.spec.ts`
- `docs/accessibility/wcag-compliance-m3.md`

---

#### M3-T084: Error handling and validation improvements
**Owner**: Backend Engineer 2 + Frontend Engineer 1
**Dependencies**: M3-T080, M3-T081
**Parallel with**: M3-T083
**Estimate**: 14 hours

**Description**:
Improve error messages, validation feedback, and error recovery flows for AI workflows.

**Acceptance Criteria**:
- [ ] AI service errors show specific issue (timeout, rate limit, API error)
- [ ] Prompt template errors show syntax issue with line number
- [ ] Context size errors show which components are too large
- [ ] AI decision parsing errors show what was invalid
- [ ] CoordinatorWorkflow errors handled gracefully (fallback to manual retry)
- [ ] All errors logged to monitoring system
- [ ] User-friendly error messages (no stack traces in UI)
- [ ] Suggested fixes provided for common errors
- [ ] Error recovery: can retry AI remediation manually
- [ ] Graceful degradation: if AI service down, fall back to standard retry

**Testing Requirements**:
- [ ] Test all error scenarios return proper messages
- [ ] Test error recovery flows (retry after AI failure)
- [ ] Test validation catches edge cases
- [ ] Test errors are logged correctly
- [ ] Test graceful degradation when AI service unavailable

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] All tests passing
- [ ] Error messages reviewed and approved

**Deliverables**:
- `src/lib/errors/ai-errors.ts` (error classes)
- `src/lib/validation/ai-validator.ts` (enhanced)
- `src/components/workflow/ErrorBoundary.tsx` (enhanced for AI errors)
- `docs/troubleshooting/ai-errors.md`

---

## Phase 4: Demo Preparation (Week 17)
**Goal**: Prepare demo, documentation, and training materials

### Demo Preparation Tasks

#### M3-T090: Create demo workflow examples for Milestone 3
**Owner**: Backend Engineer 2 + QA Engineer
**Dependencies**: M3-T083, M3-T084
**Parallel with**: M3-T091, M3-T092
**Estimate**: 12 hours

**Description**:
Create 3-5 example workflows that showcase Milestone 3 capabilities for Week 18 demo.

**Acceptance Criteria**:
- [ ] Example 1: Self-healing package build (intentional TypeScript error, AI fixes)
- [ ] Example 2: API integration with auto-repair (schema change, AI adapts)
- [ ] Example 3: Data quality workflow (AI cleans invalid records)
- [ ] Each example has descriptive name, documentation, and demo script
- [ ] Examples can be imported via seed script
- [ ] Examples demonstrate all M3 features (AI remediation, prompt templates, decision routing)
- [ ] Examples execute successfully with realistic mock data
- [ ] Examples show AI fixing real, believable errors
- [ ] Examples cover all decision types (RETRY, FAIL, ESCALATE)

**Testing Requirements**:
- [ ] Test: Import all examples successfully
- [ ] Test: Execute all examples end-to-end
- [ ] Test: AI remediates errors correctly in each example
- [ ] Test: Documentation is clear and accurate

**Completion Requirements**:
- [ ] Code committed to feature branch
- [ ] Examples tested and working
- [ ] Documentation complete

**Deliverables**:
- `examples/milestone-3/self-healing-package-build.json`
- `examples/milestone-3/api-auto-repair.json`
- `examples/milestone-3/data-quality-workflow.json`
- `examples/milestone-3/prompt-templates/` (demo templates)
- `scripts/seed-demo-workflows-m3.ts`
- `docs/examples/milestone-3-demos.md`

---

#### M3-T091: Write user documentation for Milestone 3
**Owner**: Frontend Engineer 1 + Backend Engineer 1
**Dependencies**: M3-T083, M3-T084
**Parallel with**: M3-T090, M3-T092
**Estimate**: 16 hours

**Description**:
Create comprehensive user documentation for AI self-healing workflows, prompt templates, and context configuration.

**Acceptance Criteria**:
- [ ] Guide: Enabling AI remediation on activities (step-by-step with screenshots)
- [ ] Guide: Creating and using prompt templates (best practices, examples)
- [ ] Guide: Configuring context for AI (what to include, when, why)
- [ ] Guide: Understanding AI decisions (RETRY/FAIL/ESCALATE explained)
- [ ] Guide: Monitoring AI remediation attempts (reading timeline)
- [ ] Guide: Troubleshooting AI workflows (common issues, solutions)
- [ ] Guide: AI cost management (estimating, optimizing)
- [ ] Video walkthrough (10-12 minutes) demonstrating all M3 features
- [ ] All documentation has screenshots and code examples
- [ ] Documentation versioned (for Milestone 3)
- [ ] Interactive tutorial showing AI self-healing in action

**Testing Requirements**:
- [ ] Have non-team member follow guide and provide feedback
- [ ] Test all code examples execute correctly
- [ ] Verify all links work
- [ ] Test video quality and audio

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Feedback incorporated

**Deliverables**:
- `docs/user-guide/ai-self-healing.md`
- `docs/user-guide/prompt-templates.md`
- `docs/user-guide/context-configuration.md`
- `docs/user-guide/ai-decisions.md`
- `docs/user-guide/ai-monitoring.md`
- `docs/user-guide/troubleshooting-ai.md`
- `docs/user-guide/ai-cost-management.md`
- `docs/user-guide/video-walkthrough-m3.mp4`

---

#### M3-T092: Create developer/API documentation for Milestone 3
**Owner**: Backend Engineer 1 + Backend Engineer 2
**Dependencies**: M3-T084
**Parallel with**: M3-T090, M3-T091
**Estimate**: 12 hours

**Description**:
Create developer documentation for AI remediation patterns, prompt template API, and CoordinatorWorkflow integration.

**Acceptance Criteria**:
- [ ] API reference for prompt templates endpoints (OpenAPI/Swagger-style)
- [ ] API reference for remediation endpoints
- [ ] AI remediation pattern architecture document (how compilation works)
- [ ] Context builder guide (how context is collected)
- [ ] Prompt template engine documentation (syntax, variables, helpers)
- [ ] CoordinatorWorkflow integration guide (spawning, communication)
- [ ] Decision routing documentation (how decisions are routed)
- [ ] Code examples for programmatic AI workflow creation
- [ ] All API endpoints have curl examples
- [ ] Migration guide from M2 to M3

**Testing Requirements**:
- [ ] Test all code examples execute correctly
- [ ] Test all curl examples work
- [ ] Verify API documentation matches implementation

**Completion Requirements**:
- [ ] Documentation published
- [ ] Peer review completed
- [ ] Documentation versioned

**Deliverables**:
- `docs/api/prompt-templates-reference.md`
- `docs/api/remediation-reference.md`
- `docs/architecture/ai-remediation-pattern.md`
- `docs/architecture/context-builder.md`
- `docs/architecture/prompt-template-engine.md`
- `docs/architecture/coordinator-integration.md`
- `docs/architecture/decision-routing.md`
- `docs/migration/m2-to-m3.md`

---

#### M3-T093: Prepare demo script and environment for Milestone 3
**Owner**: QA Engineer + DevOps Engineer
**Dependencies**: M3-T090, M3-T091
**Parallel with**: None (final task)
**Estimate**: 10 hours

**Description**:
Prepare stable demo environment and rehearse demo script for Week 18 stakeholder presentation. This is THE GAME CHANGER demo.

**Acceptance Criteria**:
- [ ] Demo environment deployed with M3 features
- [ ] Demo environment pre-seeded with example workflows and templates
- [ ] Demo script written (covers 6-point M3 demo from roadmap)
- [ ] Demo rehearsed with timing (25 minutes total)
- [ ] Backup plan if live demo fails (recording)
- [ ] Q&A talking points prepared
- [ ] Success metrics prepared (AI success rate, time saved, manual fixes eliminated)
- [ ] Comparison with M1+M2 (what's new, why game changer)
- [ ] AI service configured and tested (API keys, rate limits)
- [ ] Contingency plan if AI service has issues during demo

**Testing Requirements**:
- [ ] Run demo script 3+ times successfully
- [ ] Test demo environment is stable (no crashes)
- [ ] Test AI service responds reliably
- [ ] Have backup recording ready
- [ ] Test Q&A scenarios

**Completion Requirements**:
- [ ] Demo environment stable
- [ ] Team rehearsed and confident
- [ ] Backup materials ready

**Deliverables**:
- `docs/demo/milestone-3-script.md`
- `docs/demo/talking-points-m3.md`
- `docs/demo/success-metrics-m3.md`
- `docs/demo/m3-value-proposition.md` (why this is game changer)
- Demo environment URL
- Backup demo recording

---

## Phase 5: Buffer & Final Polish (Week 18)
**Goal**: Address issues found in Week 17, final polish, prepare for demo

### Buffer Tasks

#### M3-T100: Bug fixes and issue resolution
**Owner**: All engineers
**Dependencies**: M3-T093
**Parallel with**: M3-T101
**Estimate**: 40 hours (distributed across team)

**Description**:
Address all bugs and issues found during Week 17 testing and rehearsals. This is a buffer task for unexpected issues.

**Acceptance Criteria**:
- [ ] All critical bugs fixed (P0)
- [ ] All high-priority bugs fixed (P1)
- [ ] Medium-priority bugs triaged (fix or defer to M4)
- [ ] No known blockers for demo
- [ ] Regression testing passed
- [ ] Performance still meets benchmarks
- [ ] AI service integration stable

**Testing Requirements**:
- [ ] All existing tests still pass
- [ ] New tests added for bug fixes
- [ ] Manual testing of demo flows
- [ ] Performance regression testing
- [ ] AI service stress testing

**Completion Requirements**:
- [ ] All critical and high-priority issues resolved
- [ ] Release candidate created
- [ ] Final testing completed

**Deliverables**:
- Bug fixes committed to feature branch
- Updated test suites
- Release notes

---

#### M3-T101: Final demo preparation and rehearsal
**Owner**: All team members
**Dependencies**: M3-T093, M3-T100
**Parallel with**: None (final task before demo)
**Estimate**: 10 hours (team activity)

**Description**:
Final team rehearsal, polish demo environment, prepare presentation materials. Make this THE GAME CHANGER demo.

**Acceptance Criteria**:
- [ ] Demo runs smoothly start to finish
- [ ] All team members can present sections
- [ ] Presentation slides prepared (with value proposition)
- [ ] Success metrics compiled (AI success rate, manual fixes eliminated, time saved)
- [ ] Stakeholder invite sent
- [ ] Demo environment tested 1 hour before presentation
- [ ] Backup recording tested
- [ ] Q&A preparation (anticipated questions about AI, cost, accuracy)

**Testing Requirements**:
- [ ] Full demo run-through with timing
- [ ] Fallback plan tested (recording)
- [ ] All demo workflows execute successfully with AI
- [ ] AI service responds correctly
- [ ] Q&A preparation

**Completion Requirements**:
- [ ] Team confident in demo
- [ ] All materials ready
- [ ] Stakeholders confirmed

**Deliverables**:
- Final demo environment
- Presentation materials
- Success metrics report
- Team ready to present

---

## Dependency Graph

### Visual Representation

```
Week 13 (Foundation - All Parallel):
├─ M3-T001 (Database Schema)
│  ├─ M3-T002 (Prompt Templates Table)
│  └─ M3-T003 (Remediation Attempts Table)
├─ M3-T010 (tRPC AI Config)
│  ├─ M3-T011 (Prompt Templates API)
│  └─ M3-T012 (Remediation History API)
├─ M3-T020 (AI Remediation Pattern) ← CRITICAL PATH
│  ├─ M3-T021 (Context Builder)
│  └─ M3-T030 (CoordinatorWorkflow Integration)
├─ M3-T032 (AI Service Integration)
│  └─ M3-T033 (AI Monitoring)
└─ M3-T040 (AI Toggle UI)
   ├─ M3-T041 (Prompt Template Editor)
   └─ M3-T042 (Context Config UI)

Week 14 (Backend Integration):
├─ M3-T022 (Prompt Template Engine) [depends: T021, T011]
├─ M3-T031 (Decision Routing) [depends: T030, T022]
└─ M3-T060 (AI Remediation Service) [depends: T031, T030]
   └─ M3-T061 (AI Retry Orchestration) [depends: T060, T031]

Week 15 (Frontend Integration):
├─ M3-T050 (Retry Attempt Visualization) [depends: T042, T040, T012]
├─ M3-T051 (AI Decision Display) [depends: T050]
├─ M3-T070 (Deployment Pipeline) [depends: T061, T051]
└─ M3-T071 (Execution Monitoring) [depends: T061, T050]

Week 16 (Testing):
├─ M3-T080 (E2E Tests) [depends: T071, T070]
├─ M3-T081 (Integration Tests) [depends: T060, T061]
├─ M3-T082 (Performance Tests) [depends: T080, T081]
├─ M3-T083 (UI Polish) [depends: T071]
└─ M3-T084 (Error Handling) [depends: T080, T081]

Week 17 (Demo Prep):
├─ M3-T090 (Demo Examples) [depends: T083, T084]
├─ M3-T091 (User Docs) [depends: T083, T084]
├─ M3-T092 (Dev Docs) [depends: T084]
└─ M3-T093 (Demo Script) [depends: T090, T091]

Week 18 (Buffer):
├─ M3-T100 (Bug Fixes) [depends: T093]
└─ M3-T101 (Final Rehearsal) [depends: T093, T100]
```

### Critical Path (88 hours = ~2.5 weeks)

```
M3-T001 (4h)
  → M3-T010 (6h)
    → M3-T020 (16h) ← AI REMEDIATION PATTERN (CRITICAL)
      → M3-T021 (14h) ← CONTEXT BUILDER
        → M3-T022 (12h) ← PROMPT ENGINE
          → M3-T031 (12h) ← DECISION ROUTER
            → M3-T040 (14h) ← AI TOGGLE UI
              → M3-T080 (16h)

Total: 94 hours
```

This is your critical path. Any delays here push the entire milestone. Focus engineering effort here.

---

## Weekly Timeline with Team Assignments

### Week 13: Foundation (All Teams in Parallel)

**Backend Team**:
- BE1: M3-T020 (AI Remediation Pattern) - 16h ← CRITICAL
- BE1: M3-T030 (CoordinatorWorkflow Integration) - 12h
- BE2: M3-T001 (Database Schema) - 4h
- BE2: M3-T002 (Prompt Templates Table) - 3h
- BE2: M3-T003 (Remediation Attempts Table) - 3h
- BE2: M3-T010 (tRPC AI Config) - 6h
- BE2: M3-T011 (Prompt Templates API) - 8h
**Total**: 52 hours (both engineers working full week)

**Frontend Team**:
- FE1: M3-T040 (AI Toggle UI) - 14h
- FE1: M3-T041 (Prompt Template Editor) - 16h
- FE1: M3-T042 (Context Config UI) - 10h
**Total**: 40 hours

**DevOps Team**:
- DevOps: M3-T032 (AI Service Integration) - 8h
- DevOps: M3-T033 (AI Monitoring) - 6h
- DevOps: Support team - 6h
**Total**: 20 hours (0.5 FTE)

**QA Team**:
- QA: Test planning for M3 - 10h
- QA: Manual testing - 10h
**Total**: 20 hours (0.5 FTE)

**End of Week 13 Deliverables**:
- Database schema supports AI remediation
- AI remediation pattern compiler working
- CoordinatorWorkflow integration complete
- AI toggle UI functional
- Prompt template editor complete
- AI service integrated

---

### Week 14: Backend Integration

**Backend Team**:
- BE1: M3-T021 (Context Builder) - 14h ← CRITICAL
- BE1: M3-T060 (AI Remediation Service) - 16h
- BE2: M3-T012 (Remediation History API) - 6h
- BE2: M3-T022 (Prompt Template Engine) - 12h
- BE2: M3-T031 (Decision Routing) - 12h
**Total**: 60 hours (both engineers)

**Frontend Team**:
- FE1: M3-T050 (Retry Attempt Visualization) - 16h
- FE1: Polish from Week 13 - 8h
**Total**: 24 hours (lighter week waiting for backend)

**DevOps Team**:
- DevOps: Support backend integration - 10h
- DevOps: AI service testing - 6h
**Total**: 16 hours (0.5 FTE)

**QA Team**:
- QA: Manual testing - 12h
- QA: Test case creation - 10h
**Total**: 22 hours (0.5 FTE)

**End of Week 14 Deliverables**:
- Context builder collects relevant information
- Prompt template engine renders templates
- AI remediation service orchestrates flow
- Decision routing routes AI decisions
- Retry attempt visualization shows attempts

---

### Week 15: Full Stack Integration

**Backend Team**:
- BE1: M3-T070 (Deployment Pipeline) - 10h
- BE1: Support frontend integration - 10h
- BE2: M3-T061 (AI Retry Orchestration) - 14h
- BE2: Support M3-T071 (data endpoints) - 8h
**Total**: 42 hours

**Frontend Team**:
- FE1: M3-T051 (AI Decision Display) - 10h
- FE1: M3-T071 (Execution Monitoring) - 12h
- FE1: Integration testing - 8h
**Total**: 30 hours

**DevOps Team**:
- DevOps: Deploy to staging - 8h
- DevOps: AI monitoring dashboards - 6h
**Total**: 14 hours (0.5 FTE)

**QA Team**:
- QA: Integration testing - 14h
- QA: Manual testing - 8h
**Total**: 22 hours (0.5 FTE)

**End of Week 15 Deliverables**:
- Can deploy AI workflows
- Can execute AI workflows with remediation
- Can monitor AI attempts in real-time
- Can view AI decisions
- Staging environment operational

---

### Week 16: Testing & Polish

**Backend Team**:
- BE1: M3-T081 (Integration Tests) - 12h
- BE1: M3-T084 (Error Handling) - 7h
- BE2: M3-T084 (Error Handling) - 7h
- BE2: Bug fixes - 12h
**Total**: 38 hours

**Frontend Team**:
- FE1: M3-T083 (UI Polish) - 16h
- FE1: M3-T084 (Error Handling) - 7h
**Total**: 23 hours

**QA Team**:
- QA: M3-T080 (E2E Tests) - 16h
- QA: M3-T082 (Performance Tests) - 10h
- QA: Manual testing - 10h
**Total**: 36 hours

**DevOps Team**:
- DevOps: Performance tuning - 10h
- DevOps: Demo environment prep - 8h
**Total**: 18 hours (0.5 FTE)

**End of Week 16 Deliverables**:
- Comprehensive test suites passing
- UI polished and accessible
- Error handling improved
- Demo environment ready
- Bug backlog triaged

---

### Week 17: Demo Preparation

**Backend Team**:
- BE1: M3-T092 (Dev Docs) - 12h
- BE1: M3-T091 (User Docs) - 4h
- BE2: M3-T090 (Demo Examples) - 12h
- BE2: Bug fixes - 8h
**Total**: 36 hours

**Frontend Team**:
- FE1: M3-T091 (User Docs) - 12h
- FE1: Record demo video - 8h
- FE1: Bug fixes - 8h
**Total**: 28 hours

**QA Team**:
- QA: M3-T090 (Demo Examples) - 6h
- QA: M3-T093 (Demo Script) - 10h
- QA: Final testing - 14h
**Total**: 30 hours

**DevOps Team**:
- DevOps: M3-T093 (Demo Environment) - 10h
- DevOps: Infrastructure checks - 6h
**Total**: 16 hours (0.5 FTE)

**End of Week 17 Deliverables**:
- Demo workflows created and tested
- User and developer documentation complete
- Demo script rehearsed
- Demo environment stable
- Team ready to demo

---

### Week 18: Buffer & Demo

**All Team**:
- M3-T100 (Bug Fixes) - 20h distributed
- M3-T101 (Final Rehearsal) - 10h team activity
- Buffer for unexpected issues - 10h

**Demo Day** (End of Week 18):
- Present to stakeholders
- Show 6-point demo from roadmap
- Gather feedback for Milestone 4

**End of Week 18 Deliverables**:
- Milestone 3 complete
- Demo successful
- Stakeholder feedback collected
- Go/No-Go decision on Milestone 4

---

## Risk Mitigation

### High-Risk Items

1. **AI Service Integration** (M3-T032, M3-T060)
   - **Risk**: AI service may be unreliable, slow, or expensive
   - **Mitigation**: Mock AI service for testing, have fallback to manual retry, configure timeouts
   - **Fallback**: Use simpler AI models, or disable AI if service unreliable

2. **CoordinatorWorkflow Integration** (M3-T030)
   - **Risk**: Spawning child workflows may have edge cases, errors
   - **Mitigation**: Extensive integration tests, review Temporal best practices, have BE1 as expert
   - **Fallback**: Simplified AI pattern without child workflows (inline AI call)

3. **Context Builder Complexity** (M3-T021)
   - **Risk**: Collecting context may be complex, slow, or incomplete
   - **Mitigation**: Start simple (error only), add complexity incrementally, test performance
   - **Fallback**: Minimal context (error message only)

4. **Prompt Template Engine** (M3-T022)
   - **Risk**: Template rendering may have security issues (injection)
   - **Mitigation**: Use trusted library (Handlebars), sanitize inputs, security review
   - **Fallback**: Fixed prompt templates (no user customization)

5. **AI Decision Parsing** (M3-T060)
   - **Risk**: AI responses may be unpredictable, hard to parse
   - **Mitigation**: Use structured output format (JSON), validate responses, have fallback parser
   - **Fallback**: Assume FAIL decision if response unparseable

### Dependencies on External Systems

- **AI Service (OpenAI, Claude)**: Critical dependency. Have mock service for testing, configure timeouts and retries.
- **Temporal**: Critical dependency. Continue using Temporal Cloud as backup.
- **CoordinatorWorkflow Package**: Dependency on existing package. Ensure version compatibility.

### Team Availability Risks

- **Key person dependency**: BE1 is critical for AI pattern and CoordinatorWorkflow integration. If unavailable, BE2 must be trained.
- **Reduced capacity**: DevOps and QA at 0.5 FTE. Plan accordingly.
- **Buffer**: Week 18 is intentional buffer for unexpected absences.

---

## Success Metrics for Milestone 3

### Quantitative Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| AI-enabled workflows created | 30-50 | Count in database |
| AI remediation success rate | >50% | % of failures fixed by AI |
| Manual fixes eliminated | >40% | Manual fixes before vs. after AI |
| Successful executions | >95% | Execution success rate |
| User adoption | 10-15 users | User accounts with AI workflows |
| AI response time | <30 seconds | Average time for AI to respond |
| Deployment time | <5 minutes | Average time from "Deploy" click to "Active" |
| Test coverage | >80% | Code coverage report |
| Zero critical bugs | 0 P0 bugs | Bug tracker |

### Qualitative Success Criteria

- [ ] **Game Changer**: Stakeholders see clear value in AI self-healing
- [ ] **Usable**: User can enable AI on activity in 5 minutes
- [ ] **Reliable**: AI remediates real errors successfully
- [ ] **Understandable**: Users understand AI decisions and reasoning
- [ ] **Documented**: User guide enables self-service AI workflows
- [ ] **Production-ready**: Code quality suitable for production deployment

### Demo Success Criteria (Week 18)

Must successfully demonstrate all 6 points from roadmap:
1. [ ] Create workflow with intentionally failing activity
2. [ ] Enable AI remediation on activity
3. [ ] Run workflow, watch it fail
4. [ ] AI agent analyzes error, makes fix (show in UI)
5. [ ] Workflow retries and succeeds (self-healing!)
6. [ ] Show AI's fix attempt in execution log (full transparency)

**If all 6 succeed**: Milestone 3 complete ✓ **GAME CHANGER ACHIEVED**
**If <6 succeed**: Use Week 18 buffer to address issues

---

## Handoff to Milestone 4

### Prerequisites for M4 Start

- [ ] All M3 tasks completed (or deferred with documented reason)
- [ ] Demo successful and stakeholder approval received
- [ ] User feedback collected and documented
- [ ] Known issues triaged (fix in M4 or defer)
- [ ] M3 code merged to main branch
- [ ] M3 documentation published
- [ ] Team retrospective completed
- [ ] AI service integration stable and cost-effective

### Lessons Learned Handoff

At end of M3, document:
1. What took longer than expected (adjust M4 estimates)
2. What went smoothly (repeat in M4)
3. Technical debt created (address in M4 if critical)
4. User feedback themes (prioritize in M4)
5. Team velocity (actual vs. estimated hours)
6. AI success rate (what types of errors AI fixed vs. couldn't fix)
7. Cost analysis (AI API usage, cost per remediation attempt)

### Milestone 4 Preview

Based on M3 completion, M4 will add:
- Loop container nodes (for each)
- Concurrency control (parallel with limits)
- Progress tracking
- Batch processing capabilities

Expected start: Week 19 (immediately after M3 completion)

---

## Appendix: Task Summary Table

| Task ID | Task Name | Owner | Estimate | Week | Dependencies |
|---------|-----------|-------|----------|------|--------------|
| M3-T001 | Extend activity schema for AI | BE2 | 4h | 13 | M2 complete |
| M3-T002 | Create prompt_templates table | BE2 | 3h | 13 | T001 |
| M3-T003 | Create remediation_attempts table | BE2 | 3h | 13 | T001, T002 |
| M3-T010 | Enhance tRPC for AI config | BE2 | 6h | 13 | T001 |
| M3-T011 | Prompt templates API | BE2 | 8h | 13 | T002, T010 |
| M3-T012 | Remediation history API | BE2 | 6h | 14 | T003, T010 |
| M3-T020 | AI remediation pattern compiler | BE1 | 16h | 13 | M1-T021, M2-T022 |
| M3-T021 | Context builder | BE1 | 14h | 14 | T020 |
| M3-T022 | Prompt template engine | BE2 | 12h | 14 | T021, T011 |
| M3-T030 | CoordinatorWorkflow integration | BE1 | 12h | 13 | T020 |
| M3-T031 | Decision routing logic | BE2 | 12h | 14 | T030, T022 |
| M3-T032 | AI service integration | DevOps | 8h | 13 | T022 |
| M3-T033 | AI monitoring | DevOps | 6h | 13 | T032 |
| M3-T040 | AI remediation toggle | FE1 | 14h | 13 | M1-T042 |
| M3-T041 | Prompt template editor | FE1 | 16h | 13 | T040, T011 |
| M3-T042 | Context configuration UI | FE1 | 10h | 13 | T040 |
| M3-T050 | Retry attempt visualization | FE1 | 16h | 14 | T042, T040, T012 |
| M3-T051 | AI decision display | FE1 | 10h | 15 | T050 |
| M3-T060 | AI remediation service | BE1 | 16h | 14 | T031, T030 |
| M3-T061 | AI retry orchestration | BE2 | 14h | 15 | T060, T031 |
| M3-T070 | Deployment pipeline for AI | BE1 | 10h | 15 | T061, T051 |
| M3-T071 | Execution monitoring for AI | FE1 | 12h | 15 | T061, T050 |
| M3-T080 | E2E AI self-healing tests | QA | 16h | 16 | T071, T070 |
| M3-T081 | Integration tests for AI engine | BE1 | 12h | 16 | T060, T061 |
| M3-T082 | Performance testing | QA | 10h | 16 | T080, T081 |
| M3-T083 | UI polish for AI | FE1 | 16h | 16 | T071 |
| M3-T084 | Error handling | BE2+FE1 | 14h | 16 | T080, T081 |
| M3-T090 | Demo examples for M3 | BE2+QA | 12h | 17 | T083, T084 |
| M3-T091 | User documentation for M3 | FE1+BE1 | 16h | 17 | T083, T084 |
| M3-T092 | Developer documentation for M3 | BE1+BE2 | 12h | 17 | T084 |
| M3-T093 | Demo script and environment | QA+DevOps | 10h | 17 | T090, T091 |
| M3-T100 | Bug fixes | All | 40h | 18 | T093 |
| M3-T101 | Final rehearsal | All | 10h | 18 | T093, T100 |

**Total Estimated Hours**: ~420 hours
**Team Size**: 5 people (2 BE, 1 FE, 0.5 DevOps, 0.5 QA)
**Timeline**: 6 weeks
**Capacity**: 200 hours per week (5 people × 40 hours)
**Buffer**: ~38% (Week 18 is mostly buffer)

---

**Created**: 2025-01-19
**Version**: 1.0
**Next Review**: End of Week 15 (mid-milestone check-in)
