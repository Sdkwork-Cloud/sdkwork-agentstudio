import assert from 'node:assert/strict';
import {
  type ChatCronActivityNotification,
  deliverChatCronActivityNotifications,
} from './chatCronActivityNotificationRuntime.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function createNotification(kind: ChatCronActivityNotification['kind']): ChatCronActivityNotification {
  return {
    kind,
    title: kind === 'completed' ? 'Cron: Digest' : 'Cron: Warmup',
    body: kind === 'completed' ? 'Cron job completed.' : 'Cron job started.',
    sessionId: `cron:session:${kind}`,
  };
}

await runTest('chat cron notification runtime skips in-app and system notifications when new message notifications are disabled', async () => {
  const toastCalls: ChatCronActivityNotification[] = [];
  const systemCalls: ChatCronActivityNotification[] = [];

  await deliverChatCronActivityNotifications({
    notifications: [createNotification('completed')],
    loadPreferences: async () => ({
      notifications: {
        newMessages: false,
      },
    }),
    showToast: (notification) => {
      toastCalls.push(notification);
    },
    shouldShowSystemNotification: () => true,
    showSystemNotification: async (notification) => {
      systemCalls.push(notification);
    },
  });

  assert.deepEqual(toastCalls, []);
  assert.deepEqual(systemCalls, []);
});

await runTest('chat cron notification runtime emits in-app and system notifications when new message notifications are enabled', async () => {
  const toastCalls: ChatCronActivityNotification[] = [];
  const systemCalls: ChatCronActivityNotification[] = [];
  const started = createNotification('started');
  const completed = createNotification('completed');

  await deliverChatCronActivityNotifications({
    notifications: [started, completed],
    loadPreferences: async () => ({
      notifications: {
        newMessages: true,
      },
    }),
    showToast: (notification) => {
      toastCalls.push(notification);
    },
    shouldShowSystemNotification: () => true,
    showSystemNotification: async (notification) => {
      systemCalls.push(notification);
    },
  });

  assert.deepEqual(toastCalls, [started, completed]);
  assert.deepEqual(systemCalls, [started, completed]);
});

await runTest('chat cron notification runtime suppresses system notifications while the app stays focused', async () => {
  const toastCalls: ChatCronActivityNotification[] = [];
  const systemCalls: ChatCronActivityNotification[] = [];
  const completed = createNotification('completed');

  await deliverChatCronActivityNotifications({
    notifications: [completed],
    loadPreferences: async () => ({
      notifications: {
        newMessages: true,
      },
    }),
    showToast: (notification) => {
      toastCalls.push(notification);
    },
    shouldShowSystemNotification: () => false,
    showSystemNotification: async (notification) => {
      systemCalls.push(notification);
    },
  });

  assert.deepEqual(toastCalls, [completed]);
  assert.deepEqual(systemCalls, []);
});
