import assert from 'node:assert/strict';
import { AUTH_SESSION_STORAGE_KEY } from '@sdkwork/agentstudio-pc-infrastructure';
import { appAuthService } from '../services/index.ts';
import {
  clearAppSdkSessionTokens,
  readAppSdkSessionTokens,
  resetAppSdkClient,
} from '../sdk/useAppSdkClient.ts';
import type { StateStorage } from './simpleStore.ts';
import { createAuthStore } from './authStore.ts';

function createMemoryStorage(): StateStorage {
  const store = new Map<string, string>();

  return {
    getItem(name) {
      return store.get(name) ?? null;
    },
    setItem(name, value) {
      store.set(name, value);
    },
    removeItem(name) {
      store.delete(name);
    },
  };
}

const fetchCalls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];

function readJsonRequestBody(init?: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
}

function installBrowserStorage(storage: StateStorage): void {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'window', { value: { localStorage: storage }, configurable: true });
}

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  fetchCalls.push({ input, init });
  const url = String(input);
  const body = readJsonRequestBody(init);

  if (
    url.endsWith('/app/v3/api/auth/sessions')
    && body.grantType === 'password'
  ) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-login',
        errorName: '',
        data: {
          authToken: 'jwt-token',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: {
            username: body.username,
            email: body.username,
            nickname: 'Night Operator',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/auth/registrations')) {
    return new Response(JSON.stringify({
      code: '2000',
      msg: 'success',
      requestId: 'req-register',
      errorName: '',
      data: {
        authToken: 'register-auth-token',
        accessToken: 'register-access-token',
        refreshToken: 'register-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          username: body.username,
          email: body.email,
          nickname: 'Night Operator',
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.endsWith('/app/v3/api/auth/sessions/current')) {
    return new Response(JSON.stringify({
      code: '2000',
      msg: 'success',
      requestId: 'req-logout',
      errorName: '',
      data: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.endsWith('/app/v3/api/auth/password_reset_requests')) {
    return new Response(JSON.stringify({
      code: '2000',
      msg: 'success',
      requestId: 'req-reset',
      errorName: '',
      data: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (url.endsWith('/app/v3/api/auth/password_resets')) {
    return new Response(JSON.stringify({
      code: '2000',
      msg: 'success',
      requestId: 'req-reset-confirm',
      errorName: '',
      data: null,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
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
          accessToken: 'phone-access-token',
          refreshToken: 'phone-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: {
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
          accessToken: 'email-access-token',
          refreshToken: 'email-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: {
            username: 'operator@example.com',
            email: 'operator@example.com',
            nickname: 'Email Operator',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/oauth/sessions')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-oauth-login',
        errorName: '',
        data: {
          authToken: 'oauth-auth-token',
          accessToken: 'oauth-access-token',
          refreshToken: 'oauth-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          user: {
            username: `${(body.provider || 'oauth').toLowerCase()}-user`,
            email: 'octocat@example.com',
            nickname: 'Octo Cat',
            avatar: 'https://cdn.example.com/octocat.png',
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (url.endsWith('/app/v3/api/oauth/device_authorizations/qr-login-1')) {
    return new Response(
      JSON.stringify({
        code: '2000',
        msg: 'success',
        requestId: 'req-qr-status',
        errorName: '',
        data: {
          deviceAuthorizationId: 'qr-login-1',
          id: 'qr-login-1',
          status: 'completed',
          user: {
            username: 'wechat-user',
            email: 'wechat-user@example.com',
            nickname: 'WeChat User',
            avatar: 'https://cdn.example.com/wechat-user.png',
          },
          session: {
            authToken: 'qr-auth-token',
            accessToken: 'qr-access-token',
            refreshToken: 'qr-refresh-token',
            tokenType: 'Bearer',
            expiresIn: 3600,
            user: {
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

await runTest('useAuthStore signs in and persists the entered email', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const store = createAuthStore(storage);

  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().user, null);

  await store.getState().signIn({
    email: 'night-operator@example.com',
    password: 'secret',
  });

  assert.equal(store.getState().isAuthenticated, true);
  assert.equal(store.getState().user?.email, 'night-operator@example.com');
  assert.match(store.getState().user?.displayName ?? '', /\S/);
  assert.equal(readAppSdkSessionTokens().authToken, 'jwt-token');
  assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
});

await runTest('useAuthStore registers and signs out cleanly', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const store = createAuthStore(storage);

  await store.getState().register({
    name: 'Night Operator',
    email: 'night-operator@example.com',
    password: 'secret',
  });

  assert.equal(store.getState().isAuthenticated, true);
  assert.equal(store.getState().user?.displayName, 'Night Operator');

  await store.getState().signOut();

  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().user, null);
  assert.equal(readAppSdkSessionTokens().authToken, undefined);
  assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
});

await runTest('useAuthStore sends password reset requests through the backend auth client', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const store = createAuthStore(storage);

  await store.getState().requestPasswordReset({
    account: ' night-operator@example.com ',
    channel: 'EMAIL',
  });

  const resetRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/password_reset_requests'),
  );

  assert.ok(resetRequest);
  assert.equal(resetRequest.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(resetRequest.init?.body ?? '{}')), {
    account: 'night-operator@example.com',
    channel: 'EMAIL',
  });
});

await runTest('useAuthStore signs in with phone verification codes', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const store = createAuthStore(storage);

  const user = await store.getState().signInWithPhoneCode({
    phone: '13800138000',
    code: '123456',
  });

  assert.equal(store.getState().isAuthenticated, true);
  assert.equal(user.displayName, 'Phone Operator');

  const phoneLoginRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/sessions'),
  );

  assert.ok(phoneLoginRequest);
  assert.deepEqual(JSON.parse(String(phoneLoginRequest.init?.body ?? '{}')), {
    grantType: 'phone_code',
    phone: '13800138000',
    code: '123456',
  });
});

await runTest('useAuthStore signs in with email verification codes', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const store = createAuthStore(storage);

  const user = await store.getState().signInWithEmailCode({
    email: 'operator@example.com',
    code: '654321',
  });

  assert.equal(store.getState().isAuthenticated, true);
  assert.equal(user.displayName, 'Email Operator');

  const emailLoginRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/sessions'),
  );

  assert.ok(emailLoginRequest);
  assert.deepEqual(JSON.parse(String(emailLoginRequest.init?.body ?? '{}')), {
    grantType: 'email_code',
    email: 'operator@example.com',
    code: '654321',
  });
});

await runTest('useAuthStore confirms password reset with verification codes', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const store = createAuthStore(storage);

  await store.getState().resetPassword({
    account: 'operator@example.com',
    code: '654321',
    newPassword: 'new-secret',
  });

  const resetPasswordRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/auth/password_resets'),
  );

  assert.ok(resetPasswordRequest);
  assert.deepEqual(JSON.parse(String(resetPasswordRequest.init?.body ?? '{}')), {
    account: 'operator@example.com',
    code: '654321',
    newPassword: 'new-secret',
    confirmPassword: 'new-secret',
  });
});

await runTest('useAuthStore clears stale persisted auth state when the app sdk session token is missing', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  storage.setItem(
    'agent-studio-auth-storage',
    JSON.stringify({
      state: {
        isAuthenticated: true,
        user: {
          firstName: 'Night',
          lastName: 'Operator',
          email: 'night-operator@example.com',
          displayName: 'Night Operator',
          initials: 'NO',
        },
      },
      version: 0,
    }),
  );

  const store = createAuthStore(storage);

  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().user, null);
});

await runTest('useAuthStore signs in with OAuth providers and persists the returned identity', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const store = createAuthStore(storage);

  const user = await store.getState().signInWithOAuth({
    provider: 'github',
    code: 'oauth-code',
    state: 'oauth-state',
    deviceType: 'web',
  });

  assert.equal(store.getState().isAuthenticated, true);
  assert.equal(user.email, 'octocat@example.com');
  assert.equal(user.displayName, 'Octo Cat');

  const oauthLoginRequest = fetchCalls.find(({ input }) =>
    String(input).endsWith('/app/v3/api/oauth/sessions'),
  );

  assert.ok(oauthLoginRequest);
  assert.deepEqual(JSON.parse(String(oauthLoginRequest.init?.body ?? '{}')), {
    provider: 'GITHUB',
    code: 'oauth-code',
    state: 'oauth-state',
    deviceType: 'web',
  });
  assert.equal(readAppSdkSessionTokens().authToken, 'oauth-auth-token');
  assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
});

await runTest('useAuthStore applies confirmed qr login sessions into auth state', async () => {
  const storage = createMemoryStorage();
  installBrowserStorage(storage);
  const store = createAuthStore(storage);
  const qrStatus = await appAuthService.checkLoginQrCodeStatus('qr-login-1');

  assert.equal(qrStatus.status, 'confirmed');
  assert.ok(qrStatus.session);

  const user = store.getState().applySession(qrStatus.session!);

  assert.equal(store.getState().isAuthenticated, true);
  assert.equal(user.email, 'wechat-user@example.com');
  assert.equal(user.displayName, 'WeChat User');
  assert.equal(user.initials, 'WU');
});
