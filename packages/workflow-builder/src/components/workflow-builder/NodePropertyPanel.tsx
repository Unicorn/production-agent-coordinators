'use client';

import { YStack, XStack, Text, Input, TextArea, Label, Button, ScrollView, Card, Switch, Select, Adapt, Sheet, Separator } from 'tamagui';
import { X, Save, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { CronExpressionBuilder } from '../cron/CronExpressionBuilder';
import { api } from '@/lib/trpc/client';

interface NodePropertyPanelProps {
  node: {
    id: string;
    type: 'activity' | 'agent' | 'signal' | 'query' | 'work-queue' | 'scheduled-workflow' | 'child-workflow' | 'api-endpoint' | 'condition' | 'phase' | 'retry' | 'state-variable';
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
      role="complementary"
      aria-label="Node properties panel"
    >
      {/* Header */}
      <XStack ai="center" jc="space-between">
        <YStack gap="$1">
          <Text fontSize="$5" fontWeight="600">Properties</Text>
          <Text fontSize="$2" color="$gray11" textTransform="capitalize">
            {node.type.replace('-', ' ')}
          </Text>
        </YStack>
        <Button
          size="$3"
          icon={X}
          onPress={onClose}
          chromeless
          aria-label="Close properties panel"
        />
      </XStack>

      {/* Content */}
      <ScrollView
        f={1}
        showsVerticalScrollIndicator={false}
        role="region"
        aria-label="Property fields"
      >
        <YStack gap="$4">
          {node.type === 'activity' && <ActivityProperties properties={properties} onChange={handlePropertyChange} node={node} />}
          {node.type === 'agent' && <AgentProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'signal' && <SignalProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'query' && <QueryProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'work-queue' && <WorkQueueProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'scheduled-workflow' && <ScheduledWorkflowProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'child-workflow' && <ChildWorkflowProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'api-endpoint' && <ApiEndpointProperties properties={properties} onChange={handlePropertyChange} availableSignals={availableSignals} availableQueries={availableQueries} />}
          {node.type === 'condition' && <ConditionProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'phase' && <PhaseProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'retry' && <RetryProperties properties={properties} onChange={handlePropertyChange} />}
          {node.type === 'state-variable' && <StateVariableProperties properties={properties} onChange={handlePropertyChange} />}
        </YStack>
      </ScrollView>

      {/* Actions */}
      <XStack
        gap="$2"
        jc="flex-end"
        borderTopWidth={1}
        borderTopColor="$borderColor"
        pt="$3"
        role="group"
        aria-label="Property panel actions"
      >
        <Button onPress={onClose} chromeless aria-label="Cancel changes">
          Cancel
        </Button>
        <Button
          themeInverse
          icon={hasChanges ? Save : Check}
          onPress={handleSave}
          disabled={!hasChanges}
          aria-label={hasChanges ? 'Save property changes' : 'Changes saved'}
        >
          {hasChanges ? 'Save Changes' : 'Saved'}
        </Button>
      </XStack>
    </YStack>
  );
}

// Activity Properties
function ActivityProperties({ properties, onChange, node }: any) {
  const componentName = properties.componentName || node?.data?.componentName;
  
  // Show specialized properties for database components
  if (componentName === 'postgresql-query') {
    return <PostgreSQLProperties properties={properties} onChange={onChange} />;
  }
  
  if (componentName === 'redis-command') {
    return <RedisProperties properties={properties} onChange={onChange} />;
  }
  
  if (componentName === 'typescript-processor') {
    return <TypeScriptProperties properties={properties} onChange={onChange} />;
  }
  
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

      <Separator />
      
      <YStack gap="$2">
        <Label>Retry Policy</Label>
        <Select
          value={properties.retryPolicy?.strategy || 'none'}
          onValueChange={(v) => onChange('retryPolicy', {
            ...properties.retryPolicy,
            strategy: v,
          })}
        >
          <Select.Trigger iconAfter={ChevronDown}>
            <Select.Value placeholder="Select retry strategy" />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport>
              <Select.Item index={0} value="none">
                <Select.ItemText>No retries</Select.ItemText>
              </Select.Item>
              <Select.Item index={1} value="keep-trying">
                <Select.ItemText>Keep trying until success</Select.ItemText>
              </Select.Item>
              <Select.Item index={2} value="fail-after-x">
                <Select.ItemText>Fail after X attempts</Select.ItemText>
              </Select.Item>
              <Select.Item index={3} value="exponential-backoff">
                <Select.ItemText>Exponential backoff</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select>
      </YStack>

      {properties.retryPolicy?.strategy === 'fail-after-x' && (
        <YStack gap="$2">
          <Label>Max Attempts</Label>
          <Input
            value={properties.retryPolicy?.maxAttempts?.toString() || ''}
            onChangeText={(v) => onChange('retryPolicy', {
              ...properties.retryPolicy,
              maxAttempts: v ? parseInt(v, 10) : undefined,
            })}
            placeholder="e.g., 3"
            keyboardType="numeric"
          />
        </YStack>
      )}

      {properties.retryPolicy?.strategy === 'exponential-backoff' && (
        <YStack gap="$3">
          <YStack gap="$2">
            <Label>Max Attempts</Label>
            <Input
              value={properties.retryPolicy?.maxAttempts?.toString() || ''}
              onChangeText={(v) => onChange('retryPolicy', {
                ...properties.retryPolicy,
                maxAttempts: v ? parseInt(v, 10) : undefined,
              })}
              placeholder="e.g., 5"
              keyboardType="numeric"
            />
          </YStack>
          <YStack gap="$2">
            <Label>Initial Interval</Label>
            <Input
              value={properties.retryPolicy?.initialInterval || ''}
              onChangeText={(v) => onChange('retryPolicy', {
                ...properties.retryPolicy,
                initialInterval: v,
              })}
              placeholder="e.g., 1s, 5m"
            />
            <Text fontSize="$1" color="$gray11">Format: 1s, 5m, 1h</Text>
          </YStack>
          <YStack gap="$2">
            <Label>Max Interval</Label>
            <Input
              value={properties.retryPolicy?.maxInterval || ''}
              onChangeText={(v) => onChange('retryPolicy', {
                ...properties.retryPolicy,
                maxInterval: v,
              })}
              placeholder="e.g., 1h"
            />
          </YStack>
          <YStack gap="$2">
            <Label>Backoff Coefficient</Label>
            <Input
              value={properties.retryPolicy?.backoffCoefficient?.toString() || ''}
              onChangeText={(v) => onChange('retryPolicy', {
                ...properties.retryPolicy,
                backoffCoefficient: v ? parseFloat(v) : undefined,
              })}
              placeholder="e.g., 2.0"
              keyboardType="decimal-pad"
            />
          </YStack>
        </YStack>
      )}
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


// Condition Properties
function ConditionProperties({ properties, onChange }: any) {
  const config = properties.config || {};
  
  const updateConfig = (key: string, value: any) => {
    onChange('config', { ...config, [key]: value });
  };

  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Condition Configuration</Text>

      <YStack gap="$2">
        <Label>Label</Label>
        <Input
          value={properties.label || ''}
          onChangeText={(v) => onChange('label', v)}
          placeholder="Condition Name"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Condition Expression</Label>
        <TextArea
          value={config.expression || ''}
          onChangeText={(v) => updateConfig('expression', v)}
          placeholder="result.success === true"
          rows={4}
        />
        <Text fontSize="$1" color="$gray11">
          JavaScript expression that evaluates to true/false
        </Text>
      </YStack>
    </YStack>
  );
}

// Phase Properties
function PhaseProperties({ properties, onChange }: any) {
  const config = properties.config || {};
  
  const updateConfig = (key: string, value: any) => {
    onChange('config', { ...config, [key]: value });
  };

  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Phase Configuration</Text>

      <YStack gap="$2">
        <Label>Phase Name</Label>
        <Input
          value={config.name || properties.label || ''}
          onChangeText={(v) => {
            updateConfig('name', v);
            onChange('label', v);
          }}
          placeholder="INITIALIZE"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Description</Label>
        <TextArea
          value={config.description || ''}
          onChangeText={(v) => updateConfig('description', v)}
          placeholder="Phase description"
          rows={3}
        />
      </YStack>

      <YStack gap="$2">
        <Label>Execution Mode</Label>
        <Select
          value={config.sequential !== false ? 'sequential' : 'concurrent'}
          onValueChange={(v) => updateConfig('sequential', v === 'sequential')}
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
              <Select.Item value="sequential" index={0}>
                <Select.ItemText>Sequential</Select.ItemText>
              </Select.Item>
              <Select.Item value="concurrent" index={1}>
                <Select.ItemText>Concurrent</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
      </YStack>

      {config.sequential === false && (
        <YStack gap="$2">
          <Label>Max Concurrency</Label>
          <Input
            value={config.maxConcurrency?.toString() || '4'}
            onChangeText={(v) => updateConfig('maxConcurrency', parseInt(v) || 4)}
            keyboardType="numeric"
            placeholder="4"
          />
        </YStack>
      )}
    </YStack>
  );
}

// Retry Properties
function RetryProperties({ properties, onChange }: any) {
  const config = properties.config || {};
  
  const updateConfig = (key: string, value: any) => {
    onChange('config', { ...config, [key]: value });
  };

  const updateBackoff = (key: string, value: any) => {
    updateConfig('backoff', { ...(config.backoff || {}), [key]: value });
  };

  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Retry Configuration</Text>

      <YStack gap="$2">
        <Label>Label</Label>
        <Input
          value={properties.label || ''}
          onChangeText={(v) => onChange('label', v)}
          placeholder="Retry Loop"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Max Attempts</Label>
        <Input
          value={config.maxAttempts?.toString() || '3'}
          onChangeText={(v) => updateConfig('maxAttempts', parseInt(v) || 3)}
          keyboardType="numeric"
          placeholder="3"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Retry On</Label>
        <Select
          value={config.retryOn || 'failure'}
          onValueChange={(v) => updateConfig('retryOn', v)}
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
              <Select.Item value="failure" index={0}>
                <Select.ItemText>Failure</Select.ItemText>
              </Select.Item>
              <Select.Item value="error" index={1}>
                <Select.ItemText>Error</Select.ItemText>
              </Select.Item>
              <Select.Item value="condition" index={2}>
                <Select.ItemText>Condition</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
      </YStack>

      {config.retryOn === 'condition' && (
        <YStack gap="$2">
          <Label>Condition Expression</Label>
          <TextArea
            value={config.condition || ''}
            onChangeText={(v) => updateConfig('condition', v)}
            placeholder="result.status === 'retry'"
            rows={3}
          />
        </YStack>
      )}

      <YStack gap="$2">
        <Label>Backoff Type</Label>
        <Select
          value={config.backoff?.type || 'exponential'}
          onValueChange={(v) => updateBackoff('type', v)}
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
              <Select.Item value="linear" index={1}>
                <Select.ItemText>Linear</Select.ItemText>
              </Select.Item>
              <Select.Item value="exponential" index={2}>
                <Select.ItemText>Exponential</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
      </YStack>

      {config.backoff?.type !== 'none' && (
        <>
          <YStack gap="$2">
            <Label>Initial Interval</Label>
            <Input
              value={config.backoff?.initialInterval || '1s'}
              onChangeText={(v) => updateBackoff('initialInterval', v)}
              placeholder="1s"
            />
            <Text fontSize="$1" color="$gray11">
              e.g., 1s, 1m, 5m
            </Text>
          </YStack>

          {config.backoff?.type === 'exponential' && (
            <YStack gap="$2">
              <Label>Multiplier</Label>
              <Input
                value={config.backoff?.multiplier?.toString() || '2'}
                onChangeText={(v) => updateBackoff('multiplier', parseFloat(v) || 2)}
                keyboardType="numeric"
                placeholder="2"
              />
            </YStack>
          )}
        </>
      )}

      <YStack gap="$2">
        <Label>Scope</Label>
        <Select
          value={config.scope || 'block'}
          onValueChange={(v) => updateConfig('scope', v)}
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
              <Select.Item value="activity" index={0}>
                <Select.ItemText>Activity</Select.ItemText>
              </Select.Item>
              <Select.Item value="agent" index={1}>
                <Select.ItemText>Agent</Select.ItemText>
              </Select.Item>
              <Select.Item value="child-workflow" index={2}>
                <Select.ItemText>Child Workflow</Select.ItemText>
              </Select.Item>
              <Select.Item value="block" index={3}>
                <Select.ItemText>Block</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
      </YStack>
    </YStack>
  );
}

// State Variable Properties
function StateVariableProperties({ properties, onChange }: any) {
  const config = properties.config || {};
  
  const updateConfig = (key: string, value: any) => {
    onChange('config', { ...config, [key]: value });
  };

  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">State Variable Configuration</Text>

      <YStack gap="$2">
        <Label>Variable Name</Label>
        <Input
          value={config.name || properties.label || ''}
          onChangeText={(v) => {
            updateConfig('name', v);
            onChange('label', v);
          }}
          placeholder="variableName"
        />
      </YStack>

      <YStack gap="$2">
        <Label>Operation</Label>
        <Select
          value={config.operation || 'set'}
          onValueChange={(v) => updateConfig('operation', v)}
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
              <Select.Item value="set" index={0}>
                <Select.ItemText>Set</Select.ItemText>
              </Select.Item>
              <Select.Item value="append" index={1}>
                <Select.ItemText>Append</Select.ItemText>
              </Select.Item>
              <Select.Item value="increment" index={2}>
                <Select.ItemText>Increment</Select.ItemText>
              </Select.Item>
              <Select.Item value="decrement" index={3}>
                <Select.ItemText>Decrement</Select.ItemText>
              </Select.Item>
              <Select.Item value="get" index={4}>
                <Select.ItemText>Get</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
      </YStack>

      {(config.operation === 'set' || config.operation === 'append') && (
        <YStack gap="$2">
          <Label>Value</Label>
          <TextArea
            value={typeof config.value === 'string' ? config.value : JSON.stringify(config.value || '')}
            onChangeText={(v) => {
              try {
                const parsed = JSON.parse(v);
                updateConfig('value', parsed);
              } catch {
                updateConfig('value', v);
              }
            }}
            placeholder="Value or JSON"
            rows={3}
          />
        </YStack>
      )}

      <YStack gap="$2">
        <Label>Scope</Label>
        <Select
          value={config.scope || 'workflow'}
          onValueChange={(v) => updateConfig('scope', v)}
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
              <Select.Item value="workflow" index={0}>
                <Select.ItemText>Workflow</Select.ItemText>
              </Select.Item>
              <Select.Item value="phase" index={1}>
                <Select.ItemText>Phase</Select.ItemText>
              </Select.Item>
              <Select.Item value="loop" index={2}>
                <Select.ItemText>Loop</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
      </YStack>

      {config.operation === 'set' && (
        <YStack gap="$2">
          <Label>Initial Value (optional)</Label>
          <TextArea
            value={typeof config.initialValue === 'string' ? config.initialValue : JSON.stringify(config.initialValue || '')}
            onChangeText={(v) => {
              try {
                const parsed = JSON.parse(v);
                updateConfig('initialValue', parsed);
              } catch {
                updateConfig('initialValue', v);
              }
            }}
            placeholder="Initial value or JSON"
            rows={2}
          />
        </YStack>
      )}
    </YStack>
  );
}

// PostgreSQL Properties
function PostgreSQLProperties({ properties, onChange }: any) {
  const projectId = properties.projectId;
  const { data: connections } = api.connections.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">PostgreSQL Query</Text>

      <YStack gap="$2">
        <Label>Connection</Label>
        <Select
          value={properties.connectionId || ''}
          onValueChange={(v) => onChange('connectionId', v)}
        >
          <Select.Trigger>
            <Select.Value placeholder="Select connection" />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport>
              {connections?.connections.map((conn) => (
                <Select.Item key={conn.id} value={conn.id}>
                  <Select.ItemText>{conn.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select>
      </YStack>

      <YStack gap="$2">
        <Label>Query</Label>
        <TextArea
          value={properties.query || ''}
          onChangeText={(v) => onChange('query', v)}
          placeholder="SELECT * FROM users WHERE id = $1"
          fontFamily="$mono"
          numberOfLines={6}
        />
      </YStack>

      <YStack gap="$2">
        <Label>Parameters (JSON array)</Label>
        <TextArea
          value={properties.parameters ? JSON.stringify(properties.parameters, null, 2) : ''}
          onChangeText={(v) => {
            try {
              const parsed = JSON.parse(v);
              onChange('parameters', parsed);
            } catch {
              // Invalid JSON, ignore
            }
          }}
          placeholder='["value1", "value2"]'
          fontFamily="$mono"
          numberOfLines={3}
        />
      </YStack>

      <Separator />
      
      <YStack gap="$2">
        <Label>Retry Policy</Label>
        <Select
          value={properties.retryPolicy?.strategy || 'exponential-backoff'}
          onValueChange={(v) => onChange('retryPolicy', {
            ...properties.retryPolicy,
            strategy: v,
          })}
        >
          <Select.Trigger iconAfter={ChevronDown}>
            <Select.Value placeholder="Select retry strategy" />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport>
              <Select.Item index={0} value="keep-trying">
                <Select.ItemText>Keep trying until success</Select.ItemText>
              </Select.Item>
              <Select.Item index={1} value="fail-after-x">
                <Select.ItemText>Fail after X attempts</Select.ItemText>
              </Select.Item>
              <Select.Item index={2} value="exponential-backoff">
                <Select.ItemText>Exponential backoff</Select.ItemText>
              </Select.Item>
              <Select.Item index={3} value="none">
                <Select.ItemText>No retries</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select>
      </YStack>

      {properties.retryPolicy?.strategy === 'fail-after-x' && (
        <YStack gap="$2">
          <Label>Max Attempts</Label>
          <Input
            value={properties.retryPolicy?.maxAttempts?.toString() || ''}
            onChangeText={(v) => onChange('retryPolicy', {
              ...properties.retryPolicy,
              maxAttempts: v ? parseInt(v, 10) : undefined,
            })}
            placeholder="e.g., 3"
            keyboardType="numeric"
          />
        </YStack>
      )}

      {properties.retryPolicy?.strategy === 'exponential-backoff' && (
        <YStack gap="$3">
          <YStack gap="$2">
            <Label>Max Attempts</Label>
            <Input
              value={properties.retryPolicy?.maxAttempts?.toString() || ''}
              onChangeText={(v) => onChange('retryPolicy', {
                ...properties.retryPolicy,
                maxAttempts: v ? parseInt(v, 10) : undefined,
              })}
              placeholder="e.g., 5"
              keyboardType="numeric"
            />
          </YStack>
          <YStack gap="$2">
            <Label>Initial Interval</Label>
            <Input
              value={properties.retryPolicy?.initialInterval || '1s'}
              onChangeText={(v) => onChange('retryPolicy', {
                ...properties.retryPolicy,
                initialInterval: v,
              })}
              placeholder="e.g., 1s, 5m"
            />
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}

// Redis Properties
function RedisProperties({ properties, onChange }: any) {
  const projectId = properties.projectId;
  const { data: connections } = api.connections.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">Redis Command</Text>

      <YStack gap="$2">
        <Label>Connection</Label>
        <Select
          value={properties.connectionId || ''}
          onValueChange={(v) => onChange('connectionId', v)}
        >
          <Select.Trigger>
            <Select.Value placeholder="Select connection" />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport>
              {connections?.connections.map((conn) => (
                <Select.Item key={conn.id} value={conn.id}>
                  <Select.ItemText>{conn.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select>
      </YStack>

      <YStack gap="$2">
        <Label>Command</Label>
        <Select
          value={properties.command || 'GET'}
          onValueChange={(v) => onChange('command', v)}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport>
              <Select.Item value="GET">GET</Select.Item>
              <Select.Item value="SET">SET</Select.Item>
              <Select.Item value="DEL">DEL</Select.Item>
              <Select.Item value="EXISTS">EXISTS</Select.Item>
              <Select.Item value="INCR">INCR</Select.Item>
              <Select.Item value="DECR">DECR</Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select>
      </YStack>

      <YStack gap="$2">
        <Label>Key</Label>
        <Input
          value={properties.key || ''}
          onChangeText={(v) => onChange('key', v)}
          placeholder="e.g., user:123"
        />
      </YStack>

      {(properties.command === 'SET') && (
        <YStack gap="$2">
          <Label>Value</Label>
          <TextArea
            value={properties.value || ''}
            onChangeText={(v) => onChange('value', v)}
            placeholder="Value to set"
            numberOfLines={3}
          />
        </YStack>
      )}

      <Separator />
      
      <YStack gap="$2">
        <Label>Retry Policy</Label>
        <Select
          value={properties.retryPolicy?.strategy || 'exponential-backoff'}
          onValueChange={(v) => onChange('retryPolicy', {
            ...properties.retryPolicy,
            strategy: v,
          })}
        >
          <Select.Trigger iconAfter={ChevronDown}>
            <Select.Value placeholder="Select retry strategy" />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport>
              <Select.Item index={0} value="keep-trying">
                <Select.ItemText>Keep trying until success</Select.ItemText>
              </Select.Item>
              <Select.Item index={1} value="fail-after-x">
                <Select.ItemText>Fail after X attempts</Select.ItemText>
              </Select.Item>
              <Select.Item index={2} value="exponential-backoff">
                <Select.ItemText>Exponential backoff</Select.ItemText>
              </Select.Item>
              <Select.Item index={3} value="none">
                <Select.ItemText>No retries</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select>
      </YStack>

      {properties.retryPolicy?.strategy === 'fail-after-x' && (
        <YStack gap="$2">
          <Label>Max Attempts</Label>
          <Input
            value={properties.retryPolicy?.maxAttempts?.toString() || ''}
            onChangeText={(v) => onChange('retryPolicy', {
              ...properties.retryPolicy,
              maxAttempts: v ? parseInt(v, 10) : undefined,
            })}
            placeholder="e.g., 3"
            keyboardType="numeric"
          />
        </YStack>
      )}

      {properties.retryPolicy?.strategy === 'exponential-backoff' && (
        <YStack gap="$3">
          <YStack gap="$2">
            <Label>Max Attempts</Label>
            <Input
              value={properties.retryPolicy?.maxAttempts?.toString() || ''}
              onChangeText={(v) => onChange('retryPolicy', {
                ...properties.retryPolicy,
                maxAttempts: v ? parseInt(v, 10) : undefined,
              })}
              placeholder="e.g., 5"
              keyboardType="numeric"
            />
          </YStack>
          <YStack gap="$2">
            <Label>Initial Interval</Label>
            <Input
              value={properties.retryPolicy?.initialInterval || '1s'}
              onChangeText={(v) => onChange('retryPolicy', {
                ...properties.retryPolicy,
                initialInterval: v,
              })}
              placeholder="e.g., 1s, 5m"
            />
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}

// TypeScript Properties
function TypeScriptProperties({ properties, onChange }: any) {
  return (
    <YStack gap="$3">
      <Text fontSize="$4" fontWeight="600">TypeScript Processor</Text>

      <YStack gap="$2">
        <Label>Code</Label>
        <TextArea
          value={properties.code || ''}
          onChangeText={(v) => onChange('code', v)}
          placeholder="// Process input data
export async function process(input: any): Promise<any> {
  // Your code here
  return input;
}"
          fontFamily="$mono"
          numberOfLines={12}
        />
      </YStack>

      <YStack gap="$2">
        <Label>Input Schema (JSON)</Label>
        <TextArea
          value={properties.inputSchema ? JSON.stringify(properties.inputSchema, null, 2) : ''}
          onChangeText={(v) => {
            try {
              const parsed = JSON.parse(v);
              onChange('inputSchema', parsed);
            } catch {
              // Invalid JSON, ignore
            }
          }}
          placeholder='{"type": "object", "properties": {...}}'
          fontFamily="$mono"
          numberOfLines={4}
        />
      </YStack>

      <YStack gap="$2">
        <Label>Output Schema (JSON)</Label>
        <TextArea
          value={properties.outputSchema ? JSON.stringify(properties.outputSchema, null, 2) : ''}
          onChangeText={(v) => {
            try {
              const parsed = JSON.parse(v);
              onChange('outputSchema', parsed);
            } catch {
              // Invalid JSON, ignore
            }
          }}
          placeholder='{"type": "object", "properties": {...}}'
          fontFamily="$mono"
          numberOfLines={4}
        />
      </YStack>
    </YStack>
  );
}
