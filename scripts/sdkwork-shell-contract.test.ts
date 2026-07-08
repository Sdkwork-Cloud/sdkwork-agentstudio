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

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-clawstudio-shell keeps retained secondary routes addressable while the primary chrome stays simplified', () => {
  const shellPackage = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-clawstudio-shell/package.json',
  );
  const routesSource = read('packages/sdkwork-clawstudio-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read('packages/sdkwork-clawstudio-shell/src/application/router/routePaths.ts');
  const routePrefetchSource = read('packages/sdkwork-clawstudio-shell/src/application/router/routePrefetch.ts');
  const sidebarSource = read('packages/sdkwork-clawstudio-shell/src/components/Sidebar.tsx');
  const settingsSource = read('packages/sdkwork-clawstudio-settings/src/GeneralSettings.tsx');
  const commandPaletteSource = read('packages/sdkwork-clawstudio-shell/src/components/commandPaletteCommands.ts');

  assert.equal(shellPackage.dependencies?.['@sdkwork/clawstudio-agent'], 'workspace:*');
  assert.match(routePathsSource, /AGENTS: '\/agents'/);
  assert.match(routePathsSource, /KERNEL: '\/kernel'/);
  assert.match(routePathsSource, /NODES: '\/nodes'/);
  assert.match(routePathsSource, /USAGE: '\/usage'/);
  assert.match(routesSource, /path="\/agents"/);
  assert.match(routesSource, /path="\/kernel"/);
  assert.match(routesSource, /path="\/nodes"/);
  assert.match(routesSource, /path="\/usage"/);
  assert.match(routePrefetchSource, /\['\/kernel', \(\) => import\('@sdkwork\/claw-settings'\)\]/);
  assert.match(routePrefetchSource, /\['\/nodes', \(\) => import\('@sdkwork\/claw-instances'\)\]/);
  assert.doesNotMatch(routePrefetchSource, /\['\/agents', \(\) => import\('@sdkwork\/claw-agent'\)\]/);
  assert.doesNotMatch(sidebarSource, /id: 'agents'/);
  assert.doesNotMatch(settingsSource, /id: 'agents', label: t\('sidebar\.agentMarket'\)/);
  assert.match(sidebarSource, /id: 'instances'/);
  assert.match(sidebarSource, /id: 'docs'/);
  assert.doesNotMatch(sidebarSource, /id: 'kernel'/);
  assert.doesNotMatch(sidebarSource, /id: 'nodes'/);
  assert.doesNotMatch(sidebarSource, /id: 'usage'/);
  assert.match(settingsSource, /id: 'instances', label: t\('sidebar\.instances'\)/);
  assert.doesNotMatch(settingsSource, /id: 'kernel', label: t\('sidebar\.kernelCenter'\)/);
  assert.doesNotMatch(settingsSource, /id: 'nodes', label: t\('sidebar\.nodes'\)/);
  assert.doesNotMatch(settingsSource, /id: 'usage', label: t\('sidebar\.usage'\)/);
  assert.doesNotMatch(commandPaletteSource, /id: 'nav-agents'/);
  assert.doesNotMatch(commandPaletteSource, /id: 'action-terminal'/);
  assert.doesNotMatch(commandPaletteSource, /Terminal opened/);
  assert.match(commandPaletteSource, /id: 'nav-kernel'/);
  assert.match(commandPaletteSource, /id: 'nav-nodes'/);
  assert.match(commandPaletteSource, /id: 'nav-usage'/);
});

runTest('sdkwork-clawstudio-shell fully removes app store, third-party catalog, and commerce surfaces from retained host entrypoints', () => {
  const routesSource = read('packages/sdkwork-clawstudio-shell/src/application/router/AppRoutes.tsx');
  const routePathsSource = read('packages/sdkwork-clawstudio-shell/src/application/router/routePaths.ts');
  const routePrefetchSource = read('packages/sdkwork-clawstudio-shell/src/application/router/routePrefetch.ts');
  const sidebarSource = read('packages/sdkwork-clawstudio-shell/src/components/Sidebar.tsx');
  const settingsSource = read('packages/sdkwork-clawstudio-settings/src/GeneralSettings.tsx');
  const commandPaletteSource = read('packages/sdkwork-clawstudio-shell/src/components/commandPaletteCommands.ts');
  const headerSource = read('packages/sdkwork-clawstudio-shell/src/components/AppHeader.tsx');
  const trayBridgeSource = read('packages/sdkwork-clawstudio-desktop/src/desktop/bootstrap/DesktopTrayRouteBridge.tsx');
  const desktopBootstrapSource = read('packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs');
  const shellPackageSource = read('packages/sdkwork-clawstudio-shell/package.json');

  for (const source of [
    routesSource,
    routePathsSource,
    routePrefetchSource,
    sidebarSource,
    settingsSource,
    commandPaletteSource,
    trayBridgeSource,
    desktopBootstrapSource,
    shellPackageSource,
  ]) {
    assert.doesNotMatch(source, /\/apps\b/);
    assert.doesNotMatch(source, /\/market\b/);
    assert.doesNotMatch(source, /\/mall\b/);
    assert.doesNotMatch(source, /\/github\b/);
    assert.doesNotMatch(source, /\/huggingface\b/);
    assert.doesNotMatch(source, /\/model-purchase\b/);
    assert.doesNotMatch(source, /\/points\b/);
    assert.doesNotMatch(source, /@sdkwork\/claw-(apps|github|huggingface|mall|market|model-purchase|points)/);
  }

  assert.doesNotMatch(headerSource, /PointsHeaderEntry/);
  assert.doesNotMatch(desktopBootstrapSource, /open_apps/);
});

runTest('sdkwork-clawstudio-shell migrates persisted sidebar visibility away from removed ecosystem ids', () => {
  const appStoreSource = read('packages/sdkwork-clawstudio-core/src/stores/useAppStore.ts');

  assert.match(appStoreSource, /const SIDEBAR_VISIBILITY_VERSION = 5;/);
  assert.match(appStoreSource, /const DEFAULT_HIDDEN_SIDEBAR_ITEMS = \['extensions'\] as const;/);
  assert.match(appStoreSource, /item !== 'apps'/);
  assert.match(appStoreSource, /item !== 'market'/);
  assert.match(appStoreSource, /item !== 'mall'/);
  assert.match(appStoreSource, /item !== 'github'/);
  assert.match(appStoreSource, /item !== 'huggingface'/);
  assert.match(appStoreSource, /item !== 'model-purchase'/);
  assert.match(appStoreSource, /item !== 'points'/);
});

runTest('sdkwork-clawstudio-shell keeps header chrome focused on search, mobile guide, and account controls', () => {
  const headerSource = read('packages/sdkwork-clawstudio-shell/src/components/AppHeader.tsx');

  assert.match(headerSource, /MobileAppDownloadDialog|install\.mobileGuide\.headerAction/);
  assert.match(headerSource, /OPEN_COMMAND_PALETTE_EVENT|commandPalette\.searchPlaceholder/);
  assert.match(headerSource, /sidebar\.userMenu\.profileSettings/);
  assert.match(headerSource, /sidebar\.userMenu\.logout/);
  assert.match(headerSource, /DesktopWindowControls variant="header"/);
  assert.doesNotMatch(headerSource, /InstanceSwitcher/);
  assert.doesNotMatch(headerSource, /@sdkwork\/claw-points/);
});

runTest('sdkwork-clawstudio-shell keeps auth routes isolated while workspace chrome owns retained navigation surfaces', () => {
  const layoutSource = read('packages/sdkwork-clawstudio-shell/src/application/layouts/MainLayout.tsx');
  const routesSource = read('packages/sdkwork-clawstudio-shell/src/application/router/AppRoutes.tsx');
  const sidebarSource = read('packages/sdkwork-clawstudio-shell/src/components/Sidebar.tsx');

  assert.match(routesSource, /path="\/login"/);
  assert.match(routesSource, /path="\/register"/);
  assert.match(routesSource, /path="\/forgot-password"/);
  assert.match(routesSource, /path="\/login\/oauth\/callback\/:provider"/);
  assert.match(layoutSource, /isAuthRoute/);
  assert.match(sidebarSource, /data-slot="sidebar-user-control"/);
  assert.match(sidebarSource, /data-slot="sidebar-edge-control"/);
  assert.match(sidebarSource, /data-slot="sidebar-resize-handle"/);
});

runTest('sdkwork-clawstudio-shell keeps sidebar labels color-aligned with sidebar icons across expanded and collapsed navigation items', () => {
  const sidebarSource = read('packages/sdkwork-clawstudio-shell/src/components/Sidebar.tsx');

  assert.match(sidebarSource, /function getSidebarNavToneClasses\(isActive: boolean\)/);
  assert.match(sidebarSource, /labelClassName=\{tone\.label\}/);
  assert.match(sidebarSource, /className=\{`h-5 w-5 shrink-0 transition-colors \$\{tone\.icon\}`\}/);
  assert.match(sidebarSource, /className=\{`text-\[14px\] tracking-tight \$\{tone\.label\}`\}/);
  assert.match(sidebarSource, /text-primary-700 dark:text-primary-400/);
  assert.match(sidebarSource, /text-zinc-600 group-hover:text-zinc-950 dark:text-zinc-500 dark:group-hover:text-zinc-300/);
  assert.doesNotMatch(sidebarSource, /labelClassName=\{isActive \? 'text-primary-200' : undefined\}/);
});

runTest('sdkwork-clawstudio-shell keeps sidebar light by default and scopes deep chrome to dark mode', () => {
  const sidebarSource = read('packages/sdkwork-clawstudio-shell/src/components/Sidebar.tsx');

  assert.match(sidebarSource, /border-r border-zinc-200 bg-zinc-50\/95 text-zinc-700/);
  assert.match(
    sidebarSource,
    /dark:border-zinc-900\/90 dark:bg-\[linear-gradient\(180deg,_#13151a_0%,_#0b0c10_100%\)\] dark:text-zinc-300/,
  );
  assert.doesNotMatch(
    sidebarSource,
    /border-r border-zinc-900\/90 bg-\[linear-gradient\(180deg,_#13151a_0%,_#0b0c10_100%\)\] text-zinc-300/,
  );
  assert.match(sidebarSource, /hover:bg-zinc-950\/\[0\.045\] dark:hover:bg-white\/\[0\.05\]/);
  assert.match(sidebarSource, /border border-zinc-200 bg-white text-zinc-700/);
  assert.match(sidebarSource, /dark:border-white\/8 dark:bg-white\/\[0\.04\] dark:text-zinc-300/);
});

runTest('sdkwork-clawstudio-shell binds dark variants to the theme manager dark class and exposes the full theme color catalog', () => {
  const themeManagerSource = read('packages/sdkwork-clawstudio-shell/src/application/providers/ThemeManager.tsx');
  const shellStylesSource = read('packages/sdkwork-clawstudio-shell/src/styles/index.css');
  const generalSettingsSource = read('packages/sdkwork-clawstudio-settings/src/GeneralSettings.tsx');
  const appStoreSource = read('packages/sdkwork-clawstudio-core/src/stores/useAppStore.ts');

  assert.match(themeManagerSource, /root\.classList\.add\('dark'\)/);
  assert.match(themeManagerSource, /root\.classList\.remove\('dark'\)/);
  assert.match(shellStylesSource, /@custom-variant dark\s*\(&:where\(\.dark,\s*\.dark \*\)\);/);
  assert.match(shellStylesSource, /\[data-theme="tech-blue"\]/);
  assert.match(shellStylesSource, /\[data-theme="lobster"\]/);
  assert.match(shellStylesSource, /\[data-theme="green-tech"\]/);
  assert.match(shellStylesSource, /\[data-theme="zinc"\]/);
  assert.match(shellStylesSource, /\[data-theme="violet"\]/);
  assert.match(shellStylesSource, /\[data-theme="rose"\]/);
  assert.match(generalSettingsSource, /id: 'tech-blue'/);
  assert.match(appStoreSource, /themeColor: 'tech-blue'/);
});

runTest('sdkwork-clawstudio-shell gives light mode a flat graphite enterprise theme without changing layout source', () => {
  const shellStylesSource = read('packages/sdkwork-clawstudio-shell/src/styles/index.css');
  const layoutSource = read('packages/sdkwork-clawstudio-shell/src/application/layouts/MainLayout.tsx');

  assert.match(shellStylesSource, /--theme-neutral-50: #fafafa;/);
  assert.match(shellStylesSource, /--theme-neutral-950: #09090b;/);
  assert.match(shellStylesSource, /--theme-surface-base: #f3f3f4;/);
  assert.match(shellStylesSource, /--theme-surface-raised: #ffffff;/);
  assert.match(shellStylesSource, /--theme-surface-muted: #eeeeef;/);
  assert.match(shellStylesSource, /--theme-surface-dialog: #ffffff;/);
  assert.match(shellStylesSource, /--theme-dialog-overlay: rgba\(17, 17, 19, 0\.24\);/);
  assert.match(shellStylesSource, /--theme-dialog-border: rgba\(9, 9, 11, 0\.1\);/);
  assert.match(shellStylesSource, /--theme-dialog-shadow: 0 22px 54px rgba\(9, 9, 11, 0\.09\);/);
  assert.match(shellStylesSource, /--theme-border-subtle: transparent;/);
  assert.match(shellStylesSource, /--theme-border-strong: rgba\(9, 9, 11, 0\.06\);/);
  assert.match(shellStylesSource, /--theme-text-strong: #111111;/);
  assert.doesNotMatch(shellStylesSource, /--theme-neutral-50: #f8fafc;/);
  assert.doesNotMatch(shellStylesSource, /--theme-surface-base: #f5f7fb;/);
  assert.doesNotMatch(shellStylesSource, /--theme-border-subtle: #d9e2ef;/);
  assert.match(shellStylesSource, /\[data-theme="tech-blue"\][\s\S]*--theme-primary-500: #2864c8;/);
  assert.match(shellStylesSource, /\.dark\[data-theme="tech-blue"\][\s\S]*--theme-primary-500: #3b82f6;/);
  assert.match(shellStylesSource, /html:not\(\.dark\) body/);
  assert.match(shellStylesSource, /html:not\(\.dark\) \.bg-zinc-100/);
  assert.match(shellStylesSource, /html:not\(\.dark\) \.text-zinc-950/);
  assert.match(shellStylesSource, /html:not\(\.dark\) \.border-zinc-200/);
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.bg-zinc-50[\s\S]*?background-color: var\(--theme-surface-raised\);/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.bg-white[\s\S]*?background-color: var\(--theme-surface-raised\);/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.shadow-sm[\s\S]*?box-shadow: none;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.shadow-xl[\s\S]*?box-shadow: none;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.shadow-\\\[18px_0_50px_rgba\\\(15\\,23\\,42\\,0\\.08\\\)\\\][\s\S]*?box-shadow: none;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\^="shadow-"\][\s\S]*?html:not\(\.dark\) \[class\*=":shadow-"\][\s\S]*?box-shadow: none !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[data-slot='dialog-overlay'\][\s\S]*?background-color: var\(--theme-dialog-overlay\) !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[data-slot='dialog-content'\][\s\S]*?background-color: var\(--theme-surface-dialog\) !important;[\s\S]*?border-color: var\(--theme-dialog-border\) !important;[\s\S]*?box-shadow: var\(--theme-dialog-shadow\) !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[data-slot='overlay-backdrop'\][\s\S]*?background-color: var\(--theme-dialog-overlay\) !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[data-slot\^='overlay-surface-'\][\s\S]*?background-color: var\(--theme-surface-dialog\) !important;[\s\S]*?border-color: var\(--theme-dialog-border\) !important;[\s\S]*?box-shadow: var\(--theme-dialog-shadow\) !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="shadow-primary-"\][\s\S]*?box-shadow: none !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.drop-shadow-sm[\s\S]*?filter: none !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="drop-shadow-"\][\s\S]*?filter: none !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.border-zinc-200[\s\S]*?border-color: transparent;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="border-zinc-200"\][\s\S]*?border-color: transparent !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="border-zinc-100"\][\s\S]*?border-color: transparent !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="border-zinc-300"\][\s\S]*?border-color: var\(--theme-border-strong\) !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.divide-zinc-100 > :not\(\[hidden\]\) ~ :not\(\[hidden\]\)[\s\S]*?border-color: transparent;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.ring-zinc-200[\s\S]*?(?:--tw-ring-color|border-color): transparent;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.divide-zinc-200 > :not\(\[hidden\]\) ~ :not\(\[hidden\]\)[\s\S]*?border-color: transparent;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class~="border-dashed"\]\[class~="border-zinc-300"\][\s\S]*?html:not\(\.dark\) \[class~="border-dashed"\]\[class~="border-zinc-300\\\/80"\][\s\S]*?border-color: transparent;/,
  );
  assert.doesNotMatch(shellStylesSource, /\[class\*="border-dashed"\]\[class\*="border-zinc-"\]/);
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \.border-white\\\/70[\s\S]*?border-color: transparent;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="ring-primary-"\][\s\S]*?--tw-ring-color: transparent !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="border-primary-"\][\s\S]*?border-color: transparent !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="border-amber-"\][\s\S]*?border-color: transparent !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) :where\(input, textarea, select\)[\s\S]*?border-color: transparent !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="bg-\\\[radial-gradient"\][\s\S]*?background-image: none !important;/,
  );
  assert.match(
    shellStylesSource,
    /html:not\(\.dark\) \[class\*="bg-\\\[linear-gradient"\][\s\S]*?background-image: none !important;/,
  );
  assert.match(
    shellStylesSource,
    /\n  \[data-chat-scroll-region='messages'\] \{[\s\S]*?--chat-scrollbar-track: var\(--theme-surface-muted\);[\s\S]*?--chat-scrollbar-thumb: color-mix\(in srgb, var\(--theme-neutral-400\) 82%, var\(--theme-neutral-500\) 18%\);/,
  );
  assert.doesNotMatch(
    shellStylesSource,
    /\n  \[data-chat-scroll-region='messages'\] \{[\s\S]*?var\(--theme-primary-(?:100|500)\)/,
  );
  assert.doesNotMatch(
    shellStylesSource,
    /html:not\(\.dark\) \.(?:bg-zinc-50|bg-white|hover\\:bg-zinc-50|hover\\:bg-zinc-900)[\s\S]*?background-color: color-mix\(in srgb,[^;]*var\(--theme-primary-(?:50|100)\)/,
  );
  assert.doesNotMatch(
    shellStylesSource,
    /html:not\(\.dark\) \.(?:shadow-sm|shadow-md|shadow-lg|shadow-xl|shadow-2xl|shadow-\\\[)[\s\S]*?rgba\(9, 9, 11, 0\.(?:1[0-9]|2[0-9]|3[0-9])\)/,
  );
  assert.doesNotMatch(
    shellStylesSource,
    /html:not\(\.dark\) [^{]*radial-gradient\(circle_at_(?:top|left)/,
  );
  assert.doesNotMatch(shellStylesSource, /html:not\(\.dark\) \.grid-cols/);
  assert.doesNotMatch(shellStylesSource, /html:not\(\.dark\) \.space-y-/);
  assert.match(layoutSource, /bg-zinc-100 text-zinc-900 font-sans/);
  assert.match(
    layoutSource,
    /dark:bg-\[radial-gradient\(circle_at_top,_rgba\(59,130,246,0\.16\),_transparent_68%\)\]/,
  );
  assert.match(
    layoutSource,
    /dark:bg-\[radial-gradient\(circle_at_left,_rgba\(255,255,255,0\.04\),_transparent_72%\)\]/,
  );
});
