import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDesktopStartupFatalEvidenceDocument,
  reportDesktopStartupFatalError,
} from './desktopStartupFatalErrorReporter.ts';

test('desktop startup fatal error reporter builds a bootstrap failure evidence document', () => {
  const document = buildDesktopStartupFatalEvidenceDocument({
    error: new Error('desktop bootstrap import failed'),
    runId: 7,
    durationMs: 125,
    recordedAt: '2026-04-20T00:00:00.000Z',
  });

  assert.equal(document.version, 1);
  assert.equal(document.status, 'failed');
  assert.equal(document.phase, 'bootstrap-failed');
  assert.equal(document.runId, 7);
  assert.equal(document.durationMs, 125);
  assert.equal(document.recordedAt, '2026-04-20T00:00:00.000Z');
  assert.equal(document.error?.message, 'desktop bootstrap import failed');
  assert.equal(document.paths, null);
  assert.deepEqual(document.hostEndpoints, []);
});

test('desktop startup fatal error reporter persists bootstrap failure evidence through the raw tauri invoke bridge', async () => {
  const invocations: Array<{
    command: string;
    payload?: Record<string, unknown>;
  }> = [];

  const persisted = await reportDesktopStartupFatalError(new Error('desktop bootstrap import failed'), {
    runId: 9,
    durationMs: 33,
    recordedAt: '2026-04-20T00:00:00.000Z',
    waitForInvoke: async () => async (command, payload) => {
      invocations.push({ command, payload });
      return null;
    },
    writeBrowserFallback: () => {},
  });

  assert.equal(persisted, true);
  assert.equal(invocations.length, 1);
  assert.equal(invocations[0]?.command, 'write_text_file');
  assert.equal(
    invocations[0]?.payload?.path,
    'diagnostics/desktop-startup-evidence.json',
  );
  assert.match(
    String(invocations[0]?.payload?.content ?? ''),
    /"phase": "bootstrap-failed"/,
  );
  assert.match(
    String(invocations[0]?.payload?.content ?? ''),
    /desktop bootstrap import failed/,
  );
});
