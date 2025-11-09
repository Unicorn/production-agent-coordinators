# Troubleshooting Guide

Common issues and solutions for Agent Coordinator.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [Workflow Execution Errors](#workflow-execution-errors)
- [Agent Issues](#agent-issues)
- [Infrastructure Problems](#infrastructure-problems)
- [Performance Issues](#performance-issues)

## Installation Issues

### Build Failures

**Problem:** `yarn build` fails with errors

**Solutions:**

1. Clean and rebuild:
```bash
yarn clean
rm -rf node_modules
yarn install
yarn build
```

2. Check Node.js version:
```bash
node --version  # Should be >= 18.0.0
```

3. Check for dependency conflicts:
```bash
yarn why <package-name>
```

### TypeScript Errors

**Problem:** Type checking fails

**Solutions:**

1. Ensure correct TypeScript version:
```bash
yarn why typescript  # Should be >= 5.6.3
```

2. Run type checking:
```bash
yarn typecheck
```

3. Check for circular dependencies in imports

## Configuration Problems

### Config File Not Found

**Problem:** `Configuration file not found`

**Solutions:**

1. Create config file:
```bash
coordinator init-config
```

2. Specify config explicitly:
```bash
coordinator run hello --config /full/path/to/.coordinatorrc
```

3. Check file permissions:
```bash
ls -la .coordinatorrc
chmod 644 .coordinatorrc
```

### Invalid Configuration

**Problem:** `Invalid configuration: ...`

**Solutions:**

1. Validate JSON syntax:
```bash
cat .coordinatorrc | jq .
```

2. Check for required fields:
```json
{
  "defaultAgent": "mock",
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

3. Use init-config to generate valid config:
```bash
coordinator init-config --format json
```

### Environment Variables Not Expanding

**Problem:** `${ENV_VAR}` appears literally in config

**Solutions:**

1. Verify environment variable is set:
```bash
echo $ANTHROPIC_API_KEY
```

2. Export variable before running:
```bash
export ANTHROPIC_API_KEY="your-key"
coordinator run hello
```

3. Use JavaScript config for dynamic values:
```javascript
// coordinator.config.js
export default {
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY
  }
};
```

## Workflow Execution Errors

### "No such spec: <name>"

**Problem:** Spec not found

**Solutions:**

1. List available specs:
```bash
coordinator list-specs
```

2. Build spec package:
```bash
yarn workspace @coordinator/specs-<name> build
```

3. Check spec registration in CLI:
```typescript
// packages/cli/src/workflow-runner.ts
coordinator.registerSpec(new YourSpecFactory());
```

### Workflow Hangs or Never Completes

**Problem:** Workflow stuck in `RUNNING` state

**Solutions:**

1. Enable debug logging:
```bash
DEBUG=coordinator:* coordinator run <spec>
```

2. Check if workflow ever finalizes:
```typescript
// In spec
return {
  actions: [],
  finalize: true  // Must be true to complete!
};
```

3. Check for infinite loops:
- Ensure state progresses
- Verify artifact keys are set correctly

### "Workflow failed to complete"

**Problem:** Workflow ends with error

**Solutions:**

1. Check debug logs:
```bash
DEBUG=coordinator:* coordinator run <spec> 2>&1 | tee error.log
```

2. Review agent responses:
- Check if agents are returning errors
- Verify response formats match expectations

3. Check error handling:
```typescript
onAgentError(state, workKind, error, attemptNumber) {
  // Ensure this returns a valid decision
}
```

## Agent Issues

### "Agent not available: <name>"

**Problem:** Agent not found

**Solutions:**

1. List available agents:
```bash
coordinator list-agents
```

2. Build agent package:
```bash
yarn workspace @coordinator/agents-<name> build
```

3. Register agent in CLI:
```typescript
coordinator.registerAgent('name', new YourAgentFactory());
```

### Invalid API Key Errors

**Problem:** `Invalid API key` or authentication errors

**Solutions:**

1. Verify API key is set:
```bash
echo $ANTHROPIC_API_KEY
```

2. Test API key directly:
```bash
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'
```

3. Check config file:
```json
{
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"  // Correct
  }
}
```

### Rate Limit Errors

**Problem:** `Rate limit exceeded` errors

**Solutions:**

1. Implement exponential backoff in spec:
```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (error.type === 'RATE_LIMIT') {
    const backoffMs = Math.pow(2, attemptNumber) * 1000;
    return {
      actions: [{
        type: 'REQUEST_WORK',
        workKind,
        payload: { ...originalPayload, retryAfter: backoffMs }
      }],
      finalize: false
    };
  }
}
```

2. Use mock agents during development:
```bash
coordinator run <spec> --agent mock
```

3. Reduce concurrent requests

### Agent Timeout Errors

**Problem:** `Agent timeout` or requests taking too long

**Solutions:**

1. Increase timeout in config:
```json
{
  "agents": {
    "anthropic": {
      "timeout": 60000  // 60 seconds
    }
  }
}
```

2. Check network connectivity:
```bash
ping api.anthropic.com
```

3. Reduce payload size if sending large data

## Infrastructure Problems

### Docker Services Won't Start

**Problem:** `yarn infra:up` fails

**Solutions:**

1. Check Docker is running:
```bash
docker ps
```

2. View service logs:
```bash
yarn infra:logs
```

3. Stop and restart services:
```bash
yarn infra:down
docker system prune  # Warning: removes all stopped containers
yarn infra:up
```

### Port Conflicts

**Problem:** `Port already in use` errors

**Solutions:**

1. Find what's using the port:
```bash
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :7233  # Temporal
```

2. Stop conflicting service:
```bash
# Example for PostgreSQL
brew services stop postgresql
```

3. Change ports in `docker/.env`:
```bash
POSTGRES_PORT=5433
REDIS_PORT=6380
```

### Cannot Connect to Database

**Problem:** PostgreSQL connection errors

**Solutions:**

1. Verify service is running:
```bash
docker compose -f docker/docker-compose.yml ps
```

2. Check connection:
```bash
docker exec -it coordinator-postgres psql -U coordinator -d coordinator
```

3. Restart service:
```bash
docker compose -f docker/docker-compose.yml restart postgres
```

## Performance Issues

### Slow Workflow Execution

**Problem:** Workflows take too long

**Solutions:**

1. Use mock agents for development:
```bash
coordinator run <spec> --agent mock
```

2. Profile with debug logging:
```bash
DEBUG=coordinator:* coordinator run <spec>
```

3. Implement parallel execution:
```typescript
return {
  actions: [
    { type: 'REQUEST_WORK', workKind: 'task1', payload: {} },
    { type: 'REQUEST_WORK', workKind: 'task2', payload: {} }
  ],
  finalize: false
};
```

### High Memory Usage

**Problem:** Process using too much memory

**Solutions:**

1. Monitor memory:
```bash
node --max-old-space-size=4096 dist/cli.js run <spec>
```

2. Stream large files instead of loading entirely:
```typescript
// Use storage streams
const stream = await this.context.storage.createReadStream(key);
```

3. Clear large artifacts when no longer needed

### Slow Test Runs

**Problem:** Tests take too long

**Solutions:**

1. Run tests without watch mode:
```bash
yarn test  # Stops after completion
```

2. Run specific test files:
```bash
yarn test path/to/test.test.ts
```

3. Use mock agents in tests:
```typescript
const agent = new MockAgent(context);
```

## Debug Checklist

When troubleshooting, follow this checklist:

1. Enable debug logging:
```bash
DEBUG=coordinator:* coordinator run <spec>
```

2. Check configuration:
```bash
coordinator list-specs
coordinator list-agents
cat .coordinatorrc
```

3. Verify environment:
```bash
node --version
yarn --version
echo $ANTHROPIC_API_KEY
```

4. Check infrastructure:
```bash
docker compose -f docker/docker-compose.yml ps
```

5. Review logs:
```bash
yarn infra:logs
```

6. Test with minimal example:
```bash
coordinator run hello --agent mock
```

## Getting Help

If you're still stuck:

1. **Check existing issues:** [GitHub Issues](https://github.com/bernierllc/agent-coordinator/issues)

2. **Review documentation:**
   - [Getting Started](getting-started.md)
   - [FAQ](faq.md)
   - [Reference Documentation](reference/)

3. **Gather information:**
   - Debug logs
   - Configuration files
   - Error messages
   - Steps to reproduce

4. **Create detailed issue:**
   - Include Node/Yarn versions
   - Provide minimal reproduction
   - Share relevant logs
   - Describe expected vs actual behavior

## Related Documentation

- [FAQ](faq.md)
- [CLI Commands Reference](reference/cli-commands.md)
- [Configuration Reference](reference/configuration.md)
- [Agent Configuration Guide](how-to/configure-agents.md)
