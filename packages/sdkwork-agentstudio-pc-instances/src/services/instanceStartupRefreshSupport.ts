import type { RuntimeBuiltInOpenClawStatusChangedEvent } from '@sdkwork/agentstudio-pc-infrastructure';
import { isOpenClawRuntimeKind } from '@sdkwork/agentstudio-pc-types';
import type { InstanceWorkbenchSnapshot } from '../types/index.ts';
import type { Instance } from '../types/index.ts';

export const BUILT_IN_OPENCLAW_STARTUP_REFRESH_INTERVAL_MS = 1500;

function isPendingBuiltInOpenClawStartup(instance: Pick<
  Instance,
  'isBuiltIn' | 'runtimeKind' | 'deploymentMode' | 'status'
>) {
  return (
    instance.isBuiltIn === true &&
    isOpenClawRuntimeKind(instance.runtimeKind) &&
    instance.deploymentMode === 'local-managed' &&
    instance.status === 'starting'
  );
}

export function hasPendingBuiltInOpenClawStartup(
  instances: Array<Pick<Instance, 'isBuiltIn' | 'runtimeKind' | 'deploymentMode' | 'status'>>,
) {
  return instances.some((instance) => isPendingBuiltInOpenClawStartup(instance));
}

export function hasPendingBuiltInOpenClawWorkbenchStartup(
  workbench: Pick<InstanceWorkbenchSnapshot, 'detail' | 'instance'> | null,
) {
  const instance = workbench?.instance ?? workbench?.detail?.instance;
  if (!instance) {
    return false;
  }

  return isPendingBuiltInOpenClawStartup(instance);
}

export function shouldRefreshInstancesForBuiltInOpenClawStatusChange(
  instances: Array<
    Pick<Instance, 'id' | 'isBuiltIn' | 'runtimeKind' | 'deploymentMode' | 'status'>
  >,
  event: Pick<RuntimeBuiltInOpenClawStatusChangedEvent, 'instanceId'>,
) {
  return instances.some(
    (instance) =>
      instance.id === event.instanceId && isPendingBuiltInOpenClawStartup(instance),
  );
}

export function shouldRefreshWorkbenchForBuiltInOpenClawStatusChange(
  instanceId: string | undefined,
  workbench: Pick<InstanceWorkbenchSnapshot, 'detail' | 'instance'> | null,
  event: Pick<RuntimeBuiltInOpenClawStatusChangedEvent, 'instanceId'>,
) {
  const instance = workbench?.instance ?? workbench?.detail?.instance;
  if (!instance || !instanceId || instanceId !== event.instanceId) {
    return false;
  }

  return instance.id === event.instanceId && isPendingBuiltInOpenClawStartup(instance);
}
