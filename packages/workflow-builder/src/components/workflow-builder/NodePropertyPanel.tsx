'use client';

import { YStack, XStack, Text, Input, TextArea, Label, Button, ScrollView, Card, Switch, Select, Adapt, Sheet, Separator } from 'tamagui';
import { X, Save, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { CronExpressionBuilder } from '../cron/CronExpressionBuilder';

interface NodePropertyPanelProps {
  node: {
    id: string;
    type: 'activity' | 'agent' | 'signal' | 'query' | 'work-queue' | 'scheduled-workflow' | 'child-workflow' | 'api-endpoint';
    data: Record<string, any>;
  } | null;
  onClose: () => void;
  onSave: (nodeId: string, updates: Record<string, any>) => void;
  availableSignals?: Array<{ id: string; signal_name: string }>;
  availableQueries?: Array<{ id: string; query_name: string }>;
}

export function NodePropertyPanel({ node, onClose, onSave, availableSignals = [], availableQueries = [] }: NodePropertyPanelProps) {
  const [properties, setProperties] = useState(node?.data || {});
  const [hasChanges, setHasChanges] = useState(false);

  if (!node) return null;

  const handlePropertyChange = (key: string, value: any) => {
    setProperties(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(node.id, properties);
    setHasChanges(false);
  };

  return (
    <YStack
      f={1}
      gap="$3"
      p="$4"
      bg="$background"
      borderLeftWidth={1}
      borderLeftColor="$borderColor"
      maxWidth={350}
      position="relative"
    >
      {/* Header */}
      <XStack ai="center" jc="space-between">
        <YStack gap="$1">
          <Text fontSize="$5" fontWeight="600">Properties</Text>
          <Text fontSize="$2" color="$gray11" textTransform="capitalize">
            {node.type.replace('-', ' ')}
          </Text>
        </YStack>
        <Button size="$3" icon={X} onPress={onClose} chromeless />
      </XStack>

      {/* Content */}
      <ScrollView f={1} showsVerticalScrollIndicator={false}>
        <YStack gap="$4">
          {node.type === 'activity' && <ActivityProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'agent' && <AgentProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'signal' && <SignalProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'query' && <QueryProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'work-queue' && <WorkQueueProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'scheduled-workflow' && <ScheduledWorkflowProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'child-workflow' && <ChildWorkflowProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'api-endpoint' && <ApiEndpointProperties properties={properties} onChange={handlePropertyChange} availableSignals={availableSignals} availableQueries={availableQueries} />}
        </YStack>
      </ScrollView>

      {/* Actions */}
      <XStack gap="$2" jc="flex-end" borderTopWidth={1} borderTopColor="$borderColor" pt="$3">
        <Button onPress={onClose} chromeless>
          Cancel
        </Button>
        <Button
          themeInverse
          icon={hasChanges ? Save : Check}
          onPress={handleSave}
          disabled={!hasChanges}
        >
          {hasChanges ? 'Save Changes' : 'Saved'}
        </Button>
      </XStack>
    </YStack>
  );
}

// Activity Properties
function ActivityProperties({ properties, onChange }: any) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Activity Configuration</Text>

      <YStack gap="$2">
        <Label>Activity Name</Label>
        <Input
          value={properties.activityName || ''}
          onChangeText={(v) => onChange('activityName', v)}
          placeholder="e.g., processDataActivity"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Task Queue</Label>
        <Input
          value={properties.taskQueue || ''}
          onChangeText={(v) => onChange('taskQueue', v)}
          placeholder="e.g., data-processing-queue"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Timeout (seconds)</Label>
        <Input
          value={properties.timeout || ''}
          onChangeText={(v) => onChange('timeout', v)}
          placeholder="300"
          keyboardType="numeric"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Retry Policy</Label>
        <Card bg="$gray2" p="$3">
          <YStack gap="$2">
            <Input
              placeholder="Max Attempts"
              value={properties.retryMaxAttempts || ''}
              onChangeText={(v) => onChange('retryMaxAttempts', v)}
              keyboardType="numeric"
            />
            <Input
              placeholder="Initial Interval (ms)"
              value={properties.retryInitialInterval || ''}
              onChangeText={(v) => onChange('retryInitialInterval', v)}
              keyboardType="numeric"
            />
          </YStack>
        </Card>
      </YStack>
    </YStack>
  );
}

// Agent Properties
function AgentProperties({ properties, onChange }: any) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Agent Configuration</Text>

      <YStack gap="$2">
        <Label>Agent Prompt ID</Label>
        <Input
          value={properties.agentPromptId || ''}
          onChangeText={(v) => onChange('agentPromptId', v)}
          placeholder="Select or enter prompt ID"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Model</Label>
        <Select value={properties.model || 'gpt-4'} onValueChange={(v) => onChange('model', v)}>
          <Select.Trigger iconAfter={ChevronDown}>
            <Select.Value placeholder="Select model" />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport>
              <Select.Item index={0} value="gpt-4">
                <Select.ItemText>GPT-4</Select.ItemText>
              </Select.Item>
              <Select.Item index={1} value="gpt-4-turbo">
                <Select.ItemText>GPT-4 Turbo</Select.ItemText>
              </Select.Item>
              <Select.Item index={2} value="claude-3-opus">
                <Select.ItemText>Claude 3 Opus</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select>
      </YStack>

      <YStack gap="$2">
        <Label>Temperature</Label>
        <Input
          value={properties.temperature || '0.7'}
          onChangeText={(v) => onChange('temperature', v)}
          keyboardType="decimal-pad"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Max Tokens</Label>
        <Input
          value={properties.maxTokens || ''}
          onChangeText={(v) => onChange('maxTokens', v)}
          keyboardType="numeric"
        />
      </YStack>
    </YStack>
  );
}

// Signal Properties
function SignalProperties({ properties, onChange }: any) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Signal Configuration</Text>

      <YStack gap="$2">
        <Label>Signal Name</Label>
        <Input
          value={properties.signalName || ''}
          onChangeText={(v) => onChange('signalName', v)}
          placeholder="e.g., updateStatus"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Parameters Schema (JSON)</Label>
        <TextArea
          value={properties.parametersSchema || ''}
          onChangeText={(v) => onChange('parametersSchema', v)}
          placeholder='{"type": "object", "properties": {...}}'
          fontFamily="$mono"
          numberOfLines={5}
        />
      </YStack>
    </YStack>
  );
}

// Query Properties
function QueryProperties({ properties, onChange }: any) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Query Configuration</Text>

      <YStack gap="$2">
        <Label>Query Name</Label>
        <Input
          value={properties.queryName || ''}
          onChangeText={(v) => onChange('queryName', v)}
          placeholder="e.g., getStatus"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Return Type Schema (JSON)</Label>
        <TextArea
          value={properties.returnTypeSchema || ''}
          onChangeText={(v) => onChange('returnTypeSchema', v)}
          placeholder='{"type": "object", "properties": {...}}'
          fontFamily="$mono"
          numberOfLines={5}
        />
      </YStack>
    </YStack>
  );
}

// Work Queue Properties
function WorkQueueProperties({ properties, onChange }: any) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Work Queue Configuration</Text>

      <YStack gap="$2">
        <Label>Queue Name</Label>
        <Input
          value={properties.queueName || ''}
          onChangeText={(v) => onChange('queueName', v)}
          placeholder="e.g., pendingTasks"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Priority</Label>
        <Select value={properties.priority || 'fifo'} onValueChange={(v) => onChange('priority', v)}>
          <Select.Trigger iconAfter={ChevronDown}>
            <Select.Value placeholder="Select priority" />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport>
              <Select.Item index={0} value="fifo">
                <Select.ItemText>FIFO</Select.ItemText>
              </Select.Item>
              <Select.Item index={1} value="lifo">
                <Select.ItemText>LIFO</Select.ItemText>
              </Select.Item>
              <Select.Item index={2} value="priority">
                <Select.ItemText>Priority</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select>
      </YStack>

      <XStack ai="center" gap="$3">
        <Switch checked={properties.deduplicate || false} onCheckedChange={(v) => onChange('deduplicate', v)}>
          <Switch.Thumb animation="quick" />
        </Switch>
        <Label flex={1}>Enable Deduplication</Label>
      </XStack>
    </YStack>
  );
}

// Scheduled Workflow Properties
function ScheduledWorkflowProperties({ properties, onChange }: any) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Scheduled Workflow Configuration</Text>

      <YStack gap="$2">
        <Label>Workflow Name</Label>
        <Input
          value={properties.workflowName || ''}
          onChangeText={(v) => onChange('workflowName', v)}
          placeholder="e.g., dailyCleanup"
        />
      </YStack>

      <Separator />

      <CronExpressionBuilder
        value={properties.cronExpression || ''}
        onChange={(v) => onChange('cronExpression', v)}
      />

      <Separator />

      <XStack ai="center" gap="$3">
        <Switch checked={properties.startImmediately || false} onCheckedChange={(v) => onChange('startImmediately', v)}>
          <Switch.Thumb animation="quick" />
        </Switch>
        <Label flex={1}>Start Immediately</Label>
      </XStack>

      <XStack ai="center" gap="$3">
        <Switch checked={properties.endWithParent || false} onCheckedChange={(v) => onChange('endWithParent', v)}>
          <Switch.Thumb animation="quick" />
        </Switch>
        <Label flex={1}>End with Parent</Label>
      </XStack>
    </YStack>
  );
}

// Child Workflow Properties
function ChildWorkflowProperties({ properties, onChange }: any) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Child Workflow Configuration</Text>

      <YStack gap="$2">
        <Label>Workflow Type</Label>
        <Input
          value={properties.workflowType || ''}
          onChangeText={(v) => onChange('workflowType', v)}
          placeholder="e.g., processOrderWorkflow"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Task Queue</Label>
        <Input
          value={properties.taskQueue || ''}
          onChangeText={(v) => onChange('taskQueue', v)}
          placeholder="e.g., order-processing"
        />
      </YStack>

      <Separator />

      <Text fontSize="$3" fontWeight="600">Parent Communication</Text>

      <YStack gap="$2">
        <Label>Signal to Parent (optional)</Label>
        <Input
          value={properties.signalToParent || ''}
          onChangeText={(v) => onChange('signalToParent', v)}
          placeholder="e.g., orderCompleted"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Query Parent (optional)</Label>
        <Input
          value={properties.queryParent || ''}
          onChangeText={(v) => onChange('queryParent', v)}
          placeholder="e.g., getOrderStatus"
        />
      </YStack>

      <Separator />

      <Text fontSize="$3" fontWeight="600">Dependency Blocking</Text>

      <YStack gap="$2">
        <Label>Block Until Work Queue</Label>
        <Input
          value={properties.blockUntilQueue || ''}
          onChangeText={(v) => onChange('blockUntilQueue', v)}
          placeholder="e.g., prerequisites"
        />
      </YStack>
    </YStack>
  );
}

// API Endpoint Properties
function ApiEndpointProperties({ properties, onChange, availableSignals = [], availableQueries = [] }: any) {
  const config = properties.config || {};
  const targetType = config.targetType || 'start';

  const updateConfig = (key: string, value: any) => {
    onChange('config', { ...config, [key]: value });
  };

  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">API Endpoint Configuration</Text>

      <YStack gap="$2">
        <Label>HTTP Method</Label>
        <Select value={config.method || 'POST'} onValueChange={(v) => updateConfig('method', v)}>
          <Select.Trigger>
            <Select.Value placeholder="Select method" />
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
              <Select.Item value="GET" index={0}>
                <Select.ItemText>GET</Select.ItemText>
              </Select.Item>
              <Select.Item value="POST" index={1}>
                <Select.ItemText>POST</Select.ItemText>
              </Select.Item>
              <Select.Item value="PUT" index={2}>
                <Select.ItemText>PUT</Select.ItemText>
              </Select.Item>
              <Select.Item value="DELETE" index={3}>
                <Select.ItemText>DELETE</Select.ItemText>
              </Select.Item>
              <Select.Item value="PATCH" index={4}>
                <Select.ItemText>PATCH</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
      </YStack>

      <YStack gap="$2">
        <Label>Endpoint Path</Label>
        <Input
          value={config.endpointPath || ''}
          onChangeText={(v) => updateConfig('endpointPath', v)}
          placeholder="/orders"
        />
        <Text fontSize="$1" color="$gray10">
          Relative path (e.g., /orders, /api/v1/users)
        </Text>
      </YStack>

      <YStack gap="$2">
        <Label>Description</Label>
        <TextArea
          value={config.description || ''}
          onChangeText={(v) => updateConfig('description', v)}
          placeholder="What this endpoint does"
          minHeight={60}
        />
      </YStack>

      <Separator />

      <YStack gap="$2">
        <Label>Target Type</Label>
        <Select value={targetType} onValueChange={(v) => updateConfig('targetType', v)}>
          <Select.Trigger>
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
            <Select.ScrollUpButton />
            <Select.Viewport>
              <Select.Item value="start" index={0}>
                <Select.ItemText>Start Workflow</Select.ItemText>
              </Select.Item>
              <Select.Item value="signal" index={1}>
                <Select.ItemText>Send Signal</Select.ItemText>
              </Select.Item>
              <Select.Item value="query" index={2}>
                <Select.ItemText>Query State</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
      </YStack>

      {targetType === 'signal' && (
        <YStack gap="$2">
          <Label>Signal Name</Label>
          <Select
            value={config.targetName || ''}
            onValueChange={(v) => updateConfig('targetName', v)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Select signal" />
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
                {availableSignals.map((signal: any, index: number) => (
                  <Select.Item key={signal.id} value={signal.signal_name} index={index}>
                    <Select.ItemText>{signal.signal_name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select>
        </YStack>
      )}

      {targetType === 'query' && (
        <YStack gap="$2">
          <Label>Query Name</Label>
          <Select
            value={config.targetName || ''}
            onValueChange={(v) => updateConfig('targetName', v)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Select query" />
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
                {availableQueries.map((query: any, index: number) => (
                  <Select.Item key={query.id} value={query.query_name} index={index}>
                    <Select.ItemText>{query.query_name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select>
        </YStack>
      )}

      <Separator />

      <YStack gap="$2">
        <Label>Authentication</Label>
        <Select
          value={config.authType || 'api-key'}
          onValueChange={(v) => updateConfig('authType', v)}
        >
          <Select.Trigger>
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
            <Select.ScrollUpButton />
            <Select.Viewport>
              <Select.Item value="none" index={0}>
                <Select.ItemText>None</Select.ItemText>
              </Select.Item>
              <Select.Item value="api-key" index={1}>
                <Select.ItemText>API Key</Select.ItemText>
              </Select.Item>
              <Select.Item value="jwt" index={2}>
                <Select.ItemText>JWT</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
      </YStack>

      <YStack gap="$2">
        <Label>Rate Limit (per minute)</Label>
        <Input
          value={config.rateLimitPerMinute?.toString() || '60'}
          onChangeText={(v) => updateConfig('rateLimitPerMinute', parseInt(v) || 60)}
          keyboardType="numeric"
          placeholder="60"
        />
      </YStack>
    </YStack>
  );
}

