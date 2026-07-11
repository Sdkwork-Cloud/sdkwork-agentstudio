import assert from 'node:assert/strict';
import { shouldRenderChatRuntimeWarmersForPath } from './chatRuntimeWarmersPolicy.ts';

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
  'chat runtime warmers stay disabled on auth and oauth callback routes',
  () => {
    assert.equal(shouldRenderChatRuntimeWarmersForPath('/auth'), false);
    assert.equal(shouldRenderChatRuntimeWarmersForPath('/login'), false);
    assert.equal(shouldRenderChatRuntimeWarmersForPath('/register'), false);
    assert.equal(shouldRenderChatRuntimeWarmersForPath('/forgot-password'), false);
    assert.equal(
      shouldRenderChatRuntimeWarmersForPath('/login/oauth/callback/github'),
      false,
    );
  },
);

await runTest(
  'chat runtime warmers stay enabled on authenticated workspace routes',
  () => {
    assert.equal(shouldRenderChatRuntimeWarmersForPath('/dashboard'), true);
    assert.equal(shouldRenderChatRuntimeWarmersForPath('/chat'), true);
    assert.equal(shouldRenderChatRuntimeWarmersForPath('/nodes'), true);
    assert.equal(shouldRenderChatRuntimeWarmersForPath('/agents/openclaw'), true);
  },
);
