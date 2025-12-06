# Component Organization Revamp

**Date:** 2025-01-XX  
**Status:** Planning  
**Goal:** Reorganize workflow builder components into a hierarchical, intuitive structure that's easy for humans and AI to navigate

---

## Current State Analysis

### Existing Component Types

#### Core Workflow Types
- `activity` - Temporal activities that perform work
- `agent` - AI agents that make decisions
- `signal` - Signal handlers for workflow communication
- `trigger` - Workflow trigger/start condition
- `query` - Query handler for read-only state inspection
- `scheduled-workflow` - Scheduled (cron) child workflow
- `work-queue` - Work queue for pending items

#### Interface Types
- `data-in` - Interface component for receiving data (creates POST/PATCH endpoints)
- `data-out` - Interface component for providing data (creates GET endpoints)

#### API Gateway Types (Kong)
- `kong-logging` - Logging configuration for API endpoints (project-level)
- `kong-cache` - Kong proxy caching configuration with Redis backend
- `kong-cors` - CORS (Cross-Origin Resource Sharing) configuration

#### Control Flow Types
- `condition` - Branch workflow based on condition (if/else)
- `phase` - Organize workflow into phases (sequential or concurrent)
- `retry` - Retry logic with exponential backoff
- `state-variable` - Manage workflow state variables

#### Workflow Structure Types
- `api-endpoint` - Expose workflow as HTTP API endpoint
- `child-workflow` - Start a child workflow
- `service-container` - Service container node
- `end` - End node

### Existing Activity Components (Examples)
- `fetch-api-data` - Fetches data from external API
- `process-data` - Transforms and processes data
- `send-notification` - Sends notifications (email, Slack, webhook, SMS)
- `save-to-database` - Saves data to database
- `read-from-database` - Reads data from database
- `log-message` - Logs messages with severity levels

### Existing Agent Components (Examples)
- `code-analysis-agent` - Analyzes code for issues
- `test-generation-agent` - Generates unit tests

### Existing Trigger Components (Examples)
- Various trigger types for starting workflows

---

## Proposed Hierarchical Organization

### Category Structure

```
📦 Components
├── 🔵 Core Workflow
│   ├── Start & End
│   │   ├── Trigger (start)
│   │   ├── End (end)
│   │   └── Scheduled Workflow (cron)
│   ├── Execution
│   │   ├── Activity (generic activities)
│   │   ├── Agent (AI agents)
│   │   └── Child Workflow
│   └── State Management
│       ├── State Variable
│       ├── Work Queue
│       ├── Signal
│       └── Query
│
├── 🌐 API & Integration
│   ├── API Endpoints
│   │   ├── API Endpoint (expose workflow as HTTP)
│   │   ├── Data In (POST/PATCH endpoints)
│   │   └── Data Out (GET endpoints)
│   ├── API Gateway (Kong)
│   │   ├── Kong Logging
│   │   ├── Kong Cache
│   │   └── Kong CORS
│   └── External APIs
│       ├── HTTP Request
│       ├── Webhook Receiver
│       └── Third-party Integrations
│
├── 💾 Data & Storage
│   ├── Database
│   │   ├── PostgreSQL Query
│   │   ├── PostgreSQL Write
│   │   ├── Supabase Query
│   │   ├── Supabase Write
│   │   └── Generic Database
│   ├── Cache
│   │   ├── Redis Command
│   │   ├── Upstash Redis
│   │   └── Memory Cache
│   └── File Storage
│       ├── Local File Storage
│       ├── S3 File Storage
│       └── File Operations
│
├── 🔀 Control Flow
│   ├── Branching
│   │   ├── Condition (if/else)
│   │   └── Switch (multiple branches)
│   ├── Loops
│   │   ├── Retry Loop
│   │   ├── For Each
│   │   └── While Loop
│   └── Organization
│       ├── Phase (sequential/concurrent)
│       └── Parallel Execution
│
├── 🤖 AI & Automation
│   ├── AI Agents
│   │   ├── Code Analysis Agent
│   │   ├── Test Generation Agent
│   │   ├── Documentation Agent
│   │   └── Custom Agent
│   └── AI Services
│       ├── Anthropic Claude
│       ├── OpenAI GPT
│       └── AI Model Provider
│
├── 🔧 Development Tools
│   ├── Git Operations
│   │   ├── Git Commit
│   │   ├── Git Push
│   │   ├── Git Branch
│   │   └── Create Pull Request
│   ├── Build & Test
│   │   ├── Run Build
│   │   ├── Run Tests
│   │   └── Quality Checks
│   └── File Operations
│       ├── Create File
│       ├── Update File
│       └── Delete File
│
├── 📧 Communication
│   ├── Notifications
│   │   ├── Send Email
│   │   ├── Send Slack Message
│   │   ├── Send SMS
│   │   └── Send Webhook
│   └── Messaging
│       ├── Queue Message
│       └── Publish Event
│
└── 🔌 Service Integration
    ├── BrainGrid
    │   ├── Create Requirement
    │   ├── List Projects
    │   └── Manage Tasks
    ├── Service Container
    └── External Services
```

---

## Proposed Component Type Renaming

### Current → Proposed Mapping

| Current Type | Proposed Type | Category | Reason |
|-------------|---------------|----------|--------|
| `activity` | `activity` | Core Workflow → Execution | Keep as generic activity type |
| `agent` | `agent` | AI & Automation → AI Agents | Keep as AI agent type |
| `trigger` | `trigger` | Core Workflow → Start & End | Keep as trigger type |
| `signal` | `signal` | Core Workflow → State Management | Keep as signal type |
| `query` | `query` | Core Workflow → State Management | Keep as query type |
| `scheduled-workflow` | `scheduled-workflow` | Core Workflow → Start & End | Keep as scheduled type |
| `work-queue` | `work-queue` | Core Workflow → State Management | Keep as work queue type |
| `data-in` | `api-endpoint-in` | API & Integration → API Endpoints | More descriptive |
| `data-out` | `api-endpoint-out` | API & Integration → API Endpoints | More descriptive |
| `api-endpoint` | `api-endpoint-expose` | API & Integration → API Endpoints | More descriptive |
| `kong-logging` | `api-gateway-logging` | API & Integration → API Gateway | More generic, not Kong-specific |
| `kong-cache` | `api-gateway-cache` | API & Integration → API Gateway | More generic, not Kong-specific |
| `kong-cors` | `api-gateway-cors` | API & Integration → API Gateway | More generic, not Kong-specific |
| `condition` | `control-flow-condition` | Control Flow → Branching | More descriptive |
| `phase` | `control-flow-phase` | Control Flow → Organization | More descriptive |
| `retry` | `control-flow-retry` | Control Flow → Loops | More descriptive |
| `state-variable` | `workflow-state` | Core Workflow → State Management | More descriptive |
| `child-workflow` | `workflow-child` | Core Workflow → Execution | More descriptive |
| `service-container` | `service-container` | Service Integration | Keep as is |

---

## Component Metadata Enhancement

### New Fields to Add

```typescript
interface ComponentMetadata {
  // Existing fields
  component_type_id: string;
  name: string;
  display_name: string;
  description: string;
  
  // New hierarchical fields
  category: string;              // e.g., "api-integration"
  subcategory: string;           // e.g., "api-gateway"
  category_path: string[];      // e.g., ["api-integration", "api-gateway"]
  
  // Enhanced searchability
  keywords: string[];            // Search keywords
  tags: string[];                // Existing tags
  capabilities: string[];       // Existing capabilities
  
  // AI-friendly metadata
  ai_description: string;         // Detailed description for AI understanding
  use_cases: string[];           // Common use cases
  related_components: string[];  // Related component IDs
  
  // Visual metadata
  icon: string;                  // Icon identifier
  icon_provider: string;         // "lucide", "custom", etc.
  color: string;                 // Theme color
  
  // Hierarchical organization
  parent_category?: string;      // Parent category ID
  sort_order: number;            // Display order within category
}
```

---

## Database Schema Changes

### New Tables

```sql
-- Component categories (hierarchical)
CREATE TABLE component_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  icon_provider VARCHAR(50) DEFAULT 'lucide',
  color VARCHAR(50),
  parent_category_id UUID REFERENCES component_categories(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Component to category mapping
CREATE TABLE component_category_mapping (
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES component_categories(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (component_id, category_id)
);

-- Component keywords for search
CREATE TABLE component_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  keyword VARCHAR(100) NOT NULL,
  weight DECIMAL(3,2) DEFAULT 1.0, -- Search relevance weight
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(component_id, keyword)
);

-- Component use cases
CREATE TABLE component_use_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  use_case TEXT NOT NULL,
  example JSONB, -- Example configuration
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration Strategy

1. **Phase 1: Add new tables** (non-breaking)
   - Create `component_categories` table
   - Create mapping and metadata tables
   - Seed initial categories

2. **Phase 2: Migrate existing data**
   - Map existing components to new categories
   - Extract keywords from names, descriptions, tags
   - Generate use cases from existing documentation

3. **Phase 3: Update component types**
   - Rename component types (with backward compatibility)
   - Update UI to use new categories
   - Update search to use keywords

4. **Phase 4: Deprecate old system**
   - Mark old categorization as deprecated
   - Remove old categorization logic

---

## UI/UX Changes

### Component Palette Organization

```typescript
interface CategoryDisplay {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  expanded: boolean;
  subcategories: SubcategoryDisplay[];
  components: ComponentDisplay[];
}

interface SubcategoryDisplay {
  id: string;
  name: string;
  icon?: LucideIcon;
  components: ComponentDisplay[];
}

interface ComponentDisplay {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  type: string;
  category_path: string[];
}
```

### Search Functionality

```typescript
interface ComponentSearch {
  query: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  capabilities?: string[];
  use_case?: string;
}

// Search algorithm:
// 1. Exact name match (weight: 10)
// 2. Keyword match (weight: 5)
// 3. Description match (weight: 3)
// 4. Tag match (weight: 2)
// 5. Capability match (weight: 1)
```

---

## AI Searchability Enhancements

### Semantic Search Fields

```typescript
interface AISearchMetadata {
  // Natural language descriptions
  natural_language_description: string;
  // Example: "Use this component to fetch data from an external HTTP API endpoint"
  
  // Intent-based categorization
  primary_intent: string;
  // Example: "fetch-external-data"
  
  secondary_intents: string[];
  // Example: ["http-request", "api-call", "data-retrieval"]
  
  // Context clues
  typical_context: string[];
  // Example: ["after receiving webhook", "before processing data"]
  
  // Input/output patterns
  input_pattern: string;
  // Example: "Requires URL, HTTP method, optional headers and body"
  
  output_pattern: string;
  // Example: "Returns response data, status code, and headers"
}
```

### Vector Embeddings (Future)

For advanced AI search, consider storing vector embeddings:

```sql
ALTER TABLE components 
  ADD COLUMN embedding vector(1536); -- OpenAI embedding dimension

CREATE INDEX idx_components_embedding 
  ON components USING ivfflat (embedding vector_cosine_ops);
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Create database schema for categories
- [ ] Seed initial category hierarchy
- [ ] Create migration scripts
- [ ] Add category fields to component types

### Phase 2: Data Migration (Week 2)
- [ ] Map existing components to categories
- [ ] Extract and populate keywords
- [ ] Generate use cases from existing docs
- [ ] Update component metadata

### Phase 3: UI Updates (Week 3)
- [ ] Update NodeTypesPalette to use categories
- [ ] Implement hierarchical display
- [ ] Add category filtering
- [ ] Update search functionality

### Phase 4: Component Type Renaming (Week 4)
- [ ] Create migration for type renaming
- [ ] Update all references to old types
- [ ] Add backward compatibility layer
- [ ] Update documentation

### Phase 5: AI Search (Week 5)
- [ ] Add semantic search fields
- [ ] Implement keyword-based search
- [ ] Add use case matching
- [ ] Test AI search accuracy

### Phase 6: Testing & Refinement (Week 6)
- [ ] User testing
- [ ] AI search testing
- [ ] Performance optimization
- [ ] Documentation updates

---

## Example: Reorganized Component Display

### Before (Current)
```
Components
├── Activities (6)
├── Agents (2)
├── Triggers (3)
├── Data In
├── Data Out
├── Control Flow
├── Kong Logging
├── Kong Cache
├── Kong CORS
```

### After (Proposed)
```
Components
├── 🔵 Core Workflow
│   ├── Start & End
│   │   ├── Trigger (3)
│   │   └── Scheduled Workflow
│   ├── Execution
│   │   ├── Activity (6)
│   │   ├── Agent (2)
│   │   └── Child Workflow
│   └── State Management
│       ├── State Variable
│       ├── Work Queue
│       ├── Signal
│       └── Query
│
├── 🌐 API & Integration
│   ├── API Endpoints
│   │   ├── API Endpoint (expose)
│   │   ├── Data In (POST/PATCH)
│   │   └── Data Out (GET)
│   └── API Gateway
│       ├── Logging
│       ├── Cache
│       └── CORS
│
├── 💾 Data & Storage
│   ├── Database
│   │   ├── Save to Database
│   │   └── Read from Database
│   └── Cache
│       └── (Future: Redis, etc.)
│
├── 🔀 Control Flow
│   ├── Branching
│   │   └── Condition
│   ├── Loops
│   │   └── Retry
│   └── Organization
│       └── Phase
│
├── 🤖 AI & Automation
│   └── AI Agents
│       ├── Code Analysis Agent
│       └── Test Generation Agent
│
└── 📧 Communication
    └── Notifications
        └── Send Notification
```

---

## Benefits

1. **Human Intuitive**: Logical grouping by function/purpose
2. **AI Searchable**: Rich metadata, keywords, use cases
3. **Scalable**: Hierarchical structure supports growth
4. **Discoverable**: Related components grouped together
5. **Maintainable**: Clear organization for developers

---

## Migration Considerations

1. **Backward Compatibility**: Keep old type names working during transition
2. **Data Integrity**: Ensure all components have categories
3. **Performance**: Index categories and keywords for fast search
4. **User Experience**: Smooth transition with clear migration path

---

## Next Steps

1. Review and approve this organization structure
2. Create detailed database migration scripts
3. Design UI mockups for hierarchical display
4. Implement Phase 1 (Foundation)
5. Test with real components and workflows

