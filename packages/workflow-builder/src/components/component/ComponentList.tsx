/**
 * Component List - Grid of component cards
 */

'use client';

import { YStack, XStack, Text, Spinner, Button, Input } from 'tamagui';
import { useState } from 'react';
import { ComponentCard } from './ComponentCard';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/trpc/client';

interface ComponentListProps {
  type?: string;
  capability?: string;
  onComponentClick?: (componentId: string) => void;
}

export function ComponentList({ 
  type, 
  capability,
  onComponentClick 
}: ComponentListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState(type || '');

  const { data, isLoading, error } = api.components.list.useQuery({
    type: selectedType || undefined,
    capability,
    includeDeprecated: false,
  });

  const { data: types } = api.components.getTypes.useQuery();

  if (isLoading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6">
        <Spinner size="large" />
        <Text marginTop="$4">Loading components...</Text>
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$6">
        <Text color="$red10">Error loading components: {error.message}</Text>
      </YStack>
    );
  }

  const filteredComponents = data?.components.filter((c) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      c.display_name.toLowerCase().includes(query) ||
      c.name.toLowerCase().includes(query) ||
      c.description?.toLowerCase().includes(query)
    );
  }) || [];

  return (
    <YStack flex={1} gap="$4">
      {/* Filters */}
      <XStack gap="$3" flexWrap="wrap" alignItems="center">
        <Input
          flex={1}
          minWidth={200}
          size="$4"
          placeholder="Search components..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        <XStack gap="$2" flexWrap="wrap">
          <Button
            size="$3"
            theme={selectedType === '' ? 'blue' : undefined}
            onPress={() => setSelectedType('')}
          >
            All
          </Button>
          {types?.map((t) => (
            <Button
              key={t.id}
              size="$3"
              theme={selectedType === t.name ? 'blue' : undefined}
              onPress={() => setSelectedType(t.name)}
            >
              {t.name}
            </Button>
          ))}
        </XStack>
      </XStack>

      {/* Results count */}
      <Text fontSize="$3" color="$gray11">
        {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''} found
      </Text>

      {/* Component grid */}
      <YStack gap="$3">
        {filteredComponents.length === 0 ? (
          <YStack padding="$6" alignItems="center">
            <Text color="$gray11">No components found</Text>
            <Button
              marginTop="$4"
              onPress={() => router.push('/components/new')}
            >
              Create Component
            </Button>
          </YStack>
        ) : (
          filteredComponents.map((component) => (
            <ComponentCard
              key={component.id}
              component={component as any}
              onClick={() => {
                if (onComponentClick) {
                  onComponentClick(component.id);
                } else {
                  router.push(`/components/${component.id}`);
                }
              }}
            />
          ))
        )}
      </YStack>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <XStack justifyContent="center" gap="$2" marginTop="$4">
          <Text fontSize="$3" color="$gray11">
            Page {data.page} of {data.totalPages}
          </Text>
          {/* TODO: Add pagination controls */}
        </XStack>
      )}
    </YStack>
  );
}

