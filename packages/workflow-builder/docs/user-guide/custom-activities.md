# Custom Activities

Custom activities allow you to write your own TypeScript code that runs as part of your workflows. This is useful when you need functionality that isn't available in the built-in components.

## Creating a Custom Activity

1. Navigate to **Components** in the sidebar
2. Click **New Component**
3. Select **Activity** as the component type
4. Toggle on **Custom Activity (Write Your Own Code)**
5. Write your TypeScript activity code in the code editor
6. Click **Validate TypeScript** to ensure your code is valid
7. Fill in the other required fields (Name, Display Name, etc.)
8. Click **Create Component**

## Writing Activity Code

### Basic Structure

Your custom activity must:
- Export an async function
- Accept an input parameter (can be typed)
- Return a value (can be typed)

### Example: Simple Activity

```typescript
export async function greetUser(input: { name: string }) {
  return {
    greeting: `Hello, ${input.name}!`,
    timestamp: new Date().toISOString(),
  };
}
```

### Example: Activity with External API Call

```typescript
export async function fetchUserData(input: { userId: string }) {
  const response = await fetch(`https://api.example.com/users/${input.userId}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }
  
  const userData = await response.json();
  
  return {
    user: userData,
    fetchedAt: new Date().toISOString(),
  };
}
```

### Example: Activity with Multiple Operations

```typescript
export async function processOrder(input: {
  orderId: string;
  customerId: string;
  items: Array<{ id: string; quantity: number }>;
}) {
  // Calculate total
  let total = 0;
  for (const item of input.items) {
    // In a real scenario, you'd fetch prices from a database
    const price = await getItemPrice(item.id);
    total += price * item.quantity;
  }
  
  // Create order record
  const order = {
    id: input.orderId,
    customerId: input.customerId,
    items: input.items,
    total,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  // Save to database (example)
  await saveOrder(order);
  
  return {
    success: true,
    order,
  };
}

async function getItemPrice(itemId: string): Promise<number> {
  // Implementation
  return 10.00;
}

async function saveOrder(order: any): Promise<void> {
  // Implementation
}
```

## TypeScript Validation

The code editor validates your TypeScript code in **strict mode** to ensure:

- No syntax errors
- Type safety
- Proper async/await usage
- Export statements are present

### Validation Errors

If your code has errors, they will be displayed below the editor with:
- Line and column number
- Error message
- Error code

**You must fix all errors before saving the component.**

### Validation Warnings

Warnings won't prevent you from saving, but you should address them:
- Unused variables
- Type inference issues
- Best practice violations

## Using Custom Activities in Workflows

Once created, your custom activity appears in the component palette just like built-in activities:

1. Open your workflow in the visual editor
2. Find your custom activity in the **Activities** section
3. Drag it onto the canvas
4. Configure its inputs (map data from previous steps)
5. Connect it to other workflow steps

## Input and Output Schemas

While optional, defining input and output schemas helps:

- Document what data your activity expects
- Validate inputs at runtime
- Enable better autocomplete in the workflow builder
- Help other users understand your activity

Example schemas:

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "User's name"
    }
  },
  "required": ["name"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "greeting": {
      "type": "string"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

## Best Practices

### Error Handling

Always handle errors gracefully:

```typescript
export async function robustActivity(input: { url: string }) {
  try {
    const response = await fetch(input.url);
    return { success: true, data: await response.json() };
  } catch (error) {
    // Log error for debugging
    console.error('Activity failed:', error);
    
    // Return error information
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

### Timeouts

For long-running operations, consider timeouts:

```typescript
export async function activityWithTimeout(input: { url: string }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(input.url, { signal: controller.signal });
    return { success: true, data: await response.json() };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Activity timed out after 30 seconds');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Logging

Use console.log for debugging (visible in worker logs):

```typescript
export async function loggingActivity(input: { data: any }) {
  console.log('Activity started with input:', input);
  
  const result = await processData(input.data);
  
  console.log('Activity completed with result:', result);
  
  return result;
}
```

### Type Safety

Use TypeScript types for better safety:

```typescript
interface ProcessInput {
  userId: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, any>;
}

interface ProcessOutput {
  success: boolean;
  userId: string;
  timestamp: string;
  result?: any;
  error?: string;
}

export async function typedActivity(input: ProcessInput): Promise<ProcessOutput> {
  // Implementation with type safety
  return {
    success: true,
    userId: input.userId,
    timestamp: new Date().toISOString(),
  };
}
```

## Limitations

- **No external packages**: You can't import npm packages (yet). Use only built-in Node.js APIs and fetch.
- **Execution context**: Activities run in the Temporal worker process, not in isolation.
- **Resource limits**: Be mindful of memory and CPU usage.
- **Security**: Don't hardcode secrets; use environment variables or Temporal secrets.

## Security Considerations

### Input Validation

Always validate inputs:

```typescript
export async function secureActivity(input: { email: string }) {
  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error('Invalid email format');
  }
  
  // Proceed with validated input
  return { valid: true };
}
```

### Sanitization

Sanitize data before using in queries or external calls:

```typescript
export async function sanitizedActivity(input: { query: string }) {
  // Remove potentially harmful characters
  const sanitized = input.query.replace(/[^\w\s-]/gi, '');
  
  // Use sanitized data
  return { sanitized };
}
```

## Troubleshooting

### Activity Not Appearing in Palette

- Ensure component is saved successfully
- Check that component type is "activity"
- Verify component is set to active

### Activity Fails at Runtime

- Check worker logs for error messages
- Verify TypeScript code is valid
- Ensure all required inputs are provided
- Check for runtime errors (null references, etc.)

### Validation Errors

- Read error messages carefully
- Check line numbers indicated
- Ensure all functions are async
- Verify export statements exist

## Examples

See the [examples](../../../examples/) directory for more custom activity examples.

