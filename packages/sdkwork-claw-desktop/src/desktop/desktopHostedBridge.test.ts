import assert from 'node:assert/strict';
import {
  DesktopHostedRuntimeReadinessError,
  buildDesktopHostedRuntimeReadinessEvidence,
  createDeferredDesktopHostedStudioPlatform,
  createDesktopHostedInternalPlatform,
  createDesktopHostedManagePlatform,
  probeDesktopHostedRuntimeReadiness,
  createDesktopHostedStudioPlatform,
  type DesktopHostedRuntimeDescriptor,
  probeDesktopHostedControlPlane,
} from './desktopHostedBridge.ts';

const BUILT_IN_INSTANCE_ID = 'managed-openclaw-primary';
const BUILT_IN_INSTANCE_PATH =
  `http://127.0.0.1:21289/claw/api/v1/studio/instances/${BUILT_IN_INSTANCE_ID}`;

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

function createJsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      },
    },
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function createMockWebSocketFactory(outcome: 'open' | 'error') {
  const urls: string[] = [];

  class MockWebSocket {
    onopen: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onclose: ((event: unknown) => void) | null = null;

    constructor(url: string) {
      urls.push(url);
      setTimeout(() => {
        if (outcome === 'open') {
          this.onopen?.({ type: 'open' });
          return;
        }

        this.onerror?.({ type: 'error' });
      }, 0);
    }

    close() {
      // Probe cleanup is best-effort only.
    }
  }

  return {
    urls,
    factory(url: string) {
      return new MockWebSocket(url);
    },
  };
}

function readHeaderValue(headers: HeadersInit | undefined, name: string): string | null {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(name);
  }

  if (Array.isArray(headers)) {
    const matched = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return matched?.[1] ?? null;
  }

  const matched = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return typeof matched?.[1] === 'string' ? matched[1] : null;
}

const desktopHostedRuntime: DesktopHostedRuntimeDescriptor = {
  mode: 'desktopCombined',
  lifecycle: 'ready',
  apiBasePath: '/claw/api/v1',
  manageBasePath: '/claw/manage/v1',
  internalBasePath: '/claw/internal/v1',
  browserBaseUrl: 'http://127.0.0.1:21289',
  browserSessionToken: 'desktop-session-token',
  lastError: null,
};

await runTest('desktop hosted bridge forwards browser session token to manage, internal, and studio hosted requests', async () => {
  const requests: Array<{ input: string; method: string; browserSessionToken: string | null }> = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    requests.push({
      input,
      method: init?.method ?? 'GET',
      browserSessionToken: readHeaderValue(init?.headers, 'x-claw-browser-session'),
    });

    return createJsonResponse([]);
  };

  const manage = createDesktopHostedManagePlatform(desktopHostedRuntime, fetchImpl);
  const internal = createDesktopHostedInternalPlatform(desktopHostedRuntime, fetchImpl);
  const studio = createDesktopHostedStudioPlatform(desktopHostedRuntime, fetchImpl);

  await manage.getHostEndpoints();
  await internal.listNodeSessions();
  await studio.listInstances();

  assert.deepEqual(requests, [
    {
      input: 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints',
      method: 'GET',
      browserSessionToken: 'desktop-session-token',
    },
    {
      input: 'http://127.0.0.1:21289/claw/internal/v1/node-sessions',
      method: 'GET',
      browserSessionToken: 'desktop-session-token',
    },
    {
      input: 'http://127.0.0.1:21289/claw/api/v1/studio/instances',
      method: 'GET',
      browserSessionToken: 'desktop-session-token',
    },
  ]);
});

await runTest('desktop hosted bridge probes canonical internal and manage hosted control-plane surfaces', async () => {
  const requests: Array<{ input: string; method: string; browserSessionToken: string | null }> = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    requests.push({
      input,
      method: init?.method ?? 'GET',
      browserSessionToken: readHeaderValue(init?.headers, 'x-claw-browser-session'),
    });

    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          baseUrl: 'http://127.0.0.1:21289',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  const result = await probeDesktopHostedControlPlane(desktopHostedRuntime, fetchImpl);

  assert.equal(result.hostPlatformStatus.lifecycle, 'ready');
  assert.equal(result.hostEndpoints[0]?.endpointId, 'claw-manage-http');
  assert.deepEqual(requests, [
    {
      input: 'http://127.0.0.1:21289/claw/internal/v1/host-platform',
      method: 'GET',
      browserSessionToken: 'desktop-session-token',
    },
    {
      input: 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints',
      method: 'GET',
      browserSessionToken: 'desktop-session-token',
    },
  ]);
});

await runTest('desktop hosted bridge readiness probe forwards abort signal to hosted HTTP probes', async () => {
  const abortController = new AbortController();
  const requests: Array<{ input: string; signal: AbortSignal | null }> = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    requests.push({
      input,
      signal: init?.signal ?? null,
    });

    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          baseUrl: 'http://127.0.0.1:21289',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  const result = await probeDesktopHostedRuntimeReadiness(
    desktopHostedRuntime,
    fetchImpl,
    {
      requiresBuiltInOpenClawEvidence: false,
      signal: abortController.signal,
    },
  );

  assert.equal(result.evidence.ready, true);
  assert.equal(requests.length, 2);
  assert.ok(
    requests.every((request) => request.signal === abortController.signal),
    'expected every readiness HTTP probe to receive the retry abort signal',
  );
});

await runTest('desktop hosted bridge readiness probe validates hosted internal, manage, and studio instance surfaces', async () => {
  const requests: Array<{ input: string; method: string; browserSessionToken: string | null }> = [];
  const webSocketProbe = createMockWebSocketFactory('open');
  const fetchImpl = async (input: string, init?: RequestInit) => {
    requests.push({
      input,
      method: init?.method ?? 'GET',
      browserSessionToken: readHeaderValue(init?.headers, 'x-claw-browser-session'),
    });

    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          baseUrl: 'http://127.0.0.1:21289',
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  const result = await probeDesktopHostedRuntimeReadiness(
    desktopHostedRuntime,
    fetchImpl,
    {
      requiresBuiltInOpenClawEvidence: true,
      webSocketFactory: webSocketProbe.factory,
    },
  );

  assert.equal(result.hostPlatformStatus.lifecycle, 'ready');
  assert.equal(result.descriptor.browserBaseUrl, 'http://127.0.0.1:21289');
  assert.equal(result.hostEndpoints[0]?.endpointId, 'claw-manage-http');
  assert.equal(result.instances[0]?.id, BUILT_IN_INSTANCE_ID);
  assert.equal(result.evidence.gatewayWebsocketReady, true);
  assert.equal(result.evidence.gatewayWebsocketProbeSupported, true);
  assert.equal(result.evidence.gatewayWebsocketDialable, true);
  assert.equal(result.evidence.builtInInstanceReady, true);
  assert.equal(result.evidence.ready, true);
  assert.equal(result.evidence.openClawGatewayWebsocketUrl, 'ws://127.0.0.1:18871');
  assert.equal(result.evidence.builtInInstanceWebsocketUrl, 'ws://127.0.0.1:18871');
  assert.deepEqual(webSocketProbe.urls, ['ws://127.0.0.1:18871']);
  assert.deepEqual(
    [...requests].sort((left, right) => left.input.localeCompare(right.input)),
    [
      {
        input: 'http://127.0.0.1:21289/claw/internal/v1/host-platform',
        method: 'GET',
        browserSessionToken: 'desktop-session-token',
      },
      {
        input: 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints',
        method: 'GET',
        browserSessionToken: 'desktop-session-token',
      },
      {
        input: 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime',
        method: 'GET',
        browserSessionToken: 'desktop-session-token',
      },
      {
        input: 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway',
        method: 'GET',
        browserSessionToken: 'desktop-session-token',
      },
      {
        input: 'http://127.0.0.1:21289/claw/api/v1/studio/instances',
        method: 'GET',
        browserSessionToken: 'desktop-session-token',
      },
    ].sort((left, right) => left.input.localeCompare(right.input)),
  );
});

await runTest('desktop hosted bridge readiness probe rejects when the OpenClaw gateway websocket is not dialable yet', async () => {
  const webSocketProbe = createMockWebSocketFactory('error');
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
      webSocketFactory: webSocketProbe.factory,
      webSocketConnectTimeoutMs: 50,
    }),
    (error: unknown) => {
      assert.ok(error instanceof DesktopHostedRuntimeReadinessError);
      assert.match(
        error.message,
        /WebSocket connection on the OpenClaw gateway/i,
      );
      assert.equal(error.snapshot.evidence.gatewayWebsocketProbeSupported, true);
      assert.equal(error.snapshot.evidence.gatewayWebsocketDialable, false);
      assert.equal(error.snapshot.evidence.ready, false);
      return true;
    },
  );
  assert.deepEqual(webSocketProbe.urls, ['ws://127.0.0.1:18871']);
});

await runTest('desktop hosted bridge readiness evidence resolves the built-in OpenClaw instance even when it does not use a legacy built-in id', () => {
  const evidence = buildDesktopHostedRuntimeReadinessEvidence(
    desktopHostedRuntime,
    {
      mode: 'desktopCombined',
      lifecycle: 'ready',
      hostId: 'desktop-local',
      displayName: 'Desktop Combined Host',
      version: 'desktop@test',
      desiredStateProjectionVersion: 'phase2',
      rolloutEngineVersion: 'phase2',
      manageBasePath: '/claw/manage/v1',
      internalBasePath: '/claw/internal/v1',
      stateStoreDriver: 'sqlite',
      stateStore: {
        activeProfileId: 'default-sqlite',
        providers: [],
        profiles: [],
      },
      capabilityKeys: [],
      updatedAt: 1,
    } as any,
    [
      {
        endpointId: 'claw-manage-http',
        baseUrl: 'http://127.0.0.1:21289',
      },
    ] as any,
    {
      lifecycle: 'ready',
      endpointId: 'openclaw-gateway',
      activePort: 18871,
      baseUrl: 'http://127.0.0.1:18871',
      websocketUrl: 'ws://127.0.0.1:18871',
    } as any,
    {
      lifecycle: 'ready',
      endpointId: 'openclaw-gateway',
      activePort: 18871,
      baseUrl: 'http://127.0.0.1:18871',
      websocketUrl: 'ws://127.0.0.1:18871',
    } as any,
    [
      {
        id: BUILT_IN_INSTANCE_ID,
        name: 'Built-In OpenClaw Primary',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        isBuiltIn: true,
        isDefault: true,
      },
    ] as any,
    {
      requiresBuiltInOpenClawEvidence: true,
    },
  );

  assert.equal(evidence.builtInInstanceId, BUILT_IN_INSTANCE_ID);
  assert.equal(evidence.builtInInstanceReady, true);
});

await runTest('desktop hosted bridge readiness treats a degraded host lifecycle as usable when the hosted control plane and OpenClaw surfaces are ready', () => {
  const evidence = buildDesktopHostedRuntimeReadinessEvidence(
    desktopHostedRuntime,
    {
      mode: 'desktopCombined',
      lifecycle: 'degraded',
      hostId: 'desktop-local',
      displayName: 'Desktop Combined Host',
      version: 'desktop@test',
      desiredStateProjectionVersion: 'phase2',
      rolloutEngineVersion: 'phase2',
      manageBasePath: '/claw/manage/v1',
      internalBasePath: '/claw/internal/v1',
      stateStoreDriver: 'sqlite',
      stateStore: {
        activeProfileId: 'default-sqlite',
        providers: [],
        profiles: [],
      },
      supportedCapabilityKeys: ['manage.openclaw.gateway.invoke'],
      availableCapabilityKeys: ['manage.openclaw.gateway.invoke'],
      capabilityKeys: ['manage.openclaw.gateway.invoke'],
      updatedAt: 1,
    } as any,
    [
      {
        endpointId: 'claw-manage-http',
        baseUrl: 'http://127.0.0.1:21289',
      },
    ] as any,
    {
      lifecycle: 'ready',
      endpointId: 'openclaw-gateway',
      activePort: 18871,
      baseUrl: 'http://127.0.0.1:18871',
      websocketUrl: 'ws://127.0.0.1:18871',
    } as any,
    {
      lifecycle: 'ready',
      endpointId: 'openclaw-gateway',
      activePort: 18871,
      baseUrl: 'http://127.0.0.1:18871',
      websocketUrl: 'ws://127.0.0.1:18871',
    } as any,
    [
      {
        id: BUILT_IN_INSTANCE_ID,
        name: 'Built-In OpenClaw Primary',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        isBuiltIn: true,
        isDefault: true,
      },
    ] as any,
    {
      requiresBuiltInOpenClawEvidence: true,
    },
  );

  assert.equal(evidence.hostLifecycle, 'degraded');
  assert.equal(evidence.hostLifecycleReady, true);
  assert.equal(evidence.ready, true);
});

await runTest('desktop hosted bridge readiness probe requires gateway invoke capability before declaring built-in OpenClaw ready', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [
          'internal.host-platform.read',
          'manage.host-endpoints.read',
          'manage.openclaw.runtime.read',
          'manage.openclaw.gateway.read',
        ],
        supportedCapabilityKeys: [
          'internal.host-platform.read',
          'manage.host-endpoints.read',
          'manage.openclaw.runtime.read',
          'manage.openclaw.gateway.read',
          'manage.openclaw.gateway.invoke',
        ],
        availableCapabilityKeys: [
          'internal.host-platform.read',
          'manage.host-endpoints.read',
          'manage.openclaw.runtime.read',
          'manage.openclaw.gateway.read',
        ],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    (error: unknown) => {
      assert.ok(error instanceof DesktopHostedRuntimeReadinessError);
      assert.match(
        error.message,
        /gateway invoke capability/i,
      );
      assert.equal(error.snapshot.evidence.ready, false);
      return true;
    },
  );
});

await runTest('desktop hosted bridge readiness probe selects the canonical manage endpoint instead of assuming the first published endpoint is authoritative', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'irrelevant-public-endpoint',
          bindHost: '0.0.0.0',
          requestedPort: 28797,
          activePort: 28797,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:28797',
          websocketUrl: null,
          loopbackOnly: false,
          dynamicPort: false,
        },
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  const result = await probeDesktopHostedRuntimeReadiness(
    {
      ...desktopHostedRuntime,
      endpointId: 'claw-manage-http',
      activePort: 21289,
    },
    fetchImpl,
  );

  assert.equal(result.evidence.manageEndpointId, 'claw-manage-http');
  assert.equal(result.evidence.manageEndpointActivePort, 21289);
  assert.equal(result.evidence.manageBaseUrl, 'http://127.0.0.1:21289');
  assert.equal(result.evidence.manageEndpointMatchesDescriptor, true);
  assert.equal(result.evidence.manageEndpointIdMatchesDescriptor, true);
  assert.equal(result.evidence.manageEndpointActivePortMatchesDescriptor, true);
  assert.equal(result.evidence.ready, true);
});

await runTest('desktop hosted bridge readiness probe rejects a hosted runtime that is not ready', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'starting',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          baseUrl: 'http://127.0.0.1:21289',
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'stopped',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: null,
        baseUrl: null,
        websocketUrl: null,
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'stopped',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: null,
        baseUrl: null,
        websocketUrl: null,
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /desktop hosted runtime is not ready/i,
  );
});

await runTest('desktop hosted bridge readiness probe accepts non-openclaw package profiles when the hosted shell is ready without OpenClaw surfaces', async () => {
  const requests: string[] = [];
  const fetchImpl = async (input: string) => {
    requests.push(input);
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  const result = await probeDesktopHostedRuntimeReadiness(
    desktopHostedRuntime,
    fetchImpl,
    {
      requiresBuiltInOpenClawEvidence: false,
    },
  );

  assert.equal(result.evidence.hostLifecycleReady, true);
  assert.equal(result.evidence.manageEndpointPublished, true);
  assert.equal(result.evidence.openClawRuntimeReady, false);
  assert.equal(result.evidence.openClawGatewayReady, false);
  assert.equal(result.evidence.builtInInstanceReady, false);
  assert.equal(result.evidence.ready, true);
  assert.deepEqual(requests, [
    'http://127.0.0.1:21289/claw/internal/v1/host-platform',
    'http://127.0.0.1:21289/claw/manage/v1/host-endpoints',
  ]);
});

await runTest('desktop hosted bridge readiness evidence marks built-in instance as not ready when the gateway websocket drifts from the built-in projection', async () => {
  const evidence = buildDesktopHostedRuntimeReadinessEvidence(
    desktopHostedRuntime,
    {
      mode: 'desktopCombined',
      lifecycle: 'ready',
      distributionFamily: 'desktop',
      deploymentFamily: 'bareMetal',
      hostId: 'desktop-local',
      displayName: 'Desktop Combined Host',
      version: 'desktop@test',
      desiredStateProjectionVersion: 'phase2',
      rolloutEngineVersion: 'phase2',
      manageBasePath: '/claw/manage/v1',
      internalBasePath: '/claw/internal/v1',
      stateStoreDriver: 'sqlite',
      stateStore: {
        activeProfileId: 'default-sqlite',
        providers: [],
        profiles: [],
      },
      capabilityKeys: [],
      updatedAt: 1,
    },
    [
      {
        endpointId: 'claw-manage-http',
        bindHost: '127.0.0.1',
        requestedPort: 21289,
        activePort: 21289,
        scheme: 'http',
        baseUrl: 'http://127.0.0.1:21289',
        websocketUrl: null,
        loopbackOnly: true,
        dynamicPort: false,
      },
    ],
    {
      runtimeKind: 'openclaw',
      lifecycle: 'ready',
      endpointId: 'openclaw-gateway',
      requestedPort: 18871,
      activePort: 18871,
      baseUrl: 'http://127.0.0.1:18871',
      websocketUrl: 'ws://127.0.0.1:18871',
      managedBy: 'desktopCombined',
      updatedAt: 1,
    },
    {
      gatewayKind: 'openclawGateway',
      lifecycle: 'ready',
      endpointId: 'openclaw-gateway',
      requestedPort: 18871,
      activePort: 18871,
      baseUrl: 'http://127.0.0.1:18871',
      websocketUrl: 'ws://127.0.0.1:18871',
      managedBy: 'desktopCombined',
      updatedAt: 1,
    },
    [
      {
        id: BUILT_IN_INSTANCE_ID,
        name: 'Local Built-In',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:19999',
      } as any,
    ],
    {
      requiresBuiltInOpenClawEvidence: true,
    },
  );

  assert.equal(evidence.gatewayWebsocketReady, true);
  assert.equal(evidence.runtimeAndGatewayWebsocketUrlMatch, true);
  assert.equal(evidence.builtInInstanceWebsocketUrlMatchesGateway, false);
  assert.equal(evidence.builtInInstanceReady, false);
  assert.equal(evidence.ready, false);
});

await runTest('desktop hosted bridge readiness probe rejects when the built-in instance is missing hosted endpoints', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          baseUrl: 'http://127.0.0.1:21289',
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: null,
          websocketUrl: null,
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /built-in openclaw instance/i,
  );
});

await runTest('desktop hosted bridge readiness probe rejects when the manage host endpoint is missing a baseUrl', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: null,
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /manage host endpoint baseurl/i,
  );
});

await runTest('desktop hosted bridge readiness probe rejects when the published manage host endpoint baseUrl drifts from the runtime descriptor browserBaseUrl', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 19797,
          activePort: 19797,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:19797',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /descriptor browserbaseurl does not match the published manage host endpoint baseurl/i,
  );
});

await runTest('desktop hosted bridge readiness probe preserves a structured readiness snapshot when the canonical manage endpoint drifts from the descriptor', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 19797,
          activePort: 19797,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:19797',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  let thrownError: unknown = null;
  try {
    await probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    });
  } catch (error) {
    thrownError = error;
  }

  assert.ok(thrownError instanceof DesktopHostedRuntimeReadinessError);
  assert.match(
    thrownError.message,
    /descriptor browserbaseurl does not match the published manage host endpoint baseurl/i,
  );
  assert.equal(thrownError.snapshot.evidence.manageEndpointMatchesDescriptor, false);
  assert.equal(thrownError.snapshot.evidence.manageBaseUrl, 'http://127.0.0.1:19797');
  assert.equal(thrownError.snapshot.evidence.ready, false);
});

await runTest('desktop hosted bridge readiness probe rejects when built-in OpenClaw urls drift from the OpenClaw gateway projection', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:19999',
          websocketUrl: 'ws://127.0.0.1:19999',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /built-in openclaw instance urls .* OpenClaw gateway projection/i,
  );
});

await runTest('desktop hosted bridge readiness probe rejects when OpenClaw runtime and gateway endpoint ids drift', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-runtime',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /openclaw runtime and gateway endpoints/i,
  );
});

await runTest('desktop hosted bridge readiness probe rejects when OpenClaw runtime and gateway active ports drift', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18872,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /openclaw runtime and gateway endpoints with mismatched active ports/i,
  );
});

await runTest('desktop hosted bridge readiness probe rejects when the built-in OpenClaw instance is not online yet', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'offline',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /built-in openclaw instance is not online yet/i,
  );
});

await runTest('desktop hosted bridge readiness probe rejects non-OpenClaw kernels before treating them as built-in OpenClaw', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'custom',
          deploymentMode: 'local-managed',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /did not expose the built-in OpenClaw instance/i,
  );
});

await runTest('desktop hosted bridge readiness probe rejects non-local-managed instances before treating them as built-in OpenClaw', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'remote',
          transportKind: 'openclawGatewayWs',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /did not expose the built-in OpenClaw instance/i,
  );
});

await runTest('desktop hosted bridge readiness probe rejects when the built-in instance transport kind drifts away from the OpenClaw gateway transport', async () => {
  const fetchImpl = async (input: string) => {
    if (input === 'http://127.0.0.1:21289/claw/internal/v1/host-platform') {
      return createJsonResponse({
        mode: 'desktopCombined',
        lifecycle: 'ready',
        hostId: 'desktop-local',
        displayName: 'Desktop Combined Host',
        version: 'desktop@test',
        desiredStateProjectionVersion: 'phase2',
        rolloutEngineVersion: 'phase2',
        manageBasePath: '/claw/manage/v1',
        internalBasePath: '/claw/internal/v1',
        stateStoreDriver: 'sqlite',
        stateStore: {
          activeProfileId: 'default-sqlite',
          providers: [],
          profiles: [],
        },
        capabilityKeys: [],
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/host-endpoints') {
      return createJsonResponse([
        {
          endpointId: 'claw-manage-http',
          bindHost: '127.0.0.1',
          requestedPort: 21289,
          activePort: 21289,
          scheme: 'http',
          baseUrl: 'http://127.0.0.1:21289',
          websocketUrl: null,
          loopbackOnly: true,
          dynamicPort: false,
        },
      ]);
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/runtime') {
      return createJsonResponse({
        runtimeKind: 'openclaw',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/manage/v1/openclaw/gateway') {
      return createJsonResponse({
        gatewayKind: 'openclawGateway',
        lifecycle: 'ready',
        endpointId: 'openclaw-gateway',
        requestedPort: 18871,
        activePort: 18871,
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
        managedBy: 'desktopCombined',
        updatedAt: 1,
      });
    }

    if (input === 'http://127.0.0.1:21289/claw/api/v1/studio/instances') {
      return createJsonResponse([
        {
          id: BUILT_IN_INSTANCE_ID,
          name: 'Local Built-In',
          runtimeKind: 'openclaw',
          deploymentMode: 'local-managed',
          transportKind: 'customHttp',
          status: 'online',
          baseUrl: 'http://127.0.0.1:18871',
          websocketUrl: 'ws://127.0.0.1:18871',
        },
      ]);
    }

    throw new Error(`unexpected request: ${input}`);
  };

  await assert.rejects(
    () => probeDesktopHostedRuntimeReadiness(desktopHostedRuntime, fetchImpl, {
      requiresBuiltInOpenClawEvidence: true,
    }),
    /projected a built-in instance transportkind .* instead of "openclawgatewayws"/i,
  );
});

await runTest('desktop hosted studio bridge routes canonical instance lifecycle mutations through the hosted api base path', async () => {
  const requests: Array<{ input: string; method: string; browserSessionToken: string | null; body?: string | null }> = [];
  const createdInstance = {
    id: 'created-instance',
    name: 'Created instance',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'offline',
  };
  const updatedInstance = {
    id: BUILT_IN_INSTANCE_ID,
    name: 'Updated instance',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'offline',
  };

  const fetchImpl = async (input: string, init?: RequestInit) => {
    const inputText = String(input);
    const method = init?.method ?? 'GET';
    requests.push({
      input: inputText,
      method,
      browserSessionToken: readHeaderValue(init?.headers, 'x-claw-browser-session'),
      body: typeof init?.body === 'string' ? init.body : null,
    });

    if (inputText === 'http://127.0.0.1:21289/claw/api/v1/studio/instances' && method === 'POST') {
      return createJsonResponse(createdInstance);
    }

    if (inputText === BUILT_IN_INSTANCE_PATH && method === 'PUT') {
      return createJsonResponse(updatedInstance);
    }

    if (inputText === BUILT_IN_INSTANCE_PATH && method === 'DELETE') {
      return createJsonResponse(true);
    }

    if (inputText === `${BUILT_IN_INSTANCE_PATH}:start` && method === 'POST') {
      return createJsonResponse({ ...updatedInstance, status: 'online' });
    }

    if (inputText === `${BUILT_IN_INSTANCE_PATH}:stop` && method === 'POST') {
      return createJsonResponse({ ...updatedInstance, status: 'offline' });
    }

    if (inputText === `${BUILT_IN_INSTANCE_PATH}:restart` && method === 'POST') {
      return createJsonResponse({ ...updatedInstance, status: 'online' });
    }

    throw new Error(`unexpected request: ${inputText}`);
  };

  const studio = createDesktopHostedStudioPlatform(desktopHostedRuntime, fetchImpl);

  const created = await studio.createInstance({
    name: 'Created instance',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
  });
  const updated = await studio.updateInstance(BUILT_IN_INSTANCE_ID, {
    name: 'Updated instance',
    status: 'offline',
  });
  const deleted = await studio.deleteInstance(BUILT_IN_INSTANCE_ID);
  const started = await studio.startInstance(BUILT_IN_INSTANCE_ID);
  const stopped = await studio.stopInstance(BUILT_IN_INSTANCE_ID);
  const restarted = await studio.restartInstance(BUILT_IN_INSTANCE_ID);

  assert.equal(created.id, 'created-instance');
  assert.equal(updated.name, 'Updated instance');
  assert.equal(deleted, true);
  assert.equal(started?.status, 'online');
  assert.equal(stopped?.status, 'offline');
  assert.equal(restarted?.status, 'online');
  assert.deepEqual(requests, [
    {
      input: 'http://127.0.0.1:21289/claw/api/v1/studio/instances',
      method: 'POST',
      browserSessionToken: 'desktop-session-token',
      body: JSON.stringify({
        name: 'Created instance',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
      }),
    },
    {
      input: BUILT_IN_INSTANCE_PATH,
      method: 'PUT',
      browserSessionToken: 'desktop-session-token',
      body: JSON.stringify({
        name: 'Updated instance',
        status: 'offline',
      }),
    },
    {
      input: BUILT_IN_INSTANCE_PATH,
      method: 'DELETE',
      browserSessionToken: 'desktop-session-token',
      body: null,
    },
    {
      input: `${BUILT_IN_INSTANCE_PATH}:start`,
      method: 'POST',
      browserSessionToken: 'desktop-session-token',
      body: null,
    },
    {
      input: `${BUILT_IN_INSTANCE_PATH}:stop`,
      method: 'POST',
      browserSessionToken: 'desktop-session-token',
      body: null,
    },
    {
      input: `${BUILT_IN_INSTANCE_PATH}:restart`,
      method: 'POST',
      browserSessionToken: 'desktop-session-token',
      body: null,
    },
  ]);
});

await runTest('deferred desktop hosted studio platform refreshes browser base url and session token after descriptor changes', async () => {
  let currentDescriptor: DesktopHostedRuntimeDescriptor = {
    ...desktopHostedRuntime,
    browserBaseUrl: 'http://127.0.0.1:21289',
    browserSessionToken: 'desktop-session-token-1',
  };
  const requests: Array<{ input: string; browserSessionToken: string | null }> = [];
  const fetchImpl = async (input: string, init?: RequestInit) => {
    requests.push({
      input: String(input),
      browserSessionToken: readHeaderValue(init?.headers, 'x-claw-browser-session'),
    });

    return createJsonResponse([
      {
        id: BUILT_IN_INSTANCE_ID,
        name: 'Local Built-In',
        runtimeKind: 'openclaw',
        deploymentMode: 'local-managed',
        transportKind: 'openclawGatewayWs',
        status: 'online',
        baseUrl: 'http://127.0.0.1:18871',
        websocketUrl: 'ws://127.0.0.1:18871',
      },
    ]);
  };

  const studio = createDeferredDesktopHostedStudioPlatform(
    async () => currentDescriptor,
    fetchImpl,
  );

  await studio.listInstances();

  currentDescriptor = {
    ...currentDescriptor,
    browserBaseUrl: 'http://127.0.0.1:19876',
    browserSessionToken: 'desktop-session-token-2',
  };

  await studio.listInstances();

  assert.deepEqual(requests, [
    {
      input: 'http://127.0.0.1:21289/claw/api/v1/studio/instances',
      browserSessionToken: 'desktop-session-token-1',
    },
    {
      input: 'http://127.0.0.1:19876/claw/api/v1/studio/instances',
      browserSessionToken: 'desktop-session-token-2',
    },
  ]);
});

