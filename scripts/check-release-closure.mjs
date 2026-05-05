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
    packageJson.scripts['check:release-flow'],
    /sdkwork-run-node scripts\/release\/release-coverage\.test\.mjs/,
    'check:release-flow must execute the shared release coverage helper tests',
  );
  assert.match(
    packageJson.scripts['check:release-flow'],
    /sdkwork-run-node scripts\/release\/release-status\.test\.mjs/,
    'check:release-flow must execute the release status diagnostic tests',
  );
  assert.match(
    packageJson.scripts['check:release-flow'],
    /sdkwork-run-node scripts\/release\/release-paths\.test\.mjs/,
    'check:release-flow must execute the shared release path helper tests',
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
    packageJson.scripts['release:smoke:web'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs smoke web/,
    'package.json must expose the packaged web archive smoke command',
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
  assert.match(
    packageJson.scripts['release:finalize'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs finalize$/,
    'package.json must expose strict full-matrix release finalization as the default command',
  );
  assert.doesNotMatch(
    packageJson.scripts['release:finalize'],
    /--allow-partial-release/,
    'the default release finalization command must not allow partial release manifests',
  );
  assert.match(
    packageJson.scripts['release:finalize:partial'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs finalize --allow-partial-release/,
    'package.json must make partial local/debug finalization explicit',
  );
  assert.match(
    packageJson.scripts['release:assert-ready'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs assert-ready/,
    'package.json must expose an explicit finalized release readiness assertion command',
  );
  assert.match(
    packageJson.scripts['release:status'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs status/,
    'package.json must expose a machine-readable local release status diagnostic command',
  );
  assert.match(
    packageJson.scripts['release:fixture:ready'],
    /sdkwork-run-node scripts\/release\/write-readiness-fixture\.mjs/,
    'package.json must expose a complete local release readiness fixture generator',
  );
  assert.match(
    packageJson.scripts['check:release-flow'],
    /sdkwork-run-node scripts\/release\/write-readiness-fixture\.mjs --help/,
    'check:release-flow must keep the release readiness fixture generator CLI loadable',
  );
  assert.match(
    read('scripts/release/write-readiness-fixture.mjs'),
    /createReleasePlan[\s\S]*buildReleaseCoverage[\s\S]*releaseCoverage\.status !== 'complete'[\s\S]*releasePlan\.requiredTargetCount[\s\S]*releasePlanTargetCount !== releaseCoverage\.requiredTargets\.length[\s\S]*assertReleaseReadiness/,
    'release readiness fixture generator must build complete default-profile coverage, cross-check the release plan target count from plan metadata, and verify it through the real readiness gate',
  );
  assert.match(
    read('scripts/release/local-release-command.test.mjs'),
    /complete default-profile publish gate fixture[\s\S]*artifactCount, 25[\s\S]*requiredTargetCount, 25[\s\S]*releasePlanTargetCount, 25[\s\S]*assertReleaseReadiness/,
    'local release tests must prove the readiness fixture covers the full default profile, matches the release plan target count, and passes the real readiness gate',
  );
  assert.match(
    read('scripts/release/local-release-command.test.mjs'),
    /machine-readable release status[\s\S]*missingTargetCount, 25[\s\S]*nextCommands[\s\S]*nextActions[\s\S]*package-target[\s\S]*release status from existing partial manifests[\s\S]*missingTargetCount, 24[\s\S]*nextActions[\s\S]*package-target/,
    'local release tests must prove release:status reports empty and partial local aggregations with actionable missing-target commands and prioritized next actions',
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
    /required_target_count: \$\{\{ steps\.plan\.outputs\.required_target_count \}\}[\s\S]*family_target_counts: \$\{\{ steps\.plan\.outputs\.family_target_counts \}\}/,
    'release workflow must forward release plan target-count summaries from the prepare job',
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
    /package-release-assets\.mjs web[\s\S]*smoke-web-release-assets\.mjs --release-assets-dir artifacts\/release/,
    'web release workflow must smoke packaged web and docs archives before attesting and uploading artifacts',
  );
  assert.match(
    workflow,
    /Render release notes[\s\S]*node scripts\/release\/render-release-notes\.mjs --release-tag \$\{\{ needs\.prepare\.outputs\.release_tag \}\} --output release-assets\/release-notes\.md[\s\S]*Finalize release assets[\s\S]*node scripts\/release\/finalize-release-assets\.mjs --profile \$\{\{ inputs\.release_profile \}\} --release-tag \$\{\{ needs\.prepare\.outputs\.release_tag \}\} --repository \$\{\{ github\.repository \}\} --release-assets-dir release-assets[\s\S]*Assert release readiness[\s\S]*node scripts\/release\/assert-release-readiness\.mjs --profile \$\{\{ inputs\.release_profile \}\} --release-assets-dir release-assets/,
    'release workflow must render release notes before strict finalization so public release metadata is covered by the final evidence chain',
  );
  assert.doesNotMatch(
    workflow,
    /Finalize release assets[\s\S]*--allow-partial-release[\s\S]*Assert release readiness/,
    'release workflow must not publish partial release manifests',
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
    /familyTargetCounts[\s\S]*requiredTargetCount[\s\S]*family_target_counts[\s\S]*required_target_count/,
    'release and deployment docs must describe release plan target-count authority outputs',
  );
  assert.match(
    releaseDoc,
    /pnpm release:status[\s\S]*status[\s\S]*issueCount[\s\S]*blockingIssueCount[\s\S]*hasIssues[\s\S]*hasBlockingIssues[\s\S]*issueCountsBySeverity[\s\S]*issueCountsByCode[\s\S]*releaseCoverage[\s\S]*nextCommands[\s\S]*nextActions[\s\S]*recommendedAction[\s\S]*fix-issue[\s\S]*package-target[\s\S]*priority[\s\S]*invalid[\s\S]*does not replace `release:assert-ready`/,
    'release and deployment docs must describe the local release status diagnostic, prioritized next actions, actionable invalid issue semantics, and its boundary from the strict readiness gate',
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
    /releaseCoverage/,
    'release and deployment docs must describe full release coverage metadata',
  );
  assert.match(
    releaseDoc,
    /--allow-partial-release/,
    'release and deployment docs must explain explicit partial local/debug finalization',
  );
  assert.match(
    releaseDoc,
    /removes stale top-level `release-manifest\.json`, `release-manifest\.json\.sha256\.txt`, `release-attestations\.json`, and `SHA256SUMS\.txt`/,
    'release and deployment docs must describe fail-closed stale final manifest cleanup',
  );
  assert.match(
    releaseDoc,
    /release:assert-ready/,
    'release and deployment docs must expose the finalized release readiness assertion command',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /releaseCoverage[\s\S]*allowPartialRelease[\s\S]*Checksum manifest mismatch/,
    'release readiness assertion must reject partial manifests and checksum drift',
  );
  assert.match(
    read('scripts/release/release-profiles.mjs'),
    /manifestFileName:\s*'release-manifest\.json'[\s\S]*manifestChecksumFileName:\s*'release-manifest\.json\.sha256\.txt'[\s\S]*attestationEvidenceFileName:\s*'release-attestations\.json'[\s\S]*globalChecksumsFileName:\s*'SHA256SUMS\.txt'/,
    'release profile must declare the finalized manifest checksum sidecar and attestation evidence names',
  );
  assert.match(
    read('scripts/release/resolve-release-plan.mjs'),
    /manifest_checksum_file_name=\$\{plan\.release\.manifestChecksumFileName\}/,
    'release plan must expose the finalized manifest checksum sidecar name to automation',
  );
  assert.match(
    read('scripts/release/resolve-release-plan.mjs'),
    /attestation_evidence_file_name=\$\{plan\.release\.attestationEvidenceFileName\}/,
    'release plan must expose the finalized attestation evidence file name to automation',
  );
  assert.match(
    read('scripts/release/resolve-release-plan.mjs'),
    /familyTargetCounts[\s\S]*requiredTargetCount[\s\S]*required_target_count=\$\{plan\.requiredTargetCount\}[\s\S]*family_target_counts=\$\{JSON\.stringify\(plan\.familyTargetCounts\)\}/,
    'release plan must expose machine-readable target count summaries to automation',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /writeFileChecksumSidecar[\s\S]*computeSha256\(sourcePath\)[\s\S]*manifestChecksumFileName/,
    'release finalizer must write a detached checksum sidecar for release-manifest.json',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /attestationEvidenceFileName[\s\S]*attestationPredicateType/,
    'release finalizer must stamp attestation evidence contract metadata into release-manifest.json',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /assertReleaseManifestChecksumSidecar[\s\S]*readSingleFileChecksumSidecar[\s\S]*computeSha256\(manifestPath\)[\s\S]*Release manifest checksum sidecar mismatch/,
    'release readiness assertion must verify release-manifest.json before parsing finalized metadata',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /assertReleaseAttestationEvidenceReady[\s\S]*Release attestation evidence[\s\S]*gh attestation verify/s,
    'release readiness assertion must require offline attestation evidence for publishable artifacts',
  );
  assert.match(
    read('scripts/release/write-attestation-evidence.mjs'),
    /gh[\s\S]*attestation[\s\S]*verify[\s\S]*--source-ref[\s\S]*--predicate-type[\s\S]*--format[\s\S]*json[\s\S]*Attestation verification did not bind expected digest/s,
    'release attestation evidence writer must verify every artifact and bind the manifest digest',
  );
  assert.match(
    read('.github/workflows/release-reusable.yml'),
    /Render release notes[\s\S]*Finalize release assets[\s\S]*Attest finalized release assets[\s\S]*Write finalized attestation evidence[\s\S]*Assert release readiness/s,
    'release workflow must render notes before finalization, then attest finalized assets and write attestation evidence before readiness',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /from '\.\/release-paths\.mjs'/,
    'release readiness assertion must use the shared release path helper',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /from '\.\/release-paths\.mjs'/,
    'release finalizer must use the shared release path helper',
  );
  assert.match(
    read('scripts/release/release-smoke-contract.mjs'),
    /from '\.\/release-paths\.mjs'/,
    'release smoke report generation must use the shared release path helper',
  );
  assert.match(
    read('scripts/release/release-smoke-contract.mjs'),
    /normalizeReleaseSmokeRelativePath[\s\S]*assertSafeReleaseRelativePath[\s\S]*normalizeReleaseSmokeRelativePathArray[\s\S]*artifactRelativePaths:\s*normalizeReleaseSmokeRelativePathArray[\s\S]*launcherRelativePath:\s*normalizeReleaseSmokeRelativePath/,
    'release smoke contract must reject unsafe artifact and launcher paths before reports are written',
  );
  assert.match(
    read('scripts/release/smoke-desktop-startup-evidence.mjs'),
    /normalizeReleaseSmokeRelativePath[\s\S]*normalizeReleaseSmokeRelativePathArray[\s\S]*capturedEvidenceRelativePath\s*=\s*normalizeReleaseSmokeRelativePath[\s\S]*artifactRelativePaths:\s*normalizeReleaseSmokeRelativePathArray/,
    'desktop startup smoke report generation must reject unsafe captured evidence and artifact paths before reports are written',
  );
  assert.match(
    read('scripts/release/release-paths.mjs'),
    /assertSafeReleaseRelativePath[\s\S]*path\.posix\.isAbsolute[\s\S]*path\.win32\.isAbsolute[\s\S]*path\.posix\.normalize/,
    'shared release path helper must enforce cross-platform canonical relative artifact paths',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /assertReleaseTopLevelFileName[\s\S]*path\.posix\.basename[\s\S]*path\.win32\.basename[\s\S]*assertReleaseChecksumFileName[\s\S]*assertReleaseManifestChecksumFileName/,
    'release readiness assertion must enforce top-level checksum file names as safe basenames',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /function computeSha256\(filePath\)[\s\S]*openSync[\s\S]*readSync[\s\S]*closeSync/,
    'release readiness assertion must hash artifacts in fixed-size chunks',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /from '\.\/release-coverage\.mjs'/,
    'release readiness assertion must use the shared release coverage helper',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /from '\.\/release-coverage\.mjs'/,
    'release finalizer must use the shared release coverage helper',
  );
  assert.doesNotMatch(
    read('scripts/release/assert-release-readiness.mjs'),
    /function buildRequiredReleaseCoverage\(/,
    'release readiness assertion must not duplicate required-target coverage construction',
  );
  assert.doesNotMatch(
    read('scripts/release/finalize-release-assets.mjs'),
    /function buildRequiredReleaseCoverage\(/,
    'release finalizer must not duplicate required-target coverage construction',
  );
  assert.doesNotMatch(
    read('scripts/release/assert-release-readiness.mjs'),
    /function artifactSatisfiesCoverageRequirement\(/,
    'release readiness assertion must not duplicate artifact coverage matching',
  );
  assert.doesNotMatch(
    read('scripts/release/finalize-release-assets.mjs'),
    /function artifactSatisfiesCoverageRequirement\(/,
    'release finalizer must not duplicate artifact coverage matching',
  );
  assert.match(
    read('scripts/release/release-coverage.mjs'),
    /buildArtifactPresentTargets[\s\S]*artifactSatisfiesCoverageRequirement[\s\S]*buildArtifactsOutsideReleaseProfile[\s\S]*buildDuplicateReleaseTargetEntries[\s\S]*buildReleaseCoverage/,
    'shared release coverage helper must own artifact-derived target verification and profile-boundary checks',
  );
  assert.match(
    read('scripts/release/release-status.mjs'),
    /releaseIssueMetadataByCode[\s\S]*recommendedAction[\s\S]*normalizeReleaseIssue[\s\S]*buildReleaseNextActions/,
    'release status diagnostics must map issue codes to actionable remediation metadata and aggregate next actions',
  );
  assert.match(
    read('scripts/release/release-status.mjs'),
    /createReleasePlan[\s\S]*buildReleaseCoverage[\s\S]*buildArtifactsOutsideReleaseProfile[\s\S]*buildDuplicateReleaseTargetEntries[\s\S]*issues\.map\(normalizeReleaseIssue\)[\s\S]*blockingIssueCount[\s\S]*issueCountsBySeverity[\s\S]*issueCountsByCode[\s\S]*nextCommands[\s\S]*nextActions: buildReleaseNextActions/,
    'release status diagnostics must use the release plan and shared coverage helper to report partial local aggregation status plus prioritized actionable invalid structural issues',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /assertArtifactsWithinActiveReleaseProfile[\s\S]*outside the active release profile/,
    'release readiness assertion must reject artifacts outside the active release profile',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /assertNoDuplicateArtifactsForReleaseTargets[\s\S]*multiple artifacts for the same release target/,
    'release readiness assertion must reject duplicate artifacts for the same release target',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /assertRequiredSmokeMetadata[\s\S]*desktopInstallerSmoke[\s\S]*desktopStartupSmoke[\s\S]*webArchiveSmoke[\s\S]*serverBundleSmoke[\s\S]*deploymentSmoke[\s\S]*assertArtifactsSmokeMetadataReady/,
    'release readiness assertion must reject finalized manifests with missing smoke metadata',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /assertMetadataEvidenceFile[\s\S]*references missing[\s\S]*references a non-file[\s\S]*reportRelativePath[\s\S]*manifestRelativePath[\s\S]*capturedEvidenceRelativePath/,
    'release readiness assertion must reject smoke metadata that references missing or non-file evidence paths',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /buildEvidenceFileMetadata[\s\S]*computeSha256[\s\S]*Size[\s\S]*buildCommonSmokeEvidenceMetadata[\s\S]*buildEvidenceFileMetadata\(smokeReportPath, 'report'\)[\s\S]*buildEvidenceFileMetadata\(manifestPath, 'manifest'\)[\s\S]*buildEvidenceFileMetadata\([\s\S]*'capturedEvidence'/,
    'release finalizer must stamp smoke evidence sha256 and size bindings into final metadata',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /assertMetadataEvidenceIntegrity[\s\S]*computeSha256[\s\S]*mismatch[\s\S]*reportSha256[\s\S]*manifestSha256[\s\S]*capturedEvidenceSha256/,
    'release readiness assertion must verify smoke evidence sha256 and size bindings',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /readMetadataEvidenceJson[\s\S]*readJsonFile/,
    'release readiness assertion must re-read smoke reports and reject drift from finalized metadata',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /removePackagingChecksumSidecars[\s\S]*\.sha256\.txt/,
    'release finalizer must remove per-artifact checksum sidecars after writing the authoritative checksum manifest',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /assertReleaseAssetsDirectoryClosed[\s\S]*files not declared by release-manifest\.json/,
    'release readiness assertion must reject files that would be published but are not declared by the finalized manifest',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /unsupported filesystem entries not declared by release-manifest\.json/,
    'release readiness assertion must reject symlinks and other non-regular release directory entries before publishing',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /function assertSmokeReportCoreMatchesMetadata\(/,
    'release readiness assertion must report smoke metadata drift against referenced reports',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /does not match report/,
    'release readiness assertion must fail closed with explicit smoke report drift errors',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /desktopInstallerSmoke[\s\S]*assertSmokeReportCoreMatchesMetadata[\s\S]*desktopStartupSmoke[\s\S]*assertSmokeReportCoreMatchesMetadata[\s\S]*webArchiveSmoke[\s\S]*assertSmokeReportCoreMatchesMetadata[\s\S]*serverBundleSmoke[\s\S]*assertSmokeReportCoreMatchesMetadata[\s\S]*deploymentSmoke[\s\S]*assertSmokeReportCoreMatchesMetadata/,
    'release readiness assertion must compare smoke reports for every release artifact family',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /validatePartialReleaseAssetManifest[\s\S]*profile mismatch[\s\S]*assertSafeReleaseRelativePath/,
    'release finalizer must reject wrong-profile partial manifests and unsafe partial artifact paths before generating final manifests',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /assertArtifactsWithinActiveReleaseProfile[\s\S]*outside the active release profile/,
    'release finalizer must reject artifacts outside the active release profile before writing final manifests',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /assertNoDuplicateArtifactsForReleaseTargets[\s\S]*multiple artifacts for the same release target/,
    'release finalizer must reject duplicate target artifacts before writing final manifests',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /capturedEvidenceRelativePath[\s\S]*normalizeReleaseSmokeRelativePath/,
    'release finalizer must reject unsafe desktop startup captured evidence paths through the shared smoke path contract before reading evidence',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /assertSafeSmokeLauncherRelativePath[\s\S]*normalizeReleaseSmokeRelativePath[\s\S]*launcher path/,
    'release finalizer must reject unsafe server and deployment smoke launcher paths through the shared smoke path contract',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /normalizeReleaseSmokePathArray[\s\S]*normalizeReleaseSmokeRelativePathArray/,
    'release finalizer must normalize smoke artifact path arrays through the shared smoke path contract',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects checksum file names that resolve outside the release assets directory/,
    'release readiness tests must cover unsafe checksum file names',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects manifest checksum sidecar names that resolve outside the release assets directory/,
    'release readiness tests must cover unsafe manifest checksum sidecar file names',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /verifies present targets from artifact metadata/,
    'release readiness tests must cover artifact-derived release coverage verification',
  );
  assert.match(
    read('scripts/release/release-coverage.test.mjs'),
    /builds required targets and coverage from artifact metadata/,
    'release coverage tests must cover shared target construction and artifact matching',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects artifacts outside the active release profile/,
    'release readiness tests must cover active-profile artifact rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects duplicate artifacts for the same release target/,
    'release readiness tests must cover duplicate target artifact rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /hashes artifacts in fixed-size chunks/,
    'release readiness tests must cover bounded-memory artifact hashing',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /requires canonical relative artifact paths in manifests and checksums/,
    'release readiness tests must cover non-canonical manifest/checksum artifact paths',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects finalized desktop manifests without required smoke metadata/,
    'release readiness tests must cover missing finalized smoke metadata rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects smoke metadata that references missing evidence files/,
    'release readiness tests must cover missing smoke evidence file rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects smoke metadata evidence paths that are not files/,
    'release readiness tests must cover non-file smoke evidence path rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects smoke metadata that drifts from referenced smoke reports/,
    'release readiness tests must cover smoke report drift rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects smoke evidence files whose hashes drift from finalized metadata/,
    'release readiness tests must cover smoke evidence hash drift rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects smoke metadata that omits evidence hash and size bindings/,
    'release readiness tests must cover missing smoke evidence hash and size bindings',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects missing or drifted release manifest checksum sidecars/,
    'release readiness tests must cover finalized manifest checksum sidecar rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects missing or malformed attestation evidence[\s\S]*rejects attestation evidence that does not bind every artifact/,
    'release readiness tests must cover finalized attestation evidence rejection',
  );
  assert.match(
    read('scripts/release/write-attestation-evidence.test.mjs'),
    /verifies every finalized artifact[\s\S]*rejects verification output that does not bind the expected artifact digest/,
    'release attestation evidence writer tests must cover artifact verification and digest binding',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.test.mjs'),
    /release-manifest\.json\.sha256\.txt[\s\S]*release-attestations\.json[\s\S]*missing release manifest checksum sidecar[\s\S]*fileSha256\(manifestPath\)/,
    'release finalizer tests must assert the finalized manifest checksum sidecar is emitted',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.test.mjs'),
    /commonSmokeEvidenceMetadata[\s\S]*fileEvidenceMetadata[\s\S]*'report'[\s\S]*'manifest'[\s\S]*'capturedEvidence'/,
    'release finalizer tests must assert smoke evidence hash and size metadata is emitted',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.test.mjs'),
    /rejects partial manifests from another active release profile/,
    'release finalizer tests must cover wrong-profile partial manifest rejection',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.test.mjs'),
    /rejects non-canonical artifact paths before writing the final manifest/,
    'release finalizer tests must cover non-canonical partial artifact paths',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.test.mjs'),
    /rejects duplicate artifacts for the same release target/,
    'release finalizer tests must cover duplicate target artifact rejection',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.test.mjs'),
    /rejects desktop startup smoke reports that reference evidence outside release assets/,
    'release finalizer tests must cover desktop startup captured evidence path escape rejection',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.test.mjs'),
    /rejects server smoke reports with unsafe launcher paths/,
    'release finalizer tests must cover server smoke launcher path rejection',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.test.mjs'),
    /rejects deployment smoke reports with unsafe launcher paths/,
    'release finalizer tests must cover deployment smoke launcher path rejection',
  );
  assert.match(
    read('scripts/release/release-smoke-contract.test.mjs'),
    /rejects unsafe artifact and launcher paths before writing reports/,
    'release smoke contract tests must cover generation-time unsafe artifact and launcher path rejection',
  );
  assert.match(
    read('scripts/release/archive-entry-safety.mjs'),
    /assertArchiveEntryPathSafe[\s\S]*unsafe absolute path/,
    'shared archive entry safety helper must reject unsafe and non-canonical paths',
  );
  assert.match(
    read('scripts/release/archive-entry-safety.mjs'),
    /assertArchiveEntryPathSafe[\s\S]*unsafe parent traversal path/,
    'shared archive entry safety helper must reject archive parent traversal paths',
  );
  assert.match(
    read('scripts/release/archive-entry-safety.mjs'),
    /assertArchiveEntryPathSafe[\s\S]*non-canonical relative path/,
    'shared archive entry safety helper must reject non-canonical archive paths',
  );
  assert.match(
    read('scripts/release/archive-entry-safety.mjs'),
    /assertUniqueArchiveEntryPath[\s\S]*duplicate archive entry/,
    'shared archive entry safety helper must reject duplicate normalized archive paths',
  );
  assert.match(
    read('scripts/release/archive-entry-safety.mjs'),
    /assertTarArchiveEntryTypeAllowed[\s\S]*unsupported archive entry type[\s\S]*assertZipArchiveEntryTypeAllowed[\s\S]*unsupported archive entry type/,
    'shared archive entry safety helper must reject unsupported tar and zip archive entry types',
  );
  assert.match(
    read('scripts/release/archive-entry-safety.test.mjs'),
    /classifies Unix-mode ZIP directory entries without requiring a trailing slash/,
    'shared archive entry safety tests must cover Unix-mode ZIP directory classification',
  );
  assert.match(
    read('scripts/release/smoke-web-release-assets.mjs'),
    /readArchiveTarGzEntries\(archivePath,[\s\S]*context:\s*'Web release'/,
    'web archive smoke must validate archive entries through the shared archive entry safety helper',
  );
  assert.match(
    read('scripts/release/smoke-server-release-assets.mjs'),
    /assertServerArchiveEntriesSafe[\s\S]*readZipArchiveEntries[\s\S]*readTarGzEntries[\s\S]*assertServerArchiveEntriesSafe\(archivePath\);[\s\S]*Extracting server/,
    'server archive smoke must validate archive entries before invoking platform extractors',
  );
  assert.match(
    read('scripts/release/smoke-deployment-release-assets.mjs'),
    /readZipArchiveEntries\(archivePath,[\s\S]*readTarGzEntries\(archivePath,[\s\S]*Extracting deployment/,
    'deployment archive smoke must validate archive entries before invoking platform extractors',
  );
  assert.match(
    read('scripts/verify-desktop-openclaw-release-assets.mjs'),
    /readZipArchiveEntries\(archivePath,[\s\S]*context:\s*'Desktop OpenClaw runtime'/,
    'desktop OpenClaw runtime verifier must validate runtime.zip entries through the shared archive entry safety helper',
  );
  assert.match(
    read('scripts/release/smoke-desktop-installers.mjs'),
    /assertMacosCompanionArchiveEntriesSafe[\s\S]*\.app\.zip[\s\S]*readZipArchiveEntries[\s\S]*\.app\.tar\.gz[\s\S]*readTarGzEntries[\s\S]*assertMacosCompanionArchiveEntriesSafe\(absolutePath\)/,
    'desktop installer smoke must validate macOS app archive companions before writing installer smoke reports',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.mjs'),
    /getFinalizedArchiveArtifactContext[\s\S]*family\.toLowerCase\(\) === 'desktop'[\s\S]*platform\.toLowerCase\(\) === 'macos'[\s\S]*\.app\.zip[\s\S]*\.app\.tar\.gz[\s\S]*endsWith\('\.tar\.gz'\)[\s\S]*endsWith\('\.zip'\)[\s\S]*assertFinalizedArchiveArtifactEntriesSafe[\s\S]*readZipArchiveEntries[\s\S]*readTarGzEntries[\s\S]*assertFinalizedArchiveArtifactsSafe[\s\S]*assertFinalizedArchiveArtifactsSafe\(\{[\s\S]*releaseAssetsDir: normalizedReleaseAssetsDir[\s\S]*artifacts/,
    'release readiness assertion must independently validate finalized tar.gz and zip archive entries before publishing',
  );
  assert.match(
    read('scripts/release/smoke-web-release-assets.test.mjs'),
    /rejects duplicate normalized archive entries[\s\S]*rejects symlink archive entries/,
    'web archive smoke tests must cover duplicate and symlink archive entry rejection',
  );
  assert.match(
    read('scripts/release/smoke-server-release-assets.test.mjs'),
    /rejects unsafe tar entries before extraction[\s\S]*rejects symlink tar entries before extraction[\s\S]*rejects duplicate normalized zip entries before extraction[\s\S]*rejects symlink zip entries before extraction/,
    'server archive smoke tests must cover unsafe tar, symlink tar, duplicate zip, and symlink zip rejection before extraction',
  );
  assert.match(
    read('scripts/release/smoke-deployment-release-assets.test.mjs'),
    /rejects unsafe archive paths before extraction[\s\S]*rejects symlink archive entries before extraction/,
    'deployment archive smoke tests must cover unsafe path and symlink archive entry rejection before extraction',
  );
  assert.match(
    read('scripts/verify-desktop-openclaw-release-assets.test.mjs'),
    /rejects duplicate normalized runtime archive entries[\s\S]*rejects symlink runtime archive entries/,
    'desktop OpenClaw runtime archive tests must cover duplicate and symlink ZIP entry rejection',
  );
  assert.match(
    read('scripts/release/smoke-desktop-installers.test.mjs'),
    /rejects unsafe macOS app archive companion entries/,
    'desktop installer smoke tests must cover unsafe macOS app archive companion entry rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects unsafe finalized macOS app archive companion entries/,
    'release readiness tests must cover unsafe finalized macOS app archive companion entry rejection',
  );
  assert.match(
    read('scripts/release/assert-release-readiness.test.mjs'),
    /rejects unsafe finalized web archive entries/,
    'release readiness tests must cover unsafe finalized non-desktop archive entry rejection',
  );
  assert.match(
    read('scripts/release/smoke-desktop-startup-evidence.test.mjs'),
    /rejects unsafe artifact paths before writing reports/,
    'desktop startup smoke tests must cover generation-time unsafe artifact path rejection',
  );
  assert.match(
    read('scripts/release/smoke-desktop-startup-evidence.test.mjs'),
    /rejects captured evidence paths outside release assets before writing reports/,
    'desktop startup smoke tests must cover generation-time captured evidence path escape rejection',
  );
  assert.match(
    read('scripts/release/finalize-release-assets.mjs'),
    /removeStaleFinalizedReleaseOutputs\(\{[\s\S]*releaseAssetsDir[\s\S]*profile[\s\S]*\}\);[\s\S]*requireDesktopInstallerSmokeReports/,
    'release finalizer must remove stale top-level finalized outputs before validation starts',
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
    /capturedEvidenceRelativePath[\s\S]*canonical relative path inside the release asset directory/,
    'release and deployment docs must document captured desktop startup evidence path confinement',
  );
  assert.match(
    releaseDoc,
    /launcherRelativePath[\s\S]*canonical release-relative path/,
    'release and deployment docs must document server and deployment launcher path canonicalization',
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
    releaseDoc,
    /release:package:web[\s\S]*rebuilds the production web host[\s\S]*web performance budget[\s\S]*docs site/i,
    'release and deployment docs must document that local web packaging rebuilds web/docs outputs and enforces the web performance budget',
  );
  assert.match(
    packageJson.scripts['release:package:web'],
    /sdkwork-run-node scripts\/release\/local-release-command\.mjs package web/,
    'package.json must expose web packaging through the local release wrapper',
  );
  assert.match(
    read('scripts/release/local-release-command.mjs'),
    /ensureLocalWebBuildPrerequisiteFn\(\{[\s\S]*context[\s\S]*\}\);[\s\S]*packageWebAssetsFn\(context\);[\s\S]*await smokeWebReleaseAssetsFn\(context\);/,
    'local release wrapper must rebuild web/docs prerequisites, package assets, and smoke the real web archive before web packaging completes',
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
