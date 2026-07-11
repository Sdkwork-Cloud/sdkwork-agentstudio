import { openClawConfigService } from '@sdkwork/agentstudio-pc-core';
import { getPlatformBridge } from '@sdkwork/agentstudio-pc-infrastructure';
import { isOpenClawBundledChannelId } from '@sdkwork/agentstudio-pc-types';
import type {
  ListParams,
  PaginatedResult,
  StudioInstanceDetailRecord,
} from '@sdkwork/agentstudio-pc-types';

export type ChannelFieldInputType = 'text' | 'password' | 'number' | 'url';

export interface ChannelField {
  key: string;
  label: string;
  type?: ChannelFieldInputType;
  placeholder: string;
  value?: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  sensitive?: boolean;
  inputMode?: 'text' | 'url' | 'numeric';
}

export interface Channel {
  id: string;
  name: string;
  description: string;
  icon?: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  configurationMode?: 'required' | 'none';
  fields: ChannelField[];
  setupGuide: string[];
  fieldCount?: number;
  configuredFieldCount?: number;
}

export interface CreateChannelDTO {
  name: string;
  description: string;
  icon: string;
  fields: ChannelField[];
  setupGuide: string[];
}

export interface UpdateChannelDTO extends Partial<CreateChannelDTO> {
  enabled?: boolean;
  status?: 'connected' | 'disconnected' | 'not_configured';
}

export interface IChannelService {
  getList(instanceId: string, params?: ListParams): Promise<PaginatedResult<Channel>>;
  getById(instanceId: string, id: string): Promise<Channel | null>;
  create(instanceId: string, data: CreateChannelDTO): Promise<Channel>;
  update(id: string, data: UpdateChannelDTO): Promise<Channel>;
  delete(id: string): Promise<boolean>;
  getChannels(instanceId: string): Promise<Channel[]>;
  updateChannelStatus(instanceId: string, channelId: string, enabled: boolean): Promise<Channel[]>;
  saveChannelConfig(instanceId: string, channelId: string, configData: Record<string, string>): Promise<Channel[]>;
  deleteChannelConfig(instanceId: string, channelId: string): Promise<Channel[]>;
}

interface WorkbenchChannelWriteBridge {
  setInstanceChannelEnabled?: (
    instanceId: string,
    channelId: string,
    enabled: boolean,
  ) => Promise<boolean>;
  saveInstanceChannelConfig?: (
    instanceId: string,
    channelId: string,
    values: Record<string, string>,
  ) => Promise<boolean>;
  deleteInstanceChannelConfig?: (instanceId: string, channelId: string) => Promise<boolean>;
}

type OpenClawChannelDefinition = ReturnType<typeof openClawConfigService.getChannelDefinitions>[number];
type WorkbenchChannelRecord = NonNullable<StudioInstanceDetailRecord['workbench']>['channels'][number] & {
  values?: Record<string, string>;
};

const CHANNEL_WRITE_UNAVAILABLE_ERROR =
  'Channel configuration is not writable for this instance.';

const channelIconNameMap: Record<string, string> = {
  qqbot: 'MessageCircle',
  feishu: 'MessageCircle',
  'openclaw-weixin': 'MessageCircle',
  wecom: 'Building2',
  'dingtalk-connector': 'MessageSquare',
  dingtalk: 'MessageSquare',
  imessage: 'MessageCircle',
  irc: 'Hash',
  matrix: 'Grid3X3',
  mattermost: 'MessageSquare',
  signal: 'Radio',
  telegram: 'Send',
  slack: 'Hash',
};

const retiredOpenClawWorkbenchChannelIds = new Set([
  'qq',
  'wechat',
  'wehcat',
  'sdkworkchat',
]);

function resolveChannelIconName(channelId: string, iconName?: string) {
  return iconName || channelIconNameMap[channelId] || 'MessageCircle';
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return String(error ?? '');
}

function isMissingConfigFileError(error: unknown) {
  const message = readErrorMessage(error).toLowerCase();
  return (
    message.includes('enoent') ||
    message.includes('os error 2') ||
    message.includes('no such file') ||
    message.includes('cannot find path') ||
    message.includes('\u627e\u4e0d\u5230\u6307\u5b9a\u7684\u6587\u4ef6') ||
    message.includes('attached openclaw config file is no longer available on disk') ||
    message.includes('re-scan or reattach the instance configuration') ||
    message.includes('not found')
  );
}

function normalizeChannelValues(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, candidate]) => typeof candidate === 'string')
      .map(([key, candidate]) => [key, candidate as string]),
  );
}

function countConfiguredValues(values: Record<string, string>) {
  return Object.values(values).filter((value) => value.trim().length > 0).length;
}

function mapField(
  field: OpenClawChannelDefinition['fields'][number],
  values: Record<string, string>,
): ChannelField {
  return {
    key: field.key,
    label: field.label,
    type: field.sensitive
      ? 'password'
      : field.inputMode === 'numeric'
        ? 'number'
        : field.inputMode === 'url'
          ? 'url'
          : 'text',
    placeholder: field.placeholder,
    value: values[field.key],
    helpText: field.helpText,
    required: field.required,
    multiline: field.multiline,
    sensitive: field.sensitive,
    inputMode: field.inputMode,
  };
}

function mapConfigBackedChannel(
  channel: Awaited<ReturnType<typeof openClawConfigService.readConfigSnapshot>>['channelSnapshots'][number],
): Channel {
  return {
    id: channel.id,
    name: channel.name,
    description: channel.description,
    icon: resolveChannelIconName(channel.id),
    status: channel.status,
    enabled: channel.enabled,
    configurationMode: channel.configurationMode,
    fieldCount: channel.fieldCount,
    configuredFieldCount: channel.configuredFieldCount,
    setupGuide: [...channel.setupSteps],
    fields: channel.fields.map((field) => mapField(field, channel.values)),
  };
}

function mapWorkbenchChannel(
  definition: OpenClawChannelDefinition,
  current?: WorkbenchChannelRecord,
): Channel {
  const values = normalizeChannelValues(current?.values);
  const configuredFieldCount =
    typeof current?.configuredFieldCount === 'number'
      ? current.configuredFieldCount
      : countConfiguredValues(values);
  const configurationMode =
    current?.configurationMode || definition.configurationMode || 'required';
  const enabled =
    typeof current?.enabled === 'boolean' ? current.enabled : configurationMode === 'none';
  const status =
    current?.status ||
    (configurationMode === 'none'
      ? enabled
        ? 'connected'
        : 'disconnected'
      : configuredFieldCount > 0
        ? enabled
          ? 'connected'
          : 'disconnected'
        : 'not_configured');

  return {
    id: definition.id,
    name: current?.name || definition.name,
    description: current?.description || definition.description,
    icon: resolveChannelIconName(definition.id),
    status,
    enabled,
    configurationMode,
    fieldCount: definition.fields.length,
    configuredFieldCount,
    setupGuide:
      current?.setupSteps && current.setupSteps.length > 0
        ? [...current.setupSteps]
        : [...definition.setupSteps],
    fields: definition.fields.map((field) => mapField(field, values)),
  };
}

function mapExternalWorkbenchChannel(current: WorkbenchChannelRecord): Channel {
  return {
    id: current.id,
    name: current.name || current.id,
    description: current.description || 'Runtime-discovered OpenClaw channel.',
    icon: resolveChannelIconName(current.id),
    status: current.status || 'not_configured',
    enabled: typeof current.enabled === 'boolean' ? current.enabled : current.status === 'connected',
    configurationMode: current.configurationMode || 'required',
    fieldCount:
      typeof current.fieldCount === 'number' && Number.isFinite(current.fieldCount)
        ? current.fieldCount
        : 0,
    configuredFieldCount:
      typeof current.configuredFieldCount === 'number' && Number.isFinite(current.configuredFieldCount)
        ? current.configuredFieldCount
        : 0,
    setupGuide: current.setupSteps ? [...current.setupSteps] : [],
    fields: [],
  };
}

class ChannelService implements IChannelService {
  private getStudioApi() {
    return getPlatformBridge().studio as ReturnType<typeof getPlatformBridge>['studio'] &
      WorkbenchChannelWriteBridge;
  }

  private async getInstanceDetail(instanceId: string) {
    return this.getStudioApi().getInstanceDetail(instanceId);
  }

  private resolveConfigFilePath(detail: StudioInstanceDetailRecord | null | undefined) {
    return openClawConfigService.resolveInstanceConfigPath(detail);
  }

  private canFallbackToWorkbench(
    detail: StudioInstanceDetailRecord | null | undefined,
    error: unknown,
  ) {
    return Boolean(detail?.workbench && isMissingConfigFileError(error));
  }

  private mapWorkbenchChannels(detail: StudioInstanceDetailRecord): Channel[] {
    const definitions = openClawConfigService.getChannelDefinitions();
    const definitionById = new Map(definitions.map((definition) => [definition.id, definition] as const));
    const workbenchChannels = detail.workbench?.channels || [];
    const workbenchById = new Map(
      workbenchChannels.map((channel) => [channel.id, channel as WorkbenchChannelRecord] as const),
    );

    const orderedIds = definitions.map((definition) => definition.id);
    const mappedChannels = orderedIds.map((channelId) => {
      const definition = definitionById.get(channelId);
      const workbenchChannel = workbenchById.get(channelId);

      if (definition) {
        return mapWorkbenchChannel(definition, workbenchChannel);
      }

      throw new Error(`Missing OpenClaw channel definition for "${channelId}"`);
    });

    for (const channel of workbenchChannels) {
      if (
        isOpenClawBundledChannelId(channel.id) ||
        retiredOpenClawWorkbenchChannelIds.has(channel.id) ||
        !channel.id
      ) {
        continue;
      }

      mappedChannels.push(mapExternalWorkbenchChannel(channel as WorkbenchChannelRecord));
    }

    return mappedChannels;
  }

  private requireSetInstanceChannelEnabled() {
    const studioApi = this.getStudioApi();
    if (typeof studioApi.setInstanceChannelEnabled !== 'function') {
      throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
    }

    return studioApi.setInstanceChannelEnabled.bind(studioApi);
  }

  private requireSaveInstanceChannelConfig() {
    const studioApi = this.getStudioApi();
    if (typeof studioApi.saveInstanceChannelConfig !== 'function') {
      throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
    }

    return studioApi.saveInstanceChannelConfig.bind(studioApi);
  }

  private requireDeleteInstanceChannelConfig() {
    const studioApi = this.getStudioApi();
    if (typeof studioApi.deleteInstanceChannelConfig !== 'function') {
      throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
    }

    return studioApi.deleteInstanceChannelConfig.bind(studioApi);
  }

  async getList(instanceId: string, params: ListParams = {}): Promise<PaginatedResult<Channel>> {
    const channels = await this.getChannels(instanceId);

    let filtered = channels;
    if (params.keyword) {
      const lowerKeyword = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (channel) =>
          channel.name.toLowerCase().includes(lowerKeyword) ||
          channel.description.toLowerCase().includes(lowerKeyword),
      );
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const total = filtered.length;
    const fromIdx = (page - 1) * pageSize;
    const items = filtered.slice(fromIdx, fromIdx + pageSize);
    const hasMore = fromIdx + pageSize < total;

    return {
      items,
      pageInfo: {
        mode: 'offset',
        page,
        pageSize,
        hasMore,
        totalItems: String(total),
      },
    };
  }

  async getById(instanceId: string, id: string): Promise<Channel | null> {
    const channels = await this.getChannels(instanceId);
    return channels.find((channel) => channel.id === id) || null;
  }

  async create(_instanceId: string, _data: CreateChannelDTO): Promise<Channel> {
    throw new Error('Method not implemented.');
  }

  async update(_id: string, _data: UpdateChannelDTO): Promise<Channel> {
    throw new Error('Method not implemented.');
  }

  async delete(_id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  async getChannels(instanceId: string): Promise<Channel[]> {
    const detail = await this.getInstanceDetail(instanceId);
    const configFilePath = this.resolveConfigFilePath(detail);
    if (configFilePath) {
      try {
        const snapshot = await openClawConfigService.readConfigSnapshot(configFilePath);
        return snapshot.channelSnapshots.map((channel) => mapConfigBackedChannel(channel));
      } catch (error) {
        if (detail?.workbench && this.canFallbackToWorkbench(detail, error)) {
          return this.mapWorkbenchChannels(detail);
        }

        throw error;
      }
    }

    if (detail?.workbench) {
      return this.mapWorkbenchChannels(detail);
    }

    return [];
  }

  async updateChannelStatus(
    instanceId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<Channel[]> {
    const detail = await this.getInstanceDetail(instanceId);
    const configFilePath = this.resolveConfigFilePath(detail);
    if (configFilePath) {
      try {
        await openClawConfigService.setChannelEnabled({
          configFile: configFilePath,
          channelId,
          enabled,
        });
        return this.getChannels(instanceId);
      } catch (error) {
        if (!this.canFallbackToWorkbench(detail, error)) {
          throw error;
        }
      }
    }

    if (detail?.workbench) {
      const setInstanceChannelEnabled = this.requireSetInstanceChannelEnabled();
      const updated = await setInstanceChannelEnabled(instanceId, channelId, enabled);
      if (!updated) {
        throw new Error('Failed to update channel status');
      }
      return this.getChannels(instanceId);
    }

    throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
  }

  async saveChannelConfig(
    instanceId: string,
    channelId: string,
    configData: Record<string, string>,
  ): Promise<Channel[]> {
    const detail = await this.getInstanceDetail(instanceId);
    const configFilePath = this.resolveConfigFilePath(detail);
    if (configFilePath) {
      try {
        await openClawConfigService.saveChannelConfiguration({
          configFile: configFilePath,
          channelId,
          values: configData,
          enabled: true,
        });
        return this.getChannels(instanceId);
      } catch (error) {
        if (!this.canFallbackToWorkbench(detail, error)) {
          throw error;
        }
      }
    }

    if (detail?.workbench) {
      const saveInstanceChannelConfig = this.requireSaveInstanceChannelConfig();
      const updated = await saveInstanceChannelConfig(instanceId, channelId, configData);
      if (!updated) {
        throw new Error('Failed to save channel config');
      }
      return this.getChannels(instanceId);
    }

    throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
  }

  async deleteChannelConfig(instanceId: string, channelId: string): Promise<Channel[]> {
    const detail = await this.getInstanceDetail(instanceId);
    const configFilePath = this.resolveConfigFilePath(detail);
    if (configFilePath) {
      try {
        await openClawConfigService.saveChannelConfiguration({
          configFile: configFilePath,
          channelId,
          values: {},
          enabled: false,
        });
        return this.getChannels(instanceId);
      } catch (error) {
        if (!this.canFallbackToWorkbench(detail, error)) {
          throw error;
        }
      }
    }

    if (detail?.workbench) {
      const deleteInstanceChannelConfig = this.requireDeleteInstanceChannelConfig();
      const updated = await deleteInstanceChannelConfig(instanceId, channelId);
      if (!updated) {
        throw new Error('Failed to delete channel config');
      }
      return this.getChannels(instanceId);
    }

    throw new Error(CHANNEL_WRITE_UNAVAILABLE_ERROR);
  }
}

export const channelService = new ChannelService();
