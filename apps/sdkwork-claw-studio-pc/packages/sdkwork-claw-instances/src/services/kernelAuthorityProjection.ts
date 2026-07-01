import type { KernelAuthority, StudioInstanceDetailRecord } from '@sdkwork/claw-types';

function resolveAuthorityOwner(
  detail: StudioInstanceDetailRecord | null | undefined,
): KernelAuthority['owner'] {
  switch (detail?.lifecycle.owner) {
    case 'appManaged':
      return 'appManaged';
    case 'remoteService':
      return 'remoteManaged';
    default:
      return 'userManaged';
  }
}

function resolveControlPlane(
  detail: StudioInstanceDetailRecord | null | undefined,
): KernelAuthority['controlPlane'] {
  if (!detail) {
    return 'none';
  }

  switch (detail.lifecycle.owner) {
    case 'appManaged':
      return 'desktopHost';
    case 'remoteService':
      return 'remoteApi';
    case 'externalProcess':
      return detail.instance.runtimeKind === 'openclaw' ? 'kernelGateway' : 'bridge';
    default:
      return 'none';
  }
}

export function buildKernelAuthorityProjection(
  detail: StudioInstanceDetailRecord | null | undefined,
): KernelAuthority | null {
  if (!detail) {
    return null;
  }

  const lifecycleControl = Boolean(
    detail.lifecycle.lifecycleControllable ?? detail.lifecycle.startStopSupported,
  );
  const configControl = detail.lifecycle.configWritable === true;
  const upgradeControl = detail.lifecycle.owner === 'appManaged';

  return {
    owner: resolveAuthorityOwner(detail),
    controlPlane: resolveControlPlane(detail),
    lifecycleControl,
    configControl,
    upgradeControl,
    doctorSupport: detail.instance.runtimeKind === 'openclaw',
    migrationSupport: detail.instance.isBuiltIn === true,
    observable: true,
    writable: configControl,
  };
}
