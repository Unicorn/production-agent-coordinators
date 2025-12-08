# Inside/Outside Service Visualization Enhancement

## Overview

This document extends the UI utility visual representation plan to support clear visualization of the **inside/outside** nature of services. Users need to understand:
- **What comes INTO a service** (interfaces, connectors from outside)
- **What happens INSIDE a service** (components, flow, logic)
- **What goes OUT of a service** (interfaces, connectors to outside)

This visualization helps users understand service boundaries and makes it easier to build complex applications as multiple services rather than a single monolithic service.

## Two Distinct Views

### 1. Service Builder View (Single Service Focus)

**Purpose**: Build and configure one service in detail

**Visual Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 Order Processing Service                                  │
│ ═══════════════════════════════════════════════════════════  │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔌 EXTERNAL CONNECTORS (Outside)                    │   │
│  │                                                       │   │
│  │  📧 SendGrid Email ──────────┐                       │   │
│  │  💳 Stripe Payment ──────────┤                       │   │
│  │  💾 PostgreSQL ──────────────┤                       │   │
│  │                              │                       │   │
│  └──────────────────────────────┼───────────────────────┘   │
│                                  │                           │
│  ┌──────────────────────────────┼───────────────────────┐   │
│  │ 🚪 INCOMING INTERFACES     │                       │   │
│  │                              │                       │   │
│  │  📥 Receive Order (POST) ─────┤                       │   │
│  │  🔍 Get Order Status (GET) ────┤                       │   │
│  │                              │                       │   │
│  └──────────────────────────────┼───────────────────────┘   │
│                                  │                           │
│  ┌──────────────────────────────┼───────────────────────┐   │
│  │ ⚙️ INTERNAL FLOW (Inside)      │                       │   │
│  │                              │                       │   │
│  │  [Start] → [Validate Order] → [Process Payment]      │   │
│  │           ↓                  ↓                          │   │
│  │  [Send Email] ← [Update DB] ← [Create Invoice]       │   │
│  │                              │                       │   │
│  └──────────────────────────────┼───────────────────────┘   │
│                                  │                           │
│  ┌──────────────────────────────┼───────────────────────┐   │
│  │ 🚪 OUTGOING INTERFACES        │                       │   │
│  │                              │                       │   │
│  │  📤 Send Payment Request ─────┤                       │   │
│  │  📤 Notify Shipping ──────────┤                       │   │
│  │                              │                       │   │
│  └──────────────────────────────┼───────────────────────┘   │
│                                  │                           │
│  ┌──────────────────────────────┼───────────────────────┐   │
│  │ 🔌 EXTERNAL CONNECTIONS (Outside)                    │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │ → Payment Service (via Interface)              │  │   │
│  │  │ → Shipping Service (via Interface)             │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Service boundary clearly visible
- Zones for different connection types
- Internal flow visible and editable
- External connections shown as ports on boundary
- Interfaces shown as connection points

### 2. Project View (Multi-Service Overview)

**Purpose**: See how multiple services connect within a project

**Visual Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ 📦 E-Commerce Project                                        │
│ ═══════════════════════════════════════════════════════════  │
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ 🏢 Order Service │         │ 🏢 Payment Service│          │
│  │                 │         │                 │          │
│  │  [Internal Flow] │         │  [Internal Flow]│          │
│  │                 │         │                 │          │
│  │  🚪 Send Payment │─────────→│  🚪 Receive      │          │
│  │     Request     │         │     Payment     │          │
│  │                 │         │                 │          │
│  └──────────────────┘         └──────────────────┘          │
│         │                              │                      │
│         │                              │                      │
│         ↓                              ↓                      │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │ 🔌 SendGrid       │         │ 🔌 Stripe         │          │
│  │    Email          │         │    Payment        │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
│  ┌──────────────────┐                                         │
│  │ 🏢 Shipping       │                                         │
│  │    Service        │                                         │
│  │                   │                                         │
│  │  🚪 Receive        │←────────┐                              │
│  │     Shipping Req  │         │                              │
│  │                   │         │                              │
│  └───────────────────┘         │                              │
│                                │                              │
│                                │                              │
│  ┌──────────────────┐         │                              │
│  │ 🏢 Order Service    │─────────┘                              │
│  │                  │                                        │
│  │  🚪 Notify        │                                        │
│  │     Shipping     │                                        │
│  │                  │                                        │
│  └──────────────────┘                                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Multiple services visible
- Service-to-service connections (interfaces)
- External connectors shown
- Connection flow clearly visible
- Click service to navigate to builder view

## React Flow Implementation

### Can React Flow Handle This?

**Yes!** React Flow is well-suited for this with:

1. **Custom Node Types**: Create `ServiceContainerNode` that acts as a boundary
2. **Nested Nodes**: Components can be children of service container
3. **Custom Edges**: Different styles for interfaces vs connectors
4. **Multiple Instances**: Different React Flow instances for different views
5. **Node Positioning**: Control node positions relative to container

### Implementation Approach

#### 1. Service Container Node

**Custom Node Type**: `ServiceContainerNode`

```typescript
interface ServiceContainerNodeData {
  serviceId: string;
  serviceName: string;
  // Zones
  incomingInterfaces: InterfaceNode[];
  outgoingInterfaces: InterfaceNode[];
  externalConnectors: ConnectorNode[];
  internalComponents: ComponentNode[];
  // View mode
  viewMode: 'builder' | 'project'; // Different rendering
}
```

**Visual Structure**:
```
┌─────────────────────────────────────────┐
│ 🏢 Service Name                          │ ← Header
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ 🔌 External Connectors               ││ ← Top Zone
│ │  [Connector 1] [Connector 2]        ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ 🚪 Incoming Interfaces               ││ ← Left Zone
│ │  [Interface 1]                       ││
│ │  [Interface 2]                       ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ ⚙️ Internal Flow                      ││ ← Center Zone
│ │  [Component] → [Component]           ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ 🚪 Outgoing Interfaces               ││ ← Right Zone
│ │  [Interface 1]                       ││
│ │  [Interface 2]                       ││
│ └─────────────────────────────────────┘│
│                                         │
│ ┌─────────────────────────────────────┐│
│ │ 🔌 External Connections              ││ ← Bottom Zone
│ │  [Service Connection]               ││
│ └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

#### 2. Zone-Based Layout

**Zones in Service Container**:

1. **Top Zone**: External Connectors (Input)
   - Email, Database, API connectors
   - Dragged from palette
   - Shown as ports on top edge

2. **Left Zone**: Incoming Interfaces
   - Interfaces that receive data/actions
   - Connection points on left edge
   - Can connect from other services

3. **Center Zone**: Internal Flow
   - Components and their connections
   - Standard workflow canvas
   - Editable flow logic

4. **Right Zone**: Outgoing Interfaces
   - Interfaces that send data/actions
   - Connection points on right edge
   - Can connect to other services

5. **Bottom Zone**: External Connections (Output)
   - Connections to other services
   - Project connectors
   - Shown as ports on bottom edge

#### 3. React Flow Configuration

**Service Builder View**:
```typescript
<ReactFlow
  nodes={[
    // Service container (parent)
    {
      id: 'service-container',
      type: 'serviceContainer',
      position: { x: 0, y: 0 },
      data: {
        serviceId: '...',
        viewMode: 'builder',
        // Zones contain child nodes
        zones: {
          top: [...connectorNodes],
          left: [...incomingInterfaceNodes],
          center: [...componentNodes],
          right: [...outgoingInterfaceNodes],
          bottom: [...externalConnectionNodes],
        }
      },
      // Container dimensions
      style: { width: 1200, height: 800 },
    },
  ]}
  edges={[...internalEdges, ...interfaceEdges, ...connectorEdges]}
  nodeTypes={{
    serviceContainer: ServiceContainerNode,
    interface: InterfaceNode,
    connector: ConnectorNode,
    component: ComponentNode,
    // ... other types
  }}
  // Prevent connections outside service boundary
  connectionMode="loose"
  // Custom connection validation
  isValidConnection={(connection) => {
    // Validate connection based on zones
    return validateConnection(connection);
  }}
/>
```

**Project View**:
```typescript
<ReactFlow
  nodes={[
    // Multiple service containers
    {
      id: 'service-1',
      type: 'serviceContainer',
      position: { x: 0, y: 0 },
      data: {
        serviceId: '...',
        viewMode: 'project', // Collapsed/overview mode
      },
      style: { width: 300, height: 200 }, // Smaller in project view
    },
    {
      id: 'service-2',
      type: 'serviceContainer',
      position: { x: 400, y: 0 },
      data: {
        serviceId: '...',
        viewMode: 'project',
      },
    },
  ]}
  edges={[
    // Service-to-service connections
    {
      id: 'service1-to-service2',
      source: 'service-1',
      target: 'service-2',
      sourceHandle: 'outgoing-interface-1',
      targetHandle: 'incoming-interface-1',
      type: 'interface', // Different edge style
      label: 'Send Payment Request',
    },
  ]}
  nodeTypes={{
    serviceContainer: ServiceContainerNode,
  }}
  // Auto-layout for project view
  layout="dagre"
  direction="LR"
/>
```

#### 4. Zone Boundaries and Ports

**Visual Ports on Container Edges**:

```typescript
// Service container with ports
<div className="service-container">
  {/* Top edge - External connectors */}
  <div className="zone-top">
    {connectors.map(connector => (
      <div
        key={connector.id}
        className="connector-port"
        style={{
          position: 'absolute',
          top: 0,
          left: `${connector.position}%`, // Position along top edge
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          id={`connector-${connector.id}`}
        />
        <ConnectorBadge connector={connector} />
      </div>
    ))}
  </div>

  {/* Left edge - Incoming interfaces */}
  <div className="zone-left">
    {incomingInterfaces.map(interface => (
      <div
        key={interface.id}
        className="interface-port"
        style={{
          position: 'absolute',
          left: 0,
          top: `${interface.position}%`, // Position along left edge
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          id={`interface-in-${interface.id}`}
        />
        <InterfaceBadge interface={interface} direction="incoming" />
      </div>
    ))}
  </div>

  {/* Center - Internal flow */}
  <div className="zone-center">
    <ReactFlow
      nodes={internalComponents}
      edges={internalEdges}
      // Nested React Flow for internal flow
    />
  </div>

  {/* Right edge - Outgoing interfaces */}
  <div className="zone-right">
    {outgoingInterfaces.map(interface => (
      <div
        key={interface.id}
        className="interface-port"
        style={{
          position: 'absolute',
          right: 0,
          top: `${interface.position}%`,
        }}
      >
        <Handle
          type="source"
          position={Position.Right}
          id={`interface-out-${interface.id}`}
        />
        <InterfaceBadge interface={interface} direction="outgoing" />
      </div>
    ))}
  </div>

  {/* Bottom edge - External service connections */}
  <div className="zone-bottom">
    {externalConnections.map(connection => (
      <div
        key={connection.id}
        className="connection-port"
        style={{
          position: 'absolute',
          bottom: 0,
          left: `${connection.position}%`,
        }}
      >
        <Handle
          type="source"
          position={Position.Bottom}
          id={`connection-${connection.id}`}
        />
        <ConnectionBadge connection={connection} />
      </div>
    ))}
  </div>
</div>
```

## Visual Design Details

### Service Container Styling

```css
.service-container {
  position: relative;
  border: 3px solid #6366f1; /* Indigo - service color */
  border-radius: 12px;
  background: linear-gradient(to bottom, #eef2ff, #f9fafb);
  min-width: 1000px;
  min-height: 700px;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
}

.service-container.builder-view {
  /* Full size for builder */
  width: 100%;
  height: 100%;
}

.service-container.project-view {
  /* Compact for project view */
  width: 300px;
  height: 200px;
  border-width: 2px;
}

/* Zone boundaries */
.zone-top,
.zone-left,
.zone-right,
.zone-bottom {
  position: absolute;
  border: 1px dashed #c7d2fe;
  background: rgba(199, 210, 254, 0.05);
}

.zone-top {
  top: 0;
  left: 0;
  right: 0;
  height: 100px;
}

.zone-left {
  top: 100px;
  left: 0;
  bottom: 100px;
  width: 150px;
}

.zone-center {
  top: 100px;
  left: 150px;
  right: 150px;
  bottom: 100px;
  /* Internal flow canvas */
}

.zone-right {
  top: 100px;
  right: 0;
  bottom: 100px;
  width: 150px;
}

.zone-bottom {
  bottom: 0;
  left: 0;
  right: 0;
  height: 100px;
}
```

### Port Styling

```css
.interface-port,
.connector-port,
.connection-port {
  position: absolute;
  padding: 8px 12px;
  border-radius: 8px;
  background: white;
  border: 2px solid #6366f1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  z-index: 10;
}

.interface-port.incoming {
  border-color: #14b8a6; /* Teal */
  background: #f0fdfa;
}

.interface-port.outgoing {
  border-color: #10b981; /* Green */
  background: #f0fdf4;
}

.connector-port {
  border-color: #f59e0b; /* Orange */
  background: #fffbeb;
}

.connection-port {
  border-color: #06b6d4; /* Cyan */
  background: #ecfeff;
}
```

### Edge Styling

```css
/* Interface edges (service-to-service) */
.edge-interface {
  stroke: #14b8a6; /* Teal */
  stroke-width: 3;
  marker-end: url(#interface-arrow);
}

/* Connector edges (external) */
.edge-connector {
  stroke: #f59e0b; /* Orange */
  stroke-width: 2;
  stroke-dasharray: 5,5;
  marker-end: url(#connector-arrow);
}

/* Internal flow */
.edge-internal {
  stroke: #6366f1; /* Indigo */
  stroke-width: 2;
  marker-end: url(#internal-arrow);
}
```

## Interaction Patterns

### Service Builder View

1. **Adding Components**:
   - Drag component from palette
   - Drop in center zone (internal flow)
   - Component appears in internal flow canvas

2. **Adding Interfaces**:
   - Click "Add Interface" button
   - Choose type (incoming/outgoing)
   - Interface appears as port on appropriate edge
   - Configure interface details

3. **Adding Connectors**:
   - Drag connector from palette
   - Drop in top zone (external connectors)
   - Connector appears as port on top edge
   - Configure connector settings

4. **Connecting Services**:
   - In project view, drag from outgoing interface
   - Connect to incoming interface of another service
   - Edge shows service-to-service connection

### Project View

1. **Navigating to Service**:
   - Click on service container
   - Navigate to service builder view
   - Service opens in builder mode

2. **Viewing Connections**:
   - Hover over service to highlight connections
   - Click connection to see details
   - View connection flow

3. **Adding New Service**:
   - Click "Add Service" button
   - New service container appears
   - Configure service name and details

## Alternative: Layered Canvas Approach

If React Flow's nested nodes prove challenging, consider a **layered canvas approach**:

### Layer Structure

1. **Background Layer**: Service boundaries
2. **Connection Layer**: Interfaces and connectors
3. **Component Layer**: Internal components
4. **Overlay Layer**: Tooltips, labels, annotations

### Implementation

```typescript
<div className="layered-canvas">
  {/* Background - Service boundaries */}
  <svg className="layer-boundaries">
    <ServiceBoundary service={service} />
  </svg>

  {/* Connections - Interfaces and connectors */}
  <svg className="layer-connections">
    <InterfaceConnections interfaces={interfaces} />
    <ConnectorConnections connectors={connectors} />
  </svg>

  {/* Components - Internal flow */}
  <ReactFlow
    className="layer-components"
    nodes={internalComponents}
    edges={internalEdges}
  />

  {/* Overlay - Interactive elements */}
  <div className="layer-overlay">
    <Tooltips />
    <Labels />
    <Annotations />
  </div>
</div>
```

## Migration Path

### Phase 1: Service Container Node
- [ ] Create `ServiceContainerNode` component
- [ ] Implement zone-based layout
- [ ] Add port rendering on edges
- [ ] Test with single service

### Phase 2: Builder View
- [ ] Implement service builder view
- [ ] Add zone interactions (drag to zones)
- [ ] Implement internal flow canvas
- [ ] Add interface/connector management

### Phase 3: Project View
- [ ] Implement project view
- [ ] Add service-to-service connections
- [ ] Implement auto-layout
- [ ] Add navigation between views

### Phase 4: Enhanced Features
- [ ] Add connection validation
- [ ] Implement connection highlighting
- [ ] Add connection flow animation
- [ ] Implement connection details panel

## React Flow vs Alternatives

### React Flow Advantages
- ✅ Already in use
- ✅ Good TypeScript support
- ✅ Custom node types
- ✅ Custom edges
- ✅ Active development
- ✅ Good documentation

### Potential Challenges
- ⚠️ Nested nodes can be complex
- ⚠️ Zone-based layout requires custom positioning
- ⚠️ Port positioning on edges needs careful calculation

### Alternatives Considered
- **JsPlumb**: More built-in support for ports, but different API
- **D3.js**: More control, but more work
- **Custom Canvas**: Full control, but significant development

### Recommendation
**Stick with React Flow** but:
1. Start with simpler approach (zones as visual guides, not strict boundaries)
2. Use custom positioning for ports
3. Consider layered approach if nested nodes prove difficult
4. Iterate based on user feedback

## Success Metrics

- [ ] Users can clearly see what comes into a service
- [ ] Users can clearly see what happens inside a service
- [ ] Users can clearly see what goes out of a service
- [ ] Service boundaries are visually obvious
- [ ] Interface vs connector distinction is clear
- [ ] Project view shows service relationships clearly
- [ ] Navigation between views is intuitive
- [ ] Users prefer building as multiple services vs single service

## Related Documents

- `2025-01-20-services-components-connectors-refactor.md` - Core refactoring plan
- `2025-01-20-ui-utility-visual-representation.md` - UI utility plan
- React Flow documentation: https://reactflow.dev

