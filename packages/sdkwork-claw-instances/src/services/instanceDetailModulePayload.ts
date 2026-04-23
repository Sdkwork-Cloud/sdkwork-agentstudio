import type {
  InstanceBaseDetail,
  InstanceDiagnosticEntry,
  InstanceManagementAction,
} from './instanceBaseDetail.ts';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';

export interface InstanceDetailModuleNavigationItem {
  id: string;
  label: string;
  visible: boolean;
}

export interface InstanceDetailModulePayload {
  kernelId: string;
  moduleType: string;
  navigation: InstanceDetailModuleNavigationItem[];
  sections: Record<string, unknown>;
  diagnostics: InstanceDiagnosticEntry[];
  managementActions: InstanceManagementAction[];
}

export interface OpenClawInstanceDetailModulePayload extends InstanceDetailModulePayload {
  kernelId: 'openclaw';
  moduleType: 'openclaw-workbench';
  sections: {
    workbench: InstanceWorkbenchSnapshot | null;
  };
}

export interface HermesRuntimePolicyItem {
  id: 'windows' | 'python' | 'node' | (string & {});
  titleKey: string;
  detailKey: string;
}

export interface HermesReadinessCheckItem {
  id: 'deploymentTarget' | 'endpointExposure' | 'observability' | (string & {});
  status: 'configured' | 'required' | 'optional' | (string & {});
  labelKey: string;
  detailKey: string;
}

export interface HermesEnvironmentSection {
  deploymentMode: string;
  transportId: string;
  hostLabel: string | null;
  version: string | null;
  endpointCount: number;
}

export interface HermesConfigSection {
  storageProvider: string;
  dataAccessRouteCount: number;
  artifactCount: number;
}

export interface HermesInstanceDetailModulePayload extends InstanceDetailModulePayload {
  kernelId: 'hermes';
  moduleType: 'hermes-runtime';
  sections: {
    runtimePolicies: HermesRuntimePolicyItem[];
    readinessChecks: HermesReadinessCheckItem[];
    environment: HermesEnvironmentSection;
    config: HermesConfigSection;
    notes: string[];
  };
}

interface CreateInstanceDetailModulePayloadArgs {
  kernelId: string;
  moduleType: string;
  navigation?: InstanceDetailModuleNavigationItem[];
  sections?: Record<string, unknown>;
  diagnostics?: InstanceDiagnosticEntry[];
  managementActions?: InstanceManagementAction[];
}

export function createInstanceDetailModulePayload(
  args: CreateInstanceDetailModulePayloadArgs,
): InstanceDetailModulePayload {
  return {
    kernelId: args.kernelId,
    moduleType: args.moduleType,
    navigation: args.navigation || [],
    sections: args.sections || {},
    diagnostics: args.diagnostics || [],
    managementActions: args.managementActions || [],
  };
}

export function createOpenClawInstanceDetailModulePayload(
  workbench: InstanceWorkbenchSnapshot | null,
): OpenClawInstanceDetailModulePayload {
  return {
    kernelId: 'openclaw',
    moduleType: 'openclaw-workbench',
    navigation: [],
    sections: {
      workbench,
    },
    diagnostics: [],
    managementActions: [],
  };
}

function buildHermesRuntimePolicies(): HermesRuntimePolicyItem[] {
  return [
    {
      id: 'windows',
      titleKey: 'instances.detail.modules.hermes.runtimePolicies.windows.title',
      detailKey: 'instances.detail.modules.hermes.runtimePolicies.windows.detail',
    },
    {
      id: 'python',
      titleKey: 'instances.detail.modules.hermes.runtimePolicies.python.title',
      detailKey: 'instances.detail.modules.hermes.runtimePolicies.python.detail',
    },
    {
      id: 'node',
      titleKey: 'instances.detail.modules.hermes.runtimePolicies.node.title',
      detailKey: 'instances.detail.modules.hermes.runtimePolicies.node.detail',
    },
  ];
}

function buildHermesReadinessChecks(
  baseDetail: InstanceBaseDetail | null | undefined,
): HermesReadinessCheckItem[] {
  const deploymentMode = baseDetail?.instance.deploymentMode;
  const hasSupportedDeploymentTarget =
    deploymentMode === 'remote' ||
    deploymentMode === 'local-external' ||
    deploymentMode === 'local-managed';
  const hasPublishedEndpoints = (baseDetail?.connectivity.endpoints.length || 0) > 0;
  const hasObservability = baseDetail?.observability.logAvailable === true;

  return [
    {
      id: 'deploymentTarget',
      status: hasSupportedDeploymentTarget ? 'configured' : 'required',
      labelKey: 'instances.detail.modules.hermes.readiness.deploymentTarget.label',
      detailKey: hasSupportedDeploymentTarget
        ? 'instances.detail.modules.hermes.readiness.deploymentTarget.configured'
        : 'instances.detail.modules.hermes.readiness.deploymentTarget.required',
    },
    {
      id: 'endpointExposure',
      status: hasPublishedEndpoints ? 'configured' : 'required',
      labelKey: 'instances.detail.modules.hermes.readiness.endpointExposure.label',
      detailKey: hasPublishedEndpoints
        ? 'instances.detail.modules.hermes.readiness.endpointExposure.configured'
        : 'instances.detail.modules.hermes.readiness.endpointExposure.required',
    },
    {
      id: 'observability',
      status: hasObservability ? 'configured' : 'optional',
      labelKey: 'instances.detail.modules.hermes.readiness.observability.label',
      detailKey: hasObservability
        ? 'instances.detail.modules.hermes.readiness.observability.configured'
        : 'instances.detail.modules.hermes.readiness.observability.optional',
    },
  ];
}

function buildHermesNotes(baseDetail: InstanceBaseDetail | null | undefined): string[] {
  if (!baseDetail) {
    return [];
  }

  return [
    ...baseDetail.lifecycle.notes,
    ...baseDetail.runtimeNotes.map((note) =>
      note.content ? `${note.title}: ${note.content}` : note.title,
    ),
  ].filter((note, index, items) => note && items.indexOf(note) === index);
}

function buildHermesDiagnostics(
  baseDetail: InstanceBaseDetail | null | undefined,
  readinessChecks: HermesReadinessCheckItem[],
): InstanceDiagnosticEntry[] {
  const diagnostics = [...(baseDetail?.management.diagnostics || [])];

  for (const check of readinessChecks) {
    if (check.status === 'required') {
      diagnostics.push({
        id: `hermes-${check.id}`,
        label: check.id,
        value: check.detailKey,
        severity: 'warning',
      });
    }
  }

  return diagnostics;
}

export function createHermesInstanceDetailModulePayload(
  baseDetail?: InstanceBaseDetail | null,
): HermesInstanceDetailModulePayload {
  const readinessChecks = buildHermesReadinessChecks(baseDetail);

  return {
    kernelId: 'hermes',
    moduleType: 'hermes-runtime',
    navigation: [],
    sections: {
      runtimePolicies: buildHermesRuntimePolicies(),
      readinessChecks,
      environment: {
        deploymentMode: baseDetail?.instance.deploymentMode || 'unknown',
        transportId: baseDetail?.instance.transportId || 'unknown',
        hostLabel: baseDetail?.instance.hostLabel ?? null,
        version: baseDetail?.instance.version || null,
        endpointCount: baseDetail?.connectivity.endpoints.length || 0,
      },
      config: {
        storageProvider: baseDetail?.storage.provider || 'unknown',
        dataAccessRouteCount: baseDetail?.dataAccess.routes.length || 0,
        artifactCount: baseDetail?.artifacts.length || 0,
      },
      notes: buildHermesNotes(baseDetail),
    },
    diagnostics: buildHermesDiagnostics(baseDetail, readinessChecks),
    managementActions:
      baseDetail?.management.actions.filter((action) => action.scope === 'kernelModule') || [],
  };
}

export function getHermesInstanceDetailModulePayload(
  payload: InstanceDetailModulePayload | null | undefined,
): HermesInstanceDetailModulePayload | null {
  if (!payload || payload.kernelId !== 'hermes' || payload.moduleType !== 'hermes-runtime') {
    return null;
  }

  return payload as HermesInstanceDetailModulePayload;
}

export function getOpenClawWorkbenchFromModulePayload(
  payload: InstanceDetailModulePayload | null | undefined,
): InstanceWorkbenchSnapshot | null {
  if (!payload || payload.kernelId !== 'openclaw' || payload.moduleType !== 'openclaw-workbench') {
    return null;
  }

  const sections = payload.sections as { workbench?: InstanceWorkbenchSnapshot | null };
  return sections.workbench ?? null;
}
