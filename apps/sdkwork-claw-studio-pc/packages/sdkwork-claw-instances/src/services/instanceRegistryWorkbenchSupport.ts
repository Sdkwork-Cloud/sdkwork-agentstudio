import type {
  StudioInstanceDetailRecord,
  StudioInstanceRecord,
} from '@sdkwork/claw-types';
import type { Instance, InstanceConfig } from '../types/index.ts';
import { isNonEmptyString } from './openClawSupport.ts';

const RUNTIME_KIND_DESCRIPTOR_PATTERN =
  /\b(runtime|kernel|agent|gateway|daemon|service|server)\b/;
const RUNTIME_KIND_NOISE_TOKENS = new Set([
  'agent',
  'app',
  'built',
  'builtin',
  'daemon',
  'desktop',
  'external',
  'gateway',
  'host',
  'in',
  'instance',
  'kernel',
  'linux',
  'local',
  'mac',
  'macos',
  'managed',
  'remote',
  'runtime',
  'server',
  'service',
  'studio',
  'windows',
  'wsl',
  'wsl2',
]);

function buildHermesOfficialRuntimeNotes(): StudioInstanceDetailRecord['officialRuntimeNotes'] {
  return [
    {
      title: 'Windows WSL2 or remote Linux',
      content: 'Windows hosts must run Hermes through WSL2 or a remote Linux environment.',
      sourceUrl: 'https://github.com/nousresearch/hermes-agent',
    },
    {
      title: 'External runtimes',
      content: 'Python and uv must be installed externally. Node.js remains external and optional for some Hermes capabilities.',
      sourceUrl: 'https://hermes-agent.nousresearch.com/docs/getting-started/installation/',
    },
  ];
}

function inferRuntimeKindFromType(
  type: string,
): StudioInstanceRecord['runtimeKind'] | null {
  const normalizedType = type.trim().toLowerCase();
  const compactType = normalizedType.replace(/[^a-z0-9]+/g, '');
  if (!compactType) {
    return null;
  }

  if (compactType.includes('openclaw')) {
    return 'openclaw';
  }
  if (compactType.includes('hermes')) {
    return 'hermes';
  }
  if (compactType.includes('zeroclaw')) {
    return 'zeroclaw';
  }
  if (compactType.includes('ironclaw')) {
    return 'ironclaw';
  }

  const genericRuntimeMatch = compactType.match(/([a-z0-9]+claw|hermes)/);
  if (genericRuntimeMatch?.[1]) {
    return genericRuntimeMatch[1] as StudioInstanceRecord['runtimeKind'];
  }

  if (!RUNTIME_KIND_DESCRIPTOR_PATTERN.test(normalizedType)) {
    return null;
  }

  const genericKernelCandidate = normalizedType
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token && !RUNTIME_KIND_NOISE_TOKENS.has(token))
    .join('');

  if (!genericKernelCandidate || genericKernelCandidate === 'custom') {
    return null;
  }

  return genericKernelCandidate as StudioInstanceRecord['runtimeKind'];
}

export function resolveRegistryKernelId(
  instance: Instance,
): StudioInstanceRecord['runtimeKind'] {
  if (isNonEmptyString(instance.runtimeKind)) {
    return instance.runtimeKind.trim() as StudioInstanceRecord['runtimeKind'];
  }

  const inferredRuntimeKind = inferRuntimeKindFromType(instance.type);
  if (inferredRuntimeKind) {
    return inferredRuntimeKind;
  }

  return 'custom';
}

export function resolveRegistryRuntimeKind(
  instance: Instance,
): StudioInstanceRecord['runtimeKind'] {
  return resolveRegistryKernelId(instance);
}

function normalizeRegistryInstanceStatus(
  status: Instance['status'],
): StudioInstanceDetailRecord['instance']['status'] {
  return status === 'syncing' ? 'starting' : status;
}

function resolveRegistryDeploymentMode(
  instance: Instance,
): StudioInstanceRecord['deploymentMode'] {
  if (
    instance.deploymentMode === 'local-managed' ||
    instance.deploymentMode === 'local-external' ||
    instance.deploymentMode === 'remote'
  ) {
    return instance.deploymentMode;
  }

  return instance.isBuiltIn ? 'local-managed' : 'remote';
}

function resolveRegistryTransportKind(
  instance: Instance,
  runtimeKind: StudioInstanceRecord['runtimeKind'],
): StudioInstanceRecord['transportKind'] {
  if (isNonEmptyString(instance.transportKind)) {
    return instance.transportKind.trim() as StudioInstanceRecord['transportKind'];
  }

  const hasBaseUrl = isNonEmptyString(instance.baseUrl);
  const hasWebsocketUrl = isNonEmptyString(instance.websocketUrl);

  switch (runtimeKind) {
    case 'openclaw':
      return 'openclawGatewayWs';
    case 'zeroclaw':
      return 'zeroclawHttp';
    case 'ironclaw':
      return 'ironclawWeb';
    case 'hermes':
      return 'customHttp';
    default:
      if (hasWebsocketUrl && !hasBaseUrl) {
        return 'customWs';
      }
      return 'customHttp';
  }
}

function resolveRegistryStorageBinding(
  instance: Instance,
  deploymentMode: StudioInstanceRecord['deploymentMode'],
): StudioInstanceRecord['storage'] {
  const provider =
    instance.storage?.provider || (deploymentMode === 'remote' ? 'remoteApi' : 'localFile');

  return {
    provider,
    namespace: instance.storage?.namespace || instance.id,
    ...(instance.storage?.profileId ? { profileId: instance.storage.profileId } : {}),
    ...(instance.storage?.database ? { database: instance.storage.database } : {}),
    ...(instance.storage?.connectionHint
      ? { connectionHint: instance.storage.connectionHint }
      : {}),
    ...(instance.storage?.endpoint ? { endpoint: instance.storage.endpoint } : {}),
  };
}

function storageCapabilitiesForProvider(
  provider: StudioInstanceRecord['storage']['provider'],
) {
  switch (provider) {
    case 'memory':
      return [false, true, false, false] as const;
    case 'localFile':
      return [true, false, false, false] as const;
    case 'sqlite':
      return [true, true, true, false] as const;
    case 'postgres':
      return [true, true, true, true] as const;
    case 'remoteApi':
      return [true, true, false, true] as const;
    default:
      return [true, false, false, false] as const;
  }
}

function resolveRegistryStorageStatus(
  storage: StudioInstanceRecord['storage'],
): StudioInstanceDetailRecord['storage']['status'] {
  switch (storage.provider) {
    case 'memory':
    case 'localFile':
      return 'ready';
    case 'sqlite':
      return isNonEmptyString(storage.namespace) ? 'ready' : 'configurationRequired';
    case 'postgres':
      return isNonEmptyString(storage.connectionHint) ? 'ready' : 'configurationRequired';
    case 'remoteApi':
      return isNonEmptyString(storage.endpoint) ? 'planned' : 'configurationRequired';
    default:
      return 'planned';
  }
}

function resolveRegistryLifecycleOwner(
  instance: Instance,
  deploymentMode: StudioInstanceRecord['deploymentMode'],
): StudioInstanceDetailRecord['lifecycle']['owner'] {
  if (deploymentMode === 'remote') {
    return 'remoteService';
  }

  if (instance.isBuiltIn && deploymentMode === 'local-managed') {
    return 'appManaged';
  }

  return 'externalProcess';
}

function defaultCapabilitiesForRuntime(
  runtimeKind: StudioInstanceRecord['runtimeKind'],
): StudioInstanceRecord['capabilities'] {
  if (runtimeKind === 'openclaw') {
    return ['chat', 'health', 'files', 'memory', 'tasks', 'tools', 'models'];
  }

  if (runtimeKind === 'hermes') {
    return ['chat', 'health', 'files', 'memory', 'tools', 'models'];
  }

  if (runtimeKind === 'custom') {
    return ['chat', 'health'];
  }

  return ['chat', 'health', 'models'];
}

function isLoopbackHost(value: string) {
  const fallback = value.trim().replace(/^\[|\]$/g, '').toLowerCase();
  return (
    fallback === '127.0.0.1' ||
    fallback === '::1' ||
    fallback === 'localhost' ||
    fallback.endsWith('.localhost')
  );
}

function buildRegistryConnectivityEndpoints(
  instance: Instance,
  token: string | undefined,
  deploymentMode: StudioInstanceRecord['deploymentMode'],
  baseUrl: string | null,
  websocketUrl: string | null,
): StudioInstanceDetailRecord['connectivity']['endpoints'] {
  const exposure: StudioInstanceDetailRecord['connectivity']['endpoints'][number]['exposure'] =
    deploymentMode === 'remote'
      ? 'remote'
      : isLoopbackHost(instance.ip)
        ? 'loopback'
        : 'private';
  const auth: StudioInstanceDetailRecord['connectivity']['endpoints'][number]['auth'] = token
    ? 'token'
    : deploymentMode === 'remote'
      ? 'external'
      : 'unknown';
  const endpoints: StudioInstanceDetailRecord['connectivity']['endpoints'] = [];

  if (baseUrl) {
    endpoints.push({
      id: 'base-url',
      label: 'Base URL',
      kind: 'http',
      status: 'ready',
      url: baseUrl,
      exposure,
      auth,
      source: 'config',
    });
  }

  if (websocketUrl) {
    endpoints.push({
      id: 'websocket-url',
      label: 'WebSocket URL',
      kind: 'websocket',
      status: 'ready',
      url: websocketUrl,
      exposure,
      auth,
      source: 'config',
    });
  }

  return endpoints;
}

export function buildRegistryBackedDetail(
  instance: Instance,
  config: InstanceConfig,
  token: string | undefined,
  logs: string,
): StudioInstanceDetailRecord {
  const evaluatedAt = Date.now();
  const healthScore = instance.status === 'online' ? 80 : 35;
  const healthStatus =
    instance.status === 'online'
      ? 'healthy'
      : instance.status === 'offline'
        ? 'offline'
        : 'attention';
  const runtimeKind = resolveRegistryKernelId(instance);
  const deploymentMode = resolveRegistryDeploymentMode(instance);
  const transportKind = resolveRegistryTransportKind(instance, runtimeKind);
  const baseUrl = isNonEmptyString(instance.baseUrl) ? instance.baseUrl : null;
  const websocketUrl = isNonEmptyString(instance.websocketUrl) ? instance.websocketUrl : null;
  const storageBinding = resolveRegistryStorageBinding(instance, deploymentMode);
  const [durable, queryable, transactional, remote] = storageCapabilitiesForProvider(
    storageBinding.provider,
  );
  const lifecycleOwner = resolveRegistryLifecycleOwner(instance, deploymentMode);
  const capabilities = defaultCapabilitiesForRuntime(runtimeKind);
  const connectivityEndpoints = buildRegistryConnectivityEndpoints(
    instance,
    token,
    deploymentMode,
    baseUrl,
    websocketUrl,
  );
  const storageStatus = resolveRegistryStorageStatus(storageBinding);
  const configSnapshot = {
    port: config.port,
    sandbox: config.sandbox,
    autoUpdate: config.autoUpdate,
    logLevel: config.logLevel,
    corsOrigins: config.corsOrigins,
    ...(baseUrl ? { baseUrl } : {}),
    ...(websocketUrl ? { websocketUrl } : {}),
    ...(token ? { authToken: token } : {}),
  };

  return {
    instance: {
      id: instance.id,
      name: instance.name,
      description: undefined,
      runtimeKind,
      deploymentMode,
      transportKind,
      status: normalizeRegistryInstanceStatus(instance.status),
      isBuiltIn: instance.isBuiltIn === true,
      isDefault: false,
      iconType: instance.iconType,
      version: instance.version,
      typeLabel: instance.type,
      host: instance.ip,
      port: Number.parseInt(config.port, 10) || null,
      baseUrl,
      websocketUrl,
      cpu: instance.cpu,
      memory: instance.memory,
      totalMemory: instance.totalMemory,
      uptime: instance.uptime,
      capabilities,
      storage: {
        ...storageBinding,
      },
      config: configSnapshot,
      createdAt: evaluatedAt,
      updatedAt: evaluatedAt,
      lastSeenAt: evaluatedAt,
    },
    config: configSnapshot,
    logs,
    health: {
      score: healthScore,
      status: healthStatus,
      checks: [],
      evaluatedAt,
    },
    lifecycle: {
      owner: lifecycleOwner,
      startStopSupported: false,
      configWritable: false,
      workbenchManaged: false,
      endpointObserved: false,
      lifecycleControllable: false,
      notes: ['Registry-backed detail projection.'],
    },
    storage: {
      status: storageStatus,
      ...storageBinding,
      durable,
      queryable,
      transactional,
      remote,
    },
    connectivity: {
      primaryTransport: transportKind,
      endpoints: connectivityEndpoints,
    },
    observability: {
      status: logs ? 'limited' : 'unavailable',
      logAvailable: Boolean(logs),
      logPreview: logs ? logs.split('\n').filter(Boolean).slice(-5) : [],
      metricsSource: 'derived',
      lastSeenAt: evaluatedAt,
    },
    dataAccess: {
      routes: [
        {
          id: 'config',
          label: 'Configuration',
          scope: 'config',
          mode: 'metadataOnly',
          status: 'ready',
          target: 'studio.instances registry metadata',
          readonly: false,
          authoritative: false,
          detail: 'Registry-backed detail projects configuration from Claw Studio metadata.',
          source: 'integration',
        },
        {
          id: 'logs',
          label: 'Logs',
          scope: 'logs',
          mode: 'metadataOnly',
          status: logs ? 'limited' : 'planned',
          target: null,
          readonly: true,
          authoritative: false,
          detail: 'Registry-backed detail only exposes derived log preview lines.',
          source: 'derived',
        },
      ],
    },
    artifacts: [
      {
        id: 'storage-binding',
        label: 'Storage Binding',
        kind: 'storageBinding',
        status:
          storageStatus === 'ready'
            ? remote
              ? 'remote'
              : 'available'
            : storageStatus === 'planned'
              ? 'planned'
              : 'missing',
        location:
          storageBinding.endpoint ||
          storageBinding.database ||
          storageBinding.namespace ||
          instance.id,
        readonly: false,
        detail: 'Registry-backed detail projects storage metadata only.',
        source: 'storage',
      },
    ],
    capabilities: capabilities.map((id) => ({
      id,
      status: 'ready',
      detail: 'Registry-backed detail projection.',
      source: 'runtime',
    })),
    officialRuntimeNotes: runtimeKind === 'hermes' ? buildHermesOfficialRuntimeNotes() : [],
  };
}
