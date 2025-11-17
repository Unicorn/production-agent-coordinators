'use client';

import { useParams } from 'next/navigation';
import { api as trpc } from '@/lib/trpc/client';
import { YStack, XStack, Heading, Text, Spinner, Button } from 'tamagui';
import { Save, Play, Settings, Code2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TemporalWorkflowCanvas } from '@/components/workflow-builder/TemporalWorkflowCanvas';
import { CodePreviewDialog } from '@/components/workflow-builder/CodePreviewDialog';
import { WorkflowExecutionPanel } from '@/components/workflow-execution/WorkflowExecutionPanel';

export default function WorkflowBuilderPage() {
  const params = useParams();
  const workflowId = params.id as string;
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [compiledCode, setCompiledCode] = useState<any>(null);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const [executionData, setExecutionData] = useState<any>(null);

  // Fetch workflow details
  const { data: workflowData, isLoading } = trpc.workflows.get.useQuery({
    id: workflowId,
  });

  // Fetch available components for palette
  const { data: componentsData } = trpc.components.list.useQuery({
    page: 1,
    pageSize: 100,
  });

  // Fetch work queues
  const { data: workQueuesData } = trpc.workQueues.list.useQuery({
    workflowId,
  });

  // Fetch signals
  const { data: signalsData } = trpc.signals.list.useQuery({
    workflowId,
  });

  // Fetch queries
  const { data: queriesData } = trpc.queries.list.useQuery({
    workflowId,
  });

  // Compile mutation
  const compileMutation = trpc.compiler.compile.useMutation({
    onSuccess: (data) => {
      setCompiledCode(data.compiled);
      setShowCodePreview(true);
    },
  });

  // Build/Execute mutation
  const buildMutation = trpc.execution.build.useMutation({
    onSuccess: (data) => {
      setCurrentExecutionId(data.executionId);
      // Start polling for execution status
    },
  });

  // Get execution status
  const { data: executionStatus } = trpc.execution.getStatus.useQuery(
    { executionId: currentExecutionId! },
    { 
      enabled: !!currentExecutionId,
      refetchInterval: (data) => {
        // Poll every second while building/running, stop when complete/failed
        return data?.status === 'building' || data?.status === 'running' ? 1000 : false;
      },
    }
  );

  // Update execution data when status changes
  useEffect(() => {
    if (executionStatus) {
      // Simulate execution steps for UI
      const mockSteps = [
        { id: '1', name: 'Compiling workflow', status: 'completed' as const, duration: 500 },
        { id: '2', name: 'Validating code', status: 'completed' as const, duration: 300 },
        { id: '3', name: 'Registering activities', status: executionStatus.status === 'building' ? 'running' as const : 'completed' as const, duration: 400 },
        { id: '4', name: 'Executing workflow', status: executionStatus.status === 'running' ? 'running' as const : executionStatus.status === 'completed' ? 'completed' as const : 'pending' as const },
      ];

      const progress = executionStatus.status === 'building' ? 50 : 
                      executionStatus.status === 'running' ? 75 : 
                      executionStatus.status === 'completed' ? 100 : 0;

      setExecutionData({
        id: currentExecutionId,
        status: executionStatus.status,
        startedAt: executionStatus.startedAt,
        completedAt: executionStatus.completedAt,
        steps: mockSteps,
        progress,
        result: executionStatus.result,
        error: executionStatus.error,
      });
    }
  }, [executionStatus, currentExecutionId]);

  const handleSave = async () => {
    // TODO: Implement save workflow definition
    console.log('Saving workflow...');
    setHasUnsavedChanges(false);
  };

  const handleGenerateCode = async () => {
    await compileMutation.mutateAsync({
      workflowId,
      includeComments: true,
      strictMode: true,
    });
  };

  const handleBuildWorkflow = async () => {
    await buildMutation.mutateAsync({
      workflowId,
      input: {},
    });
  };

  const handleRetryExecution = async () => {
    setCurrentExecutionId(null);
    setExecutionData(null);
    await handleBuildWorkflow();
  };

  if (isLoading) {
    return (
      <YStack f={1} ai="center" jc="center" gap="$4">
        <Spinner size="large" />
        <Text>Loading workflow builder...</Text>
      </YStack>
    );
  }

  if (!workflowData?.workflow) {
    return (
      <YStack f={1} ai="center" jc="center" gap="$4">
        <Text fontSize="$6" color="$red10">Workflow not found</Text>
      </YStack>
    );
  }

  return (
    <YStack f={1} h="100vh">
      {/* Header */}
      <XStack
        ai="center"
        jc="space-between"
        p="$4"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
        bg="$background"
      >
        <YStack gap="$1">
          <Heading size="$6">{workflowData.workflow.name}</Heading>
          <Text fontSize="$3" color="$gray11">
            {workflowData.workflow.description || 'No description'}
          </Text>
        </YStack>

        <XStack gap="$2" ai="center">
          {hasUnsavedChanges && (
            <Text fontSize="$2" color="$orange10">
              Unsaved changes
            </Text>
          )}
          
          <Button
            icon={Settings}
            size="$3"
            chromeless
          >
            Settings
          </Button>

          <Button
            icon={Save}
            size="$3"
            onPress={handleSave}
            disabled={!hasUnsavedChanges}
          >
            Save
          </Button>

          <Button
            icon={Play}
            size="$3"
            themeInverse
            onPress={handleBuildWorkflow}
            disabled={buildMutation.isLoading || executionData?.status === 'building' || executionData?.status === 'running'}
          >
            {buildMutation.isLoading ? 'Building...' : 'Build Workflow'}
          </Button>

          <Button
            icon={Code2}
            size="$3"
            onPress={handleGenerateCode}
            chromeless
          >
            View Code
          </Button>
        </XStack>
      </XStack>

      {/* Canvas + Execution Panel */}
      <XStack f={1} position="relative">
        {/* Workflow Canvas */}
        <YStack f={1}>
          <TemporalWorkflowCanvas
            workflow={workflowData.workflow}
            availableComponents={componentsData?.components || []}
            workQueues={workQueuesData?.workQueues || []}
            signals={signalsData?.signals || []}
            queries={queriesData?.queries || []}
            onChange={() => setHasUnsavedChanges(true)}
          />
        </YStack>

        {/* Execution Panel */}
        <WorkflowExecutionPanel
          workflowId={workflowId}
          execution={executionData}
          onRun={handleBuildWorkflow}
          onRetry={handleRetryExecution}
        />
      </XStack>

      {/* Code Preview Dialog */}
      {compiledCode && (
        <CodePreviewDialog
          open={showCodePreview}
          onOpenChange={setShowCodePreview}
          workflowCode={compiledCode.workflowCode}
          activitiesCode={compiledCode.activitiesCode}
          workerCode={compiledCode.workerCode}
          packageJson={compiledCode.packageJson}
          tsConfig={compiledCode.tsConfig}
        />
      )}
    </YStack>
  );
}

