# Demo Workflows Setup

This document describes the demo workflows available in the workflow builder and how to set them up.

## Available Demo Workflows

### 1. Hello World Demo (`hello-world-demo`)

A simple greeting workflow demonstrating the basic agent coordinator system.

**What it does:**
- Starts the workflow
- Sends a greeting request to a MockAgent
- Agent responds with "Hello"
- Workflow completes

**Use case:** Perfect for understanding the basics of workflow execution and agent coordination.

### 2. Agent Conversation Demo (`agent-conversation-demo`)

Two agents (Alice and Bob) having a conversation about their favorite programming languages.

**What it does:**
- Alice initiates: "Hi Bob! I'm curious - what's your favorite programming language and why?"
- Bob responds: "Hey Alice! I love TypeScript because of its type safety and excellent tooling. What about you?"
- Alice replies: "Great choice! I'm a fan of Python for its simplicity and amazing data science ecosystem."
- Bob concludes: "I have! Python is fantastic for data science and scripting. Nice chatting with you!"
- Workflow completes

**Use case:** Demonstrates multi-step coordination between multiple agents.

## Quick Setup

### Automated Setup (Recommended)

Run the setup script to create a test user and seed both demo workflows:

```bash
cd packages/workflow-builder
tsx scripts/create-test-user-and-seed.ts
```

This will:
1. Create a test user (`test@example.com / testpassword123`)
2. Create a "Demo Workflows" project
3. Add both demo workflows to the project
4. Set them as "active" and "public" (visible to all users)

### Manual Setup

If you prefer to set things up manually or add the workflows to an existing user:

1. Start the app and create a user:
   ```bash
   yarn dev
   # Visit http://localhost:3010 and sign up
   ```

2. Run the seed script:
   ```bash
   tsx scripts/seed-demo-workflows.ts
   ```

## Viewing the Workflows

1. Start the workflow builder:
   ```bash
   yarn dev
   ```

2. Open your browser to http://localhost:3010

3. Login with:
   - Email: `test@example.com`
   - Password: `testpassword123`

4. You should see both demo workflows in the workflow list

## Implementation Details

The demo workflows are created from the command-line examples in `/examples`:
- `examples/demo-hello-world.ts` → Hello World Demo
- `examples/demo-conversation-temporal.ts` → Agent Conversation Demo

They work identically to the command-line versions but are:
- Stored in the database
- Visible in the workflow builder UI
- Executable through the web interface
- Public (visible to all users)

## Workflow Definitions

Both workflows use the React Flow format with nodes and edges:

- **Nodes**: Represent workflow steps (trigger, agent, end)
- **Edges**: Define the flow between steps
- **Data**: Contains configuration for each step

Example structure:
```json
{
  "nodes": [
    { "id": "start-1", "type": "trigger", "position": {...}, "data": {...} },
    { "id": "agent-1", "type": "agent", "position": {...}, "data": {...} },
    { "id": "end-1", "type": "end", "position": {...}, "data": {...} }
  ],
  "edges": [
    { "id": "e1", "source": "start-1", "target": "agent-1" },
    { "id": "e2", "source": "agent-1", "target": "end-1" }
  ]
}
```

## Troubleshooting

### No workflows appear after setup

1. Check that you're logged in with the correct user
2. Verify workflows were created:
   ```bash
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -c "SELECT display_name, kebab_name, status_id FROM workflows;"
   ```

### "Failed to create user record" error

The database triggers require migrations to be up to date:
```bash
supabase db reset
tsx scripts/create-test-user-and-seed.ts
```

### Workflows exist but can't see them

Check the workflow visibility:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT w.display_name, v.name as visibility 
      FROM workflows w 
      JOIN component_visibility v ON w.visibility_id = v.id;"
```

They should be marked as "public".

## Scripts Reference

- **`scripts/create-test-user-and-seed.ts`**: Complete setup (user + workflows)
- **`scripts/seed-demo-workflows.ts`**: Seed workflows only (requires existing user)
- **`scripts/test-signup.ts`**: Test user creation and diagnose issues
- **`seed-demo-workflows.sh`**: Bash script for seeding (legacy, use TS version)

## Database Tables

Demo workflows are stored in:
- **`projects`**: Demo Workflows project
- **`workflows`**: Both workflow definitions
- **`users`**: Test user account

They can be queried and modified through the Supabase client or directly via SQL.

