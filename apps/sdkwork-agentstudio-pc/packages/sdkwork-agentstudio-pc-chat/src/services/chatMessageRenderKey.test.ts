import assert from 'node:assert/strict';
import { resolveChatMessageRenderKey } from './chatMessageRenderKey.ts';

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

await runTest(
  'resolveChatMessageRenderKey namespaces explicit message ids by session id',
  () => {
    assert.equal(
      resolveChatMessageRenderKey({
        sessionId: 'session-a',
        message: {
          id: 'msg-1',
          role: 'assistant',
          timestamp: 100,
        },
        index: 0,
      }),
      'session:session-a:msg:msg-1',
    );
  },
);

await runTest(
  'resolveChatMessageRenderKey falls back to messageId and keeps different sessions isolated',
  () => {
    assert.equal(
      resolveChatMessageRenderKey({
        sessionId: 'session-a',
        message: {
          messageId: 'shared-id',
          role: 'assistant',
          timestamp: 101,
        },
        index: 0,
      }),
      'session:session-a:msg:shared-id',
    );
    assert.equal(
      resolveChatMessageRenderKey({
        sessionId: 'session-b',
        message: {
          messageId: 'shared-id',
          role: 'assistant',
          timestamp: 101,
        },
        index: 0,
      }),
      'session:session-b:msg:shared-id',
    );
  },
);

await runTest(
  'resolveChatMessageRenderKey uses upstream-style role timestamp fallback when ids are unavailable',
  () => {
    assert.equal(
      resolveChatMessageRenderKey({
        sessionId: 'session-a',
        message: {
          role: 'user',
          timestamp: 102,
        },
        index: 3,
      }),
      'session:session-a:msg:user:102:3',
    );
    assert.equal(
      resolveChatMessageRenderKey({
        sessionId: 'session-a',
        message: {
          role: 'assistant',
        },
        index: 4,
      }),
      'session:session-a:msg:assistant:4',
    );
  },
);

await runTest(
  'resolveChatMessageRenderKey keeps duplicate sequence fallback messages distinct within one session',
  () => {
    const firstKey = resolveChatMessageRenderKey({
      sessionId: 'session-a',
      message: {
        role: 'assistant',
        seq: 7,
      } as {
        role: string;
        seq: number;
      },
      index: 4,
    });
    const secondKey = resolveChatMessageRenderKey({
      sessionId: 'session-a',
      message: {
        role: 'assistant',
        seq: 7,
      } as {
        role: string;
        seq: number;
      },
      index: 5,
    });

    assert.notEqual(firstKey, secondKey);
  },
);

await runTest(
  'resolveChatMessageRenderKey prefers authoritative message sequence before index-based fallbacks',
  () => {
    assert.equal(
      resolveChatMessageRenderKey({
        sessionId: 'session-a',
        message: {
          role: 'assistant',
          seq: 7,
        } as {
          role: string;
          seq: number;
        },
        index: 4,
      }),
      'session:session-a:msg:seq:7:4',
    );
  },
);
