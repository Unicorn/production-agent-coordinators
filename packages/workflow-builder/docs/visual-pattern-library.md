# Visual Pattern Library for Workflow Builder

**Purpose:** Reference guide for implementing visual patterns for complex workflow components
**Audience:** UI/UX designers and frontend developers
**Related:** `ux-analysis-workflow-builder.md`

---

## Node Type Visual Language

### Color Coding System

```
Phase Container:      Indigo (#6366f1)  - Structural grouping
Loop Container:       Blue (#3b82f6)    - Iteration/repetition
Condition:            Amber (#f59e0b)   - Decision/branching
Retry:                Pink (#ec4899)    - Error handling
State Variable:       Purple (#8b5cf6)  - Data storage
Activity:             Blue (#3b82f6)    - Work execution
Agent:                Purple (#a855f7)  - AI/agent execution
Child Workflow:       Green (#10b981)   - Workflow spawning
Signal:               Green (#10b981)   - Event handling
Trigger:              Orange (#f97316)  - Workflow start/end
```

### Icon System

```
Phase:           Layers icon (stacked rectangles)
Loop:            Circular arrows (🔁)
Condition:       Branch/fork icon
Retry:           Rotate counter-clockwise
State:           Database/cylinder
Activity:        Box/package
Agent:           Radio waves/broadcast
Child Workflow:  Rocket (startChild) / Pause (executeChild)
Signal:          Play button / radio waves
Trigger:         Lightning bolt / flag
```

### Border Styles

```
Phase Container:     Solid 3px border with rounded corners
Loop Container:      Solid 2px border with dashed inner boundary
Condition:           Solid 2px border, diamond rotation
Retry:               Dashed 2px border (retry attempts)
Normal Node:         Solid 2px border
Selected Node:       Thicker border + glow shadow
Executing Node:      Pulsing animation
Failed Node:         Red border + error icon
```

---

## Container Patterns

### 1. Phase Container

**Visual Structure:**
```
╔═══════════════════════════════════════════╗ ← Double-line header
║  📚 Phase: BUILD            [▼ Collapse]  ║
╠═══════════════════════════════════════════╣ ← Separator
║  Execution: Concurrent (max 4)            ║ ← Config summary
╠═══════════════════════════════════════════╣
║                                           ║
║  [Child nodes arranged inside...]         ║ ← Content area
║                                           ║
╚═══════════════════════════════════════════╝ ← Double-line footer
```

**Collapsed State:**
```
┌───────────────────────────────────────────┐
│  📚 Phase: BUILD            [▶ Expand]    │
│  Contains: 5 nodes | Concurrent (max 4)   │
└───────────────────────────────────────────┘
```

**CSS Styling:**
```css
.phase-container {
  border: 3px solid #6366f1;
  border-radius: 12px;
  background: linear-gradient(to bottom, #eef2ff, #f9fafb);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
}

.phase-container.selected {
  background: #6366f1;
  color: white;
  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
}

.phase-header {
  padding: 16px 20px;
  border-bottom: 2px solid #c7d2fe;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.phase-content {
  padding: 24px;
  min-height: 200px;
}
```

**Interaction States:**
- **Hover:** Subtle background color shift
- **Drag-over:** Dashed border animation to show drop target
- **Collapsed:** Content hidden, header shows summary stats
- **Expanded:** Full content visible, resize handles active

---

### 2. Loop Container

**Visual Structure:**
```
╔═══════════════════════════════════════════════════════════╗
║  🔁 While Loop: hasUnbuiltPackages()    [⚙️] [▼ Collapse] ║
╠═══════════════════════════════════════════════════════════╣
║  Concurrency: ████ (4/4 active) | Strategy: Promise.race  ║
║  Exit Condition: state.packages.every(p => p.built)       ║
╠═══════════════════════════════════════════════════════════╣
║  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ ║
║                                                           ║
║  │  [Loop Body Nodes...]                                │ ║
║                                                           ║
║  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ ║
╚═══════════════════════════════════════════════════════════╝
     │ Continue (loop back)    │ Exit (break)
     ↓                          ↓
```

**Concurrency Visualizer:**
```
Concurrency Slots: ████░░░░ (4/8 active)
                   ↑Active  ↑Available
```

**Loop Iteration Counter (Runtime):**
```
Iteration: 12 | Avg Duration: 2.3s | Total Time: 27.6s
[───────────●───────] Progress indicator
```

**CSS Styling:**
```css
.loop-container {
  border: 2px solid #3b82f6;
  border-radius: 10px;
  background: linear-gradient(to bottom, #eff6ff, #f9fafb);
}

.loop-body {
  border: 2px dashed #93c5fd;
  border-radius: 8px;
  padding: 16px;
  margin: 12px;
  background: rgba(147, 197, 253, 0.05);
}

.concurrency-visualizer {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 6px;
}

.concurrency-slot {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 2px solid #3b82f6;
}

.concurrency-slot.active {
  background: #3b82f6;
  animation: pulse 2s ease-in-out infinite;
}

.concurrency-slot.available {
  background: transparent;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

**Interaction Patterns:**
- **Hover:** Show full exit condition expression
- **Click config icon (⚙️):** Open loop configuration panel
- **Drag nodes into dashed area:** Add to loop body
- **Drag nodes out:** Remove from loop body
- **Runtime:** Animate active slots, show iteration counter

---

### 3. Retry Pattern Container

**Visual Structure:**
```
╔═══════════════════════════════════════════════════════════╗
║  🔄 Coordinator Retry Loop              [⚙️] [▼ Collapse] ║
╠═══════════════════════════════════════════════════════════╣
║  Target: Run Build Activity                               ║
║  Max Attempts: 3 | Backoff: Exponential (1s → 100s)       ║
║  On Failure: Execute CoordinatorWorkflow                  ║
╠═══════════════════════════════════════════════════════════╣
║  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ ║
║                                                           ║
║  │  [Wrapped Activity/Agent/Child Workflow]             │ ║
║                                                           ║
║  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ ║
║                                                           ║
║  On Failure:                                              ║
║  ┌────────────────────────────────────────────┐           ║
║  │  ⏸️ Execute CoordinatorWorkflow (blocking) │           ║
║  │  Problem Type: BUILD_FAILURE              │           ║
║  │  Decision Handling:                       │           ║
║  │    • RETRY → Loop continues               │           ║
║  │    • ESCALATE → Throw error               │           ║
║  │    • RESOLVED → Break loop                │           ║
║  └────────────────────────────────────────────┘           ║
╚═══════════════════════════════════════════════════════════╝
```

**Backoff Timeline Visualizer:**
```
Attempt Timeline:
├─ Attempt 1: 0s        [FAIL]
├──► Backoff: 1s
├─ Attempt 2: 1s        [FAIL]
├────► Backoff: 2s (exponential)
├─ Attempt 3: 3s        [FAIL]
└────► ESCALATE
```

**Runtime State:**
```
╔═══════════════════════════════════════════════════════════╗
║  🔄 Coordinator Retry Loop (ACTIVE)                       ║
╠═══════════════════════════════════════════════════════════╣
║  Current Attempt: 2/3                                     ║
║  ├─┬─┬─┐                                                  ║
║  ✓ ● ○  (Attempt 1 failed, Attempt 2 running)            ║
║                                                           ║
║  Coordinator Status: Analyzing error...                   ║
║  Agent Selected: TypeScript Fixer                         ║
║  Expected Decision: RETRY                                 ║
╚═══════════════════════════════════════════════════════════╝
```

**CSS Styling:**
```css
.retry-container {
  border: 2px dashed #ec4899;
  border-radius: 10px;
  background: linear-gradient(to bottom, #fce7f3, #f9fafb);
}

.retry-container.active {
  border-color: #f59e0b;
  animation: retry-pulse 1s ease-in-out infinite;
}

@keyframes retry-pulse {
  0%, 100% { border-opacity: 1; }
  50% { border-opacity: 0.5; }
}

.retry-attempt-indicator {
  display: flex;
  gap: 8px;
  padding: 8px;
}

.retry-attempt {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid #ec4899;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
}

.retry-attempt.success {
  background: #10b981;
  border-color: #10b981;
  color: white;
}

.retry-attempt.failed {
  background: #ef4444;
  border-color: #ef4444;
  color: white;
}

.retry-attempt.running {
  background: #f59e0b;
  border-color: #f59e0b;
  color: white;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

## Conditional Flow Patterns

### 1. Binary Condition (Diamond)

**Visual Structure:**
```
        ┌─────────────────────┐
        │  Code Exists?       │
        │  ─────────────────  │
        │  result.codeExists  │
        │  === true           │
        └────┬──────────┬─────┘
           TRUE      FALSE
             ↓          ↓
```

**Diamond Rotation:**
```css
.condition-node {
  transform: rotate(45deg);
  border: 2px solid #f59e0b;
  background: #fffbeb;
  padding: 18px;
}

.condition-content {
  transform: rotate(-45deg); /* Rotate content back */
}

.condition-handle.true {
  position: absolute;
  right: -8px;
  background: #10b981;
}

.condition-handle.false {
  position: absolute;
  left: -8px;
  background: #ef4444;
}
```

**Path Labels:**
```
┌─────┐              ┌─────┐
│TRUE │   Hoverable  │FALSE│
└─────┘   badge      └─────┘
```

---

### 2. Multi-Way Condition (Switch)

**Visual Structure:**
```
        ┌──────────────────────┐
        │  Package State       │
        │  ────────────────    │
        │  Switch: status      │
        └────┬────┬────┬───────┘
             ↓    ↓    ↓
          FRESH  PARTIAL  PUBLISHED
```

**CSS Styling:**
```css
.switch-node {
  border: 2px solid #f59e0b;
  border-radius: 8px;
  background: #fffbeb;
  min-width: 200px;
}

.switch-outputs {
  display: flex;
  justify-content: space-around;
  padding: 12px;
  border-top: 1px solid #fbbf24;
}

.switch-output {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.switch-output-label {
  font-size: 10px;
  font-weight: 700;
  color: #92400e;
  text-transform: uppercase;
}

.switch-output-handle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #f59e0b;
  border: 2px solid white;
}
```

---

## State Flow Visualization

### 1. State Variable Badge System

**Read Badge:**
```
┌──────────────────────┐
│  Activity Node       │
│  ─────────────────  │
│  📖 READ: state      │ ← Badge
│     completedPackages│
└──────────────────────┘
```

**Write Badge:**
```
┌──────────────────────┐
│  Activity Node       │
│  ─────────────────  │
│  📝 WRITE: state     │ ← Badge
│     failedPackages   │
└──────────────────────┘
```

**Both:**
```
┌──────────────────────┐
│  Activity Node       │
│  ─────────────────  │
│  📖 READ: state      │
│  📝 WRITE: state     │
└──────────────────────┘
```

**CSS Styling:**
```css
.state-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  margin-top: 8px;
}

.state-badge.read {
  background: rgba(59, 130, 246, 0.1);
  color: #1e40af;
  border: 1px solid #93c5fd;
}

.state-badge.write {
  background: rgba(139, 92, 246, 0.1);
  color: #5b21b6;
  border: 1px solid #c4b5fd;
}
```

---

### 2. State Flow Lines (Overlay)

**Visual Pattern:**
```
[Declare State] ──────┬─────────────────────┐
                      ↓                     ↓
              [Read State Node]    [Write State Node]
                      ↓                     ↓
                      └──────┬──────────────┘
                             ↓
                    [Read State Node]
```

**Overlay Styling:**
```css
.state-flow-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.state-flow-line {
  stroke: #8b5cf6;
  stroke-width: 3;
  stroke-dasharray: 5, 5;
  animation: dash 1s linear infinite;
}

@keyframes dash {
  to {
    stroke-dashoffset: -10;
  }
}

.state-flow-node-highlight {
  outline: 3px solid #8b5cf6;
  outline-offset: 4px;
  border-radius: 8px;
}
```

---

## Child Workflow Visual Distinctions

### 1. StartChild (Async, Non-Blocking)

**Visual Indicator:**
```
┌─────────────────────────────────────┐
│  🚀 Start Child Workflow            │
│  ───────────────────────────────   │
│  PackageBuildWorkflow               │
│  ───────────────────────────────   │
│  ⚡ Non-blocking (async)            │
│  Returns: WorkflowHandle            │
└─────────────────────────────────────┘
```

**Icon & Color:**
- Rocket icon (🚀) for "launch and go"
- Green background (#10b981)
- Dotted outline (non-blocking)

---

### 2. ExecuteChild (Blocking)

**Visual Indicator:**
```
┌─────────────────────────────────────┐
│  ⏸️ Execute Child Workflow          │
│  ───────────────────────────────   │
│  CoordinatorWorkflow                │
│  ───────────────────────────────   │
│  ⏳ Blocking (waits for result)    │
│  Returns: Decision                  │
└─────────────────────────────────────┘
```

**Icon & Color:**
- Pause/Wait icon (⏸️) for "blocks parent"
- Orange background (#f59e0b)
- Solid outline (blocking)

---

### 3. CSS Styling

```css
.child-workflow-node {
  border-radius: 10px;
  padding: 14px 18px;
  min-width: 220px;
}

.child-workflow-node.start-child {
  border: 2px dotted #10b981;
  background: linear-gradient(135deg, #d1fae5, #f0fdf4);
}

.child-workflow-node.execute-child {
  border: 2px solid #f59e0b;
  background: linear-gradient(135deg, #fef3c7, #fffbeb);
}

.execution-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.execution-type-badge.non-blocking {
  background: #10b981;
  color: white;
}

.execution-type-badge.blocking {
  background: #f59e0b;
  color: white;
  animation: blocking-pulse 2s ease-in-out infinite;
}

@keyframes blocking-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## Execution State Indicators

### Node Status Colors

```
Pending:     Gray (#6b7280) - Not yet started
Running:     Blue (#3b82f6) - Currently executing (pulse)
Completed:   Green (#10b981) - Successfully finished (checkmark)
Failed:      Red (#ef4444) - Error occurred (X icon)
Retrying:    Orange (#f59e0b) - In retry loop (spinner)
Skipped:     Gray (#9ca3af) - Not executed (dash)
```

### Node Overlay States

**Running:**
```css
.node.running {
  border-color: #3b82f6;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
  animation: running-pulse 1.5s ease-in-out infinite;
}

@keyframes running-pulse {
  0%, 100% {
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.1);
  }
}
```

**Completed:**
```css
.node.completed::after {
  content: '✓';
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  background: #10b981;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

**Failed:**
```css
.node.failed {
  border-color: #ef4444;
  background: #fee;
}

.node.failed::after {
  content: '✕';
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  background: #ef4444;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 18px;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

---

## Path Highlighting

### Hover Highlight Pattern

**Normal State:**
```css
.workflow-edge {
  stroke: #9ca3af;
  stroke-width: 2;
  opacity: 0.6;
}

.workflow-node {
  opacity: 1;
}
```

**Hover State (Upstream/Downstream):**
```css
.workflow-edge.highlighted-path {
  stroke: #3b82f6;
  stroke-width: 3;
  opacity: 1;
  animation: path-flow 1s linear infinite;
}

@keyframes path-flow {
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 20;
  }
}

.workflow-node.highlighted-path {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.workflow-node.highlighted-path-current {
  border-color: #1e40af;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4);
  z-index: 100;
}
```

### Scenario Testing Path

**Active Path:**
```css
.scenario-active-path .workflow-edge {
  stroke: #10b981;
  stroke-width: 4;
  opacity: 1;
}

.scenario-active-path .workflow-node {
  border-color: #10b981;
  background: linear-gradient(135deg, #d1fae5, #ecfdf5);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
}
```

**Inactive Path:**
```css
.scenario-inactive-path .workflow-edge {
  stroke: #e5e7eb;
  opacity: 0.3;
}

.scenario-inactive-path .workflow-node {
  opacity: 0.4;
  filter: grayscale(50%);
}
```

---

## Interaction Animations

### Drag and Drop

**Dragging from Palette:**
```css
.component-card.dragging {
  opacity: 0.5;
  transform: scale(0.95);
}

.canvas-drop-zone.drag-over {
  background: rgba(59, 130, 246, 0.05);
  outline: 2px dashed #3b82f6;
  outline-offset: 8px;
}
```

**Dragging into Container:**
```css
.container-node.drop-target {
  border-color: #10b981;
  border-style: dashed;
  animation: container-drop-pulse 0.5s ease-in-out infinite;
}

@keyframes container-drop-pulse {
  0%, 100% {
    background: rgba(16, 185, 129, 0.05);
  }
  50% {
    background: rgba(16, 185, 129, 0.15);
  }
}
```

### Expand/Collapse

**Container Expand Animation:**
```css
.container-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease-out;
}

.container-node.expanded .container-content {
  max-height: 1000px;
}

.expand-icon {
  transition: transform 0.3s ease;
}

.container-node.expanded .expand-icon {
  transform: rotate(180deg);
}
```

---

## Responsive Zoom Levels

### Overview (25%)
```css
.workflow-canvas.zoom-overview .node-label {
  display: none;
}

.workflow-canvas.zoom-overview .node-icon {
  font-size: 16px;
}

.workflow-canvas.zoom-overview .container-content {
  max-height: 0 !important; /* Force collapse */
}
```

### Structure (50-75%)
```css
.workflow-canvas.zoom-structure .node-label {
  font-size: 11px;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.workflow-canvas.zoom-structure .node-config-preview {
  display: none;
}
```

### Detail (100%+)
```css
.workflow-canvas.zoom-detail .node-label {
  font-size: 14px;
}

.workflow-canvas.zoom-detail .node-config-preview {
  display: block;
  font-size: 11px;
  color: #6b7280;
  margin-top: 6px;
}
```

---

## Accessibility Patterns

### Keyboard Navigation
```
Tab: Move between nodes
Arrow Keys: Navigate connected nodes
Enter: Select/edit node
Space: Toggle expand/collapse
Delete/Backspace: Delete selected node
Cmd+Z/Ctrl+Z: Undo
Cmd+Y/Ctrl+Y: Redo
```

### Screen Reader Labels
```html
<div
  role="button"
  aria-label="Phase container: BUILD, contains 5 nodes, concurrent execution"
  aria-expanded="true"
  aria-controls="phase-build-content"
>
  <div id="phase-build-content" role="region" aria-label="Phase BUILD content">
    <!-- Child nodes -->
  </div>
</div>
```

### Focus Indicators
```css
.workflow-node:focus {
  outline: 3px solid #3b82f6;
  outline-offset: 4px;
}

.workflow-edge:focus {
  stroke-width: 4;
  stroke: #3b82f6;
}
```

---

## Implementation Checklist

### Container Patterns
- [ ] Phase container with expand/collapse
- [ ] Loop container with concurrency visualizer
- [ ] Retry container with attempt timeline
- [ ] Drag-into-container interaction
- [ ] Nested container support

### Conditional Patterns
- [ ] Binary condition (diamond)
- [ ] Multi-way condition (switch)
- [ ] Path highlighting on hover
- [ ] Scenario testing mode
- [ ] Path labels and annotations

### State Patterns
- [ ] Read/write badges on nodes
- [ ] State flow overlay lines
- [ ] State inspector panel
- [ ] Mutation timeline view

### Child Workflow Patterns
- [ ] StartChild visual distinction
- [ ] ExecuteChild visual distinction
- [ ] Input mapping editor
- [ ] Completion tracking indicator

### Execution Patterns
- [ ] Node status indicators (running, completed, failed)
- [ ] Execution path highlighting
- [ ] Timeline view
- [ ] State inspector at execution points

### Interaction Patterns
- [ ] Path tracing (to start/end)
- [ ] Multi-level zoom
- [ ] Drag and drop animations
- [ ] Expand/collapse animations
- [ ] Keyboard navigation

### Accessibility
- [ ] Keyboard shortcuts
- [ ] Screen reader labels
- [ ] Focus indicators
- [ ] Color contrast (WCAG AA)

---

**Pattern Library Version:** 1.0
**Last Updated:** 2025-11-19
**Related Documents:**
- `ux-analysis-workflow-builder.md` - Full UX analysis
- `ux-analysis-executive-summary.md` - Quick reference
