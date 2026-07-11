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

runTest('ChannelWorkspace gives documented scan-capable channels a command-first connection panel with manual fallback', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /QrCode/);
  assert.match(source, /Keyboard/);
  assert.match(source, /getChannelBindingGuide/);
  assert.match(source, /selectedBindingGuide/);
  assert.match(source, /selectedConnectionMode === 'qr'/);
  assert.match(source, /data-slot="channel-workspace-qr-panel"/);
  assert.match(source, /data-slot="channel-workspace-binding-command"/);
  assert.match(source, /data-slot="channel-workspace-binding-step"/);
  assert.match(source, /data-slot="channel-workspace-qr-manual-action"/);
  assert.match(source, /texts\.qrConnectionTitle/);
  assert.match(source, /texts\.manualConfigurationAction/);
  assert.match(source, /setSelectedConnectionMode\('manual'\)/);
  assert.doesNotMatch(source, /buildChannelQrContent/);
  assert.doesNotMatch(source, /QRCode\.toDataURL/);
});

runTest('ChannelWorkspace keeps credentials hidden until scan-capable setup switches to manual entry', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /const shouldShowCredentialsPanel = !selectedBindingGuide \|\| selectedConnectionMode === 'manual'/);
  assert.match(source, /\{shouldShowCredentialsPanel \? \(/);
  assert.match(source, /data-slot="channel-workspace-credentials-panel"/);
});

runTest('ChannelWorkspace opens documented binding destinations without submitting manual fields while scan setup is active', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /const handleQrConnect = \(\) =>/);
  assert.match(source, /onStartBinding/);
  assert.match(source, /bindingSession/);
  assert.match(source, /void onStartBinding\(selectedChannel\)/);
  assert.match(source, /setSelectedConnectionMode\('manual'\)/);
  assert.match(source, /selectedBindingGuide && selectedConnectionMode === 'qr'/);
  assert.match(source, /texts\.actionConnect/);
});

runTest('ChannelWorkspace renders real binding QR payloads and progress from the channel feature session', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'ChannelWorkspace.tsx'), 'utf8');

  assert.match(source, /ChannelWorkspaceBindingSession/);
  assert.match(source, /selectedBindingSession\?\.qrImageSrc/);
  assert.match(source, /data-slot="channel-workspace-binding-qr-image"/);
  assert.match(source, /data-slot="channel-workspace-binding-terminal-qr"/);
  assert.match(source, /data-slot="channel-workspace-binding-output"/);
  assert.match(source, /selectedBindingSession\?\.state === 'connected'/);
  assert.match(source, /selectedBindingSession\?\.state === 'failed'/);
  assert.doesNotMatch(source, /kind: sdkwork-agentstudio-pc-channel-connect/);
});
