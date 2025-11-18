'use client';

import { YStack, XStack, Text, Card, Button, ScrollView, Input } from 'tamagui';
import { Activity, Bot, Send, Search, Inbox, Clock, Plus, Globe } from 'lucide-react';
import { useState } from 'react';

interface NodeType {
  id: string;
  type: 'activity' | 'agent' | 'signal' | 'query' | 'work-queue' | 'scheduled-workflow';
  name: string;
  description: string;
  icon: typeof Activity;
  color: string;
  metadata?: Record<string, any>;
}

interface NodeTypesPaletteProps {
  availableComponents: any[];
  workQueues: any[];
  signals: any[];
  queries: any[];
  onAddNode?: (nodeType: NodeType) => void;
}

export function NodeTypesPalette({
  availableComponents,
  workQueues,
  signals,
  queries,
  onAddNode,
}: NodeTypesPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Build node types from available data
  const nodeTypes: NodeType[] = [
    // Activities from components
    ...availableComponents
      .filter(c => c.component_type_id === 'activity')
      .map(c => ({
        id: c.id,
        type: 'activity' as const,
        name: c.name,
        description: c.description || 'Temporal Activity',
        icon: Activity,
        color: '$blue9',
        metadata: c,
      })),
    
    // Agents from components
    ...availableComponents
      .filter(c => c.component_type_id === 'agent')
      .map(c => ({
        id: c.id,
        type: 'agent' as const,
        name: c.name,
        description: c.description || 'AI Agent',
        icon: Bot,
        color: '$purple9',
        metadata: c,
      })),
    
    // Work Queues
    ...workQueues.map(wq => ({
      id: wq.id,
      type: 'work-queue' as const,
      name: wq.queue_name,
      description: wq.description || 'Work Queue',
      icon: Inbox,
      color: '$yellow9',
      metadata: wq,
    })),
    
    // Signals
    ...signals.map(s => ({
      id: s.id,
      type: 'signal' as const,
      name: s.signal_name,
      description: s.description || 'Signal Handler',
      icon: Send,
      color: '$orange9',
      metadata: s,
    })),
    
    // Queries
    ...queries.map(q => ({
      id: q.id,
      type: 'query' as const,
      name: q.query_name,
      description: q.description || 'Query Handler',
      icon: Search,
      color: '$teal9',
      metadata: q,
    })),
    
    // API Endpoint (built-in node type)
    {
      id: 'api-endpoint',
      type: 'api-endpoint' as const,
      name: 'API Endpoint',
      description: 'Expose workflow as HTTP API endpoint',
      icon: Globe,
      color: '$green9',
      metadata: {},
    },
  ];

  // Filter by search and category
  const filteredNodeTypes = nodeTypes.filter(node => {
    const matchesSearch = searchQuery === '' || 
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategory || node.type === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Group by type
  const groupedNodeTypes = filteredNodeTypes.reduce((acc, node) => {
    if (!acc[node.type]) {
      acc[node.type] = [];
    }
    acc[node.type].push(node);
    return acc;
  }, {} as Record<string, NodeType[]>);

  const categories = [
    { id: 'activity', label: 'Activities', icon: Activity, color: '$blue9' },
    { id: 'agent', label: 'Agents', icon: Bot, color: '$purple9' },
    { id: 'work-queue', label: 'Work Queues', icon: Inbox, color: '$yellow9' },
    { id: 'signal', label: 'Signals', icon: Send, color: '$orange9' },
    { id: 'query', label: 'Queries', icon: Search, color: '$teal9' },
    { id: 'scheduled-workflow', label: 'Scheduled', icon: Clock, color: '$pink9' },
  ];

  return (
    <YStack f={1} gap="$3" p="$3" bg="$background" borderRightWidth={1} borderRightColor="$borderColor" maxWidth={300}>
      {/* Header */}
      <YStack gap="$2">
        <Text fontSize="$5" fontWeight="600">Components</Text>
        <Text fontSize="$2" color="$gray11">
          Drag onto canvas to add
        </Text>
      </YStack>

      {/* Search */}
      <Input
        placeholder="Search components..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        size="$3"
      />

      {/* Category Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap="$2">
          <Button
            size="$2"
            onPress={() => setSelectedCategory(null)}
            bg={!selectedCategory ? '$blue5' : '$gray3'}
            borderColor={!selectedCategory ? '$blue7' : '$gray6'}
          >
            All
          </Button>
          {categories.map(cat => {
            const count = nodeTypes.filter(n => n.type === cat.id).length;
            return (
              <Button
                key={cat.id}
                size="$2"
                icon={cat.icon}
                onPress={() => setSelectedCategory(cat.id)}
                bg={selectedCategory === cat.id ? `${cat.color.replace('9', '3')}` : '$gray3'}
                borderColor={selectedCategory === cat.id ? `${cat.color.replace('9', '6')}` : '$gray6'}
              >
                {cat.label} ({count})
              </Button>
            );
          })}
        </XStack>
      </ScrollView>

      {/* Node Types List */}
      <ScrollView f={1} showsVerticalScrollIndicator={false}>
        <YStack gap="$3">
          {Object.entries(groupedNodeTypes).map(([type, nodes]) => {
            const category = categories.find(c => c.id === type);
            if (!category) return null;

            return (
              <YStack key={type} gap="$2">
                <XStack ai="center" gap="$2">
                  <category.icon size={16} color={category.color} />
                  <Text fontSize="$3" fontWeight="600" color={category.color}>
                    {category.label}
                  </Text>
                  <Text fontSize="$2" color="$gray11">({nodes.length})</Text>
                </XStack>

                <YStack gap="$2">
                  {nodes.map(node => (
                    <Card
                      key={node.id}
                      p="$3"
                      pressStyle={{ scale: 0.98 }}
                      cursor="grab"
                      onPress={() => onAddNode?.(node)}
                      hoverStyle={{ bg: '$gray3' }}
                    >
                      <YStack gap="$1">
                        <XStack ai="center" gap="$2">
                          <node.icon size={16} color={node.color} />
                          <Text fontSize="$3" fontWeight="600" color={node.color}>
                            {node.name}
                          </Text>
                        </XStack>
                        <Text fontSize="$2" color="$gray11" numberOfLines={2}>
                          {node.description}
                        </Text>
                      </YStack>
                    </Card>
                  ))}
                </YStack>
              </YStack>
            );
          })}

          {/* Empty State */}
          {filteredNodeTypes.length === 0 && (
            <Card p="$4" ai="center" gap="$2">
              <Text fontSize="$3" color="$gray11">
                No components found
              </Text>
              {searchQuery && (
                <Button
                  size="$2"
                  onPress={() => setSearchQuery('')}
                  chromeless
                >
                  Clear search
                </Button>
              )}
            </Card>
          )}

          {/* Add New Component CTA */}
          <Card p="$3" bg="$blue2" borderWidth={1} borderColor="$blue6">
            <YStack gap="$2" ai="center">
              <Plus size={20} color="$blue11" />
              <Text fontSize="$2" color="$blue11" textAlign="center">
                Need a new component type?
              </Text>
              <Button size="$2" bg="$blue5" color="$blue11">
                Create Component
              </Button>
            </YStack>
          </Card>
        </YStack>
      </ScrollView>
    </YStack>
  );
}

