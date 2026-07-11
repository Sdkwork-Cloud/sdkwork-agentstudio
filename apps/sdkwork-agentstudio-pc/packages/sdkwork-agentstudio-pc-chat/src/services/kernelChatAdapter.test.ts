import assert from 'node:assert/strict';
import {
  createKernelChatAdapterCapabilities,
  type KernelChatAdapter,
} from './kernelChatAdapter.ts';

function runTest(name: string, fn: () => Promise<void> | void) {
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

await runTest('kernel chat adapter capabilities default projection metadata from authority semantics', () => {
  const gateway = createKernelChatAdapterCapabilities({
    adapterId: 'openclawGateway',
    authorityKind: 'gateway',
  });
  const http = createKernelChatAdapterCapabilities({
    adapterId: 'transportBacked',
    authorityKind: 'http',
    durable: false,
    writable: true,
    supportsAgentProfiles: false,
  });

  assert.deepEqual(gateway, {
    adapterId: 'openclawGateway',
    authorityKind: 'gateway',
    supported: true,
    durable: true,
    writable: true,
    supportsStreaming: true,
    supportsRuns: true,
    supportsAgentProfiles: true,
    supportsSessionMutation: true,
    capabilitySet: {
      supportsAgentProfiles: true,
      supportsSessionMutation: true,
      supportsStreaming: true,
      supportsRuns: true,
      supportsRunAbort: false,
      supportsModelSelection: false,
      supportsReasoningControl: false,
      supportsThinkingLevel: false,
      supportsFastMode: false,
      supportsVerboseLevel: false,
      supportsAttachments: false,
    },
    reason: null,
  });
  assert.deepEqual(http, {
    adapterId: 'transportBacked',
    authorityKind: 'http',
    supported: true,
    durable: false,
    writable: true,
    supportsStreaming: true,
    supportsRuns: true,
    supportsAgentProfiles: false,
    supportsSessionMutation: true,
    capabilitySet: {
      supportsAgentProfiles: false,
      supportsSessionMutation: true,
      supportsStreaming: true,
      supportsRuns: true,
      supportsRunAbort: false,
      supportsModelSelection: false,
      supportsReasoningControl: false,
      supportsThinkingLevel: false,
      supportsFastMode: false,
      supportsVerboseLevel: false,
      supportsAttachments: false,
    },
    reason: null,
  });
});

await runTest('kernel chat adapter contract can expose capability envelopes without leaking route mode details', () => {
  const adapter: KernelChatAdapter = {
    adapterId: 'hermes',
    getCapabilities() {
      return createKernelChatAdapterCapabilities({
        adapterId: 'hermes',
        authorityKind: 'sqlite',
        supported: false,
        reason: 'Hermes chat transport is not wired yet.',
      });
    },
  };

  assert.deepEqual(adapter.getCapabilities(), {
    adapterId: 'hermes',
    authorityKind: 'sqlite',
    supported: false,
    durable: true,
    writable: true,
    supportsStreaming: true,
    supportsRuns: true,
    supportsAgentProfiles: true,
    supportsSessionMutation: true,
    capabilitySet: {
      supportsAgentProfiles: true,
      supportsSessionMutation: true,
      supportsStreaming: true,
      supportsRuns: true,
      supportsRunAbort: false,
      supportsModelSelection: false,
      supportsReasoningControl: false,
      supportsThinkingLevel: false,
      supportsFastMode: false,
      supportsVerboseLevel: false,
      supportsAttachments: false,
    },
    reason: 'Hermes chat transport is not wired yet.',
  });
});
