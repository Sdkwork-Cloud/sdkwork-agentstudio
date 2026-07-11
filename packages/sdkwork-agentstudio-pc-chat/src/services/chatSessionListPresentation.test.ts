import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import {
  formatChatSessionRelativeTime,
  presentChatSessionListItem,
} from './chatSessionListPresentation.ts';

const ZH_RELATIVE_TIME_LABELS = {
  yesterday: '昨天',
  daysAgo: (count: number) => `${count}天前`,
};

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

function encodeUtf8AsLatin1(value: string) {
  return Buffer.from(value, 'utf8').toString('latin1');
}

await runTest(
  'presentChatSessionListItem derives sidebar metadata for a running gateway main session',
  () => {
    assert.equal(typeof presentChatSessionListItem, 'function');

    const presentation = presentChatSessionListItem({
      session: {
        id: 'agent:research:main',
        title: 'main',
        updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
        lastMessagePreview: 'Drafting the final parity report',
        runId: 'run-1',
        messages: [
          {
            role: 'user',
            content: 'Drafting the final parity report',
            timestamp: Date.UTC(2026, 3, 3, 10, 55, 0),
          },
          {
            role: 'assistant',
            content: 'Streaming assistant reply in progress',
            timestamp: Date.UTC(2026, 3, 3, 10, 58, 0),
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      isGatewayMainSession: true,
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.deepEqual(presentation, {
      displayTitle: 'Drafting the final parity report',
      preview: 'Streaming assistant reply in progress',
      relativeTimeLabel: '10:58',
      isRunning: true,
      isPinned: true,
      showDeleteAction: false,
    });
  },
);

await runTest(
  'presentChatSessionListItem suppresses duplicate preview text when it only repeats the title',
  () => {
    assert.equal(typeof presentChatSessionListItem, 'function');

    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:session-1',
        title: 'Release checklist for the desktop build',
        updatedAt: Date.UTC(2026, 3, 3, 10, 30, 0),
        lastMessagePreview: 'Release checklist for the desktop build',
        messages: [
          {
            role: 'user',
            content: 'Release checklist for the desktop build',
            timestamp: Date.UTC(2026, 3, 3, 10, 30, 0),
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      isGatewayMainSession: false,
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(presentation.displayTitle, 'Release checklist for the desktop build');
    assert.equal(presentation.preview, null);
    assert.equal(presentation.relativeTimeLabel, '10:30');
    assert.equal(presentation.isRunning, false);
    assert.equal(presentation.isPinned, false);
    assert.equal(presentation.showDeleteAction, true);
  },
);

await runTest(
  'presentChatSessionListItem hides opaque backend preview ids until readable transcript content exists',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:runtime-preview-id',
        title: 'New Conversation',
        updatedAt: Date.UTC(2026, 3, 3, 10, 31, 0),
        lastMessagePreview: 'thread:agent-studio:instance-a:session-42',
        messages: [],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(presentation.displayTitle, 'New Conversation');
    assert.equal(presentation.preview, null);
  },
);

await runTest(
  'presentChatSessionListItem hides technical message preview ids until readable transcript content exists',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:runtime-message-id',
        title: 'New Conversation',
        updatedAt: Date.UTC(2026, 3, 3, 10, 32, 0),
        lastMessagePreview: 'message-42',
        messages: [],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(presentation.displayTitle, 'New Conversation');
    assert.equal(presentation.preview, null);
  },
);

await runTest(
  'presentChatSessionListItem keeps latest message preview separate from the session title',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:title-preview-boundary',
        title: 'Kernel startup reliability',
        updatedAt: Date.UTC(2026, 3, 3, 10, 33, 0),
        lastMessagePreview: 'Assistant latest update that belongs only in preview',
        messages: [],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(presentation.displayTitle, 'Kernel startup reliability');
    assert.equal(presentation.preview, 'Assistant latest update that belongs only in preview');
  },
);

await runTest(
  'presentChatSessionListItem repairs mojibake in stored titles and previews before rendering',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:mojibake-title-preview',
        title: encodeUtf8AsLatin1('聊天标题正常显示'),
        updatedAt: Date.UTC(2026, 3, 3, 10, 35, 0),
        lastMessagePreview: encodeUtf8AsLatin1('助手回复也不能乱码'),
        messages: [],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(presentation.displayTitle, '聊天标题正常显示');
    assert.equal(presentation.preview, '助手回复也不能乱码');
  },
);

await runTest(
  'presentChatSessionListItem does not use a readable latest message preview as the title for untitled sessions',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:untitled-preview-boundary',
        title: 'New Conversation',
        updatedAt: Date.UTC(2026, 3, 3, 10, 34, 0),
        lastMessagePreview: 'Readable assistant summary that must not become the title',
        messages: [],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(presentation.displayTitle, 'New Conversation');
    assert.equal(presentation.preview, 'Readable assistant summary that must not become the title');
  },
);

await runTest(
  'presentChatSessionListItem repairs legacy preview-backed stored titles from the first user message',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:legacy-preview-title',
        title: 'Assistant latest update that belongs only in preview',
        updatedAt: Date.UTC(2026, 3, 26, 10, 58, 0),
        lastMessagePreview: 'Assistant latest update that belongs only in preview',
        messages: [
          {
            role: 'user',
            content: 'Diagnose why the desktop hosted runtime starts degraded',
            timestamp: Date.UTC(2026, 3, 26, 10, 50, 0),
          },
          {
            role: 'assistant',
            content: 'Assistant latest update that belongs only in preview',
            timestamp: Date.UTC(2026, 3, 26, 10, 58, 0),
          },
        ],
      },
      now: Date.UTC(2026, 3, 26, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(
      presentation.displayTitle,
      'Diagnose why the desktop hosted runtime starts degraded',
    );
    assert.equal(presentation.preview, 'Assistant latest update that belongs only in preview');
  },
);

await runTest(
  'presentChatSessionListItem derives the visible title from the first user message when the stored title is a date',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:date-title-boundary',
        title: '2026-04-26 10:58',
        updatedAt: Date.UTC(2026, 3, 26, 10, 58, 0),
        lastMessagePreview: 'Assistant latest update that belongs only in preview',
        messages: [
          {
            role: 'user',
            content: 'Diagnose why the desktop hosted runtime starts degraded',
            timestamp: Date.UTC(2026, 3, 26, 10, 50, 0),
          },
          {
            role: 'assistant',
            content: 'Assistant latest update that belongs only in preview',
            timestamp: Date.UTC(2026, 3, 26, 10, 58, 0),
          },
        ],
      },
      now: Date.UTC(2026, 3, 26, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(
      presentation.displayTitle,
      'Diagnose why the desktop hosted runtime starts degraded',
    );
    assert.notEqual(presentation.displayTitle, '2026-04-26 10:58');
    assert.equal(presentation.preview, 'Assistant latest update that belongs only in preview');
  },
);

await runTest(
  'presentChatSessionListItem prefixes user previews but still suppresses them when the semantic text only repeats the title',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:user-echo',
        title: 'Release checklist for the desktop build',
        updatedAt: Date.UTC(2026, 3, 3, 10, 30, 0),
        messages: [
          {
            role: 'user',
            content: 'Release checklist for the desktop build',
            timestamp: Date.UTC(2026, 3, 3, 10, 30, 0),
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      previewLabels: {
        you: 'You',
        system: 'System',
        tool: 'Tool',
        attachment: 'Attachment',
        attachments: 'Attachments',
      },
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(presentation.preview, null);
  },
);

await runTest(
  'formatChatSessionRelativeTime uses IM-style recency labels for today, yesterday, recent days, and precise dates',
  () => {
    assert.equal(typeof formatChatSessionRelativeTime, 'function');

    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 3, 10, 59, 40),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
        locale: 'zh-CN',
        timeZone: 'UTC',
        relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      }),
      '10:59',
    );
    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 2, 11, 0, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
        locale: 'zh-CN',
        timeZone: 'UTC',
        relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      }),
      '昨天',
    );
    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 2, 31, 11, 0, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
        locale: 'zh-CN',
        timeZone: 'UTC',
        relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      }),
      '3天前',
    );
    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 2, 12, 11, 0, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
        locale: 'zh-CN',
        timeZone: 'UTC',
        relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      }),
      '03-12',
    );
    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2025, 11, 12, 11, 0, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
        locale: 'zh-CN',
        timeZone: 'UTC',
        relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
      }),
      '2025-12-12',
    );
    assert.equal(
      formatChatSessionRelativeTime({
        updatedAt: Date.UTC(2026, 3, 2, 11, 0, 0),
        now: Date.UTC(2026, 3, 3, 11, 0, 0),
        locale: 'en-US',
        timeZone: 'UTC',
      }),
      'Yesterday',
    );
  },
);

await runTest(
  'presentChatSessionListItem prefers kernel session and message authority for running state and preview text',
  () => {
    assert.equal(typeof presentChatSessionListItem, 'function');

    const presentation = presentChatSessionListItem({
      session: {
        id: 'agent:research:main',
        title: 'main',
        updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
        lastMessagePreview: 'Legacy preview',
        runId: null,
        kernelSession: {
          ref: {
            kernelId: 'openclaw',
            instanceId: 'instance-1',
            sessionId: 'agent:research:main',
          },
          authority: {
            kind: 'gateway',
            source: 'kernel',
            durable: true,
            writable: true,
          },
          lifecycle: 'running',
          title: 'main',
          createdAt: Date.UTC(2026, 3, 3, 10, 40, 0),
          updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
          messageCount: 2,
          activeRunId: 'kernel-run-1',
        },
        messages: [
          {
            role: 'user',
            content: 'Legacy title',
            kernelMessage: {
              id: 'message-1',
              sessionRef: {
                kernelId: 'openclaw',
                instanceId: 'instance-1',
                sessionId: 'agent:research:main',
              },
              role: 'user',
              status: 'complete',
              createdAt: Date.UTC(2026, 3, 3, 10, 55, 0),
              updatedAt: Date.UTC(2026, 3, 3, 10, 55, 0),
              text: 'Kernel title',
              parts: [
                {
                  kind: 'text',
                  text: 'Kernel title',
                },
              ],
            },
          },
          {
            role: 'assistant',
            content: 'Legacy preview',
            kernelMessage: {
              id: 'message-2',
              sessionRef: {
                kernelId: 'openclaw',
                instanceId: 'instance-1',
                sessionId: 'agent:research:main',
              },
              role: 'assistant',
              status: 'streaming',
              createdAt: Date.UTC(2026, 3, 3, 10, 58, 0),
              updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
              text: 'Kernel preview',
              parts: [
                {
                  kind: 'text',
                  text: 'Kernel preview',
                },
              ],
            },
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      isGatewayMainSession: true,
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.deepEqual(presentation, {
      displayTitle: 'Kernel title',
      preview: 'Kernel preview',
      relativeTimeLabel: '10:58',
      isRunning: true,
      isPinned: true,
      showDeleteAction: false,
    });
  },
);

await runTest(
  'presentChatSessionListItem orders preview candidates by authoritative sequence instead of raw message array order',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:seq-preview',
        title: 'Architecture review',
        updatedAt: Date.UTC(2026, 3, 3, 11, 0, 0),
        lastMessagePreview: 'Stale preview',
        messages: [
          {
            role: 'assistant',
            content: 'Legacy assistant preview',
            kernelMessage: {
              id: 'message-2',
              sessionRef: {
                kernelId: 'openclaw',
                instanceId: 'instance-1',
                sessionId: 'thread:seq-preview',
              },
              role: 'assistant',
              status: 'complete',
              createdAt: Date.UTC(2026, 3, 3, 10, 58, 0),
              updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
              text: 'Assistant should win by seq',
              nativeMetadata: {
                seq: 2,
              },
              parts: [
                {
                  kind: 'text',
                  text: 'Assistant should win by seq',
                },
              ],
            },
          },
          {
            role: 'user',
            content: 'Legacy user preview',
            kernelMessage: {
              id: 'message-1',
              sessionRef: {
                kernelId: 'openclaw',
                instanceId: 'instance-1',
                sessionId: 'thread:seq-preview',
              },
              role: 'user',
              status: 'complete',
              createdAt: Date.UTC(2026, 3, 3, 10, 59, 0),
              updatedAt: Date.UTC(2026, 3, 3, 10, 59, 0),
              text: 'User arrived later in the raw array',
              nativeMetadata: {
                seq: 1,
              },
              parts: [
                {
                  kind: 'text',
                  text: 'User arrived later in the raw array',
                },
              ],
            },
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 1, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(presentation.displayTitle, 'Architecture review');
    assert.equal(presentation.preview, 'Assistant should win by seq');
  },
);

await runTest(
  'presentChatSessionListItem formats tool and attachment summaries with localized preview labels',
  () => {
    const toolPresentation = presentChatSessionListItem({
      session: {
        id: 'thread:tool-session',
        title: 'Repo sync',
        updatedAt: Date.UTC(2026, 3, 3, 10, 58, 0),
        messages: [
          {
            role: 'tool',
            content: '',
            toolCards: [
              {
                kind: 'result',
                name: 'repo_sync',
                preview: 'Synced 18 files',
              },
            ],
            timestamp: Date.UTC(2026, 3, 3, 10, 58, 0),
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      previewLabels: {
        you: 'You',
        system: 'System',
        tool: 'Tool',
        attachment: 'Attachment',
        attachments: 'Attachments',
      },
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    const attachmentPresentation = presentChatSessionListItem({
      session: {
        id: 'thread:attachment-session',
        title: 'Asset review',
        updatedAt: Date.UTC(2026, 3, 3, 10, 59, 0),
        messages: [
          {
            role: 'user',
            content: '',
            attachments: [
              {
                id: 'asset-1',
                kind: 'file',
                name: 'report.pdf',
              },
            ],
            timestamp: Date.UTC(2026, 3, 3, 10, 59, 0),
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      previewLabels: {
        you: 'You',
        system: 'System',
        tool: 'Tool',
        attachment: 'Attachment',
        attachments: 'Attachments',
      },
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(toolPresentation.preview, 'Tool: Synced 18 files');
    assert.equal(attachmentPresentation.preview, 'Attachment: report.pdf');
  },
);

await runTest(
  'presentChatSessionListItem surfaces notice-only authoritative errors in the sidebar preview instead of leaving the row blank',
  () => {
    const presentation = presentChatSessionListItem({
      session: {
        id: 'thread:notice-preview',
        title: 'Kernel failure',
        updatedAt: Date.UTC(2026, 3, 3, 10, 59, 0),
        messages: [
          {
            role: 'assistant',
            content: '',
            timestamp: Date.UTC(2026, 3, 3, 10, 59, 0),
            kernelMessage: {
              id: 'message-notice',
              sessionRef: {
                kernelId: 'hermes',
                instanceId: 'instance-1',
                sessionId: 'thread:notice-preview',
              },
              role: 'assistant',
              status: 'error',
              createdAt: Date.UTC(2026, 3, 3, 10, 59, 0),
              updatedAt: Date.UTC(2026, 3, 3, 10, 59, 0),
              text: '',
              parts: [
                {
                  kind: 'notice',
                  code: 'kernel-error',
                  text: 'Hermes kernel execution failed.',
                  level: 'error',
                },
              ],
            },
          },
        ],
      },
      now: Date.UTC(2026, 3, 3, 11, 0, 0),
      locale: 'zh-CN',
      timeZone: 'UTC',
      relativeTimeLabels: ZH_RELATIVE_TIME_LABELS,
    });

    assert.equal(presentation.preview, 'Hermes kernel execution failed.');
  },
);

await runTest(
  'chatSessionListPresentation reuses the shared run binding source instead of duplicating legacy run fields',
  () => {
    const source = readFileSync(new URL('./chatSessionListPresentation.ts', import.meta.url), 'utf8');
    assert.match(
      source,
      /import\s*\{\s*resolveChatRunBinding,\s*type ChatRunBindingSource\s*\}\s*from '\.\/chatRunBinding\.ts';/,
    );
    assert.doesNotMatch(source, /runId\?: string \| null;/);
  },
);
