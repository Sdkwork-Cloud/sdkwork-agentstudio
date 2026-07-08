import type {
  OpenClawChannelDefinition,
  OpenClawConfigSnapshot,
} from '@sdkwork/clawstudio-core';
import type { OpenClawChannelStatusResult } from '@sdkwork/clawstudio-infrastructure';
import type { InstanceWorkbenchChannel } from '../types/index.ts';
import {
  getBooleanValue,
  getObjectValue,
  getRecordValue,
  getStringValue,
  isNonEmptyString,
  isRecord,
  titleCaseIdentifier,
} from './openClawSupport.ts';

type OpenClawChannelConfigSnapshot = OpenClawConfigSnapshot['channelSnapshots'][number];

const RETIRED_OPENCLAW_RUNTIME_CHANNEL_IDS = new Set([
  'qq',
  'wechat',
  'wehcat',
  'sdkworkchat',
]);

export function mapConfigChannel(
  channel: OpenClawChannelConfigSnapshot,
): InstanceWorkbenchChannel {
  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    status: channel.status,
    enabled: channel.enabled,
    configurationMode: channel.configurationMode,
    fieldCount: channel.fieldCount,
    configuredFieldCount: channel.configuredFieldCount,
    setupSteps: [...channel.setupSteps],
  };
}

export function cloneConfigChannel(
  channel: OpenClawChannelConfigSnapshot,
) {
  return {
    ...channel,
    setupSteps: [...channel.setupSteps],
    values: { ...channel.values },
    fields: channel.fields.map((field) => ({ ...field })),
  };
}

export function cloneWorkbenchChannel(channel: InstanceWorkbenchChannel): InstanceWorkbenchChannel {
  return {
    ...channel,
    setupSteps: [...channel.setupSteps],
    accounts: channel.accounts?.map((account) => ({ ...account })),
  };
}

function isConfiguredValue(value: unknown) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return false;
}

function normalizeChannelConnectionStatus(
  value: unknown,
): InstanceWorkbenchChannel['status'] | null {
  return value === 'connected' || value === 'disconnected' || value === 'not_configured'
    ? value
    : null;
}

function formatChannelAccountState(status: InstanceWorkbenchChannel['status']) {
  switch (status) {
    case 'connected':
      return 'connected';
    case 'disconnected':
      return 'disconnected';
    default:
      return 'not configured';
  }
}

function buildOpenClawChannelAccounts(
  status: OpenClawChannelStatusResult,
  channelId: string,
  rawChannel: Record<string, unknown>,
): NonNullable<InstanceWorkbenchChannel['accounts']> {
  const embeddedAccounts = getObjectValue(rawChannel, ['accounts']) || {};
  const runtimeAccounts = getObjectValue(status, ['channelAccounts', channelId]) || {};
  const accountIds = Array.from(
    new Set([...Object.keys(embeddedAccounts), ...Object.keys(runtimeAccounts)]),
  ).sort((left, right) => left.localeCompare(right));

  return accountIds
    .map((accountId) => {
      const embedded = getRecordValue(embeddedAccounts, [accountId]) || {};
      const runtime = getRecordValue(runtimeAccounts, [accountId]) || {};
      const configured =
        (getBooleanValue(runtime, ['configured']) ??
          getBooleanValue(embedded, ['configured']) ??
          false) ||
        Object.keys(getObjectValue(runtime, ['fields']) || {}).length > 0 ||
        Object.keys(getObjectValue(embedded, ['fields']) || {}).length > 0;
      const enabled =
        getBooleanValue(runtime, ['enabled']) ??
        getBooleanValue(embedded, ['enabled']) ??
        configured;
      const normalizedStatus =
        normalizeChannelConnectionStatus(getStringValue(runtime, ['status'])) ||
        normalizeChannelConnectionStatus(getStringValue(embedded, ['status'])) ||
        (configured ? (enabled ? 'connected' : 'disconnected') : 'not_configured');

      return {
        id: accountId,
        name:
          getStringValue(runtime, ['label']) ||
          getStringValue(runtime, ['name']) ||
          getStringValue(embedded, ['label']) ||
          getStringValue(embedded, ['name']) ||
          titleCaseIdentifier(accountId),
        status: normalizedStatus,
        enabled,
        configured,
        detail:
          getStringValue(runtime, ['detail']) ||
          getStringValue(runtime, ['message']) ||
          getStringValue(embedded, ['detail']) ||
          undefined,
      };
    })
    .filter((account) => account.id.length > 0);
}

export function mapOpenClawChannelDefinition(
  definition: OpenClawChannelDefinition,
): InstanceWorkbenchChannel {
  const configurationMode = definition.configurationMode || 'required';
  const enabled = configurationMode === 'none';

  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    status: configurationMode === 'none' ? 'connected' : 'not_configured',
    enabled,
    configurationMode,
    fieldCount: definition.fields.length,
    configuredFieldCount: 0,
    setupSteps: [...definition.setupSteps],
  };
}

export function buildOpenClawChannels(
  status: OpenClawChannelStatusResult,
): InstanceWorkbenchChannel[] {
  const rawChannels = isRecord(status.channels) ? status.channels : {};
  const orderedIds = Array.from(
    new Set([
      ...(Array.isArray(status.channelOrder) ? status.channelOrder.filter(isNonEmptyString) : []),
      ...Object.keys(rawChannels),
    ]),
  ).filter((channelId) => !RETIRED_OPENCLAW_RUNTIME_CHANNEL_IDS.has(channelId));

  return orderedIds
    .map((channelId) => {
      const rawChannel = rawChannels[channelId];
      if (!isRecord(rawChannel)) {
        return null;
      }

      const channelName = status.channelLabels?.[channelId] || titleCaseIdentifier(channelId);
      const rawFields = getObjectValue(rawChannel, ['fields']) || {};
      const accounts = buildOpenClawChannelAccounts(status, channelId, rawChannel);
      const fieldCount = Object.keys(rawFields).length;
      const accountCount = accounts.length;
      const connectedAccountCount = accounts.filter((account) => account.status === 'connected').length;
      const configuredFieldCount = Object.values(rawFields).filter((value) => isConfiguredValue(value)).length;
      const enabled = getBooleanValue(rawChannel, ['enabled']) ?? false;
      const configured =
        (getBooleanValue(rawChannel, ['configured']) ?? false) ||
        configuredFieldCount > 0 ||
        accountCount > 0;
      const setupSteps = accounts.length > 0
          ? [
              `${channelName} runtime reports ${connectedAccountCount}/${accountCount} connected accounts.`,
              ...accounts.map(
                (account) =>
                  `${account.name} (${account.id}): ${formatChannelAccountState(account.status)}${
                    account.detail ? ` - ${account.detail}` : ''
                  }`,
              ),
            ]
          : configured
            ? [
                `${channelName} channel is configured for the gateway runtime.`,
                enabled
                  ? 'Channel is enabled for runtime delivery.'
                  : 'Enable the channel after validating connectivity.',
              ]
            : [
                `Configure credentials or routing for ${channelName}.`,
                'Add at least one account or destination target.',
              ];

      return {
        id: channelId,
        name: channelName,
        description:
          status.channelDetailLabels?.[channelId] ||
          (accounts.length > 0
            ? `${channelName} integration managed by the OpenClaw gateway. Accounts: ${accounts
                .map(
                  (account) =>
                    `${account.name} (${formatChannelAccountState(account.status)})`,
                )
                .join(', ')}.`
            : `${channelName} integration managed by the OpenClaw gateway.`),
        status: configured
            ? enabled
              ? 'connected'
              : 'disconnected'
            : 'not_configured',
        enabled,
        configurationMode: 'required',
        fieldCount: Math.max(fieldCount, accountCount, configured ? 1 : 0),
        configuredFieldCount: configured
          ? Math.max(configuredFieldCount, accountCount, 1)
          : 0,
        setupSteps,
        accounts,
      } satisfies InstanceWorkbenchChannel;
    })
    .filter(Boolean) as InstanceWorkbenchChannel[];
}

export function mergeOpenClawChannelCollections(
  baseChannels: InstanceWorkbenchChannel[],
  overrideChannels: InstanceWorkbenchChannel[],
): InstanceWorkbenchChannel[] {
  const orderedIds: string[] = [];
  const mergedChannels = new Map<string, InstanceWorkbenchChannel>();

  const rememberOrder = (channelId: string) => {
    if (!orderedIds.includes(channelId)) {
      orderedIds.push(channelId);
    }
  };

  baseChannels.forEach((channel) => {
    rememberOrder(channel.id);
    mergedChannels.set(channel.id, cloneWorkbenchChannel(channel));
  });

  overrideChannels.forEach((channel) => {
    rememberOrder(channel.id);
    const baseChannel = mergedChannels.get(channel.id);

    if (!baseChannel) {
      mergedChannels.set(channel.id, cloneWorkbenchChannel(channel));
      return;
    }

    mergedChannels.set(channel.id, {
      id: channel.id,
      name: baseChannel.name || channel.name,
      description: channel.description || baseChannel.description,
      status: channel.status,
      enabled: channel.enabled,
      configurationMode: channel.configurationMode || baseChannel.configurationMode || 'required',
      fieldCount: Math.max(baseChannel.fieldCount, channel.fieldCount),
      configuredFieldCount:
        typeof channel.configuredFieldCount === 'number'
          ? channel.configuredFieldCount
          : baseChannel.configuredFieldCount,
      setupSteps:
        channel.setupSteps.length > 0 ? [...channel.setupSteps] : [...baseChannel.setupSteps],
      accounts:
        channel.accounts && channel.accounts.length > 0
          ? channel.accounts.map((account) => ({ ...account }))
          : baseChannel.accounts?.map((account) => ({ ...account })),
    });
  });

  return orderedIds
    .map((channelId) => mergedChannels.get(channelId))
    .filter(Boolean) as InstanceWorkbenchChannel[];
}
