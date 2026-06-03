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

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function extractStringArrayConstantValues(source, constantName, label) {
  const declarationPattern = new RegExp(
    `${constantName}[\\s\\S]*?=\\s*\\[([\\s\\S]*?)\\];`,
    'u',
  );
  const match = source.match(declarationPattern);
  assert.ok(match, `${label} must declare ${constantName}`);

  return [...match[1].matchAll(/['"]([^'"]+)['"]/gu)]
    .map((entry) => entry[1])
    .toSorted((left, right) => left.localeCompare(right));
}

function collectFiles(dir, extensions, ignoredDirectories = new Set()) {
  const absoluteDir = path.join(root, dir);
  const files = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relPath = path.relative(root, absolutePath).replaceAll(path.sep, '/');
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectFiles(relPath, extensions, ignoredDirectories));
      }
      continue;
    }

    if (entry.isFile() && extensions.some((extension) => relPath.endsWith(extension))) {
      files.push(relPath);
    }
  }

  return files;
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

runTest('workspace lint compiles both web and desktop hosts before parity and automation gates', () => {
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm --filter @sdkwork\/claw-web lint/);
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm --filter @sdkwork\/claw-desktop lint/);
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm check:arch/);
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm check:parity/);
  assert.match(packageJson.scripts.lint, /sdkwork-run-pnpm check:automation/);
});

runTest('automation gate freezes browser secret and persistence boundary contracts', () => {
  assert.match(
    packageJson.scripts['check:automation'] ?? '',
    /sdkwork-run-node scripts\/client-secret-boundary-contract\.test\.mjs/,
  );
  assert.match(
    packageJson.scripts['check:automation'] ?? '',
    /sdkwork-run-node scripts\/browser-persistence-policy-contract\.test\.mjs/,
  );
});

runTest('OpenClaw quality gate keeps fact-source tests in parity runners', () => {
  const foundationRunner = read('scripts/run-sdkwork-foundation-check.mjs');
  const instancesRunner = read('scripts/run-sdkwork-instances-check.mjs');
  const agentRunner = read('scripts/run-sdkwork-agent-check.mjs');
  const channelsRunner = read('scripts/run-sdkwork-channels-check.mjs');

  assert.match(packageJson.scripts['check:parity'], /sdkwork-run-pnpm check:sdkwork-foundation/);
  assert.match(packageJson.scripts['check:parity'], /sdkwork-run-pnpm check:sdkwork-agent/);
  assert.match(packageJson.scripts['check:parity'], /sdkwork-run-pnpm check:sdkwork-channels/);
  assert.match(packageJson.scripts['check:parity'], /sdkwork-run-pnpm check:sdkwork-instances/);
  assert.match(
    packageJson.scripts['check:sdkwork-hosts'],
    /sdkwork-run-node scripts\/desktop-window-chrome-contract\.test\.mjs/,
    'check:sdkwork-hosts must execute the desktop tray and window chrome contract',
  );

  assert.match(
    packageJson.scripts['check:sdkwork-foundation'],
    /sdkwork-run-node scripts\/run-sdkwork-foundation-check\.mjs/,
    'check:sdkwork-foundation must execute the shared foundation runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-agent'],
    /sdkwork-run-node scripts\/run-sdkwork-agent-check\.mjs/,
    'check:sdkwork-agent must execute the shared agent runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-channels'],
    /sdkwork-run-node scripts\/run-sdkwork-channels-check\.mjs/,
    'check:sdkwork-channels must execute the shared channels runner',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-instances'],
    /sdkwork-run-node scripts\/run-sdkwork-instances-check\.mjs/,
    'check:sdkwork-instances must execute the shared instances runner',
  );

  assert.match(
    foundationRunner,
    /packages\/sdkwork-claw-infrastructure\/src\/platform\/webStudio\.test\.ts/,
    'foundation runner must execute webStudio fact-source coverage',
  );
  assert.match(
    agentRunner,
    /packages\/sdkwork-claw-agent\/src\/services\/agentInstallService\.test\.ts/,
    'agent runner must execute agentInstallService fact-source coverage',
  );
  assert.match(
    channelsRunner,
    /packages\/sdkwork-claw-channels\/src\/services\/channelService\.test\.ts/,
    'channels runner must execute channelService fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/openClawConfigSchemaSupport\.test\.ts/,
    'instances runner must execute config schema fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/openClawManagementCapabilities\.test\.ts/,
    'instances runner must execute management capabilities fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/openClawProviderWorkspacePresentation\.test\.ts/,
    'instances runner must execute provider workspace fact-source coverage',
  );
  assert.match(
    instancesRunner,
    /packages\/sdkwork-claw-instances\/src\/services\/instanceOnboardingService\.test\.ts/,
    'instances runner must execute OpenClaw onboarding association coverage',
  );
  assert.match(
    packageJson.scripts['check:sdkwork-instances'],
    /sdkwork-run-node --experimental-strip-types scripts\/sdkwork-instances-contract\.test\.ts/,
    'check:sdkwork-instances must keep Instance Detail contract coverage in the formal gate',
  );
});

runTest('OpenClaw quality gate centralizes canonical built-in instance id literals inside targeted desktop and release tests', () => {
  const targetedFiles = [
    'packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.test.ts',
    'scripts/release/smoke-desktop-startup-evidence.test.mjs',
  ];

  for (const relPath of targetedFiles) {
    const source = read(relPath);
    assert.match(
      source,
      /const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';/,
      `${relPath} must declare a local BUILT_IN_INSTANCE_ID constant for canonical built-in identity reuse`,
    );
    assert.equal(
      countMatches(source, /managed-openclaw-primary/g),
      1,
      `${relPath} should keep the canonical managed-openclaw-primary literal in exactly one local constant declaration`,
    );
  }
});

runTest('OpenClaw quality gate confines retired built-in ids to explicit rejection coverage', () => {
  const allowedRetiredBuiltInIdFiles = new Set([
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
    'packages/sdkwork-claw-host-studio/src-host/src/lib.rs',
    'packages/sdkwork-claw-instances/src/services/nodeInventoryService.test.ts',
    'packages/sdkwork-claw-types/src/builtInKernelIdentity.test.ts',
    'scripts/openclaw-quality-gate-contract.test.mjs',
    'scripts/release/smoke-desktop-startup-evidence.test.mjs',
    'scripts/sdkwork-host-runtime-contract.test.ts',
  ]);
  const ignoredDirectories = new Set(['dist', 'node_modules', 'target']);
  const sourceFiles = [
    ...collectFiles('packages', ['.ts', '.tsx', '.mjs', '.js', '.rs'], ignoredDirectories),
    ...collectFiles('scripts', ['.ts', '.mjs', '.js'], ignoredDirectories),
  ];
  const offenders = sourceFiles.filter((relPath) => {
    if (allowedRetiredBuiltInIdFiles.has(relPath)) {
      return false;
    }

    return /local-built-in/.test(read(relPath));
  });

  assert.deepEqual(
    offenders,
    [],
    'retired local-built-in must not be used as a positive built-in OpenClaw fixture or production default',
  );
});

runTest('OpenClaw quality gate centralizes canonical browser fallback gateway defaults', () => {
  const typesSource = read('packages/sdkwork-claw-types/src/builtInKernelIdentity.ts');
  const webStudioSource = read('packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts');
  const hostCoreSource = read('packages/sdkwork-claw-host-core/src-host/src/lib.rs');
  const serverSource = read('packages/sdkwork-claw-server/src-host/src/main.rs');
  const startupSmokeSource = read('scripts/release/smoke-desktop-startup-evidence.mjs');

  assert.match(typesSource, /export const OPENCLAW_GATEWAY_DEFAULT_PORT = 21_280;/);
  assert.match(
    webStudioSource,
    /OPENCLAW_GATEWAY_DEFAULT_BASE_URL[\s\S]*OPENCLAW_GATEWAY_DEFAULT_HOST[\s\S]*OPENCLAW_GATEWAY_DEFAULT_PORT[\s\S]*OPENCLAW_GATEWAY_DEFAULT_WEBSOCKET_URL/,
  );
  assert.doesNotMatch(
    webStudioSource,
    /18789/,
    'webStudio must not reintroduce the legacy OpenClaw gateway default port',
  );
  assert.doesNotMatch(
    hostCoreSource,
    /18_789/,
    'host-core OpenClaw endpoint projections must not keep the legacy gateway default port in fixtures',
  );
  assert.doesNotMatch(
    serverSource,
    /18789/,
    'server public Studio default-provider routes must not keep the legacy OpenClaw gateway default port',
  );
  assert.match(
    startupSmokeSource,
    /const CANONICAL_BUILT_IN_OPENCLAW_INSTANCE_ID = 'managed-openclaw-primary';/,
  );
  assert.match(
    startupSmokeSource,
    /builtInInstanceId !== CANONICAL_BUILT_IN_OPENCLAW_INSTANCE_ID/,
  );
});

runTest('OpenClaw quality gate keeps Studio loopback ports out of OpenClaw derived sidecar ports', () => {
  const portsSource = read('packages/sdkwork-claw-desktop/src-tauri/src/framework/ports.rs');
  const configSource = read('packages/sdkwork-claw-desktop/src-tauri/src/framework/config.rs');

  assert.match(
    portsSource,
    /pub const OPENCLAW_BROWSER_CONTROL_DERIVED_PORT_OFFSET: u16 = 2;/,
    'desktop port policy must name OpenClaw browser control as gateway+2 so Studio cannot reuse that port',
  );
  assert.match(
    portsSource,
    /pub const OPENCLAW_BROWSER_CONTROL_DEFAULT_PORT: u16 =\s*OPENCLAW_GATEWAY_DEFAULT_PORT \+ OPENCLAW_BROWSER_CONTROL_DERIVED_PORT_OFFSET;/,
    'desktop port policy must expose the derived browser control port for conflict checks',
  );
  assert.doesNotMatch(
    portsSource,
    /pub const DESKTOP_EMBEDDED_HOST_DEFAULT_PORT: u16 = LOCAL_AI_PROXY_DEFAULT_PORT_HINT \+ 1;/,
    'desktop host must not default to 21282, which is OpenClaw gateway+2 browser control',
  );
  assert.match(
    portsSource,
    /pub const DESKTOP_EMBEDDED_HOST_DEFAULT_PORT: u16 = OPENCLAW_SIDECAR_RESERVED_PORT_END \+ 1;/,
    'desktop host default must start after the OpenClaw sidecar reservation',
  );
  assert.match(
    configSource,
    /is_openclaw_reserved_desktop_host_port\(next\.desktop_host\.port\)/,
    'config normalization must migrate existing desktopHost.port=21282 installs to the safe desktop host default',
  );
});

runTest('OpenClaw quality gate hardens desktop gateway startup probes and stale process cleanup', () => {
  const supervisorSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs',
  );

  assert.match(
    supervisorSource,
    /let http_live_probe = probe_gateway_http_live\(\s*runtime,\s*DEFAULT_OPENCLAW_GATEWAY_START_HTTP_READY_IO_TIMEOUT_MS,\s*\);/,
    'startup readiness must try the lightweight /healthz live probe before falling back to CLI health',
  );
  assert.match(
    supervisorSource,
    /is_gateway_readiness_terminal_http_status/,
    'startup readiness must name the narrow terminal /readyz status policy instead of treating warmup/degraded statuses as final',
  );
  assert.doesNotMatch(
    supervisorSource,
    /http_ready_probe\.is_http_status\(\) && !http_ready_probe\.is_http_not_found\(\)/,
    'startup readiness must not let /readyz 503 bypass the /healthz liveness fallback',
  );
  assert.match(
    supervisorSource,
    /match terminate_process_ids\(&stale_pids\)/,
    'stale OpenClaw cleanup must inspect termination errors instead of bubbling them up unconditionally',
  );
  assert.match(
    supervisorSource,
    /is_stale_openclaw_termination_access_denied/,
    'Windows access-denied stale OpenClaw processes need a named nonfatal policy when the gateway port is free',
  );
});

runTest('OpenClaw quality gate rejects packaged runtimes with missing channel metadata before config rewrite', () => {
  const runtimeSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs',
  );
  const sharedChannelSource = read('packages/sdkwork-claw-types/src/openclawChannels.ts');
  const desktopChannelConfigSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_channel_config.rs',
  );
  const releaseAssetVerifierSource = read('scripts/verify-desktop-openclaw-release-assets.mjs');
  const verifierTestSource = read('scripts/verify-desktop-openclaw-release-assets.test.mjs');
  const sharedChannelIds = extractStringArrayConstantValues(
    sharedChannelSource,
    'OPENCLAW_BUNDLED_CHANNEL_IDS',
    'shared OpenClaw channel registry',
  );
  const desktopChannelIds = extractStringArrayConstantValues(
    desktopChannelConfigSource,
    'BUNDLED_OPENCLAW_CHANNEL_IDS',
    'desktop OpenClaw channel sanitizer',
  );
  const releaseVerifierChannelIds = extractStringArrayConstantValues(
    releaseAssetVerifierSource,
    'EXPECTED_OPENCLAW_RELEASE_CHANNEL_IDS',
    'desktop release OpenClaw asset verifier',
  );

  assert.deepEqual(
    desktopChannelIds,
    sharedChannelIds,
    'desktop channel sanitizer must use the same bundled channel id set as @sdkwork/claw-types',
  );
  assert.deepEqual(
    releaseVerifierChannelIds,
    sharedChannelIds,
    'desktop release verifier must use the same bundled channel id set as @sdkwork/claw-types',
  );
  assert.equal(
    sharedChannelIds.includes('qq'),
    false,
    'retired qq channel must not re-enter the canonical bundled OpenClaw channel set',
  );

  const collectChannelIdsSource = runtimeSource
    .split('fn collect_openclaw_runtime_channel_ids')
    .at(1)
    ?.split('fn collect_openclaw_extension_channel_ids')
    .at(0) ?? '';
  const activationConfigSource = runtimeSource
    .split('fn ensure_built_in_openclaw_state')
    .at(1)
    ?.split('fn resolve_requested_managed_gateway_port')
    .at(0) ?? '';

  assert.match(
    collectChannelIdsSource,
    /packaged OpenClaw runtime channel metadata not found/,
    'packaged release activation must fail clearly when the OpenClaw channel metadata directory is missing',
  );
  assert.doesNotMatch(
    collectChannelIdsSource,
    /return Ok\(BTreeSet::new\(\)\);/,
    'missing release channel metadata must not silently produce an empty channel set',
  );
  assert.match(
    collectChannelIdsSource,
    /if channel_ids\.is_empty\(\)[\s\S]*packaged OpenClaw runtime channel metadata is empty/,
    'packaged release activation must reject an empty channel metadata set before sanitizing config',
  );
  assert.match(
    activationConfigSource,
    /sanitize_legacy_provider_runtime_config\(&mut config\);[\s\S]*sanitize_openclaw_channel_config\(&mut config, available_channel_ids\);[\s\S]*fs::write/,
    'desktop activation must sanitize retired channels before writing the managed OpenClaw config file',
  );
  const desktopStudioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );
  assert.match(
    desktopChannelConfigSource,
    /model_by_channel\.retain\(\|channel_id, value\|[\s\S]*available_channel_ids\.contains\(channel_id\)[\s\S]*channel_overrides\.retain\(\|_, model_ref\| model_ref\.is_string\(\)\);/,
    'desktop activation must prune retired channels from channels.modelByChannel before writing config',
  );
  assert.match(
    desktopChannelConfigSource,
    /else if channels_root\.contains_key\("modelByChannel"\) \{\s*channels_root\.remove\("modelByChannel"\);\s*\}/,
    'desktop activation must remove malformed channels.modelByChannel values before writing config',
  );
  assert.match(
    desktopChannelConfigSource,
    /get\("defaults"\)[\s\S]*!defaults\.is_object\(\)[\s\S]*channels_root\.remove\("defaults"\);/,
    'desktop activation must remove malformed channels.defaults values before writing config',
  );
  assert.match(
    desktopChannelConfigSource,
    /if config\.get\("channels"\)\.is_some\(\) \{\s*remove_nested_key\(config, &\["channels"\]\);\s*\}/,
    'desktop activation must remove malformed channels roots before writing config',
  );
  assert.match(
    desktopChannelConfigSource,
    /available_channel_ids\.contains\(channel_id\) && value\.is_object\(\)/,
    'desktop activation must remove malformed supported channel roots before writing config',
  );
  assert.match(
    desktopStudioSource,
    /let channel_ids = resolve_openclaw_config_writer_channel_ids\(paths\);\s*sanitize_openclaw_channel_config\(&mut normalized_root, &channel_ids\);[\s\S]*serde_json::to_string_pretty\(&normalized_root\)/,
    'desktop OpenClaw config writes must sanitize retired channels against active runtime metadata before serializing from Studio actions',
  );
  assert.match(
    desktopStudioSource,
    /read_active_openclaw_runtime_install_key\(paths\)[\s\S]*collect_openclaw_runtime_channel_ids\(&runtime_dir\)[\s\S]*unwrap_or_else\(bundled_openclaw_channel_id_set\)/,
    'desktop Studio config writes must prefer active OpenClaw runtime channel metadata and only fall back to the bundled channel set when active runtime state is unavailable',
  );
  const coreChannelConfigSource = read(
    'packages/sdkwork-claw-core/src/services/openClawChannelConfigService.ts',
  );
  const coreConfigSource = read('packages/sdkwork-claw-core/src/services/openClawConfigService.ts');
  assert.match(
    coreChannelConfigSource,
    /const modelByChannelRoot = readObject\(channelsRoot\.modelByChannel\);[\s\S]*const channelModelOverrides = readObject\(modelByChannelRoot\[channelId\]\);[\s\S]*delete channelModelOverrides\[overrideKey\];[\s\S]*delete channelsRoot\.modelByChannel;/,
    'structured config writes must prune retired channels from channels.modelByChannel',
  );
  assert.match(
    coreChannelConfigSource,
    /else if \(hasOwn\(channelsRoot, 'modelByChannel'\)\) \{\s*delete channelsRoot\.modelByChannel;\s*changed = true;\s*\}/,
    'structured config writes must remove malformed channels.modelByChannel values',
  );
  assert.match(
    coreChannelConfigSource,
    /const defaultsRoot = readObject\(channelsRoot\.defaults\);[\s\S]*delete channelsRoot\.defaults;/,
    'structured config writes must remove malformed channels.defaults values',
  );
  assert.match(
    coreChannelConfigSource,
    /if \(hasOwn\(root, 'channels'\)\) \{\s*delete root\.channels;\s*return true;\s*\}/,
    'structured config writes must remove malformed channels roots',
  );
  assert.match(
    coreChannelConfigSource,
    /OPENCLAW_SUPPORTED_CHANNEL_ID_SET\.has\(channelId\) && readObject\(channelsRoot\[channelId\]\)/,
    'structured config writes must remove malformed supported channel roots',
  );
  assert.match(
    coreChannelConfigSource,
    /if \(Object\.keys\(channelsRoot\)\.length === 0\) \{\s*delete root\.channels;\s*changed = true;\s*\}/,
    'structured config writes must remove an empty channels root after retired channel pruning',
  );
  assert.match(
    coreConfigSource,
    /mutateOpenClawConfigDocumentDelegate\(raw, \(root\) => \{\s*mutate\(root\);\s*normalizeStructuredOpenClawConfigRootBeforeWrite\(root\);\s*\}\);/,
    'structured config document helpers must sanitize the final root before serializing',
  );
  assert.match(
    coreConfigSource,
    /const normalizedRaw = normalizeStructuredOpenClawConfigRootBeforeWrite\(parsed\)\s*\?\s*`\$\{stringifyJson5\(parsed, 2\)\}\\n`\s*:\s*raw;[\s\S]*\.writeFile\(normalizedConfigFile, normalizedRaw\)/,
    'raw config document saves must sanitize retired channels before writing user-edited openclaw.json',
  );
  const browserStudioSource = read('packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts');
  assert.match(
    browserStudioSource,
    /function pruneBrowserOpenClawModelByChannel[\s\S]*isSupportedBrowserOpenClawChannel\(channelId\)[\s\S]*typeof modelRef === 'string'/,
    'browser fallback persistence must prune retired channels from channels.modelByChannel',
  );
  assert.match(
    browserStudioSource,
    /if \(asObject\(channelsRoot\.defaults\) === channelsRoot\.defaults\) \{\s*preservedMetaChannels\.defaults = channelsRoot\.defaults;/,
    'browser fallback persistence must remove malformed channels.defaults values',
  );
  assert.match(
    browserStudioSource,
    /isSupportedBrowserOpenClawChannel\(channelId\) && asObject\(value\) === value/,
    'browser fallback persistence must remove malformed supported channel roots',
  );
  assert.match(
    browserStudioSource,
    /updater\(root\);\s*pruneRetiredOpenClawChannelsRoot\(root\);\s*const content = `\$\{JSON\.stringify\(root, null, 2\)\}\\n`;/,
    'browser fallback config writes must sanitize the final root after channel mutations',
  );
  assert.match(
    browserStudioSource,
    /if \(Object\.keys\(prunedChannels\)\.length === 0\) \{\s*delete root\.channels;\s*return;\s*\}/,
    'browser fallback persistence must remove an empty channels root after retired channel pruning',
  );
  const channelsServiceSource = read('packages/sdkwork-claw-channels/src/services/channelService.ts');
  assert.match(
    channelsServiceSource,
    /const orderedIds = definitions\.map\(\(definition\) => definition\.id\);/,
    'channels feature fallback must derive its catalog from supported OpenClaw definitions instead of stale workbench channel ids',
  );
  assert.match(
    channelsServiceSource,
    /retiredOpenClawWorkbenchChannelIds[\s\S]*'qq'[\s\S]*'wechat'[\s\S]*'wehcat'[\s\S]*'sdkworkchat'[\s\S]*mapExternalWorkbenchChannel/,
    'channels feature fallback must reject retired aliases while rendering runtime-discovered external plugin channels read-only',
  );
  const instanceChannelWorkbenchSource = read(
    'packages/sdkwork-claw-instances/src/services/openClawChannelWorkbenchSupport.ts',
  );
  assert.match(
    instanceChannelWorkbenchSource,
    /const RETIRED_OPENCLAW_RUNTIME_CHANNEL_IDS = new Set\([\s\S]*'qq'[\s\S]*'wechat'[\s\S]*'wehcat'[\s\S]*'sdkworkchat'[\s\S]*\)[\s\S]*\.filter\(\(channelId\) => !RETIRED_OPENCLAW_RUNTIME_CHANNEL_IDS\.has\(channelId\)\)/,
    'instance workbench channel projection must reject retired aliases while preserving runtime-discovered external plugin channels',
  );
  assert.match(
    releaseAssetVerifierSource,
    /verifyMaterializedRuntimeChannelMetadata\(\s*path\.join\(resourceDir, 'runtime'\),\s*'prepared OpenClaw source runtime',\s*\)/,
    'desktop release verifier must validate prepared source runtime channel metadata before packaging evidence is accepted',
  );
  assert.match(
    releaseAssetVerifierSource,
    /verifyArchiveRuntimeChannelMetadata\(\{\s*archiveBuffer,\s*entries,\s*archivePath,\s*contextLabel: 'packaged OpenClaw runtime archive',\s*\}\);/,
    'desktop release verifier must validate channel metadata inside runtime.zip',
  );
  assert.match(
    releaseAssetVerifierSource,
    /verifyMaterializedRuntimeChannelMetadata\(\s*path\.join\(installDir, 'runtime'\),\s*contextLabel,\s*\)/,
    'desktop release verifier must validate channel metadata after archive extraction or staged install-root materialization',
  );
  assert.match(
    verifierTestSource,
    /rejects packaged runtime archives missing channel metadata/,
    'desktop release verifier tests must reject archives with no OpenClaw channel metadata',
  );
  assert.match(
    verifierTestSource,
    /rejects packaged runtime archives with retired channel metadata/,
    'desktop release verifier tests must reject archives that reintroduce retired OpenClaw channel ids such as qq',
  );
});

runTest('OpenClaw quality gate recovers malformed canonical configs before release startup rewrite', () => {
  const authoritySource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs',
  );
  const runtimeSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs',
  );
  const importSource = authoritySource
    .split('pub fn import_or_default_openclaw_config')
    .at(1)
    ?.split('pub fn record_config_migration')
    .at(0) ?? '';
  const recordMigrationSource = authoritySource
    .split('pub fn record_config_migration')
    .at(1)
    ?.split('pub fn record_activation_result')
    .at(0) ?? '';
  const activationConfigSource = runtimeSource
    .split('fn ensure_built_in_openclaw_state')
    .at(1)
    ?.split('fn resolve_requested_managed_gateway_port')
    .at(0) ?? '';

  assert.match(
    authoritySource,
    /pub struct ImportedOpenClawConfig \{[\s\S]*pub root: Value,[\s\S]*pub source_path: Option<PathBuf>,[\s\S]*pub quarantined_path: Option<PathBuf>,[\s\S]*\}/,
    'OpenClaw config import results must preserve an already-quarantined path for migration evidence',
  );
  assert.match(
    importSource,
    /match read_json5_object\(config_file_path\)[\s\S]*Err\(FrameworkError::ValidationFailed\(_\)\)[\s\S]*quarantine_path\(config_file_path, &state_paths\.quarantine_dir\)/,
    'malformed canonical OpenClaw config documents must be quarantined instead of failing release startup',
  );
  assert.match(
    importSource,
    /root: Value::Object\(Map::new\(\)\),[\s\S]*source_path: Some\(config_file_path\.to_path_buf\(\)\),[\s\S]*quarantined_path: Some\(quarantined_path\)/,
    'malformed canonical OpenClaw config recovery must fall back to an empty object and keep source/quarantine paths',
  );
  assert.match(
    recordMigrationSource,
    /let mut recorded_quarantined_path = quarantined_path\.map\(PathBuf::from\);[\s\S]*recorded_quarantined_path\.is_none\(\)[\s\S]*quarantine_path\(source_path, &state_paths\.quarantine_dir\)/,
    'migration recording must reuse import-time quarantine paths and only quarantine live legacy sources itself',
  );
  assert.match(
    recordMigrationSource,
    /authority\.quarantined_paths\.push\(quarantined_path_string\);/,
    'migration recording must persist the recovered malformed config path in authority state',
  );
  assert.match(
    activationConfigSource,
    /imported_config\.quarantined_path\.as_deref\(\),[\s\S]*&config_file_path/,
    'release startup rewrite must pass import-time quarantine evidence into migration recording',
  );
  assert.match(
    authoritySource,
    /import_or_default_openclaw_config_quarantines_invalid_canonical_config_before_rewrite/,
    'desktop authority tests must cover malformed canonical OpenClaw config recovery before rewrite',
  );
});

runTest('OpenClaw quality gate forbids retired gateway default ports and legacy managed loopback windows', () => {
  const allowedLegacyPortFiles = new Set([
    'scripts/openclaw-quality-gate-contract.test.mjs',
  ]);
  const ignoredDirectories = new Set(['dist', 'node_modules', 'target']);
  const sourceFiles = [
    ...collectFiles('packages', ['.ts', '.tsx', '.mjs', '.js', '.rs'], ignoredDirectories),
    ...collectFiles('scripts', ['.ts', '.mjs', '.js'], ignoredDirectories),
  ];
  const offenders = sourceFiles.filter((relPath) => {
    if (allowedLegacyPortFiles.has(relPath)) {
      return false;
    }

    return /18789|18_789/.test(read(relPath));
  });

  assert.deepEqual(
    offenders,
    [],
    'retired OpenClaw gateway default port literals must not appear outside this guard',
  );

  const legacyManagedLoopbackOffenders = sourceFiles.filter((relPath) => {
    if (relPath === 'scripts/openclaw-quality-gate-contract.test.mjs') {
      return false;
    }

    return /LEGACY_MANAGED_LOOPBACK|is_legacy_managed_loopback_port/.test(read(relPath));
  });

  assert.deepEqual(
    legacyManagedLoopbackOffenders,
    [],
    'the new multi-kernel port model must not preserve the retired 18xxx managed loopback window',
  );
});

runTest('OpenClaw quality gate centralizes hidden Windows child process flags', () => {
  const desktopChildProcessSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/child_process.rs',
  );
  const desktopInternalCliSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs',
  );
  const serverServiceSource = read('packages/sdkwork-claw-server/src-host/src/service.rs');

  assert.match(
    desktopChildProcessSource,
    /pub\(crate\) const WINDOWS_CREATE_NO_WINDOW: u32 = 0x0800_0000;/,
    'desktop runtime must expose the canonical Windows no-window flag from one child_process policy module',
  );
  assert.match(
    serverServiceSource,
    /const WINDOWS_CREATE_NO_WINDOW: u32 = 0x0800_0000;/,
    'server service control must name its Windows no-window flag instead of inlining the magic number',
  );
  assert.match(
    serverServiceSource,
    /process\.creation_flags\(windows_hidden_service_command_creation_flags\(\)\)/,
    'server service commands must apply the named hidden child-process policy',
  );
  assert.doesNotMatch(
    serverServiceSource,
    /creation_flags\(0x0800_0000\)/,
    'server service commands must not inline CREATE_NO_WINDOW in process setup',
  );
  assert.match(
    desktopInternalCliSource,
    /command\.envs\(runtime\.managed_env\(\)\);\s*configure_hidden_child_process\(&mut command\);/,
    'internal OpenClaw CLI bridge must reuse the desktop hidden child-process policy',
  );
});

runTest('OpenClaw quality gate keeps desktop and release automation child processes hidden on Windows', () => {
  const prepareRuntimeSource = read('scripts/prepare-openclaw-runtime.mjs');
  const syncBundledComponentsSource = read('scripts/sync-bundled-components.mjs');
  const applyOpenClawUpgradeSource = read('scripts/apply-openclaw-upgrade.mjs');
  const openClawUpgradeReadinessSource = read('scripts/openclaw-upgrade-readiness.mjs');
  const packageReleaseAssetsSource = read('scripts/release/package-release-assets.mjs');
  const smokeServerSource = read('scripts/release/smoke-server-release-assets.mjs');
  const smokeDeploymentSource = read('scripts/release/smoke-deployment-release-assets.mjs');

  assert.match(
    prepareRuntimeSource,
    /spawn\(resolvedRobocopyCommand[\s\S]*windowsHide:\s*true/,
    'OpenClaw runtime robocopy fallback must not show a Windows console window',
  );
  assert.match(
    prepareRuntimeSource,
    /spawn\(resolvedCommand, args[\s\S]*windowsHide:\s*true/,
    'OpenClaw runtime command runner must hide Windows child-process windows',
  );
  assert.match(
    prepareRuntimeSource,
    /spawnSync\(resolvedCommand, \['--version'\][\s\S]*windowsHide:\s*true/,
    'OpenClaw runtime command probes must hide Windows child-process windows',
  );
  assert.match(
    syncBundledComponentsSource,
    /spawnSync\(command, commandArgs,[\s\S]*windowsHide:\s*true/,
    'bundled component sync command runner must hide Windows child-process windows',
  );
  assert.match(
    applyOpenClawUpgradeSource,
    /spawn\(process\.execPath, \[scriptRelativePath, \.\.\.args\][\s\S]*windowsHide:\s*true/,
    'OpenClaw upgrade workflow subcommands must hide Windows child-process windows',
  );
  assert.match(
    openClawUpgradeReadinessSource,
    /spawnSync\('git', \['-C', repoDir, 'status', '--short'\][\s\S]*windowsHide:\s*true/,
    'OpenClaw upgrade readiness git probes must hide Windows child-process windows',
  );

  assert.match(
    packageReleaseAssetsSource,
    /resolveSpawnCommand\('powershell'\)[\s\S]*SDKWORK_ZIP_DESTINATION:\s*archivePath[\s\S]*windowsHide:\s*true/,
    'release asset PowerShell zip packaging must hide Windows child-process windows',
  );
  assert.match(
    packageReleaseAssetsSource,
    /spawnSync\(tarPlan\.command, tarPlan\.args[\s\S]*windowsHide:\s*true/,
    'release asset tar packaging must keep the same hidden-child-process policy',
  );

  assert.match(
    smokeServerSource,
    /spawnSync\(resolveSpawnCommand\(command, platform, env\), args[\s\S]*windowsHide:\s*true/,
    'server release smoke command runner must hide Windows child-process windows',
  );
  assert.match(
    smokeServerSource,
    /resolveSpawnCommand\('powershell'\)[\s\S]*SDKWORK_ZIP_DESTINATION:\s*extractDir[\s\S]*windowsHide:\s*true/,
    'server release smoke PowerShell archive extraction must hide Windows child-process windows',
  );
  assert.match(
    smokeServerSource,
    /runTaskkillFn\('taskkill', \['\/PID', String\(childPid\), '\/T', '\/F'\][\s\S]*windowsHide:\s*true/,
    'server release smoke taskkill cleanup must hide Windows child-process windows',
  );

  assert.match(
    smokeDeploymentSource,
    /spawnSync\(command, args[\s\S]*windowsHide:\s*true/,
    'deployment release smoke command runner must hide Windows child-process windows',
  );
  assert.match(
    smokeDeploymentSource,
    /spawnSync\(command, args[\s\S]*timeout: DOCKER_SERVER_CAPABILITY_TIMEOUT_MS[\s\S]*windowsHide:\s*true/,
    'deployment release smoke command probes must hide Windows child-process windows',
  );
  assert.match(
    smokeDeploymentSource,
    /spawnSync\('docker', \['info'[\s\S]*timeout: timeoutMs[\s\S]*windowsHide:\s*true/,
    'deployment release smoke Docker server probes must hide Windows child-process windows',
  );
});

runTest('OpenClaw mirror archive shell helpers are compile-time isolated by platform', () => {
  const exportSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_export.rs',
  );
  const importSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs',
  );

  assert.doesNotMatch(
    exportSource,
    /let archive_result = if cfg!\(windows\)/,
    'mirror export archive creation must not rely on runtime cfg! dispatch for shell helpers',
  );
  assert.match(
    exportSource,
    /#\[cfg\(windows\)\]\s*fn create_windows_archive_from_staging/,
    'Windows mirror export archive helper must be compiled only on Windows',
  );
  assert.match(
    exportSource,
    /#\[cfg\(not\(windows\)\)\]\s*fn create_unix_archive_from_staging/,
    'Unix mirror export archive helper must not be compiled into Windows builds',
  );

  assert.doesNotMatch(
    importSource,
    /let extract_result = if cfg!\(windows\)/,
    'mirror import archive extraction must not rely on runtime cfg! dispatch for shell helpers',
  );
  assert.doesNotMatch(
    importSource,
    /let entries = if cfg!\(windows\)/,
    'mirror import archive listing must not rely on runtime cfg! dispatch for shell helpers',
  );
  assert.match(
    importSource,
    /#\[cfg\(windows\)\]\s*fn list_archive_entries\(source_path: &Path\) -> Result<Vec<String>>/,
    'Windows mirror import archive listing entrypoint must be compiled only on Windows',
  );
  assert.match(
    importSource,
    /#\[cfg\(not\(windows\)\)\]\s*fn list_archive_entries\(source_path: &Path\) -> Result<Vec<String>>/,
    'Unix mirror import archive listing entrypoint must not be compiled into Windows builds',
  );
  assert.match(
    importSource,
    /#\[cfg\(windows\)\]\s*fn extract_archive\(archive_path: &Path, destination_dir: &Path\) -> Result<\(\)>/,
    'Windows mirror import archive extraction entrypoint must be compiled only on Windows',
  );
  assert.match(
    importSource,
    /#\[cfg\(not\(windows\)\)\]\s*fn extract_archive\(archive_path: &Path, destination_dir: &Path\) -> Result<\(\)>/,
    'Unix mirror import archive extraction entrypoint must not be compiled into Windows builds',
  );
});
