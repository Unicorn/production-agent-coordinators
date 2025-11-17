/**
 * Create New Workflow Page
 */

'use client';

import { YStack, XStack, H1, Button, Input, TextArea, Label, Select, Adapt, Sheet, Card, Text } from 'tamagui';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuardWithLoading } from '@/components/shared/AuthGuard';
import { Header } from '@/components/shared/Header';
import { Sidebar } from '@/components/shared/Sidebar';
import { api } from '@/lib/trpc/client';
import { Check, ChevronDown } from 'lucide-react';

function NewWorkflowContent() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [taskQueueId, setTaskQueueId] = useState('');
  const [visibility, setVisibility] = useState<string>('private');
  const [error, setError] = useState('');

  const { data: taskQueues } = api.taskQueues.list.useQuery();
  
  const createMutation = api.workflows.create.useMutation({
    onSuccess: (workflow) => {
      router.push(`/workflows/${workflow.id}/edit`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !displayName || !taskQueueId) {
      setError('Name, display name, and task queue are required');
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      displayName: displayName.trim(),
      description: description.trim() || undefined,
      visibility: visibility as any,
      taskQueueId,
    });
  };

  return (
    <YStack flex={1}>
      <Header />
      <XStack flex={1}>
        <Sidebar />
        <YStack flex={1} padding="$6" gap="$4">
          <H1>Create Workflow</H1>

          <Card padding="$4" elevate maxWidth={600}>
            <form onSubmit={handleSubmit}>
              <YStack gap="$4">
                {error && (
                  <YStack padding="$3" backgroundColor="$red3" borderRadius="$4">
                    <Text color="$red11">{error}</Text>
                  </YStack>
                )}

                <YStack gap="$2">
                  <Label htmlFor="name" fontSize="$3" fontWeight="600">
                    Name *
                  </Label>
                  <Input
                    id="name"
                    size="$4"
                    placeholder="my-workflow"
                    value={name}
                    onChangeText={setName}
                    disabled={createMutation.isLoading}
                  />
                  <Text fontSize="$2" color="$gray11">
                    Kebab-case identifier (e.g., customer-onboarding)
                  </Text>
                </YStack>

                <YStack gap="$2">
                  <Label htmlFor="displayName" fontSize="$3" fontWeight="600">
                    Display Name *
                  </Label>
                  <Input
                    id="displayName"
                    size="$4"
                    placeholder="My Workflow"
                    value={displayName}
                    onChangeText={setDisplayName}
                    disabled={createMutation.isLoading}
                  />
                </YStack>

                <YStack gap="$2">
                  <Label htmlFor="description" fontSize="$3" fontWeight="600">
                    Description
                  </Label>
                  <TextArea
                    id="description"
                    size="$4"
                    placeholder="What does this workflow do?"
                    value={description}
                    onChangeText={setDescription}
                    disabled={createMutation.isLoading}
                    numberOfLines={3}
                  />
                </YStack>

                <YStack gap="$2">
                  <Label htmlFor="taskQueue" fontSize="$3" fontWeight="600">
                    Task Queue *
                  </Label>
                  <Select
                    value={taskQueueId}
                    onValueChange={setTaskQueueId}
                    disabled={createMutation.isLoading}
                  >
                    <Select.Trigger width="100%" iconAfter={ChevronDown}>
                      <Select.Value placeholder="Select task queue" />
                    </Select.Trigger>

                    <Adapt when="sm" platform="touch">
                      <Sheet modal dismissOnSnapToBottom>
                        <Sheet.Frame>
                          <Sheet.ScrollView>
                            <Adapt.Contents />
                          </Sheet.ScrollView>
                        </Sheet.Frame>
                        <Sheet.Overlay />
                      </Sheet>
                    </Adapt>

                    <Select.Content zIndex={200000}>
                      <Select.ScrollUpButton />
                      <Select.Viewport>
                        {taskQueues?.map((queue) => (
                          <Select.Item key={queue.id} index={queue.id} value={queue.id}>
                            <Select.ItemText>{queue.name}</Select.ItemText>
                            <Select.ItemIndicator marginLeft="auto">
                              <Check size={16} />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                      <Select.ScrollDownButton />
                    </Select.Content>
                  </Select>
                </YStack>

                <YStack gap="$2">
                  <Label htmlFor="visibility" fontSize="$3" fontWeight="600">
                    Visibility
                  </Label>
                  <Select
                    value={visibility}
                    onValueChange={setVisibility}
                    disabled={createMutation.isLoading}
                  >
                    <Select.Trigger width="100%" iconAfter={ChevronDown}>
                      <Select.Value />
                    </Select.Trigger>

                    <Adapt when="sm" platform="touch">
                      <Sheet modal dismissOnSnapToBottom>
                        <Sheet.Frame>
                          <Sheet.ScrollView>
                            <Adapt.Contents />
                          </Sheet.ScrollView>
                        </Sheet.Frame>
                        <Sheet.Overlay />
                      </Sheet>
                    </Adapt>

                    <Select.Content zIndex={200000}>
                      <Select.Viewport>
                        <Select.Item index={0} value="public">
                          <Select.ItemText>Public</Select.ItemText>
                          <Select.ItemIndicator marginLeft="auto">
                            <Check size={16} />
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item index={1} value="private">
                          <Select.ItemText>Private</Select.ItemText>
                          <Select.ItemIndicator marginLeft="auto">
                            <Check size={16} />
                          </Select.ItemIndicator>
                        </Select.Item>
                        <Select.Item index={2} value="organization">
                          <Select.ItemText>Organization</Select.ItemText>
                          <Select.ItemIndicator marginLeft="auto">
                            <Check size={16} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      </Select.Viewport>
                    </Select.Content>
                  </Select>
                </YStack>

                <XStack gap="$3" marginTop="$4">
                  <Button
                    size="$4"
                    theme="blue"
                    onPress={handleSubmit}
                    disabled={createMutation.isLoading}
                    flex={1}
                  >
                    {createMutation.isLoading ? 'Creating...' : 'Create & Edit'}
                  </Button>
                  <Button
                    size="$4"
                    variant="outlined"
                    onPress={() => router.back()}
                    disabled={createMutation.isLoading}
                  >
                    Cancel
                  </Button>
                </XStack>
              </YStack>
            </form>
          </Card>
        </YStack>
      </XStack>
    </YStack>
  );
}

export default function NewWorkflowPage() {
  return (
    <AuthGuardWithLoading>
      <NewWorkflowContent />
    </AuthGuardWithLoading>
  );
}

