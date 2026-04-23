import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('sdkwork-claw-chat is implemented locally instead of re-exporting claw-studio-chat', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-chat/package.json');
  const indexSource = read('packages/sdkwork-claw-chat/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/Chat.tsx'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatService.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/clawChatService.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/openclaw/openClawGatewayClient.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/store/chatStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/store/useChatStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/store/openClawGatewaySessionStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/types/index.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-chat']);
  assert.ok(!pkg.dependencies?.['@google/genai']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-chat/);
  assert.match(indexSource, /Chat/);
  assert.match(indexSource, /useChatStore/);
  assert.match(indexSource, /chatService/);
});

await runTest('sdkwork-claw-chat routes model selection through the composer', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatPageCompositionSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageCompositionState.ts',
  );
  const chatPagePresentationPropsSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPagePresentationPropsState.ts',
  );
  const conversationPaneSource = read(
    'packages/sdkwork-claw-chat/src/components/ChatConversationPane.tsx',
  );
  const presentationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPresentationState.ts',
  );
  const conversationPanePresentationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatConversationPanePresentationState.ts',
  );
  const presentationNavigationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPresentationNavigation.ts',
  );
  const compactModelPreferenceHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatCompactModelPreference.ts',
  );
  const composerPanelSource = read('packages/sdkwork-claw-chat/src/components/ChatComposerPanel.tsx');
  const chatInputSource = read('packages/sdkwork-claw-chat/src/components/ChatInput.tsx');

  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatComposerState.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/components/ChatComposerPanel.tsx'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/components/ChatConversationPane.tsx'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/useChatPresentationState.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/useChatPresentationNavigation.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/useChatCompactModelPreference.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/useChatConversationPanePresentationState.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/useChatSessionContextDrawerPresentationState.ts'));
  assert.doesNotMatch(chatPageSource, /showModelDropdown/);
  assert.doesNotMatch(chatPageSource, /setShowModelDropdown/);
  assert.doesNotMatch(chatPageSource, /chat\.page\.selectModel/);
  assert.doesNotMatch(chatPageSource, /useNavigate/);
  assert.match(chatPageSource, /import \{ ChatConversationPane \} from '\.\.\/components\/ChatConversationPane';/);
  assert.match(chatPageSource, /import \{ useChatPageCompositionState \} from '\.\/useChatPageCompositionState';/);
  assert.match(
    chatPagePresentationPropsSource,
    /const\s*\{\s*topControlsProps,\s*emptyStateProps,\s*composerPanelProps,\s*sessionContextDrawerProps,\s*onManageInstances,\s*\}\s*=\s*useChatPresentationState\(\{/s,
  );
  assert.match(chatPageSource, /<ChatConversationPane \{\.\.\.conversationPaneProps\} \/>/);
  assert.match(
    chatPagePresentationPropsSource,
    /conversationPaneProps:\s*\{[\s\S]*composerPanelProps,[\s\S]*onManageInstances,[\s\S]*\}/s,
  );
  assert.match(chatPageSource, /<ChatSessionContextDrawer \{\.\.\.sessionContextDrawerProps\} \/>/);
  assert.match(chatPagePresentationPropsSource, /sessionContextDrawerProps,/);
  assert.match(
    chatPageCompositionSource,
    /const\s*\{\s*conversationPaneProps,\s*sessionContextDrawerProps,\s*\}\s*=\s*useChatPagePresentationPropsState\(\{/s,
  );
  assert.doesNotMatch(chatPageSource, /<ChatInput[\s\S]*activeChannel=\{activeChannel\}/);
  assert.match(presentationHookSource, /import \{ useChatPresentationNavigation \} from '\.\/useChatPresentationNavigation';/);
  assert.match(presentationHookSource, /import \{ useChatCompactModelPreference \} from '\.\/useChatCompactModelPreference';/);
  assert.match(
    presentationHookSource,
    /import \{[\s\S]*useChatConversationPanePresentationState[\s\S]*\} from '\.\/useChatConversationPanePresentationState';/s,
  );
  assert.doesNotMatch(presentationHookSource, /import \{ useNavigate \} from 'react-router-dom';/);
  assert.doesNotMatch(presentationHookSource, /const navigate = useNavigate\(\);/);
  assert.match(
    conversationPanePresentationHookSource,
    /const composerPanelProps = \{\s*showJumpToLatest,\s*hasMessages: activeMessagesCount > 0,\s*jumpToLatestLabel: t\('chat\.page\.jumpToLatest'\),\s*onJumpToLatest: jumpToLatest,\s*inputProps: \{[\s\S]*activeChannel,[\s\S]*activeModel,[\s\S]*onChannelChange: handleChannelChange,[\s\S]*onModelChange: handleModelChange,[\s\S]*compactModelSelector,[\s\S]*\},\s*\};/s,
  );
  assert.match(presentationNavigationHookSource, /import \{ useNavigate \} from 'react-router-dom';/);
  assert.match(presentationNavigationHookSource, /const navigate = useNavigate\(\);/);
  assert.match(compactModelPreferenceHookSource, /import \{[\s\S]*settingsService,[\s\S]*\} from '@sdkwork\/claw-core';/s);
  assert.match(conversationPaneSource, /import \{ ChatComposerPanel \} from '\.\/ChatComposerPanel';/);
  assert.match(conversationPaneSource, /<ChatComposerPanel \{\.\.\.composerPanelProps\} \/>/);
  assert.match(composerPanelSource, /<ChatInput \{\.\.\.inputProps\} \/>/);
  assert.match(chatInputSource, /onModelChange/);
  assert.match(chatInputSource, /activeChannel/);
  assert.match(chatInputSource, /activeModel/);
  assert.doesNotMatch(chatInputSource, /Sparkles/);
  assert.doesNotMatch(chatInputSource, /readyWith/);
  assert.doesNotMatch(chatInputSource, /respondingWith/);
  assert.doesNotMatch(chatInputSource, /nextReplyUses/);
  assert.doesNotMatch(chatInputSource, /activeChannel\?\.icon/);
  assert.doesNotMatch(chatInputSource, /chat\.input\.modelLabel/);
  assert.doesNotMatch(chatInputSource, /min-h-\[88px\]/);
  assert.match(chatInputSource, /const actionButtonClassName =/);
  assert.match(chatInputSource, /const modelTriggerClassName =/);
  assert.match(chatInputSource, /createPortal/);
  assert.doesNotMatch(chatInputSource, /className="absolute bottom-full left-0 z-50/);
  assert.doesNotMatch(chatInputSource, /border-t border-zinc-200/);
  assert.match(chatInputSource, /dark:bg-transparent/);
});

await runTest('sdkwork-claw-chat derives active channel and model ids from instance config', () => {
  const chatPageCompositionSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageCompositionState.ts',
  );
  const modelPreferenceStateHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatModelPreferenceSourceState.ts',
  );

  assert.match(chatPageCompositionSource, /useChatPageSourceState/);
  assert.match(
    modelPreferenceStateHookSource,
    /activeChannelId: instanceConfig\?\.activeChannelId \|\| '',/,
  );
  assert.match(
    modelPreferenceStateHookSource,
    /activeModelId: instanceConfig\?\.activeModelId \|\| '',/,
  );
});

await runTest('sdkwork-claw-chat keeps page-local UI state inside a dedicated page hook', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatPageCompositionSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageCompositionState.ts',
  );
  const uiStateHookSource = read('packages/sdkwork-claw-chat/src/pages/useChatPageUiState.ts');

  assert.match(chatPageCompositionSource, /useChatPageUiState/);
  assert.doesNotMatch(chatPageSource, /import \{ useState \} from 'react';/);
  assert.doesNotMatch(
    chatPageSource,
    /const \[isSessionContextDrawerOpen, setIsSessionContextDrawerOpen\] = useState\(false\);/,
  );
  assert.doesNotMatch(
    chatPageSource,
    /const \[selectedSkillId, setSelectedSkillId\] = useState<string \| null>\(null\);/,
  );
  assert.doesNotMatch(
    chatPageSource,
    /const \[selectedAgentId, setSelectedAgentId\] = useState<string \| null>\(null\);/,
  );
  assert.match(uiStateHookSource, /import \{ useState \} from 'react';/);
  assert.match(uiStateHookSource, /export function useChatPageUiState\(\)/);
});

await runTest('sdkwork-claw-chat keeps route-level boundaries by consuming shared core services instead of other route packages', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const sourceStateHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageSourceState.ts',
  );
  const instanceSourceHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatInstanceSourceState.ts',
  );
  const modelPreferenceSourceHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatModelPreferenceSourceState.ts',
  );
  const chatContextCatalogHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatContextCatalogState.ts',
  );
  const chatSkillCatalogHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatSkillCatalogState.ts',
  );
  const chatServiceSource = read('packages/sdkwork-claw-chat/src/services/chatService.ts');
  const chatInputSource = read('packages/sdkwork-claw-chat/src/components/ChatInput.tsx');

  assert.doesNotMatch(chatPageSource, /from '@sdkwork\/claw-market'/);
  assert.doesNotMatch(chatPageSource, /from '@sdkwork\/claw-settings'/);
  assert.doesNotMatch(chatServiceSource, /from '@sdkwork\/claw-settings'/);
  assert.doesNotMatch(chatInputSource, /from '@sdkwork\/claw-settings'/);
  assert.doesNotMatch(chatPageSource, /from '@sdkwork\/claw-core'/);
  assert.doesNotMatch(sourceStateHookSource, /from '@sdkwork\/claw-core'/);
  assert.match(instanceSourceHookSource, /from '@sdkwork\/claw-core'/);
  assert.match(modelPreferenceSourceHookSource, /from '@sdkwork\/claw-core'/);
  assert.doesNotMatch(chatContextCatalogHookSource, /from '@sdkwork\/claw-core'/);
  assert.match(chatSkillCatalogHookSource, /from '@sdkwork\/claw-core'/);
  assert.match(chatServiceSource, /from '@sdkwork\/claw-core'/);
  assert.match(chatInputSource, /from '@sdkwork\/claw-core'/);
  assert.doesNotMatch(chatContextCatalogHookSource, /clawHubService/);
  assert.match(chatSkillCatalogHookSource, /clawHubService/);
  assert.match(chatServiceSource, /llmStore/);
  assert.doesNotMatch(chatServiceSource, /useLLMStore/);
});

await runTest('sdkwork-claw-chat routes model configuration entry points into settings after api-router removal', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const presentationNavigationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPresentationNavigation.ts',
  );
  const sessionContextDrawerPresentationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatSessionContextDrawerPresentationState.ts',
  );
  const conversationPanePresentationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatConversationPanePresentationState.ts',
  );

  assert.match(chatPageSource, /<ChatSessionContextDrawer \{\.\.\.sessionContextDrawerProps\} \/>/);
  assert.match(presentationNavigationHookSource, /navigate\('\/settings\?tab=api'\)/);
  assert.match(sessionContextDrawerPresentationHookSource, /onOpenSettings: handleOpenSettings,/);
  assert.match(conversationPanePresentationHookSource, /onOpenModelConfig: handleOpenModelConfig,/);
  assert.doesNotMatch(chatPageSource, /navigate\('\/settings\/llm'\)/);
  assert.doesNotMatch(chatPageSource, /navigate\('\/api-router'\)/);
});

await runTest('sdkwork-claw-chat resolves model catalogs through the shared provider routing catalog instead of studio mocks', () => {
  const serviceSource = read(
    'packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogService.ts',
  );

  assert.doesNotMatch(serviceSource, /studioMockService/);
  assert.match(serviceSource, /providerRoutingCatalogService/);
  assert.match(serviceSource, /from '@sdkwork\/claw-core'/);
});

await runTest('sdkwork-claw-chat model catalog runtime probing keys gateway behavior off route mode instead of the OpenClaw kernel id', () => {
  const coreSource = read(
    'packages/sdkwork-claw-chat/src/services/instanceEffectiveModelCatalogCore.ts',
  );

  assert.match(coreSource, /if \(route\.mode !== 'instanceOpenClawGatewayWs'\) \{/);
  assert.doesNotMatch(
    coreSource,
    /if \(route\.mode !== 'instanceOpenClawGatewayWs' \|\| instance\.runtimeKind !== 'openclaw'\) \{/,
  );
  assert.match(coreSource, /const gatewayModels = await this\.dependencies\.listGatewayModels\(instanceId\);/);
  assert.match(coreSource, /if \(!configPath\) \{/);
  assert.match(coreSource, /channels: buildRuntimeFallbackChannels\(gatewayModels\),/);
});

await runTest('sdkwork-claw-chat services barrel stays Node-safe for pure service tests', () => {
  const servicesIndexSource = read('packages/sdkwork-claw-chat/src/services/index.ts');
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');

  assert.doesNotMatch(servicesIndexSource, /clawChatService/);
  assert.doesNotMatch(servicesIndexSource, /react-i18next/);
  assert.doesNotMatch(chatStoreSource, /zustand/);
});

await runTest('sdkwork-claw-chat exposes the kernel-native chat standard across shared types, services, and store projections', () => {
  const typesIndexSource = read('packages/sdkwork-claw-types/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-chat/src/services/index.ts');
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');
  const agentServiceSource = read('packages/sdkwork-claw-chat/src/services/agentService.ts');
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatPageCompositionSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageCompositionState.ts',
  );
  const chatPageWorkspaceSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageWorkspaceState.ts',
  );
  const chatPageContractsSource = read(
    'packages/sdkwork-claw-chat/src/pages/chatPageContracts.ts',
  );
  const chatSessionViewHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatSessionViewState.ts',
  );
  const chatActiveSessionProjectionHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatActiveSessionProjectionState.ts',
  );
  const chatMessageDisplayHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatMessageDisplayState.ts',
  );
  const chatInteractionHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatInteractionState.ts',
  );
  const chatSendExecutionHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatSendExecutionState.ts',
  );
  const chatCheckRunner = read('scripts/run-sdkwork-chat-check.mjs');

  assert.ok(exists('packages/sdkwork-claw-types/src/kernelChatModel.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/openclaw/openClawKernelChatProjection.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/store/localChatKernelProjection.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/kernelChatAgentCatalogService.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/kernelChatSessionState.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/kernelChatMessageState.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatHttpMessagePayload.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatHttpStreamProtocol.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/kernelChatMessagePartsPresentation.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatSessionOwnerPresentation.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatSidebarAgentRailPresentation.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatSidebarChromePresentation.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/services/chatSidebarHistoryPresentation.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/chatPageContracts.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/useChatActiveSessionProjectionState.ts'));
  assert.ok(exists('packages/sdkwork-claw-chat/src/pages/useChatMessageDisplayState.ts'));
  assert.match(typesIndexSource, /kernelChatModel/);
  assert.match(servicesIndexSource, /chatSessionOwnerPresentation/);
  assert.match(servicesIndexSource, /chatHttpMessagePayload/);
  assert.match(servicesIndexSource, /chatHttpStreamProtocol/);
  assert.match(servicesIndexSource, /chatSidebarAgentRailPresentation/);
  assert.match(servicesIndexSource, /chatSidebarChromePresentation/);
  assert.match(servicesIndexSource, /chatSidebarHistoryPresentation/);
  assert.match(servicesIndexSource, /kernelChatMessagePartsPresentation/);
  assert.match(servicesIndexSource, /kernelChatAgentCatalogService/);
  assert.match(servicesIndexSource, /kernelChatSessionState/);
  assert.match(servicesIndexSource, /kernelChatMessageState/);
  assert.match(chatPageContractsSource, /export type ChatPageTranslate =/);
  assert.match(chatPageContractsSource, /export type ChatPageSendMode =/);
  assert.match(chatPageContractsSource, /export type ChatPageNewSessionModelMode =/);
  assert.match(chatPageContractsSource, /export type ChatPageAgentCatalogMode =/);
  assert.match(chatPageContractsSource, /export type ChatPageKernelSessionState = \{/);
  assert.match(chatPageContractsSource, /export type ChatPageRuntimeAdapterCapabilities =/);
  assert.match(chatPageContractsSource, /export type ChatPageSyncState = SyncState;/);
  assert.match(chatPageContractsSource, /export type ChatPageSelectableSessionRef = Pick<ChatSession, 'id'>;/);
  assert.match(chatPageContractsSource, /export type ChatPageSessionControlActions = \{/);
  assert.match(chatStoreSource, /kernelMessage\?: KernelChatMessage \| null;/);
  assert.match(chatStoreSource, /kernelSession\?: KernelChatSession \| null;/);
  assert.match(agentServiceSource, /kernelChatAgentCatalogService/);
  assert.match(chatPageSource, /useChatPageCompositionState/);
  assert.match(chatPageCompositionSource, /useChatPageWorkspaceState/);
  assert.match(chatPageWorkspaceSource, /useChatSessionViewState/);
  assert.match(chatPageWorkspaceSource, /useChatInteractionState/);
  assert.match(
    chatSessionViewHookSource,
    /import \{ useChatActiveSessionProjectionState \} from '\.\/useChatActiveSessionProjectionState';/,
  );
  assert.match(
    chatSessionViewHookSource,
    /import \{ useChatMessageDisplayState \} from '\.\/useChatMessageDisplayState';/,
  );
  assert.doesNotMatch(chatSessionViewHookSource, /resolveKernelChatSessionState/);
  assert.doesNotMatch(chatSessionViewHookSource, /resolveKernelChatMessageState/);
  assert.match(chatSessionViewHookSource, /from '\.\/chatPageContracts';/);
  assert.match(chatActiveSessionProjectionHookSource, /resolveKernelChatSessionState/);
  assert.match(chatActiveSessionProjectionHookSource, /from '\.\/chatPageContracts';/);
  assert.match(chatInteractionHookSource, /from '\.\/chatPageContracts';/);
  assert.match(chatMessageDisplayHookSource, /resolveKernelChatMessageState/);
  assert.match(chatSendExecutionHookSource, /createChatComposerSendActions/);
  assert.match(chatSendExecutionHookSource, /from '\.\/chatPageContracts';/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-types\/src\/kernelChatModel\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/kernelChatAgentCatalogService\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/kernelChatSessionState\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/kernelChatMessageState\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/chatSessionOwnerPresentation\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/chatHttpMessagePayload\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/chatHttpStreamProtocol\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/kernelChatMessagePartsPresentation\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/chatSidebarAgentRailPresentation\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/chatSidebarChromePresentation\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/chatSidebarHistoryPresentation\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/openclaw\/openClawKernelChatProjection\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/services\/store\/localChatKernelProjection\.test\.ts/);
  assert.match(chatCheckRunner, /packages\/sdkwork-claw-chat\/src\/store\/openClawGatewayKernelProjection\.test\.ts/);
});

await runTest('sdkwork-claw-chat parity checks use the shared Node TypeScript runner for Node-loaded chat services', () => {
  const workspacePackageJson = read('package.json');
  const chatCheckRunner = read('scripts/run-sdkwork-chat-check.mjs');
  const nodeTypeScriptRunner = read('scripts/run-node-typescript-check.mjs');

  assert.match(
    workspacePackageJson,
    /"check:sdkwork-chat"\s*:\s*"sdkwork-run-node scripts\/run-sdkwork-chat-check\.mjs"/,
  );
  assert.ok(exists('scripts/run-sdkwork-chat-check.mjs'));
  assert.ok(exists('scripts/run-node-typescript-check.mjs'));
  assert.match(nodeTypeScriptRunner, /--experimental-transform-types/);
  assert.match(nodeTypeScriptRunner, /--disable-warning=ExperimentalWarning/);
  assert.match(chatCheckRunner, /runNodeTypeScriptChecks/);
  assert.match(chatCheckRunner, /sdkwork-chat-contract\.test\.ts/);
  assert.doesNotMatch(chatCheckRunner, /tsx/);
});

await runTest('sdkwork-claw-chat chat service loads under Node without Vite env injection', async () => {
  const chatServiceModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-chat/src/services/chatService.ts'),
  ).href;
  const chatServiceModule =
    (await import(chatServiceModuleUrl)) as typeof import('../packages/sdkwork-claw-chat/src/services/chatService');

  assert.ok(chatServiceModule.chatService);
  assert.equal(typeof chatServiceModule.buildSystemInstruction, 'function');
});

await runTest('sdkwork-claw-chat chat service forbids browser-direct provider calls and env-key fallbacks', () => {
  const chatServiceSource = read('packages/sdkwork-claw-chat/src/services/chatService.ts');

  assert.doesNotMatch(chatServiceSource, /@google\/genai/);
  assert.doesNotMatch(chatServiceSource, /GoogleGenAI/);
  assert.doesNotMatch(chatServiceSource, /GenerateContentResponse/);
  assert.doesNotMatch(chatServiceSource, /VITE_ANTHROPIC_API_KEY/);
  assert.doesNotMatch(chatServiceSource, /VITE_GEMINI_API_KEY/);
  assert.doesNotMatch(chatServiceSource, /VITE_OPENAI_API_KEY/);
  assert.doesNotMatch(chatServiceSource, /API_KEY_MAP/);
  assert.doesNotMatch(chatServiceSource, /channel\.baseUrl}\/chat\/completions/);
  assert.doesNotMatch(chatServiceSource, /new GoogleGenAI/);
  assert.match(chatServiceSource, /Select or start an AI-compatible instance to chat\./);
  assert.match(chatServiceSource, /buildChatHttpRequestMessages/);
  assert.match(chatServiceSource, /normalizeChatTransportStream/);
});

await runTest('sdkwork-claw-chat chat service requires a real active instance before streaming', async () => {
  const chatServiceModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-chat/src/services/chatService.ts'),
  ).href;
  const instanceStoreModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-core/src/stores/instanceStore.ts'),
  ).href;
  const {
    chatService,
  } = (await import(chatServiceModuleUrl)) as typeof import('../packages/sdkwork-claw-chat/src/services/chatService');
  const {
    instanceStore,
  } = (await import(instanceStoreModuleUrl)) as typeof import('../packages/sdkwork-claw-core/src/stores/instanceStore');

  const initialState = instanceStore.getState();

  try {
    instanceStore.setState({
      ...initialState,
      activeInstanceId: null,
    });

    const chunks: string[] = [];
    for await (const chunk of chatService.sendMessageStream(
      null,
      'hello',
      {
        id: 'google/gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'google',
        icon: 'AI',
      },
      undefined,
      undefined,
    )) {
      chunks.push(chunk);
    }

    assert.deepEqual(chunks, [
      'Error: Select or start an AI-compatible instance to chat.',
    ]);
  } finally {
    instanceStore.setState(initialState, true);
  }
});

await runTest('sdkwork-claw-chat store tolerates migrated sessions without messages arrays', async () => {
  const storeModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-chat/src/store/chatStore.ts'),
  ).href;
  const { chatStore } = (await import(storeModuleUrl)) as typeof import('../packages/sdkwork-claw-chat/src/store/chatStore');

  const initialState = chatStore.getState();

  try {
    chatStore.setState({
      ...initialState,
      sessions: [
        {
          id: 'legacy-session',
          title: 'Legacy Session',
          createdAt: 1,
          updatedAt: 1,
          model: 'Gemini 3 Flash',
        } as any,
      ],
      activeSessionIdByInstance: {
        __direct__: 'legacy-session',
      },
    });

    chatStore.getState().addMessage('legacy-session', {
      role: 'user',
      content: 'hello from migrated state',
    });

    const legacySession = chatStore
      .getState()
      .sessions.find((session) => session.id === 'legacy-session');

    assert.ok(legacySession);
    assert.deepEqual(
      legacySession.messages.map((message) => ({
        content: message.content,
        role: message.role,
      })),
      [{ role: 'user', content: 'hello from migrated state' }],
    );
  } finally {
    chatStore.setState(initialState, true);
  }
});

await runTest('sdkwork-claw-chat derives a readable local session title from the first user message', async () => {
  const storeModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-chat/src/store/chatStore.ts'),
  ).href;
  const { chatStore } = (await import(storeModuleUrl)) as typeof import('../packages/sdkwork-claw-chat/src/store/chatStore');

  const initialState = chatStore.getState();

  try {
    chatStore.setState({
      ...initialState,
      sessions: [
        {
          id: 'fresh-session',
          title: 'New Conversation',
          createdAt: 1,
          updatedAt: 1,
          model: 'Gemini 3 Flash',
          messages: [],
        } as any,
      ],
      activeSessionIdByInstance: {
        __direct__: 'fresh-session',
      },
    });

    chatStore.getState().addMessage('fresh-session', {
      role: 'user',
      content:
        '  Build   an install checklist\n\nfor OpenClaw across macOS   and Windows, then summarize blockers  ',
    });

    const session = chatStore
      .getState()
      .sessions.find((entry) => entry.id === 'fresh-session');

    assert.ok(session);
    assert.equal(
      session.title,
      'Build an install checklist for OpenClaw across macOS and Windows, then summar...',
    );
  } finally {
    chatStore.setState(initialState, true);
  }
});

await runTest('sdkwork-claw-chat keeps active session state isolated per instance and hard-cuts instance chat onto adapter-owned authority', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');
  const localGatewaySource = read('packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts');
  const chatMappingSource = read('packages/sdkwork-claw-chat/src/chatSessionMapping.ts');
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatPageCompositionSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageCompositionState.ts',
  );
  const chatPageWorkspaceSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageWorkspaceState.ts',
  );
  const sourceStateHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageSourceState.ts',
  );
  const runtimeSourceHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatRuntimeSourceState.ts',
  );
  const chatPageRuntimeHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageRuntimeState.ts',
  );
  const chatInteractionHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatInteractionState.ts',
  );
  const chatSendExecutionHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatSendExecutionState.ts',
  );
  const chatSidebarSource = read('packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx');

  assert.match(chatStoreSource, /activeSessionIdByInstance/);
  assert.match(chatStoreSource, /syncStateByInstance/);
  assert.match(chatStoreSource, /connectGatewayInstances/);
  assert.match(chatStoreSource, /sendKernelMessage/);
  assert.match(chatStoreSource, /abortSession/);
  assert.match(chatStoreSource, /instanceRouteModeById/);
  assert.match(chatStoreSource, /instanceChatAdapterCapabilitiesById/);
  assert.match(chatStoreSource, /createAuthoritativeKernelChatAdapterRegistry/);
  assert.match(chatStoreSource, /transport\?: 'local' \| 'kernelAdapter' \| 'openclawGateway';/);
  assert.match(chatStoreSource, /transport: 'kernelAdapter'/);
  assert.match(localGatewaySource, /Instance-scoped kernel chat sessions are not persisted through the studio conversation store/);
  assert.match(localGatewaySource, /return \[\];/);
  assert.match(
    chatMappingSource,
    /Durable(?: or gateway-authoritative)? kernel chat sessions must not be persisted through the studio conversation store/,
  );
  assert.doesNotMatch(chatMappingSource, /hydrateLocalChatKernelProjection/);
  assert.match(chatPageSource, /useChatPageCompositionState/);
  assert.match(chatPageCompositionSource, /useChatPageSourceState/);
  assert.match(chatPageCompositionSource, /useChatPageWorkspaceState/);
  assert.match(sourceStateHookSource, /useChatRuntimeSourceState/);
  assert.match(runtimeSourceHookSource, /sendKernelMessage/);
  assert.match(runtimeSourceHookSource, /abortSession/);
  assert.match(chatPageWorkspaceSource, /useChatPageRuntimeState/);
  assert.match(chatPageRuntimeHookSource, /const activeAdapterCapabilities =/);
  assert.match(chatPageRuntimeHookSource, /const adapterRuntimeState = resolveChatRuntimeState\(/);
  assert.match(chatPageRuntimeHookSource, /const sendMode = adapterRuntimeState\.sendMode;/);
  assert.match(chatPageWorkspaceSource, /useChatInteractionState/);
  assert.match(chatSendExecutionHookSource, /const sessionRunActions = createChatSessionRunActions\(/);
  assert.match(chatPageWorkspaceSource, /sendKernelMessage/);
  assert.match(chatPageWorkspaceSource, /abortSession/);
  assert.match(chatSidebarSource, /resolveChatSidebarViewState/);
  assert.match(chatSidebarSource, /activeHistorySessions\.find\(\(session\) => session\.id === item\.sessionId\)/);
  assert.doesNotMatch(chatSidebarSource, /\{session\.title\}/);
});

await runTest('sdkwork-claw-chat does not fall back to local HTTP while an instance route is still unresolved', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatPageCompositionSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageCompositionState.ts',
  );
  const chatPageWorkspaceSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageWorkspaceState.ts',
  );
  const chatPageRuntimeHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageRuntimeState.ts',
  );
  const chatSessionViewHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatSessionViewState.ts',
  );
  const chatActiveSessionProjectionHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatActiveSessionProjectionState.ts',
  );
  const chatInteractionHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatInteractionState.ts',
  );
  const chatSendExecutionHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatSendExecutionState.ts',
  );

  assert.match(chatPageCompositionSource, /useChatPageWorkspaceState/);
  assert.match(
    chatPageRuntimeHookSource,
    /const routeMode = activeInstanceId \? instanceRouteModeById\[activeInstanceId\] : 'directLlm';/,
  );
  assert.match(chatPageRuntimeHookSource, /const adapterRuntimeState = resolveChatRuntimeState\(\{/);
  assert.match(chatPageRuntimeHookSource, /const isChatSupportedRoute = adapterRuntimeState\.isChatAvailable;/);
  assert.match(chatPageWorkspaceSource, /useChatPageRuntimeState/);
  assert.match(chatPageWorkspaceSource, /useChatSessionViewState/);
  assert.match(
    chatSessionViewHookSource,
    /useChatActiveSessionProjectionState\(\{/,
  );
  assert.match(
    chatActiveSessionProjectionHookSource,
    /const chatRuntimeState = resolveChatRuntimeState\(\{/,
  );
  assert.match(
    chatActiveSessionProjectionHookSource,
    /const isUnsupportedRoute = chatRuntimeState\.isBlocked;/,
  );
  assert.doesNotMatch(
    chatPageRuntimeHookSource,
    /const routeMode = activeInstanceId \? instanceRouteModeById\[activeInstanceId\] \?\? 'directLlm' : 'directLlm';/,
  );
  assert.match(
    chatSendExecutionHookSource,
    /const composerSendActions = createChatComposerSendActions\(\{\s*activeInstanceId,\s*selectedSessionId,\s*sendMode,\s*hasActiveChannel: Boolean\(activeChannel\),\s*isChatSupportedRoute,\s*isBusy,\s*hasPendingInstanceRoute: Boolean\(activeInstanceId && !routeMode\),/s,
  );
  assert.match(chatSendExecutionHookSource, /const handleSend = composerSendActions\.submit;/);
  assert.match(chatPageSource, /useChatPageCompositionState/);
  assert.doesNotMatch(
    chatPageSource,
    /if\s*\(\s*!activeModel\s*\|\|\s*!activeChannel\s*\|\|\s*!isChatSupportedRoute\s*\|\|\s*isBusy\s*\|\|\s*\(activeInstanceId && !routeMode\)\s*\)\s*\{/,
  );
});

await runTest('sdkwork-claw-chat re-hydrates the active instance when the same instance route authority changes after the route has already resolved', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatPageCompositionSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageCompositionState.ts',
  );
  const pageSynchronizationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageSynchronizationState.ts',
  );
  const runtimeSynchronizationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatRuntimeSynchronization.ts',
  );
  const instanceHydrationSynchronizationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatInstanceHydrationSynchronization.ts',
  );
  const servicesIndexSource = read('packages/sdkwork-claw-chat/src/services/index.ts');

  assert.match(
    servicesIndexSource,
    /export \* from '\.\/chatInstanceHydrationPolicy(?:\.ts)?';/,
  );
  assert.match(chatPageSource, /useChatPageCompositionState/);
  assert.match(
    chatPageCompositionSource,
    /import \{ useChatPageSynchronizationState \} from '\.\/useChatPageSynchronizationState';/,
  );
  assert.match(
    pageSynchronizationHookSource,
    /import \{[\s\S]*useChatRuntimeSynchronization[\s\S]*\} from '\.\/useChatRuntimeSynchronization';/s,
  );
  assert.match(
    pageSynchronizationHookSource,
    /useChatRuntimeSynchronization\(runtimeSynchronization\);/,
  );
  assert.match(
    runtimeSynchronizationHookSource,
    /import \{ useChatInstanceHydrationSynchronization \} from '\.\/useChatInstanceHydrationSynchronization';/,
  );
  assert.match(
    runtimeSynchronizationHookSource,
    /useChatInstanceHydrationSynchronization\(\{\s*activeInstanceId,\s*routeMode,\s*hydrateInstance,\s*\}\);/s,
  );
  assert.doesNotMatch(
    runtimeSynchronizationHookSource,
    /resolveChatInstanceHydrationKey/,
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
});

await runTest('sdkwork-claw-chat re-runs gateway warmup when directory status changes without requiring the warmed instance id set to change', () => {
  const warmersSource = read('packages/sdkwork-claw-chat/src/runtime/OpenClawGatewayConnections.tsx');
  const warmersPolicySource = read(
    'packages/sdkwork-claw-chat/src/runtime/openClawGatewayConnectionsPolicy.ts',
  );

  assert.match(
    warmersSource,
    /resolveOpenClawGatewayWarmRefreshKey,/,
  );
  assert.match(
    warmersSource,
    /const warmRefreshKey = useMemo\(\s*\(\)\s*=>\s*resolveOpenClawGatewayWarmRefreshKey\(\{\s*pathname: location\.pathname,\s*activeInstanceId,\s*directoryInstances: instances,\s*\}\),/s,
  );
  assert.match(
    warmersSource,
    /\}, \[\s*connectGatewayInstances,\s*instanceSignature,\s*shouldWarmConnections,\s*warmRefreshKey,\s*builtInStatusRefreshTick,\s*\]\);/s,
  );
  assert.match(
    warmersPolicySource,
    /export function resolveOpenClawGatewayWarmRefreshKey/,
  );
  assert.match(
    warmersPolicySource,
    /return plan\.instanceIds\s*\.map\(\(instanceId\) => `\$\{instanceId\}:\$\{statusByInstanceId\.get\(instanceId\) \?\? 'unknown'\}`\)\s*\.join\('\|'\);/s,
  );
});

await runTest('sdkwork-claw-chat re-runs gateway warmup for warmed instances when built-in OpenClaw runtime status events arrive outside directory polling', () => {
  const warmersSource = read('packages/sdkwork-claw-chat/src/runtime/OpenClawGatewayConnections.tsx');
  const warmersPolicySource = read(
    'packages/sdkwork-claw-chat/src/runtime/openClawGatewayConnectionsPolicy.ts',
  );

  assert.match(
    warmersSource,
    /import \{ runtime \} from '@sdkwork\/claw-infrastructure';/,
  );
  assert.match(
    warmersSource,
    /shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange,/,
  );
  assert.match(
    warmersSource,
    /const handleBuiltInOpenClawStatusChanged = useEffectEvent\(\s*\(event: \{ instanceId: string \}\) => \{/,
  );
  assert.match(
    warmersSource,
    /runtime\s*\.subscribeBuiltInOpenClawStatusChanged\(\(event\) => \{\s*handleBuiltInOpenClawStatusChanged\(event\);/s,
  );
  assert.match(
    warmersSource,
    /if\s*\(\s*!shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange\(\{\s*pathname: location\.pathname,\s*warmedInstanceIds: instanceIds,\s*eventInstanceId: event\.instanceId,\s*\}\)\s*\)\s*\{/s,
  );
  assert.match(
    warmersSource,
    /setBuiltInStatusRefreshTick\(\(current\) => current \+ 1\);/,
  );
  assert.match(
    warmersSource,
    /\}, \[\s*connectGatewayInstances,\s*instanceSignature,\s*shouldWarmConnections,\s*warmRefreshKey,\s*builtInStatusRefreshTick,\s*\]\);/s,
  );
  assert.match(
    warmersPolicySource,
    /export function shouldRefreshOpenClawGatewayWarmConnectionsForBuiltInStatusChange/,
  );
  assert.match(
    warmersPolicySource,
    /return normalizeInstanceIds\(params\.warmedInstanceIds \?\? \[\]\)\.includes\(eventInstanceId\);/,
  );
});

await runTest('sdkwork-claw-chat wires OpenClaw history config into the gateway session store', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');

  assert.match(chatStoreSource, /openClawGatewayHistoryConfigService/);
  assert.match(chatStoreSource, /resolveHistoryMaxChars\(instanceId\)/);
  assert.match(
    chatStoreSource,
    /openClawGatewayHistoryConfigService\.getHistoryMaxChars\(instanceId\)/,
  );
});

await runTest('sdkwork-claw-chat re-resolves authoritative instance routes before session creation mutations instead of trusting stale cached modes', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');

  assert.match(
    chatStoreSource,
    /async createSession\(model, instanceId, options\) \{[\s\S]*const resolvedContext = await resolveInstanceChatContext\(instanceId\);/s,
  );
  assert.match(
    chatStoreSource,
    /async startNewSession\(model, instanceId, options\) \{[\s\S]*const resolvedContext = await resolveInstanceChatContext\(instanceId\);/s,
  );
  assert.doesNotMatch(
    chatStoreSource,
    /get\(\)\.instanceRouteModeById\[instanceId\] !== undefined/,
  );
});

await runTest('sdkwork-claw-chat re-resolves authoritative instance routes before session selection mutations instead of trusting stale cached modes', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');

  assert.match(
    chatStoreSource,
    /async setActiveSession\(id, instanceId\) \{[\s\S]*const resolvedContext = await resolveInstanceChatContext\(resolvedInstanceId\);/s,
  );
  assert.doesNotMatch(
    chatStoreSource,
    /async setActiveSession\(id, instanceId\) \{[\s\S]*get\(\)\.instanceRouteModeById\[resolvedInstanceId\] === 'instanceOpenClawGatewayWs'/s,
  );
});

await runTest('sdkwork-claw-chat re-resolves authoritative instance routes before gateway-backed session deletion and reset mutations', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');

  assert.match(
    chatStoreSource,
    /async deleteSession\(id, instanceId\) \{[\s\S]*if \(isGatewayAuthoritativeStoredSession\(session\) && resolvedInstanceId\) \{[\s\S]*const resolvedContext = await resolveInstanceChatContext\(resolvedInstanceId\);/s,
  );
  assert.match(
    chatStoreSource,
    /async clearSession\(id, instanceId\) \{[\s\S]*if \(isGatewayAuthoritativeStoredSession\(session\) && resolvedInstanceId\) \{[\s\S]*const resolvedContext = await resolveInstanceChatContext\(resolvedInstanceId\);/s,
  );
  assert.doesNotMatch(
    chatStoreSource,
    /async clearSession\(id, instanceId\) \{[\s\S]*const resolvedRoute = await resolveInstanceRouteMode\(resolvedInstanceId\);/s,
  );
  assert.doesNotMatch(
    chatStoreSource,
    /async deleteSession\(id, instanceId\) \{[\s\S]*if \(session\?\.transport === 'openclawGateway' && resolvedInstanceId\) \{/s,
  );
  assert.doesNotMatch(
    chatStoreSource,
    /async clearSession\(id, instanceId\) \{[\s\S]*if \(session\?\.transport === 'openclawGateway' && resolvedInstanceId\) \{/s,
  );
});

await runTest('sdkwork-claw-chat transport-backed session deletion keeps active fallback inside authoritative adapter scope instead of reusing stale gateway sessions', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');

  assert.match(
    chatStoreSource,
    /const nextAdapterSessions = listScopeAdapterSessions\(nextSessions, resolvedInstanceId\);/,
  );
  assert.match(
    chatStoreSource,
    /return applyAdapterInstanceScopeState\(state, resolvedInstanceId, \{\s*baseSessions: nextSessions,\s*preservedAdapterSessions: nextAdapterSessions,\s*\}\);/s,
  );
});

await runTest('sdkwork-claw-chat transport-backed session creation keeps the authoritative instance scope adapter-only', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');

  assert.match(
    chatStoreSource,
    /const nextAdapterSessions = listScopeAdapterSessions\(nextSessions, instanceId\);[\s\S]*return applyAdapterInstanceScopeState\(state, instanceId, \{\s*baseSessions: nextSessions,\s*preservedAdapterSessions: nextAdapterSessions,\s*preferredActiveSessionId: session\.id,/s,
  );
  assert.doesNotMatch(chatStoreSource, /persistSession\(/);
});

await runTest('sdkwork-claw-chat transport-backed session clearing and flush keep the active scope adapter-only', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');

  assert.match(
    chatStoreSource,
    /async clearSession\(id, instanceId\) \{[\s\S]*const nextAdapterSessions = listScopeAdapterSessions\(nextSessions, resolvedInstanceId\);[\s\S]*return applyAdapterInstanceScopeState\(state, resolvedInstanceId, \{\s*baseSessions: nextSessions,\s*preservedAdapterSessions: nextAdapterSessions,\s*preferredActiveSessionId: id,/s,
  );
  assert.match(
    chatStoreSource,
    /async flushSession\(id\) \{[\s\S]*const sessionInstanceId = session\.instanceId;[\s\S]*const nextAdapterSessions = listScopeAdapterSessions\(state\.sessions, sessionInstanceId\);[\s\S]*return applyAdapterInstanceScopeState\(state, sessionInstanceId, \{\s*preservedAdapterSessions: nextAdapterSessions,\s*preferredActiveSessionId: session\.id,\s*syncState: 'idle',\s*lastError: undefined,\s*\}\);/s,
  );
});

await runTest('sdkwork-claw-chat transport-backed message append and edit mutations keep authoritative instance scope adapter-only', () => {
  const chatStoreSource = read('packages/sdkwork-claw-chat/src/store/chatStore.ts');

  assert.match(
    chatStoreSource,
    /addMessage\(sessionId, message\) \{[\s\S]*const nextAdapterSessions = listScopeAdapterSessions\(nextSessions, nextSession\.instanceId\);[\s\S]*applyAdapterInstanceScopeState\(state, nextSession\.instanceId, \{\s*baseSessions: nextSessions,\s*preservedAdapterSessions: nextAdapterSessions,/s,
  );
  assert.match(
    chatStoreSource,
    /updateMessage\(sessionId, messageId, content\) \{[\s\S]*const nextAdapterSessions = listScopeAdapterSessions\(nextSessions, updatedInstanceId\);[\s\S]*applyAdapterInstanceScopeState\(state, updatedInstanceId, \{\s*baseSessions: nextSessions,\s*preservedAdapterSessions: nextAdapterSessions,/s,
  );
});

await runTest('sdkwork-claw-chat bootstrap state machine does not auto-create local sessions while hydration is in an error state', () => {
  const bootstrapSource = read('packages/sdkwork-claw-chat/src/services/chatSessionBootstrap.ts');

  assert.match(
    bootstrapSource,
    /if \(params\.syncState === 'error'\) \{\s*return \{ type: 'idle' \};\s*\}/,
  );
  assert.match(
    bootstrapSource,
    /if \(!params\.sendMode\) \{\s*return \{ type: 'idle' \};\s*\}/,
  );
  assert.doesNotMatch(
    bootstrapSource,
    /params\.sendMode \?\? \(params\.routeMode === 'instanceOpenClawGatewayWs' \? 'gateway' : 'local'\)/,
  );
});

await runTest('sdkwork-claw-chat llm store does not seed default browser-direct provider channels', () => {
  const llmStoreSource = read('packages/sdkwork-claw-settings/src/store/useLLMStore.ts');

  assert.doesNotMatch(llmStoreSource, /const DEFAULT_CHANNELS:/);
  assert.doesNotMatch(llmStoreSource, /channels:\s*DEFAULT_CHANNELS/);
  assert.doesNotMatch(llmStoreSource, /activeChannelId:\s*'google-gemini'/);
  assert.doesNotMatch(llmStoreSource, /activeModelId:\s*'gemini-3-flash-preview'/);
});

await runTest('sdkwork-claw-chat resolves runtime chat routes for multiple claw instance kinds', async () => {
  const runtimeRouteModuleUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-chat/src/services/instanceChatRouteService.ts'),
  ).href;
  const { resolveInstanceChatRoute } =
    (await import(runtimeRouteModuleUrl)) as typeof import('../packages/sdkwork-claw-chat/src/services/instanceChatRouteService');

  const openClawRoute = resolveInstanceChatRoute({
    id: 'local-built-in',
    name: 'Local Built-In',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: 'bundled',
    typeLabel: 'Built-In OpenClaw',
    host: '127.0.0.1',
    port: 18789,
    baseUrl: 'http://127.0.0.1:18789',
    websocketUrl: 'ws://127.0.0.1:18789',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '18789',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18789',
      websocketUrl: 'ws://127.0.0.1:18789',
    },
    createdAt: 1,
    updatedAt: 1,
  });

  const legacyOpenClawRoute = resolveInstanceChatRoute({
    id: 'openclaw-legacy-http',
    name: 'OpenClaw Legacy HTTP',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-external',
    transportKind: 'customHttp',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '0.6.0',
    typeLabel: 'OpenClaw Legacy',
    host: '127.0.0.1',
    port: 18795,
    baseUrl: 'http://127.0.0.1:18795/v1/chat/completions',
    websocketUrl: 'ws://127.0.0.1:18795/ws',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '18795',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18795/v1/chat/completions',
      websocketUrl: 'ws://127.0.0.1:18795/ws',
    },
    createdAt: 1,
    updatedAt: 1,
  });

  const zeroClawRoute = resolveInstanceChatRoute({
    id: 'zero-remote',
    name: 'Zero Remote',
    runtimeKind: 'zeroclaw',
    deploymentMode: 'remote',
    transportKind: 'zeroclawHttp',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '1.0.0',
    typeLabel: 'ZeroClaw',
    host: 'zero.example.com',
    port: 443,
    baseUrl: 'https://zero.example.com/',
    websocketUrl: null,
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat'],
    storage: {
      provider: 'postgres',
      namespace: 'studio.chat',
    },
    config: {
      port: '443',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'https://zero.example.com/',
      websocketUrl: null,
    },
    createdAt: 1,
    updatedAt: 1,
  });

  const ironClawRoute = resolveInstanceChatRoute({
    id: 'iron-remote',
    name: 'Iron Remote',
    runtimeKind: 'ironclaw',
    deploymentMode: 'remote',
    transportKind: 'ironclawWeb',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '0.3.0',
    typeLabel: 'IronClaw',
    host: 'iron.example.com',
    port: 443,
    baseUrl: 'https://iron.example.com',
    websocketUrl: null,
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat'],
    storage: {
      provider: 'postgres',
      namespace: 'studio.chat',
    },
    config: {
      port: '443',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'https://iron.example.com',
      websocketUrl: null,
    },
    createdAt: 1,
    updatedAt: 1,
  });

  const customWebSocketRoute = resolveInstanceChatRoute({
    id: 'custom-ws',
    name: 'Custom WS',
    runtimeKind: 'custom',
    deploymentMode: 'remote',
    transportKind: 'customWs',
    status: 'online',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: 'custom',
    typeLabel: 'Custom',
    host: 'custom.example.com',
    port: 443,
    baseUrl: null,
    websocketUrl: 'wss://custom.example.com/ws',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat'],
    storage: {
      provider: 'remoteApi',
      namespace: 'studio.chat',
    },
    config: {
      port: '443',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: null,
      websocketUrl: 'wss://custom.example.com/ws',
    },
    createdAt: 1,
    updatedAt: 1,
  });

  const offlineExternalOpenClawRoute = resolveInstanceChatRoute({
    id: 'openclaw-external-offline',
    name: 'OpenClaw External Offline',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-external',
    transportKind: 'openclawGatewayWs',
    status: 'offline',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '0.6.0',
    typeLabel: 'OpenClaw External',
    host: '127.0.0.1',
    port: 18798,
    baseUrl: 'http://127.0.0.1:18798',
    websocketUrl: 'ws://127.0.0.1:18798',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health'],
    storage: {
      provider: 'localFile',
      namespace: 'claw-studio',
    },
    config: {
      port: '18798',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'http://127.0.0.1:18798',
      websocketUrl: 'ws://127.0.0.1:18798',
    },
    createdAt: 1,
    updatedAt: 1,
  });

  const offlineRemoteOpenClawRoute = resolveInstanceChatRoute({
    id: 'openclaw-remote-offline',
    name: 'OpenClaw Remote Offline',
    runtimeKind: 'openclaw',
    deploymentMode: 'remote',
    transportKind: 'openclawGatewayWs',
    status: 'error',
    isBuiltIn: false,
    isDefault: false,
    iconType: 'server',
    version: '0.6.0',
    typeLabel: 'OpenClaw Remote',
    host: 'openclaw.example.com',
    port: 443,
    baseUrl: 'https://openclaw.example.com',
    websocketUrl: 'wss://openclaw.example.com/ws',
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health'],
    storage: {
      provider: 'remoteApi',
      namespace: 'claw-studio',
    },
    config: {
      port: '443',
      sandbox: true,
      autoUpdate: false,
      logLevel: 'info',
      corsOrigins: '*',
      baseUrl: 'https://openclaw.example.com',
      websocketUrl: 'wss://openclaw.example.com/ws',
    },
    createdAt: 1,
    updatedAt: 1,
  });

  assert.equal(openClawRoute.mode, 'instanceOpenClawGatewayWs');
  assert.equal(openClawRoute.endpoint, undefined);
  assert.equal(openClawRoute.websocketUrl, 'ws://127.0.0.1:18789');
  assert.equal(openClawRoute.runtimeKind, 'openclaw');
  assert.equal(legacyOpenClawRoute.mode, 'instanceOpenClawGatewayWs');
  assert.equal(legacyOpenClawRoute.endpoint, 'http://127.0.0.1:18795/v1/chat/completions');
  assert.equal(legacyOpenClawRoute.websocketUrl, 'ws://127.0.0.1:18795');
  assert.equal(offlineExternalOpenClawRoute.mode, 'unsupported');
  assert.match(offlineExternalOpenClawRoute.reason ?? '', /not online|offline|start|running/i);
  assert.equal(offlineRemoteOpenClawRoute.mode, 'unsupported');
  assert.match(offlineRemoteOpenClawRoute.reason ?? '', /not online|offline|start|running/i);
  assert.equal(zeroClawRoute.mode, 'instanceOpenAiHttp');
  assert.equal(zeroClawRoute.endpoint, 'https://zero.example.com/chat/completions');
  assert.equal(ironClawRoute.mode, 'instanceSseHttp');
  assert.equal(ironClawRoute.endpoint, 'https://iron.example.com/api/chat/completions');
  assert.equal(customWebSocketRoute.mode, 'instanceWebSocket');
  assert.equal(customWebSocketRoute.websocketUrl, 'wss://custom.example.com/ws');
  assert.equal(resolveInstanceChatRoute(null).mode, 'directLlm');
});

await runTest('sdkwork-claw-chat reflows chrome before text gets squeezed on smaller screens', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const chatPageCompositionSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatPageCompositionState.ts',
  );
  const sidebarChromeSource = read(
    'packages/sdkwork-claw-chat/src/components/ChatSidebarChrome.tsx',
  );
  const conversationPaneSource = read(
    'packages/sdkwork-claw-chat/src/components/ChatConversationPane.tsx',
  );
  const conversationPanePresentationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatConversationPanePresentationState.ts',
  );
  const sidebarHookSource = read('packages/sdkwork-claw-chat/src/pages/useChatSidebarState.ts');
  const chatSidebarSource = read('packages/sdkwork-claw-chat/src/components/ChatSidebar.tsx');
  const chatSidebarViewStateSource = read(
    'packages/sdkwork-claw-chat/src/services/chatSidebarViewState.ts',
  );
  const topControlsSource = read('packages/sdkwork-claw-chat/src/components/ChatTopControls.tsx');
  const composerPanelSource = read('packages/sdkwork-claw-chat/src/components/ChatComposerPanel.tsx');
  const chatInputSource = read('packages/sdkwork-claw-chat/src/components/ChatInput.tsx');
  const chatMessageSource = read('packages/sdkwork-claw-chat/src/components/ChatMessage.tsx');
  const createAgentMenuSource = read(
    'packages/sdkwork-claw-chat/src/components/ChatSidebarCreateAgentMenu.tsx',
  );
  const sidebarItemPrimitivesSource = read(
    'packages/sdkwork-claw-chat/src/components/chatSidebarItemPrimitives.ts',
  );
  const sessionActionMenuSource = read(
    'packages/sdkwork-claw-chat/src/components/ChatSidebarSessionActionMenu.tsx',
  );
  const chatChromeSurfaceSource = read(
    'packages/sdkwork-claw-chat/src/components/chatChromeSurface.ts',
  );
  const englishChatLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/en/chat.json');
  const chineseChatLocaleSource = read('packages/sdkwork-claw-i18n/src/locales/zh/chat.json');

  assert.match(chatPageSource, /useChatPageCompositionState/);
  assert.match(
    chatPageCompositionSource,
    /import \{ useChatSidebarState \} from '\.\/useChatSidebarState';/,
  );
  assert.match(
    chatPageCompositionSource,
    /const\s*\{\s*isSidebarOpen,\s*closeSidebar,\s*openSidebar,\s*sidebarBackdropLabel,\s*desktopSidebarProps,\s*mobileSidebarProps,\s*\}\s*=\s*useChatSidebarState\(\{[\s\S]*t,[\s\S]*sourceState,[\s\S]*pageUiState,[\s\S]*workspaceState,[\s\S]*\}\);/s,
  );
  assert.match(chatPageSource, /import \{ ChatSidebarChrome \} from '\.\.\/components\/ChatSidebarChrome';/);
  assert.match(chatPageSource, /<ChatSidebarChrome \{\.\.\.sidebarChromeProps\} \/>/);
  assert.match(
    chatPageCompositionSource,
    /sidebarChromeProps:\s*\{[\s\S]*desktopSidebarProps,[\s\S]*mobileSidebarProps,[\s\S]*\}/s,
  );
  assert.doesNotMatch(chatPageSource, /className="hidden h-full w-72 shrink-0 lg:flex xl:w-80"/);
  assert.doesNotMatch(chatPageSource, /className="fixed inset-0 z-40 bg-zinc-950\/45 backdrop-blur-sm lg:hidden"/);
  assert.doesNotMatch(chatPageSource, /className="fixed inset-y-0 left-0 z-50 w-\[min\(22rem,calc\(100vw-1rem\)\)\] lg:hidden"/);
  assert.match(sidebarChromeSource, /const CHAT_SIDEBAR_WIDTH_STORAGE_KEY = 'claw-studio\.chat\.sidebar\.width';/);
  assert.match(sidebarChromeSource, /className="group\/chat-sidebar-resize relative hidden h-full shrink-0 lg:flex"/);
  assert.match(sidebarChromeSource, /style=\{\{ width: `\$\{sidebarWidth\}px` \}\}/);
  assert.match(sidebarChromeSource, /className="absolute inset-y-0 right-\[-6px\] z-20 hidden w-3 cursor-col-resize touch-none lg:flex"/);
  assert.match(sidebarChromeSource, /onDoubleClick=\{handleDesktopSidebarReset\}/);
  assert.match(sidebarChromeSource, /event\.currentTarget\.setPointerCapture\(event\.pointerId\);/);
  assert.match(sidebarChromeSource, /className="fixed inset-0 z-40 bg-zinc-950\/45 backdrop-blur-sm lg:hidden"/);
  assert.match(sidebarChromeSource, /className="fixed inset-y-0 left-0 z-50 w-\[min\(22rem,calc\(100vw-1rem\)\)\] lg:hidden"/);
  assert.match(chatPageSource, /import \{ ChatConversationPane \} from '\.\.\/components\/ChatConversationPane';/);
  assert.match(
    chatPageCompositionSource,
    /import \{ useChatPagePresentationPropsState \} from '\.\/useChatPagePresentationPropsState';/,
  );
  assert.match(sidebarHookSource, /const \[isSidebarOpen, setIsSidebarOpen\] = useState\(false\);/);
  assert.match(sidebarHookSource, /const sharedSidebarProps = \{/);
  assert.match(sidebarHookSource, /desktopSidebarProps: sharedSidebarProps,/);
  assert.match(
    sidebarHookSource,
    /mobileSidebarProps: \{[\s\S]*\.\.\.sharedSidebarProps,[\s\S]*async onSelectAgent\(selection\) \{[\s\S]*const result = await handleAgentSelection\(selection\);[\s\S]*if \(result\.status === 'completed'\) \{[\s\S]*closeSidebar\(\);[\s\S]*\}[\s\S]*\},[\s\S]*async onSessionSelect\(selection\) \{[\s\S]*const result = await handleSessionSelection\(selection\);[\s\S]*if \(result\.status === 'completed'\) \{[\s\S]*closeSidebar\(\);[\s\S]*\}[\s\S]*\},[\s\S]*onClose: closeSidebar,[\s\S]*\},/s,
  );
  assert.match(conversationPaneSource, /import \{ ChatTopControls \} from '\.\/ChatTopControls';/);
  assert.match(conversationPaneSource, /import \{ ChatComposerPanel \} from '\.\/ChatComposerPanel';/);
  assert.match(conversationPaneSource, /className="relative flex h-full min-w-0 flex-1 flex-col"/);
  assert.doesNotMatch(chatPageSource, /className="relative flex h-full min-w-0 flex-1 flex-col pt-11 sm:pt-12"/);
  assert.match(conversationPaneSource, /className="min-h-0 flex-1 overflow-y-auto scrollbar-hide"/);
  assert.match(chatChromeSurfaceSource, /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =/);
  assert.match(chatChromeSurfaceSource, /flex-shrink-0 bg-transparent px-3 pb-3 pt-1\.5 sm:px-4 sm:pb-4 sm:pt-2 lg:px-6/);
  assert.doesNotMatch(chatChromeSurfaceSource, /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =\s*'[^']*border-t[^']*';/);
  assert.doesNotMatch(chatChromeSurfaceSource, /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =\s*'[^']*bg-gradient-to-t[^']*';/);
  assert.doesNotMatch(chatChromeSurfaceSource, /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =\s*'[^']*backdrop-blur-xl[^']*';/);
  assert.match(conversationPaneSource, /<div className=\{CHAT_CHROME_COMPOSER_LAYER_CLASS\}>/);
  assert.doesNotMatch(chatPageSource, /const composerSurfaceRef = useRef<HTMLDivElement \| null>\(null\);/);
  assert.doesNotMatch(chatPageSource, /const \[composerSurfaceHeight, setComposerSurfaceHeight\] = useState\(0\);/);
  assert.doesNotMatch(chatPageSource, /const messageListBottomPadding = `calc\(\$\{composerSurfaceHeight \+ 32\}px \+ env\(safe-area-inset-bottom\)\)`;/);
  assert.doesNotMatch(chatPageSource, /const emptyStateBottomPadding = `calc\(\$\{composerSurfaceHeight \+ 52\}px \+ env\(safe-area-inset-bottom\)\)`;/);
  assert.doesNotMatch(chatPageSource, /style=\{\{\s*paddingBottom: messageListBottomPadding,\s*\}\}/);
  assert.doesNotMatch(chatPageSource, /new ResizeObserver\(\(\[entry\]\) => \{/);
  assert.match(conversationPaneSource, /mx-auto flex w-full max-w-6xl text-\[10px\] tracking-normal text-zinc-400 dark:text-zinc-500/);
  assert.match(
    conversationPaneSource,
    /group\.role === 'user'\s*\?\s*'justify-end pl-4 pr-2 sm:pl-6 sm:pr-3 lg:pl-8 lg:pr-4'\s*:\s*'justify-start px-4 sm:px-6 lg:px-8'/,
  );
  assert.match(conversationPaneSource, /flex min-w-0 max-w-full flex-wrap items-center gap-x-1\.5 gap-y-0\.5/);
  assert.match(conversationPaneSource, /<span className="truncate font-medium text-zinc-500 dark:text-zinc-400">/);
  assert.match(conversationPaneSource, /<span className="shrink-0 text-zinc-300 dark:text-zinc-600">\/<\/span>/);
  assert.match(conversationPaneSource, /<span className="truncate text-zinc-400 dark:text-zinc-500">\s*\{group\.footer\.modelLabel\}\s*<\/span>/);
  assert.doesNotMatch(conversationPaneSource, /rounded-full border border-zinc-200 bg-white\/80 px-2 py-0\.5 text-\[10px\] font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900\/70 dark:text-zinc-300/);
  assert.doesNotMatch(conversationPaneSource, /'inline-flex shrink-0 items-center gap-1\.5 rounded-full border px-2\.5 py-1 text-\[11px\] font-semibold'/);
  assert.match(topControlsSource, /className="pointer-events-none absolute left-2\.5 top-2\.5 z-20 sm:left-3 sm:top-3 lg:hidden"/);
  assert.match(topControlsSource, /className="pointer-events-none absolute right-2\.5 top-2\.5 z-20 sm:right-3 sm:top-3 lg:right-4"/);
  assert.doesNotMatch(topControlsSource, /lg:right-32 xl:right-36/);
  assert.match(composerPanelSource, /className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8"/);
  assert.match(composerPanelSource, /<ChatInput \{\.\.\.inputProps\} \/>/);
  assert.match(conversationPanePresentationHookSource, /const topControlsProps = \{/);

  assert.match(
    chatSidebarSource,
    /onSessionSelect\?: \([\s\S]*selection\?: ChatSidebarSessionSelection[\s\S]*\) =>[\s\S]*Promise<ChatSidebarSelectionActionResult \| void>[\s\S]*ChatSidebarSelectionActionResult[\s\S]*void;/s,
  );
  assert.match(
    chatSidebarSource,
    /onSelectAgent\?: \([\s\S]*selection: ChatSidebarAgentSelection[\s\S]*\) =>[\s\S]*Promise<ChatSidebarSelectionActionResult \| void>[\s\S]*ChatSidebarSelectionActionResult[\s\S]*void;/s,
  );
  assert.match(chatSidebarSource, /onClose\?: \(\) => void;/);
  assert.match(chatSidebarSource, /selectionErrorMessage\?: string \| null;/);
  assert.match(chatSidebarSource, /onDismissSelectionError\?: \(\) => void;/);
  assert.match(
    chatSidebarSource,
    /selectionErrorMessage \? \([\s\S]*t\('chat\.sidebar\.dismissSelectionError'\)[\s\S]*onDismissSelectionError\?\.\(\)[\s\S]*\) : null/s,
  );
  assert.match(chatSidebarSource, /resolveChatSidebarViewState/);
  assert.match(chatSidebarSource, /'flex h-full min-h-0 w-full flex-col border-r border-zinc-200 bg-zinc-50\/50/);
  assert.match(chatSidebarSource, /<h3 className="mb-1\.5 px-3 text-\[10px\] font-medium uppercase tracking-\[0\.14em\] text-zinc-400 dark:text-zinc-500">/);
  assert.match(chatSidebarSource, /chat\.sidebar\.mainAgentBadge/);
  assert.match(chatSidebarSource, /from '\.\/chatSidebarItemPrimitives';/);
  assert.match(chatSidebarSource, /CHAT_SIDEBAR_ROW_BUTTON_CLASS/);
  assert.match(chatSidebarSource, /CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS/);
  assert.match(chatSidebarSource, /CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS/);
  assert.match(chatSidebarSource, /CHAT_SIDEBAR_PREVIEW_TEXT_CLASS/);
  assert.match(chatSidebarSource, /CHAT_SIDEBAR_TIME_LABEL_CLASS/);
  assert.match(chatSidebarSource, /className="group relative"/);
  assert.match(
    sidebarItemPrimitivesSource,
    /'flex w-full items-stretch gap-3 rounded-\[0\.75rem\] px-3 py-3 text-left transition-colors disabled:cursor-wait'/,
  );
  assert.match(sidebarItemPrimitivesSource, /export const CHAT_SIDEBAR_ROW_BUTTON_CLASS =/);
  assert.match(sidebarItemPrimitivesSource, /export const CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS =/);
  assert.match(sidebarItemPrimitivesSource, /export const CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS =/);
  assert.match(sidebarItemPrimitivesSource, /export const CHAT_SIDEBAR_PRIMARY_BADGE_CLASS =/);
  assert.match(sidebarItemPrimitivesSource, /export const CHAT_SIDEBAR_PREVIEW_TEXT_CLASS =/);
  assert.match(sidebarItemPrimitivesSource, /export const CHAT_SIDEBAR_TIME_LABEL_CLASS =/);
  assert.match(sidebarItemPrimitivesSource, /export const SESSION_OWNER_SLOT_CLASS =/);
  assert.match(sidebarItemPrimitivesSource, /export const SESSION_KERNEL_SLOT_CLASS =/);
  assert.match(sidebarItemPrimitivesSource, /export function resolveKernelBadgeLabel\(/);
  assert.match(chatSidebarSource, /<div className="min-w-0 flex-1 overflow-hidden">/);
  assert.match(chatSidebarSource, /<span className=\{SESSION_OWNER_SLOT_CLASS\} title=\{agent\.name\}>/);
  assert.match(
    chatSidebarViewStateSource,
    /const agentRail = resolveChatSidebarAgentRailPresentation\(\{[\s\S]*agentOptions: params\.agentOptions,[\s\S]*sessions: instanceSessions,[\s\S]*activeSessionId: params\.activeSessionId,[\s\S]*isChatSupported: params\.isChatSupported,[\s\S]*sessionScopeMode: params\.sessionScopeMode,[\s\S]*selectedAgentId: effectiveSelectedAgentId,[\s\S]*primaryAgentId: params\.primaryAgentId,[\s\S]*previewLabels: params\.previewLabels,[\s\S]*relativeTimeLabels: params\.relativeTimeLabels,[\s\S]*locale: params\.locale,[\s\S]*timeZone: params\.timeZone,[\s\S]*emptyPreviewLabel: params\.agentRailEmptyPreviewLabel,[\s\S]*\}\);/s,
  );
  assert.match(
    chatSidebarViewStateSource,
    /const sidebarChrome = resolveChatSidebarChromePresentation\(\{[\s\S]*agentRailItemCount: agentRail\.items\.length,[\s\S]*historySections: activeSidebarHistory\.sections,[\s\S]*totalHistoryItems: activeSidebarHistory\.totalItems,[\s\S]*\}\);/s,
  );
  assert.match(
    chatSidebarViewStateSource,
    /const currentAgentHistory = resolveChatSidebarHistoryPresentation\(\{[\s\S]*sessions: currentAgentHistorySessions,[\s\S]*selectedSessionId:[\s\S]*sessionScopeMode: params\.sessionScopeMode,[\s\S]*sessionScopeAgentId: params\.sessionScopeAgentId,[\s\S]*agentOptions: params\.agentOptions,[\s\S]*fallbackMainAgentName: params\.fallbackMainAgentName,[\s\S]*previewLabels: params\.previewLabels,[\s\S]*locale: params\.locale,[\s\S]*\}\);/s,
  );
  assert.doesNotMatch(chatSidebarSource, /const SESSION_OWNER_SLOT_CLASS =/);
  assert.doesNotMatch(chatSidebarSource, /const SESSION_KERNEL_SLOT_CLASS =/);
  assert.doesNotMatch(chatSidebarSource, /function resolveKernelBadgeLabel\(/);
  assert.match(chatSidebarSource, /className=\{SESSION_OWNER_SLOT_CLASS\}/);
  assert.match(
    chatSidebarSource,
    /item\.ownerKernelLabel \?\s*\(\s*<span className=\{SESSION_KERNEL_SLOT_CLASS\} title=\{item\.ownerKernelLabel\}>[\s\S]*\{resolveKernelBadgeLabel\(item\.ownerKernelLabel\)\}[\s\S]*<\/span>\s*\) : null/,
  );
  assert.match(
    chatSidebarSource,
    /agent\.kernelLabel \?\s*\(\s*<span className=\{SESSION_KERNEL_SLOT_CLASS\} title=\{agent\.kernelLabel\}>[\s\S]*\{resolveKernelBadgeLabel\(agent\.kernelLabel\)\}[\s\S]*<\/span>\s*\) : null/,
  );
  assert.match(
    chatSidebarSource,
    /const agentPreviewText = agent\.preview \?\? t\('chat\.sidebar\.agentRailEmptyPreview'\);/,
  );
  assert.match(chatSidebarSource, /agent\.relativeTimeLabel \?\s*\(/);
  assert.match(chatSidebarSource, /<span className=\{SESSION_OWNER_SLOT_CLASS\} title=\{agent\.name\}>/);
  assert.match(
    chatSidebarSource,
    /<p[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_PREVIEW_TEXT_CLASS,[\s\S]*\)\}[\s\S]*>\s*\{agentPreviewText\}\s*<\/p>/,
  );
  assert.doesNotMatch(
    chatSidebarSource,
    /agent\.kernelLabel \?\s*\(\s*<span className="mt-0\.5 block truncate text-\[10px\] font-medium uppercase tracking-\[0\.12em\] text-zinc-400 dark:text-zinc-500">\s*\{agent\.kernelLabel\}\s*<\/span>\s*\) : null/,
  );
  assert.match(chatSidebarSource, /<div className="flex min-w-0 items-center gap-1\.5">/);
  assert.match(chatSidebarSource, /item\.pinOrigin === 'system' \?\s*\(/);
  assert.match(chatSidebarSource, /item\.pinOrigin === 'user' \?\s*\(/);
  assert.match(chatSidebarSource, /item\.isFavorited \?\s*\(/);
  assert.match(chatSidebarSource, /item\.hasUnread \?\s*\(/);
  assert.match(
    chatSidebarSource,
    /<span[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_TIME_LABEL_CLASS,[\s\S]*'transition-opacity',[\s\S]*\)\}[\s\S]*>\s*\{item\.relativeTimeLabel\}\s*<\/span>/,
  );
  assert.match(
    chatSidebarSource,
    /<p[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_PREVIEW_TEXT_CLASS,[\s\S]*\)\}[\s\S]*>\s*\{previewText\}\s*<\/p>/,
  );
  assert.match(
    chatSidebarSource,
    /sidebarChrome\.showAgentRail[\s\S]*visibleAgentRailItems\.map\(renderAgentRailItem\)/s,
  );
  assert.match(chatSidebarSource, /const \[agentSearchQuery, setAgentSearchQuery\] = React\.useState\(''\);/);
  assert.match(chatSidebarSource, /const visibleAgentRailItems = React\.useMemo\(\(\) => \{/);
  assert.match(chatSidebarSource, /placeholder=\{t\('chat\.sidebar\.agentSearchPlaceholder'\)\}/);
  assert.match(chatSidebarSource, /openCreateAgentMenuAtElement\(event\.currentTarget, event\.currentTarget\)/);
  assert.match(chatSidebarSource, /closeSessionMenu\(\);\s*setCreateAgentMenuState\(\{/);
  assert.match(chatSidebarSource, /onSelectAction=\{handleCreateAgentMenuAction\}/);
  assert.match(chatSidebarSource, /className="max-h-\[22\.875rem\] overflow-y-auto pr-1"/);
  assert.match(chatSidebarSource, /visibleAgentRailItems\.length === 0 && agentSearchQuery\.trim\(\)/);
  assert.match(chatSidebarSource, /title=\{t\('chat\.sidebar\.newAgentOptions'\)\}/);
  assert.match(chatSidebarSource, /aria-label=\{t\('chat\.sidebar\.newAgentOptions'\)\}/);
  assert.match(chatSidebarSource, /if \(isCreateAgentMenuOpen\) \{\s*closeCreateAgentMenu\(\);\s*return;\s*\}/);
  assert.match(chatSidebarSource, /<span>\{t\('chat\.sidebar\.createButtonLabel'\)\}<\/span>/);
  assert.doesNotMatch(chatSidebarSource, /hidden sm:inline/);
  assert.match(createAgentMenuSource, /role="menu"/);
  assert.match(createAgentMenuSource, /action\.id === 'custom'/);
  assert.match(createAgentMenuSource, /action\.id === 'library'/);
  assert.match(createAgentMenuSource, /action\.id === 'market'/);
  assert.match(createAgentMenuSource, /action\.id === 'copy'/);
  assert.match(createAgentMenuSource, /aria-label=\{closeLabel\}/);
  assert.match(createAgentMenuSource, /\.focus\(\{ preventScroll: true \}\)/);
  assert.match(
    chatSidebarSource,
    /sidebarChrome\.sections\.map\(\(\{ section, titleKey \}\) => \([\s\S]*renderSessionGroup\(section, t\(titleKey\)\)[\s\S]*<\/React\.Fragment>/s,
  );
  assert.match(
    chatSidebarSource,
    /className=\{cn\(\s*'absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-zinc-900\/\[0\.06\] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white\/\[0\.08\] dark:hover:text-zinc-200',[\s\S]*\)\}/,
  );
  assert.match(chatSidebarSource, /event\.key === 'Enter'/);
  assert.match(chatSidebarSource, /event\.key === ' '/);
  assert.match(chatSidebarSource, /event\.key === 'ContextMenu'/);
  assert.match(chatSidebarSource, /event\.shiftKey && event\.key === 'F10'/);
  assert.match(
    chatSidebarSource,
    /openSessionMenuAtElement\(event\.currentTarget, item, event\.currentTarget\)/,
  );
  assert.match(chatSidebarSource, /closeCreateAgentMenu\(\);\s*setSessionMenuState\(\{/);
  assert.match(
    chatSidebarSource,
    /if \(isSessionMenuOpen\) \{\s*closeSessionMenu\(\);\s*return;\s*\}[\s\S]*openSessionMenuAtElement\(event\.currentTarget, item, event\.currentTarget\);/,
  );
  assert.match(chatSidebarSource, /group-hover:opacity-0 group-focus-within:opacity-0/);
  assert.match(chatSidebarSource, /aria-haspopup="menu"/);
  assert.match(chatSidebarSource, /aria-expanded=\{isSessionMenuOpen\}/);
  assert.match(
    chatSidebarSource,
    /closeLabel=\{t\('chat\.sidebar\.dismissSessionActionsMenu'\)\}/,
  );
  assert.match(
    chatSidebarSource,
    /restoreFocusElement=\{sessionMenuState\?\.restoreFocusElement \?\? null\}/,
  );
  assert.match(
    chatSidebarSource,
    /group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100/,
  );
  assert.match(sessionActionMenuSource, /aria-label=\{closeLabel\}/);
  assert.match(sessionActionMenuSource, /\.focus\(\{ preventScroll: true \}\)/);
  assert.match(englishChatLocaleSource, /"agentSearchPlaceholder":\s*"Search current agents\.\.\."/);
  assert.match(englishChatLocaleSource, /"agentRailEmptyPreview":\s*"No conversations yet"/);
  assert.match(englishChatLocaleSource, /"createButtonLabel":\s*"Create"/);
  assert.match(englishChatLocaleSource, /"newAgentOptions":\s*"Create Agent options"/);
  assert.match(englishChatLocaleSource, /"dismissCreateAgentMenu":\s*"Close create agent menu"/);
  assert.match(englishChatLocaleSource, /"selectAgentFailed":\s*"Unable to switch to the selected agent\."/);
  assert.match(englishChatLocaleSource, /"selectSessionFailed":\s*"Unable to open the selected conversation\."/);
  assert.match(englishChatLocaleSource, /"dismissSelectionError":\s*"Dismiss"/);
  assert.match(chineseChatLocaleSource, /"agentSearchPlaceholder":/);
  assert.match(chineseChatLocaleSource, /"agentRailEmptyPreview":/);
  assert.match(chineseChatLocaleSource, /"createButtonLabel":/);
  assert.match(chineseChatLocaleSource, /"dismissCreateAgentMenu":/);
  assert.match(chineseChatLocaleSource, /"selectAgentFailed":/);
  assert.match(chineseChatLocaleSource, /"selectSessionFailed":/);
  assert.match(chineseChatLocaleSource, /"dismissSelectionError":/);
  assert.match(englishChatLocaleSource, /"dismissSessionActionsMenu":\s*"Close session actions menu"/);
  assert.match(chineseChatLocaleSource, /"dismissSessionActionsMenu":/);
  assert.doesNotMatch(chatSidebarSource, /resolveChatSessionOwnerPresentation/);
  assert.doesNotMatch(chatSidebarSource, /presentChatSessionListItem/);
  assert.doesNotMatch(chatSidebarSource, /agentItems/);
  assert.doesNotMatch(chatSidebarSource, /sectionTitleKeyById/);
  assert.doesNotMatch(chatSidebarSource, /const SESSION_TIME_SLOT_CLASS =/);
  assert.doesNotMatch(chatSidebarSource, /<div className=\{SESSION_TIME_SLOT_CLASS\}>/);
  assert.doesNotMatch(chatSidebarSource, /className="rounded-md p-1 opacity-100 transition-opacity hover:bg-zinc-900\/\[0\.06\] sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-white\/\[0\.08\]"/);
  assert.match(chatSidebarSource, /const historyTabs = \[/);
  assert.match(chatSidebarSource, /id: 'currentAgent'/);
  assert.match(chatSidebarSource, /id: 'allSessions'/);

  assert.match(chatInputSource, /const viewportPadding = window\.innerWidth < 640 \? 12 : 16;/);
  assert.match(chatInputSource, /Math\.max\(window\.innerWidth < 640 \? 280 : 320/);
  assert.match(chatInputSource, /className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"/);
  assert.match(chatInputSource, /truncate max-w-\[8\.5rem\] sm:max-w-\[12rem\] lg:max-w-\[16rem\]/);
  assert.doesNotMatch(chatInputSource, /chat\.input\.disclaimer/);

  assert.match(chatMessageSource, /group mx-auto flex w-full max-w-6xl transition-all duration-300/);
  assert.match(
    chatMessageSource,
    /isUser\s*\?\s*'justify-end pl-4 pr-2 sm:pl-6 sm:pr-3 lg:pl-8 lg:pr-4'\s*:\s*'justify-start px-4 sm:px-6 lg:px-8'/,
  );
  assert.match(
    chatMessageSource,
    /rounded-br-md bg-zinc-100 px-3\.5 py-1\.5 text-zinc-900 sm:max-w-\[95%\] dark:bg-zinc-800 dark:text-zinc-100/,
  );
  assert.match(chatMessageSource, /:\s*isTool\s*\?\s*'w-full px-0 py-0 text-zinc-900 dark:text-zinc-100'\s*:\s*'w-full px-0 py-0 text-zinc-900 dark:text-zinc-100'/);
  assert.match(chatMessageSource, /CHAT_SURFACE_PANEL_CLASS,/);
  assert.match(chatMessageSource, /'relative mb-4 mt-3 min-w-0 overflow-hidden rounded-xl dark:bg-\[#1E1E1E\]'/);
  assert.match(chatMessageSource, /prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mb-2 prose-headings:mt-4 prose-a:text-primary-500 hover:prose-a:text-primary-600/);
  assert.match(chatMessageSource, /'prose prose-zinc prose-sm relative max-w-none break-words text-\[14px\] leading-6 dark:prose-invert sm:prose-sm'/);
  assert.match(chatMessageSource, /prose-code:before:content-none prose-code:after:content-none prose-p:my-2 prose-p:leading-6 prose-pre:my-3 prose-pre:bg-transparent prose-pre:p-0 prose-ul:my-2 prose-ol:my-2/);
  assert.match(chatMessageSource, /attachments\.length > 0 \? \(\s*<div className="mb-2\.5 grid gap-3 sm:grid-cols-2">/);
  assert.match(chatMessageSource, /reasoning \? \(\s*<details[\s\S]*CHAT_SURFACE_INSET_PANEL_CLASS,[\s\S]*'mb-2\.5 overflow-hidden dark:bg-zinc-900\/65'/s);
  assert.match(
    chatMessageSource,
    /<div className=\{hasRenderableContent \? 'mt-1\.5' : (?:undefined|null)\}>/,
  );
  assert.match(chatMessageSource, /opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100/);
  assert.match(chatMessageSource, /const showFloatingCopyAction = !showHeader && canCopyMessage && \(isUser \|\| role === 'assistant'\);/);
  assert.match(chatMessageSource, /'min-w-0 flex-1',\s*showFloatingCopyAction && 'relative pr-11 sm:pr-12'/);
  assert.match(chatMessageSource, /className=\{cn\(\s*'absolute right-0 top-0 z-10 flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100'/);
  assert.doesNotMatch(chatMessageSource, /sm:prose-base/);
  assert.doesNotMatch(chatMessageSource, /showAvatar\?: boolean;/);
  assert.doesNotMatch(chatMessageSource, /reserveAvatarSpace\?: boolean;/);
  assert.doesNotMatch(chatMessageSource, /<Bot className=/);
});

await runTest('sdkwork-claw-chat empty state scales from stacked mobile welcome to a balanced desktop split layout', () => {
  const chatPageSource = read('packages/sdkwork-claw-chat/src/pages/Chat.tsx');
  const conversationPaneSource = read(
    'packages/sdkwork-claw-chat/src/components/ChatConversationPane.tsx',
  );
  const conversationPanePresentationHookSource = read(
    'packages/sdkwork-claw-chat/src/pages/useChatConversationPanePresentationState.ts',
  );
  const chatEmptyStateSource = read('packages/sdkwork-claw-chat/src/components/ChatEmptyState.tsx');

  assert.match(chatPageSource, /import \{ ChatConversationPane \} from '\.\.\/components\/ChatConversationPane';/);
  assert.match(conversationPaneSource, /import \{ ChatEmptyState \} from '\.\/ChatEmptyState';/);
  assert.match(conversationPaneSource, /className="flex min-h-full flex-1 items-center justify-center px-3 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10"/);
  assert.match(conversationPanePresentationHookSource, /const appName = t\('common\.productName'\);/);
  assert.match(conversationPanePresentationHookSource, /const emptyStateHighlights = \[/);
  assert.match(conversationPanePresentationHookSource, /description: emptyStateDescription,/);
  assert.match(conversationPanePresentationHookSource, /highlights: emptyStateHighlights,/);
  assert.match(conversationPaneSource, /<ChatEmptyState \{\.\.\.emptyStateProps\} \/>/);
  assert.match(chatEmptyStateSource, /className="grid w-full max-w-6xl gap-4 lg:grid-cols-\[minmax\(0,1\.05fr\)_minmax\(20rem,0\.95fr\)\] lg:items-center xl:gap-6"/);
  assert.match(chatEmptyStateSource, /CHAT_SURFACE_ELEVATED_PANEL_CLASS,/);
  assert.match(chatEmptyStateSource, /'flex flex-col items-center p-6 text-center sm:p-8 lg:items-start lg:p-10 lg:text-left'/);
  assert.match(chatEmptyStateSource, /className="mb-6 inline-flex items-center rounded-full border border-primary-500\/15 bg-primary-500\/8 px-3 py-1 text-xs font-semibold tracking-\[0\.16em\] text-primary-600/);
  assert.match(chatEmptyStateSource, /className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"/);
  assert.match(chatEmptyStateSource, /CHAT_SURFACE_INTERACTIVE_PANEL_CLASS,/);
  assert.match(chatEmptyStateSource, /'group relative flex min-h-\[8\.5rem\] flex-col justify-between overflow-hidden p-5 text-left'/);
});
