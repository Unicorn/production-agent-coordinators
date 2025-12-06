# @bernierllc Package Components Plan

**Date:** 2025-01-20  
**Status:** Planning  
**Related:** [Component Planning Guide](../../../docs/standards/component-planning-guide.md), [Overview](./00-overview.md)

---

## Overview

This plan covers creating workflow components from existing @bernierllc npm packages. Each package is analyzed for component potential based on the Component Planning Guide.

---

## Package Analysis

### High Priority Components

#### 1. @bernierllc/supabase-client

**Component Potential**: ✅ High  
**Component Type**: `activity` or `data-in`/`data-out`  
**Category**: `core-actions` or `connect-services`

**Analysis**:
- Already identified for Supabase Postgres connector (see [Storage Connectors Plan](./01-storage-connectors.md))
- Should be leveraged in Supabase Postgres component
- May also provide Supabase Storage API, Auth API, Realtime API components

**Implementation Checklist**:
- [ ] Review `@bernierllc/supabase-client` package structure and capabilities
- [ ] Identify which Supabase APIs are exposed (Postgres, Storage, Auth, Realtime)
- [ ] Create components for each Supabase API:
  - [ ] Supabase Postgres Query (see storage connectors plan)
  - [ ] Supabase Storage (file upload/download)
  - [ ] Supabase Auth (user management)
  - [ ] Supabase Realtime (subscribe to changes)
- [ ] Create connector type for Supabase
- [ ] Document Supabase component usage

---

#### 2. @bernierllc/anthropic-client

**Component Potential**: ✅ Medium-High  
**Component Type**: `agent`  
**Category**: `ai-automation`

**Analysis**:
- Anthropic/Claude AI integration is valuable for AI workflows
- May already exist as agent component, but could enhance
- Provides structured AI client interface

**Component Classification**:
- **Name**: `anthropic-agent` or `claude-agent`
- **Display Name**: "Claude AI Agent"
- **Purpose**: AI-powered decision making and content generation

**NPM Package**: Use existing `@bernierllc/anthropic-client`

**Implementation Checklist**:
- [ ] Review `@bernierllc/anthropic-client` package API
- [ ] Check if Anthropic agent component already exists
- [ ] If not, create agent component using `@bernierllc/anthropic-client`
- [ ] Create connector type for Anthropic API keys
- [ ] Create component definition in database
- [ ] Create UI component for property panel
- [ ] Add tests for Anthropic agent
- [ ] Document Anthropic agent usage


---

#### 3. @bernierllc/email-tracking

**Component Potential**: ✅ Medium  
**Component Type**: `activity` or `signal`  
**Category**: `core-actions` or `receive-data`

**Analysis**:
- Email tracking (opens, clicks) can be useful for workflows
- May be better as a signal/trigger component for receiving tracking events
- Could also be activity for querying tracking data

**Component Classification**:
- **Option 1**: `email-tracking-query` (activity) - Query email tracking data
- **Option 2**: `email-tracking-webhook` (trigger/signal) - Receive tracking events

**Implementation Checklist**:
- [ ] Review `@bernierllc/email-tracking` package API
- [ ] Determine if query or webhook component is more valuable
- [ ] Create appropriate component type
- [ ] Create component definition in database
- [ ] Create UI component for property panel
- [ ] Add tests for email tracking
- [ ] Document email tracking component usage

---

#### 4. @bernierllc/task-queue

**Component Potential**: ✅ Medium  
**Component Type**: `activity` or `data-in`/`data-out`  
**Category**: `connect-services`

**Analysis**:
- Task queue integration could be valuable for workflow orchestration
- May overlap with Temporal task queue concepts
- Could be used for external task queue integration

**Implementation Checklist**:
- [ ] Review `@bernierllc/task-queue` package API
- [ ] Determine use case and value
- [ ] If valuable, create task queue component
- [ ] Create component definition in database
- [ ] Document task queue component usage

---

### Low Priority Components

#### 5. @bernierllc/validators-image-asset

**Component Potential**: ⚠️ Low-Medium  
**Component Type**: `activity`  
**Category**: `core-actions`

**Analysis**:
- Image validation may be useful for specific workflows
- Niche use case, implement if needed

**Implementation Checklist**:
- [ ] Review `@bernierllc/validators-image-asset` package API
- [ ] Determine if image validation is needed in workflows
- [ ] If needed, create image validation component
- [ ] Create component definition in database
- [ ] Document image validation component usage




---

#### 6. @bernierllc/markdown-detector

**Component Potential**: ⚠️ Low-Medium  
**Component Type**: `activity`  
**Category**: `core-actions`

**Analysis**:
- Markdown detection may be useful for content processing workflows
- Niche use case, implement if needed

**Implementation Checklist**:
- [ ] Review `@bernierllc/markdown-detector` package API
- [ ] Determine if markdown detection is needed
- [ ] If needed, create markdown detection component

## UI Packages (Project Interfaces)

The following packages are UI components and should NOT be workflow components:
- `@bernierllc/messaging-ui`

These are React/UI libraries and should be used in the workflow builder UI, not as workflow components.

---

## Package Discovery Process

For each package, follow this process:

1. **Review Package**:
   - [ ] Read package README
   - [ ] Review package API/exports
   - [ ] Understand package purpose and capabilities

2. **Assess Component Potential**:
   - [ ] Does it perform work? → `activity`
   - [ ] Does it use AI/LLM? → `agent`
   - [ ] Does it receive events? → `signal` or `data-in`
   - [ ] Does it expose data? → `data-out`

3. **Plan Component**:
   - [ ] Determine component type and category
   - [ ] Define component configuration schema
   - [ ] Define input/output schemas
   - [ ] Determine connector requirements
   - [ ] Plan NPM package structure

4. **Implement Component**:
   - [ ] Create NPM package for activities (if needed)
   - [ ] Implement activity/agent code
   - [ ] Create component definition in database
   - [ ] Create UI component for property panel
   - [ ] Add tests
   - [ ] Document usage

---

## Testing Requirements

### Unit Tests
- [ ] Test each component activity independently
- [ ] Test error handling
- [ ] Test input validation
- [ ] Test output schema validation

### Integration Tests
- [ ] Test with actual package dependencies
- [ ] Test component execution in workflow context
- [ ] Test connector integration (if applicable)

### E2E Tests
- [ ] Test complete workflow with component
- [ ] Test error scenarios
- [ ] Test performance

---

## Documentation Requirements

- [ ] Component usage guides
- [ ] Package integration documentation
- [ ] Examples for common use cases
- [ ] API reference for each component
- [ ] Troubleshooting guides

---

## References

- [Component Planning Guide](../../../docs/standards/component-planning-guide.md)
- [Overview](./00-overview.md)
- [Storage Connectors Plan](./01-storage-connectors.md)
- [Services/Components/Connectors Refactor Plan](../2025-01-20-services-components-connectors-refactor.md)

