import type { StudioInstanceDetailRecord } from '@sdkwork/claw-types';

export type TaskCrudSurface = 'backendWorkbench' | 'gateway' | 'unsupported';

const TASK_GATEWAY_TRANSPORTS = new Set<string>(['openclawGatewayWs']);

export function hasWorkbench(detail: StudioInstanceDetailRecord | null | undefined) {
  return Boolean(detail?.workbench);
}

function readTaskSurfaceTransports(
  detail: StudioInstanceDetailRecord | null | undefined,
): string[] {
  const candidates = [
    detail?.connectivity?.primaryTransport,
    detail?.instance.transportKind,
  ];

  return Array.from(
    new Set(
      candidates
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export function hasGatewayTaskSurface(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return readTaskSurfaceTransports(detail).some((transport) =>
    TASK_GATEWAY_TRANSPORTS.has(transport),
  );
}

export function resolveTaskCrudSurface(
  detail: StudioInstanceDetailRecord | null | undefined,
): TaskCrudSurface {
  if (!detail) {
    return 'unsupported';
  }

  if (hasWorkbench(detail)) {
    return 'backendWorkbench';
  }

  if (hasGatewayTaskSurface(detail)) {
    return 'gateway';
  }

  return 'unsupported';
}

export function canManageTasks(detail: StudioInstanceDetailRecord | null | undefined) {
  return resolveTaskCrudSurface(detail) !== 'unsupported';
}

export function supportsRuntimeTaskSurface(
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return hasGatewayTaskSurface(detail);
}
