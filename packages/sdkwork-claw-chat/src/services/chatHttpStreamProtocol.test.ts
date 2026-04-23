import assert from 'node:assert/strict';

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
