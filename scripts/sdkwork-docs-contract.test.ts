import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function assertReadableChineseMarkdown(relPath: string, text: string) {
  assert.match(
    text,
    /[\u4e00-\u9fff]/u,
    `${relPath} must contain real Chinese text`,
  );
  assert.doesNotMatch(
    text,
    /[\u0080-\u009f\u00c0-\u00ff]/u,
    `${relPath} must not contain mojibake Latin-1/control characters`,
  );
}

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('sdkwork-claw-docs keeps the V5 docs package surface locally', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>('packages/sdkwork-claw-docs/package.json');
  const indexSource = read('packages/sdkwork-claw-docs/src/index.ts');

  assert.ok(exists('packages/sdkwork-claw-docs/src/Docs.tsx'));
  assert.ok(exists('packages/sdkwork-claw-docs/src/content/index.ts'));

  assert.match(indexSource, /export \* from '\.\/Docs';/);
  assert.match(indexSource, /export \* from '\.\/content';/);
  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-docs']);
  assert.doesNotMatch(indexSource, /@sdkwork\/claw-studio-docs/);
});

await runTest('workspace docs document server verification and release planning entrypoints', () => {
  const gettingStarted = read('docs/guide/getting-started.md');
  const gettingStartedZh = read('docs/zh-CN/guide/getting-started.md');
  const commandsReference = read('docs/reference/commands.md');
  const commandsReferenceZh = read('docs/zh-CN/reference/commands.md');
  const readme = read('README.md');
  const contributing = read('docs/contributing/index.md');
  const releaseAndDeployment = read('docs/core/release-and-deployment.md');
  const releaseAndDeploymentZh = read('docs/zh-CN/core/release-and-deployment.md');
  const rootPackage = readJson<{ scripts?: Record<string, string> }>('package.json');

  assertReadableChineseMarkdown('docs/zh-CN/core/release-and-deployment.md', releaseAndDeploymentZh);
  assertReadableChineseMarkdown('docs/zh-CN/reference/commands.md', commandsReferenceZh);

  assert.match(gettingStarted, /pnpm check:multi-mode/);
  assert.match(gettingStartedZh, /pnpm check:multi-mode/);
  assert.match(gettingStarted, /pnpm check:server/);
  assert.match(gettingStarted, /pnpm release:plan/);
  assert.match(commandsReference, /pnpm check:multi-mode/);
  assert.match(commandsReferenceZh, /pnpm check:multi-mode/);
  assert.match(commandsReference, /pnpm check:server/);
  assert.match(commandsReferenceZh, /pnpm check:server/);
  assert.match(commandsReference, /pnpm check:desktop-openclaw-runtime/);
  assert.match(commandsReferenceZh, /pnpm check:desktop-openclaw-runtime/);
  assert.match(commandsReference, /pnpm check:sdkwork-host-runtime/);
  assert.match(commandsReferenceZh, /pnpm check:sdkwork-host-runtime/);
  assert.match(commandsReference, /pnpm check:automation/);
  assert.match(commandsReference, /pnpm check:release-flow/);
  assert.match(commandsReference, /pnpm check:ci-flow/);
  assert.match(commandsReference, /pnpm release:plan/);
  assert.match(commandsReference, /requiredTargetCount/);
  assert.match(commandsReference, /familyTargetCounts/);
  assert.match(commandsReference, /release target-count authority/);
  assert.match(commandsReferenceZh, /pnpm release:plan/);
  assert.match(commandsReference, /pnpm release:status/);
  assert.match(commandsReference, /status` \(`complete`, `partial`, or `invalid`\)/);
  assert.match(commandsReference, /issueCount/);
  assert.match(commandsReference, /blockingIssueCount/);
  assert.match(commandsReference, /hasIssues/);
  assert.match(commandsReference, /hasBlockingIssues/);
  assert.match(commandsReference, /issueCountsBySeverity/);
  assert.match(commandsReference, /issueCountsByCode/);
  assert.match(commandsReference, /recommendedAction/);
  assert.match(commandsReference, /nextCommands/);
  assert.match(commandsReference, /nextActions/);
  assert.match(commandsReference, /fix-issue/);
  assert.match(commandsReference, /package-target/);
  assert.match(commandsReference, /priority/);
  assert.match(commandsReference, /pnpm release:smoke:desktop/);
  assert.match(commandsReferenceZh, /pnpm release:smoke:desktop/);
  assert.match(commandsReference, /pnpm release:smoke:desktop-packaged-launch/);
  assert.match(commandsReferenceZh, /pnpm release:smoke:desktop-packaged-launch/);
  assert.match(commandsReference, /pnpm release:smoke:desktop-startup/);
  assert.match(commandsReferenceZh, /pnpm release:smoke:desktop-startup/);
  assert.match(commandsReference, /pnpm release:smoke:server/);
  assert.match(commandsReferenceZh, /pnpm release:smoke:server/);
  assert.match(commandsReference, /pnpm release:smoke:container/);
  assert.match(commandsReferenceZh, /pnpm release:smoke:container/);
  assert.match(commandsReference, /pnpm release:smoke:kubernetes/);
  assert.match(commandsReferenceZh, /pnpm release:smoke:kubernetes/);
  assert.match(commandsReferenceZh, /pnpm release:smoke:web/);
  assert.match(commandsReference, /pnpm release:finalize:partial/);
  assert.match(commandsReferenceZh, /pnpm release:finalize:partial/);
  assert.match(commandsReference, /pnpm release:write-attestation-evidence/);
  assert.match(commandsReferenceZh, /pnpm release:write-attestation-evidence/);
  assert.match(commandsReference, /pnpm release:assert-ready/);
  assert.match(commandsReferenceZh, /pnpm release:assert-ready/);
  assert.match(commandsReference, /pnpm release:fixture:ready/);
  assert.match(commandsReference, /all 25 required Web, desktop, server, container, and kubernetes targets/);
  assert.match(commandsReference, /cross-check the required target count against `release:plan\.requiredTargetCount`/);
  assert.match(commandsReference, /mainline CI runs this command as the final readiness success-path proof/);
  assert.match(releaseAndDeployment, /pnpm release:fixture:ready/);
  assert.match(releaseAndDeployment, /familyTargetCounts/);
  assert.match(releaseAndDeployment, /requiredTargetCount/);
  assert.match(releaseAndDeployment, /family_target_counts/);
  assert.match(releaseAndDeployment, /required_target_count/);
  assert.match(releaseAndDeployment, /readiness fixture refuses plans that omit `requiredTargetCount`/);
  assert.match(releaseAndDeployment, /pnpm release:status/);
  assert.match(releaseAndDeployment, /blockingIssueCount/);
  assert.match(releaseAndDeployment, /hasBlockingIssues/);
  assert.match(releaseAndDeployment, /issueCountsBySeverity/);
  assert.match(releaseAndDeployment, /issueCountsByCode/);
  assert.match(releaseAndDeployment, /recommendedAction/);
  assert.match(releaseAndDeployment, /complete` means full coverage with no structural issues/);
  assert.match(releaseAndDeployment, /invalid` means one or more issues exist/);
  assert.match(releaseAndDeployment, /nested `releaseCoverage\.status` is `complete`/);
  assert.match(releaseAndDeployment, /nextCommands/);
  assert.match(releaseAndDeployment, /nextActions/);
  assert.match(releaseAndDeployment, /fix-issue/);
  assert.match(releaseAndDeployment, /package-target/);
  assert.match(releaseAndDeployment, /priority/);
  assert.match(releaseAndDeployment, /does not replace `release:assert-ready`/);
  assert.match(releaseAndDeployment, /local and CI success-path proof[\s\S]*covers every target required by the default `claw-studio` profile[\s\S]*cross-checks the fixture target count against the real `release:plan\.requiredTargetCount` summary[\s\S]*real `release:assert-ready`/);
  assert.match(releaseAndDeployment, /CI detects release-matrix drift before a publish run/);
  assert.match(releaseAndDeployment, /releaseCoverage/);
  assert.match(releaseAndDeploymentZh, /releaseCoverage/);
  assert.match(releaseAndDeployment, /pnpm release:assert-ready/);
  assert.match(releaseAndDeploymentZh, /pnpm release:assert-ready/);
  assert.match(releaseAndDeployment, /release-manifest\.json\.sha256\.txt/);
  assert.match(releaseAndDeploymentZh, /release-manifest\.json\.sha256\.txt/);
  assert.match(releaseAndDeployment, /releaseMetadata[\s\S]*release-notes\.md/);
  assert.match(releaseAndDeploymentZh, /releaseMetadata[\s\S]*release-notes\.md/);
  assert.match(releaseAndDeployment, /release-notes\.md[\s\S]*SHA256SUMS\.txt[\s\S]*release-attestations\.json[\s\S]*release:assert-ready/);
  assert.match(releaseAndDeploymentZh, /release-notes\.md[\s\S]*SHA256SUMS\.txt[\s\S]*release-attestations\.json[\s\S]*release:assert-ready/);
  assert.match(releaseAndDeployment, /release-attestations\.json/);
  assert.match(releaseAndDeploymentZh, /release-attestations\.json/);
  assert.match(commandsReference, /release-notes\.md[\s\S]*releaseMetadata[\s\S]*SHA256SUMS\.txt/);
  assert.match(commandsReferenceZh, /release-notes\.md[\s\S]*releaseMetadata[\s\S]*SHA256SUMS\.txt/);
  assert.match(commandsReference, /release-manifest\.json\.sha256\.txt/);
  assert.match(commandsReferenceZh, /release-manifest\.json\.sha256\.txt/);
  assert.match(commandsReference, /release-attestations\.json/);
  assert.match(commandsReferenceZh, /release-attestations\.json/);
  assert.match(releaseAndDeployment, /release asset directories are closed inventories/);
  assert.match(releaseAndDeployment, /not declared by `release-manifest\.json`/);
  assert.match(releaseAndDeployment, /symlinks, junctions, devices, pipes/);
  assert.match(releaseAndDeployment, /non-regular filesystem entry/);
  assert.match(commandsReference, /not declared by the finalized manifest/);
  assert.match(commandsReference, /symlinks, junctions, devices, pipes, or other non-regular release directory entries/);
  assert.match(
    commandsReference,
    /release:smoke:desktop[\s\S]*OpenClaw `runtime\.zip`[\s\S]*macOS `\.app\.zip`\/`\.app\.tar\.gz` companion archive entries[\s\S]*duplicate normalized paths[\s\S]*encrypted ZIP entries[\s\S]*symlinks[\s\S]*non-regular archive entries/,
  );
  assert.match(
    commandsReference,
    /release:smoke:web[\s\S]*archive-internal absolute paths[\s\S]*duplicate normalized paths[\s\S]*symlinks[\s\S]*hardlinks[\s\S]*non-regular entries/,
  );
  assert.match(
    commandsReference,
    /release:smoke:server[\s\S]*pre-validates `\.tar\.gz`\/`\.zip` archive entries before extraction[\s\S]*absolute paths[\s\S]*duplicate normalized paths[\s\S]*symlinks[\s\S]*hardlinks[\s\S]*non-regular archive entries/,
  );
  assert.match(
    commandsReference,
    /release:smoke:container[\s\S]*pre-validates archive entries before extraction[\s\S]*unsafe paths[\s\S]*duplicate normalized paths[\s\S]*symlinks[\s\S]*hardlinks[\s\S]*non-regular archive entries/,
  );
  assert.match(
    commandsReference,
    /release:smoke:kubernetes[\s\S]*pre-validates archive entries before extraction[\s\S]*unsafe paths[\s\S]*duplicate normalized paths[\s\S]*symlinks[\s\S]*hardlinks[\s\S]*non-regular archive entries/,
  );
  assert.match(
    releaseAndDeployment,
    /Desktop installer smoke also treats the packaged OpenClaw `runtime\.zip` and macOS `\.app\.zip`\/`\.app\.tar\.gz` companion archive as release-security boundaries[\s\S]*duplicate normalized paths[\s\S]*encrypted ZIP entries[\s\S]*symlinks[\s\S]*non-regular archive entries/,
  );
  assert.match(
    releaseAndDeployment,
    /archive-internal absolute paths[\s\S]*duplicate normalized paths[\s\S]*symlinks[\s\S]*hardlinks[\s\S]*non-regular archive entries/,
  );
  assert.match(
    releaseAndDeployment,
    /Before invoking PowerShell `Expand-Archive`, `unzip`, or `tar`[\s\S]*pre-validates every `\.tar\.gz`\/`\.zip` archive entry/,
  );
  assert.match(
    releaseAndDeployment,
    /desktop OpenClaw runtime and macOS companion archive smoke reject unsafe archive-internal entries before install-root simulation or installer smoke reporting/,
  );
  assert.match(
    releaseAndDeployment,
    /release:assert-ready[\s\S]*independently revalidates every finalized `\.tar\.gz` and `\.zip` artifact[\s\S]*macOS `\.app\.zip` and `\.app\.tar\.gz` desktop app companion archives/,
  );
  assert.match(
    releaseAndDeployment,
    /finalized archive artifact contains unsafe internal entries/,
  );
  assert.match(
    releaseAndDeployment,
    /web\/server\/deployment smoke reject unsafe archive-internal entries before reading or extracting packaged archives/,
  );
  assert.match(gettingStarted, /release-manifest\.json\.sha256\.txt/);
  assert.match(gettingStartedZh, /release-manifest\.json\.sha256\.txt/);
  assert.match(gettingStarted, /release-attestations\.json/);
  assert.match(gettingStartedZh, /release-attestations\.json/);
  assert.match(gettingStarted, /gh attestation verify/);
  assert.match(gettingStartedZh, /gh attestation verify/);
  assert.match(releaseAndDeployment, /gh attestation verify/);
  assert.match(releaseAndDeploymentZh, /gh attestation verify/);
  assert.match(
    releaseAndDeployment,
    /release-attestations\.json[\s\S]*relativePath[\s\S]*sha256[\s\S]*repository[\s\S]*releaseTag[\s\S]*sourceRef[\s\S]*predicateType[\s\S]*signerWorkflow[\s\S]*signerWorkflowIdentity/,
  );
  assert.match(
    releaseAndDeploymentZh,
    /release-attestations\.json[\s\S]*relativePath[\s\S]*sha256[\s\S]*repository[\s\S]*releaseTag[\s\S]*sourceRef[\s\S]*predicateType[\s\S]*signerWorkflow[\s\S]*signerWorkflowIdentity/,
  );
  assert.match(releaseAndDeployment, /gh attestation verify[\s\S]*--signer-workflow[\s\S]*signerWorkflowIdentity/);
  assert.match(releaseAndDeploymentZh, /gh attestation verify[\s\S]*--signer-workflow[\s\S]*signerWorkflowIdentity/);
  assert.match(
    releaseAndDeployment,
    /release:assert-ready[\s\S]*desktopInstallerSmoke[\s\S]*desktopStartupSmoke[\s\S]*webArchiveSmoke[\s\S]*serverBundleSmoke[\s\S]*deploymentSmoke/,
  );
  assert.match(
    releaseAndDeploymentZh,
    /release:assert-ready[\s\S]*desktopInstallerSmoke[\s\S]*desktopStartupSmoke[\s\S]*webArchiveSmoke[\s\S]*serverBundleSmoke[\s\S]*deploymentSmoke/,
  );
  assert.match(commandsReference, /release:assert-ready[\s\S]*family-specific smoke metadata/);
  assert.match(commandsReferenceZh, /release:assert-ready[\s\S]*smoke 元数据/);
  assert.match(
    commandsReference,
    /release:assert-ready[\s\S]*every finalized `\.tar\.gz` and `\.zip` artifact[\s\S]*macOS `\.app\.zip` and `\.app\.tar\.gz` desktop app companion archives[\s\S]*symlinks[\s\S]*non-regular archive entries/,
  );
  assert.match(
    commandsReference,
    /release:assert-ready[\s\S]*reportRelativePath[\s\S]*manifestRelativePath[\s\S]*capturedEvidenceRelativePath[\s\S]*evidence files still present[\s\S]*sha256\/size[\s\S]*smoke report contents/,
  );
  assert.match(
    commandsReferenceZh,
    /release:assert-ready[\s\S]*reportRelativePath[\s\S]*manifestRelativePath[\s\S]*capturedEvidenceRelativePath[\s\S]*sha256\/size[\s\S]*smoke report/,
  );
  assert.match(releaseAndDeploymentZh, /## 发布就绪门禁/);
  assert.doesNotMatch(releaseAndDeploymentZh, /## Release Readiness Gate/);
  assert.match(releaseAndDeployment, /--allow-partial-release/);
  assert.match(releaseAndDeploymentZh, /--allow-partial-release/);
  assert.match(releaseAndDeploymentZh, /releaseCoverage\.allowPartialRelease/);
  assert.match(releaseAndDeployment, /partial manifests for a different release profile/);
  assert.match(releaseAndDeployment, /unsafe or non-canonical artifact paths/);
  assert.match(
    releaseAndDeployment,
    /capturedEvidenceRelativePath[\s\S]*canonical relative path inside the release asset directory/,
  );
  assert.match(
    releaseAndDeployment,
    /release:assert-ready[\s\S]*release-attestations\.json[\s\S]*missing, malformed, points at missing evidence files, has mismatched evidence sha256\/size bindings, or no longer matches the referenced smoke report contents[\s\S]*reportRelativePath[\s\S]*manifestRelativePath[\s\S]*capturedEvidenceRelativePath[\s\S]*reportSha256[\s\S]*manifestSha256[\s\S]*capturedEvidenceSha256/,
  );
  assert.match(
    releaseAndDeploymentZh,
    /reportRelativePath[\s\S]*manifestRelativePath[\s\S]*capturedEvidenceRelativePath[\s\S]*reportSha256[\s\S]*manifestSha256[\s\S]*capturedEvidenceSha256[\s\S]*sha256\/size/,
  );
  assert.match(
    releaseAndDeploymentZh,
    /reportRelativePath[\s\S]*manifestRelativePath[\s\S]*capturedEvidenceRelativePath[\s\S]*release 资产目录内的普通文件[\s\S]*smoke report[\s\S]*漂移/,
  );
  assert.match(
    releaseAndDeployment,
    /Smoke generation itself is also fail-closed[\s\S]*reject unsafe or non-canonical artifact, launcher, and captured evidence paths before writing report metadata[\s\S]*finalization revalidates those same paths through the shared smoke path contract/,
  );
  assert.match(releaseAndDeployment, /launcherRelativePath[\s\S]*canonical release-relative path/);
  assert.match(
    releaseAndDeploymentZh,
    /release-smoke-report\.json[\s\S]*desktop-startup-smoke-report\.json[\s\S]*artifactRelativePaths[\s\S]*launcherRelativePath[\s\S]*capturedEvidenceRelativePath[\s\S]*shared smoke path contract/,
  );
  assert.match(releaseAndDeployment, /artifacts outside the active release profile/);
  assert.match(releaseAndDeployment, /multiple artifacts for the same release target/);
  assert.match(commandsReference, /wrong-profile partial manifests/);
  assert.match(
    commandsReference,
    /release:smoke:desktop-startup[\s\S]*rejects unsafe or non-canonical artifact and captured evidence paths before writing report metadata/,
  );
  assert.match(
    commandsReferenceZh,
    /release:smoke:desktop-startup[\s\S]*artifactRelativePaths[\s\S]*capturedEvidenceRelativePath[\s\S]*desktop-startup-smoke-report\.json/,
  );
  assert.match(
    commandsReference,
    /release:smoke:server[\s\S]*rejects unsafe or non-canonical artifact and launcher paths before writing `release-smoke-report\.json`/,
  );
  assert.match(
    commandsReferenceZh,
    /release:smoke:server[\s\S]*artifactRelativePaths[\s\S]*launcherRelativePath[\s\S]*release-smoke-report\.json/,
  );
  assert.match(
    commandsReference,
    /release:finalize[\s\S]*revalidate unsafe or non-canonical artifact, launcher, and captured evidence paths through the shared smoke path contract/,
  );
  assert.match(
    commandsReferenceZh,
    /release:finalize[\s\S]*shared smoke path contract/,
  );
  assert.match(commandsReference, /duplicate artifacts for the same release target/);
  assert.match(commandsReference, /SDKWORK_RELEASE_REPOSITORY[\s\S]*GITHUB_REPOSITORY[\s\S]*git remote origin/);
  assert.match(commandsReferenceZh, /SDKWORK_RELEASE_REPOSITORY[\s\S]*GITHUB_REPOSITORY[\s\S]*git remote origin/);
  assert.match(releaseAndDeployment, /pnpm check:multi-mode/);
  assert.match(releaseAndDeploymentZh, /pnpm check:multi-mode/);
  assert.match(releaseAndDeployment, /versionSourcesAligned/);
  assert.match(readme, /pnpm check:multi-mode\s+# validate desktop, server, OpenClaw runtime, and release packaging together/i);
  assert.match(releaseAndDeployment, /pnpm check:desktop/);
  assert.match(releaseAndDeploymentZh, /pnpm check:desktop/);
  assert.match(releaseAndDeployment, /pnpm check:server/);
  assert.match(releaseAndDeploymentZh, /pnpm check:server/);
  assert.match(releaseAndDeployment, /pnpm check:automation/);
  assert.match(releaseAndDeployment, /pnpm release:plan/);
  assert.match(releaseAndDeploymentZh, /pnpm release:plan/);
  assert.match(releaseAndDeployment, /pnpm release:package:desktop/);
  assert.match(releaseAndDeployment, /pnpm release:package:server/);
  assert.match(releaseAndDeployment, /pnpm release:package:container/);
  assert.match(releaseAndDeployment, /pnpm release:package:kubernetes/);
  assert.match(releaseAndDeployment, /pnpm release:package:web/);
  assert.match(releaseAndDeploymentZh, /pnpm release:package:desktop/);
  assert.match(releaseAndDeploymentZh, /pnpm release:package:server/);
  assert.match(releaseAndDeploymentZh, /pnpm release:package:container/);
  assert.match(releaseAndDeploymentZh, /pnpm release:package:kubernetes/);
  assert.match(releaseAndDeploymentZh, /pnpm release:package:web/);
  assert.match(releaseAndDeploymentZh, /pnpm release:smoke:desktop/);
  assert.match(releaseAndDeploymentZh, /pnpm release:smoke:server/);
  assert.match(releaseAndDeploymentZh, /pnpm release:smoke:container/);
  assert.match(releaseAndDeploymentZh, /pnpm release:smoke:kubernetes/);
  assert.match(readme, /pnpm check:server\s+# validate the native Rust server runtime/i);
  assert.match(readme, /pnpm check:automation\s+# validate release and CI automation contracts/i);
  assert.doesNotMatch(readme, /node scripts\/check-server-platform-foundation\.mjs/);
  assert.match(contributing, /pnpm check:multi-mode/);
  assert.match(contributing, /pnpm check:server/);
  assert.match(contributing, /pnpm check:automation/);
  assert.match(
    rootPackage.scripts?.['check:multi-mode'] ?? '',
    /sdkwork-run-pnpm check:desktop && sdkwork-run-pnpm check:server && sdkwork-run-pnpm check:sdkwork-host-runtime && sdkwork-run-pnpm check:desktop-openclaw-runtime && sdkwork-run-pnpm check:release-flow/,
  );
  assert.match(rootPackage.scripts?.['check:sdkwork-docs'] ?? '', /vitepress-command-contract\.test\.mjs/);
});

await runTest('workspace docs keep internal plans out of public local-search indexing', async () => {
  const configSource = read('docs/.vitepress/siteConfig.mjs');
  const searchPolicyPath = 'docs/.vitepress/searchIndexPolicy.mjs';

  assert.ok(exists(searchPolicyPath));
  assert.equal(exists('docs/.vitepress/config.ts'), false);
  assert.equal(exists('docs/.vitepress/searchIndexPolicy.ts'), false);
  assert.match(configSource, /searchIndexPolicy/);
  assert.match(configSource, /options:\s*localSearchOptions/);
  assert.match(configSource, /srcExclude:\s*publicDocsSrcExclude/);

  const policyModuleUrl = pathToFileURL(path.join(root, searchPolicyPath)).href;
  const policyModule = await import(policyModuleUrl);

  assert.ok(Array.isArray(policyModule.publicDocsSrcExclude));
  assert.ok(policyModule.publicDocsSrcExclude.includes('plans/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes('superpowers/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes('zh-CN/plans/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes('reports/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes('release/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes('review/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes('step/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes('prompts/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes(`${String.fromCodePoint(0x67b6, 0x6784)}/**`));

  assert.equal(policyModule.shouldIndexSearchPage('guide/getting-started.md'), true);
  assert.equal(policyModule.shouldIndexSearchPage('reference/commands.md'), true);
  assert.equal(policyModule.shouldIndexSearchPage('plans/2026-03-10-tauri-local-packaging-workflow.md'), false);
  assert.equal(policyModule.shouldIndexSearchPage('superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md'), false);
  assert.equal(policyModule.shouldIndexSearchPage('reports/2026-04-05-unified-rust-host-runtime-hardening-smoke.md'), false);
  assert.equal(policyModule.shouldIndexSearchPage('release/release-2026-04-08-34.md'), false);
  assert.equal(policyModule.shouldIndexSearchPage('review/step-03-local-ai-proxy-shared-types-hotspot-split-2026-04-08.md'), false);
  assert.equal(policyModule.shouldIndexSearchPage('step/2026-04-07-openclaw-v2026-4-5-audit-log.md'), false);
  assert.equal(policyModule.shouldIndexSearchPage('prompts/internal-agent-prompt.md'), false);
  assert.equal(policyModule.shouldIndexSearchPage(`${String.fromCodePoint(0x67b6, 0x6784)}/README.md`), false);
  assert.equal(policyModule.shouldIndexSearchPage('zh-CN/guide/getting-started.md'), true);
  assert.equal(policyModule.shouldIndexSearchPage('zh-CN/plans/internal-only.md'), false);
});

await runTest('workspace docs publish only curated public docs sections', async () => {
  const searchPolicySource = read('docs/.vitepress/searchIndexPolicy.mjs');
  const vitepressRunnerSource = read('scripts/run-vitepress.mjs');

  assert.match(
    searchPolicySource,
    /internalDocsPrefixes[\s\S]*'reports\/'[\s\S]*'review\/'[\s\S]*'step\/'/,
    'public docs build must exclude historical reports, review logs, and execution-step records',
  );
  assert.match(
    searchPolicySource,
    /internalDocsPrefixes[\s\S]*'release\/'/,
    'public docs build must exclude release-note fragments and prompt logs from the published site',
  );
  assert.match(
    searchPolicySource,
    /internalDocsPrefixes[\s\S]*'prompts\/'/,
    'public docs build must exclude prompt logs from the published site',
  );
  assert.match(
    vitepressRunnerSource,
    /findSidebarGroups[\s\S]*buildSidebarConfig[\s\S]*renderSidebar/,
    'static docs build must render sidebars from the curated VitePress config instead of listing filesystem pages',
  );
  assert.match(
    vitepressRunnerSource,
    /verifyStaticDocsLinks[\s\S]*missing internal link/,
    'static docs build must verify generated root-relative internal links before reporting success',
  );
  assert.doesNotMatch(
    vitepressRunnerSource,
    /pages\.slice\(0,\s*80\)/,
    'static docs build must not expose arbitrary filesystem pages in the public sidebar',
  );
});
