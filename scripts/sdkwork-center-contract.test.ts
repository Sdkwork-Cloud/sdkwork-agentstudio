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

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-agentstudio-pc-center is implemented locally instead of re-exporting agent-studio-claw-center', () => {
  const workspacePackage = readJson<{ scripts?: Record<string, string> }>('package.json');
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-agentstudio-pc-center/package.json');
  const indexSource = read('packages/sdkwork-agentstudio-pc-center/src/index.ts');
  const uploadPageSource = read('packages/sdkwork-agentstudio-pc-center/src/pages/ClawUpload.tsx');
  const centerCheckRunnerSource = read('scripts/run-sdkwork-center-check.mjs');
  const registryPresentationSource = read('packages/sdkwork-agentstudio-pc-center/src/services/clawRegistryPresentation.ts');
  const clawServiceSource = read('packages/sdkwork-agentstudio-pc-center/src/services/clawService.ts');

  assert.ok(exists('packages/sdkwork-agentstudio-pc-center/src/pages/ClawCenter.tsx'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-center/src/pages/ClawDetail.tsx'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-center/src/services/clawService.ts'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-center/src/types/index.ts'));
  assert.ok(exists('scripts/run-sdkwork-center-check.mjs'));

  assert.ok(!pkg.dependencies?.['@sdkwork/agentstudio-pc-studio-claw-center']);
  assert.ok(pkg.dependencies?.['@sdkwork/agentstudio-pc-infrastructure']);
  assert.match(
    workspacePackage.scripts?.['check:sdkwork-center'] ?? '',
    /sdkwork-run-node scripts\/run-sdkwork-center-check\.mjs && sdkwork-run-node --experimental-strip-types scripts\/sdkwork-center-contract\.test\.ts/,
  );
  assert.match(
    centerCheckRunnerSource,
    /packages\/sdkwork-agentstudio-pc-center\/src\/services\/clawRegistryPresentation\.test\.ts/,
  );
  assert.doesNotMatch(indexSource, /@sdkwork\/agent-studio-claw-center/);
  assert.doesNotMatch(registryPresentationSource, /runtimeKind === 'openclaw'/);
  assert.doesNotMatch(clawServiceSource, /runtimeKind === 'openclaw'/);
  assert.match(indexSource, /ClawCenter/);
  assert.match(indexSource, /ClawDetail/);
  assert.match(indexSource, /ClawUpload/);
  assert.match(uploadPageSource, /studio\.listInstances\(\)/);
  assert.match(uploadPageSource, /instance\.runtimeKind === 'openclaw'/);
  assert.doesNotMatch(uploadPageSource, /navigate\('\/api-router'\)/);
  assert.match(uploadPageSource, /navigate\(`\/instances\/\$\{instance\.id\}`\)/);
  assert.match(uploadPageSource, /clawUpload\.summary\.gatewayReady/);
});

runTest('claw registry center keeps a search-first workbench and adaptive maximum page width', () => {
  const centerPageSource = read('packages/sdkwork-agentstudio-pc-center/src/pages/ClawCenter.tsx');
  const detailPageSource = read('packages/sdkwork-agentstudio-pc-center/src/pages/ClawDetail.tsx');
  const uploadPageSource = read('packages/sdkwork-agentstudio-pc-center/src/pages/ClawUpload.tsx');

  assert.match(centerPageSource, /max-w-none/);
  assert.match(detailPageSource, /max-w-\[min\(1760px,_calc\(100vw-2rem\)\)\]/);
  assert.match(centerPageSource, /selectLatestRegistryEntries/);
  assert.match(centerPageSource, /selectPopularRegistryEntries/);
  assert.match(centerPageSource, /selectRecommendedRegistryEntries/);
  assert.match(centerPageSource, /clawCenter\.sections\.latestClaw/);
  assert.match(centerPageSource, /clawCenter\.sections\.popularClaw/);
  assert.match(centerPageSource, /clawCenter\.sections\.recommendedClaw/);
  assert.match(centerPageSource, /xl:grid-cols-\[240px_minmax\(0,1fr\)_320px\]/);
  assert.match(centerPageSource, /xl:grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(centerPageSource, /clawCenter\.actions\.quickRegister/);
  assert.match(centerPageSource, /navigate\('\/claw-upload'\)/);
  assert.match(centerPageSource, /matchReasons/);
  assert.match(centerPageSource, /categoryName\(entry\.category, t, entry\.category\)/);
  assert.match(centerPageSource, /const currentCommand = primaryEntry \? buildRegistryConnectCommand\(primaryEntry\) : '';/);
  assert.match(centerPageSource, /clawCenter\.labels\.currentCommand/);
  assert.match(centerPageSource, /aria-label=\{t\('clawCenter\.actions\.copyContent'\)\}/);
  assert.match(centerPageSource, /font-mono/);
  assert.doesNotMatch(centerPageSource, /TopMatchCard/);
  assert.doesNotMatch(centerPageSource, /searchSuggestions/);
  assert.doesNotMatch(centerPageSource, /clawCenter\.sections\.spotlightEyebrow/);
  assert.doesNotMatch(centerPageSource, /clawCenter\.sections\.statusEyebrow/);
  assert.match(centerPageSource, /bg-zinc-50 dark:bg-zinc-950/);
  assert.match(detailPageSource, /bg-zinc-50 dark:bg-zinc-950/);
  assert.match(uploadPageSource, /bg-zinc-50 dark:bg-zinc-950/);
  assert.doesNotMatch(centerPageSource, /radial-gradient|linear-gradient/);
  assert.doesNotMatch(detailPageSource, /radial-gradient|linear-gradient/);
  assert.doesNotMatch(uploadPageSource, /radial-gradient|linear-gradient/);
});

runTest('claw center locales stay valid json and include search workbench copy in both languages', () => {
  const enLocale = readJson<{ clawCenter: Record<string, any> }>('packages/sdkwork-agentstudio-pc-i18n/src/locales/en.json');
  const zhLocale = readJson<{ clawCenter: Record<string, any> }>('packages/sdkwork-agentstudio-pc-i18n/src/locales/zh.json');

  assert.equal(enLocale.clawCenter.actions.copyContent, 'Copy Content');
  assert.equal(enLocale.clawCenter.actions.quickRegister, 'Networking');
  assert.equal(enLocale.clawCenter.labels.matchReasons, 'Matched On');
  assert.equal(enLocale.clawCenter.sections.latestClaw, 'Latest Claw');
  assert.equal(enLocale.clawCenter.sections.popularClaw, 'Popular Claw');
  assert.equal(enLocale.clawCenter.sections.recommendedClaw, 'Recommended Claw');

  assert.equal(zhLocale.clawCenter.actions.copyContent, '\u590d\u5236\u5185\u5bb9');
  assert.equal(zhLocale.clawCenter.actions.quickRegister, '\u8054\u7f51');
  assert.equal(zhLocale.clawCenter.title, 'OpenClaw \u6ce8\u518c\u4e2d\u5fc3');
  assert.equal(zhLocale.clawCenter.labels.matchReasons, '\u5339\u914d\u547d\u4e2d');
  assert.equal(zhLocale.clawCenter.sections.latestClaw, '\u6700\u65b0 Claw');
  assert.equal(zhLocale.clawCenter.sections.popularClaw, '\u70ed\u95e8 Claw');
  assert.equal(zhLocale.clawCenter.sections.recommendedClaw, '\u63a8\u8350 Claw');
});

runTest('openclaw networking surface keeps explicit OpenClaw gateway copy and clean capability formatting', () => {
  const uploadPageSource = read('packages/sdkwork-agentstudio-pc-center/src/pages/ClawUpload.tsx');
  const enLocale = readJson<any>('packages/sdkwork-agentstudio-pc-i18n/src/locales/en.json');
  const zhLocale = readJson<any>('packages/sdkwork-agentstudio-pc-i18n/src/locales/zh.json');

  assert.doesNotMatch(uploadPageSource, /join\(' ç’º?'\)/);
  assert.equal(enLocale.sidebar.clawUpload, 'Networking');
  assert.equal(enLocale.commandPalette.commands.upload.title, 'Go to Networking');
  assert.equal(
    enLocale.commandPalette.commands.upload.subtitle,
    'Inspect local OpenClaw gateway endpoints and registry-linked connectivity',
  );
  assert.equal(enLocale.clawUpload.eyebrow, 'OpenClaw Linked');
  assert.equal(enLocale.clawUpload.title, 'Networking');
  assert.match(enLocale.clawUpload.description, /OpenClaw-only networking view/);
  assert.equal(zhLocale.sidebar.clawUpload, '\u8054\u7f51');
  assert.equal(zhLocale.commandPalette.commands.upload.title, '\u524d\u5f80\u8054\u7f51');
  assert.equal(
    zhLocale.commandPalette.commands.upload.subtitle,
    '\u67e5\u770b\u672c\u5730 OpenClaw \u7f51\u5173\u7aef\u70b9\u4e0e\u6ce8\u518c\u8868\u5173\u8054\u8fde\u901a\u6027',
  );
  assert.equal(zhLocale.clawUpload.eyebrow, 'OpenClaw \u5df2\u5173\u8054');
  assert.equal(zhLocale.clawUpload.title, '\u8054\u7f51');
  assert.match(zhLocale.clawUpload.description, /\u4ec5\u7528\u4e8e OpenClaw \u8054\u7f51\u89c6\u56fe/);
});
