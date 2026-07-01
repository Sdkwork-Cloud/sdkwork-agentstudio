import assert from 'node:assert/strict';
import { createAppEnvConfig } from '../config/env.ts';
import {
  checkAppUpdate,
  type AppUpdateCheckRequest,
} from './updateClient.ts';

async function runTest(name: string, callback: () => Promise<void>) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const sampleRequest: AppUpdateCheckRequest = {
  appId: 42,
  runtime: 'TAURI',
  platform: 'desktop_windows',
  architecture: 'x86_64',
  currentVersion: '0.1.0',
  buildNumber: '100',
  releaseChannel: 'stable',
  packageName: 'claw-studio',
  bundleId: 'com.sdkwork.claw-studio',
  deviceId: 'device-1',
  osVersion: 'Windows 11',
  locale: 'zh-CN',
  metadata: {
    distributionId: 'global',
  },
};

function createMockSdkClientFactory() {
  let apiKey: string | null = null;
  let setApiKeyCalls = 0;

  return {
    readApiKey() {
      return apiKey;
    },
    readSetApiKeyCalls() {
      return setApiKeyCalls;
    },
    clientFactory() {
      return {
        setApiKey(nextApiKey: string) {
          setApiKeyCalls += 1;
          apiKey = nextApiKey;
          return this;
        },
        app: {
          async checkAppUpdate(request: AppUpdateCheckRequest) {
            return {
              code: 0,
              message: 'ok',
              data: {
                hasUpdate: request.currentVersion === '0.1.0',
                currentVersion: request.currentVersion,
                targetVersion: request.currentVersion === '0.1.0' ? '0.2.0' : request.currentVersion,
                updateUrl:
                  request.currentVersion === '0.1.0'
                    ? 'https://downloads.sdkwork.com/claw-studio-0.2.0'
                    : undefined,
                deliveryType: request.currentVersion === '0.1.0' ? 'DOWNLOAD_URL' : undefined,
                releaseChannel: request.releaseChannel,
                resolvedPackage:
                  request.currentVersion === '0.1.0'
                    ? {
                        url: 'https://downloads.sdkwork.com/claw-studio-0.2.0.exe',
                        packageFormat: 'nsis',
                        architecture: 'x86_64',
                      }
                    : undefined,
                metadata: request.metadata,
              },
            };
          },
        },
      };
    },
  };
}

await runTest('checkAppUpdate never applies browser root tokens to the generated sdk client', async () => {
  const appSdk = createMockSdkClientFactory();
  const env = createAppEnvConfig({
    VITE_API_BASE_URL: 'http://localhost:8080/',
    SDKWORK_ACCESS_TOKEN: 'Bearer desktop-token',
    VITE_APP_ID: '42',
  });

  const result = await checkAppUpdate(sampleRequest, {
    env,
    clientFactory: appSdk.clientFactory,
  });

  assert.equal(appSdk.readSetApiKeyCalls(), 0);
  assert.equal(appSdk.readApiKey(), null);
  assert.equal(result.hasUpdate, true);
  assert.equal(result.targetVersion, '0.2.0');
  assert.equal(result.resolvedPackage?.url, 'https://downloads.sdkwork.com/claw-studio-0.2.0.exe');
});

await runTest('checkAppUpdate omits Authorization when no access token is configured', async () => {
  const appSdk = createMockSdkClientFactory();
  const env = createAppEnvConfig({
    VITE_API_BASE_URL: 'http://localhost:8080',
    VITE_APP_ID: '42',
  });

  await checkAppUpdate(sampleRequest, {
    env,
    clientFactory: appSdk.clientFactory,
  });

  assert.equal(appSdk.readSetApiKeyCalls(), 0);
  assert.equal(appSdk.readApiKey(), null);
});
