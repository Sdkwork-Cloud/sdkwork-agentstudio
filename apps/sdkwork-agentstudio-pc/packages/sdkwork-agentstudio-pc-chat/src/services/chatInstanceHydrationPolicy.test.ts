import assert from 'node:assert/strict';
import { resolveChatInstanceHydrationKey } from './chatInstanceHydrationPolicy.ts';

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
  'chat instance hydration key stays empty until an active instance route is resolved',
  () => {
    assert.equal(
      resolveChatInstanceHydrationKey({
        activeInstanceId: null,
        routeMode: 'instanceOpenAiHttp',
      }),
      null,
    );
    assert.equal(
      resolveChatInstanceHydrationKey({
        activeInstanceId: undefined,
        routeMode: undefined,
      }),
      null,
    );
    assert.equal(
      resolveChatInstanceHydrationKey({
        activeInstanceId: 'instance-a',
        routeMode: undefined,
      }),
      null,
    );
  },
);

await runTest(
  'chat instance hydration key distinguishes unsupported and recovered resolved route states for the same instance',
  () => {
    const unsupportedKey = resolveChatInstanceHydrationKey({
      activeInstanceId: 'instance-a',
      routeMode: 'unsupported',
    });
    const recoveredKey = resolveChatInstanceHydrationKey({
      activeInstanceId: 'instance-a',
      routeMode: 'instanceOpenAiHttp',
    });

    assert.equal(unsupportedKey, 'instance-a:unsupported');
    assert.equal(recoveredKey, 'instance-a:instanceOpenAiHttp');
    assert.notEqual(unsupportedKey, recoveredKey);
  },
);
