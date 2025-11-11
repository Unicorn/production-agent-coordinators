# How to Use the CLI

The Agent Coordinator CLI is your primary interface for running workflows, managing configurations, and inspecting the system.

## What You'll Learn

- All CLI commands and their options
- How to configure the CLI
- How to debug workflow execution
- How to automate with scripts

## Installation

The CLI is built as part of the project:

```bash
cd agent-coordinator
yarn install
yarn build

# CLI is available at:
cd packages/cli
node dist/cli.js --help
```

## Command Overview

```bash
coordinator <command> [options]

Commands:
  run <spec>        Run a workflow with the specified spec
  list-specs        List all available workflow specs
  list-agents       List all available agents
  init-config       Initialize a configuration file

Options:
  -V, --version     Output the version number
  -h, --help        Display help for command
```

## Running Workflows

### Basic Usage

```bash
node dist/cli.js run <spec>
```

**Example:**

```bash
node dist/cli.js run hello
```

### With Agent Selection

```bash
node dist/cli.js run <spec> --agent <agent>
```

**Examples:**

```bash
# Use mock agent
node dist/cli.js run hello --agent mock

# Use Claude agent
node dist/cli.js run todo --agent anthropic
```

### With Custom Config

```bash
node dist/cli.js run <spec> --config <path>
```

**Examples:**

```bash
# Use config in current directory
node dist/cli.js run hello --config .coordinatorrc

# Use config from specific location
node dist/cli.js run todo --config /path/to/config.json
```

### Combined Options

```bash
node dist/cli.js run todo \
  --agent anthropic \
  --config ./configs/production.json
```

## Listing Resources

### List Specs

View all available workflow specifications:

```bash
node dist/cli.js list-specs
```

**Output:**

```
Available Workflow Specs:

  - hello
  - todo
  - review

Total: 3 specs
```

### List Specs (Verbose)

Get detailed information:

```bash
node dist/cli.js list-specs --verbose
```

**Output:**

```
Available Workflow Specs:

  hello
    Simple hello world workflow - requests greeting and completes

  todo
    Multi-step todo workflow: gather requirements, create tasks, and confirm completion

  review
    Code review workflow: analyze code, generate suggestions, create report

Total: 3 specs
```

### List Agents

View all available agents:

```bash
node dist/cli.js list-agents
```

**Output:**

```
Available Agents:

  - mock
  - anthropic
  - database

Total: 3 agents
```

### List Agents (Verbose)

```bash
node dist/cli.js list-agents --verbose
```

**Output:**

```
Available Agents:

  mock
    Mock agent for testing and development
    Supports: greet, gather_requirements, create_tasks, confirm_completion

  anthropic
    Claude-powered AI agent
    Supports: all work kinds

  database
    PostgreSQL database agent
    Supports: query, execute

Total: 3 agents
```

## Configuration Management

### Initialize Config

Create a new configuration file:

```bash
node dist/cli.js init-config
```

Creates `.coordinatorrc` in the current directory:

```json
{
  "defaultAgent": "mock",
  "defaultSpec": "hello",
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

### Initialize JSON Config

```bash
node dist/cli.js init-config --format json
```

### Initialize JavaScript Config

```bash
node dist/cli.js init-config --format js
```

Creates `coordinator.config.js`:

```javascript
export default {
  defaultAgent: 'mock',
  defaultSpec: 'hello',
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY || ''
  }
};
```

### Custom Output Path

```bash
node dist/cli.js init-config --output ./configs/dev.json
```

## Configuration Files

The CLI searches for configuration in this order:

1. `--config` option path
2. `.coordinatorrc` (current directory)
3. `.coordinatorrc.json`
4. `coordinator.config.js`
5. `package.json` (coordinator field)
6. Default configuration

### Configuration Format

**JSON (.coordinatorrc):**

```json
{
  "defaultAgent": "anthropic",
  "defaultSpec": "hello",
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}",
    "openai": "${OPENAI_API_KEY}"
  },
  "agents": {
    "anthropic": {
      "model": "claude-3-5-sonnet-20241022",
      "maxTokens": 4096,
      "temperature": 1.0
    }
  },
  "specs": {
    "todo": {
      "defaultAgent": "anthropic",
      "maxTasks": 10
    }
  },
  "storage": {
    "type": "local",
    "path": "./output"
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

**JavaScript (coordinator.config.js):**

```javascript
export default {
  defaultAgent: process.env.NODE_ENV === 'production' ? 'anthropic' : 'mock',

  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY,
  },

  agents: {
    anthropic: {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
    },
  },

  specs: {
    todo: {
      maxTasks: parseInt(process.env.MAX_TASKS || '10', 10),
    },
  },
};
```

## Debugging and Logging

### Enable Debug Logging

```bash
DEBUG=coordinator:* node dist/cli.js run hello
```

**Output:**

```
coordinator:cli Loading configuration from .coordinatorrc
coordinator:container Registering spec factory name=hello
coordinator:container Registering agent factory name=mock
coordinator:engine Initializing workflow goalId=hello-1
coordinator:spec Requesting greeting work
coordinator:engine Applying REQUEST_WORK action stepId=step-1
coordinator:agent Executing work kind=greet
coordinator:engine Applying AGENT_RESPONSE stepId=step-1 status=OK
coordinator:spec Greeting completed, finalizing workflow
coordinator:engine Workflow finalized status=COMPLETED
```

### Debug Specific Components

```bash
# Only engine logs
DEBUG=coordinator:engine node dist/cli.js run hello

# Engine and spec logs
DEBUG=coordinator:engine,coordinator:spec node dist/cli.js run todo

# All except agent logs
DEBUG=coordinator:*,-coordinator:agent node dist/cli.js run hello
```

### Verbose Output

```bash
# Enable all debug output
DEBUG=* node dist/cli.js run hello
```

### Log to File

```bash
# Redirect output
node dist/cli.js run hello > workflow.log 2>&1

# Or with debug enabled
DEBUG=coordinator:* node dist/cli.js run hello 2>&1 | tee workflow.log
```

## Exit Codes

The CLI uses standard exit codes:

- **0** - Success
- **1** - Failure (workflow error, config error, etc.)

**Use in scripts:**

```bash
#!/bin/bash

if node dist/cli.js run hello; then
  echo "Workflow succeeded"
else
  echo "Workflow failed"
  exit 1
fi
```

## Environment Variables

### Configuration Variables

```bash
# API Keys
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."

# Storage
export STORAGE_PATH="./output"
export STORAGE_TYPE="local"

# Logging
export LOG_LEVEL="debug"
export LOG_FORMAT="json"

# Agent Mode
export AGENT_MODE="mock"  # or "anthropic"
```

### Using in Config

Reference environment variables:

```json
{
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  },
  "storage": {
    "path": "${STORAGE_PATH}"
  }
}
```

## Scripting and Automation

### Bash Script

```bash
#!/bin/bash
# run-workflows.sh

set -e  # Exit on error

# Configuration
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
CLI="node dist/cli.js"

# Run workflows
echo "Running hello workflow..."
$CLI run hello --agent mock

echo "Running todo workflow..."
$CLI run todo --agent anthropic

echo "All workflows completed successfully"
```

### CI/CD Integration

**GitHub Actions:**

```yaml
name: Test Workflows

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: yarn install

      - name: Build
        run: yarn build

      - name: Run workflow tests
        run: |
          cd packages/cli
          node dist/cli.js run hello --agent mock
          node dist/cli.js run todo --agent mock

      - name: Run with Claude (optional)
        if: ${{ secrets.ANTHROPIC_API_KEY }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          cd packages/cli
          node dist/cli.js run hello --agent anthropic
```

### NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "workflow:hello": "cd packages/cli && node dist/cli.js run hello",
    "workflow:todo": "cd packages/cli && node dist/cli.js run todo",
    "workflow:all": "yarn workflow:hello && yarn workflow:todo"
  }
}
```

Usage:

```bash
yarn workflow:hello
yarn workflow:todo
yarn workflow:all
```

## Advanced Usage

### Custom CLI Wrapper

Create a wrapper script for convenience:

```bash
#!/bin/bash
# coordinator (in your PATH)

cd /path/to/agent-coordinator/packages/cli
node dist/cli.js "$@"
```

Make executable:

```bash
chmod +x coordinator
sudo mv coordinator /usr/local/bin/
```

Now use from anywhere:

```bash
coordinator run hello
coordinator list-specs
```

### JSON Output

Parse CLI output in scripts:

```bash
# Run workflow and capture output
OUTPUT=$(node dist/cli.js run hello 2>/dev/null)

# Parse with jq
GREETING=$(echo "$OUTPUT" | jq -r '.greeting.message')
echo "Agent said: $GREETING"
```

### Parallel Execution

Run multiple workflows in parallel:

```bash
#!/bin/bash

# Run workflows in background
node dist/cli.js run hello --agent mock > hello.log 2>&1 &
PID1=$!

node dist/cli.js run todo --agent mock > todo.log 2>&1 &
PID2=$!

# Wait for all to complete
wait $PID1 $PID2

echo "All workflows completed"
```

### Conditional Execution

```bash
#!/bin/bash

# Run hello, if successful run todo
if node dist/cli.js run hello; then
  echo "Hello succeeded, running todo..."
  node dist/cli.js run todo
else
  echo "Hello failed, skipping todo"
  exit 1
fi
```

## Troubleshooting

### "Command not found"

Ensure you're in the correct directory:

```bash
cd agent-coordinator/packages/cli
node dist/cli.js --help
```

Or use full path:

```bash
node /path/to/agent-coordinator/packages/cli/dist/cli.js --help
```

### "Module not found"

Rebuild the CLI:

```bash
cd packages/cli
yarn install
yarn build
```

### "Config file not found"

Check configuration search paths:

```bash
# Show where CLI looks for config
DEBUG=coordinator:config node dist/cli.js run hello
```

Specify config explicitly:

```bash
node dist/cli.js run hello --config /full/path/to/.coordinatorrc
```

### "Spec not found"

List available specs:

```bash
node dist/cli.js list-specs
```

Ensure spec package is built:

```bash
yarn workspace @coordinator/specs-<name> build
```

### "Agent not available"

List available agents:

```bash
node dist/cli.js list-agents
```

Check agent registration in `src/workflow-runner.ts`.

## Tips and Best Practices

### 1. Use Configuration Files

Don't pass options repeatedly:

```bash
# Bad - repetitive
node dist/cli.js run hello --agent anthropic
node dist/cli.js run todo --agent anthropic

# Good - use config
echo '{"defaultAgent": "anthropic"}' > .coordinatorrc
node dist/cli.js run hello
node dist/cli.js run todo
```

### 2. Use Environment-Specific Configs

```bash
# Development
node dist/cli.js run hello --config .coordinatorrc.dev

# Production
node dist/cli.js run hello --config .coordinatorrc.prod
```

### 3. Enable Logging for Debugging

Always use DEBUG when troubleshooting:

```bash
DEBUG=coordinator:* node dist/cli.js run hello
```

### 4. Test with Mock Agents First

```bash
# Test workflow logic
node dist/cli.js run my-workflow --agent mock

# Then test with real agents
node dist/cli.js run my-workflow --agent anthropic
```

### 5. Capture Output for Processing

```bash
# Save results
node dist/cli.js run hello > results.json

# Process results
cat results.json | jq '.greeting.message'
```

## Next Steps

- [Configure agents](configure-agents.md) for different workflows
- [Create custom workflows](create-custom-workflow.md)
- [Learn automation patterns](../use-cases/simple-automation.md)
- [Explore configuration options](../reference/configuration.md)

## Related Documentation

- [CLI Commands Reference](../reference/cli-commands.md)
- [Configuration Reference](../reference/configuration.md)
- [Troubleshooting](../troubleshooting.md)
