# Custom Activity Example: Data Processor

This example shows a more complex custom activity that processes and transforms data.

## Activity Code

```typescript
/**
 * Data processor activity that filters, transforms, and aggregates data
 */
export async function processData(input: {
  data: Array<{ id: string; value: number; category: string }>;
  operation: 'sum' | 'average' | 'max' | 'min' | 'count';
  filterCategory?: string;
}) {
  const { data, operation, filterCategory } = input;
  
  // Validate input
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Data must be a non-empty array');
  }
  
  // Filter by category if specified
  let processedData = data;
  if (filterCategory) {
    processedData = data.filter(item => item.category === filterCategory);
  }
  
  // Perform operation
  let result: number;
  switch (operation) {
    case 'sum':
      result = processedData.reduce((sum, item) => sum + item.value, 0);
      break;
    
    case 'average':
      const sum = processedData.reduce((acc, item) => acc + item.value, 0);
      result = sum / processedData.length;
      break;
    
    case 'max':
      result = Math.max(...processedData.map(item => item.value));
      break;
    
    case 'min':
      result = Math.min(...processedData.map(item => item.value));
      break;
    
    case 'count':
      result = processedData.length;
      break;
    
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
  
  // Group by category for summary
  const summary: Record<string, number> = {};
  for (const item of processedData) {
    summary[item.category] = (summary[item.category] || 0) + 1;
  }
  
  return {
    result,
    operation,
    itemsProcessed: processedData.length,
    totalItems: data.length,
    filterApplied: !!filterCategory,
    categorySummary: summary,
    timestamp: new Date().toISOString(),
  };
}
```

## How to Create

1. Navigate to **Components** → **New Component**
2. Fill in the details:
   - **Name**: `processData`
   - **Display Name**: `Process Data`
   - **Description**: `Filters, transforms, and aggregates data`
   - **Component Type**: `activity`
   - **Tags**: `data, processing, analytics`
3. Toggle **Custom Activity** on
4. Paste the code above
5. Validate and create

## Input Schema

```json
{
  "type": "object",
  "properties": {
    "data": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "value": { "type": "number" },
          "category": { "type": "string" }
        },
        "required": ["id", "value", "category"]
      },
      "description": "Array of data items to process"
    },
    "operation": {
      "type": "string",
      "enum": ["sum", "average", "max", "min", "count"],
      "description": "Operation to perform on the data"
    },
    "filterCategory": {
      "type": "string",
      "description": "Optional category to filter by"
    }
  },
  "required": ["data", "operation"]
}
```

## Output Schema

```json
{
  "type": "object",
  "properties": {
    "result": {
      "type": "number",
      "description": "Result of the operation"
    },
    "operation": {
      "type": "string",
      "description": "Operation that was performed"
    },
    "itemsProcessed": {
      "type": "number",
      "description": "Number of items processed"
    },
    "totalItems": {
      "type": "number",
      "description": "Total items in input"
    },
    "filterApplied": {
      "type": "boolean",
      "description": "Whether a filter was applied"
    },
    "categorySummary": {
      "type": "object",
      "description": "Count of items per category"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  }
}
```

## Example Usage

### Input
```json
{
  "data": [
    { "id": "1", "value": 100, "category": "sales" },
    { "id": "2", "value": 150, "category": "sales" },
    { "id": "3", "value": 200, "category": "marketing" },
    { "id": "4", "value": 75, "category": "sales" },
    { "id": "5", "value": 300, "category": "marketing" }
  ],
  "operation": "sum",
  "filterCategory": "sales"
}
```

### Output
```json
{
  "result": 325,
  "operation": "sum",
  "itemsProcessed": 3,
  "totalItems": 5,
  "filterApplied": true,
  "categorySummary": {
    "sales": 3
  },
  "timestamp": "2025-11-17T10:30:00.000Z"
}
```

## Use Cases

- **Sales Analytics**: Calculate total sales, average order value, etc.
- **Data Validation**: Count items meeting certain criteria
- **Report Generation**: Aggregate data for reports
- **Dashboard Metrics**: Calculate KPIs from raw data
- **Data Transformation**: Filter and transform data for downstream processes

