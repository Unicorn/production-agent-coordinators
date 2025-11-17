# Temporal Workflow & Activity Documentation Index

This directory contains comprehensive documentation of the Temporal workflow structure and naming conventions for the production-agent-coordinators codebase.

## Quick Navigation

### For Quick Reference
**File:** `NAMING_PATTERNS_REFERENCE.md`
- Pattern summary tables
- Decision trees for naming
- Anti-patterns to avoid
- Consistency checklist
- ~10 minutes to read

### For Complete Understanding
**File:** `WORKFLOW_STRUCTURE_ANALYSIS.md`
- Full architectural overview
- All workflow definitions explained
- Directory structure explained
- Activity definitions explained
- Type definitions explained
- Worker setup patterns
- ~20 minutes to read thoroughly

### For Code Examples
**File:** `CODE_EXAMPLES.md`
- Real code from 3 workflow examples
- Real code from 3 activity examples
- Activity proxy configuration
- Type definition examples
- Exact file locations and line numbers
- ~15 minutes to read and understand

### For Summary
**File:** `CODEBASE_EXPLORATION_SUMMARY.txt`
- Executive summary of exploration
- Key findings in digest form
- Specific file locations
- Recommendations
- ~10 minutes to read

## Document Overview

### WORKFLOW_STRUCTURE_ANALYSIS.md (18 KB)
Comprehensive technical analysis of the entire system.

**Contents:**
1. Executive Summary
2. Directory Structure
3. Workflow Definitions (Temporal Coordinator + Package Builder)
4. Activity Definitions (Build, Agent, Report)
5. Naming Conventions Summary (detailed)
6. Type Definitions
7. Worker Setup
8. Existing Standardization Patterns
9. Current Workflow Examples
10. Scripts and Integration
11. Key Findings & Standardization
12. Areas for Standardization
13. Next Steps

**Best for:** Understanding the complete system architecture and all components

---

### NAMING_PATTERNS_REFERENCE.md (9.1 KB)
Quick-reference guide for naming conventions and patterns.

**Contents:**
1. Pattern Summary Table (Workflows, Activities, Types)
2. Agentic Activities (Special Category)
3. File Organization Reference
4. Activity Proxy Configuration Pattern
5. Import Pattern
6. Workflow ID Naming
7. Verb Inventory
8. Anti-Patterns (What NOT to Do)
9. Decision Tree: Naming Your Activity
10. Decision Tree: Naming Your Workflow
11. Code Examples
12. Consistency Checklist
13. Related Files to Reference

**Best for:** Quick lookup when naming new workflows/activities

---

### CODE_EXAMPLES.md (19 KB)
Real code from the codebase with detailed analysis.

**Workflows Shown:**
1. `helloWorkflow()` - Simple demo workflow
   - Location: /packages/temporal-coordinator/src/workflows.ts
   - 125 lines shown with analysis

2. `PackageBuilderWorkflow()` - Complex parent orchestrator
   - Location: /packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts
   - 110 lines shown with analysis

3. `PackageBuildWorkflow()` - Complex child executor
   - Location: /packages/agents/package-builder-production/src/workflows/package-build.workflow.ts
   - 142 lines shown with analysis

**Activities Shown:**
1. Build Activities (`runBuild`, `runTests`, `runQualityChecks`, `publishPackage`)
   - Location: /packages/agents/package-builder-production/src/activities/build.activities.ts
   - 152 lines shown with analysis

2. Agentic Activity (`spawnFixAgent`, `verifyDependencies`)
   - Location: /packages/agents/package-builder-production/src/activities/agent.activities.ts
   - 73 lines shown with analysis

3. Report Activities (`writePackageBuildReport`, `loadAllPackageReports`, `writeBuildReport`)
   - Location: /packages/agents/package-builder-production/src/activities/report.activities.ts
   - 52 lines shown with analysis

**Also Shown:**
- Activity Proxy Configuration Pattern
- Type Definition Examples

**Best for:** Seeing real code patterns in context

---

### CODEBASE_EXPLORATION_SUMMARY.txt (4 KB)
Executive summary in plain text format.

**Contents:**
1. Executive Summary
2. Key Findings (10 major discoveries)
3. Deliverables Created
4. Analysis Methodology
5. Findings Not Yet Explored
6. Recommendations

**Best for:** Quick overview or executive briefing

---

## Key Findings at a Glance

### Workflow Naming
```
Simple/Demo:      <purpose>Workflow              (camelCase)
Complex:          <Entity><Purpose>Workflow      (PascalCase)
Examples:         helloWorkflow, PackageBuildWorkflow
Rule:             ALWAYS ends with "Workflow"
```

### Activity Naming
```
General:          <verb><noun>                   (camelCase)
Entity-focused:   <verb><Entity>                 (camelCase)
CLI-style:        run<Command>                   (runBuild, runTests)
Complex:          <verb><Entity><noun>           (writePackageBuildReport)
Agentic:          spawn<Agent>                   (spawnFixAgent)
Verification:     verify<Resource>               (verifyDependencies)
Rule:             NO "Activity" suffix, always camelCase
```

### Type Naming
```
Pattern:          <Entity><Purpose><Kind>        (PascalCase)
Examples:         PackageBuildInput, BuildResult, PackageBuildReport
```

### Agentic Activities
```
Definition:       Activities that invoke external agents
Primary Example:  spawnFixAgent()
Location:         /packages/agents/package-builder-production/src/activities/agent.activities.ts
Naming Pattern:   spawn<Agent> or spawn<Entity><Action>
Current Status:   TODO - integration not yet complete
```

## Quick Reference: Naming Your New Item

### Is it a Workflow?

1. Is it simple/demo level?
   - YES → Use `<purpose>Workflow` (camelCase)
   - Example: `demoWorkflow`

2. Is it complex/production?
   - YES → Use `<Entity><Purpose>Workflow` (PascalCase)
   - Example: `PackageBuildWorkflow`

### Is it an Activity?

1. Does it invoke an external agent?
   - YES → Use `spawn<Agent>` pattern
   - Example: `spawnFixAgent`

2. Is it a CLI-like command (build, test, publish)?
   - YES → Use `run<Command>` pattern
   - Examples: `runBuild`, `runTests`

3. Is it validation/checking?
   - YES → Use `verify<Resource>` pattern
   - Example: `verifyDependencies`

4. Is it multi-part with entity scope?
   - YES → Use `<verb><Entity><noun>` pattern
   - Example: `writePackageBuildReport`

5. Otherwise, use `<verb><noun>` pattern
   - Examples: `executeSpecDecision`, `processAgentResponse`

## File Locations Quick Reference

### Workflows
- Simple examples: `/packages/temporal-coordinator/src/workflows.ts`
- Complex parent: `/packages/agents/package-builder-production/src/workflows/package-builder.workflow.ts`
- Complex child: `/packages/agents/package-builder-production/src/workflows/package-build.workflow.ts`

### Activities
- Coordination: `/packages/temporal-coordinator/src/activities.ts`
- Build: `/packages/agents/package-builder-production/src/activities/build.activities.ts`
- Agent (Agentic): `/packages/agents/package-builder-production/src/activities/agent.activities.ts`
- Report: `/packages/agents/package-builder-production/src/activities/report.activities.ts`

### Types
- All types: `/packages/agents/package-builder-production/src/types/index.ts`

### Workers
- Coordinator: `/packages/temporal-coordinator/src/worker.ts`
- Package Builder: `/packages/agents/package-builder-production/src/worker.ts`

## Agentic Activities - Special Pattern

The codebase includes a special category of activities called "agentic activities" that are designed to invoke external agents to perform work.

**Key Example:** `spawnFixAgent()`
- Receives quality check failures
- Categorizes failure types
- Looks up or creates appropriate fix prompt
- Currently TODO: would invoke external agent
- Manages prompt templates in `.claude/agents/fix-prompts/`

**Pattern:**
```typescript
export async function spawnFixAgent(input: {
  packagePath: string;
  planPath: string;
  failures: QualityFailure[];
}): Promise<void>
```

**Usage:** Called from PackageBuildWorkflow when quality checks fail (up to 3 retries)

## Activity Timeout Standards

```
General coordination:     5 minutes
Build operations:        10 minutes
Agent activities:        30 minutes (longer for agent work)
Reporting:               1 minute
Retry policy:            3 attempts with exponential backoff
```

## Consistency Checklist

Before committing new workflows/activities, verify:

- [ ] Workflow ends with `Workflow` suffix
- [ ] Workflow is either simple camelCase or complex PascalCase
- [ ] Activity starts with a verb
- [ ] Activity has NO "Activity" suffix
- [ ] Activity is camelCase
- [ ] Activity has explicit input/output types
- [ ] Agentic activities use `spawn<Agent>` pattern
- [ ] Types use `<Entity><Purpose><Kind>` pattern
- [ ] File follows naming convention (*.workflow.ts, *.activities.ts)
- [ ] Activities organized by domain (build, agent, report)
- [ ] Tests in __tests__ subdirectory

## Next Steps

1. Review NAMING_PATTERNS_REFERENCE.md for quick guidance
2. Check CODE_EXAMPLES.md when implementing
3. Reference WORKFLOW_STRUCTURE_ANALYSIS.md for deeper understanding
4. Use CODEBASE_EXPLORATION_SUMMARY.txt for briefings

## Areas Still Requiring Documentation

Per the exploration, the following items were identified as needing further work:

1. Plan writer workflows (mentioned but not yet implemented/documented)
2. Full agentic activity integration (TODO items in code)
3. Standardized error type structures
4. Documented activity timeout standards
5. Complete testing patterns and mocking strategies

---

**Last Updated:** November 13, 2025
**Exploration Thoroughness Level:** Very Thorough - Comprehensive
**Documents Included:** 4 files, ~55 KB total documentation
