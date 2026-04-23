import assert from 'node:assert/strict';
import {
  detectChatOperationalEvent,
  detectChatJsonBlock,
  presentChatToolCardsSummary,
  sanitizeChatOperationalMessageText,
} from './chatMessageStructuredContent.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('detectChatJsonBlock formats object payloads and exposes key summaries', () => {
  assert.deepEqual(
    detectChatJsonBlock('{"status":"ok","files":["a.ts","b.ts"]}'),
    {
      kind: 'object',
      pretty: '{\n  "status": "ok",\n  "files": [\n    "a.ts",\n    "b.ts"\n  ]\n}',
      keyCount: 2,
      keys: ['status', 'files'],
    },
  );
});

await runTest('detectChatJsonBlock formats arrays and reports the item count', () => {
  assert.deepEqual(
    detectChatJsonBlock('[{"id":1},{"id":2},{"id":3}]'),
    {
      kind: 'array',
      pretty: '[\n  {\n    "id": 1\n  },\n  {\n    "id": 2\n  },\n  {\n    "id": 3\n  }\n]',
      itemCount: 3,
    },
  );
});

await runTest('detectChatJsonBlock ignores plain text and oversize payloads', () => {
  assert.equal(detectChatJsonBlock('plain text response'), null);
  assert.equal(
    detectChatJsonBlock(`{"payload":"${'x'.repeat(20_001)}"}`),
    null,
  );
});

await runTest('detectChatOperationalEvent extracts reminder metadata and summary from structured reminder text', () => {
  assert.deepEqual(
    detectChatOperationalEvent(
      '[2026-04-23 09:00] A scheduled reminder has been triggered. The reminder content is: Prepare the weekly status update. Handle this reminder internally. Current time: 2026-04-23 09:00',
    ),
    {
      kind: 'reminder',
      badgeLabel: 'Reminder',
      summary: 'Prepare the weekly status update.',
      scheduledAtLabel: '2026-04-23 09:00',
      currentTimeLabel: '2026-04-23 09:00',
    },
  );
});

await runTest('detectChatOperationalEvent supports localized reminder and task payloads', () => {
  assert.deepEqual(
    detectChatOperationalEvent(
      '[2026-04-23 09:00] \u63d0\u9192\uff1a\u660e\u5929 9 \u70b9\u5f00\u4f1a\u3002 Current time: 2026-04-23 09:00',
    ),
    {
      kind: 'reminder',
      badgeLabel: '\u63d0\u9192',
      summary: '\u660e\u5929 9 \u70b9\u5f00\u4f1a\u3002',
      scheduledAtLabel: '2026-04-23 09:00',
      currentTimeLabel: '2026-04-23 09:00',
    },
  );

  assert.deepEqual(
    detectChatOperationalEvent(
      '\u4efb\u52a1\uff1a\u6574\u7406\u5468\u62a5\u3002 Handle this task internally. Current time: 2026-04-23 09:30',
    ),
    {
      kind: 'task',
      badgeLabel: '\u4efb\u52a1',
      summary: '\u6574\u7406\u5468\u62a5\u3002',
      currentTimeLabel: '2026-04-23 09:30',
    },
  );
});

await runTest('sanitizeChatOperationalMessageText collapses operational payloads to the visible summary', () => {
  assert.equal(
    sanitizeChatOperationalMessageText(
      'A scheduled reminder has been triggered. The reminder content is: Reply to the vendor. Do not relay it to the user unless explicitly requested. Current time: 2026-04-23 12:00',
    ),
    'Reply to the vendor.',
  );
});

await runTest('presentChatToolCardsSummary compacts tool names for collapsed summaries', () => {
  assert.deepEqual(
    presentChatToolCardsSummary({
      toolCards: [
        { kind: 'call', name: 'Bash' },
        { kind: 'result', name: 'Bash' },
        { kind: 'call', name: 'Read' },
        { kind: 'result', name: 'Write' },
      ],
      previewText: '',
    }),
    {
      totalCount: 4,
      visibleNames: ['Bash', 'Read'],
      hiddenCount: 1,
      previewText: null,
    },
  );
});

await runTest('presentChatToolCardsSummary falls back to a sanitized preview when no tool names are usable', () => {
  assert.deepEqual(
    presentChatToolCardsSummary({
      toolCards: [
        { kind: 'call', name: '   ' },
      ],
      previewText: '  tool output with\nmultiple   spaces  ',
    }),
    {
      totalCount: 1,
      visibleNames: [],
      hiddenCount: 0,
      previewText: 'tool output with multiple spaces',
    },
  );
});
