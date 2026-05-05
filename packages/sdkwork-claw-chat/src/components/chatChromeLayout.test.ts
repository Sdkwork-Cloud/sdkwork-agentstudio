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

const pageSource = readFileSync(new URL('../pages/Chat.tsx', import.meta.url), 'utf8');
const conversationPaneSource = readFileSync(new URL('./ChatConversationPane.tsx', import.meta.url), 'utf8');
const topControlsSource = readFileSync(new URL('./ChatTopControls.tsx', import.meta.url), 'utf8');
const inputSource = readFileSync(new URL('./ChatInput.tsx', import.meta.url), 'utf8');
const chromeSurfaceSource = readFileSync(new URL('./chatChromeSurface.ts', import.meta.url), 'utf8');

await runTest(
  'Chat removes the visible top header rail, keeps floating controls, and does not reserve a chat-local top header band',
  () => {
    assert.match(
      pageSource,
      /className="relative flex h-full min-w-0 overflow-hidden bg-zinc-100 dark:bg-zinc-950"/,
    );
    assert.match(conversationPaneSource, /className="relative flex h-full min-w-0 flex-1 flex-col"/);
    assert.doesNotMatch(pageSource, /className="relative flex h-full min-w-0 flex-1 flex-col pt-11 sm:pt-12"/);
    assert.doesNotMatch(
      pageSource,
      /className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6"/,
    );
    assert.match(
      topControlsSource,
      /className="pointer-events-none absolute left-2\.5 top-2\.5 z-20 sm:left-3 sm:top-3 lg:hidden"/,
    );
    assert.match(
      topControlsSource,
      /className="pointer-events-none absolute right-2\.5 top-2\.5 z-20 sm:right-3 sm:top-3 lg:right-4"/,
    );
    assert.doesNotMatch(
      topControlsSource,
      /rounded-2xl border border-zinc-200\/80 bg-white\/90 px-4 py-3 shadow-sm shadow-zinc-950\/5 backdrop-blur-xl/,
    );
    assert.doesNotMatch(topControlsSource, /lg:right-32 xl:right-36/);
  },
);

await runTest(
  'Chat keeps the composer rail flat but restores contrast with a subtle translucent separation layer',
  () => {
    assert.match(
      chromeSurfaceSource,
      /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =\s*'flex-shrink-0 bg-transparent px-3 pb-3 pt-1\.5 sm:px-4 sm:pb-4 sm:pt-2 lg:px-6';/,
    );
    assert.doesNotMatch(
      chromeSurfaceSource,
      /className="flex-shrink-0 border-t border-zinc-200\/80 bg-zinc-50\/88 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4 lg:px-6 dark:border-zinc-800 dark:bg-zinc-950\/88"/,
    );
    assert.match(inputSource, /CHAT_SURFACE_INPUT_CLASS,/);
    assert.match(
      inputSource,
      /'relative flex w-full flex-col overflow-visible rounded-\[18px\] px-2 py-1\.5 shadow-\[0_-10px_24px_rgba\(15,23,42,0\.06\)\] backdrop-blur-xl transition-all duration-300 dark:shadow-\[0_-14px_34px_rgba\(0,0,0,0\.24\)\] sm:rounded-\[20px\] sm:px-2\.5 sm:py-2'/,
    );
    assert.doesNotMatch(
      inputSource,
      /'relative flex w-full flex-col overflow-visible transition-all duration-300'/,
    );
    assert.match(
      inputSource,
      /const modelTriggerClassName = cn\(\s*'inline-flex h-8 max-w-\[11\.5rem\] items-center gap-1\.5 rounded-full px-2\.5 text-xs font-medium transition-colors sm:h-9 sm:max-w-\[13\.5rem\] lg:max-w-\[15\.5rem\]'/,
    );
  },
);

await runTest(
  'ChatInput uses a shorter transparent textarea and borderless side controls for a flatter composer',
  () => {
    assert.match(
      inputSource,
      /className="min-h-\[48px\] max-h-\[220px\] w-full resize-none rounded-none border-none bg-transparent px-0 py-0\.5 text-\[14px\] leading-6 text-zinc-900 shadow-none placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-zinc-50 dark:placeholder:text-zinc-500"/,
    );
    assert.doesNotMatch(
      inputSource,
      /className="min-h-\[72px\] max-h-\[320px\] w-full resize-none rounded-none border-none bg-transparent px-0 py-0 text-\[15px\] leading-7 text-zinc-900 shadow-none placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-zinc-100 dark:placeholder:text-zinc-500"/,
    );
    assert.match(
      inputSource,
      /const sendSideActionButtonClassName =\s*'flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100\/80 hover:text-zinc-900 dark:bg-zinc-800\/55 dark:text-zinc-200 dark:hover:bg-zinc-800\/90 dark:hover:text-zinc-50';/,
    );
    assert.doesNotMatch(
      inputSource,
      /const sendSideActionButtonClassName =\s*'flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200\/80 bg-white text-zinc-500 transition-colors hover:bg-zinc-100\/80 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800\/80 dark:hover:text-zinc-100';/,
    );
  },
);

await runTest(
  'ChatInput removes the import-url globe icon from the visible composer actions',
  () => {
    assert.doesNotMatch(inputSource, /<Globe2 className="h-4 w-4" \/>/);
    assert.doesNotMatch(
      inputSource,
      /onClick=\{\(\) => \{\s*setShowUrlImport\(\(current\) => !current\);\s*setComposerError\(null\);\s*\}\}/,
    );
  },
);
