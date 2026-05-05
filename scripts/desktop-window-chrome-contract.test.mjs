import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function readText(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('desktop shell hides native window chrome in favor of a custom title bar', () => {
  const tauriConfig = readJson('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json');
  const mainWindow = tauriConfig.app?.windows?.[0];

  assert.equal(mainWindow?.decorations, false);
  assert.equal(mainWindow?.visible, false);
  assert.equal(mainWindow?.fullscreen, false);
});

runTest('desktop shell keeps title-bar window controls in the shared desktop bridge component', () => {
  const bridgeSource = readText('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const controlsSource = readText('packages/sdkwork-claw-core/src/components/DesktopWindowControls.tsx');
  const headerSource = readText('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const startupSource = readText(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopStartupScreen.tsx',
  );

  assert.match(bridgeSource, /minimizeWindow/);
  assert.match(bridgeSource, /maximizeWindow/);
  assert.match(bridgeSource, /restoreWindow/);
  assert.match(bridgeSource, /isWindowMaximized/);
  assert.match(bridgeSource, /unmaximize/);
  assert.match(bridgeSource, /isMaximized/);
  assert.match(bridgeSource, /closeWindow/);
  assert.match(controlsSource, /restoreWindow/);
  assert.match(controlsSource, /isWindowMaximized/);
  assert.match(headerSource, /DesktopWindowControls/);
  assert.match(headerSource, /variant="header"/);
  assert.match(headerSource, /mode\?: 'default' \| 'auth' \| 'window-controls'/);
  assert.match(startupSource, /import \{ AppHeader \} from '@sdkwork\/claw-shell';/);
  assert.match(startupSource, /<AppHeader\s+mode="window-controls"/);
  assert.match(startupSource, /windowControlLabels=\{getStartupWindowControlLabels\(language\)\}/);
  assert.doesNotMatch(startupSource, /StartupWindowControls/);
  assert.doesNotMatch(startupSource, /WindowControlButton/);
  assert.doesNotMatch(startupSource, /from '\.\.\/tauriBridge'/);
  assert.doesNotMatch(startupSource, /restoreWindow/);
  assert.doesNotMatch(startupSource, /isWindowMaximized/);
});

runTest('desktop startup keeps the initial window at the configured default size', () => {
  const bootstrapSource = readText(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );

  assert.doesNotMatch(bootstrapSource, /setFullscreen\(true\)/);
});

runTest('desktop shell grants custom title-bar window permissions through a real capability file', () => {
  const capabilityRelativePath =
    'packages/sdkwork-claw-desktop/src-tauri/capabilities/default.json';
  const capabilityPath = path.join(rootDir, capabilityRelativePath);

  assert.equal(
    existsSync(capabilityPath),
    true,
    `expected ${capabilityRelativePath} to exist`,
  );

  const capability = readJson(capabilityRelativePath);

  assert.equal(capability.identifier, 'default');
  assert.deepEqual(capability.windows, ['main']);
  assert.ok(Array.isArray(capability.permissions));
  assert.ok(capability.permissions.includes('core:default'));
  assert.ok(capability.permissions.includes('core:window:allow-start-dragging'));
  assert.ok(capability.permissions.includes('core:window:allow-internal-toggle-maximize'));
  assert.ok(capability.permissions.includes('core:window:allow-hide'));
  assert.ok(capability.permissions.includes('core:window:allow-is-fullscreen'));
  assert.ok(capability.permissions.includes('core:window:allow-maximize'));
  assert.ok(capability.permissions.includes('core:window:allow-minimize'));
  assert.ok(capability.permissions.includes('core:window:allow-is-maximized'));
  assert.ok(capability.permissions.includes('core:window:allow-is-minimized'));
  assert.ok(capability.permissions.includes('core:window:allow-is-visible'));
  assert.ok(capability.permissions.includes('core:window:allow-show'));
  assert.ok(capability.permissions.includes('core:window:allow-set-focus'));
  assert.ok(capability.permissions.includes('core:window:allow-set-fullscreen'));
  assert.ok(capability.permissions.includes('core:window:allow-toggle-maximize'));
  assert.ok(capability.permissions.includes('core:window:allow-unmaximize'));
  assert.ok(capability.permissions.includes('core:window:allow-unminimize'));
  assert.ok(capability.permissions.includes('core:window:allow-close'));
});

runTest('desktop capability stays aligned with the window APIs used by the desktop host', () => {
  const capability = readJson('packages/sdkwork-claw-desktop/src-tauri/capabilities/default.json');
  const bridgeSource = readText('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const bootstrapSource = readText(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );

  assert.match(bridgeSource, /currentWindow\.hide\(\)/);
  assert.match(bridgeSource, /currentWindow\.minimize\(\)/);
  assert.match(bridgeSource, /currentWindow\.maximize\(\)/);
  assert.match(bridgeSource, /currentWindow\.unmaximize\(\)/);
  assert.match(bridgeSource, /currentWindow\.isMaximized\(\)/);
  assert.match(bridgeSource, /currentWindow\.isFullscreen\(\)/);
  assert.match(bridgeSource, /currentWindow\.isMinimized\(\)/);
  assert.match(bridgeSource, /currentWindow\.isVisible\(\)/);
  assert.match(bridgeSource, /currentWindow\.setFullscreen\(false\)/);
  assert.match(bridgeSource, /currentWindow\.show\(\)/);
  assert.match(bridgeSource, /currentWindow\.unminimize\(\)/);
  assert.match(bridgeSource, /currentWindow\.setFocus\(\)/);
  assert.match(bootstrapSource, /desktopWindow\.show\(\)/);
  assert.match(bootstrapSource, /desktopWindow\.setFocus\(\)/);

  const requiredPermissions = [
    'core:default',
    'core:window:allow-hide',
    'core:window:allow-is-fullscreen',
    'core:window:allow-is-maximized',
    'core:window:allow-is-minimized',
    'core:window:allow-is-visible',
    'core:window:allow-maximize',
    'core:window:allow-minimize',
    'core:window:allow-set-focus',
    'core:window:allow-set-fullscreen',
    'core:window:allow-show',
    'core:window:allow-unmaximize',
    'core:window:allow-unminimize',
  ];

  for (const permission of requiredPermissions) {
    assert.ok(
      capability.permissions.includes(permission),
      `expected desktop capability to include ${permission}`,
    );
  }
});

runTest('desktop shell keeps header interactions outside the drag region hitbox', () => {
  const headerSource = readText('packages/sdkwork-claw-shell/src/components/AppHeader.tsx');
  const switcherSource = readText('packages/sdkwork-claw-shell/src/components/InstanceSwitcher.tsx');

  assert.match(headerSource, /data-tauri-drag-region="false"/);
  assert.match(switcherSource, /data-tauri-drag-region="false"/);
  assert.doesNotMatch(headerSource, /<header[^>]*data-tauri-drag-region/);
  assert.match(headerSource, /h-12/);
});

runTest('desktop runtime detection supports Tauri v2 window APIs without relying on withGlobalTauri', () => {
  const runtimeSource = readText('packages/sdkwork-claw-desktop/src/desktop/runtime.ts');
  const tauriConfig = readJson('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json');

  assert.match(runtimeSource, /isTauri/);
  assert.equal(tauriConfig.app?.withGlobalTauri, undefined);
  assert.match(runtimeSource, /__TAURI_INTERNALS__/);
  assert.match(runtimeSource, /typeof tauriInternals\.invoke === 'function'/);
});

runTest('desktop startup host avoids StrictMode replays for one-shot window bootstrap side effects', () => {
  const bootstrapSource = readText(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
  );

  assert.match(bootstrapSource, /createRoot/);
  assert.match(bootstrapSource, /<DesktopBootstrapApp/);
  assert.doesNotMatch(bootstrapSource, /StrictMode/);
});

runTest('desktop tray route bridge stays host-local and drives navigation through browser history', () => {
  const bridgeSource = readText(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopTrayRouteBridge.tsx',
  );

  assert.doesNotMatch(bridgeSource, /react-router-dom/);
  assert.doesNotMatch(bridgeSource, /ROUTE_PATHS\.INSTALL/);
  assert.match(bridgeSource, /ROUTE_PATHS\.DASHBOARD/);
  assert.doesNotMatch(bridgeSource, /ROUTE_PATHS\.APPS/);
  assert.match(bridgeSource, /ROUTE_PATHS\.INSTANCES/);
  assert.match(bridgeSource, /ROUTE_PATHS\.TASKS/);
  assert.match(bridgeSource, /window\.history\.pushState/);
  assert.match(bridgeSource, /new PopStateEvent\('popstate'\)/);
  assert.match(bridgeSource, /window\.__CLAW_PENDING_TRAY_ROUTE__/);
  assert.match(bridgeSource, /DESKTOP_EVENTS\.trayNavigate/);
});

runTest('desktop bridge exposes host language sync for tray localization', () => {
  const catalogSource = readText('packages/sdkwork-claw-desktop/src/desktop/catalog.ts');
  const bridgeSource = readText('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const indexSource = readText('packages/sdkwork-claw-desktop/src/index.ts');
  const appProvidersSource = readText(
    'packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx',
  );
  const languageManagerSource = readText(
    'packages/sdkwork-claw-shell/src/application/providers/LanguageManager.tsx',
  );
  const bootstrapSource = readText(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const settingsSource = readText('packages/sdkwork-claw-settings/src/GeneralSettings.tsx');
  const appStoreSource = readText('packages/sdkwork-claw-core/src/stores/useAppStore.ts');

  assert.match(catalogSource, /setAppLanguage: 'set_app_language'/);
  assert.match(bridgeSource, /export async function setAppLanguage/);
  assert.match(bridgeSource, /DESKTOP_COMMANDS\.setAppLanguage/);
  assert.match(indexSource, /setAppLanguage/);
  assert.match(appProvidersSource, /onLanguagePreferenceChange\?:/);
  assert.match(languageManagerSource, /languagePreference/);
  assert.match(languageManagerSource, /onLanguagePreferenceChange\?\.\(languagePreference\)/);
  assert.doesNotMatch(languageManagerSource, /getRuntimePlatform\(\)\.setAppLanguage/);
  assert.match(bootstrapSource, /handleLanguagePreferenceChange/);
  assert.match(bootstrapSource, /void setAppLanguage\(languagePreference\);/);
  assert.match(settingsSource, /languagePreference/);
  assert.match(settingsSource, /value="system"/);
  assert.match(appStoreSource, /languagePreference/);
  assert.match(appStoreSource, /type LanguagePreference = Language \| 'system'/);
});
