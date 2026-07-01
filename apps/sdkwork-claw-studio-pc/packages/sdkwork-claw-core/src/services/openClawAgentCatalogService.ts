import {
  openClawGatewayClient,
  studio,
  type OpenClawAgentsListResult,
  type OpenClawConfigSnapshot as GatewayOpenClawConfigSnapshot,
} from '@sdkwork/claw-infrastructure';
import type { Agent, StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import type { OpenClawConfigSnapshot } from './openClawConfigService.ts';
import { resolveAttachedKernelConfigFile } from './kernelConfigAttachmentService.ts';
import { openClawConfigService } from './openClawConfigService.ts';
import { normalizeOpenClawAgentId } from './openClawAgentDocumentService.ts';
import {
  buildOpenClawAgentSnapshotsFromConfigRoot,
  type OpenClawAgentSnapshot,
} from './openClawAgentSnapshotService.ts';

export interface OpenClawAgentCatalogAgent extends Agent {
  isDefault: boolean;
}

export interface OpenClawAgentCatalog {
  agents: OpenClawAgentCatalogAgent[];
  defaultAgentId: string | null;
}

export interface OpenClawAgentCatalogDependencies {
  getInstanceDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  resolveAttachedKernelConfigFile: (
    detail: StudioInstanceDetailRecord | null | undefined,
  ) => string | null;
  readOpenClawConfigSnapshot: (configPath: string) => Promise<OpenClawConfigSnapshot>;
  getOpenClawGatewayConfig?: (
    instanceId: string,
  ) => Promise<GatewayOpenClawConfigSnapshot>;
  listOpenClawGatewayAgents?: (
    instanceId: string,
  ) => Promise<OpenClawAgentsListResult>;
}

export interface OpenClawAgentCatalogDependencyOverrides {
  getInstanceDetail?: OpenClawAgentCatalogDependencies['getInstanceDetail'];
  resolveAttachedKernelConfigFile?: OpenClawAgentCatalogDependencies['resolveAttachedKernelConfigFile'];
  readOpenClawConfigSnapshot?: OpenClawAgentCatalogDependencies['readOpenClawConfigSnapshot'];
  getOpenClawGatewayConfig?: OpenClawAgentCatalogDependencies['getOpenClawGatewayConfig'];
  listOpenClawGatewayAgents?: OpenClawAgentCatalogDependencies['listOpenClawGatewayAgents'];
}

export const DEFAULT_TASK_AGENT_SELECT_VALUE = '__default__';

export interface TaskAgentSelectOption {
  value: string;
  agentId: string | null;
  name: string;
  description: string;
  missing: boolean;
  defaultRoute: boolean;
  defaultAgent: boolean;
}

export interface TaskAgentSelectState {
  value: string;
  options: TaskAgentSelectOption[];
}

function titleizeIdentifier(value: string) {
  return value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

type OpenClawAgentCatalogConfigSnapshot = Pick<OpenClawConfigSnapshot, 'agentSnapshots'>;

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readScalarString(value: unknown) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function readNestedString(record: Record<string, unknown> | null | undefined, keys: string[]) {
  let current: unknown = record;
  for (const key of keys) {
    if (!isRecord(current)) {
      return null;
    }

    current = current[key];
  }

  return readScalarString(current);
}

function readFirstString(
  record: Record<string, unknown> | null | undefined,
  paths: string[][],
) {
  for (const path of paths) {
    const value = readNestedString(record, path);
    if (value) {
      return value;
    }
  }

  return null;
}

function readNestedBoolean(record: Record<string, unknown> | null | undefined, keys: string[]) {
  let current: unknown = record;
  for (const key of keys) {
    if (!isRecord(current)) {
      return false;
    }

    current = current[key];
  }

  return current === true;
}

function hasOpenClawGatewayTransport(detail: StudioInstanceDetailRecord | null | undefined) {
  const transports = [
    detail?.connectivity?.primaryTransport,
    detail?.instance.transportKind,
  ];

  return transports.some(
    (transport) => normalizeOptionalString(transport)?.toLowerCase() === 'openclawgatewayws',
  );
}

function isOpenClawCompatibleDetail(detail: StudioInstanceDetailRecord | null | undefined) {
  return detail?.instance.runtimeKind === 'openclaw' || hasOpenClawGatewayTransport(detail);
}

function normalizeGatewayAgent(entry: Record<string, unknown>): OpenClawAgentCatalogAgent | null {
  const rawId = readFirstString(entry, [['id'], ['agentId'], ['agent_id']]);
  if (!rawId) {
    return null;
  }

  const id = normalizeOpenClawAgentId(rawId);
  const name = readFirstString(entry, [
    ['name'],
    ['displayName'],
    ['display_name'],
    ['label'],
    ['title'],
  ]);
  const fallbackName = titleizeIdentifier(id) || 'Main';
  const resolvedName = name || fallbackName;
  const description =
    readFirstString(entry, [['description'], ['summary']]) ||
    `${resolvedName} agent`;
  const avatar =
    readFirstString(entry, [['avatar'], ['identity', 'emoji'], ['identity', 'avatar'], ['icon']]) ||
    resolvedName.charAt(0).toUpperCase() ||
    'O';

  return {
    id,
    name: resolvedName,
    description,
    avatar,
    systemPrompt:
      readFirstString(entry, [
        ['systemPrompt'],
        ['system_prompt'],
        ['prompt'],
        ['instructions'],
      ]) || '',
    creator: readFirstString(entry, [['creator'], ['author'], ['source']]) || 'OpenClaw',
    isDefault:
      readNestedBoolean(entry, ['default']) ||
      readNestedBoolean(entry, ['isDefault']) ||
      readNestedBoolean(entry, ['is_default']),
  };
}

function normalizeGatewayAgents(
  agentsResult: OpenClawAgentsListResult | null,
) {
  return (Array.isArray(agentsResult?.agents) ? agentsResult.agents : [])
    .filter(isRecord)
    .map(normalizeGatewayAgent)
    .filter((agent): agent is OpenClawAgentCatalogAgent => Boolean(agent));
}

function buildGatewayConfigSnapshot(
  instanceId: string,
  gatewayConfig: GatewayOpenClawConfigSnapshot | null,
): OpenClawAgentCatalogConfigSnapshot | null {
  if (!isRecord(gatewayConfig?.config)) {
    return null;
  }

  return {
    agentSnapshots: buildOpenClawAgentSnapshotsFromConfigRoot(
      gatewayConfig.config,
      normalizeOptionalString(gatewayConfig.path) ||
        `/openclaw-gateway/${instanceId}/openclaw.json`,
    ),
  };
}

function mergeConfigSnapshots(
  ...snapshots: Array<OpenClawAgentCatalogConfigSnapshot | null | undefined>
): OpenClawAgentCatalogConfigSnapshot | null {
  const mergedById = new Map<string, OpenClawAgentSnapshot>();

  for (const snapshot of snapshots) {
    for (const agent of snapshot?.agentSnapshots ?? []) {
      const id = normalizeOpenClawAgentId(agent.id);
      if (!id || mergedById.has(id)) {
        continue;
      }

      mergedById.set(id, {
        ...agent,
        id,
      });
    }
  }

  if (mergedById.size === 0) {
    return null;
  }

  return {
    agentSnapshots: [...mergedById.values()],
  };
}

function resolveDefaultAgentId(
  detail: StudioInstanceDetailRecord | null | undefined,
  configSnapshot: OpenClawAgentCatalogConfigSnapshot | null,
  runtimeAgents: OpenClawAgentCatalogAgent[],
) {
  const configuredDefaultAgentId =
    configSnapshot?.agentSnapshots.find((agent) => agent.isDefault)?.id || null;
  if (configuredDefaultAgentId) {
    return configuredDefaultAgentId;
  }

  const runtimeDefaultAgentId =
    runtimeAgents.find((agent) => agent.isDefault)?.id || null;
  if (runtimeDefaultAgentId) {
    return runtimeDefaultAgentId;
  }

  const workbenchAgentIds =
    detail?.workbench?.agents.map((agentRecord) => agentRecord.agent.id).filter(Boolean) || [];
  if (workbenchAgentIds.includes('main')) {
    return 'main';
  }

  return workbenchAgentIds[0] || 'main';
}

class DefaultOpenClawAgentCatalogService {
  private readonly dependencies: OpenClawAgentCatalogDependencies;

  constructor(dependencies: OpenClawAgentCatalogDependencies) {
    this.dependencies = dependencies;
  }

  async getCatalog(instanceId: string): Promise<OpenClawAgentCatalog> {
    const detail = await this.dependencies.getInstanceDetail(instanceId);
    if (!isOpenClawCompatibleDetail(detail)) {
      return {
        agents: [],
        defaultAgentId: null,
      };
    }

    const configPath = this.dependencies.resolveAttachedKernelConfigFile(detail);
    let localConfigSnapshot: OpenClawAgentCatalogConfigSnapshot | null = null;
    if (configPath) {
      localConfigSnapshot = await this.dependencies
        .readOpenClawConfigSnapshot(configPath)
        .catch(() => null);
    }

    let gatewayConfigSnapshot: OpenClawAgentCatalogConfigSnapshot | null = null;
    let runtimeAgents: OpenClawAgentCatalogAgent[] = [];
    if (hasOpenClawGatewayTransport(detail)) {
      const [gatewayConfigResult, gatewayAgentsResult] = await Promise.allSettled([
        this.dependencies.getOpenClawGatewayConfig?.(instanceId),
        this.dependencies.listOpenClawGatewayAgents?.(instanceId),
      ]);

      gatewayConfigSnapshot =
        gatewayConfigResult.status === 'fulfilled'
          ? buildGatewayConfigSnapshot(instanceId, gatewayConfigResult.value ?? null)
          : null;
      runtimeAgents =
        gatewayAgentsResult.status === 'fulfilled'
          ? normalizeGatewayAgents(gatewayAgentsResult.value ?? null)
          : [];
    }

    const configSnapshot = mergeConfigSnapshots(gatewayConfigSnapshot, localConfigSnapshot);
    const workbenchAgents = detail?.workbench?.agents || [];
    const workbenchAgentMap = new Map(
      workbenchAgents.map((agentRecord) => [agentRecord.agent.id, agentRecord.agent] as const),
    );
    const configAgentMap = new Map(
      (configSnapshot?.agentSnapshots || []).map((agent) => [agent.id, agent] as const),
    );
    const runtimeAgentMap = new Map(runtimeAgents.map((agent) => [agent.id, agent] as const));
    const defaultAgentId = resolveDefaultAgentId(detail, configSnapshot, runtimeAgents);
    const orderedIds = Array.from(
      new Set([
        ...(configSnapshot?.agentSnapshots || []).map((agent) => agent.id),
        ...runtimeAgents.map((agent) => agent.id),
        ...workbenchAgents.map((agentRecord) => agentRecord.agent.id),
      ]),
    ).filter(Boolean);
    const ids = orderedIds.length > 0 ? orderedIds : [defaultAgentId];
    const orderIndex = new Map(ids.map((id, index) => [id, index] as const));

    const agents = ids
      .map((id): OpenClawAgentCatalogAgent => {
        const workbenchAgent = workbenchAgentMap.get(id);
        const runtimeAgent = runtimeAgentMap.get(id);
        const configAgent = configAgentMap.get(id);
        const fallbackName = titleizeIdentifier(id) || 'Main';

        return {
          id,
          name: workbenchAgent?.name || runtimeAgent?.name || configAgent?.name || fallbackName,
          description:
            workbenchAgent?.description ||
            runtimeAgent?.description ||
            configAgent?.description ||
            `${fallbackName} agent`,
          avatar: workbenchAgent?.avatar || runtimeAgent?.avatar || configAgent?.avatar || 'AI',
          systemPrompt: workbenchAgent?.systemPrompt || runtimeAgent?.systemPrompt || '',
          creator: workbenchAgent?.creator || runtimeAgent?.creator || 'OpenClaw',
          isDefault: id === defaultAgentId,
        };
      })
      .sort((left, right) => {
        if (left.isDefault !== right.isDefault) {
          return left.isDefault ? -1 : 1;
        }

        return (orderIndex.get(left.id) || 0) - (orderIndex.get(right.id) || 0);
      });

    return {
      agents,
      defaultAgentId,
    };
  }
}

export function buildTaskAgentSelectState(input: {
  catalog: OpenClawAgentCatalog;
  selectedAgentId?: string | null;
}): TaskAgentSelectState {
  const normalizedSelectedAgentId = input.selectedAgentId?.trim() || '';
  const defaultAgent =
    input.catalog.agents.find((agent) => agent.isDefault) ||
    input.catalog.agents.find((agent) => agent.id === input.catalog.defaultAgentId) ||
    null;
  const options: TaskAgentSelectOption[] = [
    {
      value: DEFAULT_TASK_AGENT_SELECT_VALUE,
      agentId: null,
      name: defaultAgent?.name || titleizeIdentifier(input.catalog.defaultAgentId || 'main') || 'Main',
      description: defaultAgent?.description || 'Follow the default OpenClaw agent routing.',
      missing: false,
      defaultRoute: true,
      defaultAgent: false,
    },
    ...input.catalog.agents.map((agent) => ({
      value: agent.id,
      agentId: agent.id,
      name: agent.name,
      description: agent.description,
      missing: false,
      defaultRoute: false,
      defaultAgent: agent.isDefault,
    })),
  ];

  if (normalizedSelectedAgentId && !options.some((option) => option.value === normalizedSelectedAgentId)) {
    options.push({
      value: normalizedSelectedAgentId,
      agentId: normalizedSelectedAgentId,
      name: titleizeIdentifier(normalizedSelectedAgentId) || normalizedSelectedAgentId,
      description: 'This agent binding is no longer available from the connected instance.',
      missing: true,
      defaultRoute: false,
      defaultAgent: false,
    });
  }

  return {
    value: normalizedSelectedAgentId || DEFAULT_TASK_AGENT_SELECT_VALUE,
    options,
  };
}

export function createOpenClawAgentCatalogService(
  overrides: OpenClawAgentCatalogDependencyOverrides = {},
) {
  return new DefaultOpenClawAgentCatalogService({
    getInstanceDetail: overrides.getInstanceDetail || ((instanceId) => studio.getInstanceDetail(instanceId)),
    resolveAttachedKernelConfigFile:
      overrides.resolveAttachedKernelConfigFile ||
      ((detail) => resolveAttachedKernelConfigFile(detail)),
    readOpenClawConfigSnapshot:
      overrides.readOpenClawConfigSnapshot ||
      ((configPath) => openClawConfigService.readConfigSnapshot(configPath)),
    getOpenClawGatewayConfig:
      overrides.getOpenClawGatewayConfig ||
      ((instanceId) => openClawGatewayClient.getConfig(instanceId)),
    listOpenClawGatewayAgents:
      overrides.listOpenClawGatewayAgents ||
      ((instanceId) => openClawGatewayClient.listAgents(instanceId)),
  });
}

export const openClawAgentCatalogService = createOpenClawAgentCatalogService();
