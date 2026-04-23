import {
  type StudioInstanceRecord,
} from '@sdkwork/claw-infrastructure';

export interface ResolveBuiltInOpenClawInstanceOptions {
  preferredInstanceId?: string | null;
  gatewayBaseUrl?: string | null;
  gatewayWebsocketUrl?: string | null;
}

function normalizeRequiredString(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeComparableUrl(value: string | null | undefined): string | null {
  const normalized = normalizeRequiredString(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    url.hash = '';
    url.search = '';
    if ((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')) {
      url.port = '';
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    return normalized.replace(/\/+$/, '');
  }
}

function isBuiltInOpenClawInstance(instance: StudioInstanceRecord): boolean {
  return (
    instance.runtimeKind === 'openclaw'
    && instance.deploymentMode === 'local-managed'
    && instance.transportKind === 'openclawGatewayWs'
  );
}

function calculateGatewayMatchScore(
  instance: StudioInstanceRecord,
  options: ResolveBuiltInOpenClawInstanceOptions,
): number {
  const gatewayBaseUrl = normalizeComparableUrl(options.gatewayBaseUrl);
  const gatewayWebsocketUrl = normalizeComparableUrl(options.gatewayWebsocketUrl);
  const instanceBaseUrl = normalizeComparableUrl(instance.baseUrl);
  const instanceWebsocketUrl = normalizeComparableUrl(instance.websocketUrl);

  let score = 0;
  if (gatewayBaseUrl && instanceBaseUrl && gatewayBaseUrl === instanceBaseUrl) {
    score += 2;
  }
  if (gatewayWebsocketUrl && instanceWebsocketUrl && gatewayWebsocketUrl === instanceWebsocketUrl) {
    score += 2;
  }
  if (instance.isBuiltIn) {
    score += 1;
  }
  if (instance.isDefault) {
    score += 1;
  }
  return score;
}

export function resolveBuiltInOpenClawInstance(
  instances: StudioInstanceRecord[] | null | undefined,
  options: ResolveBuiltInOpenClawInstanceOptions = {},
): StudioInstanceRecord | null {
  if (!Array.isArray(instances) || instances.length === 0) {
    return null;
  }

  const preferredInstanceId = normalizeRequiredString(options.preferredInstanceId);
  if (preferredInstanceId) {
    const preferredInstance = instances.find(
      (instance) => normalizeRequiredString(instance.id) === preferredInstanceId,
    );
    if (preferredInstance) {
      return preferredInstance;
    }
  }

  const rankedByGateway = instances
    .map((instance, index) => ({
      instance,
      index,
      score: calculateGatewayMatchScore(instance, options),
      builtInOpenClawPriority: isBuiltInOpenClawInstance(instance) ? 1 : 0,
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.builtInOpenClawPriority !== left.builtInOpenClawPriority) {
        return right.builtInOpenClawPriority - left.builtInOpenClawPriority;
      }
      return left.index - right.index;
    });

  if (rankedByGateway[0]?.score) {
    return rankedByGateway[0].instance;
  }

  const explicitBuiltInInstance = instances.find((instance) => instance.isBuiltIn);
  if (explicitBuiltInInstance) {
    return explicitBuiltInInstance;
  }

  const defaultInstance = instances.find((instance) => instance.isDefault);
  if (defaultInstance) {
    return defaultInstance;
  }

  const builtInOpenClawInstance = instances.find(isBuiltInOpenClawInstance);
  if (builtInOpenClawInstance) {
    return builtInOpenClawInstance;
  }

  return instances[0] ?? null;
}
