# Test Suite

## Overview

This directory contains both E2E tests (Playwright) and unit tests (Vitest) for the workflow builder application.

## Test Structure

```
tests/
├── e2e/              # Playwright E2E tests
│   ├── agent-creation.spec.ts      # Manual and AI-assisted agent creation
│   ├── agent-testing.spec.ts       # Agent testing modal and workflow
│   ├── agents.spec.ts              # Agent list and basic functionality
│   └── helpers/                    # Test utilities
└── unit/             # Vitest unit tests
    ├── agent-builder.test.ts       # Conversation service tests
    ├── agent-builder-router.test.ts # tRPC router tests (placeholder)
    ├── agent-tester-activities.test.ts # Activity tests
    └── agent-tester-router.test.ts  # Router tests (placeholder)
```

## Running Tests

### E2E Tests (Playwright)

```bash
# Run all E2E tests
yarn test:e2e

# Run with UI
yarn test:e2e:ui

# Debug mode
yarn test:e2e:debug

# View report
yarn test:e2e:report
```

**Prerequisites:**
- Dev server running on `http://localhost:3010`
- Test user credentials in `.env.local`:
  - `TEST_EMAIL=test@example.com`
  - `TEST_PASSWORD=your-password`

### Unit Tests (Vitest)

```bash
# Run all unit tests
yarn test

# Watch mode
yarn test:watch

# Run only unit tests
yarn test:unit
```

## Test Coverage

### E2E Tests

**Agent Creation:**
- ✅ Manual agent creation form
- ✅ Creating agent with all fields
- ✅ Field validation
- ✅ AI-assisted builder interface
- ✅ Conversation flow
- ✅ Prompt generation
- ✅ Saving generated prompts

**Agent Testing:**
- ✅ Test button on agent detail page
- ✅ Modal opening and closing
- ✅ Starting test session
- ✅ Sending messages
- ✅ Receiving responses
- ✅ Ending test session

### Unit Tests

**Agent Builder Service:**
- ✅ Session creation and management
- ✅ Message sending
- ✅ Prompt regeneration
- ✅ Session cleanup

**Agent Tester Activities:**
- ✅ Fetching agent prompts
- ✅ Calling agent API
- ✅ Token efficiency (message limiting)
- ✅ Saving test sessions

**Routers:**
- ⚠️ Placeholder structure (requires tRPC test context setup)

## Test Data

Tests use:
- Test user: `test@example.com` (or from `TEST_EMAIL` env var)
- Test agents: Created with timestamp-based names to avoid conflicts
- System workflows: Should be seeded via migrations

## Environment Variables

Create `.env.local` in the project root:

```env
TEST_EMAIL=test@example.com
TEST_PASSWORD=your-test-password
ANTHROPIC_API_KEY=your-api-key  # For AI-assisted tests
BASE_URL=http://localhost:3010
```

## Notes

- E2E tests run in headless mode by default (see `playwright.config.ts`)
- Unit tests use mocks for external services (Supabase, Anthropic)
- Router tests need tRPC test context setup (TODO)
- Some tests may be skipped if prerequisites aren't met (e.g., no agents exist)
