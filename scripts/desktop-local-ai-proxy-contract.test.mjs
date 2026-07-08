import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const failures = [];

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return null;
  }

  return readFileSync(absolutePath, 'utf8');
}

function assertIncludes(relativePath, expectedText, label) {
  const content = readText(relativePath);
  if (!content) {
    return;
  }

  if (!content.includes(expectedText)) {
    failures.push(`Missing ${label} in ${relativePath}: expected "${expectedText}"`);
  }
}

function assertOrdered(relativePath, beforeText, afterText, label) {
  const content = readText(relativePath);
  if (!content) {
    return;
  }

  const beforeIndex = content.indexOf(beforeText);
  const afterIndex = content.indexOf(afterText);
  if (beforeIndex === -1 || afterIndex === -1 || beforeIndex >= afterIndex) {
    failures.push(
      `Missing ordered ${label} in ${relativePath}: expected "${beforeText}" before "${afterText}"`,
    );
  }
}

assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod local_ai_proxy;',
  'local ai proxy module export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'pub local_ai_proxy: LocalAiProxyService,',
  'framework services local ai proxy field',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'local_ai_proxy: LocalAiProxyService::new(),',
  'framework services local ai proxy initialization',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'pub fn ensure_local_ai_proxy_ready(',
  'framework services local ai proxy ensure function',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  '.ensure_local_ai_proxy_ready(&context.paths, &context.config)',
  'bundled openclaw activation local ai proxy ensure call',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  '.ensure_local_ai_proxy_ready(&state.paths, &state.config_snapshot())?;',
  'tray background restart local ai proxy ensure call',
);
assertOrdered(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  '.configure_openclaw_gateway(&runtime)',
  '.ensure_local_ai_proxy_ready(&context.paths, &context.config)',
  'gateway configuration before local ai proxy projection',
);
assertOrdered(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  '.ensure_local_ai_proxy_ready(&context.paths, &context.config)',
  '.ensure_desktop_kernel_running(&context.paths, &context.config)',
  'local ai proxy readiness before desktop kernel ensure',
);
assertOrdered(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  '.ensure_local_ai_proxy_ready(&state.paths, &state.config_snapshot())?;',
  '.restart_openclaw_gateway(&state.paths)?;',
  'tray local ai proxy sync before openclaw gateway restart',
);
assertIncludes(
  'packages/sdkwork-clawstudio-settings/src/kernelCenterView.ts',
  'resolveLocalAiProxyPortValue',
  'kernel center local ai proxy port helper',
);
assertIncludes(
  'packages/sdkwork-clawstudio-settings/src/KernelCenter.tsx',
  'settings.kernelCenter.sections.localAiProxy',
  'kernel center local ai proxy section',
);
assertIncludes(
  'packages/sdkwork-clawstudio-settings/src/KernelCenter.tsx',
  'dashboard?.localAiProxy',
  'kernel center local ai proxy dashboard access',
);
assertIncludes(
  'packages/sdkwork-clawstudio-settings/src/KernelCenter.tsx',
  'localAiProxy.defaultRoutes.map',
  'kernel center protocol default route rendering',
);
assertIncludes(
  'packages/sdkwork-clawstudio-settings/src/services/kernelCenterService.ts',
  'defaultRoutes: info?.localAiProxy?.defaultRoutes ?? []',
  'kernel center service protocol default route mapping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'defaultRoutes: RuntimeDesktopLocalAiProxyDefaultRouteInfo[];',
  'runtime local ai proxy default routes contract',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/mod.rs',
  'default_routes: health',
  'rust desktop local ai proxy default route mapping',
);
assertIncludes(
  'packages/sdkwork-clawstudio-i18n/src/locales/en.json',
  '"localAiProxy"',
  'english kernel center local ai proxy locale key',
);
assertIncludes(
  'packages/sdkwork-clawstudio-i18n/src/locales/zh.json',
  '"localAiProxy"',
  'chinese kernel center local ai proxy locale key',
);

if (failures.length > 0) {
  console.error('Desktop local AI proxy contract failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Desktop local AI proxy contract passed.');
