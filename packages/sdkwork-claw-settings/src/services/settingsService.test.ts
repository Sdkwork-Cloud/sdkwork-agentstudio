import assert from 'node:assert/strict';
import {
  createSettingsService,
  type CreateSettingsServiceOptions,
} from './settingsService.ts';

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

function createNotificationSettingsState() {
  return {
    enablePush: true,
    enableEmail: true,
    enableInApp: true,
    typeSettings: {
      TASK: { enableEmail: true, enableInApp: true },
      SECURITY: { enableEmail: true, enablePush: true },
      MESSAGE: { enableInApp: true },
    },
  };
}

let notificationSettingsState = createNotificationSettingsState();
let notificationRequestLog: Array<{
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
  const client: Awaited<ReturnType<NonNullable<CreateSettingsServiceOptions['getClient']>>> = {
    user: {
      async getUserProfile() {
        return (await fetch('http://localhost/app/v3/api/user/profile')).json();
      },
      async updateUserProfile(body) {
        return (
          await fetch('http://localhost/app/v3/api/user/profile', {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        ).json();
      },
      async changePassword(body) {
        return (
          await fetch('http://localhost/app/v3/api/user/password', {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        ).json();
      },
    },
    notification: {
      async getNotificationSettings() {
        return (await fetch('http://localhost/app/v3/api/notification/settings')).json();
      },
      async updateNotificationSettings(body) {
        return (
          await fetch('http://localhost/app/v3/api/notification/settings', {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        ).json();
      },
      async updateTypeSettings(type, body) {
        return (
          await fetch(
            `http://localhost/app/v3/api/notification/settings/${encodeURIComponent(String(type))}`,
            {
              method: 'PUT',
              body: JSON.stringify(body),
            },
          )
        ).json();
      },
    },
  };

  return createSettingsService({
    getClient: () => client,
  });
}

function resetNotificationFetchState() {
  notificationSettingsState = createNotificationSettingsState();
  notificationRequestLog = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;

    notificationRequestLog.push({
      url,
      method,
      body,
    });

    if (url.endsWith('/app/v3/api/notification/settings') && method === 'GET') {
      return jsonResponse({
        code: 0,
        data: notificationSettingsState,
      });
    }

    if (url.endsWith('/app/v3/api/notification/settings') && method === 'PUT') {
      notificationSettingsState = {
        ...notificationSettingsState,
        ...(body ?? {}),
      };
      return jsonResponse({
        code: 0,
        data: notificationSettingsState,
      });
    }

    const typeSettingsMatch = url.match(/\/app\/v3\/api\/notification\/settings\/([^/?#]+)$/);
    if (typeSettingsMatch && method === 'PUT') {
      const type = decodeURIComponent(typeSettingsMatch[1] || '');
      notificationSettingsState = {
        ...notificationSettingsState,
        typeSettings: {
          ...notificationSettingsState.typeSettings,
          [type]: {
            ...(notificationSettingsState.typeSettings[type as keyof typeof notificationSettingsState.typeSettings] ?? {}),
            ...(body ?? {}),
          },
        },
      };

      return jsonResponse({ code: 0, data: null });
    }

    return jsonResponse({ code: 404, message: 'Not found' }, 404);
  }) as typeof fetch;
}

async function runTest(name: string, fn: () => Promise<void> | void) {
  storage.clear();
  resetNotificationFetchState();
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
});

await runTest('settingsService keeps security and privacy overlays when notification settings reload', async () => {
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
});

await runTest('settingsService still updates local-only preferences when notification settings authentication expires', async () => {
  const settingsService = createTestSettingsService();

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.endsWith('/app/v3/api/notification/settings') && method === 'GET') {
      return jsonResponse(
        {
          code: '4010',
          msg: 'token expired',
        },
        401,
      );
    }

    return jsonResponse({ code: 404, message: 'Not found' }, 404);
  }) as typeof fetch;

  const updated = await settingsService.updatePreferences({
    general: {
      launchOnStartup: true,
      startMinimized: true,
      compactModelSelector: false,
    },
    privacy: {
      shareUsageData: true,
      personalizedRecommendations: true,
    },
    security: {
      twoFactorAuth: true,
      loginAlerts: false,
    },
  });

  assert.deepEqual(updated.general, {
    launchOnStartup: true,
    startMinimized: true,
    compactModelSelector: false,
  });
  assert.deepEqual(updated.privacy, {
    shareUsageData: true,
    personalizedRecommendations: true,
  });
  assert.deepEqual(updated.security, {
    twoFactorAuth: true,
    loginAlerts: false,
  });
  assert.deepEqual(updated.notifications, {
    systemUpdates: true,
    taskFailures: true,
    securityAlerts: true,
    taskCompletions: true,
    newMessages: true,
  });
});

await runTest('settingsService updates notification globals and per-type switches through app sdk routes', async () => {
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

  assert.equal(notificationSettingsState.enableEmail, false);
  assert.equal(notificationSettingsState.enableInApp, true);
  assert.equal(notificationSettingsState.typeSettings.TASK.enableEmail, false);
  assert.equal(notificationSettingsState.typeSettings.TASK.enableInApp, false);
  assert.equal(notificationSettingsState.typeSettings.SECURITY.enableEmail, false);
  assert.equal(notificationSettingsState.typeSettings.MESSAGE.enableInApp, true);

  assert.deepEqual(
    notificationRequestLog
      .filter((entry) => entry.method === 'PUT')
      .map((entry) => entry.url.replace(/^.*\/app\/v3\/api/, '')),
    [
      '/notification/settings',
      '/notification/settings/TASK',
      '/notification/settings/SECURITY',
      '/notification/settings/MESSAGE',
    ],
  );

  assert.equal(updated.notifications.systemUpdates, false);
  assert.equal(updated.notifications.taskFailures, false);
  assert.equal(updated.notifications.securityAlerts, false);
  assert.equal(updated.notifications.taskCompletions, false);
  assert.equal(updated.notifications.newMessages, true);
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
