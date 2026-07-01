import { studio } from '@sdkwork/claw-infrastructure';
import type { StudioInstanceDetailRecord, StudioInstanceRecord } from '@sdkwork/claw-types';
import {
  resolveInstanceChatRoute,
  type InstanceChatRoute,
} from '../instanceChatRouteService.ts';

export interface AuthoritativeInstanceChatRouteResolution {
  detail: StudioInstanceDetailRecord | null;
  instance: StudioInstanceRecord | null;
  route: InstanceChatRoute;
}

export async function resolveAuthoritativeInstanceChatRoute(
  instanceId: string | null | undefined,
): Promise<AuthoritativeInstanceChatRouteResolution> {
  if (!instanceId) {
    return {
      detail: null,
      instance: null,
      route: resolveInstanceChatRoute(null),
    };
  }

  const detail = await studio.getInstanceDetail(instanceId).catch(() => null);
  const instance = detail?.instance ?? (await studio.getInstance(instanceId));

  return {
    detail,
    instance,
    route: resolveInstanceChatRoute(instance),
  };
}
