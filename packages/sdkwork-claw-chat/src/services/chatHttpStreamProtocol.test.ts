import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

import { extractChatHttpStreamTextDeltas } from './chatHttpStreamProtocol.ts';

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
  'extractChatHttpStreamTextDeltas reads OpenAI chat-completions deltas from SSE frames',
  () => {
    assert.deepEqual(
      extractChatHttpStreamTextDeltas(`data: {"choices":[{"delta":{"content":"Hello"}}]}`),
      ['Hello'],
    );
  },
);

await runTest(
  'extractChatHttpStreamTextDeltas reads Responses API output_text deltas without duplicating done events',
  () => {
    assert.deepEqual(
      extractChatHttpStreamTextDeltas(
        `event: response.output_text.delta\ndata: {"delta":"Hello"}\n\n`,
      ),
      ['Hello'],
    );
    assert.deepEqual(
      extractChatHttpStreamTextDeltas(
        `event: response.output_text.done\ndata: {"text":"Hello"}\n\n`,
      ),
      [],
    );
  },
);

await runTest(
  'extractChatHttpStreamTextDeltas ignores Hermes tool progress events so tool telemetry does not pollute assistant text',
  () => {
    assert.deepEqual(
      extractChatHttpStreamTextDeltas(
        `event: hermes.tool.progress\ndata: {"tool_name":"browser.search","phase":"running","message":"Searching..."}\n\n`,
      ),
      [],
    );
  },
);

await runTest(
  'extractChatHttpStreamTextDeltas repairs mojibake text fragments from generic HTTP streams',
  () => {
    const mojibake = encodeUtf8AsLatin1('你好，HTTP 流式消息正常显示。');

    assert.deepEqual(
      extractChatHttpStreamTextDeltas(
        `data: ${JSON.stringify({ choices: [{ delta: { content: mojibake } }] })}`,
      ),
      ['你好，HTTP 流式消息正常显示。'],
    );
  },
);
