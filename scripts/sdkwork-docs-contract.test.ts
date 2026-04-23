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
  assert.match(commandsReferenceZh, /pnpm release:plan/);
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
  const configSource = read('docs/.vitepress/config.ts');
  const searchPolicyPath = 'docs/.vitepress/searchIndexPolicy.ts';

  assert.ok(exists(searchPolicyPath));
  assert.match(configSource, /searchIndexPolicy/);
  assert.match(configSource, /options:\s*localSearchOptions/);
  assert.match(configSource, /srcExclude:\s*publicDocsSrcExclude/);

  const policyModuleUrl = pathToFileURL(path.join(root, searchPolicyPath)).href;
  const policyModule = await import(policyModuleUrl);

  assert.ok(Array.isArray(policyModule.publicDocsSrcExclude));
  assert.ok(policyModule.publicDocsSrcExclude.includes('plans/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes('superpowers/**'));
  assert.ok(policyModule.publicDocsSrcExclude.includes('zh-CN/plans/**'));

  assert.equal(policyModule.shouldIndexSearchPage('guide/getting-started.md'), true);
  assert.equal(policyModule.shouldIndexSearchPage('reference/commands.md'), true);
  assert.equal(policyModule.shouldIndexSearchPage('plans/2026-03-10-tauri-local-packaging-workflow.md'), false);
  assert.equal(policyModule.shouldIndexSearchPage('superpowers/specs/2026-04-02-claw-studio-unified-host-platform-v7-design.md'), false);
  assert.equal(policyModule.shouldIndexSearchPage('zh-CN/guide/getting-started.md'), true);
  assert.equal(policyModule.shouldIndexSearchPage('zh-CN/plans/internal-only.md'), false);
});
