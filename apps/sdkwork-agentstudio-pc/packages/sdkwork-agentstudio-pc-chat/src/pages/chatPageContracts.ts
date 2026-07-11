import type { InstanceDirectoryItem } from '@sdkwork/agentstudio-pc-core';
import type { Agent, KernelChatAuthorityKind, Skill } from '@sdkwork/agentstudio-pc-types';
import type {
  ChatConversationBodyMode,
  ChatMessageGroup,
  ChatPageModel,
  ChatPageModelChannel,
  ChatRunBinding,
  ChatRuntimeState,
  ChatSessionControlActions,
  ChatWorkspaceMode,
  ChatWorkspacePresentation,
  InstanceChatRouteMode,
  InstanceEffectiveModelCatalog,
  KernelChatAdapterCapabilities,
  KernelChatMessageState,
} from '../services';
import type { ChatComposerSubmitPayload } from '../types';
import type {
  ChatSession,
  ChatState,
  GatewayConnectionStatus,
  Message,
  SyncState,
} from '../store/useChatStore';
import type { ChatContextOption } from './chatContextOptions';

export type ChatPageTranslate = (key: string, options?: Record<string, unknown>) => string;

export type ChatPageSendMode = 'local' | 'gateway';
export type ChatPageNewSessionModelMode = 'modelName' | 'modelId';
export type ChatPageAgentCatalogMode = 'sharedCatalog' | 'kernelCatalog';
export type ChatPageSessionScopeMode = 'all' | 'agentBound';

export type ChatPageKernelSessionState = {
  authorityKind?: KernelChatAuthorityKind | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  model?: string | null;
  defaultModel?: string | null;
};

export type ChatPageRuntimeAdapterCapabilities = KernelChatAdapterCapabilities | null;

export type ChatPageSessionControlOption = {
  value: string;
  label: string;
};

export type ChatPageSyncState = SyncState;

export type ChatPageSelectableSessionRef = Pick<ChatSession, 'id'>;

export type ChatPageSessionControlActions = {
  onSelectThinkingLevel?: (thinkingLevel: string | null) => void;
  onSelectFastMode?: (fastMode: string | null) => void;
  onSelectVerboseLevel?: (verboseLevel: string | null) => void;
  onSelectReasoningLevel?: (reasoningLevel: string | null) => void;
};

export interface ChatPageInstanceSourceState {
  activeInstanceId: string | null;
  setActiveInstanceId: (instanceId: string | null) => void;
  instances: InstanceDirectoryItem[];
  hasResolvedInstances: boolean;
}

export type ChatPageRuntimeSourceState = Pick<
  ChatState,
  | 'sessions'
  | 'activeSessionIdByInstance'
  | 'syncStateByInstance'
  | 'gatewayConnectionStatusByInstance'
  | 'lastErrorByInstance'
  | 'instanceRouteModeById'
  | 'instanceChatAdapterCapabilitiesById'
  | 'hydrateInstance'
  | 'createSession'
  | 'addMessage'
  | 'updateMessage'
  | 'removeMessages'
  | 'flushSession'
  | 'deleteSession'
  | 'setActiveSession'
  | 'sendKernelMessage'
  | 'abortSession'
  | 'setKernelSessionModel'
  | 'setKernelSessionThinkingLevel'
  | 'setKernelSessionFastMode'
  | 'setKernelSessionVerboseLevel'
  | 'setKernelSessionReasoningLevel'
>;

export interface ChatPageModelPreferenceSourceState {
  activeChannelId: string;
  activeModelId: string;
  setActiveChannel: (instanceId: string, channelId: string) => void;
  setActiveModel: (instanceId: string, modelId: string) => void;
}

export interface ChatPageSourceState {
  instance: ChatPageInstanceSourceState;
  runtime: ChatPageRuntimeSourceState;
  modelPreference: ChatPageModelPreferenceSourceState;
}

export interface ChatPageUiDrawerState {
  isSessionContextDrawerOpen: boolean;
  setIsSessionContextDrawerOpen: (value: boolean) => void;
}

export interface ChatPageSelectionTransitionState {
  requestId: number;
  kind: 'agent' | 'session' | 'agentCreated';
  agentId: string | null;
  sessionId: string | null;
}

export interface ChatPageUiSelectionState {
  selectedSkillId: string | null;
  setSelectedSkillId: (value: string | null) => void;
  selectedAgentId: string | null | undefined;
  setSelectedAgentId: (value: string | null | undefined) => void;
  selectionTransition: ChatPageSelectionTransitionState | null;
  setSelectionTransition: (value: ChatPageSelectionTransitionState | null) => void;
}

export interface ChatPageUiState {
  drawer: ChatPageUiDrawerState;
  selection: ChatPageUiSelectionState;
}

export type ChatPageGatewayConnectionStateByInstance = Record<
  string,
  GatewayConnectionStatus | undefined
>;

export interface ChatPageConversationBodyState {
  mode: ChatConversationBodyMode;
}

export interface ChatPageWorkspaceRuntimeState {
  activeSessionId: string | null;
  syncState: SyncState;
  routeMode: InstanceChatRouteMode | undefined;
  lastError: string | undefined;
  activeAdapterCapabilities: KernelChatAdapterCapabilities | null;
  isChatSupportedRoute: boolean;
  agentCatalogMode: ChatPageAgentCatalogMode;
  sessionScopeMode: ChatPageSessionScopeMode;
  sendMode: ChatPageSendMode;
  newSessionModelMode: ChatPageNewSessionModelMode;
  supportsSessionScopeSync: boolean;
  gatewayConnectionStatus: GatewayConnectionStatus | null;
  defaultAgentId: string | null;
  effectiveGatewayAgentId: string | null;
  hasResolvedVisibleAgents: boolean;
  visibleAgentIds: string[] | null;
}

export interface ChatPageWorkspaceCatalogState {
  isAgentSelectorLoading: boolean;
  isSkillSelectorLoading: boolean;
  agentOptions: ChatContextOption[];
  skillOptions: ChatContextOption[];
  visibleAgents: Agent[];
  activeAgent: Agent | undefined;
  activeSkill: Skill | undefined;
  modelCatalog: InstanceEffectiveModelCatalog | undefined;
  modelCatalogError: unknown;
  catalogChannels: ChatPageModelChannel[];
}

export interface ChatPageWorkspaceSessionState {
  workspaceMode: ChatWorkspaceMode;
  isExplicitBlankWorkspace: boolean;
  isDisplaySessionFallback: boolean;
  selectableInstanceSessions: ChatSession[];
  selectedSession: ChatSession | null;
  displaySessionId: string | null;
  displaySession: ChatSession | null;
  selectedSessionAgentId: string | null;
  displaySessionAgentId: string | null;
  activeKernelSessionState: ChatPageKernelSessionState;
  activeRunBinding: ChatRunBinding;
  chatRuntimeState: ChatRuntimeState;
  isUnsupportedRoute: boolean;
  runningRunBinding: ChatRunBinding | null;
  sessionSelectedModelId: string | null;
  activeMessages: Message[];
  conversationBodyState: ChatPageConversationBodyState;
  activeMessageGroups: ChatMessageGroup<KernelChatMessageState>[];
}

export interface ChatPageWorkspaceInteractionState {
  isActiveSessionGenerating: boolean;
  isBusy: boolean;
  canStop: boolean;
  channels: ChatPageModelChannel[];
  activeChannel: ChatPageModelChannel | undefined;
  activeModel: ChatPageModel | undefined;
  sessionControlActions: ChatSessionControlActions;
  activeThinkingLevel: string | null;
  thinkingLevelDefaultLabel: string;
  thinkingLevelOptions: ChatPageSessionControlOption[];
  activeFastMode: string | null;
  fastModeDefaultLabel: string;
  fastModeOptions: ChatPageSessionControlOption[];
  activeVerboseLevel: string | null;
  verboseLevelDefaultLabel: string;
  verboseLevelOptions: ChatPageSessionControlOption[];
  activeReasoningLevel: string | null;
  reasoningLevelDefaultLabel: string;
  reasoningLevelOptions: ChatPageSessionControlOption[];
  newSessionModel: string | undefined;
  handleChannelChange: (channelId: string) => void;
  handleModelChange: (channelId: string, modelId: string) => void;
  handleSend: (payload: ChatComposerSubmitPayload) => Promise<boolean>;
  handleStop: () => void;
}

export type ChatPageWorkspacePresentationState = ChatWorkspacePresentation;

export interface ChatPageWorkspaceState {
  runtime: ChatPageWorkspaceRuntimeState;
  catalog: ChatPageWorkspaceCatalogState;
  session: ChatPageWorkspaceSessionState;
  interaction: ChatPageWorkspaceInteractionState;
  presentation: ChatPageWorkspacePresentationState;
}
