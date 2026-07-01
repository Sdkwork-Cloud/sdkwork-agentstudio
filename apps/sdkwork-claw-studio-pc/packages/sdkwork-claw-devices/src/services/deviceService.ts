import { openClawGatewayClient, studio } from '@sdkwork/claw-infrastructure';

export interface DeviceWorkspaceInstance {
  id: string;
  name: string;
  runtimeKind: string;
  status?: string;
  isDefault?: boolean;
  isBuiltIn?: boolean;
  version?: string;
  typeLabel?: string;
}

export interface DeviceTokenSummary {
  role: string;
  scopes: string[];
  createdAtMs?: number;
  rotatedAtMs?: number;
  revokedAtMs?: number;
  lastUsedAtMs?: number;
}

export interface PendingDevicePairing {
  requestId: string;
  deviceId: string;
  name: string;
  roles: string[];
  scopes: string[];
  remoteIp?: string;
  requestedAtMs?: number;
  isRepair?: boolean;
}

export interface PairedDeviceRecord {
  id: string;
  name: string;
  roles: string[];
  scopes: string[];
  remoteIp?: string;
  approvedAtMs?: number;
  createdAtMs?: number;
  tokenList: DeviceTokenSummary[];
  tokens: DeviceTokenSummary[];
}

export interface DeviceWorkspaceSnapshot {
  instance: DeviceWorkspaceInstance;
  pending: PendingDevicePairing[];
  paired: PairedDeviceRecord[];
}

export interface RotateDeviceTokenInput {
  deviceId: string;
  role: string;
  scopes?: string[];
}

export interface RotateDeviceTokenResult {
  deviceId: string;
  role: string;
  scopes: string[];
  token: string;
  rotatedAtMs?: number;
}

interface DeviceServiceDependencies {
  studioApi: {
    listInstances(): Promise<DeviceWorkspaceInstance[]>;
  };
  gatewayClient: {
    listDevicePairings(instanceId: string, args?: Record<string, unknown>): Promise<unknown>;
    approveDevicePairing(instanceId: string, args: Record<string, unknown>): Promise<unknown>;
    rejectDevicePairing(instanceId: string, args: Record<string, unknown>): Promise<unknown>;
    removeDevicePairing(instanceId: string, args: Record<string, unknown>): Promise<unknown>;
    rotateDeviceToken(instanceId: string, args: Record<string, unknown>): Promise<unknown>;
    revokeDeviceToken(instanceId: string, args: Record<string, unknown>): Promise<unknown>;
  };
}

export interface DeviceServiceDependencyOverrides {
  studioApi?: Partial<DeviceServiceDependencies['studioApi']>;
  gatewayClient?: Partial<DeviceServiceDependencies['gatewayClient']>;
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalizePendingDevice(entry: unknown): PendingDevicePairing | null {
  const record = asObject(entry);
  const requestId = asString(record.requestId)?.trim() || '';
  const deviceId = asString(record.deviceId)?.trim() || '';

  if (!requestId || !deviceId) {
    return null;
  }

  const role = asString(record.role)?.trim();
  const roles = dedupeStrings([...readStringArray(record.roles), ...(role ? [role] : [])]);

  return {
    requestId,
    deviceId,
    name: asString(record.displayName)?.trim() || deviceId,
    roles,
    scopes: dedupeStrings(readStringArray(record.scopes)),
    remoteIp: asString(record.remoteIp)?.trim(),
    requestedAtMs: asNumber(record.ts) ?? asNumber(record.createdAtMs),
    isRepair: record.isRepair === true,
  };
}

function normalizeTokenSummary(entry: unknown): DeviceTokenSummary | null {
  const record = asObject(entry);
  const role = asString(record.role)?.trim() || '';

  if (!role) {
    return null;
  }

  return {
    role,
    scopes: dedupeStrings(readStringArray(record.scopes)),
    createdAtMs: asNumber(record.createdAtMs),
    rotatedAtMs: asNumber(record.rotatedAtMs),
    revokedAtMs: asNumber(record.revokedAtMs),
    lastUsedAtMs: asNumber(record.lastUsedAtMs),
  };
}

function normalizePairedDevice(entry: unknown): PairedDeviceRecord | null {
  const record = asObject(entry);
  const deviceId = asString(record.deviceId)?.trim() || '';

  if (!deviceId) {
    return null;
  }

  const tokens = Array.isArray(record.tokens)
    ? record.tokens.map(normalizeTokenSummary).filter((token): token is DeviceTokenSummary => Boolean(token))
    : [];
  const role = asString(record.role)?.trim();
  const roles = dedupeStrings([...readStringArray(record.roles), ...(role ? [role] : [])]);

  return {
    id: deviceId,
    name: asString(record.displayName)?.trim() || deviceId,
    roles,
    scopes: dedupeStrings(readStringArray(record.scopes)),
    remoteIp: asString(record.remoteIp)?.trim(),
    approvedAtMs: asNumber(record.approvedAtMs),
    createdAtMs: asNumber(record.createdAtMs),
    tokenList: tokens,
    tokens,
  };
}

function normalizeRotateTokenResult(
  value: unknown,
  input: RotateDeviceTokenInput,
): RotateDeviceTokenResult {
  const record = asObject(value);
  const token = asString(record.token)?.trim() || '';

  if (!token) {
    throw new Error('OpenClaw did not return a device token.');
  }

  return {
    deviceId: asString(record.deviceId)?.trim() || input.deviceId,
    role: asString(record.role)?.trim() || input.role,
    scopes: dedupeStrings(readStringArray(record.scopes).length ? readStringArray(record.scopes) : input.scopes || []),
    token,
    rotatedAtMs: asNumber(record.rotatedAtMs) ?? asNumber(record.createdAtMs),
  };
}

function pickTargetInstance(
  instances: DeviceWorkspaceInstance[],
  preferredInstanceId?: string,
): DeviceWorkspaceInstance | null {
  const openClawInstances = instances.filter((instance) => instance.runtimeKind === 'openclaw');

  if (preferredInstanceId) {
    const preferred = openClawInstances.find((instance) => instance.id === preferredInstanceId);
    if (preferred) {
      return preferred;
    }
  }

  return (
    openClawInstances.find((instance) => instance.isDefault) ||
    openClawInstances.find((instance) => instance.isBuiltIn) ||
    openClawInstances.find((instance) => instance.status === 'online') ||
    openClawInstances[0] ||
    null
  );
}

function createDefaultDependencies(): DeviceServiceDependencies {
  return {
    studioApi: {
      listInstances: () => studio.listInstances(),
    },
    gatewayClient: {
      listDevicePairings: (instanceId, args = {}) => openClawGatewayClient.listDevicePairings(instanceId, args),
      approveDevicePairing: (instanceId, args) => openClawGatewayClient.approveDevicePairing(instanceId, args),
      rejectDevicePairing: (instanceId, args) => openClawGatewayClient.rejectDevicePairing(instanceId, args),
      removeDevicePairing: (instanceId, args) => openClawGatewayClient.removeDevicePairing(instanceId, args),
      rotateDeviceToken: (instanceId, args) => openClawGatewayClient.rotateDeviceToken(instanceId, args),
      revokeDeviceToken: (instanceId, args) => openClawGatewayClient.revokeDeviceToken(instanceId, args),
    },
  };
}

function mergeDependencies(
  overrides: DeviceServiceDependencyOverrides = {},
): DeviceServiceDependencies {
  const defaults = createDefaultDependencies();

  return {
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    gatewayClient: {
      ...defaults.gatewayClient,
      ...(overrides.gatewayClient || {}),
    },
  };
}

function requireGatewayMethod<T extends keyof DeviceServiceDependencies['gatewayClient']>(
  dependencies: DeviceServiceDependencies,
  key: T,
) {
  const method = dependencies.gatewayClient[key];
  if (typeof method !== 'function') {
    throw new Error(`OpenClaw gateway method "${String(key)}" is unavailable.`);
  }

  return method;
}

class DeviceService {
  private readonly dependencies: DeviceServiceDependencies;

  constructor(dependencies: DeviceServiceDependencies) {
    this.dependencies = dependencies;
  }

  private async resolveTargetInstance(preferredInstanceId?: string) {
    const instances = await this.dependencies.studioApi.listInstances();
    const target = pickTargetInstance(instances, preferredInstanceId);

    if (!target) {
      throw new Error('No OpenClaw instance is available for device pairing management.');
    }

    return target;
  }

  async getWorkspaceSnapshot(preferredInstanceId?: string): Promise<DeviceWorkspaceSnapshot> {
    const target = await this.resolveTargetInstance(preferredInstanceId);
    const listDevicePairings = requireGatewayMethod(this.dependencies, 'listDevicePairings');
    const result = asObject(await listDevicePairings(target.id, {}));

    const pending = Array.isArray(result.pending)
      ? result.pending
          .map(normalizePendingDevice)
          .filter((entry): entry is PendingDevicePairing => Boolean(entry))
      : [];
    const paired = Array.isArray(result.paired)
      ? result.paired
          .map(normalizePairedDevice)
          .filter((entry): entry is PairedDeviceRecord => Boolean(entry))
      : [];

    return {
      instance: target,
      pending,
      paired,
    };
  }

  async approvePairing(requestId: string, preferredInstanceId?: string) {
    const target = await this.resolveTargetInstance(preferredInstanceId);
    const approveDevicePairing = requireGatewayMethod(this.dependencies, 'approveDevicePairing');
    await approveDevicePairing(target.id, { requestId });
  }

  async rejectPairing(requestId: string, preferredInstanceId?: string) {
    const target = await this.resolveTargetInstance(preferredInstanceId);
    const rejectDevicePairing = requireGatewayMethod(this.dependencies, 'rejectDevicePairing');
    await rejectDevicePairing(target.id, { requestId });
  }

  async removeDevice(deviceId: string, preferredInstanceId?: string) {
    const target = await this.resolveTargetInstance(preferredInstanceId);
    const removeDevicePairing = requireGatewayMethod(this.dependencies, 'removeDevicePairing');
    await removeDevicePairing(target.id, { deviceId });
  }

  async rotateToken(
    input: RotateDeviceTokenInput,
    preferredInstanceId?: string,
  ): Promise<RotateDeviceTokenResult> {
    const target = await this.resolveTargetInstance(preferredInstanceId);
    const rotateDeviceToken = requireGatewayMethod(this.dependencies, 'rotateDeviceToken');
    const result = await rotateDeviceToken(target.id, {
      deviceId: input.deviceId,
      role: input.role,
      scopes: input.scopes,
    });

    return normalizeRotateTokenResult(result, input);
  }

  async revokeToken(
    input: Pick<RotateDeviceTokenInput, 'deviceId' | 'role'>,
    preferredInstanceId?: string,
  ) {
    const target = await this.resolveTargetInstance(preferredInstanceId);
    const revokeDeviceToken = requireGatewayMethod(this.dependencies, 'revokeDeviceToken');
    await revokeDeviceToken(target.id, {
      deviceId: input.deviceId,
      role: input.role,
    });
  }
}

export function createDeviceService(
  overrides: DeviceServiceDependencyOverrides = {},
) {
  return new DeviceService(mergeDependencies(overrides));
}

export const deviceService = createDeviceService();
