import assert from 'node:assert/strict';

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

let instanceBaseDetailModule:
  | typeof import('./instanceBaseDetail.ts')
  | undefined;

try {
  instanceBaseDetailModule = await import('./instanceBaseDetail.ts');
} catch {
  instanceBaseDetailModule = undefined;
}

await runTest(
  'projectInstanceBaseDetail maps shared detail fields into a kernel-neutral detail contract',
  async () => {
    assert.ok(instanceBaseDetailModule, 'Expected instanceBaseDetail.ts to exist');
    assert.equal(typeof instanceBaseDetailModule?.projectInstanceBaseDetail, 'function');

    const baseDetail = instanceBaseDetailModule?.projectInstanceBaseDetail({
      instance: {
        id: 'instance-hermes',
        name: 'Hermes Runtime',
        runtimeKind: 'hermes',
        deploymentMode: 'remote',
        transportKind: 'customHttp',
        status: 'online',
        version: '2.1.0',
        isBuiltIn: false,
        host: 'hermes.remote',
      },
      health: {
        score: 92,
        status: 'healthy',
        checks: [{ id: 'runtime', label: 'Runtime', status: 'healthy', detail: 'Ready' }],
      },
      lifecycle: {
        owner: 'remoteService',
        startStopSupported: false,
        configWritable: false,
        lifecycleControllable: false,
        lastActivationStage: 'ready',
        lastError: null,
        notes: ['Remote Linux only'],
      },
      storage: {
        status: 'ready',
        provider: 'remoteApi',
        namespace: 'hermes',
        durable: true,
        queryable: true,
        transactional: false,
        remote: true,
      },
      connectivity: {
        primaryTransport: 'customHttp',
        endpoints: [
          {
            id: 'api',
            label: 'API',
            kind: 'http',
            status: 'ready',
            url: 'https://hermes.example/api',
            exposure: 'remote',
            auth: 'token',
            source: 'runtime',
          },
        ],
      },
      observability: {
        status: 'ready',
        logAvailable: true,
        logFilePath: '/var/log/hermes.log',
        logPreview: ['ready'],
        lastSeenAt: 1712995200000,
        metricsSource: 'runtime',
      },
      dataAccess: {
        routes: [
          {
            id: 'config',
            label: 'Config',
            scope: 'config',
            mode: 'remoteEndpoint',
            status: 'ready',
            target: 'https://hermes.example/config',
            readonly: true,
            authoritative: true,
            detail: 'Remote config',
            source: 'integration',
          },
        ],
      },
      artifacts: [
        {
          id: 'dashboard',
          label: 'Dashboard',
          kind: 'dashboard',
          status: 'remote',
          location: 'https://hermes.example',
          readonly: true,
          detail: 'Remote dashboard',
          source: 'runtime',
        },
      ],
      capabilities: [
        {
          id: 'tools',
          status: 'ready',
          detail: 'Tools enabled',
          source: 'runtime',
        },
      ],
      officialRuntimeNotes: [
        {
          title: 'Windows support',
          content: 'Requires WSL2 or remote Linux',
        },
      ],
      consoleAccess: {
        kind: 'openclawControlUi',
        available: false,
        authMode: 'unknown',
        reason: 'Not supported',
      },
      config: {
        port: '0',
        sandbox: false,
        autoUpdate: false,
        logLevel: 'info',
        corsOrigins: '*',
      },
      logs: '',
      workbench: null,
    } as never);

    assert.equal(baseDetail?.instance.kernelId, 'hermes');
    assert.equal(baseDetail?.instance.instanceId, 'instance-hermes');
    assert.equal(baseDetail?.instance.displayName, 'Hermes Runtime');
    assert.equal(baseDetail?.connectivity.transportId, 'customHttp');
    assert.deepEqual(baseDetail?.observability.logLocations, ['/var/log/hermes.log']);
    assert.equal(baseDetail?.management.consoleAvailability?.available, false);
    assert.equal(baseDetail?.management.actions.length, 0);
    assert.equal(baseDetail?.runtimeNotes[0]?.content, 'Requires WSL2 or remote Linux');
  },
);

await runTest(
  'projectInstanceBaseDetail keeps syncing instances in stop/restart mode instead of re-enabling start',
  async () => {
    assert.ok(instanceBaseDetailModule, 'Expected instanceBaseDetail.ts to exist');

    const baseDetail = instanceBaseDetailModule?.projectInstanceBaseDetail({
      instance: {
        id: 'instance-syncing',
        name: 'Syncing Built-In',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'syncing',
        version: '2026.4.15',
        isBuiltIn: true,
        host: '127.0.0.1',
      },
      health: {
        score: 70,
        status: 'healthy',
        checks: [],
      },
      lifecycle: {
        owner: 'appManaged',
        startStopSupported: true,
        configWritable: true,
        lifecycleControllable: true,
        lastActivationStage: 'runtime_sync',
        lastError: null,
        notes: [],
      },
      storage: {
        status: 'ready',
        provider: 'localFile',
        namespace: 'instance-syncing',
        durable: true,
        queryable: true,
        transactional: false,
        remote: false,
      },
      connectivity: {
        primaryTransport: 'openclawGatewayWs',
        endpoints: [],
      },
      observability: {
        status: 'ready',
        logAvailable: true,
        logFilePath: null,
        logPreview: [],
        lastSeenAt: null,
        metricsSource: 'runtime',
      },
      dataAccess: {
        routes: [],
      },
      artifacts: [],
      capabilities: [],
      officialRuntimeNotes: [],
      consoleAccess: null,
      config: {
        port: '21280',
        sandbox: true,
        autoUpdate: true,
        logLevel: 'info',
        corsOrigins: '*',
      },
      logs: '',
      workbench: null,
    } as never);

    const actionsById = Object.fromEntries(
      (baseDetail?.management.actions ?? []).map((action) => [action.id, action]),
    );

    assert.equal(actionsById.start?.enabled, false);
    assert.equal(actionsById.stop?.enabled, true);
    assert.equal(actionsById.restart?.enabled, true);
  },
);
