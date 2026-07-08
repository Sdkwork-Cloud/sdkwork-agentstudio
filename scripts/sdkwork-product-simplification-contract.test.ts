import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
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

const removedRoutePatterns = [
  /\/apps\b/,
  /\/market\b/,
  /\/mall\b/,
  /\/github\b/,
  /\/huggingface\b/,
  /\/model-purchase\b/,
  /\/points\b/,
] as const;

runTest('simplified product shell removes app store, ecosystem marketplaces, and commerce routes from host surfaces', () => {
  const routesSource = read('packages/sdkwork-clawstudio-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read('packages/sdkwork-clawstudio-shell/src/application/router/routePaths.ts');
  const routePrefetchSource = read('packages/sdkwork-clawstudio-shell/src/application/router/routePrefetch.ts');
  const sidebarSource = read('packages/sdkwork-clawstudio-shell/src/components/Sidebar.tsx');
  const coreSidebarSource = read('packages/sdkwork-clawstudio-core/src/components/Sidebar.tsx');
  const coreCommandPaletteSource = read('packages/sdkwork-clawstudio-core/src/components/CommandPalette.tsx');
  const settingsSource = read('packages/sdkwork-clawstudio-settings/src/GeneralSettings.tsx');
  const commandPaletteSource = read('packages/sdkwork-clawstudio-shell/src/components/commandPaletteCommands.ts');
  const headerSource = read('packages/sdkwork-clawstudio-shell/src/components/AppHeader.tsx');
  const trayBridgeSource = read('packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/DesktopTrayRouteBridge.tsx');
  const desktopBootstrapSource = read('packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs');
  const shellPackageSource = read('packages/sdkwork-clawstudio-shell/package.json');

  for (const pattern of removedRoutePatterns) {
    assert.doesNotMatch(routesSource, pattern);
    assert.doesNotMatch(routePathsSource, pattern);
    assert.doesNotMatch(routePrefetchSource, pattern);
    assert.doesNotMatch(sidebarSource, pattern);
    assert.doesNotMatch(coreSidebarSource, pattern);
    assert.doesNotMatch(coreCommandPaletteSource, pattern);
    assert.doesNotMatch(settingsSource, pattern);
    assert.doesNotMatch(commandPaletteSource, pattern);
    assert.doesNotMatch(trayBridgeSource, pattern);
    assert.doesNotMatch(desktopBootstrapSource, pattern);
  }

  assert.doesNotMatch(routesSource, /@sdkwork\/claw-(apps|github|huggingface|mall|market|model-purchase|points)/);
  assert.doesNotMatch(routePrefetchSource, /@sdkwork\/claw-(apps|github|huggingface|mall|market|model-purchase|points)/);
  assert.doesNotMatch(headerSource, /PointsHeaderEntry/);
  assert.doesNotMatch(headerSource, /@sdkwork\/claw-points/);
  assert.doesNotMatch(shellPackageSource, /@sdkwork\/claw-(apps|github|huggingface|mall|market|model-purchase|points)/);
  assert.doesNotMatch(desktopBootstrapSource, /open_apps/);
});

runTest('simplified workspace checks stop requiring removed feature packages', () => {
  const packageJsonSource = read('package.json');
  const structureSource = read('scripts/check-sdkwork-clawstudio-structure.mjs');
  const routeSurfaceSource = read('scripts/check-sdkwork-clawstudio-route-surface.mjs');
  const routeBaselineSource = read('scripts/fixtures/claw-studio-v5-route-surface.json');
  const featureBridgeSource = read('scripts/sdkwork-feature-bridges-contract.test.ts');
  const qualityGateSource = read('scripts/openclaw-quality-gate-contract.test.mjs');

  assert.doesNotMatch(packageJsonSource, /check:sdkwork-(apps|github|huggingface|mall|market|model-purchase|points)/);
  assert.doesNotMatch(structureSource, /sdkwork-clawstudio-(apps|github|huggingface|mall|market|model-purchase|points)/);
  assert.doesNotMatch(routeSurfaceSource, /\/(apps|market|mall|github|huggingface|model-purchase|points)/);
  assert.doesNotMatch(routeBaselineSource, /\/(apps|market|github|huggingface)/);
  assert.doesNotMatch(featureBridgeSource, /sdkwork-clawstudio-(apps|github|huggingface|model-purchase|points)/);
  assert.doesNotMatch(qualityGateSource, /sdkwork-market/);
});

runTest('simplified workspace removes deprecated feature package directories', () => {
  const removedPackageDirs = [
    'packages/sdkwork-clawstudio-apps',
    'packages/sdkwork-clawstudio-github',
    'packages/sdkwork-clawstudio-huggingface',
    'packages/sdkwork-clawstudio-mall',
    'packages/sdkwork-clawstudio-market',
    'packages/sdkwork-clawstudio-model-purchase',
    'packages/sdkwork-clawstudio-points',
  ];

  for (const relPath of removedPackageDirs) {
    assert.equal(exists(relPath), false, `${relPath} should be removed`);
  }
});

runTest('simplified workspace removes obsolete product contracts and shared exports', () => {
  const removedScriptFiles = [
    'scripts/run-sdkwork-apps-check.mjs',
    'scripts/run-sdkwork-market-check.mjs',
    'scripts/run-sdkwork-points-check.mjs',
    'scripts/sdkwork-apps-contract.test.ts',
    'scripts/sdkwork-github-contract.test.ts',
    'scripts/sdkwork-huggingface-contract.test.ts',
    'scripts/sdkwork-market-contract.test.ts',
    'scripts/sdkwork-mall-contract.test.ts',
    'scripts/sdkwork-model-purchase-contract.test.ts',
    'scripts/sdkwork-points-contract.test.ts',
  ];
  const coreServicesIndexSource = read('packages/sdkwork-clawstudio-core/src/services/index.ts');

  for (const relPath of removedScriptFiles) {
    assert.equal(exists(relPath), false, `${relPath} should be removed`);
  }

  assert.doesNotMatch(coreServicesIndexSource, /appStoreCatalogService/);
  assert.doesNotMatch(coreServicesIndexSource, /clawMallService/);
  assert.doesNotMatch(coreServicesIndexSource, /pointsWalletService/);
});
