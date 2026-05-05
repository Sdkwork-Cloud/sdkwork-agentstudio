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

runTest('ChannelWorkspace keeps category tabs title-only without passing description copy into the shared region tabs', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.doesNotMatch(source, /const regionDescriptions: Partial<Record<ChannelCatalogRegion, string>> =/);
  assert.doesNotMatch(source, /buildChannelCatalogRegionDescriptions\(t\)/);
  assert.doesNotMatch(source, /descriptions=\{regionDescriptions\}/);
});

runTest('ChannelWorkspace keeps the management drawer on a premium segmented surface system', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /data-slot="channel-workspace-drawer-header"/);
  assert.match(source, /data-slot="channel-workspace-setup-panel"/);
  assert.match(source, /data-slot="channel-workspace-credentials-panel"/);
  assert.match(source, /data-slot="channel-workspace-footer"/);
  assert.match(source, /selectedChannel\.description/);
  assert.match(source, /rounded-\[24px\]/);
  assert.match(source, /bg-gradient-to-br from-white via-white to-zinc-50/);
  assert.match(source, /bg-gradient-to-br from-primary-50 via-white to-primary-100\/70/);
  assert.match(source, /border border-zinc-200\/80 bg-white\/92/);
});

runTest('ChannelWorkspace reads region copy from the shared catalog region content helper', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /from '\.\/channelCatalogRegionContent'/);
  assert.match(source, /buildChannelCatalogRegionLabels\(t\)/);
  assert.match(source, /getChannelCatalogRegionEmptyText\(t, activeRegion\)/);
});

runTest('ChannelWorkspace uses the same premium empty state surface language as the catalog', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /dataSlot="channel-workspace-empty-state"/);
  assert.match(source, /rounded-\[24px\] border border-dashed border-zinc-300\/80 bg-gradient-to-br from-white via-white to-zinc-50\/90/);
});

runTest('ChannelWorkspace removes leftover hardcoded English drawer copy and routes channel content through localization helpers', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.doesNotMatch(source, /Delete configuration/);
  assert.doesNotMatch(source, /is required\./);
  assert.match(source, /localizeChannelWorkspaceItem\(t, item, \{\s*localizeMetadata: false,\s*\}\)/);
  assert.match(source, /localizeChannelOfficialLink\(t, channel\.id,/);
  assert.match(source, /texts\.validationRequiredField\(missingField\.label\)/);
});

runTest('ChannelWorkspace gives domestic channels a QR-first connection panel with a manual configuration fallback', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /import \* as QRCode from 'qrcode'/);
  assert.match(source, /QrCode/);
  assert.match(source, /Keyboard/);
  assert.match(source, /supportsChannelQrConnection/);
  assert.match(source, /selectedChannelSupportsQrConnection/);
  assert.match(source, /selectedConnectionMode === 'qr'/);
  assert.match(source, /data-slot="channel-workspace-qr-panel"/);
  assert.match(source, /data-slot="channel-workspace-qr-manual-action"/);
  assert.match(source, /texts\.qrConnectionTitle/);
  assert.match(source, /texts\.manualConfigurationAction/);
  assert.match(source, /setSelectedConnectionMode\('manual'\)/);
});

runTest('ChannelWorkspace keeps credentials hidden until domestic QR setup switches to manual entry', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /const shouldShowCredentialsPanel = !selectedChannelSupportsQrConnection \|\| selectedConnectionMode === 'manual'/);
  assert.match(source, /\{shouldShowCredentialsPanel \? \(/);
  assert.match(source, /data-slot="channel-workspace-credentials-panel"/);
});

runTest('ChannelWorkspace does not submit required manual fields while the domestic QR panel is still active', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /const handleQrConnect = \(\) =>/);
  assert.match(source, /selectedChannel\.fields\.length === 0 && onToggleEnabled/);
  assert.match(source, /setSelectedConnectionMode\('manual'\)/);
  assert.match(source, /selectedChannelSupportsQrConnection && selectedConnectionMode === 'qr'/);
  assert.match(source, /texts\.actionConnect/);
});
