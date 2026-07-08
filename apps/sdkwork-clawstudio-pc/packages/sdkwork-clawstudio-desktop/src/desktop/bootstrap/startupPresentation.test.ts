import assert from 'node:assert/strict';
import {
  getStartupCopy,
  getStartupMinimumWaitMs,
  getStartupProgressModel,
  resolveStartupBootstrapStage,
  shouldEnterFullscreenAfterStartup,
  readStartupAppearanceSnapshot,
} from './startupPresentation.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('readStartupAppearanceSnapshot restores persisted theme, accent, and language', () => {
  const snapshot = JSON.stringify({
    state: {
      themeMode: 'system',
      themeColor: 'lobster',
      language: 'zh-CN',
    },
  });

  assert.deepEqual(
    readStartupAppearanceSnapshot({
      storageValue: snapshot,
      browserLanguage: 'en-US',
      prefersDark: true,
    }),
    {
      language: 'zh',
      themeColor: 'lobster',
      themeMode: 'system',
      isDark: true,
    },
  );
});

runTest('readStartupAppearanceSnapshot falls back safely when the snapshot is invalid', () => {
  assert.deepEqual(
    readStartupAppearanceSnapshot({
      storageValue: 'not-json',
      browserLanguage: 'ja-JP',
      prefersDark: false,
    }),
    {
      language: 'en',
      themeColor: 'lobster',
      themeMode: 'system',
      isDark: false,
    },
  );
});

runTest('getStartupCopy keeps startup copy intentionally short', () => {
  assert.deepEqual(getStartupCopy('en', 'Claw Studio'), {
    title: 'Claw Studio',
    preparingWindow: 'Preparing window',
    connectingRuntime: 'Connecting runtime',
    loadingWorkspace: 'Loading workspace',
    mountingShell: 'Opening workspace',
    ready: 'Workspace ready',
    errorTitle: 'Startup failed',
    retryLabel: 'Try again',
  });

  assert.deepEqual(getStartupCopy('zh', 'Claw Studio'), {
    title: 'Claw Studio',
    preparingWindow: '\u51c6\u5907\u7a97\u53e3',
    connectingRuntime: '\u8fde\u63a5\u684c\u9762\u5f15\u64ce',
    loadingWorkspace: '\u52a0\u8f7d\u5de5\u4f5c\u53f0',
    mountingShell: '\u6253\u5f00\u5de5\u4f5c\u53f0',
    ready: '\u5de5\u4f5c\u53f0\u5df2\u5c31\u7eea',
    errorTitle: '\u542f\u52a8\u5931\u8d25',
    retryLabel: '\u91cd\u8bd5',
  });
});

runTest('resolveStartupBootstrapStage follows real startup milestones', () => {
  assert.equal(
    resolveStartupBootstrapStage({
      hasWindowPresented: false,
      hasRuntimeConnected: false,
      hasShellBootstrapped: false,
      hasShellMounted: false,
    }),
    'preparing-window',
  );

  assert.equal(
    resolveStartupBootstrapStage({
      hasWindowPresented: true,
      hasRuntimeConnected: false,
      hasShellBootstrapped: false,
      hasShellMounted: false,
    }),
    'connecting-runtime',
  );

  assert.equal(
    resolveStartupBootstrapStage({
      hasWindowPresented: true,
      hasRuntimeConnected: true,
      hasShellBootstrapped: false,
      hasShellMounted: false,
    }),
    'loading-workspace',
  );

  assert.equal(
    resolveStartupBootstrapStage({
      hasWindowPresented: true,
      hasRuntimeConnected: true,
      hasShellBootstrapped: true,
      hasShellMounted: false,
    }),
    'mounting-shell',
  );

  assert.equal(
    resolveStartupBootstrapStage({
      hasWindowPresented: true,
      hasRuntimeConnected: true,
      hasShellBootstrapped: true,
      hasShellMounted: true,
    }),
    'ready',
  );
});

runTest('getStartupProgressModel follows real startup milestones', () => {
  assert.deepEqual(
    getStartupProgressModel({
      milestones: {
        hasWindowPresented: false,
        hasRuntimeConnected: false,
        hasShellBootstrapped: false,
        hasShellMounted: false,
      },
      language: 'en',
    }),
    {
      phase: 'preparing-window',
      progress: 12,
      statusLabel: 'Preparing window',
    },
  );

  assert.deepEqual(
    getStartupProgressModel({
      milestones: {
        hasWindowPresented: true,
        hasRuntimeConnected: false,
        hasShellBootstrapped: false,
        hasShellMounted: false,
      },
      language: 'zh',
    }),
    {
      phase: 'connecting-runtime',
      progress: 36,
      statusLabel: '\u8fde\u63a5\u684c\u9762\u5f15\u64ce',
    },
  );

  assert.deepEqual(
    getStartupProgressModel({
      milestones: {
        hasWindowPresented: true,
        hasRuntimeConnected: true,
        hasShellBootstrapped: false,
        hasShellMounted: false,
      },
      language: 'zh',
    }),
    {
      phase: 'loading-workspace',
      progress: 68,
      statusLabel: '\u52a0\u8f7d\u5de5\u4f5c\u53f0',
    },
  );

  assert.deepEqual(
    getStartupProgressModel({
      milestones: {
        hasWindowPresented: true,
        hasRuntimeConnected: true,
        hasShellBootstrapped: true,
        hasShellMounted: false,
      },
      language: 'zh',
    }),
    {
      phase: 'mounting-shell',
      progress: 90,
      statusLabel: '\u6253\u5f00\u5de5\u4f5c\u53f0',
    },
  );
});

runTest('getStartupProgressModel returns a ready state once boot completes', () => {
  assert.deepEqual(
    getStartupProgressModel({
      milestones: {
        hasWindowPresented: true,
        hasRuntimeConnected: true,
        hasShellBootstrapped: true,
        hasShellMounted: true,
      },
      language: 'zh',
    }),
    {
      phase: 'ready',
      progress: 100,
      statusLabel: '\u5de5\u4f5c\u53f0\u5df2\u5c31\u7eea',
    },
  );
});

runTest('getStartupMinimumWaitMs keeps the splash visible for the minimum duration only', () => {
  assert.equal(
    getStartupMinimumWaitMs({
      currentTimeMs: 350,
      startedAtMs: 0,
      minimumVisibleMs: 1200,
    }),
    850,
  );

  assert.equal(
    getStartupMinimumWaitMs({
      currentTimeMs: 1420,
      startedAtMs: 0,
      minimumVisibleMs: 1200,
    }),
    0,
  );
});

runTest('shouldEnterFullscreenAfterStartup only switches after splash handoff', () => {
  assert.equal(
    shouldEnterFullscreenAfterStartup({
      stage: 'loading-workspace',
      isSplashVisible: true,
      hasRequestedFullscreen: false,
      hasPresentedWindow: true,
    }),
    false,
  );

  assert.equal(
    shouldEnterFullscreenAfterStartup({
      stage: 'ready',
      isSplashVisible: true,
      hasRequestedFullscreen: false,
      hasPresentedWindow: true,
    }),
    false,
  );

  assert.equal(
    shouldEnterFullscreenAfterStartup({
      stage: 'ready',
      isSplashVisible: false,
      hasRequestedFullscreen: false,
      hasPresentedWindow: false,
    }),
    false,
  );

  assert.equal(
    shouldEnterFullscreenAfterStartup({
      stage: 'ready',
      isSplashVisible: false,
      hasRequestedFullscreen: false,
      hasPresentedWindow: true,
    }),
    true,
  );

  assert.equal(
    shouldEnterFullscreenAfterStartup({
      stage: 'ready',
      isSplashVisible: false,
      hasRequestedFullscreen: true,
      hasPresentedWindow: true,
    }),
    false,
  );
});
