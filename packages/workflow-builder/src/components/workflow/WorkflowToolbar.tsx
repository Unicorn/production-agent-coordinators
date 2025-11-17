/**
 * Workflow Toolbar - Save, deploy, and other actions
 */

'use client';

import { XStack, Button, Text, Separator } from 'tamagui';
import { Save, Play, Pause } from 'lucide-react';

interface WorkflowToolbarProps {
  onSave: () => void;
  onDeploy: () => void;
  isSaving?: boolean;
  isDeploying?: boolean;
  readOnly?: boolean;
}

export function WorkflowToolbar({
  onSave,
  onDeploy,
  isSaving = false,
  isDeploying = false,
  readOnly = false,
}: WorkflowToolbarProps) {
  return (
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

      <XStack flex={1} />

      <Text fontSize="$2" color="$gray11">
        {readOnly ? 'Read-only' : 'Editing'}
      </Text>
    </XStack>
  );
}

