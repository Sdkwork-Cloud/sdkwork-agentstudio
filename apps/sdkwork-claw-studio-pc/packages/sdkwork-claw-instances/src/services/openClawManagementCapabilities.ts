import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';
import { buildKernelAuthorityProjection } from './kernelAuthorityProjection.ts';

function isOpenClawDetail(
  detail: StudioInstanceDetailRecord | null | undefined,
): detail is StudioInstanceDetailRecord & {
  instance: StudioInstanceDetailRecord['instance'] & {
    runtimeKind: 'openclaw';
  };
} {
  return detail?.instance.runtimeKind === 'openclaw';
}

function isBuiltInOpenClawProbeCandidate(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  const authority = buildKernelAuthorityProjection(detail);

  return (
    isOpenClawDetail(detail) &&
    detail.instance.isBuiltIn === true &&
    authority?.owner === 'appManaged' &&
    authority.controlPlane === 'desktopHost' &&
    detail.lifecycle.endpointObserved === true
  );
}

export function hasWritableOpenClawConfigRoute(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  if (!isOpenClawDetail(detail)) {
    return false;
  }

  return detail.dataAccess.routes.some(
    (route) =>
      route.scope === 'config' &&
      Boolean(route.target) &&
      (route.mode === 'managedFile' || route.mode === 'managedDirectory') &&
      route.readonly !== true,
  );
}

export function isProviderCenterControlledOpenClawDetail(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  if (!isOpenClawDetail(detail)) {
    return false;
  }

  const authority = buildKernelAuthorityProjection(detail);
  if (!authority?.configControl) {
    return false;
  }

  return authority.controlPlane === 'desktopHost' || hasWritableOpenClawConfigRoute(detail);
}

export function hasReadyOpenClawGateway(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  if (!isOpenClawDetail(detail)) {
    return false;
  }

  if (detail.instance.status === 'online') {
    return true;
  }

  return detail.lifecycle.endpointObserved === true && detail.health.status !== 'offline';
}

export function shouldProbeOpenClawGateway(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return hasReadyOpenClawGateway(detail) || isBuiltInOpenClawProbeCandidate(detail);
}
