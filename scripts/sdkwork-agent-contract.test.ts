import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-agent stays local and exposes a dedicated market surface', () => {
  const pkg = readJson<{ dependencies?: Record<string, string> }>(
    'packages/sdkwork-claw-agent/package.json',
  );
  const indexSource = read('packages/sdkwork-claw-agent/src/index.ts');
  const entrySource = read('packages/sdkwork-claw-agent/src/AgentMarket.tsx');
  const pageSource = read('packages/sdkwork-claw-agent/src/pages/AgentMarket.tsx');
  const servicesIndexSource = read('packages/sdkwork-claw-agent/src/services/index.ts');

  assert.ok(exists('packages/sdkwork-claw-agent/src/AgentMarket.tsx'));
  assert.ok(exists('packages/sdkwork-claw-agent/src/pages/AgentMarket.tsx'));
  assert.ok(exists('packages/sdkwork-claw-agent/src/services/agentCatalog.ts'));
  assert.ok(exists('packages/sdkwork-claw-agent/src/services/agentCatalog.test.ts'));
  assert.ok(exists('packages/sdkwork-claw-agent/src/services/agentInstallService.ts'));

  assert.ok(!pkg.dependencies?.['@sdkwork/claw-studio-agent']);
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-infrastructure'], 'workspace:*');
  assert.equal(pkg.dependencies?.['@sdkwork/claw-types'], 'workspace:*');
  assert.match(indexSource, /\.\/AgentMarket/);
  assert.match(indexSource, /\.\/services/);
  assert.match(entrySource, /lazy\(\(\) =>/);
  assert.match(entrySource, /\.\/pages\/AgentMarket/);
  assert.match(servicesIndexSource, /\.\/agentCatalog\.ts/);
  assert.match(servicesIndexSource, /\.\/agentInstallService\.ts/);
  assert.match(pageSource, /agentInstallService\.listInstallTargets/);
  assert.match(pageSource, /createAgentMarketCatalog/);
  assert.match(pageSource, /useSearchParams/);
  assert.match(pageSource, /instanceId/);
  assert.match(pageSource, /resolvePreferredTargetId/);
  assert.match(pageSource, /sortTargetsForTemplate/);
  assert.match(pageSource, /catalog\.categories\.map/);
  assert.match(pageSource, /agentMarket\.searchPlaceholder/);
  assert.doesNotMatch(pageSource, /agentMarket\.hero\./);
  assert.doesNotMatch(pageSource, /agentMarket\.metrics\./);
  assert.doesNotMatch(pageSource, /MetricCard/);
  assert.doesNotMatch(pageSource, /agentMarket\.section\.title/);
  assert.doesNotMatch(pageSource, /agentMarket\.section\.description/);
  assert.match(pageSource, /agentMarket\.actions\.installToInstance/);
  assert.match(pageSource, /agentMarket\.categories\.\$\{template\.category\}/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.name/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.summary/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.description/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.focus/);
  assert.match(pageSource, /agentMarket\.templates\.\$\{template\.id\}\.capabilities\.\$\{index\}/);
  assert.match(pageSource, /agentMarket\.labels\.installed/);
  assert.match(pageSource, /agentMarket\.labels\.builtIn/);
  assert.match(pageSource, /type: target\.typeLabel/);
  assert.match(pageSource, /agentMarket\.error\.title/);
  assert.match(pageSource, /agentMarket\.error\.description/);
  assert.match(pageSource, /agentMarket\.error\.retry/);
});

runTest('sdkwork-claw-agent delegates shared catalog and install logic to @sdkwork/claw-core while keeping a local market surface', () => {
  const catalogSource = read('packages/sdkwork-claw-agent/src/services/agentCatalog.ts');
  const installServiceSource = read('packages/sdkwork-claw-agent/src/services/agentInstallService.ts');
  const sharedCatalogSource = read('packages/sdkwork-claw-core/src/services/agentCatalog.ts');
  const sharedInstallServiceSource = read('packages/sdkwork-claw-core/src/services/agentInstallService.ts');

  assert.match(catalogSource, /from '@sdkwork\/claw-core';/);
  assert.match(catalogSource, /AGENT_MARKET_TEMPLATES/);
  assert.match(catalogSource, /buildAgentWorkspaceFiles/);
  assert.match(catalogSource, /buildCoordinatorWorkspaceFiles/);
  assert.match(catalogSource, /createAgentMarketCatalog/);
  assert.match(installServiceSource, /from '@sdkwork\/claw-core';/);
  assert.match(installServiceSource, /agentInstallService/);
  assert.match(installServiceSource, /AgentInstallTarget/);
  assert.doesNotMatch(catalogSource, /function buildWorkspaceFiles/);
  assert.doesNotMatch(installServiceSource, /class AgentInstallService/);

  assert.match(sharedCatalogSource, /'AGENTS\.md'/);
  assert.match(sharedCatalogSource, /'BOOT\.md'/);
  assert.match(sharedCatalogSource, /'SOUL\.md'/);
  assert.match(sharedCatalogSource, /'TOOLS\.md'/);
  assert.match(sharedCatalogSource, /'IDENTITY\.md'/);
  assert.match(sharedCatalogSource, /'USER\.md'/);
  assert.match(sharedCatalogSource, /'HEARTBEAT\.md'/);
  assert.match(sharedCatalogSource, /'BOOTSTRAP\.md'/);
  assert.match(sharedCatalogSource, /'MEMORY\.md'/);
  assert.match(sharedCatalogSource, /memory\/YYYY-MM-DD\.md/);
  assert.match(sharedCatalogSource, /skip heartbeat API calls/);
  assert.doesNotMatch(sharedCatalogSource, /HEARTBEAT_OK/);
  assert.match(sharedInstallServiceSource, /studio\.listInstances/);
  assert.match(sharedInstallServiceSource, /openClawConfigService\.resolveInstanceConfigPath/);
  assert.match(sharedInstallServiceSource, /openClawConfigService\.resolveAgentPaths/);
  assert.match(sharedInstallServiceSource, /Promise\.allSettled/);
  assert.match(sharedInstallServiceSource, /buildAgentWorkspaceFiles/);
  assert.match(sharedInstallServiceSource, /ensureAgentWorkspaceSkeleton/);
  assert.match(sharedInstallServiceSource, /buildCoordinatorWorkspaceFiles/);
  assert.match(sharedInstallServiceSource, /isBuiltIn/);
  assert.match(sharedInstallServiceSource, /openClawConfigService\.saveAgent/);
  assert.match(sharedInstallServiceSource, /openClawConfigService\.configureMultiAgentSupport/);
  assert.match(sharedInstallServiceSource, /coordinatorAgentId: 'main'/);
  assert.match(sharedInstallServiceSource, /maxConcurrent: 4/);
  assert.match(sharedInstallServiceSource, /maxSpawnDepth: 2/);
  assert.match(sharedInstallServiceSource, /maxChildrenPerAgent: 5/);
  assert.doesNotMatch(sharedInstallServiceSource, /fetch\(/);
  assert.doesNotMatch(sharedInstallServiceSource, /axios\./);
});

runTest('sdkwork-claw-agent parity checks use the shared Node TypeScript runner for OpenClaw install flows', () => {
  const workspacePackageJson = read('package.json');
  const agentCheckRunner = read('scripts/run-sdkwork-agent-check.mjs');
  const nodeTypeScriptRunner = read('scripts/run-node-typescript-check.mjs');
  const installServiceTestSource = read(
    'packages/sdkwork-claw-agent/src/services/agentInstallService.test.ts',
  );

  assert.match(installServiceTestSource, /@sdkwork\/claw-core/);
  assert.match(
    workspacePackageJson,
    /"check:sdkwork-agent"\s*:\s*"sdkwork-run-node scripts\/run-sdkwork-agent-check\.mjs"/,
  );
  assert.ok(exists('scripts/run-sdkwork-agent-check.mjs'));
  assert.ok(exists('scripts/run-node-typescript-check.mjs'));
  assert.match(nodeTypeScriptRunner, /--experimental-transform-types/);
  assert.match(nodeTypeScriptRunner, /--disable-warning=ExperimentalWarning/);
  assert.match(agentCheckRunner, /runNodeTypeScriptChecks/);
  assert.match(agentCheckRunner, /agentCatalog\.test\.ts/);
  assert.match(agentCheckRunner, /agentInstallService\.test\.ts/);
  assert.doesNotMatch(agentCheckRunner, /tsx/);
});
