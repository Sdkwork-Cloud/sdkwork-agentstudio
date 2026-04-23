import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('tauriBridge removes api-router runtime bootstrap helpers while keeping desktop runtime helpers', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const desktopProvidersSource = fs.readFileSync(
    path.join(import.meta.dirname, 'providers', 'DesktopProviders.tsx'),
    'utf8',
  );

  assert.doesNotMatch(tauriBridgeSource, /export async function syncDesktopAuthSession/);
  assert.doesNotMatch(tauriBridgeSource, /export async function clearDesktopAuthSession/);
  assert.doesNotMatch(tauriBridgeSource, /export async function getApiRouterRuntimeStatus/);
  assert.doesNotMatch(tauriBridgeSource, /export async function ensureApiRouterRuntimeStarted/);
  assert.doesNotMatch(tauriBridgeSource, /export async function getApiRouterAdminBootstrapSession/);
  assert.match(tauriBridgeSource, /export async function getDesktopKernelStatus/);
  assert.match(tauriBridgeSource, /export async function ensureDesktopKernelRunning/);
  assert.match(tauriBridgeSource, /export async function restartDesktopKernel/);
  assert.match(tauriBridgeSource, /export async function testLocalAiProxyRoute/);
  assert.match(tauriBridgeSource, /export async function listLocalAiProxyRequestLogs/);
  assert.match(tauriBridgeSource, /export async function listLocalAiProxyMessageLogs/);
  assert.match(tauriBridgeSource, /export async function updateLocalAiProxyMessageCapture/);
  assert.match(tauriBridgeSource, /from '\.\/studioCommandCompat';/);
  assert.match(tauriBridgeSource, /getStatus:\s*getDesktopKernelStatus/);
  assert.match(tauriBridgeSource, /ensureRunning:\s*ensureDesktopKernelRunning/);
  assert.match(tauriBridgeSource, /restart:\s*restartDesktopKernel/);
  assert.match(tauriBridgeSource, /testLocalAiProxyRoute:\s*\(routeId\)\s*=>\s*testLocalAiProxyRoute\(routeId\)/);
  assert.match(tauriBridgeSource, /listLocalAiProxyRequestLogs:\s*\(query\)\s*=>\s*listLocalAiProxyRequestLogs\(query\)/);
  assert.match(tauriBridgeSource, /listLocalAiProxyMessageLogs:\s*\(query\)\s*=>\s*listLocalAiProxyMessageLogs\(query\)/);
  assert.match(tauriBridgeSource, /updateLocalAiProxyMessageCapture:\s*\(enabled\)\s*=>\s*updateLocalAiProxyMessageCapture\(enabled\)/);
  assert.match(tauriBridgeSource, /DESKTOP_COMMANDS\.testLocalAiProxyRoute/);
  assert.match(tauriBridgeSource, /DESKTOP_COMMANDS\.listLocalAiProxyRequestLogs/);
  assert.match(tauriBridgeSource, /DESKTOP_COMMANDS\.listLocalAiProxyMessageLogs/);
  assert.match(tauriBridgeSource, /DESKTOP_COMMANDS\.updateLocalAiProxyMessageCapture/);
  assert.doesNotMatch(desktopProvidersSource, /DesktopAuthSessionBridge/);
});

test('tauriBridge isolates direct studio Tauri command compatibility in a dedicated compat module', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const compatSource = fs.readFileSync(
    path.join(import.meta.dirname, 'studioCommandCompat.ts'),
    'utf8',
  );
  const desktopIndexSource = fs.readFileSync(
    path.join(desktopRoot, 'src/index.ts'),
    'utf8',
  );

  assert.match(compatSource, /export interface DesktopLegacyStudioCompatApi/);
  assert.match(compatSource, /export const desktopLegacyStudioCompatApi/);
  assert.doesNotMatch(compatSource, /from '@sdkwork\/claw-types'/);
  assert.match(
    compatSource,
    /KernelChatAgentProfile,[\s\S]*KernelChatMessage,[\s\S]*KernelChatRun,[\s\S]*KernelChatSession,[\s\S]*from '@sdkwork\/claw-infrastructure'/,
  );
  assert.match(compatSource, /DESKTOP_COMMANDS\.studioListInstances/);
  assert.match(compatSource, /DESKTOP_COMMANDS\.studioInvokeOpenClawGateway/);
  assert.match(compatSource, /DESKTOP_COMMANDS\.studioCreateInstanceTask/);
  assert.match(compatSource, /DESKTOP_COMMANDS\.studioUpdateInstanceTask/);
  assert.match(compatSource, /DESKTOP_COMMANDS\.studioListConversations/);
  assert.match(tauriBridgeSource, /export \{[\s\S]*\} from '\.\/studioCommandCompat';/);
  assert.match(tauriBridgeSource, /desktopLegacyStudioCompatApi/);
  assert.match(tauriBridgeSource, /studioListInstances/);
  assert.match(tauriBridgeSource, /invokeOpenClawGateway/);
  assert.match(tauriBridgeSource, /studioCreateInstanceTask/);
  assert.match(tauriBridgeSource, /studioUpdateInstanceTask/);
  assert.match(tauriBridgeSource, /studioListConversations/);
  assert.doesNotMatch(tauriBridgeSource, /export async function studioListInstances/);
  assert.doesNotMatch(tauriBridgeSource, /export async function invokeOpenClawGateway/);
  assert.doesNotMatch(tauriBridgeSource, /export async function studioCreateInstanceTask/);
  assert.doesNotMatch(tauriBridgeSource, /export async function studioUpdateInstanceTask/);
  assert.doesNotMatch(tauriBridgeSource, /export async function studioListConversations/);
  assert.match(desktopIndexSource, /desktopLegacyStudioCompatApi/);
});

test('tauriBridge exposes authoritative kernel chat studio commands for local kernel-backed chat runtimes', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const infrastructureRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-infrastructure/src');
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const compatSource = fs.readFileSync(
    path.join(import.meta.dirname, 'studioCommandCompat.ts'),
    'utf8',
  );
  const studioContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/studio.ts'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );
  const studioCommandsSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/commands/studio_commands.rs'),
    'utf8',
  );

  assert.match(studioContractSource, /listKernelChatSessions\?\(instanceId: string\): Promise<KernelChatSession\[]>;/);
  assert.match(studioContractSource, /createKernelChatSession\?\(\s*input: StudioCreateKernelChatSessionInput,\s*\): Promise<KernelChatSession>;/);
  assert.match(studioContractSource, /startKernelChatRun\?\(\s*input: StudioStartKernelChatRunInput,\s*\): Promise<KernelChatRun>;/);
  assert.match(studioContractSource, /listKernelChatRuns\?\(\s*instanceId: string,\s*sessionId: string,\s*\): Promise<KernelChatRun\[]>;/);
  assert.match(studioContractSource, /getKernelChatRun\?\(\s*instanceId: string,\s*sessionId: string,\s*runId: string,\s*\): Promise<KernelChatRun \| null>;/);
  assert.match(studioContractSource, /loadKernelChatMessages\?\(\s*instanceId: string,\s*sessionId: string,\s*\): Promise<KernelChatMessage\[]>;/);
  assert.match(catalogSource, /studioListKernelChatSessions:\s*'studio_list_kernel_chat_sessions'/);
  assert.match(catalogSource, /studioCreateKernelChatSession:\s*'studio_create_kernel_chat_session'/);
  assert.match(catalogSource, /studioStartKernelChatRun:\s*'studio_start_kernel_chat_run'/);
  assert.match(catalogSource, /studioListKernelChatRuns:\s*'studio_list_kernel_chat_runs'/);
  assert.match(catalogSource, /studioGetKernelChatRun:\s*'studio_get_kernel_chat_run'/);
  assert.match(catalogSource, /studioLoadKernelChatMessages:\s*'studio_load_kernel_chat_messages'/);
  assert.match(compatSource, /listKernelChatSessions\(instanceId: string\): Promise<KernelChatSession\[]>;/);
  assert.match(compatSource, /createKernelChatSession\(input: StudioCreateKernelChatSessionInput\): Promise<KernelChatSession>;/);
  assert.match(compatSource, /startKernelChatRun\(input: StudioStartKernelChatRunInput\): Promise<KernelChatRun>;/);
  assert.match(compatSource, /listKernelChatRuns\(instanceId: string, sessionId: string\): Promise<KernelChatRun\[]>;/);
  assert.match(compatSource, /getKernelChatRun\(\s*instanceId: string,\s*sessionId: string,\s*runId: string,\s*\): Promise<KernelChatRun \| null>;/);
  assert.match(compatSource, /loadKernelChatMessages\(instanceId: string, sessionId: string\): Promise<KernelChatMessage\[]>;/);
  assert.match(tauriBridgeSource, /createDesktopHttpFirstStudioPlatform\(\)/);
  assert.match(tauriBridgeSource, /listKernelChatSessions:/);
  assert.match(tauriBridgeSource, /createKernelChatSession:/);
  assert.match(tauriBridgeSource, /startKernelChatRun:/);
  assert.match(tauriBridgeSource, /listKernelChatRuns:/);
  assert.match(tauriBridgeSource, /getKernelChatRun:/);
  assert.match(tauriBridgeSource, /loadKernelChatMessages:/);
  assert.match(studioCommandsSource, /pub async fn studio_list_kernel_chat_sessions/);
  assert.match(studioCommandsSource, /pub async fn studio_create_kernel_chat_session/);
  assert.match(studioCommandsSource, /pub async fn studio_start_kernel_chat_run/);
  assert.match(studioCommandsSource, /pub async fn studio_list_kernel_chat_runs/);
  assert.match(studioCommandsSource, /pub async fn studio_get_kernel_chat_run/);
  assert.match(studioCommandsSource, /pub async fn studio_load_kernel_chat_messages/);
  assert.match(bootstrapSource, /commands::studio_commands::studio_list_kernel_chat_sessions/);
  assert.match(bootstrapSource, /commands::studio_commands::studio_create_kernel_chat_session/);
  assert.match(bootstrapSource, /commands::studio_commands::studio_start_kernel_chat_run/);
  assert.match(bootstrapSource, /commands::studio_commands::studio_list_kernel_chat_runs/);
  assert.match(bootstrapSource, /commands::studio_commands::studio_get_kernel_chat_run/);
  assert.match(bootstrapSource, /commands::studio_commands::studio_load_kernel_chat_messages/);
});

test('tauriBridge exposes desktop kernel agent creation commands through the studio contract chain', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const infrastructureRoot = path.resolve(
    import.meta.dirname,
    '../../../sdkwork-claw-infrastructure/src',
  );
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const compatSource = fs.readFileSync(
    path.join(import.meta.dirname, 'studioCommandCompat.ts'),
    'utf8',
  );
  const studioContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/studio.ts'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );
  const studioCommandsSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/commands/studio_commands.rs'),
    'utf8',
  );

  assert.match(
    studioContractSource,
    /getKernelAgentCreationCapability\?\(\s*instanceId: string,\s*\): Promise<StudioKernelAgentCreationCapability>;/,
  );
  assert.match(
    studioContractSource,
    /createKernelAgent\?\(\s*input: StudioCreateKernelAgentInput,\s*\): Promise<StudioCreatedKernelAgentRecord>;/,
  );
  assert.match(
    catalogSource,
    /studioGetKernelAgentCreationCapability:\s*'studio_get_kernel_agent_creation_capability'/,
  );
  assert.match(
    catalogSource,
    /studioCreateKernelAgent:\s*'studio_create_kernel_agent'/,
  );
  assert.match(
    compatSource,
    /getKernelAgentCreationCapability\(\s*instanceId: string,\s*\): Promise<StudioKernelAgentCreationCapability>;/,
  );
  assert.match(
    compatSource,
    /createKernelAgent\(\s*input: StudioCreateKernelAgentInput\s*\): Promise<StudioCreatedKernelAgentRecord>;/,
  );
  assert.match(
    compatSource,
    /DESKTOP_COMMANDS\.studioGetKernelAgentCreationCapability/,
  );
  assert.match(compatSource, /DESKTOP_COMMANDS\.studioCreateKernelAgent/);
  assert.match(tauriBridgeSource, /createDesktopHttpFirstStudioPlatform\(\)/);
  assert.match(tauriBridgeSource, /getKernelAgentCreationCapability:/);
  assert.match(tauriBridgeSource, /createKernelAgent:/);
  assert.match(
    studioCommandsSource,
    /pub async fn studio_get_kernel_agent_creation_capability/,
  );
  assert.match(studioCommandsSource, /pub async fn studio_create_kernel_agent/);
  assert.match(
    bootstrapSource,
    /commands::studio_commands::studio_get_kernel_agent_creation_capability/,
  );
  assert.match(bootstrapSource, /commands::studio_commands::studio_create_kernel_agent/);
});

test('tauriBridge exposes manage rollout and internal host platform contract surfaces', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const infrastructureRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-infrastructure/src');
  const manageContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/manage.ts'),
    'utf8',
  );
  const internalContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/internal.ts'),
    'utf8',
  );
  const registrySource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/registry.ts'),
    'utf8',
  );
  const platformIndexSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/index.ts'),
    'utf8',
  );

  assert.match(manageContractSource, /export interface ManageRolloutRecord/);
  assert.match(manageContractSource, /listRollouts\(\): Promise<ManageRolloutListResult>/);
  assert.match(manageContractSource, /export interface ManageRolloutPreview/);
  assert.match(manageContractSource, /previewRollout\(input: PreviewRolloutRequest\)/);
  assert.match(manageContractSource, /startRollout\(rolloutId: string\)/);
  assert.match(internalContractSource, /export interface HostPlatformStatusRecord/);
  assert.match(internalContractSource, /listNodeSessions\(\): Promise<InternalNodeSessionRecord\[]>/);
  assert.match(internalContractSource, /export interface InternalErrorEnvelope/);
  assert.match(internalContractSource, /getHostPlatformStatus\(\): Promise<HostPlatformStatusRecord>/);
  assert.match(catalogSource, /listRollouts:\s*'manage_list_rollouts'/);
  assert.match(catalogSource, /previewRollout:\s*'manage_preview_rollout'/);
  assert.match(catalogSource, /startRollout:\s*'manage_start_rollout'/);
  assert.match(catalogSource, /getHostPlatformStatus:\s*'internal_get_host_platform_status'/);
  assert.match(catalogSource, /listNodeSessions:\s*'internal_list_node_sessions'/);
  assert.match(tauriBridgeSource, /export async function listRollouts/);
  assert.match(tauriBridgeSource, /export async function previewRollout/);
  assert.match(tauriBridgeSource, /export async function startRollout/);
  assert.match(tauriBridgeSource, /export async function getHostPlatformStatus/);
  assert.match(tauriBridgeSource, /export async function listNodeSessions/);
  assert.match(
    tauriBridgeSource,
    /manage:\s*createDesktopHttpFirstManagePlatform\(\),/,
  );
  assert.match(
    tauriBridgeSource,
    /internal:\s*createDesktopHttpFirstInternalPlatform\(\),/,
  );
  assert.match(registrySource, /manage:\s*ManagePlatformAPI;/);
  assert.match(registrySource, /internal:\s*InternalPlatformAPI;/);
  assert.match(registrySource, /export const manage:\s*ManagePlatformAPI/);
  assert.match(registrySource, /export const internal:\s*InternalPlatformAPI/);
  assert.match(platformIndexSource, /ManagePlatformAPI/);
  assert.match(platformIndexSource, /InternalPlatformAPI/);
});

test('tauriBridge routes combined host status and rollout preview through desktop commands backed by host-core wiring', async () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const cargoSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/Cargo.toml'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );
  const studioCommandsSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/commands/studio_commands.rs'),
    'utf8',
  );
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );

  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<HostPlatformStatusRecord>\(\s*DESKTOP_COMMANDS\.getHostPlatformStatus,[\s\S]*operation:\s*'internal\.getHostPlatformStatus'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<ManageRolloutPreview>\(\s*DESKTOP_COMMANDS\.previewRollout,\s*\{\s*input\s*\},[\s\S]*operation:\s*'manage\.previewRollout'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<ManageRolloutRecord>\(\s*DESKTOP_COMMANDS\.startRollout,\s*\{\s*rolloutId\s*\},[\s\S]*operation:\s*'manage\.startRollout'/,
  );
  assert.match(
    cargoSource,
    /sdkwork-claw-host-core\s*=\s*\{\s*path\s*=\s*"\.\.\/\.\.\/sdkwork-claw-host-core\/src-host"\s*\}/,
  );
  assert.match(studioCommandsSource, /pub async fn get_host_platform_status/);
  assert.match(studioCommandsSource, /pub async fn list_rollouts/);
  assert.match(studioCommandsSource, /pub async fn preview_rollout/);
  assert.match(studioCommandsSource, /pub async fn start_rollout/);
  assert.match(studioCommandsSource, /pub async fn list_node_sessions/);
  assert.match(bootstrapSource, /commands::studio_commands::get_host_platform_status/);
  assert.match(bootstrapSource, /commands::studio_commands::list_rollouts/);
  assert.match(bootstrapSource, /commands::studio_commands::preview_rollout/);
  assert.match(bootstrapSource, /commands::studio_commands::start_rollout/);
  assert.match(bootstrapSource, /commands::studio_commands::list_node_sessions/);
});

test('tauriBridge exposes native desktop notifications through the shared platform bridge', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const pluginsSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/plugins/mod.rs'),
    'utf8',
  );
  const cargoSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/Cargo.toml'),
    'utf8',
  );
  const notificationsServiceSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/framework/services/notifications.rs'),
    'utf8',
  );
  const infrastructureRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-infrastructure/src');
  const platformTypesSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/types.ts'),
    'utf8',
  );
  const registrySource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/registry.ts'),
    'utf8',
  );
  const platformIndexSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/index.ts'),
    'utf8',
  );

  assert.match(platformTypesSource, /export interface PlatformNotificationRequest \{/);
  assert.match(platformTypesSource, /title: string;/);
  assert.match(platformTypesSource, /body\?: string;/);
  assert.match(
    platformTypesSource,
    /showNotification\(notification: PlatformNotificationRequest\): Promise<void>;/,
  );
  assert.match(
    registrySource,
    /showNotification:\s*\(notification\)\s*=>\s*getPlatformBridge\(\)\.platform\.showNotification\(notification\)/,
  );
  assert.match(platformIndexSource, /PlatformNotificationRequest/);
  assert.doesNotMatch(tauriBridgeSource, /import \{ invoke \} from '@tauri-apps\/api\/core';/);
  assert.match(tauriBridgeSource, /export async function showDesktopNotification/);
  assert.match(tauriBridgeSource, /invokeTauriRuntimeCommand<void>\(\s*'plugin:notification\|notify',/);
  assert.match(
    tauriBridgeSource,
    /showNotification:\s*\(notification\)\s*=>\s*showDesktopNotification\(notification\)/,
  );
  assert.match(cargoSource, /tauri-plugin-notification\s*=\s*"2"/);
  assert.match(pluginsSource, /plugin\(tauri_plugin_notification::init\(\)\)/);
  assert.match(
    notificationsServiceSource,
    /id:\s*"native"\.to_string\(\),[\s\S]*availability:\s*DesktopProviderAvailability::Ready/,
  );
  assert.match(
    notificationsServiceSource,
    /native_notifications_are_ready_once_runtime_adapters_are_wired/,
  );
});

test('tauriBridge exposes desktop filesystem opener commands through the shared platform bridge', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const infrastructureRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-infrastructure/src');
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const platformTypesSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/types.ts'),
    'utf8',
  );
  const registrySource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/registry.ts'),
    'utf8',
  );
  const platformIndexSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/index.ts'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );

  assert.match(platformTypesSource, /openPath\?\(path: string\): Promise<void>;/);
  assert.match(platformTypesSource, /revealPath\?\(path: string\): Promise<void>;/);
  assert.match(catalogSource, /openPath:\s*'open_path'/);
  assert.match(catalogSource, /revealPath:\s*'reveal_path'/);
  assert.match(tauriBridgeSource, /export async function openPath\(path: string\): Promise<void>/);
  assert.match(tauriBridgeSource, /export async function revealPath\(path: string\): Promise<void>/);
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<void>\(DESKTOP_COMMANDS\.openPath,\s*\{\s*path\s*\},\s*\{\s*operation:\s*'shell\.openPath'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<void>\(DESKTOP_COMMANDS\.revealPath,\s*\{\s*path\s*\},\s*\{\s*operation:\s*'shell\.revealPath'/,
  );
  assert.match(
    tauriBridgeSource,
    /openPath:\s*\(path\)\s*=>\s*openPath\(path\)/,
  );
  assert.match(
    tauriBridgeSource,
    /revealPath:\s*\(path\)\s*=>\s*revealPath\(path\)/,
  );
  assert.match(
    registrySource,
    /openPath:\s*\(path\)\s*=>\s*getPlatformBridge\(\)\.platform\.openPath\?\.\(path\)\s*\?\?\s*Promise\.reject/,
  );
  assert.match(
    registrySource,
    /revealPath:\s*\(path\)\s*=>\s*getPlatformBridge\(\)\.platform\.revealPath\?\.\(path\)\s*\?\?\s*Promise\.reject/,
  );
  assert.match(platformIndexSource, /PlatformAPI/);
  assert.match(bootstrapSource, /commands::open_path::open_path/);
  assert.match(bootstrapSource, /commands::reveal_path::reveal_path/);
});

test('tauriBridge exposes OpenClaw mirror export through the shared kernel platform bridge', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );
  const commandsModSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/commands/mod.rs'),
    'utf8',
  );
  const infrastructureRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-infrastructure/src');
  const kernelContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/kernel.ts'),
    'utf8',
  );
  const registrySource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/registry.ts'),
    'utf8',
  );
  const platformIndexSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/index.ts'),
    'utf8',
  );
  const webKernelSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/webKernel.ts'),
    'utf8',
  );
  const typesRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-types/src');
  const typesIndexSource = fs.readFileSync(path.join(typesRoot, 'index.ts'), 'utf8');

  assert.match(typesIndexSource, /export \* from '\.\/openclawMirror\.ts';/);
  assert.match(kernelContractSource, /inspectOpenClawMirrorExport\(\): Promise<OpenClawMirrorExportPreview \| null>;/);
  assert.match(
    kernelContractSource,
    /exportOpenClawMirror\(request: OpenClawMirrorExportRequest\): Promise<OpenClawMirrorExportResult>;/,
  );
  assert.match(catalogSource, /inspectOpenClawMirrorExport:\s*'inspect_openclaw_mirror_export'/);
  assert.match(catalogSource, /exportOpenClawMirror:\s*'export_openclaw_mirror'/);
  assert.match(tauriBridgeSource, /export async function inspectOpenClawMirrorExport/);
  assert.match(tauriBridgeSource, /export async function exportOpenClawMirror/);
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<OpenClawMirrorExportPreview \| null>\(\s*DESKTOP_COMMANDS\.inspectOpenClawMirrorExport,[\s\S]*operation:\s*'kernel\.inspectOpenClawMirrorExport'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<OpenClawMirrorExportResult>\(\s*DESKTOP_COMMANDS\.exportOpenClawMirror,\s*\{\s*request\s*\},[\s\S]*operation:\s*'kernel\.exportOpenClawMirror'/,
  );
  assert.match(
    tauriBridgeSource,
    /kernel:\s*\{[\s\S]*inspectOpenClawMirrorExport:\s*\(\)\s*=>\s*inspectOpenClawMirrorExport\(\),[\s\S]*exportOpenClawMirror:\s*\(request\)\s*=>\s*exportOpenClawMirror\(request\)/,
  );
  assert.match(
    registrySource,
    /inspectOpenClawMirrorExport:\s*\(\)\s*=>\s*getPlatformBridge\(\)\.kernel\.inspectOpenClawMirrorExport\(\)/,
  );
  assert.match(
    registrySource,
    /exportOpenClawMirror:\s*\(request\)\s*=>\s*getPlatformBridge\(\)\.kernel\.exportOpenClawMirror\(request\)/,
  );
  assert.match(platformIndexSource, /OpenClawMirrorExportPreview/);
  assert.match(platformIndexSource, /OpenClawMirrorExportResult/);
  assert.match(webKernelSource, /async inspectOpenClawMirrorExport\(\): Promise<OpenClawMirrorExportPreview \| null>/);
  assert.match(
    webKernelSource,
    /async exportOpenClawMirror\(\s*_request: OpenClawMirrorExportRequest,\s*\): Promise<OpenClawMirrorExportResult>/,
  );
  assert.match(commandsModSource, /pub mod openclaw_mirror;/);
  assert.match(bootstrapSource, /commands::openclaw_mirror::inspect_openclaw_mirror_export/);
  assert.match(bootstrapSource, /commands::openclaw_mirror::export_openclaw_mirror/);
});

test('tauriBridge exposes OpenClaw mirror import through the shared kernel platform bridge', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );
  const commandsModSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/commands/mod.rs'),
    'utf8',
  );
  const infrastructureRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-infrastructure/src');
  const kernelContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/kernel.ts'),
    'utf8',
  );
  const registrySource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/registry.ts'),
    'utf8',
  );
  const platformIndexSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/index.ts'),
    'utf8',
  );
  const webKernelSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/webKernel.ts'),
    'utf8',
  );
  const typesRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-types/src');
  const mirrorTypesSource = fs.readFileSync(path.join(typesRoot, 'openclawMirror.ts'), 'utf8');
  const coreRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-core/src');
  const mirrorServiceSource = fs.readFileSync(
    path.join(coreRoot, 'services/openClawMirrorService.ts'),
    'utf8',
  );

  assert.match(mirrorTypesSource, /export interface OpenClawMirrorImportPreview \{/);
  assert.match(mirrorTypesSource, /sourcePath: string;/);
  assert.match(mirrorTypesSource, /warnings: string\[\];/);
  assert.match(mirrorTypesSource, /export interface OpenClawMirrorImportRequest \{/);
  assert.match(mirrorTypesSource, /createSafetySnapshot: boolean;/);
  assert.match(mirrorTypesSource, /restartGateway: boolean;/);
  assert.match(
    mirrorTypesSource,
    /export type OpenClawMirrorImportVerificationStatus = 'ready' \| 'degraded';/,
  );
  assert.match(
    mirrorTypesSource,
    /export type OpenClawMirrorImportVerificationCheckStatus = 'passed' \| 'failed' \| 'skipped';/,
  );
  assert.match(mirrorTypesSource, /export interface OpenClawMirrorImportVerificationCheck \{/);
  assert.match(mirrorTypesSource, /id: string;/);
  assert.match(mirrorTypesSource, /label: string;/);
  assert.match(mirrorTypesSource, /status: OpenClawMirrorImportVerificationCheckStatus;/);
  assert.match(mirrorTypesSource, /detail: string;/);
  assert.match(mirrorTypesSource, /export interface OpenClawMirrorImportVerification \{/);
  assert.match(mirrorTypesSource, /checkedAt: string;/);
  assert.match(mirrorTypesSource, /status: OpenClawMirrorImportVerificationStatus;/);
  assert.match(
    mirrorTypesSource,
    /checks: OpenClawMirrorImportVerificationCheck\[\];/,
  );
  assert.match(mirrorTypesSource, /export interface OpenClawMirrorImportResult \{/);
  assert.match(mirrorTypesSource, /safetySnapshot\?: OpenClawMirrorSafetySnapshotRecord \| null;/);
  assert.match(
    mirrorTypesSource,
    /verification: OpenClawMirrorImportVerification;/,
  );
  assert.match(
    kernelContractSource,
    /inspectOpenClawMirrorImport\(sourcePath: string\): Promise<OpenClawMirrorImportPreview \| null>;/,
  );
  assert.match(
    kernelContractSource,
    /importOpenClawMirror\(request: OpenClawMirrorImportRequest\): Promise<OpenClawMirrorImportResult>;/,
  );
  assert.match(catalogSource, /inspectOpenClawMirrorImport:\s*'inspect_openclaw_mirror_import'/);
  assert.match(catalogSource, /importOpenClawMirror:\s*'import_openclaw_mirror'/);
  assert.match(tauriBridgeSource, /export async function inspectOpenClawMirrorImport/);
  assert.match(tauriBridgeSource, /export async function importOpenClawMirror/);
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<OpenClawMirrorImportPreview \| null>\(\s*DESKTOP_COMMANDS\.inspectOpenClawMirrorImport,\s*\{\s*sourcePath\s*\},[\s\S]*operation:\s*'kernel\.inspectOpenClawMirrorImport'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<OpenClawMirrorImportResult>\(\s*DESKTOP_COMMANDS\.importOpenClawMirror,\s*\{\s*request\s*\},[\s\S]*operation:\s*'kernel\.importOpenClawMirror'/,
  );
  assert.match(
    tauriBridgeSource,
    /kernel:\s*\{[\s\S]*inspectOpenClawMirrorImport:\s*\(sourcePath\)\s*=>\s*inspectOpenClawMirrorImport\(sourcePath\),[\s\S]*importOpenClawMirror:\s*\(request\)\s*=>\s*importOpenClawMirror\(request\)/,
  );
  assert.match(
    registrySource,
    /inspectOpenClawMirrorImport:\s*\(sourcePath\)\s*=>\s*getPlatformBridge\(\)\.kernel\.inspectOpenClawMirrorImport\(sourcePath\)/,
  );
  assert.match(
    registrySource,
    /importOpenClawMirror:\s*\(request\)\s*=>\s*getPlatformBridge\(\)\.kernel\.importOpenClawMirror\(request\)/,
  );
  assert.match(platformIndexSource, /OpenClawMirrorImportPreview/);
  assert.match(platformIndexSource, /OpenClawMirrorImportResult/);
  assert.match(
    webKernelSource,
    /async inspectOpenClawMirrorImport\(\s*_sourcePath: string,\s*\): Promise<OpenClawMirrorImportPreview \| null>/,
  );
  assert.match(
    webKernelSource,
    /async importOpenClawMirror\(\s*_request: OpenClawMirrorImportRequest,\s*\): Promise<OpenClawMirrorImportResult>/,
  );
  assert.match(
    mirrorServiceSource,
    /async inspectOpenClawMirrorImport\(\s*sourcePath: string,\s*\): Promise<OpenClawMirrorImportPreview \| null>/,
  );
  assert.match(
    mirrorServiceSource,
    /async importOpenClawMirror\(\s*request: OpenClawMirrorImportRequest,\s*\): Promise<OpenClawMirrorImportResult>/,
  );
  assert.match(commandsModSource, /pub mod openclaw_mirror;/);
  assert.match(bootstrapSource, /commands::openclaw_mirror::inspect_openclaw_mirror_import/);
  assert.match(bootstrapSource, /commands::openclaw_mirror::import_openclaw_mirror/);
});

test('tauriBridge keeps canonical host-manage placeholders and startup metadata visible at the desktop package boundary', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const desktopIndexSource = fs.readFileSync(
    path.join(desktopRoot, 'src/index.ts'),
    'utf8',
  );
  const infrastructureRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-infrastructure/src');
  const manageContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/manage.ts'),
    'utf8',
  );
  const runtimeContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/runtime.ts'),
    'utf8',
  );

  assert.match(manageContractSource, /getHostEndpoints\(\): Promise<ManageHostEndpointRecord\[]>/);
  assert.match(manageContractSource, /getOpenClawRuntime\(\): Promise<ManageOpenClawRuntimeRecord>/);
  assert.match(manageContractSource, /getOpenClawGateway\(\): Promise<ManageOpenClawGatewayRecord>/);
  assert.match(manageContractSource, /invokeOpenClawGateway\(request: ManageOpenClawGatewayInvokeRequest\)/);
  assert.match(runtimeContractSource, /export interface RuntimeStartupContext \{/);
  assert.match(runtimeContractSource, /apiBasePath\?: string \| null;/);
  assert.match(runtimeContractSource, /hostEndpointId\?: string \| null;/);
  assert.match(runtimeContractSource, /hostRequestedPort\?: number \| null;/);
  assert.match(runtimeContractSource, /hostActivePort\?: number \| null;/);
  assert.match(runtimeContractSource, /runtimeDataDir\?: string \| null;/);
  assert.match(runtimeContractSource, /webDistDir\?: string \| null;/);
  assert.match(runtimeContractSource, /export interface RuntimeDesktopActiveKernelRuntimeInfo \{/);
  assert.doesNotMatch(
    runtimeContractSource,
    /export interface RuntimeDesktopOpenClawRuntimeInfo \{[\s\S]*stateDir: string;/,
  );
  assert.match(
    runtimeContractSource,
    /export interface RuntimeDesktopKernelInfo \{[\s\S]*activeRuntime: RuntimeDesktopActiveKernelRuntimeInfo;[\s\S]*openClawRuntime\?: RuntimeDesktopOpenClawRuntimeInfo \| null;/,
  );
  assert.match(tauriBridgeSource, /export interface DesktopKernelInfo extends RuntimeDesktopKernelInfo \{\}/);
  assert.match(tauriBridgeSource, /export async function getHostEndpoints\(\)/);
  assert.match(tauriBridgeSource, /export async function getOpenClawRuntime\(\)/);
  assert.match(tauriBridgeSource, /export async function getOpenClawGateway\(\)/);
  assert.match(tauriBridgeSource, /export async function invokeManagedOpenClawGateway\(/);
  assert.match(
    tauriBridgeSource,
    /startup:\s*\{[\s\S]*hostMode:\s*desktopHostRuntime\?\.mode \?\? 'desktopCombined'[\s\S]*distributionFamily:\s*'desktop'[\s\S]*deploymentFamily:\s*'bareMetal'[\s\S]*acceleratorProfile:\s*null[\s\S]*apiBasePath:\s*desktopHostRuntime\?\.apiBasePath \?\? DESKTOP_API_BASE_PATH[\s\S]*manageBasePath:\s*desktopHostRuntime\?\.manageBasePath \?\? DESKTOP_MANAGE_BASE_PATH[\s\S]*internalBasePath:\s*desktopHostRuntime\?\.internalBasePath \?\? DESKTOP_INTERNAL_BASE_PATH[\s\S]*hostEndpointId:\s*desktopHostRuntime\?\.endpointId \?\? null[\s\S]*hostRequestedPort:\s*desktopHostRuntime\?\.requestedPort \?\? null[\s\S]*hostActivePort:\s*desktopHostRuntime\?\.activePort \?\? null[\s\S]*runtimeDataDir:\s*desktopHostRuntime\?\.runtimeDataDir \?\? null[\s\S]*webDistDir:\s*desktopHostRuntime\?\.webDistDir \?\? null/,
  );
  assert.match(desktopIndexSource, /getHostEndpoints,/);
  assert.match(desktopIndexSource, /getOpenClawRuntime,/);
  assert.match(desktopIndexSource, /getOpenClawGateway,/);
  assert.match(desktopIndexSource, /invokeManagedOpenClawGateway,/);
});

test('tauriBridge derives desktop browserBaseUrl from the canonical embedded host runtime descriptor', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );

  assert.match(catalogSource, /getDesktopHostRuntime:\s*'get_desktop_host_runtime'/);
  assert.match(
    tauriBridgeSource,
    /export async function getDesktopHostRuntime\(\): Promise<DesktopHostedRuntimeDescriptor \| null> \{/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<DesktopHostedRuntimeDescriptor \| null>\(\s*DESKTOP_COMMANDS\.getDesktopHostRuntime,/,
  );
  assert.match(
    tauriBridgeSource,
    /browserBaseUrl:\s*desktopHostRuntime\?\.browserBaseUrl \?\? null/,
  );
});

test('tauriBridge registers the canonical desktop host runtime descriptor command', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );
  const studioCommandsSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/commands/studio_commands.rs'),
    'utf8',
  );

  assert.match(catalogSource, /getDesktopHostRuntime:\s*'get_desktop_host_runtime'/);
  assert.match(studioCommandsSource, /pub async fn get_desktop_host_runtime/);
  assert.match(bootstrapSource, /commands::studio_commands::get_desktop_host_runtime/);
});

test('tauriBridge waits for the Tauri runtime before resolving the desktop hosted runtime descriptor', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );

  assert.match(
    tauriBridgeSource,
    /waitForTauriRuntime,/,
  );
  assert.match(
    tauriBridgeSource,
    /const desktopHostRuntimeResolver = createDesktopHostRuntimeResolver\(\{[\s\S]*waitForRuntime:\s*\(\)\s*=>\s*waitForTauriRuntime\(\)/,
  );
  assert.doesNotMatch(
    tauriBridgeSource,
    /const desktopHostRuntimeResolver = createDesktopHostRuntimeResolver\(\{[\s\S]*waitForRuntime:\s*\(\)\s*=>\s*isTauriRuntime\(\)/,
  );
});

test('tauriBridge resolves desktop hosted runtime descriptors through a refreshable in-flight resolver instead of a sticky cache', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );

  assert.match(
    tauriBridgeSource,
    /createDesktopHostRuntimeResolver/,
  );
  assert.match(
    tauriBridgeSource,
    /const desktopHostRuntimeResolver = createDesktopHostRuntimeResolver\(\{/,
  );
  assert.match(
    tauriBridgeSource,
    /return desktopHostRuntimeResolver\.resolve\(\);/,
  );
  assert.doesNotMatch(
    tauriBridgeSource,
    /let desktopHostRuntimePromise: Promise<DesktopHostedRuntimeDescriptor \| null> \| null = null;/,
  );
});

test('tauriBridge configures manage and internal desktop bridge surfaces as HTTP-only over the embedded host browser shell', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );

  assert.match(
    tauriBridgeSource,
    /WebManagePlatform,\s*WebPlatform,\s*WebInternalPlatform,\s*configurePlatformBridge/,
  );
  assert.match(
    tauriBridgeSource,
    /const DESKTOP_MANAGE_BASE_PATH = '\/claw\/manage\/v1';/,
  );
  assert.match(
    tauriBridgeSource,
    /const DESKTOP_INTERNAL_BASE_PATH = '\/claw\/internal\/v1';/,
  );
  assert.match(
    tauriBridgeSource,
    /createDesktopHostedManagePlatform as createStaticDesktopHostedManagePlatform/,
  );
  assert.match(
    tauriBridgeSource,
     /createDesktopHostedInternalPlatform as createStaticDesktopHostedInternalPlatform/,
  );
  assert.match(
    tauriBridgeSource,
     /async function requireDesktopHostedRuntime\(\s*operation: string,\s*\): Promise<DesktopHostedRuntimeDescriptor> \{/,
  );
  assert.match(
    tauriBridgeSource,
     /async function createDesktopHostedManagePlatform\(\s*operation: string,\s*\): Promise<WebManagePlatform> \{/,
  );
  assert.match(
    tauriBridgeSource,
     /async function createDesktopHostedInternalPlatform\(\s*operation: string,\s*\): Promise<WebInternalPlatform> \{/,
  );
  assert.match(
    tauriBridgeSource,
     /return createStaticDesktopHostedManagePlatform\(\s*await requireDesktopHostedRuntime\(operation\),\s*\);/,
  );
  assert.match(
    tauriBridgeSource,
     /return createStaticDesktopHostedInternalPlatform\(\s*await requireDesktopHostedRuntime\(operation\),\s*\);/,
   );
   assert.match(
     tauriBridgeSource,
      /throw new DesktopBridgeError\(\{[\s\S]*operation,[\s\S]*runtime:\s*'desktop'[\s\S]*Canonical desktop embedded host runtime descriptor is unavailable\./,
    );
    assert.doesNotMatch(
      tauriBridgeSource,
      /if \(!desktopHostRuntime\) \{[\s\S]*return listRollouts\(\);/,
    );
    assert.doesNotMatch(
      tauriBridgeSource,
      /if \(!desktopHostRuntime\) \{[\s\S]*return getHostPlatformStatus\(\);/,
    );
  assert.match(
    tauriBridgeSource,
     /manage:\s*createDesktopHttpFirstManagePlatform\(\),/,
  );
  assert.match(
    tauriBridgeSource,
    /internal:\s*createDesktopHttpFirstInternalPlatform\(\),/,
  );
});

test('tauriBridge configures studio operations as HTTP-only over the embedded host browser shell', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );

  assert.match(
    tauriBridgeSource,
    /const DESKTOP_API_BASE_PATH = '\/claw\/api\/v1';/,
  );
  assert.match(
    tauriBridgeSource,
     /function createDesktopHttpFirstStudioPlatform\(\) \{/,
  );
  assert.match(
    tauriBridgeSource,
     /createDeferredDesktopHostedStudioPlatform as createStaticDeferredDesktopHostedStudioPlatform/,
  );
  assert.match(
    tauriBridgeSource,
     /const hostedPlatform = createStaticDeferredDesktopHostedStudioPlatform\(\(\)\s*=>[\s\S]*'studio\.requestHostedSurface'/,
  );
  assert.match(
    tauriBridgeSource,
     /return Object\.assign\(hostedPlatform,\s*\{/,
  );
  assert.match(
    tauriBridgeSource,
      /'studio\.requestHostedSurface'/,
    );
    assert.doesNotMatch(
      tauriBridgeSource,
      /fallback:\s*desktopDirectStudioPlatform,/,
   );
  assert.doesNotMatch(
    tauriBridgeSource,
    /const hostedPlatform = new WebHostedStudioPlatform\(\{/,
  );
  assert.match(
    tauriBridgeSource,
     /studio:\s*createDesktopHttpFirstStudioPlatform\(\),/,
  );
});

test('tauriBridge keeps enough hosted runtime readiness budget for packaged cold starts', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const readinessRetryTimeoutMatch = tauriBridgeSource.match(
    /const DESKTOP_HOSTED_RUNTIME_READINESS_RETRY_TIMEOUT_MS = ([0-9_]+);/,
  );

  assert.ok(
    readinessRetryTimeoutMatch,
    'desktop hosted runtime readiness timeout should stay explicit in tauriBridge.ts',
  );

  const readinessRetryTimeoutMs = Number(
    readinessRetryTimeoutMatch[1].replaceAll('_', ''),
  );

  assert.ok(
    readinessRetryTimeoutMs >= 120_000,
    `packaged first-launch runtime extraction and gateway cold starts require at least 120000ms of readiness budget, received ${readinessRetryTimeoutMs}ms`,
  );
});

test('tauriBridge reuses the shared hosted studio adapter instead of maintaining a second manual studio fetch implementation', () => {
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const infrastructureRoot = path.resolve(import.meta.dirname, '../../../sdkwork-claw-infrastructure/src');
  const platformIndexSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/index.ts'),
    'utf8',
  );

  assert.match(platformIndexSource, /WebHostedStudioPlatform/);
  assert.match(
    tauriBridgeSource,
    /createDeferredDesktopHostedStudioPlatform as createStaticDeferredDesktopHostedStudioPlatform/,
  );
});

test('tauriBridge routes canonical host-manage OpenClaw surfaces through concrete desktop commands instead of placeholders', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );
  const studioCommandsSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/commands/studio_commands.rs'),
    'utf8',
  );
  const studioServiceSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/framework/services/studio.rs'),
    'utf8',
  );

  assert.match(catalogSource, /getHostEndpoints:\s*'manage_get_host_endpoints'/);
  assert.match(catalogSource, /getOpenClawRuntime:\s*'manage_get_openclaw_runtime'/);
  assert.match(catalogSource, /getOpenClawGateway:\s*'manage_get_openclaw_gateway'/);
  assert.match(
    catalogSource,
    /invokeManagedOpenClawGateway:\s*'manage_invoke_openclaw_gateway'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<ManageHostEndpointRecord\[]>\(\s*DESKTOP_COMMANDS\.getHostEndpoints,\s*undefined,\s*\{\s*operation:\s*'manage\.getHostEndpoints'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<ManageOpenClawRuntimeRecord>\(\s*DESKTOP_COMMANDS\.getOpenClawRuntime,\s*undefined,\s*\{\s*operation:\s*'manage\.getOpenClawRuntime'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<ManageOpenClawGatewayRecord>\(\s*DESKTOP_COMMANDS\.getOpenClawGateway,\s*undefined,\s*\{\s*operation:\s*'manage\.getOpenClawGateway'/,
  );
  assert.match(
    tauriBridgeSource,
    /invokeDesktopCommand<unknown>\(\s*DESKTOP_COMMANDS\.invokeManagedOpenClawGateway,\s*\{\s*request\s*\},\s*\{\s*operation:\s*'manage\.invokeOpenClawGateway'/,
  );
  assert.doesNotMatch(
    tauriBridgeSource,
    /Manage host endpoints are not available on the desktop bridge yet\./,
  );
  assert.doesNotMatch(
    tauriBridgeSource,
    /Manage OpenClaw runtime is not available on the desktop bridge yet\./,
  );
  assert.doesNotMatch(
    tauriBridgeSource,
    /Manage OpenClaw gateway is not available on the desktop bridge yet\./,
  );
  assert.doesNotMatch(
    tauriBridgeSource,
    /Manage OpenClaw gateway invoke is not available on the desktop bridge yet\./,
  );
  assert.match(studioCommandsSource, /pub async fn get_host_endpoints/);
  assert.match(studioCommandsSource, /pub async fn get_openclaw_runtime/);
  assert.match(studioCommandsSource, /pub async fn get_openclaw_gateway/);
  assert.match(studioCommandsSource, /pub async fn invoke_managed_openclaw_gateway/);
  assert.match(bootstrapSource, /commands::studio_commands::get_host_endpoints/);
  assert.match(bootstrapSource, /commands::studio_commands::get_openclaw_runtime/);
  assert.match(bootstrapSource, /commands::studio_commands::get_openclaw_gateway/);
  assert.match(bootstrapSource, /commands::studio_commands::invoke_managed_openclaw_gateway/);
  assert.match(studioServiceSource, /pub fn get_host_endpoints\(/);
  assert.match(studioServiceSource, /pub fn get_openclaw_runtime\(/);
  assert.match(studioServiceSource, /pub fn get_openclaw_gateway\(/);
  assert.match(studioServiceSource, /pub fn invoke_managed_openclaw_gateway\(/);
  assert.match(studioServiceSource, /project_openclaw_runtime/);
  assert.match(studioServiceSource, /project_openclaw_gateway/);
  assert.match(studioServiceSource, /built_in_openclaw_lifecycle\(supervisor\)\?/);
});

test('tauriBridge exposes built-in OpenClaw status change events through the shared runtime bridge', () => {
  const desktopRoot = path.resolve(import.meta.dirname, '../../');
  const infrastructureRoot = path.resolve(
    import.meta.dirname,
    '../../../sdkwork-claw-infrastructure/src',
  );
  const tauriBridgeSource = fs.readFileSync(
    path.join(import.meta.dirname, 'tauriBridge.ts'),
    'utf8',
  );
  const catalogSource = fs.readFileSync(
    path.join(import.meta.dirname, 'catalog.ts'),
    'utf8',
  );
  const runtimeContractSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/contracts/runtime.ts'),
    'utf8',
  );
  const runtimeIndexSource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/index.ts'),
    'utf8',
  );
  const registrySource = fs.readFileSync(
    path.join(infrastructureRoot, 'platform/registry.ts'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/app/bootstrap.rs'),
    'utf8',
  );
  const contextSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/framework/context.rs'),
    'utf8',
  );
  const eventsSource = fs.readFileSync(
    path.join(desktopRoot, 'src-tauri/src/framework/events.rs'),
    'utf8',
  );

  assert.match(
    eventsSource,
    /pub const BUILT_IN_OPENCLAW_STATUS_CHANGED: &str = "studio:\/\/built-in-openclaw-status-changed";/,
  );
  assert.match(
    catalogSource,
    /builtInOpenClawStatusChanged:\s*'studio:\/\/built-in-openclaw-status-changed'/,
  );
  assert.match(
    runtimeContractSource,
    /export interface RuntimeBuiltInOpenClawStatusChangedEvent[\s\S]*instanceId: string;[\s\S]*status:/,
  );
  assert.match(
    runtimeContractSource,
    /subscribeBuiltInOpenClawStatusChanged\(\s*listener: \(event: RuntimeBuiltInOpenClawStatusChangedEvent\) => void,\s*\): Promise<RuntimeEventUnsubscribe>;/,
  );
  assert.match(runtimeIndexSource, /RuntimeBuiltInOpenClawStatusChangedEvent/);
  assert.match(
    registrySource,
    /subscribeBuiltInOpenClawStatusChanged:\s*\(listener\)\s*=>\s*getPlatformBridge\(\)\.runtime\.subscribeBuiltInOpenClawStatusChanged\(listener\)/,
  );
  assert.match(tauriBridgeSource, /export interface DesktopBuiltInOpenClawStatusChangedEvent/);
  assert.match(tauriBridgeSource, /export async function subscribeBuiltInOpenClawStatusChanged/);
  assert.match(
    tauriBridgeSource,
    /listenDesktopEvent<DesktopBuiltInOpenClawStatusChangedEvent>\(\s*DESKTOP_EVENTS\.builtInOpenClawStatusChanged,\s*listener,/,
  );
  assert.match(
    tauriBridgeSource,
    /subscribeBuiltInOpenClawStatusChanged:\s*\(listener\)\s*=>\s*subscribeBuiltInOpenClawStatusChanged\(listener\)/,
  );
  assert.match(
    bootstrapSource,
    /context\.emit_built_in_openclaw_status_changed\(/,
  );
  assert.match(
    contextSource,
    /self\.emit\(events::BUILT_IN_OPENCLAW_STATUS_CHANGED,\s*payload\)/,
  );
});
