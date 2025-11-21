# Workflow Builder UX Architecture Review & Recommendations

**Review Date:** 2025-11-19
**Reviewed By:** ArchitectUX Agent
**Application:** Workflow Builder - Visual Temporal Workflow Editor
**URL:** http://localhost:3010/workflows/[id]/edit

---

## Executive Summary

The Workflow Builder demonstrates solid foundational architecture with React Flow integration, Tamagui UI components, and a three-panel layout (palette, canvas, properties). However, there are critical UX gaps in discoverability, interaction feedback, error handling, and accessibility that limit productivity and user confidence.

**Overall Grade:** B- (Good foundation, needs UX refinement)

**Key Strengths:**
- Clean three-panel layout with logical information architecture
- Auto-save with debouncing prevents data loss
- Drag-and-drop component system is intuitive
- Read-only mode with visual feedback for active workflows
- Collapsible sections in component palette

**Critical Issues:**
- No visual feedback during drag operations (ghost image, drop zones)
- Property panel lacks validation feedback and error states
- Missing keyboard shortcuts and accessibility features
- No undo/redo functionality
- Insufficient canvas navigation feedback (zoom levels, grid snapping)
- Component search/filter functionality missing from palette

---

## Detailed Analysis

### 1. Information Architecture & Layout

#### Current Structure
```
┌─────────────────────────────────────────────────────────┐
│  Component Palette (280px) │ Toolbar + Canvas │ Props  │
│  ├─ Activities (collapsed)  │ [Save] [Deploy] │ Panel  │
│  ├─ Agents                  │                 │ (320px)│
│  └─ Triggers                │   React Flow    │        │
│                             │   Canvas        │        │
└─────────────────────────────────────────────────────────┘
```

**Strengths:**
- Logical left-to-right workflow: select → place → configure
- Fixed sidebar widths prevent layout shift
- Component categorization by type (Activity, Agent, Trigger)
- Collapsible sections reduce visual clutter

**Issues:**
- No visual hierarchy between active and inactive UI regions
- Property panel appears/disappears without transition animation
- Component palette scrolls but lacks visual indicators (scroll shadows)
- Canvas lacks grid or alignment guides for precise positioning
- No breadcrumb or workflow metadata display (workflow name, last saved)

**Recommendations:**

1. **Add Visual Hierarchy**
   ```css
   /* Active panel should have elevated appearance */
   .panel-active {
     box-shadow: 0 0 0 2px var(--color-blue8);
     z-index: 10;
   }

   /* Inactive panels should be slightly dimmed */
   .panel-inactive {
     opacity: 0.85;
     filter: saturate(0.9);
   }
   ```

2. **Implement Scroll Shadows**
   ```css
   .scrollable-container {
     background:
       linear-gradient(white 30%, rgba(255,255,255,0)),
       linear-gradient(rgba(255,255,255,0), white 70%) 0 100%,
       radial-gradient(farthest-side at 50% 0, rgba(0,0,0,0.1), transparent),
       radial-gradient(farthest-side at 50% 100%, rgba(0,0,0,0.1), transparent) 0 100%;
     background-repeat: no-repeat;
     background-size: 100% 40px, 100% 40px, 100% 14px, 100% 14px;
     background-attachment: local, local, scroll, scroll;
   }
   ```

3. **Add Workflow Header**
   ```tsx
   // Insert above toolbar
   <WorkflowHeader>
     <Breadcrumbs>
       <Link to="/workflows">Workflows</Link> /
       <Text fontWeight="bold">{workflowName}</Text>
     </Breadcrumbs>
     <LastSaved>
       {isSaving ? 'Saving...' : `Saved ${formatRelative(lastSavedTime)}`}
     </LastSaved>
   </WorkflowHeader>
   ```

---

### 2. Interaction Patterns

#### Drag-and-Drop

**Current Implementation:**
- Components set `dataTransfer` with JSON data
- Canvas listens for `onDrop` and `onDragOver`
- No visual feedback during drag

**Critical Missing Features:**
1. **Drag Ghost Image** - Users don't see what they're dragging
2. **Drop Zone Indicators** - No visual cue where component will land
3. **Drop Validation** - No feedback for invalid drop targets
4. **Drag Cancel** - No way to cancel a drag operation

**Implementation Guide:**

```tsx
// ComponentCard.tsx - Enhanced drag start
const handleDragStart = (e: React.DragEvent) => {
  e.dataTransfer.setData('application/json', JSON.stringify(component));
  e.dataTransfer.effectAllowed = 'copy';

  // Create custom drag ghost
  const ghost = document.createElement('div');
  ghost.innerHTML = `
    <div style="
      padding: 12px 16px;
      background: white;
      border: 2px dashed var(--color-blue8);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-weight: 600;
    ">
      ${component.display_name}
    </div>
  `;
  ghost.style.position = 'absolute';
  ghost.style.top = '-1000px';
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 50, 25);

  setTimeout(() => document.body.removeChild(ghost), 0);

  // Add visual feedback to source
  e.currentTarget.classList.add('dragging');
};

const handleDragEnd = (e: React.DragEvent) => {
  e.currentTarget.classList.remove('dragging');
};
```

```css
/* CSS for drag states */
.dragging {
  opacity: 0.5;
  transform: scale(0.95);
  transition: all 0.2s ease;
}

.canvas-drag-over {
  background-image:
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 20px,
      var(--color-blue3) 20px,
      var(--color-blue3) 40px
    );
  animation: slide 1s linear infinite;
}

@keyframes slide {
  0% { background-position: 0 0; }
  100% { background-position: 40px 40px; }
}

.drop-zone-valid {
  border: 2px dashed var(--color-green8);
  background-color: var(--color-green2);
}

.drop-zone-invalid {
  border: 2px dashed var(--color-red8);
  background-color: var(--color-red2);
  cursor: not-allowed;
}
```

```tsx
// WorkflowCanvas.tsx - Enhanced drop handling
const [isDraggingOver, setIsDraggingOver] = useState(false);
const [dropPosition, setDropPosition] = useState<{x: number, y: number} | null>(null);

const onDragOver = useCallback((event: React.DragEvent) => {
  event.preventDefault();
  if (readOnly) {
    event.dataTransfer.dropEffect = 'none';
    return;
  }

  event.dataTransfer.dropEffect = 'copy';
  setIsDraggingOver(true);

  // Calculate drop position for preview
  const bounds = event.currentTarget.getBoundingClientRect();
  setDropPosition({
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top
  });
}, [readOnly]);

const onDragLeave = useCallback(() => {
  setIsDraggingOver(false);
  setDropPosition(null);
}, []);

// Render drop preview indicator
{isDraggingOver && dropPosition && (
  <div
    style={{
      position: 'absolute',
      left: dropPosition.x,
      top: dropPosition.y,
      width: 180,
      height: 80,
      border: '2px dashed var(--color-blue8)',
      borderRadius: 8,
      backgroundColor: 'var(--color-blue2)',
      pointerEvents: 'none',
      zIndex: 1000,
      transform: 'translate(-50%, -50%)',
      animation: 'pulse 1s ease-in-out infinite'
    }}
  />
)}
```

#### Node Selection & Editing

**Current Implementation:**
- Click node to select
- Property panel appears on right
- Changes auto-save on blur

**Issues:**
1. No multi-select capability
2. No visual feedback when hovering over nodes
3. Property panel appearance lacks transition
4. No keyboard navigation between nodes
5. No inline editing of node labels

**Recommendations:**

```tsx
// Enhanced node interactions
const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
const [multiSelectedNodes, setMultiSelectedNodes] = useState<Set<string>>(new Set());

const onNodeMouseEnter = useCallback((_event: React.MouseEvent, node: Node) => {
  if (!readOnly) {
    setHoveredNodeId(node.id);
  }
}, [readOnly]);

const onNodeMouseLeave = useCallback(() => {
  setHoveredNodeId(null);
}, []);

const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
  // Multi-select with Cmd/Ctrl
  if (event.metaKey || event.ctrlKey) {
    setMultiSelectedNodes(prev => {
      const next = new Set(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  } else {
    setSelectedNode(node as WorkflowNode);
    setMultiSelectedNodes(new Set([node.id]));
  }
}, []);

// Add to ReactFlow component
<ReactFlow
  onNodeMouseEnter={onNodeMouseEnter}
  onNodeMouseLeave={onNodeMouseLeave}
  // ... other props
/>
```

```css
/* Node interaction states */
.react-flow__node:hover {
  box-shadow: 0 0 0 3px var(--color-blue4);
  transition: box-shadow 0.2s ease;
  cursor: pointer;
}

.react-flow__node.selected {
  box-shadow: 0 0 0 3px var(--color-blue8);
}

.react-flow__node.multi-selected {
  box-shadow: 0 0 0 3px var(--color-purple8);
}

/* Property panel animation */
.property-panel-enter {
  transform: translateX(100%);
  opacity: 0;
}

.property-panel-enter-active {
  transform: translateX(0);
  opacity: 1;
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.property-panel-exit {
  transform: translateX(0);
  opacity: 1;
}

.property-panel-exit-active {
  transform: translateX(100%);
  opacity: 0;
  transition: transform 0.3s ease, opacity 0.3s ease;
}
```

---

### 3. Visual Feedback & States

#### Current State Indicators
- Selected node: Highlighted with selection color
- Saving state: Button shows "Saving..."
- Read-only: Overlay with blur effect
- Editing status: Emoji in toolbar (✏️)

#### Missing Feedback

1. **No Loading States**
   - Component palette loads with no skeleton
   - Canvas appears immediately (could show if workflow is large)
   - No progress indicator for deployments

2. **No Error States**
   - Invalid JSON in property panel just shows alert()
   - Failed saves have no visual indication
   - Network errors not surfaced to user

3. **No Success Confirmations**
   - Save succeeds silently
   - Deploy succeeds with just data refresh
   - No toast notifications

4. **No Validation Feedback**
   - Required fields not marked
   - Invalid configurations show no warnings
   - Disconnected nodes not highlighted

**Implementation Guide:**

```tsx
// Add toast notification system
import { Toast, ToastProvider, useToast } from '@/components/ui/Toast';

export function WorkflowCanvas() {
  const toast = useToast();

  const handleSave = useCallback(async () => {
    try {
      await saveMutation.mutateAsync({ id: workflowId, definition });
      toast.success('Workflow saved successfully');
    } catch (error) {
      toast.error(`Failed to save: ${error.message}`);
    }
  }, [workflowId, definition, saveMutation, toast]);

  const handleDeploy = useCallback(async () => {
    try {
      await deployMutation.mutateAsync({ id: workflowId });
      toast.success('Workflow deployed successfully', {
        action: {
          label: 'View Execution',
          onClick: () => router.push(`/workflows/${workflowId}/executions`)
        }
      });
    } catch (error) {
      toast.error(`Deployment failed: ${error.message}`);
    }
  }, [workflowId, deployMutation, toast]);
}
```

```tsx
// PropertyPanel.tsx - Enhanced validation
const [configError, setConfigError] = useState<string | null>(null);

const handleConfigChange = (value: string) => {
  setConfig(value);

  try {
    JSON.parse(value);
    setConfigError(null);
  } catch (err) {
    setConfigError(err instanceof Error ? err.message : 'Invalid JSON');
  }
};

const handleSave = () => {
  if (configError) {
    toast.error('Cannot save: Configuration contains invalid JSON');
    return;
  }

  try {
    const parsedConfig = JSON.parse(config);
    onUpdate({
      data: { ...node.data, label, config: parsedConfig }
    });
    toast.success('Node properties updated');
  } catch (err) {
    toast.error('Failed to update properties');
  }
};

// In render
<YStack gap="$2">
  <Label htmlFor="config" fontSize="$3" fontWeight="600">
    Configuration (JSON)
    {configError && (
      <Text color="$red10" fontSize="$2" marginLeft="$2">
        ⚠ {configError}
      </Text>
    )}
  </Label>
  <YStack
    borderWidth={1}
    borderColor={configError ? "$red8" : "$borderColor"}
    borderRadius="$4"
    padding="$2"
    backgroundColor={configError ? "$red2" : "$gray2"}
  >
    <textarea
      value={config}
      onChange={(e) => handleConfigChange(e.target.value)}
      style={{
        fontFamily: 'monospace',
        fontSize: 12,
        color: configError ? 'var(--color-red11)' : 'inherit'
      }}
    />
  </YStack>
</YStack>
```

```tsx
// Workflow validation - detect disconnected nodes
const validateWorkflow = useCallback(() => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for disconnected nodes
  const connectedNodeIds = new Set<string>();
  edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  nodes.forEach(node => {
    if (!connectedNodeIds.has(node.id) && node.type !== 'trigger') {
      warnings.push(`Node "${node.data.label}" is not connected`);
    }
  });

  // Check for missing trigger
  const hasTrigger = nodes.some(n => n.type === 'trigger');
  if (!hasTrigger) {
    errors.push('Workflow must have at least one trigger node');
  }

  // Check for missing end node
  const hasEnd = nodes.some(n => n.type === 'end');
  if (!hasEnd) {
    warnings.push('Workflow has no end node');
  }

  return { errors, warnings, isValid: errors.length === 0 };
}, [nodes, edges]);

// Show validation in toolbar
const validation = validateWorkflow();

{validation.warnings.length > 0 && (
  <XStack gap="$2" alignItems="center" paddingHorizontal="$3" paddingVertical="$2" backgroundColor="$yellow2" borderRadius="$3">
    <AlertCircle size={16} color="var(--color-yellow10)" />
    <Text fontSize="$2" color="$yellow11">
      {validation.warnings.length} warning{validation.warnings.length > 1 ? 's' : ''}
    </Text>
  </XStack>
)}
```

---

### 4. Canvas Navigation & Controls

#### Current Implementation
- React Flow built-in controls (zoom in/out, fit view, lock)
- MiniMap in bottom-right
- Background grid pattern
- Mouse wheel zoom, pan with drag

#### Missing Features
1. **No zoom level indicator** - Users don't know current zoom %
2. **No grid snapping** - Precise alignment is difficult
3. **No alignment tools** - Can't align multiple nodes
4. **No keyboard shortcuts** - All actions require mouse
5. **No canvas search** - Can't find nodes by name
6. **No overview map toggle** - MiniMap always visible

**Recommendations:**

```tsx
// Add zoom indicator
const [zoomLevel, setZoomLevel] = useState(100);

const handleZoomChange = useCallback((viewport: any) => {
  setZoomLevel(Math.round(viewport.zoom * 100));
}, []);

<ReactFlow
  onMove={(event, viewport) => handleZoomChange(viewport)}
  // ... other props
>
  {/* Zoom indicator overlay */}
  <div style={{
    position: 'absolute',
    bottom: 16,
    left: 16,
    background: 'white',
    padding: '6px 12px',
    borderRadius: 6,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    fontSize: 12,
    fontWeight: 600,
    zIndex: 10
  }}>
    {zoomLevel}%
  </div>
</ReactFlow>
```

```tsx
// Add grid snapping
const snapGrid: [number, number] = [16, 16];

<ReactFlow
  snapToGrid={true}
  snapGrid={snapGrid}
  // ... other props
/>
```

```tsx
// Add keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd/Ctrl + S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }

    // Cmd/Ctrl + D to deploy
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault();
      handleDeploy();
    }

    // Delete/Backspace to delete selected node
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
      e.preventDefault();
      handleDeleteNode(selectedNode.id);
    }

    // Cmd/Ctrl + Z to undo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
    }

    // Cmd/Ctrl + Shift + Z to redo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      handleRedo();
    }

    // Cmd/Ctrl + A to select all
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      setMultiSelectedNodes(new Set(nodes.map(n => n.id)));
    }

    // Escape to deselect
    if (e.key === 'Escape') {
      setSelectedNode(null);
      setMultiSelectedNodes(new Set());
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedNode, nodes, handleSave, handleDeploy]);

// Show keyboard shortcuts help
<KeyboardShortcutsTooltip>
  <XStack gap="$2">
    <Kbd>⌘</Kbd> + <Kbd>S</Kbd> = Save
    <Kbd>⌘</Kbd> + <Kbd>D</Kbd> = Deploy
    <Kbd>Delete</Kbd> = Delete Node
    <Kbd>⌘</Kbd> + <Kbd>Z</Kbd> = Undo
  </XStack>
</KeyboardShortcutsTooltip>
```

```tsx
// Add node search/filter in component palette
const [searchQuery, setSearchQuery] = useState('');

const filteredComponents = useMemo(() => {
  if (!searchQuery) return components;

  return components.filter(comp =>
    comp.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comp.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comp.capabilities?.some(cap => cap.toLowerCase().includes(searchQuery.toLowerCase()))
  );
}, [components, searchQuery]);

// In ComponentPalette render
<YStack padding="$4" borderBottomWidth={1} borderColor="$borderColor">
  <Text fontSize="$6" fontWeight="bold">Components</Text>
  <Input
    placeholder="Search components..."
    value={searchQuery}
    onChangeText={setSearchQuery}
    size="$3"
    marginTop="$2"
  />
  <Text fontSize="$2" color={disabled ? "$red10" : "$gray11"} marginTop="$1">
    {disabled ? 'Editing disabled' : `${filteredComponents.length} components`}
  </Text>
</YStack>
```

---

### 5. Component Palette UX

#### Current Implementation
- Fixed 280px width sidebar
- Collapsible sections by type
- Component cards with icons, descriptions, tags, version
- Drag-and-drop to canvas
- Disabled state when workflow is active

#### Strengths
- Clear visual hierarchy with section headers
- Badge count shows items per section
- Component cards have good information density
- Icons provide quick visual identification

#### Issues
1. **No search/filter** - Hard to find specific components in large libraries
2. **No favorites/recent** - Can't mark frequently used components
3. **No component preview** - Can't see what component does before dragging
4. **Section state not persisted** - Collapsed sections reset on refresh
5. **No keyboard navigation** - Can't navigate with arrow keys
6. **No component details modal** - Limited space for documentation

**Recommendations:**

```tsx
// ComponentPalette.tsx - Enhanced with search and persistence

const [searchQuery, setSearchQuery] = useState('');
const [favorites, setFavorites] = useState<Set<string>>(
  new Set(JSON.parse(localStorage.getItem('favorite-components') || '[]'))
);

// Persist section state
useEffect(() => {
  localStorage.setItem('palette-sections', JSON.stringify(expandedSections));
}, [expandedSections]);

// Load persisted state
useEffect(() => {
  const saved = localStorage.getItem('palette-sections');
  if (saved) {
    setExpandedSections(JSON.parse(saved));
  }
}, []);

const toggleFavorite = (componentId: string) => {
  setFavorites(prev => {
    const next = new Set(prev);
    if (next.has(componentId)) {
      next.delete(componentId);
    } else {
      next.add(componentId);
    }
    localStorage.setItem('favorite-components', JSON.stringify([...next]));
    return next;
  });
};

// Categorize with favorites
const categorizedComponents = useMemo(() => {
  const favoriteComps = components.filter(c => favorites.has(c.id));
  const grouped = groupedComponents; // existing logic

  if (favoriteComps.length > 0) {
    return {
      Favorites: favoriteComps,
      ...grouped
    };
  }

  return grouped;
}, [components, favorites, groupedComponents]);

// In render, add to ComponentCard
<ComponentCard
  component={component}
  draggable
  onFavoriteToggle={() => toggleFavorite(component.id)}
  isFavorite={favorites.has(component.id)}
  onDragStart={handleDragStart}
/>
```

```tsx
// ComponentCard.tsx - Add favorite toggle and preview
interface ComponentCardProps {
  component: Component;
  draggable?: boolean;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

export function ComponentCard({
  component,
  draggable,
  isFavorite,
  onFavoriteToggle,
  onDragStart
}: ComponentCardProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <>
      <Card>
        <XStack justifyContent="space-between">
          <XStack alignItems="center" gap="$2" flex={1}>
            <Icon size={18} />
            <Text>{component.display_name}</Text>
          </XStack>
          <XStack gap="$1">
            <Button
              size="$2"
              circular
              chromeless
              icon={isFavorite ? StarFilled : Star}
              onPress={(e) => {
                e.stopPropagation();
                onFavoriteToggle?.();
              }}
            />
            <Button
              size="$2"
              circular
              chromeless
              icon={Info}
              onPress={(e) => {
                e.stopPropagation();
                setShowPreview(true);
              }}
            />
          </XStack>
        </XStack>
        {/* Rest of card content */}
      </Card>

      {/* Preview modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <ComponentPreview component={component} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
```

---

### 6. Property Panel UX

#### Current Implementation
- Fixed 320px width sidebar on right
- Appears when node selected
- Shows: Type, Component, Label, Configuration (JSON), Position
- Auto-saves on blur
- Close button to dismiss

#### Issues
1. **Raw JSON editing is developer-hostile** - Need form fields
2. **No validation until blur** - Users don't see errors while typing
3. **No field documentation** - Users don't know what config fields do
4. **No autocomplete** - JSON keys must be typed manually
5. **Position is read-only** - Should allow manual coordinate entry
6. **No property history** - Can't revert changes

**Recommendations:**

```tsx
// PropertyPanel.tsx - Dynamic form generation
import { z } from 'zod';
import { ComponentSchemaRegistry } from '@/lib/component-schemas';

export function PropertyPanel({ node, onUpdate, onClose }: PropertyPanelProps) {
  const [formData, setFormData] = useState(node.data.config || {});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get schema for this component type
  const schema = ComponentSchemaRegistry.get(node.data.componentName);

  const validateField = (key: string, value: any) => {
    if (!schema) return null;

    try {
      schema.shape[key].parse(value);
      return null;
    } catch (err) {
      return err instanceof z.ZodError ? err.errors[0].message : 'Invalid value';
    }
  };

  const handleFieldChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));

    const error = validateField(key, value);
    setErrors(prev => ({
      ...prev,
      [key]: error || undefined
    }));
  };

  const handleSave = () => {
    // Validate all fields
    const allErrors: Record<string, string> = {};
    Object.entries(formData).forEach(([key, value]) => {
      const error = validateField(key, value);
      if (error) allErrors[key] = error;
    });

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      toast.error('Please fix validation errors');
      return;
    }

    onUpdate({
      data: { ...node.data, label, config: formData }
    });
  };

  return (
    <YStack gap="$4">
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$6" fontWeight="bold">Properties</Text>
        <Button icon={X} onPress={onClose} />
      </XStack>

      {/* Dynamic form fields based on schema */}
      {schema ? (
        <YStack gap="$3">
          {Object.entries(schema.shape).map(([key, fieldSchema]) => (
            <FormField
              key={key}
              label={key}
              value={formData[key]}
              onChange={(value) => handleFieldChange(key, value)}
              error={errors[key]}
              schema={fieldSchema}
            />
          ))}
        </YStack>
      ) : (
        // Fallback to JSON editor
        <JSONEditor value={formData} onChange={setFormData} />
      )}

      {/* Editable position */}
      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="600">Position</Text>
        <XStack gap="$2">
          <YStack flex={1}>
            <Label>X</Label>
            <Input
              value={String(Math.round(node.position.x))}
              onChangeText={(val) => {
                const x = parseInt(val, 10);
                if (!isNaN(x)) {
                  onUpdate({ position: { ...node.position, x } });
                }
              }}
            />
          </YStack>
          <YStack flex={1}>
            <Label>Y</Label>
            <Input
              value={String(Math.round(node.position.y))}
              onChangeText={(val) => {
                const y = parseInt(val, 10);
                if (!isNaN(y)) {
                  onUpdate({ position: { ...node.position, y } });
                }
              }}
            />
          </YStack>
        </XStack>
      </YStack>

      {/* Actions */}
      <XStack gap="$2" justifyContent="flex-end">
        <Button variant="outlined" onPress={onClose}>Cancel</Button>
        <Button theme="blue" onPress={handleSave}>Save Changes</Button>
      </XStack>
    </YStack>
  );
}
```

```tsx
// FormField.tsx - Smart field component
function FormField({ label, value, onChange, error, schema }: FormFieldProps) {
  const fieldType = getFieldType(schema);

  switch (fieldType) {
    case 'string':
      return (
        <YStack gap="$1">
          <Label>{label}</Label>
          <Input
            value={value || ''}
            onChangeText={onChange}
            placeholder={schema.description}
          />
          {error && <Text color="$red10" fontSize="$2">{error}</Text>}
        </YStack>
      );

    case 'number':
      return (
        <YStack gap="$1">
          <Label>{label}</Label>
          <Input
            type="number"
            value={String(value || '')}
            onChangeText={(val) => onChange(parseFloat(val))}
          />
          {error && <Text color="$red10" fontSize="$2">{error}</Text>}
        </YStack>
      );

    case 'boolean':
      return (
        <XStack gap="$2" alignItems="center">
          <Switch checked={value || false} onCheckedChange={onChange} />
          <Label>{label}</Label>
          {error && <Text color="$red10" fontSize="$2">{error}</Text>}
        </XStack>
      );

    case 'enum':
      return (
        <YStack gap="$1">
          <Label>{label}</Label>
          <Select value={value} onValueChange={onChange}>
            {schema.options.map(opt => (
              <Select.Item key={opt} value={opt}>{opt}</Select.Item>
            ))}
          </Select>
          {error && <Text color="$red10" fontSize="$2">{error}</Text>}
        </YStack>
      );

    default:
      return (
        <YStack gap="$1">
          <Label>{label}</Label>
          <JSONEditor value={value} onChange={onChange} />
          {error && <Text color="$red10" fontSize="$2">{error}</Text>}
        </YStack>
      );
  }
}
```

---

### 7. Accessibility

#### Current State
- Basic semantic HTML from Tamagui
- No ARIA labels on interactive elements
- No keyboard navigation for canvas
- No screen reader announcements
- No focus management

#### Critical Gaps

1. **Keyboard Navigation**
   - Cannot navigate component palette with keyboard
   - Cannot select nodes with keyboard
   - Cannot connect nodes with keyboard
   - Tab order is not logical

2. **Screen Reader Support**
   - Canvas state changes not announced
   - Save/deploy actions provide no feedback
   - Node connections have no accessible description
   - Drag-and-drop operations not accessible

3. **Focus Management**
   - Property panel opening doesn't move focus
   - Modal dialogs may not trap focus
   - No focus indicators on custom components

4. **Color Contrast**
   - Some text colors may not meet WCAG AA
   - Node states rely only on color (should have patterns/icons)

**Implementation Guide:**

```tsx
// Add skip link
<a href="#main-canvas" className="skip-link">
  Skip to workflow canvas
</a>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-blue9);
  color: white;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
</style>
```

```tsx
// Component Palette with keyboard navigation
const ComponentPalette = () => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const componentRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleKeyDown = (e: KeyboardEvent) => {
    const flatComponents = Object.values(groupedComponents).flat();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(focusedIndex + 1, flatComponents.length - 1);
      setFocusedIndex(nextIndex);
      componentRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(focusedIndex - 1, 0);
      setFocusedIndex(prevIndex);
      componentRefs.current[prevIndex]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      // Trigger drag or add to canvas
      handleComponentSelect(flatComponents[focusedIndex]);
    }
  };

  return (
    <YStack
      role="navigation"
      aria-label="Component palette"
      onKeyDown={handleKeyDown}
    >
      {/* Components with proper ARIA */}
      {flatComponents.map((comp, idx) => (
        <div
          key={comp.id}
          ref={el => componentRefs.current[idx] = el}
          role="button"
          tabIndex={idx === focusedIndex ? 0 : -1}
          aria-label={`${comp.display_name} - ${comp.component_type.name}`}
          aria-describedby={`desc-${comp.id}`}
        >
          <ComponentCard component={comp} />
          <div id={`desc-${comp.id}`} hidden>
            {comp.description}
          </div>
        </div>
      ))}
    </YStack>
  );
};
```

```tsx
// Accessible drag-and-drop alternative
const [announcements, setAnnouncements] = useState<string[]>([]);

const handleComponentSelect = (component: Component) => {
  // Alternative to drag-and-drop for keyboard users
  const position = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  };

  const newNode: WorkflowNode = {
    id: `${component.id}-${Date.now()}`,
    type: component.component_type.name,
    position,
    data: {
      label: component.display_name,
      componentId: component.id,
      componentName: component.name,
      config: {}
    }
  };

  setNodes(nds => [...nds, newNode]);
  setAnnouncements(prev => [...prev, `Added ${component.display_name} to canvas`]);
};

// Screen reader announcements
<div role="status" aria-live="polite" className="sr-only">
  {announcements[announcements.length - 1]}
</div>

<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
```

```tsx
// Focus trap for property panel
import FocusTrap from 'focus-trap-react';

export function PropertyPanel({ node, onUpdate, onClose }: PropertyPanelProps) {
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Move focus to first input when panel opens
    firstInputRef.current?.focus();
  }, []);

  return (
    <FocusTrap>
      <YStack
        role="dialog"
        aria-labelledby="property-panel-title"
        aria-modal="true"
      >
        <XStack justifyContent="space-between">
          <Text id="property-panel-title" fontSize="$6" fontWeight="bold">
            Node Properties
          </Text>
          <Button
            icon={X}
            onPress={onClose}
            aria-label="Close property panel"
          />
        </XStack>

        <Input
          ref={firstInputRef}
          id="label"
          aria-label="Node label"
          value={label}
          onChangeText={setLabel}
        />

        {/* Rest of form */}
      </YStack>
    </FocusTrap>
  );
}
```

---

### 8. Performance Considerations

#### Current Implementation
- Auto-save with 1.5 second debounce
- React Flow handles canvas virtualization
- Component list renders all at once
- No code splitting for node types

#### Potential Issues

1. **Large Workflows**
   - 100+ nodes may cause performance degradation
   - Auto-save serializes entire graph on every change
   - No pagination or virtualization in component palette

2. **Memory Leaks**
   - Timeout refs may not be cleaned up properly
   - Event listeners on window not removed
   - Canvas retains all nodes in memory

3. **Bundle Size**
   - All node types loaded upfront
   - React Flow is heavy (~200KB gzipped)
   - Tamagui brings significant runtime

**Recommendations:**

```tsx
// Virtualize component palette for large lists
import { FixedSizeList } from 'react-window';

export function ComponentPalette({ components }: ComponentPaletteProps) {
  const flatComponents = useMemo(() =>
    Object.values(groupedComponents).flat(),
    [groupedComponents]
  );

  const Row = ({ index, style }: { index: number; style: any }) => (
    <div style={style}>
      <ComponentCard component={flatComponents[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={window.innerHeight - 100}
      itemCount={flatComponents.length}
      itemSize={120}
      width={280}
    >
      {Row}
    </FixedSizeList>
  );
}
```

```tsx
// Optimize auto-save with dirty tracking
const getDirtyFields = (prev: WorkflowDefinition, current: WorkflowDefinition) => {
  const dirty: Partial<WorkflowDefinition> = {};

  if (JSON.stringify(prev.nodes) !== JSON.stringify(current.nodes)) {
    dirty.nodes = current.nodes;
  }

  if (JSON.stringify(prev.edges) !== JSON.stringify(current.edges)) {
    dirty.edges = current.edges;
  }

  return dirty;
};

useEffect(() => {
  if (readOnly) return;

  const dirty = getDirtyFields(lastSavedDefinitionRef.current, { nodes, edges });

  if (Object.keys(dirty).length > 0) {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveMutation.mutate({
        id: workflowId,
        definition: { nodes, edges }
      });
    }, 1500);
  }

  return () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
  };
}, [nodes, edges, readOnly]);
```

```tsx
// Code split node types
import { lazy, Suspense } from 'react';

const ActivityNode = lazy(() => import('./nodes/ActivityNode'));
const AgentNode = lazy(() => import('./nodes/AgentNode'));
const TriggerNode = lazy(() => import('./nodes/TriggerNode'));
// ... other nodes

export const nodeTypes = {
  activity: (props: any) => (
    <Suspense fallback={<NodeSkeleton />}>
      <ActivityNode {...props} />
    </Suspense>
  ),
  agent: (props: any) => (
    <Suspense fallback={<NodeSkeleton />}>
      <AgentNode {...props} />
    </Suspense>
  ),
  // ... other types
};
```

---

## CSS Design System Foundation

### Design Tokens

```css
/* /Users/mattbernier/projects/production-agent-coordinators/packages/workflow-builder/src/styles/design-system.css */

:root {
  /* Spacing Scale (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  /* Typography */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Courier New', monospace;

  --text-xs: 0.75rem;   /* 12px */
  --text-sm: 0.875rem;  /* 14px */
  --text-base: 1rem;    /* 16px */
  --text-lg: 1.125rem;  /* 18px */
  --text-xl: 1.25rem;   /* 20px */
  --text-2xl: 1.5rem;   /* 24px */

  /* Colors - Extend Tamagui theme */
  --canvas-bg: #fafafa;
  --canvas-grid: #e5e5e5;

  --node-activity-bg: #eff6ff;
  --node-activity-border: #bfdbfe;
  --node-activity-selected: #3b82f6;

  --node-agent-bg: #faf5ff;
  --node-agent-border: #e9d5ff;
  --node-agent-selected: #a855f7;

  --node-trigger-bg: #fff7ed;
  --node-trigger-border: #fed7aa;
  --node-trigger-selected: #f97316;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

  /* Z-index Scale */
  --z-canvas: 0;
  --z-nodes: 1;
  --z-edges: 2;
  --z-controls: 10;
  --z-palette: 20;
  --z-property-panel: 20;
  --z-toolbar: 30;
  --z-modal: 100;
  --z-toast: 200;

  /* Animation */
  --duration-fast: 150ms;
  --duration-base: 250ms;
  --duration-slow: 350ms;
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}
```

### Component-Specific Styles

```css
/* /Users/mattbernier/projects/production-agent-coordinators/packages/workflow-builder/src/styles/workflow-canvas.css */

/* Canvas Container */
.workflow-canvas-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background-color: var(--canvas-bg);
}

/* React Flow Customizations */
.react-flow__background {
  background-color: var(--canvas-bg);
}

.react-flow__node {
  font-family: var(--font-sans);
  cursor: pointer;
  transition: box-shadow var(--duration-base) var(--ease-out);
}

.react-flow__node:hover {
  box-shadow: 0 0 0 3px var(--color-blue4);
}

.react-flow__node.selected {
  box-shadow: 0 0 0 3px var(--color-blue8);
}

.react-flow__edge-path {
  stroke-width: 2;
  stroke: var(--color-gray7);
  transition: stroke var(--duration-fast) var(--ease-out);
}

.react-flow__edge:hover .react-flow__edge-path,
.react-flow__edge.selected .react-flow__edge-path {
  stroke: var(--color-blue8);
  stroke-width: 3;
}

.react-flow__handle {
  width: 10px;
  height: 10px;
  background: var(--color-gray6);
  border: 2px solid white;
  transition: all var(--duration-fast) var(--ease-out);
}

.react-flow__handle:hover {
  width: 14px;
  height: 14px;
  background: var(--color-blue8);
}

.react-flow__handle-connecting {
  background: var(--color-blue8);
  animation: pulse 0.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

/* Panel Animations */
.panel-enter {
  opacity: 0;
  transform: translateX(100%);
}

.panel-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: opacity var(--duration-base) var(--ease-out),
              transform var(--duration-base) var(--ease-out);
}

.panel-exit {
  opacity: 1;
  transform: translateX(0);
}

.panel-exit-active {
  opacity: 0;
  transform: translateX(100%);
  transition: opacity var(--duration-base) var(--ease-in),
              transform var(--duration-base) var(--ease-in);
}

/* Scroll Shadows */
.scroll-container {
  position: relative;
  overflow-y: auto;
  background:
    linear-gradient(white 30%, rgba(255,255,255,0)),
    linear-gradient(rgba(255,255,255,0), white 70%) 0 100%,
    radial-gradient(farthest-side at 50% 0, rgba(0,0,0,0.1), transparent),
    radial-gradient(farthest-side at 50% 100%, rgba(0,0,0,0.1), transparent) 0 100%;
  background-repeat: no-repeat;
  background-size: 100% 40px, 100% 40px, 100% 14px, 100% 14px;
  background-attachment: local, local, scroll, scroll;
}

/* Drag States */
.component-dragging {
  opacity: 0.5;
  transform: scale(0.95);
  transition: all var(--duration-fast) var(--ease-out);
}

.canvas-drag-over {
  background-image:
    repeating-linear-gradient(
      45deg,
      transparent,
      transparent 20px,
      var(--color-blue2) 20px,
      var(--color-blue2) 40px
    );
  animation: slide 1s linear infinite;
}

@keyframes slide {
  0% { background-position: 0 0; }
  100% { background-position: 40px 40px; }
}

.drop-preview {
  position: absolute;
  border: 2px dashed var(--color-blue8);
  background-color: var(--color-blue2);
  border-radius: 8px;
  pointer-events: none;
  animation: pulse-opacity 1s ease-in-out infinite;
}

@keyframes pulse-opacity {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.9; }
}

/* Focus Indicators */
.focus-visible:focus {
  outline: 2px solid var(--color-blue8);
  outline-offset: 2px;
}

/* Accessibility */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-blue9);
  color: white;
  padding: var(--space-2);
  text-decoration: none;
  z-index: var(--z-toast);
  transition: top var(--duration-fast) var(--ease-out);
}

.skip-link:focus {
  top: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## Implementation Priority

### Phase 1: Critical UX Fixes (Week 1)
1. Add drag-and-drop visual feedback (ghost image, drop zones)
2. Implement toast notification system for save/deploy feedback
3. Add JSON validation with inline error display in property panel
4. Add component search/filter in palette
5. Implement keyboard shortcuts (Save, Deploy, Delete, Undo)

### Phase 2: Enhanced Interactions (Week 2)
1. Add multi-select for nodes (Cmd/Ctrl + click)
2. Implement undo/redo system
3. Add workflow validation with visual warnings
4. Enhance property panel with dynamic forms
5. Add zoom level indicator and grid snapping

### Phase 3: Accessibility & Polish (Week 3)
1. Implement keyboard navigation for palette
2. Add ARIA labels and screen reader support
3. Add focus trap for property panel
4. Implement scroll shadows for sidebars
5. Add panel transition animations

### Phase 4: Advanced Features (Week 4)
1. Add favorites/recent components
2. Implement component preview modal
3. Add alignment tools (distribute, align edges)
4. Add canvas search/find node
5. Optimize performance with virtualization

---

## Technical Debt & Refactoring

### Code Quality Issues

1. **Type Safety**
   ```tsx
   // Current - uses 'any'
   const newNode: WorkflowNode = {
     id: `${component.id}-${Date.now()}`,
     type: component.component_type.name, // Not type-safe
     // ...
   };

   // Recommended - strict typing
   type NodeType = WorkflowNode['type'];

   const createNode = (
     component: Component,
     position: { x: number; y: number }
   ): WorkflowNode => {
     const nodeType = component.component_type.name as NodeType;

     if (!isValidNodeType(nodeType)) {
       throw new Error(`Invalid node type: ${nodeType}`);
     }

     return {
       id: generateNodeId(component.id),
       type: nodeType,
       position,
       data: {
         label: component.display_name,
         componentId: component.id,
         componentName: component.name,
         config: {}
       }
     };
   };
   ```

2. **Component Separation**
   - WorkflowCanvas is 270 lines - should be split into:
     - WorkflowCanvas (orchestration)
     - CanvasContainer (React Flow wrapper)
     - AutoSaveManager (separate hook)
     - ValidationManager (separate hook)

3. **State Management**
   - Consider using Zustand or Jotai for global workflow state
   - Separate UI state from workflow data state
   - Implement command pattern for undo/redo

---

## Testing Requirements

### Unit Tests
```tsx
// WorkflowCanvas.test.tsx
describe('WorkflowCanvas', () => {
  it('should create node on component drop', () => {
    const { getByTestId } = render(<WorkflowCanvas workflowId="test" />);
    const canvas = getByTestId('workflow-canvas');

    fireEvent.drop(canvas, {
      dataTransfer: {
        getData: () => JSON.stringify(mockComponent)
      }
    });

    expect(screen.getByText(mockComponent.display_name)).toBeInTheDocument();
  });

  it('should auto-save after changes stop', async () => {
    jest.useFakeTimers();
    const saveMock = jest.fn();

    const { getByTestId } = render(
      <WorkflowCanvas workflowId="test" onSave={saveMock} />
    );

    // Make changes
    fireEvent.drop(getByTestId('canvas'), mockDropEvent);

    // Wait for debounce
    jest.advanceTimersByTime(1500);

    await waitFor(() => {
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
  });

  it('should validate workflow before deploy', () => {
    const { getByText } = render(<WorkflowCanvas workflowId="test" />);

    // Try to deploy workflow without trigger
    fireEvent.click(getByText('Deploy'));

    expect(screen.getByText(/must have.*trigger/i)).toBeInTheDocument();
  });
});
```

### Integration Tests
```tsx
// workflow-builder.e2e.ts
test('complete workflow creation flow', async ({ page }) => {
  await page.goto('/workflows/new');

  // Drag trigger to canvas
  await page.dragAndDrop(
    '[data-component="manual-trigger"]',
    '[data-testid="canvas"]'
  );

  // Verify node created
  await expect(page.locator('.react-flow__node')).toHaveCount(1);

  // Select node
  await page.click('.react-flow__node');

  // Verify property panel appears
  await expect(page.locator('[aria-label="Node properties"]')).toBeVisible();

  // Edit label
  await page.fill('[aria-label="Node label"]', 'Start Workflow');

  // Save
  await page.click('button:has-text("Save")');

  // Verify success toast
  await expect(page.locator('.toast-success')).toContainText('saved');
});
```

### Accessibility Tests
```tsx
// accessibility.test.tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('workflow canvas has no accessibility violations', async () => {
  const { container } = render(<WorkflowCanvas workflowId="test" />);
  const results = await axe(container);

  expect(results).toHaveNoViolations();
});

test('keyboard navigation works', () => {
  render(<WorkflowCanvas workflowId="test" />);

  // Tab to first component
  userEvent.tab();
  expect(screen.getByRole('button', { name: /fetch api data/i })).toHaveFocus();

  // Arrow down to next component
  userEvent.keyboard('{ArrowDown}');
  expect(screen.getByRole('button', { name: /process data/i })).toHaveFocus();

  // Enter to add to canvas
  userEvent.keyboard('{Enter}');
  expect(screen.getByText(/added process data/i)).toBeInTheDocument();
});
```

---

## Conclusion

The Workflow Builder has a solid architectural foundation but requires significant UX refinement to meet professional standards. The primary focus should be on:

1. **Immediate Impact**: Visual feedback, error handling, validation
2. **Developer Productivity**: Keyboard shortcuts, undo/redo, better property editing
3. **Accessibility**: WCAG 2.1 AA compliance, keyboard navigation, screen reader support
4. **Performance**: Virtualization, code splitting, optimized rendering

Implementing the recommendations in this document will transform the workflow builder from a functional prototype into a production-ready tool that users will find intuitive, efficient, and reliable.

---

**Next Steps:**
1. Review and prioritize recommendations with product team
2. Create detailed implementation tickets for Phase 1
3. Set up design system CSS files
4. Begin implementation with drag-and-drop feedback
5. Establish testing coverage for new features

**Questions for Product Team:**
- What is the expected maximum workflow size (node count)?
- Are there specific accessibility requirements (Section 508, WCAG 2.1 AAA)?
- What browsers/devices must be supported?
- Is there a design system or brand guidelines to follow?
- What analytics/telemetry should we capture for UX improvements?
