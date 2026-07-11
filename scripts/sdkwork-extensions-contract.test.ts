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

runTest('sdkwork-agentstudio-pc-extensions keeps the local package surface and page entrypoints', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-agentstudio-pc-extensions/package.json',
  );
  const indexSource = read('packages/sdkwork-agentstudio-pc-extensions/src/index.ts');

  assert.ok(exists('packages/sdkwork-agentstudio-pc-extensions/src/Extensions.tsx'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-extensions/src/pages/extensions/Extensions.tsx'));
  assert.ok(exists('packages/sdkwork-agentstudio-pc-extensions/src/services/extensionService.ts'));
  assert.ok(!exists('packages/sdkwork-agentstudio-pc-extensions/src/services/mySkillService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/agentstudio-pc-studio-extensions']);
  assert.doesNotMatch(indexSource, /@sdkwork\/agent-studio-extensions/);
  assert.doesNotMatch(indexSource, /mySkillService/);
});

runTest('sdkwork-agentstudio-pc-extensions page aligns to local bundled plugin management instead of instance targeting', () => {
  const pageSource = read('packages/sdkwork-agentstudio-pc-extensions/src/pages/extensions/Extensions.tsx');

  assert.match(pageSource, /useEffectEvent/);
  assert.match(pageSource, /extensions\.page\.summary\.title/);
  assert.match(pageSource, /extensions\.page\.errors\.runtimeUnavailable/);
  assert.match(pageSource, /extensionService\.installExtension\(extension\.id\)/);
  assert.match(pageSource, /extensionService\.uninstallExtension\(extension\.id\)/);
  assert.doesNotMatch(pageSource, /instanceDirectoryService/);
  assert.doesNotMatch(pageSource, /useInstanceStore/);
  assert.doesNotMatch(pageSource, /installModalExt/);
  assert.doesNotMatch(pageSource, /selectedInstanceIds/);
  assert.doesNotMatch(pageSource, /Modal/);
});

runTest('sdkwork-agentstudio-pc-extensions service reads real runtime/plugin metadata instead of mock cards', () => {
  const serviceSource = read('packages/sdkwork-agentstudio-pc-extensions/src/services/extensionService.ts');

  assert.match(serviceSource, /kernelPlatformService/);
  assert.match(serviceSource, /platform/);
  assert.match(serviceSource, /source: ExtensionSource/);
  assert.match(serviceSource, /category: ExtensionCategory/);
  assert.match(serviceSource, /bundledExtensionsDir/);
  assert.match(serviceSource, /copyPath/);
  assert.match(serviceSource, /removePath/);
  assert.doesNotMatch(serviceSource, /MOCK_EXTENSIONS/);
  assert.doesNotMatch(serviceSource, /setTimeout/);
  assert.doesNotMatch(serviceSource, /picsum\.photos/);
  assert.doesNotMatch(serviceSource, /@sdkwork\/claw-i18n/);
});
