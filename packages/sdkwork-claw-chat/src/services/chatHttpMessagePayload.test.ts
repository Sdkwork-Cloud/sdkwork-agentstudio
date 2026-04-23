import assert from 'node:assert/strict';

import { buildChatHttpRequestMessages } from './chatHttpMessagePayload.ts';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const screenshotAttachment = {
  id: 'asset-shot',
  kind: 'screenshot' as const,
  name: 'error-screen.png',
  mimeType: 'image/png',
  sizeBytes: 1234,
  url: 'https://cdn.example.com/chat/error-screen.png',
  previewUrl: 'https://cdn.example.com/chat/error-screen.png',
  objectKey: 'chat/2026/04/21/error-screen.png',
};

const audioAttachment = {
  id: 'asset-audio',
  kind: 'audio' as const,
  name: 'voice-note.webm',
  mimeType: 'audio/webm',
  sizeBytes: 4096,
  url: 'https://cdn.example.com/chat/voice-note.webm',
  previewUrl: 'https://cdn.example.com/chat/voice-note.webm',
  objectKey: 'chat/2026/04/21/voice-note.webm',
};

await runTest(
  'buildChatHttpRequestMessages uses OpenAI-style multimodal user content while preserving non-inline attachment context in text',
  () => {
    const messages = buildChatHttpRequestMessages({
      systemInstruction: 'You are a precise assistant.',
      userText: 'Inspect the screenshot and summarize the spoken note.',
      attachments: [screenshotAttachment, audioAttachment],
    });

    assert.deepEqual(messages, [
      {
        role: 'system',
        content: 'You are a precise assistant.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Inspect the screenshot and summarize the spoken note.\n\nAttachments:\n1. [audio] voice-note.webm\nURL: https://cdn.example.com/chat/voice-note.webm',
          },
          {
            type: 'image_url',
            image_url: {
              url: 'https://cdn.example.com/chat/error-screen.png',
            },
          },
        ],
      },
    ]);
  },
);

await runTest(
  'buildChatHttpRequestMessages falls back to a simple text user message when there are no multimodal attachments',
  () => {
    const messages = buildChatHttpRequestMessages({
      systemInstruction: 'Be concise.',
      userText: 'Hello world',
      attachments: [],
    });

    assert.deepEqual(messages, [
      {
        role: 'system',
        content: 'Be concise.',
      },
      {
        role: 'user',
        content: 'Hello world',
      },
    ]);
  },
);
