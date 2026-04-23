import type { ChatWorkspaceMode } from './chatWorkspaceProjection.ts';
import {
  buildChatSidebarAgentOptions,
  findChatSidebarAgentOption,
  type ChatSidebarAgentOption,
} from './chatSessionOwnerPresentation.ts';

interface ChatWorkspacePresentationVisibleAgent {
  id: string;
  name: string;
  avatar?: string | null;
  kernelId?: string | null;
  kernelLabel?: string | null;
}

export interface ChatWorkspacePresentation {
  primaryAgentId: string | null;
  sidebarAgentOptions: ChatSidebarAgentOption[];
  selectedWorkspaceAgentName: string;
  workspaceTitle: string | null;
}

export function resolveChatWorkspacePresentation(params: {
  sessionScopeMode: 'all' | 'agentBound';
  defaultAgentId?: string | null;
  visibleAgents: ChatWorkspacePresentationVisibleAgent[];
  effectiveGatewayAgentId: string | null;
  activeAgentName?: string | null;
  mainAgentLabel: string;
  workspaceMode: ChatWorkspaceMode;
  isExplicitBlankWorkspace: boolean;
  hasDisplaySession: boolean;
}): ChatWorkspacePresentation {
  const primaryAgentId =
    params.sessionScopeMode === 'agentBound' ? params.defaultAgentId ?? null : null;
  const sidebarAgentOptions = buildChatSidebarAgentOptions({
    sessionScopeMode: params.sessionScopeMode,
    visibleAgents: params.visibleAgents,
    mainAgentLabel: params.mainAgentLabel,
  });
  const selectedWorkspaceAgentName =
    findChatSidebarAgentOption(sidebarAgentOptions, params.effectiveGatewayAgentId)?.name ??
    params.activeAgentName ??
    params.mainAgentLabel;
  const workspaceTitle =
    params.hasDisplaySession ||
    (!params.isExplicitBlankWorkspace && params.workspaceMode !== 'blankAgentWorkspace')
      ? null
      : selectedWorkspaceAgentName;

  return {
    primaryAgentId,
    sidebarAgentOptions,
    selectedWorkspaceAgentName,
    workspaceTitle,
  };
}
