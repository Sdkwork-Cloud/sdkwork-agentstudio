import {
  type CreateKernelAgentResult,
  type InstanceDirectoryItem,
  resolvePreferredActiveInstanceId,
} from '@sdkwork/clawstudio-core';
import {
  findChatSidebarAgentOption,
  type ChatSidebarAgentOption,
} from './chatSessionOwnerPresentation.ts';

export interface ChatSidebarAgentSelection {
  agentId: string | null;
}

export interface ChatSidebarSessionSelection {
  sessionId?: string | null;
  instanceId?: string | null;
  agentId: string | null;
}

export interface ChatSidebarSelectionPlan {
  nextInstanceId: string | null;
  shouldHydrateTargetInstance: boolean;
  shouldSetActiveInstance: boolean;
  nextSelectedAgentId: string | null | undefined;
  nextSessionId: string | null;
  shouldSetActiveSession: boolean;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function resolveFallbackInstanceId(params: {
  instances: InstanceDirectoryItem[];
  currentActiveInstanceId: string | null;
  preferredInstanceId?: string | null;
}) {
  return resolvePreferredActiveInstanceId({
    instances: params.instances,
    activeInstanceId: params.currentActiveInstanceId,
    preferredInstanceId: params.preferredInstanceId ?? null,
  });
}

export function resolveChatSidebarKnownAgentLinkedInstanceId(params: {
  agentId: string | null;
  currentActiveInstanceId: string | null;
  agentOptions: ChatSidebarAgentOption[];
}): string | null | undefined {
  const currentActiveInstanceId = normalizeOptionalString(
    params.currentActiveInstanceId,
  );
  const normalizedAgentId = normalizeOptionalString(params.agentId);

  if (!normalizedAgentId) {
    return currentActiveInstanceId ?? null;
  }

  if (!currentActiveInstanceId) {
    return undefined;
  }

  return findChatSidebarAgentOption(params.agentOptions, normalizedAgentId)
    ? currentActiveInstanceId
    : undefined;
}

export function resolveChatSidebarAgentSelectionPlan(params: {
  selection: ChatSidebarAgentSelection;
  currentActiveInstanceId: string | null;
  instances: InstanceDirectoryItem[];
  linkedInstanceId?: string | null;
}): ChatSidebarSelectionPlan {
  const nextInstanceId = resolveFallbackInstanceId({
    instances: params.instances,
    currentActiveInstanceId: params.currentActiveInstanceId,
    preferredInstanceId: params.linkedInstanceId ?? null,
  });

  return {
    nextInstanceId,
    shouldHydrateTargetInstance:
      Boolean(nextInstanceId) &&
      nextInstanceId !== params.currentActiveInstanceId,
    shouldSetActiveInstance:
      nextInstanceId !== null && nextInstanceId !== params.currentActiveInstanceId,
    nextSelectedAgentId: params.selection.agentId,
    nextSessionId: null,
    shouldSetActiveSession: true,
  };
}

export function resolveChatSidebarSessionSelectionPlan(params: {
  selection?: ChatSidebarSessionSelection;
  currentActiveInstanceId: string | null;
}): ChatSidebarSelectionPlan {
  if (!params.selection?.sessionId) {
    return {
      nextInstanceId: params.currentActiveInstanceId,
      shouldHydrateTargetInstance: false,
      shouldSetActiveInstance: false,
      nextSelectedAgentId: params.selection ? (params.selection.agentId ?? null) : undefined,
      nextSessionId: null,
      shouldSetActiveSession: false,
    };
  }

  const nextInstanceId = params.selection.instanceId ?? null;
  return {
    nextInstanceId,
    shouldHydrateTargetInstance: nextInstanceId !== params.currentActiveInstanceId,
    shouldSetActiveInstance: nextInstanceId !== params.currentActiveInstanceId,
    nextSelectedAgentId: params.selection.agentId ?? null,
    nextSessionId: params.selection.sessionId,
    shouldSetActiveSession: true,
  };
}

export function resolveChatSidebarAgentCreatedSelectionPlan(params: {
  result: CreateKernelAgentResult;
  currentActiveInstanceId: string | null;
}): ChatSidebarSelectionPlan {
  return {
    nextInstanceId: params.result.instanceId,
    shouldHydrateTargetInstance: true,
    shouldSetActiveInstance: params.result.instanceId !== params.currentActiveInstanceId,
    nextSelectedAgentId: params.result.agentId,
    nextSessionId: null,
    shouldSetActiveSession: true,
  };
}
