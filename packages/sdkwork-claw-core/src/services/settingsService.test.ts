import assert from 'node:assert/strict';
import { createSettingsService } from './settingsService.ts';

function createStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

const storage = createStorage();
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  configurable: true,
});

let requestLog: Array<{
  url: string;
  method: string;
  body?: Record<string, unknown>;
}> = [];

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createTestSettingsService() {
  return createSettingsService({
    getClient: () => ({
      user: {
        async getUserProfile() {
          return (await fetch('http://localhost/app/v3/api/user/profile')).json();
        },
        async updateUserProfile(body: Record<string, unknown>) {
          return (
            await fetch('http://localhost/app/v3/api/user/profile', {
              method: 'PUT',
              body: JSON.stringify(body),
            })
          ).json();
        },
        async changePassword(body: Record<string, unknown>) {
          return (
            await fetch('http://localhost/app/v3/api/user/password', {
              method: 'PUT',
              body: JSON.stringify(body),
            })
          ).json();
        },
      },
    }),
  });
}

function resetFetchState() {
  requestLog = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;

    requestLog.push({
      url,
      method,
      body,
    });

    return jsonResponse({ code: 404, message: 'Not found' }, 404);
  }) as typeof fetch;
}

function assertNoRemoteNotificationRequests() {
  assert.deepEqual(
    requestLog.filter((entry) => entry.url.includes('/app/v3/api/notification/settings')),
    [],
  );
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  storage.clear();
  resetFetchState();
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('settingsService persists general preferences across reads', async () => {
  const settingsService = createTestSettingsService();
  const initial = await settingsService.getPreferences();
  assert.equal(initial.general.launchOnStartup, false);
  assert.equal(initial.general.compactModelSelector, true);

  const updated = await settingsService.updatePreferences({
    general: {
      launchOnStartup: true,
      startMinimized: true,
      compactModelSelector: false,
    },
  });

  assert.equal(updated.general.launchOnStartup, true);
  assert.equal(updated.general.startMinimized, true);
  assert.equal(updated.general.compactModelSelector, false);

  const reloaded = await settingsService.getPreferences();
  assert.equal(reloaded.general.launchOnStartup, true);
  assert.equal(reloaded.general.startMinimized, true);
  assert.equal(reloaded.general.compactModelSelector, false);
  assertNoRemoteNotificationRequests();
});

await runTest('settingsService keeps security and privacy overlays across reloads', async () => {
  const settingsService = createTestSettingsService();
  await settingsService.updatePreferences({
    privacy: {
      shareUsageData: true,
      personalizedRecommendations: true,
    },
    security: {
      twoFactorAuth: true,
      loginAlerts: false,
    },
  });

  const reloaded = await settingsService.getPreferences();
  assert.equal(reloaded.privacy.shareUsageData, true);
  assert.equal(reloaded.privacy.personalizedRecommendations, true);
  assert.equal(reloaded.security.twoFactorAuth, true);
  assert.equal(reloaded.security.loginAlerts, false);
  assertNoRemoteNotificationRequests();
});

await runTest('settingsService persists notification preferences locally without remote sdk routes', async () => {
  const settingsService = createTestSettingsService();
  const updated = await settingsService.updatePreferences({
    notifications: {
      systemUpdates: false,
      taskFailures: false,
      securityAlerts: false,
      taskCompletions: false,
      newMessages: true,
    },
  });

  assert.deepEqual(updated.notifications, {
    systemUpdates: false,
    taskFailures: false,
    securityAlerts: false,
    taskCompletions: false,
    newMessages: true,
  });

  const reloaded = await settingsService.getPreferences();
  assert.deepEqual(reloaded.notifications, {
    systemUpdates: false,
    taskFailures: false,
    securityAlerts: false,
    taskCompletions: false,
    newMessages: true,
  });
  assertNoRemoteNotificationRequests();
});

await runTest('settingsService keeps local preferences available even when fetch is unavailable', async () => {
  const settingsService = createTestSettingsService();
  await settingsService.updatePreferences({
    general: {
      launchOnStartup: true,
      startMinimized: true,
      compactModelSelector: false,
    },
    notifications: {
      systemUpdates: false,
      taskFailures: false,
      securityAlerts: false,
      taskCompletions: false,
      newMessages: false,
    },
  });

  globalThis.fetch = (async () => {
    throw new Error('network unavailable');
  }) as typeof fetch;

  const preferences = await settingsService.getPreferences();
  assert.deepEqual(preferences.general, {
    launchOnStartup: true,
    startMinimized: true,
    compactModelSelector: false,
  });
  assert.deepEqual(preferences.notifications, {
    systemUpdates: false,
    taskFailures: false,
    securityAlerts: false,
    taskCompletions: false,
    newMessages: false,
  });
});

await runTest('settingsService reads default preferences when legacy browser storage is blocked', async () => {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('localStorage is blocked', 'SecurityError');
    },
  });

  const settingsService = createSettingsService({
    getClient: () => ({
      user: {
        async getUserProfile() {
          return { code: 0, data: {} };
        },
        async updateUserProfile() {
          return { code: 0, data: {} };
        },
        async changePassword() {
          return { code: 0, data: null };
        },
      },
    }),
    storageApi: {
      async getText() {
        throw new Error('platform storage unavailable');
      },
      async putText() {
        throw new Error('platform storage unavailable');
      },
      async removeText() {
        throw new Error('platform storage unavailable');
      },
      async listKeys() {
        throw new Error('platform storage unavailable');
      },
    },
  });

  try {
    const preferences = await settingsService.getPreferences();

    assert.deepEqual(preferences.general, {
      launchOnStartup: false,
      startMinimized: false,
      compactModelSelector: true,
    });
    assert.deepEqual(preferences.privacy, {
      shareUsageData: false,
      personalizedRecommendations: false,
    });
  } finally {
    if (previousDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', previousDescriptor);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  }
});

await runTest('settingsService surfaces remote profile failures instead of falling back to mock data', async () => {
  const settingsService = createTestSettingsService();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith('/app/v3/api/user/profile') && (!init?.method || init.method === 'GET')) {
      return new Response(JSON.stringify({ code: '5000', msg: 'Profile lookup failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ code: 404, message: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  await assert.rejects(
    settingsService.getProfile(),
    /Profile lookup failed|500/,
  );
});

await runTest('settingsService preserves empty remote profile names instead of forcing a placeholder identity', async () => {
  const settingsService = createTestSettingsService();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith('/app/v3/api/user/profile') && (!init?.method || init.method === 'GET')) {
      return jsonResponse({
        code: 0,
        data: {
          email: 'profile@example.com',
          avatar: 'https://cdn.example.com/avatar.png',
        },
      });
    }

    return jsonResponse({ code: 404, message: 'Not found' }, 404);
  }) as typeof fetch;

  const profile = await settingsService.getProfile();

  assert.deepEqual(profile, {
    firstName: '',
    lastName: '',
    email: 'profile@example.com',
    avatarUrl: 'https://cdn.example.com/avatar.png',
  });
});
