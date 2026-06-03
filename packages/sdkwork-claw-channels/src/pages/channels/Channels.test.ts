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

runTest('Channels page uses the full available workspace width', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'Channels.tsx'), 'utf8');

  assert.doesNotMatch(source, /mx-auto max-w-5xl/);
  assert.match(source, /w-full space-y-6/);
  assert.doesNotMatch(source, /text-3xl font-bold tracking-tight text-zinc-900/);
  assert.doesNotMatch(source, /t\('channels\.page\.title'\)/);
});

runTest('Channels page keeps channel feedback copy and validation wired to locale keys instead of inline English fallbacks', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'Channels.tsx'), 'utf8');

  assert.doesNotMatch(source, /defaultValue:\s*'/);
  assert.match(source, /t\('channels\.page\.feedback\.loadFailedServiceUnavailable'\)/);
  assert.match(source, /t\('channels\.page\.feedback\.toggleFailed'\)/);
  assert.match(source, /t\('channels\.page\.feedback\.saveFailed'\)/);
  assert.match(source, /t\('channels\.page\.feedback\.deleteFailed'\)/);
  assert.match(source, /t\('channels\.page\.feedback\.loadFailed'\)/);
  assert.match(source, /t\('channels\.page\.validation\.requiredField', \{ field: fieldLabel \}\)/);
  assert.match(source, /localizeChannelWorkspaceItem\(t, \{/);
});

runTest('Channels page starts a real binding session instead of opening docs when scan setup is available', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'Channels.tsx'), 'utf8');

  assert.match(source, /channelBindingSessionService/);
  assert.match(source, /const \[bindingSession, setBindingSession\]/);
  assert.match(source, /handleStartBinding/);
  assert.match(source, /onStartBinding=\{handleStartBinding\}/);
  assert.match(source, /bindingSession=\{bindingSession\}/);
  assert.match(source, /subscribeProcessOutput/);
  assert.match(source, /subscribeJobUpdates/);
  assert.match(source, /extractChannelBindingQrPayload/);
  assert.match(source, /channelService\.getChannels\(effectiveInstanceId\)/);
});
