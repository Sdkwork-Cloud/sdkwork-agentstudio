import { useEffect, useRef } from 'react';
import type { InstanceChatRouteMode } from '../services';
import { resolveChatInstanceHydrationKey } from '../services';

export interface UseChatInstanceHydrationSynchronizationInput {
  activeInstanceId: string | null | undefined;
  routeMode: InstanceChatRouteMode | undefined;
  hydrateInstance: (instanceId: string | null | undefined) => Promise<void> | void;
}

export function useChatInstanceHydrationSynchronization({
  activeInstanceId,
  routeMode,
  hydrateInstance,
}: UseChatInstanceHydrationSynchronizationInput) {
  const lastResolvedRouteHydrationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void hydrateInstance(activeInstanceId);
  }, [activeInstanceId, hydrateInstance]);

  useEffect(() => {
    const nextHydrationKey = resolveChatInstanceHydrationKey({
      activeInstanceId,
      routeMode,
    });
    if (lastResolvedRouteHydrationKeyRef.current === nextHydrationKey) {
      return;
    }

    const hadResolvedHydrationKey = lastResolvedRouteHydrationKeyRef.current !== null;
    lastResolvedRouteHydrationKeyRef.current = nextHydrationKey;

    if (!nextHydrationKey || !hadResolvedHydrationKey) {
      return;
    }

    void hydrateInstance(activeInstanceId);
  }, [activeInstanceId, hydrateInstance, routeMode]);
}
