# Agent Prompts

Agent prompts define the behavior of AI-powered agent components.

## Overview

Agent prompts are markdown templates that guide AI agents in making decisions or performing tasks. They can be used by agent components in workflows.

## Creating an Agent Prompt

1. Navigate to **Agents** in the sidebar
2. Click **New Agent Prompt**
3. Fill in:
   - **Name**: Prompt identifier (camelCase)
   - **Display Name**: User-friendly name
   - **Description**: What the prompt does
   - **Version**: Version number
   - **Prompt Content**: Markdown prompt template
   - **Capabilities**: Comma-separated capabilities
   - **Tags**: Optional tags
4. Click **Create Agent Prompt**

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

## Related Documentation

- [Components](components.md) - Creating agent components
- [Building Workflows](building-workflows.md) - Using agents in workflows

