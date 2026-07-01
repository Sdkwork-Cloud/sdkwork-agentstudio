import { useSyncExternalStore } from 'react';
import {
  chatSessionPreferencesStore,
  type ChatSessionPreferencesState,
} from './chatSessionPreferencesStore.ts';

function useBoundChatSessionPreferencesStore(): ChatSessionPreferencesState;
function useBoundChatSessionPreferencesStore<T>(
  selector: (state: ChatSessionPreferencesState) => T,
): T;
function useBoundChatSessionPreferencesStore<T>(
  selector?: (state: ChatSessionPreferencesState) => T,
) {
  return useSyncExternalStore(
    chatSessionPreferencesStore.subscribe,
    () => {
      const state = chatSessionPreferencesStore.getState();
      return selector ? selector(state) : state;
    },
    () => {
      const state = chatSessionPreferencesStore.getState();
      return selector ? selector(state) : state;
    },
  );
}

export const useChatSessionPreferencesStore = Object.assign(
  useBoundChatSessionPreferencesStore,
  {
    getState: chatSessionPreferencesStore.getState,
    setState: chatSessionPreferencesStore.setState,
    subscribe: chatSessionPreferencesStore.subscribe,
    persist: chatSessionPreferencesStore.persist,
  },
);
