/**
 * Component Card - Display a single component
 */

'use client';

import { Card, YStack, XStack, Text } from 'tamagui';
import { Badge } from '../shared/Badge';
import type { Database } from '@/types/database';

type Component = Database['public']['Tables']['components']['Row'] & {
  component_type: { name: string; icon: string | null };
  visibility: { name: string };
};

interface ComponentCardProps {
  component: Component;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

export function ComponentCard({ 
  component, 
  onClick, 
  draggable = false,
  onDragStart,
}: ComponentCardProps) {
  const typeColors: Record<string, string> = {
    activity: '$blue10',
    agent: '$purple10',
    signal: '$green10',
    trigger: '$orange10',
  };

  const typeColor = typeColors[component.component_type.name] || '$gray10';

  return (
    <Card
      padding="$3"
      pressStyle={{ scale: 0.98 }}
      hoverStyle={{ backgroundColor: '$gray3' }}
      cursor="pointer"
      onPress={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      animation="quick"
    >
      <YStack gap="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$5" fontWeight="600">
            {component.display_name}
          </Text>
          <Badge backgroundColor={typeColor} size="$2">
            <Text fontSize="$2" color="white">
              {component.component_type.name}
            </Text>
          </Badge>
        </XStack>

        {component.description && (
          <Text fontSize="$3" color="$gray11" numberOfLines={2}>
            {component.description}
          </Text>
        )}

        <XStack gap="$2" flexWrap="wrap">
          {component.capabilities && component.capabilities.length > 0 && (
            <>
              {component.capabilities.slice(0, 3).map((cap) => (
                <Badge key={cap} size="$1" backgroundColor="$gray5">
                  <Text fontSize="$1" color="$gray12">
                    {cap}
                  </Text>
                </Badge>
              ))}
              {component.capabilities.length > 3 && (
                <Badge size="$1" backgroundColor="$gray5">
                  <Text fontSize="$1" color="$gray12">
                    +{component.capabilities.length - 3}
                  </Text>
                </Badge>
              )}
            </>
          )}
        </XStack>

        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$2" color="$gray10">
            v{component.version}
          </Text>
          {component.deprecated && (
            <Badge backgroundColor="$red5" size="$1">
              <Text fontSize="$1" color="$red11">
                deprecated
              </Text>
            </Badge>
          )}
        </XStack>
      </YStack>
    </Card>
  );
}

