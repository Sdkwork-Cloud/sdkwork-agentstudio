import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const instanceDetailBadgeDescriptorsModuleUrl = pathToFileURL(
  path.join(root, 'packages/sdkwork-claw-instances/src/pages/instanceDetailBadgeDescriptors.ts'),
).href;
const { buildInstanceDetailBadgeDescriptors } =
  (await import(instanceDetailBadgeDescriptorsModuleUrl)) as typeof import('../packages/sdkwork-claw-instances/src/pages/instanceDetailBadgeDescriptors');

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function readSources(relPaths: string[]) {
  return relPaths.map((relPath) => read(relPath)).join('\n');
}

const instanceDetailRouteRelPath = 'packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx';
const openClawInstanceDetailPageRelPath =
  'packages/sdkwork-claw-instances/src/pages/OpenClawInstanceDetailPage.tsx';

function readInstanceDetailRouteSource() {
  return read(instanceDetailRouteRelPath);
}

function readInstanceDetailPageSources() {
  return readSources([instanceDetailRouteRelPath, openClawInstanceDetailPageRelPath]);
}

function getLocaleValue(locale: Record<string, unknown>, key: string) {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, locale);
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function extractBetween(source: string, startMarker: string, endMarker: string) {
  const startIndex = source.indexOf(startMarker);
  assert.notEqual(startIndex, -1, `Expected to find start marker: ${startMarker}`);

  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(endIndex, -1, `Expected to find end marker: ${endMarker}`);

  return source.slice(startIndex, endIndex);
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-instances is implemented locally instead of re-exporting claw-studio-instances', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-instances/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-instances/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-instances/src/pages/Instances.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/pages/OpenClawInstanceDetailPage.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/InstanceFileExplorer.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/InstanceFilesWorkspace.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/agentWorkbenchService.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceService.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/store/useInstanceStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/types/index.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-instances']);
  assert.ok(
    pkg.dependencies?.react,
    'sdkwork-claw-instances should declare react so package-local component tests resolve the shared runtime locally',
  );
  assert.ok(
    pkg.dependencies?.['react-dom'],
    'sdkwork-claw-instances should declare react-dom so renderToStaticMarkup resolves from the same workspace dependency tree as react',
  );
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-instances/);
  assert.match(indexSource, /Instances/);
  assert.match(indexSource, /InstanceDetail/);
  assert.match(indexSource, /Nodes/);
  assert.match(indexSource, /agentSkillManagementService/);
  assert.match(indexSource, /agentWorkbenchService/);
  assert.match(indexSource, /instanceService/);
  assert.match(indexSource, /instanceWorkbenchService/);
  assert.match(indexSource, /useInstanceStore/);
  assert.doesNotMatch(indexSource, /export \* from '\.\/services';/);
  assert.doesNotMatch(indexSource, /export \* from '\.\/types';/);
});

runTest('sdkwork-claw-instances exports the Nodes surface through package and service barrels with localized page copy', () => {
  const indexSource = read('packages/sdkwork-claw-instances/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
  const nodesSource = read('packages/sdkwork-claw-instances/src/pages/Nodes.tsx');
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const enInstancesLocale = readJson<Record<string, unknown>>(
    'packages/sdkwork-claw-i18n/src/locales/en/instances.json',
  );
  const zhInstancesLocale = readJson<Record<string, unknown>>(
    'packages/sdkwork-claw-i18n/src/locales/zh/instances.json',
  );
  const directKeys = [...nodesSource.matchAll(/\bt\('([^']+)'\)/g)].map((match) => match[1]);
  const uniqueKeys = [...new Set(directKeys)].sort();

  const missingKeys = uniqueKeys.filter(
    (key) => getLocaleValue(enLocale, key) === undefined || getLocaleValue(zhLocale, key) === undefined,
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/pages/Nodes.tsx'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/nodeInventoryService.ts'));
  assert.match(indexSource, /Nodes/);
  assert.match(servicesIndexSource, /nodeInventoryService/);
  assert.match(nodesSource, /nodeInventoryService/);
  assert.doesNotMatch(nodesSource, /Cluster governance starts here\./);
  assert.doesNotMatch(nodesSource, /Failed to load node inventory\./);
  assert.match(nodesSource, /instances\.nodes\.description/);
  assert.match(nodesSource, /instances\.nodes\.actions\.refresh/);
  assert.match(nodesSource, /instances\.nodes\.actions\.ensureLocalNode/);
  assert.match(nodesSource, /instances\.nodes\.actions\.restartLocalNode/);
  assert.match(nodesSource, /instances\.nodes\.metrics\.totalNodes/);
  assert.match(nodesSource, /instances\.nodes\.fields\.topology/);
  assert.match(nodesSource, /instances\.nodes\.kinds\.localPrimary/);
  assert.match(nodesSource, /instances\.nodes\.health\.ok/);
  assert.equal(
    getLocaleValue(enLocale, 'instances.nodes.description'),
    'Cluster governance starts here. Local primary kernels are listed beside attached or managed nodes so rollout, diagnostics, and topology drift can converge on one product model.',
  );
  assert.equal(
    getLocaleValue(zhLocale, 'instances.nodes.description'),
    '集群治理从这里开始。本地主节点内核会与已接入或已托管的节点一同展示，让发布、诊断与拓扑漂移可以收敛到同一套产品模型。',
  );
  assert.equal(
    getLocaleValue(enInstancesLocale, 'nodes.description'),
    getLocaleValue(enLocale, 'instances.nodes.description'),
  );
  assert.equal(
    getLocaleValue(zhInstancesLocale, 'nodes.description'),
    getLocaleValue(zhLocale, 'instances.nodes.description'),
  );
  assert.deepEqual(missingKeys, []);
});

runTest('sdkwork-claw-instances removes the legacy token chrome from instance detail', () => {
  const detailSource = readInstanceDetailPageSources();

  assert.doesNotMatch(detailSource, /instances\.detail\.fields\.apiToken/);
  assert.doesNotMatch(detailSource, /sk-local-123456789/);
});

runTest(
  'sdkwork-claw-instances resolves instance detail modules through a kernel-aware registry while preserving the OpenClaw detail implementation',
  () => {
    const routeSource = readInstanceDetailRouteSource();
    const detailSource = readInstanceDetailPageSources();
    const detailModuleCatalogSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailModuleCatalog.ts',
    );
    const detailSourceContractSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailSource.ts',
    );
    const detailModuleTypesSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailModules/types.ts',
    );
    const openClawDetailModuleSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailModules/openClawInstanceDetailModule.ts',
    );
    const hermesDetailModuleSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailModules/hermesInstanceDetailModule.ts',
    );

    assert.ok(exists('packages/sdkwork-claw-instances/src/pages/HermesInstanceDetailPage.tsx'));
    assert.ok(exists('packages/sdkwork-claw-instances/src/pages/UnsupportedInstanceDetailPage.tsx'));
    assert.ok(exists(openClawInstanceDetailPageRelPath));
    assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceDetailSource.ts'));
    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceDetailModules/openClawInstanceDetailModule.ts'),
    );
    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceDetailModules/hermesInstanceDetailModule.ts'),
    );
    assert.match(routeSource, /resolveSupportedInstanceDetailModule/);
    assert.match(routeSource, /createInstanceDetailSource/);
    assert.match(routeSource, /detailModule\.DetailPage/);
    assert.match(
      routeSource,
      /<DetailPage[\s\S]*source=\{detailSource\}[\s\S]*onOpenAgentMarketModal=\{onOpenAgentMarketModal\}[\s\S]*\/>/,
    );
    assert.match(routeSource, /loadBaseDetail:\s*(?:async\s*)?\(instanceId\)\s*=>/);
    assert.match(routeSource, /loadModulePayload:\s*(?:async\s*)?\(instanceId\)\s*=>/);
    assert.doesNotMatch(routeSource, /extensions:\s*\{/);
    assert.match(routeSource, /detailModule\.loadModulePayload\(instanceId,\s*\{/);
    assert.match(routeSource, /loadBaseDetail:\s*\(\)\s*=>\s*loadBaseDetail\(instanceId\)/);
    assert.doesNotMatch(routeSource, /function OpenClawInstanceDetailPage\(/);
    assert.match(detailSource, /function OpenClawInstanceDetailPage\(/);
    assert.match(detailSource, /type InstanceDetailPageProps,/);
    assert.match(detailSource, /\}: InstanceDetailPageProps\)/);
    assert.match(detailSource, /source\s*\.\s*loadModulePayload\(\)/);
    assert.match(detailSource, /getOpenClawWorkbenchFromModulePayload/);
    assert.match(detailSource, /instanceWorkbenchService\.getInstanceWorkbench\(/);
    assert.match(detailSource, /source\s*\.\s*loadModulePayload\(\)/);
    assert.doesNotMatch(detailSource, /source\.loadWorkbench\(\)/);
    assert.doesNotMatch(detailSource, /getOpenClawInstanceDetailSourceExtension/);
    assert.doesNotMatch(detailSource, /buildHermesRuntimePolicies\(/);
    assert.match(detailSource, /UnsupportedInstanceDetailPage/);
    assert.match(detailModuleCatalogSource, /createKernelDetailModuleRegistry/);
    assert.match(detailModuleCatalogSource, /instanceDetailModuleRegistrations/);
    assert.doesNotMatch(detailModuleCatalogSource, /type SupportedInstanceDetailModuleId =/);
    assert.match(detailSourceContractSource, /export interface InstanceDetailSource/);
    assert.match(
      detailSourceContractSource,
      /export interface InstanceDetailSource \{[\s\S]*?loadBaseDetail: \(\) => Promise<InstanceBaseDetail \| null>;[\s\S]*?loadModulePayload: \(\) => Promise<InstanceDetailModulePayload \| null>;[\s\S]*?\}/,
    );
    assert.match(detailSourceContractSource, /loadBaseDetail: \(\) => Promise<InstanceBaseDetail \| null>/);
    assert.match(detailSourceContractSource, /loadModulePayload: \(\) => Promise<InstanceDetailModulePayload \| null>/);
    assert.doesNotMatch(detailSourceContractSource, /OpenClawInstanceDetailSourceExtension/);
    assert.doesNotMatch(detailSourceContractSource, /extensions\?: TExtensions/);
    assert.doesNotMatch(detailSourceContractSource, /getOpenClawInstanceDetailSourceExtension/);
    assert.match(detailModuleTypesSource, /export interface InstanceDetailPageProps \{/);
    assert.match(detailModuleTypesSource, /source: InstanceDetailSource;/);
    assert.match(
      detailModuleTypesSource,
      /onOpenAgentMarketModal:\s*\(\s*request: InstanceDetailAgentMarketModalRequest,\s*\)\s*=>\s*void;/,
    );
    assert.match(detailModuleTypesSource, /DetailPage: ComponentType<InstanceDetailPageProps>;/);
    assert.match(detailModuleTypesSource, /export interface InstanceDetailModulePayloadLoadContext/);
    assert.match(detailModuleTypesSource, /loadBaseDetail: \(\) => Promise<InstanceBaseDetail \| null>/);
    assert.match(
      detailModuleTypesSource,
      /loadModulePayload:\s*\(\s*instanceId: string,\s*context: InstanceDetailModulePayloadLoadContext,\s*\)\s*=>\s*Promise<InstanceDetailModulePayload \| null>/,
    );
    assert.match(openClawDetailModuleSource, /chrome: 'sharedWorkbench'/);
    assert.match(openClawDetailModuleSource, /loadModulePayload:/);
    assert.doesNotMatch(openClawDetailModuleSource, /moduleId:/);
    assert.match(openClawDetailModuleSource, /OpenClawInstanceDetailPage\.tsx/);
    assert.match(hermesDetailModuleSource, /chrome: 'kernelOwned'/);
    assert.match(hermesDetailModuleSource, /loadModulePayload:/);
    assert.match(hermesDetailModuleSource, /context\.loadBaseDetail\(\)/);
    assert.doesNotMatch(hermesDetailModuleSource, /moduleId:/);
    assert.match(hermesDetailModuleSource, /HermesInstanceDetailPage\.tsx/);
    assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceBaseDetail.ts'));
    assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceDetailModulePayload.ts'));
  },
);

runTest(
  'sdkwork-claw-instances routes Instance Detail section metadata and presentation helpers through a dedicated module',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const presentationSource = read(
      'packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.ts',
    );

    assert.ok(
      exists('packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.ts'),
    );
    assert.match(
      detailSource,
      /from '\.\.\/components\/instanceDetailWorkbenchPresentation'/,
    );
    assert.doesNotMatch(detailSource, /interface WorkbenchSectionDefinition \{/);
    assert.doesNotMatch(detailSource, /const workbenchSections: WorkbenchSectionDefinition\[] = \[/);
    assert.doesNotMatch(detailSource, /function getRuntimeStatusTone\(/);
    assert.doesNotMatch(detailSource, /function getStatusBadge\(/);
    assert.doesNotMatch(detailSource, /function getDangerBadge\(/);
    assert.doesNotMatch(detailSource, /function getCapabilityTone\(/);
    assert.doesNotMatch(detailSource, /function getManagementEntryTone\(/);
    assert.doesNotMatch(detailSource, /function buildTaskScheduleSummary\(/);

    assert.match(presentationSource, /export const workbenchSections/);
    assert.match(presentationSource, /export function getRuntimeStatusTone/);
    assert.match(presentationSource, /export function getStatusBadge/);
    assert.match(presentationSource, /export function getDangerBadge/);
    assert.match(presentationSource, /export function getCapabilityTone/);
    assert.match(presentationSource, /export function getManagementEntryTone/);
    assert.match(presentationSource, /export function buildTaskScheduleSummary/);
  },
);

runTest(
  'sdkwork-claw-instances routes Instance Detail section chrome through shared workbench primitives',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const sectionContentSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx',
    );
    const primitiveSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceWorkbenchPrimitives.tsx',
    );

    assert.ok(
      exists('packages/sdkwork-claw-instances/src/components/InstanceWorkbenchPrimitives.tsx'),
    );
    assert.doesNotMatch(detailSource, /function SectionHeading\(/);
    assert.doesNotMatch(detailSource, /function SectionAvailabilityNotice\(/);

    assert.match(sectionContentSource, /from '\.\/InstanceWorkbenchPrimitives\.tsx'/);
    assert.match(primitiveSource, /export function SectionHeading/);
    assert.match(primitiveSource, /export function SectionAvailabilityNotice/);
  },
);

runTest(
  'sdkwork-claw-instances routes config draft types and form-state factories through a shared helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const derivedStateSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
    );
    const configSyncSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailConfigSyncState.ts',
    );
    const instanceDetailResetSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailResetState.ts',
    );
    const configDraftSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawConfigDrafts.ts',
    );
    const configPresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawConfigPresentation.ts',
    );
    assert.match(configSyncSource, /createOpenClawXSearchDraft as createXSearchFormState/);
    assert.match(
      configSyncSource,
      /createOpenClawWebSearchNativeCodexDraft as createWebSearchNativeCodexFormState/,
    );
    assert.match(configSyncSource, /createOpenClawWebSearchDraftState/);
    assert.match(configSyncSource, /createOpenClawWebFetchDraftState/);
    assert.match(
      configSyncSource,
      /createOpenClawAuthCooldownsDraft as createAuthCooldownsFormState/,
    );
    assert.match(configSyncSource, /createOpenClawDreamingFormState/);
    assert.match(instanceDetailResetSource, /createOpenClawConfigResetState/);
    assert.match(
      detailSource,
      /type OpenClawWebSearchSharedDraftValue as OpenClawWebSearchSharedFormState/,
    );
    assert.match(
      detailSource,
      /type OpenClawWebSearchProviderDraftValue as OpenClawWebSearchProviderFormState/,
    );
    assert.match(detailSource, /type OpenClawXSearchDraftValue as OpenClawXSearchFormState/);
    assert.match(
      detailSource,
      /type OpenClawWebSearchNativeCodexDraftValue as OpenClawWebSearchNativeCodexFormState/,
    );
    assert.match(
      detailSource,
      /type OpenClawWebFetchSharedDraftValue as OpenClawWebFetchSharedFormState/,
    );
    assert.match(
      detailSource,
      /type OpenClawWebFetchFallbackDraftValue as OpenClawWebFetchFallbackFormState/,
    );
    assert.match(
      detailSource,
      /type OpenClawAuthCooldownsDraftValue as OpenClawAuthCooldownsFormState/,
    );
    assert.match(derivedStateSource, /from '\.\/openClawConfigDrafts\.ts'/);
    assert.doesNotMatch(derivedStateSource, /from '\.\/openClawManagedConfigDrafts\.ts'/);
    assert.doesNotMatch(detailSource, /createOpenClawXSearchDraft as createXSearchFormState/);
    assert.doesNotMatch(
      detailSource,
      /createOpenClawWebSearchNativeCodexDraft as createWebSearchNativeCodexFormState/,
    );
    assert.doesNotMatch(detailSource, /createOpenClawWebSearchDraftState/);
    assert.doesNotMatch(
      detailSource,
      /createOpenClawAuthCooldownsDraft as createAuthCooldownsFormState/,
    );
    assert.doesNotMatch(detailSource, /createOpenClawDreamingFormState/);

    assert.doesNotMatch(detailSource, /interface OpenClawWebSearchSharedFormState \{/);
    assert.doesNotMatch(detailSource, /interface OpenClawWebSearchProviderFormState \{/);
    assert.doesNotMatch(detailSource, /interface OpenClawXSearchFormState \{/);
    assert.doesNotMatch(detailSource, /interface OpenClawWebSearchNativeCodexFormState \{/);
    assert.doesNotMatch(detailSource, /interface OpenClawWebFetchSharedFormState \{/);
    assert.doesNotMatch(detailSource, /interface OpenClawWebFetchFallbackFormState \{/);
    assert.doesNotMatch(detailSource, /interface OpenClawAuthCooldownsFormState \{/);
    assert.doesNotMatch(detailSource, /function createWebSearchSharedFormState\(/);
    assert.doesNotMatch(detailSource, /function createWebSearchProviderFormState\(/);
    assert.doesNotMatch(detailSource, /function createXSearchFormState\(/);
    assert.doesNotMatch(detailSource, /function createWebSearchNativeCodexFormState\(/);
    assert.doesNotMatch(detailSource, /function createWebFetchSharedFormState\(/);
    assert.doesNotMatch(detailSource, /function createWebFetchFallbackFormState\(/);
    assert.doesNotMatch(detailSource, /function createAuthCooldownsFormState\(/);
    assert.doesNotMatch(detailSource, /function formatOptionalWholeNumber\(/);
    assert.doesNotMatch(detailSource, /createOpenClawWebSearchSharedDraft as createWebSearchSharedFormState/);
    assert.doesNotMatch(
      detailSource,
      /createOpenClawWebSearchProviderDraft as createWebSearchProviderFormState/,
    );
    assert.doesNotMatch(detailSource, /createOpenClawWebFetchSharedDraft as createWebFetchSharedFormState/);
    assert.doesNotMatch(
      detailSource,
      /createOpenClawWebFetchFallbackDraft as createWebFetchFallbackFormState/,
    );
    assert.doesNotMatch(detailSource, /createWebFetchSharedFormState\(/);
    assert.doesNotMatch(detailSource, /createWebFetchFallbackFormState\(/);
    const configWebSearchSyncEffect = extractBetween(
      detailSource,
      'const configWebSearch = workbench?.configWebSearch || null;',
      'const configAuthCooldowns = workbench?.configAuthCooldowns || null;',
    );
    const configAuthCooldownsSyncEffect = extractBetween(
      detailSource,
      'const configAuthCooldowns = workbench?.configAuthCooldowns || null;',
      'const configDreaming = workbench?.configDreaming || null;',
    );
    const configDreamingSyncEffect = extractBetween(
      detailSource,
      'const configDreaming = workbench?.configDreaming || null;',
      'const configXSearch = workbench?.configXSearch || null;',
    );
    const configXSearchSyncEffect = extractBetween(
      detailSource,
      'const configXSearch = workbench?.configXSearch || null;',
      'const configWebSearchNativeCodex = workbench?.configWebSearchNativeCodex || null;',
    );
    const configWebSearchNativeCodexSyncEffect = extractBetween(
      detailSource,
      'const configWebSearchNativeCodex = workbench?.configWebSearchNativeCodex || null;',
      'const configWebFetch = workbench?.configWebFetch || null;',
    );
    const configWebFetchSyncEffect = extractBetween(
      detailSource,
      'const configWebFetch = workbench?.configWebFetch || null;',
      'const agents = workbench?.agents || [];',
    );
    const configResetEffect = extractBetween(
      detailSource,
      'applyInstanceDetailInstanceSwitchResetState({',
      'setIsAgentDialogOpen,',
    );
    assert.match(configWebSearchSyncEffect, /applyInstanceDetailConfigWebSearchSyncState\(\{/);
    assert.match(configWebSearchSyncEffect, /currentProviderId: selectedWebSearchProviderId,/);
    assert.match(configWebSearchSyncEffect, /setSelectedWebSearchProviderId,/);
    assert.match(configWebSearchSyncEffect, /setWebSearchSharedDraft,/);
    assert.match(configWebSearchSyncEffect, /setWebSearchProviderDrafts,/);
    assert.match(configWebSearchSyncEffect, /setWebSearchError,/);
    assert.doesNotMatch(configWebSearchSyncEffect, /createOpenClawWebSearchDraftState/);
    assert.doesNotMatch(configWebSearchSyncEffect, /providers\.some/);
    assert.doesNotMatch(configWebSearchSyncEffect, /createWebSearchSharedFormState/);
    assert.match(
      configAuthCooldownsSyncEffect,
      /applyInstanceDetailConfigAuthCooldownsSyncState\(\{/,
    );
    assert.match(configAuthCooldownsSyncEffect, /setAuthCooldownsDraft,/);
    assert.match(configAuthCooldownsSyncEffect, /setAuthCooldownsError,/);
    assert.doesNotMatch(configAuthCooldownsSyncEffect, /createAuthCooldownsFormState/);
    assert.match(configDreamingSyncEffect, /applyInstanceDetailConfigDreamingSyncState\(\{/);
    assert.match(configDreamingSyncEffect, /setDreamingDraft,/);
    assert.match(configDreamingSyncEffect, /setDreamingError,/);
    assert.doesNotMatch(configDreamingSyncEffect, /createOpenClawDreamingFormState/);
    assert.match(configXSearchSyncEffect, /applyInstanceDetailConfigXSearchSyncState\(\{/);
    assert.match(configXSearchSyncEffect, /setXSearchDraft,/);
    assert.match(configXSearchSyncEffect, /setXSearchError,/);
    assert.doesNotMatch(configXSearchSyncEffect, /createXSearchFormState/);
    assert.match(
      configWebSearchNativeCodexSyncEffect,
      /applyInstanceDetailConfigWebSearchNativeCodexSyncState\(\{/,
    );
    assert.match(configWebSearchNativeCodexSyncEffect, /setWebSearchNativeCodexDraft,/);
    assert.match(configWebSearchNativeCodexSyncEffect, /setWebSearchNativeCodexError,/);
    assert.doesNotMatch(
      configWebSearchNativeCodexSyncEffect,
      /createWebSearchNativeCodexFormState/,
    );
    assert.match(configWebFetchSyncEffect, /applyInstanceDetailConfigWebFetchSyncState\(\{/);
    assert.match(configWebFetchSyncEffect, /setWebFetchSharedDraft,/);
    assert.match(configWebFetchSyncEffect, /setWebFetchFallbackDraft,/);
    assert.match(configWebFetchSyncEffect, /setWebFetchError,/);
    assert.doesNotMatch(configWebFetchSyncEffect, /createOpenClawWebFetchDraftState/);
    assert.doesNotMatch(configAuthCooldownsSyncEffect, /if \(!configAuthCooldowns\)/);
    assert.doesNotMatch(configDreamingSyncEffect, /if \(!configDreaming\)/);
    assert.doesNotMatch(configXSearchSyncEffect, /if \(!configXSearch\)/);
    assert.doesNotMatch(
      configWebSearchNativeCodexSyncEffect,
      /if \(!configWebSearchNativeCodex\)/,
    );
    assert.match(
      configSyncSource,
      /export function applyInstanceDetailConfigWebSearchSyncState\(/,
    );
    assert.match(
      configSyncSource,
      /const webSearchDraftState = createOpenClawWebSearchDraftState\(\{/,
    );
    assert.match(
      configSyncSource,
      /setSelectedWebSearchProviderId\(webSearchDraftState\.selectedProviderId\);/,
    );
    assert.match(
      configSyncSource,
      /setWebSearchSharedDraft\(webSearchDraftState\.sharedDraft\);/,
    );
    assert.match(
      configSyncSource,
      /setWebSearchProviderDrafts\(webSearchDraftState\.providerDrafts\);/,
    );
    assert.match(
      configSyncSource,
      /export function applyInstanceDetailConfigAuthCooldownsSyncState\(/,
    );
    assert.match(
      configSyncSource,
      /setAuthCooldownsDraft\(createAuthCooldownsFormState\(config\)\);/,
    );
    assert.match(
      configSyncSource,
      /export function applyInstanceDetailConfigDreamingSyncState\(/,
    );
    assert.match(
      configSyncSource,
      /setDreamingDraft\(createOpenClawDreamingFormState\(config\)\);/,
    );
    assert.match(
      configSyncSource,
      /export function applyInstanceDetailConfigXSearchSyncState\(/,
    );
    assert.match(configSyncSource, /setXSearchDraft\(createXSearchFormState\(config\)\);/);
    assert.match(
      configSyncSource,
      /export function applyInstanceDetailConfigWebSearchNativeCodexSyncState\(/,
    );
    assert.match(
      configSyncSource,
      /setWebSearchNativeCodexDraft\(createWebSearchNativeCodexFormState\(config\)\);/,
    );
    assert.match(
      configSyncSource,
      /export function applyInstanceDetailConfigWebFetchSyncState\(/,
    );
    assert.match(
      configSyncSource,
      /const webFetchDraftState = createOpenClawWebFetchDraftState\(config\);/,
    );
    assert.match(
      configSyncSource,
      /setWebFetchSharedDraft\(webFetchDraftState\.sharedDraft\);/,
    );
    assert.match(
      configSyncSource,
      /setWebFetchFallbackDraft\(webFetchDraftState\.fallbackDraft\);/,
    );
    assert.doesNotMatch(configSyncSource, /toast\./);
    assert.doesNotMatch(configSyncSource, /instanceService\./);
    assert.match(configResetEffect, /setSelectedWebSearchProviderId,/);
    assert.match(configResetEffect, /setWebSearchSharedDraft,/);
    assert.match(configResetEffect, /setWebSearchProviderDrafts,/);
    assert.match(configResetEffect, /setWebFetchSharedDraft,/);
    assert.match(configResetEffect, /setWebFetchFallbackDraft,/);
    assert.match(configResetEffect, /setAuthCooldownsDraft,/);
    assert.match(configResetEffect, /setDreamingDraft,/);
    assert.doesNotMatch(detailSource, /createOpenClawConfigResetState/);
    assert.match(
      instanceDetailResetSource,
      /const configResetState = createOpenClawConfigResetState\(\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setSelectedWebSearchProviderId\(configResetState\.webSearch\.selectedProviderId\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setWebSearchSharedDraft\(configResetState\.webSearch\.sharedDraft\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setWebSearchProviderDrafts\(configResetState\.webSearch\.providerDrafts\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setWebFetchSharedDraft\(configResetState\.webFetch\.sharedDraft\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setWebFetchFallbackDraft\(configResetState\.webFetch\.fallbackDraft\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setAuthCooldownsDraft\(configResetState\.authCooldowns\.draft\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setDreamingDraft\(configResetState\.dreaming\.draft\);/,
    );
    assert.doesNotMatch(instanceDetailResetSource, /setSelectedWebSearchProviderId\(null\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setWebSearchSharedDraft\(null\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setWebSearchProviderDrafts\(\{\}\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setWebFetchSharedDraft\(null\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setWebFetchError\(null\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setIsSavingWebFetch\(false\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setAuthCooldownsDraft\(null\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setDreamingDraft\(null\);/);
    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/openClawConfigPresentation.ts'),
    );
    assert.match(servicesIndexSource, /openClawConfigPresentation/);
    assert.match(detailSource, /buildInstanceDetailDerivedState/);
    assert.match(derivedStateSource, /buildOpenClawWebSearchProviderSelectionState/);
    assert.match(detailSource, /buildOpenClawConfigDraftChangeHandlers/);
    assert.doesNotMatch(detailSource, /applyOpenClawWebSearchProviderDraftChange/);
    assert.doesNotMatch(detailSource, /applyOpenClawNullableDraftFieldChange/);
    assert.doesNotMatch(detailSource, /applyOpenClawDraftFieldChange/);
    assert.doesNotMatch(detailSource, /const selectedWebSearchProvider = useMemo/);
    assert.doesNotMatch(detailSource, /createWebSearchProviderFormState\(/);
    assert.doesNotMatch(detailSource, /const handleWebSearchSharedDraftChange = \(/);
    assert.doesNotMatch(detailSource, /const handleWebSearchProviderDraftChange = \(/);
    assert.doesNotMatch(detailSource, /const handleXSearchDraftChange = \(/);
    assert.doesNotMatch(detailSource, /const handleWebSearchNativeCodexDraftChange = \(/);
    assert.doesNotMatch(detailSource, /const handleWebFetchSharedDraftChange = \(/);
    assert.doesNotMatch(detailSource, /const handleWebFetchFallbackDraftChange = \(/);
    assert.doesNotMatch(detailSource, /const handleAuthCooldownsDraftChange = \(/);
    assert.doesNotMatch(detailSource, /const handleDreamingDraftChange = \(/);
    const configDraftChangeBuilder = extractBetween(
      detailSource,
      '  const configDraftChangeHandlers = ',
      '  const configMutationHandlers = ',
    );
    assert.match(
      configDraftChangeBuilder,
      /buildOpenClawConfigDraftChangeHandlers\(\{/,
    );
    assert.match(configDraftChangeBuilder, /selectedWebSearchProvider,/);
    assert.match(configDraftChangeBuilder, /setWebSearchError,/);
    assert.match(configDraftChangeBuilder, /setWebSearchSharedDraft,/);
    assert.match(configDraftChangeBuilder, /setWebSearchProviderDrafts,/);
    assert.match(configDraftChangeBuilder, /setXSearchError,/);
    assert.match(configDraftChangeBuilder, /setXSearchDraft,/);
    assert.match(configDraftChangeBuilder, /setWebSearchNativeCodexError,/);
    assert.match(configDraftChangeBuilder, /setWebSearchNativeCodexDraft,/);
    assert.match(configDraftChangeBuilder, /setWebFetchError,/);
    assert.match(configDraftChangeBuilder, /setWebFetchSharedDraft,/);
    assert.match(configDraftChangeBuilder, /setWebFetchFallbackDraft,/);
    assert.match(configDraftChangeBuilder, /setAuthCooldownsError,/);
    assert.match(configDraftChangeBuilder, /setAuthCooldownsDraft,/);
    assert.match(configDraftChangeBuilder, /setDreamingError,/);
    assert.match(configDraftChangeBuilder, /setDreamingDraft,/);
    assert.match(
      detailSource,
      /onDreamingDraftChange: configDraftChangeHandlers\.onDreamingDraftChange/,
    );
    assert.match(
      detailSource,
      /onWebSearchSharedDraftChange: configDraftChangeHandlers\.onWebSearchSharedDraftChange/,
    );
    assert.match(
      detailSource,
      /onWebSearchProviderDraftChange:\s+configDraftChangeHandlers\.onWebSearchProviderDraftChange/,
    );
    assert.match(
      detailSource,
      /onWebFetchSharedDraftChange: configDraftChangeHandlers\.onWebFetchSharedDraftChange/,
    );
    assert.match(
      detailSource,
      /onWebFetchFallbackDraftChange:\s+configDraftChangeHandlers\.onWebFetchFallbackDraftChange/,
    );
    assert.match(
      detailSource,
      /onWebSearchNativeCodexDraftChange:\s+configDraftChangeHandlers\.onWebSearchNativeCodexDraftChange/,
    );
    assert.match(
      detailSource,
      /onXSearchDraftChange: configDraftChangeHandlers\.onXSearchDraftChange/,
    );
    assert.match(
      detailSource,
      /onAuthCooldownsDraftChange:\s+configDraftChangeHandlers\.onAuthCooldownsDraftChange/,
    );
    assert.match(
      configPresentationSource,
      /export function buildOpenClawConfigDraftChangeHandlers\(/,
    );
    assert.match(
      configPresentationSource,
      /applyOpenClawWebSearchProviderDraftChange/,
    );
    assert.match(
      configPresentationSource,
      /applyOpenClawNullableDraftFieldChange/,
    );
    assert.match(
      configPresentationSource,
      /applyOpenClawDraftFieldChange/,
    );
    assert.doesNotMatch(configPresentationSource, /instanceService\./);
    assert.doesNotMatch(configPresentationSource, /toast\./);
    assert.doesNotMatch(configPresentationSource, /loadWorkbench\(/);

    assert.match(configDraftSource, /export function createOpenClawWebSearchSharedDraft/);
    assert.match(configDraftSource, /export function createOpenClawWebSearchDraftState/);
    assert.match(configDraftSource, /export function createOpenClawWebSearchProviderDraft/);
    assert.match(
      configDraftSource,
      /export function buildOpenClawWebSearchProviderSelectionState/,
    );
    assert.match(
      configDraftSource,
      /export function applyOpenClawWebSearchProviderDraftChange/,
    );
    assert.match(configDraftSource, /export function applyOpenClawNullableDraftFieldChange/);
    assert.match(configDraftSource, /export function applyOpenClawDraftFieldChange/);
    assert.match(configDraftSource, /export function createOpenClawXSearchDraft/);
    assert.match(configDraftSource, /export function createOpenClawWebSearchNativeCodexDraft/);
    assert.match(configDraftSource, /export function createOpenClawWebFetchSharedDraft/);
    assert.match(configDraftSource, /export function createOpenClawWebFetchFallbackDraft/);
    assert.match(configDraftSource, /export function createOpenClawWebFetchDraftState/);
    assert.match(configDraftSource, /export function createOpenClawConfigResetState/);
    assert.match(configDraftSource, /export function createOpenClawAuthCooldownsDraft/);
    assert.doesNotMatch(configDraftSource, /openClawManagedConfigDrafts\.ts/);
    assert.equal(
      exists('packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.ts'),
      false,
    );
    assert.equal(
      exists('packages/sdkwork-claw-instances/src/services/openClawManagedConfigPresentation.ts'),
      false,
    );
    assert.equal(
      exists(
        'packages/sdkwork-claw-instances/src/services/instanceDetailManagedConfigSyncState.ts',
      ),
      false,
    );
  },
);

runTest(
  'sdkwork-claw-instances routes config save handler construction through a shared helper while keeping write authority in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const configMutationSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawConfigMutationSupport.ts',
    );
    const configMutationExecutorSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailConfigMutationSupport.ts',
    );
    const configRunner = extractBetween(
      detailSource,
      '  const runConfigSave = ',
      '  const configMutationHandlers = ',
    );
    const configHandlerBuilder = extractBetween(
      detailSource,
      '  const configMutationHandlers = ',
      '  const renderWorkbenchSectionAvailability = createInstanceDetailSectionAvailabilityRenderer({',
    );

    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/openClawConfigMutationSupport.ts'),
    );
    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceDetailConfigMutationSupport.ts'),
    );
    assert.match(servicesIndexSource, /openClawConfigMutationSupport/);
    assert.match(servicesIndexSource, /instanceDetailConfigMutationSupport/);
    assert.doesNotMatch(detailSource, /const runConfigSave = async/);
    assert.match(configRunner, /createOpenClawConfigSaveRunner\(\{/);
    assert.match(
      configRunner,
      /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/,
    );
    assert.match(configRunner, /reportSuccess: toastReporters\.reportSuccess,/);

    assert.match(
      configHandlerBuilder,
      /buildOpenClawConfigMutationHandlers\(\{/,
    );
    assert.match(configHandlerBuilder, /executeSaveRequest: runConfigSave/);
    assert.match(
      detailSource,
      /const configMutationExecutors = createInstanceDetailConfigMutationExecutors\(\{\s*instanceService,\s*\}\);/,
    );
    assert.match(
      configHandlerBuilder,
      /executeSave: configMutationExecutors\.webSearch\.executeSave,/,
    );
    assert.match(
      configHandlerBuilder,
      /executeSave: configMutationExecutors\.xSearch\.executeSave,/,
    );
    assert.match(
      configHandlerBuilder,
      /executeSave: configMutationExecutors\.webSearchNativeCodex\.executeSave,/,
    );
    assert.match(
      configHandlerBuilder,
      /executeSave: configMutationExecutors\.webFetch\.executeSave,/,
    );
    assert.match(
      configHandlerBuilder,
      /executeSave: configMutationExecutors\.authCooldowns\.executeSave,/,
    );
    assert.match(
      configHandlerBuilder,
      /executeSave: configMutationExecutors\.dreaming\.executeSave,/,
    );
    assert.doesNotMatch(
      configHandlerBuilder,
      /executeSave: \(instanceId, input\) => instanceService\.saveOpenClawWebSearchConfig\(instanceId, input\)/,
    );
    assert.doesNotMatch(
      configHandlerBuilder,
      /executeSave: \(instanceId, input\) => instanceService\.saveOpenClawXSearchConfig\(instanceId, input\)/,
    );
    assert.doesNotMatch(
      configHandlerBuilder,
      /executeSave: \(instanceId, input\) =>\s+instanceService\.saveOpenClawWebSearchNativeCodexConfig\(instanceId, input\)/,
    );
    assert.doesNotMatch(
      configHandlerBuilder,
      /executeSave: \(instanceId, input\) => instanceService\.saveOpenClawWebFetchConfig\(instanceId, input\)/,
    );
    assert.doesNotMatch(
      configHandlerBuilder,
      /executeSave: \(instanceId, input\) =>\s+instanceService\.saveOpenClawAuthCooldownsConfig\(instanceId, input\)/,
    );
    assert.doesNotMatch(
      configHandlerBuilder,
      /executeSave: \(instanceId, input\) => instanceService\.saveOpenClawDreamingConfig\(instanceId, input\)/,
    );
    assert.doesNotMatch(detailSource, /const handleSaveWebSearchConfig = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const handleSaveXSearchConfig = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const handleSaveWebSearchNativeCodexConfig = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const handleSaveWebFetchConfig = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const handleSaveAuthCooldownsConfig = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const handleSaveDreamingConfig = async \(\) => \{/);
    assert.match(
      detailSource,
      /onSaveDreamingConfig:\s*configMutationHandlers\.onSaveDreamingConfig/,
    );
    assert.match(
      detailSource,
      /onSaveWebSearchConfig:\s*configMutationHandlers\.onSaveWebSearchConfig/,
    );
    assert.match(
      detailSource,
      /onSaveWebFetchConfig:\s*configMutationHandlers\.onSaveWebFetchConfig/,
    );
    assert.match(
      detailSource,
      /onSaveWebSearchNativeCodexConfig:\s*configMutationHandlers\.onSaveWebSearchNativeCodexConfig/,
    );
    assert.match(
      detailSource,
      /onSaveXSearchConfig:\s*configMutationHandlers\.onSaveXSearchConfig/,
    );
    assert.match(
      detailSource,
      /onSaveAuthCooldownsConfig:\s*configMutationHandlers\.onSaveAuthCooldownsConfig/,
    );

    assert.match(
      configMutationSupportSource,
      /export function createOpenClawConfigSaveRunner/,
    );
    assert.match(
      configMutationSupportSource,
      /export function buildOpenClawConfigMutationHandlers/,
    );
    assert.doesNotMatch(
      configMutationSupportSource,
      /openClawManagedConfigMutationSupport\.ts/,
    );
    assert.doesNotMatch(configMutationSupportSource, /instanceService\./);
    assert.doesNotMatch(configMutationSupportSource, /toast\./);
    assert.doesNotMatch(configMutationSupportSource, /await loadWorkbench\(/);
    assert.match(
      configMutationExecutorSupportSource,
      /export function createInstanceDetailConfigMutationExecutors/,
    );
    assert.match(
      configMutationExecutorSupportSource,
      /saveOpenClawWebSearchConfig: ConfigMutationExecutors\['webSearch'\]\['executeSave'\]/,
    );
    assert.match(
      configMutationExecutorSupportSource,
      /saveOpenClawXSearchConfig: ConfigMutationExecutors\['xSearch'\]\['executeSave'\]/,
    );
    assert.match(
      configMutationExecutorSupportSource,
      /saveOpenClawWebSearchNativeCodexConfig: ConfigMutationExecutors\['webSearchNativeCodex'\]\['executeSave'\]/,
    );
    assert.match(
      configMutationExecutorSupportSource,
      /saveOpenClawWebFetchConfig: ConfigMutationExecutors\['webFetch'\]\['executeSave'\]/,
    );
    assert.match(
      configMutationExecutorSupportSource,
      /saveOpenClawAuthCooldownsConfig: ConfigMutationExecutors\['authCooldowns'\]\['executeSave'\]/,
    );
    assert.match(
      configMutationExecutorSupportSource,
      /saveOpenClawDreamingConfig: ConfigMutationExecutors\['dreaming'\]\['executeSave'\]/,
    );
    assert.doesNotMatch(
      configMutationExecutorSupportSource,
      /openClawManagedConfigMutationSupport\.ts/,
    );
    assert.equal(
      exists(
        'packages/sdkwork-claw-instances/src/services/openClawManagedConfigMutationSupport.ts',
      ),
      false,
    );
    assert.equal(
      exists(
        'packages/sdkwork-claw-instances/src/services/instanceDetailManagedConfigMutationSupport.ts',
      ),
      false,
    );
    assert.doesNotMatch(configMutationExecutorSupportSource, /toast\./);
    assert.doesNotMatch(configMutationExecutorSupportSource, /navigate\(/);
    assert.doesNotMatch(configMutationExecutorSupportSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes instance detail navigation and shared status label mapping through a dedicated helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const navigationSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailNavigationSupport.ts',
    );
    const navigationHandlers = extractBetween(
      detailSource,
      '  const getSharedStatusLabel = ',
      '  const agentDialogStateHandlers = buildOpenClawAgentDialogStateHandlers({',
    );

    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceDetailNavigationSupport.ts'),
    );
    assert.match(servicesIndexSource, /instanceDetailNavigationSupport/);
    assert.match(navigationHandlers, /createSharedStatusLabelGetter\(t\)/);
    assert.match(navigationHandlers, /buildInstanceDetailNavigationHandlers\(\{/);
    assert.match(navigationHandlers, /instance,/);
    assert.match(navigationHandlers, /navigate,/);
    assert.match(navigationHandlers, /openAgentMarketModal: \(\) => \{/);
    assert.match(navigationHandlers, /setActiveInstanceId,/);

    assert.doesNotMatch(detailSource, /const getSharedStatusLabel = \(status: string\) => /);
    assert.doesNotMatch(detailSource, /onOpenAgentMarket: \(\) =>/);
    assert.doesNotMatch(detailSource, /onOpenProviderCenter: \(\) => navigate\('\/settings\?tab=api'\)/);
    assert.doesNotMatch(detailSource, /onClick=\{\(\) => navigate\('\/instances'\)\}/);
    assert.doesNotMatch(detailSource, /onSetActive=\{\(\) => setActiveInstanceId\(instance\.id\)\}/);

    assert.doesNotMatch(detailSource, /onOpenAgentMarket: detailNavigationHandlers\.onOpenAgentMarket,/);
    assert.match(detailSource, /onOpenProviderCenter: detailNavigationHandlers\.onOpenProviderCenter,/);
    assert.match(detailSource, /onClick=\{detailNavigationHandlers\.onBackToInstances\}/);
    assert.match(detailSource, /onSetActive=\{detailNavigationHandlers\.onSetActive\}/);

    assert.match(
      navigationSupportSource,
      /export function createSharedStatusLabelGetter\(/,
    );
    assert.match(
      navigationSupportSource,
      /export function buildInstanceDetailNavigationHandlers\(/,
    );
    assert.doesNotMatch(navigationSupportSource, /toast\./);
    assert.doesNotMatch(navigationSupportSource, /instanceService\./);
    assert.doesNotMatch(navigationSupportSource, /window\.confirm\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes the page-owned section availability renderer through a dedicated helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const availabilitySupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailSectionAvailabilitySupport.ts',
    );
    const availabilityRendererBuilder = extractBetween(
      detailSource,
      '  const configMutationHandlers = ',
      '  const agentSectionProps = buildAgentSectionProps({',
    );

    assert.ok(
      exists(
        'packages/sdkwork-claw-instances/src/services/instanceDetailSectionAvailabilitySupport.ts',
      ),
    );
    assert.match(servicesIndexSource, /instanceDetailSectionAvailabilitySupport/);
    assert.match(
      availabilityRendererBuilder,
      /const renderWorkbenchSectionAvailability = createInstanceDetailSectionAvailabilityRenderer\(\{/,
    );
    assert.match(availabilityRendererBuilder, /workbench(?:\s*,|:\s*displayWorkbench,)/);
    assert.match(availabilityRendererBuilder, /t,/);
    assert.match(availabilityRendererBuilder, /formatWorkbenchLabel,/);
    assert.match(availabilityRendererBuilder, /getCapabilityTone,/);
    assert.match(
      availabilityRendererBuilder,
      /renderAvailability: renderInstanceDetailSectionAvailability,/,
    );

    assert.doesNotMatch(
      detailSource,
      /const renderWorkbenchSectionAvailability = \(\s*sectionId: InstanceWorkbenchSectionId,/,
    );
    assert.doesNotMatch(detailSource, /renderInstanceDetailSectionAvailability\(\{/);
    assert.match(
      detailSource,
      /availabilityNotice: renderWorkbenchSectionAvailability\(\s*'llmProviders',/,
    );
    assert.match(
      detailSource,
      /renderSectionAvailability: renderWorkbenchSectionAvailability,/,
    );

    assert.match(
      availabilitySupportSource,
      /export function createInstanceDetailSectionAvailabilityRenderer/,
    );
    assert.doesNotMatch(availabilitySupportSource, /toast\./);
    assert.doesNotMatch(availabilitySupportSource, /instanceService\./);
    assert.doesNotMatch(availabilitySupportSource, /navigate\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes current-instance silent reload callbacks through a dedicated helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const detailSectionModelsSource = read(
      'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
    );
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const reloadSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailReloadSupport.ts',
    );
    const agentSectionPropsBuilder = extractBetween(
      detailSectionModelsSource,
      'export function buildAgentSectionProps({',
      'export function buildLlmProviderSectionProps({',
    );

    assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceDetailReloadSupport.ts'));
    assert.match(servicesIndexSource, /instanceDetailReloadSupport/);

    assert.match(
      detailSource,
      /const reloadCurrentWorkbenchSilently = createInstanceDetailSilentWorkbenchReloadHandler\(\{/,
    );
    assert.match(detailSource, /instanceId: id,/);
    assert.match(detailSource, /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/);
    assert.match(detailSource, /onReloadFiles=\{reloadCurrentWorkbenchSilently\}/);
    assert.match(detailSource, /onReloadConfig=\{reloadCurrentWorkbenchSilently\}/);
    assert.doesNotMatch(
      detailSource,
      /onReloadFiles=\{\(\) => \(id \? loadWorkbench\(id, \{ withSpinner: false \}\) : undefined\)\}/,
    );
    assert.doesNotMatch(
      detailSource,
      /onReloadConfig=\{\(\) => \(id \? loadWorkbench\(id, \{ withSpinner: false \}\) : undefined\)\}/,
    );

    assert.match(
      agentSectionPropsBuilder,
      /const reloadAgentWorkbenchSilently = createInstanceDetailSilentWorkbenchReloadHandler\(\{/,
    );
    assert.match(agentSectionPropsBuilder, /instanceId,/);
    assert.match(agentSectionPropsBuilder, /reloadWorkbench: loadWorkbench,/);
    assert.match(agentSectionPropsBuilder, /onReload: reloadAgentWorkbenchSilently,/);
    assert.doesNotMatch(
      agentSectionPropsBuilder,
      /onReload: \(\) => \(instanceId \? loadWorkbench\(instanceId, \{ withSpinner: false \}\) : undefined\),/,
    );

    assert.match(
      reloadSupportSource,
      /export function createInstanceDetailSilentWorkbenchReloadHandler/,
    );
    assert.doesNotMatch(reloadSupportSource, /toast\./);
    assert.doesNotMatch(reloadSupportSource, /instanceService\./);
    assert.doesNotMatch(reloadSupportSource, /navigate\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes page-owned workbench reload adapters through the reload support helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const reloadSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailReloadSupport.ts',
    );
    const providerCatalogRunner = extractBetween(
      detailSource,
      '  const runProviderCatalogMutation = ',
      '  const providerMutationHandlers = ',
    );
    const agentSkillRunner = extractBetween(
      detailSource,
      '  const runAgentSkillMutation = ',
      '  const agentSkillMutationHandlers = ',
    );
    const agentRunner = extractBetween(
      detailSource,
      '  const runAgentMutation = ',
      '  const agentMutationHandlers = ',
    );
    const lifecycleRunner = extractBetween(
      detailSource,
      '  const runLifecycleAction = ',
      '  const lifecycleActionHandlers = ',
    );
    const configChannelRunner = extractBetween(
      detailSource,
      '  const runConfigChannelMutation = ',
      '  const configChannelStateHandlers = ',
    );
    const configRunner = extractBetween(
      detailSource,
      '  const runConfigSave = ',
      '  const configDraftChangeHandlers = ',
    );

    assert.match(
      detailSource,
      /const workbenchReloadHandlers = createInstanceDetailWorkbenchReloadHandlers\(\{/,
    );
    assert.match(detailSource, /loadWorkbench,/);
    assert.match(providerCatalogRunner, /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/);
    assert.match(agentSkillRunner, /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/);
    assert.match(agentRunner, /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/);
    assert.match(
      detailSource,
      /const baseRunLifecycleAction = createInstanceLifecycleActionRunner\(\{[\s\S]*reloadWorkbench: workbenchReloadHandlers\.reloadWorkbenchImmediately,[\s\S]*\}\);/s,
    );
    assert.match(lifecycleRunner, /const didSucceed = await baseRunLifecycleAction\(request\);/);
    assert.match(
      configChannelRunner,
      /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/,
    );
    assert.match(configRunner, /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/);

    assert.doesNotMatch(
      detailSource,
      /reloadWorkbench: \(instanceId, options\) => loadWorkbench\(instanceId, options\)/,
    );
    assert.doesNotMatch(
      detailSource,
      /reloadWorkbench: \(instanceId\) => loadWorkbench\(instanceId\)/,
    );

    assert.match(
      reloadSupportSource,
      /export function createInstanceDetailWorkbenchReloadHandlers/,
    );
    assert.match(reloadSupportSource, /reloadWorkbenchImmediately:/);
    assert.doesNotMatch(reloadSupportSource, /toast\./);
    assert.doesNotMatch(reloadSupportSource, /instanceService\./);
    assert.doesNotMatch(reloadSupportSource, /navigate\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes page-owned toast reporters through a dedicated helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const toastSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailToastSupport.ts',
    );

    assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceDetailToastSupport.ts'));
    assert.match(servicesIndexSource, /instanceDetailToastSupport/);
    assert.match(
      detailSource,
      /const toastReporters = createInstanceDetailToastReporters\(\{\s*toast,\s*\}\);/,
    );
    assert.doesNotMatch(
      detailSource,
      /reportSuccess: \(message\) => toast\.success\(message\)/,
    );
    assert.doesNotMatch(
      detailSource,
      /reportError: \(message\) => toast\.error\(message\)/,
    );
    assert.doesNotMatch(
      detailSource,
      /reportInfo: \(message\) => toast\.info\(message\)/,
    );

    assert.match(toastSupportSource, /export function createInstanceDetailToastReporters/);
    assert.doesNotMatch(toastSupportSource, /instanceService\./);
    assert.doesNotMatch(toastSupportSource, /navigate\(/);
    assert.doesNotMatch(toastSupportSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes page-owned console error reporters through a dedicated helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const consoleErrorSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailConsoleErrorSupport.ts',
    );

    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceDetailConsoleErrorSupport.ts'),
    );
    assert.match(servicesIndexSource, /instanceDetailConsoleErrorSupport/);
    assert.match(
      detailSource,
      /const consoleErrorReporters = createInstanceDetailConsoleErrorReporters\(\{\s*console,\s*\}\);/,
    );
    assert.match(detailSource, /reportError: consoleErrorReporters\.reportWorkbenchLoadError,/);
    assert.match(detailSource, /reportError: consoleErrorReporters\.reportAgentWorkbenchLoadError,/);
    assert.match(detailSource, /reportError: consoleErrorReporters\.reportInstanceFilesLoadError,/);
    assert.match(detailSource, /reportError: consoleErrorReporters\.reportInstanceMemoriesLoadError,/);
    assert.doesNotMatch(detailSource, /console\.error\('Failed to fetch instance workbench:', error\)/);
    assert.doesNotMatch(
      detailSource,
      /reportError: \(error\) => console\.error\('Failed to load agent workbench:', error\)/,
    );
    assert.doesNotMatch(
      detailSource,
      /reportError: \(error\) => console\.error\('Failed to load instance files:', error\)/,
    );
    assert.doesNotMatch(
      detailSource,
      /reportError: \(error\) => console\.error\('Failed to load instance memories:', error\)/,
    );

    assert.match(
      consoleErrorSupportSource,
      /export function createInstanceDetailConsoleErrorReporters/,
    );
    assert.doesNotMatch(consoleErrorSupportSource, /instanceService\./);
    assert.doesNotMatch(consoleErrorSupportSource, /navigate\(/);
    assert.doesNotMatch(consoleErrorSupportSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes OpenClaw agent mutation orchestration through a shared helper while keeping write authority in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const agentMutationSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.ts',
    );
    const agentMutationStateSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailAgentMutationStateSupport.ts',
    );
    const agentMutationExecutorSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailAgentMutationSupport.ts',
    );
    const agentMutationRunner = extractBetween(
      detailSource,
      '  const runAgentMutation = ',
      '  const agentMutationHandlers = ',
    );
    const agentMutationHandlers = extractBetween(
      detailSource,
      '  const agentMutationHandlers = ',
      '  const runLifecycleAction = ',
    );

    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/openClawAgentMutationSupport.ts'),
    );
    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceDetailAgentMutationSupport.ts'),
    );
    assert.match(servicesIndexSource, /openClawAgentMutationSupport/);
    assert.match(servicesIndexSource, /instanceDetailAgentMutationSupport/);
    assert.match(
      detailSource,
      /const agentMutationExecutors = createInstanceDetailAgentMutationExecutors\(\{\s*instanceService,\s*\}\);/,
    );
    assert.match(agentMutationRunner, /createOpenClawAgentMutationRunner\(\{/);
    assert.match(agentMutationRunner, /\.\.\.agentMutationExecutors,/);
    assert.match(
      agentMutationRunner,
      /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/,
    );
    assert.match(agentMutationRunner, /reportSuccess: toastReporters\.reportSuccess,/);
    assert.match(agentMutationRunner, /reportError: toastReporters\.reportError,/);
    assert.doesNotMatch(
      agentMutationRunner,
      /executeCreate: \(instanceId, agent(?:: OpenClawAgentInput)?\) =>\s+instanceService\.createOpenClawAgent\(instanceId, agent\)/,
    );
    assert.doesNotMatch(
      agentMutationRunner,
      /executeUpdate: \(instanceId, agent(?:: OpenClawAgentInput)?\) =>\s+instanceService\.updateOpenClawAgent\(instanceId, agent\)/,
    );
    assert.doesNotMatch(
      agentMutationRunner,
      /executeDelete: \(instanceId, agentId\) => instanceService\.deleteOpenClawAgent\(instanceId, agentId\)/,
    );

    assert.match(detailSource, /buildOpenClawAgentMutationHandlers\(\{/);
    assert.match(agentMutationHandlers, /executeMutation: runAgentMutation,/);
    assert.match(agentMutationHandlers, /reportError: toastReporters\.reportError,/);
    assert.match(
      detailSource,
      /const agentMutationStateBindings = createInstanceDetailAgentMutationStateBindings\(\{\s*setIsAgentCreationWorkflowOpen,\s*setIsAgentDialogOpen,\s*setEditingAgentId,\s*setAgentDeleteId,\s*\}\);/s,
    );
    assert.match(
      agentMutationHandlers,
      /dismissAgentDialog: agentMutationStateBindings\.dismissAgentDialog,/,
    );
    assert.match(
      agentMutationHandlers,
      /clearAgentDeleteId: agentMutationStateBindings\.clearAgentDeleteId,/,
    );
    assert.doesNotMatch(agentMutationHandlers, /instanceService\.updateOpenClawAgent\(/);
    assert.doesNotMatch(agentMutationHandlers, /instanceService\.createOpenClawAgent\(/);
    assert.doesNotMatch(agentMutationHandlers, /instanceService\.deleteOpenClawAgent\(/);
    assert.doesNotMatch(agentMutationHandlers, /await loadWorkbench\(/);
    assert.doesNotMatch(agentMutationHandlers, /dismissAgentDialog: \(\) => \{/);
    assert.doesNotMatch(
      agentMutationHandlers,
      /clearAgentDeleteId: \(\) => setAgentDeleteId\(null\),/,
    );
    assert.doesNotMatch(detailSource, /const handleSaveAgentDialog = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const handleDeleteAgent = async \(\) => \{/);

    assert.match(
      agentMutationSupportSource,
      /export function buildOpenClawAgentMutationHandlers/,
    );
    assert.match(
      agentMutationSupportSource,
      /export function buildOpenClawAgentSaveMutationRequest/,
    );
    assert.match(
      agentMutationSupportSource,
      /export function buildOpenClawAgentDeleteMutationRequest/,
    );
    assert.match(
      agentMutationSupportSource,
      /export function createOpenClawAgentMutationRunner/,
    );
    assert.doesNotMatch(agentMutationSupportSource, /instanceService\./);
    assert.doesNotMatch(agentMutationSupportSource, /toast\./);
    assert.doesNotMatch(agentMutationSupportSource, /await loadWorkbench\(/);
    assert.match(
      agentMutationStateSupportSource,
      /export function createInstanceDetailAgentMutationStateBindings\(args: \{/,
    );
    assert.match(agentMutationStateSupportSource, /dismissAgentDialog: \(\) => \{/);
    assert.match(
      agentMutationStateSupportSource,
      /args\.setIsAgentCreationWorkflowOpen\(false\);/,
    );
    assert.match(agentMutationStateSupportSource, /args\.setIsAgentDialogOpen\(false\);/);
    assert.match(agentMutationStateSupportSource, /args\.setEditingAgentId\(null\);/);
    assert.match(
      agentMutationStateSupportSource,
      /clearAgentDeleteId: \(\) => args\.setAgentDeleteId\(null\)/,
    );
    assert.doesNotMatch(agentMutationStateSupportSource, /instanceService\./);
    assert.doesNotMatch(agentMutationStateSupportSource, /toast\./);
    assert.doesNotMatch(agentMutationStateSupportSource, /loadWorkbench\(/);

    assert.match(
      agentMutationExecutorSupportSource,
      /export function createInstanceDetailAgentMutationExecutors/,
    );
    assert.match(
      agentMutationExecutorSupportSource,
      /createOpenClawAgent: AgentMutationExecutors\['executeCreate'\]/,
    );
    assert.match(
      agentMutationExecutorSupportSource,
      /updateOpenClawAgent: AgentMutationExecutors\['executeUpdate'\]/,
    );
    assert.match(
      agentMutationExecutorSupportSource,
      /deleteOpenClawAgent: AgentMutationExecutors\['executeDelete'\]/,
    );
    assert.doesNotMatch(agentMutationExecutorSupportSource, /toast\./);
    assert.doesNotMatch(agentMutationExecutorSupportSource, /navigate\(/);
    assert.doesNotMatch(agentMutationExecutorSupportSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes OpenClaw agent dialog draft selection through shared presentation helpers while keeping dialog visibility in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const agentPresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.ts',
    );
    const agentDialogHandlers = extractBetween(
      detailSource,
      '  const agentDialogStateHandlers = ',
      '  const providerDialogStateHandlers = ',
    );

    assert.match(detailSource, /buildOpenClawAgentDialogStateHandlers\(\{/);
    assert.match(agentDialogHandlers, /selectedAgentWorkbench,/);
    assert.match(agentDialogHandlers, /setEditingAgentId,/);
    assert.match(agentDialogHandlers, /setAgentDialogDraft,/);
    assert.match(agentDialogHandlers, /setIsAgentDialogOpen,/);
    assert.doesNotMatch(detailSource, /const openCreateAgentDialog = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const openEditAgentDialog = /);
    assert.match(detailSource, /const openAgentCreationWorkflow = \(\) => \{/);
    assert.match(detailSource, /createOpenClawAgentCreateDialogState\(\)/);
    assert.match(detailSource, /onOpenAgentCreationWorkflow: openAgentCreationWorkflow,/);
    assert.match(detailSource, /onEditAgent: agentDialogStateHandlers\.openEditAgentDialog,/);

    assert.match(
      agentPresentationSource,
      /export function buildOpenClawAgentDialogStateHandlers\(/,
    );
    assert.match(
      agentPresentationSource,
      /export function createOpenClawAgentCreateDialogState\(/,
    );
    assert.match(
      agentPresentationSource,
      /export function createOpenClawAgentEditDialogState\(/,
    );
    assert.doesNotMatch(agentPresentationSource, /toast\./);
    assert.doesNotMatch(agentPresentationSource, /instanceService\./);
  },
);

runTest(
  'sdkwork-claw-instances routes OpenClaw agent model option projection through a shared presentation helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const derivedStateSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
    );
    const agentPresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawAgentPresentation.ts',
    );
    const agentModelOptionProjection = extractBetween(
      derivedStateSource,
      '    providerDialogPresentation: buildOpenClawProviderDialogPresentation({',
      '    readonlyChannelWorkspaceItems:',
    );

    assert.match(detailSource, /buildInstanceDetailDerivedState/);
    assert.match(derivedStateSource, /buildOpenClawAgentModelOptions/);
    assert.match(
      agentModelOptionProjection,
      /availableAgentModelOptions: buildOpenClawAgentModelOptions\(workbench\?\.llmProviders\),/,
    );
    assert.doesNotMatch(agentModelOptionProjection, /const availableAgentModelOptions = useMemo\(/);
    assert.doesNotMatch(agentModelOptionProjection, /new Map<string, \{ value: string; label: string \}>/);
    assert.doesNotMatch(agentModelOptionProjection, /normalizeLegacyProviderId\(provider\.id\)/);
    assert.doesNotMatch(agentModelOptionProjection, /provider\.models\.forEach/);

    assert.match(
      agentPresentationSource,
      /export function buildOpenClawAgentModelOptions\(/,
    );
    assert.doesNotMatch(agentPresentationSource, /toast\./);
    assert.doesNotMatch(agentPresentationSource, /instanceService\./);
  },
);

runTest(
  'sdkwork-claw-instances routes main workbench loading orchestration through a cancellable shared helper while keeping module-source authority in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const workbenchStateSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailWorkbenchState.ts',
    );
    const mainWorkbenchLoadBlock = extractBetween(
      detailSource,
      'const loadWorkbench = async (',
      'useEffect(() => () => {',
    );
    const unmountCleanupBlock = extractBetween(
      detailSource,
      'useEffect(() => () => {',
      'useEffect(() => {',
    );

    assert.match(
      detailSource,
      /const loadWorkbenchRequestRef = useRef<ReturnType<typeof startLoadInstanceDetailWorkbench> \| null>\(null\);/,
    );
    assert.match(detailSource, /startLoadInstanceDetailWorkbench\(\{/);
    assert.match(servicesIndexSource, /instanceDetailWorkbenchState/);
    assert.match(mainWorkbenchLoadBlock, /loadWorkbenchRequestRef\.current\?\.cancel\(\);/);
    assert.match(
      mainWorkbenchLoadBlock,
      /const request = startLoadInstanceDetailWorkbench\(\{/,
    );
    assert.match(mainWorkbenchLoadBlock, /setWorkbench,/);
    assert.match(mainWorkbenchLoadBlock, /setConfig,/);
    assert.match(mainWorkbenchLoadBlock, /setIsLoading,/);
    assert.match(
      mainWorkbenchLoadBlock,
      /loadWorkbench:\s*async\s*\(instanceId\)\s*=>/,
    );
    assert.match(mainWorkbenchLoadBlock, /source\.instanceId === instanceId/);
    assert.match(
      mainWorkbenchLoadBlock,
      /getOpenClawWorkbenchFromModulePayload\(await source\.loadModulePayload\(\)\)/,
    );
    assert.match(
      mainWorkbenchLoadBlock,
      /instanceWorkbenchService\.getInstanceWorkbench\(instanceId\)/,
    );
    assert.match(
      mainWorkbenchLoadBlock,
      /reportError: consoleErrorReporters\.reportWorkbenchLoadError,/,
    );
    assert.match(mainWorkbenchLoadBlock, /loadWorkbenchRequestRef\.current = request;/);
    assert.doesNotMatch(mainWorkbenchLoadBlock, /try\s*\{/);
    assert.doesNotMatch(mainWorkbenchLoadBlock, /setWorkbench\(nextWorkbench\);/);
    assert.doesNotMatch(
      mainWorkbenchLoadBlock,
      /setConfig\(nextWorkbench\?\.config \|\| null\);/,
    );
    assert.doesNotMatch(mainWorkbenchLoadBlock, /setIsLoading\(true\);/);
    assert.doesNotMatch(mainWorkbenchLoadBlock, /setIsLoading\(false\);/);
    assert.match(unmountCleanupBlock, /loadWorkbenchRequestRef\.current\?\.cancel\(\);/);

    assert.match(
      workbenchStateSource,
      /export interface InstanceDetailWorkbenchLoadRequest \{/,
    );
    assert.match(workbenchStateSource, /cancel: \(\) => void;/);
    assert.match(workbenchStateSource, /promise: Promise<void>;/);
    assert.match(
      workbenchStateSource,
      /export function startLoadInstanceDetailWorkbench\(/,
    );
    assert.match(workbenchStateSource, /let cancelled = false;/);
    assert.match(
      workbenchStateSource,
      /if \(showSpinner\) \{\s*setIsLoading\(true\);\s*\}/s,
    );
    assert.match(
      workbenchStateSource,
      /import \{ normalizeInstanceWorkbenchSnapshot \} from '\.\/instanceWorkbenchNormalization\.ts';/,
    );
    assert.match(
      workbenchStateSource,
      /if \(cancelled\) \{\s*return;\s*\}\s*const normalizedWorkbench = normalizeInstanceWorkbenchSnapshot\(nextWorkbench\);\s*setWorkbench\(normalizedWorkbench\);/s,
    );
    assert.match(
      workbenchStateSource,
      /setConfig\(normalizedWorkbench\?\.config \|\| null\);/,
    );
    assert.match(workbenchStateSource, /reportError\(error\);/);
    assert.match(
      workbenchStateSource,
      /if \(preserveStateOnError !== true\) \{\s*setWorkbench\(null\);\s*setConfig\(null\);\s*\}/s,
    );
    assert.match(
      workbenchStateSource,
      /if \(!cancelled && showSpinner\) \{\s*setIsLoading\(false\);\s*\}/s,
    );
    assert.match(
      workbenchStateSource,
      /cancel\(\) \{\s*cancelled = true;\s*\}/s,
    );
    assert.doesNotMatch(workbenchStateSource, /instanceWorkbenchService\./);
    assert.doesNotMatch(workbenchStateSource, /source\.loadModulePayload/);
    assert.match(servicesIndexSource, /instanceWorkbenchNormalization/);
  },
);

runTest(
  'sdkwork-claw-instances routes OpenClaw agent reset baselines through a shared presentation helper while keeping setter ownership in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const instanceDetailResetSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailResetState.ts',
    );
    const instanceSwitchResetEffect = extractBetween(
      detailSource,
      'applyInstanceDetailInstanceSwitchResetState({',
      '  }, [id]);',
    );

    assert.match(detailSource, /applyInstanceDetailInstanceSwitchResetState\(\{/);
    assert.match(instanceSwitchResetEffect, /setSelectedAgentId,/);
    assert.match(instanceSwitchResetEffect, /setSelectedAgentWorkbench,/);
    assert.match(instanceSwitchResetEffect, /setAgentWorkbenchError,/);
    assert.match(instanceSwitchResetEffect, /setAgentDialogDraft,/);
    assert.match(instanceSwitchResetEffect, /setEditingAgentId,/);
    assert.match(instanceSwitchResetEffect, /setRemovingAgentSkillKeys,/);
    assert.doesNotMatch(detailSource, /createOpenClawAgentWorkspaceResetState/);
    assert.match(
      instanceDetailResetSource,
      /const agentWorkspaceResetState = createOpenClawAgentWorkspaceResetState\(\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setSelectedAgentId\(agentWorkspaceResetState\.selectedAgentId\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setSelectedAgentWorkbench\(agentWorkspaceResetState\.selectedAgentWorkbench\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setAgentWorkbenchError\(agentWorkspaceResetState\.workbenchError\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setAgentDialogDraft\(agentWorkspaceResetState\.dialogState\.draft\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setEditingAgentId\(agentWorkspaceResetState\.dialogState\.editingAgentId\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setRemovingAgentSkillKeys\(agentWorkspaceResetState\.removingSkillKeys\);/,
    );
    assert.doesNotMatch(instanceDetailResetSource, /setSelectedAgentId\(null\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setSelectedAgentWorkbench\(null\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setAgentWorkbenchError\(null\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setIsAgentWorkbenchLoading\(false\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setAgentDeleteId\(null\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setIsInstallingAgentSkill\(false\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setUpdatingAgentSkillKeys\(\[\]\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setRemovingAgentSkillKeys\(\[\]\);/);
    assert.doesNotMatch(instanceDetailResetSource, /createOpenClawAgentCreateDialogState\(\)/);

    assert.match(
      instanceDetailResetSource,
      /export function applyInstanceDetailInstanceSwitchResetState\(/,
    );
    assert.doesNotMatch(instanceDetailResetSource, /toast\./);
    assert.doesNotMatch(instanceDetailResetSource, /instanceService\./);
  },
);

runTest(
  'sdkwork-claw-instances routes workbench hydration reset baselines through a shared helper while keeping setter ownership in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const instanceDetailResetSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailResetState.ts',
    );
    const hydrationResetEffect = extractBetween(
      detailSource,
      'applyInstanceDetailInstanceSwitchResetState({',
      'setIsProviderDialogOpen,',
    );

    assert.match(detailSource, /applyInstanceDetailInstanceSwitchResetState\(\{/);
    assert.match(hydrationResetEffect, /setIsWorkbenchFilesLoading,/);
    assert.match(hydrationResetEffect, /setIsWorkbenchMemoryLoading,/);
    assert.doesNotMatch(detailSource, /createInstanceWorkbenchHydrationResetState/);
    assert.match(
      instanceDetailResetSource,
      /const workbenchHydrationResetState = createInstanceWorkbenchHydrationResetState\(\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setIsWorkbenchFilesLoading\(workbenchHydrationResetState\.isFilesLoading\);/,
    );
    assert.match(
      instanceDetailResetSource,
      /setIsWorkbenchMemoryLoading\(workbenchHydrationResetState\.isMemoryLoading\);/,
    );
    assert.doesNotMatch(instanceDetailResetSource, /setIsWorkbenchFilesLoading\(false\);/);
    assert.doesNotMatch(instanceDetailResetSource, /setIsWorkbenchMemoryLoading\(false\);/);

    assert.match(
      instanceDetailResetSource,
      /createInstanceWorkbenchHydrationResetState\(/,
    );
    assert.doesNotMatch(instanceDetailResetSource, /toast\./);
    assert.doesNotMatch(instanceDetailResetSource, /instanceService\./);
    assert.doesNotMatch(instanceDetailResetSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes workbench lazy-load orchestration through a shared hydration helper while keeping load authority in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const hydrationSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceWorkbenchHydration.ts',
    );
    const loaderSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailWorkbenchLoaderSupport.ts',
    );

    assert.match(detailSource, /startLazyLoadInstanceWorkbenchFiles\(\{/);
    assert.match(
      detailSource,
      /const workbenchLoaderBindings = createInstanceDetailWorkbenchLoaderBindings\(\{\s*agentWorkbenchService,\s*instanceWorkbenchService,\s*\}\);/s,
    );
    assert.match(
      detailSource,
      /loadFiles: workbenchLoaderBindings\.loadFiles,/,
    );
    assert.match(detailSource, /setIsLoading: setIsWorkbenchFilesLoading,/);
    assert.match(
      detailSource,
      /reportError: consoleErrorReporters\.reportInstanceFilesLoadError,/,
    );
    assert.match(detailSource, /startLazyLoadInstanceWorkbenchMemory\(\{/);
    assert.match(
      detailSource,
      /loadMemories: workbenchLoaderBindings\.loadMemories,/,
    );
    assert.match(detailSource, /setIsLoading: setIsWorkbenchMemoryLoading,/);
    assert.match(
      detailSource,
      /reportError: consoleErrorReporters\.reportInstanceMemoriesLoadError,/,
    );
    assert.doesNotMatch(detailSource, /shouldLazyLoadInstanceWorkbenchFiles\(/);
    assert.doesNotMatch(detailSource, /shouldLazyLoadInstanceWorkbenchMemory\(/);
    assert.doesNotMatch(detailSource, /mergeLazyLoadedWorkbenchFiles\(/);
    assert.doesNotMatch(detailSource, /mergeLazyLoadedWorkbenchMemories\(/);

    assert.match(hydrationSource, /export function startLazyLoadInstanceWorkbenchFiles\(/);
    assert.match(
      hydrationSource,
      /shouldLazyLoadInstanceWorkbenchFiles\(\{ activeSection, detail, workbench \}\)/,
    );
    assert.match(hydrationSource, /mergeLazyLoadedWorkbenchFiles\(current, files\)/);
    assert.match(hydrationSource, /export function startLazyLoadInstanceWorkbenchMemory\(/);
    assert.match(
      hydrationSource,
      /shouldLazyLoadInstanceWorkbenchMemory\(\{ activeSection, detail, workbench \}\)/,
    );
    assert.match(hydrationSource, /mergeLazyLoadedWorkbenchMemories\(current, memories\)/);
    assert.match(
      loaderSupportSource,
      /export function createInstanceDetailWorkbenchLoaderBindings\(args: \{/,
    );
    assert.match(
      loaderSupportSource,
      /loadFiles: \(instanceId, agents\) => args\.instanceWorkbenchService\.listInstanceFiles\(instanceId, agents\)/,
    );
    assert.match(
      loaderSupportSource,
      /loadMemories: \(instanceId, agents\) => args\.instanceWorkbenchService\.listInstanceMemories\(instanceId, agents\)/,
    );
    assert.doesNotMatch(
      detailSource,
      /loadFiles: \(instanceId, agents\) => instanceWorkbenchService\.listInstanceFiles\(instanceId, agents\)/,
    );
    assert.doesNotMatch(
      detailSource,
      /loadMemories: \(instanceId, agents\) => instanceWorkbenchService\.listInstanceMemories\(instanceId, agents\)/,
    );
    assert.doesNotMatch(loaderSupportSource, /toast\./);
    assert.doesNotMatch(loaderSupportSource, /consoleErrorReporters/);
    assert.doesNotMatch(loaderSupportSource, /loadWorkbench\(/);
    assert.doesNotMatch(hydrationSource, /instanceWorkbenchService\./);
    assert.doesNotMatch(hydrationSource, /toast\./);
    assert.doesNotMatch(hydrationSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes agent workbench selection and loading orchestration through a shared helper while keeping load authority in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const agentWorkbenchStateSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailAgentWorkbenchState.ts',
    );
    const loaderSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailWorkbenchLoaderSupport.ts',
    );
    const agentSelectionSyncEffect = extractBetween(
      detailSource,
      'const agents = workbench?.agents || [];',
      'return startLoadInstanceDetailAgentWorkbench({',
    );
    const agentWorkbenchLoadEffect = extractBetween(
      detailSource,
      'return startLoadInstanceDetailAgentWorkbench({',
      '}, [activeSection, displayWorkbench, id, selectedAgentId]);',
    );

    assert.match(detailSource, /applyInstanceDetailAgentWorkbenchSyncState\(\{/);
    assert.match(agentSelectionSyncEffect, /setSelectedAgentId,/);
    assert.match(agentSelectionSyncEffect, /setSelectedAgentWorkbench,/);
    assert.match(agentSelectionSyncEffect, /setAgentWorkbenchError,/);
    assert.match(agentSelectionSyncEffect, /setIsAgentWorkbenchLoading,/);
    assert.doesNotMatch(agentSelectionSyncEffect, /agents\.length === 0/);
    assert.doesNotMatch(agentSelectionSyncEffect, /agents\.some/);

    assert.match(detailSource, /startLoadInstanceDetailAgentWorkbench\(\{/);
    assert.match(detailSource, /workbench: displayWorkbench,/);
    assert.match(
      detailSource,
      /loadAgentWorkbench: workbenchLoaderBindings\.loadAgentWorkbench,/,
    );
    assert.match(
      detailSource,
      /reportError: consoleErrorReporters\.reportAgentWorkbenchLoadError,/,
    );
    assert.match(detailSource, /fallbackErrorMessage: 'Failed to load agent detail\.',/);
    assert.doesNotMatch(agentWorkbenchLoadEffect, /let cancelled = false/);
    assert.doesNotMatch(agentWorkbenchLoadEffect, /setSelectedAgentWorkbench\(null\);/);
    assert.doesNotMatch(agentWorkbenchLoadEffect, /setAgentWorkbenchError\(null\);/);
    assert.doesNotMatch(agentWorkbenchLoadEffect, /setIsAgentWorkbenchLoading\(true\);/);

    assert.match(
      agentWorkbenchStateSource,
      /export function applyInstanceDetailAgentWorkbenchSyncState\(/,
    );
    assert.match(
      agentWorkbenchStateSource,
      /setSelectedAgentId\(\(current\) =>/,
    );
    assert.match(
      agentWorkbenchStateSource,
      /export function startLoadInstanceDetailAgentWorkbench\(/,
    );
    assert.match(agentWorkbenchStateSource, /loadAgentWorkbench\(\{/);
    assert.match(agentWorkbenchStateSource, /reportError\(error\);/);
    assert.match(agentWorkbenchStateSource, /fallbackErrorMessage/);
    assert.match(
      loaderSupportSource,
      /loadAgentWorkbench: \(input\) => args\.agentWorkbenchService\.getAgentWorkbench\(input\)/,
    );
    assert.doesNotMatch(
      detailSource,
      /loadAgentWorkbench: \(input\) => agentWorkbenchService\.getAgentWorkbench\(input\)/,
    );
    assert.doesNotMatch(agentWorkbenchStateSource, /agentWorkbenchService\./);
    assert.doesNotMatch(agentWorkbenchStateSource, /toast\./);
    assert.doesNotMatch(agentWorkbenchStateSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes OpenClaw agent skill mutation orchestration through a shared helper while keeping write authority in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const agentSkillMutationSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.ts',
    );
    const agentSkillExecutorSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailAgentSkillMutationSupport.ts',
    );
    const agentSkillMutationRunner = extractBetween(
      detailSource,
      '  const runAgentSkillMutation = ',
      '  const agentSkillMutationHandlers = ',
    );
    const agentSkillMutationHandlers = extractBetween(
      detailSource,
      '  const agentSkillMutationHandlers = ',
      '  const runAgentMutation = ',
    );

    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.ts'),
    );
    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceDetailAgentSkillMutationSupport.ts'),
    );
    assert.match(servicesIndexSource, /openClawAgentSkillMutationSupport/);
    assert.match(servicesIndexSource, /instanceDetailAgentSkillMutationSupport/);
    assert.match(
      detailSource,
      /const agentSkillMutationExecutors = createInstanceDetailAgentSkillMutationExecutors\(\{\s*agentSkillManagementService,\s*\}\);/,
    );
    assert.match(agentSkillMutationRunner, /createOpenClawAgentSkillMutationRunner\(\{/);
    assert.match(
      agentSkillMutationRunner,
      /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/,
    );
    assert.match(agentSkillMutationRunner, /reportSuccess: toastReporters\.reportSuccess,/);
    assert.match(agentSkillMutationRunner, /reportError: toastReporters\.reportError,/);

    assert.match(detailSource, /buildOpenClawAgentSkillMutationHandlers\(\{/);
    assert.match(agentSkillMutationHandlers, /\.\.\.agentSkillMutationExecutors,/);
    assert.doesNotMatch(
      agentSkillMutationHandlers,
      /executeInstall: \(input\) => agentSkillManagementService\.installSkill\(input\)/,
    );
    assert.doesNotMatch(
      agentSkillMutationHandlers,
      /executeToggle: \(input\) => agentSkillManagementService\.setSkillEnabled\(input\)/,
    );
    assert.doesNotMatch(
      agentSkillMutationHandlers,
      /executeRemove: \(input\) => agentSkillManagementService\.removeSkill\(input\)/,
    );
    assert.match(agentSkillMutationHandlers, /executeMutation: runAgentSkillMutation,/);
    assert.doesNotMatch(agentSkillMutationHandlers, /await loadWorkbench\(/);
    assert.doesNotMatch(detailSource, /const handleInstallAgentSkill = async \(slug: string\) => \{/);
    assert.doesNotMatch(detailSource, /const handleSetAgentSkillEnabled = async \(skillKey: string, enabled: boolean\) => \{/);
    assert.doesNotMatch(detailSource, /const handleRemoveAgentSkill = async \(/);

    assert.doesNotMatch(detailSource, /function addPendingId\(/);
    assert.doesNotMatch(detailSource, /function removePendingId\(/);

    assert.match(
      agentSkillMutationSupportSource,
      /export function buildOpenClawAgentSkillMutationHandlers/,
    );
    assert.match(
      agentSkillMutationSupportSource,
      /export function buildOpenClawAgentSkillInstallMutationRequest/,
    );
    assert.match(
      agentSkillMutationSupportSource,
      /export function buildOpenClawAgentSkillToggleMutationRequest/,
    );
    assert.match(
      agentSkillMutationSupportSource,
      /export function buildOpenClawAgentSkillRemoveMutationRequest/,
    );
    assert.match(
      agentSkillMutationSupportSource,
      /export function createOpenClawAgentSkillMutationRunner/,
    );
    assert.doesNotMatch(agentSkillMutationSupportSource, /agentSkillManagementService\./);
    assert.doesNotMatch(agentSkillMutationSupportSource, /toast\./);
    assert.doesNotMatch(agentSkillMutationSupportSource, /await loadWorkbench\(/);
    assert.match(
      agentSkillExecutorSupportSource,
      /export function createInstanceDetailAgentSkillMutationExecutors/,
    );
    assert.doesNotMatch(agentSkillExecutorSupportSource, /toast\./);
    assert.doesNotMatch(agentSkillExecutorSupportSource, /navigate\(/);
    assert.doesNotMatch(agentSkillExecutorSupportSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes OpenClaw provider dialog launch callbacks through section models while keeping page-owned reset authority',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const providerPresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.ts',
    );
    const sectionModelsSource = read(
      'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
    );
    const llmProviderSectionHelper = extractBetween(
      sectionModelsSource,
      'export function buildLlmProviderSectionProps({',
      'export function buildLlmProviderDialogStateHandlers({',
    );
    const llmProviderDialogStateHelper = extractBetween(
      sectionModelsSource,
      'export function buildLlmProviderDialogStateHandlers({',
      'export function buildLlmProviderDialogProps({',
    );
    const providerDialogStateHandlers = extractBetween(
      detailSource,
      '  const providerDialogStateHandlers = buildLlmProviderDialogStateHandlers({',
      '  const runProviderCatalogMutation = ',
    );
    const llmProviderSectionProps = extractBetween(
      detailSource,
      '  const llmProviderSectionProps = buildLlmProviderSectionProps({',
      '  const llmProviderDialogProps = buildLlmProviderDialogProps({',
    );

    assert.match(detailSource, /buildLlmProviderSectionProps/);
    assert.doesNotMatch(detailSource, /const openCreateProviderDialog = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const openCreateProviderModelDialog = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const openEditProviderModelDialog = \(/);

    assert.match(providerDialogStateHandlers, /setProviderDialogDraft: setProviderDialogDraft/);
    assert.match(
      providerDialogStateHandlers,
      /setProviderModelDialogDraft: setProviderModelDialogDraft/,
    );

    assert.match(llmProviderSectionProps, /setIsProviderDialogOpen,/);
    assert.match(llmProviderSectionProps, /setProviderDialogDraft,/);
    assert.match(llmProviderSectionProps, /setIsProviderModelDialogOpen,/);
    assert.match(llmProviderSectionProps, /setProviderModelDialogDraft,/);
    assert.doesNotMatch(
      llmProviderSectionProps,
      /onOpenCreateProviderDialog:\s*openCreateProviderDialog/,
    );
    assert.doesNotMatch(
      llmProviderSectionProps,
      /onOpenCreateProviderModelDialog:\s*openCreateProviderModelDialog/,
    );
    assert.doesNotMatch(
      llmProviderSectionProps,
      /onOpenEditProviderModelDialog:\s*openEditProviderModelDialog/,
    );

    assert.match(llmProviderSectionHelper, /createOpenClawProviderCreateDialogState/);
    assert.match(llmProviderSectionHelper, /createOpenClawProviderModelCreateDialogState/);
    assert.match(llmProviderSectionHelper, /createOpenClawProviderModelEditDialogState/);
    assert.match(llmProviderDialogStateHelper, /createOpenClawProviderDialogResetDrafts\(\)/);
    assert.match(
      llmProviderDialogStateHelper,
      /setProviderDialogDraft\(providerDialogResetDrafts\.providerDialogDraft\)/,
    );
    assert.match(
      llmProviderDialogStateHelper,
      /setProviderModelDialogDraft\(providerDialogResetDrafts\.providerModelDialogDraft\)/,
    );
    assert.match(llmProviderSectionHelper, /onOpenCreateProviderDialog: \(\) => \{/);
    assert.match(llmProviderSectionHelper, /if \(!canManageOpenClawProviders\) \{/);
    assert.match(llmProviderSectionHelper, /setProviderDialogDraft\(\(\) => dialogState\.draft\)/);
    assert.match(llmProviderSectionHelper, /setIsProviderDialogOpen\(true\)/);
    assert.match(
      llmProviderSectionHelper,
      /setProviderModelDialogDraft\(\(\) => dialogState\.draft\)/,
    );
    assert.match(llmProviderSectionHelper, /setIsProviderModelDialogOpen\(true\)/);
    assert.match(
      llmProviderSectionHelper,
      /createOpenClawProviderModelEditDialogState\(model\)/,
    );
    assert.doesNotMatch(llmProviderSectionHelper, /instanceService\./);
    assert.doesNotMatch(llmProviderSectionHelper, /toast\./);
    assert.doesNotMatch(llmProviderSectionHelper, /loadWorkbench\(/);

    assert.match(servicesIndexSource, /openClawProviderPresentation/);
    assert.match(
      providerPresentationSource,
      /export function createOpenClawProviderCreateDialogState\(/,
    );
    assert.match(
      providerPresentationSource,
      /export function createOpenClawProviderModelCreateDialogState\(/,
    );
    assert.match(
      providerPresentationSource,
      /export function createOpenClawProviderDialogResetDrafts\(/,
    );
    assert.match(
      providerPresentationSource,
      /export function createOpenClawProviderModelEditDialogState\(/,
    );
    assert.doesNotMatch(providerPresentationSource, /setIsProviderDialogOpen/);
    assert.doesNotMatch(providerPresentationSource, /toast\./);
    assert.doesNotMatch(providerPresentationSource, /instanceService\./);
  },
);

runTest(
  'sdkwork-claw-instances routes instance lifecycle action orchestration through a shared helper while keeping write authority in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const lifecycleSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceLifecycleActionSupport.ts',
    );
    const lifecycleMutationExecutorSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailLifecycleMutationSupport.ts',
    );
    const deleteSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailDeleteSupport.ts',
    );
    const lifecycleRunner = extractBetween(
      detailSource,
      '  const runLifecycleAction = ',
      '  const lifecycleActionHandlers = buildInstanceLifecycleActionHandlers({',
    );
    const lifecycleHandlers = extractBetween(
      detailSource,
      '  const lifecycleActionHandlers = buildInstanceLifecycleActionHandlers({',
      '  const consoleHandlers = buildInstanceConsoleHandlers({',
    );
    const consoleHandlers = extractBetween(
      detailSource,
      '  const consoleHandlers = buildInstanceConsoleHandlers({',
      '  const deleteHandlerBindings = createInstanceDetailDeleteHandlerBindings({',
    );
    const deleteHandlerBindings = extractBetween(
      detailSource,
      '  const deleteHandlerBindings = createInstanceDetailDeleteHandlerBindings({',
      '  const deleteHandler = buildInstanceDeleteHandler({',
    );
    const deleteHandlers = extractBetween(
      detailSource,
      '  const deleteHandler = buildInstanceDeleteHandler({',
      '  const runConfigChannelMutation = createOpenClawConfigChannelMutationRunner({',
    );

    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceLifecycleActionSupport.ts'),
    );
    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceDetailLifecycleMutationSupport.ts'),
    );
    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/instanceDetailDeleteSupport.ts'),
    );
    assert.match(servicesIndexSource, /instanceLifecycleActionSupport/);
    assert.match(servicesIndexSource, /instanceDetailLifecycleMutationSupport/);
    assert.match(servicesIndexSource, /instanceDetailDeleteSupport/);
    assert.match(
      detailSource,
      /const baseRunLifecycleAction = createInstanceLifecycleActionRunner\(\{[\s\S]*reloadWorkbench: workbenchReloadHandlers\.reloadWorkbenchImmediately,[\s\S]*reportSuccess: toastReporters\.reportSuccess,[\s\S]*reportError: toastReporters\.reportError,[\s\S]*\}\);/s,
    );
    assert.match(lifecycleRunner, /const didSucceed = await baseRunLifecycleAction\(request\);/);

    assert.match(lifecycleHandlers, /runLifecycleAction,/);
    assert.match(
      detailSource,
      /const lifecycleMutationExecutors = createInstanceDetailLifecycleMutationExecutors\(\{\s*instanceService,\s*\}\);/,
    );
    assert.match(lifecycleHandlers, /\.\.\.lifecycleMutationExecutors,/);
    assert.doesNotMatch(
      lifecycleHandlers,
      /executeRestart: \(instanceId\) => instanceService\.restartInstance\(instanceId\)/,
    );
    assert.doesNotMatch(
      lifecycleHandlers,
      /executeStop: \(instanceId\) => instanceService\.stopInstance\(instanceId\)/,
    );
    assert.doesNotMatch(
      lifecycleHandlers,
      /executeStart: \(instanceId\) => instanceService\.startInstance\(instanceId\)/,
    );
    assert.doesNotMatch(lifecycleHandlers, /toast\.success/);
    assert.doesNotMatch(lifecycleHandlers, /await loadWorkbench\(/);

    assert.match(consoleHandlers, /consoleTarget:/);
    assert.match(consoleHandlers, /openExternalLink: openExternalUrl,/);
    assert.match(consoleHandlers, /reportInfo: toastReporters\.reportInfo,/);
    assert.match(consoleHandlers, /reportError: toastReporters\.reportError,/);
    assert.doesNotMatch(consoleHandlers, /openExternalLink: \(href\) => openExternalUrl\(href\)/);
    assert.doesNotMatch(consoleHandlers, /consoleTarget\?\.autoLoginUrl \|\| consoleTarget\?\.url/);
    assert.doesNotMatch(consoleHandlers, /toast\.info\(consoleTarget\.reason\)/);
    assert.match(
      detailSource,
      /const deleteHandlerBindings = createInstanceDetailDeleteHandlerBindings\(\{\s*confirmDelete: window\.confirm,\s*navigate,\s*instanceService,\s*\}\);/,
    );
    assert.match(deleteHandlerBindings, /confirmDelete: window\.confirm,/);
    assert.match(deleteHandlerBindings, /navigate,/);
    assert.match(deleteHandlerBindings, /instanceService,/);
    assert.match(deleteHandlers, /instanceId: id,/);
    assert.match(deleteHandlers, /canDelete,/);
    assert.match(deleteHandlers, /activeInstanceId,/);
    assert.match(deleteHandlers, /\.\.\.deleteHandlerBindings,/);
    assert.match(deleteHandlers, /setActiveInstanceId,/);
    assert.match(deleteHandlers, /reportSuccess: toastReporters\.reportSuccess,/);
    assert.match(deleteHandlers, /reportError: toastReporters\.reportError,/);
    assert.doesNotMatch(deleteHandlers, /confirmDelete: \(message\) => window\.confirm\(message\)/);
    assert.doesNotMatch(
      deleteHandlers,
      /executeDelete: \(instanceId\) => instanceService\.deleteInstance\(instanceId\)/,
    );
    assert.doesNotMatch(deleteHandlers, /navigateToInstances: \(\) => navigate\('\/instances'\)/);

    assert.doesNotMatch(detailSource, /const handleRestart = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const handleStop = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const handleStart = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const handleOpenControlPage = async \(\) => \{/);
    assert.doesNotMatch(detailSource, /const openOfficialLink = async \(href: string\) => \{/);
    assert.doesNotMatch(detailSource, /const openTaskWorkspace = \(/);
    assert.doesNotMatch(detailSource, /const handleDelete = async \(\) => \{/);
    assert.match(detailSource, /onOpenControlPage=\{consoleHandlers\.onOpenControlPage\}/);
    assert.match(detailSource, /onRestart=\{lifecycleActionHandlers\.onRestart\}/);
    assert.match(detailSource, /onStop=\{lifecycleActionHandlers\.onStop\}/);
    assert.match(detailSource, /onStart=\{lifecycleActionHandlers\.onStart\}/);
    assert.match(detailSource, /onOpenOfficialLink=\{consoleHandlers\.onOpenOfficialLink\}/);
    assert.match(detailSource, /onDelete=\{deleteHandler\}/);

    assert.match(
      lifecycleSupportSource,
      /export function createInstanceLifecycleActionRunner/,
    );
    assert.match(
      lifecycleSupportSource,
      /export function buildInstanceLifecycleActionHandlers/,
    );
    assert.match(
      lifecycleSupportSource,
      /export function buildInstanceConsoleHandlers/,
    );
    assert.match(
      lifecycleSupportSource,
      /export function buildInstanceDeleteHandler/,
    );
    assert.doesNotMatch(lifecycleSupportSource, /instanceService\./);
    assert.doesNotMatch(lifecycleSupportSource, /toast\./);
    assert.doesNotMatch(lifecycleSupportSource, /await loadWorkbench\(/);
    assert.doesNotMatch(lifecycleSupportSource, /openExternalUrl\(/);
    assert.doesNotMatch(lifecycleSupportSource, /navigate\('/);
    assert.doesNotMatch(lifecycleSupportSource, /window\.confirm\(/);
    assert.match(
      deleteSupportSource,
      /export function createInstanceDetailDeleteHandlerBindings/,
    );
    assert.match(
      deleteSupportSource,
      /deleteInstance: DeleteHandlerBindings\['executeDelete'\]/,
    );
    assert.match(
      deleteSupportSource,
      /confirmDelete: DeleteHandlerBindings\['confirmDelete'\]/,
    );
    assert.match(
      deleteSupportSource,
      /executeDelete: \(instanceId\) => args\.instanceService\.deleteInstance\(instanceId\)/,
    );
    assert.match(
      deleteSupportSource,
      /navigateToInstances: \(\) => args\.navigate\('\/instances'\)/,
    );
    assert.doesNotMatch(deleteSupportSource, /setActiveInstanceId/);
    assert.doesNotMatch(deleteSupportSource, /reportSuccess/);
    assert.doesNotMatch(deleteSupportSource, /reportError/);
    assert.doesNotMatch(deleteSupportSource, /window\.confirm\(/);
    assert.match(
      lifecycleMutationExecutorSupportSource,
      /export function createInstanceDetailLifecycleMutationExecutors/,
    );
    assert.match(
      lifecycleMutationExecutorSupportSource,
      /restartInstance: LifecycleMutationExecutors\['executeRestart'\]/,
    );
    assert.match(
      lifecycleMutationExecutorSupportSource,
      /stopInstance: LifecycleMutationExecutors\['executeStop'\]/,
    );
    assert.match(
      lifecycleMutationExecutorSupportSource,
      /startInstance: LifecycleMutationExecutors\['executeStart'\]/,
    );
    assert.doesNotMatch(lifecycleMutationExecutorSupportSource, /toast\./);
    assert.doesNotMatch(lifecycleMutationExecutorSupportSource, /navigate\(/);
    assert.doesNotMatch(lifecycleMutationExecutorSupportSource, /loadWorkbench\(/);
  },
);

runTest('sdkwork-claw-instances upgrades the detail page into a sidebar workbench for OpenClaw runtime capabilities', () => {
  const detailSource = readSources([
    'packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx',
    'packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.ts',
  ]);

  assert.match(detailSource, /instanceWorkbench\.sidebar\.overview/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.channels/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.cronTasks/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.llmProviders/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.agents/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.skills/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.files/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.memory/);
  assert.match(detailSource, /instanceWorkbench\.sidebar\.tools/);
  assert.match(detailSource, /instanceWorkbench\.sections\.overview/);
  assert.match(detailSource, /instanceWorkbench\.sections\.channels/);
  assert.match(detailSource, /instanceWorkbench\.sections\.cronTasks/);
  assert.match(detailSource, /instanceWorkbench\.sections\.llmProviders/);
  assert.match(detailSource, /instanceWorkbench\.sections\.agents/);
  assert.match(detailSource, /instanceWorkbench\.sections\.skills/);
  assert.match(detailSource, /instanceWorkbench\.sections\.files/);
  assert.match(detailSource, /instanceWorkbench\.sections\.memory/);
  assert.match(detailSource, /instanceWorkbench\.sections\.tools/);
});

runTest('sdkwork-claw-instances uses a wider detail canvas and row-based operational list shells', () => {
  const detailSource = readInstanceDetailPageSources();
  const primitivesSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceWorkbenchPrimitives.tsx',
  );
  const toolsSource = read('packages/sdkwork-claw-instances/src/components/InstanceDetailToolsSection.tsx');

  assert.doesNotMatch(detailSource, /max-w-\[96rem\]/);
  assert.match(primitivesSource, /data-slot="instance-workbench-row-list"/);
  assert.match(toolsSource, /RowMetric/);
});

runTest('sdkwork-claw-instances routes shared cron task manager embedding through section models for task operations', () => {
  const detailSource = readInstanceDetailPageSources();
  const sectionModelsSource = read(
    'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
  );

  assert.match(detailSource, /buildTasksSectionContent/);
  assert.doesNotMatch(detailSource, /instanceId=\{id\} embedded/);
  assert.match(sectionModelsSource, /CronTasksManager/);
  assert.match(sectionModelsSource, /instanceId,/);
  assert.match(sectionModelsSource, /embedded: true/);
  assert.doesNotMatch(detailSource, /TaskCatalog/);
  assert.doesNotMatch(detailSource, /TaskExecutionHistoryDrawer/);
  assert.doesNotMatch(detailSource, /<TaskRow/);
});

runTest('sdkwork-claw-instances opens channel official setup links through the host external browser bridge', () => {
  const detailSource = readInstanceDetailPageSources();
  const channelsSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailChannelsSection.tsx',
  );
  const lifecycleSupportSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceLifecycleActionSupport.ts',
  );

  assert.match(channelsSource, /ChannelWorkspace/);
  assert.match(detailSource, /openExternalUrl/);
  assert.match(detailSource, /buildInstanceConsoleHandlers/);
  assert.match(detailSource, /onOpenOfficialLink=\{consoleHandlers\.onOpenOfficialLink\}/);
  assert.match(lifecycleSupportSource, /onOpenOfficialLink: async \(href: string\) => \{/);
  assert.match(lifecycleSupportSource, /await args\.openExternalLink\(href\);/);
  assert.match(channelsSource, /onOpenOfficialLink=\{\(_channel, link\) => void onOpenOfficialLink\(link\.href\)\}/);
});

runTest(
  'sdkwork-claw-instances routes config-channel page handlers through shared helpers while keeping write authority in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const configChannelPresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawConfigChannelPresentation.ts',
    );
    const configChannelMutationSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawConfigChannelMutationSupport.ts',
    );
    const configChannelMutationExecutorSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailConfigChannelMutationSupport.ts',
    );

    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/openClawConfigChannelPresentation.ts'),
    );
    assert.ok(
      exists('packages/sdkwork-claw-instances/src/services/openClawConfigChannelMutationSupport.ts'),
    );
    assert.ok(
      exists(
        'packages/sdkwork-claw-instances/src/services/instanceDetailConfigChannelMutationSupport.ts',
      ),
    );
    assert.match(servicesIndexSource, /openClawConfigChannelPresentation/);
    assert.match(servicesIndexSource, /openClawConfigChannelMutationSupport/);
    assert.match(servicesIndexSource, /instanceDetailConfigChannelMutationSupport/);
    assert.doesNotMatch(detailSource, /const runConfigChannelMutation = async/);
    assert.match(
      detailSource,
      /const configChannelMutationExecutors = createInstanceDetailConfigChannelMutationExecutors\(\{\s*instanceService,\s*\}\);/,
    );
    assert.match(
      detailSource,
      /const runConfigChannelMutation = createOpenClawConfigChannelMutationRunner\(\{/,
    );
    assert.match(detailSource, /\.\.\.configChannelMutationExecutors,/);
    assert.match(
      detailSource,
      /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/,
    );
    assert.match(detailSource, /reportSuccess: toastReporters\.reportSuccess,/);
    assert.match(detailSource, /reportError: toastReporters\.reportError,/);
    assert.doesNotMatch(
      detailSource,
      /executeSaveConfig: \(instanceId, channelId, values\) =>\s+instanceService\.saveOpenClawChannelConfig\(instanceId, channelId, values\)/,
    );
    assert.doesNotMatch(
      detailSource,
      /executeToggleEnabled: \(instanceId, channelId, enabled\) =>\s+instanceService\.setOpenClawChannelEnabled\(instanceId, channelId, enabled\)/,
    );
    assert.doesNotMatch(detailSource, /runOpenClawConfigChannelMutation\(\{/);
    assert.match(detailSource, /buildOpenClawConfigChannelStateHandlers/);
    assert.match(detailSource, /buildOpenClawConfigChannelMutationHandlers/);
    assert.match(
      detailSource,
      /const configChannelStateHandlers = buildOpenClawConfigChannelStateHandlers\(\{/,
    );
    assert.match(
      detailSource,
      /const configChannelMutationHandlers = buildOpenClawConfigChannelMutationHandlers\(\{/,
    );
    assert.match(detailSource, /selectedConfigChannel,/);
    assert.match(detailSource, /selectedConfigChannelDraft,/);
    assert.match(detailSource, /configChannels,/);
    assert.match(detailSource, /setConfigChannelError,/);
    assert.match(detailSource, /setSelectedConfigChannelId,/);
    assert.match(detailSource, /setConfigChannelDrafts,/);
    assert.match(detailSource, /setSavingConfigChannel: setIsSavingConfigChannel,/);
    assert.match(detailSource, /executeMutation: runConfigChannelMutation,/);
    assert.doesNotMatch(detailSource, /const handleConfigChannelSelectionChange = /);
    assert.doesNotMatch(detailSource, /const handleConfigChannelDraftChange = /);
    assert.doesNotMatch(detailSource, /const handleToggleConfigChannel = async /);
    assert.doesNotMatch(detailSource, /const handleSaveConfigChannel = async /);
    assert.doesNotMatch(detailSource, /const handleDeleteConfigChannelConfiguration = async /);
    assert.match(
      detailSource,
      /onSelectedConfigChannelIdChange=\{configChannelStateHandlers\.onSelectedConfigChannelIdChange\}/,
    );
    assert.match(
      detailSource,
      /onConfigChannelFieldChange=\{configChannelStateHandlers\.onConfigChannelFieldChange\}/,
    );
    assert.match(
      detailSource,
      /onSaveConfigChannel=\{configChannelMutationHandlers\.onSaveConfigChannel\}/,
    );
    assert.match(
      detailSource,
      /onDeleteConfigChannelConfiguration=\{\s*configChannelMutationHandlers\.onDeleteConfigChannelConfiguration\s*\}/,
    );
    assert.match(
      detailSource,
      /onToggleConfigChannel=\{configChannelMutationHandlers\.onToggleConfigChannel\}/,
    );
    assert.match(
      configChannelPresentationSource,
      /export function buildOpenClawConfigChannelStateHandlers\(/,
    );
    assert.match(configChannelPresentationSource, /applyOpenClawConfigChannelDraftChange/);
    assert.doesNotMatch(configChannelPresentationSource, /toast\./);
    assert.doesNotMatch(configChannelPresentationSource, /instanceService\./);
    assert.doesNotMatch(configChannelPresentationSource, /loadWorkbench\(/);
    assert.match(
      configChannelMutationSupportSource,
      /export function applyOpenClawConfigChannelDraftChange/,
    );
    assert.match(
      configChannelMutationSupportSource,
      /export function buildOpenClawConfigChannelToggleMutationRequest/,
    );
    assert.match(
      configChannelMutationSupportSource,
      /export function buildOpenClawConfigChannelSaveMutationRequest/,
    );
    assert.match(
      configChannelMutationSupportSource,
      /export function buildOpenClawConfigChannelDeleteMutationRequest/,
    );
    assert.match(
      configChannelMutationSupportSource,
      /export function buildOpenClawConfigChannelMutationHandlers\(/,
    );
    assert.match(
      configChannelMutationSupportSource,
      /export function createOpenClawConfigChannelMutationRunner/,
    );
    assert.match(
      configChannelMutationSupportSource,
      /export async function runOpenClawConfigChannelMutation/,
    );
    assert.match(
      configChannelMutationSupportSource,
      /args\.setConfigChannelDrafts\(\(current\) => \(\{/,
    );
    assert.doesNotMatch(configChannelMutationSupportSource, /instanceService\./);
    assert.doesNotMatch(configChannelMutationSupportSource, /toast\./);
    assert.doesNotMatch(configChannelMutationSupportSource, /await loadWorkbench\(/);
    assert.match(
      configChannelMutationExecutorSupportSource,
      /export function createInstanceDetailConfigChannelMutationExecutors/,
    );
    assert.match(
      configChannelMutationExecutorSupportSource,
      /saveOpenClawChannelConfig: ConfigChannelMutationExecutors\['executeSaveConfig'\]/,
    );
    assert.match(
      configChannelMutationExecutorSupportSource,
      /setOpenClawChannelEnabled: ConfigChannelMutationExecutors\['executeToggleEnabled'\]/,
    );
    assert.doesNotMatch(configChannelMutationExecutorSupportSource, /toast\./);
    assert.doesNotMatch(configChannelMutationExecutorSupportSource, /navigate\(/);
    assert.doesNotMatch(configChannelMutationExecutorSupportSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes config-channel selection and draft derivation through a shared presentation helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const derivedStateSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
    );
    const configChannelPresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawConfigChannelPresentation.ts',
    );
    const configChannelSelectionStateBuilder = extractBetween(
      configChannelPresentationSource,
      'export function buildOpenClawConfigChannelSelectionState(',
      'export function buildOpenClawConfigChannelWorkspaceItems(',
    );

    assert.match(detailSource, /buildInstanceDetailDerivedState/);
    assert.match(detailSource, /configChannelSelectionState,/);
    assert.match(derivedStateSource, /buildOpenClawConfigChannelSelectionState/);
    assert.match(detailSource, /const \{ selectedConfigChannel, selectedConfigChannelDraft \} = configChannelSelectionState;/);
    assert.doesNotMatch(detailSource, /const selectedConfigChannel = useMemo\(/);
    assert.doesNotMatch(
      detailSource,
      /configChannels\.find\(\(channel\) => channel\.id === selectedConfigChannelId\) \|\| null/,
    );
    assert.doesNotMatch(
      detailSource,
      /const selectedConfigChannelDraft = selectedConfigChannel[\s\S]*configChannelDrafts\[selectedConfigChannel\.id\] \|\| selectedConfigChannel\.values/,
    );

    assert.match(
      configChannelPresentationSource,
      /export function buildOpenClawConfigChannelSelectionState\(/,
    );
    assert.doesNotMatch(configChannelSelectionStateBuilder, /setSelectedConfigChannelId/);
    assert.doesNotMatch(configChannelSelectionStateBuilder, /toast\./);
    assert.doesNotMatch(configChannelSelectionStateBuilder, /instanceService\./);
    assert.doesNotMatch(configChannelSelectionStateBuilder, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes config-channel workspace projection through a shared presentation helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const derivedStateSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
    );
    const configChannelPresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawConfigChannelPresentation.ts',
    );
    const configChannelWorkspaceItemsBuilder = extractBetween(
      configChannelPresentationSource,
      'export function buildOpenClawConfigChannelWorkspaceItems(',
      'export function buildOpenClawConfigChannelStateHandlers(',
    );

    assert.match(detailSource, /buildInstanceDetailDerivedState/);
    assert.match(detailSource, /configChannelWorkspaceItems,/);
    assert.match(derivedStateSource, /buildOpenClawConfigChannelWorkspaceItems/);
    assert.doesNotMatch(
      detailSource,
      /const configChannelWorkspaceItems = useMemo<ChannelWorkspaceItem\[]>\(\s*\(\) =>\s*configChannels\.map\(\(channel\) => \{/,
    );
    assert.doesNotMatch(detailSource, /const configuredFieldCount = channel\.fields\.filter/);
    assert.doesNotMatch(detailSource, /const derivedStatus =/);

    assert.match(
      configChannelPresentationSource,
      /export function buildOpenClawConfigChannelWorkspaceItems\(/,
    );
    assert.doesNotMatch(configChannelWorkspaceItemsBuilder, /setSelectedConfigChannelId/);
    assert.doesNotMatch(configChannelWorkspaceItemsBuilder, /toast\./);
    assert.doesNotMatch(configChannelWorkspaceItemsBuilder, /instanceService\./);
    assert.doesNotMatch(configChannelWorkspaceItemsBuilder, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes config-channel toggle target lookup through the shared mutation helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const configChannelMutationSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawConfigChannelMutationSupport.ts',
    );

    assert.match(detailSource, /onToggleConfigChannel=\{configChannelMutationHandlers\.onToggleConfigChannel\}/);
    assert.doesNotMatch(detailSource, /onToggleConfigChannel=\{\(channelId, nextEnabled\) => \{/);

    assert.match(
      configChannelMutationSupportSource,
      /const configChannel = findConfigChannelById\(args\.configChannels, channelId\);/,
    );
    assert.match(
      configChannelMutationSupportSource,
      /buildOpenClawConfigChannelToggleMutationRequest/,
    );
    assert.doesNotMatch(configChannelMutationSupportSource, /toast\./);
    assert.doesNotMatch(configChannelMutationSupportSource, /instanceService\./);
    assert.doesNotMatch(configChannelMutationSupportSource, /await loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes readonly channel workspace projection through a shared presentation helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const derivedStateSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
    );
    const channelPresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawChannelPresentation.ts',
    );
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

    assert.match(detailSource, /buildInstanceDetailDerivedState/);
    assert.match(detailSource, /readonlyChannelWorkspaceItems,/);
    assert.match(derivedStateSource, /buildReadonlyChannelWorkspaceItems/);
    assert.doesNotMatch(detailSource, /const readonlyChannelCatalogItems = useMemo<ChannelCatalogItem\[]>\(/);
    assert.doesNotMatch(detailSource, /readonlyChannelCatalogItems\.map\(\(channel\) => \(\{/);

    assert.match(channelPresentationSource, /export function buildReadonlyChannelWorkspaceItems\(/);
    assert.match(servicesIndexSource, /openClawChannelPresentation/);
    assert.doesNotMatch(channelPresentationSource, /toast\./);
    assert.doesNotMatch(channelPresentationSource, /instanceService\./);
    assert.doesNotMatch(channelPresentationSource, /loadWorkbench\(/);
  },
);

runTest('sdkwork-claw-instances keeps agents and skills visible in the top summary card deck', () => {
  const detailSource = readInstanceDetailPageSources();
  const presentationSource = read(
    'packages/sdkwork-claw-instances/src/components/instanceDetailWorkbenchPresentation.ts',
  );

  assert.match(detailSource, /InstanceDetailWorkbenchChrome/);
  assert.match(presentationSource, /instanceWorkbench\.summary\.agents/);
  assert.match(presentationSource, /instanceWorkbench\.summary\.skills/);
});

runTest('sdkwork-claw-instances turns files into an IDE-style explorer and editor workspace', () => {
  const sectionContentSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx',
  );
  const filesSectionSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailFilesSection.tsx',
  );
  const explorerSource = read('packages/sdkwork-claw-instances/src/components/InstanceFileExplorer.tsx');
  const workspaceSource = read('packages/sdkwork-claw-instances/src/components/InstanceFilesWorkspace.tsx');
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-instances/package.json',
  );

  assert.ok(pkg.dependencies?.['@monaco-editor/react']);
  assert.match(sectionContentSource, /InstanceDetailFilesSection/);
  assert.match(filesSectionSource, /InstanceFilesWorkspace/);
  assert.match(filesSectionSource, /mode="instance"/);
  assert.match(workspaceSource, /data-slot="instance-files-explorer"/);
  assert.match(workspaceSource, /data-slot="instance-files-editor"/);
  assert.match(workspaceSource, /InstanceFilesTabsBar/);
  assert.match(workspaceSource, /@monaco-editor\/react/);
  assert.match(explorerSource, /data-slot="instance-files-tree"/);
  assert.match(explorerSource, /directory/i);
  assert.doesNotMatch(sectionContentSource, /instanceWorkbench\.sidebar\.title/);
  assert.doesNotMatch(sectionContentSource, /instanceWorkbench\.sidebar\.description/);
});

runTest('sdkwork-claw-instances keeps instance-level destructive actions in the header and out of files/tools sections', () => {
  const detailSource = readInstanceDetailPageSources();
  const headerSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailHeader.tsx',
  );
  const filesSectionSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailFilesSection.tsx',
  );
  const toolsSectionSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailConfigToolsSection.tsx',
  );

  assert.match(detailSource, /InstanceDetailHeader/);
  assert.match(headerSource, /instances\.detail\.actions\.uninstallInstance/);
  assert.doesNotMatch(filesSectionSource, /instances\.detail\.fields\.apiToken/);
  assert.doesNotMatch(filesSectionSource, /instances\.detail\.actions\.saveConfiguration/);
  assert.doesNotMatch(toolsSectionSource, /instances\.detail\.dangerZone/);
  assert.doesNotMatch(toolsSectionSource, /instances\.detail\.dangerDescription/);
  assert.doesNotMatch(toolsSectionSource, /instances\.detail\.actions\.uninstallInstance/);
});

runTest(
  'sdkwork-claw-instances routes agent and llm provider section models through a dedicated helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const helperSource = read(
      'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
    );

    assert.match(detailSource, /buildAgentSectionProps/);
    assert.match(detailSource, /buildLlmProviderSectionProps/);
    assert.match(detailSource, /buildLlmProviderDialogProps/);
    assert.doesNotMatch(detailSource, /const agentSectionProps = workbench \?/);
    assert.doesNotMatch(detailSource, /const llmProviderSectionProps = workbench \?/);
    assert.doesNotMatch(detailSource, /const llmProviderDialogProps = \{/);
    assert.doesNotMatch(detailSource, /onAgentDialogOpenChange:\s*setIsAgentDialogOpen/);
    assert.match(detailSource, /setIsAgentDialogOpen,/);
    assert.match(detailSource, /setEditingAgentId,/);

    assert.match(helperSource, /export function buildAgentSectionProps/);
    assert.match(helperSource, /export function buildLlmProviderSectionProps/);
    assert.match(helperSource, /export function buildLlmProviderDialogProps/);
    assert.match(helperSource, /createOpenClawAgentCreateDialogState/);
    assert.match(helperSource, /onAgentDialogOpenChange: \(open\) =>/);
    assert.match(helperSource, /setIsAgentDialogOpen\(open\)/);
    assert.match(helperSource, /setEditingAgentId\(dialogState\.editingAgentId\)/);
  },
);

runTest(
  'sdkwork-claw-instances routes memory and config tools section composition through the dedicated section components',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const sectionModelsSource = read(
      'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
    );
    const memorySectionSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailMemoryWorkbenchSection.tsx',
    );
    const configToolsSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailConfigToolsSection.tsx',
    );
    const managedWebSearchPanelSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailConfigWebSearchPanel.tsx',
    );
    const managedWebFetchPanelSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailConfigWebFetchPanel.tsx',
    );
    const managedWebSearchNativeCodexPanelSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailConfigWebSearchNativeCodexPanel.tsx',
    );
    const managedXSearchPanelSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailConfigXSearchPanel.tsx',
    );
    const managedAuthCooldownsPanelSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailConfigAuthCooldownsPanel.tsx',
    );
    const toolsSectionSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailToolsSection.tsx',
    );

    assert.match(detailSource, /buildMemoryWorkbenchSectionContent/);
    assert.match(detailSource, /buildConfigToolsSectionContent/);
    assert.doesNotMatch(detailSource, /buildManagedToolsSectionContent/);
    assert.doesNotMatch(
      detailSource,
      /const memorySectionContent = <InstanceDetailMemoryWorkbenchSection \{\.\.\.memorySectionProps\} \/>;/,
    );
    assert.doesNotMatch(
      detailSource,
      /const toolsSectionContent = <InstanceDetailConfigToolsSection \{\.\.\.toolsSectionProps\} \/>;/,
    );
    assert.doesNotMatch(detailSource, /const memorySectionProps = workbench \?/);
    assert.doesNotMatch(detailSource, /const managedWebSearchPanel =/);
    assert.doesNotMatch(detailSource, /const managedWebFetchPanel =/);
    assert.doesNotMatch(detailSource, /const managedWebSearchNativeCodexPanel =/);
    assert.doesNotMatch(detailSource, /const managedXSearchPanel =/);
    assert.doesNotMatch(detailSource, /const managedAuthCooldownsPanel =/);
    assert.doesNotMatch(detailSource, /const toolsSectionProps = \{/);

    assert.match(sectionModelsSource, /export function buildMemoryWorkbenchSectionContent/);
    assert.match(sectionModelsSource, /export function buildConfigToolsSectionContent/);
    assert.doesNotMatch(sectionModelsSource, /export function buildManagedToolsSectionContent/);
    assert.match(sectionModelsSource, /InstanceDetailMemoryWorkbenchSection/);
    assert.match(sectionModelsSource, /InstanceDetailConfigToolsSection/);
    assert.match(sectionModelsSource, /createElement\(InstanceDetailConfigToolsSection, sectionProps\)/);
    assert.doesNotMatch(
      sectionModelsSource,
      /createElement\(InstanceDetailManagedToolsSection, sectionProps\)/,
    );
    assert.match(memorySectionSource, /InstanceDetailMemorySection/);
    assert.match(memorySectionSource, /latestDreamDiaryUpdatedAt/);
    assert.match(configToolsSource, /InstanceDetailConfigWebSearchPanel/);
    assert.match(configToolsSource, /InstanceDetailConfigWebFetchPanel/);
    assert.match(configToolsSource, /InstanceDetailConfigWebSearchNativeCodexPanel/);
    assert.match(configToolsSource, /InstanceDetailConfigXSearchPanel/);
    assert.match(configToolsSource, /InstanceDetailConfigAuthCooldownsPanel/);
    assert.match(configToolsSource, /InstanceDetailToolsSection/);
    assert.match(configToolsSource, /const configWebSearchPanel =/);
    assert.match(configToolsSource, /const configWebFetchPanel =/);
    assert.match(configToolsSource, /const configWebSearchNativeCodexPanel =/);
    assert.match(configToolsSource, /const configXSearchPanel =/);
    assert.match(configToolsSource, /const configAuthCooldownsPanel =/);
    assert.doesNotMatch(configToolsSource, /const managedWebSearchPanel =/);
    assert.doesNotMatch(configToolsSource, /const managedWebFetchPanel =/);
    assert.doesNotMatch(configToolsSource, /const managedWebSearchNativeCodexPanel =/);
    assert.doesNotMatch(configToolsSource, /const managedXSearchPanel =/);
    assert.doesNotMatch(configToolsSource, /const managedAuthCooldownsPanel =/);
    assert.match(managedWebSearchPanelSource, /data-slot="instance-detail-config-web-search"/);
    assert.match(managedWebFetchPanelSource, /data-slot="instance-detail-config-web-fetch"/);
    assert.match(
      managedWebSearchNativeCodexPanelSource,
      /data-slot="instance-detail-config-web-search-native-codex"/,
    );
    assert.match(managedXSearchPanelSource, /data-slot="instance-detail-config-x-search"/);
    assert.match(
      managedAuthCooldownsPanelSource,
      /data-slot="instance-detail-config-auth-cooldowns"/,
    );
    assert.doesNotMatch(managedWebSearchPanelSource, /data-slot="instance-detail-managed-web-search"/);
    assert.doesNotMatch(managedWebFetchPanelSource, /data-slot="instance-detail-managed-web-fetch"/);
    assert.doesNotMatch(
      managedWebSearchNativeCodexPanelSource,
      /data-slot="instance-detail-managed-web-search-native-codex"/,
    );
    assert.doesNotMatch(managedXSearchPanelSource, /data-slot="instance-detail-managed-x-search"/);
    assert.doesNotMatch(
      managedAuthCooldownsPanelSource,
      /data-slot="instance-detail-managed-auth-cooldowns"/,
    );
    assert.match(toolsSectionSource, /configAuthCooldownsPanel: React\.ReactNode;/);
    assert.match(toolsSectionSource, /configWebSearchPanel: React\.ReactNode;/);
    assert.match(toolsSectionSource, /configWebSearchNativeCodexPanel: React\.ReactNode;/);
    assert.match(toolsSectionSource, /configXSearchPanel: React\.ReactNode;/);
    assert.match(toolsSectionSource, /configWebFetchPanel: React\.ReactNode;/);
    assert.doesNotMatch(toolsSectionSource, /managedAuthCooldownsPanel: React\.ReactNode;/);
    assert.doesNotMatch(toolsSectionSource, /managedWebSearchPanel: React\.ReactNode;/);
    assert.doesNotMatch(toolsSectionSource, /managedWebSearchNativeCodexPanel: React\.ReactNode;/);
    assert.doesNotMatch(toolsSectionSource, /managedXSearchPanel: React\.ReactNode;/);
    assert.doesNotMatch(toolsSectionSource, /managedWebFetchPanel: React\.ReactNode;/);
  },
);

runTest(
  'sdkwork-claw-instances routes memory and tools section prop composition through section models',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const sectionModelsSource = read(
      'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
    );

    assert.match(detailSource, /buildMemoryWorkbenchSectionProps/);
    assert.match(detailSource, /buildConfigToolsSectionProps/);
    assert.doesNotMatch(detailSource, /buildManagedToolsSectionProps/);
    assert.doesNotMatch(detailSource, /instances\.detail\.instanceWorkbench\.empty\.memory/);
    assert.doesNotMatch(detailSource, /instances\.detail\.instanceWorkbench\.empty\.tools/);

    assert.match(sectionModelsSource, /export function buildMemoryWorkbenchSectionProps/);
    assert.match(sectionModelsSource, /export function buildConfigToolsSectionProps/);
    assert.doesNotMatch(sectionModelsSource, /export function buildManagedToolsSectionProps/);
    assert.match(
      sectionModelsSource,
      /instances\.detail\.instanceWorkbench\.empty\.memory/,
    );
    assert.match(
      sectionModelsSource,
      /instances\.detail\.instanceWorkbench\.empty\.tools/,
    );
  },
);

runTest(
  'sdkwork-claw-instances routes agent, llm provider, and task section content composition through section models',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const sectionModelsSource = read(
      'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
    );

    assert.match(detailSource, /buildAgentSectionContent/);
    assert.match(detailSource, /buildLlmProvidersSectionContent/);
    assert.match(detailSource, /buildTasksSectionContent/);
    assert.doesNotMatch(detailSource, /const agentSectionContent = agentSectionProps \?/);
    assert.doesNotMatch(detailSource, /const llmProvidersSectionContent = llmProviderSectionProps \?/);
    assert.doesNotMatch(
      detailSource,
      /const tasksSectionContent = workbench \? <CronTasksManager instanceId=\{id\} embedded \/> : null;/,
    );

    assert.match(sectionModelsSource, /export function buildAgentSectionContent/);
    assert.match(sectionModelsSource, /export function buildLlmProvidersSectionContent/);
    assert.match(sectionModelsSource, /export function buildTasksSectionContent/);
    assert.match(sectionModelsSource, /InstanceDetailAgentsSection/);
    assert.match(sectionModelsSource, /InstanceDetailLlmProvidersWorkbenchSection/);
    assert.match(sectionModelsSource, /CronTasksManager/);
  },
);

runTest(
  'sdkwork-claw-instances routes instance detail section switching through a dedicated section-content component',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const sectionContentSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx',
    );

    assert.match(detailSource, /InstanceDetailSectionContent/);
    assert.doesNotMatch(detailSource, /const renderSectionAvailability = \(/);
    assert.doesNotMatch(detailSource, /const renderOverviewSection = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const renderChannelsSection = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const renderTasksSection = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const renderAgentsSection = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const renderSkillsSection = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const renderLlmProvidersSection = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const renderFilesSection = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const renderConfigSection = \(\) => \{/);
    assert.doesNotMatch(detailSource, /const renderSectionContent = \(\) => \{/);

    assert.match(sectionContentSource, /export function InstanceDetailSectionContent/);
    assert.match(sectionContentSource, /SectionAvailabilityNotice/);
    assert.match(sectionContentSource, /InstanceDetailOverviewSection/);
    assert.match(sectionContentSource, /InstanceDetailChannelsSection/);
    assert.match(sectionContentSource, /InstanceDetailSkillsSection/);
    assert.match(sectionContentSource, /InstanceDetailFilesSection/);
    assert.match(sectionContentSource, /InstanceConfigWorkbenchPanel/);
  },
);

runTest(
  'sdkwork-claw-instances lazy-loads heavy files and config sections through the section router',
  () => {
    const sectionContentSource = read(
      'packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx',
    );

    assert.match(
      sectionContentSource,
      /const LazyInstanceDetailFilesSection = React\.lazy\(/,
    );
    assert.match(
      sectionContentSource,
      /const LazyInstanceConfigWorkbenchPanel = React\.lazy\(/,
    );
    assert.match(
      sectionContentSource,
      /import\('\.\/InstanceDetailFilesSection\.tsx'\)/,
    );
    assert.match(
      sectionContentSource,
      /import\('\.\/InstanceConfigWorkbenchPanel\.tsx'\)/,
    );
    assert.doesNotMatch(
      sectionContentSource,
      /import \{ InstanceDetailFilesSection \} from '\.\/InstanceDetailFilesSection\.tsx';/,
    );
    assert.doesNotMatch(
      sectionContentSource,
      /import \{ InstanceConfigWorkbenchPanel \} from '\.\/InstanceConfigWorkbenchPanel\.tsx';/,
    );
    assert.match(sectionContentSource, /<React\.Suspense fallback=\{/);
  },
);

runTest(
  'sdkwork-claw-instances routes Instance Detail page derived presentation state through a shared helper',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const helperSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
    );
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

    assert.ok(exists('packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts'));
    assert.match(detailSource, /buildInstanceDetailDerivedState/);
    assert.match(servicesIndexSource, /instanceDetailDerivedState/);
    assert.doesNotMatch(detailSource, /const providerWorkspaceState = buildOpenClawProviderWorkspaceState\(detail\);/);
    assert.doesNotMatch(detailSource, /const memoryWorkbenchState = buildInstanceMemoryWorkbenchState\(workbench\);/);
    assert.doesNotMatch(detailSource, /const managementSummary = useMemo/);
    assert.doesNotMatch(detailSource, /const providerSelectionState = useMemo/);
    assert.doesNotMatch(detailSource, /const configChannelSelectionState = useMemo/);
    assert.doesNotMatch(detailSource, /const webSearchProviderSelectionState = useMemo/);
    assert.doesNotMatch(detailSource, /const providerDialogPresentation = useMemo/);
    assert.doesNotMatch(detailSource, /const availableAgentModelOptions = buildOpenClawAgentModelOptions/);
    assert.doesNotMatch(detailSource, /const readonlyChannelWorkspaceItems = useMemo/);
    assert.doesNotMatch(detailSource, /const configChannelWorkspaceItems = useMemo/);

    assert.match(helperSource, /export function buildInstanceDetailDerivedState/);
    assert.match(helperSource, /buildInstanceActionCapabilities/);
    assert.match(helperSource, /buildOpenClawProviderWorkspaceState/);
    assert.match(helperSource, /buildInstanceMemoryWorkbenchState/);
    assert.match(helperSource, /buildInstanceManagementSummary/);
    assert.match(helperSource, /buildOpenClawProviderSelectionState/);
    assert.match(helperSource, /buildOpenClawConfigChannelSelectionState/);
    assert.match(helperSource, /buildOpenClawWebSearchProviderSelectionState/);
    assert.match(helperSource, /buildOpenClawProviderDialogPresentation/);
    assert.match(helperSource, /buildOpenClawAgentModelOptions/);
    assert.match(helperSource, /buildReadonlyChannelWorkspaceItems/);
    assert.match(helperSource, /buildOpenClawConfigChannelWorkspaceItems/);
  },
);

runTest('sdkwork-claw-instances blocks unsupported lifecycle mutations before the studio bridge is called', () => {
  const serviceSource = read('packages/sdkwork-claw-instances/src/services/instanceService.ts');
  const serviceCoreSource = read('packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts');

  assert.match(serviceSource, /createInstanceService as createInstanceServiceCore/);
  assert.match(serviceSource, /export const instanceService = createInstanceService\(\);/);
  assert.match(serviceCoreSource, /assertLifecycleControlSupported/);
  assert.match(serviceCoreSource, /getInstanceDetail\(id\)\.catch\(\(\) => null\)/);
  assert.match(serviceCoreSource, /detail\.lifecycle\.startStopSupported === false/);
  assert.match(serviceCoreSource, /await this\.assertLifecycleControlSupported\(id\);\s*const updated = await this\.dependencies\.studioApi\.startInstance\(id\);/);
  assert.match(serviceCoreSource, /await this\.assertLifecycleControlSupported\(id\);\s*const updated = await this\.dependencies\.studioApi\.stopInstance\(id\);/);
  assert.match(serviceCoreSource, /await this\.assertLifecycleControlSupported\(id\);\s*const updated = await this\.dependencies\.studioApi\.restartInstance\(id\);/);
});

runTest('sdkwork-claw-instances runtime service wrappers forward openClawConfigService methods explicitly instead of spreading a class instance', () => {
  const instanceServiceSource = read('packages/sdkwork-claw-instances/src/services/instanceService.ts');
  const workbenchServiceSource = read('packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts');
  const instanceServiceOverrides = extractBetween(
    instanceServiceSource,
    'function createRuntimeDependencyOverrides()',
    'export function createInstanceService(',
  );
  const workbenchServiceOverrides = extractBetween(
    workbenchServiceSource,
    'function createRuntimeDependencyOverrides()',
    'export function createInstanceWorkbenchService(',
  );

  assert.match(instanceServiceOverrides, /resolveInstanceConfigPath:\s*\(detail\)\s*=>\s*openClawConfigService\.resolveInstanceConfigPath\(detail\)/);
  assert.match(instanceServiceOverrides, /readConfigDocument:\s*\(configPath\)\s*=>\s*openClawConfigService\.readConfigDocument\(configPath\)/);
  assert.match(instanceServiceOverrides, /writeConfigDocument:\s*\(configPath,\s*raw\)\s*=>\s*openClawConfigService\.writeConfigDocument\(configPath,\s*raw\)/);
  assert.match(instanceServiceOverrides, /saveAgent:\s*\(input\)\s*=>\s*openClawConfigService\.saveAgent\(input\)/);
  assert.match(instanceServiceOverrides, /deleteAgent:\s*\(input\)\s*=>\s*openClawConfigService\.deleteAgent\(input\)/);
  assert.match(instanceServiceOverrides, /saveChannelConfiguration:\s*\(input\)\s*=>\s*openClawConfigService\.saveChannelConfiguration\(input\)/);
  assert.match(instanceServiceOverrides, /saveWebSearchConfiguration:\s*\(input\)\s*=>\s*openClawConfigService\.saveWebSearchConfiguration\(input\)/);
  assert.match(instanceServiceOverrides, /saveAuthCooldownsConfiguration:\s*\(input\)\s*=>\s*openClawConfigService\.saveAuthCooldownsConfiguration\(input\)/);
  assert.match(instanceServiceOverrides, /setChannelEnabled:\s*\(input\)\s*=>\s*openClawConfigService\.setChannelEnabled\(input\)/);
  assert.doesNotMatch(instanceServiceOverrides, /openClawConfigService,\s*\n/);

  assert.match(workbenchServiceOverrides, /resolveInstanceConfigPath:\s*\(detail\)\s*=>\s*openClawConfigService\.resolveInstanceConfigPath\(detail\)/);
  assert.match(workbenchServiceOverrides, /readConfigSnapshot:\s*\(configPath\)\s*=>\s*openClawConfigService\.readConfigSnapshot\(configPath\)/);
  assert.match(workbenchServiceOverrides, /getChannelDefinitions:\s*\(\)\s*=>\s*openClawConfigService\.getChannelDefinitions\(\)/);
  assert.doesNotMatch(workbenchServiceOverrides, /openClawConfigService,\s*\n/);
});

runTest('sdkwork-claw-instances gates instance detail lifecycle actions with backend lifecycle capability', () => {
  const detailSource = readInstanceDetailPageSources();
  const derivedStateSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
  );
  const headerSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailHeader.tsx',
  );
  const actionCapabilitiesSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.ts',
  );

  assert.match(actionCapabilitiesSource, /buildInstanceActionCapabilities/);
  assert.match(
    actionCapabilitiesSource,
    /detail\?\.lifecycle\.lifecycleControllable \?\? detail\?\.lifecycle\.startStopSupported/,
  );
  assert.match(detailSource, /buildInstanceDetailDerivedState/);
  assert.match(
    derivedStateSource,
    /const actionCapabilityInstance = instance[\s\S]*isBuiltIn: instance\.isBuiltIn \?\? detail\?\.instance\.isBuiltIn,[\s\S]*const actionCapabilities = buildInstanceActionCapabilities\(actionCapabilityInstance, detail\);/,
  );
  assert.match(derivedStateSource, /canControlLifecycle: actionCapabilities\.canControlLifecycle,/);
  assert.match(derivedStateSource, /canStopLifecycle: actionCapabilities\.canStop,/);
  assert.match(derivedStateSource, /canStartLifecycle: actionCapabilities\.canStart,/);
  assert.match(detailSource, /InstanceDetailHeader/);
  assert.match(headerSource, /\{canControlLifecycle \? \(/);
  assert.match(derivedStateSource, /canDelete: actionCapabilities\.canDelete,/);
  assert.match(headerSource, /\{canDelete \? \(/);
  assert.doesNotMatch(detailSource, /onClick=\{handleRestart\}[\s\S]*instances\.detail\.actions\.restart[\s\S]*\{instance\.status === 'online' \?/);
});

runTest('sdkwork-claw-instances blocks built-in instance uninstall in the service layer instead of relying only on UI chrome', () => {
  const instanceServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts',
  );

  assert.match(instanceServiceCoreSource, /function createBuiltInInstanceDeleteError\(\)/);
  assert.match(
    instanceServiceCoreSource,
    /private async assertDeleteSupported\(id: string\) \{[\s\S]*detail\?\.instance\.isBuiltIn === true[\s\S]*throw createBuiltInInstanceDeleteError\(\);/s,
  );
  assert.match(
    instanceServiceCoreSource,
    /async deleteInstance\(id: string\): Promise<void> \{\s*await this\.assertDeleteSupported\(id\);[\s\S]*this\.dependencies\.studioApi\.deleteInstance\(id\);/s,
  );
});

runTest('sdkwork-claw-instances preloads lifecycle support for instance list actions before exposing controls', () => {
  const listSource = read('packages/sdkwork-claw-instances/src/pages/Instances.tsx');
  const actionCapabilitiesSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceActionCapabilities.ts',
  );

  assert.match(
    listSource,
    /const \[actionCapabilitiesByInstanceId, setActionCapabilitiesByInstanceId\] = useState</,
  );
  assert.match(listSource, /buildInstanceActionCapabilities\(instance, null\)/);
  assert.match(listSource, /loadInstanceActionCapabilities\(/);
  assert.match(
    actionCapabilitiesSource,
    /const detail = await loadDetail\(instance\.id\)\.catch\(\(\) => null\);/,
  );
  assert.match(listSource, /actionCapabilitiesByInstanceId\[instance\.id\]/);
  assert.match(listSource, /const canRestartLifecycle = actionCapabilities\.canRestart;/);
  assert.match(listSource, /const canStartLifecycle = actionCapabilities\.canStart;/);
  assert.match(listSource, /const canDelete = actionCapabilities\.canDelete;/);
});

runTest('sdkwork-claw-instances adds an instance-native LLM provider workspace with editable config chrome', () => {
  const detailSource = readInstanceDetailPageSources();
  const providersSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProvidersSection.tsx',
  );
  const managedProvidersSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProvidersWorkbenchSection.tsx',
  );
  const sectionModelsSource = read(
    'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
  );
  const panelSource = read('packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx');

  assert.match(detailSource, /buildLlmProvidersSectionContent/);
  assert.match(detailSource, /buildInstanceDetailNavigationHandlers/);
  assert.match(
    detailSource,
    /onOpenProviderCenter: detailNavigationHandlers\.onOpenProviderCenter,/,
  );
  assert.match(providersSource, /data-slot="instance-llm-provider-list"/);
  assert.match(providersSource, /isProviderConfigReadonly/);
  assert.match(providersSource, /providerCenter\.page\.title/);
  assert.match(sectionModelsSource, /InstanceDetailLlmProvidersWorkbenchSection/);
  assert.match(managedProvidersSource, /InstanceDetailLlmProvidersSection/);
  assert.match(panelSource, /data-slot="instance-llm-config-panel"/);
  assert.match(panelSource, /onOpenProviderCenter\?: \(\) => void;/);
  assert.match(panelSource, /openProviderCenterLabel\?: string;/);
  assert.match(panelSource, /onOpenProviderCenter && openProviderCenterLabel/);
  assert.match(panelSource, /defaultModelId/);
  assert.match(panelSource, /temperature/);
  assert.match(panelSource, /maxTokens/);
});

runTest('sdkwork-claw-instances aggregates instance-native runtime surfaces through a dedicated workbench service', () => {
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts',
  ]);

  assert.match(serviceSource, /getInstanceDetail/);
  assert.match(serviceSource, /instanceService/);
  assert.match(serviceSource, /getInstanceById/);
  assert.match(serviceSource, /getInstanceConfig/);
  assert.match(serviceSource, /getInstanceToken/);
  assert.match(serviceSource, /getInstanceLogs/);
  assert.match(serviceSource, /openClawGatewayClient/);
  assert.match(serviceSource, /getChannelStatus/);
  assert.match(serviceSource, /listWorkbenchCronJobs/);
  assert.match(serviceSource, /listWorkbenchCronRuns/);
  assert.match(serviceSource, /listInstanceFiles/);
  assert.match(serviceSource, /listInstanceMemories/);
  assert.match(serviceSource, /buildRegistryWorkbenchSnapshot/);
  assert.doesNotMatch(serviceSource, /studioMockService/);
});

runTest('sdkwork-claw-instances renders a backend-authored runtime overview section', () => {
  const sectionContentSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx',
  );
  const overviewSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailOverviewSection.tsx',
  );

  assert.match(sectionContentSource, /InstanceDetailOverviewSection/);
  assert.match(overviewSource, /data-slot="instance-detail-overview"/);
  assert.match(overviewSource, /data-slot="instance-detail-management-summary"/);
  assert.match(overviewSource, /data-slot="instance-detail-capability-matrix"/);
  assert.match(overviewSource, /data-slot="instance-detail-connectivity"/);
});

runTest('sdkwork-claw-instances promotes instance management metadata into the overview workbench surface', () => {
  const detailSource = readInstanceDetailPageSources();
  const derivedStateSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
  );
  const overviewSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailOverviewSection.tsx',
  );
  const presentationSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceManagementPresentation.ts',
  );

  assert.match(detailSource, /buildInstanceDetailDerivedState/);
  assert.match(derivedStateSource, /buildInstanceManagementSummary/);
  assert.match(overviewSource, /instanceWorkbench\.overview\.management\.title/);
  assert.match(overviewSource, /instanceWorkbench\.overview\.management\.description/);
  assert.match(presentationSource, /managementScope/);
  assert.match(presentationSource, /kernelConfig/);
  assert.match(presentationSource, /defaultWorkspace/);
  assert.match(presentationSource, /instanceWorkbench\.overview\.management\.labels\.controlPlane/);
  assert.match(presentationSource, /instanceWorkbench\.overview\.management\.details\.scopeFull/);
});

runTest('sdkwork-claw-instances renders backend-authored data access and artifact overview surfaces', () => {
  const overviewSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailOverviewSection.tsx',
  );
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts',
  ]);

  assert.match(overviewSource, /data-slot="instance-detail-data-access"/);
  assert.match(overviewSource, /data-slot="instance-detail-artifacts"/);
  assert.match(overviewSource, /detail\.dataAccess/);
  assert.match(overviewSource, /detail\.artifacts/);
  assert.match(serviceSource, /dataAccess/);
  assert.match(serviceSource, /artifacts/);
});

runTest(
  'sdkwork-claw-instances keeps shared startup refresh support keyed to platform startup facts instead of the OpenClaw kernel id',
  () => {
    const startupRefreshSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceStartupRefreshSupport.ts',
    );

    assert.match(startupRefreshSupportSource, /instance\.isBuiltIn === true/);
    assert.match(startupRefreshSupportSource, /instance\.deploymentMode === 'local-managed'/);
    assert.match(startupRefreshSupportSource, /instance\.status === 'starting'/);
    assert.doesNotMatch(startupRefreshSupportSource, /instance\.runtimeKind === 'openclaw'/);
  },
);

runTest('sdkwork-claw-instances keeps metadata badge keys unique when different fields share the same value', () => {
  const badges = buildInstanceDetailBadgeDescriptors('config', [
    { slot: 'scope', value: 'config' },
    { slot: 'mode', value: 'metadataOnly' },
    { slot: 'source', value: 'config' },
  ]);

  assert.deepEqual(
    badges.map((badge) => badge.value),
    ['config', 'metadataOnly', 'config'],
  );
  assert.deepEqual(
    badges.map((badge) => badge.key),
    ['config-scope-config', 'config-mode-metadataOnly', 'config-source-config'],
  );
  assert.equal(new Set(badges.map((badge) => badge.key)).size, badges.length);
});

runTest('sdkwork-claw-instances prefers backend-authored openclaw workbench sections when available', () => {
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  ]);

  assert.match(serviceSource, /detail\.workbench/);
  assert.match(serviceSource, /isOpenClawDetail\(detail\)/);
  assert.match(serviceSource, /if \(detail\?\.workbench\)/);
  assert.match(serviceSource, /mapBackendWorkbench\(detail,/);
});

runTest('sdkwork-claw-instances reuses the shared cron manager and keeps OpenClaw cron CRUD fully editable', () => {
  const detailSource = readInstanceDetailPageSources();
  const derivedStateSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
  );
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  ]);
  const studioContract = read('packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts');
  const instancesPkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-instances/package.json',
  );
  const panelSource = read('packages/sdkwork-claw-instances/src/components/InstanceLLMConfigPanel.tsx');
  const sectionModelsSource = read(
    'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
  );

  assert.equal(instancesPkg.dependencies?.['@sdkwork/claw-commons'], 'workspace:*');
  assert.match(studioContract, /createInstanceTask/);
  assert.match(studioContract, /updateInstanceTask/);
  assert.match(studioContract, /cloneInstanceTask/);
  assert.match(studioContract, /runInstanceTaskNow/);
  assert.match(studioContract, /listInstanceTaskExecutions/);
  assert.match(studioContract, /updateInstanceTaskStatus/);
  assert.match(studioContract, /deleteInstanceTask/);
  assert.match(serviceSource, /studio\.createInstanceTask/);
  assert.match(serviceSource, /studio\.updateInstanceTask/);
  assert.match(serviceSource, /studio\.cloneInstanceTask/);
  assert.match(serviceSource, /studio\.runInstanceTaskNow/);
  assert.match(serviceSource, /studio\.listInstanceTaskExecutions/);
  assert.match(serviceSource, /studio\.updateInstanceTaskStatus/);
  assert.match(serviceSource, /studio\.deleteInstanceTask/);
  assert.doesNotMatch(serviceSource, /OpenClaw managed cron task mutations are not wired yet/);
  assert.match(derivedStateSource, /detail\?\.instance\.runtimeKind === 'openclaw'/);
  assert.match(detailSource, /buildTasksSectionContent/);
  assert.match(sectionModelsSource, /CronTasksManager/);
  assert.match(sectionModelsSource, /instanceId,/);
  assert.doesNotMatch(detailSource, /data-slot="instance-openclaw-cron-editor-notice"/);
  assert.doesNotMatch(detailSource, /instanceWorkbench\.sections\.cronTasks\.editorNotice/);
  assert.doesNotMatch(detailSource, /isOpenClawTaskEditorPending/);
  assert.match(panelSource, /isReadonly: boolean;/);
  assert.match(panelSource, /readonlyMessage\?: string;/);
  assert.match(panelSource, /disabled=\{isReadonly\}/);
});

runTest('sdkwork-claw-instances keeps local-external OpenClaw config-backed while routing provider changes through Provider Center', () => {
  const detailSource = readInstanceDetailPageSources();
  const derivedStateSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
  );
  const sectionContentSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.tsx',
  );
  const channelsSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailChannelsSection.tsx',
  );
  const providersSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProvidersSection.tsx',
  );
  const instanceServiceSource = [
    read('packages/sdkwork-claw-instances/src/services/instanceService.ts'),
    read('packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts'),
  ].join('\n');
  const providerWorkspaceSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts',
  );
  const capabilitiesSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts',
  );
  const workbenchSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts',
  ]);
  const sectionModelsSource = read(
    'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
  );

  assert.match(detailSource, /buildLlmProvidersSectionContent/);
  assert.match(channelsSource, /ChannelWorkspace/);
  assert.match(sectionContentSource, /configFilePath=\{effectiveConfigFilePath\}/);
  assert.match(channelsSource, /configFileLabel: formatWorkbenchLabel\('configFile'\)/);
  assert.match(detailSource, /buildInstanceDetailDerivedState/);
  assert.match(derivedStateSource, /buildOpenClawProviderWorkspaceState/);
  assert.match(derivedStateSource, /buildOpenClawProviderSelectionState/);
  assert.match(derivedStateSource, /kernelAuthority\?\.configControl/);
  assert.match(providersSource, /isReadonly=\{isProviderConfigReadonly\}/);
  assert.match(sectionModelsSource, /InstanceDetailLlmProvidersWorkbenchSection/);
  assert.match(
    providersSource,
    /readonlyMessage=\{t\('instances\.detail\.instanceWorkbench\.llmProviders\.readonlyNotice'\)\}/,
  );
  assert.match(providersSource, /disabled=\{!canManageOpenClawProviders\}/);
  assert.doesNotMatch(detailSource, /const selectedProvider = useMemo\(/);
  assert.doesNotMatch(detailSource, /const deletingProvider = useMemo\(/);
  assert.doesNotMatch(detailSource, /const deletingProviderModel = useMemo\(/);
  assert.doesNotMatch(detailSource, /const selectedProviderDraft = selectedProvider/);
  assert.doesNotMatch(detailSource, /const selectedProviderRequestDraft = selectedProvider/);
  assert.doesNotMatch(detailSource, /const selectedProviderRequestParseError = useMemo\(/);
  assert.doesNotMatch(detailSource, /const hasPendingProviderChanges = Boolean\(/);
  assert.match(derivedStateSource, /canEditConfigChannels: Boolean\(id && isOpenClawConfigWritable && configChannels\.length\)/);
  assert.match(
    derivedStateSource,
    /canEditConfigAuthCooldowns: Boolean\(\s*id && isOpenClawConfigWritable && configAuthCooldowns,\s*\)/,
  );

  assert.match(instanceServiceSource, /openClawConfigService/);
  assert.match(instanceServiceSource, /createProviderCenterControlledOpenClawProviderError/);
  assert.doesNotMatch(instanceServiceSource, /createManagedOpenClawProviderControlPlaneError/);
  assert.match(instanceServiceSource, /Provider Center/);
  assert.match(instanceServiceSource, /resolveOpenClawConfigBinding/);
  assert.doesNotMatch(instanceServiceSource, /resolveManagedOpenClawConfig/);
  assert.match(instanceServiceSource, /resolvedDetail\.lifecycle\.configWritable/);
  assert.match(instanceServiceSource, /openClawConfigService\.resolveInstanceConfigPath/);
  assert.doesNotMatch(instanceServiceSource, /ManagedOpenClawConfigSchemaSnapshot/);
  assert.doesNotMatch(instanceServiceSource, /getManagedOpenClawConfigDocument/);
  assert.doesNotMatch(instanceServiceSource, /updateManagedOpenClawConfigDocument/);
  assert.doesNotMatch(instanceServiceSource, /getManagedOpenClawConfigSchema/);
  assert.doesNotMatch(instanceServiceSource, /openManagedOpenClawConfigFile/);
  assert.doesNotMatch(instanceServiceSource, /applyManagedOpenClawConfigDocument/);
  assert.doesNotMatch(instanceServiceSource, /runManagedOpenClawUpdate/);

  assert.match(providerWorkspaceSource, /buildKernelAuthorityProjection/);
  assert.match(providerWorkspaceSource, /export function buildOpenClawProviderSelectionState/);
  assert.match(providerWorkspaceSource, /createOpenClawProviderConfigDraft/);
  assert.match(providerWorkspaceSource, /createOpenClawProviderRequestDraft/);
  assert.match(providerWorkspaceSource, /hasPendingOpenClawProviderConfigChanges/);
  assert.match(providerWorkspaceSource, /hasWritableOpenClawConfigRoute/);
  assert.match(providerWorkspaceSource, /parseOpenClawProviderRequestOverridesDraft/);
  assert.match(providerWorkspaceSource, /isProviderConfigReadonly:\s*providerCenterControlled/);
  assert.match(providerWorkspaceSource, /canManageProviderCatalog:\s*false/);
  assert.doesNotMatch(providerWorkspaceSource, /hasManagedOpenClawConfigRoute/);
  assert.doesNotMatch(capabilitiesSource, /export const hasManagedOpenClawConfigRoute =/);
  assert.doesNotMatch(providerWorkspaceSource, /instanceService\./);
  assert.doesNotMatch(providerWorkspaceSource, /toast\./);
  assert.doesNotMatch(providerWorkspaceSource, /loadWorkbench\(/);

  assert.match(workbenchSource, /openClawConfigService/);
  assert.match(workbenchSource, /resolveInstanceConfigPath/);
  assert.match(workbenchSource, /detail\.dataAccess/);
  assert.match(workbenchSource, /isProviderCenterControlledOpenClawDetail/);
  assert.match(workbenchSource, /providerSnapshots\.map\(mapConfigBackedProvider\)/);
});

runTest('sdkwork-claw-instances keeps OpenClaw agent CRUD real while provider routes stay discoverable in instance detail', () => {
  const detailSource = readInstanceDetailPageSources();
  const agentsSectionSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailAgentsSection.tsx',
  );
  const providersSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailLlmProvidersSection.tsx',
  );
  const instanceServiceSource = [
    read('packages/sdkwork-claw-instances/src/services/instanceService.ts'),
    read('packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts'),
  ].join('\n');
  const workbenchSource = readSources([
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts',
  ]);
  const agentWorkbenchSupportSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawAgentWorkbenchSupport.ts',
  );
  const capabilitiesSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.ts',
  );
  const sectionModelsSource = read(
    'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
  );

  assert.match(detailSource, /buildLlmProvidersSectionContent/);
  assert.match(providersSource, /instances\.detail\.instanceWorkbench\.llmProviders\.panel\.newProvider/);
  assert.match(
    providersSource,
    /instances\.detail\.instanceWorkbench\.llmProviders\.panel\.providerModelsTitle/,
  );
  assert.match(providersSource, /isProviderConfigReadonly/);
  assert.match(providersSource, /canManageOpenClawProviders/);
  assert.match(sectionModelsSource, /InstanceDetailLlmProvidersWorkbenchSection/);
  assert.match(detailSource, /onEditAgent:\s*agentDialogStateHandlers\.openEditAgentDialog/);
  assert.match(agentsSectionSource, /instances\.detail\.instanceWorkbench\.agents\.deleteDialog\.title/);
  assert.match(agentsSectionSource, /onEditAgent=\{onEditAgent\}/);
  assert.match(instanceServiceSource, /createOpenClawAgent/);
  assert.match(instanceServiceSource, /updateOpenClawAgent/);
  assert.match(instanceServiceSource, /deleteOpenClawAgent/);
  assert.match(agentWorkbenchSupportSource, /configSource: 'configFile'/);
  assert.match(agentWorkbenchSupportSource, /function mapConfigBackedAgent\(/);
  assert.doesNotMatch(agentWorkbenchSupportSource, /function mapManagedAgent\(/);
  assert.match(agentWorkbenchSupportSource, /export function buildOpenClawWorkbenchAgents\(/);
  assert.doesNotMatch(agentWorkbenchSupportSource, /export function buildManagedOpenClawAgents\(/);
  assert.match(capabilitiesSource, /function isBuiltInOpenClawProbeCandidate\(/);
  assert.doesNotMatch(capabilitiesSource, /function isBuiltInManagedOpenClawProbeCandidate\(/);
  assert.match(workbenchSource, /configSnapshot\?\.agentSnapshots/);
  assert.match(workbenchSource, /buildOpenClawWorkbenchAgents\(/);
  assert.doesNotMatch(workbenchSource, /buildManagedOpenClawAgents\(/);
});

runTest('sdkwork-claw-instances keeps the OpenClaw workbench file explorer aligned with the standard bootstrap file set', () => {
  const rustWorkbenchSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_workbench.rs',
  );

  assert.match(rustWorkbenchSource, /"AGENTS\.md"/);
  assert.match(rustWorkbenchSource, /"HEARTBEAT\.md"/);
  assert.match(rustWorkbenchSource, /"BOOT\.md"/);
  assert.match(rustWorkbenchSource, /"BOOTSTRAP\.md"/);
  assert.match(rustWorkbenchSource, /"MEMORY\.md"/);
});

runTest('sdkwork-claw-instances routes agent creation through one centered workflow modal instead of split market and create buttons', () => {
  const detailSource = readInstanceDetailPageSources();
  const agentsSectionSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailAgentsSection.tsx',
  );
  const workflowSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceAgentCreationWorkflowDialog.tsx',
  );
  const panelSource = read('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx');
  const editorSource = read(
    'packages/sdkwork-claw-instances/src/components/OpenClawAgentEditorForm.tsx',
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/components/InstanceAgentCreationWorkflowDialog.tsx'));
  assert.match(panelSource, /onOpenAgentCreationWorkflow/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.agents\.panel\.newAgent/);
  assert.doesNotMatch(panelSource, /sidebar\.agentMarket/);
  assert.doesNotMatch(panelSource, /BriefcaseBusiness/);
  assert.doesNotMatch(detailSource, /onOpenAgentMarket: detailNavigationHandlers\.onOpenAgentMarket,/);
  assert.doesNotMatch(detailSource, /onCreateAgent: agentDialogStateHandlers\.openCreateAgentDialog,/);
  assert.match(agentsSectionSource, /InstanceAgentCreationWorkflowDialog/);
  assert.match(agentsSectionSource, /onOpenAgentCreationWorkflow=\{onOpenAgentCreationWorkflow\}/);
  assert.match(workflowSource, /left-1\/2 top-1\/2/);
  assert.match(workflowSource, /kernelAgentLibraryService/);
  assert.match(workflowSource, /kernelOwnedAgentLibraryService/);
  assert.match(workflowSource, /agentInstallService/);
  assert.match(
    workflowSource,
    /instances\.detail\.instanceWorkbench\.agents\.creationWorkflow\./,
  );
  assert.match(
    editorSource,
    /instances\.detail\.instanceWorkbench\.agents\.(creationWorkflow|dialog)\./,
  );
  assert.doesNotMatch(workflowSource, /chat\.sidebar\./);
  assert.doesNotMatch(editorSource, /chat\.sidebar\./);
  assert.doesNotMatch(workflowSource, /window\.setTimeout/);
  assert.match(detailSource, /isReadonly:\s*!isOpenClawConfigWritable/);
  assert.match(panelSource, /disabled=\{isReadonly\}/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.agents\.marketReadonlyNotice/);
});

runTest('sdkwork-claw-instances turns agents into a master-detail workbench backed by an agent-scoped service', () => {
  const detailSource = readInstanceDetailPageSources();
  const agentsSectionSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceDetailAgentsSection.tsx',
  );
  const sectionModelsSource = read(
    'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
  );
  const panelSource = read('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx');
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/agentWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/agentWorkbenchServiceCore.ts',
  ]);

  assert.match(detailSource, /buildAgentSectionContent/);
  assert.match(detailSource, /selectedAgentId/);
  assert.match(detailSource, /agentWorkbenchService\.getAgentWorkbench/);
  assert.match(sectionModelsSource, /InstanceDetailAgentsSection/);
  assert.match(agentsSectionSource, /data-slot="instance-detail-agents-section"/);
  assert.match(agentsSectionSource, /AgentWorkbenchPanel/);
  assert.match(agentsSectionSource, /onOpenAgentCreationWorkflow=\{onOpenAgentCreationWorkflow\}/);
  assert.match(agentsSectionSource, /InstanceAgentCreationWorkflowDialog/);
  assert.match(agentsSectionSource, /onDeleteAgent=\{onRequestDeleteAgent\}/);
  assert.match(panelSource, /data-slot="agent-workbench-sidebar"/);
  assert.match(panelSource, /data-slot="agent-workbench-detail"/);
  assert.match(panelSource, /data-slot="agent-workbench-top-tabs"/);
  assert.match(panelSource, /data-slot="agent-workbench-files"/);
  assert.match(panelSource, /InstanceFilesWorkspace/);
  assert.match(panelSource, /mode="agent"/);
  assert.doesNotMatch(panelSource, /<InstanceFileExplorer/);
  assert.match(serviceSource, /authProfilesPath/);
  assert.match(serviceSource, /modelsRegistryPath/);
  assert.match(serviceSource, /sessionsPath/);
  assert.match(serviceSource, /routeStatus/);
});

runTest('sdkwork-claw-instances gives agent skills an official workspace-scoped install guide and richer status metadata', () => {
  const panelSource = read('packages/sdkwork-claw-instances/src/components/AgentWorkbenchPanel.tsx');
  const serviceSource = readSources([
    'packages/sdkwork-claw-instances/src/services/agentWorkbenchService.ts',
    'packages/sdkwork-claw-instances/src/services/agentWorkbenchServiceCore.ts',
  ]);

  assert.match(panelSource, /openclaw skills install/);
  assert.match(panelSource, /return `cd "\$\{target\}"\\nopenclaw skills install \$\{normalizedSlug\}`;/);
  assert.match(panelSource, /navigator\.clipboard\.writeText/);
  assert.match(panelSource, /skill\.scope/);
  assert.match(panelSource, /skill\.eligible/);
  assert.match(serviceSource, /scope:/);
  assert.match(serviceSource, /installOptions:/);
  assert.match(serviceSource, /skillKey:/);
});

runTest('sdkwork-claw-instances routes remote provider config patch building through a dedicated helper', () => {
  const coreSource = read('packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts');

  assert.ok(exists('packages/sdkwork-claw-instances/src/services/openClawProviderConfigPatch.ts'));
  assert.match(coreSource, /from '\.\/openClawProviderConfigPatch\.ts'/);
  assert.doesNotMatch(coreSource, /function buildOpenClawModelRef\(/);
  assert.doesNotMatch(coreSource, /function inferOpenClawModelCatalogStreaming\(/);
  assert.doesNotMatch(coreSource, /function buildOpenClawRuntimeParamsPatch\(/);
  assert.doesNotMatch(coreSource, /function buildOpenClawRequestOverridesPatch\(/);
  assert.doesNotMatch(coreSource, /function buildRemoteOpenClawProviderConfigPatch\(/);
});

runTest('sdkwork-claw-instances routes fallback kernel config-path resolution through a shared helper', () => {
  const instanceServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts',
  );
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/services/kernelConfigPathFallback.ts'));
  assert.ok(!exists('packages/sdkwork-claw-instances/src/services/openClawConfigPathFallback.ts'));
  assert.match(instanceServiceCoreSource, /from '\.\/kernelConfigPathFallback\.ts'/);
  assert.match(instanceWorkbenchServiceCoreSource, /from '\.\/kernelConfigPathFallback\.ts'/);
  assert.doesNotMatch(instanceServiceCoreSource, /function resolveFallbackInstanceConfigPath\(/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function resolveFallbackInstanceConfigPath\(/,
  );
});

runTest(
  'sdkwork-claw-instances keeps instanceServiceCore config bindings aligned with kernel-config terminology inside runtime config flows',
  () => {
    const instanceServiceCoreSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts',
    );

    assert.match(
      instanceServiceCoreSource,
      /private async saveOpenClawConfigWithGateway\(\s*id: string,\s*configBinding: \{/,
    );
    assert.match(
      instanceServiceCoreSource,
      /private async assertOpenClawConfigDocumentAvailable\(configPath: string\)/,
    );
    assert.match(
      instanceServiceCoreSource,
      /private async resolveOpenClawConfigBinding\(\s*id: string,\s*detail\?: StudioInstanceDetailRecord \| null,/,
    );
    assert.match(instanceServiceCoreSource, /configBinding\.detail/);
    assert.match(instanceServiceCoreSource, /configBinding\.configPath/);
    assert.match(
      instanceServiceCoreSource,
      /const configBinding = await this\.resolveOpenClawConfigBinding\(/,
    );
    assert.doesNotMatch(
      instanceServiceCoreSource,
      /const managedConfig = await this\.resolveOpenClawConfigBinding\(/,
    );
    assert.doesNotMatch(
      instanceServiceCoreSource,
      /assertManagedOpenClawConfigDocumentAvailable|resolveManagedOpenClawConfig|saveManagedOpenClawConfigWithGateway/,
    );
  },
);

runTest(
  'sdkwork-claw-instances keeps internal workbench config snapshot typing aligned with kernel-config terminology',
  () => {
    const agentWorkbenchServiceCoreSource = read(
      'packages/sdkwork-claw-instances/src/services/agentWorkbenchServiceCore.ts',
    );
    const agentWorkbenchSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawAgentWorkbenchSupport.ts',
    );
    const channelWorkbenchSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawChannelWorkbenchSupport.ts',
    );
    const providerWorkbenchSupportSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawProviderWorkbenchSupport.ts',
    );
    const combinedSource = [
      agentWorkbenchServiceCoreSource,
      agentWorkbenchSupportSource,
      channelWorkbenchSupportSource,
      providerWorkbenchSupportSource,
    ].join('\n');

    assert.doesNotMatch(combinedSource, /ManagedOpenClawConfigSnapshot/);
    assert.match(
      agentWorkbenchServiceCoreSource,
      /import type { OpenClawConfigSnapshot } from '@sdkwork\/claw-core';/,
    );
    assert.match(
      agentWorkbenchSupportSource,
      /type OpenClawAgentConfigSnapshot = OpenClawConfigSnapshot\['agentSnapshots'\]\[number\];/,
    );
    assert.match(
      channelWorkbenchSupportSource,
      /type OpenClawChannelConfigSnapshot = OpenClawConfigSnapshot\['channelSnapshots'\]\[number\];/,
    );
    assert.match(
      providerWorkbenchSupportSource,
      /export function mapConfigBackedProvider\(/,
    );
    assert.doesNotMatch(
      providerWorkbenchSupportSource,
      /export function mapManagedProvider\(/,
    );
    assert.match(
      providerWorkbenchSupportSource,
      /provider: OpenClawConfigSnapshot\['providerSnapshots'\]\[number\],/,
    );
  },
);

runTest('sdkwork-claw-instances routes OpenClaw file path derivation through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );
  const fileWorkbenchSupportSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawFileWorkbenchSupport.ts',
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/services/openClawFilePathSupport.ts'));
  assert.ok(exists('packages/sdkwork-claw-instances/src/services/openClawFileWorkbenchSupport.ts'));
  assert.match(instanceWorkbenchServiceCoreSource, /from '\.\/openClawFileWorkbenchSupport\.ts'/);
  assert.match(fileWorkbenchSupportSource, /from '\.\/openClawFilePathSupport\.ts'/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function normalizeOpenClawFilePath\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isRootedOpenClawFilePath\(/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function shouldCompareOpenClawPathCaseInsensitively\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function normalizeOpenClawComparablePath\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function trimComparableOpenClawPathPrefix\(/,
  );
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function getWorkbenchPathBasename\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function trimOpenClawWorkspacePrefix\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function normalizeOpenClawRequestPath\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function deriveOpenClawFileRequestPath\(/);
});

runTest(
  'sdkwork-claw-instances routes provider workspace sync-state shaping through a shared helper while keeping setter ownership in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const providerWorkspacePresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.ts',
    );
    const providerWorkspaceSyncEffect = extractBetween(
      detailSource,
      'const providers = workbench?.llmProviders || [];',
      'const configChannels = workbench?.configChannels || [];',
    );

    assert.match(detailSource, /buildOpenClawProviderWorkspaceSyncState/);
    assert.match(
      providerWorkspaceSyncEffect,
      /const providerWorkspaceSyncState = buildOpenClawProviderWorkspaceSyncState\(\{/,
    );
    assert.match(
      providerWorkspaceSyncEffect,
      /setSelectedProviderId\(providerWorkspaceSyncState\.resolveSelectedProviderId\);/,
    );
    assert.match(
      providerWorkspaceSyncEffect,
      /setProviderDrafts\(providerWorkspaceSyncState\.providerDrafts\);/,
    );
    assert.match(
      providerWorkspaceSyncEffect,
      /setProviderRequestDrafts\(providerWorkspaceSyncState\.providerRequestDrafts\);/,
    );
    assert.doesNotMatch(providerWorkspaceSyncEffect, /if \(providers\.length === 0\)/);
    assert.doesNotMatch(providerWorkspaceSyncEffect, /providers\.some/);
    assert.doesNotMatch(providerWorkspaceSyncEffect, /providers\[0\]\.id/);
    assert.doesNotMatch(providerWorkspaceSyncEffect, /setSelectedProviderId\(\(current\) =>/);
    assert.doesNotMatch(providerWorkspaceSyncEffect, /setProviderDrafts\(\{\}\);/);
    assert.doesNotMatch(providerWorkspaceSyncEffect, /setProviderRequestDrafts\(\{\}\);/);

    assert.match(
      providerWorkspacePresentationSource,
      /export function buildOpenClawProviderWorkspaceSyncState\(/,
    );
    assert.doesNotMatch(providerWorkspacePresentationSource, /setSelectedProviderId/);
    assert.doesNotMatch(providerWorkspacePresentationSource, /toast\./);
    assert.doesNotMatch(providerWorkspacePresentationSource, /instanceService\./);
    assert.doesNotMatch(providerWorkspacePresentationSource, /loadWorkbench\(/);
  },
);

runTest(
  'sdkwork-claw-instances routes config channel workspace sync-state shaping through a shared helper while keeping setter ownership in the page',
  () => {
    const detailSource = readInstanceDetailPageSources();
    const configChannelPresentationSource = read(
      'packages/sdkwork-claw-instances/src/services/openClawConfigChannelPresentation.ts',
    );
    const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
    const configChannelWorkspaceSyncBuilder = extractBetween(
      configChannelPresentationSource,
      'export function buildOpenClawConfigChannelWorkspaceSyncState(',
      'export function buildOpenClawConfigChannelSelectionState(',
    );
    const configChannelSyncEffect = extractBetween(
      detailSource,
      'const configChannels = workbench?.configChannels || [];',
      'const configWebSearch = workbench?.configWebSearch || null;',
    );

    assert.match(detailSource, /buildOpenClawConfigChannelWorkspaceSyncState/);
    assert.match(
      configChannelSyncEffect,
      /const configChannelWorkspaceSyncState = buildOpenClawConfigChannelWorkspaceSyncState\(\{/,
    );
    assert.match(
      configChannelSyncEffect,
      /setSelectedConfigChannelId\(configChannelWorkspaceSyncState\.resolveSelectedConfigChannelId\);/,
    );
    assert.match(
      configChannelSyncEffect,
      /setConfigChannelDrafts\(configChannelWorkspaceSyncState\.configChannelDrafts\);/,
    );
    assert.match(
      configChannelSyncEffect,
      /setConfigChannelError\(configChannelWorkspaceSyncState\.configChannelError\);/,
    );
    assert.doesNotMatch(configChannelSyncEffect, /if \(configChannels\.length === 0\)/);
    assert.doesNotMatch(configChannelSyncEffect, /configChannels\.some/);
    assert.doesNotMatch(configChannelSyncEffect, /setSelectedConfigChannelId\(\(current\) =>/);
    assert.doesNotMatch(configChannelSyncEffect, /setConfigChannelDrafts\(\{\}\);/);
    assert.doesNotMatch(configChannelSyncEffect, /setConfigChannelError\(null\);/);

    assert.match(
      configChannelPresentationSource,
      /export function buildOpenClawConfigChannelWorkspaceSyncState\(/,
    );
    assert.match(servicesIndexSource, /openClawConfigChannelPresentation/);
    assert.doesNotMatch(configChannelWorkspaceSyncBuilder, /setSelectedConfigChannelId/);
    assert.doesNotMatch(configChannelWorkspaceSyncBuilder, /toast\./);
    assert.doesNotMatch(configChannelWorkspaceSyncBuilder, /instanceService\./);
    assert.doesNotMatch(configChannelWorkspaceSyncBuilder, /loadWorkbench\(/);
  },
);

runTest('sdkwork-claw-instances routes provider catalog mutation construction and execution through a shared helper while keeping write-path authority in the page', () => {
  const detailSource = readInstanceDetailPageSources();
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
  const derivedStateSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceDetailDerivedState.ts',
  );
  const providerDraftSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.ts',
  );
  const providerPresentationSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawProviderPresentation.ts',
  );
  const providerCatalogMutationSupportSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawProviderCatalogMutationSupport.ts',
  );
  const providerCatalogExecutorSupportSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceDetailProviderCatalogMutationSupport.ts',
  );
  const sectionModelsSource = read(
    'packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts',
  );
  const providerMutationHandlersHelper = extractBetween(
    providerCatalogMutationSupportSource,
    'export function buildOpenClawProviderMutationHandlers(args: BuildOpenClawProviderMutationHandlersArgs) {',
    'function buildTranslatedProviderErrorMessage(args: {',
  );
  const providerMutationHandlers = extractBetween(
    detailSource,
    '  const providerMutationHandlers = buildOpenClawProviderMutationHandlers({',
    '  const runAgentSkillMutation = ',
  );
  const providerConfigHandler = extractBetween(
    providerMutationHandlersHelper,
    '    onSaveProviderConfig: async () =>',
    '    onSubmitProviderDialog: async () =>',
  );
  const providerDialogStateHandlers = extractBetween(
    detailSource,
    '  const providerDialogStateHandlers = buildLlmProviderDialogStateHandlers({',
    '  const runProviderCatalogMutation = ',
  );
  const providerDialogHandler = extractBetween(
    providerMutationHandlersHelper,
    '    onSubmitProviderDialog: async () =>',
    '    onSubmitProviderModelDialog: async () =>',
  );
  const providerModelDialogHandler = extractBetween(
    providerMutationHandlersHelper,
    '    onSubmitProviderModelDialog: async () =>',
    '    onDeleteProviderModel: async () =>',
  );
  const providerModelDeleteHandler = extractBetween(
    providerMutationHandlersHelper,
    '    onDeleteProviderModel: async () =>',
    '    onDeleteProvider: async () =>',
  );
  const providerDeleteHandler = extractBetween(
    providerMutationHandlersHelper,
    '    onDeleteProvider: async () =>',
    '  };',
  );
  const providerDialogPresentation = extractBetween(
    derivedStateSource,
    '    providerDialogPresentation: buildOpenClawProviderDialogPresentation({',
    '    availableAgentModelOptions:',
  );
  const providerCatalogRunner = extractBetween(
    detailSource,
    '  const runProviderCatalogMutation = ',
    '  const providerMutationHandlers = buildOpenClawProviderMutationHandlers({',
  );
  const llmProviderSectionProps = extractBetween(
    detailSource,
    '  const llmProviderSectionProps = buildLlmProviderSectionProps({',
    '  const llmProviderDialogProps = buildLlmProviderDialogProps({',
  );
  const llmProviderSectionHelper = extractBetween(
    sectionModelsSource,
    'export function buildLlmProviderSectionProps({',
    'export function buildLlmProviderDialogStateHandlers({',
  );

  assert.ok(
    exists('packages/sdkwork-claw-instances/src/services/openClawProviderCatalogMutationSupport.ts'),
  );
  assert.ok(
    exists('packages/sdkwork-claw-instances/src/services/instanceDetailProviderCatalogMutationSupport.ts'),
  );
  assert.match(servicesIndexSource, /instanceDetailProviderCatalogMutationSupport/);
  assert.doesNotMatch(detailSource, /const completeProviderCatalogMutation = async/);
  assert.doesNotMatch(detailSource, /const resetProviderDialogDraft = \(\) => \{/);
  assert.doesNotMatch(detailSource, /const resetProviderModelDialogDraft = \(\) => \{/);
  assert.doesNotMatch(detailSource, /const dismissProviderDialog = \(\) => \{/);
  assert.doesNotMatch(detailSource, /const dismissProviderModelDialog = \(\) => \{/);
  assert.doesNotMatch(detailSource, /const handleSaveProviderConfig = async \(\) => \{/);
  assert.doesNotMatch(detailSource, /const handleSubmitProviderDialog = async \(\) => \{/);
  assert.doesNotMatch(detailSource, /const handleSubmitProviderModelDialog = async \(\) => \{/);
  assert.doesNotMatch(detailSource, /const handleDeleteProviderModel = async \(\) => \{/);
  assert.doesNotMatch(detailSource, /const handleDeleteProvider = async \(\) => \{/);
  assert.match(
    detailSource,
    /const providerMutationHandlers = buildOpenClawProviderMutationHandlers\(\{/,
  );
  assert.match(providerMutationHandlersHelper, /runOpenClawProviderCatalogMutationBuildResult/);
  assert.doesNotMatch(detailSource, /const handleProviderFieldChange = \(/);
  assert.doesNotMatch(detailSource, /const handleProviderConfigChange = \(/);
  assert.doesNotMatch(detailSource, /const handleProviderRequestOverridesChange = \(value: string\) => \{/);
  assert.doesNotMatch(detailSource, /const handleResetProviderDraft = \(\) => \{/);
  assert.doesNotMatch(detailSource, /const providerDialogModels = useMemo\(/);
  assert.doesNotMatch(detailSource, /const providerDialogRequestParseError = useMemo\(/);
  assert.doesNotMatch(detailSource, /parseOpenClawProviderModelsText/);
  assert.doesNotMatch(detailSource, /parseOpenClawProviderRequestOverridesDraft/);
  assert.match(providerDialogPresentation, /buildOpenClawProviderDialogPresentation\(\{/);
  assert.match(providerDialogPresentation, /draft: providerDialogDraft/);
  assert.match(providerDialogPresentation, /t,/);
  assert.match(
    detailSource,
    /const providerCatalogMutationExecutors = createInstanceDetailProviderCatalogMutationExecutors\(\{\s*instanceService,\s*\}\);/,
  );
  assert.match(providerCatalogRunner, /createOpenClawProviderCatalogMutationRunner\(\{/);
  assert.match(providerCatalogRunner, /\.\.\.providerCatalogMutationExecutors,/);
  assert.match(providerCatalogRunner, /setSelectedProviderId/);
  assert.match(providerConfigHandler, /runOpenClawProviderCatalogMutationBuildResult\(\{/);
  assert.match(providerDialogHandler, /runOpenClawProviderCatalogMutationBuildResult\(\{/);
  assert.match(providerModelDialogHandler, /runOpenClawProviderCatalogMutationBuildResult\(\{/);
  assert.match(providerModelDeleteHandler, /runOpenClawProviderCatalogMutationBuildResult\(\{/);
  assert.match(providerDeleteHandler, /runOpenClawProviderCatalogMutationBuildResult\(\{/);
  assert.doesNotMatch(providerConfigHandler, /mutationRequest\.kind === 'skip'/);
  assert.doesNotMatch(providerDialogHandler, /mutationRequest\.kind === 'skip'/);
  assert.doesNotMatch(providerModelDialogHandler, /mutationRequest\.kind === 'skip'/);
  assert.doesNotMatch(providerConfigHandler, /mutationRequest\.kind === 'error'/);
  assert.doesNotMatch(providerDialogHandler, /mutationRequest\.kind === 'error'/);
  assert.doesNotMatch(providerModelDialogHandler, /mutationRequest\.kind === 'error'/);
  assert.doesNotMatch(providerModelDeleteHandler, /mutationRequest\.kind !== 'mutation'/);
  assert.doesNotMatch(providerDeleteHandler, /mutationRequest\.kind !== 'mutation'/);
  assert.match(providerModelDeleteHandler, /buildOpenClawProviderModelDeleteMutationRequest/);
  assert.match(providerDeleteHandler, /buildOpenClawProviderDeleteMutationRequest/);
  assert.doesNotMatch(providerConfigHandler, /parseOpenClawProviderRequestOverridesDraft/);
  assert.doesNotMatch(providerConfigHandler, /updateInstanceLlmProviderConfig/);
  assert.match(providerConfigHandler, /reportError: args\.reportError/);
  assert.match(providerDialogHandler, /reportError: args\.reportError/);
  assert.match(providerModelDialogHandler, /reportError: args\.reportError/);
  assert.match(providerModelDeleteHandler, /reportError: args\.reportError/);
  assert.match(providerDeleteHandler, /reportError: args\.reportError/);
  assert.doesNotMatch(providerConfigHandler, /toast\.success/);
  assert.match(providerConfigHandler, /buildOpenClawProviderConfigMutationRequest/);
  assert.doesNotMatch(providerConfigHandler, /buildOpenClawProviderConfigSaveInput/);
  assert.doesNotMatch(providerConfigHandler, /buildOpenClawProviderConfigMutationPlan/);
  assert.match(
    providerCatalogRunner,
    /\.\.\.providerCatalogMutationExecutors,/,
  );
  assert.doesNotMatch(
    providerCatalogRunner,
    /executeProviderConfigUpdate: \(instanceId, providerId, providerUpdate\) =>/,
  );
  assert.doesNotMatch(
    providerCatalogRunner,
    /executeProviderCreate: \(instanceId, providerInput, selection\) =>/,
  );
  assert.doesNotMatch(
    providerCatalogRunner,
    /executeProviderModelUpdate: \(instanceId, providerId, originalId, model\) =>/,
  );
  assert.doesNotMatch(
    providerCatalogRunner,
    /executeProviderModelCreate: \(instanceId, providerId, model\) =>/,
  );
  assert.doesNotMatch(
    providerCatalogRunner,
    /executeProviderModelDelete: \(instanceId, providerId, modelId\) =>/,
  );
  assert.doesNotMatch(
    providerCatalogRunner,
    /executeProviderDelete: \(instanceId, providerId\) =>/,
  );
  assert.match(providerCatalogRunner, /reportSuccess: toastReporters\.reportSuccess,/);
  assert.match(
    providerCatalogRunner,
    /reloadWorkbench: workbenchReloadHandlers\.reloadWorkbench,/,
  );
  assert.match(providerMutationHandlers, /executeMutation: runProviderCatalogMutation/);
  assert.match(providerMutationHandlers, /reportError: toastReporters\.reportError,/);
  assert.match(
    providerMutationHandlers,
    /dismissProviderDialog: providerDialogStateHandlers\.dismissProviderDialog/,
  );
  assert.match(
    providerMutationHandlers,
    /dismissProviderModelDialog: providerDialogStateHandlers\.dismissProviderModelDialog/,
  );
  assert.match(llmProviderSectionProps, /setProviderDrafts,/);
  assert.match(llmProviderSectionProps, /setProviderRequestDrafts,/);
  assert.doesNotMatch(llmProviderSectionProps, /onFieldChange: handleProviderFieldChange/);
  assert.doesNotMatch(
    llmProviderSectionProps,
    /onRequestOverridesChange: handleProviderRequestOverridesChange/,
  );
  assert.doesNotMatch(llmProviderSectionProps, /onConfigChange: handleProviderConfigChange/);
  assert.doesNotMatch(llmProviderSectionProps, /onReset: handleResetProviderDraft/);
  assert.match(llmProviderSectionHelper, /applyOpenClawProviderFieldDraftChange/);
  assert.match(llmProviderSectionHelper, /applyOpenClawProviderConfigDraftChange/);
  assert.match(llmProviderSectionHelper, /applyOpenClawProviderRequestDraftChange/);
  assert.match(llmProviderSectionHelper, /createOpenClawProviderConfigDraft\(selectedProvider\)/);
  assert.match(llmProviderSectionHelper, /createOpenClawProviderRequestDraft\(selectedProvider\)/);
  assert.match(llmProviderSectionHelper, /setProviderDrafts\(\(current\) =>/);
  assert.match(llmProviderSectionHelper, /setProviderRequestDrafts\(\(current\) =>/);
  assert.doesNotMatch(llmProviderSectionHelper, /instanceService\./);
  assert.doesNotMatch(llmProviderSectionHelper, /toast\./);
  assert.doesNotMatch(llmProviderSectionHelper, /loadWorkbench\(/);
  assert.doesNotMatch(providerDialogHandler, /completeProviderCatalogMutation/);
  assert.match(providerDialogHandler, /buildOpenClawProviderDialogMutationRequest/);
  assert.match(providerDialogHandler, /afterSuccess: args\.dismissProviderDialog/);
  assert.match(providerDialogHandler, /providerDialogModels/);
  assert.doesNotMatch(providerDialogHandler, /buildOpenClawProviderDialogSaveInput/);
  assert.doesNotMatch(providerDialogHandler, /buildOpenClawProviderDialogMutationPlan/);
  assert.doesNotMatch(providerModelDialogHandler, /completeProviderCatalogMutation/);
  assert.match(providerModelDialogHandler, /buildOpenClawProviderModelMutationRequest/);
  assert.match(providerModelDialogHandler, /afterSuccess: args\.dismissProviderModelDialog/);
  assert.doesNotMatch(providerModelDialogHandler, /buildOpenClawProviderModelDialogSaveInput/);
  assert.doesNotMatch(providerModelDialogHandler, /buildOpenClawProviderModelMutationPlan/);
  assert.doesNotMatch(providerModelDeleteHandler, /toast\.success/);
  assert.doesNotMatch(providerDeleteHandler, /toast\.success/);
  assert.doesNotMatch(providerModelDeleteHandler, /await loadWorkbench/);
  assert.doesNotMatch(providerDeleteHandler, /await loadWorkbench/);
  assert.doesNotMatch(providerModelDeleteHandler, /buildOpenClawProviderModelDeleteMutationPlan/);
  assert.doesNotMatch(providerDeleteHandler, /buildOpenClawProviderDeleteMutationPlan/);
  const providerDeleteStateSupportSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceDetailProviderDeleteStateSupport.ts',
  );
  assert.match(
    detailSource,
    /const providerDeleteStateBindings = createInstanceDetailProviderDeleteStateBindings\(\{\s*setProviderDeleteId,\s*setProviderModelDeleteId,\s*\}\);/s,
  );
  assert.match(providerDialogStateHandlers, /setIsProviderDialogOpen: setIsProviderDialogOpen/);
  assert.match(providerDialogStateHandlers, /setProviderDialogDraft: setProviderDialogDraft/);
  assert.match(
    providerDialogStateHandlers,
    /setIsProviderModelDialogOpen: setIsProviderModelDialogOpen/,
  );
  assert.match(
    providerDialogStateHandlers,
    /setProviderModelDialogDraft: setProviderModelDialogDraft/,
  );
  assert.match(
    providerDialogStateHandlers,
    /setProviderDeleteId: providerDeleteStateBindings\.setProviderDeleteId/,
  );
  assert.match(
    providerDialogStateHandlers,
    /setProviderModelDeleteId: providerDeleteStateBindings\.setProviderModelDeleteId/,
  );
  assert.match(
    detailSource,
    /clearProviderModelDeleteId: providerDeleteStateBindings\.clearProviderModelDeleteId/,
  );
  assert.match(
    detailSource,
    /clearProviderDeleteId: providerDeleteStateBindings\.clearProviderDeleteId/,
  );
  assert.doesNotMatch(
    providerDialogStateHandlers,
    /setProviderDeleteId: \(value\) => setProviderDeleteId\(value\)/,
  );
  assert.doesNotMatch(
    providerDialogStateHandlers,
    /setProviderModelDeleteId: \(value\) => setProviderModelDeleteId\(value\)/,
  );
  assert.doesNotMatch(detailSource, /clearProviderModelDeleteId: \(\) => setProviderModelDeleteId\(null\)/);
  assert.doesNotMatch(detailSource, /clearProviderDeleteId: \(\) => setProviderDeleteId\(null\)/);
  assert.match(
    providerDeleteStateSupportSource,
    /export function createInstanceDetailProviderDeleteStateBindings\(args: \{/,
  );
  assert.match(
    providerDeleteStateSupportSource,
    /setProviderDeleteId: args\.setProviderDeleteId/,
  );
  assert.match(
    providerDeleteStateSupportSource,
    /setProviderModelDeleteId: args\.setProviderModelDeleteId/,
  );
  assert.match(
    providerDeleteStateSupportSource,
    /clearProviderDeleteId: \(\) => args\.setProviderDeleteId\(null\)/,
  );
  assert.match(
    providerDeleteStateSupportSource,
    /clearProviderModelDeleteId: \(\) => args\.setProviderModelDeleteId\(null\)/,
  );
  assert.doesNotMatch(providerDeleteStateSupportSource, /setIsProviderDialogOpen/);
  assert.doesNotMatch(providerDeleteStateSupportSource, /setProviderDialogDraft/);
  assert.doesNotMatch(providerDeleteStateSupportSource, /executeMutation/);
  assert.doesNotMatch(providerDeleteStateSupportSource, /reportError/);
  const providerResetEffect = extractBetween(
    detailSource,
    'applyInstanceDetailInstanceSwitchResetState({',
    'setSelectedWebSearchProviderId,',
  );
  const instanceDetailResetSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceDetailResetState.ts',
  );
  assert.match(
    providerResetEffect,
    /providerDialogResetDrafts: createOpenClawProviderDialogResetDrafts\(\),/,
  );
  assert.match(providerResetEffect, /setIsProviderDialogOpen,/);
  assert.match(providerResetEffect, /setProviderDialogDraft,/);
  assert.match(providerResetEffect, /setProviderRequestDrafts,/);
  assert.match(providerResetEffect, /setIsProviderModelDialogOpen,/);
  assert.match(providerResetEffect, /setProviderModelDialogDraft,/);
  assert.match(providerResetEffect, /setProviderModelDeleteId,/);
  assert.match(providerResetEffect, /setProviderDeleteId,/);
  assert.match(
    instanceDetailResetSource,
    /const providerWorkspaceResetState =\s*createOpenClawProviderWorkspaceResetState\(providerDialogResetDrafts\);/,
  );
  assert.match(
    instanceDetailResetSource,
    /setIsProviderDialogOpen\(providerWorkspaceResetState\.isProviderDialogOpen\);/,
  );
  assert.match(
    instanceDetailResetSource,
    /setProviderDialogDraft\(providerWorkspaceResetState\.providerDialogDraft\);/,
  );
  assert.match(
    instanceDetailResetSource,
    /setProviderRequestDrafts\(providerWorkspaceResetState\.providerRequestDrafts\);/,
  );
  assert.match(
    instanceDetailResetSource,
    /setIsProviderModelDialogOpen\(providerWorkspaceResetState\.isProviderModelDialogOpen\);/,
  );
  assert.match(
    instanceDetailResetSource,
    /setProviderModelDialogDraft\(providerWorkspaceResetState\.providerModelDialogDraft\);/,
  );
  assert.match(
    instanceDetailResetSource,
    /setProviderModelDeleteId\(providerWorkspaceResetState\.providerModelDeleteId\);/,
  );
  assert.match(
    instanceDetailResetSource,
    /setProviderDeleteId\(providerWorkspaceResetState\.providerDeleteId\);/,
  );
  assert.doesNotMatch(detailSource, /createOpenClawProviderWorkspaceResetState/);
  assert.doesNotMatch(instanceDetailResetSource, /setIsProviderDialogOpen\(false\);/);
  assert.doesNotMatch(instanceDetailResetSource, /setProviderRequestDrafts\(\{\}\);/);
  assert.doesNotMatch(instanceDetailResetSource, /setIsProviderModelDialogOpen\(false\);/);
  assert.doesNotMatch(instanceDetailResetSource, /setProviderModelDeleteId\(null\);/);
  assert.doesNotMatch(instanceDetailResetSource, /setProviderDeleteId\(null\);/);
  assert.match(
    detailSource,
    /const \[providerDialogDraft, setProviderDialogDraft\] = useState<OpenClawProviderFormState>\(\s*\(\) =>\s*createOpenClawProviderDialogResetDrafts\(\)\.providerDialogDraft/s,
  );
  assert.match(
    detailSource,
    /const \[providerModelDialogDraft, setProviderModelDialogDraft\] =[\s\S]*?useState<OpenClawProviderModelFormState>\(\s*\(\) =>\s*createOpenClawProviderDialogResetDrafts\(\)\.providerModelDialogDraft/s,
  );
  assert.doesNotMatch(detailSource, /createOpenClawProviderCreateDialogState\(\)/);
  assert.doesNotMatch(detailSource, /createOpenClawProviderModelCreateDialogState\(\)/);
  assert.match(providerCatalogMutationSupportSource, /export function buildOpenClawProviderConfigMutationRequest/);
  assert.match(providerCatalogMutationSupportSource, /export function buildOpenClawProviderDialogMutationRequest/);
  assert.match(providerCatalogMutationSupportSource, /export function buildOpenClawProviderModelMutationRequest/);
  assert.match(providerCatalogMutationSupportSource, /export function buildOpenClawProviderModelDeleteMutationRequest/);
  assert.match(providerCatalogMutationSupportSource, /export function buildOpenClawProviderDeleteMutationRequest/);
  assert.match(
    providerCatalogMutationSupportSource,
    /export async function runOpenClawProviderCatalogMutationBuildResult/,
  );
  assert.match(
    providerCatalogMutationSupportSource,
    /export function buildOpenClawProviderMutationHandlers/,
  );
  assert.match(providerCatalogMutationSupportSource, /export function createOpenClawProviderCatalogMutationRunner/);
  assert.match(providerPresentationSource, /export function buildOpenClawProviderDialogPresentation/);
  assert.match(
    providerPresentationSource,
    /export function createOpenClawProviderWorkspaceResetState\(/,
  );
  assert.match(providerPresentationSource, /parseOpenClawProviderModelsText/);
  assert.match(providerPresentationSource, /parseOpenClawProviderRequestOverridesDraft/);
  assert.doesNotMatch(providerPresentationSource, /instanceService\./);
  assert.doesNotMatch(providerPresentationSource, /toast\./);
  assert.doesNotMatch(providerPresentationSource, /loadWorkbench\(/);
  assert.match(providerCatalogMutationSupportSource, /buildOpenClawProviderConfigSaveInput/);
  assert.match(providerCatalogMutationSupportSource, /buildOpenClawProviderDialogSaveInput/);
  assert.match(providerCatalogMutationSupportSource, /buildOpenClawProviderModelDialogSaveInput/);
  assert.match(providerCatalogMutationSupportSource, /buildOpenClawProviderConfigMutationPlan/);
  assert.match(providerCatalogMutationSupportSource, /buildOpenClawProviderDialogMutationPlan/);
  assert.match(providerCatalogMutationSupportSource, /buildOpenClawProviderModelMutationPlan/);
  assert.match(providerCatalogMutationSupportSource, /buildOpenClawProviderModelDeleteMutationPlan/);
  assert.match(providerCatalogMutationSupportSource, /buildOpenClawProviderDeleteMutationPlan/);
  assert.doesNotMatch(providerCatalogMutationSupportSource, /instanceService\./);
  assert.doesNotMatch(providerCatalogMutationSupportSource, /toast\./);
  assert.doesNotMatch(providerCatalogMutationSupportSource, /await loadWorkbench\(/);
  assert.match(
    providerCatalogExecutorSupportSource,
    /export function createInstanceDetailProviderCatalogMutationExecutors/,
  );
  assert.doesNotMatch(providerCatalogExecutorSupportSource, /toast\./);
  assert.doesNotMatch(providerCatalogExecutorSupportSource, /navigate\(/);
  assert.doesNotMatch(providerCatalogExecutorSupportSource, /loadWorkbench\(/);

  assert.match(providerDraftSource, /kind:\s*'providerConfigUpdate'/);
  assert.match(providerDraftSource, /kind:\s*'providerCreate'/);
  assert.match(providerDraftSource, /kind:\s*'providerModelCreate'/);
  assert.match(providerDraftSource, /kind:\s*'providerModelUpdate'/);
  assert.match(providerDraftSource, /kind:\s*'providerModelDelete'/);
  assert.match(providerDraftSource, /kind:\s*'providerDelete'/);
  assert.match(providerDraftSource, /export function createOpenClawProviderConfigDraft/);
  assert.match(providerDraftSource, /export function createOpenClawProviderRequestDraft/);
  assert.match(providerDraftSource, /export function hasPendingOpenClawProviderConfigChanges/);
  assert.match(providerDraftSource, /export function applyOpenClawProviderFieldDraftChange/);
  assert.match(providerDraftSource, /export function applyOpenClawProviderConfigDraftChange/);
  assert.match(providerDraftSource, /export function applyOpenClawProviderRequestDraftChange/);
  assert.match(sectionModelsSource, /export function buildLlmProviderDialogStateHandlers\(/);

  assert.doesNotMatch(detailSource, /instanceService\.updateInstanceLlmProviderConfig\(/);
  assert.doesNotMatch(detailSource, /instanceService\.createInstanceLlmProvider\(/);
  assert.doesNotMatch(detailSource, /instanceService\.createInstanceLlmProviderModel\(/);
  assert.doesNotMatch(detailSource, /instanceService\.updateInstanceLlmProviderModel\(/);
  assert.doesNotMatch(detailSource, /instanceService\.deleteInstanceLlmProviderModel\(/);
  assert.doesNotMatch(detailSource, /instanceService\.deleteInstanceLlmProvider\(/);
  assert.match(derivedStateSource, /buildOpenClawProviderSelectionState\(/);
  assert.match(
    detailSource,
    /onSave: providerMutationHandlers\.onSaveProviderConfig/,
  );
  assert.match(
    detailSource,
    /onSubmitProviderDialog: providerMutationHandlers\.onSubmitProviderDialog/,
  );
  assert.match(
    detailSource,
    /onSubmitProviderModelDialog: providerMutationHandlers\.onSubmitProviderModelDialog/,
  );
  assert.match(detailSource, /onDeleteProvider: providerMutationHandlers\.onDeleteProvider/);
  assert.match(
    detailSource,
    /onDeleteProviderModel: providerMutationHandlers\.onDeleteProviderModel/,
  );
  assert.doesNotMatch(detailSource, /hasPendingOpenClawProviderConfigChanges\(\{/);
  assert.match(
    detailSource,
    /onProviderDialogOpenChange: providerDialogStateHandlers\.onProviderDialogOpenChange/,
  );
  assert.match(
    detailSource,
    /onProviderModelDialogOpenChange: providerDialogStateHandlers\.onProviderModelDialogOpenChange/,
  );
  assert.match(
    detailSource,
    /onProviderDeleteDialogOpenChange: providerDialogStateHandlers\.onProviderDeleteDialogOpenChange/,
  );
  assert.match(
    detailSource,
    /onProviderModelDeleteDialogOpenChange:\s*providerDialogStateHandlers\.onProviderModelDeleteDialogOpenChange/,
  );
  assert.doesNotMatch(detailSource, /onResetProviderDialogDraft=/);
  assert.doesNotMatch(detailSource, /onResetProviderModelDialogDraft=/);
  assert.doesNotMatch(detailSource, /onDismissProviderDeleteDialog=/);
  assert.doesNotMatch(detailSource, /onDismissProviderModelDeleteDialog=/);
  assert.doesNotMatch(detailSource, /onProviderDialogOpenChange: setIsProviderDialogOpen/);
  assert.doesNotMatch(detailSource, /onProviderModelDialogOpenChange: setIsProviderModelDialogOpen/);
});

runTest('sdkwork-claw-instances routes OpenClaw task normalization through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/services/openClawTaskNormalization.ts'));
  assert.match(instanceWorkbenchServiceCoreSource, /from '\.\/openClawTaskNormalization\.ts'/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isWorkbenchTaskScheduleMode\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isWorkbenchTaskActionType\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isWorkbenchTaskStatus\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isWorkbenchTaskSessionMode\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isWorkbenchTaskWakeUpMode\(/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function isWorkbenchTaskExecutionContent\(/,
  );
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isWorkbenchTaskDeliveryMode\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isWorkbenchTaskThinking\(/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function isWorkbenchTaskExecutionStatus\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function isWorkbenchTaskExecutionTrigger\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function normalizeWorkbenchTaskExecution\(/,
  );
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function normalizeWorkbenchTask\(/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function normalizeWorkbenchTaskCollection\(/,
  );
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function cloneWorkbenchTask\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mergeWorkbenchTasks\(/);
});

runTest('sdkwork-claw-instances routes OpenClaw runtime memory summarization through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/services/openClawRuntimeMemorySupport.ts'));
  assert.match(instanceWorkbenchServiceCoreSource, /from '\.\/openClawRuntimeMemorySupport\.ts'/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function getPathLeaf\(/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function inferRuntimeMemoryEntryType\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function inferRuntimeMemoryEntrySource\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function extractRuntimeMemorySnippet\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function formatRuntimeMemoryLineRange\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function extractDreamDiaryContent\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function buildOpenClawRuntimeMemories\(/,
  );
});

runTest('sdkwork-claw-instances routes OpenClaw channel workbench shaping through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );
  const snapshotSupportSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts',
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/services/openClawChannelWorkbenchSupport.ts'));
  assert.match(instanceWorkbenchServiceCoreSource, /from '\.\/instanceWorkbenchSnapshotSupport\.ts'/);
  assert.match(snapshotSupportSource, /from '\.\/openClawChannelWorkbenchSupport\.ts'/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mapConfigChannel\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function cloneConfigChannel\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function cloneWorkbenchChannel\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isConfiguredValue\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function normalizeChannelConnectionStatus\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function formatChannelAccountState\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildOpenClawChannelAccounts\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildOpenClawChannels\(/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function mapOpenClawChannelDefinition\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function mergeOpenClawChannelCollections\(/,
  );
});

runTest('sdkwork-claw-instances routes OpenClaw agent workbench shaping through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );

  assert.ok(exists('packages/sdkwork-claw-instances/src/services/openClawAgentWorkbenchSupport.ts'));
  assert.match(instanceWorkbenchServiceCoreSource, /from '\.\/openClawAgentWorkbenchSupport\.ts'/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function clampScore\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function deriveFocusAreas\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mapAgent\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mapConfigBackedAgent\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function cloneWorkbenchAgent\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function normalizeWorkbenchAgent\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mergeWorkbenchAgents\(/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function mergeOpenClawAgentCollections\(/,
  );
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildManagedOpenClawAgents\(/);
});

runTest('sdkwork-claw-instances routes OpenClaw config workbench shaping through the standard helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

  assert.ok(
    exists('packages/sdkwork-claw-instances/src/services/openClawConfigWorkbenchSupport.ts'),
  );
  assert.equal(
    exists('packages/sdkwork-claw-instances/src/services/openClawManagedConfigWorkbenchSupport.ts'),
    false,
  );
  assert.match(
    instanceWorkbenchServiceCoreSource,
    /from '\.\/openClawConfigWorkbenchSupport\.ts'/,
  );
  assert.match(servicesIndexSource, /openClawConfigWorkbenchSupport/);
  assert.doesNotMatch(servicesIndexSource, /openClawManagedConfigWorkbenchSupport/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function createEmptyOpenClawConfigSnapshot\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function buildConfigSectionCount\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function buildKernelConfigInsights\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function cloneManagedWebSearchConfig\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function cloneManagedXSearchConfig\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function cloneManagedWebSearchNativeCodexConfig\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function cloneManagedWebFetchConfig\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function cloneManagedAuthCooldownsConfig\(/,
  );
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function cloneManagedDreamingConfig\(/,
  );
});

runTest('sdkwork-claw-instances routes OpenClaw provider workbench shaping through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

  assert.ok(
    exists('packages/sdkwork-claw-instances/src/services/openClawProviderWorkbenchSupport.ts'),
  );
  assert.match(
    instanceWorkbenchServiceCoreSource,
    /from '\.\/openClawProviderWorkbenchSupport\.ts'/,
  );
  assert.match(servicesIndexSource, /openClawProviderWorkbenchSupport/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mapConfigBackedProvider\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mapLlmProvider\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function providerMatchesId\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildOpenClawLlmProviders\(/);
});

runTest('sdkwork-claw-instances routes OpenClaw skill workbench shaping through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

  assert.ok(
    exists('packages/sdkwork-claw-instances/src/services/openClawSkillWorkbenchSupport.ts'),
  );
  assert.match(
    instanceWorkbenchServiceCoreSource,
    /from '\.\/openClawSkillWorkbenchSupport\.ts'/,
  );
  assert.match(servicesIndexSource, /openClawSkillWorkbenchSupport/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function inferSkillCategory\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildOpenClawSkills\(/);
});

runTest('sdkwork-claw-instances routes OpenClaw tool workbench shaping through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

  assert.ok(
    exists('packages/sdkwork-claw-instances/src/services/openClawToolWorkbenchSupport.ts'),
  );
  assert.match(
    instanceWorkbenchServiceCoreSource,
    /from '\.\/openClawToolWorkbenchSupport\.ts'/,
  );
  assert.match(servicesIndexSource, /openClawToolWorkbenchSupport/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function inferToolCategory\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function inferToolAccess\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mergeUniqueValues\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mergeToolStatus\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildOpenClawTools\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildOpenClawScopedTools\(/);
});

runTest('sdkwork-claw-instances routes OpenClaw file workbench shaping through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

  assert.ok(
    exists('packages/sdkwork-claw-instances/src/services/openClawFileWorkbenchSupport.ts'),
  );
  assert.match(
    instanceWorkbenchServiceCoreSource,
    /from '\.\/openClawFileWorkbenchSupport\.ts'/,
  );
  assert.match(servicesIndexSource, /openClawFileWorkbenchSupport/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function inferOpenClawFileCategory\(/);
  assert.doesNotMatch(
    instanceWorkbenchServiceCoreSource,
    /function mapOpenClawFileEntryToWorkbenchFile\(/,
  );
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mergeOpenClawFileCollections\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildOpenClawMemories\(/);
});

runTest(
  'sdkwork-claw-instances keys shared workbench file-content loading off gateway transport facts instead of the OpenClaw kernel id',
  () => {
    const fileWorkbenchSource = read(
      'packages/sdkwork-claw-instances/src/services/instanceFileWorkbench.ts',
    );

    assert.match(fileWorkbenchSource, /input\.transportKind === 'openclawGatewayWs'/);
    assert.match(fileWorkbenchSource, /!input\.isBuiltIn/);
    assert.doesNotMatch(fileWorkbenchSource, /input\.runtimeKind === 'openclaw'/);
  },
);

runTest('sdkwork-claw-instances routes registry-backed detail projection through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');
  const registryWorkbenchSupportSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceRegistryWorkbenchSupport.ts',
  );

  assert.ok(
    exists('packages/sdkwork-claw-instances/src/services/instanceRegistryWorkbenchSupport.ts'),
  );
  assert.match(
    instanceWorkbenchServiceCoreSource,
    /from '\.\/instanceRegistryWorkbenchSupport\.ts'/,
  );
  assert.match(servicesIndexSource, /instanceRegistryWorkbenchSupport/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildRegistryBackedDetail\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function resolveRegistryRuntimeKind\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function resolveRegistryDeploymentMode\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function resolveRegistryTransportKind\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function resolveRegistryStorageBinding\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function storageCapabilitiesForProvider\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function resolveRegistryStorageStatus\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function resolveRegistryLifecycleOwner\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function defaultCapabilitiesForRuntime\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildRegistryConnectivityEndpoints\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function isLoopbackHost\(/);
  assert.match(registryWorkbenchSupportSource, /function inferRuntimeKindFromType\(/);
  assert.match(registryWorkbenchSupportSource, /compactType\.match\(\/\(\[a-z0-9\]\+claw\|hermes\)\//);
  assert.match(registryWorkbenchSupportSource, /if \(hasWebsocketUrl && !hasBaseUrl\) \{/);
  assert.match(registryWorkbenchSupportSource, /return 'customWs';/);
});

runTest('sdkwork-claw-instances routes workbench snapshot assembly through a shared helper', () => {
  const instanceWorkbenchServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts',
  );
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

  assert.ok(
    exists('packages/sdkwork-claw-instances/src/services/instanceWorkbenchSnapshotSupport.ts'),
  );
  assert.match(
    instanceWorkbenchServiceCoreSource,
    /from '\.\/instanceWorkbenchSnapshotSupport\.ts'/,
  );
  assert.match(servicesIndexSource, /instanceWorkbenchSnapshotSupport/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mapBackendWorkbench\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mapStudioInstance\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mapStudioConfig\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function getCapabilityMap\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function resolveCapabilityAvailability\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildSectionAvailability\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function countOverviewEntries\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildOpenClawSectionCounts\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildOpenClawSnapshotFromSections\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function mergeOpenClawSnapshots\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function finalizeOpenClawSnapshot\(/);
  assert.doesNotMatch(instanceWorkbenchServiceCoreSource, /function buildDetailOnlyWorkbenchSnapshot\(/);
});

runTest('sdkwork-claw-instances keeps direct InstanceDetail i18n keys mapped in both locale bundles', () => {
  const detailSource = readInstanceDetailPageSources();
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const directKeys = [...detailSource.matchAll(/\bt\('([^']+)'\)/g)].map((match) => match[1]);
  const uniqueKeys = [...new Set(directKeys)].sort();

  const missingKeys = uniqueKeys.filter(
    (key) => getLocaleValue(enLocale, key) === undefined || getLocaleValue(zhLocale, key) === undefined,
  );

  assert.deepEqual(missingKeys, []);
});

runTest('sdkwork-claw-instances labels instance-detail channels as chat channels across split and aggregate locales', () => {
  const enLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/en.json');
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const enInstancesLocale = readJson<Record<string, unknown>>(
    'packages/sdkwork-claw-i18n/src/locales/en/instances.json',
  );
  const zhInstancesLocale = readJson<Record<string, unknown>>(
    'packages/sdkwork-claw-i18n/src/locales/zh/instances.json',
  );

  assert.equal(
    getLocaleValue(enInstancesLocale, 'detail.instanceWorkbench.sidebar.channels'),
    'Chat Channels',
  );
  assert.equal(
    getLocaleValue(zhInstancesLocale, 'detail.instanceWorkbench.sidebar.channels'),
    '聊天通道',
  );
  assert.equal(
    getLocaleValue(enInstancesLocale, 'detail.instanceWorkbench.sections.channels.title'),
    'Chat Channels',
  );
  assert.equal(
    getLocaleValue(zhInstancesLocale, 'detail.instanceWorkbench.sections.channels.title'),
    '聊天通道',
  );

  assert.equal(
    getLocaleValue(enLocale, 'instances.detail.instanceWorkbench.sidebar.channels'),
    getLocaleValue(enInstancesLocale, 'detail.instanceWorkbench.sidebar.channels'),
  );
  assert.equal(
    getLocaleValue(zhLocale, 'instances.detail.instanceWorkbench.sidebar.channels'),
    getLocaleValue(zhInstancesLocale, 'detail.instanceWorkbench.sidebar.channels'),
  );
  assert.equal(
    getLocaleValue(enLocale, 'instances.detail.instanceWorkbench.sections.channels.title'),
    getLocaleValue(enInstancesLocale, 'detail.instanceWorkbench.sections.channels.title'),
  );
  assert.equal(
    getLocaleValue(zhLocale, 'instances.detail.instanceWorkbench.sections.channels.title'),
    getLocaleValue(zhInstancesLocale, 'detail.instanceWorkbench.sections.channels.title'),
  );
});

runTest('sdkwork-claw-instances config workbench editor source avoids mojibake fallback copy', () => {
  const editorSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigSchemaSectionEditor.tsx',
  );
  const zhLocale = readJson<Record<string, unknown>>('packages/sdkwork-claw-i18n/src/locales/zh.json');
  const fallbackEntries = new Map(
    [
      ...editorSource.matchAll(
        /(?:params|props)\.t\('([^']*schemaEditor[^']*)', '([^']+)', '([^']+)'/g,
      ),
    ].map((match) => [
      match[1],
      {
        en: match[2],
        zhFallback: match[3],
      },
    ]),
  );

  const expectedLocaleKeys = [
    'instances.detail.instanceWorkbench.config.schemaEditor.hideValue',
    'instances.detail.instanceWorkbench.config.schemaEditor.revealValue',
    'instances.detail.instanceWorkbench.config.schemaEditor.notSet',
    'instances.detail.instanceWorkbench.config.schemaEditor.unsupportedArraySchema',
    'instances.detail.instanceWorkbench.config.schemaEditor.itemCount',
    'instances.detail.instanceWorkbench.config.schemaEditor.addItem',
    'instances.detail.instanceWorkbench.config.schemaEditor.noItemsYet',
    'instances.detail.instanceWorkbench.config.schemaEditor.noArrayItemsMatchSearch',
    'instances.detail.instanceWorkbench.config.schemaEditor.itemLabel',
    'instances.detail.instanceWorkbench.config.schemaEditor.removeItem',
    'instances.detail.instanceWorkbench.config.schemaEditor.customEntries',
    'instances.detail.instanceWorkbench.config.schemaEditor.customEntriesDescription',
    'instances.detail.instanceWorkbench.config.schemaEditor.addEntry',
    'instances.detail.instanceWorkbench.config.schemaEditor.noCustomEntriesYet',
    'instances.detail.instanceWorkbench.config.schemaEditor.noCustomEntriesMatchSearch',
    'instances.detail.instanceWorkbench.config.schemaEditor.removeEntry',
    'instances.detail.instanceWorkbench.config.schemaEditor.noConfiguredFieldsYet',
    'instances.detail.instanceWorkbench.config.schemaEditor.saferInRawMode',
    'instances.detail.instanceWorkbench.config.schemaEditor.schemaUnavailable',
    'instances.detail.instanceWorkbench.config.schemaEditor.invalidDraftForConfigMode',
    'instances.detail.instanceWorkbench.config.schemaEditor.dynamicPathsUseRawMode',
    'instances.detail.instanceWorkbench.config.schemaEditor.hiddenSensitiveValues',
    'instances.detail.instanceWorkbench.config.schemaEditor.noSettingsMatchSearch',
    'instances.detail.instanceWorkbench.config.schemaEditor.noSettingsAvailable',
  ];

  assert.doesNotMatch(editorSource, /(?:params|props)\.t\('',/);
  assert.doesNotMatch(editorSource, /[\p{Script=Han}]/u);
  for (const key of expectedLocaleKeys) {
    const entry = fallbackEntries.get(key);
    assert.ok(entry, `missing schemaEditor keyed fallback for ${key}`);
    assert.equal(entry.en, entry.zhFallback);

    const localeValue = getLocaleValue(zhLocale, key);
    assert.equal(typeof localeValue, 'string');
    assert.match(String(localeValue), /[\p{Script=Han}]/u);
    assert.doesNotMatch(String(localeValue), /\?{2,}|^\?/);
  }
});

runTest('sdkwork-claw-instances config workbench panel keeps clean fallback copy without runtime mojibake guards', () => {
  const panelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx',
  );
  const fallbackEntries = [...panelSource.matchAll(/\btr\('', '([^']+)', '([^']+)'/g)].map((match) => ({
    en: match[1],
    zh: match[2],
  }));

  assert.doesNotMatch(panelSource, /GARBLED_ZH_FALLBACK_PATTERN/);
  assert.doesNotMatch(panelSource, /resolveDefaultValue/);

  fallbackEntries.forEach(({ en, zh }) => {
    const isExplicitEnglishCarryover = zh === en || zh === 'Raw';
    const hasChineseCopy = /[\u4e00-\u9fff]/.test(zh);

    assert.ok(
      isExplicitEnglishCarryover || hasChineseCopy,
      `Expected clean zh fallback copy for "${en}", received "${zh}"`,
    );
  });
});

runTest('sdkwork-claw-instances raw config editor avoids strict JSON validation and calls out JSON5 support', () => {
  const rawPanelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchRawPanel.tsx',
  );

  assert.match(rawPanelSource, /jsonDefaults\.setDiagnosticsOptions\(\{\s*validate:\s*false\s*\}\)/);
  assert.match(rawPanelSource, /Raw config \(JSON\/JSON5\)/);
});

runTest('sdkwork-claw-instances raw config editor protects sensitive values until explicitly revealed', () => {
  const rawPanelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchRawPanel.tsx',
  );

  assert.match(rawPanelSource, /rawSensitiveVisible/);
  assert.match(rawPanelSource, /Hidden until you reveal sensitive values\./);
  assert.match(rawPanelSource, /Use reveal to inspect and edit the raw config\./);
});

runTest('sdkwork-claw-instances config workbench exposes a root settings overview before section detail', () => {
  const panelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx',
  );
  const overviewSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchOverview.tsx',
  );
  const presentationSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceConfigWorkbenchPresentation.ts',
  );

  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.navigation\.settingsTab/);
  assert.match(panelSource, /setActiveSectionKey\(null\)/);
  assert.match(panelSource, /InstanceConfigWorkbenchOverview/);
  assert.match(panelSource, /buildInstanceConfigOverviewMetrics/);
  assert.match(panelSource, /groupInstanceConfigSectionsByCategory/);
  assert.match(panelSource, /model\.sections\.filter\(\(section\) => !schemaSectionByKey\.has\(section\.key\)\)/);
  assert.match(overviewSource, /OpenClaw config overview/);
  assert.match(overviewSource, /Review section groups and jump into a specific area before editing\./);
  assert.match(overviewSource, /category\.sectionLabels\.map\(\(label\) => \(/);
  assert.match(presentationSource, /groupInstanceConfigSectionsByCategory/);
  assert.match(presentationSource, /buildInstanceConfigOverviewMetrics/);
  assert.match(panelSource, /computeInstanceConfigWorkbenchDiff\(/);
  assert.match(panelSource, /Custom sections/);
  assert.match(panelSource, /Raw lines/);
});

runTest('sdkwork-claw-instances config workbench keeps control-ui style config actions and status coverage', () => {
  const panelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx',
  );
  const navigationSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchConfigNavigation.tsx',
  );
  const toolbarSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchToolbar.tsx',
  );
  const diffSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchDiffPanel.tsx',
  );
  const serviceSource = [
    read('packages/sdkwork-claw-instances/src/services/instanceService.ts'),
    read('packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts'),
  ].join('\n');
  const servicesIndexSource = read('packages/sdkwork-claw-instances/src/services/index.ts');

  assert.match(panelSource, /InstanceConfigWorkbenchToolbar/);
  assert.match(panelSource, /InstanceConfigWorkbenchDiffPanel/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.open/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.apply/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.update/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.noChanges/);
  assert.match(navigationSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.navigation\.invalidDraft/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.metrics\.formCoverage/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.metrics\.schemaVersion/);
  assert.match(panelSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.metrics\.schemaGenerated/);
  assert.match(toolbarSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.toolbar\.rawOnlyPaths/);
  assert.match(diffSource, /instances\.detail\.instanceWorkbench\.config\.workbench\.diff\.title/);
  assert.match(diffSource, /formatDiffValuePreviewWithHints\(/);
  assert.match(diffSource, /countSensitiveConfigValues\(value, pathSegments, uiHints\) > 0/);
  assert.match(diffSource, /setActiveSectionKey\(entry\.sectionKey\)/);
  assert.match(diffSource, /availableSectionKeys\.has\(entry\.sectionKey\)/);
  assert.match(diffSource, /setActiveMode\('raw'\)/);

  assert.match(panelSource, /type OpenClawConfigSchemaSnapshot/);
  assert.match(panelSource, /instanceService\.getOpenClawConfigDocument\(props\.instanceId\)/);
  assert.match(panelSource, /instanceService\.getOpenClawConfigSchema\(props\.instanceId\)/);
  assert.match(panelSource, /instanceService\.updateOpenClawConfigDocument\(props\.instanceId, rawDraft\)/);
  assert.match(panelSource, /instanceService\.openClawConfigFile\(props\.instanceId\)/);
  assert.match(panelSource, /instanceService\.applyOpenClawConfigDocument\(props\.instanceId, rawDraft\)/);
  assert.match(panelSource, /instanceService\.runOpenClawUpdate\(props\.instanceId\)/);
  assert.doesNotMatch(panelSource, /ManagedOpenClawConfigSchemaSnapshot/);
  assert.doesNotMatch(panelSource, /getManagedOpenClawConfigDocument/);
  assert.doesNotMatch(panelSource, /getManagedOpenClawConfigSchema/);
  assert.doesNotMatch(panelSource, /updateManagedOpenClawConfigDocument/);
  assert.doesNotMatch(panelSource, /openManagedOpenClawConfigFile/);
  assert.doesNotMatch(panelSource, /applyManagedOpenClawConfigDocument/);
  assert.doesNotMatch(panelSource, /runManagedOpenClawUpdate/);

  assert.match(serviceSource, /OpenClawConfigSchemaSnapshot/);
  assert.match(serviceSource, /getOpenClawConfigDocument/);
  assert.match(serviceSource, /updateOpenClawConfigDocument/);
  assert.match(serviceSource, /getOpenClawConfigSchema/);
  assert.match(serviceSource, /openClawConfigFile/);
  assert.match(serviceSource, /applyOpenClawConfigDocument/);
  assert.match(serviceSource, /runOpenClawUpdate/);
  assert.match(serviceSource, /openClawGatewayClient\.openConfigFile/);
  assert.match(serviceSource, /openClawGatewayClient\.applyConfig/);
  assert.match(serviceSource, /openClawGatewayClient\.runUpdate/);
  assert.doesNotMatch(serviceSource, /ManagedOpenClawConfigSchemaSnapshot/);
  assert.doesNotMatch(serviceSource, /getManagedOpenClawConfigDocument/);
  assert.doesNotMatch(serviceSource, /updateManagedOpenClawConfigDocument/);
  assert.doesNotMatch(serviceSource, /getManagedOpenClawConfigSchema/);
  assert.doesNotMatch(serviceSource, /openManagedOpenClawConfigFile/);
  assert.doesNotMatch(serviceSource, /applyManagedOpenClawConfigDocument/);
  assert.doesNotMatch(serviceSource, /runManagedOpenClawUpdate/);
  assert.match(servicesIndexSource, /instanceConfigWorkbenchPresentation/);
});

runTest('sdkwork-claw-instances config workbench keeps navigation, section hero, and raw editor in dedicated focused components', () => {
  const panelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchPanel.tsx',
  );
  const navigationSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchConfigNavigation.tsx',
  );
  const heroSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchSectionHero.tsx',
  );
  const rawPanelSource = read(
    'packages/sdkwork-claw-instances/src/components/InstanceConfigWorkbenchRawPanel.tsx',
  );

  assert.match(panelSource, /InstanceConfigWorkbenchConfigNavigation/);
  assert.match(panelSource, /InstanceConfigWorkbenchSectionHero/);
  assert.match(panelSource, /InstanceConfigWorkbenchRawPanel/);
  assert.doesNotMatch(panelSource, /Search settings\.\.\./);
  assert.doesNotMatch(panelSource, /The current draft is invalid JSON5\./);
  assert.doesNotMatch(panelSource, /Hidden until you reveal sensitive values\./);
  assert.match(navigationSource, /Search settings\.\.\./);
  assert.match(navigationSource, /The current draft is invalid JSON5\./);
  assert.match(navigationSource, /Open Raw/);
  assert.match(navigationSource, /Dismiss/);
  assert.match(heroSource, /Config section/);
  assert.match(heroSource, /Custom section/);
  assert.match(heroSource, /Hide sensitive values/);
  assert.match(heroSource, /Reveal sensitive values/);
  assert.match(rawPanelSource, /Raw config \(JSON\/JSON5\)/);
  assert.match(rawPanelSource, /Hidden until you reveal sensitive values\./);
  assert.match(rawPanelSource, /Use reveal to inspect and edit the raw config\./);
  assert.match(rawPanelSource, /MonacoEditor/);
});

runTest('sdkwork-claw-instances test narratives use OpenClaw config file wording instead of legacy config file wording', () => {
  const testSource = readSources([
    'packages/sdkwork-claw-instances/src/services/agentSkillManagementService.test.ts',
    'packages/sdkwork-claw-instances/src/services/instanceManagementPresentation.test.ts',
    'packages/sdkwork-claw-instances/src/services/instanceService.test.ts',
    'packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts',
    'packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts',
    'packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts',
  ]);

  assert.doesNotMatch(testSource, /Managed config file/);
  assert.doesNotMatch(testSource, /managed config file path/);
  assert.doesNotMatch(testSource, /Writable managed config file\./);
  assert.doesNotMatch(testSource, /no managed config file is attached/);
});

runTest('OpenClaw test fixtures use the canonical user-root config path outside explicit legacy compatibility cases', () => {
  const testSource = readSources([
    'packages/sdkwork-claw-types/src/kernelModel.test.ts',
    'packages/sdkwork-claw-settings/src/services/kernelCenterService.test.ts',
    'packages/sdkwork-claw-instances/src/services/agentWorkbenchService.test.ts',
    'packages/sdkwork-claw-instances/src/services/instanceConfigWorkbench.test.ts',
    'packages/sdkwork-claw-instances/src/services/instanceManagementPresentation.test.ts',
    'packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts',
    'packages/sdkwork-claw-instances/src/services/kernelConfigProjection.test.ts',
    'packages/sdkwork-claw-channels/src/services/channelService.test.ts',
    'packages/sdkwork-claw-instances/src/services/kernelConfigPathFallback.test.ts',
    'packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts',
    'packages/sdkwork-claw-core/src/services/kernelPlatformService.test.ts',
    'packages/sdkwork-claw-core/src/services/openClawMirrorService.test.ts',
    'packages/sdkwork-claw-instances/src/components/InstanceDetailSectionContent.test.tsx',
    'packages/sdkwork-claw-infrastructure/src/platform/registry.test.ts',
  ]);

  assert.match(testSource, /\.openclaw\/openclaw\.json/);
  assert.doesNotMatch(
    testSource,
    /(?:[A-Za-z]:\/Users\/admin|\/home\/admin)\/\.sdkwork\/crawstudio\/\.openclaw\/openclaw\.json/,
  );
});

runTest('sdkwork-claw-core OpenClaw config tests avoid managed-config helper naming outside explicit legacy paths', () => {
  const testSource = read('packages/sdkwork-claw-core/src/services/openClawConfigService.test.ts');

  assert.doesNotMatch(testSource, /createInstanceDetailWithManagedConfig/);
  assert.doesNotMatch(testSource, /createBuiltInManagedOpenClawDetailWithLegacyConfigPath/);
  assert.doesNotMatch(testSource, /Managed OpenClaw workspace directory\./);
});
