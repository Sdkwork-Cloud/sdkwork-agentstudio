import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  getChatSessionDisplayTitle,
  normalizeChatSessionTitle,
} from './chatSessionTitlePresentation.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function encodeUtf8AsLatin1(value: string) {
  return Buffer.from(value, 'utf8').toString('latin1');
}

await runTest('normalizeChatSessionTitle collapses whitespace and trims the title', () => {
  assert.equal(
    normalizeChatSessionTitle('  Review\n\nOpenClaw install flow   on macOS and Windows\t '),
    'Review OpenClaw install flow on macOS and Windows',
  );
});

await runTest('getChatSessionDisplayTitle prefers the first user message when the stored title is still the default', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'New Conversation',
      messages: [
        {
          role: 'user',
          content: '  Compare Gemini CLI and Claude Code router mapping strategy  ',
        },
      ],
      lastMessagePreview: undefined,
    }),
    'Compare Gemini CLI and Claude Code router mapping strategy',
  );
});

await runTest('getChatSessionDisplayTitle falls back to the first readable assistant message when no user message exists', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'session-alpha(2026-04-26)',
      messages: [
        {
          role: 'assistant',
          content: '  I found the root cause in the OpenClaw gateway history sync.  ',
        },
      ],
      lastMessagePreview: undefined,
    }),
    'I found the root cause in the OpenClaw gateway history sync.',
  );
});

await runTest('getChatSessionDisplayTitle skips empty title candidates before falling back to a readable conversation message', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'New Conversation',
      messages: [
        {
          role: 'user',
          content: '   ',
        },
        {
          role: 'assistant',
          content: 'Recovered title from the first readable message.',
        },
      ],
      lastMessagePreview: undefined,
    }),
    'Recovered title from the first readable message.',
  );
});

await runTest('normalizeChatSessionTitle repairs mojibake before rendering session titles', () => {
  assert.equal(
    normalizeChatSessionTitle(encodeUtf8AsLatin1('修复聊天对话乱码')),
    '修复聊天对话乱码',
  );
});

await runTest('getChatSessionDisplayTitle uses up to 300 characters from the first user message when no readable title exists', () => {
  const longPrompt = `${'A'.repeat(150)} ${'B'.repeat(150)} ${'C'.repeat(40)}`;
  const displayTitle = getChatSessionDisplayTitle({
    title: '2026-04-26 10:58',
    messages: [
      {
        role: 'user',
        content: longPrompt,
      },
    ],
    lastMessagePreview: 'Assistant preview must not become the title',
  });

  assert.equal(displayTitle.length, 300);
  assert.equal(displayTitle, `${longPrompt.slice(0, 297).trimEnd()}...`);
  assert.notEqual(displayTitle, '2026-04-26 10:58');
});

await runTest('getChatSessionDisplayTitle never promotes the latest message preview into the session title', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'agent-studio:instance-a:session-1',
      messages: [],
      lastMessagePreview: '  Investigate the latest billing sync failure and summarize the root cause  ',
    }),
    'New Conversation',
  );
});

await runTest('getChatSessionDisplayTitle repairs legacy preview-backed titles from the first user message', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'Assistant latest update that belongs only in preview',
      messages: [
        {
          role: 'user',
          content: 'Diagnose why the desktop hosted runtime starts degraded',
        },
        {
          role: 'assistant',
          content: 'Assistant latest update that belongs only in preview',
        },
      ],
      lastMessagePreview: 'Assistant latest update that belongs only in preview',
    }),
    'Diagnose why the desktop hosted runtime starts degraded',
  );
});

await runTest('getChatSessionDisplayTitle prefers the first user message over weak technical runtime labels', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'openclaw-tui',
      messages: [
        {
          role: 'user',
          content: '  Draft a human-friendly install checklist for Windows, macOS, and Linux  ',
        },
      ],
      lastMessagePreview: 'Follow-up preview that should not win',
    }),
    'Draft a human-friendly install checklist for Windows, macOS, and Linux',
  );
});

await runTest('getChatSessionDisplayTitle treats generic main session labels as an untitled chat instead of latest preview text', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'main',
      messages: [],
      lastMessagePreview: '  Summarize the first user request instead of showing a runtime slot name  ',
    }),
    'New Conversation',
  );
});

await runTest('getChatSessionDisplayTitle treats date and time labels as non-title metadata', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: '2026-04-26',
      messages: [
        {
          role: 'user',
          content: 'Fix the OpenClaw startup failure and kernel retry loop',
        },
      ],
      lastMessagePreview: 'Assistant reply that must not become the title',
    }),
    'Fix the OpenClaw startup failure and kernel retry loop',
  );

  assert.equal(
    getChatSessionDisplayTitle({
      title: '2026-04-26 10:58',
      messages: [],
      lastMessagePreview: 'Readable assistant summary that must stay out of the title',
    }),
    'New Conversation',
  );

  assert.equal(
    getChatSessionDisplayTitle({
      title: '10:58',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'New Conversation',
  );

  assert.equal(
    getChatSessionDisplayTitle({
      title: '20260426105830',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'New Conversation',
  );

  assert.equal(
    getChatSessionDisplayTitle({
      title: '04/26/2026 10:58',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'New Conversation',
  );
});

await runTest('getChatSessionDisplayTitle treats id plus date labels as non-title metadata', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'thread-agent-studio-20260426105830(2026-04-26)',
      messages: [
        {
          role: 'user',
          content: 'Explain why the OpenClaw kernel session title is not persisted',
        },
      ],
      lastMessagePreview: 'Assistant reply that must not become the title',
    }),
    'Explain why the OpenClaw kernel session title is not persisted',
  );

  assert.equal(
    getChatSessionDisplayTitle({
      title: 'session-abc123(2026-04-26)',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'New Conversation',
  );

  assert.equal(
    getChatSessionDisplayTitle({
      title: 'agent-studio:instance-a:session-1 (2026-04-26)',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'New Conversation',
  );

  assert.equal(
    getChatSessionDisplayTitle({
      title: 'f3a9c2id(2026-04-26)',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'New Conversation',
  );

  assert.equal(
    getChatSessionDisplayTitle({
      title: 'openclaw7d9f2a(2026-04-26)',
      messages: [
        {
          role: 'user',
          content: 'Use the first message instead of a generated runtime id with a date',
        },
      ],
      lastMessagePreview: undefined,
    }),
    'Use the first message instead of a generated runtime id with a date',
  );
});

await runTest('getChatSessionDisplayTitle preserves natural language titles that contain dates', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'Agent roadmap (2026-04-26)',
      titleSource: 'explicit',
      messages: [
        {
          role: 'user',
          content: 'This prompt should not replace the explicit dated title',
        },
      ],
      lastMessagePreview: undefined,
    }),
    'Agent roadmap (2026-04-26)',
  );
});

await runTest('getChatSessionDisplayTitle uses a stable main-session fallback for agent main session keys', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      id: 'agent:research:main',
      title: 'main',
      messages: [],
      lastMessagePreview: 'Assistant follow-up that must stay out of the title',
    }),
    'Main Session',
  );
});

await runTest('getChatSessionDisplayTitle preserves an explicit title over a newer assistant preview', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'Desktop runtime startup failures',
      titleSource: 'explicit',
      messages: [
        {
          role: 'assistant',
          content: 'I found several likely causes in the logs.',
        },
      ],
      lastMessagePreview: 'I found several likely causes in the logs.',
    }),
    'Desktop runtime startup failures',
  );
});

await runTest('getChatSessionDisplayTitle prefixes explicit subagent labels to match openclaw naming', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      id: 'agent:main:subagent:abc-123',
      title: 'Task Runner',
      titleSource: 'explicit',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'Subagent: Task Runner',
  );
});

await runTest('getChatSessionDisplayTitle prefixes explicit cron labels to match openclaw naming', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      id: 'agent:main:cron:abc-123',
      title: 'Nightly Sync',
      titleSource: 'explicit',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'Cron: Nightly Sync',
  );
});

await runTest('getChatSessionDisplayTitle does not double-prefix typed session labels', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      id: 'agent:main:subagent:abc-123',
      title: 'Subagent: Runner',
      titleSource: 'explicit',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'Subagent: Runner',
  );
});

await runTest('getChatSessionDisplayTitle falls back to openclaw typed defaults when no readable content exists', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      id: 'agent:main:subagent:abc-123',
      title: 'agent:main:subagent:abc-123',
      titleSource: 'default',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'Subagent:',
  );

  assert.equal(
    getChatSessionDisplayTitle({
      id: 'agent:main:cron:abc-123',
      title: 'agent:main:cron:abc-123',
      titleSource: 'default',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'Cron Job:',
  );
});

await runTest('getChatSessionDisplayTitle hides machine session ids when no readable content exists', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'agent:research:main',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'New Conversation',
  );
});

await runTest('getChatSessionDisplayTitle hides agent thread session ids when no readable content exists', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'agent:research:main:thread:agent-studio:session-1',
      messages: [],
      lastMessagePreview: undefined,
    }),
    'New Conversation',
  );
});

await runTest('getChatSessionDisplayTitle hides technical message preview ids when no readable content exists', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'New Conversation',
      messages: [],
      lastMessagePreview: 'message-42',
    }),
    'New Conversation',
  );
});

await runTest('getChatSessionDisplayTitle prefers kernel-authored first user message text over legacy content mirrors', () => {
  assert.equal(
    getChatSessionDisplayTitle({
      title: 'New Conversation',
      messages: [
        {
          role: 'user',
          content: 'Legacy mirrored prompt',
          kernelMessage: {
            id: 'message-1',
            sessionRef: {
              kernelId: 'openclaw',
              instanceId: 'instance-1',
              sessionId: 'session-1',
            },
            role: 'user',
            status: 'complete',
            createdAt: 1,
            updatedAt: 1,
            text: 'Kernel authored prompt',
            parts: [
              {
                kind: 'text',
                text: 'Kernel authored prompt',
              },
            ],
          },
        },
      ],
      lastMessagePreview: undefined,
    }),
    'Kernel authored prompt',
  );
});
