# Enhanced Discovery with Plan Generation

## Status
In Progress - Foundation Complete

## Goal
Enable workflow to automatically generate missing package plans by traversing dependency lineage from suite/parent plans.

## What We Built Today
✅ `discoverPlanFromDependencyGraph()` - Traverses MCP dependency graph to find plans
✅ Comprehensive tests (16/16 passing)
✅ TDD implementation with RED-GREEN-REFACTOR

## Next Steps

### 1. Integrate Discovery into Workflow
**File**: `src/workflows/suite-builder.workflow.ts:159-186` (discoveryPhase)

**Current**: Fails when package not found on filesystem
**Needed**:
- Add proxy for `discoverPlanFromDependencyGraph`
- Call when searchForPackage fails
- Check if package exists in MCP
- Find highest-level plan (suite > parent > dependency)

### 2. Plan Generation Orchestration
**New Activity**: `src/activities/planning.activities.ts`

```typescript
async function generatePlanLineage(input: {
  targetPackage: string;
  parentPlanPath: string;
  parentPlanContent: string;
  dependencyChain: string[]; // [suite, parent, ..., target]
  mcpServerUrl: string;
  workspaceRoot: string;
}): Promise<{ planPath: string; branchName: string }[]>
```

**Logic**:
- For each package in chain (top-down)
- Call package-planning-writer agent:
  - Prompt: `"Given parent plan {path}, write plan for {package} following tool repo requirements. Reply with plan file path."`
- Register plan with MCP (plan_file_path + branch_name)
- Return plan info for target package

### 3. Update MCP Registration
**MCP Params**: Add `branch_name` to packages_update tool call

### 4. Wire Into Workflow
**discoveryPhase** → calls `discoverPlanFromDependencyGraph`
**planningPhase** → calls `generatePlanLineage` if needed
**Continue** → with generated plan for target package

## Agent Integration
**Agent**: `/Users/mattbernier/projects/tools/.claude/agents/package-planning-writer.md`
**Usage**: Execute via Task tool or subprocess for each plan in lineage

## Test Case
`@bernierllc/github-parser`:
- Exists in MCP, no plan
- Has dependency `@bernierllc/webhook-receiver` (also no plan)
- Both depend on suite plan (if it exists)
- Workflow should generate plans top-down, then build

## Files Modified
- ✅ `src/activities/discovery.activities.ts` - Added `discoverPlanFromDependencyGraph`
- ✅ `src/activities/__tests__/discovery.activities.test.ts` - Added tests
- ⏳ `src/workflows/suite-builder.workflow.ts` - Needs integration
- ⏳ `src/activities/planning.activities.ts` - Needs plan generation orchestration
