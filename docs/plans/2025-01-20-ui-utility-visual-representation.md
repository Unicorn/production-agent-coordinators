# UI Utility Visual Representation Plan

## Overview

This plan outlines how to make the workflow builder UI itself more representative of the utility and purpose of services, interfaces, connectors, and components. The goal is to use visual design, iconography, grouping, and interaction patterns to help users intuitively understand what each element does and how it fits into their application.

## Core Principles

### 1. Visual Metaphors Over Technical Terms
- Use visual metaphors that convey purpose (e.g., "plug" for connectors, "door" for interfaces)
- Avoid technical jargon in visual representation
- Let icons and colors tell the story

### 2. Contextual Grouping by Utility
- Group components by what they DO, not just by technical type
- Show relationships visually (e.g., "This connects to that")
- Organize palette by user intent, not implementation details

### 3. Progressive Disclosure
- Show essential information first
- Reveal details on interaction (hover, click, expand)
- Use tooltips and contextual help liberally

### 4. Visual Hierarchy of Purpose
- Services: Large, prominent (the "buildings")
- Interfaces: Medium, connection points (the "doors")
- Connectors: Small, linking elements (the "plugs")
- Components: Varied by type (the "furniture")

### 5. Inside/Outside Visualization
- **See**: `2025-01-20-inside-outside-service-visualization.md` for detailed plan
- Clearly show what comes INTO a service (interfaces, connectors from outside)
- Clearly show what happens INSIDE a service (components, flow, logic)
- Clearly show what goes OUT of a service (interfaces, connectors to outside)
- Use zone-based layout in Service Builder View
- Use compact service containers in Project View

## Component Palette Reorganization

### Current Structure (Technical)
```
- Activities
- Agents
- Signals
- Queries
- Triggers
```

### Proposed Structure (Utility-Based)

```
┌─────────────────────────────────────────┐
│ 🏗️ BUILD YOUR SERVICE                  │
├─────────────────────────────────────────┤
│                                         │
│ 📦 Core Actions                         │
│   • Send Notification                   │
│   • Save to Database                   │
│   • Fetch API Data                     │
│   • Process Data                       │
│                                         │
│ 🤖 AI & Automation                     │
│   • Agent Actions                       │
│   • Decision Making                     │
│   • Content Generation                  │
│                                         │
│ 🔌 Connect to Services                 │
│   • Call Another Service                │
│   • Receive from Service                │
│                                         │
│ 🌐 Connect to External                  │
│   • Send Email (SendGrid)               │
│   • Send Slack Message                  │
│   • Call External API                  │
│                                         │
│ 📥 Receive Data                         │
│   • API Endpoint (POST)                 │
│   • Webhook Receiver                    │
│                                         │
│ 📤 Provide Data                         │
│   • API Query (GET)                     │
│   • State Query                         │
│                                         │
│ 🔀 Control Flow                         │
│   • Condition                           │
│   • Loop                                │
│   • Retry                               │
│                                         │
└─────────────────────────────────────────┘
```

### Visual Design for Palette Sections

**Section Headers:**
- Large, bold icon (emoji or lucide icon)
- Descriptive title (what it does)
- Subtle background color
- Expandable/collapsible

**Component Cards:**
- Icon representing utility (not just type)
- Clear name (what it does)
- Brief description (why you'd use it)
- Visual indicator if connector required
- Badge showing connector type if applicable

## Node Visual Language Enhancement

### Service Nodes (Main Workflow)

**Two View Modes:**

#### Service Builder View (Single Service Focus)
**Visual Design:**
```
┌─────────────────────────────────────────────────────────┐
│ 🏢 Order Processing Service                              │
│ ═══════════════════════════════════════════════════════  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔌 EXTERNAL CONNECTORS (Top Zone)                  │ │
│ │  [SendGrid] [Stripe] [PostgreSQL]                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌──────┐                                    ┌──────┐    │
│ │ 🚪   │                                    │ 🚪   │    │
│ │ IN   │                                    │ OUT  │    │
│ │      │  ┌───────────────────────────┐   │      │    │
│ │      │  │ ⚙️ INTERNAL FLOW           │   │      │    │
│ │      │  │  [Component] → [Component]│   │      │    │
│ │      │  └───────────────────────────┘   │      │    │
│ └──────┘                                    └──────┘    │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔌 EXTERNAL CONNECTIONS (Bottom Zone)              │ │
│ │  → Payment Service  → Shipping Service            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Characteristics:**
- Zone-based layout (top, left, center, right, bottom)
- External connectors on top edge
- Incoming interfaces on left edge
- Internal flow in center (editable canvas)
- Outgoing interfaces on right edge
- External service connections on bottom edge
- Clear visual boundaries between zones

#### Project View (Multi-Service Overview)
**Visual Design:**
```
┌──────────────────┐         ┌──────────────────┐
│ 🏢 Order Service │         │ 🏢 Payment Service│
│                 │         │                 │
│  [Internal Flow] │         │  [Internal Flow]│
│                 │         │                 │
│  🚪 Send Payment │─────────→│  🚪 Receive      │
│     Request     │         │     Payment     │
│                 │         │                 │
└──────────────────┘         └──────────────────┘
```

**Characteristics:**
- Compact size (300x200px)
- Shows service name
- Shows key interfaces as connection points
- Service-to-service connections visible
- Click to navigate to Service Builder View

### Interface Nodes

**Visual Design - Service Interface (Internal):**
```
┌─────────────────────────────────────────┐
│ 🚪 Send Order Action                   │
│ ════════════════════════════════════   │
│                                         │
│  Type: Send Action (Signal)            │
│  To: Payment Service                    │
│                                         │
│  📋 Payload: { orderId, amount }      │
│                                         │
└─────────────────────────────────────────┘
```

**Visual Design - Public Interface (External):**
```
┌─────────────────────────────────────────┐
│ 🌐 Get Order Status                     │
│ ════════════════════════════════════   │
│                                         │
│  Type: Query (GET)                      │
│  Endpoint: /api/orders/{id}             │
│                                         │
│  🔐 Auth: API Key Required              │
│  📋 Returns: Order state                │
│                                         │
└─────────────────────────────────────────┘
```

**Characteristics:**
- Door/portal icon (🚪 for internal, 🌐 for external)
- Clear type indicator (Send Action, Get State, Modify State)
- Shows target service (for internal) or endpoint (for external)
- Auth indicator for public interfaces
- Payload/return schema preview

### Connector Nodes

**Visual Design - Project Connector:**
```
┌─────────────────────────────────────────┐
│ 🔌 → Payment Service                    │
│ ════════════════════════════════════   │
│                                         │
│  Project: E-Commerce                    │
│  Service: Payment Processing            │
│  Interface: Process Payment            │
│                                         │
│  Status: ✅ Connected                   │
│                                         │
└─────────────────────────────────────────┘
```

**Visual Design - Third-Party Connector:**
```
┌─────────────────────────────────────────┐
│ 🔌 SendGrid Email                       │
│ ════════════════════════════════════   │
│                                         │
│  Type: Email Service                    │
│  Account: production@example.com        │
│                                         │
│  Status: ✅ Connected                   │
│  Last Used: 2 hours ago                 │
│                                         │
└─────────────────────────────────────────┘
```

**Characteristics:**
- Plug/connection icon
- Shows what it connects to
- Status indicator (connected, disconnected, error)
- Usage information
- Configuration preview

### Component Nodes with Connectors

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ 📧 Send Notification                    │
│ ════════════════════════════════════   │
│                                         │
│  Type: Email                            │
│  To: {{customer.email}}                 │
│  Subject: Order Confirmation              │
│                                         │
│  🔌 Connector: SendGrid Production      │
│  [Change Connector]                     │
│                                         │
└─────────────────────────────────────────┘
```

**Characteristics:**
- Shows selected connector prominently
- "Change Connector" button/link
- Visual indicator if connector missing (red border, warning icon)
- Connector type badge

## Canvas Visual Enhancements

### Connection Visualization

**Service-to-Service Connections:**
```
[Service A] ──🚪──→ [Service B]
         (interface)
```

**Service-to-External Connections:**
```
[Service] ──🔌──→ [SendGrid]
        (connector)
```

**Visual Styling:**
- Different line styles for different connection types
- Interface connections: Solid blue line with door icon
- Connector connections: Dashed orange line with plug icon
- Hover to show connection details

### Connection Type Indicators

**Edge Labels:**
- Interface edges: Show interface name
- Connector edges: Show connector name
- Data flow edges: Show data type/schema

**Edge Styling:**
```css
.edge-interface {
  stroke: #3b82f6;      /* Blue */
  stroke-width: 3;
  stroke-dasharray: none;
  marker-end: url(#interface-arrow);
}

.edge-connector {
  stroke: #f59e0b;      /* Orange */
  stroke-width: 2;
  stroke-dasharray: 5,5;
  marker-end: url(#connector-arrow);
}

.edge-data-flow {
  stroke: #10b981;      /* Green */
  stroke-width: 2;
  marker-end: url(#data-arrow);
}
```

### Visual Grouping

**Service Containers:**
- Each service shown as a container/box
- Interfaces shown as connection points on container edges
- Connectors shown as external connection points
- Components shown inside service container

**Layout:**
```
┌─────────────────────────────────────────┐
│ 🏢 Order Service                        │
│ ════════════════════════════════════   │
│                                         │
│  [Components inside service]           │
│                                         │
│  🚪 Interfaces:                        │
│    • Send Payment Request               │
│    • Get Order Status                  │
│                                         │
│  🔌 Connectors:                        │
│    • SendGrid Email                    │
│    • Stripe Payment                    │
│                                         │
└─────────────────────────────────────────┘
```

## Interactive Tooltips and Help

### Contextual Tooltips

**On Hover:**
- Component: "Sends an email notification using your configured email connector"
- Interface: "Allows other services to send actions to this service"
- Connector: "Connects to SendGrid email service. Configure in project settings."

**On Click:**
- Expand to show full description
- Show usage examples
- Link to documentation

### Inline Help Text

**Component Configuration:**
```
┌─────────────────────────────────────────┐
│ Connector Selection                     │
│ ─────────────────────────────────────   │
│                                         │
│  Select Email Connector:                │
│  [SendGrid Production ▼]               │
│                                         │
│  💡 Tip: Connectors are configured at   │
│     the project level. Create a new     │
│     connector if you need a different   │
│     email account.                       │
│                                         │
└─────────────────────────────────────────┘
```

## Smart Visual Organization

### Palette Grouping Logic

**Group by User Intent:**
1. **What I Want to Do** (Actions)
   - Send notifications
   - Save data
   - Fetch data
   - Process data

2. **How I Connect** (Integration)
   - To other services (interfaces)
   - To external services (connectors)
   - Receive data (endpoints)

3. **How I Control** (Flow)
   - Conditions
   - Loops
   - Retry logic

### Visual Search and Filtering

**Search by Purpose:**
- "Send email" → Shows notification components with email connectors
- "Connect to database" → Shows database connector components
- "Call another service" → Shows service interface components

**Filter by Connector Type:**
- Show only components that use email connectors
- Show only components that use database connectors
- Show only components that use API connectors

## Component Configuration UI

### Connector Selection Pattern

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ Component: Send Notification            │
│ ════════════════════════════════════   │
│                                         │
│ Notification Type:                   │
│ ○ Email                                  │
│ ○ Slack                                  │
│ ○ SMS                                    │
│                                         │
│ ─────────────────────────────────────   │
│                                         │
│ Email Connector:                         │
│ ┌───────────────────────────────────┐   │
│ │ 🔌 SendGrid Production           │   │
│ │ production@example.com           │   │
│ │ ✅ Connected                      │   │
│ │ [Change] [Test]                   │   │
│ └───────────────────────────────────┘   │
│                                         │
│ [+ Add New Connector]                   │
│                                         │
└─────────────────────────────────────────┘
```

**Features:**
- Visual connector card showing selected connector
- Status indicator (connected, disconnected, error)
- Quick actions (Change, Test)
- "Add New Connector" button opens connector creation modal
- Shows connector type and account info

### Connector Creation Modal

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ Create New Connector                    │
│ ════════════════════════════════════   │
│                                         │
│ Connector Type:                          │
│ [Email ▼]                                │
│                                         │
│ ─────────────────────────────────────   │
│                                         │
│ Provider:                                │
│ [SendGrid ▼]                             │
│                                         │
│ Configuration:                           │
│ ┌───────────────────────────────────┐   │
│ │ API Key: [••••••••••••••••]      │   │
│ │ From Email: [user@example.com]   │   │
│ │ From Name: [My App]              │   │
│ └───────────────────────────────────┘   │
│                                         │
│ [Test Connection] [Cancel] [Create]    │
│                                         │
└─────────────────────────────────────────┘
```

## Project Page Visual Enhancements

### Connector Management Section

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ 🔌 Connectors                           │
│ ════════════════════════════════════   │
│                                         │
│ 📧 Email (2)                           │
│ ┌───────────────────────────────────┐   │
│ │ 🔌 SendGrid Production           │   │
│ │ ✅ Active | Last used: 2h ago     │   │
│ │ [Edit] [Test] [Delete]            │   │
│ └───────────────────────────────────┘   │
│ ┌───────────────────────────────────┐   │
│ │ 🔌 SendGrid Development           │   │
│ │ ✅ Active | Last used: 1d ago     │   │
│ │ [Edit] [Test] [Delete]            │   │
│ └───────────────────────────────────┘   │
│                                         │
│ 💾 Database (1)                         │
│ ┌───────────────────────────────────┐   │
│ │ 🔌 Main PostgreSQL                │   │
│ │ ✅ Active | Last used: 5m ago     │   │
│ │ [Edit] [Test] [Delete]            │   │
│ └───────────────────────────────────┘   │
│                                         │
│ [+ Add Connector]                       │
│                                         │
└─────────────────────────────────────────┘
```

### Service Connection Graph

**Visual Design:**
```
┌─────────────────────────────────────────┐
│ 🗺️ Service Connections                  │
│ ════════════════════════════════════   │
│                                         │
│         [Order Service]                │
│              │                          │
│              │ 🚪 Process Payment      │
│              ↓                          │
│         [Payment Service]               │
│              │                          │
│              │ 🔌 Stripe                │
│              ↓                          │
│         [External API]                  │
│                                         │
│  Legend:                                │
│  🚪 = Service Interface                 │
│  🔌 = External Connector                │
│                                         │
└─────────────────────────────────────────┘
```

**Features:**
- Interactive React Flow diagram
- Click nodes to navigate to service
- Hover edges to see interface/connector details
- Color coding by connection type
- Auto-layout with manual positioning option

## Icon System

### Purpose-Based Icons

**Services:**
- 🏢 Building (main service)
- 🏭 Factory (processing service)
- 🏪 Store (data service)

**Interfaces:**
- 🚪 Door (service interface - internal)
- 🌐 Globe (public interface - external)
- 📡 Radio (signal interface)
- 🔍 Search (query interface)
- ✏️ Edit (update interface)

**Connectors:**
- 🔌 Plug (generic connector)
- 📧 Email (email connector)
- 💬 Chat (Slack/chat connector)
- 💾 Database (database connector)
- 🌍 API (API connector)
- 🔗 Link (project connector)

**Components:**
- 📧 Send (notification)
- 💾 Save (database write)
- 📖 Read (database read)
- 🌐 Fetch (API call)
- 🤖 Agent (AI agent)
- ⚙️ Process (data processing)

## Color Coding System

### Purpose-Based Colors

**Services:**
- Primary: Indigo (#6366f1) - Main structure
- Secondary: Blue (#3b82f6) - Supporting services

**Interfaces:**
- Internal: Teal (#14b8a6) - Service-to-service
- External: Green (#10b981) - Public APIs

**Connectors:**
- Email: Blue (#3b82f6)
- Database: Purple (#8b5cf6)
- API: Orange (#f59e0b)
- Project: Cyan (#06b6d4)

**Components:**
- Action: Blue (#3b82f6)
- Data: Purple (#8b5cf6)
- AI: Pink (#ec4899)
- Control: Amber (#f59e0b)

## Implementation Tasks

### Phase 1: Palette Reorganization

- [ ] Reorganize component palette by utility
- [ ] Add utility-based section headers
- [ ] Update component cards with purpose icons
- [ ] Add connector requirement indicators
- [ ] Implement search by purpose

### Phase 2: Node Visual Updates

- [ ] Create service node visual design
- [ ] Create interface node components
- [ ] Create connector node components
- [ ] Update component nodes with connector display
- [ ] Add visual status indicators

### Phase 3: Inside/Outside Service Visualization

- [ ] Create `ServiceContainerNode` component
- [ ] Implement zone-based layout (top, left, center, right, bottom)
- [ ] Add port system for interfaces and connectors
- [ ] Implement Service Builder View (single service focus)
- [ ] Implement Project View (multi-service overview)
- [ ] Add navigation between views
- [ ] Create zone boundaries and styling
- [ ] Implement port positioning on container edges

### Phase 4: Connection Visualization

- [ ] Implement different edge styles for connection types
- [ ] Add connection type markers/arrows
- [ ] Create edge labels with connection details
- [ ] Add hover tooltips for connections
- [ ] Implement connection highlighting

### Phase 5: Interactive Help

- [ ] Add contextual tooltips
- [ ] Create inline help text components
- [ ] Implement expandable descriptions
- [ ] Add usage examples
- [ ] Link to documentation

### Phase 6: Configuration UI

- [ ] Create connector selection component
- [ ] Build connector creation modal
- [ ] Add connector test functionality
- [ ] Implement connector status display
- [ ] Add connector management UI

### Phase 7: Project Page Enhancements

- [ ] Design connector management section
- [ ] Implement service connection graph (Project View)
- [ ] Add interactive graph features
- [ ] Create connector grouping by type
- [ ] Add connector usage statistics

## Design System Updates

### New Component Patterns

**ConnectorCard:**
- Shows connector type, name, status
- Quick actions (Edit, Test, Delete)
- Usage information
- Visual status indicator

**InterfaceBadge:**
- Shows interface type and name
- Connection status
- Click to view details
- Visual type indicator

**ServiceContainer:**
- Container for service visualization
- Shows interfaces as connection points
- Shows connectors as external links
- Expandable to show internal flow

### Animation Patterns

**Connector Connection:**
- Animated plug-in effect when connector selected
- Visual feedback on connection success
- Error animation on connection failure

**Interface Connection:**
- Animated door opening when interface connected
- Visual flow animation along connection
- Status pulse for active connections

## Accessibility Considerations

### Screen Reader Support

- Descriptive labels for all visual elements
- Connection type announced clearly
- Status changes announced
- Keyboard navigation for all interactions

### Keyboard Navigation

- Tab through components in palette
- Arrow keys navigate canvas
- Enter to select/configure
- Escape to close modals

### Color Contrast

- All text meets WCAG AA standards
- Status indicators use icons + color
- No color-only information

## Success Metrics

- [ ] Users can identify component purpose without reading descriptions
- [ ] Connector selection is intuitive and clear
- [ ] Service connections are visually obvious
- [ ] Users understand interface vs connector distinction
- [ ] Configuration flow is self-explanatory
- [ ] Visual design reduces cognitive load

## Related Documents

- `2025-01-20-services-components-connectors-refactor.md` - Core refactoring plan
- `2025-01-20-inside-outside-service-visualization.md` - Inside/outside visualization detailed plan
- `visual-pattern-library.md` - Existing visual patterns
- Design system documentation

