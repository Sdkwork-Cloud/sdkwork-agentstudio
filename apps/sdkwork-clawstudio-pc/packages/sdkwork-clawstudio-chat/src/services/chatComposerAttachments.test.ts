import assert from 'node:assert/strict';
import {
  buildGatewayAttachments,
  composeOutgoingChatText,
  deriveUserMessageTitle,
} from './chatComposerAttachments.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const screenshotAttachment = {
  id: 'asset-shot',
  kind: 'screenshot' as const,
  name: 'error-screen.png',
  mimeType: 'image/png',
  sizeBytes: 1234,
  url: 'https://cdn.example.com/chat/error-screen.png',
  previewUrl: 'https://cdn.example.com/chat/error-screen.png',
  objectKey: 'chat/2026/03/22/error-screen.png',
};

const audioAttachment = {
  id: 'asset-audio',
  kind: 'audio' as const,
  name: 'voice-note.webm',
  mimeType: 'audio/webm',
  sizeBytes: 4096,
  url: 'https://cdn.example.com/chat/voice-note.webm',
  previewUrl: 'https://cdn.example.com/chat/voice-note.webm',
  objectKey: 'chat/2026/03/22/voice-note.webm',
};

await runTest('composeOutgoingChatText keeps user text and appends a clean attachment context block for text-only providers', () => {
  const text = composeOutgoingChatText('Please inspect the bug and the spoken note.', [
    screenshotAttachment,
    audioAttachment,
  ]);

  assert.match(text, /^Please inspect the bug and the spoken note\./);
  assert.match(text, /Attachments:/);
  assert.match(text, /error-screen\.png/);
  assert.match(text, /voice-note\.webm/);
  assert.match(text, /https:\/\/cdn\.example\.com\/chat\/error-screen\.png/);
  assert.match(text, /https:\/\/cdn\.example\.com\/chat\/voice-note\.webm/);
});

await runTest('composeOutgoingChatText produces a useful attachment-only prompt when the user sends no text', () => {
  const text = composeOutgoingChatText('', [screenshotAttachment]);

  assert.match(text, /The user sent attachments without additional text\./);
  assert.match(text, /error-screen\.png/);
});

await runTest('buildGatewayAttachments maps chat attachments into gateway-friendly payload objects', () => {
  const payload = buildGatewayAttachments([screenshotAttachment, audioAttachment]);

  assert.deepEqual(payload, [
    {
      id: 'asset-shot',
      kind: 'screenshot',
      name: 'error-screen.png',
      mimeType: 'image/png',
      sizeBytes: 1234,
      url: 'https://cdn.example.com/chat/error-screen.png',
      previewUrl: 'https://cdn.example.com/chat/error-screen.png',
      objectKey: 'chat/2026/03/22/error-screen.png',
    },
    {
      id: 'asset-audio',
      kind: 'audio',
      name: 'voice-note.webm',
      mimeType: 'audio/webm',
      sizeBytes: 4096,
      url: 'https://cdn.example.com/chat/voice-note.webm',
      previewUrl: 'https://cdn.example.com/chat/voice-note.webm',
      objectKey: 'chat/2026/03/22/voice-note.webm',
    },
  ]);
});

await runTest('deriveUserMessageTitle prefers trimmed text but falls back to attachment names for attachment-only messages', () => {
  assert.equal(
    deriveUserMessageTitle({
      text: '  Need a quick summary of these assets  ',
      attachments: [screenshotAttachment],
    }),
    'Need a quick summary of these assets',
  );

  assert.equal(
    deriveUserMessageTitle({
      text: '   ',
      attachments: [screenshotAttachment, audioAttachment],
    }),
    'error-screen.png, voice-note.webm',
  );
});

await runTest('deriveUserMessageTitle collapses multiline whitespace into a single readable line', () => {
  assert.equal(
    deriveUserMessageTitle({
      text: '  Build   a release plan\n\nfor the api router \t and summarize blockers  ',
      attachments: [],
    }),
    'Build a release plan for the api router and summarize blockers',
  );
});
