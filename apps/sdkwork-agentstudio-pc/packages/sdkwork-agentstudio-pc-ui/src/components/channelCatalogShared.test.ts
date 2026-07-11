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

runTest('channel catalog surfaces reuse a shared presentation module for identity and empty states', () => {
  const sharedSource = readFileSync(resolve(import.meta.dirname, 'channelCatalogShared.tsx'), 'utf8');
  const catalogSource = readFileSync(resolve(import.meta.dirname, 'ChannelCatalog.tsx'), 'utf8');
  const workspaceSource = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(sharedSource, /export function ChannelIdentityBadge/);
  assert.match(sharedSource, /export function ChannelEmptyStateSurface/);
  assert.match(catalogSource, /from '\.\/channelCatalogShared'/);
  assert.match(workspaceSource, /from '\.\/channelCatalogShared'/);
  assert.match(catalogSource, /ChannelIdentityBadge/);
  assert.match(workspaceSource, /ChannelIdentityBadge/);
  assert.match(catalogSource, /ChannelEmptyStateSurface/);
  assert.match(workspaceSource, /ChannelEmptyStateSurface/);
});
