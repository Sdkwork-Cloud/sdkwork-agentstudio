import type { ChannelWorkspaceItem } from '@sdkwork/claw-ui';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import {
  applyOpenClawConfigChannelDraftChange,
  type OpenClawConfigChannelDrafts,
} from './openClawConfigChannelMutationSupport.ts';

export interface BuildOpenClawConfigChannelWorkspaceSyncStateInput {
  configChannels: InstanceWorkbenchSnapshot['configChannels'] | null | undefined;
}

export interface BuildOpenClawConfigChannelSelectionStateInput {
  configChannels: InstanceWorkbenchSnapshot['configChannels'] | null | undefined;
  selectedConfigChannelId: string | null;
  configChannelDrafts: OpenClawConfigChannelDrafts;
}

export interface BuildOpenClawConfigChannelWorkspaceItemsInput {
  configChannels: InstanceWorkbenchSnapshot['configChannels'] | null | undefined;
  runtimeChannels: InstanceWorkbenchSnapshot['channels'] | null | undefined;
  configChannelDrafts: OpenClawConfigChannelDrafts;
}

export interface OpenClawConfigChannelWorkspaceSyncState {
  resolveSelectedConfigChannelId: (currentSelectedConfigChannelId: string | null) => string | null;
  configChannelDrafts: OpenClawConfigChannelDrafts;
  configChannelError: string | null;
}

export interface OpenClawConfigChannelSelectionState {
  selectedConfigChannel: NonNullable<InstanceWorkbenchSnapshot['configChannels']>[number] | null;
  selectedConfigChannelDraft: Record<string, string> | null;
}

export interface BuildOpenClawConfigChannelStateHandlersArgs {
  selectedConfigChannel: NonNullable<InstanceWorkbenchSnapshot['configChannels']>[number] | null;
  setConfigChannelError: (value: string | null) => void;
  setSelectedConfigChannelId: (value: string | null) => void;
  setConfigChannelDrafts: (
    updater: (current: OpenClawConfigChannelDrafts) => OpenClawConfigChannelDrafts,
  ) => void;
}

export function findOpenClawConfigChannelById(
  configChannels: InstanceWorkbenchSnapshot['configChannels'] | null | undefined,
  channelId: string | null,
): NonNullable<InstanceWorkbenchSnapshot['configChannels']>[number] | null {
  if (!channelId) {
    return null;
  }

  return (configChannels || []).find((channel) => channel.id === channelId) || null;
}

export function buildOpenClawConfigChannelWorkspaceSyncState({
  configChannels,
}: BuildOpenClawConfigChannelWorkspaceSyncStateInput): OpenClawConfigChannelWorkspaceSyncState {
  const availableConfigChannels = configChannels || [];

  return {
    resolveSelectedConfigChannelId: (currentSelectedConfigChannelId) =>
      currentSelectedConfigChannelId &&
      availableConfigChannels.some((channel) => channel.id === currentSelectedConfigChannelId)
        ? currentSelectedConfigChannelId
        : null,
    configChannelDrafts: {},
    configChannelError: null,
  };
}

export function buildOpenClawConfigChannelSelectionState({
  configChannels,
  selectedConfigChannelId,
  configChannelDrafts,
}: BuildOpenClawConfigChannelSelectionStateInput): OpenClawConfigChannelSelectionState {
  const selectedConfigChannel = findOpenClawConfigChannelById(
    configChannels,
    selectedConfigChannelId,
  );

  return {
    selectedConfigChannel,
    selectedConfigChannelDraft: selectedConfigChannel
      ? configChannelDrafts[selectedConfigChannel.id] || selectedConfigChannel.values
      : null,
  };
}

export function buildOpenClawConfigChannelWorkspaceItems({
  configChannels,
  runtimeChannels,
  configChannelDrafts,
}: BuildOpenClawConfigChannelWorkspaceItemsInput): ChannelWorkspaceItem[] {
  const availableConfigChannels = configChannels || [];
  const availableRuntimeChannels = runtimeChannels || [];

  return availableConfigChannels.map((channel) => {
    const runtimeChannel = availableRuntimeChannels.find((item) => item.id === channel.id) || null;
    const draft = configChannelDrafts[channel.id] || channel.values;
    const configuredFieldCount = channel.fields.filter((field) => Boolean((draft[field.key] || '').trim())).length;
    const status =
      channel.configurationMode === 'none'
        ? channel.enabled
          ? 'connected'
          : 'disconnected'
        : configuredFieldCount === 0
          ? 'not_configured'
          : channel.status === 'connected'
            ? 'connected'
            : 'disconnected';

    return {
      id: channel.id,
      name: channel.name,
      description: runtimeChannel?.description || channel.description,
      status,
      enabled: channel.enabled,
      configurationMode: channel.configurationMode,
      fieldCount: channel.fieldCount,
      configuredFieldCount,
      setupSteps:
        runtimeChannel?.setupSteps && runtimeChannel.setupSteps.length > 0
          ? [...runtimeChannel.setupSteps]
          : [...channel.setupSteps],
      fields: channel.fields.map((field) => ({ ...field })),
      values: { ...draft },
    };
  });
}

export function buildOpenClawConfigChannelStateHandlers(
  args: BuildOpenClawConfigChannelStateHandlersArgs,
) {
  return {
    onSelectedConfigChannelIdChange: (channelId: string | null) => {
      args.setConfigChannelError(null);
      args.setSelectedConfigChannelId(channelId);
    },
    onConfigChannelFieldChange: (fieldKey: string, value: string) => {
      if (!args.selectedConfigChannel) {
        return;
      }

      args.setConfigChannelError(null);
      args.setConfigChannelDrafts((current) =>
        applyOpenClawConfigChannelDraftChange({
          drafts: current,
          channel: args.selectedConfigChannel!,
          fieldKey,
          value,
        }),
      );
    },
  };
}
