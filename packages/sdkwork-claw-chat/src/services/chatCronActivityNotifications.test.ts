import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectChatCronActivityNotification } from './chatCronActivityNotifications.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'detectChatCronActivityNotification emits a start notification when a cron run begins',
  () => {
    assert.deepEqual(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:cron:nightly-sync',
          title: 'Nightly Sync',
          lastMessagePreview: 'Waiting to run',
          runId: null,
        },
        nextSession: {
          id: 'agent:main:cron:nightly-sync',
          title: 'Nightly Sync',
          lastMessagePreview: 'Preparing execution',
          runId: 'run-1',
        },
      }),
      {
        kind: 'started',
        title: 'Cron: Nightly Sync',
        body: 'Preparing execution',
        sessionId: 'agent:main:cron:nightly-sync',
      },
    );
  },
);

await runTest(
  'detectChatCronActivityNotification emits a completion notification when a cron run finishes',
  () => {
    assert.deepEqual(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'Running',
          runId: 'run-1',
        },
        nextSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'Sent the morning briefing to Slack.',
          runId: null,
        },
      }),
      {
        kind: 'completed',
        title: 'Cron: Daily Briefing',
        body: 'Sent the morning briefing to Slack.',
        sessionId: 'agent:main:cron:daily-briefing',
      },
    );
  },
);

await runTest(
  'detectChatCronActivityNotification falls back to the generic body when the preview is only a technical message id',
  () => {
    assert.deepEqual(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'Running',
          runId: 'run-1',
        },
        nextSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'message-42',
          runId: null,
        },
      }),
      {
        kind: 'completed',
        title: 'Cron: Daily Briefing',
        body: 'Cron job completed.',
        sessionId: 'agent:main:cron:daily-briefing',
      },
    );
  },
);

await runTest(
  'detectChatCronActivityNotification ignores non-cron sessions and unchanged cron runs',
  () => {
    assert.equal(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:main',
          title: 'Main Session',
          lastMessagePreview: 'hello',
          runId: null,
        },
        nextSession: {
          id: 'agent:main:main',
          title: 'Main Session',
          lastMessagePreview: 'hello again',
          runId: 'run-1',
        },
      }),
      null,
    );

    assert.equal(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'Still running',
          runId: 'run-1',
        },
        nextSession: {
          id: 'agent:main:cron:daily-briefing',
          title: 'Daily Briefing',
          lastMessagePreview: 'Still running',
          runId: 'run-1',
        },
      }),
      null,
    );
  },
);

await runTest(
  'detectChatCronActivityNotification compares kernel session run state before legacy mirrors',
  () => {
    assert.deepEqual(
      detectChatCronActivityNotification({
        previousSession: {
          id: 'agent:main:cron:nightly-sync',
          title: 'Nightly Sync',
          lastMessagePreview: 'Waiting to run',
          runId: null,
          kernelSession: {
            ref: {
              kernelId: 'openclaw',
              instanceId: 'instance-1',
              sessionId: 'agent:main:cron:nightly-sync',
            },
            authority: {
              kind: 'gateway',
              source: 'kernel',
              durable: true,
              writable: true,
            },
            lifecycle: 'ready',
            title: 'Nightly Sync',
            createdAt: 1,
            updatedAt: 1,
            messageCount: 0,
            activeRunId: null,
          },
        },
        nextSession: {
          id: 'agent:main:cron:nightly-sync',
          title: 'Nightly Sync',
          lastMessagePreview: 'Preparing execution',
          runId: null,
          kernelSession: {
            ref: {
              kernelId: 'openclaw',
              instanceId: 'instance-1',
              sessionId: 'agent:main:cron:nightly-sync',
            },
            authority: {
              kind: 'gateway',
              source: 'kernel',
              durable: true,
              writable: true,
            },
            lifecycle: 'running',
            title: 'Nightly Sync',
            createdAt: 1,
            updatedAt: 2,
            messageCount: 0,
            activeRunId: 'kernel-run-1',
          },
        },
      }),
      {
        kind: 'started',
        title: 'Cron: Nightly Sync',
        body: 'Preparing execution',
        sessionId: 'agent:main:cron:nightly-sync',
      },
    );
  },
);

await runTest(
  'chatCronActivityNotifications reuses the shared run binding source instead of duplicating run state fields',
  () => {
    const source = readFileSync(new URL('./chatCronActivityNotifications.ts', import.meta.url), 'utf8');
    assert.match(
      source,
      /import\s*\{\s*resolveChatRunBinding,\s*type ChatRunBindingSource\s*\}\s*from '\.\/chatRunBinding\.ts';/,
    );
    assert.doesNotMatch(source, /runId\?: string \| null;/);
    assert.doesNotMatch(source, /activeRunId\?: string \| null;/);
  },
);
