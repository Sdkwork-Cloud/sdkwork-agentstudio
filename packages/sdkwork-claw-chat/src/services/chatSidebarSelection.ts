import {
  type CreateKernelAgentResult,
  type InstanceDirectoryItem,
  resolvePreferredActiveInstanceId,
} from '@sdkwork/claw-core';

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
      (nextInstanceId !== params.currentActiveInstanceId ||
        params.selection.agentId !== null),
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
