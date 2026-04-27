import assert from 'node:assert/strict';

import { buildChatAgentOptions } from './chatContextOptions.ts';

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
  'buildChatAgentOptions removes opaque id/date catalog names before context drawer items consume them',
  () => {
    const options = buildChatAgentOptions({
      agents: [
        {
          id: 'gw-7f9d2c4b1e',
          name: 'gw-7f9d2c4b1e(2026-04-26)',
          description: '',
          avatar: 'GW',
          systemPrompt: '',
          creator: 'OpenClaw',
          kernelLabel: 'OpenClaw',
        },
      ] as any,
      defaultLabel: 'Default',
      defaultDescription: 'Default route',
    });

    assert.deepEqual(options[1], {
      id: 'gw-7f9d2c4b1e',
      name: 'OpenClaw Agent',
      description: '',
      avatarLabel: 'OP',
    });
  },
);
