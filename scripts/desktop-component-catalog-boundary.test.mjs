import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { listKernelDefinitions } from './release/kernel-definitions.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const kernelIds = listKernelDefinitions().map((definition) => definition.kernelId);

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function collectConfiguredComponentIds(serviceDefaults) {
  return [
    ...(Array.isArray(serviceDefaults.autoStartComponentIds)
      ? serviceDefaults.autoStartComponentIds
      : []),
    ...(Array.isArray(serviceDefaults.manualComponentIds)
      ? serviceDefaults.manualComponentIds
      : []),
    ...(Array.isArray(serviceDefaults.embeddedComponentIds)
      ? serviceDefaults.embeddedComponentIds
      : []),
  ]
    .map((entry) => String(entry ?? '').trim())
    .filter(Boolean);
}

test('desktop component foundation catalog excludes kernel ids from generic component metadata', () => {
  const registry = readJson(
    'packages/sdkwork-clawstudio-desktop/src-tauri/foundation/components/component-registry.json',
  );
  const serviceDefaults = readJson(
    'packages/sdkwork-clawstudio-desktop/src-tauri/foundation/components/service-defaults.json',
  );

  const registryIds = Array.isArray(registry.components)
    ? registry.components.map((entry) => String(entry?.id ?? '').trim()).filter(Boolean)
    : [];
  const configuredIds = collectConfiguredComponentIds(serviceDefaults);

  for (const kernelId of kernelIds) {
    assert.ok(
      !registryIds.includes(kernelId),
      `generic desktop component registry must not contain kernel id "${kernelId}"`,
    );
    assert.ok(
      !configuredIds.includes(kernelId),
      `generic desktop service defaults must not contain kernel id "${kernelId}"`,
    );
  }
});

test('desktop component Rust defaults and host mapping do not special-case kernel ids', () => {
  const componentsSource = readFileSync(
    path.join(
      rootDir,
      'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/components.rs',
    ),
    'utf8',
  );
  const componentHostSource = readFileSync(
    path.join(
      rootDir,
      'packages/sdkwork-clawstudio-desktop/src-tauri/src/framework/services/component_host.rs',
    ),
    'utf8',
  );

  for (const kernelId of kernelIds) {
    assert.doesNotMatch(
      componentsSource,
      new RegExp(`id:\\s*"${kernelId}"\\.to_string\\(\\)`),
      `desktop component defaults must not seed kernel id "${kernelId}"`,
    );
  }

  assert.doesNotMatch(
    componentHostSource,
    /match definition\.id\.as_str\(\)\s*\{\s*"openclaw"\s*=>/s,
    'desktop component host must not remap OpenClaw kernel lifecycle through the generic component catalog',
  );
});
