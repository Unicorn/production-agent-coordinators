# Agent Testing

Interactive testing of agent prompts using Temporal workflows with human-in-the-loop interaction.

## Overview

The Agent Tester allows you to have real-time conversations with your agent prompts before using them in production workflows. It uses a Temporal workflow to maintain conversation state and handle the interaction.

## How It Works

1. **Workflow-Based**: Each test session runs as a Temporal workflow
2. **Durable State**: Conversation history is maintained in workflow state
3. **Signals & Queries**: UI sends messages via signals, queries workflow for state
4. **Auto-Timeout**: Sessions end after 5 minutes of inactivity

## Starting a Test

1. Navigate to an agent prompt's detail page
2. Click **Test Agent** button
3. A modal will open with the test interface
4. Optionally enter an initial message
5. Click **Start Test**

The workflow will:
- Load your agent prompt
- Initialize the conversation
- Wait for your messages

## Using the Test Interface

### Sending Messages

1. Type your message in the input field
2. Click **Send** or press Enter
3. The message is sent to the workflow via signal
4. The workflow calls the agent API with your prompt
5. The response appears in the chat

### Viewing Conversation

- Messages appear in chronological order
- Your messages are on the right (blue)
- Agent responses are on the left (gray)
- The conversation scrolls automatically

### Ending a Test

- Click **End Test** to stop the workflow
- Or close the modal (will warn if test is active)
- The workflow will save the conversation and terminate

## Test Session Lifecycle

1. **Start**: Workflow created, session record in database
2. **Active**: Receiving messages, calling agent API
3. **End**: User ends or timeout (5 min inactivity)
4. **Complete**: Conversation saved, workflow terminated

## Technical Details

### Workflow Architecture

The agent tester workflow:
- Maintains conversation array in workflow state
- Uses signals to receive user messages
- Uses queries to expose conversation state
- Calls agent activities with conversation history
- Handles timeouts and errors gracefully

### Token Efficiency

The workflow is token-efficient:
- Only sends recent messages (last 20) to agent API
- Older context is truncated automatically
- Full conversation history maintained in workflow state

### Session Management

- One active test per agent per user
- Sessions tracked in `agent_test_sessions` table
- Conversation history stored as JSONB
- Status: active, completed, cancelled, timeout

## Best Practices

### Testing Different Scenarios

- Test with various input types
- Try edge cases and error conditions
- Test conversation flow and context retention
- Verify output format matches expectations

### Iterating on Prompts

1. Test your prompt
2. Identify issues or improvements
3. Edit the prompt
4. Test again to verify changes

### Performance Testing

- Test with long conversations
- Verify token efficiency
- Check response times
- Monitor for timeouts

## Troubleshooting

### Test Won't Start

- Check that system workflows are set up (see [System Workflows Setup](../system-workflows-setup.md))
- Verify Temporal server is running
- Check browser console for errors

### Messages Not Appearing

- Wait a few seconds (polling every 2 seconds)
- Check that workflow is still active
- Refresh the page if needed

### Workflow Timeout

- Sessions auto-end after 5 minutes of inactivity
- Start a new test if needed
- Consider breaking long tests into multiple sessions

## Related Documentation

- [Agent Prompts](agent-prompts.md) - Creating agent prompts
- [System Workflows Setup](../system-workflows-setup.md) - System workflow configuration
- [Temporal Integration](../architecture/temporal-integration.md) - How workflows execute
- [API Reference](../api/trpc-routers.md#agent-tester-router-agenttester) - Agent tester API

