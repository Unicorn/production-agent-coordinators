# CLI Quick Reference

Quick reference card for Agent Coordinator CLI commands.

## Essential Commands

```bash
# Run a workflow
coordinator run <spec> [--agent <agent>] [--config <path>]

# List available specs
coordinator list-specs [-v]

# List available agents
coordinator list-agents [-v]

# Create configuration file
coordinator init-config [--format json|js] [--output <path>]
```

## Common Workflows

```bash
# Run Hello workflow with mock agent
coordinator run hello

# Run Todo workflow with Claude
coordinator run todo --agent anthropic

# Run with custom config
coordinator run hello --config .coordinatorrc.prod

# Debug mode
DEBUG=coordinator:* coordinator run hello
```

## Configuration

**File locations (searched in order):**
1. `--config` path
2. `.coordinatorrc`
3. `.coordinatorrc.json`
4. `coordinator.config.js`
5. `package.json` (coordinator field)

**Basic config:**
```json
{
  "defaultAgent": "anthropic",
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

## Environment Variables

```bash
# API Keys
export ANTHROPIC_API_KEY="sk-ant-..."

# Debug logging
export DEBUG="coordinator:*"

# Environment
export NODE_ENV="production"
```

## Exit Codes

- `0` - Success
- `1` - Failure

## Quick Debugging

```bash
# View all logs
DEBUG=coordinator:* coordinator run hello 2>&1 | tee debug.log

# Check configuration
coordinator list-agents
coordinator list-specs

# Validate setup
coordinator run hello --agent mock
```

## Related Documentation

- [Full CLI Reference](cli-commands.md)
- [Configuration Reference](configuration.md)
- [CLI Usage Guide](../how-to/use-cli.md)
