import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

await runTest('api settings shell routes the API tab through a compact three-tab workspace without the old stacked log tabs', async () => {
  const settingsSource = read('./Settings.tsx');
  const settingsIndexSource = read('./index.ts');
  const apiSettingsWrapperSource = read('./ApiSettings.ts');
  const apiSettingsSource = read('./ApiSettings.tsx');
  const apiLogsTablesSource = read('./apiLogsTables.tsx');

  assert.match(settingsSource, /import \{ ApiSettings \} from '\.\/ApiSettings';/);
  assert.match(settingsSource, /activeTab === 'api' && <ApiSettings \/>/);
  assert.doesNotMatch(settingsSource, /activeTab === 'api' && <ProviderConfigCenter \/>/);

  assert.match(settingsIndexSource, /export \* from '\.\/ApiSettings';/);
  assert.match(apiSettingsWrapperSource, /LazyApiSettings/);
  assert.match(apiSettingsSource, /resolveApiSettingsSection/);
  assert.match(apiSettingsSource, /ProviderConfigCenter/);
  assert.match(apiSettingsSource, /localAiProxyLogsService/);
  assert.match(apiSettingsSource, /data-slot="api-settings-top-tabs"/);
  assert.match(apiLogsTablesSource, /data-slot="api-request-logs-table"/);
  assert.match(apiLogsTablesSource, /data-slot="api-message-logs-table"/);
  assert.match(apiSettingsSource, /DEFAULT_API_SECTION_LABELS/);
  assert.match(apiSettingsSource, /apiLogs\.tabs\.providers/);
  assert.match(apiSettingsSource, /apiLogs\.tabs\.requests/);
  assert.match(apiSettingsSource, /apiLogs\.tabs\.messages/);
  assert.match(apiSettingsSource, /messageCaptureEnabled/);
  assert.match(apiSettingsSource, /messageCaptureToolbarLabel/);
  assert.match(apiSettingsSource, /data-slot="api-message-capture-toggle"/);
  assert.match(apiSettingsSource, /getRuntimeSummary/);
  assert.match(apiSettingsSource, /data-slot="api-log-runtime-summary"/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeSummaryTitle/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeFields\.proxyLifecycle/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeFields\.logPath/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeFields\.snapshotPath/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeFields\.observabilityDbPath/);
  assert.match(apiSettingsSource, /className="flex h-10 max-w-full items-center gap-3/);
  assert.match(apiLogsTablesSource, /pageSize/);
  assert.doesNotMatch(apiSettingsSource, /data-slot="api-settings-section-tabs"/);
  assert.doesNotMatch(apiSettingsSource, /lg:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.doesNotMatch(apiSettingsSource, /apiLogs\.sections\.providersDescription/);
  assert.doesNotMatch(apiSettingsSource, /apiLogs\.sections\.logsDescription/);
  assert.doesNotMatch(
    apiSettingsSource,
    /<div className="text-xs text-zinc-500 dark:text-zinc-400">/,
  );
});

await runTest('api settings runtime summary treats ready local proxy lifecycle as a first-class localized state', async () => {
  const apiSettingsSource = read('./ApiSettings.tsx');
  const enApiLogs = JSON.parse(read('../../sdkwork-claw-i18n/src/locales/en/apiLogs.json')) as Record<string, any>;
  const zhApiLogs = JSON.parse(read('../../sdkwork-claw-i18n/src/locales/zh/apiLogs.json')) as Record<string, any>;

  assert.match(apiSettingsSource, /case 'ready':/);
  assert.match(apiSettingsSource, /apiLogs\.logs\.runtimeLifecycle\.ready/);
  assert.equal(typeof enApiLogs.logs.runtimeLifecycle.ready, 'string');
  assert.equal(typeof zhApiLogs.logs.runtimeLifecycle.ready, 'string');
});
