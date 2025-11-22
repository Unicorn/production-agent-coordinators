# Phase 2: Slack Integration - Testing Guide

## Prerequisites

1. **Slack Workspace** with admin access
2. **Slack App** configured with required permissions
3. **Temporal** running (`docker-compose up -d` in `docker/`)
4. **Environment variables** configured

## Slack App Setup

### Required OAuth Scopes

**Bot Token Scopes:**
- `chat:write` - Send messages
- `commands` - Handle slash commands
- `im:history` - Read DM history
- `channels:history` - Read channel messages
- `app_mentions:read` - Respond to mentions

### Slash Commands

Create `/dev-workflow` command:
- **Command:** `/dev-workflow`
- **Request URL:** `https://your-domain.com/slack/commands` (or use Socket Mode)
- **Short Description:** Start a development workflow
- **Usage Hint:** `[feature description]`

### Event Subscriptions (if using HTTP mode)

Subscribe to:
- `message.channels`
- `message.im`

### Socket Mode (Recommended for development)

Enable Socket Mode in Slack App settings and generate App-Level Token with `connections:write` scope.

## Environment Setup

```bash
# Copy example env
cp .env.example .env

# Edit .env and add your Slack credentials
SLACK_BOT_TOKEN=xoxb-your-actual-token
SLACK_SIGNING_SECRET=your-actual-secret
SLACK_APP_TOKEN=xapp-your-actual-token  # If using Socket Mode
SLACK_SOCKET_MODE=true
```

## Running the Tests

### 1. Start Infrastructure

```bash
# Start Temporal (from docker/ directory)
cd docker
docker-compose up -d

# Verify Temporal is running
docker-compose ps
```

### 2. Start Development Worker

```bash
cd packages/dev-workflow
npm run worker:dev
```

### 3. Start Slack Bot

```bash
# In another terminal
cd packages/dev-workflow
npm run start:slack
```

### 4. Test in Slack

#### Test 1: Basic Slash Command

In any Slack channel or DM:

```
/dev-workflow Add user authentication with OAuth2
```

**Expected:**
1. Immediate response: "🚀 Starting development workflow..."
2. Bot starts asking clarifying questions in thread
3. Questions appear one at a time
4. You can respond with natural language

#### Test 2: Conversational Q&A

After triggering command:

1. **Bot:** "What is the main goal of this feature?"
2. **You:** "Allow users to sign in with Google and GitHub"
3. **Bot:** "Who are the primary users?"
4. **You:** "Web application users who want secure authentication"
5. **Bot:** "Are there any specific technical constraints or dependencies?"
6. **You:** "Must work with our existing user database"

**Expected:**
- Bot waits for each response before asking next question
- Conversation flows naturally
- 5-minute timeout if no response

#### Test 3: Plan Approval

After Q&A:

**Expected:**
1. Bot presents summary of requirements
2. Shows what it understood
3. Asks for approval: "Reply 'approve' to continue"
4. You reply: "approve"
5. Bot confirms: "Perfect! I'll get started..."

#### Test 4: Progress Updates

After approval:

**Expected:**
1. ✅ "Created requirement req-123"
2. ⚙️ "Task Claimed: Working on Setup and configuration"
3. ✅ "Task Completed: Finished Setup and configuration"
4. Progress updates appear automatically as work progresses

#### Test 5: Stop/Pause Controls

During progress updates:

**Expected:**
1. Message includes ⏸️ Pause and ⏹️ Stop buttons
2. Click "Pause" → Workflow pauses, message updates
3. Or click "Stop" → Confirmation dialog → Workflow stops

## Verification Checklist

- [ ] Slash command triggers workflow
- [ ] Bot asks clarifying questions in thread
- [ ] Bot waits for user responses (via signals)
- [ ] Timeout works (5 min per question)
- [ ] Plan summary presented for approval
- [ ] Progress updates appear automatically
- [ ] Stop/Pause buttons work
- [ ] Temporal UI shows workflow execution
- [ ] BrainGrid tasks created successfully

## Troubleshooting

### "Bot not responding"

1. Check Slack bot server logs
2. Verify `SLACK_BOT_TOKEN` is correct
3. Check Socket Mode is enabled if using it
4. Verify bot is invited to channel

### "Workflow not starting"

1. Check Temporal is running: `docker-compose ps`
2. Verify dev worker is running: `npm run worker:dev`
3. Check Temporal UI: `http://localhost:8080`

### "Questions not appearing"

1. Check workflow logs in Temporal UI
2. Verify Slack activities are registered
3. Check signal handlers are set up

### "Signals not working"

1. Verify workflow ID matches between bot and Temporal
2. Check Connection to Temporal is successful
3. Verify signal names match exactly

## Next Steps (Phase 3)

- Real agent execution (replace simulated work)
- AI-powered task breakdown
- Code generation and testing
- Git integration

## Reference

- Slack App Manifest: `packages/dev-workflow/slack-app-manifest.yml`
- Architecture: `docs/plans/2025-11-21-dev-workflow-temporal-architecture.md`
