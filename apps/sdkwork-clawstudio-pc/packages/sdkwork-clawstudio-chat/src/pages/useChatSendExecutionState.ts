import { useRef, useState } from 'react';
import type { Agent, Skill } from '@sdkwork/clawstudio-types';
import {
  canStopChatKernelRun,
  chatService,
  createChatComposerSendActions,
  createChatLocalRunActions,
  resolveChatKernelRunDispatchMode,
  createChatSessionRunActions,
  type ChatRunStateBinding,
  type ChatPageModel,
  type ChatPageModelChannel,
  type InstanceChatRouteMode,
  type KernelChatAdapterCapabilities,
} from '../services';
import type { ChatComposerSubmitPayload, ChatModel } from '../types';
import { useChatStore, type ChatState } from '../store/useChatStore';
import type {
  ChatPageSendMode,
  ChatPageSessionScopeMode,
} from './chatPageContracts';
import { resolveChatGenerationViewState } from './chatGenerationViewPolicy';

export interface UseChatSendExecutionStateInput {
  activeInstanceId: string | null | undefined;
  selectedSessionId: string | null;
  displaySessionId: string | null;
  activeRunBinding: ChatRunStateBinding;
  runningRunBinding: ChatRunStateBinding | null;
  sendMode: ChatPageSendMode;
  routeMode: InstanceChatRouteMode | undefined;
  isChatSupportedRoute: boolean;
  activeAdapterCapabilities: KernelChatAdapterCapabilities | null;
  activeChannel: ChatPageModelChannel | undefined;
  activeModel: ChatPageModel | undefined;
  activeSkill: Skill | undefined;
  activeAgent: Agent | undefined;
  sessionScopeMode: ChatPageSessionScopeMode;
  effectiveGatewayAgentId: string | null;
  newSessionModel: string | undefined;
  createSession: ChatState['createSession'];
  addMessage: ChatState['addMessage'];
  updateMessage: ChatState['updateMessage'];
  removeMessages: ChatState['removeMessages'];
  flushSession: ChatState['flushSession'];
  sendKernelMessage: ChatState['sendKernelMessage'];
  abortSession: ChatState['abortSession'];
}

export interface UseChatSendExecutionStateResult {
  isActiveSessionGenerating: boolean;
  isBusy: boolean;
  canStop: boolean;
  handleSend: (payload: ChatComposerSubmitPayload) => Promise<boolean>;
  handleStop: () => void;
}

export function useChatSendExecutionState({
  activeInstanceId,
  selectedSessionId,
  displaySessionId,
  activeRunBinding,
  runningRunBinding,
  sendMode,
  routeMode,
  isChatSupportedRoute,
  activeAdapterCapabilities,
  activeChannel,
  activeModel,
  activeSkill,
  activeAgent,
  sessionScopeMode,
  effectiveGatewayAgentId,
  newSessionModel,
  createSession,
  addMessage,
  updateMessage,
  removeMessages,
  flushSession,
  sendKernelMessage,
  abortSession,
}: UseChatSendExecutionStateInput): UseChatSendExecutionStateResult {
  const [pendingSendSessionId, setPendingSendSessionId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendSubmitLockRef = useRef<Promise<boolean> | null>(null);

  const { isActiveSessionGenerating, isComposerLocked, stopRunBinding } = resolveChatGenerationViewState({
    effectiveActiveSessionId: displaySessionId,
    pendingSendSessionId,
    activeRunBinding,
    runningRunBinding,
  });
  const isBusy = isComposerLocked;
  const dispatchMode = resolveChatKernelRunDispatchMode({
    activeInstanceId,
    sendMode,
    adapterCapabilities: activeAdapterCapabilities,
  });
  const resolvedActiveModel: ChatModel | null =
    activeChannel && activeModel
      ? {
          id: activeModel.id,
          name: activeModel.name,
          provider: activeChannel.provider,
          icon: activeChannel.icon,
        }
      : null;
  const sessionRunActions = createChatSessionRunActions({
    activeInstanceId,
    sendMode,
    dispatchMode,
    stopRunBinding,
    setPendingSendSessionId,
    sendKernelMessage,
    abortSession,
  });
  const directRunActions = createChatLocalRunActions({
    sendMode,
    abortControllerRef,
    setPendingSendSessionId,
    addMessage,
    updateMessage,
    removeMessages,
    flushSession,
    getSessionById: (sessionId, instanceId) => {
      const scopedInstanceId =
        instanceId === undefined ? activeInstanceId ?? null : instanceId;
      return useChatStore
        .getState()
        .sessions.find(
          (session) =>
            session.id === sessionId &&
            (session.instanceId ?? null) === scopedInstanceId,
        );
    },
    sendMessageStream: chatService.sendMessageStream.bind(chatService),
  });
  const canStop =
    canStopChatKernelRun({
      activeInstanceId,
      sendMode,
      dispatchMode,
      runBinding: stopRunBinding,
      supportsRunAbort: activeAdapterCapabilities?.capabilitySet.supportsRunAbort ?? false,
    }) ||
    (sendMode === 'local' && Boolean(abortControllerRef.current));
  const composerSendActions = createChatComposerSendActions({
    activeInstanceId,
    selectedSessionId,
    sendMode,
    hasActiveChannel: Boolean(activeChannel),
    isChatSupportedRoute,
    isBusy,
    hasPendingInstanceRoute: Boolean(activeInstanceId && !routeMode),
    activeModel: resolvedActiveModel,
    activeSkill: activeSkill ?? null,
    activeAgent: activeAgent ?? null,
    sessionScopeMode,
    sessionScopeAgentId: effectiveGatewayAgentId,
    newSessionModel,
    inFlightSubmitRef: sendSubmitLockRef,
    createSession,
    sessionRunActions,
    directRunActions,
  });
  const handleSend = composerSendActions.submit;
  const handleStop = () => {
    void sessionRunActions.stopActiveRun().then((handled) => {
      if (!handled) {
        directRunActions.stopActiveRun();
      }
    });
  };

  return {
    isActiveSessionGenerating,
    isBusy,
    canStop,
    handleSend,
    handleStop,
  };
}
