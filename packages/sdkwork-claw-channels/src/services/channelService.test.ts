import assert from 'node:assert/strict';
import { openClawConfigService } from '@sdkwork/claw-core';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/claw-infrastructure';
import {
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  type StudioInstanceDetailRecord,
} from '@sdkwork/claw-types';
import { channelService } from './channelService.ts';

const BUILT_IN_INSTANCE_ID = STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID;

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

async function withMockedWindowStorage(fn: () => Promise<void>) {
  const globalWithWindow = globalThis as unknown as { window?: unknown };
  const originalWindow = globalWithWindow.window;
  const storage = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return storage.size;
    },
    clear() {
      storage.clear();
    },
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  };

  globalWithWindow.window = {
    localStorage,
  };

  try {
    await fn();
  } finally {
    globalWithWindow.window = originalWindow;
  }
}

function createConfigBackedWorkbenchDetail(
  channelOverrides: Partial<
    NonNullable<NonNullable<StudioInstanceDetailRecord['workbench']>['channels']>[number]
  > = {},
): StudioInstanceDetailRecord {
  const channel = {
    id: 'wehcat',
    name: 'Wehcat',
    description: 'Wehcat official account bridge.',
    status: 'connected',
    enabled: true,
    configurationMode: 'required',
    fieldCount: 3,
    configuredFieldCount: 3,
    setupSteps: ['Create an app', 'Copy credentials'],
    values: {
      appId: 'wx1234567890abcdef',
      appSecret: 'secret',
      token: 'token',
    },
    ...channelOverrides,
  };

  return {
    instance: {
      id: BUILT_IN_INSTANCE_ID,
      name: 'Built-In OpenClaw',
      description: 'Built-In OpenClaw instance for channels fallback tests.',
      runtimeKind: 'openclaw',
      deploymentMode: 'local-managed',
      transportKind: 'openclawGatewayWs',
      status: 'online',
      isBuiltIn: true,
      isDefault: true,
      iconType: 'server',
      version: '2026.04.16',
      typeLabel: 'OpenClaw',
      host: '127.0.0.1',
      port: 21280,
      baseUrl: 'http://127.0.0.1:21280',
      websocketUrl: 'ws://127.0.0.1:21280',
      cpu: 0,
      memory: 0,
      totalMemory: '0 GB',
      uptime: '0m',
      capabilities: ['channels'],
      storage: {
        provider: 'localFile',
        namespace: 'managed-openclaw',
      },
      config: {
        port: '21280',
        sandbox: true,
        autoUpdate: true,
        logLevel: 'info',
        corsOrigins: '*',
      },
      createdAt: 1,
      updatedAt: 1,
      lastSeenAt: 1,
    },
    config: {
      port: '21280',
      sandbox: true,
      autoUpdate: true,
      logLevel: 'info',
      corsOrigins: '*',
    },
    logs: '',
    health: {
      score: 100,
      status: 'healthy',
      checks: [],
      evaluatedAt: 1,
    },
    lifecycle: {
      owner: 'appSupervisor',
      startStopSupported: true,
      configWritable: true,
      notes: [],
    },
    storage: {
      status: 'ready',
      provider: 'localFile',
      namespace: 'managed-openclaw',
      durable: true,
      queryable: false,
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
      logPreview: [],
      metricsSource: 'runtime',
      lastSeenAt: 1,
    },
    dataAccess: {
      routes: [
        {
          id: 'config',
          label: 'Config',
          scope: 'config',
          mode: 'managedFile',
          status: 'ready',
          target: 'D:/missing/.openclaw/openclaw.json',
          readonly: false,
          authoritative: true,
          detail: 'Writable config file',
          source: 'config',
        },
      ],
    },
    artifacts: [
      {
        id: 'config-file',
        label: 'Config File',
        kind: 'configFile',
        status: 'configured',
        location: 'D:/missing/.openclaw/openclaw.json',
        readonly: false,
        detail: 'Writable config file',
        source: 'config',
      },
    ],
    capabilities: [],
    officialRuntimeNotes: [],
    consoleAccess: {
      supported: false,
      entries: [],
    },
    workbench: {
      channels: [channel],
    } as StudioInstanceDetailRecord['workbench'],
  };
}

function createMissingConfigError() {
  return new Error(
    'The attached OpenClaw config file is no longer available on disk. Re-scan or reattach the instance configuration. (C:/Users/admin/.openclaw/openclaw.json)',
  );
}

await runTest('getList exposes the seeded channel catalog', async () => {
  await withMockedWindowStorage(async () => {
    const result = await channelService.getList(BUILT_IN_INSTANCE_ID, { page: 1, pageSize: 20 });

    assert.equal(result.items[0]?.id, 'sdkworkchat');
    assert.equal(result.items.some((channel) => channel.id === 'wehcat'), true);
    assert.equal(result.items[0]?.fieldCount, 0);
    assert.equal(result.items[0]?.configuredFieldCount, 0);
    assert.equal(result.items[0]?.status, 'connected');
  });
});

await runTest('saveChannelConfig and deleteChannelConfig keep state in sync with v3 behavior', async () => {
  await withMockedWindowStorage(async () => {
    await channelService.saveChannelConfig(BUILT_IN_INSTANCE_ID, 'wehcat', {
      appId: 'wx1234567890abcdef',
      appSecret: 'secret',
      token: 'token',
    });

    let wehcat = await channelService.getById(BUILT_IN_INSTANCE_ID, 'wehcat');
    assert.equal(wehcat?.enabled, true);
    assert.equal(wehcat?.status, 'connected');
    assert.equal(
      wehcat?.fields.find((field) => field.key === 'appId')?.value,
      'wx1234567890abcdef',
    );

    await channelService.deleteChannelConfig(BUILT_IN_INSTANCE_ID, 'wehcat');

    wehcat = await channelService.getById(BUILT_IN_INSTANCE_ID, 'wehcat');
    assert.equal(wehcat?.enabled, false);
    assert.equal(wehcat?.status, 'not_configured');
    assert.equal(
      wehcat?.fields.find((field) => field.key === 'appId')?.value,
      undefined,
    );
  });
});

await runTest('create preserves the v3 unimplemented mutation contract', async () => {
  await assert.rejects(
    () =>
      channelService.create(BUILT_IN_INSTANCE_ID, {
        name: 'Custom Channel',
        description: 'Custom integration',
        icon: 'Webhook',
        fields: [],
        setupGuide: [],
      }),
    /Method not implemented\./,
  );
});

await runTest(
  'getChannels falls back to the workbench snapshot when the config file path is stale',
  async () => {
    const originalBridge = getPlatformBridge();
    const originalReadConfigSnapshot = openClawConfigService.readConfigSnapshot;
    const detail = createConfigBackedWorkbenchDetail();

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstanceDetail() {
          return detail;
        },
      },
    });
    (openClawConfigService as typeof openClawConfigService & {
      readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
    }).readConfigSnapshot = async () => {
      throw createMissingConfigError();
    };

    try {
      const channels = await channelService.getChannels(BUILT_IN_INSTANCE_ID);
      const wehcat = channels.find((channel) => channel.id === 'wehcat');

      assert.equal(wehcat?.enabled, true);
      assert.equal(wehcat?.status, 'connected');
      assert.equal(
        wehcat?.fields.find((field) => field.key === 'appId')?.value,
        'wx1234567890abcdef',
      );
    } finally {
      (openClawConfigService as typeof openClawConfigService & {
        readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
      }).readConfigSnapshot = originalReadConfigSnapshot;
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'updateChannelStatus falls back to the workbench bridge when the config file path is stale',
  async () => {
    const originalBridge = getPlatformBridge();
    const originalReadConfigSnapshot = openClawConfigService.readConfigSnapshot;
    const originalSetChannelEnabled = openClawConfigService.setChannelEnabled;
    const detail = createConfigBackedWorkbenchDetail();
    const bridgeCalls: string[] = [];

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstanceDetail() {
          return detail;
        },
        async setInstanceChannelEnabled(_instanceId, channelId, enabled) {
          bridgeCalls.push(`toggle:${channelId}:${enabled}`);
          const wehcat = detail.workbench?.channels.find((channel) => channel.id === channelId);
          if (!wehcat) {
            return false;
          }

          wehcat.enabled = enabled;
          wehcat.status = enabled ? 'connected' : 'disconnected';
          return true;
        },
      },
    });
    (openClawConfigService as typeof openClawConfigService & {
      readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
      setChannelEnabled: typeof openClawConfigService.setChannelEnabled;
    }).readConfigSnapshot = async () => {
      throw createMissingConfigError();
    };
    (openClawConfigService as typeof openClawConfigService & {
      readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
      setChannelEnabled: typeof openClawConfigService.setChannelEnabled;
    }).setChannelEnabled = async () => {
      throw createMissingConfigError();
    };

    try {
      const channels = await channelService.updateChannelStatus(
        'managed-openclaw',
        'wehcat',
        false,
      );
      const wehcat = channels.find((channel) => channel.id === 'wehcat');

      assert.deepEqual(bridgeCalls, ['toggle:wehcat:false']);
      assert.equal(wehcat?.enabled, false);
      assert.equal(wehcat?.status, 'disconnected');
    } finally {
      (openClawConfigService as typeof openClawConfigService & {
        readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
        setChannelEnabled: typeof openClawConfigService.setChannelEnabled;
      }).readConfigSnapshot = originalReadConfigSnapshot;
      (openClawConfigService as typeof openClawConfigService & {
        readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
        setChannelEnabled: typeof openClawConfigService.setChannelEnabled;
      }).setChannelEnabled = originalSetChannelEnabled;
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'saveChannelConfig falls back to the workbench bridge when the config file path is stale',
  async () => {
    const originalBridge = getPlatformBridge();
    const originalReadConfigSnapshot = openClawConfigService.readConfigSnapshot;
    const originalSaveChannelConfiguration = openClawConfigService.saveChannelConfiguration;
    const detail = createConfigBackedWorkbenchDetail({
      status: 'not_configured',
      enabled: false,
      configuredFieldCount: 0,
      values: {},
    });
    const bridgeCalls: string[] = [];

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstanceDetail() {
          return detail;
        },
        async saveInstanceChannelConfig(_instanceId, channelId, values) {
          bridgeCalls.push(`save:${channelId}`);
          const wehcat = detail.workbench?.channels.find((channel) => channel.id === channelId);
          if (!wehcat) {
            return false;
          }

          wehcat.values = { ...values };
          wehcat.enabled = true;
          wehcat.status = 'connected';
          wehcat.configuredFieldCount = Object.values(values).filter((value) => value.trim()).length;
          return true;
        },
      },
    });
    (openClawConfigService as typeof openClawConfigService & {
      readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
      saveChannelConfiguration: typeof openClawConfigService.saveChannelConfiguration;
    }).readConfigSnapshot = async () => {
      throw createMissingConfigError();
    };
    (openClawConfigService as typeof openClawConfigService & {
      readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
      saveChannelConfiguration: typeof openClawConfigService.saveChannelConfiguration;
    }).saveChannelConfiguration = async () => {
      throw createMissingConfigError();
    };

    try {
      const channels = await channelService.saveChannelConfig('managed-openclaw', 'wehcat', {
        appId: 'wx-channel',
        appSecret: 'secret',
        token: 'token',
      });
      const wehcat = channels.find((channel) => channel.id === 'wehcat');

      assert.deepEqual(bridgeCalls, ['save:wehcat']);
      assert.equal(wehcat?.enabled, true);
      assert.equal(wehcat?.status, 'connected');
      assert.equal(
        wehcat?.fields.find((field) => field.key === 'appId')?.value,
        'wx-channel',
      );
    } finally {
      (openClawConfigService as typeof openClawConfigService & {
        readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
        saveChannelConfiguration: typeof openClawConfigService.saveChannelConfiguration;
      }).readConfigSnapshot = originalReadConfigSnapshot;
      (openClawConfigService as typeof openClawConfigService & {
        readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
        saveChannelConfiguration: typeof openClawConfigService.saveChannelConfiguration;
      }).saveChannelConfiguration = originalSaveChannelConfiguration;
      configurePlatformBridge(originalBridge);
    }
  },
);

await runTest(
  'deleteChannelConfig falls back to the workbench bridge when the config file path is stale',
  async () => {
    const originalBridge = getPlatformBridge();
    const originalReadConfigSnapshot = openClawConfigService.readConfigSnapshot;
    const originalSaveChannelConfiguration = openClawConfigService.saveChannelConfiguration;
    const detail = createConfigBackedWorkbenchDetail();
    const bridgeCalls: string[] = [];

    configurePlatformBridge({
      studio: {
        ...originalBridge.studio,
        async getInstanceDetail() {
          return detail;
        },
        async deleteInstanceChannelConfig(_instanceId, channelId) {
          bridgeCalls.push(`delete:${channelId}`);
          const wehcat = detail.workbench?.channels.find((channel) => channel.id === channelId);
          if (!wehcat) {
            return false;
          }

          wehcat.values = {};
          wehcat.enabled = false;
          wehcat.status = 'not_configured';
          wehcat.configuredFieldCount = 0;
          return true;
        },
      },
    });
    (openClawConfigService as typeof openClawConfigService & {
      readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
      saveChannelConfiguration: typeof openClawConfigService.saveChannelConfiguration;
    }).readConfigSnapshot = async () => {
      throw createMissingConfigError();
    };
    (openClawConfigService as typeof openClawConfigService & {
      readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
      saveChannelConfiguration: typeof openClawConfigService.saveChannelConfiguration;
    }).saveChannelConfiguration = async () => {
      throw createMissingConfigError();
    };

    try {
      const channels = await channelService.deleteChannelConfig('managed-openclaw', 'wehcat');
      const wehcat = channels.find((channel) => channel.id === 'wehcat');

      assert.deepEqual(bridgeCalls, ['delete:wehcat']);
      assert.equal(wehcat?.enabled, false);
      assert.equal(wehcat?.status, 'not_configured');
      assert.equal(
        wehcat?.fields.find((field) => field.key === 'appId')?.value,
        undefined,
      );
    } finally {
      (openClawConfigService as typeof openClawConfigService & {
        readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
        saveChannelConfiguration: typeof openClawConfigService.saveChannelConfiguration;
      }).readConfigSnapshot = originalReadConfigSnapshot;
      (openClawConfigService as typeof openClawConfigService & {
        readConfigSnapshot: typeof openClawConfigService.readConfigSnapshot;
        saveChannelConfiguration: typeof openClawConfigService.saveChannelConfiguration;
      }).saveChannelConfiguration = originalSaveChannelConfiguration;
      configurePlatformBridge(originalBridge);
    }
  },
);
