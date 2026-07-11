import type { InstanceConfig, InstanceWorkbenchSnapshot } from '../types/index.ts';
import { normalizeInstanceWorkbenchSnapshot } from './instanceWorkbenchNormalization.ts';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;

export interface StartLoadInstanceDetailWorkbenchInput {
  targetInstanceId: string;
  withSpinner?: boolean;
  preserveStateOnError?: boolean;
  setWorkbench: StateSetter<InstanceWorkbenchSnapshot | null>;
  setConfig: StateSetter<InstanceConfig | null>;
  setIsLoading: StateSetter<boolean>;
  loadWorkbench: (instanceId: string) => Promise<InstanceWorkbenchSnapshot | null>;
  reportError: (error: unknown) => void;
}

export interface InstanceDetailWorkbenchLoadRequest {
  cancel: () => void;
  promise: Promise<void>;
}

export function startLoadInstanceDetailWorkbench({
  targetInstanceId,
  withSpinner,
  preserveStateOnError,
  setWorkbench,
  setConfig,
  setIsLoading,
  loadWorkbench,
  reportError,
}: StartLoadInstanceDetailWorkbenchInput): InstanceDetailWorkbenchLoadRequest {
  const showSpinner = withSpinner !== false;
  let cancelled = false;

  if (showSpinner) {
    setIsLoading(true);
  }

  const promise = loadWorkbench(targetInstanceId)
    .then((nextWorkbench) => {
      if (cancelled) {
        return;
      }

      const normalizedWorkbench = normalizeInstanceWorkbenchSnapshot(nextWorkbench);
      setWorkbench(normalizedWorkbench);
      setConfig(normalizedWorkbench?.config || null);
    })
    .catch((error) => {
      reportError(error);
      if (cancelled) {
        return;
      }

      if (preserveStateOnError !== true) {
        setWorkbench(null);
        setConfig(null);
      }
    })
    .finally(() => {
      if (!cancelled && showSpinner) {
        setIsLoading(false);
      }
    });

  return {
    cancel() {
      cancelled = true;
    },
    promise,
  };
}
