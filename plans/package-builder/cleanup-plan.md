# Cleanup Plan: Remove Turn-Based Workflow Code

## Overview

This plan outlines the systematic removal of obsolete turn-based workflow code now that we've integrated CLI agents.

## Files to Remove

### 1. Turn-Based Workflow Files (No Longer Used)
- `packages/agents/package-builder-production/src/workflows/gemini-turn-based-agent.workflow.ts`
- `packages/agents/package-builder-production/src/workflows/turn-based-coding-agent.workflow.ts`
- `packages/agents/package-builder-production/src/workflows/package-build-turn-based.workflow.ts` (if exists)

### 2. Test Files (Keep for Reference Initially)
- `packages/agents/package-builder-production/src/workflows/__tests__/gemini-turn-based-agent.workflow.test.ts`
  - **Action**: Move to `__tests__/archived/` for reference

## Files to Update

### 1. `src/workflows/index.ts`
- Remove exports for turn-based workflows
- Keep only active workflows

### 2. `src/workflows/package-builder.workflow.ts`
- Remove feature flag for `enableTurnBasedGeneration`
- Remove `TurnBasedCodingAgentWorkflow` import
- Always use `PackageBuildWorkflow`

### 3. `src/worker.ts`
- Update comments to reflect CLI-based approach
- Consider removing `turn-based-coding` queue (or keep for backward compatibility temporarily)
- Update documentation

### 4. `src/workflows/package-build.workflow.ts`
- Already updated - verify no remaining references

## API-Specific Code to Review

### Files to Review (May Still Be Used Elsewhere)
- `src/activities/agent-execution.activities.ts` - `executeAgentWithClaude`
  - **Status**: Used by `AgentExecutorWorkflow` - KEEP for now
- `src/activities/gemini-agent.activities.ts` - API-specific activities
  - **Status**: May be used by other workflows - REVIEW before removing
- `src/activities/agent.activities.ts` - `spawnFixAgent`
  - **Status**: Still used in PackageBuildWorkflow for quality fixes - KEEP

## Cleanup Order

### Phase 1: Safe Removals (No Dependencies)
1. Remove turn-based workflow files
2. Update exports in `index.ts`
3. Update `package-builder.workflow.ts` to remove feature flag

### Phase 2: Worker Updates
4. Update `worker.ts` comments and documentation
5. Consider queue consolidation (after testing)

### Phase 3: API Code Review
6. Review `gemini-agent.activities.ts` for unused API code
7. Mark deprecated functions with `@deprecated` tags
8. Create migration guide for any remaining API usage

## Backward Compatibility

- Keep worker queues for now (backward compatibility)
- Mark deprecated exports with `@deprecated` tags
- Add migration notes in code comments

## Testing After Cleanup

- [ ] Verify PackageBuildWorkflow still works
- [ ] Verify PackageBuilderWorkflow still works
- [ ] Test CLI agent integration end-to-end
- [ ] Verify no broken imports

