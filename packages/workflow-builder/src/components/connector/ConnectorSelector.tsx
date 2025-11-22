'use client';

import { YStack, XStack, Text, Button, Select, Label, Spinner } from 'tamagui';
import { Plus, Check } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/trpc/client';
import { ConnectorCreationModal } from './ConnectorCreationModal';

interface ConnectorSelectorProps {
  projectId: string;
  connectorType: 'email' | 'slack' | 'database' | 'api' | 'oauth';
  value?: string; // Selected connector ID
  onChange: (connectorId: string | undefined) => void;
  allowNewConnector?: boolean;
  disabled?: boolean;
}

/**
 * Reusable connector selector component for component configuration.
 * 
 * Supports selecting existing connectors or creating new ones.
 * Works with both the existing connections system (database) and
 * the new connectors system (email, slack, api, oauth).
 */
export function ConnectorSelector({
  projectId,
  connectorType,
  value,
  onChange,
  allowNewConnector = true,
  disabled = false,
}: ConnectorSelectorProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const utils = api.useUtils();

  // For database connectors, use the existing connections API
  const isDatabaseConnector = connectorType === 'database';
  
  const { data: connectionsData, isLoading: connectionsLoading } = 
    api.connections.list.useQuery(
      { projectId },
      { enabled: isDatabaseConnector && !!projectId }
    );

  // TODO: When connectors API is implemented, use it for non-database connectors
  // const { data: connectorsData, isLoading: connectorsLoading } = 
  //   api.connectors.list.useQuery(
  //     { projectId, connectorType },
  //     { enabled: !isDatabaseConnector && !!projectId }
  //   );

  const connectors = isDatabaseConnector
    ? connectionsData?.connections.map(conn => ({
        id: conn.id,
        name: conn.name,
        type: conn.connectionType,
      })) || []
    : []; // TODO: Map from connectorsData when available

  const isLoading = isDatabaseConnector ? connectionsLoading : false; // TODO: connectorsLoading

  const handleCreateSuccess = (newConnectorId: string) => {
    // Invalidate queries to refresh the list
    if (isDatabaseConnector) {
      utils.connections.list.invalidate({ projectId });
    } else {
      // TODO: utils.connectors.list.invalidate({ projectId, connectorType });
    }
    
    // Select the newly created connector
    onChange(newConnectorId);
    setShowCreateModal(false);
  };

  return (
    <YStack gap="$2">
      <XStack ai="center" jc="space-between">
        <Label htmlFor="connector-select">
          {connectorType === 'database' ? 'Database Connector' :
           connectorType === 'email' ? 'Email Connector' :
           connectorType === 'slack' ? 'Slack Connector' :
           connectorType === 'api' ? 'API Connector' :
           'OAuth Connector'}
        </Label>
        {allowNewConnector && (
          <Button
            size="$2"
            icon={Plus}
            onPress={() => setShowCreateModal(true)}
            disabled={disabled}
            chromeless
          >
            Create New
          </Button>
        )}
      </XStack>

      {isLoading ? (
        <XStack ai="center" gap="$2" p="$3">
          <Spinner size="small" />
          <Text fontSize="$2" color="$gray11">Loading connectors...</Text>
        </XStack>
      ) : (
        <Select
          value={value || ''}
          onValueChange={(v) => onChange(v || undefined)}
          disabled={disabled}
        >
          <Select.Trigger id="connector-select" width="100%">
            <Select.Value placeholder={`Select ${connectorType} connector`} />
          </Select.Trigger>
          <Select.Content>
            <Select.Viewport>
              <Select.Item index={-1} value="">
                <Select.ItemText>None</Select.ItemText>
                {!value && (
                  <Select.ItemIndicator marginLeft="auto">
                    <Check size={16} />
                  </Select.ItemIndicator>
                )}
              </Select.Item>
              {connectors.map((connector, index) => (
                <Select.Item key={connector.id} index={index} value={connector.id}>
                  <Select.ItemText>{connector.name}</Select.ItemText>
                  {value === connector.id && (
                    <Select.ItemIndicator marginLeft="auto">
                      <Check size={16} />
                    </Select.ItemIndicator>
                  )}
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select>
      )}

      {value && (
        <Text fontSize="$2" color="$gray11">
          Selected: {connectors.find(c => c.id === value)?.name || 'Unknown'}
        </Text>
      )}

      {showCreateModal && (
        <ConnectorCreationModal
          projectId={projectId}
          connectorType={connectorType}
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onSuccess={handleCreateSuccess}
        />
      )}
    </YStack>
  );
}

