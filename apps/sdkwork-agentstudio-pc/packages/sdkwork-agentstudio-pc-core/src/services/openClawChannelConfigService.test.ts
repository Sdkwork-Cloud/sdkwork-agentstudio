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

let channelConfigServiceModule:
  | typeof import('./openClawChannelConfigService.ts')
  | undefined;

try {
  channelConfigServiceModule = await import('./openClawChannelConfigService.ts');
} catch {
  channelConfigServiceModule = undefined;
}

await runTest(
  'openClawChannelConfigService exposes channel definition, snapshot, document, and mutation helpers',
  () => {
    assert.ok(
      channelConfigServiceModule,
      'Expected openClawChannelConfigService.ts to exist',
    );
    assert.equal(
      typeof channelConfigServiceModule?.listOpenClawChannelDefinitions,
      'function',
    );
    assert.equal(
      typeof channelConfigServiceModule?.buildOpenClawChannelSnapshotsFromConfigRoot,
      'function',
    );
    assert.equal(
      typeof channelConfigServiceModule?.saveOpenClawChannelConfigurationToConfigRoot,
      'function',
    );
    assert.equal(
      typeof channelConfigServiceModule?.setOpenClawChannelEnabledInDocument,
      'function',
    );
  },
);

await runTest(
  'openClawChannelConfigService resolves canonical channel definitions with shared context-visibility controls',
  () => {
    const definitions = channelConfigServiceModule?.listOpenClawChannelDefinitions() || [];
    const ids = definitions.map((channel) => channel.id);
    const qqbot = definitions.find((channel) => channel.id === 'qqbot');
    const feishu = definitions.find((channel) => channel.id === 'feishu');
    const telegram = definitions.find((channel) => channel.id === 'telegram');
    const slack = definitions.find((channel) => channel.id === 'slack');

    assert.deepEqual(ids, ['qqbot', 'feishu', 'imessage', 'irc', 'matrix', 'mattermost', 'signal', 'slack', 'telegram']);
    assert.equal(ids.some((id) => ['sdkworkchat', 'wechat', 'wehcat', 'qq', 'dingtalk', 'wecom'].includes(id)), false);
    assert.ok(qqbot);
    assert.ok(feishu);
    assert.ok(telegram);
    assert.ok(slack);
    assert.equal(qqbot?.fields.find((field) => field.key === 'appId')?.required, true);
    assert.equal(qqbot?.fields.find((field) => field.key === 'clientSecret')?.sensitive, true);
    assert.equal(qqbot?.fields.find((field) => field.key === 'allowFrom')?.storageFormat, 'stringArray');
    assert.equal(qqbot?.fields.find((field) => field.key === 'groupAllowFrom')?.storageFormat, 'stringArray');
    assert.equal(qqbot?.fields.find((field) => field.key === 'groups')?.storageFormat, 'jsonObject');
    assert.equal(qqbot?.fields.find((field) => field.key === 'streaming')?.storageFormat, 'jsonValue');
    assert.equal(qqbot?.fields.find((field) => field.key === 'stt')?.storageFormat, 'jsonValue');
    assert.equal(qqbot?.fields.find((field) => field.key === 'tts')?.storageFormat, 'jsonValue');
    assert.equal(qqbot?.fields.find((field) => field.key === 'audioFormatPolicy')?.storageFormat, 'jsonObject');
    assert.equal(feishu?.fields.find((field) => field.key === 'accounts')?.storageFormat, 'jsonObject');
    assert.equal(feishu?.fields.find((field) => field.key === 'appSecret')?.sensitive, true);
    assert.equal(feishu?.fields.find((field) => field.key === 'allowFrom')?.storageFormat, 'stringArray');
    assert.equal(feishu?.fields.find((field) => field.key === 'groupAllowFrom')?.storageFormat, 'stringArray');
    assert.equal(feishu?.fields.find((field) => field.key === 'groups')?.storageFormat, 'jsonObject');
    assert.equal(feishu?.fields.find((field) => field.key === 'streaming')?.storageFormat, 'jsonValue');
    assert.equal(telegram?.fields.some((field) => field.key === 'errorPolicy'), true);
    assert.equal(
      telegram?.fields.find((field) => field.key === 'errorCooldownMs')?.inputMode,
      'numeric',
    );
    assert.equal(slack?.fields.find((field) => field.key === 'allowFrom')?.multiline, true);
    assert.equal(slack?.fields.find((field) => field.key === 'groups')?.multiline, true);
    assert.equal(telegram?.fields.some((field) => field.key === 'contextVisibility'), true);
    assert.equal(slack?.fields.some((field) => field.key === 'contextVisibility'), true);
  },
);

await runTest(
  'openClawChannelConfigService writes channel config using native array and object values instead of string blobs',
  () => {
    const root = {
      channels: {},
    };

    channelConfigServiceModule?.saveOpenClawChannelConfigurationToConfigRoot(root, {
      channelId: 'slack',
      enabled: true,
      values: {
        allowFrom: '+15555550123\n+15555550124',
        groups: `{
  "*": {
    "requireMention": true
  }
}`,
      },
    });

    assert.deepEqual(root, {
      channels: {
        slack: {
          allowFrom: ['+15555550123', '+15555550124'],
          groups: {
            '*': {
              requireMention: true,
            },
          },
          enabled: true,
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService writes qqbot JSON value fields without forcing object-only values',
  () => {
    const root = {
      channels: {},
    };

    channelConfigServiceModule?.saveOpenClawChannelConfigurationToConfigRoot(root, {
      channelId: 'qqbot',
      enabled: true,
      values: {
        appId: '123456',
        clientSecret: 'secret://qqbot/client-secret',
        streaming: 'true',
        stt: 'false',
        tts: `{
  "provider": "default"
}`,
        audioFormatPolicy: `{
  "sttDirectFormats": ["amr"],
  "uploadDirectFormats": ["amr"],
  "transcodeEnabled": true
}`,
        accounts: `{
  "main": {
    "appId": "123456"
  }
}`,
      },
    });

    assert.deepEqual(root, {
      channels: {
        qqbot: {
          appId: '123456',
          clientSecret: 'secret://qqbot/client-secret',
          streaming: true,
          stt: false,
          tts: {
            provider: 'default',
          },
          audioFormatPolicy: {
            sttDirectFormats: ['amr'],
            uploadDirectFormats: ['amr'],
            transcodeEnabled: true,
          },
          accounts: {
            main: {
              appId: '123456',
            },
          },
          enabled: true,
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService rejects retired channel ids so callers cannot create startup blockers',
  () => {
    const root = {
      channels: {
        qq: {
          botKey: 'qq-bot-key',
          groupId: '123456789',
          enabled: true,
        },
      },
    };

    assert.throws(
      () =>
        channelConfigServiceModule?.saveOpenClawChannelConfigurationToConfigRoot(root, {
          channelId: 'qq',
          enabled: false,
          values: {},
        }),
      /Unsupported OpenClaw channel: qq/,
    );

    assert.deepEqual(root, {
      channels: {
        qq: {
          botKey: 'qq-bot-key',
          groupId: '123456789',
          enabled: true,
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService builds channel snapshots with stable status and serialized values',
  () => {
    const snapshots =
      channelConfigServiceModule?.buildOpenClawChannelSnapshotsFromConfigRoot({
        channels: {
          telegram: {
            botToken: '123456:telegram-token',
            contextVisibility: 'allowlist_quote',
            enabled: true,
          },
          slack: {
            allowFrom: ['+15555550123'],
            groups: {
              '*': {
                requireMention: true,
              },
            },
          },
        },
      }) || [];

    const telegram = snapshots.find((channel) => channel.id === 'telegram');
    const slack = snapshots.find((channel) => channel.id === 'slack');

    assert.equal(telegram?.configuredFieldCount, 2);
    assert.equal(telegram?.status, 'connected');
    assert.equal(telegram?.values.contextVisibility, 'allowlist_quote');
    assert.equal(slack?.status, 'connected');
    assert.match(slack?.values.allowFrom || '', /\+15555550123/);
    assert.match(slack?.values.groups || '', /requireMention/);
  },
);

await runTest(
  'openClawChannelConfigService toggles channel enabled state directly in a raw config document',
  () => {
    const nextRaw = channelConfigServiceModule?.setOpenClawChannelEnabledInDocument(
      `{
  channels: {
    telegram: {
      botToken: "123456:telegram-token"
    }
  }
}`,
      {
        channelId: 'telegram',
        enabled: false,
      },
    );

    assert.match(nextRaw || '', /"enabled": false/);
    assert.match(nextRaw || '', /botToken/);
  },
);

await runTest(
  'openClawChannelConfigService removes empty channel config when toggled disabled',
  () => {
    const nextRaw = channelConfigServiceModule?.setOpenClawChannelEnabledInDocument(
      `{
  channels: {
    telegram: {
      enabled: true
    }
  }
}`,
      {
        channelId: 'telegram',
        enabled: false,
      },
    );

    assert.equal(nextRaw, '{}\n');
  },
);

await runTest(
  'openClawChannelConfigService rejects retired channel ids when toggling enabled state',
  () => {
    assert.throws(
      () =>
        channelConfigServiceModule?.setOpenClawChannelEnabledInDocument(
          `{
  channels: {
    qq: {
      enabled: true
    }
  }
}`,
          {
            channelId: 'qq',
            enabled: false,
          },
        ),
      /Unsupported OpenClaw channel: qq/,
    );
  },
);

await runTest(
  'openClawChannelConfigService migrates legacy qq channel roots and model mappings to canonical qqbot',
  () => {
    const root = {
      channels: {
        telegram: {
          botToken: '123456:telegram-token',
          enabled: true,
        },
        feishu: {
          appId: 'cli_a1234567890abcdef',
          enabled: true,
        },
        qq: {
          appId: 'legacy-app-id',
          clientSecret: 'legacy-client-secret',
          enabled: true,
        },
        modelByChannel: {
          telegram: {
            '*': 'sdkwork-local-proxy/gpt-5.4',
          },
          feishu: {
            '*': 'sdkwork-local-proxy/gpt-feishu',
          },
          qq: {
            '*': 'sdkwork-local-proxy/gpt-legacy',
          },
          dingtalk: {
            '*': 'sdkwork-local-proxy/gpt-legacy',
          },
          slack: {
            C123: 'openai/gpt-5.4',
          },
        },
      },
    };

    const changed =
      channelConfigServiceModule?.pruneRetiredOpenClawChannelConfigFromRoot(root) ?? false;

    assert.equal(changed, true);
    assert.deepEqual(root, {
      channels: {
        qqbot: {
          appId: 'legacy-app-id',
          clientSecret: 'legacy-client-secret',
          enabled: true,
        },
        telegram: {
          botToken: '123456:telegram-token',
          enabled: true,
        },
        feishu: {
          appId: 'cli_a1234567890abcdef',
          enabled: true,
        },
        modelByChannel: {
          qqbot: {
            '*': 'sdkwork-local-proxy/gpt-legacy',
          },
          telegram: {
            '*': 'sdkwork-local-proxy/gpt-5.4',
          },
          feishu: {
            '*': 'sdkwork-local-proxy/gpt-feishu',
          },
          slack: {
            C123: 'openai/gpt-5.4',
          },
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService preserves canonical qqbot when a legacy qq root is also present',
  () => {
    const root = {
      channels: {
        qqbot: {
          appId: 'canonical-app-id',
          clientSecret: 'canonical-secret',
          enabled: true,
        },
        qq: {
          appId: 'legacy-app-id',
          clientSecret: 'legacy-secret',
          enabled: false,
        },
        modelByChannel: {
          qqbot: {
            '*': 'sdkwork-local-proxy/gpt-current',
          },
          qq: {
            '*': 'sdkwork-local-proxy/gpt-legacy',
          },
        },
      },
    };

    const changed =
      channelConfigServiceModule?.pruneRetiredOpenClawChannelConfigFromRoot(root) ?? false;

    assert.equal(changed, true);
    assert.deepEqual(root, {
      channels: {
        qqbot: {
          appId: 'canonical-app-id',
          clientSecret: 'canonical-secret',
          enabled: true,
        },
        modelByChannel: {
          qqbot: {
            '*': 'sdkwork-local-proxy/gpt-current',
          },
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService removes the channels root when only unsupported retired channel config remains',
  () => {
    const root = {
      channels: {
        dingtalk: {
          enabled: true,
        },
        modelByChannel: {
          dingtalk: {
            '*': 'sdkwork-local-proxy/gpt-legacy',
          },
        },
      },
    };

    const changed =
      channelConfigServiceModule?.pruneRetiredOpenClawChannelConfigFromRoot(root) ?? false;

    assert.equal(changed, true);
    assert.deepEqual(root, {});
  },
);

await runTest(
  'openClawChannelConfigService removes malformed channel model mappings',
  () => {
    const root = {
      channels: {
        telegram: {
          botToken: '123456:telegram-token',
          enabled: true,
        },
        modelByChannel: 'openai/gpt-legacy',
      },
    };

    const changed =
      channelConfigServiceModule?.pruneRetiredOpenClawChannelConfigFromRoot(root) ?? false;

    assert.equal(changed, true);
    assert.deepEqual(root, {
      channels: {
        telegram: {
          botToken: '123456:telegram-token',
          enabled: true,
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService removes malformed channel model override maps',
  () => {
    const root = {
      channels: {
        telegram: {
          botToken: '123456:telegram-token',
          enabled: true,
        },
        modelByChannel: {
          telegram: {
            '*': 'sdkwork-local-proxy/gpt-5.4',
            C123: 42,
          },
          slack: 'openai/gpt-legacy',
          matrix: ['anthropic/claude-3-7-sonnet'],
          qq: {
            '*': 'sdkwork-local-proxy/gpt-legacy',
          },
          qqbot: {
            '*': 'sdkwork-local-proxy/gpt-5.4',
          },
        },
      },
    };

    const changed =
      channelConfigServiceModule?.pruneRetiredOpenClawChannelConfigFromRoot(root) ?? false;

    assert.equal(changed, true);
    assert.deepEqual(root, {
      channels: {
        telegram: {
          botToken: '123456:telegram-token',
          enabled: true,
        },
        modelByChannel: {
          qqbot: {
            '*': 'sdkwork-local-proxy/gpt-5.4',
          },
          telegram: {
            '*': 'sdkwork-local-proxy/gpt-5.4',
          },
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService removes malformed supported channel roots',
  () => {
    const root = {
      channels: {
        telegram: '123456:telegram-token',
        slack: ['xoxb-token'],
        modelByChannel: {
          telegram: {
            '*': 'openai/gpt-5.4',
          },
          slack: {
            C123: 'openai/gpt-5.4',
          },
        },
      },
    };

    const changed =
      channelConfigServiceModule?.pruneRetiredOpenClawChannelConfigFromRoot(root) ?? false;

    assert.equal(changed, true);
    assert.deepEqual(root, {
      channels: {
        modelByChannel: {
          telegram: {
            '*': 'openai/gpt-5.4',
          },
          slack: {
            C123: 'openai/gpt-5.4',
          },
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService removes malformed channel defaults',
  () => {
    const root = {
      channels: {
        defaults: 'always-on',
        telegram: {
          botToken: '123456:telegram-token',
          enabled: true,
        },
      },
    };

    const changed =
      channelConfigServiceModule?.pruneRetiredOpenClawChannelConfigFromRoot(root) ?? false;

    assert.equal(changed, true);
    assert.deepEqual(root, {
      channels: {
        telegram: {
          botToken: '123456:telegram-token',
          enabled: true,
        },
      },
    });
  },
);

await runTest(
  'openClawChannelConfigService removes malformed channels roots',
  () => {
    const root = {
      channels: ['telegram'],
    };

    const changed =
      channelConfigServiceModule?.pruneRetiredOpenClawChannelConfigFromRoot(root) ?? false;

    assert.equal(changed, true);
    assert.deepEqual(root, {});
  },
);
