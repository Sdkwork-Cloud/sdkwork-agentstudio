import { create } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type {
  ManageRolloutPreview,
  ManageRolloutRecord,
  ManageRolloutTargetPreviewRecord,
} from '@sdkwork/claw-infrastructure';
import {
  rolloutService,
  type RolloutPhaseCounts,
  type RolloutService,
} from '../services/index.ts';

export interface RolloutStoreState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  items: ManageRolloutRecord[];
  total: number;
  phaseCounts: RolloutPhaseCounts;
  selectedRolloutId: string | null;
  preview: ManageRolloutPreview | null;
  previewFailures: ManageRolloutTargetPreviewRecord[];
  lastStartedRolloutId: string | null;
  error: string | null;
  load(): Promise<ManageRolloutRecord[]>;
  previewRollout(rolloutId: string): Promise<ManageRolloutPreview | null>;
  startRollout(rolloutId: string): Promise<ManageRolloutRecord | null>;
  reset(): void;
}

function createEmptyPhaseCounts(): RolloutPhaseCounts {
  return {
    active: 0,
    failed: 0,
    completed: 0,
    paused: 0,
    drafts: 0,
  };
}

function createRolloutStoreState(service: RolloutService) {
  return (
    set: (partial: Partial<RolloutStoreState>) => void,
    get: () => RolloutStoreState,
  ): RolloutStoreState => ({
    status: 'idle',
    items: [],
    total: 0,
    phaseCounts: createEmptyPhaseCounts(),
    selectedRolloutId: null,
    preview: null,
    previewFailures: [],
    lastStartedRolloutId: null,
    error: null,
    async load() {
      set({
        status: 'loading',
        error: null,
      });

      try {
        const result = await service.list();
        set({
          status: 'ready',
          items: result.items,
          total: result.total,
          phaseCounts: service.summarizePhases(result),
          error: null,
        });
        return result.items;
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'Loading rollouts failed.',
        });
        return [];
      }
    },
    async previewRollout(rolloutId) {
      set({
        selectedRolloutId: rolloutId,
        error: null,
      });

      try {
        const preview = await service.preview(rolloutId);
        set({
          preview,
          previewFailures: service.listTargetFailures(preview),
        });
        return preview;
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'Previewing rollout failed.',
        });
        return null;
      }
    },
    async startRollout(rolloutId) {
      set({
        selectedRolloutId: rolloutId,
        error: null,
      });

      try {
        const record = await service.start(rolloutId);
        set({
          lastStartedRolloutId: rolloutId,
        });
        await get().load();
        return record;
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'Starting rollout failed.',
        });
        return null;
      }
    },
    reset() {
      set({
        status: 'idle',
        items: [],
        total: 0,
        phaseCounts: createEmptyPhaseCounts(),
        selectedRolloutId: null,
        preview: null,
        previewFailures: [],
        lastStartedRolloutId: null,
        error: null,
      });
    },
  });
}

export function createRolloutStore(service: RolloutService = rolloutService) {
  return createStore<RolloutStoreState>(createRolloutStoreState(service));
}

export const useRolloutStore = create<RolloutStoreState>(
  createRolloutStoreState(rolloutService),
);
