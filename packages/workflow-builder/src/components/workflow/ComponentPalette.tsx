/**
 * Component Palette - Drag source for workflow components
 */

'use client';

import { ScrollView, YStack, Text, Separator } from 'tamagui';
import { ComponentCard } from '../component/ComponentCard';
import type { Database } from '@/types/database';

type Component = Database['public']['Tables']['components']['Row'] & {
  component_type: { name: string; icon: string | null };
  visibility: { name: string };
};

interface ComponentPaletteProps {
  components: Component[];
  disabled?: boolean;
}

export function ComponentPalette({ components, disabled = false }: ComponentPaletteProps) {
  // Group by type
  const groupedComponents = components.reduce((acc, comp) => {
    const type = comp.component_type.name;
    if (!acc[type]) acc[type] = [];
    acc[type].push(comp);
    return acc;
  }, {} as Record<string, Component[]>);

  return (
    <YStack 
      width={280} 
      backgroundColor="$background" 
      borderRightWidth={1} 
      borderColor="$borderColor"
      opacity={disabled ? 0.5 : 1}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <YStack padding="$4" borderBottomWidth={1} borderColor="$borderColor">
        <Text fontSize="$6" fontWeight="bold">Components</Text>
        <Text fontSize="$2" color={disabled ? "$red10" : "$gray11"} marginTop="$1">
          {disabled ? 'Editing disabled (workflow is active)' : 'Drag to canvas'}
        </Text>
      </YStack>

      <ScrollView flex={1}>
        <YStack padding="$2" gap="$4">
          {Object.entries(groupedComponents).map(([type, comps]) => (
            <YStack key={type} gap="$2">
              <Text 
                fontSize="$4" 
                fontWeight="600" 
                paddingHorizontal="$2" 
                color="$gray11"
                textTransform="capitalize"
              >
                {type === 'activity' ? 'Activities' : `${type}s`}
              </Text>

              {comps.map((component) => (
                <ComponentCard
                  key={component.id}
                  component={component}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/json',
                      JSON.stringify(component)
                    );
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                />
              ))}

              {type !== Object.keys(groupedComponents).slice(-1)[0] && (
                <Separator marginVertical="$2" />
              )}
            </YStack>
          ))}

          {components.length === 0 && (
            <YStack padding="$4" alignItems="center">
              <Text fontSize="$3" color="$gray11" textAlign="center">
                No components available. Create components first.
              </Text>
            </YStack>
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

