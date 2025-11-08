# Contributing to Agent Coordinator

Thank you for your interest in contributing to the Agent Coordinator project! This guide will help you understand our development workflow, coding standards, and best practices.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Common Tasks](#common-tasks)

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.22.0
- Docker and Docker Compose
- Git

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/bernierllc/agent-coordinator.git
cd agent-coordinator

# Install dependencies
yarn install

# Build all packages
yarn build

# Start infrastructure
yarn infra:up

# Run tests to verify setup
yarn test
yarn test:e2e
```

### Development Environment

We recommend using:

- **Editor**: VSCode with TypeScript and ESLint extensions
- **Terminal**: iTerm2 or similar with split panes
- **Docker Desktop**: For managing infrastructure services

## Development Workflow

### 1. Create a Feature Branch

```bash
# Ensure main branch is up to date
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Write code following our [Code Style Guidelines](#code-style-guidelines)
- Add tests for new functionality
- Update documentation as needed
- Run linting and type checking frequently

```bash
# During development
yarn build:watch  # Terminal 1: Watch build
yarn test:watch   # Terminal 2: Watch tests
```

### 3. Test Your Changes

```bash
# Run all tests
yarn test           # Unit tests
yarn test:e2e       # E2E tests
yarn lint           # Linting
yarn typecheck      # Type checking
```

### 4. Commit Your Changes

Follow our [Commit Conventions](#commit-conventions):

```bash
git add .
git commit -m "feat: add new spec for XYZ workflow"
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
# Then create PR on GitHub
```

## Code Style Guidelines

### TypeScript

#### Strict Mode

All packages use TypeScript strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

#### Type Annotations

- Explicit return types for public functions
- Type parameters for generic functions
- Interface over type alias for public APIs

```typescript
// ✅ Good
export function processState(state: EngineState): EngineState {
  return { ...state };
}

export interface IMyService {
  execute(input: string): Promise<Result>;
}

// ❌ Bad
export function processState(state) {
  return { ...state };
}

export type IMyService = {
  execute: (input: string) => Promise<Result>;
};
```

#### Naming Conventions

- **Interfaces**: PascalCase with `I` prefix for interfaces (e.g., `IStorage`, `ISpec`)
- **Classes**: PascalCase (e.g., `Engine`, `Container`)
- **Functions**: camelCase (e.g., `processDecision`, `applyAction`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Files**: kebab-case (e.g., `state-transitions.ts`, `hello-spec.ts`)

#### Imports

Organize imports in this order:

1. Node.js built-ins
2. External packages
3. Internal packages (using workspace aliases)
4. Relative imports

```typescript
// ✅ Good
import * as fs from 'fs';
import { Client } from '@temporalio/client';
import type { IStorage, ILogger } from '@coordinator/contracts';
import { applyRequestWork } from './state-transitions';

// ❌ Bad
import { applyRequestWork } from './state-transitions';
import type { IStorage } from '@coordinator/contracts';
import * as fs from 'fs';
```

### Pure Functions

Engine state transitions must be pure functions:

```typescript
// ✅ Good - Pure function
function applyAction(
  state: EngineState,
  action: Action,
  context: SpecExecutionContext
): EngineState {
  return {
    ...state,
    log: [...state.log, { timestamp: context.now, action }],
  };
}

// ❌ Bad - Mutates state
function applyAction(state: EngineState, action: Action): EngineState {
  state.log.push({ timestamp: Date.now(), action });  // Mutation!
  return state;  // Non-deterministic timestamp!
}
```

### Error Handling

#### Don't Swallow Errors

```typescript
// ✅ Good
async function executeAgent(): Promise<AgentResult> {
  try {
    const result = await callProvider();
    return { status: 'OK', content: result };
  } catch (error) {
    return {
      status: 'FAIL',
      errors: [{
        type: 'PROVIDER_ERROR',
        message: error.message,
        retryable: true,
      }],
    };
  }
}

// ❌ Bad
async function executeAgent(): Promise<AgentResult> {
  try {
    const result = await callProvider();
    return { status: 'OK', content: result };
  } catch (error) {
    console.error(error);  // Silent failure!
    return { status: 'OK', content: {} };  // Lying about success!
  }
}
```

#### Use Error Taxonomy

Map provider errors to our error taxonomy:

```typescript
const errorTypeMap: Record<string, ErrorType> = {
  'rate_limit_exceeded': 'RATE_LIMIT',
  'prompt_too_long': 'CONTEXT_EXCEEDED',
  'invalid_request': 'INVALID_REQUEST',
};
```

### ESLint

Run ESLint before committing:

```bash
yarn lint
```

**Note**: Linting errors must never be ignored or bypassed (per project guidelines).

## Testing Requirements

### Test Coverage

All new code must include tests:

- **Unit Tests**: For pure functions and classes
- **Integration Tests**: For component interactions
- **E2E Tests**: For complete workflows (when adding new specs)

### Unit Tests

Located alongside source files (`*.test.ts`):

```typescript
// engine/src/state-transitions.test.ts
describe('applyRequestWork', () => {
  it('should add new step to openSteps', () => {
    const state: EngineState = {
      goalId: 'test',
      status: 'RUNNING',
      openSteps: {},
      artifacts: {},
      log: [],
    };

    const action: RequestWorkAction = {
      type: 'REQUEST_WORK',
      workKind: 'HELLO',
      stepId: 'step-1',
      payload: {},
    };

    const context: SpecExecutionContext = {
      now: 1000,
      random: () => 0.5,
    };

    const newState = applyRequestWork(state, action, context);

    expect(newState.openSteps['step-1']).toEqual({
      kind: 'HELLO',
      status: 'WAITING',
      payload: {},
      createdAt: 1000,
    });
  });
});
```

### Mock Validation

**CRITICAL** (per project guidelines): All mocks must be validated against real implementations.

```typescript
describe('MockAgent validation', () => {
  it('should match real agent response schema', async () => {
    const mockAgent = new MockAgent(context);
    const mockResult = await mockAgent.execute('HELLO', {}, execContext);

    // Validate against expected schema
    expect(mockResult).toMatchObject({
      status: expect.stringMatching(/^(OK|FAIL|PARTIAL|RATE_LIMITED|CONTEXT_EXCEEDED)$/),
      content: expect.any(Object),
    });
  });

  // Periodically re-record mock responses
  it('should update mocks when real agent behavior changes', async () => {
    // This test should be updated when AnthropicAgent changes
  });
});
```

### Running Tests

```bash
# All tests run WITHOUT --watch (they stop on their own)
yarn test              # Unit tests
yarn test:e2e          # E2E tests

# Watch mode for development
yarn test:watch        # Unit tests
yarn test:e2e:watch    # E2E tests
```

### Test Failures

When tests fail, we need to evaluate whether to fix the code or fix the tests:

1. **Analyze the failure**: Why is the test failing?
2. **Check assumptions**: Are the test assumptions still valid?
3. **Review changes**: What code changed that might affect the test?
4. **Decide**: Fix code or fix test (this should be a discussion, not automatic)

## Commit Conventions

We use conventional commits for clear history and automated versioning.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring (no behavior change)
- **test**: Adding or updating tests
- **chore**: Build process, dependency updates, etc.
- **perf**: Performance improvements

### Scope

Optional, indicates which package is affected:

- `engine`
- `coordinator`
- `cli`
- `specs`
- `agents`
- `storage`
- `contracts`

### Examples

```bash
# New feature
git commit -m "feat(engine): add support for parallel step execution"

# Bug fix
git commit -m "fix(coordinator): resolve factory resolution race condition"

# Documentation
git commit -m "docs: add architecture diagrams to README"

# Multiple packages
git commit -m "refactor(engine,coordinator): extract shared utilities"

# Breaking change
git commit -m "feat(contracts)!: change AgentResult interface

BREAKING CHANGE: AgentResult.status now uses string union instead of enum"
```

### Commit Message Guidelines

- Use imperative mood ("add feature" not "added feature")
- First line <= 72 characters
- Body wraps at 72 characters
- Reference issues/PRs in footer

```
feat(specs): add TodoSpec for multi-step workflow

Implements a spec that orchestrates multiple agents to generate
a complete todo application with tests and documentation.

Closes #42
```

## Pull Request Process

### Before Creating PR

1. ✅ All tests pass (`yarn test && yarn test:e2e`)
2. ✅ No linting errors (`yarn lint`)
3. ✅ Type checking passes (`yarn typecheck`)
4. ✅ Build succeeds (`yarn build`)
5. ✅ Documentation updated (if needed)
6. ✅ Commits follow conventions

### PR Title and Description

**Title**: Use conventional commit format

```
feat(engine): add parallel step execution
```

**Description**: Explain what and why

```markdown
## Summary

Adds support for executing multiple WAITING steps in parallel to improve
workflow performance.

## Changes

- Modified `Engine.runWorkflow()` to detect parallel-eligible steps
- Added `executeParallel()` helper function
- Updated tests to cover parallel execution

## Test Plan

- [x] Unit tests for parallel execution logic
- [x] Integration tests with multiple concurrent steps
- [x] E2E test with TodoSpec (parallel DOC, TEST, REVIEW)

## Performance

Reduced TodoSpec execution time from 15s to 6s (60% improvement)
```

### Review Process

1. PR is submitted
2. Automated checks run (tests, linting, type checking)
3. Code review by maintainers
4. Address feedback
5. Approval from at least one maintainer
6. Merge to main

### Addressing Feedback

```bash
# Make changes based on feedback
git add .
git commit -m "refactor: address PR feedback"
git push origin feature/your-feature
```

## Project Structure

### Package Organization

```
packages/
├── contracts/         # Pure interfaces (no dependencies)
├── engine/           # Workflow execution (depends on contracts)
├── coordinator/      # DI and orchestration (depends on contracts, engine)
├── storage/          # Storage implementations (depends on contracts)
├── specs/            # Workflow specs (depends on contracts ONLY)
│   ├── hello/
│   └── todo/
├── agents/           # Agent implementations (depends on contracts ONLY)
│   ├── mock/
│   └── anthropic/
└── cli/              # CLI tools (depends on all)
```

### Dependency Rules

**CRITICAL**: These rules prevent circular dependencies:

1. ✅ `contracts` has ZERO dependencies
2. ✅ `engine` depends on `contracts` only
3. ✅ `specs/*` depends on `contracts` ONLY (never `engine`!)
4. ✅ `agents/*` depends on `contracts` ONLY (never `engine`!)
5. ✅ `coordinator` can depend on `contracts` and `engine`
6. ✅ `cli` can depend on everything (integration layer)

### Adding a New Package

```bash
# Create package directory
mkdir -p packages/my-package/src

# Create package.json
cat > packages/my-package/package.json << EOF
{
  "name": "@coordinator/my-package",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist tsconfig.tsbuildinfo",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@coordinator/contracts": "*"
  },
  "devDependencies": {
    "@types/node": "^22.7.5",
    "typescript": "^5.6.3",
    "vitest": "^1.6.0"
  }
}
EOF

# Create tsconfig.json
cat > packages/my-package/tsconfig.json << EOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../contracts" }
  ]
}
EOF

# Add to root package.json workspaces
# Add to tsconfig.json references
```

## Common Tasks

### Adding a New Spec

1. Create package: `packages/specs/my-spec/`
2. Implement `ISpecFactory` and `ISpec`
3. Add tests
4. Update CLI to register the spec
5. Add example usage

### Adding a New Agent

1. Create package: `packages/agents/my-agent/`
2. Implement `IAgentFactory` and `IAgent`
3. Add tests (including mock validation)
4. Update CLI to register the agent
5. Add configuration documentation

### Updating Contracts

**IMPORTANT**: Changes to `contracts` affect all packages.

1. Update interface in `packages/contracts/src/`
2. Update all implementations
3. Update all tests
4. Document breaking changes in commit message

### Debugging

```bash
# Enable debug logging
export DEBUG=coordinator:*

# Run with Node inspector
node --inspect-brk dist/cli.js run hello
# Then attach debugger in VSCode or Chrome DevTools

# View infrastructure logs
yarn infra:logs
docker compose -f docker/docker-compose.yml logs -f postgres
```

### Updating Dependencies

```bash
# Check for updates
yarn outdated

# Update all dependencies (interactive)
yarn upgrade-interactive

# Update specific package
yarn workspace @coordinator/engine add dependency@latest
```

## Getting Help

- **Documentation**: Check [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
- **Issues**: Search existing issues on GitHub
- **Discussions**: Start a discussion for questions
- **Code Review**: Tag maintainers in PRs for guidance

## License

By contributing to Agent Coordinator, you agree that your contributions will be licensed under the MIT License.
