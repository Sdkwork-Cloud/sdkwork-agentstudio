import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const foundationCheckSource = readFileSync(
  path.join(rootDir, 'scripts', 'check-desktop-platform-foundation.mjs'),
  'utf8',
);

assert.match(
  foundationCheckSource,
  /packages\/sdkwork-agentstudio-pc-desktop\/src-tauri\/tauri\.linux\.conf\.json/,
  'desktop platform foundation check must require the Linux Tauri bundle override config',
);
assert.match(
  foundationCheckSource,
  /packages\/sdkwork-agentstudio-pc-desktop\/src-tauri\/tauri\.macos\.conf\.json/,
  'desktop platform foundation check must require the macOS Tauri bundle override config',
);
assert.match(
  foundationCheckSource,
  /packages\/sdkwork-agentstudio-pc-desktop\/src-tauri\/linux-postinstall-openclaw\.sh/,
  'desktop platform foundation check must require the Linux OpenClaw postinstall hook script',
);
assert.match(
  foundationCheckSource,
  /scripts\/run-cargo\.mjs/,
  'desktop platform foundation check must require the shared Rust toolchain launcher for desktop cargo checks',
);
assert.match(
  foundationCheckSource,
  /shared Rust toolchain launcher/,
  'desktop platform foundation check must report an actionable desktop cargo launcher failure',
);
assert.match(
  foundationCheckSource,
  /'foundation\/components\/'/,
  'desktop platform foundation check must validate directory resource roots instead of recursive glob patterns',
);
assert.match(
  foundationCheckSource,
  /'generated\/bundled\/'/,
  'desktop platform foundation check must validate the generated desktop resource directory root',
);
assert.match(
  foundationCheckSource,
  /'\.\.\/dist\/'/,
  'desktop platform foundation check must validate the packaged frontend dist directory root',
);
assert.match(
  foundationCheckSource,
  /'resources\/openclaw\/'/,
  'desktop platform foundation check must validate the packaged OpenClaw resource directory root',
);
assert.match(
  foundationCheckSource,
  /generated\/release\/openclaw-resource\//,
  'desktop platform foundation check must validate the packaged archive-only OpenClaw release resource bridge',
);
assert.match(
  foundationCheckSource,
  /generated\/release\/macos-install-root\//,
  'desktop platform foundation check must validate the preexpanded macOS OpenClaw install-root layout',
);
assert.match(
  foundationCheckSource,
  /linux-postinstall-openclaw\.sh/,
  'desktop platform foundation check must validate the Linux postinstall hook reference',
);
assert.match(
  foundationCheckSource,
  /installerHooks/,
  'desktop platform foundation check must validate that Windows installer hooks are not wired after the external-runtime hard cut',
);
assert.match(
  foundationCheckSource,
  /postInstallScript/,
  'desktop platform foundation check must validate that Linux postinstall hooks are not wired after the external-runtime hard cut',
);
assert.match(
  foundationCheckSource,
  /Legacy Windows OpenClaw installer hooks must be removed after the external-runtime hard cut\./,
  'desktop platform foundation check must reject legacy Windows installer hook assets after the external-runtime hard cut',
);
assert.match(
  foundationCheckSource,
  /Legacy Linux OpenClaw postinstall hook must be removed after the external-runtime hard cut\./,
  'desktop platform foundation check must reject legacy Linux postinstall hook assets after the external-runtime hard cut',
);
assert.match(
  foundationCheckSource,
  /Desktop Linux deb packaging must not wire a legacy OpenClaw postinstall script\./,
  'desktop platform foundation check must reject legacy Linux deb postinstall script wiring',
);
assert.match(
  foundationCheckSource,
  /Desktop Linux rpm packaging must not wire a legacy OpenClaw postinstall script\./,
  'desktop platform foundation check must reject legacy Linux rpm postinstall script wiring',
);
assert.match(
  foundationCheckSource,
  /Desktop Windows Tauri config must not wire legacy OpenClaw installer hooks\./,
  'desktop platform foundation check must reject legacy Windows NSIS installer-hook wiring',
);
assert.match(
  foundationCheckSource,
  /\['bridge-web-dist', 'web-dist', \['generated', 'br', 'w'\], true\]/,
  'desktop platform foundation check must validate the Windows NSIS web-dist bridge rewrite contract with resolved-target support',
);
assert.match(
  foundationCheckSource,
  /\['bridge-openclaw', 'openclaw', \['generated', 'br', 'o'\], false\]/,
  'desktop platform foundation check must validate the Windows NSIS OpenClaw bridge rewrite contract against the stable short-path alias root',
);

console.log('ok - desktop platform foundation check covers cross-platform OpenClaw packaging constraints');
