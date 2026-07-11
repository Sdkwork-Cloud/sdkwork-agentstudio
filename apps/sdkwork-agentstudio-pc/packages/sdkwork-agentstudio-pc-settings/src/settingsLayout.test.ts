import assert from 'node:assert/strict';
import {
  isSettingsWideContentTab,
  resolveSettingsContentShellClassName,
} from './settingsLayout.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('settings layout promotes every settings tab into a full-width workspace shell', () => {
  for (const tabId of [
    'general',
    'billing',
    'wallet',
    'account',
    'notifications',
    'feedback',
    'security',
    'api',
    'data',
  ]) {
    assert.equal(isSettingsWideContentTab(tabId), true);
    assert.match(resolveSettingsContentShellClassName(tabId), /\bmax-w-none\b/);
    assert.match(resolveSettingsContentShellClassName(tabId), /\bpx-4\b/);
    assert.doesNotMatch(resolveSettingsContentShellClassName(tabId), /\bmax-w-5xl\b/);
  }
});

await runTest('settings layout keeps unknown tabs on the readable centered settings width', () => {
  assert.equal(isSettingsWideContentTab('unknown'), false);
  assert.match(resolveSettingsContentShellClassName('unknown'), /\bmax-w-5xl\b/);
  assert.match(resolveSettingsContentShellClassName('unknown'), /\bmx-auto\b/);
});
