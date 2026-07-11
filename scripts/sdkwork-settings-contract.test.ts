import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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

function readLocale(language: 'en' | 'zh'): Record<string, unknown> {
  const legacyLocalePath = `packages/sdkwork-agentstudio-pc-i18n/src/locales/${language}.json`;

  if (exists(legacyLocalePath)) {
    return readJson<Record<string, unknown>>(legacyLocalePath);
  }

  const localeDirectory = path.join(root, 'packages', 'sdkwork-agentstudio-pc-i18n', 'src', 'locales', language);
  const localeEntries = fs
    .readdirSync(localeDirectory)
    .filter((entry) => entry.endsWith('.json'))
    .sort();

  return Object.fromEntries(
    localeEntries.map((entry) => [
      path.basename(entry, '.json'),
      JSON.parse(fs.readFileSync(path.join(localeDirectory, entry), 'utf8')),
    ]),
  );
}

function readLocaleSectionSource(language: 'en' | 'zh', section: string) {
  const legacyLocalePath = `packages/sdkwork-agentstudio-pc-i18n/src/locales/${language}.json`;

  if (exists(legacyLocalePath)) {
    return read(legacyLocalePath);
  }

  return read(`packages/sdkwork-agentstudio-pc-i18n/src/locales/${language}/${section}.json`);
}

function getLocaleValue(locale: Record<string, unknown>, key: string) {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, locale);
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

runTest('sdkwork-agentstudio-pc-settings parity checks use the shared Node TypeScript runner for workspace-loaded settings services', () => {
  const workspacePackageJson = read('package.json');
  const settingsCheckRunner = read('scripts/run-sdkwork-settings-check.mjs');
  const nodeTypeScriptRunner = read('scripts/run-node-typescript-check.mjs');

  assert.match(
    workspacePackageJson,
    /"check:sdkwork-settings"\s*:\s*"sdkwork-run-node scripts\/run-sdkwork-settings-check\.mjs"/,
  );
  assert.match(settingsCheckRunner, /runNodeTypeScriptChecks/);
  assert.match(settingsCheckRunner, /kernelCenterView\.test\.ts/);
  assert.match(settingsCheckRunner, /hostRuntimeSettings\.test\.ts/);
  assert.match(settingsCheckRunner, /kernelCenterService\.test\.ts/);
  assert.match(settingsCheckRunner, /settingsService\.test\.ts/);
  assert.match(settingsCheckRunner, /providerConfigCenterService\.test\.ts/);
  assert.match(settingsCheckRunner, /providerConfigEditorPolicy\.test\.ts/);
  assert.match(settingsCheckRunner, /sdkwork-settings-contract\.test\.ts/);
  assert.match(nodeTypeScriptRunner, /ts-extension-loader\.mjs/);
});

runTest('settings service uses a local typed user port and local preference overlay without legacy notification SDK reads', () => {
  const settingsServiceSource = read('packages/sdkwork-agentstudio-pc-core/src/services/settingsService.ts');

  assert.match(settingsServiceSource, /interface SettingsSdkClient/);
  assert.match(settingsServiceSource, /getUserProfile\(\)/);
  assert.match(settingsServiceSource, /updateUserProfile\(body:/);
  assert.match(settingsServiceSource, /changePassword\(body:/);
  assert.match(settingsServiceSource, /getagentstudioAppClientWithSession/);
  assert.match(settingsServiceSource, /SETTINGS_OVERLAY_STORAGE_KEY/);
  assert.match(settingsServiceSource, /readSettingsOverlay/);
  assert.match(settingsServiceSource, /writeSettingsOverlay/);
  assert.doesNotMatch(settingsServiceSource, /client\.notification\./);
  assert.doesNotMatch(settingsServiceSource, /from ['"]@sdkwork\/app/);
});

runTest('sdkwork-agentstudio-pc-settings routes the api tab to the dedicated API workspace instead of the legacy api-key page', () => {
  const settingsSource = read('packages/sdkwork-agentstudio-pc-settings/src/Settings.tsx');
  const apiSettingsSource = read('packages/sdkwork-agentstudio-pc-settings/src/ApiSettings.tsx');
  const providerCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigCenter.tsx');
  const providerCenterServiceSource = read('packages/sdkwork-agentstudio-pc-settings/src/services/providerConfigCenterService.ts');
  const servicesIndexSource = read('packages/sdkwork-agentstudio-pc-settings/src/services/index.ts');

  assert.match(settingsSource, /ApiSettings/);
  assert.match(settingsSource, /activeTab === 'api' && <ApiSettings \/>/);
  assert.doesNotMatch(settingsSource, /activeTab === 'api' && <ApiKeysSettings \/>/);
  assert.equal(exists('packages/sdkwork-agentstudio-pc-settings/src/ApiKeysSettings.tsx'), false);
  assert.equal(exists('packages/sdkwork-agentstudio-pc-settings/src/LLMSettings.tsx'), false);
  assert.equal(exists('packages/sdkwork-agentstudio-pc-settings/src/services/apiKeyService.ts'), false);
  assert.doesNotMatch(servicesIndexSource, /apiKeyService/);
  assert.match(apiSettingsSource, /ProviderConfigCenter/);
  assert.match(apiSettingsSource, /localAiProxyLogsService/);
  assert.match(apiSettingsSource, /getRuntimeSummary/);
  assert.match(apiSettingsSource, /data-slot="api-settings-top-tabs"/);
  assert.match(apiSettingsSource, /data-slot="api-log-runtime-summary"/);
  assert.doesNotMatch(apiSettingsSource, /data-slot="api-settings-section-tabs"/);
  assert.doesNotMatch(apiSettingsSource, /resolveApiRequestLogsTab/);
  assert.doesNotMatch(apiSettingsSource, /apiLogs\.sections\.providersDescription/);
  assert.doesNotMatch(apiSettingsSource, /apiLogs\.sections\.logsDescription/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeSummaryTitle/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeFields\.proxyLifecycle/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeFields\.logPath/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeFields\.snapshotPath/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeFields\.observabilityDbPath/);
  assert.match(providerCenterSource, /providerConfigCenterService/);
  assert.match(providerCenterSource, /quickApply/);
  assert.doesNotMatch(providerCenterServiceSource, /instance\.runtimeKind === 'openclaw'/);
  assert.doesNotMatch(providerCenterSource, /studioMockService/);
});

runTest('sdkwork-agentstudio-pc-settings keeps Provider Center fully localized in Chinese and renders it in a full-width workspace shell', () => {
  const settingsSource = read('packages/sdkwork-agentstudio-pc-settings/src/Settings.tsx');
  const providerCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigCenter.tsx');
  const zhLocale = readLocale('zh');
  const providerCenterLocale = getLocaleValue(zhLocale, 'providerCenter');
  const enLocaleSource = read('packages/sdkwork-agentstudio-pc-i18n/src/locales/en/providerCenter.json');
  const zhLocaleSource = read('packages/sdkwork-agentstudio-pc-i18n/src/locales/zh/providerCenter.json');

  assert.match(settingsSource, /resolveSettingsContentShellClassName\(activeTab\)/);
  assert.doesNotMatch(providerCenterSource, /max-w-\[1500px\]/);
  assert.equal(
    getLocaleValue(zhLocale, 'providerCenter.page.eyebrow'),
    '本地代理路由中心',
  );
  assert.equal(
    getLocaleValue(zhLocale, 'providerCenter.table.provider'),
    '路由',
  );
  assert.equal(
    getLocaleValue(zhLocale, 'providerCenter.states.loading'),
    '正在加载代理路由...',
  );
  assert.equal(
    getLocaleValue(zhLocale, 'providerCenter.dialogs.editor.clientProtocol'),
    '客户端协议',
  );
  assert.equal(
    getLocaleValue(zhLocale, 'providerCenter.dialogs.editor.upstreamProtocol'),
    '上游协议',
  );
  assert.equal(
    getLocaleValue(zhLocale, 'providerCenter.dialogs.editor.enabled'),
    '启用路由',
  );
  assert.equal(
    getLocaleValue(zhLocale, 'providerCenter.toasts.saved'),
    '路由配置已保存。',
  );
  assert.match(enLocaleSource, /"requestOverridesTitle"\s*:/);
  assert.match(enLocaleSource, /"requestOverridesDescription"\s*:/);
  assert.match(enLocaleSource, /"requestOverrides"\s*:/);
  assert.match(enLocaleSource, /"requestOverridesPlaceholder"\s*:/);
  assert.match(enLocaleSource, /"requestOverridesHint"\s*:/);
  assert.match(zhLocaleSource, /"requestOverridesTitle"\s*:/);
  assert.match(zhLocaleSource, /"requestOverridesDescription"\s*:/);
  assert.match(zhLocaleSource, /"requestOverrides"\s*:/);
  assert.match(zhLocaleSource, /"requestOverridesPlaceholder"\s*:/);
  assert.match(zhLocaleSource, /"requestOverridesHint"\s*:/);
  assert.ok(
    !JSON.stringify(providerCenterLocale).includes('????'),
    'Provider Center zh locale should not contain placeholder question-mark copy',
  );
});

runTest('sdkwork-agentstudio-pc-settings renders Provider Center route editing in a sidebar editor with row-based model management', () => {
  const providerCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigCenter.tsx');
  const editorSheetSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigEditorSheet.tsx');

  assert.match(providerCenterSource, /ProviderConfigEditorSheet/);
  assert.match(editorSheetSource, /data-slot="provider-center-editor-shell"/);
  assert.match(editorSheetSource, /data-slot="provider-center-provider-sidebar"/);
  assert.match(editorSheetSource, /data-slot="provider-center-model-list"/);
  assert.match(editorSheetSource, /data-slot="provider-center-model-list-header"/);
  assert.match(editorSheetSource, /data-slot="provider-center-model-list-row"/);
  assert.match(editorSheetSource, /appendProviderConfigModelRow/);
  assert.match(editorSheetSource, /moveProviderConfigModelRow/);
  assert.match(editorSheetSource, /data-slot="provider-center-request-overrides"/);
  assert.match(editorSheetSource, /value=\{draft\.requestOverridesDraft\}/);
  assert.match(editorSheetSource, /providerCenter\.dialogs\.editor\.requestOverridesTitle/);
  assert.match(editorSheetSource, /providerCenter\.dialogs\.editor\.requestOverridesDescription/);
  assert.match(editorSheetSource, /providerCenter\.dialogs\.editor\.requestOverrides/);
  assert.match(editorSheetSource, /providerCenter\.dialogs\.editor\.requestOverridesPlaceholder/);
  assert.match(editorSheetSource, /providerCenter\.dialogs\.editor\.requestOverridesHint/);
  assert.doesNotMatch(editorSheetSource, /value=\{draft\.modelsText\}/);
  assert.doesNotMatch(editorSheetSource, /<Label>\{t\('providerCenter\.dialogs\.editor\.modelId'\)\}<\/Label>/);
  assert.doesNotMatch(editorSheetSource, /<Label>\{t\('providerCenter\.dialogs\.editor\.modelName'\)\}<\/Label>/);
});

runTest('sdkwork-agentstudio-pc-settings promotes route status controls to the top of the Provider Center editor before the access form', () => {
  const editorSheetSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigEditorSheet.tsx');
  const routeHeroIndex = editorSheetSource.indexOf('data-slot="provider-center-route-hero"');
  const routeStatusIndex = editorSheetSource.indexOf('data-slot="provider-center-route-status"');
  const accessTitleIndex = editorSheetSource.indexOf("providerCenter.dialogs.editor.accessTitle");

  assert.ok(routeHeroIndex >= 0, 'Provider Center editor should expose a dedicated route hero section');
  assert.ok(routeStatusIndex >= 0, 'Provider Center editor should expose a dedicated route status section');
  assert.ok(accessTitleIndex >= 0, 'Provider Center editor should still expose the access form section');
  assert.ok(
    routeStatusIndex < accessTitleIndex,
    'route status controls should appear before the access form section',
  );
});

runTest('sdkwork-agentstudio-pc-settings keeps the Provider Center table focused on route operations instead of exposing API keys inline', () => {
  const providerCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigCenter.tsx');

  assert.doesNotMatch(providerCenterSource, /providerCenter\.table\.apiKey/);
  assert.doesNotMatch(providerCenterSource, /maskRouteApiKey/);
});

runTest('sdkwork-agentstudio-pc-settings opens Provider Center route details from row double-click and supports a dedicated view mode', () => {
  const providerCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigCenter.tsx');
  const editorSheetSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigEditorSheet.tsx');

  assert.match(providerCenterSource, /openViewDialog/);
  assert.match(providerCenterSource, /onDoubleClick=\{\(\) => openViewDialog\(record\)\}/);
  assert.match(providerCenterSource, /mode=\{editorMode\}/);
  assert.match(editorSheetSource, /mode: 'view' \| 'edit'/);
  assert.match(editorSheetSource, /const isReadOnly = mode === 'view' \|\| draft\.managedBy !== 'user';/);
  assert.match(editorSheetSource, /onEditRequest\?: \(\) => void;/);
});

runTest('sdkwork-agentstudio-pc-settings prioritizes Provider Center summary cards above a dedicated table toolbar and removes oversized intro copy', () => {
  const providerCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigCenter.tsx');
  const summaryIndex = providerCenterSource.indexOf('data-slot="provider-center-summary"');
  const toolbarIndex = providerCenterSource.indexOf('data-slot="provider-center-table-toolbar"');
  const tableIndex = providerCenterSource.indexOf('data-slot="provider-center-table"');

  assert.ok(summaryIndex >= 0, 'Provider Center should expose a summary section');
  assert.ok(toolbarIndex >= 0, 'Provider Center should expose a table toolbar section');
  assert.ok(tableIndex >= 0, 'Provider Center should still expose the table section');
  assert.ok(summaryIndex < toolbarIndex, 'summary cards should appear before the table toolbar');
  assert.ok(toolbarIndex < tableIndex, 'table toolbar should appear before table content');
  assert.doesNotMatch(providerCenterSource, /providerCenter\.page\.description/);
  assert.doesNotMatch(providerCenterSource, /providerCenter\.page\.storageHint/);
});

runTest('sdkwork-agentstudio-pc-settings exposes a Provider Center import dropdown that delegates tool config imports through the dedicated import service', () => {
  const providerCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigCenter.tsx');
  const servicesIndexSource = read('packages/sdkwork-agentstudio-pc-settings/src/services/index.ts');
  const workspaceServiceSource = read(
    'packages/sdkwork-agentstudio-pc-settings/src/services/providerConfigCenterWorkspaceService.ts',
  );

  assert.match(providerCenterSource, /data-slot="provider-center-import-menu"/);
  assert.match(providerCenterSource, /providerCenter\.actions\.import/);
  assert.match(providerCenterSource, /providerCenter\.import\.sources\.codex\.label/);
  assert.match(providerCenterSource, /providerCenter\.import\.sources\.claudeCode\.label/);
  assert.match(providerCenterSource, /providerCenter\.import\.sources\.openCode\.label/);
  assert.match(providerCenterSource, /providerConfigCenterWorkspaceService\.importProviderConfigs/);
  assert.match(workspaceServiceSource, /importApi:\s*providerConfigImportService/);
  assert.match(providerCenterSource, /toast\.success\(/);
  assert.match(providerCenterSource, /await loadRecords\(/);
  assert.match(servicesIndexSource, /providerConfigImportService/);
});

runTest('sdkwork-agentstudio-pc-settings consolidates route base URL and model summary into a standalone Provider Center route detail dialog workflow', () => {
  const providerCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderConfigCenter.tsx');
  const healthIndicatorSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderRouteHealthIndicator.tsx');
  const routeDetailDialogSource = read('packages/sdkwork-agentstudio-pc-settings/src/ProviderRouteDetailDialog.tsx');

  assert.match(providerCenterSource, /ProviderRouteDetailDialog/);
  assert.match(providerCenterSource, /ProviderRouteHealthIndicator/);
  assert.match(providerCenterSource, /data-slot="provider-center-route-summary-cell"/);
  assert.doesNotMatch(providerCenterSource, /<th className="px-5 py-4">\{t\('providerCenter\.table\.endpoint'\)\}<\/th>/);
  assert.doesNotMatch(providerCenterSource, /<th className="px-5 py-4">\{t\('providerCenter\.table\.selection'\)\}<\/th>/);
  assert.doesNotMatch(providerCenterSource, /providerCenter\.table\.lastTest'\)\}<\/th>/);
  assert.doesNotMatch(providerCenterSource, /section className="overflow-hidden/);
  assert.match(healthIndicatorSource, /createPortal/);
  assert.match(healthIndicatorSource, /min-w-max/);
  assert.match(routeDetailDialogSource, /data-slot="provider-center-route-detail-dialog"/);
  assert.match(routeDetailDialogSource, /data-slot="provider-center-route-model-list"/);
  assert.match(routeDetailDialogSource, /data-slot="provider-center-route-model-editor"/);
  assert.match(routeDetailDialogSource, /appendProviderConfigModelRow/);
  assert.match(routeDetailDialogSource, /updateProviderConfigModelRow/);
  assert.match(routeDetailDialogSource, /removeProviderConfigModelRow/);
  assert.match(routeDetailDialogSource, /createProviderConfigDraftFromForm/);
  assert.match(routeDetailDialogSource, /onSaveRequest/);
  assert.match(routeDetailDialogSource, /onEditRequest/);
});

runTest('wallet settings content no longer applies a nested centered max-width shell inside the full-width settings workspace', () => {
  const accountSource = read('packages/sdkwork-agentstudio-pc-account/src/Account.tsx');

  assert.doesNotMatch(accountSource, /mx-auto max-w-5xl/);
});

runTest('general, security, and data settings use wide responsive workspace layouts instead of narrow centered forms', () => {
  const generalSource = read('packages/sdkwork-agentstudio-pc-settings/src/GeneralSettings.tsx');
  const securitySource = read('packages/sdkwork-agentstudio-pc-settings/src/SecuritySettings.tsx');
  const dataPrivacySource = read('packages/sdkwork-agentstudio-pc-settings/src/DataPrivacySettings.tsx');
  const enLocale = readLocale('en');
  const zhIndexSource = read('packages/sdkwork-agentstudio-pc-i18n/src/locales/zh/index.ts');

  assert.match(generalSource, /xl:grid-cols/);
  assert.match(generalSource, /resolveTranslationBundleSourceLanguage/);
  assert.match(generalSource, /hasDedicatedTranslationBundle/);
  assert.match(generalSource, /settings\.general\.languageFallbackTo/);
  assert.match(securitySource, /xl:grid-cols/);
  assert.match(dataPrivacySource, /xl:grid-cols/);
  assert.doesNotMatch(generalSource, /2xl:grid-cols/);
  assert.doesNotMatch(securitySource, /2xl:grid-cols/);
  assert.doesNotMatch(securitySource, /max-w-md/);
  assert.notEqual(getLocaleValue(enLocale, 'settings.general.languageFallbackTo'), undefined);
  assert.match(zhIndexSource, /languageFallbackTo/);
});

runTest('data privacy settings keep the workspace visible while preferences load or if the fetch fails', () => {
  const dataPrivacySource = read('packages/sdkwork-agentstudio-pc-settings/src/DataPrivacySettings.tsx');
  const enLocale = readLocale('en');
  const zhLocale = readLocale('zh');

  assert.doesNotMatch(dataPrivacySource, /if \(!prefs\)\s*\{\s*return null;\s*\}/s);
  assert.match(dataPrivacySource, /useState<UserPreferences\['privacy'\]>\(/);
  assert.match(dataPrivacySource, /settings\.dataPrivacy\.loadPreferenceFailed/);
  assert.match(dataPrivacySource, /\.catch\(\(\)\s*=>/);
  assert.notEqual(getLocaleValue(enLocale, 'settings.dataPrivacy.loadPreferenceFailed'), undefined);
  assert.notEqual(getLocaleValue(zhLocale, 'settings.dataPrivacy.loadPreferenceFailed'), undefined);
});

runTest('notification settings keep the workspace visible while preferences load or if the fetch fails', () => {
  const notificationSource = read('packages/sdkwork-agentstudio-pc-settings/src/NotificationSettings.tsx');
  const enLocale = readLocale('en');
  const zhLocale = readLocale('zh');

  assert.doesNotMatch(notificationSource, /if \(!prefs\)\s*\{\s*return null;\s*\}/s);
  assert.match(notificationSource, /useState<UserPreferences\['notifications'\]>\(/);
  assert.match(notificationSource, /settings\.notifications\.loadPreferenceFailed/);
  assert.match(notificationSource, /\.catch\(\(\)\s*=>/);
  assert.notEqual(getLocaleValue(enLocale, 'settings.notifications.loadPreferenceFailed'), undefined);
  assert.notEqual(getLocaleValue(zhLocale, 'settings.notifications.loadPreferenceFailed'), undefined);
});

runTest('general and security settings keep full controls available when preference loading fails', () => {
  const generalSource = read('packages/sdkwork-agentstudio-pc-settings/src/GeneralSettings.tsx');
  const securitySource = read('packages/sdkwork-agentstudio-pc-settings/src/SecuritySettings.tsx');
  const enLocale = readLocale('en');
  const zhLocale = readLocale('zh');

  assert.match(generalSource, /const DEFAULT_GENERAL_PREFERENCES:/);
  assert.match(generalSource, /useState<UserPreferences\['general'\]>\(DEFAULT_GENERAL_PREFERENCES\)/);
  assert.match(generalSource, /settings\.general\.loadPreferenceFailed/);
  assert.doesNotMatch(generalSource, /if \(!prefs\)\s*\{\s*return;\s*\}/s);
  assert.match(securitySource, /const DEFAULT_SECURITY_PREFERENCES:/);
  assert.match(securitySource, /useState<UserPreferences\['security'\]>\(DEFAULT_SECURITY_PREFERENCES\)/);
  assert.match(securitySource, /settings\.security\.toasts\.loadPreferenceFailed/);
  assert.doesNotMatch(securitySource, /if \(!prefs\)\s*\{\s*return;\s*\}/s);
  assert.notEqual(getLocaleValue(enLocale, 'settings.general.loadPreferenceFailed'), undefined);
  assert.notEqual(getLocaleValue(zhLocale, 'settings.general.loadPreferenceFailed'), undefined);
  assert.notEqual(getLocaleValue(enLocale, 'settings.security.toasts.loadPreferenceFailed'), undefined);
  assert.notEqual(getLocaleValue(zhLocale, 'settings.security.toasts.loadPreferenceFailed'), undefined);
});

runTest('sdkwork-agentstudio-pc-settings exports Kernel Center through package and service barrels with localized page copy', () => {
  const indexSource = read('packages/sdkwork-agentstudio-pc-settings/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-agentstudio-pc-settings/src/services/index.ts');
  const kernelCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/KernelCenter.tsx');
  const hostRuntimeSettingsSource = read('packages/sdkwork-agentstudio-pc-settings/src/HostRuntimeSettings.tsx');
  const enLocale = readLocale('en');
  const zhLocale = readLocale('zh');
  const enSettingsLocale = readJson<Record<string, unknown>>(
    'packages/sdkwork-agentstudio-pc-i18n/src/locales/en/settings.json',
  );
  const zhSettingsLocale = readJson<Record<string, unknown>>(
    'packages/sdkwork-agentstudio-pc-i18n/src/locales/zh/settings.json',
  );
  const directKeys = [
    ...kernelCenterSource.matchAll(/\bt\('([^']+)'\)/g),
    ...hostRuntimeSettingsSource.matchAll(/\bt\('([^']+)'\)/g),
  ].map((match) => match[1]);
  const uniqueKeys = [...new Set(directKeys)].sort();
  const missingKeys = uniqueKeys.filter(
    (key) => getLocaleValue(enLocale, key) === undefined || getLocaleValue(zhLocale, key) === undefined,
  );

  assert.ok(exists('packages/sdkwork-agentstudio-pc-settings/src/KernelCenter.ts'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.ts'));
  assert.match(indexSource, /KernelCenter/);
  assert.match(servicesIndexSource, /kernelCenterService/);
  assert.doesNotMatch(indexSource, /\.test['"]/);
  assert.doesNotMatch(servicesIndexSource, /\.test['"]/);
  assert.match(kernelCenterSource, /kernelCenterService/);
  assert.doesNotMatch(kernelCenterSource, /@sdkwork\/claw-infrastructure/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.description/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.actions\.refresh/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.actions\.ensureRunning/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.actions\.restart/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.metrics\.runtime/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.sections\.hostOwnership/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.serviceManager/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.messageCaptureEnabled/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.observabilityDbPath/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.routeMetrics/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.fields\.routeTests/);
  assert.match(kernelCenterSource, /formatLocalAiProxyRouteMetricSummary/);
  assert.match(kernelCenterSource, /formatLocalAiProxyRouteTestSummary/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.capabilityRollup\.ready/);
  assert.match(kernelCenterSource, /settings\.kernelCenter\.bundles\.supervisor/);
  assert.match(hostRuntimeSettingsSource, /settings\.kernelCenter\.hostRuntime\.cards\.hostMode/);
  assert.match(hostRuntimeSettingsSource, /settings\.kernelCenter\.hostRuntime\.cards\.runtimeDataDir/);
  assert.equal(
    getLocaleValue(enLocale, 'settings.kernelCenter.description'),
    'This surface shows kernel authority ownership, active endpoints, storage profile, and runtime provenance without hiding fallback behavior.',
  );
  assert.equal(
    getLocaleValue(zhLocale, 'settings.kernelCenter.description'),
    '这里会如实展示当前内核治理归属、活动端点、存储配置与运行来源，不会掩盖任何回退行为。',
  );
  assert.equal(
    getLocaleValue(enSettingsLocale, 'kernelCenter.description'),
    getLocaleValue(enLocale, 'settings.kernelCenter.description'),
  );
  assert.equal(
    getLocaleValue(zhSettingsLocale, 'kernelCenter.description'),
    getLocaleValue(zhLocale, 'settings.kernelCenter.description'),
  );
  assert.doesNotMatch(kernelCenterSource, /The built-in OpenClaw kernel is treated as mandatory product/);
  assert.doesNotMatch(kernelCenterSource, /Failed to load kernel status\./);
  assert.deepEqual(missingKeys, []);
});

runTest('sdkwork-agentstudio-pc-settings consumes Kernel Center install source from shared provenance instead of raw snapshot internals', () => {
  const kernelCenterSource = read('packages/sdkwork-agentstudio-pc-settings/src/KernelCenter.tsx');
  const kernelCenterServiceSource = read('packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.ts');

  assert.match(
    kernelCenterServiceSource,
    /const kernelHost = snapshot\?\.raw \?\? info\?\.host \?\? null;/,
  );
  assert.match(
    kernelCenterServiceSource,
    /installSource:\s*kernelHost\?\.provenance\.installSource \?\? null/,
  );
  assert.doesNotMatch(
    kernelCenterServiceSource,
    /installSource:\s*snapshot\?\.raw\.provenance\.installSource \?\? null/,
  );
  assert.doesNotMatch(kernelCenterServiceSource, /installSourceLabel:\s*string;/);
  assert.match(kernelCenterSource, /translateInstallSource\(\s*t,\s*provenance\.installSource\s*\)/);
  assert.doesNotMatch(kernelCenterSource, /dashboard\?\.snapshot\?\.raw\.provenance\.installSource/);
});

runTest('feedback center contract is expressed through the local product app client port', () => {
  const appSdkPortSource = read('packages/sdkwork-agentstudio-pc-core/src/sdk/appSdkPort.ts');
  const feedbackServiceSource = read('packages/sdkwork-agentstudio-pc-core/src/services/feedbackCenterService.ts');

  assert.match(appSdkPortSource, /export interface agentstudioFeedbackClient/);
  assert.match(appSdkPortSource, /listFeedback\(params\?: Record<string, unknown>\)/);
  assert.match(appSdkPortSource, /submit\(body: Record<string, unknown>\)/);
  assert.match(appSdkPortSource, /getFeedbackDetail\(feedbackId: string \| number\)/);
  assert.match(appSdkPortSource, /followUp\(/);
  assert.match(appSdkPortSource, /close\(/);
  assert.match(appSdkPortSource, /listFaqCategories\(\)/);
  assert.match(appSdkPortSource, /listFaqs\(params\?: Record<string, unknown>\)/);
  assert.match(appSdkPortSource, /searchFaqs\(params\?: Record<string, unknown>\)/);
  assert.match(appSdkPortSource, /getSupportInfo\(\)/);
  assert.match(feedbackServiceSource, /from '\.\.\/sdk\/appSdkPort\.ts'/);
  assert.match(feedbackServiceSource, /getagentstudioAppClientWithSession/);
  assert.doesNotMatch(feedbackServiceSource, /fetch\(/);
  assert.doesNotMatch(feedbackServiceSource, /from ['"]@sdkwork\/app/);
});

runTest('sdkwork-agentstudio-pc-settings service uses claw-core typed app client port instead of infrastructure business http', () => {
  const settingsServiceSource = read('packages/sdkwork-agentstudio-pc-settings/src/services/settingsService.ts');
  const coreSettingsServiceSource = read('packages/sdkwork-agentstudio-pc-core/src/services/settingsService.ts');

  assert.ok(exists('packages/sdkwork-agentstudio-pc-core/src/services/settingsService.ts'));
  assert.match(settingsServiceSource, /from '@sdkwork\/claw-core'/);
  assert.match(settingsServiceSource, /createSettingsService/);
  assert.doesNotMatch(settingsServiceSource, /@sdkwork\/claw-core\/services\//);
  assert.doesNotMatch(settingsServiceSource, /getagentstudioAppClientWithSession/);
  assert.doesNotMatch(settingsServiceSource, /unwrapAppSdkResponse/);
  assert.match(coreSettingsServiceSource, /getagentstudioAppClientWithSession/);
  assert.match(coreSettingsServiceSource, /unwrapAppSdkResponse/);
  assert.doesNotMatch(settingsServiceSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(settingsServiceSource, /studioMockService/);
});

runTest('sdkwork-agentstudio-pc-settings exposes a feedback settings entry backed by claw-core feedbackCenterService', () => {
  const settingsSource = read('packages/sdkwork-agentstudio-pc-settings/src/Settings.tsx');
  const enLocaleSource = readLocaleSectionSource('en', 'settings');
  const zhLocaleSource = readLocaleSectionSource('zh', 'settings');

  assert.ok(
    exists('packages/sdkwork-agentstudio-pc-settings/src/FeedbackSettings.tsx'),
    'Feedback settings page should exist',
  );

  const feedbackSettingsSource = read('packages/sdkwork-agentstudio-pc-settings/src/FeedbackSettings.tsx');

  assert.match(settingsSource, /FeedbackSettings/);
  assert.match(settingsSource, /id: 'feedback'/);
  assert.match(settingsSource, /settings\.tabs\.feedback/);
  assert.match(settingsSource, /activeTab === 'feedback' && <FeedbackSettings \/>/);

  assert.match(feedbackSettingsSource, /@sdkwork\/claw-core/);
  assert.match(feedbackSettingsSource, /feedbackCenterService/);
  assert.doesNotMatch(feedbackSettingsSource, /@sdkwork\/claw-infrastructure/);
  assert.doesNotMatch(feedbackSettingsSource, /\bfetch\(/);
  assert.doesNotMatch(feedbackSettingsSource, /\baxios\./);
  assert.doesNotMatch(feedbackSettingsSource, /getagentstudioAppClientWithSession/);

  assert.match(enLocaleSource, /"feedback": "Feedback"/);
  assert.match(zhLocaleSource, /"feedback": "反馈"/);
});

