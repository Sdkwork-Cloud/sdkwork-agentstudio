import type { StudioConversationAttachment } from '@sdkwork/agentstudio-pc-types';
import type { ChatRunStateBinding } from './chatRunBinding.ts';
import type { KernelChatAdapterCapabilities } from './kernelChatAdapter.ts';

export interface ChatKernelRunTarget {
  instanceId: string;
  sessionId: string;
}

export type ChatKernelRunDispatchMode = 'disabled' | 'gateway' | 'authoritative';

export interface ResolveChatKernelRunTargetInput {
  activeInstanceId: string | null | undefined;
  sessionId: string | null | undefined;
  sendMode?: 'local' | 'gateway';
  dispatchMode?: ChatKernelRunDispatchMode;
}

export interface ResolveChatKernelDraftSessionOptionsInput {
  sendMode: 'local' | 'gateway';
  sessionScopeMode: 'all' | 'agentBound';
  agentId?: string | null;
}

export interface CanStopChatKernelRunInput {
  activeInstanceId: string | null | undefined;
  sendMode?: 'local' | 'gateway';
  dispatchMode?: ChatKernelRunDispatchMode;
  runBinding: ChatRunStateBinding | null | undefined;
  supportsRunAbort?: boolean | null | undefined;
}

export interface ChatKernelDraftSessionOptions {
  agentId?: string | null;
  sessionId?: string;
}

type PendingSendSessionIdSetter = (
  nextState: string | null | ((current: string | null) => string | null),
) => void;

export interface CreateChatSessionRunActionsInput {
  activeInstanceId: string | null | undefined;
  sendMode: 'local' | 'gateway';
  dispatchMode?: ChatKernelRunDispatchMode;
  stopRunBinding: ChatRunStateBinding | null | undefined;
  setPendingSendSessionId: PendingSendSessionIdSetter;
  sendKernelMessage: (params: {
    instanceId: string;
    sessionId: string;
    content: string;
    model?: string;
    attachments?: StudioConversationAttachment[];
    requestText?: string;
  }) => Promise<{ runId: string }>;
  abortSession: (params: { instanceId: string; sessionId: string }) => Promise<boolean>;
  logError?: (message: string, error: unknown) => void;
}

export interface SendChatKernelRunInput {
  sessionId: string;
  content: string;
  model?: string;
  attachments?: StudioConversationAttachment[];
  requestText?: string;
}

export interface ChatSessionRunActions {
  getKernelDraftSessionOptions: (
    params: Omit<ResolveChatKernelDraftSessionOptionsInput, 'sendMode'>,
  ) => ChatKernelDraftSessionOptions | undefined;
  sendKernelRun: (params: SendChatKernelRunInput) => Promise<boolean>;
  stopActiveRun: () => Promise<boolean>;
}

export interface ResolveChatKernelRunDispatchModeInput {
  activeInstanceId: string | null | undefined;
  sendMode: 'local' | 'gateway';
  adapterCapabilities?:
    | Pick<
        KernelChatAdapterCapabilities,
        'authorityKind' | 'durable' | 'supported' | 'writable' | 'supportsRuns'
      >
    | null
    | undefined;
}

function resolveRequestedChatKernelRunDispatchMode(
  params: Pick<ResolveChatKernelRunTargetInput, 'dispatchMode' | 'sendMode'>,
): ChatKernelRunDispatchMode {
  if (params.dispatchMode) {
    return params.dispatchMode;
  }

  return params.sendMode === 'gateway' ? 'gateway' : 'disabled';
}

export function resolveChatKernelRunDispatchMode(
  params: ResolveChatKernelRunDispatchModeInput,
): ChatKernelRunDispatchMode {
  if (!params.activeInstanceId) {
    return 'disabled';
  }

  if (params.sendMode === 'gateway') {
    return 'gateway';
  }

  const adapterCapabilities = params.adapterCapabilities ?? null;
  if (!adapterCapabilities || adapterCapabilities.supported === false) {
    return 'disabled';
  }

  if (
    adapterCapabilities.authorityKind === 'gateway' ||
    adapterCapabilities.authorityKind === 'localProjection'
  ) {
    return 'disabled';
  }

  if (!adapterCapabilities.supportsRuns) {
    return 'disabled';
  }

  return adapterCapabilities.durable && adapterCapabilities.writable
    ? 'authoritative'
    : 'disabled';
}

export function resolveChatKernelRunTarget(
  params: ResolveChatKernelRunTargetInput,
): ChatKernelRunTarget | null {
  const dispatchMode = resolveRequestedChatKernelRunDispatchMode(params);
  if (
    dispatchMode === 'disabled' ||
    !params.activeInstanceId ||
    !params.sessionId
  ) {
    return null;
  }

  return {
    instanceId: params.activeInstanceId,
    sessionId: params.sessionId,
  };
}

export function resolveChatKernelStopTarget(params: {
  activeInstanceId: string | null | undefined;
  sendMode?: 'local' | 'gateway';
  dispatchMode?: ChatKernelRunDispatchMode;
  runBinding: ChatRunStateBinding | null | undefined;
}) {
  const dispatchMode = resolveRequestedChatKernelRunDispatchMode(params);
  if (
    dispatchMode === 'disabled' ||
    !params.activeInstanceId ||
    !params.runBinding?.isActive ||
    !params.runBinding?.sessionId
  ) {
    return null;
  }

  return {
    instanceId: params.activeInstanceId,
    sessionId: params.runBinding.sessionId,
  };
}

export function canStopChatKernelRun(params: CanStopChatKernelRunInput) {
  const target = resolveChatKernelStopTarget({
    activeInstanceId: params.activeInstanceId,
    sendMode: params.sendMode,
    dispatchMode: params.dispatchMode,
    runBinding: params.runBinding,
  });
  if (!target) {
    return false;
  }

  const dispatchMode = resolveRequestedChatKernelRunDispatchMode(params);
  if (dispatchMode === 'gateway') {
    return true;
  }

  if (dispatchMode === 'authoritative') {
    return Boolean(params.supportsRunAbort);
  }

  return false;
}

export function resolveChatKernelDraftSessionOptions(
  params: ResolveChatKernelDraftSessionOptionsInput,
): ChatKernelDraftSessionOptions | undefined {
  if (params.sendMode !== 'gateway') {
    return undefined;
  }

  return {
    agentId: params.agentId,
  };
}

export function createChatSessionRunActions(
  input: CreateChatSessionRunActionsInput,
): ChatSessionRunActions {
  const logError = input.logError ?? ((message: string, error: unknown) => {
    console.error(message, error);
  });

  return {
    getKernelDraftSessionOptions(params) {
      return resolveChatKernelDraftSessionOptions({
        sendMode: input.sendMode,
        ...params,
      });
    },
    async sendKernelRun(params) {
      const target = resolveChatKernelRunTarget({
        activeInstanceId: input.activeInstanceId,
        sessionId: params.sessionId,
        sendMode: input.sendMode,
        dispatchMode: input.dispatchMode,
      });
      if (!target) {
        return false;
      }

      input.setPendingSendSessionId(params.sessionId);
      try {
        await input.sendKernelMessage({
          ...target,
          content: params.content,
          model: params.model,
          attachments: params.attachments,
          requestText: params.requestText,
        });
        return true;
      } catch (error) {
        logError('Kernel chat error:', error);
        throw error;
      } finally {
        input.setPendingSendSessionId((current) => (current === params.sessionId ? null : current));
      }
    },
    async stopActiveRun() {
      const target = resolveChatKernelStopTarget({
        activeInstanceId: input.activeInstanceId,
        sendMode: input.sendMode,
        dispatchMode: input.dispatchMode,
        runBinding: input.stopRunBinding,
      });
      if (!target) {
        return false;
      }

      try {
        return await input.abortSession(target);
      } catch (error) {
        logError('Failed to abort kernel session:', error);
        return false;
      }
    },
  };
}
