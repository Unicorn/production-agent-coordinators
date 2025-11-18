# Agent Prompts

Agent prompts define the behavior of AI-powered agent components.

## Overview

Agent prompts are markdown templates that guide AI agents in making decisions or performing tasks. They can be used by agent components in workflows.

You can create agent prompts in two ways:
- **Manual Creation**: Write the prompt yourself in markdown
- **AI-Assisted Creation**: Use an AI assistant to help you create the prompt through conversation

## Creating an Agent Prompt

### Manual Creation

1. Navigate to **Agents** in the sidebar
2. Click **Create Manually** (or **New Agent Prompt** → **Create Manually**)
3. Fill in:
   - **Name**: Prompt identifier (kebab-case, e.g., `code-review-agent`)
   - **Display Name**: User-friendly name (e.g., `Code Review Agent`)
   - **Description**: What the prompt does
   - **Version**: Version number (semver format, e.g., `1.0.0`)
   - **Prompt Content**: Markdown prompt template
   - **Visibility**: Public, Private, or Organization
   - **Capabilities**: Comma-separated capabilities
   - **Tags**: Optional tags for categorization
4. Click **Create Agent Prompt**

### AI-Assisted Creation

1. Navigate to **Agents** in the sidebar
2. Click **Build with AI** (or **New Agent Prompt** → **Build with AI Assistant**)
3. Start a conversation with the AI assistant:
   - Describe what you want your agent to do
   - Answer follow-up questions
   - The AI will ask 3-5 clarifying questions
4. Review the generated prompt:
   - The AI will generate a complete markdown prompt
   - You can request changes if needed
5. Save the prompt:
   - Fill in Name and Display Name
   - Click **Save Prompt**

The AI assistant helps you create well-structured prompts by asking about:
- Agent purpose and goals
- Specific capabilities needed
- Output format requirements
- Context and constraints

## Prompt Content

Write prompts in markdown:

```markdown
# Task: Analyze Content

You are an expert content analyzer. Your task is to:

1. Read the provided content
2. Identify key themes
3. Extract important information
4. Provide a summary

## Input
{{content}}

## Output Format
- Summary: Brief overview
- Themes: List of main themes
- Key Points: Important information
```

## Prompt Variables

Use variables in prompts that get replaced at runtime:

```markdown
Analyze the following {{contentType}}:

{{content}}

Provide analysis in {{outputFormat}} format.
```

Variables are defined in the component configuration.

## Using Prompts in Components

1. Create an agent component
2. Select an agent prompt from the dropdown
3. Configure prompt variables
4. Set model provider and model name (if needed)

## Best Practices

### Clear Instructions
- Be specific about what the agent should do
- Provide examples when helpful
- Define output format clearly

### Context
- Provide relevant context
- Include background information
- Specify constraints or requirements

### Output Format
- Define expected output structure
- Use markdown formatting
- Include examples of desired output

## Testing Agent Prompts

You can test your agent prompts before using them in workflows:

1. Navigate to an agent prompt's detail page
2. Click **Test Agent**
3. A modal will open with a chat interface
4. Start a conversation with your agent:
   - Type a message and click **Send**
   - The agent will respond based on your prompt
   - Continue the conversation to test behavior
5. End the test when done:
   - Click **End Test** to close the session
   - Or close the modal (will warn if test is active)

The test uses a Temporal workflow that:
- Maintains conversation state
- Calls the agent API with your prompt
- Handles timeouts (5 minutes of inactivity)
- Saves conversation history

**Note**: Test sessions are temporary and don't affect your agent prompt. They're useful for validating prompt behavior before deploying to production workflows.

## Related Documentation

- [Components](components.md) - Creating agent components
- [Building Workflows](building-workflows.md) - Using agents in workflows
- [System Workflows](../system-workflows-setup.md) - Understanding system workflows like the agent tester

