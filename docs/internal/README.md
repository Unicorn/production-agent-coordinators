# Internal Documentation

**Purpose:** Comprehensive documentation for agent-coordinator maintainers and developers.

**Audience:** Core team members, contributors, and developers working on the codebase.

**Last Updated:** 2025-11-09

## Quick Navigation

### For New Team Members

1. Start with [Architecture Overview](./architecture/overview.md)
2. Review [Design Principles](./design/principles.md)
3. Set up your environment: [Development Setup](./development/setup.md)
4. Follow the [Development Workflow](./development/workflow.md)

### For Contributors

1. Read [Contributing Guide](./contributing.md)
2. Review [Code Style Guidelines](./development/workflow.md#code-style)
3. Understand [Testing Strategy](./development/testing.md)
4. Learn about [Adding Packages](./development/adding-packages.md)

### For Architects

1. Study [Architecture Overview](./architecture/overview.md)
2. Review [Design Decisions](./design/decisions.md)
3. Understand [Design Patterns](./design/patterns.md)
4. Read package-specific architecture docs

## Documentation Structure

```
docs/internal/
├── README.md                    # This file
├── contributing.md              # Contribution guidelines
│
├── architecture/                # System architecture
│   ├── overview.md              # High-level system design
│   ├── engine.md                # Engine package deep-dive
│   ├── coordinator.md           # DI container and orchestration
│   ├── storage.md               # Storage abstraction and security
│   ├── specs.md                 # Specification interface
│   └── agents.md                # Agent interface
│
├── development/                 # Development guides
│   ├── setup.md                 # Environment setup
│   ├── workflow.md              # Development workflow
│   ├── testing.md               # Testing strategy
│   ├── debugging.md             # Debugging techniques
│   └── adding-packages.md       # How to add new packages
│
├── design/                      # Design documentation
│   ├── principles.md            # Core design principles
│   ├── patterns.md              # Design patterns used
│   └── decisions.md             # Architectural decision records
│
├── operations/                  # Operations and deployment
│   ├── deployment.md            # Deployment guide
│   ├── docker.md                # Docker infrastructure
│   └── monitoring.md            # Observability and monitoring
│
└── api/                         # API reference
    ├── contracts.md             # Core types and interfaces
    ├── engine-api.md            # Engine public API
    └── coordinator-api.md       # Coordinator public API
```

## Architecture Documentation

### [Architecture Overview](./architecture/overview.md)
High-level system architecture, design principles, package dependencies, and data flow.

**KEY TOPICS:**
- System context and characteristics
- Core design principles (determinism, DI, separation of concerns, type safety)
- Package architecture and dependency graph
- Workflow execution sequence
- Extension points

### [Engine Architecture](./architecture/engine.md)
Deep dive into the deterministic workflow execution engine.

**KEY TOPICS:**
- Determinism implementation
- State machine and execution loop
- Pure state transition functions
- Error handling and safety limits
- Immutability patterns

### [Coordinator Architecture](./architecture/coordinator.md)
Dependency injection container and high-level orchestration.

**KEY TOPICS:**
- Container (service locator) implementation
- Factory pattern and registration
- Context object creation
- Configuration management
- Logger implementation

### [Storage Architecture](./storage.md)
Storage abstraction with security controls.

**KEY TOPICS:**
- IStorage interface
- LocalFileStorage implementation
- Security architecture (path validation, forbidden segments)
- Attack defense layers
- Future storage implementations (S3, GCS, database)

### [Spec Architecture](./specs.md)
Specification interface for workflow decision logic.

**KEY TOPICS:**
- ISpec and ISpecFactory interfaces
- Decision generation patterns (linear, conditional, parallel, map-reduce)
- Action types (REQUEST_WORK, REQUEST_APPROVAL, ANNOTATE)
- Example implementations (HelloSpec, TodoSpec)
- Testing strategies

### [Agent Architecture](./agents.md)
Agent interface for work execution.

**KEY TOPICS:**
- IAgent and IAgentFactory interfaces
- AgentResult structure and status values
- Error handling and taxonomy
- Implementation patterns (LLM call, function calling, streaming, multi-step)
- Mock validation requirements

## Development Documentation

### [Development Setup](./development/setup.md)
Step-by-step guide to setting up development environment.

**COVERS:**
- Prerequisites (Node.js, Yarn, Docker)
- Repository cloning and dependency installation
- Infrastructure setup (PostgreSQL, Redis, Temporal)
- Editor configuration (VSCode)
- Verification steps

### [Development Workflow](./development/workflow.md)
Day-to-day development practices and code style guidelines.

**COVERS:**
- Feature branch workflow
- Code style guidelines (TypeScript, naming, imports)
- Pure functions and immutability
- Error handling patterns
- Linting and type checking

### [Testing Strategy](./development/testing.md)
Comprehensive testing approach and requirements.

**COVERS:**
- Unit testing (pure functions, isolated classes)
- Integration testing (component interactions)
- E2E testing (complete workflows)
- Mock validation (CRITICAL requirement)
- Test commands and watch mode

### [Debugging Techniques](./development/debugging.md)
Tools and techniques for debugging the system.

**COVERS:**
- Debug logging configuration
- Node.js inspector usage
- Infrastructure log inspection
- Common issues and solutions
- State inspection techniques

### [Adding Packages](./development/adding-packages.md)
How to add new packages to the monorepo.

**COVERS:**
- Package directory structure
- package.json configuration
- tsconfig.json setup
- Dependency rules enforcement
- Adding to workspace and build
- Example: Creating new spec package
- Example: Creating new agent package

## Design Documentation

### [Design Principles](./design/principles.md)
Core design philosophy and architectural principles.

**COVERS:**
- Deterministic execution (WHY and HOW)
- Dependency injection (benefits and implementation)
- Separation of concerns (boundaries and rules)
- Type safety (strict mode, no implicit any)
- Security first (storage, API keys)
- Testability (pure functions, mocks)

### [Design Patterns](./design/patterns.md)
Catalog of design patterns used throughout the system.

**COVERS:**
- Factory Pattern (component creation)
- Service Locator Pattern (Container)
- Strategy Pattern (pluggable specs)
- Template Method Pattern (Engine.runWorkflow)
- Immutable Data Pattern (state updates)
- Repository Pattern (future: state persistence)

### [Architectural Decision Records](./design/decisions.md)
Log of significant architectural decisions and their rationale.

**FORMAT:**
- Decision title
- Context and problem statement
- Considered alternatives
- Decision and rationale
- Consequences (positive and negative)
- Status (proposed, accepted, deprecated, superseded)

**EXAMPLE DECISIONS:**
- ADR-001: Why Pure Functions for State Transitions
- ADR-002: Why Specs Cannot Depend on Engine
- ADR-003: Why Path Validation in Storage Layer
- ADR-004: Why Factory Pattern for Component Creation

## Operations Documentation

### [Deployment Guide](./operations/deployment.md)
Production deployment procedures and considerations.

**COVERS:**
- Environment configuration
- Infrastructure requirements
- Storage backend setup (S3, GCS)
- Database setup (PostgreSQL)
- Temporal cluster setup
- Monitoring and alerting
- Backup and disaster recovery

### [Docker Infrastructure](./operations/docker.md)
Local development infrastructure setup.

**COVERS:**
- Docker Compose configuration
- PostgreSQL setup and connection
- Redis setup and usage
- Temporal server and UI
- Service health checks
- Data persistence and volumes
- Network configuration

### [Monitoring and Observability](./operations/monitoring.md)
System observability and monitoring strategy.

**COVERS:**
- Logging strategy (structured logs, log levels)
- Metrics collection (Prometheus, custom metrics)
- Distributed tracing (OpenTelemetry integration)
- Alerting rules and thresholds
- Dashboard setup (Grafana)
- Performance profiling

## API Documentation

### [Contracts API](./api/contracts.md)
Core types and interfaces reference.

**COVERS:**
- EngineState, StepState, EngineDecision
- ISpec, ISpecFactory, SpecContext
- IAgent, IAgentFactory, AgentContext
- AgentResult, AgentResponse
- IStorage, ILogger
- Type definitions and usage examples

### [Engine API](./api/engine-api.md)
Engine class public API reference.

**COVERS:**
- Constructor and initialization
- getState() method
- processDecision() method
- processAgentResponse() method
- runWorkflow() method
- WorkflowOptions configuration
- Error handling and exceptions

### [Coordinator API](./api/coordinator-api.md)
Coordinator and Container public API reference.

**COVERS:**
- Container class methods
- Coordinator class methods
- Registration and resolution
- Context creation
- Configuration management
- Error handling

## Contributing

### [Contributing Guide](./contributing.md)
Comprehensive guide for project contributors.

**COVERS:**
- Getting started (prerequisites, setup)
- Development workflow (branch, commit, PR)
- Code style guidelines
- Testing requirements
- Commit conventions (conventional commits)
- Pull request process
- Common tasks (adding specs, agents, updating contracts)

## Document Conventions

### File Organization

- **One topic per file:** Each file covers a single component or concept
- **Cross-linking:** Use relative links to related documents
- **MECE principle:** Topics are mutually exclusive, collectively exhaustive
- **Single source of truth:** Information exists in exactly one place

### Document Structure

All architecture and development docs follow this structure:

1. **Front Matter:** Package/topic name, location, dependencies, status
2. **Purpose:** What this component does and why it exists
3. **Design Philosophy:** WHY decisions were made
4. **Architecture:** HOW it's implemented
5. **Examples:** Concrete usage examples
6. **Testing:** How to test this component
7. **Future Enhancements:** Planned improvements
8. **Related Documentation:** Cross-references
9. **Revision History:** Document change log

### Code Examples

- Include file paths and line numbers for real code references
- Show both GOOD (✅) and BAD (❌) examples
- Provide context and explanation for WHY

### Terminology

**Consistent terms used throughout:**
- **Spec:** Workflow specification (decision logic)
- **Agent:** Work executor (performs tasks)
- **Engine:** Workflow execution orchestrator
- **Container:** Service locator and DI container
- **Coordinator:** High-level orchestration API
- **Factory:** Component creator (ISpecFactory, IAgentFactory)
- **Context:** Dependency injection object (SpecContext, AgentContext)
- **State:** Workflow state (EngineState)
- **Decision:** Spec output (EngineDecision)
- **Action:** Individual directive (REQUEST_WORK, ANNOTATE, etc.)
- **Artifact:** Stored workflow output (files, JSON, etc.)

## Maintenance

### Keeping Docs Updated

**WHEN TO UPDATE:**
- Code changes that affect public APIs
- New features or capabilities added
- Architecture decisions made
- Bugs fixed that reveal design issues
- Performance optimizations applied

**HOW TO UPDATE:**
- Update relevant doc(s) in same PR as code change
- Add entry to Revision History table
- Update cross-references if structure changes
- Run `yarn typecheck` to ensure code examples are valid

### Documentation Review

**PROCESS:**
- Docs reviewed as part of PR process
- Monthly doc review for drift detection
- Quarterly comprehensive doc update
- User feedback incorporated

## Searching Documentation

### By Topic

Use the directory structure:
- **Architecture question?** → `architecture/`
- **Development question?** → `development/`
- **Design decision?** → `design/`
- **Operations question?** → `operations/`
- **API reference?** → `api/`

### By Component

- **Engine:** [architecture/engine.md](./architecture/engine.md), [api/engine-api.md](./api/engine-api.md)
- **Coordinator:** [architecture/coordinator.md](./architecture/coordinator.md), [api/coordinator-api.md](./api/coordinator-api.md)
- **Storage:** [architecture/storage.md](./architecture/storage.md)
- **Specs:** [architecture/specs.md](./architecture/specs.md)
- **Agents:** [architecture/agents.md](./architecture/agents.md)
- **Contracts:** [api/contracts.md](./api/contracts.md)

### By Use Case

- **"How do I add a new spec?"** → [development/adding-packages.md](./development/adding-packages.md)
- **"Why can't specs depend on engine?"** → [architecture/specs.md](./architecture/specs.md#why-specs-cannot-depend-on-engine)
- **"How does error handling work?"** → [architecture/engine.md](./architecture/engine.md#error-handling)
- **"How do I test a spec?"** → [development/testing.md](./development/testing.md), [architecture/specs.md](./architecture/specs.md#testing-specs)
- **"What security measures exist?"** → [architecture/storage.md](./architecture/storage.md#security-architecture)

## Getting Help

### Documentation Issues

- **Missing information:** Create GitHub issue with label `docs`
- **Incorrect information:** Create PR with fix
- **Unclear explanation:** Create issue requesting clarification

### Technical Questions

- **Architecture questions:** Review [architecture/overview.md](./architecture/overview.md) first
- **Implementation questions:** Check component-specific docs
- **Design decisions:** See [design/decisions.md](./design/decisions.md)
- **Still stuck:** Create GitHub discussion or ask in team chat

## External Documentation

This internal documentation complements:

- **[README.md](../../README.md):** Public-facing project introduction
- **[ARCHITECTURE.md](../../ARCHITECTURE.md):** High-level architecture (migrated to `architecture/overview.md`)
- **[CONTRIBUTING.md](../../CONTRIBUTING.md):** Public contribution guidelines (migrated to `contributing.md`)
- **Package READMEs:** Package-specific documentation in `packages/*/README.md`
- **Docker README:** Infrastructure setup in `docker/README.md`

## License

All documentation is part of the agent-coordinator project and is licensed under the MIT License.

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-09 | Internal Docs Agent | Initial documentation structure created |
