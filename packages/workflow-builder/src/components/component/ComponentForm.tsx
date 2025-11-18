/**
 * Component Form - Create/Edit component
 */

'use client';

import { YStack, XStack, Text, Button, Input, TextArea, Label, Select, Adapt, Sheet, Switch } from 'tamagui';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';
import { Check, ChevronDown } from 'lucide-react';
import { TypeScriptEditor } from '@/components/code-editor/TypeScriptEditor';

interface ComponentFormProps {
  componentId?: string;
  onSuccess?: () => void;
}

export function ComponentForm({ componentId, onSuccess }: ComponentFormProps) {
  const router = useRouter();
  const utils = api.useUtils();

  // Form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [componentType, setComponentType] = useState<string>('activity');
  const [visibility, setVisibility] = useState<string>('public');
  const [capabilities, setCapabilities] = useState('');
  const [tags, setTags] = useState('');
  const [isCustomActivity, setIsCustomActivity] = useState(false);
  const [activityCode, setActivityCode] = useState('');
  const [isCodeValid, setIsCodeValid] = useState(false);
  const [error, setError] = useState('');

  const { data: types } = api.components.getTypes.useQuery();

  const createMutation = api.components.create.useMutation({
    onSuccess: () => {
      utils.components.list.invalidate();
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/components');
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !displayName || !componentType) {
      setError('Name, display name, and component type are required');
      return;
    }

    // Validate custom activity code if enabled
    if (isCustomActivity && componentType === 'activity') {
      if (!activityCode.trim()) {
        setError('Activity code is required for custom activities');
        return;
      }
      
      if (!isCodeValid) {
        setError('Activity code must be valid TypeScript. Please fix errors and validate.');
        return;
      }
    }

    createMutation.mutate({
      name: name.trim(),
      displayName: displayName.trim(),
      description: description.trim() || undefined,
      version,
      componentType: componentType as any,
      visibility: visibility as any,
      capabilities: capabilities
        ? capabilities.split(',').map(c => c.trim()).filter(Boolean)
        : undefined,
      tags: tags
        ? tags.split(',').map(t => t.trim()).filter(Boolean)
        : undefined,
      // Custom activity code
      implementationLanguage: isCustomActivity && activityCode.trim() ? 'typescript' : undefined,
      implementationCode: isCustomActivity && activityCode.trim() ? activityCode : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <YStack gap="$4" maxWidth={600}>
        {error && (
          <YStack padding="$3" backgroundColor="$red3" borderRadius="$4">
            <Text color="$red11">{error}</Text>
          </YStack>
        )}

        {/* Name */}
        <YStack gap="$2">
          <Label htmlFor="name" fontSize="$3" fontWeight="600">
            Name *
          </Label>
          <Input
            id="name"
            size="$4"
            placeholder="runBuild"
            value={name}
            onChangeText={setName}
            disabled={createMutation.isLoading}
          />
          <Text fontSize="$2" color="$gray11">
            Internal name (camelCase, no spaces)
          </Text>
        </YStack>

        {/* Display Name */}
        <YStack gap="$2">
          <Label htmlFor="displayName" fontSize="$3" fontWeight="600">
            Display Name *
          </Label>
          <Input
            id="displayName"
            size="$4"
            placeholder="Run Build"
            value={displayName}
            onChangeText={setDisplayName}
            disabled={createMutation.isLoading}
          />
        </YStack>

        {/* Description */}
        <YStack gap="$2">
          <Label htmlFor="description" fontSize="$3" fontWeight="600">
            Description
          </Label>
          <TextArea
            id="description"
            size="$4"
            placeholder="What does this component do?"
            value={description}
            onChangeText={setDescription}
            disabled={createMutation.isLoading}
            numberOfLines={3}
          />
        </YStack>

        {/* Component Type */}
        <YStack gap="$2">
          <Label htmlFor="componentType" fontSize="$3" fontWeight="600">
            Component Type *
          </Label>
          <Select
            value={componentType}
            onValueChange={setComponentType}
            disabled={createMutation.isLoading}
          >
            <Select.Trigger width="100%" iconAfter={ChevronDown}>
              <Select.Value placeholder="Select type" />
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
                {types?.map((type) => (
                  <Select.Item key={type.id} index={type.id} value={type.name}>
                    <Select.ItemText>{type.name}</Select.ItemText>
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

        {/* Version */}
        <YStack gap="$2">
          <Label htmlFor="version" fontSize="$3" fontWeight="600">
            Version
          </Label>
          <Input
            id="version"
            size="$4"
            placeholder="1.0.0"
            value={version}
            onChangeText={setVersion}
            disabled={createMutation.isLoading}
          />
          <Text fontSize="$2" color="$gray11">
            Semantic version (e.g., 1.0.0)
          </Text>
        </YStack>

        {/* Visibility */}
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

        {/* Capabilities */}
        <YStack gap="$2">
          <Label htmlFor="capabilities" fontSize="$3" fontWeight="600">
            Capabilities
          </Label>
          <Input
            id="capabilities"
            size="$4"
            placeholder="fix-failing-tests, analyze-errors"
            value={capabilities}
            onChangeText={setCapabilities}
            disabled={createMutation.isLoading}
          />
          <Text fontSize="$2" color="$gray11">
            Comma-separated list
          </Text>
        </YStack>

        {/* Tags */}
        <YStack gap="$2">
          <Label htmlFor="tags" fontSize="$3" fontWeight="600">
            Tags
          </Label>
          <Input
            id="tags"
            size="$4"
            placeholder="build, testing, quality"
            value={tags}
            onChangeText={setTags}
            disabled={createMutation.isLoading}
          />
          <Text fontSize="$2" color="$gray11">
            Comma-separated list
          </Text>
        </YStack>

        {/* Custom Activity Code (only for activity type) */}
        {componentType === 'activity' && (
          <>
            <YStack gap="$2">
              <XStack gap="$3" alignItems="center">
                <Switch
                  id="customActivity"
                  checked={isCustomActivity}
                  onCheckedChange={setIsCustomActivity}
                  disabled={createMutation.isLoading}
                >
                  <Switch.Thumb animation="quick" />
                </Switch>
                <Label htmlFor="customActivity" fontSize="$3" fontWeight="600">
                  Custom Activity (Write Your Own Code)
                </Label>
              </XStack>
              <Text fontSize="$2" color="$gray11">
                Enable to write your own TypeScript activity implementation
              </Text>
            </YStack>

            {isCustomActivity && (
              <YStack gap="$2">
                <Label fontSize="$3" fontWeight="600">
                  Activity Code *
                </Label>
                <Text fontSize="$2" color="$gray11" marginBottom="$2">
                  Write TypeScript code for your custom activity. Must export an async function.
                </Text>
                <TypeScriptEditor
                  value={activityCode}
                  onChange={setActivityCode}
                  height={400}
                  readOnly={createMutation.isLoading}
                  onValidationChange={setIsCodeValid}
                />
              </YStack>
            )}
          </>
        )}

        {/* Actions */}
        <XStack gap="$3" marginTop="$4">
          <Button
            size="$4"
            theme="blue"
            onPress={handleSubmit}
            disabled={createMutation.isLoading}
            flex={1}
          >
            {createMutation.isLoading ? 'Creating...' : 'Create Component'}
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
  );
}

