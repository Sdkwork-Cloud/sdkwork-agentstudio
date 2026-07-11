import assert from 'node:assert/strict';
import {
  canImportChatComposerRemoteUrl,
  canSendChatComposerPayload,
  resolveRecorderStartErrorKey,
  shouldPersistChatComposerRecording,
  shouldConfirmChatComposerFieldOnEnter,
  shouldSendChatComposerMessageOnEnter,
  startNativeScreenshotSupportProbe,
} from './chatComposerState.ts';

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
  'canSendChatComposerPayload keeps send disabled while a recording is still being finalized',
  () => {
    assert.equal(
      canSendChatComposerPayload({
        hasActiveModel: true,
        isLoading: false,
        hasUploadingDrafts: false,
        hasPendingSendRequest: false,
        isImportingRemoteUrl: false,
        isRecording: false,
        isRecordingFinalizing: true,
        hasReadyContent: true,
      }),
      false,
    );

    assert.equal(
      canSendChatComposerPayload({
        hasActiveModel: true,
        isLoading: false,
        hasUploadingDrafts: false,
        hasPendingSendRequest: false,
        isImportingRemoteUrl: false,
        isRecording: false,
        isRecordingFinalizing: false,
        hasReadyContent: true,
      }),
      true,
    );
  },
);

await runTest(
  'canSendChatComposerPayload rejects duplicate sends and send races while a remote URL import is still starting',
  () => {
    assert.equal(
      canSendChatComposerPayload({
        hasActiveModel: true,
        isLoading: false,
        hasUploadingDrafts: false,
        hasPendingSendRequest: true,
        isImportingRemoteUrl: false,
        isRecording: false,
        isRecordingFinalizing: false,
        hasReadyContent: true,
      }),
      false,
    );

    assert.equal(
      canSendChatComposerPayload({
        hasActiveModel: true,
        isLoading: false,
        hasUploadingDrafts: false,
        hasPendingSendRequest: false,
        isImportingRemoteUrl: true,
        isRecording: false,
        isRecordingFinalizing: false,
        hasReadyContent: true,
      }),
      false,
    );
  },
);

await runTest(
  'canImportChatComposerRemoteUrl blocks duplicate imports and whitespace-only submits',
  () => {
    assert.equal(
      canImportChatComposerRemoteUrl({
        isImportingRemoteUrl: true,
        remoteUrl: 'https://example.com/demo.png',
      }),
      false,
    );

    assert.equal(
      canImportChatComposerRemoteUrl({
        isImportingRemoteUrl: false,
        remoteUrl: '   ',
      }),
      false,
    );

    assert.equal(
      canImportChatComposerRemoteUrl({
        isImportingRemoteUrl: false,
        remoteUrl: 'https://example.com/demo.png',
      }),
      true,
    );
  },
);

await runTest(
  'shouldPersistChatComposerRecording discards teardown recordings before upload work begins',
  () => {
    assert.equal(
      shouldPersistChatComposerRecording({
        blobSize: 1024,
        discardRequested: true,
        isUnmounting: false,
      }),
      false,
    );

    assert.equal(
      shouldPersistChatComposerRecording({
        blobSize: 1024,
        discardRequested: false,
        isUnmounting: true,
      }),
      false,
    );

    assert.equal(
      shouldPersistChatComposerRecording({
        blobSize: 0,
        discardRequested: false,
        isUnmounting: false,
      }),
      false,
    );

    assert.equal(
      shouldPersistChatComposerRecording({
        blobSize: 1024,
        discardRequested: false,
        isUnmounting: false,
      }),
      true,
    );
  },
);

await runTest(
  'startNativeScreenshotSupportProbe keeps polling on desktop until native support appears',
  () => {
    const scheduledCallbacks: Array<() => void> = [];
    let supportsNativeScreenshot = false;
    let detectedCount = 0;

    const stop = startNativeScreenshotSupportProbe({
      platformKind: 'desktop',
      readSupport: () => supportsNativeScreenshot,
      onSupportDetected: () => {
        detectedCount += 1;
      },
      schedule: (callback) => {
        scheduledCallbacks.push(callback);
        return scheduledCallbacks.length;
      },
      clearSchedule: () => {},
      intervalMs: 1,
    });

    assert.equal(scheduledCallbacks.length, 1);

    const firstPoll = scheduledCallbacks.shift();
    assert.ok(firstPoll);
    firstPoll();
    assert.equal(detectedCount, 0);
    assert.equal(scheduledCallbacks.length, 1);

    supportsNativeScreenshot = true;
    const secondPoll = scheduledCallbacks.shift();
    assert.ok(secondPoll);
    secondPoll();
    assert.equal(detectedCount, 1);
    assert.equal(scheduledCallbacks.length, 0);

    stop();
  },
);

await runTest(
  'startNativeScreenshotSupportProbe stays idle for non-desktop platforms',
  () => {
    let scheduleCount = 0;

    const stop = startNativeScreenshotSupportProbe({
      platformKind: 'web',
      readSupport: () => false,
      onSupportDetected: () => {
        throw new Error('The probe should not report support in web mode.');
      },
      schedule: () => {
        scheduleCount += 1;
        return scheduleCount;
      },
      clearSchedule: () => {},
      intervalMs: 1,
    });

    assert.equal(scheduleCount, 0);
    stop();
  },
);

await runTest(
  'resolveRecorderStartErrorKey treats cancelled screen-share selection as a non-error',
  () => {
    assert.equal(resolveRecorderStartErrorKey('screen-recording', 'AbortError'), null);
    assert.equal(
      resolveRecorderStartErrorKey('screen-recording', 'NotAllowedError'),
      'chat.input.screenRecordingDenied',
    );
    assert.equal(
      resolveRecorderStartErrorKey('audio', 'NotAllowedError'),
      'chat.input.recordingPermissionDenied',
    );
    assert.equal(
      resolveRecorderStartErrorKey('audio', 'AbortError'),
      'chat.input.recordingFailed',
    );
  },
);

await runTest(
  'shouldSendChatComposerMessageOnEnter blocks sends while an IME composition is still active',
  () => {
    assert.equal(
      shouldSendChatComposerMessageOnEnter({
        key: 'Enter',
        shiftKey: false,
        isLoading: false,
        isComposing: true,
        keyCode: null,
      }),
      false,
    );

    assert.equal(
      shouldSendChatComposerMessageOnEnter({
        key: 'Enter',
        shiftKey: false,
        isLoading: false,
        isComposing: false,
        keyCode: 229,
      }),
      false,
    );

    assert.equal(
      shouldSendChatComposerMessageOnEnter({
        key: 'Enter',
        shiftKey: true,
        isLoading: false,
        isComposing: false,
        keyCode: null,
      }),
      false,
    );

    assert.equal(
      shouldSendChatComposerMessageOnEnter({
        key: 'Enter',
        shiftKey: false,
        isLoading: false,
        isComposing: false,
        keyCode: null,
      }),
      true,
    );
  },
);

await runTest(
  'shouldConfirmChatComposerFieldOnEnter ignores IME composition confirms in auxiliary fields',
  () => {
    assert.equal(
      shouldConfirmChatComposerFieldOnEnter({
        key: 'Enter',
        isComposing: true,
        keyCode: null,
      }),
      false,
    );

    assert.equal(
      shouldConfirmChatComposerFieldOnEnter({
        key: 'Enter',
        isComposing: false,
        keyCode: 229,
      }),
      false,
    );

    assert.equal(
      shouldConfirmChatComposerFieldOnEnter({
        key: 'Enter',
        isComposing: false,
        keyCode: null,
      }),
      true,
    );
  },
);
