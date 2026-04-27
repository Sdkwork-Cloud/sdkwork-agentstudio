import assert from 'node:assert/strict';
import { presentOpenClawToolLinkItems } from './chatToolLinksPresentation.ts';

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
  'presentOpenClawToolLinkItems gives call and result cards distinct ids even when OpenClaw reuses the same toolCallId',
  () => {
    const items = presentOpenClawToolLinkItems({
      toolCards: [
        {
          kind: 'call',
          name: 'web_search',
          toolCallId: 'tool-web-search',
          detail: 'openclaw session title sync',
        },
        {
          kind: 'result',
          name: 'web_search',
          toolCallId: 'tool-web-search',
          preview: 'Found matching docs.',
        },
      ],
      labels: {
        call: 'Tool call',
        result: 'Tool result',
      },
    });

    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((item) => item.id),
      [
        'tool-web-search:call:0',
        'tool-web-search:result:1',
      ],
    );
    assert.deepEqual(
      items.map((item) => item.label),
      ['web_search', 'web_search 2'],
    );
    assert.deepEqual(
      items.map((item) => item.typeLabel),
      ['Tool call', 'Tool result'],
    );
  },
);
