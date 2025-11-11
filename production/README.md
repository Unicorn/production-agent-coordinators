# Production Directory

This directory contains production-specific code, configurations, and data that should NOT be committed to git.

## Structure

- **configs/** - Real configuration files (API keys, credentials, etc.) - GITIGNORED
- **scripts/** - Production scripts for running workflows
- **master-plans/** - Real master plans with actual package lists - GITIGNORED

## Usage

### Master Plans

Place real master plans in `master-plans/`:

```bash
production/master-plans/
├── content-management-suite.md
├── social-media-suite.md
└── analytics-suite.md
```

These files contain actual package dependency graphs and should be gitignored to keep proprietary information private.

### Config Files

Place production configs in `configs/`:

```bash
production/configs/
├── temporal.json          # Temporal connection config
├── npm-registry.json      # NPM registry credentials
└── build-env.json         # Build environment variables
```

### Scripts

Production scripts go in `scripts/`:

```bash
production/scripts/
├── run-content-suite.ts   # Script to build content-management-suite
├── run-social-suite.ts    # Script to build social-media-suite
└── deploy-suite.ts        # Deployment script
```

These scripts import from the production agent implementations and use real configuration files.

## Example Script

```typescript
#!/usr/bin/env tsx

import { Connection, Client } from '@temporalio/client';
import type { SuiteBuilderWorkflowConfig } from '@coordinator/temporal-coordinator';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const connection = await Connection.connect({
    address: 'localhost:7233',
  });

  const client = new Client({ connection });

  const config: SuiteBuilderWorkflowConfig = {
    goalId: 'build-content-suite',
    suiteName: 'content-management-suite',
    masterPlanPath: path.join(__dirname, '../master-plans/content-management-suite.md'),
    specConfig: {
      maxConcurrentBuilds: 4,
      enableMCPLocking: false,
    },
    agentConfig: {
      baseDir: __dirname,
      verbose: true,
    },
    maxIterations: 500,
  };

  const handle = await client.workflow.start('suiteBuilderWorkflow', {
    taskQueue: 'agent-coordinator-queue',
    workflowId: `suite-builder-${Date.now()}`,
    args: [config],
  });

  console.log(`Started workflow: ${handle.workflowId}`);

  const result = await handle.result();
  console.log('Workflow completed:', result);
}

main().catch(console.error);
```

## Security

NEVER commit files from this directory containing:
- API keys or credentials
- Proprietary package lists
- Internal architecture details
- Customer data

Use the .gitignore to protect sensitive files.
