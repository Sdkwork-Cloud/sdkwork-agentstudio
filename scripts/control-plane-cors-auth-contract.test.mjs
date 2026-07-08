import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
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

const packageJson = readJson('package.json');
const routerSource = read('packages/sdkwork-clawstudio-server/src-host/src/http/router.rs');
const httpModSource = read('packages/sdkwork-clawstudio-server/src-host/src/http/mod.rs');
const mainSource = read('packages/sdkwork-clawstudio-server/src-host/src/main.rs');

runTest('server http module exposes a dedicated cors policy helper instead of the old broad claw route mirroring', () => {
  assert.match(httpModSource, /pub mod cors_policy;/);
  assert.match(routerSource, /cors_policy/);
  assert.doesNotMatch(routerSource, /request\.uri\(\)\.path\(\)\.starts_with\("\/claw\/"\)/);
});

runTest('server integration tests lock remote origins out of control-plane surfaces', () => {
  assert.match(
    mainSource,
    /desktop_combined_hosted_startup_preflight_rejects_remote_origins_for_control_plane_surfaces/,
  );
  assert.match(
    mainSource,
    /desktop_combined_hosted_startup_preflight_stays_blocked_for_non_browser_internal_routes/,
  );
});

runTest('automation gate freezes the control-plane cors/auth contract', () => {
  assert.match(
    packageJson.scripts['check:automation'] ?? '',
    /sdkwork-run-node scripts\/control-plane-cors-auth-contract\.test\.mjs/,
  );
});
