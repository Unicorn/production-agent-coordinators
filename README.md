# Production Agent Coordinators

This is the production repository for agent coordinators, forked from [agent-coordinators](../agent-coordinators).

## Repository Structure

```
production-agent-coordinators/
├── production/              # Production-specific code and configurations
│   ├── configs/            # Real configuration files (gitignored)
│   ├── scripts/            # Production scripts
│   └── master-plans/       # Real master plans (gitignored)
│
├── packages/
│   ├── agents/             # Production agent implementations
│   │   └── suite-builder-production/
│   ├── specs/              # Production-specific specs
│   └── workflows/          # Custom workflow implementations
│
└── README.md
```

## Setup

This repository uses the upstream/downstream pattern:

- **Upstream** (agent-coordinators): Framework code, demos, stubs
- **Downstream** (production-agent-coordinators): Production implementations, real configs

### Git Workflow

```bash
# Pull latest framework updates from upstream
git fetch upstream
git merge upstream/main

# Make changes specific to production
# ... edit files ...

# Commit and push to production repo
git add .
git commit -m "Your changes"
git push origin main

# To contribute generalizable changes back to upstream
cd ../agent-coordinators
# ... make changes ...
git commit -m "Generalizable feature"
git push origin main
```

## What Goes Where

### Upstream (agent-coordinators)
- Framework packages (engine, contracts, specs, temporal-coordinator)
- Stub agent implementations with fake data
- Example configurations
- Documentation and demos

### Downstream (production-agent-coordinators)
- Real agent implementations (build, test, publish)
- Production configuration files (gitignored)
- Real master plans (gitignored)
- Production scripts and workflows
- Custom specs for production use cases

## Getting Started

1. Ensure upstream remote is configured:
```bash
git remote add upstream /Users/mattbernier/projects/agent-coordinators
```

2. Pull base framework code:
```bash
git fetch upstream
git merge upstream/main
```

3. Add your production-specific code to:
   - `production/` - configs, scripts, master plans
   - `packages/agents/` - real implementations
   - `packages/specs/` - production specs

4. Keep sensitive files gitignored (see .gitignore)

## Development

The production implementations extend the framework packages:

```typescript
// Import from upstream framework
import type { Agent } from '@coordinator/contracts';
import { Engine } from '@coordinator/engine';

// Implement real production logic
export class ProductionSuiteBuilderAgent implements Agent {
  // Real npm install, test running, package publishing
  async execute(instruction: string): Promise<string> {
    // Production implementation here
  }
}
```

## Syncing with Upstream

Regularly pull updates from the upstream framework:

```bash
# Check for upstream changes
git fetch upstream
git log HEAD..upstream/main --oneline

# Merge upstream changes
git merge upstream/main

# Resolve any conflicts
# Test that everything still works
# Commit the merge
```

## Contributing Back to Upstream

When you develop something generalizable:

1. Implement in this repo first (production context)
2. Test thoroughly
3. Extract the generalizable parts
4. Switch to agent-coordinators repo
5. Implement the generalized version with stubs
6. Create examples and documentation
7. Commit and push to upstream

This ensures features are proven in production before being added to the framework.
