import {
  installerService,
  runtime,
  studio,
  type InstallAssessmentResult,
  type InstallCatalogEntry,
  type InstallCatalogQuery,
  type InstallRequest,
  type RuntimeInfo,
  type StudioCreateInstanceInput,
  type StudioInstanceRecord,
  type StudioUpdateInstanceInput,
} from '@sdkwork/claw-infrastructure';
import {
  kernelConfigDiscoveryService,
  openClawConfigService,
  resolveOpenClawStateRootFromConfigFile,
  type ListKernelInstallConfigPathCandidatesInput,
} from '@sdkwork/claw-core';

export interface OpenClawAssociationSnapshot {
  root: Record<string, unknown>;
  defaultWorkspacePath?: string | null;
}

export interface DiscoveredInstalledOpenClawInstall {
  id: string;
  label: string;
  summary: string;
  methodId: string | null;
  methodLabel: string;
  runtimePlatform: 'host' | 'wsl';
  installControlLevel: InstallAssessmentResult['installControlLevel'];
  installStatus: NonNullable<InstallAssessmentResult['installStatus']>;
  configFile: string | null;
  installRoot: string | null;
  workRoot: string | null;
  dataRoot: string | null;
  workspacePath: string | null;
  baseUrl: string | null;
  websocketUrl: string | null;
  associatedInstanceId: string | null;
  associationStatus: 'associated' | 'readyToAssociate' | 'configMissing';
}

export interface AssociateInstalledOpenClawInstallInput {
  request: InstallRequest;
}

export interface AssociateOpenClawConfigFileInput {
  configFile: string;
  installationMethodId?: string | null;
  installationMethodLabel?: string | null;
  installRoot?: string | null;
  workRoot?: string | null;
  dataRoot?: string | null;
}

export interface OpenClawAssociationResult {
  mode: 'created' | 'updated';
  instance: StudioInstanceRecord;
  configFile: string;
}

export interface CreateRemoteOpenClawInstanceInput {
  name: string;
  host: string;
  port: number;
  secure?: boolean;
  authToken?: string | null;
  description?: string;
}

interface InstanceOnboardingDependencies {
  runtimeApi: {
    getRuntimeInfo(): Promise<RuntimeInfo>;
  };
  installerApi: {
    listInstallCatalog(query?: InstallCatalogQuery): Promise<InstallCatalogEntry[]>;
    inspectInstall(request: InstallRequest): Promise<InstallAssessmentResult>;
  };
  studioApi: {
    listInstances(): Promise<StudioInstanceRecord[]>;
    createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord>;
    updateInstance(id: string, input: StudioUpdateInstanceInput): Promise<StudioInstanceRecord>;
  };
  kernelConfigApi: {
    resolveInstallConfigPath(input: ListKernelInstallConfigPathCandidatesInput): Promise<string | null>;
  };
  openClawAssociationApi: {
    readAssociationSnapshot(configFile: string): Promise<OpenClawAssociationSnapshot>;
  };
}

export interface InstanceOnboardingDependencyOverrides {
  runtimeApi?: Partial<InstanceOnboardingDependencies['runtimeApi']>;
  installerApi?: Partial<InstanceOnboardingDependencies['installerApi']>;
  studioApi?: Partial<InstanceOnboardingDependencies['studioApi']>;
  kernelConfigApi?: Partial<InstanceOnboardingDependencies['kernelConfigApi']>;
  openClawAssociationApi?: Partial<InstanceOnboardingDependencies['openClawAssociationApi']>;
}

function createDefaultDependencies(): InstanceOnboardingDependencies {
  return {
    runtimeApi: {
      getRuntimeInfo: () => runtime.getRuntimeInfo(),
    },
    installerApi: {
      listInstallCatalog: (query) => installerService.listInstallCatalog(query),
      inspectInstall: (request) => installerService.inspectInstall(request),
    },
    studioApi: {
      listInstances: () => studio.listInstances(),
      createInstance: (input) => studio.createInstance(input),
      updateInstance: (id, input) => studio.updateInstance(id, input),
    },
    kernelConfigApi: {
      resolveInstallConfigPath: (input) =>
        kernelConfigDiscoveryService.resolveInstallConfigPath(input),
    },
    openClawAssociationApi: {
      readAssociationSnapshot: async (configFile) => {
        const snapshot = await openClawConfigService.readConfigSnapshot(configFile);
        const defaultAgent =
          snapshot.agentSnapshots.find((agent) => agent.isDefault) ||
          snapshot.agentSnapshots[0] ||
          null;

        return {
          root: snapshot.root as Record<string, unknown>,
          defaultWorkspacePath: defaultAgent?.workspace || null,
        };
      },
    },
  };
}

function normalizePath(path?: string | null) {
  return path?.replace(/\\/g, '/').trim() || null;
}

function normalizeNullableString(value?: string | null) {
  const normalized = value?.trim() || '';
  return normalized || null;
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parsePort(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 28789;
}

function normalizeControlUiBasePath(value: unknown) {
  const trimmed = readString(value);
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`;
}

function toGatewayWebsocketPath(basePath: string) {
  return basePath === '/' ? '' : basePath.replace(/\/$/, '');
}

function buildGatewayUrls(root: Record<string, unknown>) {
  const gateway = readObject(root.gateway);
  const port = parsePort(gateway?.port);
  const controlUi = readObject(gateway?.controlUi);
  const websocketPath = toGatewayWebsocketPath(
    normalizeControlUiBasePath(controlUi?.basePath),
  );

  return {
    host: '127.0.0.1',
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    websocketUrl: `ws://127.0.0.1:${port}${websocketPath}`,
  };
}

function resolveSyncedOpenClawAuthToken(input: {
  root: Record<string, unknown>;
  existingAuthToken?: string | null;
}) {
  const gateway = readObject(input.root.gateway);
  const auth = readObject(gateway?.auth);
  const configuredToken = readString(auth?.token);

  if (configuredToken) {
    return configuredToken;
  }

  return normalizeNullableString(input.existingAuthToken);
}

function resolveWorkspacePath(input: {
  snapshot: OpenClawAssociationSnapshot;
  workRoot?: string | null;
  dataRoot?: string | null;
  installRoot?: string | null;
  configFile: string;
}) {
  return (
    normalizePath(input.snapshot.defaultWorkspacePath) ||
    normalizePath(input.workRoot) ||
    normalizePath(input.dataRoot) ||
    normalizePath(input.installRoot) ||
    normalizePath(resolveOpenClawStateRootFromConfigFile(input.configFile))
  );
}

function findMatchingLocalExternalInstance(
  instances: StudioInstanceRecord[],
  input: {
    workspacePath?: string | null;
    baseUrl?: string | null;
    websocketUrl?: string | null;
  },
) {
  const workspacePath = normalizePath(input.workspacePath);
  const baseUrl = normalizePath(input.baseUrl);
  const websocketUrl = normalizePath(input.websocketUrl);

  return (
    instances.find(
      (instance) =>
        instance.runtimeKind === 'openclaw' &&
        instance.deploymentMode === 'local-external' &&
        ((workspacePath && normalizePath(instance.config.workspacePath) === workspacePath) ||
          (baseUrl && normalizePath(instance.baseUrl) === baseUrl) ||
          (websocketUrl && normalizePath(instance.websocketUrl) === websocketUrl)),
    ) || null
  );
}

function getHostOs(runtimeInfo: RuntimeInfo) {
  const os = runtimeInfo.system?.os?.toLowerCase() ?? '';
  if (os.includes('win')) {
    return 'windows' as const;
  }
  if (os.includes('mac') || os.includes('darwin')) {
    return 'macos' as const;
  }
  if (os.includes('linux') || os.includes('ubuntu')) {
    return 'linux' as const;
  }
  return 'unknown' as const;
}

function toCatalogQuery(runtimeInfo: RuntimeInfo): InstallCatalogQuery | undefined {
  const hostOs = getHostOs(runtimeInfo);
  if (hostOs === 'windows' || hostOs === 'macos') {
    return { hostPlatform: hostOs };
  }
  if (hostOs === 'linux') {
    return { hostPlatform: 'ubuntu' };
  }

  return undefined;
}

function selectOpenClawCatalogEntry(entries: InstallCatalogEntry[]) {
  return (
    entries.find((entry) => entry.appId === 'app-openclaw') ||
    entries.find((entry) => entry.defaultSoftwareName === 'openclaw') ||
    null
  );
}

function resolveHomeRoots(runtimeInfo: RuntimeInfo, assessment: InstallAssessmentResult) {
  const homeRoots = new Set<string>();
  const runtimeHome = normalizePath(assessment.runtime.runtimeHomeDir);
  const userRoot = normalizePath(runtimeInfo.paths?.userRoot);
  const userDir = normalizePath(runtimeInfo.paths?.userDir);

  if (runtimeHome) {
    homeRoots.add(runtimeHome);
  }
  if (userRoot) {
    homeRoots.add(userRoot);
  }
  if (userDir) {
    homeRoots.add(userDir);
  }

  return [...homeRoots];
}

function buildInstalledKernelConfigLookupInput(input: {
  kernelId: string;
  runtimeInfo: RuntimeInfo;
  assessment: InstallAssessmentResult;
}): ListKernelInstallConfigPathCandidatesInput {
  return {
    kernelId: input.kernelId,
    installRoot: input.assessment.resolvedInstallRoot,
    workRoot: input.assessment.resolvedWorkRoot,
    dataRoot: input.assessment.resolvedDataRoot,
    homeRoots: resolveHomeRoots(input.runtimeInfo, input.assessment),
  };
}

function buildLocalExternalInstanceCreateInput(input: {
  workspacePath: string | null;
  baseUrl: string;
  websocketUrl: string;
  port: number;
  authToken: string | null;
}) {
  return {
    name: 'OpenClaw Host',
    description: 'Attached OpenClaw runtime synchronized from an existing installation.',
    runtimeKind: 'openclaw' as const,
    deploymentMode: 'local-external' as const,
    transportKind: 'openclawGatewayWs' as const,
    iconType: 'server' as const,
    version: 'host-managed',
    typeLabel: 'Associated OpenClaw',
    host: '127.0.0.1',
    port: input.port,
    baseUrl: input.baseUrl,
    websocketUrl: input.websocketUrl,
    storage: {
      provider: 'localFile' as const,
      namespace: 'openclaw-local-external',
    },
    config: {
      port: String(input.port),
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      workspacePath: input.workspacePath,
      baseUrl: input.baseUrl,
      websocketUrl: input.websocketUrl,
      authToken: input.authToken,
    },
  } satisfies StudioCreateInstanceInput;
}

function buildLocalExternalInstanceUpdateInput(input: {
  workspacePath: string | null;
  baseUrl: string;
  websocketUrl: string;
  port: number;
  authToken: string | null;
}) {
  return {
    name: 'OpenClaw Host',
    description: 'Attached OpenClaw runtime synchronized from an existing installation.',
    iconType: 'server' as const,
    version: 'host-managed',
    typeLabel: 'Associated OpenClaw',
    host: '127.0.0.1',
    port: input.port,
    baseUrl: input.baseUrl,
    websocketUrl: input.websocketUrl,
    config: {
      port: String(input.port),
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      workspacePath: input.workspacePath,
      baseUrl: input.baseUrl,
      websocketUrl: input.websocketUrl,
      authToken: input.authToken,
    },
  } satisfies StudioUpdateInstanceInput;
}

class InstanceOnboardingService {
  private readonly dependencies: InstanceOnboardingDependencies;

  constructor(dependencies: InstanceOnboardingDependencies) {
    this.dependencies = dependencies;
  }

  async discoverInstalledOpenClawInstalls(): Promise<DiscoveredInstalledOpenClawInstall[]> {
    const runtimeInfo = await this.dependencies.runtimeApi.getRuntimeInfo();
    const entry = selectOpenClawCatalogEntry(
      await this.dependencies.installerApi.listInstallCatalog(toCatalogQuery(runtimeInfo)),
    );

    if (!entry) {
      return [];
    }

    const instances = await this.dependencies.studioApi.listInstances();
    const discovered = await Promise.all(
      entry.variants.map(async (variant): Promise<DiscoveredInstalledOpenClawInstall | null> => {
        let assessment: InstallAssessmentResult;
        try {
          assessment = await this.dependencies.installerApi.inspectInstall(variant.request);
        } catch {
          return null;
        }

        if (assessment.installStatus !== 'installed') {
          return null;
        }

        const configFile = await this.dependencies.kernelConfigApi.resolveInstallConfigPath(
          buildInstalledKernelConfigLookupInput({
            kernelId: 'openclaw',
            runtimeInfo,
            assessment,
          }),
        );

        if (!configFile) {
          return {
            id: variant.id,
            label: variant.label,
            summary: variant.summary,
            methodId: assessment.installation?.method.id ?? null,
            methodLabel: assessment.installation?.method.label || variant.label,
            runtimePlatform: variant.runtimePlatform,
            installControlLevel: assessment.installControlLevel,
            installStatus: 'installed' as const,
            configFile: null,
            installRoot: normalizePath(assessment.resolvedInstallRoot),
            workRoot: normalizePath(assessment.resolvedWorkRoot),
            dataRoot: normalizePath(assessment.resolvedDataRoot),
            workspacePath: null,
            baseUrl: null,
            websocketUrl: null,
            associatedInstanceId: null,
            associationStatus: 'configMissing' as const,
          };
        }

        const snapshot = await this.dependencies.openClawAssociationApi.readAssociationSnapshot(
          configFile,
        );
        const gateway = buildGatewayUrls(snapshot.root);
        const workspacePath = resolveWorkspacePath({
          snapshot,
          workRoot: assessment.resolvedWorkRoot,
          dataRoot: assessment.resolvedDataRoot,
          installRoot: assessment.resolvedInstallRoot,
          configFile,
        });
        const existing = findMatchingLocalExternalInstance(instances, {
          workspacePath,
          baseUrl: gateway.baseUrl,
          websocketUrl: gateway.websocketUrl,
        });

        return {
          id: variant.id,
          label: variant.label,
          summary: variant.summary,
          methodId: assessment.installation?.method.id ?? null,
          methodLabel: assessment.installation?.method.label || variant.label,
          runtimePlatform: variant.runtimePlatform,
          installControlLevel: assessment.installControlLevel,
          installStatus: 'installed' as const,
          configFile: normalizePath(configFile),
          installRoot: normalizePath(assessment.resolvedInstallRoot),
          workRoot: normalizePath(assessment.resolvedWorkRoot),
          dataRoot: normalizePath(assessment.resolvedDataRoot),
          workspacePath,
          baseUrl: gateway.baseUrl,
          websocketUrl: gateway.websocketUrl,
          associatedInstanceId: existing?.id ?? null,
          associationStatus: existing ? ('associated' as const) : ('readyToAssociate' as const),
        };
      }),
    );

    return discovered.filter((item): item is DiscoveredInstalledOpenClawInstall => Boolean(item));
  }

  async associateInstalledOpenClawInstall(
    input: AssociateInstalledOpenClawInstallInput,
  ): Promise<OpenClawAssociationResult> {
    const runtimeInfo = await this.dependencies.runtimeApi.getRuntimeInfo();
    const assessment = await this.dependencies.installerApi.inspectInstall(input.request);
    const configFile = await this.dependencies.kernelConfigApi.resolveInstallConfigPath(
      buildInstalledKernelConfigLookupInput({
        kernelId: 'openclaw',
        runtimeInfo,
        assessment,
      }),
    );

    if (!configFile) {
      throw new Error('Unable to locate the installed OpenClaw config file.');
    }

    return this.associateOpenClawConfigFile({
      configFile,
      installationMethodId: assessment.installation?.method.id ?? null,
      installationMethodLabel: assessment.installation?.method.label ?? null,
      installRoot: assessment.resolvedInstallRoot,
      workRoot: assessment.resolvedWorkRoot,
      dataRoot: assessment.resolvedDataRoot,
    });
  }

  async associateOpenClawConfigFile(
    input: AssociateOpenClawConfigFileInput,
  ): Promise<OpenClawAssociationResult> {
    const configFile = normalizePath(input.configFile);
    if (!configFile) {
      throw new Error('OpenClaw config file is required.');
    }

    const snapshot = await this.dependencies.openClawAssociationApi.readAssociationSnapshot(
      configFile,
    );
    const gateway = buildGatewayUrls(snapshot.root);
    const workspacePath = resolveWorkspacePath({
      snapshot,
      workRoot: input.workRoot,
      dataRoot: input.dataRoot,
      installRoot: input.installRoot,
      configFile,
    });
    const instances = await this.dependencies.studioApi.listInstances();
    const existing = findMatchingLocalExternalInstance(instances, {
      workspacePath,
      baseUrl: gateway.baseUrl,
      websocketUrl: gateway.websocketUrl,
    });
    const authToken = resolveSyncedOpenClawAuthToken({
      root: snapshot.root,
      existingAuthToken: existing?.config.authToken ?? null,
    });

    if (existing) {
      const updated = await this.dependencies.studioApi.updateInstance(
        existing.id,
        buildLocalExternalInstanceUpdateInput({
          workspacePath,
          baseUrl: gateway.baseUrl,
          websocketUrl: gateway.websocketUrl,
          port: gateway.port,
          authToken,
        }),
      );

      return {
        mode: 'updated',
        instance: updated,
        configFile,
      };
    }

    const created = await this.dependencies.studioApi.createInstance(
      buildLocalExternalInstanceCreateInput({
        workspacePath,
        baseUrl: gateway.baseUrl,
        websocketUrl: gateway.websocketUrl,
        port: gateway.port,
        authToken,
      }),
    );

    return {
      mode: 'created',
      instance: created,
      configFile,
    };
  }

  async createRemoteOpenClawInstance(input: CreateRemoteOpenClawInstanceInput) {
    const normalizedName = input.name.trim();
    const normalizedHost = input.host.trim();

    if (!normalizedName) {
      throw new Error('Instance name is required.');
    }
    if (!normalizedHost) {
      throw new Error('Remote host is required.');
    }
    if (!Number.isFinite(input.port) || input.port <= 0) {
      throw new Error('A valid remote port is required.');
    }

    const scheme = input.secure ? 'https' : 'http';
    const websocketScheme = input.secure ? 'wss' : 'ws';
    const baseUrl = `${scheme}://${normalizedHost}:${input.port}`;
    const websocketUrl = `${websocketScheme}://${normalizedHost}:${input.port}`;

    return this.dependencies.studioApi.createInstance({
      name: normalizedName,
      description: input.description?.trim() || undefined,
      runtimeKind: 'openclaw',
      deploymentMode: 'remote',
      transportKind: 'openclawGatewayWs',
      iconType: 'server',
      version: 'remote',
      typeLabel: 'Remote OpenClaw Gateway',
      host: normalizedHost,
      port: input.port,
      baseUrl,
      websocketUrl,
      storage: {
        provider: 'localFile',
        namespace: 'openclaw-remote',
      },
      config: {
        port: String(input.port),
        sandbox: true,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
        workspacePath: null,
        baseUrl,
        websocketUrl,
        authToken: normalizeNullableString(input.authToken),
      },
    });
  }
}

export function createInstanceOnboardingService(
  overrides: InstanceOnboardingDependencyOverrides = {},
) {
  const defaults = createDefaultDependencies();

  return new InstanceOnboardingService({
    runtimeApi: {
      ...defaults.runtimeApi,
      ...(overrides.runtimeApi || {}),
    },
    installerApi: {
      ...defaults.installerApi,
      ...(overrides.installerApi || {}),
    },
    studioApi: {
      ...defaults.studioApi,
      ...(overrides.studioApi || {}),
    },
    kernelConfigApi: {
      ...defaults.kernelConfigApi,
      ...(overrides.kernelConfigApi || {}),
    },
    openClawAssociationApi: {
      ...defaults.openClawAssociationApi,
      ...(overrides.openClawAssociationApi || {}),
    },
  });
}

export const instanceOnboardingService = createInstanceOnboardingService();
