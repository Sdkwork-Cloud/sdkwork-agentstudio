import assert from 'node:assert/strict';
import {
  CHAT_SIDEBAR_SELECTION_COMPLETED,
  createChatSidebarSelectionFailure,
} from './chatSidebarSelectionResult.ts';

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

await runTest('sidebar selection completed result keeps a null error payload', () => {
  assert.deepEqual(CHAT_SIDEBAR_SELECTION_COMPLETED, {
    status: 'completed',
    errorMessage: null,
  });
});

await runTest('sidebar selection failure prefers the thrown Error message', () => {
  assert.deepEqual(
    createChatSidebarSelectionFailure(
      new Error('Failed to hydrate the selected instance.'),
      'Fallback message',
    ),
    {
      status: 'failed',
      errorMessage: 'Failed to hydrate the selected instance.',
    },
  );
});

await runTest('sidebar selection failure falls back to the localized default when the error is opaque', () => {
  assert.deepEqual(createChatSidebarSelectionFailure(null, 'Could not switch sessions.'), {
    status: 'failed',
    errorMessage: 'Could not switch sessions.',
  });
});
