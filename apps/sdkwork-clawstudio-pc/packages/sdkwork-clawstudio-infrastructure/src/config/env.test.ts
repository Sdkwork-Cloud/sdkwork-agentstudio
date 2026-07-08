import assert from 'node:assert/strict';
import {
  createAppEnvConfig,
  getApiUrl,
  hasDesktopUpdateConfig,
} from './env.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('createAppEnvConfig applies defaults and normalizes the base URL', () => {
  const env = createAppEnvConfig({
    VITE_API_BASE_URL: 'http://localhost:8080/',
  });

  assert.equal(env.appEnv, 'development');
  assert.equal(env.api.baseUrl, 'http://localhost:8080');
  assert.equal(getApiUrl('/app/v3/api/update/check', env), 'http://localhost:8080/app/v3/api/update/check');
});

runTest('createAppEnvConfig ignores browser-side root access tokens', () => {
  const env = createAppEnvConfig({
    SDKWORK_ACCESS_TOKEN: '  Bearer test-token  ',
  });

  assert.equal(Object.prototype.hasOwnProperty.call(env, 'auth'), false);
  assert.equal((env as Record<string, unknown>).auth, undefined);
});

runTest('hasDesktopUpdateConfig reports readiness only when base URL and app id exist', () => {
  const missingAppId = createAppEnvConfig({
    VITE_API_BASE_URL: 'http://localhost:8080',
  });
  const ready = createAppEnvConfig({
    VITE_API_BASE_URL: 'http://localhost:8080',
    VITE_APP_ID: '42',
  });

  assert.equal(hasDesktopUpdateConfig(missingAppId), false);
  assert.equal(hasDesktopUpdateConfig(ready), true);
  assert.equal(ready.update.appId, 42);
});

runTest('createAppEnvConfig keeps startup update checks enabled by default', () => {
  const env = createAppEnvConfig({});

  assert.equal(env.update.enableStartupCheck, true);
  assert.equal(env.platform.isDesktop, false);
});
