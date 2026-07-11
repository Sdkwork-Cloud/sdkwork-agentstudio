import assert from 'node:assert/strict';
import {
  isGatewayAuthoritativeRouteMode,
  isGatewayAuthorityKind,
  resolveGatewayAuthoritativeKernelChat,
  shouldUseGatewayAuthoritativeSessionStore,
  shouldUseOpenClawGatewayKernelCatalog,
} from './kernelChatAuthorityPolicy.ts';

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

await runTest('kernelChatAuthorityPolicy identifies gateway authority kinds explicitly', () => {
  assert.equal(isGatewayAuthorityKind('gateway'), true);
  assert.equal(isGatewayAuthorityKind('http'), false);
  assert.equal(isGatewayAuthorityKind('sqlite'), false);
  assert.equal(isGatewayAuthorityKind(null), false);
});

await runTest('kernelChatAuthorityPolicy identifies gateway-authoritative route modes explicitly', () => {
  assert.equal(isGatewayAuthoritativeRouteMode('instanceOpenClawGatewayWs'), true);
  assert.equal(isGatewayAuthoritativeRouteMode('instanceOpenAiHttp'), false);
  assert.equal(isGatewayAuthoritativeRouteMode('unsupported'), false);
  assert.equal(isGatewayAuthoritativeRouteMode(null), false);
});

await runTest('kernelChatAuthorityPolicy resolves gateway authority from session truth before adapter metadata', () => {
  assert.equal(
    resolveGatewayAuthoritativeKernelChat({
      adapterCapabilities: {
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
      },
      sessionAuthorityKind: 'gateway',
    }),
    true,
  );
});

await runTest('kernelChatAuthorityPolicy allows gateway authority to select the gateway kernel catalog projection without relying on adapter ids', () => {
  assert.equal(
    shouldUseOpenClawGatewayKernelCatalog({
      adapterCapabilities: {
        adapterId: 'customGatewayBridge',
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
      },
    }),
    true,
  );
});

await runTest('kernelChatAuthorityPolicy resolves gateway-authoritative session store usage from route truth plus authority semantics instead of adapter ids', () => {
  assert.equal(
    shouldUseGatewayAuthoritativeSessionStore({
      routeMode: 'instanceOpenClawGatewayWs',
      adapterCapabilities: {
        adapterId: 'customGatewayBridge',
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
      },
    }),
    true,
  );

  assert.equal(
    shouldUseGatewayAuthoritativeSessionStore({
      routeMode: 'instanceOpenAiHttp',
      adapterCapabilities: {
        adapterId: 'customGatewayBridge',
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
      },
    }),
    false,
  );
});
