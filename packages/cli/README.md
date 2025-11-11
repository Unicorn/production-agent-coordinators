# @coordinator/cli

CLI tools for executing agent workflows in the coordinator system.

## Installation

```bash
yarn add @coordinator/cli
```

## Usage

### Running Workflows

Execute a workflow with the default configuration:

```bash
coordinator run hello
```

Execute a workflow with a specific agent:

```bash
coordinator run todo --agent anthropic
```

Execute a workflow with a custom config file:

```bash
coordinator run hello --config ./my-config.js
```

### Listing Available Components

List all available workflow specs:

```bash
coordinator list-specs
coordinator list-specs --verbose
```

List all available agents:

```bash
coordinator list-agents
coordinator list-agents --verbose
```

### Configuration

Initialize a configuration file:

```bash
coordinator init-config
coordinator init-config --format js
coordinator init-config --output ./config/coordinator.config.js
```

## Configuration File

The CLI supports configuration through `.coordinatorrc` (JSON) or `coordinator.config.js` (JavaScript).

### JSON Configuration (.coordinatorrc)

```json
{
  "defaultAgent": "mock",
  "defaultSpec": "hello",
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

### JavaScript Configuration (coordinator.config.js)

```javascript
export default {
  defaultAgent: 'mock',
  defaultSpec: 'hello',
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY || ''
  }
};
```

## Programmatic API

You can also use the CLI functionality programmatically:

```typescript
import { runWorkflow, loadConfig, ConsoleLogger } from '@coordinator/cli';
import { ConsoleLogger } from '@coordinator/coordinator';

const config = await loadConfig();
const logger = new ConsoleLogger();

const result = await runWorkflow({
  spec: 'hello',
  agent: 'mock',
  config,
  logger
});

if (result.success) {
  console.log('Workflow completed:', result.output);
} else {
  console.error('Workflow failed:', result.error);
}
```

## Available Commands

- `coordinator run <spec>` - Execute a workflow
- `coordinator list-specs` - List available specs
- `coordinator list-agents` - List available agents
- `coordinator init-config` - Initialize configuration file

## Options

### Global Options

- `--version` - Show version number
- `--help` - Show help

### Run Command Options

- `-a, --agent <agent>` - Specify agent to use
- `-c, --config <path>` - Path to config file

### List Commands Options

- `-v, --verbose` - Show detailed information

### Init Config Options

- `-f, --format <format>` - Config format (json or js)
- `-o, --output <path>` - Output path for config file

## Architecture

The CLI package integrates with the coordinator system through:

1. **Command Parser** - Parses CLI arguments and options
2. **Config Loader** - Loads configuration from files or environment
3. **Workflow Runner** - Executes workflows using the coordinator
4. **Progress Reporter** - Provides visual feedback during execution

## Dependencies

- `@coordinator/coordinator` - Core coordination system
- `@coordinator/contracts` - Type definitions
- `@coordinator/specs-*` - Workflow specifications
- `@coordinator/agent-*` - Agent implementations
- `commander` - CLI framework
- `chalk` - Terminal styling
- `ora` - Terminal spinners
- `cosmiconfig` - Configuration file loader
