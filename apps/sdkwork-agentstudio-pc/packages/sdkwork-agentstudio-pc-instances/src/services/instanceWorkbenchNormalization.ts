import { resolveAttachedKernelConfig } from '@sdkwork/agentstudio-pc-core';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';

function normalizeDetailConfigDisplays(
  detail: InstanceWorkbenchSnapshot['detail'],
  configFile: string | null,
) {
  if (!configFile) {
    return detail;
  }

  let changed = false;
  const routes = detail.dataAccess.routes.map((route) => {
    if (route.scope !== 'config' || route.mode !== 'managedFile' || !route.target) {
      return route;
    }
    if (route.target === configFile) {
      return route;
    }

    changed = true;
    return {
      ...route,
      target: configFile,
    };
  });
  const artifacts = detail.artifacts.map((artifact) => {
    if (artifact.kind !== 'configFile' || !artifact.location) {
      return artifact;
    }
    if (artifact.location === configFile) {
      return artifact;
    }

    changed = true;
    return {
      ...artifact,
      location: configFile,
    };
  });

  if (!changed) {
    return detail;
  }

  return {
    ...detail,
    dataAccess: {
      ...detail.dataAccess,
      routes,
    },
    artifacts,
  };
}

function resolveNormalizedKernelConfig(
  detail: InstanceWorkbenchSnapshot['detail'],
  kernelConfig: InstanceWorkbenchSnapshot['kernelConfig'] | null | undefined,
) {
  const attachedKernelConfig = resolveAttachedKernelConfig(detail);
  if (!attachedKernelConfig) {
    return kernelConfig || null;
  }

  if (!kernelConfig) {
    return attachedKernelConfig;
  }

  const sameDisplayProjection =
    kernelConfig.configFile === attachedKernelConfig.configFile &&
    kernelConfig.standardConfigFile === attachedKernelConfig.standardConfigFile &&
    kernelConfig.configRoot === attachedKernelConfig.configRoot &&
    kernelConfig.userRoot === attachedKernelConfig.userRoot &&
    kernelConfig.stateRoot === attachedKernelConfig.stateRoot &&
    kernelConfig.standardStateRoot === attachedKernelConfig.standardStateRoot &&
    kernelConfig.isStandardUserRootLayout === attachedKernelConfig.isStandardUserRootLayout;

  return sameDisplayProjection ? kernelConfig : attachedKernelConfig;
}

export function normalizeInstanceWorkbenchSnapshot(
  workbench: InstanceWorkbenchSnapshot | null | undefined,
) {
  if (!workbench) {
    return workbench || null;
  }

  if (!workbench.detail) {
    return workbench;
  }

  const normalizedKernelConfig = resolveNormalizedKernelConfig(
    workbench.detail,
    workbench.kernelConfig,
  );
  const normalizedDetail = normalizeDetailConfigDisplays(
    workbench.detail,
    normalizedKernelConfig?.configFile || null,
  );

  if (
    normalizedKernelConfig === workbench.kernelConfig &&
    normalizedDetail === workbench.detail
  ) {
    return workbench;
  }

  return {
    ...workbench,
    detail: normalizedDetail,
    kernelConfig: normalizedKernelConfig,
  };
}
