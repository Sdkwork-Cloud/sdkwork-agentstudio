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

runTest('ChannelRegionTabs renders stacked commercial tab copy with category descriptions', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelRegionTabs.tsx'), 'utf8');

  assert.match(source, /descriptions\?: Partial<Record<ChannelCatalogRegion, string>>;/);
  assert.match(source, /data-slot="channel-region-tabs"/);
  assert.match(source, /data-slot="channel-region-tab-label"/);
  assert.match(source, /data-slot="channel-region-tab-description"/);
  assert.match(source, /gap-1\.5/);
  assert.match(source, /rounded-\[0\.95rem\]/);
  assert.match(source, /p-1 /);
  assert.match(source, /h-10 min-w-\[10rem\]/);
  assert.match(source, /rounded-\[0\.8rem\] border border-transparent px-3 py-2 text-left/);
  assert.match(source, /items-start justify-between gap-2\.5/);
  assert.match(source, /border-primary-200 bg-primary-50 text-primary-700/);
  assert.match(source, /dark:border-primary-500\/30 dark:bg-primary-500\/10 dark:text-primary-300/);
  assert.doesNotMatch(source, /bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800/);
  assert.doesNotMatch(source, /text-white\/72 dark:text-zinc-700/);
  assert.match(source, /descriptions\?\.\[region\]/);
  assert.match(source, /rounded-full px-1\.5 py-0\.5 text-\[11px\]/);
  assert.doesNotMatch(source, /h-11 min-w-\[10\.5rem\]/);
  assert.doesNotMatch(source, /rounded-\[0\.875rem\] px-3\.5 py-2 text-left/);
  assert.doesNotMatch(source, /items-start justify-between gap-3/);
});
