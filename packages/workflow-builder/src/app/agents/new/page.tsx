/**
 * Create New Agent Prompt Page
 */

'use client';

import { YStack, XStack, H1 } from 'tamagui';
import { AuthGuardWithLoading } from '@/components/shared/AuthGuard';
import { Header } from '@/components/shared/Header';
import { Sidebar } from '@/components/shared/Sidebar';
import { AgentPromptEditor } from '@/components/agent/AgentPromptEditor';

function NewAgentContent() {
  return (
    <YStack flex={1}>
      <Header />
      <XStack flex={1}>
        <Sidebar />
        <YStack flex={1} padding="$6" gap="$4">
          <H1>Create Agent Prompt</H1>
          <AgentPromptEditor />
        </YStack>
      </XStack>
    </YStack>
  );
}

export default function NewAgentPage() {
  return (
    <AuthGuardWithLoading>
      <NewAgentContent />
    </AuthGuardWithLoading>
  );
}

