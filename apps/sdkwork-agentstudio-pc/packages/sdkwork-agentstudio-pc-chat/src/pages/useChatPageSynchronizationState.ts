import { useMemo } from 'react';
import {
  type UseChatActiveSessionSelectionSynchronizationInput,
  useChatActiveSessionSelectionSynchronization,
} from './useChatActiveSessionSelectionSynchronization';
import {
  type UseChatRuntimeSynchronizationInput,
  useChatRuntimeSynchronization,
} from './useChatRuntimeSynchronization';
import type {
  ChatPageSourceState,
  ChatPageUiState,
  ChatPageWorkspaceState,
} from './chatPageContracts';

export interface UseChatPageSynchronizationStateInput {
  sourceState: Pick<ChatPageSourceState, 'instance' | 'runtime' | 'modelPreference'>;
  pageUiState: Pick<ChatPageUiState, 'selection'>;
  workspaceState: Pick<
    ChatPageWorkspaceState,
    'runtime' | 'catalog' | 'session' | 'interaction' | 'presentation'
  >;
}

export function useChatPageSynchronizationState({
  sourceState,
  pageUiState,
  workspaceState,
}: UseChatPageSynchronizationStateInput) {
  const {
    instance: instanceSource,
    runtime: runtimeSource,
    modelPreference: modelPreferenceSource,
  } = sourceState;
  const { selection } = pageUiState;
  const activeSessionAgentOptionIds = useMemo(
    () => workspaceState.presentation.sidebarAgentOptions.map((agent) => agent.id),
    [workspaceState.presentation.sidebarAgentOptions],
  );
  const runtimeSynchronization: UseChatRuntimeSynchronizationInput = {
    activeInstanceId: instanceSource.activeInstanceId,
    routeMode: workspaceState.runtime.routeMode,
    syncState: workspaceState.runtime.syncState,
    hasActiveModel: Boolean(workspaceState.interaction.activeModel),
    activeChannelId: modelPreferenceSource.activeChannelId,
    activeModelId: modelPreferenceSource.activeModelId,
    activeChannel: workspaceState.interaction.activeChannel,
    activeModel: workspaceState.interaction.activeModel,
    channels: workspaceState.interaction.channels,
    sessionSelectedModelId: workspaceState.session.sessionSelectedModelId,
    newSessionModelMode: workspaceState.runtime.newSessionModelMode,
    preferredModelId: workspaceState.catalog.modelCatalog?.preferredModelId ?? null,
    catalogChannels: workspaceState.catalog.catalogChannels,
    effectiveGatewayAgentId: workspaceState.runtime.effectiveGatewayAgentId,
    activeSessionAgentId: workspaceState.session.displaySessionAgentId,
    sendMode: workspaceState.runtime.sendMode,
    supportsSessionScopeSync: workspaceState.runtime.supportsSessionScopeSync,
    activeSessionId: workspaceState.runtime.activeSessionId,
    effectiveActiveSessionId: workspaceState.session.displaySessionId,
    selectableInstanceSessions: workspaceState.session.selectableInstanceSessions,
    newSessionModel: workspaceState.interaction.newSessionModel,
    selectedAgentId: selection.selectedAgentId,
    selectedSkillId: selection.selectedSkillId,
    isSelectionTransitionPending: selection.selectionTransition !== null,
    hasResolvedVisibleAgents: workspaceState.runtime.hasResolvedVisibleAgents,
    visibleAgentIds: workspaceState.runtime.visibleAgentIds ?? [],
    isChatSupportedRoute: workspaceState.runtime.isChatSupportedRoute,
    hydrateInstance: runtimeSource.hydrateInstance,
    setActiveChannel: modelPreferenceSource.setActiveChannel,
    setActiveModel: modelPreferenceSource.setActiveModel,
    createSession: runtimeSource.createSession,
    setActiveSession: runtimeSource.setActiveSession,
    setSelectedAgentId: selection.setSelectedAgentId,
    setSelectedSkillId: selection.setSelectedSkillId,
  };
  const activeSessionSelectionSynchronization: UseChatActiveSessionSelectionSynchronizationInput = {
    isChatSupportedRoute: workspaceState.runtime.isChatSupportedRoute,
    isSelectionTransitionPending: selection.selectionTransition !== null,
    activeSession: workspaceState.session.displaySession,
    selectedAgentId: selection.selectedAgentId,
    agentOptionIds: activeSessionAgentOptionIds,
    setSelectedAgentId: selection.setSelectedAgentId,
  };

  useChatRuntimeSynchronization(runtimeSynchronization);
  useChatActiveSessionSelectionSynchronization(activeSessionSelectionSynchronization);
}
