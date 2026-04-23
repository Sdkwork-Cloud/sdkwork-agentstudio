import assert from 'node:assert/strict';

import {
  CHAT_SESSION_PREFERENCES_STORAGE_KEY,
  buildChatSessionPreferencesKey,
  createChatSessionPreferencesStore,
} from './chatSessionPreferencesStore.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createMemoryStorage() {
  const entries = new Map<string, string>();

  return {
    getItem(name: string) {
      return entries.get(name) ?? null;
    },
    setItem(name: string, value: string) {
      entries.set(name, value);
    },
    removeItem(name: string) {
      entries.delete(name);
    },
  };
}

await runTest(
  'chatSessionPreferencesStore persists favorite and pin timestamps under a stable session key and rehydrates them',
  () => {
    const storage = createMemoryStorage();
    const sessionKey = buildChatSessionPreferencesKey({
      instanceId: 'instance-alpha',
      sessionId: 'session-1',
    });
    const store = createChatSessionPreferencesStore({ storage });

    store.getState().setSessionFavorited({
      sessionKey,
      isFavorited: true,
      at: 1_710_000_000_000,
    });
    store.getState().setSessionPinned({
      sessionKey,
      isPinned: true,
      at: 1_710_000_000_100,
    });

    assert.ok(storage.getItem(CHAT_SESSION_PREFERENCES_STORAGE_KEY));

    const rehydratedStore = createChatSessionPreferencesStore({ storage });
    assert.deepEqual(rehydratedStore.getState().entriesBySessionKey[sessionKey], {
      favoriteAt: 1_710_000_000_000,
      pinnedAt: 1_710_000_000_100,
    });
  },
);

await runTest(
  'chatSessionPreferencesStore removes the persisted entry once favorite and pin are both cleared',
  () => {
    const storage = createMemoryStorage();
    const sessionKey = buildChatSessionPreferencesKey({
      instanceId: null,
      sessionId: 'session-direct',
    });
    const store = createChatSessionPreferencesStore({ storage });

    store.getState().setSessionFavorited({
      sessionKey,
      isFavorited: true,
      at: 10,
    });
    store.getState().setSessionPinned({
      sessionKey,
      isPinned: true,
      at: 20,
    });
    store.getState().setSessionFavorited({
      sessionKey,
      isFavorited: false,
    });
    store.getState().setSessionPinned({
      sessionKey,
      isPinned: false,
    });

    assert.equal(store.getState().entriesBySessionKey[sessionKey], undefined);
  },
);

await runTest(
  'buildChatSessionPreferencesKey normalizes direct conversations into the dedicated direct scope',
  () => {
    assert.equal(
      buildChatSessionPreferencesKey({
        instanceId: undefined,
        sessionId: 'session-direct',
      }),
      '__direct__:session-direct',
    );
    assert.equal(
      buildChatSessionPreferencesKey({
        instanceId: 'instance-beta',
        sessionId: 'session-42',
      }),
      'instance-beta:session-42',
    );
  },
);
