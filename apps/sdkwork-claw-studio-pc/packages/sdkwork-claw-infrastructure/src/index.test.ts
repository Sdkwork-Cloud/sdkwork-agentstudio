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

await runTest('sdkwork-claw-infrastructure root exports WebComponentPlatform for runtime bridge consumers', async () => {
  const infrastructure = await import('./index.ts');

  assert.equal(typeof infrastructure.WebComponentPlatform, 'function');
});
