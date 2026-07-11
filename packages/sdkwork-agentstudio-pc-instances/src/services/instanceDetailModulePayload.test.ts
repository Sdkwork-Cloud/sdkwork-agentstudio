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

let instanceDetailModulePayloadModule:
  | typeof import('./instanceDetailModulePayload.ts')
  | undefined;

try {
  instanceDetailModulePayloadModule = await import('./instanceDetailModulePayload.ts');
} catch {
  instanceDetailModulePayloadModule = undefined;
}

await runTest(
  'createOpenClawInstanceDetailModulePayload projects workbench data into a standardized kernel module payload',
  async () => {
    assert.ok(instanceDetailModulePayloadModule, 'Expected instanceDetailModulePayload.ts to exist');
    assert.equal(
      typeof instanceDetailModulePayloadModule?.createOpenClawInstanceDetailModulePayload,
      'function',
    );

    const fakeWorkbench = {
      instance: {
        id: 'instance-openclaw',
      },
    } as never;

    const payload = instanceDetailModulePayloadModule?.createOpenClawInstanceDetailModulePayload(
      fakeWorkbench,
    );

    assert.equal(payload?.kernelId, 'openclaw');
    assert.equal(payload?.moduleType, 'openclaw-workbench');
    assert.deepEqual(payload?.sections, {
      workbench: fakeWorkbench,
    });
    assert.deepEqual(payload?.navigation, []);
    assert.deepEqual(payload?.diagnostics, []);
    assert.deepEqual(payload?.managementActions, []);
  },
);

await runTest(
  'createHermesInstanceDetailModulePayload projects Hermes environment, readiness, and policy data into a standardized kernel module payload',
  async () => {
    assert.ok(instanceDetailModulePayloadModule, 'Expected instanceDetailModulePayload.ts to exist');
    assert.equal(
      typeof instanceDetailModulePayloadModule?.createHermesInstanceDetailModulePayload,
      'function',
    );

    const baseDetail = {
      instance: {
        kernelId: 'hermes',
        instanceId: 'instance-hermes',
        displayName: 'Hermes Runtime',
        deploymentMode: 'remote',
        transportId: 'customHttp',
        status: 'online',
        version: '0.9.0',
        hostLabel: 'linux-builder',
      },
      lifecycle: {
        owner: 'remoteService',
        lifecycle: 'observed',
        activationStage: null,
        configWritable: false,
        lifecycleControllable: false,
        notes: ['Remote Linux transport attached.'],
      },
      health: {
        score: 92,
        status: 'healthy',
        checks: [],
      },
      storage: {
        status: 'ready',
        provider: 'remoteApi',
        namespace: 'hermes',
        profileId: null,
        database: null,
        connectionHint: null,
        endpoint: 'https://storage.example.com',
        durable: true,
        queryable: true,
        transactional: false,
        remote: true,
      },
      connectivity: {
        transportId: 'customHttp',
        endpoints: [
          {
            id: 'base-url',
            label: 'Base URL',
            kind: 'http',
            status: 'ready',
            url: 'https://hermes.example.com',
            exposure: 'remote',
            auth: 'token',
            source: 'config',
          },
        ],
      },
      observability: {
        status: 'limited',
        logAvailable: true,
        logLocations: ['/var/log/hermes.log'],
        lastSeenAt: null,
        logPreview: ['Hermes online'],
        metricsSource: 'derived',
      },
      dataAccess: {
        routes: [
          {
            id: 'config',
            label: 'Configuration',
            scope: 'config',
            mode: 'metadataOnly',
            status: 'ready',
            target: 'studio.instances registry metadata',
            readonly: false,
            authoritative: false,
            detail: 'Registry-backed detail projects configuration from Agent Studio metadata.',
            source: 'integration',
          },
        ],
      },
      artifacts: [
        {
          id: 'storage-binding',
          label: 'Storage Binding',
          kind: 'storageBinding',
          status: 'remote',
          location: 'https://storage.example.com',
          readonly: false,
          detail: 'Registry-backed detail projects storage metadata only.',
          source: 'storage',
        },
      ],
      capabilities: [
        {
          id: 'chat',
          status: 'ready',
          detail: 'Registry-backed detail projection.',
          source: 'runtime',
        },
      ],
      runtimeNotes: [
        {
          title: 'Windows WSL2 or remote Linux',
          content: 'Windows hosts must run Hermes through WSL2 or a remote Linux environment.',
          sourceUrl: 'https://github.com/nousresearch/hermes-agent',
        },
        {
          title: 'External runtimes',
          content: 'Python and uv must be installed externally. Node.js remains external and optional for some Hermes capabilities.',
          sourceUrl: 'https://hermes-agent.nousresearch.com/docs/getting-started/installation/',
        },
      ],
      management: {
        actions: [],
        consoleAvailability: null,
        diagnostics: [],
      },
    } as never;

    const payload =
      instanceDetailModulePayloadModule?.createHermesInstanceDetailModulePayload(baseDetail);
    const hermesPayload = instanceDetailModulePayloadModule?.getHermesInstanceDetailModulePayload(
      payload || null,
    );

    assert.equal(payload?.kernelId, 'hermes');
    assert.equal(payload?.moduleType, 'hermes-runtime');
    assert.ok(hermesPayload);
    assert.equal(hermesPayload?.sections.runtimePolicies.length, 3);
    assert.deepEqual(
      hermesPayload?.sections.runtimePolicies.map((policy) => policy.id),
      ['windows', 'python', 'node'],
    );
    assert.deepEqual(
      hermesPayload?.sections.readinessChecks.map((check) => check.id),
      ['deploymentTarget', 'endpointExposure', 'observability'],
    );
    assert.equal(hermesPayload?.sections.readinessChecks[0]?.status, 'configured');
    assert.deepEqual(hermesPayload?.sections.environment, {
      deploymentMode: 'remote',
      transportId: 'customHttp',
      hostLabel: 'linux-builder',
      version: '0.9.0',
      endpointCount: 1,
    });
    assert.deepEqual(hermesPayload?.sections.config, {
      storageProvider: 'remoteApi',
      dataAccessRouteCount: 1,
      artifactCount: 1,
    });
    assert.deepEqual(hermesPayload?.sections.notes, [
      'Remote Linux transport attached.',
      'Windows WSL2 or remote Linux: Windows hosts must run Hermes through WSL2 or a remote Linux environment.',
      'External runtimes: Python and uv must be installed externally. Node.js remains external and optional for some Hermes capabilities.',
    ]);
  },
);

await runTest(
  'createHermesInstanceDetailModulePayload treats local-external Hermes deployment as a supported readiness posture',
  async () => {
    assert.ok(instanceDetailModulePayloadModule, 'Expected instanceDetailModulePayload.ts to exist');

    const payload = instanceDetailModulePayloadModule?.createHermesInstanceDetailModulePayload({
      instance: {
        kernelId: 'hermes',
        instanceId: 'instance-hermes-local',
        displayName: 'Hermes Local External',
        deploymentMode: 'local-external',
        transportId: 'customHttp',
        status: 'online',
        version: '0.9.0',
        hostLabel: 'wsl://Ubuntu-24.04',
      },
      lifecycle: {
        owner: 'externalProcess',
        lifecycle: 'observed',
        activationStage: null,
        configWritable: false,
        lifecycleControllable: false,
        notes: ['Hermes is attached from an external runtime.'],
      },
      health: {
        score: 88,
        status: 'healthy',
        checks: [],
      },
      storage: {
        status: 'ready',
        provider: 'localFile',
        namespace: 'hermes-local',
        profileId: null,
        database: null,
        connectionHint: null,
        endpoint: null,
        durable: true,
        queryable: false,
        transactional: false,
        remote: false,
      },
      connectivity: {
        transportId: 'customHttp',
        endpoints: [
          {
            id: 'base-url',
            label: 'Base URL',
            kind: 'http',
            status: 'ready',
            url: 'http://127.0.0.1:9540',
            exposure: 'loopback',
            auth: 'unknown',
            source: 'config',
          },
        ],
      },
      observability: {
        status: 'limited',
        logAvailable: false,
        logLocations: [],
        lastSeenAt: null,
        logPreview: [],
        metricsSource: 'derived',
      },
      dataAccess: {
        routes: [],
      },
      artifacts: [],
      capabilities: [],
      runtimeNotes: [
        {
          title: 'Windows WSL2 or remote Linux',
          content: 'Windows hosts must run Hermes through WSL2 or a remote Linux environment.',
          sourceUrl: 'https://github.com/nousresearch/hermes-agent',
        },
      ],
      management: {
        actions: [],
        consoleAvailability: null,
        diagnostics: [],
      },
    } as never);
    const hermesPayload = instanceDetailModulePayloadModule?.getHermesInstanceDetailModulePayload(
      payload || null,
    );
    const deploymentTarget = hermesPayload?.sections.readinessChecks.find(
      (check) => check.id === 'deploymentTarget',
    );

    assert.equal(deploymentTarget?.status, 'configured');
    assert.equal(
      deploymentTarget?.detailKey,
      'instances.detail.modules.hermes.readiness.deploymentTarget.configured',
    );
    assert.equal(
      hermesPayload?.diagnostics.some((diagnostic) => diagnostic.id === 'hermes-deploymentTarget'),
      false,
    );
  },
);

await runTest(
  'createHermesInstanceDetailModulePayload treats local-managed Hermes deployment as a supported target posture when the kernel is app-managed under the user-root layout',
  async () => {
    assert.ok(instanceDetailModulePayloadModule, 'Expected instanceDetailModulePayload.ts to exist');

    const payload = instanceDetailModulePayloadModule?.createHermesInstanceDetailModulePayload({
      instance: {
        kernelId: 'hermes',
        instanceId: 'instance-hermes-managed',
        displayName: 'Hermes Managed',
        deploymentMode: 'local-managed',
        transportId: 'customHttp',
        status: 'offline',
        version: '0.9.0',
        hostLabel: 'desktop-host',
      },
      lifecycle: {
        owner: 'appManaged',
        lifecycle: 'managed',
        activationStage: null,
        configWritable: false,
        lifecycleControllable: false,
        notes: [],
      },
      health: {
        score: 40,
        status: 'attention',
        checks: [],
      },
      storage: {
        status: 'planned',
        provider: 'localFile',
        namespace: 'hermes-managed',
        profileId: null,
        database: null,
        connectionHint: null,
        endpoint: null,
        durable: true,
        queryable: false,
        transactional: false,
        remote: false,
      },
      connectivity: {
        transportId: 'customHttp',
        endpoints: [],
      },
      observability: {
        status: 'unavailable',
        logAvailable: false,
        logLocations: [],
        lastSeenAt: null,
        logPreview: [],
        metricsSource: 'derived',
      },
      dataAccess: {
        routes: [],
      },
      artifacts: [],
      capabilities: [],
      runtimeNotes: [],
      management: {
        actions: [],
        consoleAvailability: null,
        diagnostics: [],
      },
    } as never);
    const hermesPayload = instanceDetailModulePayloadModule?.getHermesInstanceDetailModulePayload(
      payload || null,
    );
    const deploymentTarget = hermesPayload?.sections.readinessChecks.find(
      (check) => check.id === 'deploymentTarget',
    );

    assert.equal(deploymentTarget?.status, 'configured');
    assert.equal(
      deploymentTarget?.detailKey,
      'instances.detail.modules.hermes.readiness.deploymentTarget.configured',
    );
    assert.equal(
      hermesPayload?.diagnostics.some((diagnostic) => diagnostic.id === 'hermes-deploymentTarget'),
      false,
    );
  },
);

await runTest(
  'getOpenClawWorkbenchFromModulePayload returns the projected workbench only for openclaw workbench payloads',
  async () => {
    const fakeWorkbench = {
      instance: {
        id: 'instance-openclaw',
      },
    } as never;

    const payload = instanceDetailModulePayloadModule?.createOpenClawInstanceDetailModulePayload(
      fakeWorkbench,
    );

    assert.equal(
      instanceDetailModulePayloadModule?.getOpenClawWorkbenchFromModulePayload(payload || null),
      fakeWorkbench,
    );
    assert.equal(
      instanceDetailModulePayloadModule?.getOpenClawWorkbenchFromModulePayload({
        kernelId: 'hermes',
        moduleType: 'hermes-runtime',
        navigation: [],
        sections: {},
        diagnostics: [],
        managementActions: [],
      }),
      null,
    );
  },
);

await runTest(
  'getHermesInstanceDetailModulePayload returns the projected Hermes payload only for hermes runtime payloads',
  async () => {
    const payload = {
      kernelId: 'hermes',
      moduleType: 'hermes-runtime',
      navigation: [],
      sections: {
        runtimePolicies: [],
        readinessChecks: [],
        environment: {
          deploymentMode: 'remote',
          transportId: 'customHttp',
          hostLabel: null,
          version: null,
          endpointCount: 0,
        },
        config: {
          storageProvider: 'remoteApi',
          dataAccessRouteCount: 0,
          artifactCount: 0,
        },
        notes: [],
      },
      diagnostics: [],
      managementActions: [],
    };

    assert.equal(
      instanceDetailModulePayloadModule?.getHermesInstanceDetailModulePayload(payload as never),
      payload,
    );
    assert.equal(
      instanceDetailModulePayloadModule?.getHermesInstanceDetailModulePayload({
        kernelId: 'openclaw',
        moduleType: 'openclaw-workbench',
        navigation: [],
        sections: {},
        diagnostics: [],
        managementActions: [],
      }),
      null,
    );
  },
);
