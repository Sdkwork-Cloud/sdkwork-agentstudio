import assert from 'node:assert/strict';
import {
  createAppEnvConfig,
  type AppUpdateCheckRequest,
  type RuntimeInfo,
} from '@sdkwork/claw-infrastructure';
import { createUpdateService } from './updateService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createRuntimeInfo(overrides: Partial<RuntimeInfo> = {}): RuntimeInfo {
  return {
    platform: 'desktop',
    startup: null,
    app: {
      version: '0.1.0',
      name: 'Claw Studio',
      target: 'x86_64-pc-windows-msvc',
      ...overrides.app,
    },
    paths: null,
    config: null,
    system: {
      os: 'Windows 11',
      arch: '',
      family: 'windows',
      target: 'x86_64-pc-windows-msvc',
      ...overrides.system,
    },
    ...overrides,
  };
}

await runTest('updateService derives desktop update architecture from the target triple prefix when system.arch is unavailable', async () => {
  let capturedRequest: AppUpdateCheckRequest | null = null;
  const service = createUpdateService({
    env: createAppEnvConfig({
      VITE_API_BASE_URL: 'https://api.sdkwork.com',
      VITE_APP_ID: '42',
      VITE_PLATFORM: 'desktop',
    }),
    getRuntimeInfo: async () => createRuntimeInfo({
      app: {
        version: '0.2.0',
        name: 'Claw Studio',
        target: 'x86_64-pc-windows-msvc',
      },
      system: {
        os: 'Windows 11',
        arch: '',
        family: 'windows',
        target: 'x86_64-pc-windows-msvc',
      },
    }),
    getDeviceId: async () => 'device-1',
    checkAppUpdate: async (request) => {
      capturedRequest = request;
      return {
        hasUpdate: false,
        updateRequired: false,
        forceUpdate: false,
        currentVersion: request.currentVersion,
        targetVersion: request.currentVersion,
        highlights: [],
        resolvedPackage: null,
        frameworkPayload: null,
      };
    },
  });

  await service.checkForAppUpdate();

  assert.equal(capturedRequest?.platform, 'desktop_windows');
  assert.equal(capturedRequest?.architecture, 'x86_64');
  assert.equal(capturedRequest?.currentVersion, '0.2.0');
});

await runTest('updateService still prefers runtimeInfo.system.arch when it is already populated', async () => {
  let capturedRequest: AppUpdateCheckRequest | null = null;
  const service = createUpdateService({
    env: createAppEnvConfig({
      VITE_API_BASE_URL: 'https://api.sdkwork.com',
      VITE_APP_ID: '42',
      VITE_PLATFORM: 'desktop',
    }),
    getRuntimeInfo: async () => createRuntimeInfo({
      app: {
        version: '0.3.0',
        name: 'Claw Studio',
        target: 'aarch64-apple-darwin',
      },
      system: {
        os: 'macOS 15',
        arch: 'arm64',
        family: 'darwin',
        target: 'aarch64-apple-darwin',
      },
    }),
    getDeviceId: async () => 'device-2',
    checkAppUpdate: async (request) => {
      capturedRequest = request;
      return {
        hasUpdate: false,
        updateRequired: false,
        forceUpdate: false,
        currentVersion: request.currentVersion,
        targetVersion: request.currentVersion,
        highlights: [],
        resolvedPackage: null,
        frameworkPayload: null,
      };
    },
  });

  await service.checkForAppUpdate();

  assert.equal(capturedRequest?.platform, 'desktop_macos');
  assert.equal(capturedRequest?.architecture, 'arm64');
  assert.equal(capturedRequest?.currentVersion, '0.3.0');
});

await runTest('updateService derives desktop update platform from the target triple when family and os are unavailable', async () => {
  let capturedRequest: AppUpdateCheckRequest | null = null;
  const service = createUpdateService({
    env: createAppEnvConfig({
      VITE_API_BASE_URL: 'https://api.sdkwork.com',
      VITE_APP_ID: '42',
      VITE_PLATFORM: 'desktop',
    }),
    getRuntimeInfo: async () => createRuntimeInfo({
      app: {
        version: '0.4.0',
        name: 'Claw Studio',
        target: 'aarch64-apple-darwin',
      },
      system: {
        os: '',
        arch: '',
        family: '',
        target: 'aarch64-apple-darwin',
      },
    }),
    getDeviceId: async () => 'device-3',
    checkAppUpdate: async (request) => {
      capturedRequest = request;
      return {
        hasUpdate: false,
        updateRequired: false,
        forceUpdate: false,
        currentVersion: request.currentVersion,
        targetVersion: request.currentVersion,
        highlights: [],
        resolvedPackage: null,
        frameworkPayload: null,
      };
    },
  });

  await service.checkForAppUpdate();

  assert.equal(capturedRequest?.platform, 'desktop_macos');
  assert.equal(capturedRequest?.architecture, 'aarch64');
  assert.equal(capturedRequest?.currentVersion, '0.4.0');
});
