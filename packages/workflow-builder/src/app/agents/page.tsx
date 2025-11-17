/**
 * Agent Prompts Page
 */

'use client';

import { YStack, XStack, H1, Button, Spinner, Text } from 'tamagui';
import { useRouter } from 'next/navigation';
import { AuthGuardWithLoading } from '@/components/shared/AuthGuard';
import { Header } from '@/components/shared/Header';
import { Sidebar } from '@/components/shared/Sidebar';
import { AgentPromptCard } from '@/components/agent/AgentPromptCard';
import { api } from '@/lib/trpc/client';

function AgentsContent() {
  const router = useRouter();
  const { data, isLoading } = api.agentPrompts.list.useQuery({});

  return (
    <YStack flex={1}>
      <Header />
      <XStack flex={1}>
        <Sidebar />
        <YStack flex={1} padding="$6" gap="$4">
          <XStack justifyContent="space-between" alignItems="center">
            <H1>Agent Prompts</H1>
            <Button
              theme="blue"
              onPress={() => router.push('/agents/new')}
            >
              New Agent Prompt
            </Button>
          </XStack>

          {isLoading ? (
            <YStack flex={1} alignItems="center" justifyContent="center">
              <Spinner size="large" />
              <Text marginTop="$4">Loading agent prompts...</Text>
            </YStack>
          ) : (
            <YStack gap="$3">
              {data?.prompts.length === 0 ? (
                <YStack padding="$6" alignItems="center">
                  <Text color="$gray11">No agent prompts yet</Text>
                  <Button
                    marginTop="$4"
                    onPress={() => router.push('/agents/new')}
                  >
                    Create Your First Agent
                  </Button>
                </YStack>
              ) : (
                data?.prompts.map((prompt) => (
                  <AgentPromptCard
                    key={prompt.id}
                    prompt={prompt as any}
                    onClick={() => router.push(`/agents/${prompt.id}`)}
                  />
                ))
              )}
            </YStack>
          )}
        </YStack>
      </XStack>
    </YStack>
  );
}

export default function AgentsPage() {
  return (
    <AuthGuardWithLoading>
      <AgentsContent />
    </AuthGuardWithLoading>
  );
}

