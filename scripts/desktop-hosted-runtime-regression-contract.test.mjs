import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const packageJson = JSON.parse(
  readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
);
const desktopCheckScript = packageJson.scripts?.['check:desktop'] ?? '';
const tauriBridgeSource = readFileSync(
  path.join(
    rootDir,
    'packages',
    'sdkwork-claw-desktop',
    'src',
    'desktop',
    'tauriBridge.ts',
  ),
  'utf8',
);

assert.match(
  desktopCheckScript,
  /packages\/sdkwork-claw-desktop\/src\/desktop\/desktopHostedBridge\.test\.ts/,
  'check:desktop must execute the desktop hosted bridge regression suite',
);
assert.match(
  desktopCheckScript,
  /packages\/sdkwork-claw-desktop\/src\/desktop\/desktopHostRuntimeResolver\.test\.ts/,
  'check:desktop must execute the desktop host runtime resolver regression suite',
);
assert.match(
  desktopCheckScript,
  /packages\/sdkwork-claw-desktop\/src\/desktop\/bootstrap\/DesktopBootstrapApp\.test\.ts/,
  'check:desktop must execute the desktop bootstrap readiness regression suite',
);
assert.match(
  desktopCheckScript,
  /packages\/sdkwork-claw-desktop\/src\/desktop\/bootstrap\/desktopStartupEvidence\.test\.ts/,
  'check:desktop must execute the desktop startup evidence regression suite',
);
assert.match(
  desktopCheckScript,
  /node scripts\/run-cargo\.mjs test --manifest-path packages\/sdkwork-claw-desktop\/src-tauri\/Cargo\.toml(?: [^&]+)? embedded_host_bootstrap_exposes_structured_browser_bootstrap_descriptor/,
  'check:desktop must execute the Rust embedded host bootstrap descriptor regression',
);
assert.match(
  desktopCheckScript,
  /node scripts\/run-cargo\.mjs test --manifest-path packages\/sdkwork-claw-desktop\/src-tauri\/Cargo\.toml(?: [^&]+)? embedded_host_bootstrap_exposes_canonical_server_route_families/,
  'check:desktop must execute the Rust embedded host canonical route regression',
);
assert.doesNotMatch(
  desktopCheckScript,
  /node --test .*desktopHostRuntimeResolver\.test\.ts/,
  'desktop host runtime resolver regressions must run without node --test subprocess spawning',
);
assert.doesNotMatch(
  desktopCheckScript,
  /node --test .*DesktopBootstrapApp\.test\.ts/,
  'desktop bootstrap regressions must run without node --test subprocess spawning',
);
assert.doesNotMatch(
  desktopCheckScript,
  /embedded_host_bootstrap_exposes_structured_browser_bootstrap_descriptor -- --exact/,
  'desktop embedded host bootstrap descriptor regressions must not use cargo --exact filtering that skips the target test path',
);
assert.doesNotMatch(
  desktopCheckScript,
  /embedded_host_bootstrap_exposes_canonical_server_route_families -- --exact/,
  'desktop embedded host canonical route regressions must not use cargo --exact filtering that skips the target test path',
);
const retryTimeoutMatch = tauriBridgeSource.match(
  /const DESKTOP_HOSTED_RUNTIME_READINESS_RETRY_TIMEOUT_MS = ([\d_]+);/,
);
assert.ok(
  retryTimeoutMatch,
  'desktop hosted runtime readiness retry timeout must stay declared as a numeric constant',
);
assert.ok(
  Number(retryTimeoutMatch[1].replaceAll('_', '')) >= 15_000,
  'desktop packaged runtime readiness must tolerate 9s-class bundled OpenClaw startup before surfacing a background failure',
);

console.log(
  'ok - desktop hosted runtime regressions are wired into the mandatory desktop check',
);
