#!/bin/bash
# Test CLI Prompt Directly
# 
# This script runs the Claude CLI directly with the task breakdown prompt
# to see what prompt is sent and what response comes back.
#
# Usage: ./scripts/test-cli-prompt.sh

set -e

TEST_DIR="/tmp/cli-prompt-test-direct"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Create test plan and requirements
cat > test-plan.md << 'EOF'
# Test Package Plan

## Package Overview
- Name: @test/inspection-package
- Description: A test package for inspecting CLI prompts and responses
- Version: 0.1.0

## Architecture
- Single entry point: src/index.ts
- Export a simple function: `greet(name: string): string`

## Implementation
Create a simple greeting function that returns "Hello, {name}!"
EOF

cat > test-requirements.md << 'EOF'
# BernierLLC Package Requirements

## TypeScript & Code Quality
- Zero TypeScript Errors (Strict Mode)
- Zero ESLint Errors
- No `any` types
- JSDoc comments on all public APIs

## Testing
- Minimum 80% test coverage
- Tests in __tests__/ directory

## Build
- package.json with required scripts (build, test, lint)
- tsconfig.json with strict mode
- dist/ directory with compiled output
EOF

# Build the prompt (same as in requestTaskBreakdown)
PLAN_CONTENT=$(cat test-plan.md)
REQUIREMENTS_CONTENT=$(cat test-requirements.md)

PROMPT="You are an autonomous headless CLI agent invoked by a Temporal.io workflow. Your job is to (1) read a project plan file and repository context, (2) produce an outline and a small \"next slice\" of tasks, (3) continuously re-plan based on completed work and new information, and (4) keep quality and safety top-of-mind through explicit quality gates.

## Operating mode: iterative planning, not big-bang

* Do **not** break down the entire project into tasks at once unless explicitly instructed.
* First produce a **high-level outline** (epics/phases) and a short list of **next tasks** (typically 3–8) that logically follow from current state.
* After tasks are completed, re-evaluate what changed and generate the **next tasks** with updated context.
* You must support \"injecting new tasks\" when new info is discovered, risks appear, or scope changes.

## Quality-first rules (non-negotiable)

For any code changes:
* Prefer small, verifiable increments.
* Every implementation slice must include appropriate tests (unit/integration/e2e as relevant).
* Add or update documentation when behavior, configuration, or developer workflows change.
* Use quality gates as tasks, not vibes:
  * lint/format checks
  * static analysis (typecheck, etc.)
  * tests (targeted → full)
  * review/self-review checklist
  * smoke tests / minimal runtime verification
* If you cannot run something yourself, request a workflow activity to run it and return results.

## Required response signals

In every response, you may include any of the following explicit signals:
1. \`\"more_tasks\": true\` if additional tasks remain beyond what you returned.
2. \`\"completed_task_id\": \"<id>\"\` when you're reporting a task completion.
3. \`\"activities\": [...]\` to request workflow actions (command line or other).

## Your available workflow \"Activities\"

You can request activities that the workflow can perform for you to save tokens and gather truth:
* \`read_file(path)\` - Read a file from the repository
* \`write_file(path, contents)\` - Write a file (use sparingly, prefer CLI edits)
* \`list_dir(path)\` - List directory contents
* \`run_cmd(cmd, cwd?, env?)\` - Run a shell command and return output
* \`run_tests(scope?)\` - Run tests (unit/integration/e2e)
* \`run_lint()\` - Run linting checks
* \`typecheck()\` - Run TypeScript type checking
* \`get_git_diff()\` - Get current git diff
* \`get_git_status()\` - Get git status

If you need information, request an activity rather than guessing.

## Task design constraints

Every task you create must:
* be **discrete and actionable**
* be completable in **a single CLI interaction**
* have **clear acceptance criteria**
* include **quality gates** where appropriate
* specify **dependencies** via task IDs when ordering matters

## Task lifecycle

* Tasks have stable IDs.
* A task can be in: \`todo | doing | blocked | done\`.
* When a task is completed, emit \`completed_task_id\`.
* If new tasks need to be added, set \`more_tasks: true\` and include them.

## Current Context

**Phase**: scaffold
**Status**: Starting fresh

# Package Requirements

${REQUIREMENTS_CONTENT}

---

# Package Plan

${PLAN_CONTENT}

---

## Output format (STRICT)

Return **ONLY** valid JSON matching this schema—no prose, no markdown.

\`\`\`json
{
  \"outline\": [
    { \"phase_id\": \"P1\", \"title\": \"...\", \"description\": \"...\", \"exit_criteria\": [\"...\"] }
  ],
  \"tasks\": [
    {
      \"id\": \"T1\",
      \"title\": \"...\",
      \"description\": \"...\",
      \"acceptance_criteria\": [\"...\"],
      \"quality_gates\": [\"tests_added_or_updated\", \"tests_run\", \"lint_run\", \"typecheck_run\", \"docs_updated\"],
      \"dependencies\": [\"T0\"],
      \"activity_requests\": [
        { \"type\": \"run_cmd\", \"args\": { \"cmd\": \"...\" } }
      ]
    }
  ],
  \"more_tasks\": true,
  \"completed_task_id\": null,
  \"activities\": [
    { \"type\": \"read_file\", \"args\": { \"path\": \"package.json\" } }
  ]
}
\`\`\`

Begin by analyzing the plan and producing an outline + the first 3–8 tasks for the scaffold phase."

# Write CLAUDE.md context file
cat > CLAUDE.md << EOF
# BernierLLC Package Requirements

${REQUIREMENTS_CONTENT}

---

# Package Specification

${PLAN_CONTENT}

---

# IMPORTANT: Package Name Sanitization

The package name "@test/inspection-package" has been replaced with "[PACKAGE_NAME]" in this context to prevent import errors.
DO NOT try to import or reference the package by name. Work directly in the current directory using relative paths only.
EOF

echo "=========================================="
echo "CLAUDE CLI PROMPT TEST"
echo "=========================================="
echo ""
echo "Working Directory: $TEST_DIR"
echo ""
echo "--- PROMPT (first 500 chars) ---"
echo "${PROMPT:0:500}..."
echo ""
echo "--- Running Claude CLI ---"
echo ""

# Run Claude CLI
claude --model sonnet --permission-mode acceptEdits "$PROMPT" 2>&1 | tee cli-output.json

echo ""
echo "=========================================="
echo "CLI Execution Complete"
echo "=========================================="
echo ""
echo "Full output saved to: $TEST_DIR/cli-output.json"
echo ""
echo "To view the parsed JSON:"
echo "  cat $TEST_DIR/cli-output.json | jq ."

