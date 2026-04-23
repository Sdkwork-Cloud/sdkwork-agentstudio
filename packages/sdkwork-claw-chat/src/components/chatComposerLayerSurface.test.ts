import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

const conversationPaneSource = readFileSync(new URL('./ChatConversationPane.tsx', import.meta.url), 'utf8');
const chromeSurfaceSource = readFileSync(new URL('./chatChromeSurface.ts', import.meta.url), 'utf8');

await runTest(
  'Chat composer layer keeps using the shared surface contract and stays borderless with a transparent parent background',
  () => {
    assert.match(
      conversationPaneSource,
      /<div className=\{CHAT_CHROME_COMPOSER_LAYER_CLASS\}>/,
    );
    assert.match(
      chromeSurfaceSource,
      /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =\s*'flex-shrink-0 bg-transparent px-3 pb-3 pt-1\.5 sm:px-4 sm:pb-4 sm:pt-2 lg:px-6';/,
    );
    assert.doesNotMatch(
      chromeSurfaceSource,
      /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =\s*'[^']*border-t[^']*';/,
    );
    assert.doesNotMatch(
      chromeSurfaceSource,
      /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =\s*'[^']*bg-gradient-to-t[^']*';/,
    );
    assert.doesNotMatch(
      chromeSurfaceSource,
      /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =\s*'[^']*backdrop-blur-xl[^']*';/,
    );
  },
);
