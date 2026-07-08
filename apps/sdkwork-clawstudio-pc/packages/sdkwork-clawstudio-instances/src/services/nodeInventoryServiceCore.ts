import type { HostPlatformSnapshot, KernelPlatformSnapshot } from '@sdkwork/clawstudio-core';
import {
  buildBuiltInKernelPrimaryInstanceId,
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  type StudioInstanceRecord,
} from '@sdkwork/clawstudio-types';
import {
  isBuiltInLocalInstance,
  mapInstanceNode,
  type NodeInventoryKind,
  type NodeInventoryManagement,
} from './nodeInventoryTopology.ts';

export type NodeInventoryHealth = 'ok' | 'degraded' | 'quarantined';
export type { NodeInventoryKind, NodeInventoryManagement } from './nodeInventoryTopology.ts';

export interface NodeInventoryRecord {
  id: string;
  name: string;
  kind: NodeInventoryKind;
  management: NodeInventoryManagement;
  topologyKind: string;
  runtimeState: string;
  health: NodeInventoryHealth;
  endpoint: string | null;
  host: string | null;
  version: string | null;
  source: 'kernel' | 'instance';
  instanceId?: string;
  hostPlatformMode: HostPlatformSnapshot['mode'] | null;
  sessionId: string | null;
  sessionState: string | null;
  compatibilityState: string | null;
  desiredStateRevision: number | null;
  desiredStateHash: string | null;
  detailPath: string;
}

export interface NodeInventorySnapshot {
  hostPlatform: HostPlatformSnapshot | null;
  nodes: NodeInventoryRecord[];
  sessionCount: number;
}

type NodeKernelPlatformService = Pick<
  {
    getStatus(): Promise<KernelPlatformSnapshot | null>;
    ensureRunning(): Promise<unknown>;
    restart(): Promise<unknown>;
  },
  'getStatus' | 'ensureRunning' | 'restart'
>;
type NodeHostPlatformService = Pick<
  {
    getStatus(): Promise<HostPlatformSnapshot | null>;
    listNodeSessions(): Promise<
      Array<{
        sessionId: string;
        nodeId: string;
        state: string | null;
        compatibilityState: string | null;
        desiredStateRevision?: number | null;
        desiredStateHash?: string | null;
      }>
    >;
  },
  'getStatus' | 'listNodeSessions'
>;

export interface NodeInventoryServiceDependencies {
  kernelPlatformService: NodeKernelPlatformService;
  hostPlatformService: NodeHostPlatformService;
  studioApi: {
    getInstances(): Promise<StudioInstanceRecord[]>;
  };
}

export interface NodeInventoryServiceOverrides {
  kernelPlatformService?: Partial<NodeKernelPlatformService>;
  hostPlatformService?: Partial<NodeHostPlatformService>;
  studioApi?: Partial<NodeInventoryServiceDependencies['studioApi']>;
}

function createMissingDependencyError(name: string) {
  return new Error(`Node inventory dependency "${name}" is not configured.`);
}

function createMissingAsyncDependency<TArgs extends unknown[], TResult>(name: string) {
  return async (..._args: TArgs): Promise<TResult> => {
    throw createMissingDependencyError(name);
  };
}

function createDependencies(
  overrides: NodeInventoryServiceOverrides = {},
): NodeInventoryServiceDependencies {
  return {
    kernelPlatformService: {
      getStatus:
        overrides.kernelPlatformService?.getStatus ??
        createMissingAsyncDependency('kernelPlatformService.getStatus'),
      ensureRunning:
        overrides.kernelPlatformService?.ensureRunning ??
        createMissingAsyncDependency('kernelPlatformService.ensureRunning'),
      restart:
        overrides.kernelPlatformService?.restart ??
        createMissingAsyncDependency('kernelPlatformService.restart'),
    },
    hostPlatformService: {
      getStatus:
        overrides.hostPlatformService?.getStatus ??
        createMissingAsyncDependency('hostPlatformService.getStatus'),
      listNodeSessions:
        overrides.hostPlatformService?.listNodeSessions ??
        createMissingAsyncDependency('hostPlatformService.listNodeSessions'),
    },
    studioApi: {
      getInstances:
        overrides.studioApi?.getInstances ??
        createMissingAsyncDependency('studioApi.getInstances'),
    },
  };
}

function mapKernelHealth(snapshot: KernelPlatformSnapshot): NodeInventoryHealth {
  if (snapshot.runtimeHealth === 'healthy') {
    return 'ok';
  }

  if (snapshot.runtimeHealth === 'degraded') {
    return 'degraded';
  }

  return 'quarantined';
}

function mapInstanceHealth(status: StudioInstanceRecord['status']): NodeInventoryHealth {
  switch (status) {
    case 'online':
      return 'ok';
    case 'starting':
    case 'syncing':
      return 'degraded';
    default:
      return 'quarantined';
  }
}

function resolveSessionHealth(
  health: NodeInventoryHealth,
  compatibilityState?: string | null,
  sessionState?: string | null,
): NodeInventoryHealth {
  if (compatibilityState === 'blocked' || sessionState === 'blocked') {
    return 'quarantined';
  }

  if (compatibilityState === 'degraded' || sessionState === 'degraded') {
    return health === 'quarantined' ? health : 'degraded';
  }

  return health;
}

function normalizeRuntimeId(runtimeId: string | null | undefined) {
  return String(runtimeId ?? '').trim().toLowerCase();
}

function findMatchingBuiltInKernelInstance(
  snapshot: Pick<KernelPlatformSnapshot, 'runtimeId'>,
  instances: StudioInstanceRecord[],
) {
  return instances.find((instance) => (
    isBuiltInLocalInstance(instance)
    && normalizeRuntimeId(instance.runtimeKind) === normalizeRuntimeId(snapshot.runtimeId)
  )) ?? null;
}

function resolveFallbackKernelNodeId(
  snapshot: Pick<KernelPlatformSnapshot, 'runtimeId'>,
) {
  const runtimeId = normalizeRuntimeId(snapshot.runtimeId);
  if (!runtimeId || runtimeId === 'openclaw') {
    return STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID;
  }

  return buildBuiltInKernelPrimaryInstanceId(runtimeId) ?? STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID;
}

function resolveKernelNodeDetailPath(
  snapshot: Pick<KernelPlatformSnapshot, 'runtimeId'>,
  matchingBuiltInInstance: Pick<StudioInstanceRecord, 'id'> | null,
) {
  if (matchingBuiltInInstance) {
    return `/instances/${matchingBuiltInInstance.id}`;
  }

  return normalizeRuntimeId(snapshot.runtimeId) === 'openclaw'
    ? '/kernel'
    : '/instances';
}

function resolveSessionNodeIds(node: Pick<NodeInventoryRecord, 'id' | 'source' | 'instanceId'>) {
  return [node.id, node.instanceId].filter((value): value is string => Boolean(value));
}

function findNodeSession(
  node: Pick<NodeInventoryRecord, 'id' | 'source' | 'instanceId'>,
  sessions: ReturnType<NodeHostPlatformService['listNodeSessions']> extends Promise<infer T> ? T : never,
) {
  const candidateNodeIds = new Set(resolveSessionNodeIds(node));
  return sessions.find((session) => candidateNodeIds.has(session.nodeId)) ?? null;
}

function applyNodeSession(
  node: NodeInventoryRecord,
  session: ReturnType<typeof findNodeSession>,
): NodeInventoryRecord {
  if (!session) {
    return node;
  }

  return {
    ...node,
    health: resolveSessionHealth(node.health, session.compatibilityState, session.state),
    sessionId: session.sessionId,
    sessionState: session.state,
    compatibilityState: session.compatibilityState,
    desiredStateRevision: session.desiredStateRevision ?? null,
    desiredStateHash: session.desiredStateHash ?? null,
  };
}

function mapKernelNode(
  snapshot: KernelPlatformSnapshot,
  hostStatus: HostPlatformSnapshot | null,
  matchingBuiltInInstance: StudioInstanceRecord | null,
): NodeInventoryRecord {
  const fallbackNodeId = resolveFallbackKernelNodeId(snapshot);
  const nodeId = matchingBuiltInInstance?.id ?? fallbackNodeId;
  const nodeName = matchingBuiltInInstance?.name?.trim() || `Local ${snapshot.runtimeId} Kernel`;

  return {
    id: nodeId,
    name: nodeName,
    kind: 'localPrimary',
    management: snapshot.controlMode === 'attached' ? 'attached' : 'managed',
    topologyKind: snapshot.topologyKind,
    runtimeState: snapshot.runtimeState,
    health: mapKernelHealth(snapshot),
    endpoint: snapshot.baseUrl,
    host: snapshot.raw.provenance.platform,
    version: snapshot.runtimeVersion ?? null,
    source: 'kernel',
    instanceId: matchingBuiltInInstance?.id,
    hostPlatformMode: hostStatus?.mode ?? null,
    sessionId: null,
    sessionState: null,
    compatibilityState: null,
    desiredStateRevision: null,
    desiredStateHash: null,
    detailPath: resolveKernelNodeDetailPath(snapshot, matchingBuiltInInstance),
  };
}

function sortNodes(left: NodeInventoryRecord, right: NodeInventoryRecord) {
  const rank = (node: NodeInventoryRecord) => {
    switch (node.kind) {
      case 'localPrimary':
        return 0;
      case 'managedRemote':
        return 1;
      case 'attachedRemote':
        return 2;
      default:
        return 3;
    }
  };

  if (rank(left) !== rank(right)) {
    return rank(left) - rank(right);
  }

  return left.name.localeCompare(right.name);
}

export function createNodeInventoryService(
  overrides: NodeInventoryServiceOverrides = {},
) {
  const dependencies = createDependencies(overrides);

  return {
    async getInventory(): Promise<NodeInventorySnapshot> {
      const [snapshot, hostStatus, sessions, instances] = await Promise.all([
        dependencies.kernelPlatformService.getStatus(),
        dependencies.hostPlatformService.getStatus(),
        dependencies.hostPlatformService.listNodeSessions(),
        dependencies.studioApi.getInstances(),
      ]);

      const nodes: NodeInventoryRecord[] = [];
      const matchingBuiltInKernelInstance = snapshot
        ? findMatchingBuiltInKernelInstance(snapshot, instances)
        : null;

      if (snapshot) {
        nodes.push(mapKernelNode(snapshot, hostStatus, matchingBuiltInKernelInstance));
      }

      for (const instance of instances) {
        if (matchingBuiltInKernelInstance && instance.id === matchingBuiltInKernelInstance.id) {
          continue;
        }
        nodes.push({
          ...mapInstanceNode(instance, hostStatus),
          health: mapInstanceHealth(instance.status),
          sessionId: null,
          sessionState: null,
          compatibilityState: null,
          desiredStateRevision: null,
          desiredStateHash: null,
        });
      }

      return {
        hostPlatform: hostStatus,
        nodes: nodes
          .map((node) => applyNodeSession(node, findNodeSession(node, sessions)))
          .sort(sortNodes),
        sessionCount: sessions.length,
      };
    },

    async listNodes(): Promise<NodeInventoryRecord[]> {
      const inventory = await this.getInventory();
      return inventory.nodes;
    },

    async ensureLocalNodeRunning() {
      return dependencies.kernelPlatformService.ensureRunning();
    },

    async restartLocalNode() {
      return dependencies.kernelPlatformService.restart();
    },
  };
}
