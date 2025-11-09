# CLI Commands Reference

Complete reference for all Agent Coordinator CLI commands and options.

## Command Structure

```bash
coordinator <command> [options]
```

## Global Options

```bash
-V, --version    Output the version number
-h, --help       Display help for command
```

## Commands

### run

Run a workflow with the specified spec.

**Syntax:**
```bash
coordinator run <spec> [options]
```

**Arguments:**
- `<spec>` - Name of the workflow specification to run (required)

**Options:**
- `-a, --agent <agent>` - Agent to use for execution
- `-c, --config <path>` - Path to configuration file

**Examples:**
```bash
# Run with default agent
coordinator run hello

# Specify agent
coordinator run hello --agent anthropic

# Use custom config
coordinator run hello --config ./configs/production.json

# Combined options
coordinator run todo --agent anthropic --config .coordinatorrc
```

**Exit Codes:**
- `0` - Workflow completed successfully
- `1` - Workflow failed or configuration error

**Output:**
```json
{
  "artifactKey": "value",
  ...
}
```

---

### list-specs

List all available workflow specifications.

**Syntax:**
```bash
coordinator list-specs [options]
```

**Options:**
- `-v, --verbose` - Show detailed information

**Examples:**
```bash
# Simple list
coordinator list-specs

# Detailed information
coordinator list-specs --verbose
```

**Output (simple):**
```
Available Workflow Specs:

  - hello
  - todo
  - review

Total: 3 specs
```

**Output (verbose):**
```
Available Workflow Specs:

  hello
    Simple hello world workflow - requests greeting and completes
    Required work kinds: greet
    Version: 1.0.0

  todo
    Multi-step todo workflow: gather requirements, create tasks, confirm completion
    Required work kinds: gather_requirements, create_tasks, confirm_completion
    Version: 0.1.0

Total: 2 specs
```

---

### list-agents

List all available agents.

**Syntax:**
```bash
coordinator list-agents [options]
```

**Options:**
- `-v, --verbose` - Show detailed information

**Examples:**
```bash
# Simple list
coordinator list-agents

# Detailed information
coordinator list-agents --verbose
```

**Output (simple):**
```
Available Agents:

  - mock
  - anthropic

Total: 2 agents
```

**Output (verbose):**
```
Available Agents:

  mock
    Mock agent for testing and development
    Supports: all work kinds
    Version: 1.0.0

  anthropic
    Claude-powered AI agent using Anthropic API
    Supports: all work kinds
    Version: 1.0.0

Total: 2 agents
```

---

### init-config

Initialize a configuration file.

**Syntax:**
```bash
coordinator init-config [options]
```

**Options:**
- `-f, --format <format>` - Config format: `json` or `js` (default: `json`)
- `-o, --output <path>` - Output path for config file

**Examples:**
```bash
# Create JSON config in current directory
coordinator init-config

# Create JavaScript config
coordinator init-config --format js

# Custom output path
coordinator init-config --output ./configs/dev.json

# JavaScript config with custom path
coordinator init-config --format js --output coordinator.config.js
```

**Generated Files:**

**JSON format (.coordinatorrc):**
```json
{
  "defaultAgent": "mock",
  "defaultSpec": "hello",
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

**JavaScript format (coordinator.config.js):**
```javascript
export default {
  defaultAgent: 'mock',
  defaultSpec: 'hello',
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY || ''
  }
};
```

## Environment Variables

### API Keys

```bash
ANTHROPIC_API_KEY    Anthropic Claude API key
OPENAI_API_KEY       OpenAI API key (if using OpenAI agent)
```

### Configuration

```bash
DEBUG                Enable debug logging (e.g., DEBUG=coordinator:*)
NODE_ENV             Environment (development, production)
LOG_LEVEL            Logging level (debug, info, warn, error)
```

### Storage

```bash
STORAGE_PATH         Path for local file storage
STORAGE_TYPE         Storage backend type (local, s3)
```

## Debug Logging

Enable detailed logging with the `DEBUG` environment variable.

**Syntax:**
```bash
DEBUG=<pattern> coordinator <command>
```

**Patterns:**
```bash
# All coordinator logs
DEBUG=coordinator:*

# Specific component
DEBUG=coordinator:engine
DEBUG=coordinator:spec
DEBUG=coordinator:agent

# Multiple components
DEBUG=coordinator:engine,coordinator:spec

# Exclude components
DEBUG=coordinator:*,-coordinator:agent

# All debug output
DEBUG=*
```

**Examples:**
```bash
# Debug engine only
DEBUG=coordinator:engine coordinator run hello

# Debug everything except agents
DEBUG=coordinator:*,-coordinator:agent coordinator run todo

# All logs to file
DEBUG=coordinator:* coordinator run hello 2>&1 | tee workflow.log
```

## Configuration File Search

The CLI searches for configuration in this order:

1. Path specified with `--config` option
2. `.coordinatorrc` (current directory)
3. `.coordinatorrc.json`
4. `coordinator.config.js`
5. `package.json` (`coordinator` field)
6. Default configuration

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Workflow failure |
| `1` | Configuration error |
| `1` | Spec not found |
| `1` | Agent not available |

## Error Messages

### "No such spec: <name>"

**Cause:** Specified spec doesn't exist

**Solution:**
```bash
# List available specs
coordinator list-specs

# Ensure spec package is built
yarn workspace @coordinator/specs-<name> build
```

### "Agent not available: <name>"

**Cause:** Specified agent isn't registered

**Solution:**
```bash
# List available agents
coordinator list-agents

# Check agent registration in CLI
```

### "Configuration file not found"

**Cause:** Config file doesn't exist at specified path

**Solution:**
```bash
# Create config
coordinator init-config

# Or specify correct path
coordinator run hello --config /full/path/to/config.json
```

### "Invalid API key"

**Cause:** API key is missing or invalid

**Solution:**
```bash
# Set API key
export ANTHROPIC_API_KEY="your-key"

# Verify
echo $ANTHROPIC_API_KEY

# Or add to config file
```

## Scripting

### Bash

```bash
#!/bin/bash
set -e

# Run workflow and capture output
OUTPUT=$(coordinator run hello 2>/dev/null)

# Parse JSON output
RESULT=$(echo "$OUTPUT" | jq -r '.greeting.message')

# Use result
echo "Result: $RESULT"
```

### Make

```makefile
.PHONY: run-hello run-todo

run-hello:
\tcoordinator run hello --agent mock

run-todo:
\tcoordinator run todo --agent anthropic

all: run-hello run-todo
```

### NPM Scripts

```json
{
  "scripts": {
    "workflow:hello": "coordinator run hello",
    "workflow:todo": "coordinator run todo --agent anthropic",
    "workflow:all": "npm run workflow:hello && npm run workflow:todo"
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run workflows
  run: |
    cd packages/cli
    node dist/cli.js run hello --agent mock
    node dist/cli.js run todo --agent mock
```

### GitLab CI

```yaml
test-workflows:
  script:
    - cd packages/cli
    - node dist/cli.js run hello --agent mock
    - node dist/cli.js run todo --agent mock
```

## Related Documentation

- [CLI Usage Guide](../how-to/use-cli.md)
- [Configuration Reference](configuration.md)
- [Troubleshooting](../troubleshooting.md)
