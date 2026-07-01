import assert from 'node:assert/strict';
import type { LocalAiProxyRequestLogRecord } from '@sdkwork/claw-types';

import { formatRequestTokenSummary } from './apiLogsPresentation.ts';

const TOKEN_LABELS = {
  total: 'Total',
  input: 'Prompt',
  output: 'Completion',
  cache: 'Cache',
} as const;

function buildRequestLogRecord(
  overrides: Partial<LocalAiProxyRequestLogRecord> = {},
): LocalAiProxyRequestLogRecord {
  return {
    id: 'request-1',
    createdAt: 1_744_000_000_000,
    routeId: 'route-openai',
    routeName: 'OpenAI',
    providerId: 'openai',
    clientProtocol: 'openai-compatible',
    upstreamProtocol: 'openai-compatible',
    endpoint: 'chat/completions',
    status: 'succeeded',
    modelId: 'gpt-5.4',
    baseUrl: 'http://127.0.0.1:18797',
    ttftMs: 42,
    totalDurationMs: 128,
    totalTokens: 12_313,
    inputTokens: 11_000,
    outputTokens: 5,
    cacheTokens: 4_096,
    requestMessageCount: 1,
    responseStatus: 200,
    requestPreview: 'hello',
    responsePreview: 'world',
    requestBody: '{"messages":[]}',
    responseBody: '{"usage":{}}',
    ...overrides,
  };
}

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('formatRequestTokenSummary prefers prompt/completion aliases when available', () => {
  const summary = formatRequestTokenSummary(
    buildRequestLogRecord({
      promptTokens: 12_307,
      completionTokens: 6,
    }),
    TOKEN_LABELS,
  );

  assert.match(summary, /Total: 12,313/);
  assert.match(summary, /Prompt: 12,307/);
  assert.match(summary, /Completion: 6/);
  assert.match(summary, /Cache: 4,096/);
  assert.doesNotMatch(summary, /Prompt: 11,000/);
  assert.equal(
    summary,
    'Total: 12,313 / Prompt: 12,307 / Completion: 6 / Cache: 4,096',
  );
});

runTest('formatRequestTokenSummary falls back to input/output compatibility fields', () => {
  const summary = formatRequestTokenSummary(
    buildRequestLogRecord({
      promptTokens: undefined,
      completionTokens: undefined,
      inputTokens: 321,
      outputTokens: 9,
      totalTokens: 330,
      cacheTokens: 12,
    }),
    TOKEN_LABELS,
  );

  assert.match(summary, /Total: 330/);
  assert.match(summary, /Prompt: 321/);
  assert.match(summary, /Completion: 9/);
  assert.match(summary, /Cache: 12/);
});
