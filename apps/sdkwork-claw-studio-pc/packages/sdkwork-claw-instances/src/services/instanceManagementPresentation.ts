import type { StudioInstanceDataAccessEntry } from '@sdkwork/claw-types';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import {
  buildBundledOpenClawStartupAlert,
  isBundledOpenClawActivationDetailNote,
  type BundledOpenClawStartupAlert,
  type BundledOpenClawStartupAlertDiagnostic,
} from './bundledOpenClawStartupAlert.ts';
import { resolveAttachedKernelConfigFile } from '@sdkwork/claw-core';

export type InstanceManagementEntryTone = 'neutral' | 'success' | 'warning';

export interface InstanceManagementEntry {
  id:
    | 'controlPlane'
    | 'installMethod'
    | 'kernelConfig'
    | 'defaultWorkspace'
    | 'managementScope';
  labelKey: string;
  value: string;
  detailKey: string;
  tone: InstanceManagementEntryTone;
  mono?: boolean;
}

export type InstanceManagementAlert = BundledOpenClawStartupAlert;
export type InstanceManagementAlertDiagnostic = BundledOpenClawStartupAlertDiagnostic;

export interface InstanceManagementSummary {
  entries: InstanceManagementEntry[];
  alert: InstanceManagementAlert | null;
  notes: string[];
}

const VALUE_LABELS: Record<string, string> = {
  appManaged: 'App Managed',
  externalProcess: 'External Process',
  remoteService: 'Remote Service',
  'local-managed': 'Local Managed',
  'local-external': 'Local External',
  remote: 'Remote',
  bundled: 'Bundled',
  installerScript: 'Installer Script',
  cliScript: 'CLI Script',
  npm: 'npm',
  pnpm: 'pnpm',
  source: 'Source',
  git: 'Git',
  wsl: 'WSL',
  docker: 'Docker',
  podman: 'Podman',
  ansible: 'Ansible',
  bun: 'Bun',
  nix: 'Nix',
  unknown: 'Unknown',
};

function formatValue(value?: string | null) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    return 'Unknown';
  }

  if (VALUE_LABELS[normalized]) {
    return VALUE_LABELS[normalized];
  }

  return normalized
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (segment) => segment.toUpperCase());
}

function resolveKernelConfigRoute(workbench: InstanceWorkbenchSnapshot) {
  return (
    workbench.detail.dataAccess.routes.find(
      (route) => route.scope === 'config' && Boolean(route.target),
    ) || null
  );
}

function buildKernelConfigEntry(
  workbench: InstanceWorkbenchSnapshot,
): InstanceManagementEntry {
  if (workbench.kernelConfig?.configFile) {
    return {
      id: 'kernelConfig',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.kernelConfig',
      value: workbench.kernelConfig.configFile,
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.configManagedFile',
      tone: 'success',
      mono: true,
    };
  }

  const configRoute = resolveKernelConfigRoute(workbench);
  if (configRoute?.target) {
    const kernelConfigPath =
      resolveAttachedKernelConfigFile(workbench.detail) || configRoute.target;

    return {
      id: 'kernelConfig',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.kernelConfig',
      value: kernelConfigPath,
      detailKey: getKernelConfigDetailKey(configRoute),
      tone:
        configRoute.mode === 'remoteEndpoint' || configRoute.mode === 'metadataOnly'
          ? 'warning'
          : 'neutral',
      mono: true,
    };
  }

  return {
    id: 'kernelConfig',
    labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.kernelConfig',
    value: '--',
    detailKey: 'instances.detail.instanceWorkbench.overview.management.details.configUnavailable',
    tone: 'warning',
  };
}

function getKernelConfigDetailKey(route: StudioInstanceDataAccessEntry) {
  if (route.mode === 'managedDirectory') {
    return 'instances.detail.instanceWorkbench.overview.management.details.configManagedDirectory';
  }
  if (route.mode === 'remoteEndpoint') {
    return 'instances.detail.instanceWorkbench.overview.management.details.configRemoteEndpoint';
  }
  if (route.mode === 'metadataOnly') {
    return 'instances.detail.instanceWorkbench.overview.management.details.configMetadataOnly';
  }
  return 'instances.detail.instanceWorkbench.overview.management.details.configManagedFile';
}

function buildDefaultWorkspaceEntry(
  workbench: InstanceWorkbenchSnapshot,
): InstanceManagementEntry {
  const defaultAgent = workbench.agents.find((agent) => agent.isDefault) || workbench.agents[0];
  if (defaultAgent?.workspace) {
    return {
      id: 'defaultWorkspace',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.defaultWorkspace',
      value: defaultAgent.workspace,
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.workspaceAgent',
      tone: 'neutral',
      mono: true,
    };
  }

  const workspaceArtifact = workbench.detail.artifacts.find(
    (artifact) => artifact.kind === 'workspaceDirectory' && artifact.location,
  );
  if (workspaceArtifact?.location) {
    return {
      id: 'defaultWorkspace',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.defaultWorkspace',
      value: workspaceArtifact.location,
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.workspaceArtifact',
      tone: 'neutral',
      mono: true,
    };
  }

  return {
    id: 'defaultWorkspace',
    labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.defaultWorkspace',
    value: workbench.detail.storage.namespace || '--',
    detailKey: 'instances.detail.instanceWorkbench.overview.management.details.workspaceNamespace',
    tone: 'neutral',
  };
}

function buildManagementScopeEntry(
  workbench: InstanceWorkbenchSnapshot,
): InstanceManagementEntry {
  const lifecycleControllable =
    workbench.detail.lifecycle.lifecycleControllable ??
    workbench.detail.lifecycle.startStopSupported;
  const workbenchManaged = workbench.detail.lifecycle.workbenchManaged === true;
  const configRoute = resolveKernelConfigRoute(workbench);
  const hasRemoteManagementSurface = Boolean(
    (configRoute && configRoute.mode !== 'metadataOnly' && configRoute.readonly === false) ||
      workbench.detail.consoleAccess?.available,
  );

  if (workbench.kernelConfig?.configFile && workbench.detail.lifecycle.configWritable) {
    return {
      id: 'managementScope',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.managementScope',
      value: 'Provider Center + config workspace',
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.scopeFull',
      tone: 'success',
    };
  }

  if (workbenchManaged || lifecycleControllable || hasRemoteManagementSurface) {
    return {
      id: 'managementScope',
      labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.managementScope',
      value: 'Partial runtime control',
      detailKey: 'instances.detail.instanceWorkbench.overview.management.details.scopePartial',
      tone: 'warning',
    };
  }

  return {
    id: 'managementScope',
    labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.managementScope',
    value: 'Read-only discovery',
    detailKey: 'instances.detail.instanceWorkbench.overview.management.details.scopeReadonly',
    tone: 'warning',
  };
}

function buildNotes(
  workbench: InstanceWorkbenchSnapshot,
  alert: InstanceManagementAlert | null,
) {
  const filteredLifecycleNotes = workbench.detail.lifecycle.notes.filter((note) => {
    if (!alert) {
      return true;
    }

    return (
      note !== `Last built-in OpenClaw start error: ${alert.message}` &&
      !isBundledOpenClawActivationDetailNote(note)
    );
  });

  return [
    ...filteredLifecycleNotes,
    ...workbench.detail.officialRuntimeNotes.map((note) =>
      note.content ? `${note.title}: ${note.content}` : note.title,
    ),
  ].filter((note, index, items) => note && items.indexOf(note) === index);
}

export function buildInstanceManagementSummary(
  workbench: InstanceWorkbenchSnapshot,
): InstanceManagementSummary {
  const installMethod = workbench.detail.consoleAccess?.installMethod || null;
  const alert = buildBundledOpenClawStartupAlert(workbench.detail);

  return {
    entries: [
      {
        id: 'controlPlane',
        labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.controlPlane',
        value: `${formatValue(workbench.detail.lifecycle.owner)} / ${formatValue(workbench.detail.instance.deploymentMode)}`,
        detailKey: 'instances.detail.instanceWorkbench.overview.management.details.controlPlane',
        tone: 'neutral',
      },
      {
        id: 'installMethod',
        labelKey: 'instances.detail.instanceWorkbench.overview.management.labels.installMethod',
        value: installMethod ? formatValue(installMethod) : 'Unknown',
        detailKey: installMethod
          ? 'instances.detail.instanceWorkbench.overview.management.details.installMethod'
          : 'instances.detail.instanceWorkbench.overview.management.details.installMethodUnknown',
        tone: installMethod ? 'neutral' : 'warning',
      },
      buildKernelConfigEntry(workbench),
      buildDefaultWorkspaceEntry(workbench),
      buildManagementScopeEntry(workbench),
    ],
    alert,
    notes: buildNotes(workbench, alert),
  };
}
