# Implementation Roadmap: Services, Components, and Connectors Refactor

## Overview

This roadmap organizes implementation into 15 phases with parallelization where possible.

## Phase Breakdown

### Phase 0: Foundation & Database (Week 1)
**Goal**: Establish database schema and core data structures

**Tasks**:
- [ ] Create database migrations for new tables
  - [ ] `service_interfaces` table
  - [ ] `public_interfaces` table
  - [ ] `connectors` table
  - [ ] `project_connectors` table
- [ ] Add new columns to existing tables (backward compatible)
  - [ ] `workflows.service_display_name`
  - [ ] `task_queues.channel_display_name`
- [ ] Create database seed data for new enum types
- [ ] Write migration tests

**Dependencies**: None
**Can Parallelize**: Yes - different tables can be worked on in parallel

---

### Phase 1: Naming Changes - Backend (Week 1-2)
**Goal**: Update backend code to use new terminology

**Tasks**:
- [ ] Update TypeScript types and interfaces
- [ ] Update tRPC routers
- [ ] Update API responses to include both old and new fields
- [ ] Update database queries to use new columns
- [ ] Write unit tests

**Dependencies**: Phase 0
**Can Parallelize**: Yes - different routers/types can be updated in parallel

---

### Phase 2: Service Interfaces - Backend (Week 2-3)
**Goal**: Implement service interface system backend

**Tasks**:
- [ ] Create tRPC router for `serviceInterfaces`
- [ ] Create tRPC router for `publicInterfaces`
- [ ] Implement interface-to-Temporal mapping
- [ ] Create interface validation logic
- [ ] Write API tests

**Dependencies**: Phase 0
**Can Parallelize**: Yes - service interfaces and public interfaces can be worked on in parallel

---

### Phase 3: Connectors System - Backend (Week 2-3)
**Goal**: Implement connectors system backend

**Tasks**:
- [ ] Create tRPC router for `connectors`
- [ ] Create tRPC router for `projectConnectors`
- [ ] Implement credential encryption
- [ ] Create connector type handlers
- [ ] Write API tests

**Dependencies**: Phase 0
**Can Parallelize**: Yes - connectors and project connectors can be worked on in parallel

---

### Phase 4: Naming Changes - Frontend (Week 3-4)
**Goal**: Update UI to use new terminology

**Tasks**:
- [ ] Update UI components
- [ ] Update navigation and routing
- [ ] Update TypeScript types in frontend
- [ ] Write component tests

**Dependencies**: Phase 1
**Can Parallelize**: Yes - different UI sections can be updated in parallel

---

### Phase 5: Service Interfaces - Frontend (Week 4-5)
**Goal**: Build UI for managing service interfaces

**Tasks**:
- [ ] Create interface management components
- [ ] Add interface management to service detail page
- [ ] Create interface visualization components
- [ ] Write component tests

**Dependencies**: Phase 2, Phase 4
**Can Parallelize**: Yes - different interface components can be built in parallel

---

### Phase 6: Connectors System - Frontend (Week 4-5)
**Goal**: Build UI for managing connectors

**Tasks**:
- [ ] Create connector management components
- [ ] Add connector management to project page
- [ ] Create connector visualization components
- [ ] Write component tests

**Dependencies**: Phase 3, Phase 4
**Can Parallelize**: Yes - different connector components can be built in parallel

---

### Phase 7: Component Connector Pattern (Week 5-6)
**Goal**: Implement reusable connector pattern for components

**Tasks**:
- [ ] Create reusable connector components
- [ ] Update components that need connectors
- [ ] Implement connector selection in component config
- [ ] Write component tests

**Dependencies**: Phase 6
**Can Parallelize**: Yes - different components can be updated in parallel

---

### Phase 8: Inside/Outside Visualization - Foundation (Week 6-7)
**Goal**: Build foundation for inside/outside service visualization

**Tasks**:
- [ ] Create `ServiceContainerNode` component
- [ ] Implement zone boundaries
- [ ] Create port system
- [ ] Write component tests

**Dependencies**: Phase 5, Phase 6
**Can Parallelize**: Yes - zones and ports can be built in parallel

---

### Phase 9: Service Builder View (Week 7-8)
**Goal**: Implement single-service builder view

**Tasks**:
- [ ] Create Service Builder View page/component
- [ ] Implement zone interactions
- [ ] Implement internal flow canvas
- [ ] Add navigation from project view
- [ ] Write component tests

**Dependencies**: Phase 8
**Can Parallelize**: Partial - zones can be implemented in parallel

---

### Phase 10: Project View (Week 8-9)
**Goal**: Implement multi-service project view

**Tasks**:
- [ ] Create Project View component
- [ ] Implement service container rendering (compact mode)
- [ ] Add service-to-service connection visualization
- [ ] Implement auto-layout algorithm
- [ ] Write component tests

**Dependencies**: Phase 8, Phase 9
**Can Parallelize**: Partial - graph query and visualization can be worked on in parallel

---

### Phase 11: UI Utility Enhancements (Week 9-10)
**Goal**: Enhance UI to better represent utility

**Tasks**:
- [ ] Reorganize component palette by utility
- [ ] Enhance node visuals
- [ ] Add connection visualization enhancements
- [ ] Add interactive help
- [ ] Write component tests

**Dependencies**: Phase 9, Phase 10
**Can Parallelize**: Yes - palette, nodes, connections, and help can all be worked on in parallel

---

### Phase 12: Authentication & Security (Week 10-11)
**Goal**: Implement authentication and security features

**Tasks**:
- [ ] Implement API key generation for public interfaces
- [ ] Create API key management UI
- [ ] Implement API key authentication middleware
- [ ] Add credential encryption for connectors
- [ ] Write security tests

**Dependencies**: Phase 2, Phase 3
**Can Parallelize**: Yes - API keys and connector security can be worked on in parallel

---

### Phase 13: Kong Integration (Week 11-12)
**Goal**: Integrate Kong for public interfaces

**Tasks**:
- [ ] Create Kong route creation service
- [ ] Implement automatic route creation for public interfaces
- [ ] Add route update/delete logic
- [ ] Write integration tests

**Dependencies**: Phase 2, Phase 12
**Can Parallelize**: Partial - route creation and management can be parallelized

---

### Phase 14: Nexus Integration (Week 12-13)
**Goal**: Integrate Temporal Nexus for project connectors

**Tasks**:
- [ ] Create Nexus endpoint creation service
- [ ] Implement automatic endpoint creation for project connectors
- [ ] Add endpoint update/delete logic
- [ ] Write integration tests

**Dependencies**: Phase 3, Phase 12
**Can Parallelize**: Partial - endpoint creation and management can be parallelized

---

### Phase 15: Testing & Documentation (Week 13-14)
**Goal**: Comprehensive testing and documentation

**Tasks**:
- [ ] Write E2E tests
- [ ] Update architecture documentation
- [ ] Create user guides
- [ ] Create developer guides
- [ ] Create migration guide

**Dependencies**: All previous phases
**Can Parallelize**: Yes - different test suites and documentation can be written in parallel

---

## Parallel Workstreams

### Workstream A: Database & Backend (Weeks 1-3)
- Phase 0: Foundation & Database
- Phase 1: Naming Changes - Backend
- Phase 2: Service Interfaces - Backend
- Phase 3: Connectors System - Backend

### Workstream B: Frontend Core (Weeks 3-6)
- Phase 4: Naming Changes - Frontend
- Phase 5: Service Interfaces - Frontend
- Phase 6: Connectors System - Frontend
- Phase 7: Component Connector Pattern

### Workstream C: Visualization (Weeks 6-10)
- Phase 8: Inside/Outside Visualization - Foundation
- Phase 9: Service Builder View
- Phase 10: Project View
- Phase 11: UI Utility Enhancements

### Workstream D: Integration & Security (Weeks 10-13)
- Phase 12: Authentication & Security
- Phase 13: Kong Integration
- Phase 14: Nexus Integration

### Workstream E: Quality Assurance (Weeks 13-14)
- Phase 15: Testing & Documentation

## Timeline Summary

- **Weeks 1-3**: Backend foundation (Database, APIs)
- **Weeks 3-6**: Frontend core (UI updates, interfaces, connectors)
- **Weeks 6-10**: Visualization (Inside/outside, builder view, project view)
- **Weeks 10-13**: Integration (Security, Kong, Nexus)
- **Weeks 13-14**: Quality assurance (Testing, documentation)

**Total Duration**: ~14 weeks (3.5 months)
