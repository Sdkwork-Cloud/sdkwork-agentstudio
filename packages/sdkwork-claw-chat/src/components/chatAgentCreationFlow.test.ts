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

const sidebarSource = readFileSync(new URL('./ChatSidebar.tsx', import.meta.url), 'utf8');
const myAgentsDialogSource = readFileSync(
  new URL('./ChatMyAgentsDialog.tsx', import.meta.url),
  'utf8',
);
const agentLibraryDialogSource = readFileSync(
  new URL('./ChatAgentLibraryDialog.tsx', import.meta.url),
  'utf8',
);
const agentTemplatePickerDialogSource = readFileSync(
  new URL('./ChatAgentTemplatePickerDialog.tsx', import.meta.url),
  'utf8',
);
const agentCreationWorkflowDialogSource = readFileSync(
  new URL('./ChatAgentCreationWorkflowDialog.tsx', import.meta.url),
  'utf8',
);
const agentMarketDialogSource = readFileSync(
  new URL('./ChatAgentMarketDialog.tsx', import.meta.url),
  'utf8',
);
const newAgentDialogSource = readFileSync(
  new URL('./ChatNewAgentDialog.tsx', import.meta.url),
  'utf8',
);
const sidebarStateSource = readFileSync(
  new URL('../pages/useChatSidebarState.ts', import.meta.url),
  'utf8',
);

await runTest(
  'Chat sidebar keeps every create-agent mode local to the chat surface and routes all creation flows through one centered workflow modal instead of chaining multiple dialogs',
  () => {
    assert.match(
      sidebarSource,
      /import \{ ChatAgentCreationWorkflowDialog \} from '\.\/ChatAgentCreationWorkflowDialog';/,
    );
    assert.match(
      sidebarSource,
      /const \[agentCreationDialogMode, setAgentCreationDialogMode\] = React\.useState<ChatSidebarCreateAgentMenuActionId \| null>\(null\);/,
    );
    assert.match(
      sidebarSource,
      /const isAgentCreationDialogOpen = agentCreationDialogMode !== null;/,
    );
    assert.match(
      sidebarSource,
      /id: 'copy' as const,[\s\S]*description: t\('chat\.sidebar\.createAgentFromMyAgentsDescription'\),[\s\S]*disabled: !activeInstanceId,/s,
    );
    assert.match(
      sidebarSource,
      /if \(actionId === 'custom'\) \{[\s\S]*setAgentCreationDialogMode\('custom'\);[\s\S]*return;[\s\S]*\}/s,
    );
    assert.match(
      sidebarSource,
      /if \(actionId === 'copy'\) \{[\s\S]*if \(activeInstanceId\) \{[\s\S]*setAgentCreationDialogMode\('copy'\);[\s\S]*\}[\s\S]*return;[\s\S]*\}/s,
    );
    assert.match(
      sidebarSource,
      /if \(actionId === 'library'\) \{[\s\S]*setAgentCreationDialogMode\('library'\);[\s\S]*return;[\s\S]*\}/s,
    );
    assert.match(
      sidebarSource,
      /if \(actionId === 'market'\) \{[\s\S]*setAgentCreationDialogMode\('market'\);[\s\S]*return;[\s\S]*\}/s,
    );
    assert.match(
      sidebarSource,
      /<ChatAgentCreationWorkflowDialog[\s\S]*open=\{isAgentCreationDialogOpen\}[\s\S]*mode=\{agentCreationDialogMode\}[\s\S]*instanceId=\{activeInstanceId\}[\s\S]*onOpenChange=\{\(nextOpen\) => \{[\s\S]*if \(!nextOpen\) \{[\s\S]*setAgentCreationDialogMode\(null\);[\s\S]*return;[\s\S]*\}[\s\S]*\}\}[\s\S]*onCreated=\{async \(result\) => \{[\s\S]*return await onAgentCreated\?\.\(result\);[\s\S]*\}\}/s,
    );
    assert.doesNotMatch(sidebarSource, /const \[isMyAgentsDialogOpen, setIsMyAgentsDialogOpen\] = React\.useState\(false\);/);
    assert.doesNotMatch(sidebarSource, /const \[isAgentLibraryDialogOpen, setIsAgentLibraryDialogOpen\] = React\.useState\(false\);/);
    assert.doesNotMatch(sidebarSource, /const \[isAgentMarketDialogOpen, setIsAgentMarketDialogOpen\] = React\.useState\(false\);/);
    assert.doesNotMatch(sidebarSource, /const \[newAgentDialogMode, setNewAgentDialogMode\] = React\.useState<'create' \| 'copy'>\('create'\);/);
    assert.doesNotMatch(sidebarSource, /const \[newAgentDialogDraft, setNewAgentDialogDraft\] = React\.useState<ChatAgentDraft \| null>\(null\);/);
    assert.doesNotMatch(sidebarSource, /window\.requestAnimationFrame/);
    assert.doesNotMatch(sidebarSource, /<ChatNewAgentDialog/);
    assert.doesNotMatch(sidebarSource, /<ChatMyAgentsDialog/);
    assert.doesNotMatch(sidebarSource, /<ChatAgentLibraryDialog/);
    assert.doesNotMatch(sidebarSource, /<ChatAgentMarketDialog/);
    assert.doesNotMatch(sidebarSource, /onOpenAgentLibrary\?\.\(\)/);
    assert.doesNotMatch(sidebarSource, /onOpenAgentMarket\?\.\(\)/);
  },
);

await runTest(
  'Chat agent creation workflow dialog keeps custom, library, my-agent, and market flows inside one modal shell and switches to inline copy configuration without closing the dialog',
  () => {
    assert.match(
      agentCreationWorkflowDialogSource,
      /import \{[\s\S]*createChatAgentDraftFromLibraryAgent,[\s\S]*type ChatAgentDraft,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /import \{ ChatNewAgentDialog \} from '\.\/ChatNewAgentDialog';/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /import \{ ChatMyAgentsDialog \} from '\.\/ChatMyAgentsDialog';/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /import \{ ChatAgentLibraryDialog \} from '\.\/ChatAgentLibraryDialog';/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /import \{ ChatAgentMarketDialog \} from '\.\/ChatAgentMarketDialog';/,
    );
    assert.match(agentCreationWorkflowDialogSource, /mode: ChatSidebarCreateAgentMenuActionId \| null;/);
    assert.match(
      agentCreationWorkflowDialogSource,
      /const \[selectedTemplateAgent, setSelectedTemplateAgent\] = React\.useState<KernelAgentLibraryItem \| null>\(null\);/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /const \[selectedTemplateDraft, setSelectedTemplateDraft\] = React\.useState<ChatAgentDraft \| null>\(null\);/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /const workflowView = React\.useMemo\(\(\) => \{/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /if \(mode === 'market'\) \{\s*return 'market';\s*\}/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /if \(mode === 'custom'\) \{\s*return 'form';\s*\}/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /if \(selectedTemplateAgent\) \{\s*return 'form';\s*\}/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /const handleSelectTemplateAgent = React\.useCallback\(\(\s*agent: KernelAgentLibraryItem,\s*\) => \{\s*setSelectedTemplateAgent\(agent\);\s*setSelectedTemplateDraft\(createChatAgentDraftFromLibraryAgent\(agent\)\);\s*\}, \[\]\);/s,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /<Dialog[\s\S]*open=\{open\}[\s\S]*onOpenChange=\{onOpenChange\}[\s\S]*>/s,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /<OverlaySurface[\s\S]*isOpen=\{open\}[\s\S]*onClose=\{\(\) => onOpenChange\(false\)\}[\s\S]*className="max-h-\[calc\(100dvh-2rem\)\] w-\[min\(72rem,calc\(100vw-2rem\)\)\] max-w-none overflow-y-auto p-6"/,
    );
    assert.match(agentCreationWorkflowDialogSource, /embedded/);
    assert.match(
      agentCreationWorkflowDialogSource,
      /workflowView === 'market' \?\s*\(/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /mode === 'copy' \?\s*\(/,
    );
    assert.match(
      agentCreationWorkflowDialogSource,
      /<ChatNewAgentDialog[\s\S]*embedded[\s\S]*mode=\{mode === 'custom' \? 'create' : 'copy'\}[\s\S]*initialDraft=\{selectedTemplateDraft\}[\s\S]*sourceAgent=\{selectedTemplateAgent\}/s,
    );
  },
);

await runTest(
  'Chat my agents dialog loads owned agents from the persisted kernel agent catalog and preserves a searchable modal copy flow',
  () => {
    assert.match(myAgentsDialogSource, /import \{ useQuery \} from '@tanstack\/react-query';/);
    assert.match(
      myAgentsDialogSource,
      /import \{ ChatAgentTemplatePickerDialog \} from '\.\/ChatAgentTemplatePickerDialog';/,
    );
    assert.match(
      myAgentsDialogSource,
      /import \{[\s\S]*kernelOwnedAgentLibraryService,[\s\S]*type KernelAgentLibraryItem[\s\S]*\} from '@sdkwork\/claw-core';/s,
    );
    assert.match(myAgentsDialogSource, /instanceId: string \| null \| undefined;/);
    assert.match(
      myAgentsDialogSource,
      /queryKey: \['chat', 'owned-kernel-agent-library', instanceId\],/,
    );
    assert.match(
      myAgentsDialogSource,
      /queryFn: \(\) => kernelOwnedAgentLibraryService\.listAgents\(instanceId\),/,
    );
    assert.match(myAgentsDialogSource, /enabled: open && Boolean\(instanceId\),/);
    assert.match(
      myAgentsDialogSource,
      /onSelectAgentTemplate: \(agent: KernelAgentLibraryItem\) => void;/,
    );
    assert.match(myAgentsDialogSource, /embedded\?: boolean;/);
    assert.match(myAgentsDialogSource, /<ChatAgentTemplatePickerDialog/);
    assert.doesNotMatch(myAgentsDialogSource, /function buildLibraryAgentKey/);
  },
);

await runTest(
  'Chat agent library dialog keeps template selection local to the chat experience and exposes reusable local kernel templates in a centered modal',
  () => {
    assert.match(agentLibraryDialogSource, /import \{ useQuery \} from '@tanstack\/react-query';/);
    assert.match(
      agentLibraryDialogSource,
      /import \{ ChatAgentTemplatePickerDialog \} from '\.\/ChatAgentTemplatePickerDialog';/,
    );
    assert.match(
      agentLibraryDialogSource,
      /import \{[\s\S]*kernelAgentLibraryService,[\s\S]*type KernelAgentLibraryItem[\s\S]*\} from '@sdkwork\/claw-core';/s,
    );
    assert.match(
      agentLibraryDialogSource,
      /queryKey: \['chat', 'kernel-agent-library'\],/,
    );
    assert.match(
      agentLibraryDialogSource,
      /queryFn: \(\) => kernelAgentLibraryService\.listAgents\(\),/,
    );
    assert.match(agentLibraryDialogSource, /onSelectAgentTemplate: \(agent: KernelAgentLibraryItem\) => void;/);
    assert.match(agentLibraryDialogSource, /embedded\?: boolean;/);
    assert.match(agentLibraryDialogSource, /<ChatAgentTemplatePickerDialog/);
    assert.doesNotMatch(agentLibraryDialogSource, /function buildLibraryAgentKey/);
  },
);

await runTest(
  'Chat agent template picker dialog centralizes centered modal layout, search, and pure template selection behavior for reusable local-kernel creation flows',
  () => {
    assert.match(
      agentTemplatePickerDialogSource,
      /import \{[\s\S]*filterChatAgentTemplates,[\s\S]*resolveChatAgentTemplateKey,[\s\S]*resolveChatAgentTemplateSelectionKey[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      agentTemplatePickerDialogSource,
      /<DialogContent className="left-1\/2 top-1\/2 w-\[min\(72rem,calc\(100vw-2rem\)\)\] max-w-none translate-x-\[-50%\] translate-y-\[-50%\]">/,
    );
    assert.match(agentTemplatePickerDialogSource, /type="search"/);
    assert.match(
      agentTemplatePickerDialogSource,
      /const filteredAgents = React\.useMemo\(\s*\(\) => filterChatAgentTemplates\(agents, searchQuery\),/s,
    );
    assert.match(
      agentTemplatePickerDialogSource,
      /const effectiveSelectedAgentKey = React\.useMemo\(\s*\(\) => resolveChatAgentTemplateSelectionKey\(filteredAgents, selectedAgentKey\),/s,
    );
    assert.match(agentTemplatePickerDialogSource, /embedded\?: boolean;/);
    assert.match(agentTemplatePickerDialogSource, /const content = \(/);
    assert.match(agentTemplatePickerDialogSource, /if \(embedded\) \{\s*return content;\s*\}/);
  },
);

await runTest(
  'Chat agent market dialog keeps curated market installation inside the chat flow and emits install results back into the active sidebar selection without hardcoding a kernel id in the UI',
  () => {
    assert.match(
      agentMarketDialogSource,
      /import \{[\s\S]*agentInstallService,[\s\S]*AGENT_MARKET_TEMPLATES,[\s\S]*createAgentMarketCatalog,[\s\S]*type AgentInstallTarget,[\s\S]*type AgentMarketTemplate[\s\S]*\} from '@sdkwork\/claw-core';/s,
    );
    assert.match(agentMarketDialogSource, /instanceId: string \| null \| undefined;/);
    assert.match(agentMarketDialogSource, /embedded\?: boolean;/);
    assert.match(
      agentMarketDialogSource,
      /onInstalled: \([\s\S]*result: CreateKernelAgentResult,[\s\S]*\) =>[\s\S]*Promise<ChatAgentCreationFollowUpResult \| void>[\s\S]*ChatAgentCreationFollowUpResult[\s\S]*void;/s,
    );
    assert.match(agentMarketDialogSource, /agentInstallService\.listInstallTargets\(\)/);
    assert.match(agentMarketDialogSource, /agentInstallService\.installTemplate\(/);
    assert.match(agentMarketDialogSource, /createAgentMarketCatalog\(\{/);
    assert.match(
      agentMarketDialogSource,
      /const installTarget =[\s\S]*modalTargets\.find\([\s\S]*target\.id === effectiveSelectedTargetId[\s\S]*\)\s*\|\|\s*null;/s,
    );
    assert.match(
      agentMarketDialogSource,
      /await onInstalled\(\{[\s\S]*instanceId: effectiveSelectedTargetId,[\s\S]*kernelId: installTarget\.kernelId,[\s\S]*agentId: selectedTemplate\.id,[\s\S]*displayName: selectedTemplate\.name,[\s\S]*\}\)/s,
    );
    assert.doesNotMatch(agentMarketDialogSource, /kernelId:\s*'openclaw'/);
    assert.match(
      agentMarketDialogSource,
      /<DialogContent className="left-1\/2 top-1\/2 w-\[min\(72rem,calc\(100vw-2rem\)\)\] max-w-none translate-x-\[-50%\] translate-y-\[-50%\]">/,
    );
    assert.match(
      agentMarketDialogSource,
      /resolveChatAgentMarketSelectedTemplateId\(catalog\.templates, selectedTemplateId\)/,
    );
    assert.match(
      agentMarketDialogSource,
      /resolveChatAgentMarketSelectedTargetId\(\{[\s\S]*targets: modalTargets,[\s\S]*selectedTargetId,[\s\S]*\}\)/s,
    );
    assert.match(agentMarketDialogSource, /const content = \(/);
    assert.match(agentMarketDialogSource, /if \(embedded\) \{\s*return content;\s*\}/);
  },
);

await runTest(
  'Chat agent market dialog resets closed-modal mutation state through a stable effect callback to avoid render loops',
  () => {
    assert.match(
      agentMarketDialogSource,
      /const resetInstallMutation = React\.useEffectEvent\(\(\) => \{\s*installMutation\.reset\(\);\s*\}\);/s,
    );
    assert.match(
      agentMarketDialogSource,
      /React\.useEffect\(\(\) => \{\s*if \(!open\) \{[\s\S]*resetInstallMutation\(\);[\s\S]*\}\s*\}, \[open, resetInstallMutation\]\);/s,
    );
    assert.doesNotMatch(
      agentMarketDialogSource,
      /\}, \[installMutation, open\]\);/,
    );
  },
);

await runTest(
  'Chat new agent dialog reuses shared draft helpers and accepts copy-mode prefills from local kernel agent templates in a centered modal',
  () => {
    assert.match(
      newAgentDialogSource,
      /import \{[\s\S]*buildChatAgentCreateRequest,[\s\S]*createChatAgentDraft,[\s\S]*parseChatAgentOptionalNumber,[\s\S]*resolveKernelAgentCreationFieldSupport,[\s\S]*slugifyChatAgentId,[\s\S]*type ChatAgentDraft[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      newAgentDialogSource,
      /import \{[\s\S]*type KernelAgentLibraryItem[\s\S]*\} from '@sdkwork\/claw-core';/s,
    );
    assert.match(
      newAgentDialogSource,
      /import \{[\s\S]*normalizeChatAgentCreationFollowUpResult,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(newAgentDialogSource, /mode\?: 'create' \| 'copy';/);
    assert.match(newAgentDialogSource, /embedded\?: boolean;/);
    assert.match(newAgentDialogSource, /initialDraft\?: ChatAgentDraft \| null;/);
    assert.match(newAgentDialogSource, /sourceAgent\?: KernelAgentLibraryItem \| null;/);
    assert.match(
      newAgentDialogSource,
      /const \[createdAgentResult, setCreatedAgentResult\] = useState<CreateKernelAgentResult \| null>\(\s*null,\s*\);/s,
    );
    assert.match(
      newAgentDialogSource,
      /const \[followUpError, setFollowUpError\] = useState<string \| null>\(null\);/,
    );
    assert.match(
      newAgentDialogSource,
      /const resolveCapabilityLoadError = React\.useEffectEvent\(\(error: any\) => \{[\s\S]*t\('chat\.sidebar\.newAgentDialog\.status\.loadFailed'\);[\s\S]*\}\);/s,
    );
    assert.match(
      newAgentDialogSource,
      /setDraft\(initialDraft \?\? createChatAgentDraft\(\)\);/,
    );
    assert.match(
      newAgentDialogSource,
      /void kernelAgentManagementService[\s\S]*getCreationCapability\(instanceId\)[\s\S]*\}, \[copySourceKernelId, instanceId, open, resolveCapabilityLoadError\]\);/s,
    );
    assert.match(
      newAgentDialogSource,
      /const appliedSourceKernelIdRef = useRef<string \| null>\(null\);/,
    );
    assert.match(
      newAgentDialogSource,
      /const copySourceKernelId =[\s\S]*mode === 'copy' \? String\(sourceAgent\?\.sourceKernelId \?\? ''\)\.trim\(\)\.toLowerCase\(\) \|\| null : null;/s,
    );
    assert.match(
      newAgentDialogSource,
      /resolveChatAgentPreferredKernelId\(\{[\s\S]*availableKernelIds: nextCapability\.kernelOptions\.map\(\(option\) => option\.kernelId\),[\s\S]*selectedKernelId: current,[\s\S]*sourceKernelId: copySourceKernelId,[\s\S]*defaultKernelId: nextCapability\.defaultKernelId,[\s\S]*\}\)/s,
    );
    assert.match(
      newAgentDialogSource,
      /useEffect\(\(\) => \{[\s\S]*if \(!open \|\| !copySourceKernelId\) \{[\s\S]*appliedSourceKernelIdRef\.current = null;[\s\S]*return;[\s\S]*\}[\s\S]*if \(appliedSourceKernelIdRef\.current === copySourceKernelId\) \{[\s\S]*return;[\s\S]*\}[\s\S]*resolveChatAgentPreferredKernelId\(\{[\s\S]*selectedKernelId: null,[\s\S]*sourceKernelId: copySourceKernelId,[\s\S]*defaultKernelId: capability\.defaultKernelId,[\s\S]*\}\);/s,
    );
    assert.match(
      newAgentDialogSource,
      /if \(!open\) \{[\s\S]*capabilityRequestRef\.current \+= 1;[\s\S]*return;[\s\S]*\}/s,
    );
    assert.match(
      newAgentDialogSource,
      /if \(!open\) \{[\s\S]*setCreatedAgentResult\(null\);[\s\S]*setFollowUpError\(null\);[\s\S]*return;[\s\S]*\}/s,
    );
    assert.match(
      newAgentDialogSource,
      /if \(!instanceId\) \{[\s\S]*capabilityRequestRef\.current \+= 1;[\s\S]*return;[\s\S]*\}/s,
    );
    assert.match(
      newAgentDialogSource,
      /const selectedKernelFieldSupport =[\s\S]*resolveKernelAgentCreationFieldSupport\(selectedKernelOption\);/,
    );
    assert.match(
      newAgentDialogSource,
      /temperature = selectedKernelFieldSupport\.temperature[\s\S]*parseChatAgentOptionalNumber\([\s\S]*draft\.temperature/s,
    );
    assert.match(
      newAgentDialogSource,
      /topP = selectedKernelFieldSupport\.topP[\s\S]*parseChatAgentOptionalNumber\([\s\S]*draft\.topP/s,
    );
    assert.match(
      newAgentDialogSource,
      /maxTokens = selectedKernelFieldSupport\.maxTokens[\s\S]*parseChatAgentOptionalNumber\([\s\S]*draft\.maxTokens/s,
    );
    assert.match(
      newAgentDialogSource,
      /timeoutMs = selectedKernelFieldSupport\.timeoutMs[\s\S]*parseChatAgentOptionalNumber\([\s\S]*draft\.timeoutMs/s,
    );
    assert.match(
      newAgentDialogSource,
      /const createRequest = buildChatAgentCreateRequest\(\{[\s\S]*instanceId,[\s\S]*kernelId: selectedKernelId,[\s\S]*draft,[\s\S]*fieldSupport: selectedKernelFieldSupport,[\s\S]*temperature,[\s\S]*topP,[\s\S]*maxTokens,[\s\S]*timeoutMs,[\s\S]*\}\);/s,
    );
    assert.match(
      newAgentDialogSource,
      /setCreatedAgentResult\(null\);[\s\S]*setFollowUpError\(null\);[\s\S]*void kernelAgentManagementService[\s\S]*createAgent\(createRequest\)/s,
    );
    assert.match(
      newAgentDialogSource,
      /const followUpResult = normalizeChatAgentCreationFollowUpResult\(\s*await onCreated\?\.\(result\),\s*\);[\s\S]*if \(followUpResult\.status === 'activationFailed'\) \{[\s\S]*setCreatedAgentResult\(result\);[\s\S]*setFollowUpError\([\s\S]*t\('chat\.sidebar\.agentActivationFailed'/s,
    );
    assert.match(
      newAgentDialogSource,
      /<DialogContent className="left-1\/2 top-1\/2 w-\[min\(64rem,calc\(100vw-2rem\)\)\] max-w-none translate-x-\[-50%\] translate-y-\[-50%\]">/,
    );
    assert.match(newAgentDialogSource, /const content = \(/);
    assert.match(newAgentDialogSource, /if \(embedded\) \{\s*return content;\s*\}/);
    assert.match(
      newAgentDialogSource,
      /<Dialog[\s\S]*open=\{open\}[\s\S]*onOpenChange=\{\(nextOpen\) => \{[\s\S]*if \(isCreating && !nextOpen\) \{[\s\S]*return;[\s\S]*\}[\s\S]*onOpenChange\(nextOpen\);[\s\S]*\}\}[\s\S]*>/s,
    );
    assert.match(
      newAgentDialogSource,
      /<Button variant="outline" disabled=\{isCreating\} onClick=\{\(\) => onOpenChange\(false\)\}>/,
    );
    assert.match(
      newAgentDialogSource,
      /disabled=\{[\s\S]*isCreating \|\|[\s\S]*createdAgentResult !== null[\s\S]*\}/s,
    );
    assert.match(
      newAgentDialogSource,
      /\{\(selectedKernelOption\?\.modelOptions \?\? \[\]\)\.map\(\(option\) => \(/,
    );
    assert.match(
      newAgentDialogSource,
      /!hasAuthoritativeModelOptions \? \(/,
    );
    assert.match(
      newAgentDialogSource,
      /const selectedKernelModelOptions = selectedKernelOption\?\.modelOptions \?\? \[\];/,
    );
    assert.match(
      newAgentDialogSource,
      /const selectedKernelModelValues = selectedKernelModelOptions\.map\(\(option\) => option\.value\);/,
    );
    assert.match(
      newAgentDialogSource,
      /const hasAuthoritativeModelOptions = selectedKernelModelValues\.length > 0;/,
    );
    assert.match(
      newAgentDialogSource,
      /const resolvedFallbackModelValues = normalizeChatAgentFallbackModels\(\{[\s\S]*value: draft\.fallbackModelsText,[\s\S]*primaryModel: draft\.primaryModel,[\s\S]*allowedModelValues: hasAuthoritativeModelOptions \? selectedKernelModelValues : null,[\s\S]*\}\);/s,
    );
    assert.match(
      newAgentDialogSource,
      /const resolvedFallbackModelsText = formatChatAgentFallbackModels\(resolvedFallbackModelValues\);/,
    );
    assert.match(
      newAgentDialogSource,
      /\{selectedKernelFieldSupport\.avatar \? \(/,
    );
    assert.match(
      newAgentDialogSource,
      /\{selectedKernelFieldSupport\.primaryModel \? \([\s\S]*hasAuthoritativeModelOptions \? \([\s\S]*<Select[\s\S]*: \([\s\S]*<Input/s,
    );
    assert.match(
      newAgentDialogSource,
      /const resolvedPrimaryModelValue =[\s\S]*hasAuthoritativeModelOptions[\s\S]*draft\.primaryModel[\s\S]*selectedKernelModelOptions\.some\(\(option\) => option\.value === draft\.primaryModel\)/s,
    );
    assert.match(
      newAgentDialogSource,
      /\{selectedKernelFieldSupport\.fallbackModels \? \(/,
    );
    assert.match(
      newAgentDialogSource,
      /hasAuthoritativeModelOptions \? \(/,
    );
    assert.match(
      newAgentDialogSource,
      /<Checkbox[\s\S]*checked=\{resolvedFallbackModelValues\.includes\(option\.value\)\}/s,
    );
    assert.match(
      newAgentDialogSource,
      /toggleChatAgentFallbackModel\(\{[\s\S]*value: option\.value,[\s\S]*currentValue: draft\.fallbackModelsText,[\s\S]*primaryModel: draft\.primaryModel,[\s\S]*allowedModelValues: selectedKernelModelValues,[\s\S]*\}\)/s,
    );
    assert.match(
      newAgentDialogSource,
      /: \([\s\S]*<Textarea[\s\S]*draft\.fallbackModelsText/s,
    );
    assert.doesNotMatch(
      newAgentDialogSource,
      /selectedKernelFieldSupport\.workspace/,
    );
    assert.doesNotMatch(
      newAgentDialogSource,
      /selectedKernelFieldSupport\.agentDir/,
    );
    assert.match(
      newAgentDialogSource,
      /\{selectedKernelFieldSupport\.isDefault \? \(/,
    );
    assert.match(
      newAgentDialogSource,
      /\{selectedKernelFieldSupport\.streaming \? \(/,
    );
    assert.match(
      newAgentDialogSource,
      /useEffect\(\(\) => \{[\s\S]*if \(!hasAuthoritativeModelOptions \|\| !draft\.primaryModel\) \{[\s\S]*return;[\s\S]*\}[\s\S]*selectedKernelModelOptions\.some\(\(option\) => option\.value === draft\.primaryModel\)[\s\S]*setDraft\(\(current\) => \{[\s\S]*primaryModel: ''[\s\S]*\}\);[\s\S]*\}, \[draft\.primaryModel, hasAuthoritativeModelOptions, selectedKernelModelOptions\]\);/s,
    );
    assert.match(
      newAgentDialogSource,
      /useEffect\(\(\) => \{[\s\S]*if \(draft\.fallbackModelsText === resolvedFallbackModelsText\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setDraft\(\(current\) => \{[\s\S]*fallbackModelsText: resolvedFallbackModelsText[\s\S]*\}\);[\s\S]*\}, \[draft\.fallbackModelsText, resolvedFallbackModelsText\]\);/s,
    );
    assert.match(
      newAgentDialogSource,
      /mode === 'copy'[\s\S]*t\('chat\.sidebar\.newAgentDialog\.copyTitle'\)[\s\S]*t\('chat\.sidebar\.newAgentDialog\.title'\)/,
    );
    assert.match(newAgentDialogSource, /sourceAgent \?\s*\(/);
    assert.doesNotMatch(newAgentDialogSource, /capability\?\.modelOptions/);
    assert.doesNotMatch(newAgentDialogSource, /capability\.modelOptions\.length/);
    assert.doesNotMatch(
      newAgentDialogSource,
      /\}, \[initialDraft, instanceId, open, t\]\);/,
    );
  },
);

await runTest(
  'Chat agent creation follow-up failures are standardized so created agents are not misreported as create failures and sidebar activation errors do not reject outward',
  () => {
    assert.match(
      sidebarStateSource,
      /import \{[\s\S]*CHAT_AGENT_CREATION_FOLLOW_UP_COMPLETED,[\s\S]*createChatAgentCreationFollowUpFailure,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      sidebarStateSource,
      /const handleAgentCreated = async \(\s*result: CreateKernelAgentResult,\s*\)[\s\S]*=> \{/s,
    );
    assert.match(
      sidebarStateSource,
      /mergeCreatedKernelAgentIntoCatalog,/,
    );
    assert.match(
      sidebarStateSource,
      /queryClient\.setQueriesData<KernelChatAgentCatalog \| undefined>\(\s*\{ queryKey: \['chat', 'kernel-agent-catalog', result\.instanceId\] \},\s*\(catalog\) => mergeCreatedKernelAgentIntoCatalog\(catalog, result\),\s*\);/s,
    );
    assert.match(
      sidebarStateSource,
      /queryClient\.setQueryData<KernelChatAgentCatalog \| undefined>\(\s*\['chat', 'kernel-agent-catalog', result\.instanceId, 'kernelCatalog'\],\s*\(catalog\) => mergeCreatedKernelAgentIntoCatalog\(catalog, result\),\s*\);/s,
    );
    assert.doesNotMatch(
      sidebarStateSource,
      /queryClient\.invalidateQueries\(\{[\s\S]*queryKey: \['chat', 'kernel-agent-catalog', result\.instanceId\]/s,
    );
    assert.match(
      sidebarStateSource,
      /void queryClient\.invalidateQueries\(\{[\s\S]*queryKey: \['chat', 'owned-kernel-agent-library', result\.instanceId\],[\s\S]*\}\);[\s\S]*await commitSelectionPlan\(requestId, plan\);[\s\S]*return CHAT_AGENT_CREATION_FOLLOW_UP_COMPLETED;/s,
    );
    assert.match(
      sidebarStateSource,
      /catch \(error: any\) \{[\s\S]*return createChatAgentCreationFollowUpFailure\(error\);[\s\S]*\}[\s\S]*finally \{/s,
    );
    assert.match(
      agentMarketDialogSource,
      /import \{[\s\S]*normalizeChatAgentCreationFollowUpResult,[\s\S]*\} from '\.\.\/services';/s,
    );
    assert.match(
      agentMarketDialogSource,
      /const \[followUpError, setFollowUpError\] = useState<string \| null>\(null\);/,
    );
    assert.match(
      agentMarketDialogSource,
      /const followUpResult =[\s\S]*normalizeChatAgentCreationFollowUpResult\(\s*await onInstalled\(\{[\s\S]*\}\),\s*\);[\s\S]*if \(followUpResult\.status === 'activationFailed'\) \{[\s\S]*setFollowUpError\([\s\S]*t\('chat\.sidebar\.agentActivationFailed'/s,
    );
    assert.match(
      agentMarketDialogSource,
      /await refetch\(\)\.catch\(\(\) => null\);[\s\S]*return;[\s\S]*\}[\s\S]*onOpenChange\(false\);/s,
    );
  },
);
