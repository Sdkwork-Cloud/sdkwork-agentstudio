import assert from 'node:assert/strict';
import type { StudioWorkbenchLLMProviderRequestOverridesRecord } from '@sdkwork/claw-types';
import {
  formatOpenClawProviderRequestOverridesDraft,
  parseOpenClawProviderRequestOverridesDraft,
} from './openClawProviderRequestDraft.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('openClawProviderRequestDraft formats request overrides into JSON5 text', () => {
  const formatted = formatOpenClawProviderRequestOverridesDraft({
    headers: {
      'OpenAI-Organization': 'org_live',
    },
    auth: {
      mode: 'authorization-bearer',
      token: '${OPENAI_API_KEY}',
    },
  });

  assert.match(formatted, /OpenAI-Organization/);
  assert.match(formatted, /authorization-bearer/);
});

await runTest('openClawProviderRequestDraft parses and normalizes request overrides from JSON5 text', () => {
  const parsed = parseOpenClawProviderRequestOverridesDraft(`{
  headers: {
    "OpenAI-Organization": "org_live",
  },
  auth: {
    mode: "authorization-bearer",
    token: "\${OPENAI_API_KEY}",
  },
  proxy: {
    mode: "explicit-proxy",
    url: "http://127.0.0.1:8080",
  },
  tls: {
    insecureSkipVerify: true,
    serverName: "api.openai.internal",
  },
}`);

  assert.deepEqual(parsed, {
    headers: {
      'OpenAI-Organization': 'org_live',
    },
    auth: {
      mode: 'authorization-bearer',
      token: '${OPENAI_API_KEY}',
    },
    proxy: {
      mode: 'explicit-proxy',
      url: 'http://127.0.0.1:8080',
    },
    tls: {
      insecureSkipVerify: true,
      serverName: 'api.openai.internal',
    },
  } satisfies StudioWorkbenchLLMProviderRequestOverridesRecord);
});

await runTest('openClawProviderRequestDraft rejects unsupported auth modes', () => {
  assert.throws(
    () =>
      parseOpenClawProviderRequestOverridesDraft(`{
  auth: {
    mode: "basic",
  },
}`),
    /auth\.mode/i,
  );
});
