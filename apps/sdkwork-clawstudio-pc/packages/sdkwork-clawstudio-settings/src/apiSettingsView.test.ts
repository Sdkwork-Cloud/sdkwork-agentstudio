import assert from 'node:assert/strict';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('apiSettingsView resolves provider center and request logs sections from search params safely', async () => {
  const {
    resolveApiSettingsSection,
  } = await import('./apiSettingsView.ts');

  assert.equal(resolveApiSettingsSection(null), 'providers');
  assert.equal(resolveApiSettingsSection('requests'), 'requests');
  assert.equal(resolveApiSettingsSection('messages'), 'messages');
  assert.equal(resolveApiSettingsSection('logs'), 'requests');
  assert.equal(resolveApiSettingsSection('unknown'), 'providers');
});
