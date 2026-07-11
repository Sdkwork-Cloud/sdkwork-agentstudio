import { studio } from '@sdkwork/agentstudio-pc-infrastructure';

export interface InstanceDirectoryItem {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'starting' | 'error';
  iconType?: 'apple' | 'box' | 'server';
}

interface ActiveInstanceCandidate {
  id: string;
  status?: string | null;
}

type StudioDirectoryInstance = Awaited<ReturnType<typeof studio.listInstances>>[number];

interface InstanceDirectoryServiceDependencies {
  loadInstances?: () => Promise<StudioDirectoryInstance[]>;
  now?: () => number;
  cacheTtlMs?: number;
}

interface InstanceDirectoryCacheEntry {
  expiresAt: number;
  value: InstanceDirectoryItem[];
}

type InstanceDirectoryListener = (instances: InstanceDirectoryItem[]) => void;

function normalizeSelectionStatus(status: string | null | undefined) {
  if (status === 'syncing') {
    return 'starting';
  }

  return status;
}

function mapDirectoryInstances(
  instances: StudioDirectoryInstance[],
): InstanceDirectoryItem[] {
  return instances.map(({ id, name, host, status, iconType }) => {
    const normalizedStatus: InstanceDirectoryItem['status'] =
      status === 'syncing' ? 'starting' : status;

    return {
      id,
      name,
      ip: host,
      status: normalizedStatus,
      iconType,
    };
  });
}

export function resolvePreferredActiveInstanceId<TInstance extends ActiveInstanceCandidate>(params: {
  instances: TInstance[];
  activeInstanceId?: string | null | undefined;
  preferredInstanceId?: string | null | undefined;
}) {
  if (params.instances.length === 0) {
    return null;
  }

  if (
    params.preferredInstanceId &&
    params.instances.some((instance) => instance.id === params.preferredInstanceId)
  ) {
    return params.preferredInstanceId;
  }

  if (
    params.activeInstanceId &&
    params.instances.some((instance) => instance.id === params.activeInstanceId)
  ) {
    return params.activeInstanceId;
  }

  const nextOnlineInstance = params.instances.find(
    (instance) => normalizeSelectionStatus(instance.status) === 'online',
  );
  if (nextOnlineInstance) {
    return nextOnlineInstance.id;
  }

  const nextStartingInstance = params.instances.find(
    (instance) => normalizeSelectionStatus(instance.status) === 'starting',
  );
  if (nextStartingInstance) {
    return nextStartingInstance.id;
  }

  return params.instances[0]?.id ?? null;
}

class InstanceDirectoryService {
  private readonly loadInstancesFromSource: () => Promise<StudioDirectoryInstance[]>;

  private readonly now: () => number;

  private readonly cacheTtlMs: number;

  private cache: InstanceDirectoryCacheEntry | null = null;

  private pending: Promise<InstanceDirectoryItem[]> | null = null;

  private readonly listeners = new Set<InstanceDirectoryListener>();

  constructor({
      loadInstances = () => studio.listInstances(),
      now = () => Date.now(),
      cacheTtlMs = 1_500,
  }: InstanceDirectoryServiceDependencies = {}) {
    this.loadInstancesFromSource = loadInstances;
    this.now = now;
    this.cacheTtlMs = cacheTtlMs;
  }

  private publish(instances: InstanceDirectoryItem[]) {
    for (const listener of this.listeners) {
      listener(instances);
    }
  }

  async listInstances(options: { forceRefresh?: boolean } = {}): Promise<InstanceDirectoryItem[]> {
    const now = this.now();
    if (!options.forceRefresh && this.cache && this.cache.expiresAt > now) {
      return this.cache.value;
    }

    if (this.pending && !options.forceRefresh) {
      return this.pending;
    }

    if (this.pending && options.forceRefresh) {
      return this.pending.finally(() => this.listInstances(options));
    }

    if (options.forceRefresh) {
      this.cache = null;
    }

    this.pending = this.loadInstancesFromSource()
      .then((instances) => mapDirectoryInstances(instances))
      .then((instances) => {
        this.cache = {
          expiresAt: this.now() + this.cacheTtlMs,
          value: instances,
        };
        this.publish(instances);
        return instances;
      })
      .finally(() => {
        this.pending = null;
      });

    return this.pending;
  }

  async refresh() {
    return this.listInstances({ forceRefresh: true });
  }

  invalidate() {
    this.cache = null;
  }

  subscribe(listener: InstanceDirectoryListener) {
    this.listeners.add(listener);

    if (this.cache) {
      listener(this.cache.value);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }
}

export function createInstanceDirectoryService(
  dependencies?: InstanceDirectoryServiceDependencies,
) {
  return new InstanceDirectoryService(dependencies);
}

export const instanceDirectoryService = createInstanceDirectoryService();
