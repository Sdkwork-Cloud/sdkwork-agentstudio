import assert from 'node:assert/strict';
import {
  clearAppSdkSessionTokens,
  initAppSdkClient,
  readAppSdkSessionTokens,
  resetAppSdkClient,
} from '../sdk/useAppSdkClient.ts';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.get(key) ?? null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

function installBrowserStorage(storage: Storage): void {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });
}

const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

function readJsonRequestBody(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  fetchCalls.push({ input, init });
  const url = String(input);
  const body = readJsonRequestBody(init);

  if (url.endsWith('/app/v3/api/auth/oauth_authorization_urls')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-oauth-url',
        errorName: '',
        data: {
          authUrl: 'https://oauth.example.com/authorize?client_id=demo',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/auth/oauth_sessions')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-oauth-login',
        errorName: '',
        data: {
          authToken: 'oauth-auth-token',
          accessToken: 'oauth-payload-access-token',
          refreshToken: 'oauth-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          userInfo: {
            username: 'octocat',
            email: 'octocat@example.com',
            nickname: 'Octo Cat',
            avatar: 'https://cdn.example.com/octocat.png',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (
    url.endsWith('/app/v3/api/auth/sessions')
    && body.grantType === 'phone_code'
  ) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-phone-login',
        errorName: '',
        data: {
          authToken: 'phone-auth-token',
          accessToken: 'phone-payload-access-token',
          refreshToken: 'phone-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          userInfo: {
            username: '13800138000',
            phone: '13800138000',
            nickname: 'Phone Operator',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (
    url.endsWith('/app/v3/api/auth/sessions')
    && body.grantType === 'email_code'
  ) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-email-login',
        errorName: '',
        data: {
          authToken: 'email-auth-token',
          accessToken: 'email-payload-access-token',
          refreshToken: 'email-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          userInfo: {
            username: 'operator@example.com',
            email: 'operator@example.com',
            nickname: 'Email Operator',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/messaging/verification_codes')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-verify-send',
        errorName: '',
        data: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/messaging/verification_codes/verify')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-verify-check',
        errorName: '',
        data: {
          valid: true,
          verified: true,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/auth/password_resets')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-password-reset',
        errorName: '',
        data: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/open_platform/qr_auth/sessions')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-qr-generate',
        errorName: '',
        data: {
          type: 'WECHAT_OFFICIAL_ACCOUNT',
          title: 'WeChat QR Login',
          description: 'Scan with the official account.',
          sessionKey: 'qr-login-1',
          qrCode: {
            kind: 'image',
            source: 'external_url',
            url: 'https://cdn.example.com/qr-login-1.png',
          },
          qrContent: 'https://sdkwork.com/app/v3/api/auth/qr/entry/qr-login-1',
          expireTime: 300,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/open_platform/qr_auth/sessions/qr-login-1')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-qr-status',
        errorName: '',
        data: {
          status: 'completed',
          userInfo: {
            username: 'wechat-user',
            email: 'wechat-user@example.com',
            nickname: 'WeChat User',
            avatar: 'https://cdn.example.com/wechat-user.png',
          },
          token: {
            authToken: 'qr-auth-token',
            accessToken: 'qr-payload-access-token',
            refreshToken: 'qr-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            userInfo: {
              username: 'wechat-user',
              email: 'wechat-user@example.com',
              nickname: 'WeChat User',
              avatar: 'https://cdn.example.com/wechat-user.png',
            },
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(JSON.stringify({ code: 404, message: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    fetchCalls.length = 0;
    resetAppSdkClient();
    clearAppSdkSessionTokens();
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('appAuthService requests OAuth authorization URLs through the generated app sdk auth client', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const { appAuthService } = await import('./appAuthService.ts');

  const authUrl = await appAuthService.getOAuthAuthorizationUrl({
    provider: 'github',
    redirectUri: 'https://studio.example.com/login/oauth/callback/github?redirect=%2Fchat',
    state: 'redirect:/chat',
  });

  assert.equal(authUrl, 'https://oauth.example.com/authorize?client_id=demo');

  const oauthUrlRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/oauth_authorization_urls'),
  );

  assert.ok(oauthUrlRequest);
  assert.equal(oauthUrlRequest.init?.method, 'GET');
});

await runTest('appAuthService maps Douyin OAuth authorization through the generated app sdk auth client', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const { appAuthService } = await import('./appAuthService.ts');

  await appAuthService.getOAuthAuthorizationUrl({
    provider: 'douyin',
    redirectUri: 'https://studio.example.com/login/oauth/callback/douyin',
    scope: 'user_info',
    state: 'douyin:/chat',
  });

  const oauthUrlRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/oauth_authorization_urls'),
  );

  assert.ok(oauthUrlRequest);
  assert.equal(oauthUrlRequest.init?.method, 'GET');
});

await runTest('appAuthService completes OAuth login and persists returned session tokens', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  initAppSdkClient({ accessToken: 'configured-access-token' });
  const { appAuthService } = await import('./appAuthService.ts');

  const session = await appAuthService.loginWithOAuth({
    provider: 'github',
    code: 'oauth-code',
    state: 'oauth-state',
    deviceType: 'web',
  });

  assert.equal(session.authToken, 'oauth-auth-token');
  assert.equal(session.accessToken, 'oauth-payload-access-token');
  assert.equal(session.refreshToken, 'oauth-refresh-token');
  assert.equal(session.userInfo?.nickname, 'Octo Cat');
  assert.equal(readAppSdkSessionTokens().authToken, 'oauth-auth-token');
  assert.equal(readAppSdkSessionTokens().accessToken, 'oauth-payload-access-token');
  assert.equal(readAppSdkSessionTokens().refreshToken, 'oauth-refresh-token');

  const oauthLoginRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/oauth_sessions'),
  );

  assert.ok(oauthLoginRequest);
  assert.equal(oauthLoginRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(oauthLoginRequest.init?.body ?? '{}')), {
    provider: 'GITHUB',
    code: 'oauth-code',
    state: 'oauth-state',
    deviceType: 'web',
  });
});

await runTest('appAuthService completes Douyin OAuth login through the generated app sdk auth client', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const { appAuthService } = await import('./appAuthService.ts');

  await appAuthService.loginWithOAuth({
    provider: 'douyin',
    code: 'douyin-oauth-code',
    state: 'douyin-state',
    deviceType: 'web',
  });

  const oauthLoginRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/oauth_sessions'),
  );

  assert.ok(oauthLoginRequest);
  assert.deepEqual(JSON.parse(String(oauthLoginRequest.init?.body ?? '{}')), {
    provider: 'DOUYIN',
    code: 'douyin-oauth-code',
    state: 'douyin-state',
    deviceType: 'web',
  });
});

await runTest('appAuthService generates login qr payloads from backend qr metadata', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const { appAuthService } = await import('./appAuthService.ts');

  const qrCode = await appAuthService.generateLoginQrCode();

  assert.deepEqual(qrCode, {
    type: 'WECHAT_OFFICIAL_ACCOUNT',
    title: 'WeChat QR Login',
    description: 'Scan with the official account.',
    qrKey: 'qr-login-1',
    qrUrl: 'https://cdn.example.com/qr-login-1.png',
    qrContent: 'https://sdkwork.com/app/v3/api/auth/qr/entry/qr-login-1',
    expireTime: 300,
  });
});

await runTest('appAuthService persists confirmed qr login sessions while polling qr status', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  initAppSdkClient({ accessToken: 'configured-access-token' });
  const { appAuthService } = await import('./appAuthService.ts');

  const result = await appAuthService.checkLoginQrCodeStatus('qr-login-1');

  assert.equal(result.status, 'confirmed');
  assert.equal(result.session?.authToken, 'qr-auth-token');
  assert.equal(result.session?.accessToken, 'qr-payload-access-token');
  assert.equal(result.session?.userInfo?.nickname, 'WeChat User');
  assert.equal(readAppSdkSessionTokens().authToken, 'qr-auth-token');
  assert.equal(readAppSdkSessionTokens().accessToken, 'qr-payload-access-token');
  assert.equal(readAppSdkSessionTokens().refreshToken, 'qr-refresh-token');
});

await runTest('appAuthService completes phone verification-code login through the generated app sdk auth client', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  initAppSdkClient({ accessToken: 'configured-access-token' });
  const { appAuthService } = await import('./appAuthService.ts');

  const session = await appAuthService.loginWithPhone({
    phone: '13800138000',
    code: '123456',
  });

  assert.equal(session.authToken, 'phone-auth-token');
  assert.equal(session.accessToken, 'phone-payload-access-token');
  assert.equal(session.refreshToken, 'phone-refresh-token');
  assert.equal(session.userInfo?.nickname, 'Phone Operator');

  const phoneLoginRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/sessions'),
  );

  assert.ok(phoneLoginRequest);
  assert.equal(phoneLoginRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(phoneLoginRequest.init?.body ?? '{}')), {
    grantType: 'phone_code',
    phone: '13800138000',
    code: '123456',
  });
});

await runTest('appAuthService completes email verification-code login through the generated app sdk auth client', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  initAppSdkClient({ accessToken: 'configured-access-token' });
  const { appAuthService } = await import('./appAuthService.ts');

  const session = await appAuthService.loginWithEmail({
    email: 'operator@example.com',
    code: '654321',
  });

  assert.equal(session.authToken, 'email-auth-token');
  assert.equal(session.accessToken, 'email-payload-access-token');
  assert.equal(session.refreshToken, 'email-refresh-token');
  assert.equal(session.userInfo?.nickname, 'Email Operator');

  const emailLoginRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/sessions'),
  );

  assert.ok(emailLoginRequest);
  assert.equal(emailLoginRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(emailLoginRequest.init?.body ?? '{}')), {
    grantType: 'email_code',
    email: 'operator@example.com',
    code: '654321',
  });
});

await runTest('appAuthService sends email verification codes through the generic verify endpoint', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const { appAuthService } = await import('./appAuthService.ts');

  await appAuthService.sendVerifyCode({
    target: 'operator@example.com',
    verifyType: 'EMAIL',
    scene: 'LOGIN',
  });

  const verifySendRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/messaging/verification_codes'),
  );

  assert.ok(verifySendRequest);
  assert.equal(verifySendRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(verifySendRequest.init?.body ?? '{}')), {
    target: 'operator@example.com',
    scene: 'LOGIN',
    verifyType: 'EMAIL',
  });
});

await runTest('appAuthService sends phone verification codes through the generic verify endpoint', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const { appAuthService } = await import('./appAuthService.ts');

  await appAuthService.sendVerifyCode({
    target: '13800138000',
    verifyType: 'PHONE',
    scene: 'REGISTER',
  });

  const verifySendRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/messaging/verification_codes'),
  );

  assert.ok(verifySendRequest);
  assert.equal(verifySendRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(verifySendRequest.init?.body ?? '{}')), {
    target: '13800138000',
    scene: 'REGISTER',
    verifyType: 'PHONE',
  });
});

await runTest('appAuthService verifies codes through the generic verify check endpoint', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const { appAuthService } = await import('./appAuthService.ts');

  const valid = await appAuthService.verifyCode({
    target: 'operator@example.com',
    verifyType: 'EMAIL',
    scene: 'RESET_PASSWORD',
    code: '654321',
  });

  assert.equal(valid, true);

  const verifyCheckRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/messaging/verification_codes/verify'),
  );

  assert.ok(verifyCheckRequest);
  assert.equal(verifyCheckRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(verifyCheckRequest.init?.body ?? '{}')), {
    target: 'operator@example.com',
    scene: 'RESET_PASSWORD',
    verifyType: 'EMAIL',
    code: '654321',
  });
});

await runTest('appAuthService resets passwords through the generated app sdk auth client', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const { appAuthService } = await import('./appAuthService.ts');

  await appAuthService.resetPassword({
    account: 'operator@example.com',
    code: '654321',
    newPassword: 'new-secret',
  });

  const passwordResetRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/password_resets'),
  );

  assert.ok(passwordResetRequest);
  assert.equal(passwordResetRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(passwordResetRequest.init?.body ?? '{}')), {
    account: 'operator@example.com',
    code: '654321',
    newPassword: 'new-secret',
    confirmPassword: 'new-secret',
  });
});

await runTest('appAuthService maps configurable OAuth providers without hard-coded allowlists', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const { appAuthService } = await import('./appAuthService.ts');

  await appAuthService.getOAuthAuthorizationUrl({
    provider: 'microsoft',
    redirectUri: 'https://studio.example.com/login/oauth/callback/microsoft',
    state: 'oauth:microsoft',
  });

  const oauthUrlRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/oauth_authorization_urls'),
  );

  assert.ok(oauthUrlRequest);
  assert.equal(oauthUrlRequest.init?.method, 'GET');
});
