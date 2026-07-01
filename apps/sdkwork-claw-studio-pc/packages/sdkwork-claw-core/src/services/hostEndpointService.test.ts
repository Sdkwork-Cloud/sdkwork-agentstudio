import assert from 'node:assert/strict';
import type { ManageHostEndpointRecord } from '@sdkwork/claw-infrastructure';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createEndpoint(
  overrides: Partial<ManageHostEndpointRecord> = {},
): ManageHostEndpointRecord {
  return {
    endpointId: 'claw-manage-http',
    bindHost: '127.0.0.1',
    requestedPort: 18797,
    activePort: 18797,
    scheme: 'http',
    baseUrl: 'http://127.0.0.1:18797',
    websocketUrl: null,
    loopbackOnly: true,
    dynamicPort: true,
    lastConflictAt: null,
    lastConflictReason: null,
    ...overrides,
  };
}

await runTest(
  'hostEndpointService projects requested and active port governance for canonical host endpoints',
  async () => {
    const { createHostEndpointService } = await import('./hostEndpointService.ts');

    const service = createHostEndpointService({
      getManagePlatform: () => ({
        getHostEndpoints: async () => [
          createEndpoint(),
          createEndpoint({
            endpointId: 'openclaw-gateway-http',
            bindHost: '0.0.0.0',
            requestedPort: 18801,
            activePort: 18819,
            baseUrl: 'http://0.0.0.0:18819',
            websocketUrl: 'ws://0.0.0.0:18819',
            loopbackOnly: false,
            dynamicPort: true,
            lastConflictAt: 1_743_300_000_000,
            lastConflictReason: 'EADDRINUSE',
          }),
        ],
      } as any),
    });

    const endpoints = await service.list();

    assert.equal(endpoints.length, 2);
    assert.equal(endpoints[0]?.endpointId, 'claw-manage-http');
    assert.equal(endpoints[0]?.effectivePort, 18797);
    assert.equal(endpoints[0]?.usesRequestedPort, true);
    assert.equal(endpoints[0]?.hasConflict, false);
    assert.equal(endpoints[0]?.exposureLabel, 'Loopback Only');
    assert.equal(endpoints[0]?.status, 'ready');
    assert.equal(endpoints[1]?.endpointId, 'openclaw-gateway-http');
    assert.equal(endpoints[1]?.effectivePort, 18819);
    assert.equal(endpoints[1]?.usesRequestedPort, false);
    assert.equal(endpoints[1]?.hasConflict, true);
    assert.equal(endpoints[1]?.exposureLabel, 'Network');
    assert.equal(endpoints[1]?.conflictSummary, 'EADDRINUSE');
    assert.equal(endpoints[1]?.status, 'fallback');
  },
);
