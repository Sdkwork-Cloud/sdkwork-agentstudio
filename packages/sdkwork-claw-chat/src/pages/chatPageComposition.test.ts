import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const pageSource = readFileSync(new URL('./Chat.tsx', import.meta.url), 'utf8');
let pageCompositionHookSource = '';
try {
  pageCompositionHookSource = readFileSync(
    new URL('./useChatPageCompositionState.ts', import.meta.url),
    'utf8',
  );
} catch {
  pageCompositionHookSource = '';
}
const pageOrchestrationSource = pageCompositionHookSource || pageSource;
let workspaceStateHookSource = '';
try {
  workspaceStateHookSource = readFileSync(
    new URL('./useChatPageWorkspaceState.ts', import.meta.url),
    'utf8',
  );
} catch {
  workspaceStateHookSource = '';
}
let presentationPropsStateHookSource = '';
try {
  presentationPropsStateHookSource = readFileSync(
    new URL('./useChatPagePresentationPropsState.ts', import.meta.url),
    'utf8',
  );
} catch {
  presentationPropsStateHookSource = '';
}
let sourceStateHookSource = '';
try {
  sourceStateHookSource = readFileSync(
    new URL('./useChatPageSourceState.ts', import.meta.url),
    'utf8',
  );
} catch {
  sourceStateHookSource = '';
}
let runtimeSourceHookSource = '';
try {
  runtimeSourceHookSource = readFileSync(
    new URL('./useChatRuntimeSourceState.ts', import.meta.url),
    'utf8',
  );
} catch {
  runtimeSourceHookSource = '';
}
let uiStateHookSource = '';
try {
  uiStateHookSource = readFileSync(
    new URL('./useChatPageUiState.ts', import.meta.url),
    'utf8',
  );
} catch {
  uiStateHookSource = '';
}
let autoScrollHookSource = '';
try {
  autoScrollHookSource = readFileSync(new URL('./useChatAutoScroll.ts', import.meta.url), 'utf8');
} catch {
  autoScrollHookSource = '';
}
let runtimeSynchronizationHookSource = '';
try {
  runtimeSynchronizationHookSource = readFileSync(
    new URL('./useChatRuntimeSynchronization.ts', import.meta.url),
    'utf8',
  );
} catch {
  runtimeSynchronizationHookSource = '';
}
let contextSelectionSynchronizationHookSource = '';
try {
  contextSelectionSynchronizationHookSource = readFileSync(
    new URL('./useChatContextSelectionSynchronization.ts', import.meta.url),
    'utf8',
  );
} catch {
  contextSelectionSynchronizationHookSource = '';
}
let instanceHydrationSynchronizationHookSource = '';
try {
  instanceHydrationSynchronizationHookSource = readFileSync(
    new URL('./useChatInstanceHydrationSynchronization.ts', import.meta.url),
    'utf8',
  );
} catch {
  instanceHydrationSynchronizationHookSource = '';
}
let catalogSynchronizationHookSource = '';
try {
  catalogSynchronizationHookSource = readFileSync(
    new URL('./useChatCatalogSynchronization.ts', import.meta.url),
    'utf8',
  );
} catch {
  catalogSynchronizationHookSource = '';
}
let bootstrapSynchronizationHookSource = '';
try {
  bootstrapSynchronizationHookSource = readFileSync(
    new URL('./useChatBootstrapSynchronization.ts', import.meta.url),
    'utf8',
  );
} catch {
  bootstrapSynchronizationHookSource = '';
}
let visibleSessionSynchronizationHookSource = '';
try {
  visibleSessionSynchronizationHookSource = readFileSync(
    new URL('./useChatVisibleSessionSynchronization.ts', import.meta.url),
    'utf8',
  );
} catch {
  visibleSessionSynchronizationHookSource = '';
}
let sessionControlHookSource = '';
try {
  sessionControlHookSource = readFileSync(
    new URL('./useChatSessionControlState.ts', import.meta.url),
    'utf8',
  );
} catch {
  sessionControlHookSource = '';
}
let sessionControlCapabilityHookSource = '';
try {
  sessionControlCapabilityHookSource = readFileSync(
    new URL('./useChatSessionControlCapabilityState.ts', import.meta.url),
    'utf8',
  );
} catch {
  sessionControlCapabilityHookSource = '';
}
let sessionControlOptionsHookSource = '';
try {
  sessionControlOptionsHookSource = readFileSync(
    new URL('./useChatSessionControlOptionsState.ts', import.meta.url),
    'utf8',
  );
} catch {
  sessionControlOptionsHookSource = '';
}
let contextCatalogHookSource = '';
try {
  contextCatalogHookSource = readFileSync(
    new URL('./useChatContextCatalogState.ts', import.meta.url),
    'utf8',
  );
} catch {
  contextCatalogHookSource = '';
}
let agentCatalogStateHookSource = '';
try {
  agentCatalogStateHookSource = readFileSync(
    new URL('./useChatAgentCatalogState.ts', import.meta.url),
    'utf8',
  );
} catch {
  agentCatalogStateHookSource = '';
}
let skillCatalogStateHookSource = '';
try {
  skillCatalogStateHookSource = readFileSync(
    new URL('./useChatSkillCatalogState.ts', import.meta.url),
    'utf8',
  );
} catch {
  skillCatalogStateHookSource = '';
}
let contentPaneSource = '';
try {
  contentPaneSource = readFileSync(
    new URL('../components/ChatConversationPane.tsx', import.meta.url),
    'utf8',
  );
} catch {
  contentPaneSource = '';
}
let sidebarChromeSource = '';
try {
  sidebarChromeSource = readFileSync(
    new URL('../components/ChatSidebarChrome.tsx', import.meta.url),
    'utf8',
  );
} catch {
  sidebarChromeSource = '';
}
let presentationHookSource = '';
try {
  presentationHookSource = readFileSync(
    new URL('./useChatPresentationState.ts', import.meta.url),
    'utf8',
  );
} catch {
  presentationHookSource = '';
}
let presentationNavigationHookSource = '';
try {
  presentationNavigationHookSource = readFileSync(
    new URL('./useChatPresentationNavigation.ts', import.meta.url),
    'utf8',
  );
} catch {
  presentationNavigationHookSource = '';
}
let compactModelPreferenceHookSource = '';
try {
  compactModelPreferenceHookSource = readFileSync(
    new URL('./useChatCompactModelPreference.ts', import.meta.url),
    'utf8',
  );
} catch {
  compactModelPreferenceHookSource = '';
}
let conversationPanePresentationHookSource = '';
try {
  conversationPanePresentationHookSource = readFileSync(
    new URL('./useChatConversationPanePresentationState.ts', import.meta.url),
    'utf8',
  );
} catch {
  conversationPanePresentationHookSource = '';
}
let sessionContextDrawerPresentationHookSource = '';
try {
  sessionContextDrawerPresentationHookSource = readFileSync(
    new URL('./useChatSessionContextDrawerPresentationState.ts', import.meta.url),
    'utf8',
  );
} catch {
  sessionContextDrawerPresentationHookSource = '';
}
let sidebarHookSource = '';
try {
  sidebarHookSource = readFileSync(
    new URL('./useChatSidebarState.ts', import.meta.url),
    'utf8',
  );
} catch {
  sidebarHookSource = '';
}
let sessionViewHookSource = '';
try {
  sessionViewHookSource = readFileSync(
    new URL('./useChatSessionViewState.ts', import.meta.url),
    'utf8',
  );
} catch {
  sessionViewHookSource = '';
}
let headerStateHookSource = '';
try {
  headerStateHookSource = readFileSync(
    new URL('./useChatHeaderState.ts', import.meta.url),
    'utf8',
  );
} catch {
  headerStateHookSource = '';
}
let chatRunBindingSource = '';
try {
  chatRunBindingSource = readFileSync(
    new URL('../services/chatRunBinding.ts', import.meta.url),
    'utf8',
  );
} catch {
  chatRunBindingSource = '';
}
let pageRuntimeHookSource = '';
try {
  pageRuntimeHookSource = readFileSync(
    new URL('./useChatPageRuntimeState.ts', import.meta.url),
    'utf8',
  );
} catch {
  pageRuntimeHookSource = '';
}
let modelCatalogHookSource = '';
try {
  modelCatalogHookSource = readFileSync(
    new URL('./useChatModelCatalogState.ts', import.meta.url),
    'utf8',
  );
} catch {
  modelCatalogHookSource = '';
}
let interactionHookSource = '';
try {
  interactionHookSource = readFileSync(
    new URL('./useChatInteractionState.ts', import.meta.url),
    'utf8',
  );
} catch {
  interactionHookSource = '';
}
let interactionModelStateHookSource = '';
try {
  interactionModelStateHookSource = readFileSync(
    new URL('./useChatInteractionModelState.ts', import.meta.url),
    'utf8',
  );
} catch {
  interactionModelStateHookSource = '';
}
let pageModelSelectionHookSource = '';
try {
  pageModelSelectionHookSource = readFileSync(
    new URL('./useChatPageModelSelectionState.ts', import.meta.url),
    'utf8',
  );
} catch {
  pageModelSelectionHookSource = '';
}
let sendExecutionStateHookSource = '';
try {
  sendExecutionStateHookSource = readFileSync(
    new URL('./useChatSendExecutionState.ts', import.meta.url),
    'utf8',
  );
} catch {
  sendExecutionStateHookSource = '';
}
let activeSessionProjectionHookSource = '';
try {
  activeSessionProjectionHookSource = readFileSync(
    new URL('./useChatActiveSessionProjectionState.ts', import.meta.url),
    'utf8',
  );
} catch {
  activeSessionProjectionHookSource = '';
}
let messageDisplayStateHookSource = '';
try {
  messageDisplayStateHookSource = readFileSync(
    new URL('./useChatMessageDisplayState.ts', import.meta.url),
    'utf8',
  );
} catch {
  messageDisplayStateHookSource = '';
}
let pageContractsSource = '';
try {
  pageContractsSource = readFileSync(
    new URL('./chatPageContracts.ts', import.meta.url),
    'utf8',
  );
} catch {
  pageContractsSource = '';
}

await runTest(
  'Chat page delegates top-level page orchestration to a dedicated composition hook',
  () => {
    assert.match(
      pageSource,
      /import \{ useChatPageCompositionState \} from '\.\/useChatPageCompositionState';/,
    );
    assert.match(pageSource, /const \{ t, i18n \} = useTranslation\(\);/);
    assert.match(
      pageSource,
      /const\s*\{\s*sidebarChromeProps,\s*conversationPaneProps,\s*sessionContextDrawerProps,\s*\}\s*=\s*useChatPageCompositionState\(\{\s*t,\s*language:\s*i18n\.language,\s*\}\);/s,
    );
    assert.match(pageSource, /<ChatSidebarChrome \{\.\.\.sidebarChromeProps\} \/>/);
    assert.match(pageSource, /<ChatConversationPane \{\.\.\.conversationPaneProps\} \/>/);
    assert.match(pageSource, /<ChatSessionContextDrawer \{\.\.\.sessionContextDrawerProps\} \/>/);
    assert.doesNotMatch(pageSource, /import \{ useChatAutoScroll \} from '\.\/useChatAutoScroll';/);
    assert.doesNotMatch(
      pageSource,
      /import \{ useChatContextCatalogState \} from '\.\/useChatContextCatalogState';/,
    );
    assert.doesNotMatch(pageSource, /import \{ useChatHeaderState \} from '\.\/useChatHeaderState';/);
    assert.doesNotMatch(
      pageSource,
      /import \{ useChatInteractionState \} from '\.\/useChatInteractionState';/,
    );
    assert.doesNotMatch(
      pageSource,
      /import \{ useChatModelCatalogState \} from '\.\/useChatModelCatalogState';/,
    );
    assert.doesNotMatch(
      pageSource,
      /import \{ useChatPageRuntimeState \} from '\.\/useChatPageRuntimeState';/,
    );
    assert.doesNotMatch(
      pageSource,
      /import \{ useChatPageSourceState \} from '\.\/useChatPageSourceState';/,
    );
    assert.doesNotMatch(pageSource, /import \{ useChatPageUiState \} from '\.\/useChatPageUiState';/);
    assert.doesNotMatch(
      pageSource,
      /import \{ useChatPresentationState \} from '\.\/useChatPresentationState';/,
    );
    assert.doesNotMatch(pageSource, /import \{ useChatSidebarState \} from '\.\/useChatSidebarState';/);
    assert.doesNotMatch(
      pageSource,
      /import \{ useChatSessionViewState \} from '\.\/useChatSessionViewState';/,
    );
    assert.doesNotMatch(
      pageSource,
      /import \{ useChatRuntimeSynchronization \} from '\.\/useChatRuntimeSynchronization';/,
    );
    assert.match(pageCompositionHookSource, /export function useChatPageCompositionState/);
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatPagePresentationPropsState \} from '\.\/useChatPagePresentationPropsState';/,
    );
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatPageSourceState \} from '\.\/useChatPageSourceState';/,
    );
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatPageSynchronizationState \} from '\.\/useChatPageSynchronizationState';/,
    );
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatPageUiState \} from '\.\/useChatPageUiState';/,
    );
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatPageWorkspaceState \} from '\.\/useChatPageWorkspaceState';/,
    );
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatSidebarState \} from '\.\/useChatSidebarState';/,
    );
    assert.doesNotMatch(pageCompositionHookSource, /import \{ useChatAutoScroll \} from '\.\/useChatAutoScroll';/);
    assert.doesNotMatch(pageCompositionHookSource, /import \{ useChatContextCatalogState \} from '\.\/useChatContextCatalogState';/);
    assert.doesNotMatch(pageCompositionHookSource, /import \{ useChatHeaderState \} from '\.\/useChatHeaderState';/);
    assert.doesNotMatch(pageCompositionHookSource, /import \{ useChatInteractionState \} from '\.\/useChatInteractionState';/);
    assert.doesNotMatch(pageCompositionHookSource, /import \{ useChatModelCatalogState \} from '\.\/useChatModelCatalogState';/);
    assert.doesNotMatch(pageCompositionHookSource, /import \{ useChatPageRuntimeState \} from '\.\/useChatPageRuntimeState';/);
    assert.doesNotMatch(pageCompositionHookSource, /import \{ useChatPresentationState \} from '\.\/useChatPresentationState';/);
    assert.doesNotMatch(pageCompositionHookSource, /import \{ useChatSessionViewState \} from '\.\/useChatSessionViewState';/);
    assert.doesNotMatch(pageCompositionHookSource, /import \{ useChatRuntimeSynchronization \} from '\.\/useChatRuntimeSynchronization';/);
    assert.match(pageCompositionHookSource, /useChatPageSynchronizationState\(\{/);
    assert.match(
      pageCompositionHookSource,
      /return \{\s*sidebarChromeProps:\s*\{[\s\S]*conversationPaneProps,[\s\S]*sessionContextDrawerProps,\s*\};/s,
    );
  },
);

await runTest(
  'Chat page shares page-layer runtime contracts through a dedicated contract module',
  () => {
    assert.match(
      pageContractsSource,
      /export type ChatPageTranslate = \(key: string, options\?: Record<string, unknown>\) => string;/,
    );
    assert.match(pageContractsSource, /export type ChatPageSendMode = 'local' \| 'gateway';/);
    assert.match(
      pageContractsSource,
      /export type ChatPageNewSessionModelMode = 'modelName' \| 'modelId';/,
    );
    assert.match(
      pageContractsSource,
      /export type ChatPageAgentCatalogMode = 'sharedCatalog' \| 'kernelCatalog';/,
    );
    assert.match(
      pageContractsSource,
      /export type ChatPageSessionScopeMode = 'all' \| 'agentBound';/,
    );
    assert.match(pageContractsSource, /export type ChatPageKernelSessionState = \{/);
    assert.match(pageContractsSource, /authorityKind\?: KernelChatAuthorityKind \| null;/);
    assert.doesNotMatch(pageContractsSource, /activeRunId\?: string \| null;/);
    assert.match(
      pageContractsSource,
      /export type ChatPageRuntimeAdapterCapabilities = KernelChatAdapterCapabilities \| null;/,
    );
    assert.match(pageContractsSource, /export type ChatPageSessionControlOption = \{/);
    assert.match(pageContractsSource, /export type ChatPageSyncState = SyncState;/);
    assert.match(
      pageContractsSource,
      /export type ChatPageSelectableSessionRef = Pick<ChatSession, 'id'>;/,
    );
    assert.match(pageContractsSource, /export type ChatPageSessionControlActions = \{/);
    assert.doesNotMatch(pageContractsSource, /export type ChatPageRunBinding = Pick<ChatRunBinding,/);
    assert.match(chatRunBindingSource, /export type ChatRunStateBinding = Pick<ChatRunBinding,/);
    assert.match(
      pageContractsSource,
      /onSelectThinkingLevel\?: \(thinkingLevel: string \| null\) => void;/,
    );
    assert.match(
      pageContractsSource,
      /onSelectFastMode\?: \(fastMode: string \| null\) => void;/,
    );
    assert.match(
      pageContractsSource,
      /onSelectVerboseLevel\?: \(verboseLevel: string \| null\) => void;/,
    );
    assert.match(
      pageContractsSource,
      /onSelectReasoningLevel\?: \(reasoningLevel: string \| null\) => void;/,
    );
    assert.match(
      interactionHookSource,
      /import type \{[\s\S]*ChatPageKernelSessionState,[\s\S]*ChatPageNewSessionModelMode,[\s\S]*ChatPageSendMode,[\s\S]*ChatPageSessionScopeMode,[\s\S]*ChatPageTranslate,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      interactionHookSource,
      /import[\s\S]*type ChatRunStateBinding[\s\S]*from '\.\.\/services';/s,
    );
    assert.match(
      interactionModelStateHookSource,
      /import type \{[\s\S]*ChatPageKernelSessionState,[\s\S]*ChatPageNewSessionModelMode,[\s\S]*ChatPageTranslate,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      sendExecutionStateHookSource,
      /import[\s\S]*type ChatRunStateBinding[\s\S]*from '\.\.\/services';/s,
    );
    assert.match(
      sendExecutionStateHookSource,
      /import type \{[\s\S]*ChatPageSendMode,[\s\S]*ChatPageSessionScopeMode,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /import type \{[\s\S]*ChatPageKernelSessionState,[\s\S]*ChatPageSendMode,[\s\S]*ChatPageSessionScopeMode,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      sessionViewHookSource,
      /import type \{[\s\S]*ChatPageSendMode,[\s\S]*ChatPageSessionScopeMode,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      sidebarHookSource,
      /import type \{[\s\S]*ChatPageSessionScopeMode,[\s\S]*ChatPageTranslate,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      headerStateHookSource,
      /import type \{[\s\S]*ChatPageSendMode,[\s\S]*ChatPageTranslate,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      sessionControlHookSource,
      /import type \{[\s\S]*ChatPageKernelSessionState,[\s\S]*ChatPageRuntimeAdapterCapabilities,[\s\S]*ChatPageSessionControlOption,[\s\S]*ChatPageTranslate,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /import type \{[\s\S]*ChatPageKernelSessionState,[\s\S]*ChatPageRuntimeAdapterCapabilities,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      sessionControlOptionsHookSource,
      /import type \{[\s\S]*ChatPageSessionControlOption,[\s\S]*ChatPageTranslate,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      contextCatalogHookSource,
      /import type \{[\s\S]*ChatPageAgentCatalogMode,[\s\S]*ChatPageTranslate[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      conversationPanePresentationHookSource,
      /import type \{[\s\S]*ChatPageTranslate[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      presentationHookSource,
      /import \{[\s\S]*type UseChatConversationPanePresentationStateInput,[\s\S]*useChatConversationPanePresentationState,[\s\S]*\} from '\.\/useChatConversationPanePresentationState';/s,
    );
    assert.match(
      catalogSynchronizationHookSource,
      /import type \{ ChatPageNewSessionModelMode \} from '\.\/chatPageContracts';/,
    );
    assert.match(
      catalogSynchronizationHookSource,
      /import(?: type)? \{[\s\S]*ChatPageModel,[\s\S]*ChatPageModelChannel,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      runtimeSynchronizationHookSource,
      /import type \{[\s\S]*ChatPageSelectableSessionRef,[\s\S]*ChatPageNewSessionModelMode,[\s\S]*ChatPageSendMode,[\s\S]*ChatPageSyncState,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      runtimeSynchronizationHookSource,
      /import(?: type)? \{[\s\S]*ChatPageModel,[\s\S]*ChatPageModelChannel,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      bootstrapSynchronizationHookSource,
      /import type \{[\s\S]*ChatPageSelectableSessionRef,[\s\S]*ChatPageSendMode,[\s\S]*ChatPageSyncState,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      presentationHookSource,
      /import \{[\s\S]*type UseChatSessionContextDrawerPresentationStateInput,[\s\S]*useChatSessionContextDrawerPresentationState,[\s\S]*\} from '\.\/useChatSessionContextDrawerPresentationState';/s,
    );
    assert.doesNotMatch(
      presentationHookSource,
      /import type \{[\s\S]*ChatPageSessionControlActions,[\s\S]*ChatPageTranslate,[\s\S]*\} from '\.\/chatPageContracts';/s,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /import type \{ ChatPageSessionControlActions \} from '\.\/chatPageContracts';/,
    );
    assert.match(
      agentCatalogStateHookSource,
      /import type \{ ChatPageAgentCatalogMode \} from '\.\/chatPageContracts';/,
    );
    assert.match(
      modelCatalogHookSource,
      /import type \{ ChatPageAgentCatalogMode \} from '\.\/chatPageContracts';/,
    );
    assert.match(
      pageModelSelectionHookSource,
      /import type \{ ChatPageNewSessionModelMode \} from '\.\/chatPageContracts';/,
    );
    assert.doesNotMatch(interactionHookSource, /^type Translate =/m);
    assert.doesNotMatch(interactionHookSource, /^type ChatSendMode =/m);
    assert.doesNotMatch(interactionHookSource, /^type ChatSessionViewMode =/m);
    assert.doesNotMatch(interactionHookSource, /^type ActiveKernelSessionState =/m);
    assert.doesNotMatch(interactionModelStateHookSource, /^type Translate =/m);
    assert.doesNotMatch(interactionModelStateHookSource, /^type ChatSendMode =/m);
    assert.doesNotMatch(interactionModelStateHookSource, /^type ActiveKernelSessionState =/m);
    assert.doesNotMatch(sendExecutionStateHookSource, /^type Translate =/m);
    assert.doesNotMatch(sendExecutionStateHookSource, /^type ChatSendMode =/m);
    assert.doesNotMatch(sendExecutionStateHookSource, /^type ChatSessionViewMode =/m);
    assert.doesNotMatch(sendExecutionStateHookSource, /^type ActiveKernelSessionState =/m);
    assert.doesNotMatch(activeSessionProjectionHookSource, /^type ChatSendMode =/m);
    assert.doesNotMatch(activeSessionProjectionHookSource, /^type ChatSessionViewMode =/m);
    assert.doesNotMatch(activeSessionProjectionHookSource, /^type ActiveKernelSessionState =/m);
    assert.doesNotMatch(sessionViewHookSource, /^type ChatSendMode =/m);
    assert.doesNotMatch(sessionViewHookSource, /^type ChatSessionViewMode =/m);
    assert.doesNotMatch(sidebarHookSource, /^type Translate =/m);
    assert.doesNotMatch(sidebarHookSource, /^type ChatSendMode =/m);
    assert.doesNotMatch(sidebarHookSource, /^type ChatSessionViewMode =/m);
    assert.doesNotMatch(headerStateHookSource, /^type Translate =/m);
    assert.doesNotMatch(headerStateHookSource, /^type ChatSendMode =/m);
    assert.doesNotMatch(sessionControlHookSource, /^type Translate =/m);
    assert.doesNotMatch(sessionControlHookSource, /^type RuntimeAdapterCapabilities =/m);
    assert.doesNotMatch(sessionControlHookSource, /^type RuntimeKernelSessionState =/m);
    assert.doesNotMatch(sessionControlHookSource, /^type SessionControlOption =/m);
    assert.doesNotMatch(sessionControlCapabilityHookSource, /^type RuntimeAdapterCapabilities =/m);
    assert.doesNotMatch(sessionControlCapabilityHookSource, /^type RuntimeKernelSessionState =/m);
    assert.doesNotMatch(sessionControlOptionsHookSource, /^type Translate =/m);
    assert.doesNotMatch(sessionControlOptionsHookSource, /^type SessionControlOption =/m);
    assert.doesNotMatch(contextCatalogHookSource, /^type Translate =/m);
    assert.doesNotMatch(conversationPanePresentationHookSource, /^type Translate =/m);
    assert.doesNotMatch(presentationHookSource, /^type Translate =/m);
    assert.doesNotMatch(catalogSynchronizationHookSource, /^type RuntimeChannel =/m);
    assert.doesNotMatch(catalogSynchronizationHookSource, /^type RuntimeModel =/m);
    assert.doesNotMatch(catalogSynchronizationHookSource, /^type RuntimeCatalogChannel =/m);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /^type RuntimeChannel =/m);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /^type RuntimeModel =/m);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /^type RuntimeCatalogChannel =/m);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /^type RuntimeSelectableSession =/m);
    assert.doesNotMatch(bootstrapSynchronizationHookSource, /^type RuntimeSelectableSession =/m);
    assert.doesNotMatch(presentationHookSource, /^type ChatSessionControlActions =/m);
    assert.doesNotMatch(
      sessionContextDrawerPresentationHookSource,
      /^type ChatSessionControlActions =/m,
    );
    assert.doesNotMatch(interactionHookSource, /newSessionModelMode: 'modelName' \| 'modelId';/);
    assert.doesNotMatch(interactionModelStateHookSource, /newSessionModelMode: 'modelName' \| 'modelId';/);
    assert.doesNotMatch(pageModelSelectionHookSource, /newSessionModelMode: 'modelName' \| 'modelId';/);
    assert.doesNotMatch(catalogSynchronizationHookSource, /newSessionModelMode: 'modelName' \| 'modelId';/);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /newSessionModelMode: 'modelName' \| 'modelId';/);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /sendMode: 'local' \| 'gateway';/);
    assert.doesNotMatch(bootstrapSynchronizationHookSource, /sendMode: 'local' \| 'gateway';/);
    assert.doesNotMatch(sessionControlHookSource, /sendMode: 'local' \| 'gateway';/);
    assert.doesNotMatch(agentCatalogStateHookSource, /agentCatalogMode: 'sharedCatalog' \| 'kernelCatalog';/);
    assert.doesNotMatch(contextCatalogHookSource, /agentCatalogMode: 'sharedCatalog' \| 'kernelCatalog';/);
    assert.doesNotMatch(modelCatalogHookSource, /agentCatalogMode: 'sharedCatalog' \| 'kernelCatalog';/);
  },
);

await runTest(
  'Chat page delegates local UI state to a dedicated hook',
  () => {
    assert.match(
      pageOrchestrationSource,
      /import \{ useChatPageUiState \} from '\.\/useChatPageUiState';/,
    );
    assert.match(
      pageOrchestrationSource,
      /const pageUiState = useChatPageUiState\(\);/,
    );
    assert.doesNotMatch(pageSource, /import \{ useState \} from 'react';/);
    assert.doesNotMatch(
      pageSource,
      /const \[isSessionContextDrawerOpen, setIsSessionContextDrawerOpen\] = useState\(false\);/,
    );
    assert.doesNotMatch(
      pageSource,
      /const \[selectedSkillId, setSelectedSkillId\] = useState<string \| null>\(null\);/,
    );
    assert.doesNotMatch(
      pageSource,
      /const \[selectedAgentId, setSelectedAgentId\] = useState<string \| null \| undefined>\(undefined\);/,
    );
    assert.match(uiStateHookSource, /export function useChatPageUiState\(\)/);
    assert.match(uiStateHookSource, /import \{ useState \} from 'react';/);
    assert.match(
      uiStateHookSource,
      /const \[isSessionContextDrawerOpen, setIsSessionContextDrawerOpen\] = useState\(false\);/,
    );
    assert.match(
      uiStateHookSource,
      /const \[selectedSkillId, setSelectedSkillId\] = useState<string \| null>\(null\);/,
    );
    assert.match(
      uiStateHookSource,
      /const \[selectedAgentId, setSelectedAgentId\] = useState<string \| null \| undefined>\(undefined\);/,
    );
  },
);

await runTest(
  'Chat page delegates instance, chat-store, and llm source wiring to a dedicated hook',
  () => {
    assert.match(
      pageOrchestrationSource,
      /import \{ useChatPageSourceState \} from '\.\/useChatPageSourceState';/,
    );
    assert.match(
      pageOrchestrationSource,
      /const sourceState = useChatPageSourceState\(\);/,
    );
    assert.doesNotMatch(pageSource, /import \{ useInstanceStore, useLLMStore \} from '@sdkwork\/claw-core';/);
    assert.doesNotMatch(pageSource, /import \{ useChatStore \} from '\.\.\/store\/useChatStore';/);
    assert.doesNotMatch(pageSource, /const \{ activeInstanceId \} = useInstanceStore\(\);/);
    assert.doesNotMatch(pageSource, /const \{ setActiveChannel, setActiveModel, getInstanceConfig \} = useLLMStore\(\);/);
    assert.doesNotMatch(pageSource, /const instanceConfig = activeInstanceId \? getInstanceConfig\(activeInstanceId\) : null;/);
    assert.doesNotMatch(pageSource, /const activeChannelId = instanceConfig\?\.activeChannelId \|\| '';/);
    assert.doesNotMatch(pageSource, /const activeModelId = instanceConfig\?\.activeModelId \|\| '';/);
    assert.match(sourceStateHookSource, /export function useChatPageSourceState\(\)/);
    assert.match(sourceStateHookSource, /import \{ useChatInstanceSourceState \} from '\.\/useChatInstanceSourceState';/);
    assert.match(sourceStateHookSource, /import \{ useChatModelPreferenceSourceState \} from '\.\/useChatModelPreferenceSourceState';/);
    assert.match(sourceStateHookSource, /import \{ useChatRuntimeSourceState \} from '\.\/useChatRuntimeSourceState';/);
    assert.match(sourceStateHookSource, /const instanceState = useChatInstanceSourceState\(\);/);
    assert.match(sourceStateHookSource, /const runtimeState = useChatRuntimeSourceState\(\);/);
    assert.match(sourceStateHookSource, /const preferenceState = useChatModelPreferenceSourceState\(\{/);
    assert.doesNotMatch(sourceStateHookSource, /useLLMStore/);
    assert.doesNotMatch(sourceStateHookSource, /instanceDirectoryService/);
    assert.doesNotMatch(sourceStateHookSource, /resolvePreferredActiveInstanceId/);
    assert.match(sourceStateHookSource, /return \{\s*instance: instanceState,\s*runtime: runtimeState,\s*modelPreference: preferenceState,\s*\};/s);
  },
);

await runTest(
  'Chat page delegates runtime synchronization to a dedicated hook',
  () => {
    assert.match(
      pageOrchestrationSource,
      /import \{ useChatPageSynchronizationState \} from '\.\/useChatPageSynchronizationState';/,
    );
    assert.match(
      pageOrchestrationSource,
      /useChatPageSynchronizationState\(\{\s*sourceState,\s*pageUiState,\s*workspaceState,\s*\}\);/s,
    );
    assert.doesNotMatch(pageSource, /const lastResolvedRouteHydrationKeyRef = useRef<string \| null>\(null\);/);
    assert.doesNotMatch(pageSource, /const lastOpenClawModelScopeRef = useRef<string \| null>\(null\);/);
    assert.match(runtimeSynchronizationHookSource, /export function useChatRuntimeSynchronization/);
    assert.match(
      runtimeSynchronizationHookSource,
      /import \{ useChatContextSelectionSynchronization \} from '\.\/useChatContextSelectionSynchronization';/,
    );
    assert.match(
      runtimeSynchronizationHookSource,
      /import \{ useChatInstanceHydrationSynchronization \} from '\.\/useChatInstanceHydrationSynchronization';/,
    );
    assert.match(
      runtimeSynchronizationHookSource,
      /import \{ useChatCatalogSynchronization \} from '\.\/useChatCatalogSynchronization';/,
    );
    assert.match(
      runtimeSynchronizationHookSource,
      /import \{ useChatBootstrapSynchronization \} from '\.\/useChatBootstrapSynchronization';/,
    );
    assert.match(
      runtimeSynchronizationHookSource,
      /import \{ useChatVisibleSessionSynchronization \} from '\.\/useChatVisibleSessionSynchronization';/,
    );
    assert.match(runtimeSynchronizationHookSource, /useChatContextSelectionSynchronization\(\{/);
    assert.match(runtimeSynchronizationHookSource, /useChatInstanceHydrationSynchronization\(\{/);
    assert.match(runtimeSynchronizationHookSource, /useChatCatalogSynchronization\(\{/);
    assert.match(runtimeSynchronizationHookSource, /useChatBootstrapSynchronization\(\{/);
    assert.match(runtimeSynchronizationHookSource, /useChatVisibleSessionSynchronization\(\{/);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /resolveChatContextSelectionSyncMutation/);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /resolveChatInstanceHydrationKey/);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /resolveChatCatalogSelectionSyncMutation/);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /resolveChatPreferredModelSyncPlan/);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /resolveChatBootstrapMutation/);
    assert.doesNotMatch(runtimeSynchronizationHookSource, /resolveChatVisibleSessionSyncMutation/);
  },
);

await runTest(
  'Chat page delegates auto-scroll state and DOM coordination to a dedicated hook',
  () => {
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatPagePresentationPropsState \} from '\.\/useChatPagePresentationPropsState';/,
    );
    assert.match(
      presentationPropsStateHookSource,
      /import \{ useChatAutoScroll \} from '\.\/useChatAutoScroll';/,
    );
    assert.match(
      presentationPropsStateHookSource,
      /const\s*\{\s*messagesScrollContainerRef,\s*showJumpToLatest,\s*handleMessageListScroll,\s*jumpToLatest,\s*\}\s*=\s*useChatAutoScroll\(\{\s*sessionId:\s*session\.displaySessionId,\s*messages:\s*session\.activeMessages,\s*isBusy:\s*interaction\.isBusy,\s*\}\);/s,
    );
    assert.doesNotMatch(pageSource, /const clearChatScrollRetry = \(\) =>/);
    assert.doesNotMatch(pageSource, /const scrollChatToLatest = \(force = false\) =>/);
    assert.doesNotMatch(pageSource, /const jumpToLatest = \(\) =>/);
    assert.doesNotMatch(
      pageSource,
      /const handleMessageListScroll = \(event: React\.UIEvent<HTMLDivElement>\) =>/,
    );
    assert.match(autoScrollHookSource, /export function useChatAutoScroll/);
    assert.match(autoScrollHookSource, /resolveChatAutoScrollDecision/);
    assert.match(autoScrollHookSource, /isChatViewportNearBottom/);
  },
);

await runTest(
  'Chat page delegates instance scope and route capability state to a dedicated hook',
  () => {
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatPageWorkspaceState \} from '\.\/useChatPageWorkspaceState';/,
    );
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatPageRuntimeState \} from '\.\/useChatPageRuntimeState';/,
    );
    assert.match(
      workspaceStateHookSource,
      /const\s*\{\s*activeSessionId,\s*syncState,\s*routeMode,\s*lastError,\s*activeAdapterCapabilities,\s*isChatSupportedRoute,\s*agentCatalogMode,\s*sessionScopeMode,\s*sendMode,\s*newSessionModelMode,\s*supportsSessionScopeSync,\s*gatewayConnectionStatus,\s*\}\s*=\s*useChatPageRuntimeState\(\{\s*activeInstanceId,\s*activeSessionIdByInstance,\s*syncStateByInstance,\s*gatewayConnectionStatusByInstance,\s*lastErrorByInstance,\s*instanceRouteModeById,\s*instanceChatAdapterCapabilitiesById,\s*\}\);/s,
    );
    assert.doesNotMatch(pageSource, /import \{[\s\S]*resolveChatRuntimeState,[\s\S]*\} from '\.\.\/services';/s);
    assert.doesNotMatch(pageSource, /function getScopeKey\(instanceId: string \| null \| undefined\)/);
    assert.doesNotMatch(pageSource, /const scopeKey = getScopeKey\(activeInstanceId\);/);
    assert.doesNotMatch(pageSource, /const adapterRuntimeState = resolveChatRuntimeState\(\{/);
    assert.doesNotMatch(pageSource, /const gatewayConnectionStatus =\s*gatewayConnectionStatusByInstance\[scopeKey\]/);
    assert.match(pageRuntimeHookSource, /export function useChatPageRuntimeState/);
    assert.match(
      pageRuntimeHookSource,
      /import \{[\s\S]*resolveChatRuntimeState,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(pageRuntimeHookSource, /function getScopeKey\(instanceId: string \| null \| undefined\)/);
    assert.match(pageRuntimeHookSource, /const scopeKey = getScopeKey\(activeInstanceId\);/);
    assert.match(
      pageRuntimeHookSource,
      /const activeAdapterCapabilities =\s*activeInstanceId \? instanceChatAdapterCapabilitiesById\[activeInstanceId\] \?\? null : null;/,
    );
    assert.match(
      pageRuntimeHookSource,
      /const adapterRuntimeState = resolveChatRuntimeState\(\{\s*activeInstanceId,\s*routeMode,\s*adapterCapabilities: activeAdapterCapabilities,\s*sessionState: null,\s*\}\);/s,
    );
    assert.match(pageRuntimeHookSource, /const isChatSupportedRoute = adapterRuntimeState\.isChatAvailable;/);
    assert.match(pageRuntimeHookSource, /const agentCatalogMode = adapterRuntimeState\.agentCatalogMode;/);
    assert.match(pageRuntimeHookSource, /const sessionScopeMode = adapterRuntimeState\.sessionScopeMode;/);
    assert.match(pageRuntimeHookSource, /const sendMode = adapterRuntimeState\.sendMode;/);
    assert.match(pageRuntimeHookSource, /const newSessionModelMode = adapterRuntimeState\.newSessionModelMode;/);
    assert.match(
      pageRuntimeHookSource,
      /const supportsSessionScopeSync = adapterRuntimeState\.supportsSessionScopeSync;/,
    );
    assert.match(
      pageRuntimeHookSource,
      /const gatewayConnectionStatus =\s*gatewayConnectionStatusByInstance\[scopeKey\] \?\? \(sendMode === 'gateway' \? 'disconnected' : null\);/s,
    );
  },
);

await runTest(
  'Chat page delegates model catalog loading to a dedicated hook',
  () => {
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatPageWorkspaceState \} from '\.\/useChatPageWorkspaceState';/,
    );
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatModelCatalogState \} from '\.\/useChatModelCatalogState';/,
    );
    assert.match(
      workspaceStateHookSource,
      /const\s*\{\s*modelCatalog,\s*modelCatalogError,\s*catalogChannels,\s*\}\s*=\s*useChatModelCatalogState\(\{\s*activeInstanceId,\s*isChatSupportedRoute,\s*effectiveGatewayAgentId,\s*agentCatalogMode,\s*\}\);/s,
    );
    assert.doesNotMatch(pageSource, /import \{ useQuery \} from '@tanstack\/react-query';/);
    assert.doesNotMatch(pageSource, /import \{[\s\S]*instanceEffectiveModelCatalogService,[\s\S]*\} from '\.\.\/services';/s);
    assert.doesNotMatch(pageSource, /queryKey: \['chat', 'instance-model-catalog', activeInstanceId, effectiveGatewayAgentId\]/);
    assert.doesNotMatch(pageSource, /return instanceEffectiveModelCatalogService\.getCatalog\(/);
    assert.match(modelCatalogHookSource, /export function useChatModelCatalogState/);
    assert.match(modelCatalogHookSource, /import \{ useQuery \} from '@tanstack\/react-query';/);
    assert.match(
      modelCatalogHookSource,
      /import \{[\s\S]*instanceEffectiveModelCatalogService,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      modelCatalogHookSource,
      /queryKey: \['chat', 'instance-model-catalog', activeInstanceId, effectiveGatewayAgentId\],/s,
    );
    assert.match(
      modelCatalogHookSource,
      /return instanceEffectiveModelCatalogService\.getCatalog\(\s*activeInstanceId,\s*agentCatalogMode === 'kernelCatalog' \? effectiveGatewayAgentId : undefined,\s*\);/s,
    );
    assert.match(
      modelCatalogHookSource,
      /const catalogChannels = isChatSupportedRoute \? modelCatalog\?\.channels \?\? \[\] : \[\];/,
    );
  },
);

await runTest(
  'Chat page resolves channel and model selection through a dedicated service',
  () => {
    assert.match(
      pageModelSelectionHookSource,
      /import \{[\s\S]*resolveChatPageModelSelection,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      pageModelSelectionHookSource,
      /const\s*\{\s*channels,\s*activeChannel,\s*activeModel\s*\}\s*=\s*resolveChatPageModelSelection\(/,
    );
    assert.doesNotMatch(pageSource, /resolveChatPageModelSelection\(/);
    assert.doesNotMatch(pageSource, /function createFallbackGatewayChannel/);
    assert.doesNotMatch(pageSource, /const preferredModelId = sessionSelectedModelId \|\| activeModelId \|\| '';/);
    assert.doesNotMatch(pageSource, /const channelFromPreferredModel = preferredModelId/);
  },
);

await runTest(
  'Chat page delegates conversation pane rendering to a dedicated component',
  () => {
    assert.match(
      pageSource,
      /import \{ ChatConversationPane \} from '\.\.\/components\/ChatConversationPane';/,
    );
    assert.match(pageSource, /<ChatConversationPane \{\.\.\.conversationPaneProps\} \/>/);
    assert.match(
      presentationPropsStateHookSource,
      /conversationPaneProps:\s*\{[\s\S]*surfaceState,[\s\S]*inlineNoticeMessage,[\s\S]*showComposer,[\s\S]*messagesScrollContainerRef,[\s\S]*onMessageListScroll:[\s\S]*messageGroups,[\s\S]*topControlsProps,[\s\S]*emptyStateProps,[\s\S]*composerPanelProps,[\s\S]*onManageInstances,[\s\S]*\}/s,
    );
    assert.doesNotMatch(pageSource, /const renderContent = \(\) => \{/);
    assert.doesNotMatch(pageSource, /import \{ ChatTopControls \} from '\.\.\/components\/ChatTopControls';/);
    assert.doesNotMatch(pageSource, /import \{ ChatComposerPanel \} from '\.\.\/components\/ChatComposerPanel';/);
    assert.doesNotMatch(pageSource, /import \{ ChatEmptyState \} from '\.\.\/components\/ChatEmptyState';/);
    assert.doesNotMatch(pageSource, /import \{ ChatMessage \} from '\.\.\/components\/ChatMessage';/);
    assert.match(contentPaneSource, /export function ChatConversationPane/);
    assert.match(contentPaneSource, /import \{ ChatTopControls \} from '\.\/ChatTopControls';/);
    assert.match(contentPaneSource, /import \{ ChatComposerPanel \} from '\.\/ChatComposerPanel';/);
    assert.match(contentPaneSource, /import \{ ChatEmptyState \} from '\.\/ChatEmptyState';/);
    assert.match(contentPaneSource, /import \{ ChatMessage \} from '\.\/ChatMessage';/);
    assert.match(contentPaneSource, /inlineNoticeMessage/);
    assert.doesNotMatch(contentPaneSource, /bannerMessage/);
    assert.match(contentPaneSource, /messageGroups\.map\(\(group\) => \{/);
    assert.match(contentPaneSource, /key=\{group\.key\}/);
    assert.match(contentPaneSource, /key=\{item\.key\}/);
  },
);

await runTest(
  'Chat page delegates sidebar drawer chrome rendering to a dedicated component',
  () => {
    assert.match(
      pageSource,
      /import \{ ChatSidebarChrome \} from '\.\.\/components\/ChatSidebarChrome';/,
    );
    assert.match(pageSource, /<ChatSidebarChrome \{\.\.\.sidebarChromeProps\} \/>/);
    assert.match(
      pageCompositionHookSource,
      /sidebarChromeProps:\s*\{[\s\S]*isSidebarOpen,[\s\S]*closeSidebar,[\s\S]*sidebarBackdropLabel,[\s\S]*desktopSidebarProps,[\s\S]*mobileSidebarProps,[\s\S]*\}/s,
    );
    assert.doesNotMatch(pageSource, /import \{ AnimatePresence, motion \} from 'motion\/react';/);
    assert.doesNotMatch(pageSource, /import \{ ChatSidebar \} from '\.\.\/components\/ChatSidebar';/);
    assert.doesNotMatch(pageSource, /<ChatSidebar \{\.\.\.desktopSidebarProps\} \/>/);
    assert.doesNotMatch(pageSource, /<ChatSidebar \{\.\.\.mobileSidebarProps\} \/>/);
    assert.doesNotMatch(pageSource, /className="fixed inset-0 z-40 bg-zinc-950\/45 backdrop-blur-sm lg:hidden"/);
    assert.doesNotMatch(pageSource, /className="fixed inset-y-0 left-0 z-50 w-\[min\(22rem,calc\(100vw-1rem\)\)\] lg:hidden"/);
    assert.match(sidebarChromeSource, /export function ChatSidebarChrome/);
    assert.match(sidebarChromeSource, /import \{ AnimatePresence, motion \} from 'motion\/react';/);
    assert.match(sidebarChromeSource, /import \{ ChatSidebar \} from '\.\/ChatSidebar';/);
    assert.match(sidebarChromeSource, /<ChatSidebar \{\.\.\.desktopSidebarProps\} \/>/);
    assert.match(sidebarChromeSource, /<ChatSidebar \{\.\.\.mobileSidebarProps\} \/>/);
    assert.match(sidebarChromeSource, /className="fixed inset-0 z-40 bg-zinc-950\/45 backdrop-blur-sm lg:hidden"/);
    assert.match(sidebarChromeSource, /className="fixed inset-y-0 left-0 z-50 w-\[min\(22rem,calc\(100vw-1rem\)\)\] lg:hidden"/);
  },
);

await runTest(
  'Chat page delegates presentation props and compact-model preference loading to a dedicated hook',
  () => {
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatPagePresentationPropsState \} from '\.\/useChatPagePresentationPropsState';/,
    );
    assert.match(
      pageCompositionHookSource,
      /const\s*\{\s*conversationPaneProps,\s*sessionContextDrawerProps,\s*\}\s*=\s*useChatPagePresentationPropsState\(\{/s,
    );
    assert.match(
      presentationPropsStateHookSource,
      /import \{ useChatPresentationState \} from '\.\/useChatPresentationState';/,
    );
    assert.match(
      presentationPropsStateHookSource,
      /const\s*\{\s*topControlsProps,\s*emptyStateProps,\s*composerPanelProps,\s*sessionContextDrawerProps,\s*onManageInstances,\s*\}\s*=\s*useChatPresentationState\(\{[\s\S]*conversationPanePresentation:[\s\S]*sessionContextPresentation:[\s\S]*\}\);/s,
    );
    assert.match(
      presentationPropsStateHookSource,
      /conversationPaneProps:\s*\{[\s\S]*topControlsProps,[\s\S]*emptyStateProps,[\s\S]*composerPanelProps,[\s\S]*onManageInstances,[\s\S]*\}/s,
    );
    assert.match(pageSource, /<ChatSessionContextDrawer \{\.\.\.sessionContextDrawerProps\} \/>/);
    assert.doesNotMatch(pageSource, /import \{ useNavigate \} from 'react-router-dom';/);
    assert.doesNotMatch(pageSource, /import \{ settingsService, useInstanceStore, useLLMStore \} from '@sdkwork\/claw-core';/);
    assert.doesNotMatch(pageSource, /const navigate = useNavigate\(\);/);
    assert.doesNotMatch(pageSource, /const appName = t\('common\.productName'\);/);
    assert.doesNotMatch(pageSource, /const suggestions = \[/);
    assert.doesNotMatch(pageSource, /const \[compactModelSelector, setCompactModelSelector\] = useState\(true\);/);
    assert.doesNotMatch(pageSource, /void settingsService\s*\.getPreferences\(\)/);
    assert.doesNotMatch(pageSource, /const handleOpenSessionSettings = \(\) => \{/);
    assert.doesNotMatch(pageSource, /const emptyStateDescription =/);
    assert.doesNotMatch(pageSource, /const emptyStateHighlights = \[/);
    assert.doesNotMatch(pageSource, /const topControlsProps = \{/);
    assert.doesNotMatch(pageSource, /const emptyStateProps = \{/);
    assert.doesNotMatch(pageSource, /const composerPanelProps = \{/);
    assert.doesNotMatch(pageSource, /const sessionContextDrawerProps = \{/);
    assert.match(presentationHookSource, /export function useChatPresentationState/);
    assert.match(
      presentationHookSource,
      /import \{ useChatPresentationNavigation \} from '\.\/useChatPresentationNavigation';/,
    );
    assert.match(
      presentationHookSource,
      /import \{ useChatCompactModelPreference \} from '\.\/useChatCompactModelPreference';/,
    );
    assert.match(
      presentationHookSource,
      /import \{[\s\S]*useChatConversationPanePresentationState,[\s\S]*\} from '\.\/useChatConversationPanePresentationState';/s,
    );
    assert.match(
      presentationHookSource,
      /import \{[\s\S]*useChatSessionContextDrawerPresentationState,[\s\S]*\} from '\.\/useChatSessionContextDrawerPresentationState';/s,
    );
    assert.match(
      presentationHookSource,
      /const\s*\{\s*handleOpenModelConfig,\s*handleOpenSessionSettings,\s*onManageInstances\s*\}\s*=/s,
    );
    assert.match(
      presentationHookSource,
      /useChatPresentationNavigation\(\{\s*setIsSessionContextDrawerOpen:\s*sessionContextPresentation\.setIsSessionContextDrawerOpen,\s*\}\)/s,
    );
    assert.match(
      presentationHookSource,
      /const compactModelSelector = useChatCompactModelPreference\(\);/,
    );
    assert.match(
      presentationHookSource,
      /const\s*\{\s*topControlsProps,\s*emptyStateProps,\s*composerPanelProps\s*\}\s*=\s*useChatConversationPanePresentationState\(\{[\s\S]*compactModelSelector,\s*handleOpenModelConfig,\s*\}\);/s,
    );
    assert.match(
      presentationHookSource,
      /const sessionContextDrawerProps = useChatSessionContextDrawerPresentationState\(\{[\s\S]*handleOpenSettings:\s*handleOpenSessionSettings,[\s\S]*\}\);/s,
    );
    assert.doesNotMatch(
      presentationHookSource,
      /import \{[\s\S]*settingsService,[\s\S]*\} from '@sdkwork\/claw-core';/s,
    );
    assert.doesNotMatch(
      presentationHookSource,
      /import \{ useNavigate \} from 'react-router-dom';/,
    );
    assert.doesNotMatch(
      presentationHookSource,
      /const \[compactModelSelector, setCompactModelSelector\] = useState\(true\);/,
    );
    assert.doesNotMatch(
      presentationHookSource,
      /const navigate = useNavigate\(\);/,
    );
    assert.doesNotMatch(
      presentationHookSource,
      /const appName = t\('common\.productName'\);/,
    );
    assert.doesNotMatch(
      presentationHookSource,
      /const suggestions = \[/,
    );
    assert.doesNotMatch(
      presentationHookSource,
      /void settingsService\s*\.getPreferences\(\)\s*\.then\(\(preferences\) => \{/s,
    );
    assert.match(presentationNavigationHookSource, /export function useChatPresentationNavigation/);
    assert.match(
      presentationNavigationHookSource,
      /import \{ useNavigate \} from 'react-router-dom';/,
    );
    assert.match(
      presentationNavigationHookSource,
      /const navigate = useNavigate\(\);/,
    );
    assert.match(
      presentationNavigationHookSource,
      /navigate\('\/settings\?tab=api'\)/,
    );
    assert.match(
      presentationNavigationHookSource,
      /const onManageInstances = \(\) => \{\s*navigate\('\/instances'\);\s*\}/s,
    );
    assert.match(
      compactModelPreferenceHookSource,
      /export function useChatCompactModelPreference\(\)/,
    );
    assert.match(
      compactModelPreferenceHookSource,
      /import \{[\s\S]*settingsService,[\s\S]*\} from '@sdkwork\/claw-core';/s,
    );
    assert.match(
      compactModelPreferenceHookSource,
      /const \[compactModelSelector, setCompactModelSelector\] = useState\(true\);/,
    );
    assert.match(
      compactModelPreferenceHookSource,
      /void settingsService\s*\.getPreferences\(\)\s*\.then\(\(preferences\) => \{/s,
    );
    assert.match(
      conversationPanePresentationHookSource,
      /export function useChatConversationPanePresentationState/,
    );
    assert.match(
      conversationPanePresentationHookSource,
      /const appName = t\('common\.productName'\);/,
    );
    assert.match(
      conversationPanePresentationHookSource,
      /const suggestions = \[\s*t\('chat\.page\.suggestions\.quantum'\),\s*t\('chat\.page\.suggestions\.python'\),\s*t\('chat\.page\.suggestions\.react'\),\s*t\('chat\.page\.suggestions\.email'\),\s*\];/s,
    );
    assert.match(
      conversationPanePresentationHookSource,
      /onOpenSidebar: openSidebar,/,
    );
    assert.doesNotMatch(
      conversationPanePresentationHookSource,
      /onOpenSidebar:\s*\(\)\s*=>\s*setIsSidebarOpen\(true\),/s,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /sessionContextDrawerProps = \{/,
    );
  },
);

await runTest(
  'Chat page delegates sidebar chrome state and sidebar prop assembly to a dedicated hook',
  () => {
    assert.match(
      pageCompositionHookSource,
      /import \{ useChatSidebarState \} from '\.\/useChatSidebarState';/,
    );
    assert.match(
      pageCompositionHookSource,
      /const\s*\{\s*isSidebarOpen,\s*closeSidebar,\s*openSidebar,\s*sidebarBackdropLabel,\s*desktopSidebarProps,\s*mobileSidebarProps,\s*\}\s*=\s*useChatSidebarState\(\{\s*t,\s*sourceState,\s*pageUiState,\s*workspaceState,\s*\}\);/s,
    );
    assert.match(pageSource, /<ChatSidebarChrome \{\.\.\.sidebarChromeProps\} \/>/);
    assert.doesNotMatch(pageSource, /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/);
    assert.doesNotMatch(
      pageSource,
      /const closeSidebar = \(\) => \{\s*setIsSidebarOpen\(false\);\s*\};/s,
    );
    assert.doesNotMatch(pageSource, /isChatSupported=\{isChatSupportedRoute\}/);
    assert.doesNotMatch(pageSource, /sessionScopeAgentId=\{effectiveGatewayAgentId\}/);
    assert.match(sidebarHookSource, /export function useChatSidebarState/);
    assert.match(
      sidebarHookSource,
      /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/,
    );
    assert.match(
      sidebarHookSource,
      /const closeSidebar = \(\) => \{\s*setIsSidebarOpen\(false\);\s*\};/s,
    );
    assert.match(
      sidebarHookSource,
      /const openSidebar = \(\) => \{\s*setIsSidebarOpen\(true\);\s*\};/s,
    );
    assert.match(sidebarHookSource, /const sharedSidebarProps = \{/);
    assert.match(sidebarHookSource, /sidebarBackdropLabel: t\('common\.close'\),/);
    assert.match(sidebarHookSource, /desktopSidebarProps: sharedSidebarProps,/);
    assert.match(
      sidebarHookSource,
      /const handleAgentSelection = async \([\s\S]*selection: ChatSidebarAgentSelection,[\s\S]*\): Promise<ChatSidebarSelectionActionResult> => \{/s,
    );
    assert.match(
      sidebarHookSource,
      /const linkedInstanceId = await resolveChatAgentLinkedInstanceId\(\{[\s\S]*agentId: selection\.agentId,[\s\S]*preferredInstanceId: currentActiveInstanceId,[\s\S]*\}\)\.catch\(\(\) => null\);/s,
    );
    assert.match(
      sidebarHookSource,
      /const plan = resolveChatSidebarAgentSelectionPlan\(\{[\s\S]*selection,[\s\S]*currentActiveInstanceId,[\s\S]*instances,[\s\S]*linkedInstanceId,[\s\S]*\}\);[\s\S]*await commitSelectionPlan\(requestId, plan\);/s,
    );
    assert.match(
      sidebarHookSource,
      /const handleSessionSelection = async \([\s\S]*selection\?: ChatSidebarSessionSelection,[\s\S]*\): Promise<ChatSidebarSelectionActionResult> => \{[\s\S]*const plan = resolveChatSidebarSessionSelectionPlan\(\{[\s\S]*selection,[\s\S]*currentActiveInstanceId,[\s\S]*\}\);[\s\S]*await commitSelectionPlan\(requestId, plan\);/s,
    );
    assert.match(
      sidebarHookSource,
      /const sharedSidebarProps = \{[\s\S]*sessionScopeAgentId: runtime\.effectiveGatewayAgentId,[\s\S]*selectedAgentId,[\s\S]*primaryAgentId: presentation\.primaryAgentId,[\s\S]*agentOptions: presentation\.sidebarAgentOptions,[\s\S]*selectionErrorMessage,[\s\S]*onDismissSelectionError: \(\) => setSelectionErrorMessage\(null\),[\s\S]*\};/s,
    );
    assert.match(sidebarHookSource, /import \{ useNavigate \} from 'react-router-dom';/);
    assert.match(sidebarHookSource, /const navigate = useNavigate\(\);/);
    assert.match(
      sidebarHookSource,
      /function buildAgentActionNavigationHref\(request: ChatSidebarAgentActionRequest\)/,
    );
    assert.match(
      sidebarHookSource,
      /const handleAgentAction = async \([\s\S]*request: ChatSidebarAgentActionRequest,[\s\S]*\): Promise<void> => \{[\s\S]*if \(request\.actionId === 'publish'\) \{[\s\S]*navigate\(buildAgentActionNavigationHref\(request\)\.publish\);[\s\S]*return;[\s\S]*\}[\s\S]*if \(request\.actionId === 'settings'\) \{[\s\S]*navigate\(buildAgentActionNavigationHref\(request\)\.settings\);[\s\S]*return;[\s\S]*\}[\s\S]*await kernelAgentSidebarActionService\.removeAgent\(\{[\s\S]*instanceId: request\.instanceId,[\s\S]*agentId: request\.agentId,[\s\S]*\}\);[\s\S]*await queryClient\.invalidateQueries\(\{[\s\S]*queryKey: \['chat', 'kernel-agent-catalog', request\.instanceId\],[\s\S]*\}\);[\s\S]*\};/s,
    );
    assert.doesNotMatch(sidebarHookSource, /handleOpenAgentLibrary/);
    assert.doesNotMatch(sidebarHookSource, /handleOpenAgentMarket/);
    assert.doesNotMatch(sidebarHookSource, /onOpenAgentLibrary:/);
    assert.doesNotMatch(sidebarHookSource, /onOpenAgentMarket:/);
    assert.doesNotMatch(sidebarHookSource, /const handleOpenMyAgents = \(\) => \{/);
    assert.doesNotMatch(sidebarHookSource, /onOpenMyAgents: handleOpenMyAgents/);
    assert.match(sidebarHookSource, /onAgentAction: handleAgentAction,/);
    assert.match(
      sidebarHookSource,
      /mobileSidebarProps: \{[\s\S]*\.\.\.sharedSidebarProps,[\s\S]*async onSelectAgent\(selection\) \{[\s\S]*const result = await handleAgentSelection\(selection\);[\s\S]*if \(result\.status === 'completed'\) \{[\s\S]*closeSidebar\(\);[\s\S]*\}[\s\S]*\},[\s\S]*async onSessionSelect\(selection\) \{[\s\S]*const result = await handleSessionSelection\(selection\);[\s\S]*if \(result\.status === 'completed'\) \{[\s\S]*closeSidebar\(\);[\s\S]*\}[\s\S]*\},[\s\S]*onClose: closeSidebar,[\s\S]*\},/s,
    );
    assert.doesNotMatch(sidebarHookSource, /<ChatSidebar /);
  },
);

await runTest(
  'Chat page delegates session projection and message display through dedicated child hooks',
  () => {
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatSessionViewState \} from '\.\/useChatSessionViewState';/,
    );
    assert.match(
      workspaceStateHookSource,
      /const\s*\{\s*workspaceMode,\s*isExplicitBlankWorkspace,\s*isDisplaySessionFallback,\s*selectableInstanceSessions,\s*selectedSession,\s*displaySessionId,\s*displaySession,\s*activeKernelSessionState,\s*activeRunBinding,\s*chatRuntimeState,\s*isUnsupportedRoute,\s*runningRunBinding,\s*sessionSelectedModelId,\s*activeMessages,\s*conversationBodyState,\s*activeMessageGroups,\s*\}\s*=\s*useChatSessionViewState\(\{\s*sessions,\s*activeInstanceId,\s*activeSessionId,\s*isChatSupportedRoute,\s*sessionScopeMode,\s*effectiveGatewayAgentId,\s*selectedAgentId,\s*routeMode,\s*activeAdapterCapabilities,\s*sendMode,\s*\}\);/s,
    );
    assert.doesNotMatch(pageSource, /const instanceSessions = sessions\.filter\(/);
    assert.doesNotMatch(
      pageSource,
      /const activeSession = selectableInstanceSessions\.find\(\s*\(session\) => session\.id === effectiveActiveSessionId,\s*\);/s,
    );
    assert.doesNotMatch(pageSource, /const activeKernelSessionState = resolveKernelChatSessionState\(activeSession\);/);
    assert.doesNotMatch(
      pageSource,
      /const chatRuntimeState = resolveChatRuntimeState\(\{\s*activeInstanceId,\s*routeMode,\s*adapterCapabilities: activeAdapterCapabilities,\s*sessionState: activeKernelSessionState,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const runningRunBinding = resolveChatRunningRunBinding\(\{\s*sendMode,\s*selectableSessions: selectableInstanceSessions,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const sessionSelectedModelId =\s*sendMode === 'gateway' && activeSession\s*\?\s*activeKernelSessionState\.model \|\| activeKernelSessionState\.defaultModel \|\| null\s*:\s*null;/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const conversationBodyState = resolveChatConversationBodyState\(\{\s*messageCount: activeMessages\.length,\s*isHistoryLoading,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const activeMessageStates = useMemo\(\s*\(\) => activeMessages\.map\(\(message\) => resolveKernelChatMessageState\(message\)\),\s*\[activeMessages\],\s*\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const activeMessageGroups = useMemo\(\s*\(\) => groupChatMessagesForDisplay\(activeMessageStates\),\s*\[activeMessageStates\],\s*\);/s,
    );
    assert.match(sessionViewHookSource, /export function useChatSessionViewState/);
    assert.match(
      sessionViewHookSource,
      /import \{ useChatActiveSessionProjectionState \} from '\.\/useChatActiveSessionProjectionState';/,
    );
    assert.match(
      sessionViewHookSource,
      /import \{ useChatMessageDisplayState \} from '\.\/useChatMessageDisplayState';/,
    );
    assert.match(
      sessionViewHookSource,
      /const\s*\{\s*workspaceMode,\s*isExplicitBlankWorkspace,\s*isDisplaySessionFallback,\s*selectableInstanceSessions,\s*selectedSession,\s*displaySessionId,\s*displaySession,\s*activeKernelSessionState,\s*activeRunBinding,\s*chatRuntimeState,\s*isUnsupportedRoute,\s*runningRunBinding,\s*sessionSelectedModelId,\s*\}\s*=\s*useChatActiveSessionProjectionState\(\{\s*sessions,\s*activeInstanceId,\s*activeSessionId,\s*isChatSupportedRoute,\s*sessionScopeMode,\s*effectiveGatewayAgentId,\s*selectedAgentId,\s*routeMode,\s*activeAdapterCapabilities,\s*sendMode,\s*\}\);/s,
    );
    assert.match(
      sessionViewHookSource,
      /const \{ activeMessages, conversationBodyState, activeMessageGroups \} =/,
    );
    assert.match(
      sessionViewHookSource,
      /useChatMessageDisplayState\(\{\s*displaySession,\s*chatRuntimeState,\s*\}\);/s,
    );
    assert.doesNotMatch(sessionViewHookSource, /const instanceSessions = sessions\.filter\(/);
    assert.doesNotMatch(sessionViewHookSource, /resolveChatSessionViewState\(/);
    assert.doesNotMatch(sessionViewHookSource, /const activeSession = useMemo\(/);
    assert.doesNotMatch(sessionViewHookSource, /resolveKernelChatSessionState\(/);
    assert.doesNotMatch(sessionViewHookSource, /resolveChatRuntimeState\(/);
    assert.doesNotMatch(sessionViewHookSource, /resolveChatRunningSessionId\(/);
    assert.doesNotMatch(sessionViewHookSource, /const sessionSelectedModelId =/);
    assert.doesNotMatch(sessionViewHookSource, /resolveChatConversationBodyState\(/);
    assert.doesNotMatch(sessionViewHookSource, /resolveKernelChatMessageState\(/);
    assert.doesNotMatch(sessionViewHookSource, /groupChatMessagesForDisplay\(/);
    assert.match(
      activeSessionProjectionHookSource,
      /export function useChatActiveSessionProjectionState/,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const instanceSessions = useMemo\(\s*\(\) =>\s*sessions\.filter\(/s,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /resolveChatWorkspaceProjection\(\{\s*sessions: instanceSessions,\s*activeSessionId,\s*isChatSupported: isChatSupportedRoute,\s*sessionScopeMode,\s*sessionScopeAgentId: effectiveGatewayAgentId,\s*selectedAgentId,\s*\}\)/s,
    );
    assert.match(activeSessionProjectionHookSource, /const workspaceProjection = useMemo\(/);
    assert.match(
      activeSessionProjectionHookSource,
      /const selectableInstanceSessions = workspaceProjection\.selectableSessions;/,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const selectedSession = workspaceProjection\.selectedSession;/,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const displaySessionId = workspaceProjection\.displaySessionId;/,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const displaySession = workspaceProjection\.displaySession;/,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const activeKernelSessionState = resolveKernelChatSessionState\(displaySession\);/,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const activeRunBinding = resolveChatRunBinding\(displaySession\);/,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const chatRuntimeState = resolveChatRuntimeState\(\{\s*activeInstanceId,\s*routeMode,\s*adapterCapabilities: activeAdapterCapabilities,\s*sessionState: activeKernelSessionState,\s*\}\);/s,
    );
    assert.match(activeSessionProjectionHookSource, /const isUnsupportedRoute = chatRuntimeState\.isBlocked;/);
    assert.match(
      activeSessionProjectionHookSource,
      /const runningRunBinding = resolveChatRunningRunBinding\(\{\s*sendMode,\s*selectableSessions: selectableInstanceSessions,\s*\}\);/s,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const sessionSelectedModelId =\s*sendMode === 'gateway' && displaySession\s*\?\s*activeKernelSessionState\.model \|\| activeKernelSessionState\.defaultModel \|\| null\s*:\s*null;/s,
    );
    assert.match(
      messageDisplayStateHookSource,
      /export function useChatMessageDisplayState/,
    );
    assert.match(
      messageDisplayStateHookSource,
      /const conversationBodyState = resolveChatConversationBodyState\(\{\s*messageCount: activeMessages\.length,\s*isHistoryLoading,\s*\}\);/s,
    );
    assert.match(
      messageDisplayStateHookSource,
      /const activeMessageStates = useMemo\(\s*\(\) => activeMessages\.map\(\(message\) => resolveKernelChatMessageState\(message\)\),\s*\[activeMessages\],\s*\);/s,
    );
    assert.match(
      messageDisplayStateHookSource,
      /const activeMessageGroups = useMemo\(\s*\(\) => groupChatMessagesForDisplay\(activeMessageStates\),\s*\[activeMessageStates\],\s*\);/s,
    );
  },
);

await runTest(
  'Chat page delegates header, error, and time formatting presentation to a dedicated hook',
  () => {
    assert.match(
      presentationPropsStateHookSource,
      /import \{ useChatHeaderState \} from '\.\/useChatHeaderState';/,
    );
    assert.match(
      presentationPropsStateHookSource,
      /const \{ headerPresentation, effectiveLastError, headerStatusLabel, sessionRouteLabel, groupTimeFormatter \} =/,
    );
    assert.match(
      presentationPropsStateHookSource,
      /useChatHeaderState\(\{/,
    );
    assert.match(
      presentationPropsStateHookSource,
      /displaySession: session\.displaySession,/,
    );
    assert.match(
      presentationPropsStateHookSource,
      /workspaceTitle: presentation\.workspaceTitle,/,
    );
    assert.match(
      presentationPropsStateHookSource,
      /routeLabelKey: session\.chatRuntimeState\.routeLabelKey,/,
    );
    assert.doesNotMatch(pageSource, /const headerPresentation = useMemo\(/);
    assert.doesNotMatch(pageSource, /const unsupportedRouteMessage =/);
    assert.doesNotMatch(pageSource, /const effectiveLastError =/);
    assert.doesNotMatch(pageSource, /const headerStatusLabel = t\(`chat\.page\.headerStatus\.\$\{headerPresentation\.status\}`\);/);
    assert.doesNotMatch(pageSource, /const sessionRouteLabel = t\(chatRuntimeState\.routeLabelKey\);/);
    assert.doesNotMatch(pageSource, /const groupTimeFormatter = useMemo\(/);
    assert.match(headerStateHookSource, /export function useChatHeaderState/);
    assert.match(headerStateHookSource, /import[\s\S]*type ChatRunStateBinding[\s\S]*from '\.\.\/services';/s);
    assert.match(headerStateHookSource, /presentChatHeader\(/);
    assert.match(headerStateHookSource, /activeRunBinding,/);
    assert.match(headerStateHookSource, /const unsupportedRouteMessage = isUnsupportedRoute/);
    assert.match(headerStateHookSource, /const effectiveLastError =/);
    assert.match(
      headerStateHookSource,
      /const headerStatusLabel = t\(`chat\.page\.headerStatus\.\$\{headerPresentation\.status\}`\);/,
    );
    assert.match(headerStateHookSource, /const sessionRouteLabel = t\(routeLabelKey\);/);
    assert.match(
      headerStateHookSource,
      /new Intl\.DateTimeFormat\(language,\s*\{\s*hour: 'numeric',\s*minute: '2-digit',\s*\}\)/s,
    );
  },
);

await runTest(
  'Chat page delegates model-selection, send-stop, and session action wiring to a dedicated hook',
  () => {
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatInteractionState \} from '\.\/useChatInteractionState';/,
    );
    assert.match(
      workspaceStateHookSource,
      /const\s*\{\s*isActiveSessionGenerating,\s*isBusy,\s*canStop,\s*channels,\s*activeChannel,\s*activeModel,\s*sessionControlActions,\s*activeThinkingLevel,\s*thinkingLevelDefaultLabel,\s*thinkingLevelOptions,\s*activeFastMode,\s*fastModeDefaultLabel,\s*fastModeOptions,\s*activeVerboseLevel,\s*verboseLevelDefaultLabel,\s*verboseLevelOptions,\s*activeReasoningLevel,\s*reasoningLevelDefaultLabel,\s*reasoningLevelOptions,\s*newSessionModel,\s*handleChannelChange,\s*handleModelChange,\s*handleSend,\s*handleStop,\s*\}\s*=\s*useChatInteractionState\(\{\s*t,\s*activeInstanceId,\s*selectedSessionId:\s*sendSessionId,\s*displaySessionId,\s*sessionControlSessionId:\s*isDisplaySessionFallback\s*\?\s*null\s*:\s*selectedSession\?\.id\s*\?\?\s*null,\s*activeKernelSessionState,\s*activeRunBinding,\s*runningRunBinding,\s*sendMode,\s*catalogChannels,\s*sessionSelectedModelId,\s*activeChannelId,\s*activeModelId,\s*routeMode,\s*isChatSupportedRoute,\s*activeAdapterCapabilities,\s*newSessionModelMode,\s*effectiveGatewayAgentId,\s*activeSkill,\s*activeAgent,\s*sessionScopeMode,\s*createSession,\s*addMessage,\s*updateMessage,\s*removeMessages,\s*flushSession,\s*sendKernelMessage,\s*abortSession,\s*setActiveChannel,\s*setActiveModel,\s*setKernelSessionModel,\s*setKernelSessionThinkingLevel,\s*setKernelSessionFastMode,\s*setKernelSessionVerboseLevel,\s*setKernelSessionReasoningLevel,\s*\}\);/s,
    );
    assert.doesNotMatch(pageSource, /const sessionRunActions = createChatSessionRunActions\(/);
    assert.doesNotMatch(pageSource, /const directRunActions = createChatLocalRunActions\(/);
    assert.doesNotMatch(pageSource, /const modelSelectionActions = createChatModelSelectionActions\(/);
    assert.doesNotMatch(pageSource, /const newSessionModel = resolveNewChatSessionModel\(/);
    assert.doesNotMatch(pageSource, /const composerSendActions = createChatComposerSendActions\(/);
    assert.doesNotMatch(pageSource, /const handleChannelChange = modelSelectionActions\.selectChannel;/);
    assert.doesNotMatch(pageSource, /const handleModelChange = modelSelectionActions\.selectModel;/);
    assert.doesNotMatch(pageSource, /const handleSend = composerSendActions\.submit;/);
    assert.doesNotMatch(pageSource, /void sessionRunActions\.stopActiveRun\(\)\.then\(/);
    assert.match(interactionHookSource, /export function useChatInteractionState/);
    assert.match(
      interactionHookSource,
      /import \{ useChatInteractionModelState \} from '\.\/useChatInteractionModelState';/,
    );
    assert.match(
      interactionHookSource,
      /import \{ useChatSendExecutionState \} from '\.\/useChatSendExecutionState';/,
    );
    assert.match(
      interactionHookSource,
      /const\s*\{\s*channels,\s*activeChannel,\s*activeModel,\s*sessionControlActions,\s*activeThinkingLevel,\s*thinkingLevelDefaultLabel,\s*thinkingLevelOptions,\s*activeFastMode,\s*fastModeDefaultLabel,\s*fastModeOptions,\s*activeVerboseLevel,\s*verboseLevelDefaultLabel,\s*verboseLevelOptions,\s*activeReasoningLevel,\s*reasoningLevelDefaultLabel,\s*reasoningLevelOptions,\s*newSessionModel,\s*handleChannelChange,\s*handleModelChange,\s*\}\s*=\s*useChatInteractionModelState\(\{/s,
    );
    assert.match(
      interactionHookSource,
      /useChatSendExecutionState\(\{/,
    );
    assert.doesNotMatch(interactionHookSource, /useState<string \| null>\(null\);/);
    assert.doesNotMatch(interactionHookSource, /useRef<AbortController \| null>/);
    assert.doesNotMatch(interactionHookSource, /resolveChatGenerationViewState\(/);
    assert.doesNotMatch(interactionHookSource, /createChatSessionRunActions\(/);
    assert.doesNotMatch(interactionHookSource, /createChatLocalRunActions\(/);
    assert.doesNotMatch(interactionHookSource, /resolveChatPageModelSelection\(/);
    assert.doesNotMatch(interactionHookSource, /createChatModelSelectionActions\(/);
    assert.doesNotMatch(interactionHookSource, /resolveNewChatSessionModel\(/);
    assert.doesNotMatch(interactionHookSource, /createChatComposerSendActions\(/);
    assert.match(interactionModelStateHookSource, /export function useChatInteractionModelState/);
    assert.match(interactionModelStateHookSource, /useChatSessionControlState\(/);
    assert.match(
      interactionModelStateHookSource,
      /import \{[\s\S]*useChatPageModelSelectionState,[\s\S]*\} from '\.\/useChatPageModelSelectionState';/s,
    );
    assert.match(
      interactionModelStateHookSource,
      /const\s*\{\s*channels,\s*activeChannel,\s*activeModel,\s*newSessionModel,\s*handleChannelChange,\s*handleModelChange,\s*\}\s*=\s*useChatPageModelSelectionState\(\{/s,
    );
    assert.doesNotMatch(interactionModelStateHookSource, /resolveChatPageModelSelection\(/);
    assert.doesNotMatch(interactionModelStateHookSource, /createChatModelSelectionActions\(/);
    assert.doesNotMatch(interactionModelStateHookSource, /resolveNewChatSessionModel\(/);
    assert.match(pageModelSelectionHookSource, /export function useChatPageModelSelectionState/);
    assert.match(pageModelSelectionHookSource, /resolveChatPageModelSelection\(/);
    assert.match(pageModelSelectionHookSource, /createChatModelSelectionActions\(/);
    assert.match(pageModelSelectionHookSource, /resolveNewChatSessionModel\(/);
    assert.match(sendExecutionStateHookSource, /export function useChatSendExecutionState/);
    assert.match(sendExecutionStateHookSource, /useState<string \| null>\(null\);/);
    assert.match(sendExecutionStateHookSource, /useRef<AbortController \| null>/);
    assert.match(sendExecutionStateHookSource, /useRef<Promise<boolean> \| null>\(null\);/);
    assert.match(sendExecutionStateHookSource, /resolveChatGenerationViewState\(/);
    assert.match(sendExecutionStateHookSource, /createChatSessionRunActions\(/);
    assert.match(sendExecutionStateHookSource, /createChatLocalRunActions\(/);
    assert.match(sendExecutionStateHookSource, /createChatComposerSendActions\(/);
    assert.match(sendExecutionStateHookSource, /inFlightSubmitRef: sendSubmitLockRef,/);
  },
);

await runTest(
  'Chat page re-hydrates the active instance when the same instance route authority changes',
  () => {
    assert.match(
      runtimeSynchronizationHookSource,
      /import \{ useChatInstanceHydrationSynchronization \} from '\.\/useChatInstanceHydrationSynchronization';/,
    );
    assert.match(
      runtimeSynchronizationHookSource,
      /useChatInstanceHydrationSynchronization\(\{\s*activeInstanceId,\s*routeMode,\s*hydrateInstance,\s*\}\);/s,
    );
    assert.match(
      instanceHydrationSynchronizationHookSource,
      /import[\s\S]*resolveChatInstanceHydrationKey[\s\S]*from '\.\.\/services';/s,
    );
    assert.match(
      instanceHydrationSynchronizationHookSource,
      /const lastResolvedRouteHydrationKeyRef = useRef<string \| null>\(null\);/,
    );
    assert.match(
      instanceHydrationSynchronizationHookSource,
      /const nextHydrationKey = resolveChatInstanceHydrationKey\(\{\s*activeInstanceId,\s*routeMode,\s*\}\);/,
    );
    assert.match(
      instanceHydrationSynchronizationHookSource,
      /if \(lastResolvedRouteHydrationKeyRef\.current === nextHydrationKey\) \{\s*return;\s*\}/,
    );
    assert.match(
      instanceHydrationSynchronizationHookSource,
      /const hadResolvedHydrationKey = lastResolvedRouteHydrationKeyRef\.current !== null;/,
    );
    assert.match(
      instanceHydrationSynchronizationHookSource,
      /lastResolvedRouteHydrationKeyRef\.current = nextHydrationKey;/,
    );
    assert.match(
      instanceHydrationSynchronizationHookSource,
      /if \(!nextHydrationKey \|\| !hadResolvedHydrationKey\) \{\s*return;\s*\}/,
    );
    assert.match(
      instanceHydrationSynchronizationHookSource,
      /void hydrateInstance\(activeInstanceId\);/,
    );
  },
);

await runTest(
  'Chat page delegates agent and skill context catalogs to a dedicated hook',
  () => {
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatContextCatalogState \} from '\.\/useChatContextCatalogState';/,
    );
    assert.match(
      workspaceStateHookSource,
      /const\s*\{\s*defaultAgentId,\s*effectiveGatewayAgentId,\s*hasResolvedVisibleAgents,\s*visibleAgentIds,\s*isAgentSelectorLoading,\s*isSkillSelectorLoading,\s*agentOptions,\s*skillOptions,\s*visibleAgents,\s*activeAgent,\s*activeSkill,\s*\}\s*=\s*useChatContextCatalogState\(\{\s*t,\s*sessions,\s*activeInstanceId,\s*activeSessionId,\s*isChatSupportedRoute,\s*agentCatalogMode,\s*isSessionContextDrawerOpen,\s*selectedAgentId,\s*selectedSkillId,\s*\}\);/s,
    );
    assert.match(contextCatalogHookSource, /export function useChatContextCatalogState/);
    assert.match(
      contextCatalogHookSource,
      /import \{ useChatAgentCatalogState \} from '\.\/useChatAgentCatalogState';/,
    );
    assert.match(
      contextCatalogHookSource,
      /import type \{ ChatSession \} from '\.\.\/store\/useChatStore';/,
    );
    assert.match(
      contextCatalogHookSource,
      /import \{[\s\S]*mergeChatCatalogAgentsWithSessionFallback,[\s\S]*resolveChatSessionBinding,[\s\S]*resolveChatSidebarKernelLabel,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      contextCatalogHookSource,
      /import \{ useChatSkillCatalogState \} from '\.\/useChatSkillCatalogState';/,
    );
    assert.match(
      contextCatalogHookSource,
      /const\s*\{\s*defaultAgentId,\s*effectiveGatewayAgentId,\s*hasResolvedVisibleAgents,\s*isAgentSelectorLoading,\s*agentDefaultDescriptionKey,\s*agentProfiles,\s*visibleAgents,\s*\}\s*=\s*useChatAgentCatalogState\(\{\s*activeInstanceId,\s*isChatSupportedRoute,\s*agentCatalogMode,\s*isSessionContextDrawerOpen,\s*selectedAgentId,\s*activeSessionAgentId,\s*\}\);/s,
    );
    assert.match(
      contextCatalogHookSource,
      /const\s*\{\s*visibleSkills,\s*isSkillSelectorLoading,\s*\}\s*=\s*useChatSkillCatalogState\(\{\s*activeInstanceId,\s*isChatSupportedRoute,\s*isSessionContextDrawerOpen,\s*selectedSkillId,\s*\}\);/s,
    );
    assert.match(
      contextCatalogHookSource,
      /const scopedSessions = useMemo\(\s*\(\) =>\s*sessions\.filter\(\(session\) =>\s*activeInstanceId\s*\?\s*session\.instanceId === activeInstanceId\s*:\s*!session\.instanceId,\s*\),\s*\[activeInstanceId, sessions\],\s*\);/s,
    );
    assert.match(
      contextCatalogHookSource,
      /const activeSessionAgentId = useMemo\(\(\) => \{[\s\S]*const activeSession =[\s\S]*scopedSessions\.find\(\(session\) => session\.id === activeSessionId\) \?\? null;[\s\S]*return resolveChatSessionBinding\(activeSession\)\.agentId;[\s\S]*\}, \[activeSessionId, scopedSessions\]\);/s,
    );
    assert.match(
      contextCatalogHookSource,
      /const mergedVisibleAgents = useMemo\(\s*\(\) =>\s*mergeChatCatalogAgentsWithSessionFallback\(\{\s*catalogAgents: visibleAgents,\s*sessions: scopedSessions,\s*\}\),\s*\[scopedSessions, visibleAgents\],\s*\);/s,
    );
    assert.match(
      contextCatalogHookSource,
      /const visibleAgentsWithKernel = useMemo\(\(\) => \{/,
    );
    assert.match(
      contextCatalogHookSource,
      /for \(const profile of agentProfiles\) \{[\s\S]*kernelIdByAgentId\.set\(profile\.agentId, profile\.kernelId\);/s,
    );
    assert.match(
      contextCatalogHookSource,
      /for \(const session of \[\.\.\.scopedSessions\]\.sort\(\(left, right\) => right\.updatedAt - left\.updatedAt\)\) \{[\s\S]*const binding = resolveChatSessionBinding\(session\);[\s\S]*kernelIdByAgentId\.set\(binding\.agentId, binding\.kernelId\);/s,
    );
    assert.match(
      contextCatalogHookSource,
      /return mergedVisibleAgents\.map\(\(agent\) => \{[\s\S]*const kernelLabel = resolveChatSidebarKernelLabel\(kernelId\);[\s\S]*\.\.\.\(kernelId \? \{ kernelId \} : \{\}\),[\s\S]*\.\.\.\(kernelLabel \? \{ kernelLabel \} : \{\}\),[\s\S]*\}\);\s*\}, \[agentProfiles, mergedVisibleAgents, scopedSessions\]\);/s,
    );
    assert.match(
      contextCatalogHookSource,
      /import \{[\s\S]*buildChatAgentOptions,[\s\S]*buildChatSkillOptions,[\s\S]*\} from '\.\/chatContextOptions';/s,
    );
    assert.doesNotMatch(
      contextCatalogHookSource,
      /import \{ useQuery \} from '@tanstack\/react-query';/,
    );
    assert.doesNotMatch(
      contextCatalogHookSource,
      /import \{ clawHubService \} from '@sdkwork\/claw-core';/,
    );
    assert.doesNotMatch(
      contextCatalogHookSource,
      /kernelChatAgentCatalogService/,
    );
    assert.doesNotMatch(
      contextCatalogHookSource,
      /resolveChatAgentCatalogState/,
    );
    assert.doesNotMatch(
      contextCatalogHookSource,
      /shouldLoadChatDirectAgents/,
    );
    assert.doesNotMatch(
      contextCatalogHookSource,
      /shouldLoadChatSkills/,
    );
    assert.match(agentCatalogStateHookSource, /export function useChatAgentCatalogState/);
    assert.match(
      agentCatalogStateHookSource,
      /import \{ useQuery, useQueryClient \} from '@tanstack\/react-query';/,
    );
    assert.match(
      agentCatalogStateHookSource,
      /import \{[\s\S]*kernelChatAgentCatalogService,[\s\S]*resolveChatAgentCatalogState,[\s\S]*shouldLoadKernelChatAgentCatalog,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      agentCatalogStateHookSource,
      /import \{[\s\S]*shouldLoadChatDirectAgents[\s\S]*\} from '\.\/chatHydrationPolicy';/s,
    );
    assert.match(skillCatalogStateHookSource, /export function useChatSkillCatalogState/);
    assert.match(
      skillCatalogStateHookSource,
      /import \{ useQuery \} from '@tanstack\/react-query';/,
    );
    assert.match(
      skillCatalogStateHookSource,
      /import \{ clawHubService \} from '@sdkwork\/claw-core';/,
    );
    assert.match(
      skillCatalogStateHookSource,
      /import \{[\s\S]*shouldLoadChatSkills[\s\S]*\} from '\.\/chatHydrationPolicy';/s,
    );
    assert.doesNotMatch(pageSource, /const shouldLoadSkillCatalog = shouldLoadChatSkills\(/);
    assert.doesNotMatch(pageSource, /const shouldLoadDirectAgentCatalog = shouldLoadChatDirectAgents\(/);
    assert.doesNotMatch(pageSource, /const shouldLoadKernelAgentCatalog = shouldLoadKernelChatAgentCatalog\(/);
    assert.doesNotMatch(pageSource, /buildChatAgentOptions\(/);
    assert.doesNotMatch(pageSource, /buildChatSkillOptions\(/);
    assert.doesNotMatch(pageSource, /resolveChatAgentCatalogState\(/);
    assert.doesNotMatch(pageSource, /clawHubService\.listSkills\(\)/);
    assert.doesNotMatch(pageSource, /kernelChatAgentCatalogService\.getCatalog\(/);
    assert.doesNotMatch(pageSource, /mergeChatCatalogAgentsWithSessionFallback\(/);
  },
);

await runTest(
  'Chat page wires kernel session controls through adapter capability envelopes',
  () => {
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatSessionViewState \} from '\.\/useChatSessionViewState';/,
    );
    assert.match(
      interactionModelStateHookSource,
      /import \{[\s\S]*useChatSessionControlState,[\s\S]*\} from '\.\/useChatSessionControlState';/s,
    );
    assert.match(
      runtimeSourceHookSource,
      /setKernelSessionThinkingLevel,\s*setKernelSessionFastMode,\s*setKernelSessionVerboseLevel,\s*setKernelSessionReasoningLevel,\s*\}\s*=\s*useChatStore\(\);/s,
    );
    assert.match(
      workspaceStateHookSource,
      /const\s*\{\s*workspaceMode,\s*isExplicitBlankWorkspace,\s*isDisplaySessionFallback,\s*selectableInstanceSessions,\s*selectedSession,\s*displaySessionId,\s*displaySession,\s*activeKernelSessionState,\s*activeRunBinding,\s*chatRuntimeState,\s*isUnsupportedRoute,\s*runningRunBinding,\s*sessionSelectedModelId,\s*activeMessages,\s*conversationBodyState,\s*activeMessageGroups,\s*\}\s*=\s*useChatSessionViewState\(/s,
    );
    assert.match(
      interactionModelStateHookSource,
      /const resolvedSessionControlModelId = sessionSelectedModelId \|\| activeModelId \|\| null;/,
    );
    assert.match(
      interactionModelStateHookSource,
      /const\s*\{\s*sessionControlActions,\s*currentThinkingLevel:\s*activeThinkingLevel,\s*thinkingLevelDefaultLabel,\s*thinkingLevelOptions,\s*currentFastMode:\s*activeFastMode,\s*fastModeDefaultLabel,\s*fastModeOptions,\s*currentVerboseLevel:\s*activeVerboseLevel,\s*verboseLevelDefaultLabel,\s*verboseLevelOptions,\s*currentReasoningLevel:\s*activeReasoningLevel,\s*reasoningLevelDefaultLabel,\s*reasoningLevelOptions,\s*\}\s*=\s*useChatSessionControlState\(\{\s*t,\s*activeInstanceId,\s*targetSessionId:\s*sessionControlSessionId,\s*activeAdapterCapabilities,\s*activeKernelSessionState,\s*activeModelId:\s*resolvedSessionControlModelId,\s*setKernelSessionModel,\s*setKernelSessionThinkingLevel,\s*setKernelSessionFastMode,\s*setKernelSessionVerboseLevel,\s*setKernelSessionReasoningLevel,\s*\}\);/s,
    );
    assert.doesNotMatch(
      interactionModelStateHookSource,
      /activeModelId:\s*activeModel\?\.id \?\? null/,
    );
    assert.doesNotMatch(pageSource, /const\s*\{\s*sessionControlActions,\s*currentThinkingLevel:\s*activeThinkingLevel,/);
    assert.match(
      sessionControlHookSource,
      /export function useChatSessionControlState/,
    );
    assert.match(
      sessionControlHookSource,
      /import \{ createChatSessionControlActions \} from '\.\.\/services';/,
    );
    assert.match(
      sessionControlHookSource,
      /import \{ useChatSessionControlCapabilityState \} from '\.\/useChatSessionControlCapabilityState';/,
    );
    assert.match(
      sessionControlHookSource,
      /import \{ useChatSessionControlOptionsState \} from '\.\/useChatSessionControlOptionsState';/,
    );
    assert.match(
      sessionControlHookSource,
      /const\s*\{\s*supportsModelSelection,\s*supportsThinkingLevelControl,\s*supportsFastModeControl,\s*supportsVerboseLevelControl,\s*supportsReasoningLevelControl,\s*activeThinkingLevel,\s*activeFastMode,\s*activeVerboseLevel,\s*activeReasoningLevel,\s*activeThinkingModelId,\s*\}\s*=\s*useChatSessionControlCapabilityState\(\{\s*activeAdapterCapabilities,\s*activeKernelSessionState,\s*activeModelId,\s*\}\);/s,
    );
    assert.match(
      sessionControlHookSource,
      /const\s*\{\s*thinkingLevelDefaultLabel,\s*thinkingLevelOptions,\s*fastModeDefaultLabel,\s*fastModeOptions,\s*verboseLevelDefaultLabel,\s*verboseLevelOptions,\s*reasoningLevelDefaultLabel,\s*reasoningLevelOptions,\s*\}\s*=\s*useChatSessionControlOptionsState\(\{\s*t,\s*activeThinkingModelId,\s*\}\);/s,
    );
    assert.match(
      sessionControlHookSource,
      /createChatSessionControlActions\(\{\s*activeInstanceId,\s*targetSessionId,\s*supportsModelSelection,\s*supportsThinkingLevelControl,\s*supportsFastModeControl,\s*supportsVerboseLevelControl,\s*supportsReasoningLevelControl,\s*setKernelSessionModel,\s*setKernelSessionThinkingLevel,\s*setKernelSessionFastMode,\s*setKernelSessionVerboseLevel,\s*setKernelSessionReasoningLevel,\s*\}\)/s,
    );
    assert.doesNotMatch(
      interactionModelStateHookSource,
      /useChatSessionControlState\(\{[\s\S]*sendMode,/s,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /createChatSessionControlActions\(\{[\s\S]*sendMode,/s,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /resolveChatThinkingLevelDefaultOption|resolveChatThinkingLevelOptions/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const activeCapabilitySet = activeAdapterCapabilities\?\.capabilitySet \?\? null;/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const supportsThinkingLevelControl = Boolean\(activeCapabilitySet\?\.supportsThinkingLevel\);/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const supportsFastModeControl = Boolean\(activeCapabilitySet\?\.supportsFastMode\);/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const supportsVerboseLevelControl = Boolean\(activeCapabilitySet\?\.supportsVerboseLevel\);/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const supportsReasoningLevelControl = Boolean\(activeCapabilitySet\?\.supportsReasoningControl\);/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const activeThinkingLevel = supportsThinkingLevelControl \? activeKernelSessionState\.thinkingLevel : null;/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const activeFastMode =\s*supportsFastModeControl\s*\?\s*activeKernelSessionState\.fastMode === true\s*\?\s*'on'\s*:\s*activeKernelSessionState\.fastMode === false\s*\?\s*'off'\s*:\s*null\s*:\s*null;/s,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const activeVerboseLevel = supportsVerboseLevelControl \? activeKernelSessionState\.verboseLevel : null;/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const activeReasoningLevel = supportsReasoningLevelControl \? activeKernelSessionState\.reasoningLevel : null;/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const activeThinkingModelId =\s*\(supportsThinkingLevelControl \|\| supportsReasoningLevelControl\)\s*\?\s*activeKernelSessionState\.model \|\| activeKernelSessionState\.defaultModel \|\| activeModelId \|\| null\s*:\s*null;/s,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const thinkingLevelOptions = resolveChatThinkingLevelOptions\(activeThinkingModelId\)\.map\(\(value\) => \(\{\s*value,\s*label: t\(`chat\.page\.thinkingLevels\.\$\{value\}`\),\s*\}\)\);/s,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const resolvedThinkingLevelDefault = resolveChatThinkingLevelDefaultOption\(activeThinkingModelId\);/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const thinkingLevelDefaultLabel = resolvedThinkingLevelDefault\s*\?\s*t\('chat\.page\.thinkingLevelDefaultResolved',\s*\{\s*level: t\(`chat\.page\.thinkingLevels\.\$\{resolvedThinkingLevelDefault\}`\),\s*\}\)\s*:\s*t\('chat\.page\.thinkingLevelDefault'\);/s,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const sessionControlInheritLabel = t\('chat\.page\.sessionControlInherit'\);/,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const fastModeOptions = \[\s*\{\s*value: 'off',\s*label: t\('chat\.page\.fastModes\.off'\),\s*\},\s*\{\s*value: 'on',\s*label: t\('chat\.page\.fastModes\.on'\),\s*\},\s*\];/s,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const verboseLevelOptions = \[\s*\{\s*value: 'off',\s*label: t\('chat\.page\.verboseLevels\.off'\),\s*\},\s*\{\s*value: 'on',\s*label: t\('chat\.page\.verboseLevels\.on'\),\s*\},\s*\{\s*value: 'full',\s*label: t\('chat\.page\.verboseLevels\.full'\),\s*\},\s*\];/s,
    );
    assert.doesNotMatch(
      sessionControlHookSource,
      /const reasoningLevelOptions = \[\s*\{\s*value: 'off',\s*label: t\('chat\.page\.reasoningLevels\.off'\),\s*\},\s*\{\s*value: 'on',\s*label: t\('chat\.page\.reasoningLevels\.on'\),\s*\},\s*\{\s*value: 'stream',\s*label: t\('chat\.page\.reasoningLevels\.stream'\),\s*\},\s*\];/s,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /export function useChatSessionControlCapabilityState/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const activeCapabilitySet = activeAdapterCapabilities\?\.capabilitySet \?\? null;/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const supportsModelSelection = Boolean\(activeCapabilitySet\?\.supportsModelSelection\);/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const supportsVerboseLevelControl = Boolean\(activeCapabilitySet\?\.supportsVerboseLevel\);/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const supportsThinkingLevelControl = Boolean\(activeCapabilitySet\?\.supportsThinkingLevel\);/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const supportsFastModeControl = Boolean\(activeCapabilitySet\?\.supportsFastMode\);/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const supportsReasoningLevelControl = Boolean\(activeCapabilitySet\?\.supportsReasoningControl\);/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const activeThinkingLevel = supportsThinkingLevelControl \? activeKernelSessionState\.thinkingLevel : null;/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const activeFastMode =\s*supportsFastModeControl\s*\?\s*activeKernelSessionState\.fastMode === true\s*\?\s*'on'\s*:\s*activeKernelSessionState\.fastMode === false\s*\?\s*'off'\s*:\s*null\s*:\s*null;/s,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const activeVerboseLevel = supportsVerboseLevelControl \? activeKernelSessionState\.verboseLevel : null;/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const activeReasoningLevel = supportsReasoningLevelControl \? activeKernelSessionState\.reasoningLevel : null;/,
    );
    assert.match(
      sessionControlCapabilityHookSource,
      /const activeThinkingModelId =\s*\(supportsThinkingLevelControl \|\| supportsReasoningLevelControl\)\s*\?\s*activeKernelSessionState\.model \|\| activeKernelSessionState\.defaultModel \|\| activeModelId \|\| null\s*:\s*null;/s,
    );
    assert.match(
      sessionControlOptionsHookSource,
      /export function useChatSessionControlOptionsState/,
    );
    assert.match(
      sessionControlOptionsHookSource,
      /const thinkingLevelOptions = resolveChatThinkingLevelOptions\(activeThinkingModelId\)\.map\(\(value\) => \(\{\s*value,\s*label: t\(`chat\.page\.thinkingLevels\.\$\{value\}`\),\s*\}\)\);/s,
    );
    assert.match(
      sessionControlOptionsHookSource,
      /const resolvedThinkingLevelDefault = resolveChatThinkingLevelDefaultOption\(activeThinkingModelId\);/,
    );
    assert.match(
      sessionControlOptionsHookSource,
      /const thinkingLevelDefaultLabel = resolvedThinkingLevelDefault\s*\?\s*t\('chat\.page\.thinkingLevelDefaultResolved',\s*\{\s*level: t\(`chat\.page\.thinkingLevels\.\$\{resolvedThinkingLevelDefault\}`\),\s*\}\)\s*:\s*t\('chat\.page\.thinkingLevelDefault'\);/s,
    );
    assert.match(
      sessionControlOptionsHookSource,
      /const sessionControlInheritLabel = t\('chat\.page\.sessionControlInherit'\);/,
    );
    assert.match(
      sessionControlOptionsHookSource,
      /const fastModeOptions = \[\s*\{\s*value: 'off',\s*label: t\('chat\.page\.fastModes\.off'\),\s*\},\s*\{\s*value: 'on',\s*label: t\('chat\.page\.fastModes\.on'\),\s*\},\s*\];/s,
    );
    assert.match(
      sessionControlOptionsHookSource,
      /const verboseLevelOptions = \[\s*\{\s*value: 'off',\s*label: t\('chat\.page\.verboseLevels\.off'\),\s*\},\s*\{\s*value: 'on',\s*label: t\('chat\.page\.verboseLevels\.on'\),\s*\},\s*\{\s*value: 'full',\s*label: t\('chat\.page\.verboseLevels\.full'\),\s*\},\s*\];/s,
    );
    assert.match(
      sessionControlOptionsHookSource,
      /const reasoningLevelOptions = \[\s*\{\s*value: 'off',\s*label: t\('chat\.page\.reasoningLevels\.off'\),\s*\},\s*\{\s*value: 'on',\s*label: t\('chat\.page\.reasoningLevels\.on'\),\s*\},\s*\{\s*value: 'stream',\s*label: t\('chat\.page\.reasoningLevels\.stream'\),\s*\},\s*\];/s,
    );
    assert.doesNotMatch(pageSource, /const activeCapabilitySet = activeAdapterCapabilities\?\.capabilitySet \?\? null;/);
    assert.doesNotMatch(pageSource, /const supportsThinkingLevelControl = Boolean\(activeCapabilitySet\?\.supportsThinkingLevel\);/);
    assert.doesNotMatch(pageSource, /const supportsFastModeControl = Boolean\(activeCapabilitySet\?\.supportsFastMode\);/);
    assert.doesNotMatch(pageSource, /const supportsVerboseLevelControl = Boolean\(activeCapabilitySet\?\.supportsVerboseLevel\);/);
    assert.doesNotMatch(pageSource, /const supportsReasoningLevelControl = Boolean\(activeCapabilitySet\?\.supportsReasoningControl\);/);
    assert.doesNotMatch(pageSource, /const sessionControlInheritLabel = t\('chat\.page\.sessionControlInherit'\);/);
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /currentThinkingLevel: activeThinkingLevel,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /thinkingLevelDefaultLabel,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /thinkingLevelOptions,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /onSelectThinkingLevel: sessionControlActions\.onSelectThinkingLevel,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /currentFastMode: activeFastMode,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /fastModeDefaultLabel,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /fastModeOptions,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /onSelectFastMode: sessionControlActions\.onSelectFastMode,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /currentVerboseLevel: activeVerboseLevel,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /verboseLevelDefaultLabel,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /verboseLevelOptions,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /onSelectVerboseLevel: sessionControlActions\.onSelectVerboseLevel,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /currentReasoningLevel: activeReasoningLevel,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /reasoningLevelDefaultLabel,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /reasoningLevelOptions,/,
    );
    assert.match(
      sessionContextDrawerPresentationHookSource,
      /onSelectReasoningLevel: sessionControlActions\.onSelectReasoningLevel,/,
    );
  },
);

await runTest(
  'Chat page derives chat generation run state from the kernel session authority',
  () => {
    assert.match(
      sendExecutionStateHookSource,
      /const\s*\{\s*isActiveSessionGenerating,\s*isComposerLocked,\s*stopRunBinding\s*\}\s*=\s*resolveChatGenerationViewState\(\{\s*effectiveActiveSessionId:\s*displaySessionId,\s*pendingSendSessionId,\s*activeRunBinding,\s*runningRunBinding,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /resolveChatGenerationViewState\(\{/s,
    );
    assert.doesNotMatch(
      pageSource,
      /resolveChatGenerationViewState\(\{[\s\S]*activeSessionRunId:\s*activeSession\?\.runId\s*\?\?\s*null[\s\S]*\}\)/s,
    );
  },
);

await runTest(
  'Chat page resolves message display state through the kernel message authority',
  () => {
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatSessionViewState \} from '\.\/useChatSessionViewState';/,
    );
    assert.match(
      workspaceStateHookSource,
      /const\s*\{\s*workspaceMode,\s*isExplicitBlankWorkspace,\s*isDisplaySessionFallback,\s*selectableInstanceSessions,\s*selectedSession,\s*displaySessionId,\s*displaySession,\s*activeKernelSessionState,\s*activeRunBinding,\s*chatRuntimeState,\s*isUnsupportedRoute,\s*runningRunBinding,\s*sessionSelectedModelId,\s*activeMessages,\s*conversationBodyState,\s*activeMessageGroups,\s*\}\s*=\s*useChatSessionViewState\(/s,
    );
    assert.match(
      sessionViewHookSource,
      /import \{ useChatMessageDisplayState \} from '\.\/useChatMessageDisplayState';/,
    );
    assert.match(
      sessionViewHookSource,
      /const \{ activeMessages, conversationBodyState, activeMessageGroups \} =/,
    );
    assert.match(
      sessionViewHookSource,
      /useChatMessageDisplayState\(\{\s*displaySession,\s*chatRuntimeState,\s*\}\);/s,
    );
    assert.match(
      messageDisplayStateHookSource,
      /const activeMessageStates = useMemo\(\s*\(\) => activeMessages\.map\(\(message\) => resolveKernelChatMessageState\(message\)\),\s*\[activeMessages\],\s*\);/s,
    );
    assert.match(
      messageDisplayStateHookSource,
      /const activeMessageGroups = useMemo\(\s*\(\) => groupChatMessagesForDisplay\(activeMessageStates\),\s*\[activeMessageStates\],\s*\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const activeMessageStates = useMemo\(\s*\(\) => activeMessages\.map\(\(message\) => resolveKernelChatMessageState\(message\)\),\s*\[activeMessages\],\s*\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const activeMessageGroups = useMemo\(\s*\(\) => groupChatMessagesForDisplay\(activeMessageStates\),\s*\[activeMessageStates\],\s*\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const activeMessageGroups = useMemo\(\s*\(\) => groupChatMessagesForDisplay\(activeMessages\),\s*\[activeMessages\],\s*\);/s,
    );
  },
);

await runTest(
  'Chat page sends through the displayed session when a hidden raw active session falls back to a visible session',
  () => {
    assert.match(
      workspaceStateHookSource,
      /resolveChatSendSessionId,/,
    );
    assert.match(
      workspaceStateHookSource,
      /resolveChatWorkspacePresentation,/,
    );
    assert.match(
      workspaceStateHookSource,
      /const sendSessionId = resolveChatSendSessionId\(\{\s*selectedSessionId: activeSessionId,\s*displaySessionId,\s*sendMode,\s*\}\);/s,
    );
    assert.match(
      workspaceStateHookSource,
      /useChatInteractionState\(\{[\s\S]*selectedSessionId: sendSessionId,[\s\S]*displaySessionId,/s,
    );
    assert.doesNotMatch(
      workspaceStateHookSource,
      /useChatInteractionState\(\{[\s\S]*selectedSessionId:\s*activeSessionId,/,
    );
  },
);

await runTest(
  'Chat page only loads the OpenClaw agent catalog when the active adapter resolves to a gateway kernel chat path',
  () => {
    assert.match(
      agentCatalogStateHookSource,
      /import \{[\s\S]*kernelChatAgentCatalogService,[\s\S]*resolveChatAgentCatalogState,[\s\S]*shouldLoadKernelChatAgentCatalog,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      agentCatalogStateHookSource,
      /const shouldLoadKernelAgentCatalog = shouldLoadKernelChatAgentCatalog\(\{\s*activeInstanceId,\s*isChatSupported: isChatSupportedRoute,\s*agentCatalogMode,\s*\}\);/s,
    );
    assert.match(
      agentCatalogStateHookSource,
      /const shouldLoadAnyAgentCatalog = shouldLoadDirectAgentCatalog \|\| shouldLoadKernelAgentCatalog;/,
    );
    assert.match(
      agentCatalogStateHookSource,
      /queryKey: \['chat', 'kernel-agent-catalog', activeInstanceId, agentCatalogMode\],\s*enabled: Boolean\(activeInstanceId && shouldLoadAnyAgentCatalog\),/s,
    );
    assert.match(
      agentCatalogStateHookSource,
      /queryFn: \(\) => kernelChatAgentCatalogService\.getCatalog\(activeInstanceId \?\? undefined\),/s,
    );
  },
);

await runTest(
  'Chat page derives blocked and gateway chat state from adapter capabilities instead of raw route literals',
  () => {
    assert.match(
      pageRuntimeHookSource,
      /const activeAdapterCapabilities =\s*activeInstanceId \? instanceChatAdapterCapabilitiesById\[activeInstanceId\] \?\? null : null;/,
    );
    assert.match(
      pageRuntimeHookSource,
      /const adapterRuntimeState = resolveChatRuntimeState\(\{\s*activeInstanceId,\s*routeMode,\s*adapterCapabilities: activeAdapterCapabilities,\s*sessionState: null,\s*\}\);/s,
    );
    assert.match(pageRuntimeHookSource, /const isChatSupportedRoute = adapterRuntimeState\.isChatAvailable;/);
    assert.match(pageRuntimeHookSource, /const agentCatalogMode = adapterRuntimeState\.agentCatalogMode;/);
    assert.match(pageRuntimeHookSource, /const sessionScopeMode = adapterRuntimeState\.sessionScopeMode;/);
    assert.match(pageRuntimeHookSource, /const sendMode = adapterRuntimeState\.sendMode;/);
    assert.match(pageRuntimeHookSource, /const newSessionModelMode = adapterRuntimeState\.newSessionModelMode;/);
    assert.match(
      pageRuntimeHookSource,
      /const supportsSessionScopeSync = adapterRuntimeState\.supportsSessionScopeSync;/,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const chatRuntimeState = resolveChatRuntimeState\(\{\s*activeInstanceId,\s*routeMode,\s*adapterCapabilities: activeAdapterCapabilities,\s*sessionState: activeKernelSessionState,\s*\}\);/s,
    );
    assert.match(headerStateHookSource, /const sessionRouteLabel = t\(routeLabelKey\);/);
    assert.doesNotMatch(pageSource, /const isUnsupportedRoute = chatRuntimeState\.isBlocked;/);
    assert.doesNotMatch(pageSource, /const isUnsupportedRoute = routeMode === 'unsupported';/);
    assert.doesNotMatch(pageSource, /const isChatSupportedRoute = !isUnsupportedRoute;/);
    assert.doesNotMatch(pageSource, /const isOpenClawGateway = routeMode === 'instanceOpenClawGatewayWs';/);
    assert.doesNotMatch(pageSource, /const isGatewayAuthority = adapterRuntimeState\.isGatewayAuthority;/);
    assert.match(
      agentCatalogStateHookSource,
      /const\s*\{\s*visibleAgents,\s*defaultAgentId,\s*effectiveAgentId:\s*effectiveGatewayAgentId,\s*hasResolvedVisibleAgents,\s*isAgentSelectorLoading,\s*defaultDescriptionKey:\s*agentDefaultDescriptionKey,\s*\}\s*=\s*resolveChatAgentCatalogState\(\{/s,
    );
    assert.match(
      agentCatalogStateHookSource,
      /resolveChatAgentCatalogState\(\{\s*activeInstanceId,\s*isChatSupported: isChatSupportedRoute,\s*agentCatalogMode,\s*selectedAgentId,\s*activeSessionAgentId,\s*catalogAgents: instanceAgentCatalog\?\.agents \?\? EMPTY_AGENTS,\s*catalogDefaultAgentId: instanceAgentCatalog\?\.defaultAgentId \?\? null,\s*isSessionContextDrawerOpen,\s*shouldLoadAgentCatalog: shouldLoadAnyAgentCatalog,\s*isAgentCatalogFetched,\s*isAgentCatalogFetching,\s*\}\)/s,
    );
    assert.match(
      skillCatalogStateHookSource,
      /shouldLoadChatSkills\(\{\s*isRouteSupported: isChatSupportedRoute,\s*isSessionContextDrawerOpen,\s*selectedSkillId,\s*\}\)/s,
    );
    assert.match(
      agentCatalogStateHookSource,
      /shouldLoadChatDirectAgents\(\{\s*activeInstanceId,\s*isRouteSupported: isChatSupportedRoute,\s*agentCatalogMode,\s*isSessionContextDrawerOpen,\s*selectedAgentId,\s*\}\)/s,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /resolveChatWorkspaceProjection\(\{\s*sessions: instanceSessions,\s*activeSessionId,\s*isChatSupported: isChatSupportedRoute,\s*sessionScopeMode,\s*sessionScopeAgentId: effectiveGatewayAgentId,\s*selectedAgentId,\s*\}\)/s,
    );
    assert.match(
      pageRuntimeHookSource,
      /const gatewayConnectionStatus =\s*gatewayConnectionStatusByInstance\[scopeKey\] \?\? \(sendMode === 'gateway' \? 'disconnected' : null\);/s,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const sessionSelectedModelId =\s*sendMode === 'gateway' && displaySession\s*\?\s*activeKernelSessionState\.model \|\| activeKernelSessionState\.defaultModel \|\| null\s*:\s*null;/s,
    );
    assert.match(
      modelCatalogHookSource,
      /return instanceEffectiveModelCatalogService\.getCatalog\(\s*activeInstanceId,\s*agentCatalogMode === 'kernelCatalog' \? effectiveGatewayAgentId : undefined,\s*\);/s,
    );
    assert.match(
      sendExecutionStateHookSource,
      /const composerSendActions = createChatComposerSendActions\(\{\s*activeInstanceId,\s*selectedSessionId,\s*sendMode,\s*hasActiveChannel: Boolean\(activeChannel\),\s*isChatSupportedRoute,\s*isBusy,\s*hasPendingInstanceRoute: Boolean\(activeInstanceId && !routeMode\),/s,
    );
    assert.match(sessionContextDrawerPresentationHookSource, /showAgentSection: isChatSupportedRoute,/);
    assert.match(sessionContextDrawerPresentationHookSource, /showSkillSection: isChatSupportedRoute,/);
    assert.match(
      pageCompositionHookSource,
      /useChatSidebarState\(\{\s*t,\s*sourceState,\s*pageUiState,\s*workspaceState,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /queryKey: \['chat', 'openclaw-agent-catalog', activeInstanceId\]/s,
    );
    assert.doesNotMatch(
      pageSource,
      /queryKey: \['agents', activeInstanceId\]/s,
    );
    assert.doesNotMatch(
      pageSource,
      /if\s*\(\s*!activeModel\s*\|\|\s*!activeChannel\s*\|\|\s*!isChatSupportedRoute\s*\|\|\s*isBusy\s*\|\|\s*\(activeInstanceId && !routeMode\)\s*\)\s*\{/,
    );
    assert.doesNotMatch(
      pageSource,
      /openClawChatAgentCatalogService\.getCatalog\(activeInstanceId\)/s,
    );
  },
);

await runTest(
  'Chat page reconciles agent and skill selections through shared context-selection policy instead of inline reset effects',
  () => {
    assert.match(
      contextSelectionSynchronizationHookSource,
      /const contextSelectionSyncMutation = resolveChatContextSelectionSyncMutation\(\{\s*isChatSupported: isChatSupportedRoute,\s*selectedAgentId,\s*selectedSkillId,\s*hasResolvedVisibleAgents,\s*visibleAgentIds,\s*\}\);/s,
    );
    assert.match(
      contextSelectionSynchronizationHookSource,
      /if \(\s*contextSelectionSyncMutation &&\s*contextSelectionSyncMutation\.nextSelectedAgentId !== selectedAgentId\s*\) \{\s*setSelectedAgentId\(contextSelectionSyncMutation\.nextSelectedAgentId\);\s*\}/s,
    );
    assert.match(
      contextSelectionSynchronizationHookSource,
      /if \(\s*contextSelectionSyncMutation\?\.nextSelectedSkillId !== undefined &&\s*contextSelectionSyncMutation\.nextSelectedSkillId !== selectedSkillId\s*\) \{\s*setSelectedSkillId\(contextSelectionSyncMutation\.nextSelectedSkillId\);\s*\}/s,
    );
    assert.doesNotMatch(
      pageSource,
      /if \(\s*selectedAgentId\s*&&\s*hasResolvedVisibleAgents\s*&&\s*!visibleAgents\.some\(\(agent\) => agent\.id === selectedAgentId\)\s*\)/s,
    );
    assert.doesNotMatch(
      pageSource,
      /if \(isChatSupportedRoute\) \{\s*return;\s*\}\s*if \(selectedAgentId\) \{\s*setSelectedAgentId\(null\);\s*\}\s*if \(selectedSkillId\) \{\s*setSelectedSkillId\(null\);\s*\}/s,
    );
  },
);

await runTest(
  'Chat page derives gateway running state from the current selectable session scope instead of any hidden instance session',
  () => {
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatSessionViewState \} from '\.\/useChatSessionViewState';/,
    );
    assert.match(
      activeSessionProjectionHookSource,
      /const runningRunBinding = resolveChatRunningRunBinding\(\{\s*sendMode,\s*selectableSessions: selectableInstanceSessions,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const runningRunBinding = resolveChatRunningRunBinding\(\{\s*sendMode,\s*selectableSessions: selectableInstanceSessions,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /instanceSessions\.find\(\(session\) => Boolean\(session\.runId\)\)\?\.id \?\? null/,
    );
  },
);

await runTest(
  'Chat page routes session model selection, visible-session sync, and draft-session behavior through standardized runtime semantics',
  () => {
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatInteractionState \} from '\.\/useChatInteractionState';/,
    );
    assert.match(
      pageModelSelectionHookSource,
      /const newSessionModel = resolveNewChatSessionModel\(\{\s*newSessionModelMode,\s*activeModelId: activeModel\?\.id,\s*activeModelName: activeModel\?\.name,\s*\}\);/s,
    );
    assert.match(
      sendExecutionStateHookSource,
      /const dispatchMode = resolveChatKernelRunDispatchMode\(\{\s*activeInstanceId,\s*sendMode,\s*adapterCapabilities: activeAdapterCapabilities,\s*\}\);[\s\S]*const sessionRunActions = createChatSessionRunActions\(\{\s*activeInstanceId,\s*sendMode,\s*dispatchMode,\s*stopRunBinding,\s*setPendingSendSessionId,\s*sendKernelMessage,\s*abortSession,\s*\}\);/s,
    );
    assert.match(
      sendExecutionStateHookSource,
      /const composerSendActions = createChatComposerSendActions\(\{/,
    );
    assert.match(
      catalogSynchronizationHookSource,
      /const catalogSelectionSyncMutation = resolveChatCatalogSelectionSyncMutation\(\{\s*activeInstanceId,\s*channels,\s*activeChannel,\s*activeModel,\s*activeChannelId,\s*activeModelId,\s*sessionSelectedModelId,\s*\}\);/s,
    );
    assert.match(
      catalogSynchronizationHookSource,
      /if \(catalogSelectionSyncMutation\?\.nextChannelId && catalogSelectionSyncMutation\.nextChannelId !== activeChannelId\) \{\s*setActiveChannel\(catalogSelectionSyncMutation\.instanceId, catalogSelectionSyncMutation\.nextChannelId\);\s*\}/s,
    );
    assert.match(
      catalogSynchronizationHookSource,
      /if \(catalogSelectionSyncMutation\?\.nextModelId && catalogSelectionSyncMutation\.nextModelId !== activeModelId\) \{\s*setActiveModel\(catalogSelectionSyncMutation\.instanceId, catalogSelectionSyncMutation\.nextModelId\);\s*\}/s,
    );
    assert.match(
      visibleSessionSynchronizationHookSource,
      /const syncMutation = resolveChatVisibleSessionSyncMutation\(\{\s*activeInstanceId,\s*supportsVisibleSessionSync,\s*activeSessionId,\s*effectiveActiveSessionId,\s*selectedAgentId,\s*\}\);/s,
    );
    assert.match(
      sendExecutionStateHookSource,
      /sessionScopeMode,\s*sessionScopeAgentId: effectiveGatewayAgentId,\s*newSessionModel,\s*inFlightSubmitRef: sendSubmitLockRef,\s*createSession,\s*sessionRunActions,\s*directRunActions,\s*\}\);/s,
    );
    assert.match(
      bootstrapSynchronizationHookSource,
      /const bootstrapMutation = resolveChatBootstrapMutation\(\{\s*activeInstanceId,\s*routeMode,\s*sendMode,\s*syncState,\s*hasActiveModel,\s*activeSessionId: effectiveActiveSessionId,\s*sessionIds: selectableInstanceSessions\.map\(\(session\) => session\.id\),\s*selectedAgentId,\s*newSessionModel,\s*\}\);/s,
    );
    assert.match(
      bootstrapSynchronizationHookSource,
      /if \(bootstrapMutation\?\.type === 'createSession'\) \{\s*void createSession\(\s*bootstrapMutation\.model,\s*bootstrapMutation\.instanceId,\s*\);\s*return;\s*\}/s,
    );
    assert.match(
      bootstrapSynchronizationHookSource,
      /if \(bootstrapMutation\?\.type === 'selectSession'\) \{\s*void setActiveSession\(bootstrapMutation\.sessionId,\s*bootstrapMutation\.instanceId\);\s*\}/s,
    );
    assert.match(
      catalogSynchronizationHookSource,
      /const preferredModelSyncPlan = resolveChatPreferredModelSyncPlan\(\{\s*newSessionModelMode,\s*activeInstanceId,\s*sessionSelectedModelId,\s*preferredModelId,\s*catalogChannels,\s*activeChannelId,\s*activeModelId,\s*effectiveGatewayAgentId,\s*lastAppliedScopeKey: lastOpenClawModelScopeRef\.current,\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /if \(!isGatewayAuthority \|\| !activeInstanceId \|\| sessionSelectedModelId\)/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const nextChannelId =\s*activeChannel\?\.id \|\| channels\[0\]\?\.id;/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const nextModelId =\s*activeModel\?\.id \|\| activeChannel\?\.defaultModelId \|\| activeChannel\?\.models\[0\]\?\.id;/s,
    );
  },
);

await runTest(
  'Chat page builds agent selector copy from standardized catalog policy output',
  () => {
    assert.match(
      contextCatalogHookSource,
      /buildChatAgentOptions\(\{\s*agents: visibleAgentsWithKernel,\s*defaultLabel: t\('chat\.page\.noneDefault'\),\s*defaultDescription: t\(agentDefaultDescriptionKey\),\s*\}\)/s,
    );
    assert.match(
      contextCatalogHookSource,
      /buildChatSkillOptions\(\{\s*skills: visibleSkills,\s*defaultLabel: t\('chat\.page\.noneGeneralChat'\),\s*defaultDescription: t\('chat\.page\.defaultSkillDescription'\),\s*\}\)/s,
    );
    assert.match(
      contextCatalogHookSource,
      /visibleAgentIds: visibleAgentsWithKernel\.map\(\(agent\) => agent\.id\),/s,
    );
    assert.match(
      contextCatalogHookSource,
      /const activeAgent = visibleAgentsWithKernel\.find\(\(agent\) => agent\.id === effectiveGatewayAgentId\);/s,
    );
    assert.doesNotMatch(
      contextCatalogHookSource,
      /defaultDescription: t\(\s*isGatewayAuthority\s*\?\s*'chat\.page\.defaultAgentGatewayDescription'\s*:\s*'chat\.page\.defaultAgentDirectDescription',\s*\)/s,
    );
  },
);

await runTest(
  'Chat page routes gateway-only model mutation and send-stop behavior through standardized runtime semantics',
  () => {
    assert.match(
      workspaceStateHookSource,
      /import \{ useChatInteractionState \} from '\.\/useChatInteractionState';/,
    );
    assert.match(
      interactionModelStateHookSource,
      /import \{[\s\S]*useChatSessionControlState,[\s\S]*\} from '\.\/useChatSessionControlState';/s,
    );
    assert.match(
      interactionModelStateHookSource,
      /import \{[\s\S]*useChatPageModelSelectionState,[\s\S]*\} from '\.\/useChatPageModelSelectionState';/s,
    );
    assert.match(
      interactionModelStateHookSource,
      /const\s*\{\s*channels,\s*activeChannel,\s*activeModel,\s*newSessionModel,\s*handleChannelChange,\s*handleModelChange,\s*\}\s*=\s*useChatPageModelSelectionState\(\{/s,
    );
    assert.match(
      pageModelSelectionHookSource,
      /const modelSelectionActions = createChatModelSelectionActions\(\{\s*activeInstanceId,\s*activeChannelId: activeChannel\?\.id \?\? activeChannelId,\s*channels,\s*setActiveChannel,\s*setActiveModel,\s*sessionControlActions,\s*\}\);/s,
    );
    assert.match(
      pageModelSelectionHookSource,
      /const handleChannelChange = modelSelectionActions\.selectChannel;/,
    );
    assert.match(
      pageModelSelectionHookSource,
      /const handleModelChange = modelSelectionActions\.selectModel;/,
    );
    assert.match(
      sendExecutionStateHookSource,
      /const handleSend = composerSendActions\.submit;/,
    );
    assert.match(
      sendExecutionStateHookSource,
      /void sessionRunActions\.stopActiveRun\(\)\.then\(\(handled\) => \{\s*if \(!handled\) \{\s*directRunActions\.stopActiveRun\(\);\s*\}\s*\}\);/s,
    );
    assert.doesNotMatch(
      pageSource,
      /const modelSelectionActions = createChatModelSelectionActions\(/,
    );
    assert.doesNotMatch(
      pageSource,
      /const handleChannelChange = modelSelectionActions\.selectChannel;/,
    );
    assert.doesNotMatch(
      pageSource,
      /const handleModelChange = modelSelectionActions\.selectModel;/,
    );
    assert.doesNotMatch(
      pageSource,
      /const handleSend = composerSendActions\.submit;/,
    );
    assert.doesNotMatch(
      pageSource,
      /void sessionRunActions\.stopActiveRun\(\)\.then\(\(handled\) => \{\s*if \(!handled\) \{\s*directRunActions\.stopActiveRun\(\);\s*\}\s*\}\);/s,
    );
    assert.doesNotMatch(pageSource, /void setKernelSessionModel\(\{/);
    assert.doesNotMatch(pageSource, /resolveOpenClawDraftSessionId\(/);
    assert.doesNotMatch(pageSource, /await sendKernelMessage\(\{/);
    assert.doesNotMatch(pageSource, /void abortSession\(\{/);
  },
);

await runTest(
  'Chat page routes direct local streaming through dedicated local run actions instead of page-level stream orchestration',
  () => {
    assert.match(
      sendExecutionStateHookSource,
      /const directRunActions = createChatLocalRunActions\(\{\s*sendMode,\s*abortControllerRef,\s*setPendingSendSessionId,\s*addMessage,\s*updateMessage,\s*removeMessages,\s*flushSession,\s*getSessionById: \(sessionId, instanceId\) => \{\s*const scopedInstanceId =\s*instanceId === undefined \? activeInstanceId \?\? null : instanceId;\s*return useChatStore\s*\.getState\(\)\s*\.sessions\.find\(\s*\(session\) =>\s*session\.id === sessionId &&\s*\(session\.instanceId \?\? null\) === scopedInstanceId,\s*\);\s*\},\s*sendMessageStream: chatService\.sendMessageStream\.bind\(chatService\),\s*\}\);/s,
    );
    assert.match(sendExecutionStateHookSource, /const handleSend = composerSendActions\.submit;/);
    assert.doesNotMatch(pageSource, /const directRunActions = createChatLocalRunActions\(/);
    assert.doesNotMatch(pageSource, /const handleSend = composerSendActions\.submit;/);
    assert.doesNotMatch(pageSource, /const content = text\.trim\(\);/);
    assert.doesNotMatch(pageSource, /composeOutgoingChatText\(/);
    assert.doesNotMatch(pageSource, /resolveChatSendSessionId\(/);
    assert.doesNotMatch(pageSource, /for await \(const chunk of stream\)/);
    assert.doesNotMatch(pageSource, /abortControllerRef\.current = new AbortController\(\);/);
    assert.doesNotMatch(pageSource, /updateMessage\(sessionId, lastMessage\.id, fullContent\);/);
  },
);
