import assert from 'node:assert/strict';
import { resolveChatGenerationViewState } from './chatGenerationViewPolicy.ts';

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
  'resolveChatGenerationViewState keeps the composer locked while a background session is still streaming',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-b',
        pendingSendSessionId: 'session-a',
        activeRunBinding: null,
        runningRunBinding: null,
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: false,
        stopRunBinding: {
          sessionId: 'session-a',
          runId: null,
          isActive: false,
        },
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState marks the active session as generating for local pending sends',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-a',
        pendingSendSessionId: 'session-a',
        activeRunBinding: null,
        runningRunBinding: null,
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: true,
        stopRunBinding: {
          sessionId: 'session-a',
          runId: null,
          isActive: false,
        },
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState marks the active session as generating from the active run binding',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-a',
        pendingSendSessionId: null,
        activeRunBinding: {
          sessionId: 'session-a',
          runId: 'run-1',
          isActive: true,
        },
        runningRunBinding: {
          sessionId: 'session-a',
          runId: 'run-1',
          isActive: true,
        },
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: true,
        stopRunBinding: {
          sessionId: 'session-a',
          runId: 'run-1',
          isActive: true,
        },
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState stays idle when no send is in flight',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-a',
        pendingSendSessionId: null,
        activeRunBinding: null,
        runningRunBinding: null,
      }),
      {
        isComposerLocked: false,
        isActiveSessionGenerating: false,
        stopRunBinding: null,
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState keeps the composer locked for a background gateway run while only the visible session controls typing state',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-b',
        pendingSendSessionId: null,
        activeRunBinding: {
          sessionId: 'session-b',
          runId: null,
          isActive: false,
        },
        runningRunBinding: {
          sessionId: 'session-a',
          runId: 'run-background',
          isActive: true,
        },
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: false,
        stopRunBinding: {
          sessionId: 'session-a',
          runId: 'run-background',
          isActive: true,
        },
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState prefers stopping the visible active session when it is generating',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-b',
        pendingSendSessionId: null,
        activeRunBinding: {
          sessionId: 'session-b',
          runId: 'run-visible',
          isActive: true,
        },
        runningRunBinding: {
          sessionId: 'session-a',
          runId: 'run-background',
          isActive: true,
        },
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: true,
        stopRunBinding: {
          sessionId: 'session-b',
          runId: 'run-visible',
          isActive: true,
        },
      },
    );
  },
);

await runTest(
  'resolveChatGenerationViewState does not mark the active session as generating when only another visible session is running',
  () => {
    assert.deepEqual(
      resolveChatGenerationViewState({
        effectiveActiveSessionId: 'session-b',
        pendingSendSessionId: null,
        activeRunBinding: {
          sessionId: 'session-b',
          runId: null,
          isActive: false,
        },
        runningRunBinding: {
          sessionId: 'session-a',
          runId: 'run-background',
          isActive: true,
        },
      }),
      {
        isComposerLocked: true,
        isActiveSessionGenerating: false,
        stopRunBinding: {
          sessionId: 'session-a',
          runId: 'run-background',
          isActive: true,
        },
      },
    );
  },
);
