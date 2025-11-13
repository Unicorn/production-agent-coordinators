# Top-Down Package Planning Workflow

## Status
Future Enhancement

## Vision
Autonomous workflow that coordinates plan writing from suite-level down to individual packages, ensuring complete plan coverage before building.

## Use Case
When user requests: `yarn start:client @bernierllc/github-parser`
- Package exists in MCP (status: planning)
- No plan files exist anywhere in dependency tree
- Workflow autonomously creates complete plan hierarchy

## Architecture

### Phase 1: Plan Discovery & Analysis
1. Check MCP for target package
2. Get complete dependency graph (deps + dependents)
3. Identify highest-level context (suite, service, or root dependency)
4. Determine plan lineage: suite → service → package → target

### Phase 2: Plan Generation (Top-Down)
**For each level in lineage**:
1. Invoke package-planning-writer agent
2. Agent reads parent context + MCP package metadata
3. Agent writes plan following tool repo structure
4. Register plan with MCP (path + branch)
5. Next level uses this plan as parent context

### Phase 3: Validation
- Verify all plans in lineage exist
- Validate MECE compliance across suite
- Check dependency completeness
- Return ready-to-build plan set

## Workflow Input
```typescript
{
  targetPackage: string;
  mcpServerUrl: string;
  workspaceRoot: string;
  agentPath: string; // package-planning-writer.md
}
```

## Workflow Output
```typescript
{
  plansGenerated: {
    packageName: string;
    planPath: string;
    branchName: string;
    level: 'suite' | 'service' | 'package';
  }[];
  targetPlanPath: string;
  readyToBuild: boolean;
}
```

## Integration Points
- **MCP**: Query packages, dependencies, register plans
- **Agent**: package-planning-writer for plan generation
- **Git**: Branch management for plan PRs
- **Suite Builder**: Consumes generated plans for building

## Future Enhancements
- Parallel plan generation for independent branches
- Plan diff/merge when updating existing plans
- Interactive plan review before building
- Plan template library for common patterns
- AI-assisted MECE validation during generation

## Dependencies
- Enhanced discovery (current work)
- MCP branch_name parameter
- package-planning-writer agent
- Plan validation framework
