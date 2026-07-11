import { useChatStore } from '../store/useChatStore';
import type { ChatPageRuntimeSourceState } from './chatPageContracts';

export function useChatRuntimeSourceState(): ChatPageRuntimeSourceState {
  const {
    sessions,
    activeSessionIdByInstance,
    syncStateByInstance,
    gatewayConnectionStatusByInstance,
    lastErrorByInstance,
    instanceRouteModeById,
    instanceChatAdapterCapabilitiesById,
    hydrateInstance,
    createSession,
    addMessage,
    updateMessage,
    removeMessages,
    flushSession,
    deleteSession,
    setActiveSession,
    sendKernelMessage,
    abortSession,
    setKernelSessionModel,
    setKernelSessionThinkingLevel,
    setKernelSessionFastMode,
    setKernelSessionVerboseLevel,
    setKernelSessionReasoningLevel,
  } = useChatStore();

  return {
    sessions,
    activeSessionIdByInstance,
    syncStateByInstance,
    gatewayConnectionStatusByInstance,
    lastErrorByInstance,
    instanceRouteModeById,
    instanceChatAdapterCapabilitiesById,
    hydrateInstance,
    createSession,
    addMessage,
    updateMessage,
    removeMessages,
    flushSession,
    deleteSession,
    setActiveSession,
    sendKernelMessage,
    abortSession,
    setKernelSessionModel,
    setKernelSessionThinkingLevel,
    setKernelSessionFastMode,
    setKernelSessionVerboseLevel,
    setKernelSessionReasoningLevel,
  };
}
