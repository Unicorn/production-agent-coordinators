/**
 * Component Palette - Drag source for workflow components
 */

'use client';

import { useState } from 'react';
import { ScrollView, YStack, XStack, Text, Separator } from 'tamagui';
import { ComponentCard } from '../component/ComponentCard';
import { ChevronDown, ChevronRight, Zap, Radio, PlayCircle, GitBranch, Box, Repeat } from 'lucide-react';
import type { Database } from '@/types/database';

type Component = Database['public']['Tables']['components']['Row'] & {
  component_type: { name: string; icon: string | null };
  visibility: { name: string };
};

interface ComponentPaletteProps {
  components: Component[];
  disabled?: boolean;
}

// Icon mapping for component types
const getTypeIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    activity: Box,
    agent: Radio,
    trigger: Zap,
    signal: PlayCircle,
    condition: GitBranch,
    retry: Repeat,
  };
  return iconMap[type.toLowerCase()] || Box;
};

// Color mapping for component types
const getTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    activity: '#3b82f6',    // blue
    agent: '#a855f7',       // purple
    trigger: '#f97316',     // orange
    signal: '#10b981',      // green
    condition: '#f59e0b',   // amber
    retry: '#8b5cf6',       // violet
  };
  return colorMap[type.toLowerCase()] || '#3b82f6';
};

export function ComponentPalette({ components, disabled = false }: ComponentPaletteProps) {
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Group by type
  const groupedComponents = components.reduce((acc, comp) => {
    const type = comp.component_type.name;
    if (!acc[type]) acc[type] = [];
    acc[type].push(comp);
    return acc;
  }, {} as Record<string, Component[]>);

  // Initialize all sections as collapsed
  if (Object.keys(expandedSections).length === 0 && Object.keys(groupedComponents).length > 0) {
    const initialExpanded: Record<string, boolean> = {};
    Object.keys(groupedComponents).forEach(type => {
      initialExpanded[type] = false; // Start with all collapsed
    });
    setExpandedSections(initialExpanded);
  }

  const toggleSection = (type: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  return (
    <YStack
      width={300}
      backgroundColor="$gray1"
      borderRightWidth={1}
      borderColor="$gray6"
      opacity={disabled ? 0.5 : 1}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      <YStack padding="$4" paddingBottom="$3" borderBottomWidth={1} borderColor="$gray6" backgroundColor="white">
        <Text fontSize="$7" fontWeight="700" color="$gray12" letterSpacing={-0.5}>
          Components
        </Text>
        <Text fontSize="$3" color={disabled ? "$red10" : "$gray11"} marginTop="$1.5" lineHeight="$2">
          {disabled ? 'Editing disabled (workflow is active)' : 'Drag components to canvas'}
        </Text>
      </YStack>

      <ScrollView flex={1}>
        <YStack padding="$3" gap="$3.5">
          {Object.entries(groupedComponents).map(([type, comps]) => {
            const Icon = getTypeIcon(type);
            const typeColor = getTypeColor(type);
            const isExpanded = expandedSections[type] ?? false;

            return (
              <YStack key={type} gap="$2.5">
                <XStack
                  paddingHorizontal="$3.5"
                  paddingVertical="$3"
                  alignItems="center"
                  gap="$3"
                  cursor="pointer"
                  backgroundColor="white"
                  hoverStyle={{
                    backgroundColor: '$gray3',
                    borderColor: '$gray8'
                  }}
                  pressStyle={{ backgroundColor: '$gray4' }}
                  borderRadius="$4"
                  borderWidth={1}
                  borderColor="$gray6"
                  onPress={() => toggleSection(type)}
                  shadowColor="$gray8"
                  shadowOpacity={0.05}
                  shadowRadius={4}
                  shadowOffset={{ width: 0, height: 1 }}
                >
                  {isExpanded ? (
                    <ChevronDown size={16} color="#64748b" strokeWidth={2.5} />
                  ) : (
                    <ChevronRight size={16} color="#64748b" strokeWidth={2.5} />
                  )}
                  <Icon size={20} color={typeColor} strokeWidth={2.5} />
                  <Text
                    fontSize="$4"
                    fontWeight="700"
                    color={typeColor}
                    textTransform="capitalize"
                    flex={1}
                    letterSpacing={-0.3}
                  >
                    {type === 'activity' ? 'Activities' : `${type}s`}
                  </Text>
                  <XStack
                    backgroundColor="$gray4"
                    borderWidth={1}
                    borderColor="$gray7"
                    paddingHorizontal="$2.5"
                    paddingVertical="$1.5"
                    borderRadius="$3"
                  >
                    <Text fontSize="$2" fontWeight="700" color="$gray11">
                      {comps.length}
                    </Text>
                  </XStack>
                </XStack>

                {isExpanded && comps.map((component) => (
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
            );
          })}

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

