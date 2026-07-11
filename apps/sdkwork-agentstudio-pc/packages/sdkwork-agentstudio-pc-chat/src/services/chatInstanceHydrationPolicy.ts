import type { InstanceChatRouteMode } from './instanceChatRouteService.ts';

export function resolveChatInstanceHydrationKey(params: {
  activeInstanceId: string | null | undefined;
  routeMode: InstanceChatRouteMode | undefined;
}) {
  if (!params.activeInstanceId || !params.routeMode) {
    return null;
  }

  return `${params.activeInstanceId}:${params.routeMode}`;
}
