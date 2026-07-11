import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import { markdownContentReactMarkdownProps } from './markdownContentSupport.ts';

function runTest(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

function renderMarkdown(content: string) {
  return renderToStaticMarkup(
    React.createElement(ReactMarkdown, markdownContentReactMarkdownProps, content),
  );
}

await runTest('markdownContentReactMarkdownProps escapes raw html instead of rendering executable elements', () => {
  const markup = renderMarkdown('<img src="x" onerror="alert(1)">Hello<script>alert(1)</script>');

  assert.match(markup, /&lt;img src=&quot;x&quot; onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(markup, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<img\b/);
  assert.doesNotMatch(markup, /<script\b/);
});

await runTest('markdownContentReactMarkdownProps blocks unsafe javascript links while keeping markdown structure', () => {
  const markup = renderMarkdown('[open](javascript:alert(1))');

  assert.match(markup, /<a href="">open<\/a>/);
  assert.doesNotMatch(markup, /javascript:alert/);
});

await runTest('markdownContentReactMarkdownProps supports GFM tables for commercial content rendering', () => {
  const markup = renderMarkdown([
    '| Plan | SLA |',
    '| --- | --- |',
    '| Pro | 24h |',
  ].join('\n'));

  assert.match(markup, /<table>/);
  assert.match(markup, /<td>Pro<\/td>/);
  assert.match(markup, /<td>24h<\/td>/);
});
