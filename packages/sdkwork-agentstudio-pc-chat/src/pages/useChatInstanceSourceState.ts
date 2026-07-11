import { useEffect, useState } from 'react';
import {
  type InstanceDirectoryItem,
  instanceDirectoryService,
  resolvePreferredActiveInstanceId,
  useInstanceStore,
} from '@sdkwork/agentstudio-pc-core';
import type { ChatPageInstanceSourceState } from './chatPageContracts';

export function useChatInstanceSourceState(): ChatPageInstanceSourceState {
  const activeInstanceId = useInstanceStore((state) => state.activeInstanceId);
  const setActiveInstanceId = useInstanceStore((state) => state.setActiveInstanceId);
  const [instances, setInstances] = useState<InstanceDirectoryItem[]>([]);
  const [hasResolvedInstances, setHasResolvedInstances] = useState(false);

  useEffect(() => {
    let disposed = false;
    const syncInstances = (nextInstances: InstanceDirectoryItem[]) => {
      if (disposed) {
        return;
      }

      setInstances(nextInstances);
      setHasResolvedInstances(true);
    };

    const unsubscribe = instanceDirectoryService.subscribe(syncInstances);
    void instanceDirectoryService.listInstances().then(syncInstances).catch(() => undefined);

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const nextActiveInstanceId = resolvePreferredActiveInstanceId({
      instances,
      activeInstanceId,
    });
    if (nextActiveInstanceId !== activeInstanceId) {
      setActiveInstanceId(nextActiveInstanceId);
    }
  }, [activeInstanceId, instances, setActiveInstanceId]);

  return {
    activeInstanceId,
    setActiveInstanceId,
    instances,
    hasResolvedInstances,
  };
}
