import {
  createPersistedSimpleStore,
  type SimpleStoreApi,
  type StateStorage,
  type StoreStateSetter,
} from '@sdkwork/claw-core';

export const CHAT_SESSION_PREFERENCES_STORAGE_KEY =
  'claw-studio.chat.session-preferences.v1';

const DIRECT_SESSION_SCOPE_KEY = '__direct__';

export interface ChatSessionPreferencesEntry {
  favoriteAt: number | null;
  pinnedAt: number | null;
}

export interface ChatSessionPreferencesState {
  entriesBySessionKey: Record<string, ChatSessionPreferencesEntry>;
  setSessionFavorited: (params: {
    sessionKey: string;
    isFavorited: boolean;
    at?: number;
  }) => void;
  setSessionPinned: (params: {
    sessionKey: string;
    isPinned: boolean;
    at?: number;
  }) => void;
  clearSessionPreferences: (sessionKey: string) => void;
}

function normalizeSessionPreferenceTimestamp(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function pruneSessionPreferencesEntry(
  entry: ChatSessionPreferencesEntry,
): ChatSessionPreferencesEntry | null {
  if (entry.favoriteAt === null && entry.pinnedAt === null) {
    return null;
  }

  return entry;
}

export function buildChatSessionPreferencesKey(params: {
  instanceId?: string | null;
  sessionId: string;
}) {
  const instanceScope = params.instanceId?.trim() || DIRECT_SESSION_SCOPE_KEY;
  return `${instanceScope}:${params.sessionId}`;
}

export const createChatSessionPreferencesStoreState = (
  _set: StoreStateSetter<ChatSessionPreferencesState>,
  get: () => ChatSessionPreferencesState,
  store: SimpleStoreApi<ChatSessionPreferencesState>,
): ChatSessionPreferencesState => ({
  entriesBySessionKey: {},
  setSessionFavorited(params) {
    store.setState((state) => {
      const currentEntry = state.entriesBySessionKey[params.sessionKey] ?? {
        favoriteAt: null,
        pinnedAt: null,
      };
      const nextEntry = pruneSessionPreferencesEntry({
        ...currentEntry,
        favoriteAt: params.isFavorited
          ? normalizeSessionPreferenceTimestamp(params.at) ?? Date.now()
          : null,
      });
      const nextEntries = {
        ...state.entriesBySessionKey,
      };

      if (nextEntry) {
        nextEntries[params.sessionKey] = nextEntry;
      } else {
        delete nextEntries[params.sessionKey];
      }

      return {
        entriesBySessionKey: nextEntries,
      };
    });
  },
  setSessionPinned(params) {
    store.setState((state) => {
      const currentEntry = state.entriesBySessionKey[params.sessionKey] ?? {
        favoriteAt: null,
        pinnedAt: null,
      };
      const nextEntry = pruneSessionPreferencesEntry({
        ...currentEntry,
        pinnedAt: params.isPinned
          ? normalizeSessionPreferenceTimestamp(params.at) ?? Date.now()
          : null,
      });
      const nextEntries = {
        ...state.entriesBySessionKey,
      };

      if (nextEntry) {
        nextEntries[params.sessionKey] = nextEntry;
      } else {
        delete nextEntries[params.sessionKey];
      }

      return {
        entriesBySessionKey: nextEntries,
      };
    });
  },
  clearSessionPreferences(sessionKey) {
    store.setState((state) => {
      if (!state.entriesBySessionKey[sessionKey]) {
        return get();
      }

      const nextEntries = {
        ...state.entriesBySessionKey,
      };
      delete nextEntries[sessionKey];

      return {
        entriesBySessionKey: nextEntries,
      };
    });
  },
});

export function createChatSessionPreferencesStorePersistOptions(storage?: StateStorage) {
  return storage
    ? {
        name: CHAT_SESSION_PREFERENCES_STORAGE_KEY,
        storage,
        partialize: (state: ChatSessionPreferencesState) => ({
          entriesBySessionKey: state.entriesBySessionKey,
        }),
      }
    : {
        name: CHAT_SESSION_PREFERENCES_STORAGE_KEY,
        partialize: (state: ChatSessionPreferencesState) => ({
          entriesBySessionKey: state.entriesBySessionKey,
        }),
      };
}

export function createChatSessionPreferencesStore(options: {
  storage?: StateStorage;
} = {}) {
  return createPersistedSimpleStore<ChatSessionPreferencesState>(
    createChatSessionPreferencesStoreState,
    createChatSessionPreferencesStorePersistOptions(options.storage),
  );
}

export const chatSessionPreferencesStore = createChatSessionPreferencesStore();
