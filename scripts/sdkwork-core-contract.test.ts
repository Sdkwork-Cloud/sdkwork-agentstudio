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

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
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

runTest('sdkwork-claw-core exposes local stores and hooks instead of re-exporting claw-studio-business', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-core/package.json');
  const indexSource = read('packages/sdkwork-claw-core/src/index.ts');
  const servicesIndexSource = read('packages/sdkwork-claw-core/src/services/index.ts');

  assert.ok(exists('packages/sdkwork-claw-core/src/components/CommandPalette.tsx'));
  assert.ok(exists('packages/sdkwork-claw-core/src/components/Sidebar.tsx'));
  assert.ok(exists('packages/sdkwork-claw-core/src/sdk/useAppSdkClient.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useAppStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useInstanceStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useTaskStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/stores/useUpdateStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/store/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/store/useAppStore.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/sdk/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/hooks/useKeyboardShortcuts.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/lib/llmService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/platform/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/platform-impl/index.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/platform-impl/web.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/openClawAgentCatalogService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/updateService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/openClawConfigService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/communityService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/accountService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/settingsService.ts'));
  assert.ok(exists('packages/sdkwork-claw-core/src/services/openClawProviderRequestDraftService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-business']);
  assert.ok(!pkg.dependencies?.['@google/genai']);
  assert.equal(pkg.dependencies?.['@sdkwork/app-sdk'], 'workspace:^');
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-business/);
  assert.match(indexSource, /\.\/platform/);
  assert.match(indexSource, /\.\/platform-impl/);
  assert.match(indexSource, /\.\/store/);
  assert.doesNotMatch(indexSource, /\.\/sdk\/useAppSdkClient/);
  assert.doesNotMatch(indexSource, /\.\/sdk\/appSdkResult/);
  assert.doesNotMatch(indexSource, /\.\/components\/CommandPalette\.tsx/);
  assert.doesNotMatch(indexSource, /\.\/components\/Sidebar\.tsx/);
  assert.match(indexSource, /\.\/lib\/llmService/);
  assert.match(indexSource, /openClawConfigService/);
  assert.match(servicesIndexSource, /openClawProviderRequestDraftService/);
  assert.match(indexSource, /useAppStore/);
  assert.match(indexSource, /useKeyboardShortcuts/);
});

runTest('sdkwork-claw-core owns the shared community wrapper for remote feed sdk access', () => {
  const pkg = readJson<{ exports?: Record<string, string> }>('packages/sdkwork-claw-core/package.json');
  const servicesIndexSource = read('packages/sdkwork-claw-core/src/services/index.ts');
  const communityServiceSource = read('packages/sdkwork-claw-core/src/services/communityService.ts');

  assert.deepEqual(Object.keys(pkg.exports ?? {}).sort(), ['.', './sdk']);
  assert.match(servicesIndexSource, /communityService/);
  assert.match(communityServiceSource, /createCommunityService/);
  assert.match(communityServiceSource, /getAppSdkClientWithSession/);
  assert.match(communityServiceSource, /unwrapAppSdkResponse/);
  assert.match(communityServiceSource, /client\.feed\.getFeedList/);
  assert.match(communityServiceSource, /client\.feed\.getFeedDetail/);
  assert.match(communityServiceSource, /client\.feed\.create/);
  assert.match(communityServiceSource, /client\.comment\.getComments/);
  assert.match(communityServiceSource, /client\.comment\.createComment/);
  assert.match(communityServiceSource, /client\.category\.listCategories/);
  assert.doesNotMatch(communityServiceSource, /await import\('\.\.\/sdk\/useAppSdkClient\.ts'\)/);
});

runTest('sdkwork-claw-core package exposes a browser root entry and a Node-safe default root entry', () => {
  const pkg = readJson<{
    exports?: Record<string, string | Record<string, string>>;
  }>('packages/sdkwork-claw-core/package.json');
  const rootExport = pkg.exports?.['.'];
  const nodeEntrySource = read('packages/sdkwork-claw-core/src/node.ts');
  const nodeServicesSource = read('packages/sdkwork-claw-core/src/services/node/index.ts');
  const instanceStoreSource = read('packages/sdkwork-claw-core/src/stores/instanceStore.ts');
  const llmStoreSource = read('packages/sdkwork-claw-core/src/stores/llmStore.ts');

  assert.equal(typeof rootExport, 'object');
  assert.deepEqual(Object.keys(rootExport ?? {}), ['types', 'browser', 'default']);
  assert.deepEqual(rootExport, {
    types: './src/index.ts',
    browser: './src/index.ts',
    default: './src/node.ts',
  });
  assert.match(nodeEntrySource, /\.\/platform\/index\.ts/);
  assert.match(nodeEntrySource, /\.\/platform-impl\/index\.ts/);
  assert.match(nodeEntrySource, /\.\/services\/node\/index\.ts/);
  assert.match(nodeEntrySource, /\.\/stores\/instanceStore\.ts/);
  assert.match(nodeEntrySource, /\.\/stores\/llmStore\.ts/);
  assert.doesNotMatch(instanceStoreSource, /zustand/);
  assert.doesNotMatch(llmStoreSource, /zustand/);
  assert.match(nodeServicesSource, /\.\.\/accountService\.ts/);
  assert.match(nodeServicesSource, /\.\.\/settingsService\.ts/);
  assert.match(nodeServicesSource, /\.\.\/dashboardCommerceService\.ts/);
  assert.match(nodeServicesSource, /\.\.\/openClawConfigService\.ts/);
  assert.match(nodeServicesSource, /\.\.\/openClawProviderRequestDraftService\.ts/);
  assert.match(nodeServicesSource, /\.\.\/providerRoutingCatalogService\.ts/);
  assert.doesNotMatch(nodeEntrySource, /CommandPalette/);
  assert.doesNotMatch(nodeEntrySource, /DesktopWindowControls/);
  assert.doesNotMatch(nodeEntrySource, /Sidebar/);
  assert.doesNotMatch(nodeEntrySource, /useKeyboardShortcuts/);
  assert.doesNotMatch(nodeEntrySource, /\.\/services\/index\.ts/);
  assert.doesNotMatch(nodeEntrySource, /\.\/store\/index\.ts/);
  assert.doesNotMatch(nodeEntrySource, /useAuthStore/);
  assert.doesNotMatch(nodeEntrySource, /useAppStore/);
  assert.doesNotMatch(nodeEntrySource, /useInstanceStore/);
  assert.doesNotMatch(nodeEntrySource, /useLLMStore/);
  assert.doesNotMatch(nodeEntrySource, /useRolloutStore/);
  assert.doesNotMatch(nodeEntrySource, /useTaskStore/);
  assert.doesNotMatch(nodeEntrySource, /useUpdateStore/);
  assert.doesNotMatch(nodeEntrySource, /llmService/);
  assert.doesNotMatch(nodeServicesSource, /\.\.\/appAuthService\.ts/);
  assert.doesNotMatch(nodeServicesSource, /\.\.\/appStoreCatalogService\.ts/);
  assert.doesNotMatch(nodeServicesSource, /\.\.\/chatUploadService\.ts/);
  assert.doesNotMatch(nodeServicesSource, /\.\.\/clawHubService\.ts/);
  assert.doesNotMatch(nodeServicesSource, /\.\.\/clawMallService\.ts/);
  assert.doesNotMatch(nodeServicesSource, /\.\.\/communityService\.ts/);
  assert.doesNotMatch(nodeServicesSource, /\.\.\/feedbackCenterService\.ts/);
  assert.doesNotMatch(nodeServicesSource, /\.\.\/pointsWalletService\.ts/);
});

runTest('sdkwork-claw-core owns the remote account wrapper and local desktop-friendly settings wrapper', () => {
  const pkg = readJson<{ exports?: Record<string, string> }>('packages/sdkwork-claw-core/package.json');
  const servicesIndexSource = read('packages/sdkwork-claw-core/src/services/index.ts');
  const accountServiceSource = read('packages/sdkwork-claw-core/src/services/accountService.ts');
  const settingsServiceSource = read('packages/sdkwork-claw-core/src/services/settingsService.ts');

  assert.deepEqual(Object.keys(pkg.exports ?? {}).sort(), ['.', './sdk']);
  assert.match(servicesIndexSource, /accountService/);
  assert.match(servicesIndexSource, /settingsService/);
  assert.match(accountServiceSource, /getAppSdkClientWithSession/);
  assert.match(accountServiceSource, /unwrapAppSdkResponse/);
  assert.match(accountServiceSource, /client\.account\.getAccountSummary/);
  assert.match(settingsServiceSource, /getAppSdkClientWithSession/);
  assert.match(settingsServiceSource, /unwrapAppSdkResponse/);
  assert.match(settingsServiceSource, /client\.user\.getUserProfile/);
  assert.match(settingsServiceSource, /StoragePlatformAPI/);
  assert.match(settingsServiceSource, /storageApi\.getText/);
  assert.match(settingsServiceSource, /storageApi\.putText/);
  assert.doesNotMatch(settingsServiceSource, /client\.notification\.getNotificationSettings/);
  assert.doesNotMatch(settingsServiceSource, /client\.notification\.updateNotificationSettings/);
  assert.doesNotMatch(settingsServiceSource, /client\.notification\.updateTypeSettings/);
});

runTest('sdkwork-claw-core keeps browser-root sdk services eager while allowing node-safe commerce loading', () => {
  const clawHubServiceSource = read(
    'packages/sdkwork-claw-core/src/services/clawHubService.ts',
  );
  const communityServiceSource = read(
    'packages/sdkwork-claw-core/src/services/communityService.ts',
  );
  const dashboardCommerceServiceSource = read(
    'packages/sdkwork-claw-core/src/services/dashboardCommerceService.ts',
  );
  const feedbackCenterServiceSource = read(
    'packages/sdkwork-claw-core/src/services/feedbackCenterService.ts',
  );

  for (const source of [
    clawHubServiceSource,
    communityServiceSource,
    feedbackCenterServiceSource,
  ]) {
    assert.doesNotMatch(source, /await import\('\.\.\/sdk\/useAppSdkClient\.ts'\)/);
  }

  assert.match(
    dashboardCommerceServiceSource,
    /let dashboardCommerceSdkRuntimePromise: Promise<DashboardCommerceSdkRuntime> \| null = null;/,
  );
  assert.match(
    dashboardCommerceServiceSource,
    /dashboardCommerceSdkRuntimePromise = import\('\.\.\/sdk\/useAppSdkClient\.ts'\);/,
  );
  assert.match(
    dashboardCommerceServiceSource,
    /const \{ getAppSdkClientWithSession \} = await loadDashboardCommerceSdkRuntime\(\);/,
  );
  assert.match(
    dashboardCommerceServiceSource,
    /const \{ readAppSdkSessionTokens \} = await loadDashboardCommerceSdkRuntime\(\);/,
  );
});

runTest('sdkwork-claw-core drops retired app-store, mall, and points shared wrappers from the public service surface', () => {
  const servicesIndexSource = read('packages/sdkwork-claw-core/src/services/index.ts');

  assert.equal(exists('packages/sdkwork-claw-core/src/services/appStoreCatalogService.ts'), false);
  assert.equal(exists('packages/sdkwork-claw-core/src/services/appStoreCatalogService.test.ts'), false);
  assert.equal(exists('packages/sdkwork-claw-core/src/services/clawMallService.ts'), false);
  assert.equal(exists('packages/sdkwork-claw-core/src/services/clawMallService.test.ts'), false);
  assert.equal(exists('packages/sdkwork-claw-core/src/services/pointsWalletService.ts'), false);
  assert.equal(exists('packages/sdkwork-claw-core/src/services/pointsWalletService.test.ts'), false);
  assert.doesNotMatch(servicesIndexSource, /appStoreCatalogService/);
  assert.doesNotMatch(servicesIndexSource, /clawMallService/);
  assert.doesNotMatch(servicesIndexSource, /pointsWalletService/);
});

runTest('sdkwork-claw-core app store persists sidebar width for shell chrome resizing', () => {
  const storeSource = read('packages/sdkwork-claw-core/src/stores/useAppStore.ts');

  assert.match(storeSource, /sidebarWidth:\s*number/);
  assert.match(storeSource, /setSidebarWidth:\s*\(width:\s*number\)\s*=>\s*void/);
  assert.match(storeSource, /sidebarWidth:\s*252/);
  assert.match(storeSource, /setSidebarWidth:\s*\(sidebarWidth\)\s*=>\s*set\(\{\s*sidebarWidth\s*\}\)/);
});

runTest('sdkwork-claw-core app store tracks one-time mobile guide exposure separately from dialog visibility', () => {
  const storeSource = read('packages/sdkwork-claw-core/src/stores/useAppStore.ts');

  assert.match(storeSource, /isMobileAppDialogOpen:\s*boolean/);
  assert.match(storeSource, /hasSeenMobileAppPrompt:\s*boolean/);
  assert.match(storeSource, /openMobileAppDialog:\s*\(\)\s*=>\s*void/);
  assert.match(storeSource, /closeMobileAppDialog:\s*\(\)\s*=>\s*void/);
  assert.match(storeSource, /markMobileAppPromptSeen:\s*\(\)\s*=>\s*void/);
  assert.match(storeSource, /hasSeenMobileAppPrompt:\s*false/);
  assert.match(storeSource, /partialize/);
  assert.doesNotMatch(
    storeSource,
    /partialize:\s*\(state\):\s*PersistedAppState\s*=>\s*\(\{[\s\S]*isMobileAppDialogOpen:[\s\S]*\}\),\s*merge:/,
  );
});

runTest('sdkwork-claw-core sidebar removes legacy api-router entries', () => {
  const sidebarSource = read('packages/sdkwork-claw-core/src/components/Sidebar.tsx');

  assert.doesNotMatch(sidebarSource, /id: 'api-router'/);
});

runTest('sdkwork-claw-core shortcuts and legacy command palette avoid removed or placeholder actions', () => {
  const shortcutSource = read('packages/sdkwork-claw-core/src/hooks/useKeyboardShortcuts.ts');
  const commandPaletteSource = read('packages/sdkwork-claw-core/src/components/CommandPalette.tsx');

  assert.doesNotMatch(shortcutSource, /navigate\('\/market'\)/);
  assert.match(shortcutSource, /navigate\('\/agents'\)/);
  assert.doesNotMatch(commandPaletteSource, /id: 'action-terminal'/);
  assert.doesNotMatch(commandPaletteSource, /Terminal opened/);
});

runTest('sdkwork-claw-core exports shared desktop window controls for shell and auth surfaces', () => {
  const indexSource = read('packages/sdkwork-claw-core/src/index.ts');
  const controlsSource = read('packages/sdkwork-claw-core/src/components/DesktopWindowControls.tsx');

  assert.ok(exists('packages/sdkwork-claw-core/src/components/DesktopWindowControls.tsx'));
  assert.match(indexSource, /\.\/components\/DesktopWindowControls/);
  assert.match(controlsSource, /platform\.getPlatform\(\)\s*===\s*'desktop'/);
  assert.match(controlsSource, /common\.minimizeWindow/);
  assert.match(controlsSource, /common\.maximizeWindow/);
  assert.match(controlsSource, /common\.restoreWindow/);
  assert.match(controlsSource, /common\.closeWindow/);
});

runTest('claw host vite configs switch shared sdk resolution by explicit mode while keeping source mode for development', () => {
  const webViteConfig = read('packages/sdkwork-claw-web/vite.config.ts');
  const desktopViteConfig = read('packages/sdkwork-claw-desktop/vite.config.ts');

  assert.match(webViteConfig, /isSharedSdkSourceMode/);
  assert.match(webViteConfig, /resolvePnpmPackageDistEntry/);
  assert.match(webViteConfig, /@sdkwork\/app-sdk/);
  assert.match(webViteConfig, /sdkwork-app-sdk-typescript/);
  assert.match(webViteConfig, /src\/index\.ts/);

  assert.match(desktopViteConfig, /isSharedSdkSourceMode/);
  assert.match(desktopViteConfig, /@sdkwork\/app-sdk/);
  assert.match(desktopViteConfig, /sdkwork-app-sdk-typescript/);
  assert.match(desktopViteConfig, /src\/index\.ts/);
});

runTest('claw hosts resolve @sdkwork/sdk-common from shared SDK source only in source mode', () => {
  const webViteConfig = read('packages/sdkwork-claw-web/vite.config.ts');
  const desktopViteConfig = read('packages/sdkwork-claw-desktop/vite.config.ts');

  for (const source of [webViteConfig, desktopViteConfig]) {
    assert.match(source, /@sdkwork\/sdk-common/);
    assert.match(source, /sdkwork-sdk-common-typescript/);
    assert.match(source, /src\/index\.ts/);
  }
});

runTest('claw host tsconfig paths align TypeScript shared sdk resolution with the host alias strategy', () => {
  const webTsconfig = read('packages/sdkwork-claw-web/tsconfig.json');
  const desktopTsconfig = read('packages/sdkwork-claw-desktop/tsconfig.json');

  for (const source of [webTsconfig, desktopTsconfig]) {
    assert.match(source, /"@sdkwork\/app-sdk"/);
    assert.match(source, /"@sdkwork\/core-pc-react"/);
    assert.match(source, /"@sdkwork\/core-pc-react\/\*"/);
    assert.match(source, /sdkwork-core\/sdkwork-core-pc-react/);
    assert.match(source, /sdkwork-app-sdk-typescript/);
    assert.match(source, /"@sdkwork\/sdk-common"/);
    assert.match(source, /sdkwork-sdk-common-typescript/);
    assert.match(source, /"@sdkwork\/claw-\*"/);
    assert.doesNotMatch(source, /"@sdkwork\/craw-chat-sdk"/);
  }
});

runTest('claw hosts keep Vite import-meta typing local to the host packages instead of pinning vite/client in the shared base tsconfig', () => {
  const baseTsconfig = read('tsconfig.base.json');
  const webViteEnv = read('packages/sdkwork-claw-web/src/vite-env.d.ts');
  const desktopViteEnv = read('packages/sdkwork-claw-desktop/src/vite-env.d.ts');

  assert.doesNotMatch(baseTsconfig, /vite\/client/);
  assert.match(webViteEnv, /\[key:\s*string]: string \| undefined/);
  assert.match(webViteEnv, /interface ImportMeta/);
  assert.doesNotMatch(webViteEnv, /VITE_ACCESS_TOKEN/);
  assert.match(desktopViteEnv, /interface ImportMetaEnv/);
  assert.match(desktopViteEnv, /\[key:\s*string]: string \| undefined/);
  assert.doesNotMatch(desktopViteEnv, /VITE_ACCESS_TOKEN/);
  assert.match(desktopViteEnv, /interface ImportMeta/);
  assert.ok(exists('packages/sdkwork-claw-web/src/vite-env.d.ts'));
});

runTest('sdkwork-claw-shell publishes a local declaration for its shared stylesheet side-effect import', () => {
  const cssDeclarationSource = read('packages/sdkwork-claw-shell/src/styles/index.css.d.ts');

  assert.match(cssDeclarationSource, /declare const stylesheetUrl: string/);
  assert.match(cssDeclarationSource, /export default stylesheetUrl/);
});

runTest('claw workspace defines tracked Vite env files for development, test, and production hosts', () => {
  const gitignoreSource = read('.gitignore');
  const envExampleSource = read('.env.example');
  const envDevelopmentSource = read('.env.development');
  const envTestSource = read('.env.test');
  const envProductionSource = read('.env.production');
  const workspacePackageJson = read('package.json');
  const webPackageJson = read('packages/sdkwork-claw-web/package.json');
  const desktopPackageJson = read('packages/sdkwork-claw-desktop/package.json');
  const webEnvExampleSource = read('packages/sdkwork-claw-web/.env.example');
  const desktopEnvExampleSource = read('packages/sdkwork-claw-desktop/.env.example');
  const webViteConfig = read('packages/sdkwork-claw-web/vite.config.ts');
  const desktopViteConfig = read('packages/sdkwork-claw-desktop/vite.config.ts');
  const appSdkSource = read('packages/sdkwork-claw-core/src/sdk/useAppSdkClient.ts');

  assert.match(gitignoreSource, /!\.env\.development/);
  assert.match(gitignoreSource, /!\.env\.test/);
  assert.match(gitignoreSource, /!\.env\.production/);

  assert.match(envExampleSource, /VITE_APP_ENV=development/);
  assert.match(
    envExampleSource,
    /Keep real secrets in \.env\.development\.local or another ignored local env file\./,
  );
  assert.doesNotMatch(envExampleSource, /VITE_ACCESS_TOKEN=/);
  assert.match(envDevelopmentSource, /VITE_APP_ENV=development/);
  assert.match(envDevelopmentSource, /VITE_API_BASE_URL=https:\/\/api-dev\.sdkwork\.com/);
  assert.doesNotMatch(envDevelopmentSource, /VITE_ACCESS_TOKEN=/);
  assert.match(
    envDevelopmentSource,
    /Keep committed defaults secret-free and host-mediated\./,
  );
  assert.match(envTestSource, /VITE_APP_ENV=test/);
  assert.match(envTestSource, /VITE_API_BASE_URL=https:\/\/api-test\.sdkwork\.com/);
  assert.doesNotMatch(envTestSource, /VITE_ACCESS_TOKEN=/);
  assert.match(envProductionSource, /VITE_APP_ENV=production/);
  assert.match(envProductionSource, /VITE_API_BASE_URL=https:\/\/api\.sdkwork\.com/);
  assert.doesNotMatch(envProductionSource, /VITE_ACCESS_TOKEN=/);
  assert.doesNotMatch(webEnvExampleSource, /VITE_ACCESS_TOKEN=/);
  assert.doesNotMatch(desktopEnvExampleSource, /VITE_ACCESS_TOKEN=/);
  assert.doesNotMatch(envProductionSource, /api-dev\.sdkwork\.com/);
  assert.doesNotMatch(envProductionSource, /api-test\.sdkwork\.com/);

  assert.match(workspacePackageJson, /"dev:test"\s*:\s*"sdkwork-run-pnpm --filter @sdkwork\/claw-web run dev:test"/);
  assert.match(workspacePackageJson, /"build:test"\s*:\s*"sdkwork-run-pnpm prepare:shared-sdk && sdkwork-run-pnpm --filter @sdkwork\/claw-web run build:test"/);
  assert.match(workspacePackageJson, /"build"\s*:\s*"sdkwork-run-pnpm build:web"/);
  assert.match(workspacePackageJson, /"build:prod"\s*:\s*"sdkwork-run-pnpm prepare:shared-sdk && sdkwork-run-pnpm --filter @sdkwork\/claw-web run build:prod"/);
  assert.match(workspacePackageJson, /"tauri:dev:test"\s*:\s*"sdkwork-run-pnpm --dir packages\/sdkwork-claw-desktop tauri:dev:test"/);
  assert.match(workspacePackageJson, /"tauri:build"\s*:\s*"sdkwork-run-pnpm --dir packages\/sdkwork-claw-desktop tauri:build"/);
  assert.match(workspacePackageJson, /"tauri:build:test"\s*:\s*"sdkwork-run-pnpm --dir packages\/sdkwork-claw-desktop tauri:build:test"/);
  assert.match(workspacePackageJson, /"tauri:build:prod"\s*:\s*"sdkwork-run-pnpm --dir packages\/sdkwork-claw-desktop tauri:build:prod"/);

  assert.match(webPackageJson, /"dev:test"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/run-vite-host\.mjs serve --host 0\.0\.0\.0 --port 3001 --mode test"/);
  assert.match(
    webPackageJson,
    /"build"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && sdkwork-run-node \.\.\/\.\.\/scripts\/run-vite-host\.mjs build --mode production && sdkwork-run-node \.\.\/\.\.\/scripts\/check-web-performance-budget\.mjs"/,
  );
  assert.match(webPackageJson, /"build:test"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && sdkwork-run-node \.\.\/\.\.\/scripts\/run-vite-host\.mjs build --mode test"/);
  assert.match(
    webPackageJson,
    /"build:prod"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && sdkwork-run-node \.\.\/\.\.\/scripts\/run-vite-host\.mjs build --mode production && sdkwork-run-node \.\.\/\.\.\/scripts\/check-web-performance-budget\.mjs"/,
  );
  assert.match(webPackageJson, /"clean"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/remove-path\.mjs dist"/);
  assert.match(webPackageJson, /"lint"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/run-workspace-tsc\.mjs --noEmit"/);

  assert.match(desktopPackageJson, /"dev:test"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/run-vite-host\.mjs serve --mode test"/);
  assert.match(desktopPackageJson, /"build"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && sdkwork-run-node \.\.\/\.\.\/scripts\/run-vite-host\.mjs build && sdkwork-run-node \.\.\/\.\.\/scripts\/verify-desktop-build-assets\.mjs"/);
  assert.match(desktopPackageJson, /"build:prod"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && sdkwork-run-node \.\.\/\.\.\/scripts\/run-vite-host\.mjs build --mode production && sdkwork-run-node \.\.\/\.\.\/scripts\/verify-desktop-build-assets\.mjs"/);
  assert.match(desktopPackageJson, /"tauri:dev:test"\s*:\s*"[\s\S]*run-tauri-cli\.mjs dev --vite-mode test"/);
  assert.match(desktopPackageJson, /"tauri:build"\s*:\s*"[\s\S]*run-desktop-release-build\.mjs --phase bundle --vite-mode production"/);
  assert.match(desktopPackageJson, /"tauri:build:test"\s*:\s*"[\s\S]*run-desktop-release-build\.mjs --phase bundle --vite-mode test"/);
  assert.match(desktopPackageJson, /"tauri:build:prod"\s*:\s*"[\s\S]*run-desktop-release-build\.mjs --phase bundle --vite-mode production"/);
  assert.match(desktopPackageJson, /"clean"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/remove-path\.mjs dist"/);
  assert.match(desktopPackageJson, /"lint"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/run-workspace-tsc\.mjs --noEmit"/);

  for (const source of [webViteConfig, desktopViteConfig]) {
    assert.match(source, /const workspaceRootDir = path\.resolve\(__dirname, '\.\.\/\.\.'\);/);
    assert.match(source, /loadEnv\(mode, workspaceRootDir, ''\)/);
    assert.match(source, /envDir:\s*workspaceRootDir/);
    assert.doesNotMatch(source, /import\.meta\.env\.VITE_ACCESS_TOKEN/);
  }

  assert.doesNotMatch(appSdkSource, /DEFAULT_DEV_BASE_URL/);
  assert.doesNotMatch(appSdkSource, /DEFAULT_PROD_BASE_URL/);
  assert.doesNotMatch(appSdkSource, /https:\/\/api-dev\.sdkwork\.com/);
  assert.doesNotMatch(appSdkSource, /https:\/\/api\.sdkwork\.com/);
});

runTest('claw hosts restrict relative shared sdk aliases to source mode and keep git mode on installed package resolution', () => {
  const webViteConfig = read('packages/sdkwork-claw-web/vite.config.ts');
  const desktopViteConfig = read('packages/sdkwork-claw-desktop/vite.config.ts');

  for (const source of [webViteConfig, desktopViteConfig]) {
    assert.match(source, /isSharedSdkSourceMode/);
    assert.doesNotMatch(source, /sharedSdkMode === 'source' \|\| sharedSdkMode === 'git'/);
  }
});

runTest('claw workspace keeps relative-path shared sdk development while pinning git-backed release sources in config', () => {
  const workspacePackageJson = read('package.json');
  const webPackageJson = read('packages/sdkwork-claw-web/package.json');
  const desktopPackageJson = read('packages/sdkwork-claw-desktop/package.json');
  const workspaceManifest = read('pnpm-workspace.yaml');
  const npmrc = read('.npmrc');
  const sharedSdkReleaseConfig = read('config/shared-sdk-release-sources.json');
  const sharedSdkReleaseConfigJson = readJson<{
    sources?: Record<string, { repoUrl?: string; ref?: string }>;
  }>('config/shared-sdk-release-sources.json');
  const coreCheckRunner = read('scripts/run-sdkwork-core-check.mjs');
  const nodeTypeScriptRunner = read('scripts/run-node-typescript-check.mjs');
  const prepareSharedSdkScript = read('scripts/prepare-shared-sdk-packages.mjs');
  const prepareGitSourcesScript = read('scripts/prepare-shared-sdk-git-sources.mjs');
  const imSdkSource = sharedSdkReleaseConfigJson.sources?.['im-sdk'];
  const rtcSdkSource = sharedSdkReleaseConfigJson.sources?.['rtc-sdk'];
  const retiredChatBrandPattern = new RegExp(`open${'chat'}`, 'i');
  const retiredImBackendSourceId = `im-${'backend'}-sdk`;

  assert.match(npmrc, /link-workspace-packages\s*=\s*true/);
  assert.match(workspaceManifest, /spring-ai-plus-app-api/);
  assert.match(workspaceManifest, /sdkwork-sdk-common-typescript/);
  assert.match(workspaceManifest, /sdkwork-core\/sdkwork-core-pc-react/);
  assert.match(workspaceManifest, /craw-chat\/sdks\/sdkwork-im-sdk\/sdkwork-im-sdk-typescript/);
  assert.match(workspaceManifest, /craw-chat\/sdks\/sdkwork-rtc-sdk\/sdkwork-rtc-sdk-typescript/);
  assert.doesNotMatch(workspaceManifest, /craw-chat\/sdks\/sdkwork-craw-chat-sdk\/sdkwork-craw-chat-sdk-typescript\/composed/);
  assert.doesNotMatch(workspaceManifest, /craw-chat\/sdks\/sdkwork-craw-chat-sdk\/sdkwork-craw-chat-sdk-typescript\/generated\/server-openapi/);
  assert.doesNotMatch(workspaceManifest, retiredChatBrandPattern);
  assert.match(workspaceManifest, /'\.\.\/\.\.\/spring-ai-plus-app-api\/sdkwork-sdk-app\/sdkwork-app-sdk-typescript'/);
  assert.match(workspaceManifest, /'\.\.\/\.\.\/\.\.\/\.\.\/spring-ai-plus-app-api\/sdkwork-sdk-app\/sdkwork-app-sdk-typescript'/);
  assert.match(workspaceManifest, /'\.\.\/\.\.\/sdk\/sdkwork-sdk-commons\/sdkwork-sdk-common-typescript'/);
  assert.match(workspaceManifest, /'\.\.\/\.\.\/\.\.\/\.\.\/sdk\/sdkwork-sdk-commons\/sdkwork-sdk-common-typescript'/);
  assert.match(workspaceManifest, /'\.\.\/sdkwork-core\/sdkwork-core-pc-react'/);
  assert.match(workspaceManifest, /'\.\.\/\.\.\/\.\.\/sdkwork-core\/sdkwork-core-pc-react'/);
  assert.match(workspaceManifest, /'\.\.\/craw-chat\/sdks\/sdkwork-im-sdk\/sdkwork-im-sdk-typescript'/);
  assert.match(workspaceManifest, /'\.\.\/\.\.\/\.\.\/craw-chat\/sdks\/sdkwork-im-sdk\/sdkwork-im-sdk-typescript'/);
  assert.match(workspaceManifest, /'\.\.\/craw-chat\/sdks\/sdkwork-rtc-sdk\/sdkwork-rtc-sdk-typescript'/);
  assert.match(workspaceManifest, /'\.\.\/\.\.\/\.\.\/craw-chat\/sdks\/sdkwork-rtc-sdk\/sdkwork-rtc-sdk-typescript'/);
  assert.doesNotMatch(workspaceManifest, /'\.\.\/craw-chat\/sdks\/sdkwork-craw-chat-sdk\/sdkwork-craw-chat-sdk-typescript\/composed'/);
  assert.doesNotMatch(workspaceManifest, /'\.\.\/\.\.\/\.\.\/craw-chat\/sdks\/sdkwork-craw-chat-sdk\/sdkwork-craw-chat-sdk-typescript\/composed'/);
  assert.doesNotMatch(workspaceManifest, /'\.\.\/craw-chat\/sdks\/sdkwork-craw-chat-sdk\/sdkwork-craw-chat-sdk-typescript\/generated\/server-openapi'/);
  assert.doesNotMatch(workspaceManifest, /'\.\.\/\.\.\/\.\.\/craw-chat\/sdks\/sdkwork-craw-chat-sdk\/sdkwork-craw-chat-sdk-typescript\/generated\/server-openapi'/);
  assert.ok(exists('config/shared-sdk-release-sources.json'));
  assert.match(sharedSdkReleaseConfig, /sdkwork-sdk-app\.git/);
  assert.match(sharedSdkReleaseConfig, /sdkwork-sdk-commons\.git/);
  assert.match(sharedSdkReleaseConfig, /sdkwork-core\.git/);
  assert.match(sharedSdkReleaseConfig, /sdkwork-im-sdk\.git/);
  assert.match(sharedSdkReleaseConfig, /sdkwork-rtc-sdk\.git/);
  assert.match(sharedSdkReleaseConfig, /core-pc-react/);
  assert.match(sharedSdkReleaseConfig, /im-sdk/);
  assert.match(sharedSdkReleaseConfig, /rtc-sdk/);
  assert.doesNotMatch(sharedSdkReleaseConfig, retiredChatBrandPattern);
  assert.doesNotMatch(sharedSdkReleaseConfig, new RegExp(retiredImBackendSourceId));
  assert.doesNotMatch(sharedSdkReleaseConfig, /"ref"\s*:\s*"main"/);
  assert.equal(imSdkSource?.repoUrl, 'https://github.com/Sdkwork-Cloud/sdkwork-im-sdk.git');
  assert.equal(rtcSdkSource?.repoUrl, 'https://github.com/Sdkwork-Cloud/sdkwork-rtc-sdk.git');
  assert.match(imSdkSource?.ref ?? '', /^[0-9a-f]{40}$/);
  assert.match(rtcSdkSource?.ref ?? '', /^[0-9a-f]{40}$/);
  assert.match(workspacePackageJson, /"prepare:shared-sdk"\s*:\s*"sdkwork-run-node scripts\/prepare-shared-sdk-packages\.mjs"/);
  assert.match(workspacePackageJson, /"build"\s*:\s*"sdkwork-run-pnpm build:web"/);
  assert.match(
    webPackageJson,
    /"build"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && sdkwork-run-node \.\.\/\.\.\/scripts\/run-vite-host\.mjs build --mode production && sdkwork-run-node \.\.\/\.\.\/scripts\/check-web-performance-budget\.mjs"/,
  );
  assert.match(desktopPackageJson, /"build"\s*:\s*"sdkwork-run-node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && sdkwork-run-node \.\.\/\.\.\/scripts\/run-vite-host\.mjs build && sdkwork-run-node \.\.\/\.\.\/scripts\/verify-desktop-build-assets\.mjs"/);
  assert.match(workspacePackageJson, /"check:sdkwork-core"\s*:\s*"sdkwork-run-node scripts\/run-sdkwork-core-check\.mjs"/);
  assert.match(prepareSharedSdkScript, /SDKWORK_SHARED_SDK_MODE/);
  assert.match(prepareSharedSdkScript, /resolveSharedSdkMode/);
  assert.match(prepareSharedSdkScript, /sharedImSdkRoot/);
  assert.match(prepareSharedSdkScript, /sharedRtcSdkRoot/);
  assert.match(prepareSharedSdkScript, /@sdkwork\/im-sdk/);
  assert.match(prepareSharedSdkScript, /@sdkwork\/rtc-sdk/);
  assert.doesNotMatch(prepareSharedSdkScript, retiredChatBrandPattern);
  assert.doesNotMatch(prepareSharedSdkScript, new RegExp(retiredImBackendSourceId));
  assert.match(prepareGitSourcesScript, /['"]clone['"]/);
  assert.match(prepareGitSourcesScript, /FETCH_HEAD/);
  assert.match(prepareGitSourcesScript, /shared-sdk-release-sources\.json/);
  assert.match(prepareGitSourcesScript, /SDKWORK_SHARED_SDK_APP_REPO_URL/);
  assert.match(prepareGitSourcesScript, /SDKWORK_SHARED_SDK_COMMON_REPO_URL/);
  assert.match(prepareGitSourcesScript, /SDKWORK_SHARED_SDK_CORE_REPO_URL/);
  assert.match(prepareGitSourcesScript, /SDKWORK_SHARED_SDK_IM_REPO_URL/);
  assert.match(prepareGitSourcesScript, /SDKWORK_SHARED_SDK_RTC_REPO_URL/);
  assert.match(prepareGitSourcesScript, /https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-sdk-app\.git/);
  assert.match(prepareGitSourcesScript, /https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-sdk-commons\.git/);
  assert.match(prepareGitSourcesScript, /https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-core\.git/);
  assert.match(prepareGitSourcesScript, /https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-im-sdk\.git/);
  assert.match(prepareGitSourcesScript, /https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-rtc-sdk\.git/);
  assert.doesNotMatch(prepareGitSourcesScript, retiredChatBrandPattern);
  assert.match(prepareGitSourcesScript, /SHARED_SDK_GIT_FORCE_SYNC_ENV_VAR/);
  assert.match(prepareGitSourcesScript, /syncExistingSourceRepo/);
  assert.doesNotMatch(prepareGitSourcesScript, /vendor\/shared-sdk/);
  assert.doesNotMatch(prepareGitSourcesScript, /materializePackageRootFromVendoredSource/);
  assert.match(nodeTypeScriptRunner, /--experimental-transform-types/);
  assert.match(nodeTypeScriptRunner, /--disable-warning=ExperimentalWarning/);
  assert.match(nodeTypeScriptRunner, /ts-extension-loader\.mjs/);
  assert.match(coreCheckRunner, /runNodeTypeScriptChecks/);
  assert.match(coreCheckRunner, /sdkwork-core-contract\.test\.ts/);
  assert.match(coreCheckRunner, /clawHubService\.test\.ts/);
  assert.match(coreCheckRunner, /accountService\.test\.ts/);
  assert.match(coreCheckRunner, /communityService\.test\.ts/);
  assert.match(coreCheckRunner, /updateService\.test\.ts/);
  assert.match(coreCheckRunner, /openClawProviderRequestDraftService\.test\.ts/);
  assert.match(coreCheckRunner, /openClawAgentCatalogService\.test\.ts/);
  assert.match(coreCheckRunner, /openClawConfigService\.test\.ts/);
  assert.match(coreCheckRunner, /providerRoutingCatalogService\.test\.ts/);
  assert.match(coreCheckRunner, /settingsService\.test\.ts/);
  assert.doesNotMatch(coreCheckRunner, /tsx/);
  assert.match(workspacePackageJson, /"check:sdkwork-auth"\s*:\s*"sdkwork-run-node scripts\/run-sdkwork-auth-check\.mjs"/);
});

runTest('claw workspace tsconfig no longer hard-pins @sdkwork/app-sdk to an external source path', () => {
  const tsconfigBase = read('tsconfig.base.json');

  assert.match(tsconfigBase, /"baseUrl"\s*:\s*"\."/);
  assert.doesNotMatch(tsconfigBase, /"@sdkwork\/app-sdk"/);
});

runTest('claw core runtime wrapper delegates desktop env and session handling to @sdkwork/core-pc-react', () => {
  const workspaceManifest = read('pnpm-workspace.yaml');
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-core/package.json');
  const appSdkSource = read('packages/sdkwork-claw-core/src/sdk/useAppSdkClient.ts');

  assert.match(workspaceManifest, /\.\.\/sdkwork-core\/sdkwork-core-pc-react/);
  assert.equal(pkg.dependencies?.['@sdkwork/core-pc-react'], 'workspace:*');
  assert.match(appSdkSource, /@sdkwork\/core-pc-react\/app/);
  assert.match(appSdkSource, /@sdkwork\/core-pc-react\/runtime/);
  assert.match(appSdkSource, /configurePcReactRuntime/);
  assert.match(appSdkSource, /persistPcReactRuntimeSession/);
  assert.match(appSdkSource, /readPcReactRuntimeSession/);
  assert.match(appSdkSource, /clearPcReactRuntimeSession/);
  assert.match(appSdkSource, /createAppClientConfigFromEnv/);
  assert.match(appSdkSource, /export type AppSdkClient = ReturnType<typeof getAppClient>;/);
  assert.match(appSdkSource, /initAppSdkClient\(overrides: Partial<SdkworkAppConfig> = \{\}\): AppSdkClient/);
  assert.match(appSdkSource, /getAppSdkClient\(\): AppSdkClient/);
  assert.match(appSdkSource, /getAppSdkClientWithSession\(\s*overrides: Partial<SdkworkAppConfig> = \{\},\s*\): AppSdkClient/);
  assert.match(appSdkSource, /useAppSdkClient\(\s*overrides: Partial<SdkworkAppConfig> = \{\},\s*\): AppSdkClient/);
  assert.doesNotMatch(appSdkSource, /initAppSdkClient\(overrides: Partial<SdkworkAppConfig> = \{\}\): SdkworkAppClient/);
  assert.doesNotMatch(appSdkSource, /getAppSdkClient\(\): SdkworkAppClient/);
  assert.doesNotMatch(appSdkSource, /getAppSdkClientWithSession\(\s*overrides: Partial<SdkworkAppConfig> = \{\},\s*\): SdkworkAppClient/);
  assert.doesNotMatch(appSdkSource, /useAppSdkClient\(\s*overrides: Partial<SdkworkAppConfig> = \{\},\s*\): SdkworkAppClient/);
  assert.doesNotMatch(appSdkSource, /createClient\(/);
  assert.doesNotMatch(appSdkSource, /from 'react'/);
  assert.doesNotMatch(appSdkSource, /useMemo/);
  assert.doesNotMatch(appSdkSource, /localStorage/);
  assert.doesNotMatch(appSdkSource, /memoryStorage/);
});

runTest('claw workspace depends on a craw-chat-free core-pc-react root surface', () => {
  const pkg = readJson<{
    dependencies?: Record<string, string>;
    exports?: Record<string, string | Record<string, string>>;
  }>('../sdkwork-core/sdkwork-core-pc-react/package.json');
  const indexSource = read('../sdkwork-core/sdkwork-core-pc-react/src/index.ts');
  const runtimeSource = read('../sdkwork-core/sdkwork-core-pc-react/src/runtime/index.ts');
  const hooksSource = read('../sdkwork-core/sdkwork-core-pc-react/src/hooks/index.ts');

  assert.equal(pkg.dependencies?.['@sdkwork/craw-chat-backend-sdk'], undefined);
  assert.equal(pkg.dependencies?.['@sdkwork/craw-chat-sdk'], undefined);
  assert.equal(pkg.exports?.['./craw-chat'], undefined);
  assert.doesNotMatch(indexSource, /craw-chat\/index/);
  assert.doesNotMatch(runtimeSource, /craw-chat\/index/);
  assert.doesNotMatch(hooksSource, /useCrawChatClient/);
  assert.doesNotMatch(hooksSource, /getCrawChatClient/);
});

runTest('sdkwork-claw-core llm service routes generation through the active instance instead of direct Gemini keys', () => {
  const llmServiceSource = read('packages/sdkwork-claw-core/src/lib/llmService.ts');

  assert.match(llmServiceSource, /instanceStore/);
  assert.match(llmServiceSource, /studio\.getInstance/);
  assert.match(llmServiceSource, /fetch\(/);
  assert.doesNotMatch(llmServiceSource, /useInstanceStore/);
  assert.doesNotMatch(llmServiceSource, /@google\/genai/);
  assert.doesNotMatch(llmServiceSource, /GoogleGenAI/);
  assert.doesNotMatch(llmServiceSource, /process\.env\.GEMINI_API_KEY/);
  assert.doesNotMatch(llmServiceSource, /runtimeKind === 'openclaw'/);
  assert.match(llmServiceSource, /Select or start an AI-compatible instance/);
});

