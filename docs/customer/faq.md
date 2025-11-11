# Frequently Asked Questions

Common questions about Agent Coordinator.

## General Questions

### What is Agent Coordinator?

Agent Coordinator is a TypeScript-based platform for orchestrating AI agents to complete complex tasks. It provides:
- **Deterministic workflows** for reliable execution
- **Pluggable specifications** to define custom workflow logic
- **Multiple agent types** (Claude, mock agents, custom agents)
- **Type-safe architecture** built with TypeScript in strict mode

### Who should use Agent Coordinator?

Agent Coordinator is ideal for:
- **Developers** building multi-agent AI systems
- **Teams** needing predictable, testable AI workflows
- **Projects** requiring custom workflow orchestration
- **Anyone** wanting to integrate Claude or other LLMs into workflows

### How is this different from other agent frameworks?

Agent Coordinator focuses on:
- **Determinism** - Same inputs always produce same outputs
- **Separation of concerns** - Workflow logic separate from execution
- **Type safety** - Strict TypeScript throughout
- **Testability** - Easy to test with mock agents
- **Flexibility** - Pluggable specs and agents

## Getting Started

### What do I need to get started?

**Required:**
- Node.js 18 or higher
- Yarn 1.22 or higher
- Docker Desktop (for infrastructure)

**Optional:**
- Anthropic API key (for Claude agents)
- Git (for cloning repository)

### How do I install it?

```bash
git clone https://github.com/bernierllc/agent-coordinator.git
cd agent-coordinator
yarn install
yarn build
yarn infra:up
```

See [Getting Started](getting-started.md) for details.

### Can I use it without Docker?

Yes, but some features may be limited:
- Mock agents work without Docker
- Local file storage works without Docker
- Future features (Temporal, database) require Docker

### Do I need an Anthropic API key?

Not required to start! Use mock agents for:
- Learning the system
- Development and testing
- CI/CD pipelines

Add Anthropic API key when you need:
- Real AI-powered workflows
- Natural language understanding
- Creative content generation

## Workflows and Specs

### What's the difference between a spec and a workflow?

- **Spec** (Specification) - The workflow logic/code that defines decision-making
- **Workflow** - A running instance of a spec with specific input and state

Think of it like:
- **Spec** = Class definition
- **Workflow** = Instance of that class

### How do I create a custom workflow?

Follow the [Create Custom Workflow](how-to/create-custom-workflow.md) guide:

1. Create spec package
2. Implement `ISpec` interface
3. Create factory
4. Register with CLI
5. Test and run

### Can workflows call other workflows?

Not directly in the current version. However, you can:
- Break complex workflows into stages within one spec
- Use different work kinds to delegate to different agents
- Build hierarchical specs (coming in future versions)

### How do I handle errors in workflows?

Implement `onAgentError` in your spec:

```typescript
onAgentError(state, workKind, error, attemptNumber): EngineDecision {
  if (attemptNumber < 3) {
    // Retry logic
    return { actions: [{ type: 'REQUEST_WORK', ... }], finalize: false };
  }
  // Fail gracefully
  return { actions: [], finalize: true };
}
```

### Can workflows run in parallel?

Yes! Request multiple work items in one decision:

```typescript
return {
  actions: [
    { type: 'REQUEST_WORK', workKind: 'task1', payload: {} },
    { type: 'REQUEST_WORK', workKind: 'task2', payload: {} },
    { type: 'REQUEST_WORK', workKind: 'task3', payload: {} }
  ],
  finalize: false
};
```

The engine executes them concurrently.

## Agents

### What agents are available?

**Built-in:**
- **MockAgent** - Deterministic responses for testing
- **AnthropicAgent** - Claude-powered AI agent

**Custom:** You can build your own for:
- Database queries
- API calls
- File operations
- Any custom logic

### How do I switch between agents?

Use the `--agent` flag:

```bash
# Use mock agent
coordinator run hello --agent mock

# Use Claude
coordinator run hello --agent anthropic
```

Or set in configuration:

```json
{
  "defaultAgent": "anthropic"
}
```

### Can I use multiple agents in one workflow?

Yes! Register multiple agents:

```typescript
coordinator.registerAgent('mock', new MockAgentFactory());
coordinator.registerAgent('anthropic', new AnthropicAgentFactory());
coordinator.registerAgent('database', new DatabaseAgentFactory());
```

Route work by kind - agents declare which kinds they support.

### How do I create a custom agent?

Implement the `IAgent` interface:

```typescript
export class MyAgent implements IAgent {
  async execute(
    workKind: string,
    payload: unknown,
    context: AgentExecutionContext
  ): Promise<AgentResult> {
    // Your agent logic
    return { status: 'OK', content: {...} };
  }
}
```

See [Configure Agents](how-to/configure-agents.md) for details.

### How much does it cost to use Claude?

Pricing depends on the model:
- **Haiku** - Fastest, cheapest (~$0.25-0.00125 per 1K tokens)
- **Sonnet** - Balanced (~$3-0.015 per 1K tokens)
- **Opus** - Most capable (~$15-0.075 per 1K tokens)

Use mock agents during development to avoid costs.

## Configuration

### Where do I put my API keys?

**Best practice:**

1. Set environment variable:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

2. Reference in config:
```json
{
  "apiKeys": {
    "anthropic": "${ANTHROPIC_API_KEY}"
  }
}
```

**Never commit API keys to version control!**

### Can I have different configs for dev/prod?

Yes! Create multiple config files:

```
.coordinatorrc.dev
.coordinatorrc.staging
.coordinatorrc.prod
```

Use with:

```bash
coordinator run hello --config .coordinatorrc.prod
```

### What's the difference between .coordinatorrc and coordinator.config.js?

- **.coordinatorrc** - JSON, static values
- **coordinator.config.js** - JavaScript, dynamic values

Use JavaScript config for:
- Environment-based logic
- Computed values
- Complex configurations

## Development

### How do I run tests?

```bash
# All unit tests (no watch)
yarn test

# E2E tests
yarn test:e2e

# Watch mode (for development)
yarn test:watch

# Specific package
yarn workspace @coordinator/engine test
```

### Why do tests keep running?

Per project guidelines, always run tests **without** `--watch` so they stop automatically:

```bash
yarn test       # Correct - stops on completion
yarn test:watch # Only for active development
```

### How do I debug a workflow?

Enable debug logging:

```bash
DEBUG=coordinator:* coordinator run <spec>
```

Specific components:

```bash
DEBUG=coordinator:engine,coordinator:spec coordinator run <spec>
```

### Can I use this in CI/CD?

Yes! Use mock agents for fast, reliable tests:

```yaml
# GitHub Actions example
- name: Test workflows
  run: |
    coordinator run hello --agent mock
    coordinator run todo --agent mock
```

### What's the project structure?

```
agent-coordinator/
├── packages/
│   ├── contracts/      # Interfaces only
│   ├── engine/        # Workflow execution
│   ├── coordinator/   # DI and orchestration
│   ├── specs/         # Workflow specifications
│   ├── agents/        # Agent implementations
│   ├── storage/       # Storage implementations
│   └── cli/           # Command-line interface
├── docker/            # Infrastructure
└── tests/e2e/         # End-to-end tests
```

## Architecture

### Why is everything so type-safe?

Type safety provides:
- **Compile-time error detection**
- **Better IDE support**
- **Self-documenting code**
- **Reduced runtime errors**

### What's deterministic execution?

Determinism means:
- Same inputs → Same outputs (always)
- No side effects in state transitions
- Controlled timestamps and random values
- Reproducible for testing and debugging

### Why can't specs import from engine?

To prevent circular dependencies:
- **contracts** has zero dependencies
- **specs** depend on contracts only
- **engine** depends on contracts only
- **coordinator** brings them together

This enables dynamic loading and clean separation.

### How does the engine work?

High-level flow:

```
1. Spec generates decision (request work)
2. Engine applies actions to state
3. Engine detects waiting steps
4. Engine invokes agent executor
5. Agent executes work
6. Engine processes agent response
7. Spec generates next decision
8. Repeat until finalized
```

See [Architecture](../ARCHITECTURE.md) for details.

## Troubleshooting

### My workflow hangs, what do I check?

1. Enable debug logs
2. Check if workflow finalizes (`finalize: true`)
3. Verify state is progressing
4. Look for infinite loops

See [Troubleshooting](troubleshooting.md) for details.

### "No such spec" error?

1. List available specs: `coordinator list-specs`
2. Build spec package: `yarn workspace @coordinator/specs-<name> build`
3. Check CLI registration

### Agent timeout errors?

1. Increase timeout in config
2. Check network connectivity
3. Reduce payload size
4. Use faster model (Haiku)

### Build errors?

```bash
yarn clean
rm -rf node_modules
yarn install
yarn build
```

## Contributing

### Can I contribute?

Yes! See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Development workflow
- Code style guidelines
- Testing requirements
- Pull request process

### What kind of contributions are welcome?

- Bug fixes
- New specs and agents
- Documentation improvements
- Performance optimizations
- Test coverage
- Feature requests

### How do I report a bug?

Create a GitHub issue with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Debug logs
- Environment details

## Future Roadmap

### What features are planned?

**Near term:**
- Database-backed state persistence
- Queue-based coordinator dispatch
- Advanced agent patterns (map-reduce, critic-executor)
- Web UI for workflow management

**Long term:**
- Streaming support
- Multi-agent communication protocols
- Rate limiting and cost tracking
- More storage backends (S3, GCS)

See README roadmap for details.

### Can I request features?

Yes! Create a GitHub issue with:
- Use case description
- Why it's needed
- Proposed solution (optional)

### Will there be more agents?

Planned:
- OpenAI/GPT agents
- Tool-calling agents
- Database query agents
- File operation agents

Community contributions welcome!

## Related Documentation

- [Getting Started](getting-started.md)
- [Troubleshooting](troubleshooting.md)
- [How-To Guides](how-to/)
- [Use Cases](use-cases/)
- [Reference](reference/)
