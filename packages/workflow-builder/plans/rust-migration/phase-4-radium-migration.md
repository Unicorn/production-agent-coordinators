# Phase 4: Radium Migration

**Status**: Planning
**Prerequisites**: Phase 3 (Basic Workflows Verification) complete
**Outcome**: Workflow Builder code lives in Radium workspace, building as part of Radium

---

## CRITICAL: AGENT HANDOFF PHASE

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   THIS IS THE LAST PHASE WHERE YOU HAVE ACCESS TO production-agent-coord    ║
║                                                                              ║
║   After Phase 4, a NEW AI AGENT will continue in Radium-only context.       ║
║   That agent will have NO ACCESS to production-agent-coordinators.          ║
║                                                                              ║
║   Section 4.6 (Context Documentation Package) is NOT OPTIONAL.              ║
║   If you skip or under-document 4.6, the next agent WILL FAIL.              ║
║                                                                              ║
║   DO NOT mark Phase 4 complete until 4.6 is THOROUGHLY done.                ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**What happens if 4.6 is incomplete:**
- Phase 5 agent won't understand original TypeScript patterns
- Phase 6 agent can't create proper migration records
- Phase 9's Component Builder Agent will have no training data
- Integration with Kong/Supabase/Temporal will be guesswork
- Architecture decisions will be questioned and possibly reversed

**Your responsibility**: Leave behind EVERYTHING the next agent needs. When in doubt, document more, not less.

---

## Overview

This phase physically moves the workflow-builder codebase from `production-agent-coordinators/packages/workflow-builder/` into the Radium directory structure. After this phase, the Workflow Builder becomes the web UI for Radium.

## Strategic Goal

```
Current State                          Target State
-------------                          ------------
production-agent-coordinators/         Radium/
  packages/                              apps/
    workflow-builder/         -->          workflow-builder/    (Web UI)
      rust-compiler/          -->        crates/
      src/ (React UI)                      radium-workflow/     (Rust compiler)
                                         apps/
                                           cli/                 (existing)
                                           tui/                 (existing)
                                           desktop/             (Tauri + workflow UI)
```

## Timing Rationale

| Question | Answer |
|----------|--------|
| **Why after Phase 3?** | Rust compiler proven working, TypeScript generation verified |
| **Why before Phase 5?** | Phases 5-7 involve heavy schema work - better to do it in final location |
| **Why not earlier?** | Phases 1-3 validate the approach; moving unproven code adds risk |
| **Why not later?** | Moving during deep integration creates painful merge conflicts |

## Prerequisites Checklist

- [ ] Phase 3 complete: Basic workflows compile and generate valid TypeScript
- [ ] All Phase 1-3 tests passing
- [ ] Radium team aligned on directory structure
- [ ] Feature branch created for migration

---

## 4.1 Prepare Radium Workspace

**Goal**: Create directory structure in Radium for incoming code.

**Tasks**:
- [ ] 4.1.1 Create `Radium/crates/radium-workflow/` directory
- [ ] 4.1.2 Create `Radium/apps/workflow-builder/` directory
- [ ] 4.1.3 Update `Radium/Cargo.toml` to include `radium-workflow` as workspace member

**Cargo.toml Changes**:
```toml
# Radium/Cargo.toml - add to workspace members
[workspace]
members = [
    "crates/radium-core",
    "crates/radium-orchestrator",
    "crates/radium-abstraction",
    "crates/radium-models",
    "crates/radium-workflow",          # NEW
    "apps/cli",
    "apps/tui",
    "apps/desktop",
]
```

---

## 4.2 Move Rust Compiler

**Goal**: Move rust-compiler to Radium/crates/radium-workflow.

**Source**: `production-agent-coordinators/packages/workflow-builder/rust-compiler/`
**Destination**: `Radium/crates/radium-workflow/`

**Tasks**:
- [ ] 4.2.1 Copy `rust-compiler/` contents to `Radium/crates/radium-workflow/`
- [ ] 4.2.2 Update `Cargo.toml` package name from `workflow-compiler` to `radium-workflow`
- [ ] 4.2.3 Update crate documentation to reflect new location
- [ ] 4.2.4 Verify `cargo build` succeeds in Radium workspace
- [ ] 4.2.5 Verify all tests pass: `cargo test -p radium-workflow`

**Cargo.toml Update**:
```toml
# Radium/crates/radium-workflow/Cargo.toml
[package]
name = "radium-workflow"
version = "0.1.0"
edition = "2021"
description = "Workflow compiler and TypeScript generator for Radium"

[dependencies]
# ... existing dependencies
radium-models = { path = "../radium-models" }  # Can now use sibling crates
```

---

## 4.3 Move React UI

**Goal**: Move React frontend to Radium/apps/workflow-builder.

**Source**: `production-agent-coordinators/packages/workflow-builder/src/` (and related frontend files)
**Destination**: `Radium/apps/workflow-builder/`

**Tasks**:
- [ ] 4.3.1 Identify all frontend-related files (src/, public/, package.json, etc.)
- [ ] 4.3.2 Copy frontend files to `Radium/apps/workflow-builder/`
- [ ] 4.3.3 Update `package.json` paths and scripts as needed
- [ ] 4.3.4 Update any hardcoded API paths to point to new backend location
- [ ] 4.3.5 Verify `npm install` and `npm run build` succeed
- [ ] 4.3.6 Verify `npm run dev` starts the development server

**Directory Structure**:
```
Radium/apps/workflow-builder/
  package.json
  tsconfig.json
  src/
    components/          # Canvas, nodes, toolbar
    hooks/               # useWorkflow, useCompiler
    api/                 # API client (talks to radium-workflow)
    pages/               # If using Next.js
  public/
```

---

## 4.4 Update Imports and Paths

**Goal**: Ensure all internal references work in new location.

**Tasks**:
- [ ] 4.4.1 Update Rust `use` statements if any paths changed
- [ ] 4.4.2 Update TypeScript/JavaScript imports
- [ ] 4.4.3 Update any configuration files with hardcoded paths
- [ ] 4.4.4 Update environment variable references
- [ ] 4.4.5 Update any build scripts or Makefiles

---

## 4.5 Update CI/CD

**Goal**: Ensure automated pipelines work with new locations.

**Tasks**:
- [ ] 4.5.1 Update CI workflows to build `radium-workflow` crate
- [ ] 4.5.2 Update CI workflows to build `workflow-builder` app
- [ ] 4.5.3 Update deployment scripts for new paths
- [ ] 4.5.4 Update Kong routes if service location changed
- [ ] 4.5.5 Verify all CI checks pass

---

## 4.6 Create Context Documentation Package

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  STOP. READ THIS CAREFULLY.                                                  │
│                                                                              │
│  This section is the MOST IMPORTANT part of Phase 4.                         │
│                                                                              │
│  Sections 4.1-4.5 move code. Section 4.6 transfers KNOWLEDGE.                │
│  Code without knowledge is useless. The next agent needs BOTH.               │
│                                                                              │
│  Spend MORE time on 4.6 than you think is necessary.                         │
│  The next agent cannot ask you questions. Document EVERYTHING.               │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Goal**: Ensure a Radium-only AI agent has all context needed to complete Phases 5-9 without access to production-agent-coordinators.

**Why This Matters**: After Phase 4, development happens entirely in Radium. An AI agent working in Radium needs to:
- Understand original TypeScript patterns (for Phase 6 comparison)
- Know component behaviors and specifications
- Have migration record templates (for Phase 6 creation, Phase 9 training)
- Understand external systems (Kong, Supabase, Temporal)
- Know architecture decisions and rationale

### 4.6.1 Original Component Snapshots

**Create**: `Radium/docs/workflow-builder/original-patterns/`

For each component type, capture the original TypeScript implementation:

```
Radium/docs/workflow-builder/original-patterns/
  README.md                    # Index of all components
  components/
    start.ts.snapshot          # Original Start component
    stop.ts.snapshot           # Original Stop component
    log.ts.snapshot            # Original Log component
    conditional.ts.snapshot    # Original Conditional
    loop.ts.snapshot           # Original Loop
    http-request.ts.snapshot   # Original HTTP Request
    agent.ts.snapshot          # Original Agent component
    kong-logging.ts.snapshot   # Original Kong Logging
    database-query.ts.snapshot # Original Database Query
    child-workflow.ts.snapshot # Original Child Workflow
    signal.ts.snapshot         # Original Signal handlers
    query.ts.snapshot          # Original Query handlers
    ...
```

**Tasks**:
- [ ] 4.6.1.1 Create `original-patterns/` directory structure
- [ ] 4.6.1.2 Export each component's TypeScript to `.snapshot` files
- [ ] 4.6.1.3 Add behavior comments to each snapshot explaining what it does
- [ ] 4.6.1.4 Create README.md index linking to each component

### 4.6.2 Component Behavior Specifications

**Create**: `Radium/docs/workflow-builder/component-specs/`

For each component, document its expected behavior (not just code):

```yaml
# Radium/docs/workflow-builder/component-specs/http-request.yaml
name: http-request
category: activity
description: Makes HTTP requests to external APIs

inputs:
  - name: url
    type: string
    required: true
    description: The URL to request
  - name: method
    type: enum[GET, POST, PUT, DELETE, PATCH]
    required: true
    default: GET
  - name: headers
    type: Record<string, string>
    required: false
  - name: body
    type: any
    required: false
  - name: timeout_ms
    type: number
    required: false
    default: 30000

outputs:
  - name: status
    type: number
  - name: headers
    type: Record<string, string>
  - name: body
    type: any
  - name: duration_ms
    type: number

behaviors:
  - name: success
    condition: "status >= 200 && status < 300"
    output: "Full response object"
  - name: client_error
    condition: "status >= 400 && status < 500"
    output: "Error with status and body"
  - name: server_error
    condition: "status >= 500"
    output: "Error, may retry based on policy"
  - name: timeout
    condition: "request exceeds timeout_ms"
    output: "Timeout error"

retry_policy:
  retryable_errors: [timeout, server_error]
  max_attempts: 3
  backoff: exponential

temporal_mapping:
  type: activity
  task_queue: default
  start_to_close_timeout: "{{ timeout_ms }}ms"

example_usage: |
  const response = await httpRequest({
    url: "https://api.example.com/users",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { name: "Alice" }
  });
```

**Tasks**:
- [ ] 4.6.2.1 Create spec template YAML structure
- [ ] 4.6.2.2 Document all ~15 component types with full specs
- [ ] 4.6.2.3 Include Temporal mapping for each component
- [ ] 4.6.2.4 Add example usage for each component

### 4.6.3 Migration Record Templates

**Create**: `Radium/docs/workflow-builder/migration-records/`

Provide the exact structure Phase 6 should create, so Phase 9 knows what to expect:

```yaml
# Radium/docs/workflow-builder/migration-records/_template.yaml
# This is the template for Phase 6 component migration records

component_name: ""
migration_date: ""
migrated_by: ""

# Original Implementation
original:
  file_path: "docs/workflow-builder/original-patterns/components/{name}.ts.snapshot"
  lines_of_code: 0
  complexity_score: 0
  dependencies: []

# Rust Schema
rust_schema:
  file_path: "crates/radium-workflow/src/schemas/components/{name}.rs"
  structs:
    - name: "{Name}Input"
      fields: []
    - name: "{Name}Output"
      fields: []
  validation_rules: []

# Generated TypeScript
generated_typescript:
  file_path: "crates/radium-workflow/templates/{name}.ts.hbs"
  output_path: "generated/{name}.ts"

# Schema Decisions (for Phase 9 learning)
schema_decisions:
  - decision: ""
    rationale: ""
    alternatives_considered: []
    why_not_alternatives: ""

# Validation Decisions
validation_decisions:
  - field: ""
    validation: ""
    rationale: ""

# Lessons Learned (for Phase 9 training)
lessons_learned:
  - category: ""  # schema_design | validation | codegen | testing | edge_case
    lesson: ""
    example: ""
    recommendation: ""

# Verification Results
verification:
  typescript_compiles: false
  eslint_passes: false
  behavior_matches_original: false
  all_tests_pass: false

# Edge Cases Discovered
edge_cases:
  - input: ""
    expected_behavior: ""
    how_handled: ""
```

**Tasks**:
- [ ] 4.6.3.1 Create `_template.yaml` with full structure
- [ ] 4.6.3.2 Create `_quality-checklist.md` for record validation
- [ ] 4.6.3.3 Create example completed record for reference

### 4.6.4 External System Documentation

**Create**: `Radium/docs/workflow-builder/external-systems/`

Document integration points with external systems:

```
Radium/docs/workflow-builder/external-systems/
  kong/
    README.md                  # Kong API Gateway overview
    routes.yaml                # Current route configuration
    logging-format.md          # Log format specification
    rate-limiting.md           # Rate limit configuration

  supabase/
    README.md                  # Supabase integration overview
    schema.sql                 # Database schema dump
    rls-policies.md            # Row Level Security policies
    auth-patterns.md           # Authentication patterns

  temporal/
    README.md                  # Temporal integration overview
    worker-config.md           # Worker configuration
    task-queues.md             # Task queue setup
    activity-patterns.md       # Common activity patterns
    workflow-patterns.md       # Common workflow patterns
    signals-queries.md         # Signal and query patterns
    child-workflows.md         # Child workflow patterns
    retry-policies.md          # Retry configuration
```

**Tasks**:
- [ ] 4.6.4.1 Export Kong route configuration
- [ ] 4.6.4.2 Document Supabase schema and RLS policies
- [ ] 4.6.4.3 Document Temporal patterns and configuration
- [ ] 4.6.4.4 Add code examples for each integration

### 4.6.5 Handlebars Template Reference

**Create**: `Radium/docs/workflow-builder/templates/`

Document the template system for code generation:

```markdown
# Radium/docs/workflow-builder/templates/README.md

## Template System Overview

The workflow compiler uses Handlebars templates to generate TypeScript code.

## Directory Structure

templates/
  workflow.ts.hbs      # Main workflow file template
  activity.ts.hbs      # Activity wrapper template
  state.ts.hbs         # State management template
  types.ts.hbs         # Type definitions template
  partials/
    imports.hbs        # Common imports partial
    error-handler.hbs  # Error handling partial
    retry-logic.hbs    # Retry logic partial

## Custom Helpers

### {{temporal_type field}}
Converts Rust type to Temporal-compatible TypeScript type.

### {{validate field}}
Generates validation code for a field.

### {{camelCase name}}
Converts snake_case to camelCase.

## Example Template

```handlebars
// templates/activity.ts.hbs
import { proxyActivities } from '@temporalio/workflow';
import type { {{Name}}Input, {{Name}}Output } from './types';

const activities = proxyActivities<typeof import('./activities')>({
  startToCloseTimeout: '{{timeout}}',
  retry: {
    maximumAttempts: {{retry.max_attempts}},
  },
});

export async function {{camelCase name}}(input: {{Name}}Input): Promise<{{Name}}Output> {
  {{#each validation_rules}}
  {{validate this}}
  {{/each}}

  return activities.{{camelCase name}}(input);
}
```
```

**Tasks**:
- [ ] 4.6.5.1 Document all existing templates
- [ ] 4.6.5.2 Document custom Handlebars helpers
- [ ] 4.6.5.3 Add examples of template usage
- [ ] 4.6.5.4 Document template testing approach

### 4.6.6 Architecture Decision Records

**Create**: `Radium/docs/workflow-builder/decisions/`

Document WHY decisions were made during Phases 1-3:

```markdown
# Radium/docs/workflow-builder/decisions/001-rust-for-validation.md

# ADR-001: Use Rust for Schema Validation

## Status
Accepted

## Context
We needed to choose a language for workflow schema validation and TypeScript code generation.

## Decision
Use Rust with serde for schema validation and Handlebars for TypeScript generation.

## Rationale
1. Type safety catches schema errors at compile time
2. serde provides excellent JSON/YAML handling
3. Rust's pattern matching is ideal for schema validation
4. Performance for large workflows
5. Integration with Radium's existing Rust codebase

## Alternatives Considered
1. **TypeScript with Zod**: Simpler but less performant, type errors at runtime
2. **Go with JSON Schema**: Good performance but less type safety
3. **Python with Pydantic**: Easy to write but slow for large schemas

## Consequences
- Steeper learning curve for TypeScript-only developers
- Excellent compile-time guarantees
- Easy integration with Radium crates
```

**Tasks**:
- [ ] 4.6.6.1 Document Rust choice (ADR-001)
- [ ] 4.6.6.2 Document Kong abstraction approach (ADR-002)
- [ ] 4.6.6.3 Document Temporal integration pattern (ADR-003)
- [ ] 4.6.6.4 Document component schema structure (ADR-004)
- [ ] 4.6.6.5 Document code generation approach (ADR-005)

### 4.6.7 Move Plan Files

**Move**: Phase 5-9 plan files and radium-integration.md to Radium

```
Radium/docs/workflow-builder/plans/
  phase-5-variables-state.md
  phase-6-component-migration.md
  phase-7-advanced-features.md
  phase-8-production-hardening.md
  phase-9-component-builder.md
  radium-integration.md
```

**Tasks**:
- [ ] 4.6.7.1 Copy plan files to `Radium/docs/workflow-builder/plans/`
- [ ] 4.6.7.2 Update internal references to use new paths
- [ ] 4.6.7.3 Update any production-agent-coordinators paths to Radium paths
- [ ] 4.6.7.4 Add AGENTS.md or CLAUDE.md with plan file locations

### 4.6.8 MANDATORY: Context Package Verification

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  DO NOT PROCEED TO 4.7 UNTIL ALL VERIFICATION CHECKS PASS                    ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Self-Check: Pretend you are a new agent with ONLY the Radium codebase.**

For each question below, verify you can answer it using ONLY files in `Radium/`:

#### Component Understanding (Phase 6 readiness)
- [ ] 4.6.8.1 "What does the original http-request component do?" → Can answer from `original-patterns/`
- [ ] 4.6.8.2 "What inputs does the conditional component accept?" → Can answer from `component-specs/`
- [ ] 4.6.8.3 "How should I structure a migration record?" → Can answer from `migration-records/_template.yaml`
- [ ] 4.6.8.4 "What does a completed migration record look like?" → Example record exists

#### External Systems (Phase 5-7 readiness)
- [ ] 4.6.8.5 "How do I call Kong from a workflow?" → Can answer from `external-systems/kong/`
- [ ] 4.6.8.6 "What's the Supabase schema for workflows?" → Can answer from `external-systems/supabase/`
- [ ] 4.6.8.7 "How do Temporal activities map to components?" → Can answer from `external-systems/temporal/`

#### Code Generation (Phase 5-6 readiness)
- [ ] 4.6.8.8 "What Handlebars helpers are available?" → Can answer from `templates/README.md`
- [ ] 4.6.8.9 "How do I generate TypeScript for a new component?" → Can answer from templates docs

#### Architecture (All phases)
- [ ] 4.6.8.10 "Why did we use Rust instead of TypeScript for validation?" → Can answer from `decisions/ADR-001`
- [ ] 4.6.8.11 "What's the overall component schema structure?" → Can answer from ADRs

#### Plans and Next Steps
- [ ] 4.6.8.12 "What work remains after Phase 4?" → Plans exist in `plans/` directory
- [ ] 4.6.8.13 "Where do I find the Phase 5 tasks?" → `plans/phase-5-variables-state.md` exists

**Verification Process**:
1. Open a NEW terminal/context with ONLY Radium directory access
2. Attempt to answer each question above using only Radium files
3. If ANY question cannot be answered, go back and add more documentation
4. Do not proceed until ALL checkboxes are checked

**Common Gaps to Watch For**:
- Missing component snapshots (check all ~15 components are captured)
- Missing behavior edge cases in specs
- Temporal patterns not fully documented
- ADRs too brief to explain rationale
- Plan files still reference production-agent-coordinators paths

---

## 4.7 Deprecate Old Location

**Goal**: Leave clear trail for anyone referencing old location.

**Tasks**:
- [ ] 4.6.1 Remove workflow-builder from production-agent-coordinators workspace
- [ ] 4.6.2 Create deprecation README at old location
- [ ] 4.6.3 Update any external documentation references
- [ ] 4.6.4 Update any links in other project documentation

**Deprecation README**:
```markdown
# Workflow Builder - MOVED

This package has been moved to the Radium project.

**New locations:**
- Rust compiler: `Radium/crates/radium-workflow/`
- Web UI: `Radium/apps/workflow-builder/`

See the Radium repository for current development.
```

---

## Directory Structure After Phase 4

```
Radium/
  Cargo.toml                           # Updated with radium-workflow
  crates/
    radium-core/                       # Existing
    radium-orchestrator/               # Existing
    radium-abstraction/                # Existing
    radium-models/                     # Existing
    radium-workflow/                   # NEW: Moved from workflow-builder
      Cargo.toml
      src/
        lib.rs
        schemas/                       # Workflow schemas
        compiler/                      # TypeScript compiler
        validation/                    # Schema validation
        templates/                     # Handlebars templates
      tests/
  apps/
    cli/                               # Existing Radium CLI
    tui/                               # Existing Radium TUI
    desktop/                           # Existing Tauri app
    workflow-builder/                  # NEW: React web UI
      package.json
      src/
        components/
        hooks/
        pages/
      public/

production-agent-coordinators/
  packages/
    workflow-builder/                  # DEPRECATED
      README.md                        # Points to Radium
```

---

## Acceptance Criteria

### Code Migration (Sections 4.1-4.5, 4.7)
- [ ] `cargo build` succeeds in Radium workspace with radium-workflow
- [ ] `cargo test -p radium-workflow` passes all tests
- [ ] React UI builds: `cd Radium/apps/workflow-builder && npm run build`
- [ ] React UI runs: `cd Radium/apps/workflow-builder && npm run dev`
- [ ] Kong routes (if any) updated and functional
- [ ] CI/CD pipelines updated and green
- [ ] Old location has deprecation notice
- [ ] No broken imports or references

### Context Documentation Package (Section 4.6) - BLOCKING

```
These criteria are BLOCKING. Phase 4 is NOT complete without them.
A Radium-only agent MUST be able to continue without production-agent-coordinators access.
```

- [ ] **Original Patterns**: All ~15 component snapshots exist with behavior comments
- [ ] **Component Specs**: All components have YAML specs with inputs, outputs, behaviors
- [ ] **Migration Templates**: `_template.yaml` and example record exist
- [ ] **External Systems**: Kong, Supabase, Temporal docs are complete with examples
- [ ] **Template Reference**: Handlebars helpers and templates fully documented
- [ ] **ADRs**: At least 5 architecture decisions documented with rationale
- [ ] **Plan Files**: Phases 5-9 copied to Radium with updated paths
- [ ] **Verification**: All 13 questions in 4.6.8 can be answered from Radium files only
- [ ] **CLAUDE.md/AGENTS.md**: Created in Radium with workflow-builder context

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking changes during move | Create feature branch, full test suite before/after |
| Dependent services break | Coordinate timing, use symbolic links if needed during transition |
| CI/CD failures | Test pipeline changes in feature branch first |
| Lost git history | Use `git mv` where possible to preserve history |

---

## Rollback Plan

If critical issues are discovered after merge:

1. Revert the merge commit
2. Old location code is still functional (deprecation notice is just a README)
3. Fix issues on feature branch
4. Re-attempt migration

---

## Next Steps

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  AGENT HANDOFF OCCURS HERE                                                   ║
║                                                                              ║
║  After Phase 4, a NEW agent takes over in Radium-only context.               ║
║  Your work on this project is complete. The next agent depends on your docs. ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**For the completing agent (you):**
1. Verify ALL acceptance criteria are met, especially Section 4.6
2. Run the 4.6.8 verification checklist one final time
3. Commit all changes to Radium repository
4. Create a summary document at `Radium/docs/workflow-builder/HANDOFF.md` noting:
   - What was completed in Phases 1-4
   - Any known issues or technical debt
   - Recommendations for Phase 5 starting point
   - Any "gotchas" the next agent should know

**For the next agent (Radium-only context):**
1. Start by reading `Radium/docs/workflow-builder/HANDOFF.md`
2. Review `Radium/docs/workflow-builder/plans/` for remaining phases
3. Familiarize yourself with context docs in `Radium/docs/workflow-builder/`
4. Proceed to Phase 5 (Variables & State)
5. Begin R1-R7 integration phases in parallel (see radium-integration.md)

**Do NOT proceed to Phase 5 from this agent.** The handoff to Radium-only context is intentional.

---

## References

- [Phase 3: Basic Workflows](./phase-3-basic-workflows.md) - Must be complete first
- [Phase 5: Variables & State](./phase-5-variables-state.md) - Next phase
- [Radium Integration (R1-R7)](./radium-integration.md) - Parallel integration work
- [Radium Workspace](../../../../../../Radium/Cargo.toml)
