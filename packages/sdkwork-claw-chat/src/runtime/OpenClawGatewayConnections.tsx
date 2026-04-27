import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { instanceDirectoryService, useInstanceStore } from '@sdkwork/claw-core';
import { runtime } from '@sdkwork/claw-infrastructure';
import { openClawGatewaySessions, useChatStore } from '../store/useChatStore';
import {
  resolveOpenClawGatewayWarmRefreshKey,
  resolveOpenClawGatewayWarmPlan,
  shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange,
  shouldWarmOpenClawGatewayConnections,
} from './openClawGatewayConnectionsPolicy.ts';

const DIRECTORY_REFRESH_MS = 15_000;

export function OpenClawGatewayConnections() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const activeInstanceId = useInstanceStore((state) => state.activeInstanceId);
  const connectGatewayInstances = useChatStore((state) => state.connectGatewayInstances);
  const [builtInStatusRefreshTick, setBuiltInStatusRefreshTick] = useState(0);
  const shouldWarmConnections = shouldWarmOpenClawGatewayConnections(location.pathname);
  const prefetchPlan = useMemo(
    () =>
      resolveOpenClawGatewayWarmPlan({
        pathname: location.pathname,
        activeInstanceId,
      }),
    [activeInstanceId, location.pathname],
  );

  const { data: instances = [] } = useQuery({
    queryKey: ['chat', 'gateway-instance-directory'],
    queryFn: () => instanceDirectoryService.listInstances(),
    enabled: prefetchPlan.shouldQueryDirectory,
    refetchInterval: prefetchPlan.shouldQueryDirectory ? DIRECTORY_REFRESH_MS : false,
    staleTime: 5_000,
  });

  const instanceIds = useMemo(() => {
    if (!shouldWarmConnections) {
      return [];
    }

    return resolveOpenClawGatewayWarmPlan({
      pathname: location.pathname,
      activeInstanceId,
      directoryInstanceIds: instances.map((instance) => instance.id),
    }).instanceIds;
  }, [activeInstanceId, instances, location.pathname, shouldWarmConnections]);

  const instanceSignature = useMemo(() => instanceIds.join('|'), [instanceIds]);
  const warmRefreshKey = useMemo(
    () =>
      resolveOpenClawGatewayWarmRefreshKey({
        pathname: location.pathname,
        activeInstanceId,
        directoryInstances: instances,
      }),
    [activeInstanceId, instances, location.pathname],
  );

  const handleBuiltInOpenClawStatusChanged = useEffectEvent((event: { instanceId: string }) => {
    if (
      !shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange({
        pathname: location.pathname,
        warmedInstanceIds: instanceIds,
        eventInstanceId: event.instanceId,
      })
    ) {
      return;
    }

    setBuiltInStatusRefreshTick((current) => current + 1);
  });

  const handleGatewayAgentCatalogChanged = useEffectEvent((event: { instanceId: string }) => {
    void queryClient.invalidateQueries({
      queryKey: ['chat', 'kernel-agent-catalog', event.instanceId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['chat', 'owned-kernel-agent-library', event.instanceId],
    });
  });

  useEffect(() => {
    return openClawGatewaySessions.subscribeAgentCatalogChanged((event) => {
      handleGatewayAgentCatalogChanged(event);
    });
  }, [handleGatewayAgentCatalogChanged]);

  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};

    void runtime
      .subscribeBuiltInOpenClawStatusChanged((event) => {
        handleBuiltInOpenClawStatusChanged(event);
      })
      .then((nextUnsubscribe) => {
        if (disposed) {
          void nextUnsubscribe();
          return;
        }

        unsubscribe = nextUnsubscribe;
      })
      .catch((error) => {
        console.warn('Failed to subscribe to built-in OpenClaw status changes:', error);
      });

    return () => {
      disposed = true;
      void unsubscribe();
    };
  }, [handleBuiltInOpenClawStatusChanged]);

  useEffect(() => {
    if (!shouldWarmConnections || !instanceSignature) {
      return;
    }

    void connectGatewayInstances(instanceSignature.split('|'));
  }, [
    connectGatewayInstances,
    instanceSignature,
    shouldWarmConnections,
    warmRefreshKey,
    builtInStatusRefreshTick,
  ]);

  return null;
}
