/**
 * Workflow Canvas - Main visual workflow editor
 * Integrates with @bernierllc/workflow-ui when available
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { YStack, XStack } from 'tamagui';
import { api } from '@/lib/trpc/client';
import { ComponentPalette } from './ComponentPalette';
import { PropertyPanel } from './PropertyPanel';
import { WorkflowToolbar } from './WorkflowToolbar';
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '@/types/workflow';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from 'react-flow-renderer';
import { nodeTypes } from './nodes';

interface WorkflowCanvasProps {
  workflowId: string;
  initialDefinition?: WorkflowDefinition;
  readOnly?: boolean;
}

export function WorkflowCanvas({ 
  workflowId, 
  initialDefinition,
  readOnly = false,
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialDefinition?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialDefinition?.edges || []);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

  const utils = api.useUtils();
  const saveMutation = api.workflows.update.useMutation({
    onSuccess: () => {
      utils.workflows.get.invalidate({ id: workflowId });
    },
  });
  
  const deployMutation = api.workflows.deploy.useMutation({
    onSuccess: () => {
      utils.workflows.get.invalidate({ id: workflowId });
      utils.workflows.list.invalidate();
    },
  });

  // Load components for palette
  const { data: componentsData } = api.components.list.useQuery({
    includeDeprecated: false,
  });

  const handleSave = useCallback(async () => {
    const definition: WorkflowDefinition = {
      nodes: nodes as any,
      edges: edges as any,
    };

    await saveMutation.mutateAsync({
      id: workflowId,
      definition,
    });
  }, [workflowId, nodes, edges, saveMutation]);

  const handleDeploy = useCallback(async () => {
    await handleSave();
    await deployMutation.mutateAsync({ id: workflowId });
  }, [workflowId, handleSave, deployMutation]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges, readOnly]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node as any);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      if (readOnly) return;
      
      event.preventDefault();

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const componentData = event.dataTransfer.getData('application/json');
      
      if (!componentData) return;

      const component = JSON.parse(componentData);
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: WorkflowNode = {
        id: `${component.id}-${Date.now()}`,
        type: component.component_type.name,
        position,
        data: {
          label: component.display_name,
          componentId: component.id,
          componentName: component.name,
          config: {},
        },
      };

      setNodes((nds) => [...nds, newNode as any]);
    },
    [setNodes, readOnly]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (readOnly) return;
    
    const timer = setTimeout(() => {
      if (nodes.length > 0 || edges.length > 0) {
        handleSave();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [nodes, edges, handleSave, readOnly]);

  return (
    <XStack flex={1} height="100vh">
      {/* Component Palette (Left Sidebar) */}
      <ComponentPalette components={componentsData?.components || []} />

      {/* Main Canvas (Center) */}
      <YStack flex={1}>
        <WorkflowToolbar
          onSave={handleSave}
          onDeploy={handleDeploy}
          isSaving={saveMutation.isLoading}
          isDeploying={deployMutation.isLoading}
          readOnly={readOnly}
        />

        <div style={{ flex: 1 }} onDrop={onDrop} onDragOver={onDragOver}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
      </YStack>

      {/* Property Panel (Right Sidebar) */}
      {selectedNode && !readOnly && (
        <PropertyPanel
          node={selectedNode}
          onUpdate={(updated) => {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === selectedNode.id
                  ? { ...n, data: { ...n.data, ...updated.data } }
                  : n
              )
            );
          }}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </XStack>
  );
}

