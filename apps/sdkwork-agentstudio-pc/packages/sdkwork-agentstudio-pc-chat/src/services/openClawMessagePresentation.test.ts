import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  resolveOpenClawMessagePresentation,
} from './openClawMessagePresentation.ts';

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

await runTest(
  'resolveOpenClawMessagePresentation strips assistant-only scaffolding and keeps visible text blocks',
  () => {
    assert.deepEqual(
      resolveOpenClawMessagePresentation({
        role: 'assistant',
        content: [
          {
            type: 'thinking',
            thinking: 'Plan A',
          },
          {
            type: 'text',
            text: [
              '<relevant-memories>',
              'internal memory',
              '</relevant-memories>',
              '<thinking>hidden chain of thought</thinking>',
              'Visible answer',
            ].join('\n'),
          },
        ],
      }),
      {
        role: 'assistant',
        text: 'Visible answer',
        phase: null,
        reasoning: 'Plan A',
        toolCards: [],
      },
    );
  },
);

await runTest(
  'resolveOpenClawMessagePresentation turns tool payloads into user-friendly cards instead of raw json text',
  () => {
    assert.deepEqual(
      resolveOpenClawMessagePresentation({
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-call-bash-1',
            name: 'Bash',
            input: {
              command: 'ls -la',
            },
          },
          {
            type: 'tool_result',
            tool_call_id: 'tool-call-bash-1',
            name: 'Bash',
            text: 'Command failed',
            is_error: true,
          },
        ],
      }),
      {
        role: 'tool',
        text: '',
        phase: null,
        reasoning: null,
        toolCards: [
          {
            kind: 'call',
            name: 'Bash',
            toolCallId: 'tool-call-bash-1',
            argumentsText: '{"command":"ls -la"}',
            detail: 'ls -la',
          },
          {
            kind: 'result',
            name: 'Bash',
            toolCallId: 'tool-call-bash-1',
            text: 'Command failed',
            isError: true,
            preview: 'Error: Command failed',
          },
        ],
      },
    );
  },
);

await runTest(
  'resolveOpenClawMessagePresentation extracts sender labels from inbound metadata when the gateway payload omits a top-level sender label',
  () => {
    assert.deepEqual(
      resolveOpenClawMessagePresentation({
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              'Sender (untrusted metadata):',
              '```json',
              '{"label":"Iris","id":"1"}',
              '```',
              '',
              'Conversation info (untrusted metadata):',
              '```json',
              '{"sender":"Iris"}',
              '```',
              '',
              'Hello from the external channel',
            ].join('\n'),
          },
        ],
      }),
      {
        role: 'user',
        text: 'Hello from the external channel',
        phase: null,
        reasoning: null,
        senderLabel: 'Iris',
        toolCards: [],
      },
    );
  },
);

await runTest(
  'resolveOpenClawMessagePresentation suppresses assistant commentary text while preserving phase metadata',
  () => {
    assert.deepEqual(
      resolveOpenClawMessagePresentation({
        role: 'assistant',
        phase: 'commentary',
        content: [
          {
            type: 'text',
            text: 'Planning the next steps before the final answer.',
          },
        ],
      }),
      {
        role: 'assistant',
        text: '',
        phase: 'commentary',
        reasoning: null,
        toolCards: [],
      },
    );
  },
);

await runTest(
  'resolveOpenClawMessagePresentation repairs UTF-8 mojibake before rendering chat text',
  () => {
    assert.equal(
      resolveOpenClawMessagePresentation({
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: encodeUtf8AsLatin1('你好，OpenClaw 会话已经修复。'),
          },
        ],
      }).text,
      '你好，OpenClaw 会话已经修复。',
    );
  },
);
