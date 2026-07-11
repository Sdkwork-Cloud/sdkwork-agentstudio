import assert from 'node:assert/strict';
import { shouldShowModelChannelRail } from './chatModelSelectorPresentation.ts';

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
  'shouldShowModelChannelRail hides the channel rail when compact mode is enabled and only one channel is available',
  () => {
    assert.equal(
      shouldShowModelChannelRail({
        channelCount: 1,
        compactModelSelector: true,
      }),
      false,
    );
    assert.equal(
      shouldShowModelChannelRail({
        channelCount: 2,
        compactModelSelector: true,
      }),
      true,
    );
    assert.equal(
      shouldShowModelChannelRail({
        channelCount: 1,
        compactModelSelector: false,
      }),
      true,
    );
  },
);
