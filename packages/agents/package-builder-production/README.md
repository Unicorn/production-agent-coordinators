# Production Package Builder Agent

This is the production implementation of the Package Builder agent with real build, test, and publish capabilities.

## Overview

Unlike the stub implementation in the upstream framework, this agent:
- Actually runs `npm install` / `yarn install`
- Runs real test suites
- Publishes packages to npm registry
- Uses real credentials and configurations

## Implementation

```typescript
import type { Agent } from '@coordinator/contracts';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ProductionSuiteBuilderAgent implements Agent {
  name = 'package-builder-production';
  capabilities = ['build-package', 'test-package', 'publish-package'];

  async execute(instruction: string): Promise<string> {
    // Parse instruction
    const match = instruction.match(/^(\w+)-package: (.+)$/);
    if (!match) {
      throw new Error(\`Invalid instruction: \${instruction}\`);
    }

    const [, action, packageName] = match;

    switch (action) {
      case 'build':
        return this.buildPackage(packageName);
      case 'test':
        return this.testPackage(packageName);
      case 'publish':
        return this.publishPackage(packageName);
      default:
        throw new Error(\`Unknown action: \${action}\`);
    }
  }

  private async buildPackage(packageName: string): Promise<string> {
    try {
      // Real implementation would:
      // 1. Clone/checkout the package
      // 2. Run npm install
      // 3. Run build commands
      // 4. Return build output

      const { stdout, stderr } = await execAsync(\`yarn workspace \${packageName} build\`);
      return \`Built \${packageName}\\n\${stdout}\`;
    } catch (error) {
      throw new Error(\`Failed to build \${packageName}: \${error}\`);
    }
  }

  private async testPackage(packageName: string): Promise<string> {
    try {
      const { stdout } = await execAsync(\`yarn workspace \${packageName} test\`);
      return \`Tests passed for \${packageName}\\n\${stdout}\`;
    } catch (error) {
      throw new Error(\`Tests failed for \${packageName}: \${error}\`);
    }
  }

  private async publishPackage(packageName: string): Promise<string> {
    try {
      const { stdout } = await execAsync(\`yarn workspace \${packageName} publish\`);
      return \`Published \${packageName}\\n\${stdout}\`;
    } catch (error) {
      throw new Error(\`Failed to publish \${packageName}: \${error}\`);
    }
  }
}
```

## Configuration

Create `production/configs/build-env.json`:

```json
{
  "npmRegistry": "https://registry.npmjs.org/",
  "npmToken": "npm_...",
  "workspaceRoot": "/Users/mattbernier/projects/tools",
  "maxConcurrentBuilds": 4
}
```

## Turn-Based Package Generation

For large or complex packages that exceed token limits or require comprehensive generation with recovery support, use the turn-based workflow.

### Overview

Turn-based generation breaks package scaffolding into 15 focused phases, each with its own Claude API call, git commit, and state checkpoint. This approach:

- Avoids hitting Claude API token limits (16K output, 200K context)
- Spreads work over time to comply with rate limits (8000 tokens/minute)
- Enables recovery from failures without starting over
- Provides clear phase-by-phase progress tracking
- Commits after each phase for easy debugging

### Quick Start

```typescript
import { PackageBuildTurnBasedWorkflow } from '@bernierllc/package-builder-production';
import type { TurnBasedPackageBuildInput } from '@bernierllc/package-builder-production';

const input: TurnBasedPackageBuildInput = {
  packageName: '@bernierllc/data-validator',
  packagePath: 'packages/core/data-validator',
  planPath: 'plans/packages/core/data-validator.md',
  category: 'core',
  dependencies: [],
  workspaceRoot: process.cwd(),
  config: {
    // ... your build config ...
    turnBasedGeneration: {
      enabled: true
    }
  },
  enableTurnBasedGeneration: true
};

const handle = await client.workflow.start(PackageBuildTurnBasedWorkflow, {
  taskQueue: 'package-builder',
  args: [input]
});
```

### The 15 Phases

1. **PLANNING** - Create plan and architecture blueprint (5000 tokens)
2. **FOUNDATION** - Generate config files (3000 tokens)
3. **TYPES** - Generate type definitions (4000 tokens)
4. **CORE_IMPLEMENTATION** - Implement main functionality (8000 tokens)
5. **ENTRY_POINT** - Create barrel file (2000 tokens)
6. **UTILITIES** - Generate utility functions (4000 tokens)
7. **ERROR_HANDLING** - Create error classes (3000 tokens)
8. **TESTING** - Generate test suite (6000 tokens)
9. **DOCUMENTATION** - Write README and docs (3000 tokens)
10. **EXAMPLES** - Create usage examples (4000 tokens)
11. **INTEGRATION_REVIEW** - Review integrations (4000 tokens)
12. **CRITICAL_FIXES** - Fix issues from review (5000 tokens)
13. **BUILD_VALIDATION** - Validate build and tests (4000 tokens)
14. **FINAL_POLISH** - Final quality pass (3000 tokens)
15. **MERGE** - Prepare for merge (manual)

Total execution time: 25-35 minutes

### When to Use Turn-Based

Use turn-based generation for:

- Core packages requiring 90% test coverage
- Packages with 10+ source files
- Complex integrations (logger, neverhub)
- High-value packages requiring comprehensive testing
- Recovery from previous generation failures

Use original single-shot workflow for:

- Simple utility packages
- Fewer than 5 source files
- Quick prototypes
- Time-sensitive generation

### Recovery from Failures

If a turn-based workflow fails, resume from the last successful phase:

```typescript
import { loadGenerationState } from '@bernierllc/package-builder-production';

// Load failed session context
const context = await loadGenerationState('gen-1732198765432', process.cwd());

if (context) {
  // Resume with same input, adding context
  const resumeInput: TurnBasedPackageBuildInput = {
    ...originalInput,
    resumeFromContext: context
  };

  const handle = await client.workflow.start(PackageBuildTurnBasedWorkflow, {
    taskQueue: 'package-builder',
    args: [resumeInput]
  });
}
```

### Monitoring Progress

State files track progress in `.generation-state/` directory:

```bash
# Watch current phase
watch -n 2 'cat .generation-state/gen-*.json | jq ".currentPhase, .currentStepNumber"'

# View git commits per phase
git log --oneline feat/package-generation-<timestamp>
```

### Documentation

Comprehensive documentation available:

- **[Architecture](./docs/architecture/turn-based-generation.md)** - System design, phases, state management
- **[Operator Guide](./docs/guides/turn-based-generation-guide.md)** - Configuration, monitoring, recovery, troubleshooting
- **[Migration Guide](./docs/guides/migrating-to-turn-based.md)** - When to use, migration steps, rollback procedures

## Usage

Register this agent instead of the stub when running production workflows:

```typescript
import { Engine } from '@coordinator/engine';
import { ProductionSuiteBuilderAgent } from './packages/agents/package-builder-production';

const engine = new Engine();
engine.registerAgent(new ProductionSuiteBuilderAgent());
```

## Testing

Test the production agent with a small package first:

```bash
cd production/scripts
tsx test-production-agent.ts
```

## Security

This agent requires:
- NPM authentication token
- Write access to npm registry
- Access to source code repositories
- Claude API key with appropriate rate limits

Keep credentials in production/configs/ (gitignored).
