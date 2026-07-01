import { useStore } from 'zustand';
import {
  createInstanceStore,
  createInstanceStorePersistOptions,
  createInstanceStoreState,
  instanceStore,
  type InstanceStoreState,
} from './instanceStore.ts';

export {
  createInstanceStore,
  instanceStore,
  type InstanceStoreState,
} from './instanceStore.ts';

const useBoundInstanceStore = useStore.bind(null, instanceStore) as {
  (): InstanceStoreState;
  <T>(selector: (state: InstanceStoreState) => T): T;
};

export const useInstanceStore = Object.assign(useBoundInstanceStore, {
  getState: instanceStore.getState,
  setState: instanceStore.setState,
  subscribe: instanceStore.subscribe,
  persist: (instanceStore as typeof instanceStore & { persist?: unknown }).persist,
});
