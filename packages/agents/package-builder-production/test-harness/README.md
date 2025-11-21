# Agent Execution Test Harness

This directory contains standalone test scripts for validating the Claude AI agent execution pipeline **independently of Temporal workflows**. This enables rapid iteration and debugging without deploying to Temporal.

## Overview

The test harness validates the complete agent execution workflow:

1. **Prompt Building** - Constructing context-rich prompts with quality standards
2. **Claude Execution** - Calling the Anthropic API
3. **Response Parsing** - Extracting structured data from Claude's responses
4. **File Operations** - Creating/updating/deleting files in the workspace

## Prerequisites

### Required Environment Variables

```bash
# Required for Claude API tests
export ANTHROPIC_API_KEY="your-anthropic-api-key"

# Optional for GitHub integration tests
export GITHUB_TOKEN="your-github-token"
```

### Dependencies

All tests use `tsx` to execute TypeScript directly. No build step required.

## Directory Structure

```
test-harness/
├── README.md                       # This file
├── fixtures/                       # Test inputs
│   ├── sample-plan.md             # Sample package plan
│   ├── sample-response.json       # Sample Claude response
│   └── expected-files/            # (reserved for future use)
├── output/                         # Test outputs (gitignored)
│   ├── prompt-basic.txt
│   ├── claude-response.txt
│   ├── parsed-response.json
│   ├── test-package/              # Generated package files
│   └── e2e-test/                  # End-to-end test workspace
├── test-prompt-builder.ts         # Test 1: Prompt generation
├── test-claude-execution.ts       # Test 2: Claude API calls
├── test-response-parser.ts        # Test 3: JSON parsing
├── test-file-operations.ts        # Test 4: File I/O
└── test-end-to-end.ts             # Test 5: Full pipeline
```

## Test Scripts

### 1. Test Prompt Builder

**Purpose:** Validates prompt generation with quality standards, few-shot examples, and validation checklists.

**Run:**
```bash
cd packages/agents/package-builder-production
npx tsx test-harness/test-prompt-builder.ts
```

**Tests:**
- Basic prompt generation
- Enhanced prompt with quality standards
- GitHub context integration
- Token estimation

**Output:**
- `output/prompt-basic.txt` - Minimal prompt
- `output/prompt-enhanced.txt` - Full prompt with all enhancements

**Success Criteria:**
- Prompts generate without errors
- Quality standards section present
- Few-shot examples included
- Validation checklist present
- Token counts reasonable (<8K tokens for enhanced)

---

### 2. Test Claude Execution

**Purpose:** Validates Anthropic API integration and response handling.

**Run:**
```bash
cd packages/agents/package-builder-production
npx tsx test-harness/test-claude-execution.ts
```

**Prerequisites:**
- `ANTHROPIC_API_KEY` environment variable set

**Tests:**
- API authentication
- Prompt submission
- Response retrieval
- Error handling (rate limits, timeouts)
- Cost estimation

**Output:**
- `output/claude-response.txt` - Full Claude response
- `output/claude-response-preview.txt` - Response metadata

**Success Criteria:**
- API call succeeds
- Response contains valid JSON
- Response time < 60 seconds
- Estimated cost reasonable ($0.01-$0.10 per call)

---

### 3. Test Response Parser

**Purpose:** Validates JSON parsing with lenient handling of extra fields.

**Run:**
```bash
cd packages/agents/package-builder-production
npx tsx test-harness/test-response-parser.ts
```

**Tests:**
- Fixture response parsing
- Markdown code block stripping
- Minimal response (required fields only)
- Extra fields preservation (meta-agent pattern)
- Real Claude response parsing (if available)

**Output:**
- `output/parsed-fixture.json` - Parsed fixture
- `output/parsed-minimal.json` - Minimal valid response
- `output/parsed-extra-fields.json` - Response with extra fields

**Success Criteria:**
- All responses parse successfully
- Required fields (`files`, `summary`) present
- Optional fields (`qualityChecklist`, `questions`, `suggestions`) preserved
- Extra unknown fields preserved (lenient parsing)

---

### 4. Test File Operations

**Purpose:** Validates file creation, updates, and deletions with security checks.

**Run:**
```bash
cd packages/agents/package-builder-production
npx tsx test-harness/test-file-operations.ts
```

**Prerequisites:**
- Run `test-response-parser.ts` first to generate `parsed-fixture.json`

**Tests:**
- File creation from parsed response
- File content verification
- package.json validity
- File updates
- File deletions
- Path traversal attack protection

**Output:**
- `output/test-package/` - Generated package files

**Success Criteria:**
- All expected files created
- package.json is valid JSON
- File updates work correctly
- Deletions remove files
- Path traversal attacks blocked

---

### 5. Test End-to-End

**Purpose:** Tests the complete pipeline from prompt to files.

**Run:**
```bash
cd packages/agents/package-builder-production
npx tsx test-harness/test-end-to-end.ts
```

**Prerequisites:**
- `ANTHROPIC_API_KEY` environment variable set
- `GITHUB_TOKEN` optional (for GitHub integration)

**Tests:**
1. Build enhanced prompt with all quality standards
2. Call Claude API
3. Parse response
4. Apply file changes to workspace
5. Verify package structure
6. Measure performance
7. Estimate cost

**Output:**
- `output/e2e-test/packages/utility/logger/` - Complete generated package

**Success Criteria:**
- All 4 pipeline steps complete successfully
- Files created match expected structure
- package.json is valid
- Total time < 90 seconds
- Cost < $0.10 per run

---

## Usage Workflow

### Quick Start (Recommended Order)

```bash
# 1. Test prompt generation (no API key needed)
npx tsx test-harness/test-prompt-builder.ts

# 2. Test Claude API (requires ANTHROPIC_API_KEY)
npx tsx test-harness/test-claude-execution.ts

# 3. Test response parsing
npx tsx test-harness/test-response-parser.ts

# 4. Test file operations
npx tsx test-harness/test-file-operations.ts

# 5. Test full pipeline
npx tsx test-harness/test-end-to-end.ts
```

### Testing Individual Activities

To test a single activity without running the full pipeline:

```typescript
// Example: Test just the prompt builder
import { buildAgentPrompt } from '../src/activities/prompt-builder.activities.js';

const prompt = await buildAgentPrompt({
  agentName: 'package-development-agent',
  taskType: 'PACKAGE_SCAFFOLDING',
  instructions: 'Create logger package',
  packagePath: 'packages/utility/logger',
  planPath: 'test-harness/fixtures/sample-plan.md',
  workspaceRoot: process.cwd(),
  includeQualityStandards: true,
  includeFewShotExamples: true,
  includeValidationChecklist: true
});

console.log(prompt);
```

### Debugging Failed Tests

Each test script includes detailed error messages and suggestions:

```
❌ Test failed: Invalid JSON response

💡 Tip: Check that the response is valid JSON
```

**Common Issues:**

1. **Missing API Key**
   - Error: `ANTHROPIC_API_KEY environment variable is required`
   - Fix: `export ANTHROPIC_API_KEY=your-key`

2. **Invalid JSON Response**
   - Error: `Unexpected token in JSON`
   - Fix: Claude may have returned markdown - check `output/claude-response.txt`

3. **Path Traversal Blocked**
   - Error: `Path traversal attempt blocked`
   - Fix: This is expected - security is working correctly

4. **File Not Found**
   - Error: `ENOENT: no such file or directory`
   - Fix: Run tests in order (parser before file operations)

## Modifying Test Fixtures

### Creating New Test Plans

Edit `fixtures/sample-plan.md` to test different package types:

```markdown
# @test/my-package

**Package:** `@test/my-package`
**Type:** utility
**Status:** Planning

## Overview

...
```

### Creating New Test Responses

Edit `fixtures/sample-response.json` to test different Claude outputs:

```json
{
  "files": [
    {
      "path": "package.json",
      "operation": "create",
      "content": "..."
    }
  ],
  "summary": "...",
  "questions": [...],
  "suggestions": [...]
}
```

## Performance Benchmarks

Expected performance on typical development machine:

| Test | Duration | API Calls | Cost |
|------|----------|-----------|------|
| Prompt Builder | <100ms | 0 | $0 |
| Claude Execution | 5-30s | 1 | $0.01-$0.05 |
| Response Parser | <50ms | 0 | $0 |
| File Operations | <200ms | 0 | $0 |
| End-to-End | 5-35s | 1 | $0.01-$0.05 |

## Integration with Temporal

Once activities are tested and working with the harness:

1. **Build the project:**
   ```bash
   yarn build
   ```

2. **Deploy to Temporal:**
   ```bash
   yarn workspace @coordinator/agent-package-builder-production start:worker
   ```

3. **Run integration tests:**
   ```bash
   yarn workspace @coordinator/agent-package-builder-production test
   ```

The test harness validates activities work correctly **before** integrating with Temporal, reducing deployment cycles and debugging time.

## Troubleshooting

### Environment Variables Not Found

```bash
# Check if variables are set
echo $ANTHROPIC_API_KEY
echo $GITHUB_TOKEN

# Set in current shell
export ANTHROPIC_API_KEY="sk-..."
export GITHUB_TOKEN="ghp_..."

# Set permanently (add to ~/.bashrc or ~/.zshrc)
echo 'export ANTHROPIC_API_KEY="sk-..."' >> ~/.zshrc
```

### Tests Hang or Timeout

- **Cause:** Slow network or Claude API overload
- **Fix:** Increase timeout in test script or try again later

### Package Build Fails

```bash
# Clean and rebuild
rm -rf dist/
yarn build

# Check for TypeScript errors
yarn tsc --noEmit
```

### Output Directory Issues

```bash
# Clean output directory
rm -rf test-harness/output/*

# Recreate directory structure
mkdir -p test-harness/output
```

## Next Steps

After validating all tests pass:

1. Review `docs/plans/2025-11-20-real-agent-execution-implementation-design-v2.md`
2. Proceed to Phase 1: Implement `buildAgentPrompt()` activity
3. Run test harness to validate implementation
4. Iterate until all tests pass
5. Move to Phase 2: Response parser
6. Continue through all phases

## Support

For questions or issues:
1. Check test output for specific error messages
2. Review activity implementation in `src/activities/`
3. Consult design document for architecture details
4. Check Anthropic API status: https://status.anthropic.com/
