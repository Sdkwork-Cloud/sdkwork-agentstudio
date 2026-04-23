import React from 'react';
import { ChannelWorkspace, type ChannelWorkspaceItem } from '@sdkwork/claw-ui';

interface InstanceDetailChannelsSectionProps {
  items: ChannelWorkspaceItem[];
  canEditConfigChannels: boolean;
  configFilePath: string | null;
  selectedChannelId: string | null;
  valuesByChannelId: Record<string, Record<string, string>>;
  error: string | null;
  isSaving: boolean;
  formatWorkbenchLabel: (value: string) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  onOpenOfficialLink: (href: string) => Promise<void> | void;
  onSelectedChannelIdChange: (channelId: string | null) => void;
  onFieldChange: (fieldKey: string, value: string) => Promise<void> | void;
  onSave: () => Promise<void> | void;
  onDeleteConfiguration: () => Promise<void> | void;
  onToggleEnabled: (channelId: string, nextEnabled: boolean) => Promise<void> | void;
}

export function InstanceDetailChannelsSection({
  items,
  canEditConfigChannels,
  configFilePath,
  selectedChannelId,
  valuesByChannelId,
  error,
  isSaving,
  formatWorkbenchLabel,
  t,
  onOpenOfficialLink,
  onSelectedChannelIdChange,
  onFieldChange,
  onSave,
  onDeleteConfiguration,
  onToggleEnabled,
}: InstanceDetailChannelsSectionProps) {
  return (
    <ChannelWorkspace
      items={items}
      variant={canEditConfigChannels ? 'management' : 'summary'}
      configFilePath={configFilePath}
      selectedChannelId={canEditConfigChannels ? selectedChannelId : null}
      valuesByChannelId={valuesByChannelId}
      error={error}
      isSaving={isSaving}
      texts={{
        configFileLabel: formatWorkbenchLabel('configFile'),
        statusActive: t('channels.page.status.active'),
        statusConnected: t('dashboard.status.connected'),
        statusDisconnected: t('dashboard.status.disconnected'),
        statusNotConfigured: t('dashboard.status.not_configured'),
        actionConnect: t('channels.page.actions.connect'),
        actionConfigure: t('channels.page.actions.configure'),
        actionDownloadApp: t('channels.page.actions.downloadApp'),
        actionOpenOfficialSite: t('channels.page.actions.openOfficialSite'),
        actionEnableChannel: (name: string) => t('channels.page.actions.enableChannel', { name }),
        metricConfiguredFields: t('instances.detail.instanceWorkbench.metrics.configuredFields'),
        metricSetupSteps: t('instances.detail.instanceWorkbench.metrics.setupSteps'),
        metricDeliveryState: t('instances.detail.instanceWorkbench.metrics.deliveryState'),
        stateEnabled: t('instances.detail.instanceWorkbench.state.enabled'),
        statePending: t('instances.detail.instanceWorkbench.state.pending'),
        summaryFallback: t('instances.detail.instanceWorkbench.empty.channels'),
        panelEyebrow: t('channels.page.panel.configuration'),
        setupGuideTitle: t('channels.page.panel.setupGuide'),
        credentialsTitle: t('channels.page.panel.credentials'),
        saveAction: t('common.save'),
        savingAction: t('common.loading'),
        deleteConfigurationAction: t('channels.page.actions.deleteConfiguration'),
        validationRequiredField: (fieldLabel: string) =>
          t('channels.page.validation.requiredField', { field: fieldLabel }),
      }}
      onOpenOfficialLink={(_channel, link) => void onOpenOfficialLink(link.href)}
      onSelectedChannelIdChange={onSelectedChannelIdChange}
      onFieldChange={(_channel, fieldKey, value) => {
        void onFieldChange(fieldKey, value);
      }}
      onSave={() => void onSave()}
      onDeleteConfiguration={() => void onDeleteConfiguration()}
      onToggleEnabled={(channel, nextEnabled) => {
        void onToggleEnabled(channel.id, nextEnabled);
      }}
    />
  );
}
