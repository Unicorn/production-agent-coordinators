# @bernierllc/braingrid-cli-wrapper

Type-safe wrapper for the BrainGrid CLI.

## Installation

```bash
npm install @bernierllc/braingrid-cli-wrapper
```

## Usage

```typescript
import { createIdea, listProjects } from '@bernierllc/braingrid-cli-wrapper';

// Create a new requirement
const req = await createIdea('Add OAuth2 authentication', 'proj-123');
console.log(`Created requirement ${req.id}`);

// List projects
const projects = await listProjects();
console.log(`Found ${projects.length} projects`);
```

## API

See TypeScript definitions for complete API documentation.
