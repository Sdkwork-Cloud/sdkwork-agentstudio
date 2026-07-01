import assert from 'node:assert/strict';
import {
  buildChannelCatalogRegionDescriptions,
  buildChannelCatalogRegionLabels,
  getChannelCatalogRegionEmptyText,
} from './channelCatalogRegionContent.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('channelCatalogRegionContent builds region label and description maps from shared translation keys', () => {
  const calls: string[] = [];
  const t = (key: string) => {
    calls.push(key);
    return key;
  };

  const labels = buildChannelCatalogRegionLabels(t);
  const descriptions = buildChannelCatalogRegionDescriptions(t);

  assert.deepEqual(labels, {
    domestic: 'channels.page.catalog.tabs.domestic',
    global: 'channels.page.catalog.tabs.global',
    media: 'channels.page.catalog.tabs.media',
    all: 'channels.page.catalog.tabs.all',
  });
  assert.deepEqual(descriptions, {
    domestic: 'channels.page.catalog.descriptions.domestic',
    global: 'channels.page.catalog.descriptions.global',
    media: 'channels.page.catalog.descriptions.media',
    all: 'channels.page.catalog.descriptions.all',
  });
  assert.deepEqual(calls, [
    'channels.page.catalog.tabs.domestic',
    'channels.page.catalog.tabs.global',
    'channels.page.catalog.tabs.media',
    'channels.page.catalog.tabs.all',
    'channels.page.catalog.descriptions.domestic',
    'channels.page.catalog.descriptions.global',
    'channels.page.catalog.descriptions.media',
    'channels.page.catalog.descriptions.all',
  ]);
});

runTest('channelCatalogRegionContent resolves empty copy for every catalog region', () => {
  const t = (key: string) => key;

  assert.equal(
    getChannelCatalogRegionEmptyText(t, 'domestic'),
    'channels.page.catalog.empty.domestic',
  );
  assert.equal(
    getChannelCatalogRegionEmptyText(t, 'global'),
    'channels.page.catalog.empty.global',
  );
  assert.equal(
    getChannelCatalogRegionEmptyText(t, 'media'),
    'channels.page.catalog.empty.media',
  );
  assert.equal(
    getChannelCatalogRegionEmptyText(t, 'all'),
    'channels.page.catalog.empty.all',
  );
});
