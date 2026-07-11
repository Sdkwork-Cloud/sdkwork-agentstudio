import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const failures = [];

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return '';
  }

  return readFileSync(absolutePath, 'utf8');
}

function assertPath(relativePath, label) {
  if (!existsSync(path.join(rootDir, relativePath))) {
    failures.push(`Missing ${label}: ${relativePath}`);
  }
}

function assertIncludes(relativePath, expectedText, label) {
  const content = readText(relativePath);
  if (!content.includes(expectedText)) {
    failures.push(`Missing ${label} in ${relativePath}: expected "${expectedText}"`);
  }
}

function assertNotIncludes(relativePath, unexpectedText, label) {
  const content = readText(relativePath);
  if (content.includes(unexpectedText)) {
    failures.push(`Unexpected ${label} in ${relativePath}: found "${unexpectedText}"`);
  }
}

assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/capabilities.rs',
  'desktop capability foundation module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/kernel.rs',
  'desktop kernel contract module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/storage.rs',
  'desktop storage contract module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/kernel.rs',
  'desktop kernel assembler service module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/security.rs',
  'desktop security service module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/notifications.rs',
  'desktop notifications service module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/payments.rs',
  'desktop payments service module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/integrations.rs',
  'desktop integrations service module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/permissions.rs',
  'desktop permissions service module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/storage.rs',
  'desktop storage service module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/supervisor.rs',
  'desktop supervisor service module',
);
assertPath(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/commands/desktop_kernel.rs',
  'desktop kernel command module',
);

assertIncludes(
  'package.json',
  '"check:desktop-kernel"',
  'desktop kernel verification script',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/mod.rs',
  'pub mod capabilities;',
  'desktop capability foundation export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/mod.rs',
  'pub mod kernel;',
  'desktop kernel framework export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/mod.rs',
  'pub mod storage;',
  'desktop storage framework export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/notifications.rs',
  'CapabilityCatalog',
  'notifications shared capability catalog usage',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/payments.rs',
  'CapabilityCatalog',
  'payments shared capability catalog usage',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/integrations.rs',
  'CapabilityCatalog',
  'integrations shared capability catalog usage',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod kernel;',
  'desktop kernel assembler export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod security;',
  'desktop security service export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod notifications;',
  'desktop notifications service export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod payments;',
  'desktop payments service export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod integrations;',
  'desktop integrations service export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod permissions;',
  'desktop permissions service export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/mod.rs',
  'pub mod storage;',
  'desktop storage service export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/mod.rs',
  'pub openclaw_runtime: OpenClawRuntimeService,',
  'bundled openclaw runtime service wiring',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/mod.rs',
  'pub path_registration: PathRegistrationService,',
  'bundled openclaw path registration wiring',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/commands/mod.rs',
  'pub mod desktop_kernel;',
  'desktop kernel command export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::desktop_kernel::desktop_kernel_info',
  'desktop kernel command registration',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::desktop_kernel::desktop_storage_info',
  'desktop storage command registration',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts',
  'export async function getDesktopKernelInfo',
  'desktop kernel bridge export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src/desktop/tauriBridge.ts',
  'export async function getDesktopStorageInfo',
  'desktop storage bridge export',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/commands/get_app_config.rs',
  'PublicAppConfig',
  'public runtime config command projection type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export type RuntimeDesktopProviderAvailability',
  'desktop provider availability runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'connectionConfigured: boolean;',
  'runtime storage connection configured flag',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'databaseConfigured: boolean;',
  'runtime storage database configured flag',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'endpointConfigured: boolean;',
  'runtime storage endpoint configured flag',
);
assertNotIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'connection?: string | null;',
  'runtime raw storage connection field',
);
assertNotIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'database?: string | null;',
  'runtime raw storage database field',
);
assertNotIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'endpoint?: string | null;',
  'runtime raw storage endpoint field',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopNotificationProviderInfo',
  'desktop notification provider runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopPaymentProviderInfo',
  'desktop payment provider runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopIntegrationAdapterInfo',
  'desktop integration adapter runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopKernelInfo',
  'desktop kernel runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopFilesystemInfo',
  'desktop filesystem runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopSecurityInfo',
  'desktop security runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopProcessInfo',
  'desktop process runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopPermissionsInfo',
  'desktop permissions runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopNotificationInfo',
  'desktop notifications runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'availableProviders: RuntimeDesktopNotificationProviderInfo[];',
  'desktop notification provider payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopPaymentInfo',
  'desktop payments runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'availableProviders: RuntimeDesktopPaymentProviderInfo[];',
  'desktop payment provider payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeDesktopIntegrationInfo',
  'desktop integrations runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'availableAdapters: RuntimeDesktopIntegrationAdapterInfo[];',
  'desktop integration adapter payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'export interface RuntimeStorageInfo',
  'desktop storage runtime contract type',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'filesystem: RuntimeDesktopFilesystemInfo;',
  'desktop kernel filesystem payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'security: RuntimeDesktopSecurityInfo;',
  'desktop kernel security payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'process: RuntimeDesktopProcessInfo;',
  'desktop kernel process payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'permissions: RuntimeDesktopPermissionsInfo;',
  'desktop kernel permissions payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'notifications: RuntimeDesktopNotificationInfo;',
  'desktop kernel notifications payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'payments: RuntimeDesktopPaymentInfo;',
  'desktop kernel payments payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'integrations: RuntimeDesktopIntegrationInfo;',
  'desktop kernel integrations payload',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/supervisor.rs',
  'SERVICE_ID_OPENCLAW_GATEWAY',
  'bundled openclaw gateway service id',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/services/supervisor.rs',
  'start_openclaw_gateway',
  'bundled openclaw gateway supervisor startup',
);
assertIncludes(
  'packages/sdkwork-agentstudio-pc-infrastructure/src/platform/contracts/runtime.ts',
  'bundledComponents: RuntimeDesktopBundledComponentsInfo;',
  'desktop kernel bundled components payload',
);

if (failures.length > 0) {
  console.error('desktop kernel template contract failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('desktop kernel template contract passed');
