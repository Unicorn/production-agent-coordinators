# Cursor Agent Parallelization Guide

## Overview

Cursor 2.0+ supports running multiple agents in parallel, allowing you to work on different phases of the implementation roadmap simultaneously. This guide explains how to set up and use parallel agents effectively.

## How to Parallelize Agents in Cursor

### 1. Access Multi-Agent Interface

- Open Cursor IDE
- Navigate to the **agent management sidebar** (usually on the right or left panel)
- You'll see options to create and manage multiple agents

### 2. Create Multiple Agents

When you submit a prompt, you can:
- **Option A**: Use the multi-agent interface to spawn multiple agents
- **Option B**: Open multiple Cursor windows/instances with different worktrees
- **Option C**: Use background agents for async work

### 3. Isolate Agent Environments

Each agent needs its own isolated environment to prevent conflicts:

**Using Git Worktrees** (Recommended):
```bash
# Create worktrees for different agents
git worktree add ../production-agent-coordinators-phase0 phase0
git worktree add ../production-agent-coordinators-phase1 phase1
git worktree add ../production-agent-coordinators-phase2 phase2

# Each agent works in its own worktree
cd ../production-agent-coordinators-phase0  # Agent 1
cd ../production-agent-coordinators-phase1  # Agent 2
cd ../production-agent-coordinators-phase2  # Agent 3
```

**Using Remote Machines**:
- Set up agents on different machines/servers
- Each agent connects to its own environment
- No file conflicts possible

### 4. Assign Work to Agents

Based on the implementation roadmap, here's how to parallelize:

#### Agent 1: Database & Backend Foundation
**Worktree**: `phase0-backend`
**Phases**: 0, 1, 2, 3
**Tasks**:
- Database migrations
- Backend naming changes
- Service interfaces backend
- Connectors backend

**Prompt Example**:
```
I'm working on Phase 0-3 of the services/components/connectors refactor.
Focus on backend work: database migrations, tRPC routers, and API endpoints.
See docs/plans/2025-01-20-implementation-roadmap.md for details.
```

#### Agent 2: Frontend Core
**Worktree**: `phase4-frontend`
**Phases**: 4, 5, 6, 7
**Tasks**:
- Frontend naming changes
- Service interfaces frontend
- Connectors frontend
- Component connector pattern

**Prompt Example**:
```
I'm working on Phase 4-7 of the services/components/connectors refactor.
Focus on frontend UI components, React components, and user interfaces.
See docs/plans/2025-01-20-implementation-roadmap.md for details.
```

#### Agent 3: Visualization
**Worktree**: `phase8-visualization`
**Phases**: 8, 9, 10, 11
**Tasks**:
- Inside/outside visualization foundation
- Service builder view
- Project view
- UI utility enhancements

**Prompt Example**:
```
I'm working on Phase 8-11 of the services/components/connectors refactor.
Focus on React Flow visualization, ServiceContainerNode, and zone-based layouts.
See docs/plans/2025-01-20-inside-outside-service-visualization.md for details.
```

#### Agent 4: Integration & Security
**Worktree**: `phase12-integration`
**Phases**: 12, 13, 14
**Tasks**:
- Authentication & security
- Kong integration
- Nexus integration

**Prompt Example**:
```
I'm working on Phase 12-14 of the services/components/connectors refactor.
Focus on security, API keys, Kong routes, and Temporal Nexus integration.
See docs/plans/2025-01-20-implementation-roadmap.md for details.
```

## Best Practices

### 1. Clear Task Boundaries

Give each agent a clear, non-overlapping scope:
- ✅ "Work on database migrations for service_interfaces table"
- ❌ "Work on everything related to interfaces"

### 2. Regular Sync Points

Set up sync points where agents merge their work:
- **Daily**: Merge worktrees back to main branch
- **After each phase**: Review and integrate changes
- **Before dependent phases**: Ensure dependencies are met

### 3. Communication Between Agents

Use shared documentation:
- Update `docs/plans/2025-01-20-implementation-roadmap.md` with progress
- Use TODO comments in code for handoffs
- Document API contracts in shared files

### 4. Conflict Prevention

**File-Level Separation**:
- Agent 1: `packages/workflow-builder/src/server/api/routers/serviceInterfaces.ts`
- Agent 2: `packages/workflow-builder/src/components/interfaces/`
- Agent 3: `packages/workflow-builder/src/components/workflow/ServiceContainerNode.tsx`

**Database-Level Separation**:
- Agent 1: Creates migrations
- Agent 2: Uses migrations (reads only)
- Agent 3: Uses migrations (reads only)

## Example Workflow

### Day 1: Setup

```bash
# Create worktrees
git worktree add ../pac-phase0-backend -b phase0-backend
git worktree add ../pac-phase4-frontend -b phase4-frontend
git worktree add ../pac-phase8-visualization -b phase8-visualization

# Open separate Cursor windows
cd ../pac-phase0-backend && cursor .
cd ../pac-phase4-frontend && cursor .
cd ../pac-phase8-visualization && cursor .
```

### Day 1-3: Parallel Work

**Agent 1 (Backend)**:
- Creates database migrations
- Creates `serviceInterfaces` router
- Creates `connectors` router

**Agent 2 (Frontend)**:
- Updates UI terminology
- Prepares component structure
- Waits for Agent 1's API endpoints

**Agent 3 (Visualization)**:
- Designs ServiceContainerNode structure
- Prepares React Flow integration
- Waits for Agent 1's data models

### Day 3: Sync Point

```bash
# Merge Agent 1's work
git checkout main
git merge phase0-backend

# Update other worktrees
cd ../pac-phase4-frontend
git pull origin main

cd ../pac-phase8-visualization
git pull origin main
```

### Day 4-6: Continue Parallel Work

**Agent 1**: Continues with Phase 2-3
**Agent 2**: Starts Phase 5-6 (now that APIs exist)
**Agent 3**: Starts Phase 8 (now that data models exist)

## Using Background Agents

Cursor also supports **background agents** that work asynchronously:

1. **Start Background Agent**:
   - Submit a task
   - Choose "Run in background"
   - Agent works in remote environment

2. **Monitor Progress**:
   - Check agent status in sidebar
   - View logs and changes
   - Send follow-up instructions

3. **Take Over**:
   - Review agent's work
   - Accept or modify changes
   - Continue manually if needed

## Limitations & Considerations

### Maximum Parallel Agents
- **Up to 8 agents** can run simultaneously
- Each agent uses resources (CPU, memory, API credits)
- Monitor resource usage

### File Conflicts
- Agents working on same files will conflict
- Use worktrees or clear file boundaries
- Merge carefully with conflict resolution

### API Rate Limits
- Multiple agents = multiple API calls
- Monitor API usage
- Consider rate limiting if needed

### Coordination Overhead
- More agents = more coordination needed
- Regular sync points essential
- Clear communication critical

## Recommended Parallelization Strategy

For the implementation roadmap:

### Week 1-3: 3 Agents
1. **Agent 1**: Phases 0-3 (Backend foundation)
2. **Agent 2**: Prepares Phase 4 (Frontend prep work)
3. **Agent 3**: Prepares Phase 8 (Visualization design)

### Week 3-6: 4 Agents
1. **Agent 1**: Finishes Phase 2-3
2. **Agent 2**: Phase 4-5 (Frontend core)
3. **Agent 3**: Phase 6-7 (Connectors frontend)
4. **Agent 4**: Phase 8 (Visualization foundation)

### Week 6-10: 3 Agents
1. **Agent 1**: Phase 9 (Service Builder View)
2. **Agent 2**: Phase 10 (Project View)
3. **Agent 3**: Phase 11 (UI Utility)

### Week 10-13: 3 Agents
1. **Agent 1**: Phase 12 (Security)
2. **Agent 2**: Phase 13 (Kong)
3. **Agent 3**: Phase 14 (Nexus)

## Quick Start Commands

```bash
# Setup worktrees for parallel agents
git worktree add ../pac-backend -b backend-work
git worktree add ../pac-frontend -b frontend-work
git worktree add ../pac-viz -b visualization-work

# Open in separate Cursor windows
cd ../pac-backend && cursor . &
cd ../pac-frontend && cursor . &
cd ../pac-viz && cursor . &

# Daily sync
git checkout main
git merge backend-work
git merge frontend-work
git merge visualization-work
```

## Tips for Success

1. **Start Small**: Begin with 2-3 agents, scale up
2. **Clear Scope**: Each agent needs distinct, non-overlapping work
3. **Regular Syncs**: Merge work frequently to avoid large conflicts
4. **Monitor Progress**: Check in daily on each agent's progress
5. **Document Handoffs**: Use comments and docs for agent-to-agent communication
6. **Test Integration**: Regularly test that agents' work integrates correctly

## Troubleshooting

### Agents Overwriting Each Other
- **Solution**: Use git worktrees or clear file boundaries
- **Prevention**: Assign specific files/directories to each agent

### Merge Conflicts
- **Solution**: Resolve conflicts manually, communicate with agents
- **Prevention**: Regular syncs, clear file ownership

### Agents Blocked on Dependencies
- **Solution**: Agent 1 completes dependencies first
- **Prevention**: Follow roadmap dependency order

### Resource Exhaustion
- **Solution**: Reduce number of parallel agents
- **Prevention**: Monitor system resources

