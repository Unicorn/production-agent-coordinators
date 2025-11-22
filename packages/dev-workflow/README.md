# @bernierllc/dev-workflow

Temporal-based autonomous development workflows for feature development.

## Overview

This package implements Phase 1 of the autonomous development workflow system:
- Planning workflows that create requirements and task breakdowns
- Development task workflows that poll for work and execute tasks
- Dependency tree management with topological sorting
- Integration with BrainGrid CLI for task management

## Installation

```bash
npm install @bernierllc/dev-workflow
```

## Usage

### Start Development Worker

```bash
npm run worker:dev
```

### Run Phase 1 End-to-End Test

```bash
npm run test:phase1
```

## Architecture

- **Workflows**: FeaturePlanningWorkflow, DevelopmentTaskWorkflow
- **Activities**: BrainGrid integration, dependency tree building
- **Types**: Task status, dependency trees, workflow inputs/outputs

## Phase 1 Scope

- Mock task generation (AI-powered in Phase 2)
- Simulated task execution (real execution in Phase 2)
- Polling-based task claiming
- Dependency-aware task readiness

## Next Phases

- Phase 2: Slack integration and conversational requirements
- Phase 3: Real agent execution
- Phase 4+: Testing, deployment, and production workflows
