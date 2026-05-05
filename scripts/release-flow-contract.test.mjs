import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve(import.meta.dirname, '..');
const desktopBundleOverlayConfig = path.join(
  'src-tauri',
  'generated',
  'tauri.bundle.overlay.json',
);
const desktopLinuxTauriConfig = path.join(
  'src-tauri',
  'tauri.linux.conf.json',
);
const desktopMacosTauriConfig = path.join(
  'src-tauri',
  'tauri.macos.conf.json',
);
const desktopPackageDir = path.join('packages', 'sdkwork-claw-desktop');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('desktop release inputs keep the Windows Tauri installer config under version control', (t) => {
  const trackedFiles = spawnSync(
    'git',
    ['ls-files', 'packages/sdkwork-claw-desktop/src-tauri/tauri.windows.conf.json'],
    {
      cwd: rootDir,
      encoding: 'utf8',
      shell: false,
    },
  );

  if (trackedFiles.error?.code === 'EPERM') {
    t.skip('sandbox blocks git child processes; cannot verify tracked-file status through git');
    return;
  }

  assert.equal(trackedFiles.error, undefined);
  assert.equal(trackedFiles.status, 0);
  assert.match(
    trackedFiles.stdout,
    /packages\/sdkwork-claw-desktop\/src-tauri\/tauri\.windows\.conf\.json/,
    'release verification must not depend on an untracked local tauri.windows.conf.json file',
  );
});

test('repository exposes a cross-platform claw-studio release workflow', () => {
  const workflowPath = path.join(rootDir, '.github', 'workflows', 'release.yml');
  const reusableWorkflowPath = path.join(rootDir, '.github', 'workflows', 'release-reusable.yml');
  assert.equal(existsSync(workflowPath), true, 'missing .github/workflows/release.yml');
  assert.equal(existsSync(reusableWorkflowPath), true, 'missing .github/workflows/release-reusable.yml');

  const workflow = read('.github/workflows/release.yml');
  const reusableWorkflow = read('.github/workflows/release-reusable.yml');
  const gitSourcePreparationCount =
    reusableWorkflow.match(/node scripts\/prepare-shared-sdk-git-sources\.mjs/g)?.length ?? 0;
  const sharedSdkPreparationCount =
    reusableWorkflow.match(/pnpm prepare:shared-sdk/g)?.length ?? 0;

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /push:\s*[\s\S]*tags:\s*[\s\S]*release-\*/);
  assert.match(workflow, /package_profile:/);
  assert.match(workflow, /uses:\s*\.\/\.github\/workflows\/release-reusable\.yml/);
  assert.match(workflow, /release_profile:\s*claw-studio/);
  assert.match(workflow, /package_profile:\s*\$\{\{ github\.event_name == 'push' && 'openclaw-only' \|\| github\.event\.inputs\.package_profile \}\}/);
  assert.match(
    workflow,
    /permissions:\s*[\s\S]*packages:\s*write/,
    'release caller workflow must grant packages: write to the reusable release workflow',
  );
  assert.match(reusableWorkflow, /workflow_call:/);
  assert.match(reusableWorkflow, /package_profile:/);
  assert.match(reusableWorkflow, /concurrency:/);
  assert.match(reusableWorkflow, /release-\$\{\{ inputs\.release_profile \}\}-\$\{\{ inputs\.package_profile \}\}-\$\{\{ inputs\.release_tag \}\}/);
  assert.match(reusableWorkflow, /packages:\s*write/);
  assert.match(reusableWorkflow, /SDKWORK_SHARED_SDK_MODE:\s*git/);
  assert.match(reusableWorkflow, /verify-release:/);
  assert.match(reusableWorkflow, /Prepare shared SDK sources/);
  assert.doesNotMatch(
    reusableWorkflow,
    /SDKWORK_SHARED_SDK_GIT_REF:\s*main/,
    'release workflow must not float shared SDK resolution on a remote main branch',
  );
  assert.doesNotMatch(
    reusableWorkflow,
    /SDKWORK_SHARED_SDK_APP_REPO_URL:/,
    'release workflow should be self-contained and must not require an external app SDK repo URL',
  );
  assert.doesNotMatch(
    reusableWorkflow,
    /SDKWORK_SHARED_SDK_COMMON_REPO_URL:/,
    'release workflow should be self-contained and must not require an external common SDK repo URL',
  );
  assert.equal(gitSourcePreparationCount, 5);
  assert.match(reusableWorkflow, /pnpm install --frozen-lockfile/);
  assert.equal(sharedSdkPreparationCount, 5);
  assert.match(reusableWorkflow, /submodules:\s*recursive/);
  assert.match(reusableWorkflow, /libgtk-3-dev/);
  assert.match(reusableWorkflow, /libpipewire-0\.3-dev/);
  assert.match(reusableWorkflow, /libssl-dev/);
  assert.match(reusableWorkflow, /libfuse2t64/);
  assert.match(reusableWorkflow, /libgbm-dev/);
  assert.match(reusableWorkflow, /file/);
  assert.match(reusableWorkflow, /pkg-config/);
  assert.match(reusableWorkflow, /libwayland-dev/);
  assert.match(reusableWorkflow, /libxkbcommon-dev/);
  assert.match(reusableWorkflow, /pnpm check:server/);
  assert.match(reusableWorkflow, /pnpm build/);
  assert.match(reusableWorkflow, /pnpm docs:build/);
  assert.match(reusableWorkflow, /package_profile_id: \$\{\{ steps\.plan\.outputs\.package_profile_id \}\}/);
  assert.match(reusableWorkflow, /package_profile_included_kernel_ids: \$\{\{ steps\.plan\.outputs\.package_profile_included_kernel_ids \}\}/);
  assert.match(reusableWorkflow, /node scripts\/release\/resolve-release-plan\.mjs --profile \$\{\{ inputs\.release_profile \}\} --package-profile \$\{\{ inputs\.package_profile \}\}/);
  assert.match(reusableWorkflow, /server_matrix: \$\{\{ steps\.plan\.outputs\.server_matrix \}\}/);
  assert.match(reusableWorkflow, /container_matrix: \$\{\{ steps\.plan\.outputs\.container_matrix \}\}/);
  assert.match(reusableWorkflow, /kubernetes_matrix: \$\{\{ steps\.plan\.outputs\.kubernetes_matrix \}\}/);
  assert.match(reusableWorkflow, /node scripts\/run-desktop-release-build\.mjs --profile \$\{\{ inputs\.release_profile \}\} --package-profile \$\{\{ needs\.prepare\.outputs\.package_profile_id \}\} --phase sync --target \$\{\{ matrix\.target \}\} --release/);
  assert.match(reusableWorkflow, /node scripts\/run-desktop-release-build\.mjs --profile \$\{\{ inputs\.release_profile \}\} --package-profile \$\{\{ needs\.prepare\.outputs\.package_profile_id \}\} --phase prepare-target --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /if: contains\(needs\.prepare\.outputs\.package_profile_included_kernel_ids, 'openclaw'\)[\s\S]*node scripts\/run-desktop-release-build\.mjs --profile \$\{\{ inputs\.release_profile \}\} --package-profile \$\{\{ needs\.prepare\.outputs\.package_profile_id \}\} --phase prepare-openclaw --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /node scripts\/run-desktop-release-build\.mjs --profile \$\{\{ inputs\.release_profile \}\} --package-profile \$\{\{ needs\.prepare\.outputs\.package_profile_id \}\} --phase bundle --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /node scripts\/release\/package-release-assets\.mjs desktop --profile \$\{\{ inputs\.release_profile \}\} --package-profile \$\{\{ needs\.prepare\.outputs\.package_profile_id \}\} --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\}/);
  assert.match(
    reusableWorkflow,
    /desktop-release:[\s\S]*apt-get install -y[\s\S]*xvfb/s,
    'desktop release workflow must install xvfb so Linux packaged launch smoke can run headlessly',
  );
  assert.match(
    reusableWorkflow,
    /desktop-release:[\s\S]*package-release-assets\.mjs desktop --profile \$\{\{ inputs\.release_profile \}\} --package-profile \$\{\{ needs\.prepare\.outputs\.package_profile_id \}\} --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --output-dir artifacts\/release[\s\S]*smoke-desktop-installers\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --release-assets-dir artifacts\/release/s,
    'desktop release workflow must smoke packaged installers before attesting and uploading artifacts',
  );
  assert.match(
    reusableWorkflow,
    /desktop-release:[\s\S]*smoke-desktop-installers\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --release-assets-dir artifacts\/release[\s\S]*smoke-desktop-packaged-launch\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --release-assets-dir artifacts\/release[\s\S]*actions\/attest-build-provenance@v3/s,
    'desktop release workflow must smoke packaged launch startup after installer smoke and before attesting artifacts',
  );
  assert.match(reusableWorkflow, /server-release:/);
  assert.match(reusableWorkflow, /container-release:/);
  assert.match(reusableWorkflow, /kubernetes-release:/);
  assert.match(
    reusableWorkflow,
    /container-release:[\s\S]*docker\/setup-buildx-action@/,
    'container release workflow must provision buildx before publishing OCI images',
  );
  assert.match(
    reusableWorkflow,
    /container-release:[\s\S]*docker\/login-action@/,
    'container release workflow must authenticate to the OCI registry before pushing images',
  );
  assert.match(
    reusableWorkflow,
    /container-release:[\s\S]*docker\/build-push-action@/,
    'container release workflow must build and push the published server image',
  );
  assert.match(
    reusableWorkflow,
    /container-image-metadata-\$\{\{ matrix\.arch \}\}/,
    'release workflow must persist published image metadata by architecture for downstream packaging',
  );
  assert.match(reusableWorkflow, /pnpm server:build/);
  assert.match(reusableWorkflow, /node scripts\/run-claw-server-build\.mjs --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /node scripts\/release\/package-release-assets\.mjs server --profile \$\{\{ inputs\.release_profile \}\} --release-tag \$\{\{ needs\.prepare\.outputs\.release_tag \}\} --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\}/);
  assert.match(reusableWorkflow, /node scripts\/release\/package-release-assets\.mjs container --profile \$\{\{ inputs\.release_profile \}\} --release-tag \$\{\{ needs\.prepare\.outputs\.release_tag \}\} --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --accelerator \$\{\{ matrix\.accelerator \}\}/);
  assert.match(reusableWorkflow, /node scripts\/release\/package-release-assets\.mjs kubernetes --profile \$\{\{ inputs\.release_profile \}\} --release-tag \$\{\{ needs\.prepare\.outputs\.release_tag \}\} --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --accelerator \$\{\{ matrix\.accelerator \}\}/);
  assert.match(
    reusableWorkflow,
    /kubernetes-release:[\s\S]*needs:\s*\[\s*prepare,\s*verify-release,\s*container-release\s*\]/,
    'kubernetes packaging must wait for the OCI image publication metadata',
  );
  assert.match(
    reusableWorkflow,
    /kubernetes-release:[\s\S]*actions\/download-artifact@v4[\s\S]*container-image-metadata-\$\{\{ matrix\.arch \}\}/,
    'kubernetes packaging must download the published image metadata for the current architecture',
  );
  assert.match(
    reusableWorkflow,
    /package-release-assets\.mjs kubernetes[\s\S]*--image-repository \$\{\{ steps\.[^.]+\.outputs\.image_repository \}\}[\s\S]*--image-tag \$\{\{ steps\.[^.]+\.outputs\.image_tag \}\}[\s\S]*--image-digest \$\{\{ steps\.[^.]+\.outputs\.image_digest \}\}/,
    'kubernetes release packaging must stamp repository, tag, and digest from the published OCI image metadata',
  );
  assert.match(reusableWorkflow, /node scripts\/release\/package-release-assets\.mjs web --profile \$\{\{ inputs\.release_profile \}\}/);
  assert.match(reusableWorkflow, /node scripts\/release\/finalize-release-assets\.mjs --profile \$\{\{ inputs\.release_profile \}\}/);
  assert.match(
    reusableWorkflow,
    /node scripts\/release\/render-release-notes\.mjs --release-tag \$\{\{ needs\.prepare\.outputs\.release_tag \}\} --output release-assets\/release-notes\.md/,
  );
  assert.match(reusableWorkflow, /actions\/attest-build-provenance@v3/);
  assert.match(reusableWorkflow, /attestations:\s*write/);
  assert.match(reusableWorkflow, /id-token:\s*write/);
  assert.match(reusableWorkflow, /softprops\/action-gh-release@/);
  assert.match(reusableWorkflow, /body_path:\s*release-assets\/release-notes\.md/);
  assert.doesNotMatch(reusableWorkflow, /generate_release_notes:\s*true/);
  assert.match(reusableWorkflow, /CMAKE_GENERATOR:\s*Visual Studio 17 2022/);
  assert.match(reusableWorkflow, /needs:\s*\[\s*prepare,\s*verify-release\s*\]/);
  assert.match(reusableWorkflow, /-\s*server-release/);
  assert.match(reusableWorkflow, /-\s*container-release/);
  assert.match(reusableWorkflow, /-\s*kubernetes-release/);
});

test('desktop tauri build script stays clean of removed sdkwork-api-router artifact handling', () => {
  const buildScript = read('packages/sdkwork-claw-desktop/src-tauri/build.rs');

  assert.match(buildScript, /generated\/bundled/);
  assert.match(buildScript, /placeholder\.txt/);
  assert.doesNotMatch(buildScript, /sdkwork-api-router/);
});

test('root package exposes release helper scripts for desktop and asset packaging', () => {
  const rootPackage = JSON.parse(read('package.json'));
  const releaseClosureScriptPath = path.join(rootDir, 'scripts', 'check-release-closure.mjs');

  assert.match(
    rootPackage.scripts['check:multi-mode'],
    /sdkwork-run-pnpm check:desktop && sdkwork-run-pnpm check:server && sdkwork-run-pnpm check:sdkwork-host-runtime && sdkwork-run-pnpm check:desktop-openclaw-runtime && sdkwork-run-pnpm check:release-flow/,
    'root package must expose one unified multi-mode verification command for desktop, server, deployment runtime, OpenClaw readiness, and release packaging',
  );
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release-flow-contract\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release-deployment-contract\.test\.mjs/);
  assert.equal(existsSync(releaseClosureScriptPath), true, 'missing scripts/check-release-closure.mjs');
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/check-release-closure\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/release-profiles\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/kernel-definitions\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/run-desktop-release-build\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/run-claw-server-build\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/release-smoke-contract\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/finalize-release-assets\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/smoke-deployment-release-assets\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/smoke-server-release-assets\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/smoke-desktop-installers\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/smoke-desktop-packaged-launch\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/smoke-desktop-startup-evidence\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/local-release-command\.test\.mjs/);
  assert.match(rootPackage.scripts['check:release-flow'], /sdkwork-run-node scripts\/release\/render-release-notes\.mjs --help/);
  assert.match(rootPackage.scripts['check:ci-flow'], /sdkwork-run-node scripts\/ci-flow-contract\.test\.mjs/);
  assert.match(
    rootPackage.scripts['check:automation'],
    /sdkwork-run-node scripts\/openclaw-quality-gate-contract\.test\.mjs/,
  );
  assert.match(rootPackage.scripts['check:automation'], /sdkwork-run-pnpm check:release-flow && sdkwork-run-pnpm check:ci-flow/);
  assert.match(rootPackage.scripts['lint'], /sdkwork-run-pnpm check:automation/);
  assert.match(rootPackage.scripts['check:shared-sdk-release-parity'], /sdkwork-run-node scripts\/check-shared-sdk-release-parity\.mjs/);
  assert.match(rootPackage.scripts['check:server'], /sdkwork-run-node scripts\/check-server-platform-foundation\.mjs/);
  assert.match(rootPackage.scripts['check:server'], /sdkwork-run-node scripts\/run-cargo\.mjs test --manifest-path packages\/sdkwork-claw-server\/src-host\/Cargo\.toml/);
  assert.match(
    rootPackage.scripts['check:desktop-openclaw-runtime'],
    /sdkwork-run-node scripts\/verify-desktop-openclaw-release-assets\.test\.mjs/,
    'desktop OpenClaw runtime checks must include the dedicated release asset verifier test',
  );
  assert.match(
    rootPackage.scripts['check:desktop'],
    /sdkwork-run-node scripts\/verify-desktop-openclaw-release-assets\.test\.mjs/,
    'desktop verification must include the dedicated OpenClaw release asset verifier test',
  );
  assert.match(
    rootPackage.scripts['check:release-flow'],
    /node scripts\/verify-desktop-openclaw-release-assets\.test\.mjs/,
    'release flow verification must include the dedicated OpenClaw release asset verifier test',
  );
  assert.match(rootPackage.scripts['build:web'], /sdkwork-run-pnpm prepare:shared-sdk && sdkwork-run-pnpm --filter @sdkwork\/claw-web build/);
  assert.match(rootPackage.scripts['build:server'], /sdkwork-run-node scripts\/run-claw-server-build\.mjs/);
  assert.match(
    rootPackage.scripts['build:desktop-host'],
    /sdkwork-run-pnpm --dir packages\/sdkwork-claw-desktop build:prod/,
  );
  assert.match(
    rootPackage.scripts['build:desktop'],
    /sdkwork-run-pnpm --dir packages\/sdkwork-claw-desktop tauri:build:prod/,
  );
  assert.match(
    rootPackage.scripts['package:desktop'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs package desktop/,
  );
  assert.match(
    rootPackage.scripts['package:server'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs package server/,
  );
  assert.match(rootPackage.scripts['release:desktop'], /sdkwork-run-node scripts\/run-desktop-release-build\.mjs/);
  assert.match(rootPackage.scripts['release:plan'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs plan/);
  assert.match(rootPackage.scripts['release:package:desktop'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs package desktop/);
  assert.match(rootPackage.scripts['release:package:server'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs package server/);
  assert.match(rootPackage.scripts['release:package:container'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs package container/);
  assert.match(rootPackage.scripts['release:package:kubernetes'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs package kubernetes/);
  assert.match(rootPackage.scripts['release:package:web'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs package web/);
  assert.match(rootPackage.scripts['release:smoke:desktop'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs smoke desktop/);
  assert.match(rootPackage.scripts['release:smoke:desktop-packaged-launch'], /sdkwork-run-node scripts\/release\/smoke-desktop-packaged-launch\.mjs/);
  assert.match(rootPackage.scripts['release:smoke:desktop-startup'], /sdkwork-run-node scripts\/release\/smoke-desktop-startup-evidence\.mjs/);
  assert.match(rootPackage.scripts['release:smoke:server'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs smoke server/);
  assert.match(rootPackage.scripts['release:smoke:container'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs smoke container/);
  assert.match(rootPackage.scripts['release:smoke:kubernetes'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs smoke kubernetes/);
  assert.match(rootPackage.scripts['release:finalize'], /sdkwork-run-node scripts\/release\/local-release-command\.mjs finalize/);
  assert.match(rootPackage.scripts['server:build'], /sdkwork-run-node scripts\/run-claw-server-build\.mjs/);
});

test('release closure guard passes against the committed release packaging contracts', () => {
  const releaseClosureCheck = spawnSync(process.execPath, ['scripts/check-release-closure.mjs'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (releaseClosureCheck.error?.code === 'EPERM') {
    return import(pathToFileURL(path.join(rootDir, 'scripts', 'check-release-closure.mjs')).href)
      .then((module) => {
        assert.equal(typeof module.main, 'function');
        module.main();
      });
  }

  assert.equal(
    releaseClosureCheck.status,
    0,
    releaseClosureCheck.stderr || releaseClosureCheck.stdout || 'release closure guard must pass',
  );
});

test('release closure contract documents and guards desktop install-ready smoke evidence', () => {
  const releaseClosureGuard = read('scripts/check-release-closure.mjs');
  const releaseDoc = read('docs/core/release-and-deployment.md');

  assert.match(
    releaseClosureGuard,
    /smoke-desktop-installers/,
    'release closure guard must require the desktop workflow smoke step',
  );
  assert.match(
    releaseClosureGuard,
    /kernelInstallContracts/,
    'release closure guard must protect the persisted desktop kernel install contracts',
  );
  assert.match(
    releaseClosureGuard,
    /desktopInstallerSmoke/,
    'release closure guard must protect aggregated desktop installer smoke metadata',
  );
  assert.match(
    releaseClosureGuard,
    /kernelInstallReadiness/,
    'release closure guard must protect per-kernel install readiness metadata',
  );
  assert.match(
    releaseClosureGuard,
    /installReadyLayout/,
    'release closure guard must protect install-ready layout evidence',
  );
  assert.match(
    releaseClosureGuard,
    /release:smoke:desktop-packaged-launch/,
    'release closure guard must expose the dedicated desktop packaged launch smoke command',
  );
  assert.match(
    releaseClosureGuard,
    /release:smoke:desktop-startup/,
    'release closure guard must expose the dedicated desktop startup smoke command',
  );
  assert.match(
    releaseClosureGuard,
    /desktopStartupSmoke/,
    'release closure guard must protect aggregated desktop startup smoke metadata when it exists',
  );
  assert.match(
    releaseClosureGuard,
    /localAiProxyRuntime/,
    'release closure guard must protect aggregated desktop startup local ai proxy runtime metadata',
  );
  assert.match(
    releaseClosureGuard,
    /desktop-startup-evidence\.json/,
    'release closure guard must protect the captured desktop startup evidence path',
  );

  assert.match(
    releaseDoc,
    /check:multi-mode/,
    'release documentation must expose the unified multi-mode verification command',
  );
  assert.match(
    releaseDoc,
    /versionSourcesAligned/,
    'release documentation must explain when OpenClaw version sources are internally aligned even if no upgrade should run yet',
  );
  assert.match(
    releaseDoc,
    /release:smoke:desktop/,
    'release documentation must expose the desktop smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:desktop-packaged-launch/,
    'release documentation must expose the desktop packaged launch smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:desktop-startup/,
    'release documentation must expose the desktop startup smoke command',
  );
  assert.match(
    releaseDoc,
    /kernelInstallContracts/,
    'release documentation must describe the desktop kernel install contract metadata',
  );
  assert.match(
    releaseDoc,
    /desktopInstallerSmoke/,
    'release documentation must describe aggregated desktop installer smoke metadata',
  );
  assert.match(
    releaseDoc,
    /kernelInstallReadiness/,
    'release documentation must describe per-kernel install readiness metadata',
  );
  assert.match(
    releaseDoc,
    /installReadyLayout/,
    'release documentation must describe install-ready layout evidence',
  );
  assert.match(
    releaseDoc,
    /desktopStartupSmoke/,
    'release documentation must describe aggregated desktop startup smoke metadata',
  );
  assert.match(
    releaseDoc,
    /localAiProxyRuntime/,
    'release documentation must describe aggregated desktop startup local ai proxy runtime metadata',
  );
  assert.match(
    releaseDoc,
    /desktop-startup-evidence\.json/,
    'release documentation must describe the captured desktop startup evidence artifact',
  );
});

test('release closure contract documents and guards packaged server bundle smoke evidence', () => {
  const releaseClosureGuard = read('scripts/check-release-closure.mjs');
  const releaseDoc = read('docs/core/release-and-deployment.md');
  const reusableWorkflow = read('.github/workflows/release-reusable.yml');

  assert.match(
    releaseClosureGuard,
    /release:smoke:server/,
    'release closure guard must require the packaged server smoke command',
  );
  assert.match(
    releaseClosureGuard,
    /serverBundleSmoke/,
    'release closure guard must protect aggregated server bundle smoke metadata',
  );
  assert.match(
    reusableWorkflow,
    /server-release:[\s\S]*package-release-assets\.mjs server[\s\S]*smoke-server-release-assets\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --release-assets-dir artifacts\/release/s,
    'server release workflow must smoke packaged server bundles before attesting and uploading artifacts',
  );
  assert.match(
    releaseDoc,
    /release:smoke:server/,
    'release documentation must expose the server smoke command',
  );
  assert.match(
    releaseDoc,
    /serverBundleSmoke/,
    'release documentation must describe aggregated server bundle smoke metadata',
  );
});

test('release closure contract documents and guards deployment smoke evidence', () => {
  const releaseClosureGuard = read('scripts/check-release-closure.mjs');
  const releaseDoc = read('docs/core/release-and-deployment.md');
  const reusableWorkflow = read('.github/workflows/release-reusable.yml');

  assert.match(
    releaseClosureGuard,
    /release:smoke:container/,
    'release closure guard must require the packaged container smoke command',
  );
  assert.match(
    releaseClosureGuard,
    /release:smoke:kubernetes/,
    'release closure guard must require the packaged kubernetes smoke command',
  );
  assert.match(
    releaseClosureGuard,
    /deploymentSmoke/,
    'release closure guard must protect aggregated deployment smoke metadata',
  );
  assert.match(
    reusableWorkflow,
    /container-release:[\s\S]*package-release-assets\.mjs container[\s\S]*smoke-deployment-release-assets\.mjs --family container --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --accelerator \$\{\{ matrix\.accelerator \}\} --release-assets-dir artifacts\/release/s,
    'container release workflow must smoke packaged deployment bundles before attesting and uploading artifacts',
  );
  assert.match(
    reusableWorkflow,
    /kubernetes-release:[\s\S]*smoke-deployment-release-assets\.mjs --family kubernetes --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --accelerator \$\{\{ matrix\.accelerator \}\} --release-assets-dir artifacts\/release/s,
    'kubernetes release workflow must smoke packaged chart bundles before attesting and uploading artifacts',
  );
  assert.match(
    releaseDoc,
    /release:smoke:container/,
    'release documentation must expose the container smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:kubernetes/,
    'release documentation must expose the kubernetes smoke command',
  );
  assert.match(
    releaseDoc,
    /deploymentSmoke/,
    'release documentation must describe aggregated deployment smoke metadata',
  );
});

test('release closure contract guards unified host runtime smoke evidence', () => {
  const releaseClosureGuard = read('scripts/check-release-closure.mjs');
  const releaseDoc = read('docs/core/release-and-deployment.md');
  const runtimeSmokeReport = read(
    'docs/reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md',
  );

  assert.match(
    releaseClosureGuard,
    /2026-04-05-unified-rust-host-runtime-hardening-smoke\.md/,
    'release closure guard must require the persisted unified host runtime smoke report',
  );
  assert.match(
    releaseClosureGuard,
    /check:sdkwork-host-runtime/,
    'release closure guard must require the runtime authority verification command to stay documented',
  );

  assert.match(
    releaseDoc,
    /check:sdkwork-host-runtime/,
    'release documentation must expose the unified runtime authority verification command',
  );
  assert.match(
    releaseDoc,
    /unified host runtime smoke report/i,
    'release documentation must describe the persisted unified host runtime smoke report',
  );
  assert.match(
    runtimeSmokeReport,
    /Automated Verification/,
    'unified host runtime smoke report must record automated verification evidence',
  );
  assert.match(
    runtimeSmokeReport,
    /Follow-up Manual Checklist/,
    'unified host runtime smoke report must preserve the remaining manual verification checklist',
  );
});

test('release closure contract guards deployment bootstrap smoke evidence', () => {
  const releaseClosureGuard = read('scripts/check-release-closure.mjs');
  const releaseDoc = read('docs/core/release-and-deployment.md');
  const deploymentBootstrapSmokeReport = read(
    'docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md',
  );

  assert.match(
    releaseClosureGuard,
    /2026-04-05-unified-rust-host-deployment-bootstrap-smoke\.md/,
    'release closure guard must require the persisted deployment bootstrap smoke report',
  );
  assert.match(
    releaseClosureGuard,
    /docker compose startup/i,
    'release closure guard must preserve docker compose startup smoke evidence requirements',
  );
  assert.match(
    releaseClosureGuard,
    /singleton-k8s readiness/i,
    'release closure guard must preserve singleton-k8s readiness smoke evidence requirements',
  );

  assert.match(
    releaseDoc,
    /deployment bootstrap smoke report/i,
    'release documentation must describe the persisted deployment bootstrap smoke report',
  );
  assert.match(
    releaseDoc,
    /release:package:container/,
    'release documentation must expose the container packaging command that produces deployment bundles',
  );
  assert.match(
    releaseDoc,
    /release:package:kubernetes/,
    'release documentation must expose the kubernetes packaging command that produces deployment bundles',
  );
  assert.match(
    deploymentBootstrapSmokeReport,
    /Automated Verification/,
    'deployment bootstrap smoke report must preserve automated verification evidence',
  );
  assert.match(
    deploymentBootstrapSmokeReport,
    /docker compose -f deploy\/docker\/docker-compose\.yml up -d/,
    'deployment bootstrap smoke report must preserve docker compose startup commands',
  );
  assert.match(
    deploymentBootstrapSmokeReport,
    /helm upgrade --install claw-studio \.\/chart -f values\.release\.yaml/,
    'deployment bootstrap smoke report must preserve singleton-k8s install commands',
  );
});

test('shared sdk mode helper defaults to source mode and supports git trunk release mode', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'shared-sdk-mode.mjs');
  assert.equal(existsSync(helperPath), true, 'missing scripts/shared-sdk-mode.mjs');

  const helper = await import(pathToFileURL(helperPath).href);
  assert.equal(typeof helper.resolveSharedSdkMode, 'function');
  assert.equal(typeof helper.isSharedSdkSourceMode, 'function');
  assert.equal(typeof helper.SHARED_SDK_MODE_ENV_VAR, 'string');

  assert.equal(helper.SHARED_SDK_MODE_ENV_VAR, 'SDKWORK_SHARED_SDK_MODE');
  assert.equal(helper.resolveSharedSdkMode({}), 'source');
  assert.equal(helper.resolveSharedSdkMode({ SDKWORK_SHARED_SDK_MODE: 'source' }), 'source');
  assert.equal(helper.resolveSharedSdkMode({ SDKWORK_SHARED_SDK_MODE: 'git' }), 'git');
  assert.equal(helper.isSharedSdkSourceMode({}), true);
  assert.equal(helper.isSharedSdkSourceMode({ SDKWORK_SHARED_SDK_MODE: 'git' }), false);
});

test('shared sdk package preparation resolves the workspace root consistently from repo root and package directories', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-packages.mjs');
  assert.equal(existsSync(helperPath), true, 'missing scripts/prepare-shared-sdk-packages.mjs');

  const helper = await import(pathToFileURL(helperPath).href);
  assert.equal(typeof helper.resolveWorkspaceRootDir, 'function');
  assert.equal(typeof helper.createSharedSdkPackageContext, 'function');
  assert.equal(typeof helper.resolveCanonicalWorkspaceRootDir, 'function');

  const packageDir = path.join(rootDir, 'packages', 'sdkwork-claw-web');
  const expectedWorkspaceRoot = rootDir;
  const expectedCanonicalWorkspaceRoot = rootDir.includes(`${path.sep}.worktrees${path.sep}`)
    ? path.resolve(rootDir, '..', '..')
    : rootDir;
  const worktreePackageDir = path.join(
    expectedWorkspaceRoot,
    '.worktrees',
    'synthetic-worktree',
    'packages',
    'sdkwork-claw-web',
  );
  assert.equal(helper.resolveWorkspaceRootDir(rootDir), expectedWorkspaceRoot);
  assert.equal(helper.resolveWorkspaceRootDir(packageDir), expectedWorkspaceRoot);
  assert.equal(helper.resolveWorkspaceRootDir(worktreePackageDir), expectedWorkspaceRoot);
  assert.equal(helper.resolveCanonicalWorkspaceRootDir(packageDir), expectedCanonicalWorkspaceRoot);

  assert.deepEqual(
    helper.createSharedSdkPackageContext({
      currentWorkingDir: packageDir,
      env: { SDKWORK_SHARED_SDK_MODE: 'git' },
    }),
    {
      workspaceRoot: expectedWorkspaceRoot,
      canonicalWorkspaceRoot: expectedCanonicalWorkspaceRoot,
      sharedAppSdkRoot: path.resolve(
        expectedCanonicalWorkspaceRoot,
        '../../spring-ai-plus-app-api/sdkwork-sdk-app/sdkwork-app-sdk-typescript',
      ),
      sharedSdkCommonRoot: path.resolve(
        expectedCanonicalWorkspaceRoot,
        '../../sdk/sdkwork-sdk-commons/sdkwork-sdk-common-typescript',
      ),
      sharedImSdkRoot: path.resolve(
        expectedCanonicalWorkspaceRoot,
        '../craw-chat/sdks/sdkwork-im-sdk/sdkwork-im-sdk-typescript',
      ),
      sharedRtcSdkRoot: path.resolve(
        expectedCanonicalWorkspaceRoot,
        '../craw-chat/sdks/sdkwork-rtc-sdk/sdkwork-rtc-sdk-typescript',
      ),
      mode: 'git',
    },
  );
  assert.match(
    read('scripts/prepare-shared-sdk-packages.mjs'),
    /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*main\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
  );
});

test('shared sdk package preparation repairs package-local dependency links from the existing workspace install', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-packages.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.resolveWorkspaceInstalledPackageRoot, 'function');
  assert.equal(typeof helper.ensurePackageDependencyLinks, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-shared-sdk-links-'));
  const workspaceRoot = path.join(tempRoot, 'apps', 'claw-studio');
  const sharedAppSdkRoot = path.join(
    tempRoot,
    'spring-ai-plus-app-api',
    'sdkwork-sdk-app',
    'sdkwork-app-sdk-typescript',
  );
  const sharedSdkCommonRoot = path.join(
    tempRoot,
    'sdk',
    'sdkwork-sdk-commons',
    'sdkwork-sdk-common-typescript',
  );

  const writeWorkspaceInstalledPackage = (packageName, version = '1.0.0') => {
    const pnpmPackageDir = path.join(
      workspaceRoot,
      'node_modules',
      '.pnpm',
      `${packageName.replace('/', '+')}@${version}`,
      'node_modules',
      ...packageName.split('/'),
    );

    mkdirSync(pnpmPackageDir, { recursive: true });
    writeFileSync(
      path.join(pnpmPackageDir, 'package.json'),
      JSON.stringify({ name: packageName, version }, null, 2),
      'utf8',
    );

    return pnpmPackageDir;
  };

  mkdirSync(workspaceRoot, { recursive: true });
  writeFileSync(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/claw-workspace' }, null, 2),
    'utf8',
  );
  writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages: []\n', 'utf8');

  mkdirSync(sharedAppSdkRoot, { recursive: true });
  writeFileSync(
    path.join(sharedAppSdkRoot, 'package.json'),
    JSON.stringify(
      {
        name: '@sdkwork/app-sdk',
        dependencies: {
          '@sdkwork/sdk-common': '^1.0.2',
        },
        devDependencies: {
          '@types/node': '^20.0.0',
          typescript: '^5.3.0',
          vite: '^7.0.0',
          'vite-plugin-dts': '^4.0.0',
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  mkdirSync(path.join(sharedSdkCommonRoot, 'dist'), { recursive: true });
  writeFileSync(
    path.join(sharedSdkCommonRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/sdk-common', version: '1.0.2' }, null, 2),
    'utf8',
  );
  writeFileSync(path.join(sharedSdkCommonRoot, 'dist', 'index.js'), 'export {};\n', 'utf8');

  const expectedTargets = new Map([
    ['@sdkwork/sdk-common', sharedSdkCommonRoot],
    ['@types/node', writeWorkspaceInstalledPackage('@types/node', '20.19.39')],
    ['typescript', writeWorkspaceInstalledPackage('typescript', '6.0.2')],
    ['vite', writeWorkspaceInstalledPackage('vite', '7.3.1')],
    ['vite-plugin-dts', writeWorkspaceInstalledPackage('vite-plugin-dts', '4.5.4')],
  ]);

  try {
    const repairedPackages = helper.ensurePackageDependencyLinks(sharedAppSdkRoot, workspaceRoot, {
      localPackageRoots: {
        '@sdkwork/sdk-common': sharedSdkCommonRoot,
      },
    });

    assert.deepEqual(
      repairedPackages.sort(),
      Array.from(expectedTargets.keys()).sort(),
    );

    for (const [packageName, expectedTarget] of expectedTargets) {
      const linkPath = path.join(sharedAppSdkRoot, 'node_modules', ...packageName.split('/'));

      assert.equal(existsSync(linkPath), true, `missing link for ${packageName}`);
      assert.equal(
        realpathSync(linkPath),
        realpathSync(expectedTarget),
        `unexpected target for ${packageName}`,
      );
      assert.equal(
        helper.resolveWorkspaceInstalledPackageRoot(packageName, workspaceRoot),
        packageName === '@sdkwork/sdk-common' ? null : expectedTarget,
      );
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('shared sdk package preparation preserves existing package-local dependency installs while repairing only missing links', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-packages.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-shared-sdk-preserve-links-'));
  const workspaceRoot = path.join(tempRoot, 'apps', 'claw-studio');
  const sharedAppSdkRoot = path.join(
    tempRoot,
    'spring-ai-plus-app-api',
    'sdkwork-sdk-app',
    'sdkwork-app-sdk-typescript',
  );
  const sharedSdkCommonRoot = path.join(
    tempRoot,
    'sdk',
    'sdkwork-sdk-commons',
    'sdkwork-sdk-common-typescript',
  );

  const writeWorkspaceInstalledPackage = (packageName, version = '1.0.0') => {
    const pnpmPackageDir = path.join(
      workspaceRoot,
      'node_modules',
      '.pnpm',
      `${packageName.replace('/', '+')}@${version}`,
      'node_modules',
      ...packageName.split('/'),
    );

    mkdirSync(pnpmPackageDir, { recursive: true });
    writeFileSync(
      path.join(pnpmPackageDir, 'package.json'),
      JSON.stringify({ name: packageName, version }, null, 2),
      'utf8',
    );

    return pnpmPackageDir;
  };

  mkdirSync(workspaceRoot, { recursive: true });
  writeFileSync(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/claw-workspace' }, null, 2),
    'utf8',
  );
  writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages: []\n', 'utf8');

  mkdirSync(sharedAppSdkRoot, { recursive: true });
  writeFileSync(
    path.join(sharedAppSdkRoot, 'package.json'),
    JSON.stringify(
      {
        name: '@sdkwork/app-sdk',
        dependencies: {
          '@sdkwork/sdk-common': '^1.0.2',
        },
        devDependencies: {
          '@types/node': '^20.0.0',
          typescript: '^5.3.0',
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  mkdirSync(sharedSdkCommonRoot, { recursive: true });
  writeFileSync(
    path.join(sharedSdkCommonRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/sdk-common', version: '1.0.2' }, null, 2),
    'utf8',
  );

  const existingTypeScriptInstall = path.join(
    sharedAppSdkRoot,
    'node_modules',
    'typescript',
  );
  mkdirSync(existingTypeScriptInstall, { recursive: true });
  writeFileSync(
    path.join(existingTypeScriptInstall, 'package.json'),
    JSON.stringify({ name: 'typescript', version: '5.3.0-local' }, null, 2),
    'utf8',
  );

  writeWorkspaceInstalledPackage('@types/node', '20.19.39');
  writeWorkspaceInstalledPackage('typescript', '6.0.2');

  try {
    const repairedPackages = helper.ensurePackageDependencyLinks(sharedAppSdkRoot, workspaceRoot, {
      localPackageRoots: {
        '@sdkwork/sdk-common': sharedSdkCommonRoot,
      },
    });

    assert.deepEqual(repairedPackages.sort(), ['@sdkwork/sdk-common', '@types/node']);
    assert.equal(
      readFileSync(path.join(existingTypeScriptInstall, 'package.json'), 'utf8').includes(
        '5.3.0-local',
      ),
      true,
    );
    assert.equal(
      realpathSync(path.join(sharedAppSdkRoot, 'node_modules', '@sdkwork', 'sdk-common')),
      realpathSync(sharedSdkCommonRoot),
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('shared sdk package preparation resolves pnpm virtual store packages even when pnpm shortens long directory names', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-packages.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-shared-sdk-truncated-pnpm-root-'));
  const workspaceRoot = path.join(tempRoot, 'apps', 'claw-studio');
  const shortenedStoreDir = path.join(
    workspaceRoot,
    'node_modules',
    '.pnpm',
    '@typescript-eslint+eslint-p_0b8888e8f4d6444f0cae34f670a09065',
    'node_modules',
    '@typescript-eslint',
    'eslint-plugin',
  );

  mkdirSync(workspaceRoot, { recursive: true });
  writeFileSync(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/claw-workspace' }, null, 2),
    'utf8',
  );
  writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages: []\n', 'utf8');
  mkdirSync(shortenedStoreDir, { recursive: true });
  writeFileSync(
    path.join(shortenedStoreDir, 'package.json'),
    JSON.stringify(
      {
        name: '@typescript-eslint/eslint-plugin',
        version: '8.58.0',
      },
      null,
      2,
    ),
    'utf8',
  );

  try {
    assert.equal(
      helper.resolveWorkspaceInstalledPackageRoot('@typescript-eslint/eslint-plugin', workspaceRoot),
      shortenedStoreDir,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('shared sdk package preparation can skip devDependency hydration for packages that do not need rebuilding', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-packages.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-shared-sdk-runtime-links-'));
  const workspaceRoot = path.join(tempRoot, 'apps', 'claw-studio');
  const packageRoot = path.join(tempRoot, 'sdk', 'runtime-only-package');
  const localDependencyRoot = path.join(tempRoot, 'sdk', 'shared-runtime-dependency');

  mkdirSync(workspaceRoot, { recursive: true });
  writeFileSync(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/claw-workspace' }, null, 2),
    'utf8',
  );
  writeFileSync(path.join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages: []\n', 'utf8');

  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify(
      {
        name: '@sdkwork/runtime-only',
        dependencies: {
          '@sdkwork/shared-runtime': '^1.0.0',
        },
        devDependencies: {
          'missing-build-tool': '^1.0.0',
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  mkdirSync(localDependencyRoot, { recursive: true });
  writeFileSync(
    path.join(localDependencyRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/shared-runtime', version: '1.0.0' }, null, 2),
    'utf8',
  );

  try {
    const repairedPackages = helper.ensurePackageDependencyLinks(packageRoot, workspaceRoot, {
      includeDevDependencies: false,
      localPackageRoots: {
        '@sdkwork/shared-runtime': localDependencyRoot,
      },
    });

    assert.deepEqual(repairedPackages, ['@sdkwork/shared-runtime']);
    assert.equal(
      realpathSync(path.join(packageRoot, 'node_modules', '@sdkwork', 'shared-runtime')),
      realpathSync(localDependencyRoot),
    );
    assert.equal(
      existsSync(path.join(packageRoot, 'node_modules', 'missing-build-tool')),
      false,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git-backed shared sdk source detection resolves origin from nested directories inside an existing git checkout', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-git-sources.mjs');
  const helper = await import(pathToFileURL(helperPath).href);
  const helperSource = read('scripts/prepare-shared-sdk-git-sources.mjs');

  assert.equal(typeof helper.isGitCheckout, 'function');
  assert.equal(typeof helper.detectExistingOriginUrl, 'function');
  assert.match(
    helperSource,
    /if \(path\.resolve\(process\.argv\[1\] \?\? ''\) === __filename\) \{\s*try \{\s*main\(\);\s*\} catch \(error\) \{\s*console\.error\(error instanceof Error \? error\.message : String\(error\)\);\s*process\.exit\(1\);\s*\}\s*\}/s,
    'prepare-shared-sdk-git-sources must wrap the CLI entrypoint with a top-level error handler',
  );

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-shared-sdk-'));
  const repoRoot = path.join(tempRoot, 'shared-sdk-repo');
  const nestedPackageRoot = path.join(repoRoot, 'packages', 'sdkwork-app-sdk');
  const gitConfigPath = path.join(repoRoot, '.git', 'config');

  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(nestedPackageRoot, { recursive: true });
  mkdirSync(path.dirname(gitConfigPath), { recursive: true });
  writeFileSync(
    gitConfigPath,
    [
      '[core]',
      '\trepositoryformatversion = 0',
      '\tfilemode = false',
      '\tbare = false',
      '\tlogallrefupdates = true',
      '[remote "origin"]',
      '\turl = https://example.com/shared-sdk.git',
      '\tfetch = +refs/heads/*:refs/remotes/origin/*',
      '',
    ].join('\n'),
    'utf8',
  );

  try {
    assert.equal(helper.isGitCheckout(nestedPackageRoot), true);
    assert.equal(
      helper.detectExistingOriginUrl(nestedPackageRoot),
      'https://example.com/shared-sdk.git',
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git-backed shared sdk source helper normalizes local clone repo URLs to file URLs without rewriting remote URLs', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-git-sources.mjs');
  const helper = await import(pathToFileURL(helperPath).href);
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-shared-sdk-clone-url-'));
  const localRepoRoot = path.join(tempRoot, 'source-repo');

  mkdirSync(localRepoRoot, { recursive: true });

  try {
    assert.equal(typeof helper.resolveGitCloneRepoUrl, 'function');
    assert.equal(
      helper.resolveGitCloneRepoUrl(localRepoRoot),
      pathToFileURL(localRepoRoot).href,
    );
    assert.equal(
      helper.resolveGitCloneRepoUrl('https://example.com/sdkwork/shared-sdk.git'),
      'https://example.com/sdkwork/shared-sdk.git',
    );
    assert.equal(
      helper.resolveGitCloneRepoUrl('git@github.com:Sdkwork-Cloud/sdkwork-core.git'),
      'git@github.com:Sdkwork-Cloud/sdkwork-core.git',
    );
    assert.equal(
      helper.resolveGitCloneRepoUrl(pathToFileURL(localRepoRoot).href),
      pathToFileURL(localRepoRoot).href,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('git-backed shared sdk source helper parses monorepo submodule layouts and resolves config-backed package roots', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-git-sources.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.resolveSharedSdkReleaseConfigPath, 'function');
  assert.equal(typeof helper.readSharedSdkReleaseConfig, 'function');
  assert.equal(typeof helper.resolveSourcePackageContainerRoot, 'function');
  assert.equal(typeof helper.resolveSourcePackageRoot, 'function');
  assert.equal(typeof helper.resolveMonorepoSubmoduleRoot, 'function');
  assert.equal(typeof helper.resolveMonorepoPackageRoot, 'function');
  assert.equal(typeof helper.resolveCheckoutRootForRepoUrl, 'function');
  assert.equal(typeof helper.resolvePackageRootForCheckoutRoot, 'function');
  assert.equal(typeof helper.resolveGitCloneRepoUrl, 'function');
  assert.equal(typeof helper.parseGitSubmodulePaths, 'function');
  assert.equal(typeof helper.materializePackageRootFromMonorepo, 'function');
  assert.equal(helper.DEFAULT_SHARED_SDK_APP_REPO_URL, 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-app.git');
  assert.equal(helper.DEFAULT_SHARED_SDK_COMMON_REPO_URL, 'https://github.com/Sdkwork-Cloud/sdkwork-sdk-commons.git');
  assert.equal(helper.DEFAULT_SHARED_SDK_CORE_REPO_URL, 'https://github.com/Sdkwork-Cloud/sdkwork-core.git');
  assert.equal(helper.DEFAULT_SHARED_SDK_RELEASE_CONFIG_PATH, 'config/shared-sdk-release-sources.json');
  assert.match(
    read('scripts/prepare-shared-sdk-git-sources.mjs'),
    /advice\.detachedHead=false/,
    'shared sdk git source helper must suppress detached HEAD advice in green release automation logs',
  );

  const repoRoot = path.join(rootDir, '.tmp', 'shared-sdk-layout');
  const spec = {
    repoRoot,
    packageContainerDirName: 'sdkwork-sdk-app',
    packageDirName: 'sdkwork-app-sdk-typescript',
    monorepoSubmodulePath: 'spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app',
  };

  assert.equal(
    helper.resolveSourcePackageContainerRoot(spec).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveSourcePackageRoot(spec).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app', 'sdkwork-app-sdk-typescript').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveMonorepoSubmoduleRoot(spec).replaceAll('\\', '/'),
    path.join(repoRoot, 'spring-ai-plus-business', 'spring-ai-plus-app-api', 'sdkwork-sdk-app').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveMonorepoPackageRoot(spec).replaceAll('\\', '/'),
    path.join(
      repoRoot,
      'spring-ai-plus-business',
      'spring-ai-plus-app-api',
      'sdkwork-sdk-app',
      'sdkwork-app-sdk-typescript',
    ).replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveCheckoutRootForRepoUrl(
      spec,
      'https://github.com/Sdkwork-Cloud/sdkwork-sdk-app.git',
    ).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolveCheckoutRootForRepoUrl(
      spec,
      'https://github.com/Sdkwork-Cloud/sdkwork-app-sdk-typescript.git',
    ).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app', 'sdkwork-app-sdk-typescript').replaceAll('\\', '/'),
  );
  assert.equal(
    helper.resolvePackageRootForCheckoutRoot(
      spec,
      path.join(repoRoot, 'sdkwork-sdk-app'),
    ).replaceAll('\\', '/'),
    path.join(repoRoot, 'sdkwork-sdk-app', 'sdkwork-app-sdk-typescript').replaceAll('\\', '/'),
  );

  const parsedPaths = helper.parseGitSubmodulePaths(`
[submodule "spring-ai-plus-business/sdk/sdkwork-sdk-commons"]
    path = spring-ai-plus-business/sdk/sdkwork-sdk-commons
[submodule "spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app"]
    path = spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app
`);
  assert.deepEqual([...parsedPaths], [
    'spring-ai-plus-business/sdk/sdkwork-sdk-commons',
    'spring-ai-plus-business/spring-ai-plus-app-api/sdkwork-sdk-app',
  ]);

  const sharedSdkReleaseConfig = helper.readSharedSdkReleaseConfig(rootDir);
  assert.equal(
    path.relative(rootDir, helper.resolveSharedSdkReleaseConfigPath(rootDir)).replaceAll('\\', '/'),
    'config/shared-sdk-release-sources.json',
  );
  assert.equal(sharedSdkReleaseConfig.sources['app-sdk'].repoUrl, helper.DEFAULT_SHARED_SDK_APP_REPO_URL);
  assert.equal(sharedSdkReleaseConfig.sources['sdk-common'].repoUrl, helper.DEFAULT_SHARED_SDK_COMMON_REPO_URL);
  assert.equal(sharedSdkReleaseConfig.sources['core-pc-react'].repoUrl, helper.DEFAULT_SHARED_SDK_CORE_REPO_URL);
  assert.equal(sharedSdkReleaseConfig.sources['im-sdk'].repoUrl, helper.DEFAULT_SHARED_SDK_IM_REPO_URL);
  assert.equal(sharedSdkReleaseConfig.sources['rtc-sdk'].repoUrl, helper.DEFAULT_SHARED_SDK_RTC_REPO_URL);
  assert.doesNotMatch(JSON.stringify(sharedSdkReleaseConfig), /"ref"\s*:\s*"main"/);

  const helperSource = read('scripts/prepare-shared-sdk-git-sources.mjs');
  assert.match(helperSource, /submodule/);
  assert.match(helperSource, /--init/);
  assert.match(helperSource, /symlinkSync/);
  assert.match(helperSource, /monorepoSubmodulePath/);
  assert.match(helperSource, /shared-sdk-release-sources\.json/);
  assert.match(helperSource, /FETCH_HEAD/);
  assert.match(helperSource, /SDKWORK_SHARED_SDK_IM_REPO_URL/);
  assert.match(helperSource, /SDKWORK_SHARED_SDK_RTC_REPO_URL/);
  assert.match(helperSource, /https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-im-sdk\.git/);
  assert.match(helperSource, /https:\/\/github\.com\/Sdkwork-Cloud\/sdkwork-rtc-sdk\.git/);
});

test('git-backed shared sdk source helper can materialize pinned local git sources from the release config', async (t) => {
  const helperPath = path.join(rootDir, 'scripts', 'prepare-shared-sdk-git-sources.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-shared-sdk-'));
  const workspaceRoot = path.join(tempRoot, 'apps', 'claw-studio');
  const configPath = path.join(workspaceRoot, 'config', 'shared-sdk-release-sources.json');
  const sourceRepoRoot = path.join(tempRoot, 'source-repos');
  const appRepoRoot = path.join(sourceRepoRoot, 'sdkwork-sdk-app');
  const commonRepoRoot = path.join(sourceRepoRoot, 'sdkwork-sdk-commons');
  const coreRepoRoot = path.join(sourceRepoRoot, 'sdkwork-core');
  const imRepoRoot = path.join(sourceRepoRoot, 'sdkwork-im-sdk');
  const rtcRepoRoot = path.join(sourceRepoRoot, 'sdkwork-rtc-sdk');
  const appPackageRoot = path.join(appRepoRoot, 'sdkwork-app-sdk-typescript');
  const commonPackageRoot = path.join(commonRepoRoot, 'sdkwork-sdk-common-typescript');
  const corePackageRoot = path.join(coreRepoRoot, 'sdkwork-core-pc-react');
  const imPackageRoot = path.join(imRepoRoot, 'sdkwork-im-sdk-typescript');
  const rtcPackageRoot = path.join(rtcRepoRoot, 'sdkwork-rtc-sdk-typescript');

  function runGit(args, cwd) {
    const result = spawnSync(helper.resolveSpawnCommand('git'), args, {
      cwd,
      encoding: 'utf8',
      shell: false,
    });
    if (result.error?.code === 'EPERM' || result.error?.code === 'ENOENT') {
      t.skip('sandbox blocks git child processes; cannot materialize synthetic release git sources');
      return false;
    }
    assert.equal(result.status, 0, result.stderr || result.stdout || `git ${args.join(' ')} failed`);
    return true;
  }

  mkdirSync(appPackageRoot, { recursive: true });
  mkdirSync(commonPackageRoot, { recursive: true });
  mkdirSync(corePackageRoot, { recursive: true });
  mkdirSync(imPackageRoot, { recursive: true });
  mkdirSync(rtcPackageRoot, { recursive: true });
  mkdirSync(path.dirname(configPath), { recursive: true });

  writeFileSync(
    path.join(appPackageRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/app-sdk', version: '1.0.53' }, null, 2),
    'utf8',
  );
  writeFileSync(
    path.join(commonPackageRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/sdk-common', version: '1.0.2' }, null, 2),
    'utf8',
  );
  writeFileSync(
    path.join(corePackageRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/core-pc-react', version: '0.1.0' }, null, 2),
    'utf8',
  );
  writeFileSync(
    path.join(imPackageRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/im-sdk', version: '0.1.0' }, null, 2),
    'utf8',
  );
  writeFileSync(
    path.join(rtcPackageRoot, 'package.json'),
    JSON.stringify({ name: '@sdkwork/rtc-sdk', version: '0.1.0' }, null, 2),
    'utf8',
  );

  if (!runGit(['init', '--initial-branch', 'main'], appRepoRoot)) {
    return;
  }
  runGit(['config', 'user.name', 'Codex'], appRepoRoot);
  runGit(['config', 'user.email', 'sdkwork@zowalk.com'], appRepoRoot);
  runGit(['add', '.'], appRepoRoot);
  runGit(['commit', '-m', 'seed-app-sdk'], appRepoRoot);

  if (!runGit(['init', '--initial-branch', 'main'], commonRepoRoot)) {
    return;
  }
  runGit(['config', 'user.name', 'Codex'], commonRepoRoot);
  runGit(['config', 'user.email', 'sdkwork@zowalk.com'], commonRepoRoot);
  runGit(['add', '.'], commonRepoRoot);
  runGit(['commit', '-m', 'seed-sdk-common'], commonRepoRoot);

  if (!runGit(['init', '--initial-branch', 'main'], coreRepoRoot)) {
    return;
  }
  runGit(['config', 'user.name', 'Codex'], coreRepoRoot);
  runGit(['config', 'user.email', 'sdkwork@zowalk.com'], coreRepoRoot);
  runGit(['add', '.'], coreRepoRoot);
  runGit(['commit', '-m', 'seed-core-pc-react'], coreRepoRoot);

  if (!runGit(['init', '--initial-branch', 'main'], imRepoRoot)) {
    return;
  }
  runGit(['config', 'user.name', 'Codex'], imRepoRoot);
  runGit(['config', 'user.email', 'sdkwork@zowalk.com'], imRepoRoot);
  runGit(['add', '.'], imRepoRoot);
  runGit(['commit', '-m', 'seed-sdkwork-im-sdk'], imRepoRoot);

  if (!runGit(['init', '--initial-branch', 'main'], rtcRepoRoot)) {
    return;
  }
  runGit(['config', 'user.name', 'Codex'], rtcRepoRoot);
  runGit(['config', 'user.email', 'sdkwork@zowalk.com'], rtcRepoRoot);
  runGit(['add', '.'], rtcRepoRoot);
  runGit(['commit', '-m', 'seed-sdkwork-rtc-sdk'], rtcRepoRoot);

  writeFileSync(
    configPath,
    JSON.stringify(
      {
        sources: {
          'app-sdk': {
            repoUrl: appRepoRoot,
            ref: 'main',
          },
          'sdk-common': {
            repoUrl: commonRepoRoot,
            ref: 'main',
          },
          'core-pc-react': {
            repoUrl: coreRepoRoot,
            ref: 'main',
          },
          'im-sdk': {
            repoUrl: imRepoRoot,
            ref: 'main',
          },
          'rtc-sdk': {
            repoUrl: rtcRepoRoot,
            ref: 'main',
          },
        },
      },
      null,
      2,
    ),
    'utf8',
  );

  try {
    const preparedSources = helper.ensureSharedSdkGitSources({
      workspaceRootDir: workspaceRoot,
      env: {
        [helper.SHARED_SDK_RELEASE_CONFIG_PATH_ENV_VAR]: configPath,
      },
      syncExistingRepos: false,
    });

    const preparedAppSdk = preparedSources.find((entry) => entry.id === 'app-sdk');
    const preparedSdkCommon = preparedSources.find((entry) => entry.id === 'sdk-common');
    const preparedCorePcReact = preparedSources.find((entry) => entry.id === 'core-pc-react');
    const preparedImSdk = preparedSources.find((entry) => entry.id === 'im-sdk');
    const preparedRtcSdk = preparedSources.find((entry) => entry.id === 'rtc-sdk');

    assert.equal(preparedAppSdk?.targetRef, 'main');
    assert.equal(preparedSdkCommon?.targetRef, 'main');
    assert.equal(preparedCorePcReact?.targetRef, 'main');
    assert.equal(preparedImSdk?.targetRef, 'main');
    assert.equal(preparedRtcSdk?.targetRef, 'main');
    assert.equal(realpathSync(preparedAppSdk.packageRoot), realpathSync(path.join(
      tempRoot,
      'spring-ai-plus-app-api',
      'sdkwork-sdk-app',
      'sdkwork-app-sdk-typescript',
    )));
    assert.equal(realpathSync(preparedSdkCommon.packageRoot), realpathSync(path.join(
      tempRoot,
      'sdk',
      'sdkwork-sdk-commons',
      'sdkwork-sdk-common-typescript',
    )));
    assert.equal(realpathSync(preparedCorePcReact.packageRoot), realpathSync(path.join(
      tempRoot,
      'apps',
      'sdkwork-core',
      'sdkwork-core-pc-react',
    )));
    assert.equal(realpathSync(preparedImSdk.packageRoot), realpathSync(path.join(
      tempRoot,
      'apps',
      'craw-chat',
      'sdks',
      'sdkwork-im-sdk',
      'sdkwork-im-sdk-typescript',
    )));
    assert.equal(realpathSync(preparedRtcSdk.packageRoot), realpathSync(path.join(
      tempRoot,
      'apps',
      'craw-chat',
      'sdks',
      'sdkwork-rtc-sdk',
      'sdkwork-rtc-sdk-typescript',
    )));
    assert.equal(
      JSON.parse(readFileSync(path.join(preparedAppSdk.packageRoot, 'package.json'), 'utf8')).name,
      '@sdkwork/app-sdk',
    );
    assert.equal(
      JSON.parse(readFileSync(path.join(preparedSdkCommon.packageRoot, 'package.json'), 'utf8')).name,
      '@sdkwork/sdk-common',
    );
    assert.equal(
      JSON.parse(readFileSync(path.join(preparedCorePcReact.packageRoot, 'package.json'), 'utf8')).name,
      '@sdkwork/core-pc-react',
    );
    assert.equal(
      JSON.parse(readFileSync(path.join(preparedImSdk.packageRoot, 'package.json'), 'utf8')).name,
      '@sdkwork/im-sdk',
    );
    assert.equal(
      JSON.parse(readFileSync(path.join(preparedRtcSdk.packageRoot, 'package.json'), 'utf8')).name,
      '@sdkwork/rtc-sdk',
    );
    assert.equal(
      preparedAppSdk?.repoUrl,
      appRepoRoot,
    );
    assert.equal(
      preparedSdkCommon?.repoUrl,
      commonRepoRoot,
    );
    assert.equal(
      preparedCorePcReact?.repoUrl,
      coreRepoRoot,
    );
    assert.equal(
      preparedImSdk?.repoUrl,
      imRepoRoot,
    );
    assert.equal(
      preparedRtcSdk?.repoUrl,
      rtcRepoRoot,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('shared sdk release parity hashing treats LF and CRLF text sources as the same content', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'check-shared-sdk-release-parity.mjs');
  const helper = await import(pathToFileURL(helperPath).href);

  assert.equal(typeof helper.hashBufferForParity, 'function');
  assert.equal(
    helper.hashBufferForParity(Buffer.from('export const value = 1;\n', 'utf8')),
    helper.hashBufferForParity(Buffer.from('export const value = 1;\r\n', 'utf8')),
  );
});

test('desktop release build runner injects the supported Visual Studio generator only on Windows', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  assert.equal(existsSync(runnerPath), true, 'missing scripts/run-desktop-release-build.mjs');

  const runner = await import(pathToFileURL(runnerPath).href);
  assert.equal(typeof runner.createDesktopReleaseBuildPlan, 'function');

  const windowsPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'win32',
    env: {},
  });
  const linuxPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
  });

  assert.equal(windowsPlan.command, process.execPath);
  assert.deepEqual(windowsPlan.args, [
    path.join(path.dirname(process.execPath), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
    '--filter',
    '@sdkwork/claw-desktop',
    'run',
    'tauri:build',
    '--',
    '--profile',
    'claw-studio',
    '--package-profile',
    'openclaw-only',
    '--vite-mode',
    'production',
    '--bundles',
    'nsis',
  ]);
  assert.equal(windowsPlan.env.CMAKE_GENERATOR, 'Visual Studio 17 2022');
  assert.equal(windowsPlan.env.HOST_CMAKE_GENERATOR, 'Visual Studio 17 2022');
  assert.equal(windowsPlan.shell, false);

  assert.equal(linuxPlan.command, 'pnpm');
  assert.deepEqual(linuxPlan.args, [
    '--filter',
    '@sdkwork/claw-desktop',
    'run',
    'tauri:build',
    '--',
    '--profile',
    'claw-studio',
    '--package-profile',
    'openclaw-only',
    '--vite-mode',
    'production',
    '--bundles',
    'deb,rpm',
  ]);
  assert.equal(Object.hasOwn(linuxPlan.env, 'CMAKE_GENERATOR'), false);
  assert.equal(windowsPlan.env.SDKWORK_VITE_MODE, 'production');
  assert.equal(linuxPlan.env.SDKWORK_VITE_MODE, 'production');
  assert.equal(linuxPlan.shell, false);
});

test('desktop release build runner can override the vite mode for test bundles while keeping production as the default', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const defaultPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
  });
  const testPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    viteMode: 'test',
  });

  assert.equal(defaultPlan.env.SDKWORK_VITE_MODE, 'production');
  assert.equal(testPlan.env.SDKWORK_VITE_MODE, 'test');
});

test('desktop release target helpers resolve platform and architecture from explicit target triples', async () => {
  const helperPath = path.join(rootDir, 'scripts', 'release', 'desktop-targets.mjs');
  assert.equal(existsSync(helperPath), true, 'missing scripts/release/desktop-targets.mjs');

  const helper = await import(pathToFileURL(helperPath).href);
  assert.equal(typeof helper.parseDesktopTargetTriple, 'function');
  assert.equal(typeof helper.resolveDesktopReleaseTarget, 'function');

  assert.deepEqual(
    helper.parseDesktopTargetTriple('aarch64-pc-windows-msvc'),
    {
      platform: 'windows',
      arch: 'arm64',
      targetTriple: 'aarch64-pc-windows-msvc',
    },
  );
  assert.deepEqual(
    helper.parseDesktopTargetTriple('x86_64-apple-darwin'),
    {
      platform: 'macos',
      arch: 'x64',
      targetTriple: 'x86_64-apple-darwin',
    },
  );
  assert.deepEqual(
    helper.resolveDesktopReleaseTarget({
      env: {
        SDKWORK_DESKTOP_TARGET: 'x86_64-unknown-linux-gnu',
      },
    }),
    {
      platform: 'linux',
      arch: 'x64',
      targetTriple: 'x86_64-unknown-linux-gnu',
    },
  );
});

test('desktop release build runner forwards explicit target triples to tauri build', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const arm64WindowsPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'win32',
    env: {},
    targetTriple: 'aarch64-pc-windows-msvc',
  });

  assert.deepEqual(arm64WindowsPlan.args, [
    path.join(path.dirname(process.execPath), 'node_modules', 'pnpm', 'bin', 'pnpm.cjs'),
    '--filter',
    '@sdkwork/claw-desktop',
    'run',
    'tauri:build',
    '--',
    '--profile',
    'claw-studio',
    '--package-profile',
    'openclaw-only',
    '--vite-mode',
    'production',
    '--bundles',
    'nsis',
    '--target',
    'aarch64-pc-windows-msvc',
  ]);
  assert.equal(arm64WindowsPlan.env.SDKWORK_DESKTOP_TARGET, 'aarch64-pc-windows-msvc');
  assert.equal(arm64WindowsPlan.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'windows');
  assert.equal(arm64WindowsPlan.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');
});

test('desktop release bundle phase merges the generated Windows bundle overlay config and limits CI installers to the stable profile bundle set', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const windowsBundlePlan = runner.createDesktopReleaseBuildPlan({
    platform: 'win32',
    env: {},
    phase: 'bundle',
    targetTriple: 'x86_64-pc-windows-msvc',
  });

  assert.equal(windowsBundlePlan.command, process.execPath);
  assert.deepEqual(windowsBundlePlan.args, [
    'scripts/run-windows-tauri-bundle.mjs',
    '--profile',
    'claw-studio',
    '--config',
    path.join(desktopPackageDir, desktopBundleOverlayConfig),
    '--bundles',
    'nsis',
  ]);

  const windowsBundleModulePath = path.join(rootDir, 'scripts', 'run-windows-tauri-bundle.mjs');
  const windowsBundleModule = await import(pathToFileURL(windowsBundleModulePath).href);
  const windowsCommand = windowsBundleModule.buildWindowsTauriBundleCommand();

  assert.match(windowsCommand.args.join(' '), /--bundles nsis/);
});

test('desktop release build runner exposes granular release phases for CI diagnostics', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const syncPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    phase: 'sync',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });
  const prepareTargetPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    phase: 'prepare-target',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });
  const openClawPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    phase: 'prepare-openclaw',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });
  const bundlePlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    env: {},
    phase: 'bundle',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });

  assert.match(syncPlan.args.join(' '), /sync-bundled-components\.mjs --no-fetch --release/);
  assert.match(prepareTargetPlan.args.join(' '), /ensure-tauri-target-clean\.mjs/);
  assert.match(openClawPlan.args.join(' '), /prepare-openclaw-runtime\.mjs/);
  assert.deepEqual(bundlePlan.args, [
    '--dir',
    desktopPackageDir,
    'exec',
    'tauri',
    'build',
    '--config',
    desktopLinuxTauriConfig,
    '--config',
    desktopBundleOverlayConfig,
    '--bundles',
    'deb,rpm',
    '--target',
    'aarch64-unknown-linux-gnu',
  ]);
  assert.equal(bundlePlan.env.SDKWORK_DESKTOP_TARGET, 'aarch64-unknown-linux-gnu');
  assert.equal(bundlePlan.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'linux');
  assert.equal(bundlePlan.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');
});

test('desktop release build runner requests standard macOS dmg and app bundle outputs in CI', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const macosBundlePlan = runner.createDesktopReleaseBuildPlan({
    platform: 'darwin',
    hostArch: 'x64',
    env: {},
    phase: 'bundle',
    targetTriple: 'x86_64-apple-darwin',
  });

  assert.deepEqual(macosBundlePlan.args, [
    '--dir',
    desktopPackageDir,
    'exec',
    'tauri',
    'build',
    '--config',
    desktopMacosTauriConfig,
    '--config',
    desktopBundleOverlayConfig,
    '--bundles',
    'app,dmg',
  ]);
  assert.equal(macosBundlePlan.env.SDKWORK_DESKTOP_TARGET, 'x86_64-apple-darwin');
  assert.equal(macosBundlePlan.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'macos');
  assert.equal(macosBundlePlan.env.SDKWORK_DESKTOP_TARGET_ARCH, 'x64');
});

test('desktop release build runner avoids explicit tauri target flags on native architecture runners', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  const nativeLinuxArmPlan = runner.createDesktopReleaseBuildPlan({
    platform: 'linux',
    hostArch: 'arm64',
    env: {},
    phase: 'bundle',
    targetTriple: 'aarch64-unknown-linux-gnu',
  });

  assert.deepEqual(nativeLinuxArmPlan.args, [
    '--dir',
    desktopPackageDir,
    'exec',
    'tauri',
    'build',
    '--config',
    desktopLinuxTauriConfig,
    '--config',
    desktopBundleOverlayConfig,
    '--bundles',
    'deb,rpm',
  ]);
  assert.equal(nativeLinuxArmPlan.env.SDKWORK_DESKTOP_TARGET, 'aarch64-unknown-linux-gnu');
  assert.equal(nativeLinuxArmPlan.env.SDKWORK_DESKTOP_TARGET_PLATFORM, 'linux');
  assert.equal(nativeLinuxArmPlan.env.SDKWORK_DESKTOP_TARGET_ARCH, 'arm64');
});

test('desktop release build runner can recover a macOS dmg bundle failure when the app and dmg outputs already exist', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.canRecoverMacosBundleFailure, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-recovery-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');
    const dmgPath = path.join(bundleRoot, 'dmg', 'Claw Studio_0.1.0_x64.dmg');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });
    mkdirSync(path.dirname(dmgPath), { recursive: true });
    writeFileSync(dmgPath, 'synthetic dmg');

    assert.equal(
      runner.canRecoverMacosBundleFailure({
        platform: 'darwin',
        targetTriple: 'x86_64-apple-darwin',
        bundleTargets: ['app', 'dmg'],
        targetDir,
      }),
      true,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop release build runner can recover a macOS dmg bundle failure when Tauri leaves the dmg under the macos bundle directory', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.canRecoverMacosBundleFailure, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-recovery-macos-dir-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');
    const dmgPath = path.join(bundleRoot, 'macos', 'Claw Studio_0.1.0_x64.dmg');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });
    writeFileSync(dmgPath, 'synthetic dmg');

    assert.equal(
      runner.canRecoverMacosBundleFailure({
        platform: 'darwin',
        targetTriple: 'x86_64-apple-darwin',
        bundleTargets: ['app', 'dmg'],
        targetDir,
      }),
      true,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop release build runner does not treat a Tauri rw temporary dmg as a completed dmg output', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.canRecoverMacosBundleFailure, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-temp-dmg-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');
    const temporaryDmgPath = path.join(bundleRoot, 'macos', 'rw.86444.Claw.Studio_0.1.0_x64.dmg');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });
    writeFileSync(temporaryDmgPath, 'synthetic temporary dmg');

    assert.equal(
      runner.canRecoverMacosBundleFailure({
        platform: 'darwin',
        targetTriple: 'x86_64-apple-darwin',
        bundleTargets: ['app', 'dmg'],
        targetDir,
      }),
      false,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop release build runner can repair a macOS dmg bundle failure by converting a Tauri rw temporary dmg into the final dmg artifact', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.repairMacosDmgBundleOutput, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-repair-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');
    const temporaryDmgPath = path.join(bundleRoot, 'macos', 'rw.86444.Claw.Studio_0.1.0_x64.dmg');
    const finalDmgPath = path.join(bundleRoot, 'dmg', 'Claw.Studio_0.1.0_x64.dmg');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });
    mkdirSync(path.dirname(temporaryDmgPath), { recursive: true });
    writeFileSync(temporaryDmgPath, 'synthetic temporary dmg');

    const spawnCalls = [];
    const repaired = runner.repairMacosDmgBundleOutput({
      platform: 'darwin',
      targetTriple: 'x86_64-apple-darwin',
      bundleTargets: ['app', 'dmg'],
      targetDir,
      spawnSyncImpl(command, args) {
        spawnCalls.push({ command, args });
        mkdirSync(path.dirname(finalDmgPath), { recursive: true });
        writeFileSync(finalDmgPath, 'synthetic finalized dmg');
        return { status: 0 };
      },
    });

    assert.equal(repaired, true);
    assert.equal(existsSync(finalDmgPath), true);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0].command, 'hdiutil');
    assert.deepEqual(spawnCalls[0].args, [
      'convert',
      temporaryDmgPath,
      '-format',
      'UDZO',
      '-o',
      finalDmgPath,
    ]);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('desktop release build runner does not recover a macOS dmg bundle failure when the dmg output is missing', async () => {
  const runnerPath = path.join(rootDir, 'scripts', 'run-desktop-release-build.mjs');
  const runner = await import(pathToFileURL(runnerPath).href);

  assert.equal(typeof runner.canRecoverMacosBundleFailure, 'function');

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-macos-bundle-failure-'));

  try {
    const targetDir = path.join(tempRoot, 'target');
    const bundleRoot = path.join(targetDir, 'release', 'bundle');
    const appBundleDir = path.join(bundleRoot, 'macos', 'Claw Studio.app');

    mkdirSync(path.join(appBundleDir, 'Contents'), { recursive: true });

    assert.equal(
      runner.canRecoverMacosBundleFailure({
        platform: 'darwin',
        targetTriple: 'x86_64-apple-darwin',
        bundleTargets: ['app', 'dmg'],
        targetDir,
      }),
      false,
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('release plan resolver expands the claw-studio profile into the full desktop matrix', async () => {
  const resolverPath = path.join(rootDir, 'scripts', 'release', 'resolve-release-plan.mjs');
  assert.equal(existsSync(resolverPath), true, 'missing scripts/release/resolve-release-plan.mjs');

  const resolver = await import(pathToFileURL(resolverPath).href);
  assert.equal(typeof resolver.createReleasePlan, 'function');
  assert.equal(typeof resolver.parseArgs, 'function');

  const plan = resolver.createReleasePlan({
    profileId: 'claw-studio',
    packageProfileId: 'dual-kernel',
    releaseTag: 'release-2026-03-31-03',
    gitRef: 'refs/tags/release-2026-03-31-03',
  });

  assert.equal(plan.profileId, 'claw-studio');
  assert.equal(plan.defaultPackageProfileId, 'openclaw-only');
  assert.equal(plan.packageProfileId, 'dual-kernel');
  assert.deepEqual(plan.packageProfile.includedKernelIds, ['openclaw', 'hermes']);
  assert.equal(plan.packageProfiles.length >= 3, true);
  assert.equal(plan.desktopMatrix.length, 6);
  assert.equal(plan.serverMatrix.length, 6);
  assert.equal(plan.containerMatrix.length, 4);
  assert.equal(plan.kubernetesMatrix.length, 4);
  assert.deepEqual(
    plan.desktopMatrix.find((entry) => entry.platform === 'linux' && entry.arch === 'x64'),
    {
      runner: 'ubuntu-24.04',
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      bundles: ['deb', 'rpm'],
    },
  );
  assert.deepEqual(
    plan.desktopMatrix.find((entry) => entry.platform === 'macos' && entry.arch === 'arm64'),
    {
      runner: 'macos-15',
      platform: 'macos',
      arch: 'arm64',
      target: 'aarch64-apple-darwin',
      bundles: ['app', 'dmg'],
    },
  );
  assert.deepEqual(
    plan.serverMatrix.find((entry) => entry.platform === 'linux' && entry.arch === 'arm64'),
    {
      runner: 'ubuntu-24.04-arm',
      platform: 'linux',
      arch: 'arm64',
      target: 'aarch64-unknown-linux-gnu',
      archiveFormat: 'tar.gz',
    },
  );
  assert.deepEqual(
    plan.containerMatrix.find((entry) => entry.arch === 'x64' && entry.accelerator === 'amd-rocm'),
    {
      runner: 'ubuntu-24.04',
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'amd-rocm',
    },
  );
  assert.deepEqual(
    plan.kubernetesMatrix.find((entry) => entry.arch === 'x64' && entry.accelerator === 'nvidia-cuda'),
    {
      runner: 'ubuntu-24.04',
      platform: 'linux',
      arch: 'x64',
      target: 'x86_64-unknown-linux-gnu',
      accelerator: 'nvidia-cuda',
    },
  );
  assert.throws(
    () => resolver.parseArgs(['--release-tag']),
    /Missing value for --release-tag/,
  );
  assert.deepEqual(
    resolver.parseArgs(['--package-profile', 'hermes-only']).packageProfileId,
    'hermes-only',
  );
});

test('release asset packager knows how to filter desktop bundle outputs, resolve target roots, and name web archives', async () => {
  const packagerPath = path.join(rootDir, 'scripts', 'release', 'package-release-assets.mjs');
  assert.equal(existsSync(packagerPath), true, 'missing scripts/release/package-release-assets.mjs');

  const packager = await import(pathToFileURL(packagerPath).href);
  assert.equal(typeof packager.normalizePlatformId, 'function');
  assert.equal(typeof packager.shouldIncludeDesktopBundleFile, 'function');
  assert.equal(typeof packager.buildDesktopBundleRootCandidates, 'function');
  assert.equal(typeof packager.resolveDesktopBundleRoot, 'function');
  assert.equal(typeof packager.resolveExistingDesktopBundleRoot, 'function');
  assert.equal(typeof packager.buildWebArchiveBaseName, 'function');

  assert.equal(packager.normalizePlatformId('win32'), 'windows');
  assert.equal(packager.normalizePlatformId('darwin'), 'macos');
  assert.equal(packager.normalizePlatformId('linux'), 'linux');

  assert.equal(
    packager.shouldIncludeDesktopBundleFile('windows', 'nsis/Claw Studio_0.1.0_x64-setup.exe'),
    true,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('windows', 'deb/claw-studio_0.1.0_amd64.deb'),
    false,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('linux', 'deb/claw-studio_0.1.0_amd64.deb'),
    true,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('macos', 'dmg/Claw Studio_0.1.0_aarch64.dmg'),
    true,
  );
  assert.equal(
    packager.shouldIncludeDesktopBundleFile('macos', 'macos/rw.86444.Claw.Studio_0.1.0_x64.dmg'),
    false,
  );
  assert.equal(
    packager.resolveDesktopBundleRoot({
      targetTriple: 'aarch64-pc-windows-msvc',
      targetDir: path.join(
        rootDir,
        'packages',
        'sdkwork-claw-desktop',
        'src-tauri',
        'target',
      ),
    }).replaceAll('\\', '/'),
    path.join(
      rootDir,
      'packages',
      'sdkwork-claw-desktop',
      'src-tauri',
      'target',
      'aarch64-pc-windows-msvc',
      'release',
      'bundle',
    ).replaceAll('\\', '/'),
  );

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'claw-release-bundle-root-'));

  try {
    const tempTargetDir = path.join(tempRoot, 'target');
    const fallbackBundleRoot = path.join(tempTargetDir, 'release', 'bundle');

    mkdirSync(fallbackBundleRoot, { recursive: true });

    assert.deepEqual(
      packager.buildDesktopBundleRootCandidates({
        targetTriple: 'x86_64-pc-windows-msvc',
        targetDir: tempTargetDir,
      }).map((candidate) => candidate.replaceAll('\\', '/')),
      [
        path.join(tempTargetDir, 'x86_64-pc-windows-msvc', 'release', 'bundle').replaceAll('\\', '/'),
        fallbackBundleRoot.replaceAll('\\', '/'),
      ],
    );

    assert.equal(
      packager.resolveExistingDesktopBundleRoot({
        targetTriple: 'x86_64-pc-windows-msvc',
        targetDir: tempTargetDir,
      }).replaceAll('\\', '/'),
      fallbackBundleRoot.replaceAll('\\', '/'),
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }

  assert.equal(
    packager.buildWebArchiveBaseName('release-2026-03-26'),
    'claw-studio-web-assets-release-2026-03-26',
  );
});

test('bundled component sync resolves the npm global node_modules root for Unix and Windows layouts', async () => {
  const syncPath = path.join(rootDir, 'scripts', 'sync-bundled-components.mjs');
  const syncModule = await import(pathToFileURL(syncPath).href);
  const syncSource = read('scripts/sync-bundled-components.mjs');

  assert.equal(typeof syncModule.resolveGlobalNodeModulesDir, 'function');
  assert.match(syncSource, /buildAttempts:\s*3/);
  assert.match(syncSource, /retrying after cleaning dist/);

  assert.equal(
    syncModule.resolveGlobalNodeModulesDir('/tmp/openclaw-prefix', 'linux'),
    '/tmp/openclaw-prefix/lib/node_modules',
  );
  assert.equal(
    syncModule.resolveGlobalNodeModulesDir('/tmp/openclaw-prefix', 'darwin'),
    '/tmp/openclaw-prefix/lib/node_modules',
  );
  assert.equal(
    syncModule.resolveGlobalNodeModulesDir('C:/openclaw-prefix', 'win32'),
    'C:\\openclaw-prefix\\node_modules',
  );
  assert.doesNotMatch(syncSource, /'router-web-service',/);
  assert.doesNotMatch(syncSource, /"router-web-service",/);
  assert.doesNotMatch(syncSource, /-p'\s*,\s*'router-web-service'/);
});

test('release sync defers heavyweight openclaw builds to the dedicated preparation phase', async () => {
  const syncPath = path.join(rootDir, 'scripts', 'sync-bundled-components.mjs');
  const syncModule = await import(pathToFileURL(syncPath).href);

  assert.equal(typeof syncModule.createComponentExecutionPlan, 'function');

  assert.deepEqual(
    syncModule.createComponentExecutionPlan({
      componentId: 'openclaw',
      devMode: false,
      releaseMode: true,
    }),
    {
      shouldBuild: false,
      shouldStage: false,
    },
  );
  assert.deepEqual(
    syncModule.createComponentExecutionPlan({
      componentId: 'generic-bundled-component',
      devMode: false,
      releaseMode: true,
    }),
    {
      shouldBuild: true,
      shouldStage: true,
    },
  );
});

