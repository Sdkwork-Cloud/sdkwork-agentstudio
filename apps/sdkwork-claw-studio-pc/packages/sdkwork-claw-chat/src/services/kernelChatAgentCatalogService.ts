import type {
  Agent,
  KernelChatAgentProfile,
  PersistedKernelChatAgentRecord,
  StudioInstanceDetailRecord,
} from '@sdkwork/claw-types';
import type { KernelChatAdapterResolution } from './kernelChatAdapterRegistry.ts';
import { shouldUseOpenClawGatewayKernelCatalog } from './kernelChatAuthorityPolicy.ts';

interface OpenClawKernelChatAgentCatalogAgent {
  id: string;
  name: string;
  description?: string | null;
  avatar?: string | null;
  systemPrompt?: string | null;
  creator?: string | null;
  isDefault?: boolean | null;
}

interface OpenClawKernelChatAgentCatalog {
  defaultAgentId: string | null;
  agents: OpenClawKernelChatAgentCatalogAgent[];
}

export interface KernelChatAgentCatalogDependencies {
  getInstanceDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  resolveAdapterResolution: (
    instanceId: string,
  ) => Promise<KernelChatAdapterResolution | null>;
  getOpenClawCatalog: (
    instanceId: string,
  ) => Promise<OpenClawKernelChatAgentCatalog>;
  listPersistedKernelChatAgents?: (
    instanceId: string,
  ) => Promise<PersistedKernelChatAgentRecord[]>;
  replacePersistedKernelChatAgents?: (
    instanceId: string,
    records: PersistedKernelChatAgentRecord[],
  ) => Promise<PersistedKernelChatAgentRecord[]>;
}

export interface KernelChatAgentCatalogDependencyOverrides {
  getInstanceDetail?: KernelChatAgentCatalogDependencies['getInstanceDetail'];
  resolveAdapterResolution?: KernelChatAgentCatalogDependencies['resolveAdapterResolution'];
  getOpenClawCatalog?: KernelChatAgentCatalogDependencies['getOpenClawCatalog'];
  listPersistedKernelChatAgents?: KernelChatAgentCatalogDependencies['listPersistedKernelChatAgents'];
  replacePersistedKernelChatAgents?: KernelChatAgentCatalogDependencies['replacePersistedKernelChatAgents'];
}

export interface KernelChatAgentCatalog {
  source: 'kernelCatalog' | 'workbenchProjection' | 'none';
  defaultAgentId: string | null;
  profiles: KernelChatAgentProfile[];
  agents: Agent[];
}

interface NormalizeCatalogOptions {
  fallbackInstanceId?: string | null;
  fallbackKernelId?: string | null;
}

interface KernelChatAgentCandidate {
  profile: KernelChatAgentProfile;
  originalIndex: number;
  metadataScore: number;
  sourcePriority: number;
  isExplicitDefault: boolean;
  isSemanticMain: boolean;
}

const MAIN_AGENT_SEMANTIC_LABELS = new Set([
  'main',
  'mainagent',
]);

const CATALOG_SOURCE_PRIORITY: Record<KernelChatAgentProfile['source'], number> = {
  kernelCatalog: 0,
  sessionBinding: 1,
  workbenchProjection: 2,
};

let studioApiPromise:
  | Promise<Awaited<typeof import('@sdkwork/claw-infrastructure')>['studio']>
  | null = null;
let authoritativeKernelChatAdapterModulePromise:
  | Promise<Awaited<typeof import('./authoritativeKernelChatAdapter.ts')>>
  | null = null;
let openClawChatAgentCatalogModulePromise:
  | Promise<Awaited<typeof import('./openClawChatAgentCatalogService.ts')>>
  | null = null;

function createEmptyCatalog(): KernelChatAgentCatalog {
  return {
    source: 'none',
    defaultAgentId: null,
    profiles: [],
    agents: [],
  };
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function titleizeIdentifier(value: string) {
  return value
    .split(/[-_.]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function normalizeSemanticLabel(value: string | null | undefined) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toLowerCase().replace(/[\s_-]+/g, '') : null;
}

function normalizeKernelChatAgentProfileSource(
  source: string | null | undefined,
): KernelChatAgentProfile['source'] {
  const normalizedSource = normalizeOptionalString(source);
  switch (normalizedSource) {
    case 'kernelCatalog':
      return 'kernelCatalog';
    case 'workbenchProjection':
      return 'workbenchProjection';
    case 'sessionBinding':
    case 'persistedBinding':
    default:
      // Hermes persisted a legacy non-standard source value before the
      // contract stabilized. Treat unknown values as session bindings so
      // existing local data remains visible and safely lower-priority than
      // kernel-owned catalogs.
      return 'sessionBinding';
  }
}

function countCatalogProfileMetadata(profile: KernelChatAgentProfile) {
  let score = 0;

  if (normalizeOptionalString(profile.description)) {
    score += 1;
  }
  if (normalizeOptionalString(profile.systemPrompt)) {
    score += 1;
  }
  if (normalizeOptionalString(profile.avatar)) {
    score += 1;
  }
  if (normalizeOptionalString(profile.creator)) {
    score += 1;
  }

  return score;
}

function isSemanticMainAgentProfile(profile: KernelChatAgentProfile) {
  const normalizedAgentId = normalizeOptionalString(profile.agentId)?.toLowerCase() ?? null;
  if (normalizedAgentId === 'main') {
    return true;
  }

  const normalizedLabel = normalizeSemanticLabel(profile.label);
  return normalizedLabel ? MAIN_AGENT_SEMANTIC_LABELS.has(normalizedLabel) : false;
}

function normalizeKernelChatAgentProfile(
  profile: KernelChatAgentProfile,
  options: NormalizeCatalogOptions = {},
): KernelChatAgentProfile | null {
  const agentId = normalizeOptionalString(profile.agentId);
  const instanceId =
    normalizeOptionalString(profile.instanceId) ??
    normalizeOptionalString(options.fallbackInstanceId);
  const kernelId =
    normalizeOptionalString(profile.kernelId) ??
    normalizeOptionalString(options.fallbackKernelId);

  if (!agentId || !instanceId || !kernelId) {
    return null;
  }

  return {
    kernelId,
    instanceId,
    agentId,
    label:
      normalizeOptionalString(profile.label) ??
      titleizeIdentifier(agentId) ??
      agentId,
    description: normalizeOptionalString(profile.description),
    source: normalizeKernelChatAgentProfileSource(profile.source),
    systemPrompt: normalizeOptionalString(profile.systemPrompt),
    avatar: normalizeOptionalString(profile.avatar),
    creator: normalizeOptionalString(profile.creator),
  };
}

function shouldPreferKernelChatAgentCandidate(
  candidate: KernelChatAgentCandidate,
  current: KernelChatAgentCandidate,
) {
  if (candidate.isExplicitDefault !== current.isExplicitDefault) {
    return candidate.isExplicitDefault;
  }

  if (candidate.sourcePriority !== current.sourcePriority) {
    return candidate.sourcePriority < current.sourcePriority;
  }

  if (candidate.metadataScore !== current.metadataScore) {
    return candidate.metadataScore > current.metadataScore;
  }

  return candidate.originalIndex < current.originalIndex;
}

function normalizeKernelChatAgentCatalog(input: {
  profiles: KernelChatAgentProfile[];
  defaultAgentId?: string | null;
  fallbackInstanceId?: string | null;
  fallbackKernelId?: string | null;
}): KernelChatAgentCatalog {
  const normalizedDefaultAgentId =
    normalizeOptionalString(input.defaultAgentId)?.toLowerCase() ?? null;
  const candidatesByAgentId = new Map<string, KernelChatAgentCandidate>();

  input.profiles.forEach((rawProfile, index) => {
    const profile = normalizeKernelChatAgentProfile(rawProfile, {
      fallbackInstanceId: input.fallbackInstanceId,
      fallbackKernelId: input.fallbackKernelId,
    });
    if (!profile) {
      return;
    }

    const normalizedAgentId = profile.agentId.toLowerCase();
    const candidate: KernelChatAgentCandidate = {
      profile,
      originalIndex: index,
      metadataScore: countCatalogProfileMetadata(profile),
      sourcePriority: CATALOG_SOURCE_PRIORITY[profile.source],
      isExplicitDefault: normalizedAgentId === normalizedDefaultAgentId,
      isSemanticMain: isSemanticMainAgentProfile(profile),
    };
    const current = candidatesByAgentId.get(normalizedAgentId);

    if (!current || shouldPreferKernelChatAgentCandidate(candidate, current)) {
      candidatesByAgentId.set(normalizedAgentId, candidate);
    }
  });

  const candidates = [...candidatesByAgentId.values()];
  const resolvedDefaultAgentId =
    candidates.find((candidate) => candidate.isExplicitDefault)?.profile.agentId ??
    candidates.find((candidate) => candidate.isSemanticMain)?.profile.agentId ??
    null;

  const sortedCandidates = [...candidates].sort((left, right) => {
    const leftIsDefault = left.profile.agentId === resolvedDefaultAgentId;
    const rightIsDefault = right.profile.agentId === resolvedDefaultAgentId;
    if (leftIsDefault !== rightIsDefault) {
      return leftIsDefault ? -1 : 1;
    }

    if (left.originalIndex !== right.originalIndex) {
      return left.originalIndex - right.originalIndex;
    }

    return left.profile.label.localeCompare(right.profile.label);
  });

  return toCatalog({
    profiles: sortedCandidates.map((candidate) => candidate.profile),
    defaultAgentId: resolvedDefaultAgentId,
  });
}

async function getStudioPlatformApi() {
  if (!studioApiPromise) {
    studioApiPromise = import('@sdkwork/claw-infrastructure').then(
      (module) => module.studio,
    );
  }

  return studioApiPromise;
}

async function getAuthoritativeKernelChatAdapterModule() {
  if (!authoritativeKernelChatAdapterModulePromise) {
    authoritativeKernelChatAdapterModulePromise = import(
      './authoritativeKernelChatAdapter.ts'
    );
  }

  return authoritativeKernelChatAdapterModulePromise;
}

async function getOpenClawChatAgentCatalogModule() {
  if (!openClawChatAgentCatalogModulePromise) {
    openClawChatAgentCatalogModulePromise = import(
      './openClawChatAgentCatalogService.ts'
    );
  }

  return openClawChatAgentCatalogModulePromise;
}

function toAgent(profile: KernelChatAgentProfile): Agent {
  const fallbackCreator = titleizeIdentifier(profile.kernelId) || 'Kernel';

  return {
    id: profile.agentId,
    name: profile.label,
    description: profile.description ?? '',
    avatar: profile.avatar ?? 'AI',
    systemPrompt: profile.systemPrompt ?? '',
    creator: profile.creator ?? fallbackCreator,
  };
}

function toCatalogSource(
  profiles: KernelChatAgentProfile[],
): KernelChatAgentCatalog['source'] {
  if (profiles.length === 0) {
    return 'none';
  }

  return profiles.some((profile) => profile.source === 'kernelCatalog')
    ? 'kernelCatalog'
    : 'workbenchProjection';
}

function toCatalog(input: {
  profiles: KernelChatAgentProfile[];
  defaultAgentId?: string | null;
}): KernelChatAgentCatalog {
  return {
    source: toCatalogSource(input.profiles),
    defaultAgentId: normalizeOptionalString(input.defaultAgentId),
    profiles: input.profiles,
    agents: input.profiles.map(toAgent),
  };
}

function toPersistedKernelChatAgentRecord(input: {
  profile: KernelChatAgentProfile;
  isDefault: boolean;
  sortOrder: number;
  syncedAt: number;
}): PersistedKernelChatAgentRecord {
  return {
    id: `${input.profile.instanceId}:${input.profile.kernelId}:${input.profile.agentId}`,
    instanceId: input.profile.instanceId,
    kernelId: input.profile.kernelId,
    agentId: input.profile.agentId,
    label: input.profile.label,
    description: input.profile.description ?? null,
    source: input.profile.source,
    systemPrompt: input.profile.systemPrompt ?? null,
    avatar: input.profile.avatar ?? null,
    creator: input.profile.creator ?? null,
    isDefault: input.isDefault,
    sortOrder: input.sortOrder,
    syncedAt: input.syncedAt,
    nativeMetadata: null,
  };
}

function toKernelChatAgentProfile(
  record: PersistedKernelChatAgentRecord,
): KernelChatAgentProfile {
  return {
    kernelId: record.kernelId,
    instanceId: record.instanceId,
    agentId: record.agentId,
    label: record.label,
    description: normalizeOptionalString(record.description),
    source: normalizeKernelChatAgentProfileSource(record.source),
    systemPrompt: normalizeOptionalString(record.systemPrompt),
    avatar: normalizeOptionalString(record.avatar),
    creator: normalizeOptionalString(record.creator),
  };
}

function sortPersistedKernelChatAgentRecords(
  records: PersistedKernelChatAgentRecord[],
): PersistedKernelChatAgentRecord[] {
  return [...records].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return left.label.localeCompare(right.label);
  });
}

function toCatalogFromPersistedRecords(
  records: PersistedKernelChatAgentRecord[],
): KernelChatAgentCatalog | null {
  if (records.length === 0) {
    return null;
  }

  const sortedRecords = sortPersistedKernelChatAgentRecords(records);
  return normalizeKernelChatAgentCatalog({
    profiles: sortedRecords.map(toKernelChatAgentProfile),
    defaultAgentId:
      sortedRecords.find((record) => record.isDefault)?.agentId ?? null,
    fallbackInstanceId: sortedRecords[0]?.instanceId ?? null,
    fallbackKernelId: sortedRecords[0]?.kernelId ?? null,
  });
}

function mapOpenClawProfile(input: {
  instanceId: string;
  agent: OpenClawKernelChatAgentCatalogAgent;
}): KernelChatAgentProfile {
  return {
    kernelId: 'openclaw',
    instanceId: input.instanceId,
    agentId: input.agent.id,
    label: input.agent.name,
    description: normalizeOptionalString(input.agent.description),
    source: 'kernelCatalog',
    systemPrompt: normalizeOptionalString(input.agent.systemPrompt),
    avatar: normalizeOptionalString(input.agent.avatar),
    creator: normalizeOptionalString(input.agent.creator),
  };
}

function mapWorkbenchProfile(input: {
  detail: StudioInstanceDetailRecord;
  record: NonNullable<StudioInstanceDetailRecord['workbench']>['agents'][number];
}): KernelChatAgentProfile {
  return {
    kernelId: input.detail.instance.runtimeKind,
    instanceId: input.detail.instance.id,
    agentId: input.record.agent.id,
    label: input.record.agent.name,
    description: normalizeOptionalString(input.record.agent.description),
    source: 'workbenchProjection',
    systemPrompt: normalizeOptionalString(input.record.agent.systemPrompt),
    avatar: normalizeOptionalString(input.record.agent.avatar),
    creator: normalizeOptionalString(input.record.agent.creator),
  };
}

class DefaultKernelChatAgentCatalogService {
  private readonly dependencies: KernelChatAgentCatalogDependencies;

  constructor(dependencies: KernelChatAgentCatalogDependencies) {
    this.dependencies = dependencies;
  }

  private async resolveRuntimeCatalog(
    instanceId: string,
    detail: StudioInstanceDetailRecord,
  ): Promise<KernelChatAgentCatalog> {
    const adapterResolution = await this.dependencies.resolveAdapterResolution(instanceId);
    if (!adapterResolution || adapterResolution.capabilities.supported === false) {
      return createEmptyCatalog();
    }

    if (
      shouldUseOpenClawGatewayKernelCatalog({
        adapterCapabilities: adapterResolution.capabilities,
      })
    ) {
      const catalog = await this.dependencies.getOpenClawCatalog(instanceId);
      const profiles = catalog.agents.map((agent) => mapOpenClawProfile({ instanceId, agent }));
      return normalizeKernelChatAgentCatalog({
        profiles,
        defaultAgentId: catalog.defaultAgentId,
        fallbackInstanceId: instanceId,
        fallbackKernelId: 'openclaw',
      });
    }

    if (
      adapterResolution.capabilities.supportsAgentProfiles &&
      adapterResolution.adapter.listAgentProfiles
    ) {
      const profiles = await adapterResolution.adapter.listAgentProfiles(instanceId);
      return normalizeKernelChatAgentCatalog({
        profiles,
        defaultAgentId: null,
        fallbackInstanceId: instanceId,
        fallbackKernelId: detail.instance.runtimeKind,
      });
    }

    const profiles = (detail.workbench?.agents ?? []).map((record) =>
      mapWorkbenchProfile({ detail, record }),
    );
    return normalizeKernelChatAgentCatalog({
      profiles,
      defaultAgentId: null,
      fallbackInstanceId: instanceId,
      fallbackKernelId: detail.instance.runtimeKind,
    });
  }

  private async listPersistedCatalog(
    instanceId: string,
  ): Promise<KernelChatAgentCatalog | null> {
    if (!this.dependencies.listPersistedKernelChatAgents) {
      return null;
    }

    try {
      return toCatalogFromPersistedRecords(
        await this.dependencies.listPersistedKernelChatAgents(instanceId),
      );
    } catch {
      return null;
    }
  }

  private async replacePersistedCatalog(
    instanceId: string,
    runtimeCatalog: KernelChatAgentCatalog,
  ): Promise<KernelChatAgentCatalog | null> {
    if (
      !this.dependencies.replacePersistedKernelChatAgents ||
      runtimeCatalog.profiles.length === 0
    ) {
      return null;
    }

    try {
      return toCatalogFromPersistedRecords(
        await this.dependencies.replacePersistedKernelChatAgents(
          instanceId,
          runtimeCatalog.profiles.map((profile, index) =>
            toPersistedKernelChatAgentRecord({
              profile,
              isDefault: profile.agentId === runtimeCatalog.defaultAgentId,
              sortOrder: index,
              syncedAt: Date.now(),
            }),
          ),
        ),
      );
    } catch {
      return null;
    }
  }

  async getCatalog(instanceId?: string): Promise<KernelChatAgentCatalog> {
    if (!instanceId) {
      return createEmptyCatalog();
    }

    const detail = await this.dependencies.getInstanceDetail(instanceId);
    if (!detail) {
      return createEmptyCatalog();
    }

    let runtimeCatalog: KernelChatAgentCatalog | null = null;
    let runtimeError: unknown = null;

    try {
      runtimeCatalog = await this.resolveRuntimeCatalog(instanceId, detail);
    } catch (error) {
      runtimeError = error;
    }

    if (runtimeCatalog && runtimeCatalog.source !== 'none') {
      const replacedPersistedCatalog = await this.replacePersistedCatalog(
        instanceId,
        runtimeCatalog,
      );
      if (replacedPersistedCatalog) {
        return replacedPersistedCatalog;
      }
    }

    const persistedCatalog = await this.listPersistedCatalog(instanceId);
    if (persistedCatalog) {
      return persistedCatalog;
    }

    if (runtimeCatalog) {
      return runtimeCatalog;
    }

    if (runtimeError) {
      throw runtimeError;
    }

    return createEmptyCatalog();
  }

  async listAgentProfiles(instanceId?: string): Promise<KernelChatAgentProfile[]> {
    return (await this.getCatalog(instanceId)).profiles;
  }

  async getAgentProfile(agentId: string, instanceId?: string): Promise<KernelChatAgentProfile> {
    const profiles = await this.listAgentProfiles(instanceId);
    const profile = profiles.find((candidate) => candidate.agentId === agentId);
    if (!profile) {
      throw new Error('Kernel chat agent profile not found');
    }

    return profile;
  }

  async listAgents(instanceId?: string): Promise<Agent[]> {
    return (await this.getCatalog(instanceId)).agents;
  }

  async getAgent(agentId: string, instanceId?: string): Promise<Agent> {
    return toAgent(await this.getAgentProfile(agentId, instanceId));
  }
}

export function createKernelChatAgentCatalogService(
  overrides: KernelChatAgentCatalogDependencyOverrides = {},
) {
  return new DefaultKernelChatAgentCatalogService({
    getInstanceDetail:
      overrides.getInstanceDetail ||
      ((instanceId) =>
        getStudioPlatformApi().then((studio) => studio.getInstanceDetail(instanceId))),
    resolveAdapterResolution:
      overrides.resolveAdapterResolution ||
      ((instanceId) =>
        getAuthoritativeKernelChatAdapterModule().then((module) =>
          module.resolveAuthoritativeInstanceKernelChatAdapter(instanceId),
        )),
    getOpenClawCatalog:
      overrides.getOpenClawCatalog ||
      ((instanceId) =>
        getOpenClawChatAgentCatalogModule().then((module) =>
          module.openClawChatAgentCatalogService.getCatalog(instanceId),
        )),
    listPersistedKernelChatAgents:
      overrides.listPersistedKernelChatAgents ||
      ((instanceId) =>
        getStudioPlatformApi().then((studio) => {
          const listPersistedKernelChatAgents = studio.listPersistedKernelChatAgents;
          if (!listPersistedKernelChatAgents) {
            throw new Error(
              'Studio persisted kernel chat agents are not available for the active platform bridge.',
            );
          }
          return listPersistedKernelChatAgents.call(studio, instanceId);
        })),
    replacePersistedKernelChatAgents:
      overrides.replacePersistedKernelChatAgents ||
      ((instanceId, records) =>
        getStudioPlatformApi().then((studio) => {
          const replacePersistedKernelChatAgents =
            studio.replacePersistedKernelChatAgents;
          if (!replacePersistedKernelChatAgents) {
            throw new Error(
              'Studio persisted kernel chat agent writes are not available for the active platform bridge.',
            );
          }
          return replacePersistedKernelChatAgents.call(studio, instanceId, records);
        })),
  });
}

export const kernelChatAgentCatalogService = createKernelChatAgentCatalogService();
