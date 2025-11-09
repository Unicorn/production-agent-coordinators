# Configuration Reference

Complete reference for Agent Coordinator configuration options.

## Configuration Files

Supported formats:
- `.coordinatorrc` (JSON)
- `.coordinatorrc.json` (JSON)
- `coordinator.config.js` (JavaScript module)
- `package.json` (`coordinator` field)

## Complete Configuration Schema

```json
{
  "defaultAgent": "string",
  "defaultSpec": "string",
  "apiKeys": {
    "anthropic": "string",
    "openai": "string"
  },
  "agents": {
    "<agentName>": {
      "model": "string",
      "maxTokens": "number",
      "temperature": "number",
      "timeout": "number"
    }
  },
  "specs": {
    "<specName>": {
      "defaultAgent": "string",
      "config": {}
    }
  },
  "storage": {
    "type": "local | s3",
    "path": "string",
    "bucket": "string"
  },
  "logging": {
    "level": "debug | info | warn | error",
    "format": "text | json"
  }
}
```

## Top-Level Configuration

### defaultAgent

Default agent to use for workflows.

**Type:** `string`
**Default:** `"mock"`
**Options:** Any registered agent name

**Example:**
```json
{
  "defaultAgent": "anthropic"
}
```

### defaultSpec

Default workflow spec (not commonly used).

**Type:** `string`
**Optional**

### apiKeys

API keys for external services.

**Type:** `object`
**Keys:** Service name
**Values:** API key string or environment variable reference

**Examples:**
```json
{
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}",
    "openai": "${OPENAI_API_KEY}"
  }
}
```

**Environment variable syntax:**
```json
"${ENV_VAR_NAME}"
```

## Agent Configuration

Configure agent-specific settings.

### Anthropic Agent

```json
{
  "agents": {
    "anthropic": {
      "model": "claude-3-5-sonnet-20241022",
      "maxTokens": 4096,
      "temperature": 1.0,
      "timeout": 30000
    }
  }
}
```

**Options:**

- **model** (string) - Claude model to use
  - `claude-3-5-sonnet-20241022` - Recommended, balanced
  - `claude-3-opus-20240229` - Most capable
  - `claude-3-haiku-20240307` - Fastest, cheapest
  - Default: `claude-3-5-sonnet-20241022`

- **maxTokens** (number) - Maximum response tokens
  - Range: 1 - 4096
  - Default: 4096

- **temperature** (number) - Response randomness
  - Range: 0.0 - 1.0
  - `0.0` = Deterministic
  - `1.0` = Creative
  - Default: 1.0

- **timeout** (number) - Request timeout in milliseconds
  - Default: 30000 (30 seconds)

### Mock Agent

Mock agent typically requires no configuration.

```json
{
  "agents": {
    "mock": {}
  }
}
```

### Custom Agents

Configuration varies by agent implementation.

```json
{
  "agents": {
    "database": {
      "databaseUrl": "${DATABASE_URL}",
      "maxConnections": 10
    },
    "weather": {
      "apiKey": "${WEATHER_API_KEY}",
      "units": "metric"
    }
  }
}
```

## Spec Configuration

Configure workflow spec settings.

```json
{
  "specs": {
    "todo": {
      "defaultAgent": "anthropic",
      "maxTasks": 10,
      "timeout": 60000
    },
    "review": {
      "defaultAgent": "mock",
      "metricsToAnalyze": ["complexity", "security", "performance"]
    }
  }
}
```

**Common options:**

- **defaultAgent** (string) - Override default agent for this spec
- **timeout** (number) - Spec-specific timeout
- **config** (object) - Spec-specific configuration (varies by spec)

## Storage Configuration

### Local Storage

```json
{
  "storage": {
    "type": "local",
    "path": "./output"
  }
}
```

**Options:**
- **type** - `"local"`
- **path** - Directory path for file storage

### S3 Storage (Future)

```json
{
  "storage": {
    "type": "s3",
    "bucket": "my-bucket",
    "region": "us-east-1",
    "accessKeyId": "${AWS_ACCESS_KEY_ID}",
    "secretAccessKey": "${AWS_SECRET_ACCESS_KEY}"
  }
}
```

## Logging Configuration

```json
{
  "logging": {
    "level": "info",
    "format": "text"
  }
}
```

**Options:**

- **level** (string) - Minimum log level
  - `"debug"` - All logs
  - `"info"` - Info and above
  - `"warn"` - Warnings and errors only
  - `"error"` - Errors only
  - Default: `"info"`

- **format** (string) - Log output format
  - `"text"` - Human-readable
  - `"json"` - Structured JSON
  - Default: `"text"`

## Environment-Specific Configuration

### Development

```json
{
  "defaultAgent": "mock",
  "logging": {
    "level": "debug"
  },
  "storage": {
    "type": "local",
    "path": "./output/dev"
  }
}
```

### Production

```json
{
  "defaultAgent": "anthropic",
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY_PROD}"
  },
  "agents": {
    "anthropic": {
      "model": "claude-3-5-sonnet-20241022",
      "maxTokens": 4096,
      "temperature": 0.7
    }
  },
  "logging": {
    "level": "warn",
    "format": "json"
  },
  "storage": {
    "type": "s3",
    "bucket": "prod-coordinator-storage"
  }
}
```

## JavaScript Configuration

Dynamic configuration with JavaScript:

```javascript
// coordinator.config.js
export default {
  defaultAgent: process.env.NODE_ENV === 'production' ? 'anthropic' : 'mock',

  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY,
  },

  agents: {
    anthropic: {
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: parseInt(process.env.MAX_TOKENS || '4096', 10),
      temperature: parseFloat(process.env.TEMPERATURE || '1.0'),
    },
  },

  specs: {
    todo: {
      maxTasks: parseInt(process.env.MAX_TASKS || '10', 10),
    },
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'text',
  },
};
```

## Configuration Validation

The CLI validates configuration on load:

**Valid configuration:**
```bash
coordinator run hello
# No errors, runs workflow
```

**Invalid configuration:**
```bash
coordinator run hello
# Error: Invalid configuration: agents.anthropic.temperature must be between 0 and 1
```

## Configuration Priority

When multiple configs exist:

1. Command-line options (`--agent`, `--config`)
2. Specified config file (`--config path`)
3. `.coordinatorrc` (current directory)
4. `.coordinatorrc.json`
5. `coordinator.config.js`
6. `package.json` `coordinator` field
7. Default values

**Example:**
```bash
# Uses anthropic (from CLI), overrides config file
coordinator run hello --agent anthropic
```

## Best Practices

### 1. Use Environment Variables for Secrets

```json
{
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

Never:
```json
{
  "apiKeys": {
    "anthropic": "sk-ant-actual-key-here"
  }
}
```

### 2. Environment-Specific Configs

```
.coordinatorrc.dev
.coordinatorrc.staging
.coordinatorrc.prod
```

```bash
coordinator run hello --config .coordinatorrc.prod
```

### 3. Version Control

```gitignore
# .gitignore
.coordinatorrc
.coordinatorrc.json
coordinator.config.js
*.key
.env
```

Commit templates:
```
.coordinatorrc.example
```

### 4. Document Custom Config

```json
{
  "specs": {
    "mySpec": {
      "// customOption": "Description of what this does",
      "customOption": "value"
    }
  }
}
```

## Related Documentation

- [CLI Commands Reference](cli-commands.md)
- [Agent Configuration Guide](../how-to/configure-agents.md)
- [Workflow Specs Reference](workflow-specs.md)
