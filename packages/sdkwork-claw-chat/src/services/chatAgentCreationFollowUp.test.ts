import assert from 'node:assert/strict';
import {
  CHAT_AGENT_CREATION_FOLLOW_UP_COMPLETED,
  createChatAgentCreationFollowUpFailure,
  normalizeChatAgentCreationFollowUpResult,
} from './chatAgentCreationFollowUp.ts';

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

await runTest('normalizeChatAgentCreationFollowUpResult defaults missing follow-up state to completed', () => {
  assert.deepEqual(
    normalizeChatAgentCreationFollowUpResult(undefined),
    CHAT_AGENT_CREATION_FOLLOW_UP_COMPLETED,
  );
});

await runTest('normalizeChatAgentCreationFollowUpResult preserves an activation failure result', () => {
  const activationFailure = {
    status: 'activationFailed' as const,
    errorMessage: 'Failed to switch to the created agent.',
  };

  assert.deepEqual(
    normalizeChatAgentCreationFollowUpResult(activationFailure),
    activationFailure,
  );
});

await runTest('createChatAgentCreationFollowUpFailure keeps explicit Error messages for follow-up failures', () => {
  assert.deepEqual(
    createChatAgentCreationFollowUpFailure(new Error('Failed to hydrate target instance.')),
    {
      status: 'activationFailed',
      errorMessage: 'Failed to hydrate target instance.',
    },
  );
});

await runTest('createChatAgentCreationFollowUpFailure also normalizes non-Error values', () => {
  assert.deepEqual(createChatAgentCreationFollowUpFailure('Selection stalled'), {
    status: 'activationFailed',
    errorMessage: 'Selection stalled',
  });
});
