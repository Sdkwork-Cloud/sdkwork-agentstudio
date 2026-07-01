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

const inputSource = readFileSync(new URL('./ChatInput.tsx', import.meta.url), 'utf8');

await runTest(
  'ChatInput only clears the composer after onSend reports a handled submission',
  () => {
    assert.match(
      inputSource,
      /const handled = await onSend\(\{\s*text: message\.trim\(\),\s*attachments: readyAttachments\.map\(\(attachment\) => \(\{ \.\.\.attachment \}\)\),\s*\}\);/,
    );
    assert.match(
      inputSource,
      /if \(handled === false\) \{\s*restoreTextareaFocus\(\);\s*return;\s*\}/,
    );
    assert.match(
      inputSource,
      /if \(handled === false\) \{\s*restoreTextareaFocus\(\);\s*return;\s*\}\s*clearDrafts\(\);\s*setMessage\(''\);/s,
    );
  },
);

await runTest(
  'ChatInput only renders the stop action when the current send path is actually stoppable',
  () => {
    assert.match(inputSource, /canStop\?: boolean;/);
    assert.match(inputSource, /isLoading && canStop \?\s*\(/);
    assert.match(inputSource, /key="loading"/);
    assert.match(inputSource, /LoaderCircle className="h-\[18px\] w-\[18px\] animate-spin"/);
  },
);

await runTest(
  'ChatInput blocks duplicate local send invocations with a stable ref guard before awaiting the async onSend handler',
  () => {
    assert.match(inputSource, /const sendInvocationLockRef = useRef\(false\);/);
    assert.match(
      inputSource,
      /if \(!canSend \|\| sendInvocationLockRef\.current\) \{\s*return;\s*\}/,
    );
    assert.match(inputSource, /sendInvocationLockRef\.current = true;\s*setIsSendingMessage\(true\);/s);
    assert.match(
      inputSource,
      /finally \{\s*sendInvocationLockRef\.current = false;\s*if \(!isUnmountingRef\.current\) \{\s*setIsSendingMessage\(false\);\s*\}\s*\}/s,
    );
  },
);
