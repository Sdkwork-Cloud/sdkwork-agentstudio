import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDesktopInstallReadyLayout,
  normalizeDesktopInstallReadyLayout,
} from './desktop-install-ready-layout.mjs';
import { resolveKernelReleaseConfig } from './kernel-releases.mjs';

const openClawReleaseConfig = resolveKernelReleaseConfig('openclaw');
const openClawInstallKey = `${openClawReleaseConfig.stableVersion}-windows-x64`;

test('normalizeDesktopInstallReadyLayout strips legacy bundled node entry fields', () => {
  const normalizedLayout = normalizeDesktopInstallReadyLayout({
    mode: 'archive-extract-ready',
    installKey: openClawInstallKey,
    reuseOnFirstLaunch: true,
    requiresArchiveExtractionOnFirstLaunch: false,
    manifestRelativePath: 'manifest.json',
    runtimeSidecarRelativePath: 'runtime/.sdkwork-openclaw-runtime.json',
    cliEntryRelativePath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
    nodeEntryRelativePath: 'runtime/node/node.exe',
  });

  assert.deepEqual(normalizedLayout, {
    mode: 'archive-extract-ready',
    installKey: openClawInstallKey,
    reuseOnFirstLaunch: true,
    requiresArchiveExtractionOnFirstLaunch: false,
    manifestRelativePath: 'manifest.json',
    runtimeSidecarRelativePath: 'runtime/.sdkwork-openclaw-runtime.json',
    cliEntryRelativePath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
  });
  assert.equal(Object.hasOwn(normalizedLayout, 'nodeEntryRelativePath'), false);
});

test('buildDesktopInstallReadyLayout emits only packaged OpenClaw startup paths', () => {
  const installReadyLayout = buildDesktopInstallReadyLayout({
    mode: 'archive-extract-ready',
    manifest: {
      openclawVersion: openClawReleaseConfig.stableVersion,
      platform: 'windows',
      arch: 'x64',
      cliRelativePath: 'runtime/package/node_modules/openclaw/openclaw.mjs',
    },
  });

  assert.equal(Object.hasOwn(installReadyLayout, 'nodeEntryRelativePath'), false);
});
