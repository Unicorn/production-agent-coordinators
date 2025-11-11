# Contributing to Agent Coordinator

**Status:** Active
**Last Updated:** 2025-11-09

This document provides comprehensive guidelines for contributing to the agent-coordinator project. It is maintained for internal team members and external contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Common Tasks](#common-tasks)
- [Review Checklist](#review-checklist)

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **Yarn** >= 1.22.0
- **Docker** and Docker Compose (for infrastructure)
- **Git**

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/bernierllc/agent-coordinator.git
cd agent-coordinator

# 2. Install dependencies
yarn install

# 3. Build all packages
yarn build

# 4. Start infrastructure
yarn infra:up

# 5. Run tests to verify setup
yarn test
yarn test:e2e
```

**VERIFY:** All tests pass before making changes.

### Development Environment

**Recommended Setup:**
- **Editor:** VSCode with TypeScript and ESLint extensions
- **Terminal:** iTerm2 or similar with split panes
- **Docker Desktop:** For managing infrastructure services

**VSCode Extensions:**
- TypeScript and JavaScript Language Features (built-in)
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- GitLens (`eamodio.gitlens`)

**See:** [Development Setup](./development/setup.md) for detailed setup guide.

## Development Workflow

### 1. Create Feature Branch

```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
```

**BRANCH NAMING:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### 2. Make Changes

**WHILE DEVELOPING:**
- Write code following [Code Style Guidelines](#code-style-guidelines)
- Add tests for new functionality
- Update documentation as needed
- Run linting and type checking frequently

**RECOMMENDED WORKFLOW:**

```bash
# Terminal 1: Watch build
yarn build:watch

# Terminal 2: Watch tests
yarn test:watch

# Terminal 3: Development work
# (edit files, run commands)
```

### 3. Test Your Changes

**BEFORE COMMITTING:**

```bash
# Run all unit tests (without watch)
yarn test

# Run E2E tests
yarn test:e2e

# Run linting
yarn lint

# Run type checking
yarn typecheck

# Build all packages
yarn build
```

**CRITICAL:** All tests must pass before committing.

**NOTE (per project guidelines):**
- Linting errors must NEVER be ignored or bypassed
- All tests run WITHOUT --watch so they stop on their own
- Use `yarn test:watch` only during development

### 4. Commit Your Changes

Follow [Commit Conventions](#commit-conventions):

```bash
git add .
git commit -m "feat(engine): add support for parallel step execution"
```

**VERIFY:** Commit message follows conventional commit format.

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create PR on GitHub with proper title and description.

**See:** [Pull Request Process](#pull-request-process)

## Code Style Guidelines

### TypeScript

#### Strict Mode

All packages use TypeScript strict mode:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

**LOCATION:** Each package's `tsconfig.json`

#### Type Annotations

**RULES:**
- Explicit return types for public functions
- Type parameters for generic functions
- Interface over type alias for public APIs
- No `any` types (use `unknown` if needed)

**EXAMPLES:**

```typescript
// ✅ GOOD
export function processState(state: EngineState): EngineState {
  return { ...state };
}

export interface IMyService {
  execute(input: string): Promise<Result>;
}

function handleUnknown(data: unknown): void {
  if (typeof data === 'string') {
    console.log(data);
  }
}

// ❌ BAD
export function processState(state) {
  return { ...state };
}

export type IMyService = {
  execute: (input: string) => Promise<Result>;
};

function handleUnknown(data: any): void {
  console.log(data);
}
```

#### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Interfaces | PascalCase with `I` prefix | `IStorage`, `ISpec`, `IAgent` |
| Classes | PascalCase | `Engine`, `Container`, `LocalFileStorage` |
| Functions | camelCase | `processDecision`, `applyAction` |
| Variables | camelCase | `finalState`, `workKind` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Files | kebab-case | `state-transitions.ts`, `hello-spec.ts` |
| Directories | kebab-case | `specs/hello`, `agents/anthropic` |

#### Imports

**ORDER:**
1. Node.js built-ins
2. External packages
3. Internal packages (workspace aliases)
4. Relative imports

**EXAMPLE:**

```typescript
// ✅ GOOD
import * as fs from 'fs';
import * as path from 'path';
import { Client } from '@temporalio/client';
import type { IStorage, ILogger } from '@coordinator/contracts';
import { Engine } from '@coordinator/engine';
import { applyRequestWork } from './state-transitions';

// ❌ BAD
import { applyRequestWork } from './state-transitions';
import type { IStorage } from '@coordinator/contracts';
import * as fs from 'fs';
import { Client } from '@temporalio/client';
```

### Pure Functions

**RULE:** Engine state transitions MUST be pure functions.

**REQUIREMENTS:**
- No side effects (no I/O, no mutations, no logging)
- Deterministic (same inputs → same outputs)
- No global state access
- Use `SpecExecutionContext` for time and randomness

**EXAMPLES:**

```typescript
// ✅ GOOD - Pure function
function applyAction(
  state: EngineState,
  action: Action,
  context: SpecExecutionContext
): EngineState {
  return {
    ...state,
    log: [...state.log, { at: context.now, event: 'ACTION', data: action }],
  };
}

// ❌ BAD - Mutates state
function applyAction(state: EngineState, action: Action): EngineState {
  state.log.push({ at: Date.now(), event: 'ACTION', data: action });
  return state;
}

// ❌ BAD - Non-deterministic
function applyAction(state: EngineState, action: Action): EngineState {
  return {
    ...state,
    log: [...state.log, { at: Date.now(), event: 'ACTION', data: action }],
  };
}

// ❌ BAD - Side effect
function applyAction(state: EngineState, action: Action, context: SpecExecutionContext): EngineState {
  console.log('Applying action:', action);  // Side effect!
  return {
    ...state,
    log: [...state.log, { at: context.now, event: 'ACTION', data: action }],
  };
}
```

### Error Handling

#### Don't Swallow Errors

**EXAMPLES:**

```typescript
// ✅ GOOD
async function executeAgent(): Promise<AgentResult> {
  try {
    const result = await callProvider();
    return { status: 'OK', content: result };
  } catch (error) {
    return {
      status: 'FAIL',
      errors: [{
        type: 'PROVIDER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: true,
      }],
    };
  }
}

// ❌ BAD - Silent failure
async function executeAgent(): Promise<AgentResult> {
  try {
    const result = await callProvider();
    return { status: 'OK', content: result };
  } catch (error) {
    console.error(error);  // Logged but not propagated!
    return { status: 'OK', content: {} };  // Lying about success!
  }
}
```

#### Use Error Taxonomy

Map provider-specific errors to our error taxonomy:

```typescript
// ✅ GOOD
const errorTypeMap: Record<string, ErrorType> = {
  'rate_limit_exceeded': 'RATE_LIMIT',
  'prompt_too_long': 'CONTEXT_EXCEEDED',
  'invalid_request': 'INVALID_REQUEST',
  'timeout': 'TIMEOUT',
};

if (error.code in errorTypeMap) {
  return {
    status: errorTypeMap[error.code] === 'RATE_LIMIT' ? 'RATE_LIMITED' : 'FAIL',
    errors: [{
      type: errorTypeMap[error.code],
      message: error.message,
      retryable: error.retryable,
    }],
  };
}
```

### Linting

**COMMAND:** `yarn lint`

**RULE (per project guidelines):** Linting errors must NEVER be ignored or bypassed.

**FIXING LINT ERRORS:**

```bash
# Auto-fix where possible
yarn lint --fix

# Manually fix remaining errors
# (no `eslint-disable` comments allowed)
```

## Testing Requirements

### Test Coverage

All new code must include tests:

- **Unit Tests:** For pure functions and classes in isolation
- **Integration Tests:** For component interactions
- **E2E Tests:** For complete workflows (when adding new specs)

**COVERAGE REQUIREMENTS:**
- Pure functions: 100% coverage
- Classes: 80%+ coverage
- E2E: Happy path + major error paths

### Unit Tests

**LOCATION:** Alongside source files (`*.test.ts`)

**FOCUS:** Pure state transitions and business logic

**EXAMPLE:**

```typescript
// packages/engine/src/state-transitions.test.ts
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
      requestedAt: 1000,
      updatedAt: 1000,
    });
  });
});
```

### Mock Validation

**CRITICAL (per project guidelines):** All mocks must be validated against real implementations.

**REQUIREMENTS:**
- Mock agents must match real agent response schema
- Tests verify mock responses against real schemas
- Regular re-recording of mock responses

**EXAMPLE:**

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

    // Ensure required fields
    expect(mockResult.status).toBeDefined();
  });

  // Run manually when real agent changes
  it.skip('should re-record mock responses', async () => {
    const realAgent = new AnthropicAgent(realContext);
    const realResult = await realAgent.execute('GENERATE_CODE', testPayload, execContext);

    // Save as mock template
    await fs.writeFile(
      './mocks/anthropic-generate-code.json',
      JSON.stringify(realResult, null, 2)
    );
  });
});
```

### Running Tests

```bash
# All tests run WITHOUT --watch (they stop on their own)
yarn test              # Unit tests
yarn test:e2e          # E2E tests

# Watch mode for development ONLY
yarn test:watch        # Unit tests
yarn test:e2e:watch    # E2E tests (if available)
```

### Test Failures

**PROCESS (per project guidelines):**

When tests fail, evaluate whether to fix code or fix tests:

1. **Analyze failure:** Why is the test failing?
2. **Check assumptions:** Are test assumptions still valid?
3. **Review changes:** What code changed that might affect test?
4. **Discuss:** Fixing code vs. fixing test should be a discussion, not automatic
5. **Document:** If fixing test, explain WHY in commit message

**See:** [Testing Strategy](./development/testing.md) for comprehensive testing guide.

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear history and automated versioning.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New feature | `feat(engine): add parallel execution` |
| `fix` | Bug fix | `fix(coordinator): resolve factory race condition` |
| `docs` | Documentation | `docs: add architecture diagrams` |
| `style` | Code style (no logic change) | `style: format with prettier` |
| `refactor` | Code refactoring | `refactor(engine): extract helper functions` |
| `test` | Adding/updating tests | `test(specs): add hello spec unit tests` |
| `chore` | Build/dependencies | `chore: update dependencies` |
| `perf` | Performance improvement | `perf(engine): optimize state cloning` |

### Scope

Optional, indicates which package is affected:

- `engine`
- `coordinator`
- `cli`
- `specs`
- `agents`
- `storage`
- `contracts`

### Subject

- Use imperative mood ("add feature" not "added feature")
- Lowercase first letter
- No period at end
- Maximum 72 characters

### Body

- Wrap at 72 characters
- Explain WHAT and WHY, not HOW
- Include context and rationale

### Footer

- Reference issues/PRs: `Closes #42`, `Related to #123`
- Breaking changes: `BREAKING CHANGE: ...`

### Examples

```bash
# Simple feature
git commit -m "feat(engine): add support for parallel step execution"

# Bug fix with body
git commit -m "fix(coordinator): resolve factory resolution race condition

The factory registry was not thread-safe, causing intermittent
failures when resolving factories concurrently. Added mutex to
protect registry access."

# Breaking change
git commit -m "feat(contracts)!: change AgentResult interface

BREAKING CHANGE: AgentResult.status now uses string union instead
of enum to support custom status values.

Migration guide:
- Replace AgentStatus.OK with 'OK'
- Replace AgentStatus.FAIL with 'FAIL'

Closes #42"

# Documentation
git commit -m "docs: add architecture diagrams to README

Related to #15"

# Multiple packages
git commit -m "refactor(engine,coordinator): extract shared utilities"
```

## Pull Request Process

### Before Creating PR

**CHECKLIST:**

- [ ] All tests pass (`yarn test && yarn test:e2e`)
- [ ] No linting errors (`yarn lint`)
- [ ] Type checking passes (`yarn typecheck`)
- [ ] Build succeeds (`yarn build`)
- [ ] Documentation updated (if needed)
- [ ] Commits follow conventions
- [ ] No sensitive data in commits (API keys, passwords)

### PR Title

Use conventional commit format:

```
feat(engine): add parallel step execution
```

### PR Description

**TEMPLATE:**

```markdown
## Summary

Brief description of changes (1-2 sentences).

## Changes

- Bullet point list of specific changes
- Focus on WHAT changed, not HOW

## Motivation

Why are these changes needed?

## Test Plan

- [x] Unit tests added/updated
- [x] Integration tests added/updated
- [ ] E2E tests added (if applicable)
- [x] Manual testing performed

## Screenshots/Demos

(If applicable)

## Related Issues

Closes #123
Related to #456

## Checklist

- [x] Tests pass
- [x] Linting passes
- [x] Type checking passes
- [x] Documentation updated
- [x] Commits follow conventions
```

### Review Process

1. **PR Submitted:** Automated checks run (CI/CD)
2. **Code Review:** Maintainers review code
3. **Address Feedback:** Author makes requested changes
4. **Approval:** At least one maintainer approval required
5. **Merge:** Squash and merge to main

### Addressing Feedback

```bash
# Make requested changes
git add .
git commit -m "refactor: address PR feedback"

# Push to same branch
git push origin feature/your-feature
```

**PR automatically updates with new commits.**

## Project Structure

### Monorepo Layout

```
agent-coordinator/
├── packages/
│   ├── contracts/         # Pure interfaces (no dependencies)
│   ├── engine/           # Workflow execution (depends on contracts)
│   ├── coordinator/      # DI and orchestration (depends on contracts, engine)
│   ├── storage/          # Storage implementations (depends on contracts)
│   ├── specs/            # Workflow specs (depends on contracts ONLY)
│   │   ├── hello/
│   │   └── todo/
│   ├── agents/           # Agent implementations (depends on contracts ONLY)
│   │   ├── mock/
│   │   └── anthropic/
│   └── cli/              # CLI tools (depends on all)
├── docker/               # Infrastructure
├── tests/
│   └── e2e/             # End-to-end tests
└── docs/                # Documentation
```

### Dependency Rules

**CRITICAL:** These rules prevent circular dependencies:

1. ✅ `contracts` has ZERO dependencies
2. ✅ `engine` depends on `contracts` only
3. ✅ `specs/*` depends on `contracts` ONLY (never `engine`!)
4. ✅ `agents/*` depends on `contracts` ONLY (never `engine`!)
5. ✅ `coordinator` can depend on `contracts` and `engine`
6. ✅ `cli` can depend on everything (integration layer)

**ENFORCED BY:** TypeScript project references in `tsconfig.json`

**See:** [Architecture Overview](./architecture/overview.md#package-architecture) for details.

## Common Tasks

### Adding a New Spec

**See:** [Adding Packages](./development/adding-packages.md#adding-a-spec-package)

**STEPS:**
1. Create package directory: `packages/specs/my-spec/`
2. Create `package.json` with `@coordinator/contracts` dependency
3. Implement `ISpecFactory` and `ISpec`
4. Add tests (unit + integration)
5. Update root `package.json` workspaces
6. Update root `tsconfig.json` references
7. Register in CLI example

### Adding a New Agent

**See:** [Adding Packages](./development/adding-packages.md#adding-an-agent-package)

**STEPS:**
1. Create package directory: `packages/agents/my-agent/`
2. Create `package.json` with `@coordinator/contracts` dependency
3. Implement `IAgentFactory` and `IAgent`
4. Add tests (unit + mock validation)
5. Update root `package.json` workspaces
6. Update root `tsconfig.json` references
7. Register in CLI example

### Updating Contracts

**IMPORTANT:** Changes to `contracts` affect all packages.

**PROCESS:**
1. Update interface in `packages/contracts/src/`
2. Update ALL implementations across packages
3. Update ALL tests across packages
4. Document breaking changes in commit message
5. Update migration guide if breaking change
6. Get approval from maintainers before merging

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

**See:** [Debugging Guide](./development/debugging.md)

## Review Checklist

Use this checklist when reviewing PRs:

### Code Quality

- [ ] Code follows style guidelines
- [ ] No linting errors
- [ ] Type checking passes
- [ ] Pure functions are truly pure (no side effects)
- [ ] Error handling is comprehensive

### Testing

- [ ] Tests added for new functionality
- [ ] Tests updated for changed functionality
- [ ] All tests pass
- [ ] Mocks validated against real implementations (if applicable)
- [ ] Edge cases covered

### Architecture

- [ ] Dependency rules respected (specs/agents don't depend on engine)
- [ ] Appropriate use of interfaces
- [ ] No circular dependencies
- [ ] Factory pattern used correctly

### Documentation

- [ ] Public API documented (JSDoc comments)
- [ ] Internal docs updated (if architecture changed)
- [ ] README updated (if public interface changed)
- [ ] Migration guide provided (if breaking change)

### Security

- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Path traversal prevented (storage)
- [ ] API keys handled securely

### Performance

- [ ] No obvious performance issues
- [ ] Efficient data structures used
- [ ] No unnecessary state copying

## Getting Help

### Documentation

- **Architecture questions:** [Architecture Overview](./architecture/overview.md)
- **Development setup:** [Development Setup](./development/setup.md)
- **Testing guide:** [Testing Strategy](./development/testing.md)
- **Design decisions:** [Design Decisions](./design/decisions.md)

### Communication

- **Issues:** Create GitHub issue for bugs/features
- **Discussions:** Use GitHub Discussions for questions
- **Code Review:** Tag maintainers in PR for guidance
- **Urgent:** Contact team lead directly

## License

By contributing to Agent Coordinator, you agree that your contributions will be licensed under the MIT License.

## Acknowledgments

Thank you for contributing to Agent Coordinator! Your efforts help build a better multi-agent orchestration platform.

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2025-11-09 | Internal Docs Agent | Initial creation from CONTRIBUTING.md |
