import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

await runTest(
  'useChatInteractionModelState resolves session control model input without referencing activeModel before model selection state initializes',
  () => {
    const source = readFileSync(new URL('./useChatInteractionModelState.ts', import.meta.url), 'utf8');

    assert.match(
      source,
      /const resolvedSessionControlModelId = sessionSelectedModelId \|\| activeModelId \|\| null;/,
    );
    assert.match(
      source,
      /useChatSessionControlState\(\{[\s\S]*activeModelId:\s*resolvedSessionControlModelId,/s,
    );
    assert.doesNotMatch(
      source,
      /useChatSessionControlState\(\{[\s\S]*activeModelId:\s*activeModel\?\.id \?\? null,/s,
    );
  },
);
