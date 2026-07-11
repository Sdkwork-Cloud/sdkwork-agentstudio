import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rootDir = path.resolve(import.meta.dirname, '..');

function readWorkspaceFile(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('active external-runtime sources avoid stale bundled-runtime diagnostics', () => {
  const desktopInstallReadyLayoutSource = readWorkspaceFile('scripts/release/desktop-install-ready-layout.mjs');
  assert.doesNotMatch(
    desktopInstallReadyLayoutSource,
    /Bundled OpenClaw manifest/,
    'desktop install-ready layout helpers should describe the packaged OpenClaw manifest, not a bundled-runtime manifest',
  );

  const tauriTargetCleanSource = readWorkspaceFile('scripts/ensure-tauri-target-clean.mjs');
  assert.doesNotMatch(
    tauriTargetCleanSource,
    /bundled OpenClaw target manifest does not match the expected bundled runtime manifest/i,
    'tauri target cleanliness diagnostics should compare packaged OpenClaw manifests instead of bundled-runtime manifests',
  );
  assert.doesNotMatch(
    tauriTargetCleanSource,
    /expected bundled OpenClaw manifest|legacy bundled OpenClaw runtime/i,
    'tauri target cleanliness diagnostics should use packaged OpenClaw terminology for active resource-manifest checks',
  );

  const bundledComponentsSource = readWorkspaceFile('scripts/sync-bundled-components.mjs');
  assert.doesNotMatch(
    bundledComponentsSource,
    /prepared bundled runtime package as the source of truth/i,
    'bundled component staging logs should describe prepared OpenClaw package layouts rather than bundled-runtime packages',
  );

  const internalCliSource = readWorkspaceFile('packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/internal_cli.rs');
  assert.doesNotMatch(
    internalCliSource,
    /bundled runtime manifest value|bundled openclaw runtime|bundled resource directory/i,
    'desktop CLI tests should align their manifest terminology with the external-runtime packaged manifest contract',
  );

  const openClawRuntimeSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/openclaw_runtime.rs',
  );
  assert.doesNotMatch(
    openClawRuntimeSource,
    /bundled (?:openclaw )?runtime|bundled manifest|bundled OpenClaw CLI entrypoint/i,
    'desktop OpenClaw runtime diagnostics should describe packaged OpenClaw payloads and installs rather than bundled-runtime semantics',
  );

  const desktopStudioSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/studio.rs',
  );
  assert.doesNotMatch(
    desktopStudioSource,
    /Bundled local OpenClaw runtime managed by Agent Studio\.|Bundled OpenClaw runtime directory managed by Agent Studio\./,
    'desktop studio projections should not describe packaged OpenClaw kernel surfaces as bundled runtimes after the external-runtime hard cut',
  );

  const hostStudioSource = readWorkspaceFile('packages/sdkwork-agentstudio-pc-host-studio/src-host/src/lib.rs');
  assert.doesNotMatch(
    hostStudioSource,
    /Bundled local OpenClaw runtime managed by Agent Studio\./,
    'host studio projections should not describe the built-in OpenClaw instance as a bundled runtime after the external-runtime hard cut',
  );

  const webStudioSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/webStudio.ts',
  );
  assert.doesNotMatch(
    webStudioSource,
    /Bundled local OpenClaw runtime managed by Agent Studio\./,
    'browser fallback projections should not describe the built-in OpenClaw instance as a bundled runtime after the external-runtime hard cut',
  );

  const kernelCenterServiceSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-settings/src/services/kernelCenterService.ts',
  );
  assert.doesNotMatch(
    kernelCenterServiceSource,
    /function formatInstallSource\(|case 'bundled':\s*return 'Bundled';|case 'bundled':\s*return 'Packaged';/,
    'kernel center shared provenance should expose raw install-source identifiers instead of embedding stale or localized install-source wording after the external-runtime hard cut',
  );

  const settingsEnglishLocaleSource = readWorkspaceFile(
    'packages/sdkwork-agentstudio-pc-i18n/src/locales/en/settings.json',
  );
  assert.match(
    settingsEnglishLocaleSource,
    /"installSources"\s*:\s*{[\s\S]*"bundled"\s*:\s*"Packaged"/,
    'kernel center english locale should label bundled install sources as packaged installs',
  );

  const upgradeReadinessSource = readWorkspaceFile('scripts/openclaw-upgrade-readiness.mjs');
  assert.doesNotMatch(
    upgradeReadinessSource,
    /offline bundled runtime upgrade|Local bundled OpenClaw upstream checkout/i,
    'upgrade readiness diagnostics should describe OpenClaw source inputs and packaged upgrades without bundled-runtime wording',
  );

  const rollbackEvidenceSource = readWorkspaceFile('scripts/openclaw-upgrade-rollback-evidence.mjs');
  assert.doesNotMatch(
    rollbackEvidenceSource,
    /bundled runtime manifest|Missing bundled OpenClaw manifest/i,
    'rollback evidence should describe packaged OpenClaw manifests rather than bundled-runtime manifests',
  );

  const releaseAssetVerifierSource = readWorkspaceFile('scripts/verify-desktop-openclaw-release-assets.mjs');
  assert.doesNotMatch(
    releaseAssetVerifierSource,
    /bundled OpenClaw source runtime|bundled source manifest/i,
    'desktop OpenClaw release asset verification should describe prepared source manifests and packaged artifacts without bundled-runtime wording',
  );

  const prepareOpenClawRuntimeSource = readWorkspaceFile('scripts/prepare-openclaw-runtime.mjs');
  assert.doesNotMatch(
    prepareOpenClawRuntimeSource,
    /bundled OpenClaw runtime|bundled runtime package|bundled OpenClaw manifest|bundledNodePath|bundledCliPath|resolveBundledNpmCommand|installBundledRuntimePackageDependencies|stageBundledRuntimeRegistryPackage|cloneBundledRuntimeGitDependency|\bbundledNpm\b/i,
    'prepare-openclaw-runtime should describe packaged manifests and prepared runtime packages with current external-runtime terminology',
  );

  const upgradeExecutionEvidenceSource = readWorkspaceFile('scripts/openclaw-upgrade-execution-evidence.mjs');
  assert.doesNotMatch(
    upgradeExecutionEvidenceSource,
    /stale bundled OpenClaw or permission references/i,
    'upgrade execution evidence should describe stale packaged OpenClaw target residue with current terminology',
  );

  const platformFoundationSource = readWorkspaceFile('scripts/check-desktop-platform-foundation.mjs');
  assert.doesNotMatch(
    platformFoundationSource,
    /bundled openclaw runtime|desktop generated bundled resource root/i,
    'desktop platform foundation check should describe packaged OpenClaw and generated resource roots with current platform terminology',
  );
});
