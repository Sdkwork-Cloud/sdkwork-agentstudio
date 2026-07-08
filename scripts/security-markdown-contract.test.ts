import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

const communityPostDetailSource = await readFile(
  new URL('../packages/sdkwork-clawstudio-community/src/pages/community/CommunityPostDetail.tsx', import.meta.url),
  'utf8',
);

await runTest('community post detail must not enable rehypeRaw for user-generated markdown', () => {
  assert.doesNotMatch(communityPostDetailSource, /rehype-raw/);
  assert.doesNotMatch(communityPostDetailSource, /rehypePlugins=\{\[rehypeRaw\]\}/);
});

await runTest('community post detail must use the shared MarkdownContent abstraction', () => {
  assert.match(communityPostDetailSource, /MarkdownContent/);
});
