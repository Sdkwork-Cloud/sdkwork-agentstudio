import type {
  StudioInstanceConsoleAccessRecord,
  StudioInstanceDetailRecord,
} from '@sdkwork/claw-types';

export interface InstanceManagementAction {
  id: 'start' | 'stop' | 'restart' | (string & {});
  label: string;
  enabled: boolean;
  scope: 'shared' | 'kernelModule';
  reason?: string | null;
  confirmationLabel?: string | null;
}

export interface InstanceConsoleAvailability {
  available: boolean;
  entryUrl?: string | null;
  autoLoginUrl?: string | null;
  authMode: string;
  source: string;
  reason?: string | null;
}

export interface InstanceDiagnosticEntry {
  id: string;
  label: string;
  value: string;
  severity?: 'info' | 'warning' | 'error' | (string & {});
}

export interface InstanceBaseDetail {
  instance: {
    kernelId: StudioInstanceDetailRecord['instance']['runtimeKind'];
    instanceId: string;
    displayName: string;
    deploymentMode: StudioInstanceDetailRecord['instance']['deploymentMode'];
    transportId: StudioInstanceDetailRecord['instance']['transportKind'];
    status: StudioInstanceDetailRecord['instance']['status'];
    version: string;
    isBuiltIn?: boolean;
    hostLabel?: string | null;
  };
  lifecycle: {
    owner: StudioInstanceDetailRecord['lifecycle']['owner'];
    lifecycle: string;
    activationStage?: StudioInstanceDetailRecord['lifecycle']['lastActivationStage'] | null;
    configWritable: boolean;
    lifecycleControllable: boolean;
    notes: string[];
  };
  health: {
    score: StudioInstanceDetailRecord['health']['score'];
    status: StudioInstanceDetailRecord['health']['status'];
    checks: StudioInstanceDetailRecord['health']['checks'];
  };
  storage: {
    status: StudioInstanceDetailRecord['storage']['status'];
    provider: StudioInstanceDetailRecord['storage']['provider'];
    namespace: string;
    profileId?: string | null;
    database?: string | null;
    connectionHint?: string | null;
    endpoint?: string | null;
    durable: boolean;
    queryable: boolean;
    transactional: boolean;
    remote: boolean;
  };
  connectivity: {
    transportId: StudioInstanceDetailRecord['connectivity']['primaryTransport'];
    endpoints: StudioInstanceDetailRecord['connectivity']['endpoints'];
  };
  observability: {
    status: StudioInstanceDetailRecord['observability']['status'];
    logAvailable: boolean;
    logLocations: string[];
    lastSeenAt?: number | null;
    logPreview: string[];
    metricsSource: StudioInstanceDetailRecord['observability']['metricsSource'];
  };
  dataAccess: {
    routes: StudioInstanceDetailRecord['dataAccess']['routes'];
  };
  artifacts: StudioInstanceDetailRecord['artifacts'];
  capabilities: StudioInstanceDetailRecord['capabilities'];
  runtimeNotes: StudioInstanceDetailRecord['officialRuntimeNotes'];
  management: {
    actions: InstanceManagementAction[];
    consoleAvailability?: InstanceConsoleAvailability | null;
    diagnostics: InstanceDiagnosticEntry[];
  };
}

function resolveLifecycleMode(detail: StudioInstanceDetailRecord): string {
  if (detail.lifecycle.lifecycleControllable) {
    return 'controllable';
  }
  if (detail.lifecycle.startStopSupported) {
    return 'managed';
  }
  return 'observed';
}

function projectConsoleAvailability(
  consoleAccess: StudioInstanceConsoleAccessRecord | null | undefined,
): InstanceConsoleAvailability | null {
  if (!consoleAccess) {
    return null;
  }

  return {
    available: consoleAccess.available,
    entryUrl: consoleAccess.url ?? null,
    autoLoginUrl: consoleAccess.autoLoginUrl ?? null,
    authMode: consoleAccess.authMode,
    source: consoleAccess.authSource || 'unresolved',
    reason: consoleAccess.reason ?? null,
  };
}

function isTransitioningLifecycleStatus(status: StudioInstanceDetailRecord['instance']['status']) {
  return status === 'starting' || status === 'syncing';
}

function buildManagementActions(detail: StudioInstanceDetailRecord): InstanceManagementAction[] {
  const lifecycleControllable =
    detail.lifecycle.lifecycleControllable ?? detail.lifecycle.startStopSupported;

  if (!lifecycleControllable) {
    return [];
  }

  const canStart = detail.instance.status !== 'online' && !isTransitioningLifecycleStatus(detail.instance.status);
  const canStop = detail.instance.status === 'online' || isTransitioningLifecycleStatus(detail.instance.status);
  const canRestart = detail.instance.status !== 'offline';

  return [
    {
      id: 'start',
      label: 'Start',
      enabled: canStart,
      scope: 'shared',
      reason: canStart ? null : 'Instance is already starting or online.',
    },
    {
      id: 'stop',
      label: 'Stop',
      enabled: canStop,
      scope: 'shared',
      reason: canStop ? null : 'Instance is not running.',
    },
    {
      id: 'restart',
      label: 'Restart',
      enabled: canRestart,
      scope: 'shared',
      reason: canRestart ? null : 'Instance is offline.',
    },
  ];
}

function buildDiagnostics(detail: StudioInstanceDetailRecord): InstanceDiagnosticEntry[] {
  const diagnostics: InstanceDiagnosticEntry[] = [];

  if (detail.observability.logFilePath) {
    diagnostics.push({
      id: 'logFilePath',
      label: 'Log file',
      value: detail.observability.logFilePath,
      severity: 'info',
    });
  }

  if (detail.consoleAccess?.gatewayUrl) {
    diagnostics.push({
      id: 'gatewayUrl',
      label: 'Gateway URL',
      value: detail.consoleAccess.gatewayUrl,
      severity: 'info',
    });
  }

  if (detail.lifecycle.lastError) {
    diagnostics.push({
      id: 'lastLifecycleError',
      label: 'Last lifecycle error',
      value: detail.lifecycle.lastError,
      severity: 'error',
    });
  }

  return diagnostics;
}

export function projectInstanceBaseDetail(detail: StudioInstanceDetailRecord): InstanceBaseDetail {
  return {
    instance: {
      kernelId: detail.instance.runtimeKind,
      instanceId: detail.instance.id,
      displayName: detail.instance.name,
      deploymentMode: detail.instance.deploymentMode,
      transportId: detail.instance.transportKind,
      status: detail.instance.status,
      version: detail.instance.version,
      isBuiltIn: detail.instance.isBuiltIn,
      hostLabel: detail.instance.host || detail.instance.baseUrl || null,
    },
    lifecycle: {
      owner: detail.lifecycle.owner,
      lifecycle: resolveLifecycleMode(detail),
      activationStage: detail.lifecycle.lastActivationStage ?? null,
      configWritable: detail.lifecycle.configWritable,
      lifecycleControllable:
        detail.lifecycle.lifecycleControllable ?? detail.lifecycle.startStopSupported,
      notes: [...detail.lifecycle.notes],
    },
    health: {
      score: detail.health.score,
      status: detail.health.status,
      checks: [...detail.health.checks],
    },
    storage: {
      status: detail.storage.status,
      provider: detail.storage.provider,
      namespace: detail.storage.namespace,
      profileId: detail.storage.profileId ?? null,
      database: detail.storage.database ?? null,
      connectionHint: detail.storage.connectionHint ?? null,
      endpoint: detail.storage.endpoint ?? null,
      durable: detail.storage.durable,
      queryable: detail.storage.queryable,
      transactional: detail.storage.transactional,
      remote: detail.storage.remote,
    },
    connectivity: {
      transportId: detail.connectivity.primaryTransport,
      endpoints: [...detail.connectivity.endpoints],
    },
    observability: {
      status: detail.observability.status,
      logAvailable: detail.observability.logAvailable,
      logLocations: detail.observability.logFilePath ? [detail.observability.logFilePath] : [],
      lastSeenAt: detail.observability.lastSeenAt ?? null,
      logPreview: [...detail.observability.logPreview],
      metricsSource: detail.observability.metricsSource,
    },
    dataAccess: {
      routes: [...detail.dataAccess.routes],
    },
    artifacts: [...detail.artifacts],
    capabilities: [...detail.capabilities],
    runtimeNotes: [...detail.officialRuntimeNotes],
    management: {
      actions: buildManagementActions(detail),
      consoleAvailability: projectConsoleAvailability(detail.consoleAccess),
      diagnostics: buildDiagnostics(detail),
    },
  };
}
