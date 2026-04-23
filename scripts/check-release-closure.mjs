#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

export function main() {
  const scriptPath = path.join(rootDir, 'scripts', 'check-release-closure.mjs');
  const runtimeSmokeReportPath = path.join(
    rootDir,
    'docs',
    'reports',
    '2026-04-05-unified-rust-host-runtime-hardening-smoke.md',
  );
  const deploymentBootstrapSmokeReportPath = path.join(
    rootDir,
    'docs',
    'reports',
    '2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md',
  );
  const packageJson = JSON.parse(read('package.json'));
  const workflow = read('.github/workflows/release-reusable.yml');
  const kubernetesValues = read('deploy/kubernetes/values.yaml');
  const kubernetesDeployment = read('deploy/kubernetes/templates/deployment.yaml');
  const kubernetesReadme = read('deploy/kubernetes/README.md');
  const releaseDoc = read('docs/core/release-and-deployment.md');
  const packagerSource = read('scripts/release/package-release-assets.mjs');
  const runtimeSmokeReport = read(path.relative(rootDir, runtimeSmokeReportPath));
  const deploymentBootstrapSmokeReport = read(
    path.relative(rootDir, deploymentBootstrapSmokeReportPath),
  );

  assert.equal(existsSync(scriptPath), true, 'missing scripts/check-release-closure.mjs');
  assert.equal(
    existsSync(runtimeSmokeReportPath),
    true,
    'missing docs/reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md',
  );
  assert.equal(
    existsSync(deploymentBootstrapSmokeReportPath),
    true,
    'missing docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md',
  );
  assert.match(
    packageJson.scripts['check:multi-mode'],
    /sdkwork-run-pnpm check:desktop && sdkwork-run-pnpm check:server && sdkwork-run-pnpm check:sdkwork-host-runtime && sdkwork-run-pnpm check:desktop-openclaw-runtime && sdkwork-run-pnpm check:release-flow/,
    'package.json must expose the unified multi-mode verification command',
  );
  assert.match(
    packageJson.scripts['check:release-flow'],
    /sdkwork-run-node scripts\/check-release-closure\.mjs/,
    'check:release-flow must execute the release closure guard',
  );
  assert.match(
    packageJson.scripts['release:smoke:desktop-packaged-launch'],
    /sdkwork-run-node scripts\/release\/smoke-desktop-packaged-launch\.mjs/,
    'package.json must expose the dedicated desktop packaged launch smoke command',
  );
  assert.match(
    packageJson.scripts['release:smoke:desktop-startup'],
    /sdkwork-run-node scripts\/release\/smoke-desktop-startup-evidence\.mjs/,
    'package.json must expose the dedicated desktop startup smoke command',
  );
  assert.match(
    packageJson.scripts['release:smoke:server'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs smoke server/,
    'package.json must expose the packaged server smoke command',
  );
  assert.match(
    packageJson.scripts['release:smoke:container'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs smoke container/,
    'package.json must expose the packaged container smoke command',
  );
  assert.match(
    packageJson.scripts['release:smoke:kubernetes'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs smoke kubernetes/,
    'package.json must expose the packaged kubernetes smoke command',
  );

  assert.doesNotMatch(
    kubernetesValues,
    /tag:\s+latest/,
    'kubernetes values.yaml must not ship a mutable latest image tag',
  );
  assert.match(
    kubernetesDeployment,
    /image:\s+"?\{\{[^}]*\.Values\.image\.repository[^}]*\}\}@\{\{[^}]*\.Values\.image\.digest[^}]*\}\}"?/,
    'kubernetes deployment template must support digest-pinned images',
  );
  assert.match(
    kubernetesDeployment,
    /image:\s+"?\{\{[^}]*\.Values\.image\.repository[^}]*\}\}:\{\{[^}]*\.Values\.image\.tag[^}]*\}\}"?/,
    'kubernetes deployment template must support explicit tag fallback',
  );
  assert.match(
    workflow,
    /docker\/build-push-action@/,
    'release workflow must publish OCI images before kubernetes bundles are finalized',
  );
  assert.match(
    workflow,
    /container-image-metadata-\$\{\{ matrix\.arch \}\}/,
    'release workflow must persist published image metadata by architecture',
  );
  assert.match(
    workflow,
    /package-release-assets\.mjs kubernetes[\s\S]*--image-repository \$\{\{ steps\.[^.]+\.outputs\.image_repository \}\}[\s\S]*--image-tag \$\{\{ steps\.[^.]+\.outputs\.image_tag \}\}[\s\S]*--image-digest \$\{\{ steps\.[^.]+\.outputs\.image_digest \}\}/,
    'release workflow must stamp kubernetes bundles with the published image repository, tag, and digest',
  );
  assert.match(
    workflow,
    /desktop-release:[\s\S]*apt-get install -y[\s\S]*xvfb/s,
    'desktop release workflow must install xvfb so Linux packaged launch smoke can run headlessly',
  );
  assert.match(
    workflow,
    /package-release-assets\.mjs desktop[\s\S]*--output-dir artifacts\/release[\s\S]*smoke-desktop-installers\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --release-assets-dir artifacts\/release/,
    'desktop release workflow must smoke packaged installers before attesting and uploading artifacts',
  );
  assert.match(
    workflow,
    /smoke-desktop-installers\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --release-assets-dir artifacts\/release[\s\S]*smoke-desktop-packaged-launch\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --release-assets-dir artifacts\/release/,
    'desktop release workflow must smoke packaged launch startup after installer smoke and before attesting artifacts',
  );
  assert.match(
    workflow,
    /package-release-assets\.mjs server[\s\S]*smoke-server-release-assets\.mjs --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --release-assets-dir artifacts\/release/,
    'server release workflow must smoke packaged server bundles before attesting and uploading artifacts',
  );
  assert.match(
    workflow,
    /package-release-assets\.mjs container[\s\S]*smoke-deployment-release-assets\.mjs --family container --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --accelerator \$\{\{ matrix\.accelerator \}\} --release-assets-dir artifacts\/release/,
    'container release workflow must smoke packaged deployment bundles before attesting and uploading artifacts',
  );
  assert.match(
    workflow,
    /package-release-assets\.mjs kubernetes[\s\S]*smoke-deployment-release-assets\.mjs --family kubernetes --platform \$\{\{ matrix\.platform \}\} --arch \$\{\{ matrix\.arch \}\} --target \$\{\{ matrix\.target \}\} --accelerator \$\{\{ matrix\.accelerator \}\} --release-assets-dir artifacts\/release/,
    'kubernetes release workflow must smoke packaged chart bundles before attesting and uploading artifacts',
  );
  assert.match(
    packagerSource,
    /image:\s*',?\s*`  repository: \$\{normalizedImageRepository\}`[\s\S]*`  tag: \$\{normalizedImageTag\}`/s,
    'kubernetes packager must write image repository and tag into values.release.yaml',
  );
  assert.match(
    packagerSource,
    /imageTag:\s*normalizedImageTag/,
    'kubernetes packager must record image tag metadata in release-metadata.json',
  );
  assert.match(
    kubernetesReadme,
    /image tag/i,
    'kubernetes README must explain the immutable image tag contract',
  );
  assert.match(
    releaseDoc,
    /check:multi-mode/,
    'release and deployment docs must expose the unified multi-mode verification command',
  );
  assert.match(
    releaseDoc,
    /versionSourcesAligned/,
    'release and deployment docs must explain OpenClaw version-source alignment separately from upgrade readiness',
  );
  assert.match(
    releaseDoc,
    /release tag/i,
    'release and deployment docs must describe the kubernetes image release tag contract',
  );
  assert.match(
    releaseDoc,
    /release:smoke:desktop/,
    'release and deployment docs must expose the desktop smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:desktop-packaged-launch/,
    'release and deployment docs must expose the desktop packaged launch smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:desktop-startup/,
    'release and deployment docs must expose the desktop startup smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:server/,
    'release and deployment docs must expose the server smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:container/,
    'release and deployment docs must expose the container smoke command',
  );
  assert.match(
    releaseDoc,
    /release:smoke:kubernetes/,
    'release and deployment docs must expose the kubernetes smoke command',
  );
  assert.match(
    releaseDoc,
    /kernelInstallContracts/,
    'release and deployment docs must describe desktop kernel install contract metadata',
  );
  assert.match(
    releaseDoc,
    /desktopInstallerSmoke/,
    'release and deployment docs must describe aggregated desktop installer smoke metadata',
  );
  assert.match(
    releaseDoc,
    /desktopStartupSmoke/,
    'release and deployment docs must describe aggregated desktop startup smoke metadata',
  );
  assert.match(
    releaseDoc,
    /localAiProxyRuntime/,
    'release and deployment docs must describe aggregated desktop startup local ai proxy runtime metadata',
  );
  assert.match(
    releaseDoc,
    /serverBundleSmoke/,
    'release and deployment docs must describe aggregated server bundle smoke metadata',
  );
  assert.match(
    releaseDoc,
    /deploymentSmoke/,
    'release and deployment docs must describe aggregated deployment smoke metadata',
  );
  assert.match(
    releaseDoc,
    /kernelInstallReadiness/,
    'release and deployment docs must describe per-kernel install readiness metadata',
  );
  assert.match(
    releaseDoc,
    /externalRuntimePolicy/,
    'release and deployment docs must describe per-kernel external runtime policy evidence inside install readiness metadata',
  );
  assert.match(
    releaseDoc,
    /installReadyLayout/,
    'release and deployment docs must describe install-ready desktop layout evidence',
  );
  assert.match(
    releaseDoc,
    /archive-extract-ready/,
    'release and deployment docs must document the current Windows and Linux installReadyLayout.mode contract',
  );
  assert.match(
    releaseDoc,
    /staged-layout/,
    'release and deployment docs must document the current macOS installReadyLayout.mode contract',
  );
  assert.match(
    releaseDoc,
    /desktop-startup-evidence\.json/,
    'release and deployment docs must describe the captured desktop startup evidence artifact desktop-startup-evidence.json',
  );
  assert.match(
    releaseDoc,
    /check:sdkwork-host-runtime/,
    'release and deployment docs must expose the unified runtime authority verification command',
  );
  assert.match(
    releaseDoc,
    /unified host runtime smoke report/i,
    'release and deployment docs must describe the persisted unified host runtime smoke report',
  );
  assert.match(
    releaseDoc,
    /deployment bootstrap smoke report/i,
    'release and deployment docs must describe the persisted deployment bootstrap smoke report',
  );
  assert.match(
    releaseDoc,
    /--package-profile/,
    'release and deployment docs must describe local package-profile selection for desktop packaging and smoke verification',
  );
  assert.match(
    releaseDoc,
    /SDKWORK_RELEASE_PACKAGE_PROFILE/,
    'release and deployment docs must describe the package-profile environment override',
  );
  assert.match(
    releaseDoc,
    /release:package:container/,
    'release and deployment docs must expose the container packaging command for deployment bundles',
  );
  assert.match(
    releaseDoc,
    /release:package:kubernetes/,
    'release and deployment docs must expose the kubernetes packaging command for deployment bundles',
  );
  assert.match(
    runtimeSmokeReport,
    /Automated Verification/,
    'the unified host runtime smoke report must preserve automated verification evidence',
  );
  assert.match(
    runtimeSmokeReport,
    /check:sdkwork-host-runtime/,
    'the unified host runtime smoke report must record runtime authority verification commands',
  );
  assert.match(
    runtimeSmokeReport,
    /Follow-up Manual Checklist/,
    'the unified host runtime smoke report must preserve the remaining manual verification checklist',
  );
  assert.match(
    deploymentBootstrapSmokeReport,
    /Automated Verification/,
    'the deployment bootstrap smoke report must preserve automated verification evidence',
  );
  assert.match(
    deploymentBootstrapSmokeReport,
    /docker compose startup/i,
    'the deployment bootstrap smoke report must preserve docker compose startup evidence',
  );
  assert.match(
    deploymentBootstrapSmokeReport,
    /singleton-k8s readiness/i,
    'the deployment bootstrap smoke report must preserve singleton-k8s readiness evidence',
  );

  console.log('Release closure checks passed.');
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
