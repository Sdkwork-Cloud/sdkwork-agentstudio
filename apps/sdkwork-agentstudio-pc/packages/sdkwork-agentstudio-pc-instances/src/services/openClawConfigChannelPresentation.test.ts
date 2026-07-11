import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

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

async function loadConfigChannelPresentationModule() {
  const moduleUrl = new URL('./openClawConfigChannelPresentation.ts', import.meta.url);

  assert.ok(
    existsSync(moduleUrl),
    'expected openClawConfigChannelPresentation.ts to exist',
  );

  return import('./openClawConfigChannelPresentation.ts');
}

function createConfigChannelFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'telegram',
    name: 'Telegram',
    description: 'Telegram bridge',
    status: 'connected',
    enabled: true,
    configurationMode: 'required',
    fieldCount: 2,
    configuredFieldCount: 1,
    setupSteps: ['Configure bot'],
    values: {
      botToken: 'baseline-token',
      webhookUrl: '',
    },
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        placeholder: '123456:AA...',
        required: true,
      },
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://example.com/telegram/webhook',
        required: true,
      },
    ],
    ...overrides,
  } as any;
}

await runTest(
  'buildOpenClawConfigChannelWorkspaceSyncState clears selection, drafts, and error state when no config channels exist',
  async () => {
    const { buildOpenClawConfigChannelWorkspaceSyncState } =
      await loadConfigChannelPresentationModule();

    const syncState = buildOpenClawConfigChannelWorkspaceSyncState({
      configChannels: [],
    });

    assert.equal(syncState.resolveSelectedConfigChannelId('telegram'), null);
    assert.deepEqual(syncState.configChannelDrafts, {});
    assert.equal(syncState.configChannelError, null);
  },
);

await runTest(
  'buildOpenClawConfigChannelWorkspaceSyncState preserves a valid config channel selection and clears stale selections while resetting drafts and error state',
  async () => {
    const { buildOpenClawConfigChannelWorkspaceSyncState } =
      await loadConfigChannelPresentationModule();

    const syncState = buildOpenClawConfigChannelWorkspaceSyncState({
      configChannels: [
        createConfigChannelFixture(),
        createConfigChannelFixture({
          id: 'slack',
          name: 'Slack',
        }),
      ],
    });

    assert.equal(syncState.resolveSelectedConfigChannelId('slack'), 'slack');
    assert.equal(syncState.resolveSelectedConfigChannelId('missing-channel'), null);
    assert.equal(syncState.resolveSelectedConfigChannelId(null), null);
    assert.deepEqual(syncState.configChannelDrafts, {});
    assert.equal(syncState.configChannelError, null);
  },
);

await runTest(
  'buildOpenClawConfigChannelSelectionState derives the selected config channel and prefers explicit drafts over channel values',
  async () => {
    const { buildOpenClawConfigChannelSelectionState } =
      await loadConfigChannelPresentationModule();

    const selectionState = buildOpenClawConfigChannelSelectionState({
      configChannels: [
        createConfigChannelFixture(),
        createConfigChannelFixture({
          id: 'slack',
          name: 'Slack',
          values: {
            botToken: 'xoxb-slack-token',
            webhookUrl: 'https://example.com/slack/events',
          },
        }),
      ],
      selectedConfigChannelId: 'slack',
      configChannelDrafts: {
        slack: {
          botToken: 'override-token',
          webhookUrl: '',
        },
      },
    });

    assert.equal(selectionState.selectedConfigChannel?.id, 'slack');
    assert.deepEqual(selectionState.selectedConfigChannelDraft, {
      botToken: 'override-token',
      webhookUrl: '',
    });
  },
);

await runTest(
  'buildOpenClawConfigChannelSelectionState clears the selected config channel and draft when the selected id is missing',
  async () => {
    const { buildOpenClawConfigChannelSelectionState } =
      await loadConfigChannelPresentationModule();

    const selectionState = buildOpenClawConfigChannelSelectionState({
      configChannels: [createConfigChannelFixture()],
      selectedConfigChannelId: 'missing-channel',
      configChannelDrafts: {
        telegram: {
          botToken: 'override-token',
          webhookUrl: 'https://example.com/telegram/webhook',
        },
      },
    });

    assert.equal(selectionState.selectedConfigChannel, null);
    assert.equal(selectionState.selectedConfigChannelDraft, null);
  },
);

await runTest(
  'buildOpenClawConfigChannelWorkspaceItems merges runtime channel metadata, applies explicit drafts, and derives configured status',
  async () => {
    const { buildOpenClawConfigChannelWorkspaceItems } =
      await loadConfigChannelPresentationModule();

    const workspaceItems = buildOpenClawConfigChannelWorkspaceItems({
      configChannels: [
        createConfigChannelFixture({
          id: 'slack',
          name: 'Slack',
          description: 'Managed description',
          status: 'connected',
          values: {
            botToken: 'xoxb-slack-token',
            webhookUrl: 'https://example.com/slack/events',
          },
          setupSteps: ['Managed setup'],
        }),
      ],
      runtimeChannels: [
        {
          id: 'slack',
          description: 'Runtime description',
          setupSteps: ['Runtime setup'],
        },
      ] as any,
      configChannelDrafts: {
        slack: {
          botToken: 'override-token',
          webhookUrl: '',
        },
      },
    });

    assert.equal(workspaceItems.length, 1);
    assert.equal(workspaceItems[0]?.id, 'slack');
    assert.equal(workspaceItems[0]?.description, 'Runtime description');
    assert.equal(workspaceItems[0]?.status, 'connected');
    assert.equal(workspaceItems[0]?.configuredFieldCount, 1);
    assert.deepEqual(workspaceItems[0]?.setupSteps, ['Runtime setup']);
    assert.deepEqual(workspaceItems[0]?.values, {
      botToken: 'override-token',
      webhookUrl: '',
    });
  },
);

await runTest(
  'buildOpenClawConfigChannelWorkspaceItems falls back to managed metadata and derives none/not-configured states',
  async () => {
    const { buildOpenClawConfigChannelWorkspaceItems } =
      await loadConfigChannelPresentationModule();

    const workspaceItems = buildOpenClawConfigChannelWorkspaceItems({
      configChannels: [
        createConfigChannelFixture({
          id: 'disabled-none',
          configurationMode: 'none',
          enabled: false,
          status: 'connected',
        }),
        createConfigChannelFixture({
          id: 'empty-required',
          configurationMode: 'required',
          enabled: true,
          status: 'connected',
          values: {
            botToken: '',
            webhookUrl: '',
          },
        }),
      ],
      runtimeChannels: null,
      configChannelDrafts: {},
    });

    assert.equal(workspaceItems.length, 2);
    assert.equal(workspaceItems[0]?.description, 'Telegram bridge');
    assert.equal(workspaceItems[0]?.status, 'disconnected');
    assert.deepEqual(workspaceItems[0]?.setupSteps, ['Configure bot']);
    assert.equal(workspaceItems[1]?.status, 'not_configured');
    assert.equal(workspaceItems[1]?.configuredFieldCount, 0);
    assert.deepEqual(workspaceItems[1]?.values, {
      botToken: '',
      webhookUrl: '',
    });
  },
);

await runTest(
  'findOpenClawConfigChannelById returns the matching config channel and null for unknown ids',
  async () => {
    const { findOpenClawConfigChannelById } = await loadConfigChannelPresentationModule();

    const configChannels = [
      createConfigChannelFixture(),
      createConfigChannelFixture({
        id: 'slack',
        name: 'Slack',
      }),
    ];

    assert.equal(findOpenClawConfigChannelById(configChannels, 'slack')?.id, 'slack');
    assert.equal(findOpenClawConfigChannelById(configChannels, 'missing-channel'), null);
    assert.equal(findOpenClawConfigChannelById(null, 'slack'), null);
  },
);

await runTest(
  'buildOpenClawConfigChannelStateHandlers routes selection clears and draft changes through page-owned setters',
  async () => {
    const { buildOpenClawConfigChannelStateHandlers } =
      await loadConfigChannelPresentationModule();
    const selectedConfigChannel = createConfigChannelFixture();
    let selectedConfigChannelId: string | null = 'telegram';
    let configChannelError: string | null = 'Stale error';
    let configChannelDrafts = {
      telegram: {
        botToken: 'baseline-token',
        webhookUrl: '',
      },
    };

    const handlers = buildOpenClawConfigChannelStateHandlers({
      selectedConfigChannel,
      setConfigChannelError: (value) => {
        configChannelError = value;
      },
      setSelectedConfigChannelId: (value) => {
        selectedConfigChannelId = value;
      },
      setConfigChannelDrafts: (updater) => {
        configChannelDrafts = updater(configChannelDrafts);
      },
    });

    handlers.onSelectedConfigChannelIdChange('slack');

    assert.equal(selectedConfigChannelId, 'slack');
    assert.equal(configChannelError, null);

    configChannelError = 'Another stale error';
    handlers.onConfigChannelFieldChange('webhookUrl', 'https://example.com/telegram/webhook');

    assert.equal(configChannelError, null);
    assert.deepEqual(configChannelDrafts, {
      telegram: {
        botToken: 'baseline-token',
        webhookUrl: 'https://example.com/telegram/webhook',
      },
    });
  },
);

await runTest(
  'buildOpenClawConfigChannelStateHandlers ignores draft updates when the page has no selected config channel',
  async () => {
    const { buildOpenClawConfigChannelStateHandlers } =
      await loadConfigChannelPresentationModule();
    let configChannelError: string | null = 'Stale error';
    let selectedConfigChannelId: string | null = 'telegram';
    let configChannelDrafts = {
      telegram: {
        botToken: 'baseline-token',
        webhookUrl: '',
      },
    };

    const handlers = buildOpenClawConfigChannelStateHandlers({
      selectedConfigChannel: null,
      setConfigChannelError: (value) => {
        configChannelError = value;
      },
      setSelectedConfigChannelId: (value) => {
        selectedConfigChannelId = value;
      },
      setConfigChannelDrafts: (updater) => {
        configChannelDrafts = updater(configChannelDrafts);
      },
    });

    handlers.onConfigChannelFieldChange('webhookUrl', 'ignored');

    assert.equal(selectedConfigChannelId, 'telegram');
    assert.equal(configChannelError, 'Stale error');
    assert.deepEqual(configChannelDrafts, {
      telegram: {
        botToken: 'baseline-token',
        webhookUrl: '',
      },
    });
  },
);
