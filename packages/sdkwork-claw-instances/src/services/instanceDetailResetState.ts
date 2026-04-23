import { createInstanceWorkbenchHydrationResetState } from './instanceWorkbenchHydration.ts';
import { createOpenClawAgentWorkspaceResetState } from './openClawAgentPresentation.ts';
import {
  createOpenClawConfigResetState,
} from './openClawConfigDrafts.ts';
import {
  createOpenClawProviderWorkspaceResetState,
  type OpenClawProviderDialogResetDrafts,
} from './openClawProviderPresentation.ts';

type Setter<T> = (value: T) => void;

type WorkbenchHydrationResetState = ReturnType<typeof createInstanceWorkbenchHydrationResetState>;
type ConfigResetState = ReturnType<typeof createOpenClawConfigResetState>;
type AgentWorkspaceResetState = ReturnType<typeof createOpenClawAgentWorkspaceResetState>;

export interface ApplyInstanceDetailInstanceSwitchResetStateInput {
  providerDialogResetDrafts: OpenClawProviderDialogResetDrafts;
  setIsWorkbenchFilesLoading: Setter<WorkbenchHydrationResetState['isFilesLoading']>;
  setIsWorkbenchMemoryLoading: Setter<WorkbenchHydrationResetState['isMemoryLoading']>;
  setIsProviderDialogOpen: Setter<boolean>;
  setProviderDialogDraft: Setter<OpenClawProviderDialogResetDrafts['providerDialogDraft']>;
  setProviderRequestDrafts: Setter<Record<string, string>>;
  setIsProviderModelDialogOpen: Setter<boolean>;
  setProviderModelDialogDraft: Setter<OpenClawProviderDialogResetDrafts['providerModelDialogDraft']>;
  setProviderModelDeleteId: Setter<string | null>;
  setProviderDeleteId: Setter<string | null>;
  setSelectedWebSearchProviderId: Setter<ConfigResetState['webSearch']['selectedProviderId']>;
  setWebSearchSharedDraft: Setter<ConfigResetState['webSearch']['sharedDraft']>;
  setWebSearchProviderDrafts: Setter<ConfigResetState['webSearch']['providerDrafts']>;
  setWebSearchError: Setter<ConfigResetState['webSearch']['error']>;
  setIsSavingWebSearch: Setter<ConfigResetState['webSearch']['isSaving']>;
  setXSearchDraft: Setter<ConfigResetState['xSearch']['draft']>;
  setXSearchError: Setter<ConfigResetState['xSearch']['error']>;
  setIsSavingXSearch: Setter<ConfigResetState['xSearch']['isSaving']>;
  setWebSearchNativeCodexDraft: Setter<ConfigResetState['webSearchNativeCodex']['draft']>;
  setWebSearchNativeCodexError: Setter<ConfigResetState['webSearchNativeCodex']['error']>;
  setIsSavingWebSearchNativeCodex: Setter<ConfigResetState['webSearchNativeCodex']['isSaving']>;
  setWebFetchSharedDraft: Setter<ConfigResetState['webFetch']['sharedDraft']>;
  setWebFetchFallbackDraft: Setter<ConfigResetState['webFetch']['fallbackDraft']>;
  setWebFetchError: Setter<ConfigResetState['webFetch']['error']>;
  setIsSavingWebFetch: Setter<ConfigResetState['webFetch']['isSaving']>;
  setAuthCooldownsDraft: Setter<ConfigResetState['authCooldowns']['draft']>;
  setAuthCooldownsError: Setter<ConfigResetState['authCooldowns']['error']>;
  setIsSavingAuthCooldowns: Setter<ConfigResetState['authCooldowns']['isSaving']>;
  setDreamingDraft: Setter<ConfigResetState['dreaming']['draft']>;
  setDreamingError: Setter<ConfigResetState['dreaming']['error']>;
  setIsSavingDreaming: Setter<ConfigResetState['dreaming']['isSaving']>;
  setIsAgentCreationWorkflowOpen: Setter<AgentWorkspaceResetState['isCreationWorkflowOpen']>;
  setIsAgentDialogOpen: Setter<AgentWorkspaceResetState['isDialogOpen']>;
  setSelectedAgentId: Setter<AgentWorkspaceResetState['selectedAgentId']>;
  setSelectedAgentWorkbench: Setter<AgentWorkspaceResetState['selectedAgentWorkbench']>;
  setAgentWorkbenchError: Setter<AgentWorkspaceResetState['workbenchError']>;
  setIsAgentWorkbenchLoading: Setter<AgentWorkspaceResetState['isWorkbenchLoading']>;
  setAgentDialogDraft: Setter<AgentWorkspaceResetState['dialogState']['draft']>;
  setEditingAgentId: Setter<AgentWorkspaceResetState['dialogState']['editingAgentId']>;
  setAgentDeleteId: Setter<AgentWorkspaceResetState['deleteId']>;
  setIsInstallingAgentSkill: Setter<AgentWorkspaceResetState['isInstallingSkill']>;
  setUpdatingAgentSkillKeys: Setter<AgentWorkspaceResetState['updatingSkillKeys']>;
  setRemovingAgentSkillKeys: Setter<AgentWorkspaceResetState['removingSkillKeys']>;
}

export function applyInstanceDetailInstanceSwitchResetState(
  args: ApplyInstanceDetailInstanceSwitchResetStateInput,
) {
  const providerDialogResetDrafts = args.providerDialogResetDrafts;
  const providerWorkspaceResetState =
    createOpenClawProviderWorkspaceResetState(providerDialogResetDrafts);
  const configResetState = createOpenClawConfigResetState();
  const agentWorkspaceResetState = createOpenClawAgentWorkspaceResetState();
  const workbenchHydrationResetState = createInstanceWorkbenchHydrationResetState();

  args.setIsWorkbenchFilesLoading(workbenchHydrationResetState.isFilesLoading);
  args.setIsWorkbenchMemoryLoading(workbenchHydrationResetState.isMemoryLoading);
  args.setIsProviderDialogOpen(providerWorkspaceResetState.isProviderDialogOpen);
  args.setProviderDialogDraft(providerWorkspaceResetState.providerDialogDraft);
  args.setProviderRequestDrafts(providerWorkspaceResetState.providerRequestDrafts);
  args.setIsProviderModelDialogOpen(providerWorkspaceResetState.isProviderModelDialogOpen);
  args.setProviderModelDialogDraft(providerWorkspaceResetState.providerModelDialogDraft);
  args.setProviderModelDeleteId(providerWorkspaceResetState.providerModelDeleteId);
  args.setProviderDeleteId(providerWorkspaceResetState.providerDeleteId);
  args.setSelectedWebSearchProviderId(configResetState.webSearch.selectedProviderId);
  args.setWebSearchSharedDraft(configResetState.webSearch.sharedDraft);
  args.setWebSearchProviderDrafts(configResetState.webSearch.providerDrafts);
  args.setWebSearchError(configResetState.webSearch.error);
  args.setIsSavingWebSearch(configResetState.webSearch.isSaving);
  args.setXSearchDraft(configResetState.xSearch.draft);
  args.setXSearchError(configResetState.xSearch.error);
  args.setIsSavingXSearch(configResetState.xSearch.isSaving);
  args.setWebSearchNativeCodexDraft(configResetState.webSearchNativeCodex.draft);
  args.setWebSearchNativeCodexError(configResetState.webSearchNativeCodex.error);
  args.setIsSavingWebSearchNativeCodex(configResetState.webSearchNativeCodex.isSaving);
  args.setWebFetchSharedDraft(configResetState.webFetch.sharedDraft);
  args.setWebFetchFallbackDraft(configResetState.webFetch.fallbackDraft);
  args.setWebFetchError(configResetState.webFetch.error);
  args.setIsSavingWebFetch(configResetState.webFetch.isSaving);
  args.setAuthCooldownsDraft(configResetState.authCooldowns.draft);
  args.setAuthCooldownsError(configResetState.authCooldowns.error);
  args.setIsSavingAuthCooldowns(configResetState.authCooldowns.isSaving);
  args.setDreamingDraft(configResetState.dreaming.draft);
  args.setDreamingError(configResetState.dreaming.error);
  args.setIsSavingDreaming(configResetState.dreaming.isSaving);
  args.setIsAgentCreationWorkflowOpen(agentWorkspaceResetState.isCreationWorkflowOpen);
  args.setIsAgentDialogOpen(agentWorkspaceResetState.isDialogOpen);
  args.setSelectedAgentId(agentWorkspaceResetState.selectedAgentId);
  args.setSelectedAgentWorkbench(agentWorkspaceResetState.selectedAgentWorkbench);
  args.setAgentWorkbenchError(agentWorkspaceResetState.workbenchError);
  args.setIsAgentWorkbenchLoading(agentWorkspaceResetState.isWorkbenchLoading);
  args.setAgentDialogDraft(agentWorkspaceResetState.dialogState.draft);
  args.setEditingAgentId(agentWorkspaceResetState.dialogState.editingAgentId);
  args.setAgentDeleteId(agentWorkspaceResetState.deleteId);
  args.setIsInstallingAgentSkill(agentWorkspaceResetState.isInstallingSkill);
  args.setUpdatingAgentSkillKeys(agentWorkspaceResetState.updatingSkillKeys);
  args.setRemovingAgentSkillKeys(agentWorkspaceResetState.removingSkillKeys);
}
