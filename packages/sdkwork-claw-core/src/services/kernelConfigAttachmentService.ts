import {
  projectKernelConfig,
  type KernelConfigDescriptor,
  type KernelConfigProjectionInput,
} from '@sdkwork/local-api-proxy';
import type { KernelConfig } from '@sdkwork/claw-types';
import {
  resolveOpenClawStateRootFromConfigFile,
  resolveOpenClawUserRootFromConfigFile,
} from './openClawPathResolutionService.ts';

export interface KernelConfigBackedRoute {
  scope: string;
  mode: string;
  target?: string | null;
  authoritative?: boolean;
}

export interface KernelConfigBackedArtifact {
  kind: string;
  location?: string | null;
}

export interface KernelConfigBackedDetail {
  instance?: {
    runtimeKind?: string | null;
    deploymentMode?: string | null;
    isBuiltIn?: boolean | null;
    config?: {
      workspacePath?: string | null;
    } | null;
  } | null;
  config?: {
    workspacePath?: string | null;
  } | null;
  lifecycle?: {
    configWritable?: boolean | null;
  } | null;
  dataAccess?: {
    routes?: KernelConfigBackedRoute[] | null;
  } | null;
  artifacts?: KernelConfigBackedArtifact[] | null;
}

function normalizePath(path?: string | null) {
  return path?.replace(/\\/g, '/').trim().replace(/\/+/g, '/') || null;
}

function trimTrailingSlash(path: string) {
  return path.length > 1 ? path.replace(/\/+$/g, '') : path;
}

function joinPath(root: string, ...segments: string[]) {
  return normalizePath(
    [
      trimTrailingSlash(root),
      ...segments.map((segment) => segment.replace(/^\/+/g, '')),
    ].filter(Boolean).join('/'),
  ) || '';
}

function normalizeId(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}

function isOpenClawProjectionInput(input: KernelConfigProjectionInput) {
  return (
    normalizeId(input.kernelId) === 'openclaw'
    || normalizeId(input.runtimeKind) === 'openclaw'
  );
}

function buildStandardOpenClawStateRoot(userRoot?: string | null) {
  const normalizedUserRoot = normalizePath(userRoot);
  return normalizedUserRoot ? joinPath(normalizedUserRoot, '.openclaw') : '';
}

function buildStandardOpenClawConfigFilePath(userRoot?: string | null) {
  const standardStateRoot = buildStandardOpenClawStateRoot(userRoot);
  return standardStateRoot ? joinPath(standardStateRoot, 'openclaw.json') : '';
}

function resolveOpenClawUserRootFromWorkspacePath(workspacePath?: string | null) {
  const normalizedWorkspacePath = normalizePath(workspacePath);
  const workspaceSuffix = '/.openclaw/workspace';
  if (!normalizedWorkspacePath?.endsWith(workspaceSuffix)) {
    return null;
  }

  return normalizedWorkspacePath.slice(0, -workspaceSuffix.length) || null;
}

function isBuiltInOpenClawProjectionInput(input: KernelConfigProjectionInput) {
  return (
    normalizeId(input.runtimeKind) === 'openclaw'
    && input.isBuiltIn === true
    && normalizeId(input.deploymentMode) === 'local-managed'
  );
}

function normalizeOpenClawConfigFile(input: KernelConfigProjectionInput) {
  const normalizedConfigFile = normalizePath(input.configFile);
  if (!normalizedConfigFile) {
    return null;
  }

  if (normalizedConfigFile.endsWith('/.openclaw/openclaw.json')) {
    return normalizedConfigFile;
  }

  if (!isBuiltInOpenClawProjectionInput(input)) {
    return normalizedConfigFile;
  }

  const userRoot = resolveOpenClawUserRootFromWorkspacePath(input.workspacePath);
  return buildStandardOpenClawConfigFilePath(userRoot) || normalizedConfigFile;
}

function projectOpenClawKernelConfig(input: KernelConfigProjectionInput): KernelConfig | null {
  if (!isOpenClawProjectionInput(input)) {
    return null;
  }

  const configFile = normalizeOpenClawConfigFile(input);
  if (!configFile) {
    return null;
  }

  const userRoot = resolveOpenClawUserRootFromConfigFile(configFile) || null;
  const stateRoot = resolveOpenClawStateRootFromConfigFile(configFile) || null;
  const standardStateRoot = buildStandardOpenClawStateRoot(userRoot) || null;
  const standardConfigFile = buildStandardOpenClawConfigFilePath(userRoot) || null;
  const isStandardUserRootLayout =
    Boolean(standardConfigFile) && configFile === standardConfigFile;

  return {
    kernelId: 'openclaw',
    runtimeKind: normalizeId(input.runtimeKind) || 'openclaw',
    configFile,
    configRoot: stateRoot,
    stateRoot,
    userRoot,
    standardStateRoot,
    standardConfigFile,
    format: 'json',
    access: 'localFs',
    provenance: isStandardUserRootLayout ? 'standardUserRoot' : 'runtimeReported',
    writable: input.configWritable === true,
    resolved: true,
    schemaVersion: input.schemaVersion || null,
    isStandardUserRootLayout,
  };
}

function mapKernelConfigDescriptor(descriptor: KernelConfigDescriptor): KernelConfig {
  return {
    kernelId: descriptor.kernelId,
    runtimeKind: descriptor.runtimeKind,
    configFile: descriptor.configFile,
    configRoot: descriptor.configRoot,
    stateRoot: descriptor.stateRoot,
    userRoot: descriptor.userRoot,
    standardStateRoot: descriptor.standardStateRoot,
    standardConfigFile: descriptor.standardConfigFile,
    format: descriptor.format,
    access: descriptor.access,
    provenance: descriptor.provenance,
    writable: descriptor.writable,
    resolved: descriptor.resolved,
    schemaVersion: descriptor.schemaVersion,
    isStandardUserRootLayout: descriptor.isStandardUserRootLayout,
  };
}

export type BuildKernelConfigProjectionInput = KernelConfigProjectionInput;

export function buildKernelConfigProjection(
  input: BuildKernelConfigProjectionInput,
): KernelConfig | null {
  const descriptor = projectKernelConfig(input);
  if (descriptor) {
    return mapKernelConfigDescriptor(descriptor);
  }

  return projectOpenClawKernelConfig(input);
}

function resolveReportedConfigFile(detail: KernelConfigBackedDetail | null | undefined) {
  const configRoute = detail?.dataAccess?.routes?.find((route) => route.scope === 'config');
  if (configRoute) {
    if (configRoute.mode === 'managedFile' && configRoute.target) {
      return normalizePath(configRoute.target);
    }

    return null;
  }

  const configArtifact = detail?.artifacts?.find(
    (artifact) => artifact.kind === 'configFile' && artifact.location,
  );

  return configArtifact?.location ? normalizePath(configArtifact.location) : null;
}

function resolveWorkspacePath(detail: KernelConfigBackedDetail | null | undefined) {
  const workspaceCandidates = [
    detail?.config?.workspacePath,
    detail?.instance?.config?.workspacePath,
    detail?.dataAccess?.routes?.find((route) => route.scope === 'files')?.target,
    detail?.artifacts?.find((artifact) => artifact.kind === 'workspaceDirectory')?.location,
  ];

  for (const candidate of workspaceCandidates) {
    const normalized = normalizePath(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function resolveAttachedKernelConfig(
  detail: KernelConfigBackedDetail | null | undefined,
): KernelConfig | null {
  const configFile = resolveReportedConfigFile(detail);
  if (!configFile) {
    return null;
  }

  return buildKernelConfigProjection({
    kernelId: detail?.instance?.runtimeKind,
    runtimeKind: detail?.instance?.runtimeKind,
    deploymentMode: detail?.instance?.deploymentMode,
    isBuiltIn: detail?.instance?.isBuiltIn,
    configFile,
    workspacePath: resolveWorkspacePath(detail),
    configWritable: detail?.lifecycle?.configWritable === true,
    schemaVersion: null,
  });
}

export function resolveAttachedKernelConfigFile(
  detail: KernelConfigBackedDetail | null | undefined,
) {
  return resolveAttachedKernelConfig(detail)?.configFile || null;
}
