/**
 * Workflow Toolbar - Save, deploy, and other actions
 */

'use client';

import { XStack, YStack, Button, Text, Separator } from 'tamagui';
import { Save, Play, Edit, AlertCircle } from 'lucide-react';

interface WorkflowToolbarProps {
  onSave: () => void;
  onDeploy: () => void;
  onEnterEditMode?: () => void;
  isSaving?: boolean;
  isDeploying?: boolean;
  readOnly?: boolean;
}

export function WorkflowToolbar({
  onSave,
  onDeploy,
  onEnterEditMode,
  isSaving = false,
  isDeploying = false,
  readOnly = false,
}: WorkflowToolbarProps) {
  return (
    <YStack>
      {/* Main Toolbar */}
      <XStack
        paddingHorizontal="$4"
        paddingVertical="$3"
        backgroundColor="$background"
        borderBottomWidth={1}
        borderColor="$borderColor"
        alignItems="center"
        gap="$3"
      >
        {!readOnly && (
          <>
            <Button
              size="$3"
              icon={Save}
              onPress={onSave}
              disabled={isSaving || isDeploying}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>

            <Separator vertical />

            <Button
              size="$3"
              theme="blue"
              icon={Play}
              onPress={onDeploy}
              disabled={isSaving || isDeploying}
            >
              {isDeploying ? 'Deploying...' : 'Deploy'}
            </Button>
          </>
        )}

        {readOnly && onEnterEditMode && (
          <Button
            size="$3"
            theme="orange"
            icon={Edit}
            onPress={onEnterEditMode}
          >
            Pause to Edit
          </Button>
        )}

        <XStack flex={1} />

        <Text fontSize="$2" color={readOnly ? "$orange10" : "$gray11"} fontWeight={readOnly ? "600" : "400"}>
          {readOnly ? '🔒 Read-only (Active Workflow)' : '✏️ Editing'}
        </Text>
      </XStack>

      {/* Read-only Warning Banner */}
      {readOnly && (
        <XStack
          paddingHorizontal="$4"
          paddingVertical="$3"
          backgroundColor="$orange2"
          borderBottomWidth={1}
          borderColor="$orange6"
          alignItems="center"
          gap="$3"
        >
          <AlertCircle size={20} color="$orange10" />
          <YStack flex={1}>
            <Text fontSize="$3" fontWeight="600" color="$orange11">
              Workflow is Active
            </Text>
            <Text fontSize="$2" color="$orange10">
              This workflow is currently deployed and running. Pause it to make changes.
            </Text>
          </YStack>
          {onEnterEditMode && (
            <Button
              size="$2"
              theme="orange"
              icon={Edit}
              onPress={onEnterEditMode}
            >
              Pause to Edit
            </Button>
          )}
        </XStack>
      )}
    </YStack>
  );
}

