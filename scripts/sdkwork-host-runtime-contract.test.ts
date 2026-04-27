import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const bundledComponentsHelper = await import(
  pathToFileURL(path.join(root, 'scripts', 'sync-bundled-components.mjs')).href,
);

function read(relPath: string) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function readJson<T>(relPath: string): T {
  return JSON.parse(read(relPath)) as T;
}

function stripRustTestModule(source: string) {
  const marker = '#[cfg(test)]';
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    return source;
  }

  return source.slice(0, markerIndex);
}

function extractTypeAlias(source: string, aliasName: string) {
  const match = source.match(
    new RegExp(`export type ${aliasName} =[\\s\\S]*?;`),
  );

  assert.ok(match, `Unable to locate type alias ${aliasName}`);

  return match[0];
}

function extractDesktopLockImporter() {
  const lockSource = read('pnpm-lock.yaml').replace(/\r\n/g, '\n');
  const match = lockSource.match(
    /packages\/sdkwork-claw-desktop:\r?\n([\s\S]*?)(?:\r?\n  packages\/|\r?\npackages:|\r?\nimporters:|$)/,
  );

  if (!match) {
    throw new Error('Unable to locate the packages/sdkwork-claw-desktop importer in pnpm-lock.yaml');
  }

  return match[1];
}

function exists(relPath: string) {
  return fs.existsSync(path.join(root, relPath));
}

function readGeneratedTauriBundleOverlay() {
  const relativePath = 'packages/sdkwork-claw-desktop/src-tauri/generated/tauri.bundle.overlay.json';
  if (exists(relativePath)) {
    return read(relativePath);
  }

  return JSON.stringify(
    bundledComponentsHelper.createTauriBundleOverlayConfig({
      workspaceRootDir: root,
      platform: process.platform,
    }),
    null,
    2,
  );
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

async function runAsyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('sdkwork-claw-web stays a Vite-only host without a business runtime server', () => {
  const pkg = readJson<{
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(
    'packages/sdkwork-claw-web/package.json',
  );

  assert.equal(
    pkg.scripts?.dev,
    'sdkwork-run-node ../../scripts/run-vite-host.mjs serve --host 0.0.0.0 --port 3001 --mode development',
  );
  assert.equal(pkg.dependencies?.express, undefined);
  assert.equal(pkg.dependencies?.['sql.js'], undefined);
  assert.equal(pkg.devDependencies?.tsx, undefined);
  assert.equal(exists('packages/sdkwork-claw-web/server.ts'), false);
});

runTest('sdkwork-claw-web bootstraps shell runtime before mounting the React tree', () => {
  const mainSource = read('packages/sdkwork-claw-web/src/main.tsx');

  assert.match(mainSource, /bootstrapShellRuntime/);
  assert.doesNotMatch(mainSource, /@sdkwork\/claw-i18n/);
  assert.match(
    mainSource,
    /await bootstrapShellRuntime\([\s\S]*?\);[\s\S]*createRoot\(document\.getElementById\('root'\)!\)\.render/,
  );
});

runTest('built-in OpenClaw hosts derive a real version label instead of the bundled placeholder', () => {
  const webStudioSource = read('packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts');
  const desktopStudioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );

  assert.doesNotMatch(webStudioSource, /version:\s*'bundled'/);
  assert.match(webStudioSource, /version:\s*DEFAULT_BUNDLED_OPENCLAW_VERSION/);
  assert.doesNotMatch(
    desktopStudioSource,
    /\.unwrap_or_else\(\|\| "bundled"\.to_string\(\)\)/,
  );
  assert.match(desktopStudioSource, /resolve_built_in_openclaw_display_version/);
});

runTest('desktop kernel host service descriptions do not treat OpenClaw as mandatory product infrastructure', () => {
  const serviceManagerSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/service_manager.rs',
  );

  assert.doesNotMatch(serviceManagerSource, /required by Claw Studio/);
});

runTest('sdkwork-claw-desktop contains the Tauri runtime package surface', () => {
  const pkg = readJson<{
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  }>(
    'packages/sdkwork-claw-desktop/package.json',
  );
  const desktopLockImporter = extractDesktopLockImporter();

  assert.ok(exists('packages/sdkwork-claw-desktop/.env.example'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/Cargo.toml'));
  assert.ok(exists('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json'));
  assert.equal(
    pkg.scripts?.['dev:tauri'],
    'sdkwork-run-node ../../scripts/run-vite-host.mjs serve --host 127.0.0.1 --port 1426 --strictPort',
  );
  assert.equal(pkg.dependencies?.['@sdkwork/claw-core'], undefined);
  assert.doesNotMatch(desktopLockImporter, /'@sdkwork\/claw-core':/);
});

runTest('sdkwork-claw-server and sdkwork-claw-host-core expose the shared server host foundation', () => {
  const serverPackage = readJson<{
    dependencies?: Record<string, string>;
  }>('packages/sdkwork-claw-server/package.json');
  const hostCorePackage = readJson<{
    name?: string;
  }>('packages/sdkwork-claw-host-core/package.json');

  assert.ok(exists('packages/sdkwork-claw-server/src-host/Cargo.toml'));
  assert.ok(exists('packages/sdkwork-claw-host-core/src-host/Cargo.toml'));
  assert.equal(serverPackage.dependencies?.['@sdkwork/claw-host-core'], 'workspace:*');
  assert.equal(hostCorePackage.name, '@sdkwork/claw-host-core');
});

runTest('shared host runtime contracts freeze endpoint governance and canonical OpenClaw manage resources', () => {
  const manageContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/manage.ts',
  );
  const internalContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/internal.ts',
  );
  const runtimeContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  );
  const platformIndexSource = read('packages/sdkwork-claw-infrastructure/src/platform/index.ts');
  const serverBrowserBridgeSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/serverBrowserBridge.ts',
  );

  assert.match(manageContractSource, /export interface ManageHostEndpointRecord/);
  assert.match(manageContractSource, /requestedPort:\s*number/);
  assert.match(manageContractSource, /activePort:\s*number\s*\|\s*null/);
  assert.match(manageContractSource, /getHostEndpoints\(\): Promise<ManageHostEndpointRecord\[]>/);
  assert.match(manageContractSource, /getOpenClawRuntime\(\)/);
  assert.match(manageContractSource, /getOpenClawGateway\(\)/);
  assert.match(manageContractSource, /invokeOpenClawGateway\(/);
  assert.match(internalContractSource, /export type HostPlatformStateStoreProjectionMode/);
  assert.match(internalContractSource, /projectionMode:\s*HostPlatformStateStoreProjectionMode/);
  assert.match(internalContractSource, /'metadataOnly'/);
  assert.match(runtimeContractSource, /export interface RuntimeStartupContext/);
  assert.match(runtimeContractSource, /hostMode:/);
  assert.match(runtimeContractSource, /distributionFamily:/);
  assert.match(runtimeContractSource, /deploymentFamily:/);
  assert.match(runtimeContractSource, /acceleratorProfile\?:/);
  assert.match(platformIndexSource, /ManageHostEndpointRecord/);
  assert.match(platformIndexSource, /RuntimeStartupContext/);
  assert.match(serverBrowserBridgeSource, /desktopCombined/);
  assert.match(serverBrowserBridgeSource, /hostedBrowser:\s*true/);
  assert.match(serverBrowserBridgeSource, /browserBaseUrl/);
  assert.match(serverBrowserBridgeSource, /distributionFamily:\s*config\.distributionFamily/);
  assert.match(serverBrowserBridgeSource, /deploymentFamily:\s*config\.deploymentFamily/);
  assert.match(serverBrowserBridgeSource, /acceleratorProfile:\s*config\.acceleratorProfile/);
});

runTest('desktop runtime authority contracts expose configFile and do not publish legacy configFilePath', () => {
  const runtimeContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  );
  const desktopKernelModelSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel.rs',
  );

  assert.match(
    runtimeContractSource,
    /export interface RuntimeDesktopOpenClawRuntimeAuthorityInfo \{[\s\S]*configFile:\s*string;[\s\S]*ownedRuntimeRoots:\s*string\[];/,
  );
  assert.match(
    runtimeContractSource,
    /export interface RuntimeDesktopKernelRuntimeAuthorityInfo \{[\s\S]*configFile:\s*string;[\s\S]*ownedRuntimeRoots:\s*string\[];/,
  );
  assert.doesNotMatch(
    runtimeContractSource,
    /export interface RuntimeDesktopOpenClawRuntimeAuthorityInfo \{[\s\S]*configFilePath:\s*string;/,
  );
  assert.doesNotMatch(
    runtimeContractSource,
    /export interface RuntimeDesktopKernelRuntimeAuthorityInfo \{[\s\S]*configFilePath:\s*string;/,
  );
  assert.match(
    desktopKernelModelSource,
    /pub struct DesktopOpenClawRuntimeAuthorityInfo \{[\s\S]*pub config_file: String,[\s\S]*pub owned_runtime_roots: Vec<String>,/,
  );
  assert.match(
    desktopKernelModelSource,
    /pub struct DesktopKernelRuntimeAuthorityInfo \{[\s\S]*pub runtime_id: String,[\s\S]*pub config_file: String,[\s\S]*pub owned_runtime_roots: Vec<String>,/,
  );
  assert.doesNotMatch(
    desktopKernelModelSource,
    /pub struct DesktopOpenClawRuntimeAuthorityInfo \{[\s\S]*config_file_path:/,
  );
  assert.doesNotMatch(
    desktopKernelModelSource,
    /pub struct DesktopKernelRuntimeAuthorityInfo \{[\s\S]*config_file_path:/,
  );
});

runTest('shared kernel-platform types keep runtime, transport, console, and activation ids extensible for future kernels', () => {
  const typesSource = read('packages/sdkwork-claw-types/src/index.ts');
  const studioContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/studio.ts',
  );
  const runtimeContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  );
  const desktopStudioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );
  const desktopBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const knownRuntimeKindAlias = extractTypeAlias(typesSource, 'KnownStudioRuntimeKind');
  const runtimeKindAlias = extractTypeAlias(typesSource, 'StudioRuntimeKind');
  const knownTransportKindAlias = extractTypeAlias(
    typesSource,
    'KnownStudioInstanceTransportKind',
  );
  const transportKindAlias = extractTypeAlias(
    typesSource,
    'StudioInstanceTransportKind',
  );
  const knownConsoleKindAlias = extractTypeAlias(
    typesSource,
    'KnownStudioInstanceConsoleKind',
  );
  const consoleKindAlias = extractTypeAlias(
    typesSource,
    'StudioInstanceConsoleKind',
  );
  const knownActivationStageAlias = extractTypeAlias(
    typesSource,
    'KnownStudioInstanceActivationStage',
  );
  const activationStageAlias = extractTypeAlias(
    typesSource,
    'StudioInstanceActivationStage',
  );

  assert.match(
    knownRuntimeKindAlias,
    /export type KnownStudioRuntimeKind =[\s\S]*'openclaw'[\s\S]*'hermes'[\s\S]*'zeroclaw'[\s\S]*'ironclaw'[\s\S]*'custom'[\s\S]*;/,
  );
  assert.match(
    runtimeKindAlias,
    /export type StudioRuntimeKind =[\s\S]*KnownStudioRuntimeKind[\s\S]*\(string & \{\}\)[\s\S]*;/,
  );
  assert.match(
    knownTransportKindAlias,
    /export type KnownStudioInstanceTransportKind =[\s\S]*'openclawGatewayWs'[\s\S]*'zeroclawHttp'[\s\S]*'ironclawWeb'[\s\S]*'openaiHttp'[\s\S]*'customHttp'[\s\S]*'customWs'[\s\S]*;/,
  );
  assert.match(
    transportKindAlias,
    /export type StudioInstanceTransportKind =[\s\S]*KnownStudioInstanceTransportKind[\s\S]*\(string & \{\}\)[\s\S]*;/,
  );
  assert.match(
    knownConsoleKindAlias,
    /export type KnownStudioInstanceConsoleKind =[\s\S]*'openclawControlUi'[\s\S]*;/,
  );
  assert.match(
    consoleKindAlias,
    /export type StudioInstanceConsoleKind =[\s\S]*KnownStudioInstanceConsoleKind[\s\S]*\(string & \{\}\)[\s\S]*;/,
  );
  assert.doesNotMatch(typesSource, /StudioBuiltInOpenClawActivationStage/);
  assert.match(
    knownActivationStageAlias,
    /export type KnownStudioInstanceActivationStage =[\s\S]*'resolveRequirements'[\s\S]*'prepareInstall'[\s\S]*'validateInstall'[\s\S]*'activateInstall'[\s\S]*'prepareConfig'[\s\S]*'startProcess'[\s\S]*'verifyEndpoint'[\s\S]*'projectInstance'[\s\S]*'ready'[\s\S]*;/,
  );
  assert.match(
    activationStageAlias,
    /export type StudioInstanceActivationStage =[\s\S]*KnownStudioInstanceActivationStage[\s\S]*\(string & \{\}\)[\s\S]*;/,
  );
  assert.match(studioContractSource, /runtimeKind: StudioRuntimeKind;/);
  assert.match(studioContractSource, /transportKind: StudioInstanceTransportKind;/);
  assert.match(studioContractSource, /getInstanceDetail\(id: string\): Promise<StudioInstanceDetailRecord \| null>;/);
  assert.match(
    runtimeContractSource,
    /export interface RuntimeDesktopBundledComponentsInfo \{[\s\S]*packageProfileId:\s*string;[\s\S]*includedKernelIds:\s*string\[];[\s\S]*defaultEnabledKernelIds:\s*string\[];[\s\S]*\}/,
  );
  assert.match(
    desktopBridgeSource,
    /requiresBuiltInOpenClawEvidence\?: boolean;/,
  );
  assert.match(
    desktopBridgeSource,
    /requiresBuiltInOpenClawEvidence = true/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /function resolveBackgroundRuntimeReadinessRecoveryMode\([\s\S]*includedKernelIds[\s\S]*return includedKernelIds\.includes\('openclaw'\)[\s\S]*'managed-openclaw'[\s\S]*'generic-hosted-runtime'/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const recoveryMode = resolveBackgroundRuntimeReadinessRecoveryMode\([\s\S]*kernelInfo\?\.bundledComponents\.includedKernelIds[\s\S]*requiresBuiltInOpenClawEvidence:\s*recoveryMode === 'managed-openclaw'/,
  );
  assert.match(
    desktopStudioSource,
    /pub enum StudioRuntimeKind \{[\s\S]*Openclaw,[\s\S]*Hermes,[\s\S]*Zeroclaw,[\s\S]*Ironclaw,[\s\S]*Custom,[\s\S]*Other\(String\),[\s\S]*\}/,
  );
  assert.match(
    desktopStudioSource,
    /pub enum StudioInstanceTransportKind \{[\s\S]*OpenclawGatewayWs,[\s\S]*ZeroclawHttp,[\s\S]*IronclawWeb,[\s\S]*OpenaiHttp,[\s\S]*CustomHttp,[\s\S]*CustomWs,[\s\S]*Other\(String\),[\s\S]*\}/,
  );
  assert.match(desktopStudioSource, /impl Serialize for StudioRuntimeKind/);
  assert.match(desktopStudioSource, /impl<'de> Deserialize<'de> for StudioRuntimeKind/);
  assert.match(desktopStudioSource, /impl Serialize for StudioInstanceTransportKind/);
  assert.match(
    desktopStudioSource,
    /impl<'de> Deserialize<'de> for StudioInstanceTransportKind/,
  );
  assert.match(desktopStudioSource, /StudioRuntimeKind::Hermes => vec!\[StudioInstanceRuntimeNote \{/);
  assert.match(
    desktopStudioSource,
    /StudioRuntimeKind::Hermes => vec!\[[\s\S]*StudioInstanceCapability::Chat,[\s\S]*StudioInstanceCapability::Health,[\s\S]*StudioInstanceCapability::Files,[\s\S]*StudioInstanceCapability::Memory,[\s\S]*StudioInstanceCapability::Tools,[\s\S]*StudioInstanceCapability::Models,[\s\S]*\]/,
  );
  assert.doesNotMatch(desktopStudioSource, /StudioBuiltInOpenClawActivationStage/);
  assert.match(desktopStudioSource, /pub enum StudioInstanceActivationStage/);
  assert.match(
    desktopStudioSource,
    /pub enum StudioInstanceActivationStage \{[\s\S]*PrepareInstall,[\s\S]*PrepareConfig,[\s\S]*VerifyEndpoint,[\s\S]*Ready,[\s\S]*\}/,
  );
  assert.doesNotMatch(desktopStudioSource, /GatewayConfigured/);
  assert.doesNotMatch(desktopStudioSource, /PrepareRuntimeActivation/);
  assert.match(desktopStudioSource, /pub last_activation_stage: Option<StudioInstanceActivationStage>/);
  assert.match(
    desktopStudioSource,
    /Last built-in OpenClaw activation detail stage:/,
  );
});

runTest('desktop and server hosts keep OpenClaw detail parity for built-in, local-external, and remote shapes', () => {
  const desktopStudioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );
  const serverStudioSource = read(
    'packages/sdkwork-claw-host-studio/src-host/src/lib.rs',
  );

  assert.match(desktopStudioSource, /fn build_console_access\(/);
  assert.match(
    desktopStudioSource,
    /built_in_instance_detail_exposes_console_access_with_auto_login_url/,
  );
  assert.match(
    desktopStudioSource,
    /local_external_openclaw_detail_reports_ansible_install_method_from_profile_record/,
  );
  assert.match(
    desktopStudioSource,
    /remote_openclaw_instance_detail_does_not_reuse_built_in_local_workbench/,
  );
  assert.match(
    desktopStudioSource,
    /fn hermes_remote_instance_detail_reports_external_runtime_constraints_and_generic_connectivity\(\)/,
  );
  assert.match(desktopStudioSource, /Remote Hermes Agent/);
  assert.match(desktopStudioSource, /runtime_kind: StudioRuntimeKind::Hermes/);
  assert.match(desktopStudioSource, /transport_kind: StudioInstanceTransportKind::CustomHttp/);

  assert.match(serverStudioSource, /"consoleAccess": console_access\.unwrap_or\(Value::Null\)/);
  assert.match(
    serverStudioSource,
    /fn build_console_access\(instance: &Value, workbench: Option<&Value>\) -> Option<Value>/,
  );
  assert.match(serverStudioSource, /"exposure": endpoint_exposure_for_instance\(instance\)/);
  assert.match(serverStudioSource, /"auth": endpoint_auth_for_instance\(instance\)/);
  assert.match(
    serverStudioSource,
    /let status = if url\.is_some\(\) \{\s*"ready"\s*\} else \{\s*"configurationRequired"\s*\};/,
  );
  assert.match(serverStudioSource, /let explicit_base_url_override = !built_in/);
  assert.match(serverStudioSource, /let explicit_websocket_url_override = !built_in/);
  assert.match(
    serverStudioSource,
    /default_provider_built_in_openclaw_detail_omits_console_access_without_live_runtime_authority/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_built_in_openclaw_detail_exposes_bundled_console_access_when_control_plane_publishes_runtime_endpoints/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_local_external_openclaw_detail_exposes_console_access_without_workbench/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_remote_openclaw_detail_hides_console_launch_while_runtime_is_offline/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_remote_openclaw_detail_exposes_console_launch_when_runtime_is_online/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_remote_openclaw_detail_downgrades_blank_base_url_endpoint_status/,
  );
  assert.match(
    serverStudioSource,
    /default_provider_does_not_project_built_in_managed_workbench_when_control_plane_is_inactive/,
  );
  assert.match(
    serverStudioSource,
    /fn parse_workbench_openclaw_config_root\(workbench: Option<&Value>\) -> Option<Value>/,
  );
});

runTest('desktop bundled OpenClaw runtime reuses host-core port allocation instead of ad hoc loopback scanning', () => {
  const desktopRuntimeSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs',
  );

  assert.match(desktopRuntimeSource, /sdkwork_claw_host_core::port_allocator::/);
  assert.match(desktopRuntimeSource, /allocate_tcp_listener/);
  assert.match(desktopRuntimeSource, /PortAllocationRequest/);
  assert.match(desktopRuntimeSource, /PortRange::new/);
  assert.doesNotMatch(desktopRuntimeSource, /fn find_available_gateway_port\(/);
  assert.doesNotMatch(desktopRuntimeSource, /fn is_loopback_port_available\(/);
});

runTest('sdkwork-claw-desktop bootstraps shell runtime before mounting the React tree', () => {
  const createDesktopAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/createDesktopApp.tsx',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const desktopHostedBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts',
  );
  const desktopBootstrapRuntimeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopBootstrapRuntime.ts',
  );
  const desktopRuntimeConnectionSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopRuntimeConnection.ts',
  );
  const desktopBackgroundRuntimeReadinessToastSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopBackgroundRuntimeReadinessToast.ts',
  );
  const desktopBackgroundRuntimeReadinessRecoverySource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopBackgroundRuntimeReadinessRecovery.ts',
  );
  const desktopStartupEvidenceSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.ts',
  );
  const connectDesktopRuntimeBody = desktopBootstrapAppSource.match(
    /const connectDesktopRuntime = useEffectEvent\(async \(\) => \{([\s\S]*?)\n  }\);/,
  )?.[1];

  assert.match(createDesktopAppSource, /<DesktopBootstrapApp/);
  assert.match(desktopBootstrapAppSource, /bootstrapShellRuntime/);
  assert.match(desktopBootstrapAppSource, /ROUTE_PATHS/);
  assert.match(desktopBootstrapAppSource, /getAppInfo/);
  assert.match(desktopBootstrapAppSource, /getAppPaths/);
  assert.match(desktopBootstrapAppSource, /writeTextFile/);
  assert.match(desktopBootstrapAppSource, /toast/);
  assert.match(desktopBootstrapAppSource, /BACKGROUND_RUNTIME_READINESS_TOAST_ID/);
  assert.match(desktopBootstrapAppSource, /runDesktopBootstrapSequence/);
  assert.match(desktopBootstrapAppSource, /DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH/);
  assert.match(
    desktopStartupEvidenceSource,
    /export const DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH =\s*'diagnostics\/desktop-startup-evidence\.json';/,
  );
  assert.match(
    desktopStartupEvidenceSource,
    /export interface DesktopStartupEvidenceBundledComponents \{[\s\S]*packageProfileId:\s*string;[\s\S]*includedKernelIds:\s*string\[];[\s\S]*defaultEnabledKernelIds:\s*string\[];[\s\S]*\}/,
  );
  assert.match(
    desktopStartupEvidenceSource,
    /export interface DesktopStartupEvidenceDocument \{[\s\S]*bundledComponents:\s*DesktopStartupEvidenceBundledComponents \| null;/,
  );
  assert.match(desktopStartupEvidenceSource, /sanitizeDesktopStartupDescriptor/);
  assert.doesNotMatch(desktopStartupEvidenceSource, /browserSessionToken:/);
  assert.match(desktopHostedBridgeSource, /export interface DesktopHostedRuntimeReadinessEvidence/);
  assert.match(desktopHostedBridgeSource, /buildDesktopHostedRuntimeReadinessEvidence/);
  assert.match(desktopHostedBridgeSource, /gatewayWebsocketReady:/);
  assert.match(desktopHostedBridgeSource, /gatewayWebsocketProbeSupported:/);
  assert.match(desktopHostedBridgeSource, /gatewayWebsocketDialable:/);
  assert.match(desktopHostedBridgeSource, /gatewayInvokeCapabilityAvailable:/);
  assert.match(desktopHostedBridgeSource, /builtInInstanceReady:/);
  assert.match(desktopHostedBridgeSource, /ready:/);
  assert.doesNotMatch(desktopBootstrapAppSource, /@sdkwork\/claw-i18n/);
  assert.ok(connectDesktopRuntimeBody);
  assert.match(desktopBootstrapAppSource, /connectDesktopRuntimeDuringStartup/);
  assert.match(
    desktopBackgroundRuntimeReadinessToastSource,
    /export const BACKGROUND_RUNTIME_READINESS_TOAST_ID = 'desktop-background-runtime-readiness';/,
  );
  assert.match(
    desktopBackgroundRuntimeReadinessToastSource,
    /export function resolveBackgroundRuntimeReadinessToastResetPlan\([\s\S]*lastShownSignature:\s*string,[\s\S]*options\?:\s*ResolveBackgroundRuntimeReadinessToastResetPlanOptions,/,
  );
  assert.match(
    desktopBackgroundRuntimeReadinessToastSource,
    /dismissToastId:\s*options\?\.dismissToast \?\? true \? BACKGROUND_RUNTIME_READINESS_TOAST_ID : null/,
  );
  assert.match(
    desktopBackgroundRuntimeReadinessToastSource,
    /toastId:\s*BACKGROUND_RUNTIME_READINESS_TOAST_ID/,
  );
  assert.match(connectDesktopRuntimeBody, /connectDesktopRuntimeDuringStartup\(\{/);
  assert.match(connectDesktopRuntimeBody, /const runId = bootRunIdRef\.current;/);
  assert.match(connectDesktopRuntimeBody, /const isCurrentRun = \(\) => bootRunIdRef\.current === runId;/);
  assert.match(connectDesktopRuntimeBody, /getAppInfo,/);
  assert.match(connectDesktopRuntimeBody, /getAppPaths,/);
  assert.match(
    connectDesktopRuntimeBody,
    /let desktopKernelInfoPromise: Promise<DesktopKernelInfo \| null> \| null = null;/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /const captureDesktopKernelInfo = async \(captureRunId = runId\) => \{/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /const captureLocalAiProxyEvidence = async \(captureRunId = runId\) => \{/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /const captureLocalAiProxyEvidence = async \(captureRunId = runId\) => \{/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /const kernelInfo = await getDesktopKernelInfo\(\);/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /const localAiProxy = kernelInfo\?\.localAiProxy \?\? null;/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /const kernelInfo = await captureDesktopKernelInfo\(runId\);[\s\S]*const recoveryMode = resolveBackgroundRuntimeReadinessRecoveryMode\([\s\S]*kernelInfo\?\.bundledComponents\.includedKernelIds[\s\S]*requiresBuiltInOpenClawEvidence:\s*recoveryMode === 'managed-openclaw'/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /interface DesktopStartupEvidenceContext \{[\s\S]*bundledComponents:[\s\S]*DesktopKernelInfo\['bundledComponents'\] \| null;/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /buildDesktopStartupEvidenceDocument\(\{[\s\S]*bundledComponents:\s*bundledComponents \?\? context\?\.bundledComponents \?\? null,/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /captureLocalAiProxyEvidence:\s*\(\)\s*=>\s*captureLocalAiProxyEvidence\(runId\),/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /onReadinessReady:\s*async\s*\(\{\s*appInfo,\s*appPaths,\s*readinessSnapshot,\s*localAiProxy\s*\}\)\s*=>\s*\{/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /if \(!isCurrentRun\(\)\) \{\s*logStartup\(\s*'warn',\s*'Ignoring stale hosted runtime readiness success from a previous bootstrap run\.'/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /onReadinessFailed:\s*async\s*\(\{\s*appInfo,\s*appPaths,\s*error,\s*localAiProxy\s*\}\)\s*=>\s*\{/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /if \(!isCurrentRun\(\)\) \{\s*logStartup\(\s*'warn',\s*'Ignoring stale hosted runtime readiness failure from a previous bootstrap run\.'/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /setBackgroundRuntimeReadinessNotification\(\{\s*runId,\s*message:/,
  );
  assert.doesNotMatch(
    connectDesktopRuntimeBody,
    /hostEndpoints\[0\]/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /hostEndpointId:\s*readinessSnapshot\.evidence\.manageEndpointId/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /hostEndpointRequestedPort:\s*readinessSnapshot\.evidence\.manageEndpointRequestedPort/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /hostEndpointActivePort:\s*readinessSnapshot\.evidence\.manageEndpointActivePort/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /hostEndpointBaseUrl:\s*readinessSnapshot\.evidence\.manageBaseUrl/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /builtInInstanceRuntimeKind:\s*builtInInstance\?\.runtimeKind\s*\?\?\s*null/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /builtInInstanceDeploymentMode:\s*builtInInstance\?\.deploymentMode\s*\?\?\s*null/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /builtInInstanceTransportKind:\s*builtInInstance\?\.transportKind\s*\?\?\s*null/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /builtInInstanceStatus:\s*builtInInstance\?\.status\s*\?\?\s*null/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /isDesktopHostedRuntimeReadinessError\(/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /Hosted desktop runtime readiness probe failed in the background\./,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /phase:\s*resolvePassingDesktopStartupEvidencePhase\(\s*milestonesRef\.current\.hasShellMounted,\s*\)/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /phase:\s*'runtime-readiness-failed'/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /readinessEvidence:\s*readinessError\.snapshot\.evidence/,
  );
  assert.match(
    connectDesktopRuntimeBody,
    /runtimeReadinessFailureRef\.current = true/,
  );
  assert.match(
    desktopRuntimeConnectionSource,
    /await Promise\.all\(\[\s*options\.getAppInfo\(\),\s*options\.getAppPaths\(\),\s*\]\)/,
  );
  assert.match(
    desktopRuntimeConnectionSource,
    /Desktop runtime metadata connected\. Continuing shell launch while hosted runtime readiness is checked in the background\./,
  );
  assert.match(
    desktopRuntimeConnectionSource,
    /const readinessSnapshot = await options\.probeHostedRuntimeReadiness\(\);/,
  );
  assert.match(
    desktopRuntimeConnectionSource,
    /await options\.onReadinessFailed\(\{[\s\S]*\.\.\.baseContext,[\s\S]*error,[\s\S]*localAiProxy,[\s\S]*}\);[\s\S]*throw error;/,
  );
  assert.doesNotMatch(
    desktopRuntimeConnectionSource,
    /readinessTask/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /runDesktopBootstrapSequence\(\{[\s\S]*pathname:\s*window\.location\.pathname[\s\S]*revealStartupWindow[\s\S]*connectDesktopRuntime[\s\S]*bootstrapShellRuntime:\s*async \(\) => \{[\s\S]*await bootstrapShellRuntime\(\);[\s\S]*resolveSidebarStartupRoute[\s\S]*listSidebarRoutePrefetchPaths[\s\S]*prefetchSidebarRoute[\s\S]*prefetchSidebarRoutes[\s\S]*actions:\s*bootstrapStateActions[\s\S]*\}\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /if \(shouldPersistShellMountedDesktopStartupEvidence\(\{\s*runtimeReadinessFailed:\s*runtimeReadinessFailureRef\.current,\s*readinessSnapshot:\s*startupEvidenceContextRef\.current\?\.readinessSnapshot\s*\?\?\s*null,\s*}\)\) \{\s*void persistStartupEvidence\(\{\s*status:\s*'passed',\s*phase:\s*'shell-mounted'/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const \[backgroundRuntimeReadinessNotification,\s*setBackgroundRuntimeReadinessNotification\]\s*=\s*[\s\S]*?useState/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const clearBackgroundRuntimeReadinessFailureState = useEffectEvent\(\(options\?: \{\s*dismissToast\?: boolean;\s*}\) => \{/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const resetPlan = resolveBackgroundRuntimeReadinessToastResetPlan\(\s*backgroundRuntimeReadinessNotificationSignatureRef\.current,\s*options,\s*\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /if \(resetPlan\?\.dismissToastId\) \{\s*toast\.dismiss\(resetPlan\.dismissToastId\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const retryToastId = BACKGROUND_RUNTIME_READINESS_TOAST_ID;/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /function resolveBuiltInOpenClawInstanceFromSnapshot\(/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /function resolveBuiltInOpenClawInstanceIdFromSnapshot\(/,
  );
  assert.doesNotMatch(
    desktopBootstrapAppSource,
    /const BUILT_IN_OPENCLAW_INSTANCE_ID = 'local-built-in';/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /clearFailureState:\s*\(\)\s*=>\s*\{\s*clearBackgroundRuntimeReadinessFailureState\(\{\s*dismissToast:\s*false\s*}\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /toast\.error\([\s\S]*id:\s*toastPlan\.toastId,/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /toast\.loading\([\s\S]*id:\s*retryToastId,/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /toast\.success\([\s\S]*id:\s*retryToastId,/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /toast\.error\([\s\S]*id:\s*retryToastId,/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /const builtInInstanceId = resolveBuiltInOpenClawInstanceIdFromSnapshot\(\s*startupEvidenceContextRef\.current\?\.readinessSnapshot,\s*\);[\s\S]*openDesktopShellRoute\(\s*builtInInstanceId\s*\?\s*`\$\{ROUTE_PATHS\.INSTANCES\}\/\$\{builtInInstanceId\}`\s*:\s*ROUTE_PATHS\.INSTANCES,\s*\);/,
  );
  assert.match(
    desktopBackgroundRuntimeReadinessRecoverySource,
    /if \(recoveryMode === 'managed-openclaw'\) \{[\s\S]*if \(instanceId\) \{[\s\S]*const restartedInstance = await restartInstance\(instanceId\);[\s\S]*if \(restartedInstance\) \{[\s\S]*await reconnectHostedRuntimeReadiness\(\);[\s\S]*return;[\s\S]*await ensureDesktopKernelRunning\(\);[\s\S]*await reconnectHostedRuntimeReadiness\(\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /window\.history\.pushState\(\{\}, '', pathname\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /window\.dispatchEvent\(new PopStateEvent\('popstate'\)\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /writeTextFile\(\s*DESKTOP_STARTUP_EVIDENCE_RELATIVE_PATH/,
  );
  assert.match(
    desktopBootstrapRuntimeSource,
    /await options\.revealStartupWindow\(\);[\s\S]*await options\.connectDesktopRuntime\(\);[\s\S]*const startupRoute = options\.resolveSidebarStartupRoute\(options\.pathname\);[\s\S]*options\.prefetchSidebarRoute\(startupRoute\);[\s\S]*await options\.bootstrapShellRuntime\(\);[\s\S]*options\.actions\.setShouldRenderShell\(true\)/,
  );
  assert.match(
    desktopBootstrapRuntimeSource,
    /let warmSidebarRoutesHandle: number \| null = null;/,
  );
  assert.match(
    desktopBootstrapRuntimeSource,
    /warmSidebarRoutesHandle = options\.scheduleTask\(\(\) => \{[\s\S]*listSidebarRoutePrefetchPaths\(\)[\s\S]*filter\(\(path\) => path !== startupRoute\)/,
  );
  assert.match(
    desktopBootstrapRuntimeSource,
    /const clearWarmSidebarRoutesTask = \(\) => \{[\s\S]*options\.clearScheduledTask\(warmSidebarRoutesHandle\);/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /shouldRenderShell \? \([\s\S]*<DesktopProviders>[\s\S]*<AppProviders onLanguagePreferenceChange=\{handleLanguagePreferenceChange\}>[\s\S]*<DesktopTrayRouteBridge \/>[\s\S]*<MainLayout \/>/,
  );
});

runTest('desktop hosted readiness probe validates live OpenClaw authority instead of route presence alone', () => {
  const desktopHostedBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const internalRouteSource = read(
    'packages/sdkwork-claw-server/src-host/src/http/routes/internal_node_sessions.rs',
  );

  assert.match(desktopHostedBridgeSource, /manage\.getOpenClawRuntime\(\)/);
  assert.match(desktopHostedBridgeSource, /manage\.getOpenClawGateway\(\)/);
  assert.match(
    desktopHostedBridgeSource,
    /manage\.openclaw\.gateway\.invoke/,
  );
  assert.match(
    desktopHostedBridgeSource,
    /resolveBuiltInOpenClawInstance/,
  );
  assert.match(
    desktopHostedBridgeSource,
    /gatewayBaseUrl:\s*openClawGatewayBaseUrl,\s*[\s\S]*gatewayWebsocketUrl:\s*openClawGatewayWebsocketUrl,/,
  );
  assert.doesNotMatch(
    desktopHostedBridgeSource,
    /instances\.find\(\(instance\)\s*=>\s*normalizeRequiredString\(instance\.id\)\s*===\s*'local-built-in'\)/,
  );
  assert.match(
    desktopHostedBridgeSource,
    /Desktop hosted runtime did not expose the built-in OpenClaw instance baseUrl\./,
  );
  assert.match(
    desktopHostedBridgeSource,
    /Desktop hosted runtime did not expose the built-in OpenClaw instance websocketUrl\./,
  );
  assert.match(
    desktopHostedBridgeSource,
    /Desktop hosted runtime did not accept a WebSocket connection on the OpenClaw gateway yet\./,
  );
  assert.match(desktopBootstrapAppSource, /openClawRuntimeLifecycle:/);
  assert.match(desktopBootstrapAppSource, /openClawGatewayLifecycle:/);
  assert.doesNotMatch(
    internalRouteSource,
    /merge_hosted_openclaw_lifecycle|resolve_host_platform_lifecycle/,
  );
  assert.match(
    internalRouteSource,
    /lifecycle:\s*"ready"\.to_string\(\),/,
  );
  assert.match(
    desktopBootstrapAppSource,
    /blockOnReadiness:\s*false/,
  );
});

runTest('OpenClaw config workbench uses gateway authority when the runtime is online while keeping file fallback for offline desktop flows', () => {
  const instanceServiceCoreSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceServiceCore.ts',
  );
  const instanceServiceSource = read(
    'packages/sdkwork-claw-instances/src/services/instanceService.ts',
  );

  assert.match(
    instanceServiceCoreSource,
    /private async withOpenClawGatewayProbe<TResult>\([\s\S]*shouldProbeOpenClawGateway\(detail\)[\s\S]*const optimisticProbe = !hasReadyOpenClawGateway\(detail\);/,
  );
  assert.match(
    instanceServiceCoreSource,
    /async getOpenClawConfigDocument\(id: string\): Promise<string> \{[\s\S]*withOpenClawGatewayProbe\([\s\S]*openClawGatewayClient\.getConfig\(id\)[\s\S]*serializeOpenClawConfigDocument\(/,
  );
  assert.match(
    instanceServiceCoreSource,
    /async updateOpenClawConfigDocument\(id: string, raw: string\): Promise<void> \{[\s\S]*withOpenClawGatewayProbe\([\s\S]*openClawGatewayClient\.getConfig\(id\)[\s\S]*openClawGatewayClient\.setConfig\(id,\s*\{[\s\S]*baseHash: snapshot\.baseHash[\s\S]*\}\)/,
  );
  assert.match(
    instanceServiceCoreSource,
    /openClawConfigDocumentApi\.readConfigDocument\(\s*configBinding\.configFile/,
  );
  assert.match(
    instanceServiceCoreSource,
    /openClawConfigDocumentApi\.writeConfigDocument\(\s*configBinding\.configFile,\s*raw/,
  );
  assert.match(
    instanceServiceSource,
    /setConfig:\s*\(instanceId,\s*args\)\s*=> openClawGatewayClient\.setConfig\(instanceId,\s*args\)/,
  );
  assert.match(instanceServiceCoreSource, /function isBuiltInOpenClawDetail\(/);
  assert.match(
    instanceServiceCoreSource,
    /function createProviderCenterControlledOpenClawProviderError\(\)/,
  );
  assert.doesNotMatch(instanceServiceCoreSource, /function isBuiltInManagedOpenClawDetail\(/);
  assert.doesNotMatch(
    instanceServiceCoreSource,
    /function createManagedOpenClawProviderControlPlaneError\(\)/,
  );
  assert.doesNotMatch(instanceServiceCoreSource, /withManagedOpenClawGatewayProbe/);
});

runTest('desktop hosted runtime evidence uses built-in OpenClaw wording for readiness options and shape fields', () => {
  const desktopHostedBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.ts',
  );
  const tauriBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  );
  const smokeDesktopStartupEvidenceSource = read(
    'scripts/release/smoke-desktop-startup-evidence.mjs',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );

  assert.match(desktopHostedBridgeSource, /requiresBuiltInOpenClawEvidence\?: boolean;/);
  assert.match(desktopHostedBridgeSource, /requiresBuiltInOpenClawEvidence = true/);
  assert.match(
    desktopHostedBridgeSource,
    /builtInInstanceRuntimeKindMatchesOpenClaw:\s*boolean;/,
  );
  assert.match(
    desktopHostedBridgeSource,
    /builtInInstanceDeploymentModeMatchesLocalManaged:\s*boolean;/,
  );
  assert.match(
    desktopHostedBridgeSource,
    /builtInInstanceTransportKindMatchesOpenClawGateway:\s*boolean;/,
  );
  assert.doesNotMatch(desktopHostedBridgeSource, /requiresManagedOpenClawEvidence/);
  assert.doesNotMatch(
    desktopHostedBridgeSource,
    /builtInInstanceRuntimeKindMatchesManagedOpenClaw/,
  );
  assert.doesNotMatch(
    desktopHostedBridgeSource,
    /builtInInstanceDeploymentModeMatchesManagedOpenClaw/,
  );
  assert.doesNotMatch(
    desktopHostedBridgeSource,
    /builtInInstanceTransportKindMatchesManagedOpenClaw/,
  );

  assert.match(tauriBridgeSource, /requiresBuiltInOpenClawEvidence\?: boolean;/);
  assert.doesNotMatch(tauriBridgeSource, /requiresManagedOpenClawEvidence/);

  assert.match(smokeDesktopStartupEvidenceSource, /requiresBuiltInOpenClawEvidence = true/);
  assert.match(
    desktopBootstrapAppSource,
    /requiresBuiltInOpenClawEvidence:\s*recoveryMode === 'managed-openclaw'/,
  );
  assert.doesNotMatch(smokeDesktopStartupEvidenceSource, /requiresManagedOpenClawEvidence/);
});

runTest('internal built-in OpenClaw helpers use built-in naming instead of managed naming', () => {
  const builtInSelectionSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/builtInOpenClawInstanceSelection.ts',
  );
  const gatewayClientSource = read(
    'packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts',
  );
  const configServiceSource = read(
    'packages/sdkwork-claw-core/src/services/openClawConfigService.ts',
  );

  assert.match(builtInSelectionSource, /function isBuiltInOpenClawInstance\(/);
  assert.match(builtInSelectionSource, /isBuiltInOpenClawInstanceId\(instance\.id\)/);
  assert.match(builtInSelectionSource, /const candidates = instances\.filter\(isBuiltInOpenClawInstance\)/);
  assert.match(builtInSelectionSource, /if \(candidates\.length === 0\)\s*{\s*return null;/);
  assert.match(builtInSelectionSource, /const rankedByGateway = candidates/);
  assert.match(builtInSelectionSource, /const explicitBuiltInInstance = candidates\.find/);
  assert.doesNotMatch(builtInSelectionSource, /return instances\[0\]/);
  assert.doesNotMatch(builtInSelectionSource, /function isManagedOpenClawInstance\(/);
  assert.doesNotMatch(builtInSelectionSource, /managedOpenClawPriority/);
  assert.doesNotMatch(builtInSelectionSource, /const managedOpenClawInstance = instances\.find\(isManagedOpenClawInstance\)/);

  assert.match(gatewayClientSource, /function isBuiltInOpenClawAccess\(/);
  assert.match(gatewayClientSource, /if \(invokeGateway && isBuiltInOpenClawAccess\(access\)\)/);
  assert.doesNotMatch(gatewayClientSource, /function isBuiltInManagedOpenClawAccess\(/);
  assert.doesNotMatch(gatewayClientSource, /isBuiltInManagedOpenClawAccess\(access\)/);

  assert.match(
    configServiceSource,
    /buildOpenClawProviderSnapshotsFromConfigRoot as buildOpenClawProviderSnapshotsFromConfigRootDelegate/,
  );
  assert.match(configServiceSource, /writeOpenClawProviderConfigToConfigRoot/);
  assert.match(configServiceSource, /buildConfigDocumentPreview as buildConfigDocumentPreviewDelegate/);
  assert.match(configServiceSource, /configureOpenClawMultiAgentSupportInConfigRoot/);
  assert.doesNotMatch(configServiceSource, /function isBuiltInManagedOpenClawDetail\(/);
  assert.doesNotMatch(configServiceSource, /function resolveBuiltInManagedOpenClawWorkspacePath\(/);
  assert.doesNotMatch(configServiceSource, /function canonicalizeBuiltInManagedOpenClawConfigPath\(/);
});

runTest('OpenClaw console auth source contract uses configFile terminology across shared and host surfaces', () => {
  const sharedTypesSource = read('packages/sdkwork-claw-types/src/index.ts');
  const desktopStudioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );
  const hostedStudioSource = read(
    'packages/sdkwork-claw-host-studio/src-host/src/lib.rs',
  );

  assert.match(
    sharedTypesSource,
    /export type StudioInstanceConsoleAuthSource =[\s\S]*\| 'configFile'/,
  );
  assert.doesNotMatch(sharedTypesSource, /\| 'managedConfig'/);
  assert.match(hostedStudioSource, /Some\("configFile"\)/);
  assert.doesNotMatch(hostedStudioSource, /Some\("managedConfig"\)/);
  assert.match(desktopStudioSource, /Some\("configFile"\)/);
});

runTest('desktop runtime authority internals use config_file_path terminology instead of managed_config_path', () => {
  const kernelRuntimeTypesSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_runtime/types.rs',
  );
  const authorityServiceSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs',
  );
  const authorityServiceProductionSource = stripRustTestModule(authorityServiceSource);
  const openClawRuntimeSnapshotSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs',
  );
  const layoutSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs',
  );

  assert.match(kernelRuntimeTypesSource, /pub config_file_path: PathBuf,/);
  assert.doesNotMatch(kernelRuntimeTypesSource, /pub managed_config_path: PathBuf,/);
  assert.match(authorityServiceProductionSource, /pub fn active_config_file_path\(/);
  assert.doesNotMatch(authorityServiceProductionSource, /pub fn active_managed_config_path\(/);
  assert.match(
    authorityServiceProductionSource,
    /fn reconcile_runtime_authority_config_file_path\(/,
  );
  assert.doesNotMatch(
    authorityServiceProductionSource,
    /fn reconcile_openclaw_authority_managed_config_path\(/,
  );
  assert.doesNotMatch(authorityServiceProductionSource, /managed-config/);
  assert.doesNotMatch(authorityServiceProductionSource, /fn legacy_managed_config_file_path\(/);
  assert.match(openClawRuntimeSnapshotSource, /authority\.config_file_path/);
  assert.doesNotMatch(openClawRuntimeSnapshotSource, /authority\.managed_config_path/);
  assert.doesNotMatch(layoutSource, /managedConfigPath/);
  assert.doesNotMatch(layoutSource, /KernelAuthorityStateCompat/);
  assert.doesNotMatch(layoutSource, /impl<'de> Deserialize<'de> for KernelAuthorityState/);
});

runTest('desktop kernel path models use config_dir and config_file terminology instead of managed_config fields', () => {
  const pathsSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/paths.rs',
  );
  const bootstrapSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  );
  const internalCliSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs',
  );
  const kernelHostSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/kernel_host/mod.rs',
  );

  assert.match(pathsSource, /pub config_dir: PathBuf,/);
  assert.match(pathsSource, /pub config_file: PathBuf,/);
  assert.doesNotMatch(pathsSource, /pub managed_config_dir: PathBuf,/);
  assert.doesNotMatch(pathsSource, /pub managed_config_file: PathBuf,/);
  assert.doesNotMatch(pathsSource, /let \(managed_config_dir, managed_config_file\) =/);
  assert.doesNotMatch(pathsSource, /managed_config_dir\.clone\(\)/);
  assert.doesNotMatch(pathsSource, /managed_config_dir\.join/);
  assert.doesNotMatch(pathsSource, /kernel\.managed_config_dir/);
  assert.doesNotMatch(pathsSource, /kernel\.managed_config_file/);

  assert.match(bootstrapSource, /\.map\(\|kernel\| kernel\.config_file\)/);
  assert.doesNotMatch(bootstrapSource, /\.map\(\|kernel\| kernel\.managed_config_file\)/);
  assert.match(internalCliSource, /\.map\(\|kernel\| kernel\.config_file\)/);
  assert.doesNotMatch(internalCliSource, /\.map\(\|kernel\| kernel\.managed_config_file\)/);
  assert.match(kernelHostSource, /\.map\(\|kernel\| kernel\.config_file\.clone\(\)\)/);
  assert.doesNotMatch(kernelHostSource, /\.map\(\|kernel\| kernel\.managed_config_file\.clone\(\)\)/);
});

runTest('desktop mirror import verification exposes OpenClaw config file terminology instead of managed-config checks', () => {
  const mirrorImportSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs',
  );

  assert.match(mirrorImportSource, /"openclaw-config-file"/);
  assert.match(mirrorImportSource, /"OpenClaw config file restored"/);
  assert.match(mirrorImportSource, /Restored OpenClaw config file is present and readable at/);
  assert.match(mirrorImportSource, /OpenClaw config file is missing or invalid after import at/);
  assert.match(mirrorImportSource, /"OpenClaw state restored"/);
  assert.match(mirrorImportSource, /Restored OpenClaw state directory is present at/);
  assert.match(mirrorImportSource, /OpenClaw state directory is missing after import at/);
  assert.match(mirrorImportSource, /"OpenClaw workspace restored"/);
  assert.match(mirrorImportSource, /Restored OpenClaw workspace directory is present at/);
  assert.match(mirrorImportSource, /OpenClaw workspace directory is missing after import at/);
  assert.match(mirrorImportSource, /"OpenClaw provider projected"/);
  assert.match(
    mirrorImportSource,
    /OpenClaw config file could not be parsed to verify the projected provider\./,
  );
  assert.match(
    mirrorImportSource,
    /unsupported OpenClaw asset inventory schema version:/,
  );
  assert.match(
    mirrorImportSource,
    /skill asset payload missing from mirror archive:/,
  );
  assert.match(
    mirrorImportSource,
    /plugin asset payload missing from mirror archive:/,
  );
  assert.match(
    mirrorImportSource,
    /skill asset inventory path is outside the canonical root/,
  );
  assert.match(
    mirrorImportSource,
    /plugin asset inventory path is outside the canonical root/,
  );
  assert.match(mirrorImportSource, /fn load_openclaw_assets_snapshot\(/);
  assert.match(mirrorImportSource, /fn validate_openclaw_assets_payloads\(/);
  assert.match(mirrorImportSource, /fn validate_openclaw_asset_canonical_root\(/);
  assert.match(mirrorImportSource, /fn resolve_openclaw_asset_path\(/);
  assert.match(mirrorImportSource, /fn resolve_staged_openclaw_asset_path\(/);
  assert.match(mirrorImportSource, /sdkwork-local-proxy provider targets/);
  assert.doesNotMatch(mirrorImportSource, /"managed-config"/);
  assert.doesNotMatch(mirrorImportSource, /"Managed config restored"/);
  assert.doesNotMatch(mirrorImportSource, /Restored managed OpenClaw config/);
  assert.doesNotMatch(mirrorImportSource, /Managed OpenClaw config is missing or invalid after import/);
  assert.doesNotMatch(mirrorImportSource, /Restored managed OpenClaw state directory/);
  assert.doesNotMatch(mirrorImportSource, /Managed OpenClaw state directory is missing after import/);
  assert.doesNotMatch(mirrorImportSource, /Restored managed OpenClaw workspace directory/);
  assert.doesNotMatch(mirrorImportSource, /Managed OpenClaw workspace directory is missing after import/);
  assert.doesNotMatch(mirrorImportSource, /Managed OpenClaw provider projected/);
  assert.doesNotMatch(mirrorImportSource, /Managed OpenClaw config could not be parsed to verify/);
  assert.doesNotMatch(mirrorImportSource, /Managed sdkwork-local-proxy provider/);
  assert.doesNotMatch(mirrorImportSource, /unsupported managed asset inventory schema version:/);
  assert.doesNotMatch(mirrorImportSource, /managed skill asset payload missing from mirror archive:/);
  assert.doesNotMatch(mirrorImportSource, /managed plugin asset payload missing from mirror archive:/);
  assert.doesNotMatch(mirrorImportSource, /managed skill asset inventory path is outside the canonical root/);
  assert.doesNotMatch(mirrorImportSource, /managed plugin asset inventory path is outside the canonical root/);
  assert.doesNotMatch(mirrorImportSource, /fn load_managed_assets_snapshot\(/);
  assert.doesNotMatch(mirrorImportSource, /fn validate_managed_assets_payloads\(/);
  assert.doesNotMatch(mirrorImportSource, /fn validate_managed_asset_canonical_root\(/);
  assert.doesNotMatch(mirrorImportSource, /fn resolve_managed_asset_path\(/);
  assert.doesNotMatch(mirrorImportSource, /fn resolve_staged_managed_asset_path\(/);
});

runTest('desktop OpenClaw runtime helpers use built-in naming outside legacy compat boundaries', () => {
  const openClawRuntimeSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs',
  );
  const mirrorManifestSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_manifest.rs',
  );

  assert.match(openClawRuntimeSource, /struct BuiltInOpenClawState/);
  assert.doesNotMatch(openClawRuntimeSource, /struct ManagedOpenClawState/);
  assert.match(openClawRuntimeSource, /fn ensure_built_in_openclaw_state\(/);
  assert.doesNotMatch(openClawRuntimeSource, /fn ensure_managed_openclaw_state\(/);

  assert.match(mirrorManifestSource, /"OpenClaw workspace path"/);
  assert.doesNotMatch(mirrorManifestSource, /"managed openclaw workspace path"/);
  assert.match(mirrorManifestSource, /fn seed_built_in_openclaw_tree\(paths: &AppPaths\)/);
  assert.doesNotMatch(mirrorManifestSource, /fn seed_managed_openclaw_tree\(/);
});

runTest('desktop openclaw helpers use config file terminology in supervisor and studio services', () => {
  const supervisorSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs',
  );
  const studioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );
  const openclawWorkbenchSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_workbench.rs',
  );

  assert.match(supervisorSource, /fn configured_openclaw_gateway_port\(paths: &AppPaths\)/);
  assert.match(supervisorSource, /fn built_in_openclaw_runtime_dir\(paths: &AppPaths\) -> PathBuf/);
  assert.match(supervisorSource, /fn command_matches_built_in_openclaw_gateway<S>\(/);
  assert.match(supervisorSource, /fn readable_openclaw_config_file_path\(paths: &AppPaths\)/);
  assert.match(supervisorSource, /fn default_openclaw_config_file_path\(paths: &AppPaths\)/);
  assert.doesNotMatch(supervisorSource, /fn configured_managed_openclaw_gateway_port\(/);
  assert.doesNotMatch(supervisorSource, /fn managed_openclaw_runtime_dir\(/);
  assert.doesNotMatch(supervisorSource, /fn command_matches_managed_openclaw_gateway\(/);
  assert.doesNotMatch(supervisorSource, /fn readable_managed_openclaw_config_path\(/);
  assert.doesNotMatch(supervisorSource, /fn default_managed_openclaw_config_path\(/);

  assert.match(studioSource, /fn read_openclaw_config\(paths: &AppPaths\) -> Result<Value>/);
  assert.match(studioSource, /fn openclaw_config_target\(paths: &AppPaths\) -> String/);
  assert.match(studioSource, /fn uses_built_in_openclaw_config\(instance: &StudioInstanceRecord\) -> bool/);
  assert.match(studioSource, /fn is_built_in_openclaw_instance\(instance: &StudioInstanceRecord\) -> bool/);
  assert.match(studioSource, /fn find_built_in_openclaw_index\(instances: &\[StudioInstanceRecord\]\) -> Option<usize>/);
  assert.match(studioSource, /fn built_in_openclaw_lifecycle\(supervisor: &SupervisorService\) -> Result<OpenClawLifecycle>/);
  assert.match(studioSource, /fn built_in_openclaw_last_error\(supervisor: &SupervisorService\) -> Result<Option<String>>/);
  assert.match(studioSource, /fn built_in_openclaw_gateway_endpoint\(/);
  assert.match(studioSource, /fn built_in_openclaw_runtime_dir\(paths: &AppPaths\) -> PathBuf/);
  assert.match(studioSource, /fn readable_openclaw_config_file_path\(paths: &AppPaths\)/);
  assert.match(studioSource, /fn authority_openclaw_config_file_path\(paths: &AppPaths\)/);
  assert.doesNotMatch(studioSource, /fn uses_built_in_managed_openclaw_config\(/);
  assert.doesNotMatch(studioSource, /fn is_built_in_managed_openclaw_instance\(/);
  assert.doesNotMatch(studioSource, /fn find_built_in_managed_openclaw_index\(/);
  assert.doesNotMatch(studioSource, /fn resolve_built_in_managed_openclaw_instance\(/);
  assert.doesNotMatch(studioSource, /fn require_built_in_managed_openclaw_instance\(/);
  assert.doesNotMatch(studioSource, /fn require_managed_openclaw_task_instance\(/);
  assert.doesNotMatch(studioSource, /fn managed_openclaw_lifecycle\(/);
  assert.doesNotMatch(studioSource, /fn managed_openclaw_last_error\(/);
  assert.doesNotMatch(studioSource, /fn managed_openclaw_gateway_endpoint\(/);
  assert.doesNotMatch(studioSource, /fn managed_openclaw_runtime_dir\(/);
  assert.doesNotMatch(studioSource, /fn read_managed_openclaw_config\(/);
  assert.doesNotMatch(studioSource, /fn managed_openclaw_config_target\(/);
  assert.doesNotMatch(studioSource, /fn readable_managed_openclaw_config_path\(/);
  assert.doesNotMatch(studioSource, /fn authority_managed_openclaw_config_path\(/);

  assert.match(
    openclawWorkbenchSource,
    /fn readable_openclaw_config_file_path\(paths: &AppPaths\) -> PathBuf/,
  );
  assert.match(
    openclawWorkbenchSource,
    /fn authority_openclaw_config_file_path\(paths: &AppPaths\) -> PathBuf/,
  );
  assert.doesNotMatch(openclawWorkbenchSource, /fn readable_managed_openclaw_config_path\(/);
  assert.doesNotMatch(openclawWorkbenchSource, /fn authority_managed_openclaw_config_path\(/);
});

runTest('desktop OpenClaw legacy config path compatibility stays quarantined to drift handling and tests', () => {
  const authorityServiceSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/kernel_runtime_authority.rs',
  );
  const authorityServiceProductionSource = stripRustTestModule(authorityServiceSource);

  assert.match(authorityServiceSource, /\#\[cfg\(test\)\]\s*mod tests \{/);
  assert.match(authorityServiceSource, /fn legacy_managed_config_file_path\(/);
  assert.match(authorityServiceProductionSource, /fn reconcile_runtime_authority_config_file_path\(/);
  assert.doesNotMatch(authorityServiceProductionSource, /managed-config/);
  assert.doesNotMatch(authorityServiceProductionSource, /fn legacy_managed_config_file_path\(/);
  assert.doesNotMatch(authorityServiceProductionSource, /fn resolve_legacy_openclaw_config_source_path\(/);
});

runTest('desktop rust test helpers use config file terminology for openclaw config paths', () => {
  const internalCliSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs',
  );
  const bootstrapSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs',
  );
  const localAiProxySource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/local_ai_proxy.rs',
  );
  const openclawMirrorImportSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_import.rs',
  );
  const openclawMirrorExportSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_mirror_export.rs',
  );

  assert.match(internalCliSource, /fn openclaw_config_file_path\(/);
  assert.doesNotMatch(internalCliSource, /fn managed_openclaw_config_path\(/);

  assert.match(bootstrapSource, /fn openclaw_config_file_path\(/);
  assert.match(
    bootstrapSource,
    /fn seed_built_in_openclaw_gateway_port\(paths: &crate::framework::paths::AppPaths, port: u16\)/,
  );
  assert.doesNotMatch(bootstrapSource, /fn managed_openclaw_config_path\(/);
  assert.doesNotMatch(bootstrapSource, /fn seed_managed_openclaw_gateway_port\(/);

  assert.match(localAiProxySource, /fn openclaw_config_file_path\(/);
  assert.doesNotMatch(localAiProxySource, /fn managed_openclaw_config_path\(/);

  assert.match(openclawMirrorImportSource, /fn openclaw_config_file_path\(paths: &AppPaths\) -> PathBuf/);
  assert.match(openclawMirrorImportSource, /fn seed_built_in_openclaw_tree\(paths: &AppPaths, label: &str\)/);
  assert.doesNotMatch(openclawMirrorImportSource, /fn managed_openclaw_config_path\(/);
  assert.doesNotMatch(openclawMirrorImportSource, /fn seed_managed_openclaw_tree\(/);

  assert.match(openclawMirrorExportSource, /fn seed_built_in_openclaw_tree\(paths: &AppPaths\)/);
  assert.doesNotMatch(openclawMirrorExportSource, /fn seed_managed_openclaw_tree\(/);
});

runTest('desktop studio diagnostics use OpenClaw instance and config-file wording instead of legacy managed wording', () => {
  const studioSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
  );
  const openclawRuntimeSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime.rs',
  );
  const openclawWorkbenchSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_workbench.rs',
  );
  const runtimeSnapshotSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/openclaw_runtime_snapshot.rs',
  );

  assert.match(studioSource, /built-in OpenClaw instance/);
  assert.match(
    studioSource,
    /runtime-backed OpenClaw workspace operations are only available for the built-in OpenClaw instance/,
  );
  assert.match(
    studioSource,
    /runtime-backed task operations are only available for the built-in OpenClaw instance/,
  );
  assert.match(studioSource, /OpenClaw runtime configuration file\./);
  assert.match(studioSource, /Host OpenClaw runtime/);
  assert.match(studioSource, /Ansible OpenClaw runtime/);
  assert.doesNotMatch(studioSource, /built-in managed OpenClaw instance/);
  assert.doesNotMatch(studioSource, /Host-managed OpenClaw runtime/);
  assert.doesNotMatch(studioSource, /Ansible managed OpenClaw runtime/);
  assert.doesNotMatch(studioSource, /Managed OpenClaw runtime configuration file\./);

  assert.match(
    openclawRuntimeSource,
    /unsupported OpenClaw runtime id \{\} for install key \{\}/,
  );
  assert.match(
    openclawRuntimeSource,
    /OpenClaw runtime install key \{\} does not match manifest key \{\}/,
  );
  assert.match(openclawRuntimeSource, /built-in OpenClaw runtime install/);
  assert.doesNotMatch(
    openclawRuntimeSource,
    /unsupported managed OpenClaw runtime id \{\} for install key \{\}/,
  );
  assert.doesNotMatch(
    openclawRuntimeSource,
    /managed OpenClaw runtime install key \{\} does not match manifest key \{\}/,
  );
  assert.doesNotMatch(openclawRuntimeSource, /managed OpenClaw runtime install/);

  assert.match(
    openclawWorkbenchSource,
    /provider configured through the built-in OpenClaw runtime\./,
  );
  assert.match(openclawWorkbenchSource, /"Built-in OpenClaw"\.to_string\(\)/);
  assert.match(openclawWorkbenchSource, /"OpenClaw configuration file\."/);
  assert.match(openclawWorkbenchSource, /Cron run log for an OpenClaw task\./);
  assert.doesNotMatch(openclawWorkbenchSource, /managed OpenClaw runtime/);
  assert.doesNotMatch(openclawWorkbenchSource, /Managed OpenClaw/);

  assert.match(runtimeSnapshotSource, /OpenClaw config file could not be parsed:/);
  assert.match(runtimeSnapshotSource, /Local AI proxy is serving OpenClaw traffic at/);
  assert.doesNotMatch(runtimeSnapshotSource, /Managed OpenClaw config could not be parsed:/);
  assert.doesNotMatch(runtimeSnapshotSource, /managed OpenClaw traffic/);
});

runTest('public workbench diagnostics use OpenClaw wording across browser, host, and startup surfaces', () => {
  const webStudioSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/webStudio.ts',
  );
  const hostedStudioSource = read(
    'packages/sdkwork-claw-host-studio/src-host/src/lib.rs',
  );
  const openclawWorkbenchSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio/openclaw_workbench.rs',
  );
  const startupEvidenceSource = read(
    'scripts/release/smoke-desktop-startup-evidence.mjs',
  );
  const supervisorSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/supervisor.rs',
  );
  const internalCliSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/internal_cli.rs',
  );

  assert.match(webStudioSource, /OpenClaw workspace memory for the browser-backed workbench\./);
  assert.match(webStudioSource, /Pinned workspace memory for the OpenClaw browser workbench\./);
  assert.match(webStudioSource, /Primary OpenClaw workspace agent\./);
  assert.match(webStudioSource, /Coordinate OpenClaw workbench activity\./);
  assert.match(webStudioSource, /Edit OpenClaw workspace files from the browser\./);
  assert.match(
    webStudioSource,
    /Browser fallback projects an OpenClaw workbench snapshot, but lifecycle control stays unavailable until a native host exposes a real controller\./,
  );
  assert.match(
    webStudioSource,
    /OpenClaw browser workbench persists this capability locally when native adapters are unavailable\./,
  );
  assert.match(
    webStudioSource,
    /OpenClaw workspace files are persisted through the browser workbench state\./,
  );
  assert.match(
    webStudioSource,
    /OpenClaw memory entries are derived from browser-persisted workspace notes\./,
  );
  assert.match(
    webStudioSource,
    /OpenClaw task definitions and execution history are persisted through the browser workbench state\./,
  );
  assert.match(
    webStudioSource,
    /OpenClaw tool metadata is projected from the browser workbench state\./,
  );
  assert.match(
    webStudioSource,
    /OpenClaw provider and model selections are persisted through the browser workbench state\./,
  );
  assert.match(webStudioSource, /Browser-backed OpenClaw channel\./);
  assert.match(webStudioSource, /function isBuiltInOpenClawWorkbenchInstance/);
  assert.match(webStudioSource, /function readBuiltInOpenClawWorkbench/);
  assert.match(webStudioSource, /function updateBuiltInOpenClawWorkbench/);
  assert.match(webStudioSource, /function removeBuiltInOpenClawWorkbench/);
  assert.match(webStudioSource, /function synchronizeBuiltInOpenClawWorkbench/);
  assert.doesNotMatch(webStudioSource, /Managed OpenClaw/);
  assert.doesNotMatch(webStudioSource, /managed OpenClaw/);
  assert.doesNotMatch(webStudioSource, /Managed browser-backed OpenClaw channel\./);
  assert.doesNotMatch(webStudioSource, /function isManagedOpenClawWorkbenchInstance/);
  assert.doesNotMatch(webStudioSource, /function readManagedOpenClawWorkbench/);
  assert.doesNotMatch(webStudioSource, /function updateManagedOpenClawWorkbench/);
  assert.doesNotMatch(webStudioSource, /function removeManagedOpenClawWorkbench/);
  assert.doesNotMatch(webStudioSource, /function synchronizeManagedOpenClawWorkbench/);

  assert.match(hostedStudioSource, /Primary OpenClaw workspace agent\./);
  assert.match(hostedStudioSource, /Coordinate OpenClaw workbench activity\./);
  assert.match(hostedStudioSource, /Create and run OpenClaw scheduled tasks\./);
  assert.match(hostedStudioSource, /Edit OpenClaw workspace files from the canonical host API\./);
  assert.match(hostedStudioSource, /Primary agent instructions for the OpenClaw workspace\./);
  assert.match(hostedStudioSource, /Pinned workspace memory for the OpenClaw workbench\./);
  assert.match(hostedStudioSource, /OpenClaw runtime configuration snapshot\./);
  assert.match(hostedStudioSource, /fn is_built_in_local_openclaw_instance\(instance: &Value\) -> bool/);
  assert.match(hostedStudioSource, /fn is_openclaw_workbench_instance\(instance: &Value\) -> bool/);
  assert.match(
    hostedStudioSource,
    /OpenClaw workspace memory for the canonical host workbench\./,
  );
  assert.match(
    openclawWorkbenchSource,
    /integration configured through the built-in OpenClaw config file\./,
  );
  assert.doesNotMatch(hostedStudioSource, /Primary managed OpenClaw workspace agent\./);
  assert.doesNotMatch(hostedStudioSource, /Coordinate managed OpenClaw workbench activity\./);
  assert.doesNotMatch(hostedStudioSource, /Create and run managed OpenClaw scheduled tasks\./);
  assert.doesNotMatch(
    hostedStudioSource,
    /Edit managed OpenClaw workspace files from the canonical host API\./,
  );
  assert.doesNotMatch(
    hostedStudioSource,
    /Primary agent instructions for the managed OpenClaw workspace\./,
  );
  assert.doesNotMatch(
    hostedStudioSource,
    /Pinned workspace memory for the managed OpenClaw workbench\./,
  );
  assert.doesNotMatch(hostedStudioSource, /Managed OpenClaw runtime configuration snapshot\./);
  assert.doesNotMatch(hostedStudioSource, /fn is_built_in_local_managed_openclaw_instance\(/);
  assert.doesNotMatch(hostedStudioSource, /fn is_managed_openclaw_workbench_instance\(/);
  assert.doesNotMatch(
    hostedStudioSource,
    /Managed OpenClaw workspace memory for the canonical host workbench\./,
  );
  assert.doesNotMatch(
    openclawWorkbenchSource,
    /integration managed by the built-in OpenClaw configuration\./,
  );

  assert.match(
    startupEvidenceSource,
    /desktop startup evidence preserved the built-in OpenClaw instance projection/,
  );
  assert.match(
    startupEvidenceSource,
    /desktop startup evidence skipped built-in OpenClaw instance checks because package profile excludes openclaw/,
  );
  assert.doesNotMatch(
    startupEvidenceSource,
    /desktop startup evidence preserved the managed built-in instance projection/,
  );
  assert.doesNotMatch(
    startupEvidenceSource,
    /desktop startup evidence skipped managed OpenClaw instance checks because package profile excludes openclaw/,
  );

  assert.match(supervisorSource, /OpenClaw gateway on 127\.0\.0\.1:\{\} is not ready \(\{\}\)/);
  assert.doesNotMatch(supervisorSource, /managed OpenClaw gateway on 127\.0\.0\.1:\{\} is not ready \(\{\}\)/);

  assert.match(internalCliSource, /kernel host lost the OpenClaw gateway on 127\.0\.0\.1:\{\}/);
  assert.doesNotMatch(internalCliSource, /kernel host lost the managed OpenClaw gateway on 127\.0\.0\.1:\{\}/);
});

runTest('built-in OpenClaw test fixtures use built-in naming instead of managed-primary labels', () => {
  const source = [
    'packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts',
    'packages/sdkwork-claw-desktop/src/desktop/desktopHostedBridge.test.ts',
    'packages/sdkwork-claw-desktop/src/desktop/builtInOpenClawInstanceSelection.test.ts',
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/desktopStartupEvidence.test.ts',
    'packages/sdkwork-claw-desktop/src-tauri/src/commands/studio_commands.rs',
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/studio.rs',
    'packages/sdkwork-claw-host-studio/src-host/src/lib.rs',
  ].map((relPath) => read(relPath)).join('\n');

  assert.match(source, /Built-In OpenClaw Primary/);
  assert.match(source, /Built-In OpenClaw Primary Renamed/);
  assert.match(source, /Custom Local OpenClaw/);
  assert.doesNotMatch(source, /Managed OpenClaw Primary/);
  assert.doesNotMatch(source, /Managed OpenClaw Primary Renamed/);
  assert.doesNotMatch(source, /Custom Local Managed OpenClaw/);
});

runTest('hosted conversation snapshots do not override built-in OpenClaw runtime authority when the built-in runtime is unavailable', () => {
  const serverStudioSource = read(
    'packages/sdkwork-claw-host-studio/src-host/src/lib.rs',
  );
  const studioConversationGatewaySource = read(
    'packages/sdkwork-claw-chat/src/store/studioConversationGateway.ts',
  );
  const authoritativeRouteSource = read(
    'packages/sdkwork-claw-chat/src/services/store/authoritativeInstanceChatRoute.ts',
  );

  assert.match(
    serverStudioSource,
    /does not expose a managed workbench/,
  );
  assert.match(
    authoritativeRouteSource,
    /studio\.getInstanceDetail\(instanceId\)\.catch\(\(\) => null\)/,
  );
  assert.match(
    authoritativeRouteSource,
    /detail\?\.instance\s*\?\?\s*\(await studio\.getInstance\(instanceId\)\)/,
  );
  assert.match(
    studioConversationGatewaySource,
    /return \[\];/,
  );
  assert.match(
    studioConversationGatewaySource,
    /Instance-scoped kernel chat sessions are not persisted through the studio conversation store/,
  );
  assert.doesNotMatch(
    studioConversationGatewaySource,
    /export async function listInstanceConversations\(instanceId: string\): Promise<ChatSession\[]> \{\s*const records = await studio\.listConversations\(instanceId\);/,
  );
});

runTest('server readiness and public workbench routes stay bound to live runtime authority', () => {
  const healthRouteSource = read(
    'packages/sdkwork-claw-server/src-host/src/http/routes/health.rs',
  );
  const apiPublicSource = read(
    'packages/sdkwork-claw-server/src-host/src/http/routes/api_public.rs',
  );
  const manageOpenClawRouteSource = read(
    'packages/sdkwork-claw-server/src-host/src/http/routes/manage_openclaw.rs',
  );
  const openapiSource = read(
    'packages/sdkwork-claw-server/src-host/src/http/routes/openapi.rs',
  );
  const controlPlaneSource = read(
    'packages/sdkwork-claw-host-core/src-host/src/openclaw_control_plane.rs',
  );
  const hostStudioSource = read(
    'packages/sdkwork-claw-host-studio/src-host/src/lib.rs',
  );
  const serverMainSource = read(
    'packages/sdkwork-claw-server/src-host/src/main.rs',
  );

  assert.match(
    healthRouteSource,
    /manage_openclaw_provider[\s\S]*get_runtime\(updated_at\)/,
  );
  assert.match(
    healthRouteSource,
    /manage_openclaw_provider[\s\S]*get_gateway\(updated_at\)/,
  );
  assert.match(
    healthRouteSource,
    /StatusCode::SERVICE_UNAVAILABLE/,
  );
  assert.match(
    apiPublicSource,
    /studio_public_api_workbench_unavailable/,
  );
  assert.match(
    apiPublicSource,
    /does not expose a managed workbench/,
  );
  assert.match(
    apiPublicSource,
    /could not reach the OpenClaw gateway for studio instance/,
  );
  assert.match(
    apiPublicSource,
    /does not expose an openclaw gateway/,
  );
  assert.doesNotMatch(
    apiPublicSource,
    /could not reach the managed OpenClaw gateway for studio instance/,
  );
  assert.doesNotMatch(
    apiPublicSource,
    /does not expose a managed openclaw gateway/,
  );
  assert.match(
    manageOpenClawRouteSource,
    /The OpenClaw runtime projection is not available for this host shell\./,
  );
  assert.match(
    manageOpenClawRouteSource,
    /The OpenClaw gateway projection is not available for this host shell\./,
  );
  assert.match(
    manageOpenClawRouteSource,
    /The OpenClaw gateway is not available for this host shell\./,
  );
  assert.doesNotMatch(
    manageOpenClawRouteSource,
    /The managed OpenClaw runtime projection is not available for this host shell\./,
  );
  assert.doesNotMatch(
    manageOpenClawRouteSource,
    /The managed OpenClaw gateway projection is not available for this host shell\./,
  );
  assert.doesNotMatch(
    manageOpenClawRouteSource,
    /The managed OpenClaw gateway is not available for this host shell\./,
  );
  assert.match(
    openapiSource,
    /Invoke one OpenClaw gateway through the active host shell/,
  );
  assert.match(
    openapiSource,
    /The OpenClaw gateway is not available for the requested studio instance\./,
  );
  assert.doesNotMatch(
    openapiSource,
    /Invoke one managed OpenClaw gateway through the active host shell/,
  );
  assert.doesNotMatch(
    openapiSource,
    /The managed OpenClaw gateway is not available for the requested studio instance\./,
  );
  assert.match(
    controlPlaneSource,
    /openclaw gateway is not ready/,
  );
  assert.doesNotMatch(
    controlPlaneSource,
    /managed OpenClaw gateway is not ready/,
  );
  assert.match(
    hostStudioSource,
    /does not expose an OpenClaw gateway/,
  );
  assert.doesNotMatch(
    hostStudioSource,
    /does not expose a managed OpenClaw gateway/,
  );
  assert.match(
    serverMainSource,
    /public_studio_workbench_mutation_routes_reject_built_in_mutations_without_live_runtime_authority/,
  );
});

runTest('sdkwork hosts persist app language through a host callback while the shared runtime bridge exposes the desktop command', () => {
  const shellProvidersSource = read(
    'packages/sdkwork-claw-shell/src/application/providers/AppProviders.tsx',
  );
  const shellLanguageManagerSource = read(
    'packages/sdkwork-claw-shell/src/application/providers/LanguageManager.tsx',
  );
  const desktopBootstrapAppSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/bootstrap/DesktopBootstrapApp.tsx',
  );
  const desktopBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts',
  );
  const webRuntimeSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/webRuntime.ts',
  );
  const runtimeContractSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/runtime.ts',
  );

  assert.match(runtimeContractSource, /setAppLanguage\(language: RuntimeLanguagePreference\)/);
  assert.match(shellProvidersSource, /onLanguagePreferenceChange\?:/);
  assert.match(shellLanguageManagerSource, /onLanguagePreferenceChange\?:/);
  assert.match(shellLanguageManagerSource, /onLanguagePreferenceChange\?\.\(languagePreference\)/);
  assert.doesNotMatch(shellLanguageManagerSource, /getRuntimePlatform\(\)\.setAppLanguage\(languagePreference\)/);
  assert.match(
    desktopBootstrapAppSource,
    /import \{[\s\S]*getAppInfo,[\s\S]*probeDesktopHostedRuntimeReadiness,[\s\S]*setAppLanguage,[\s\S]*\} from '\.\.\/tauriBridge';/,
  );
  assert.match(desktopBootstrapAppSource, /const handleLanguagePreferenceChange = useEffectEvent\(/);
  assert.match(desktopBootstrapAppSource, /void setAppLanguage\(languagePreference\);/);
  assert.match(desktopBridgeSource, /export async function setAppLanguage/);
  assert.match(desktopBridgeSource, /DESKTOP_COMMANDS\.setAppLanguage/);
  assert.match(
    desktopBridgeSource,
    /export async function probeDesktopHostedRuntimeReadiness\(\s*options\?: \{/,
  );
  assert.match(
    desktopBridgeSource,
    /retryDesktopHostRuntimeOperation\(\{[\s\S]*probeStaticDesktopHostedRuntimeReadiness\(/,
  );
  assert.match(webRuntimeSource, /async setAppLanguage\(_language: RuntimeLanguagePreference\): Promise<void> \{\}/);
});

runTest('sdkwork-claw-desktop removes deprecated installer commands, metadata, and bundled registry resources from the desktop bridge', () => {
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const catalogSource = read('packages/sdkwork-claw-desktop/src/desktop/catalog.ts');
  const commandsMod = read('packages/sdkwork-claw-desktop/src-tauri/src/commands/mod.rs');
  const bootstrap = read('packages/sdkwork-claw-desktop/src-tauri/src/app/bootstrap.rs');
  const layoutSource = read('packages/sdkwork-claw-desktop/src-tauri/src/framework/layout.rs');
  const tauriConfig = read('packages/sdkwork-claw-desktop/src-tauri/tauri.conf.json');
  const tauriMacosConfig = read('packages/sdkwork-claw-desktop/src-tauri/tauri.macos.conf.json');
  const tauriBundleOverlay = readGeneratedTauriBundleOverlay();
  const componentRegistry = read(
    'packages/sdkwork-claw-desktop/src-tauri/foundation/components/component-registry.json',
  );
  const serviceDefaults = read(
    'packages/sdkwork-claw-desktop/src-tauri/foundation/components/service-defaults.json',
  );
  const componentLibrarySource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/componentLibrary.ts',
  );
  const componentContractsSource = read(
    'packages/sdkwork-claw-infrastructure/src/platform/contracts/components.ts',
  );

  assert.ok(!exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/run_install.rs'));
  assert.ok(!exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/run_uninstall.rs'));
  assert.ok(!exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/install_catalog.rs'));
  assert.ok(!exists('packages/sdkwork-claw-desktop/src-tauri/src/commands/install_progress.rs'));
  assert.doesNotMatch(catalogSource, /listInstallCatalog:\s*'list_install_catalog'/);
  assert.doesNotMatch(catalogSource, /inspectInstall:\s*'inspect_install'/);
  assert.doesNotMatch(catalogSource, /runInstallDependencies:\s*'run_install_dependencies'/);
  assert.doesNotMatch(catalogSource, /runInstall:\s*'run_install'/);
  assert.doesNotMatch(catalogSource, /runUninstall:\s*'run_uninstall'/);
  assert.doesNotMatch(catalogSource, /installProgress:\s*'[^']*installer[^']*'/i);
  assert.doesNotMatch(bridgeSource, /invokeDesktopCommand<InstallResult>\(\s*DESKTOP_COMMANDS\.runInstall/);
  assert.doesNotMatch(bridgeSource, /invokeDesktopCommand<InstallAssessmentResult>\(\s*DESKTOP_COMMANDS\.inspectInstall/);
  assert.doesNotMatch(bridgeSource, /invokeDesktopCommand<InstallDependencyResult>\(\s*DESKTOP_COMMANDS\.runInstallDependencies/);
  assert.doesNotMatch(bridgeSource, /invokeDesktopCommand<UninstallResult>\(\s*DESKTOP_COMMANDS\.runUninstall/);
  assert.doesNotMatch(bridgeSource, /listenDesktopEvent<InstallProgressEvent>\(\s*DESKTOP_EVENTS\.installProgress/);
  assert.doesNotMatch(commandsMod, /pub mod run_install;/);
  assert.doesNotMatch(commandsMod, /pub mod run_uninstall;/);
  assert.doesNotMatch(commandsMod, /pub mod install_catalog;/);
  assert.doesNotMatch(commandsMod, /pub mod install_progress;/);
  assert.doesNotMatch(bootstrap, /commands::install_catalog::list_install_catalog/);
  assert.doesNotMatch(bootstrap, /commands::run_install::inspect_install/);
  assert.doesNotMatch(bootstrap, /commands::run_install::run_install_dependencies/);
  assert.doesNotMatch(bootstrap, /commands::run_install::run_install/);
  assert.doesNotMatch(bootstrap, /commands::run_uninstall::run_uninstall/);
  assert.doesNotMatch(
    layoutSource,
    new RegExp(['LEGACY', 'OPENCLAW', 'INSTALL', 'RECORDS', 'HOME', 'NAME'].join('_')),
  );
  assert.doesNotMatch(tauriConfig, /vendor\/[^/]+\/registry\//);
  assert.doesNotMatch(tauriMacosConfig, /vendor\/[^/]+\/registry\//);
  assert.doesNotMatch(tauriBundleOverlay, /vendor\/[^/]+\/registry\//);
  assert.doesNotMatch(componentRegistry, /"id":\s*"[^"]*installer[^"]*"/i);
  assert.doesNotMatch(componentRegistry, /modules\/[^/]*installer[^/]*\/current/i);
  assert.doesNotMatch(serviceDefaults, /"embeddedComponentIds"\s*:\s*\[[^\]]*installer/i);
  assert.doesNotMatch(componentLibrarySource, /'[^']*installer[^']*'/i);
  assert.doesNotMatch(componentContractsSource, /\|\s*'[^']*installer[^']*'/i);
});

runTest('sdkwork-claw-desktop keeps browser mocks out of desktop business bridges', () => {
  const bridgeSource = read('packages/sdkwork-claw-desktop/src/desktop/tauriBridge.ts');
  const componentsBridgeSource = read(
    'packages/sdkwork-claw-desktop/src/desktop/componentsBridge.ts',
  );

  assert.doesNotMatch(bridgeSource, /WebKernelPlatform/);
  assert.doesNotMatch(bridgeSource, /WebStoragePlatform/);
  assert.doesNotMatch(bridgeSource, /WebStudioPlatform/);
  assert.doesNotMatch(
    bridgeSource,
    /studioListInstances[\s\S]*webStudioPlatform\.listInstances/,
  );
  assert.doesNotMatch(
    bridgeSource,
    /storageGetText[\s\S]*webStoragePlatform\.getText/,
  );
  assert.doesNotMatch(
    bridgeSource,
    /ensureDesktopKernelRunning[\s\S]*webKernelPlatform\.ensureRunning/,
  );
  assert.doesNotMatch(
    componentsBridgeSource,
    /webComponentPlatform\.(listComponents|controlComponent)/,
  );
});

runTest('sdkwork-claw-desktop keeps generic component defaults separate from bundled kernel versions', () => {
  const componentDefaultsSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/components.rs',
  );
  const componentResourcesSource = read(
    'packages/sdkwork-claw-desktop/src-tauri/src/framework/services/components.rs',
  );

  assert.doesNotMatch(
    componentDefaultsSource,
    /id:\s*"openclaw"\.to_string\(\)|id:\s*"zeroclaw"\.to_string\(\)|id:\s*"ironclaw"\.to_string\(\)/,
  );
  assert.doesNotMatch(componentResourcesSource, /source_component_resource_dir\(\)/);
  assert.match(componentResourcesSource, /bundle_manifest:/);
  assert.match(
    componentResourcesSource,
    /filter\(\|kernel_id\| included_kernel_ids\.contains\(kernel_id\)\)/,
  );
  assert.match(
    componentResourcesSource,
    /if normalized\.is_empty\(\) \{\s*normalized = included_kernel_ids\.clone\(\);\s*\}/,
  );
});

await runAsyncTest('sdkwork-claw-desktop recognizes Tauri v2 runtimes even when withGlobalTauri is disabled', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  const runtimeModule = await import('../packages/sdkwork-claw-desktop/src/desktop/runtime.ts');

  try {
    (globalThis as { window?: unknown }).window = {
      __TAURI_INTERNALS__: {
        invoke() {},
        transformCallback() {
          return 1;
        },
        unregisterCallback() {},
        convertFileSrc() {
          return '';
        },
      },
    };
    delete (globalThis as { isTauri?: unknown }).isTauri;

    assert.equal(
      runtimeModule.isTauriRuntime(),
      true,
      'expected the desktop runtime probe to recognize __TAURI_INTERNALS__',
    );

    (globalThis as { window?: unknown }).window = {};

    assert.equal(
      runtimeModule.isTauriRuntime(),
      false,
      'expected plain web previews without Tauri globals to stay on the web fallback',
    );
  } finally {
    if (typeof previousWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (typeof previousIsTauri === 'undefined') {
      delete (globalThis as { isTauri?: unknown }).isTauri;
    } else {
      (globalThis as { isTauri?: unknown }).isTauri = previousIsTauri;
    }
  }
});

await runAsyncTest('sdkwork-claw-desktop waits for a late Tauri runtime before invoking the desktop bridge', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  const runtimeModule = await import('../packages/sdkwork-claw-desktop/src/desktop/runtime.ts');
  let installHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    let desktopCalls = 0;
    (globalThis as { window?: unknown }).window = {};
    delete (globalThis as { isTauri?: unknown }).isTauri;

    installHandle = setTimeout(() => {
      const runtimeWindow = ((globalThis as { window?: Record<string, unknown> }).window ??
        {}) as Record<string, unknown>;
      runtimeWindow.__TAURI_INTERNALS__ = {
        invoke(command: string) {
          desktopCalls += 1;
          assert.equal(command, 'studio_list_instances');
          return Promise.resolve([
            {
              id: 'managed-openclaw-primary',
              name: 'Built-In OpenClaw Primary',
              description: 'Packaged local OpenClaw kernel managed by Claw Studio.',
              runtimeKind: 'openclaw',
              deploymentMode: 'local-managed',
              transportKind: 'openclawGatewayWs',
              status: 'online',
              isBuiltIn: true,
              isDefault: true,
              iconType: 'server',
              version: 'bundled',
              typeLabel: 'Built-In OpenClaw',
              host: '127.0.0.1',
              port: 18796,
              baseUrl: 'http://127.0.0.1:18796',
              websocketUrl: 'ws://127.0.0.1:18796',
              cpu: 0,
              memory: 0,
              totalMemory: 'Unknown',
              uptime: '-',
              capabilities: ['chat', 'health'],
              storage: {
                profileId: 'default-local',
                provider: 'localFile',
                namespace: 'claw-studio',
                database: null,
                connectionHint: null,
                endpoint: null,
              },
              config: {
                port: '18796',
                sandbox: true,
                autoUpdate: true,
                logLevel: 'info',
                corsOrigins: '*',
                workspacePath: null,
                baseUrl: 'http://127.0.0.1:18796',
                websocketUrl: 'ws://127.0.0.1:18796',
                authToken: 'studio-token',
              },
              createdAt: 1,
              updatedAt: 1,
              lastSeenAt: 1,
            },
          ]);
        },
      };
      (globalThis as { window?: unknown }).window = runtimeWindow;
    }, 15);

    const instances = await runtimeModule.invokeDesktopCommand<any[]>(
      'studio_list_instances',
      undefined,
      { operation: 'studio.listInstances' },
    );

    assert.equal(desktopCalls, 1);
    assert.equal(instances[0]?.port, 18796);
    assert.equal(instances[0]?.websocketUrl, 'ws://127.0.0.1:18796');
    assert.equal(instances[0]?.config.authToken, 'studio-token');
  } finally {
    if (installHandle) {
      clearTimeout(installHandle);
    }

    if (typeof previousWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (typeof previousIsTauri === 'undefined') {
      delete (globalThis as { isTauri?: unknown }).isTauri;
    } else {
      (globalThis as { isTauri?: unknown }).isTauri = previousIsTauri;
    }
  }
});

await runAsyncTest('sdkwork-claw-desktop strict desktop bridge rejects when Tauri runtime is unavailable', async () => {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const previousIsTauri = (globalThis as { isTauri?: unknown }).isTauri;
  const runtimeModule = await import('../packages/sdkwork-claw-desktop/src/desktop/runtime.ts');

  try {
    (globalThis as { window?: unknown }).window = {};
    delete (globalThis as { isTauri?: unknown }).isTauri;

    await assert.rejects(
      runtimeModule.runDesktopOnly('studio.listInstances', async () => []),
      (error: unknown) => {
        assert.equal(error instanceof runtimeModule.DesktopBridgeError, true);
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).operation,
          'studio.listInstances',
        );
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).runtime,
          'web',
        );
        assert.match(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).message,
          /Tauri runtime is unavailable/,
        );
        return true;
      },
    );

    await assert.rejects(
      runtimeModule.runDesktopOnly('storage.getText', async () => ({
        profileId: 'default-local',
        namespace: 'claw-studio',
        key: 'openclaw-version',
        value: null,
      })),
      (error: unknown) => {
        assert.equal(error instanceof runtimeModule.DesktopBridgeError, true);
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).operation,
          'storage.getText',
        );
        return true;
      },
    );

    await assert.rejects(
      runtimeModule.runDesktopOnly('components.list', async () => ({
        defaultStartupComponentIds: [],
        components: [],
      })),
      (error: unknown) => {
        assert.equal(error instanceof runtimeModule.DesktopBridgeError, true);
        assert.equal(
          (error as InstanceType<typeof runtimeModule.DesktopBridgeError>).operation,
          'components.list',
        );
        return true;
      },
    );
  } finally {
    if (typeof previousWindow === 'undefined') {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previousWindow;
    }

    if (typeof previousIsTauri === 'undefined') {
      delete (globalThis as { isTauri?: unknown }).isTauri;
    } else {
      (globalThis as { isTauri?: unknown }).isTauri = previousIsTauri;
    }
  }
});

await runAsyncTest('sdkwork-claw-infrastructure shares the configured platform bridge across duplicate module instances', async () => {
  const registryUrl = pathToFileURL(
    path.join(root, 'packages/sdkwork-claw-infrastructure/src/platform/registry.ts'),
  ).href;
  const registryCopyA = await import(`${registryUrl}?bridge-copy=a`);
  const registryCopyB = await import(`${registryUrl}?bridge-copy=b`);
  const originalBridge = registryCopyA.getPlatformBridge();
  const sharedInstaller = {
    async listInstallCatalog() {
      return [];
    },
    async inspectInstall() {
      return {
        ready: true,
        installStatus: 'not-installed',
        issues: [],
        dependencies: [],
        installations: [],
      };
    },
    async runInstallDependencies() {
      return { success: true, dependencyReports: [] };
    },
    async runInstall() {
      return { success: true, summary: '', stageReports: [], artifactReports: [] };
    },
    async runUninstall() {
      return { success: true, targetReports: [] };
    },
    async subscribeInstallProgress() {
      return () => {};
    },
  };

  try {
    registryCopyA.configurePlatformBridge({
      installer: sharedInstaller,
    });

    assert.equal(
      registryCopyB.getInstallerPlatform(),
      sharedInstaller,
      'expected duplicate infrastructure module instances to observe the same installer bridge',
    );
  } finally {
    registryCopyA.configurePlatformBridge(originalBridge);
  }
});
