import assert from 'node:assert/strict';
import { hasRenderableChatMessagePayload } from './chatMessageRenderability.ts';

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
  'hasRenderableChatMessagePayload treats notice-only messages as renderable so kernel errors are not dropped from the conversation',
  () => {
    assert.equal(
      hasRenderableChatMessagePayload({
        content: '',
        attachments: [],
        toolCards: [],
        notices: [
          {
            code: 'kernel-error',
            text: 'Kernel execution failed.',
            level: 'error',
          },
        ],
      }),
      true,
    );
  },
);
