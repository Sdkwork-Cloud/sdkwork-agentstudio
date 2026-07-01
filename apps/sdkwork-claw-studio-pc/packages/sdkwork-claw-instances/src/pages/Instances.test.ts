import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('Instances page uses the full available workspace width', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'Instances.tsx'), 'utf8');

  assert.doesNotMatch(source, /mx-auto h-full max-w-7xl/);
  assert.doesNotMatch(source, /mx-auto flex h-64 max-w-7xl/);
  assert.match(source, /className="flex h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950"/);
  assert.match(source, /className="scrollbar-hide flex-1 overflow-y-auto p-4 md:p-6"/);
});

runTest('Instances page uses left-aligned top tabs and exposes supported kernel installation', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'Instances.tsx'), 'utf8');

  assert.match(source, /data-slot="instances-top-tabs"/);
  assert.match(source, /instances\.list\.tabs\.activeInstances/);
  assert.match(source, /instances\.list\.tabs\.supportedKernels/);
  assert.match(source, /listKernelReleaseConfigs\(\)/);
  assert.match(source, /instances\.list\.supportedKernels\.actions\.installBuiltInInstance/);
  assert.match(source, /navigate\('\/docs#script'\)/);
});

runTest('Instances page reads kernel platform labels from platformSupport instead of compatibility fields', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'Instances.tsx'), 'utf8');

  assert.match(source, /config\.platformSupport\?\.windows/);
  assert.doesNotMatch(source, /config\.compatibility\?\.windows/);
});

runTest('Instances page keeps onboarding and old provisioning flows removed from the main management surface', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'Instances.tsx'), 'utf8');

  assert.doesNotMatch(source, /instances\.list\.actions\.newInstance/);
  assert.doesNotMatch(source, /instances\.list\.actions\.associateInstalled/);
  assert.doesNotMatch(source, /instances\.list\.emptyPrimaryAction/);
  assert.doesNotMatch(source, /instances\.list\.emptySecondaryAction/);
  assert.doesNotMatch(source, /instances\.list\.associateDialog\./);
  assert.doesNotMatch(source, /instances\.list\.remoteDialog\./);
  assert.doesNotMatch(source, /instances\.list\.onboarding\./);
  assert.doesNotMatch(source, /<Dialog /);
});

runTest('Instances page removes the top title and subtitle copy', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'Instances.tsx'), 'utf8');

  assert.doesNotMatch(source, /instances\.list\.title/);
  assert.doesNotMatch(source, /instances\.list\.subtitle/);
});
