import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest(
  'chat message code highlighting uses a dedicated prism-light helper instead of statically pulling the full syntax highlighter bundle into ChatMessage',
  async () => {
    const chatMessageSource = read('./ChatMessage.tsx');
    const codeHighlighterSource = read('./chatMessageCodeHighlighter.tsx');

    assert.match(chatMessageSource, /ChatMessageCodeHighlighter/);
    assert.doesNotMatch(chatMessageSource, /from 'react-syntax-highlighter'/);
    assert.doesNotMatch(chatMessageSource, /from 'react-syntax-highlighter\/dist\/esm\/styles\/prism'/);

    assert.match(codeHighlighterSource, /react-syntax-highlighter\/dist\/esm\/prism-light/);
    assert.match(codeHighlighterSource, /registerLanguage/);
    assert.match(codeHighlighterSource, /typescript/);
    assert.match(codeHighlighterSource, /javascript/);
    assert.match(codeHighlighterSource, /tsx/);
    assert.match(codeHighlighterSource, /jsx/);
    assert.match(codeHighlighterSource, /json/);
    assert.match(codeHighlighterSource, /yaml/);
    assert.match(codeHighlighterSource, /bash/);
    assert.match(codeHighlighterSource, /python/);
    assert.match(codeHighlighterSource, /rust/);
    assert.match(codeHighlighterSource, /java/);
    assert.match(codeHighlighterSource, /sql/);
    assert.match(codeHighlighterSource, /markdown/);
    assert.match(codeHighlighterSource, /diff/);
    assert.doesNotMatch(codeHighlighterSource, /from 'react-syntax-highlighter';/);
  },
);
