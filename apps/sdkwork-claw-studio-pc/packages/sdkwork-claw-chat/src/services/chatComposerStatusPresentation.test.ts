import assert from 'node:assert/strict';
import { resolveChatComposerStatusState } from './chatComposerStatusPresentation.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('resolveChatComposerStatusState hides idle status text', () => {
  assert.equal(
    resolveChatComposerStatusState({
      composerError: null,
      activeRecorderKind: null,
      isRecordingFinalizing: false,
      hasUploadingDrafts: false,
    }),
    'idle',
  );
});

await runTest('resolveChatComposerStatusState keeps actionable composer states visible', () => {
  assert.equal(
    resolveChatComposerStatusState({
      composerError: 'Upload failed',
      activeRecorderKind: null,
      isRecordingFinalizing: false,
      hasUploadingDrafts: false,
    }),
    'error',
  );
  assert.equal(
    resolveChatComposerStatusState({
      composerError: null,
      activeRecorderKind: 'audio',
      isRecordingFinalizing: false,
      hasUploadingDrafts: false,
    }),
    'recording-audio',
  );
  assert.equal(
    resolveChatComposerStatusState({
      composerError: null,
      activeRecorderKind: 'screen-recording',
      isRecordingFinalizing: false,
      hasUploadingDrafts: false,
    }),
    'recording-screen',
  );
  assert.equal(
    resolveChatComposerStatusState({
      composerError: null,
      activeRecorderKind: null,
      isRecordingFinalizing: true,
      hasUploadingDrafts: false,
    }),
    'finalizing',
  );
  assert.equal(
    resolveChatComposerStatusState({
      composerError: null,
      activeRecorderKind: null,
      isRecordingFinalizing: false,
      hasUploadingDrafts: true,
    }),
    'uploading',
  );
});
