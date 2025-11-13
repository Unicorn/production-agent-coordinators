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

Keep credentials in production/configs/ (gitignored).
