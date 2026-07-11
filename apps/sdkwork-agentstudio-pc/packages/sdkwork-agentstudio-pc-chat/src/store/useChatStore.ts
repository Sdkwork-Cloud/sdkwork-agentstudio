import { useStore } from 'zustand';
import {
  chatStore,
  type ChatSession,
  type ChatState,
  type GatewayConnectionStatus,
  type Message,
  type Role,
  type SyncState,
} from './chatStore.ts';

export {
  chatStore,
  openClawGatewaySessions,
  type ChatSession,
  type ChatState,
  type GatewayConnectionStatus,
  type Message,
  type Role,
  type SyncState,
} from './chatStore.ts';

const useBoundChatStore = useStore.bind(null, chatStore) as {
  (): ChatState;
  <T>(selector: (state: ChatState) => T): T;
};

export const useChatStore = Object.assign(useBoundChatStore, {
  getState: chatStore.getState,
  setState: chatStore.setState,
  subscribe: chatStore.subscribe,
});
