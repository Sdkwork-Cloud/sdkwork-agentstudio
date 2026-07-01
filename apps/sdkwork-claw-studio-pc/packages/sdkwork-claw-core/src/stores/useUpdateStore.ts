import { create } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { AppUpdateCheckResult } from '@sdkwork/claw-infrastructure';
import {
  updateService,
  type PreferredUpdateAction,
  type UpdateCapability,
} from '../services/index.ts';

export type UpdateStatus = 'idle' | 'checking' | 'ready' | 'unavailable' | 'error';

export interface UpdateStoreService {
  isStartupCheckEnabled?(): boolean;
  getUpdateCapability(): UpdateCapability;
  checkForAppUpdate(): Promise<AppUpdateCheckResult | null>;
  openUpdateTarget(result: AppUpdateCheckResult): Promise<PreferredUpdateAction>;
}

export interface UpdateStoreState {
  status: UpdateStatus;
  result: AppUpdateCheckResult | null;
  lastCheckedAt: number | null;
  error: string | null;
  checkForUpdates(): Promise<AppUpdateCheckResult | null>;
  runStartupCheck(enabled?: boolean): Promise<void>;
  openLatestUpdateTarget(): Promise<PreferredUpdateAction | null>;
  reset(): void;
}

function createUpdateStoreState(service: UpdateStoreService) {
  return (
    set: (partial: Partial<UpdateStoreState>) => void,
    get: () => UpdateStoreState,
  ): UpdateStoreState => ({
    status: 'idle',
    result: null,
    lastCheckedAt: null,
    error: null,
    async checkForUpdates() {
      const capability = service.getUpdateCapability();
      if (!capability.available) {
        set({
          status: 'unavailable',
          result: null,
          error: capability.reason || 'App update capability is unavailable.',
        });
        return null;
      }

      set({
        status: 'checking',
        error: null,
      });

      try {
        const result = await service.checkForAppUpdate();
        if (!result) {
          set({
            status: 'unavailable',
            result: null,
            error: capability.reason || 'App update capability is unavailable.',
          });
          return null;
        }

        set({
          status: 'ready',
          result,
          lastCheckedAt: Date.now(),
          error: null,
        });
        return result;
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'App update check failed.',
        });
        return null;
      }
    },
    async runStartupCheck(enabled = service.isStartupCheckEnabled ? service.isStartupCheckEnabled() : true) {
      if (!enabled) {
        return;
      }

      await get().checkForUpdates();
    },
    async openLatestUpdateTarget() {
      const result = get().result;
      if (!result) {
        return null;
      }

      try {
        return await service.openUpdateTarget(result);
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'Opening the update target failed.',
        });
        return null;
      }
    },
    reset() {
      set({
        status: 'idle',
        result: null,
        lastCheckedAt: null,
        error: null,
      });
    },
  });
}

export function createUpdateStore(service: UpdateStoreService = updateService) {
  return createStore<UpdateStoreState>(createUpdateStoreState(service));
}

export const useUpdateStore = create<UpdateStoreState>(createUpdateStoreState(updateService));
