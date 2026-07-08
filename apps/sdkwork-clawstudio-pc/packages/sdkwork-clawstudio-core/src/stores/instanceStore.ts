import {
  createPersistedSimpleStore,
  type StateStorage,
  type StoreStateSetter,
} from './simpleStore.ts';

export interface InstanceStoreState {
  activeInstanceId: string | null;
  setActiveInstanceId: (id: string | null) => void;
  reset: () => void;
}

const STORAGE_KEY = 'claw-studio-instance-storage';

export const createInstanceStoreState = (
  set: StoreStateSetter<InstanceStoreState>,
): InstanceStoreState => ({
  activeInstanceId: null,
  setActiveInstanceId(id: string | null) {
    set({ activeInstanceId: id });
  },
  reset() {
    set({ activeInstanceId: null });
  },
});

export function createInstanceStorePersistOptions(storage?: StateStorage) {
  return storage
    ? {
        name: STORAGE_KEY,
        storage,
      }
    : {
        name: STORAGE_KEY,
      };
}

export function createInstanceStore(storage?: StateStorage) {
  return createPersistedSimpleStore<InstanceStoreState>(
    createInstanceStoreState,
    createInstanceStorePersistOptions(storage),
  );
}

export const instanceStore = createInstanceStore();
