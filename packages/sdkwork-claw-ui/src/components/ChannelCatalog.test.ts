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

runTest('ChannelCatalog management cards keep link actions in the title row instead of the primary action rail', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelCatalog.tsx'), 'utf8');

  assert.match(source, /data-slot="channel-catalog-management-heading"/);
  assert.match(source, /data-slot="channel-catalog-management-link-action"/);
  assert.match(source, /data-slot="channel-catalog-management-actions"/);
  assert.doesNotMatch(
    source,
    /data-slot="channel-catalog-management-actions"[\s\S]*<OfficialLinkButton/,
  );
});

runTest('ChannelCatalog management cards expose category metadata through a dedicated premium meta row', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelCatalog.tsx'), 'utf8');

  assert.match(source, /getChannelCatalogRegions\(channel\.id\)/);
  assert.match(source, /data-slot="channel-catalog-management-meta"/);
  assert.match(source, /data-slot="channel-catalog-management-region"/);
  assert.match(source, /rounded-\[24px\]/);
  assert.match(source, /texts\.metricSetupSteps/);
  assert.doesNotMatch(
    source,
    /data-slot="channel-catalog-management-meta"[\s\S]*OfficialLinkButton/,
  );
});

runTest('ChannelCatalog summary cards reuse category metadata and a premium setup guide surface', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelCatalog.tsx'), 'utf8');

  assert.match(source, /data-slot="channel-catalog-summary-meta"/);
  assert.match(source, /data-slot="channel-catalog-summary-region"/);
  assert.match(source, /data-slot="channel-catalog-summary-guide"/);
  assert.match(source, /bg-gradient-to-br from-zinc-50 via-white to-zinc-100\/80/);
});

runTest('ChannelCatalog empty states use the same premium surface language as the live cards', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelCatalog.tsx'), 'utf8');

  assert.match(source, /dataSlot="channel-catalog-empty-state"/);
  assert.match(source, /rounded-\[24px\] border border-dashed border-zinc-300\/80 bg-gradient-to-br from-white via-white to-zinc-50\/90/);
});

runTest('ChannelCatalog summary metrics render as dedicated premium tiles', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelCatalog.tsx'), 'utf8');

  assert.match(source, /data-slot="channel-catalog-summary-metric"/);
  assert.match(source, /rounded-\[18px\] border border-zinc-200\/80 bg-white\/78 px-3\.5 py-3/);
});

runTest('ChannelCatalog management actions live in a separate action surface', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelCatalog.tsx'), 'utf8');

  assert.match(source, /data-slot="channel-catalog-management-action-panel"/);
  assert.match(source, /rounded-\[20px\] border border-zinc-200\/80 bg-zinc-50\/80 px-3 py-3/);
});

runTest('ChannelCatalog reads region copy from the shared catalog region content helper', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelCatalog.tsx'), 'utf8');

  assert.match(source, /from '\.\/channelCatalogRegionContent'/);
  assert.match(source, /buildChannelCatalogRegionLabels\(t\)/);
  assert.match(source, /buildChannelCatalogRegionDescriptions\(t\)/);
  assert.match(source, /getChannelCatalogRegionEmptyText\(t, activeRegion\)/);
});
