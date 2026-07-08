import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { normalizeChatMessageTextEncoding } from './chatTextEncoding.ts';

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

function encodeUtf8AsLatin1(value: string) {
  return Buffer.from(value, 'utf8').toString('latin1');
}

await runTest(
  'normalizeChatMessageTextEncoding repairs UTF-8 text that was decoded as Latin-1',
  () => {
    assert.equal(
      normalizeChatMessageTextEncoding(
        encodeUtf8AsLatin1('你好，消息列表不应该出现乱码。'),
      ),
      '你好，消息列表不应该出现乱码。',
    );
  },
);

await runTest(
  'normalizeChatMessageTextEncoding repairs common Windows-1252 punctuation mojibake',
  () => {
    assert.equal(
      normalizeChatMessageTextEncoding('Itâ€™s fixed â€” no mojibake.'),
      'It’s fixed — no mojibake.',
    );
  },
);

await runTest(
  'normalizeChatMessageTextEncoding leaves already-readable multilingual text unchanged',
  () => {
    assert.equal(
      normalizeChatMessageTextEncoding('中文正常，English normal, déjà vu.'),
      '中文正常，English normal, déjà vu.',
    );
  },
);

await runTest(
  'normalizeChatMessageTextEncoding decodes visible unicode escape sequences only when they improve readability',
  () => {
    assert.equal(
      normalizeChatMessageTextEncoding('\\u4f60\\u597d, OpenClaw'),
      '你好, OpenClaw',
    );
    assert.equal(
      normalizeChatMessageTextEncoding('literal \\u0061 stays explicit'),
      'literal \\u0061 stays explicit',
    );
  },
);
