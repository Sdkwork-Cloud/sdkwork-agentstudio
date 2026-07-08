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
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/storage.ts',
  'storage bridge contract module',
);
assertPath(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/webStorage.ts',
  'web storage bridge module',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/storage_commands.rs',
  'desktop storage command module',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage/drivers.rs',
  'desktop storage drivers module',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage/profiles.rs',
  'desktop storage profiles module',
);
assertPath(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage/registry.rs',
  'desktop storage registry module',
);

assertIncludes(
  'package.json',
  '"check:desktop-storage"',
  'desktop storage verification script',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/registry.ts',
  'storage:',
  'storage bridge registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/registry.ts',
  'getStoragePlatform',
  'storage bridge accessor',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/index.ts',
  "from './contracts/storage.ts'",
  'storage contract export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/index.ts',
  'getStoragePlatform',
  'storage platform export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function storageGetText',
  'desktop storage get bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function storagePutText',
  'desktop storage put bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function storageDelete',
  'desktop storage delete bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src/desktop/tauriBridge.ts',
  'export async function storageListKeys',
  'desktop storage list bridge export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/commands/mod.rs',
  'pub mod storage_commands;',
  'storage command module export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::storage_commands::storage_get_text',
  'storage get command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::storage_commands::storage_put_text',
  'storage put command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::storage_commands::storage_delete',
  'storage delete command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/app/bootstrap.rs',
  'commands::storage_commands::storage_list_keys',
  'storage list command registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage.rs',
  'mod drivers;',
  'storage drivers module declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage.rs',
  'mod profiles;',
  'storage profiles module declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage.rs',
  'mod registry;',
  'storage registry module declaration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage.rs',
  'pub use self::registry::{StorageDriver, StorageDriverRegistry};',
  'storage registry public re-export',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage.rs',
  'pub fn with_registry',
  'storage service registry injection constructor',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage/registry.rs',
  'pub trait StorageDriver',
  'storage driver extension trait',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage/registry.rs',
  'pub struct StorageDriverRegistry',
  'storage driver registry type',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage/registry.rs',
  'register_driver(',
  'storage registry driver registration',
);
assertIncludes(
  'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/storage/drivers.rs',
  'UnavailableStorageDriver',
  'storage placeholder driver adapter',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'connectionConfigured: boolean;',
  'public storage connection configured flag',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'databaseConfigured: boolean;',
  'public storage database configured flag',
);
assertIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'endpointConfigured: boolean;',
  'public storage endpoint configured flag',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'connection?: string | null;',
  'public raw storage connection field',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'database?: string | null;',
  'public raw storage database field',
);
assertNotIncludes(
  'packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/runtime.ts',
  'endpoint?: string | null;',
  'public raw storage endpoint field',
);

if (failures.length > 0) {
  console.error('desktop storage driver contract failed');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('desktop storage driver contract passed');
