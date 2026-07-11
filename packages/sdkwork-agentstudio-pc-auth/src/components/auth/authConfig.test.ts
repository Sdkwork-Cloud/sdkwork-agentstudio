import assert from 'node:assert/strict';
import {
  DEFAULT_AUTH_LOGIN_METHODS,
  DEFAULT_AUTH_OAUTH_PROVIDERS,
  DEFAULT_AUTH_RECOVERY_METHODS,
  DEFAULT_AUTH_REGISTER_METHODS,
  clearAuthRuntimeConfig,
  getAuthRuntimeConfig,
  looksLikeEmailAddress,
  looksLikePhoneNumber,
  isAuthQrLoginEnabled,
  isAuthOAuthLoginEnabled,
  setAuthRuntimeConfig,
  resolveAuthLoginMethods,
  resolveAuthOAuthProviders,
  resolveAuthRecoveryMethods,
  resolveAuthRegisterMethods,
} from './authConfig.ts';

type RuntimeConfigShape = {
  loginMethods?: string[];
  registerMethods?: string[];
  recoveryMethods?: string[];
  oauthProviders?: string[];
  qrLoginEnabled?: boolean;
  oauthLoginEnabled?: boolean;
};

function withRuntimeConfig(
  config: RuntimeConfigShape | undefined,
  run: () => void,
) {
  const runtime = globalThis as typeof globalThis & {
    __SDKWORK_CLAW_AUTH_CONFIG__?: RuntimeConfigShape;
  };
  const previous = runtime.__SDKWORK_CLAW_AUTH_CONFIG__;

  runtime.__SDKWORK_CLAW_AUTH_CONFIG__ = config;

  try {
    run();
  } finally {
    runtime.__SDKWORK_CLAW_AUTH_CONFIG__ = previous;
  }
}

withRuntimeConfig(undefined, () => {
  assert.deepEqual(resolveAuthLoginMethods(), DEFAULT_AUTH_LOGIN_METHODS);
  assert.deepEqual(resolveAuthRegisterMethods(), DEFAULT_AUTH_REGISTER_METHODS);
  assert.deepEqual(resolveAuthRecoveryMethods(), DEFAULT_AUTH_RECOVERY_METHODS);
  assert.deepEqual(resolveAuthOAuthProviders(), DEFAULT_AUTH_OAUTH_PROVIDERS);
  assert.equal(isAuthQrLoginEnabled(), true);
  assert.equal(isAuthOAuthLoginEnabled(), true);
});

withRuntimeConfig(
  {
    loginMethods: ['emailCode', 'password', 'password'],
    registerMethods: ['phone'],
    recoveryMethods: ['phone'],
    oauthProviders: ['github', 'microsoft', 'github'],
    qrLoginEnabled: false,
    oauthLoginEnabled: false,
  },
  () => {
    assert.deepEqual(resolveAuthLoginMethods(), ['emailCode', 'password']);
    assert.deepEqual(resolveAuthRegisterMethods(), ['phone']);
    assert.deepEqual(resolveAuthRecoveryMethods(), ['phone']);
    assert.deepEqual(resolveAuthOAuthProviders(), ['github', 'microsoft']);
    assert.equal(isAuthQrLoginEnabled(), false);
    assert.equal(isAuthOAuthLoginEnabled(), false);
  },
);

assert.equal(looksLikeEmailAddress('designer@sdkwork.com'), true);
assert.equal(looksLikeEmailAddress('not-an-email'), false);
assert.equal(looksLikePhoneNumber('+86 138 0013 8000'), true);
assert.equal(looksLikePhoneNumber('workspace-admin'), false);

clearAuthRuntimeConfig();
assert.equal(getAuthRuntimeConfig(), undefined);
setAuthRuntimeConfig({
  loginMethods: ['password', 'emailCode'],
  qrLoginEnabled: false,
});
assert.deepEqual(getAuthRuntimeConfig(), {
  loginMethods: ['password', 'emailCode'],
  qrLoginEnabled: false,
});
clearAuthRuntimeConfig();
assert.equal(getAuthRuntimeConfig(), undefined);

console.log('ok - authConfig resolves auth method and OAuth provider configuration');
