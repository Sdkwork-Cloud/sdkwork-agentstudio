import {
  openClawConfigService,
  resolveAttachedKernelConfigFile,
  type OpenClawConfigSnapshot,
} from '@sdkwork/claw-core';
import { studio } from '@sdkwork/claw-infrastructure';
import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';

const HISTORY_CONFIG_CACHE_TTL_MS = 5_000;

type OpenClawGatewayHistoryConfigCacheEntry = {
  expiresAt: number;
  value: number | undefined;
};

export interface OpenClawGatewayHistoryConfigService {
  getHistoryMaxChars(instanceId: string): Promise<number | undefined>;
  clearCache(instanceId?: string): void;
}

export interface OpenClawGatewayHistoryConfigServiceDependencies {
  getInstanceDetail: (instanceId: string) => Promise<StudioInstanceDetailRecord | null>;
  resolveAttachedKernelConfigFile: (
    detail: StudioInstanceDetailRecord | null | undefined,
  ) => string | null;
  readOpenClawConfigSnapshot: (configFile: string) => Promise<OpenClawConfigSnapshot>;
  now?: () => number;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readPath(root: unknown, path: string[]) {
  let current: unknown = root;
  for (const key of path) {
    const record = readObject(current);
    if (!record) {
      return undefined;
    }
    current = record[key];
  }
  return current;
}

function normalizePositiveInteger(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function resolveHistoryMaxCharsFromSnapshot(snapshot: OpenClawConfigSnapshot) {
  return (
    normalizePositiveInteger(
      readPath(snapshot.root, ['gateway', 'webchat', 'chatHistoryMaxChars']),
    ) ??
    normalizePositiveInteger(
      readPath(snapshot.root, ['gateway', 'webchat', 'chatHistory', 'maxChars']),
    )
  );
}

class DefaultOpenClawGatewayHistoryConfigService
  implements OpenClawGatewayHistoryConfigService
{
  private readonly dependencies: OpenClawGatewayHistoryConfigServiceDependencies;
  private readonly now: () => number;
  private readonly cache = new Map<string, OpenClawGatewayHistoryConfigCacheEntry>();
  private readonly pending = new Map<string, Promise<number | undefined>>();

  constructor(dependencies: OpenClawGatewayHistoryConfigServiceDependencies) {
    this.dependencies = dependencies;
    this.now = dependencies.now ?? (() => Date.now());
  }

  async getHistoryMaxChars(instanceId: string) {
    const normalizedInstanceId = instanceId.trim();
    if (!normalizedInstanceId) {
      return undefined;
    }

    const cached = this.cache.get(normalizedInstanceId);
    const currentTime = this.now();
    if (cached && cached.expiresAt > currentTime) {
      return cached.value;
    }

    const pending = this.pending.get(normalizedInstanceId);
    if (pending) {
      return pending;
    }

    const request = this.resolveHistoryMaxChars(normalizedInstanceId)
      .then((value) => {
        this.cache.set(normalizedInstanceId, {
          expiresAt: this.now() + HISTORY_CONFIG_CACHE_TTL_MS,
          value,
        });
        return value;
      })
      .finally(() => {
        if (this.pending.get(normalizedInstanceId) === request) {
          this.pending.delete(normalizedInstanceId);
        }
      });

    this.pending.set(normalizedInstanceId, request);
    return request;
  }

  clearCache(instanceId?: string) {
    if (!instanceId) {
      this.cache.clear();
      this.pending.clear();
      return;
    }

    const normalizedInstanceId = instanceId.trim();
    this.cache.delete(normalizedInstanceId);
    this.pending.delete(normalizedInstanceId);
  }

  private async resolveHistoryMaxChars(instanceId: string) {
    const detail = await this.dependencies.getInstanceDetail(instanceId).catch(() => null);
    const configFile = this.dependencies.resolveAttachedKernelConfigFile(detail);
    if (!configFile) {
      return undefined;
    }

    const snapshot = await this.dependencies.readOpenClawConfigSnapshot(configFile);
    return resolveHistoryMaxCharsFromSnapshot(snapshot);
  }
}

export function createOpenClawGatewayHistoryConfigService(
  dependencies: OpenClawGatewayHistoryConfigServiceDependencies,
) {
  return new DefaultOpenClawGatewayHistoryConfigService(dependencies);
}

export const openClawGatewayHistoryConfigService =
  createOpenClawGatewayHistoryConfigService({
    getInstanceDetail: (instanceId) => studio.getInstanceDetail(instanceId),
    resolveAttachedKernelConfigFile: (detail) => resolveAttachedKernelConfigFile(detail),
    readOpenClawConfigSnapshot: (configFile) => openClawConfigService.readConfigSnapshot(configFile),
  });
