import assert from 'node:assert/strict';

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
  'hostPortSettingsService summarizes requested and active ports, fallback conflicts, and browser entrypoint',
  async () => {
    const { createHostPortSettingsService } = await import('./hostPortSettingsService.ts');

    const service = createHostPortSettingsService({
      hostEndpointService: {
        list: async () => [
          {
            endpointId: 'claw-manage-http',
            bindHost: '127.0.0.1',
            requestedPort: 18797,
            activePort: 18797,
            effectivePort: 18797,
            scheme: 'http',
            baseUrl: 'http://127.0.0.1:18797',
            websocketUrl: null,
            loopbackOnly: true,
            dynamicPort: true,
            usesRequestedPort: true,
            hasConflict: false,
            exposureLabel: 'Loopback Only',
            conflictSummary: null,
            status: 'ready',
          },
          {
            endpointId: 'openclaw-gateway-http',
            bindHost: '0.0.0.0',
            requestedPort: 18801,
            activePort: 18819,
            effectivePort: 18819,
            scheme: 'http',
            baseUrl: 'http://0.0.0.0:18819',
            websocketUrl: 'ws://0.0.0.0:18819',
            loopbackOnly: false,
            dynamicPort: true,
            usesRequestedPort: false,
            hasConflict: true,
            exposureLabel: 'Network',
            conflictSummary: 'EADDRINUSE',
            status: 'fallback',
          },
          {
            endpointId: 'claw-manage-ws',
            bindHost: '127.0.0.1',
            requestedPort: 18802,
            activePort: null,
            effectivePort: null,
            scheme: 'ws',
            baseUrl: null,
            websocketUrl: null,
            loopbackOnly: true,
            dynamicPort: false,
            usesRequestedPort: false,
            hasConflict: false,
            exposureLabel: 'Loopback Only',
            conflictSummary: null,
            status: 'pending',
          },
        ],
      } as any,
    });

    const summary = await service.getSummary();

    assert.equal(summary.totalEndpoints, 3);
    assert.equal(summary.readyEndpoints, 2);
    assert.equal(summary.conflictedEndpoints, 1);
    assert.equal(summary.dynamicPortEndpoints, 2);
    assert.equal(summary.browserBaseUrl, 'http://127.0.0.1:18797');
    assert.equal(summary.rows[0]?.portBindingLabel, '18797');
    assert.equal(summary.rows[0]?.statusLabel, 'Requested Port Active');
    assert.equal(summary.rows[1]?.portBindingLabel, '18801 -> 18819');
    assert.equal(summary.rows[1]?.statusLabel, 'Fallback Active');
    assert.equal(
      summary.rows[1]?.conflictSummary,
      'Requested port unavailable: EADDRINUSE',
    );
    assert.equal(summary.rows[2]?.statusLabel, 'Pending');
  },
);
