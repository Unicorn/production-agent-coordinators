/**
 * Component Palette - Drag source for workflow components
 * Groups components by utility (what they do) rather than technical type
 */

'use client';

import { useState } from 'react';
import { ScrollView, YStack, XStack, Text, Separator } from 'tamagui';
import { ComponentCard } from '../component/ComponentCard';
import { 
  ChevronDown, 
  ChevronRight, 
  Box, 
  Bot, 
  Network, 
  Globe, 
  Download, 
  Upload, 
  GitBranch,
  Package,
  Wrench
} from 'lucide-react';
import type { Database } from '@/types/database';

type Component = Database['public']['Tables']['components']['Row'] & {
  component_type: { name: string; icon: string | null };
  visibility: { name: string };
};

interface ComponentPaletteProps {
  components: Component[];
  disabled?: boolean;
}

// Utility categories based on what components DO, not what they ARE
interface UtilityCategory {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
  keywords: string[]; // Keywords to match components to this category
}

const UTILITY_CATEGORIES: UtilityCategory[] = [
  {
    id: 'core-actions',
    name: 'Core Actions',
    icon: Package,
    color: '#3b82f6', // blue
    description: 'Basic operations like sending notifications, saving data, fetching APIs',
    keywords: ['notification', 'send', 'email', 'slack', 'save', 'database', 'postgresql', 'redis', 'fetch', 'api', 'http', 'process', 'data', 'transform'],
  },
  {
    id: 'ai-automation',
    name: 'AI & Automation',
    icon: Bot,
    color: '#a855f7', // purple
    description: 'AI agents, decision making, content generation',
    keywords: ['agent', 'ai', 'claude', 'anthropic', 'decision', 'generate', 'content', 'analyze', 'intelligent'],
  },
  {
    id: 'connect-services',
    name: 'Connect to Services',
    icon: Network,
    color: '#10b981', // green
    description: 'Call other services, receive from services',
    keywords: ['service', 'child-workflow', 'start-child', 'call', 'invoke', 'service-to-service'],
  },
  {
    id: 'connect-external',
    name: 'Connect to External',
    icon: Globe,
    color: '#f59e0b', // orange
    description: 'External APIs, webhooks, third-party services',
    keywords: ['external', 'webhook', 'third-party', 'integration', 'connector'],
  },
  {
    id: 'receive-data',
    name: 'Receive Data',
    icon: Download,
    color: '#06b6d4', // cyan
    description: 'API endpoints, webhook receivers',
    keywords: ['receive', 'endpoint', 'api-endpoint', 'webhook', 'post', 'input', 'trigger'],
  },
  {
    id: 'provide-data',
    name: 'Provide Data',
    icon: Upload,
    color: '#14b8a6', // teal
    description: 'API queries, state queries',
    keywords: ['query', 'get', 'state', 'provide', 'read', 'retrieve'],
  },
  {
    id: 'control-flow',
    name: 'Control Flow',
    icon: GitBranch,
    color: '#8b5cf6', // violet
    description: 'Conditions, loops, retries',
    keywords: ['condition', 'if', 'loop', 'retry', 'repeat', 'while', 'for', 'branch'],
  },
];

/**
 * Categorize a component into a utility category based on its name, description, capabilities, and tags
 */
function categorizeComponent(component: Component): string {
  const searchText = [
    component.name,
    component.display_name,
    component.description || '',
    ...(component.capabilities || []),
    ...(component.tags || []),
    component.component_type.name,
  ].join(' ').toLowerCase();

  // Find the category with the most matching keywords
  let bestMatch = UTILITY_CATEGORIES[0]; // Default to first category
  let maxMatches = 0;

  for (const category of UTILITY_CATEGORIES) {
    const matches = category.keywords.filter(keyword => 
      searchText.includes(keyword.toLowerCase())
    ).length;
    
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = category;
    }
  }

  // Special handling for specific component types
  if (component.component_type.name === 'agent') {
    return 'ai-automation';
  }
  if (component.component_type.name === 'signal' || component.name.includes('signal')) {
    return 'connect-services';
  }
  if (component.component_type.name === 'query' || component.name.includes('query')) {
    return 'provide-data';
  }
  if (component.component_type.name === 'trigger' || component.name.includes('trigger') || component.name.includes('endpoint')) {
    return 'receive-data';
  }
  if (component.component_type.name === 'condition' || component.name.includes('condition')) {
    return 'control-flow';
  }
  if (component.component_type.name === 'retry' || component.name.includes('retry')) {
    return 'control-flow';
  }

  return bestMatch.id;
}

export function ComponentPalette({ components, disabled = false }: ComponentPaletteProps) {
  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Group by utility category instead of technical type
  const groupedComponents = components.reduce((acc, comp) => {
    const categoryId = categorizeComponent(comp);
    if (!acc[categoryId]) acc[categoryId] = [];
    acc[categoryId].push(comp);
    return acc;
  }, {} as Record<string, Component[]>);

  // Initialize all sections as collapsed
  if (Object.keys(expandedSections).length === 0 && Object.keys(groupedComponents).length > 0) {
    const initialExpanded: Record<string, boolean> = {};
    Object.keys(groupedComponents).forEach(categoryId => {
      initialExpanded[categoryId] = false; // Start with all collapsed
    });
    setExpandedSections(initialExpanded);
  }

  const toggleSection = (categoryId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // Get categories that have components, in the order defined in UTILITY_CATEGORIES
  const activeCategories = UTILITY_CATEGORIES.filter(cat => 
    groupedComponents[cat.id] && groupedComponents[cat.id].length > 0
  );

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
        <XStack alignItems="center" gap="$2">
          <Wrench size={20} color="#6366f1" />
          <Text fontSize="$7" fontWeight="700" color="$gray12" letterSpacing={-0.5}>
            Build Your Service
          </Text>
        </XStack>
        <Text fontSize="$3" color={disabled ? "$red10" : "$gray11"} marginTop="$1.5" lineHeight="$2">
          {disabled ? 'Editing disabled (workflow is active)' : 'Drag components to canvas'}
        </Text>
      </YStack>

      <ScrollView flex={1}>
        <YStack padding="$3" gap="$3.5">
          {activeCategories.map((category) => {
            const comps = groupedComponents[category.id] || [];
            const Icon = category.icon;
            const categoryColor = category.color;
            const isExpanded = expandedSections[category.id] ?? false;

            return (
              <YStack key={category.id} gap="$2.5">
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
                  onPress={() => toggleSection(category.id)}
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
                  <Icon size={20} color={categoryColor} strokeWidth={2.5} />
                  <YStack flex={1} gap="$0.5">
                    <Text
                      fontSize="$4"
                      fontWeight="700"
                      color={categoryColor}
                      letterSpacing={-0.3}
                    >
                      {category.name}
                    </Text>
                    <Text
                      fontSize="$2"
                      color="$gray10"
                      lineHeight="$1"
                    >
                      {category.description}
                    </Text>
                  </YStack>
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

                {category.id !== activeCategories[activeCategories.length - 1].id && (
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

