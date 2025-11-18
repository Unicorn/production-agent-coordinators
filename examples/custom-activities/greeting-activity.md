# Custom Activity Example: Greeting Activity

This example shows how to create a simple custom activity that greets a user.

## Activity Code

```typescript
/**
 * Simple greeting activity that creates a personalized greeting message
 */
export async function greetUser(input: {
  name: string;
  language?: 'en' | 'es' | 'fr';
}) {
  const { name, language = 'en' } = input;
  
  // Greeting templates
  const greetings: Record<string, string> = {
    en: `Hello, ${name}! Welcome to the workflow builder.`,
    es: `¡Hola, ${name}! Bienvenido al creador de flujos de trabajo.`,
    fr: `Bonjour, ${name}! Bienvenue dans le créateur de workflow.`,
  };
  
  const greeting = greetings[language] || greetings.en;
  
  return {
    greeting,
    timestamp: new Date().toISOString(),
    language,
  };
}
```

## How to Create

1. Navigate to **Components** → **New Component**
2. Fill in the details:
   - **Name**: `greetUser`
   - **Display Name**: `Greet User`
   - **Description**: `Creates a personalized greeting message`
   - **Component Type**: `activity`
   - **Version**: `1.0.0`
   - **Visibility**: `private` (or `public` to share)
3. Toggle **Custom Activity** on
4. Paste the code above into the editor
5. Click **Validate TypeScript** to ensure it's valid
6. Click **Create Component**

## Input Schema (Optional)

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "User's name"
    },
    "language": {
      "type": "string",
      "enum": ["en", "es", "fr"],
      "default": "en",
      "description": "Greeting language"
    }
  },
  "required": ["name"]
}
```

## Output Schema (Optional)

```json
{
  "type": "object",
  "properties": {
    "greeting": {
      "type": "string",
      "description": "The personalized greeting message"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "When the greeting was created"
    },
    "language": {
      "type": "string",
      "description": "Language used for the greeting"
    }
  }
}
```

## Using in a Workflow

1. Create a new workflow
2. Find "Greet User" in the Activities palette
3. Drag it onto the canvas
4. Configure inputs:
   - Map `name` from a trigger input or previous step
   - Set `language` to your preferred language
5. Connect to next steps that use the greeting

## Example Workflow

```
Start
  ↓
[Trigger: Manual] → { userName: "Alice" }
  ↓
[Activity: Greet User]
  input: { name: trigger.userName, language: "en" }
  ↓
[Activity: Send Email]
  input: { 
    to: trigger.userEmail,
    subject: "Welcome",
    body: greetUser.greeting
  }
  ↓
End
```

## Output Example

```json
{
  "greeting": "Hello, Alice! Welcome to the workflow builder.",
  "timestamp": "2025-11-17T10:30:00.000Z",
  "language": "en"
}
```

