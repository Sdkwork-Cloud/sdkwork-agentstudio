import assert from 'node:assert/strict';
import {
  getChannelCatalogRegion,
  getChannelCatalogRegions,
  getChannelOfficialLink,
  isChannelDownloadAppAction,
  partitionChannelCatalogItemsByRegion,
  resolveDefaultChannelCatalogRegion,
  sortChannelCatalogItems,
} from './channelCatalogMeta.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('getChannelOfficialLink maps bundled OpenClaw channels to setup destinations', () => {
  assert.deepEqual(getChannelOfficialLink('telegram'), {
    href: 'https://core.telegram.org/bots',
    label: 'Telegram Bot Platform',
  });
  assert.deepEqual(getChannelOfficialLink('slack'), {
    href: 'https://api.slack.com/apps',
    label: 'Slack API Apps',
  });
  assert.deepEqual(getChannelOfficialLink('matrix'), {
    href: 'https://docs.openclaw.ai/channels/matrix',
    label: 'OpenClaw Matrix Channel Docs',
  });
  assert.deepEqual(getChannelOfficialLink('qqbot'), {
    href: 'https://docs.openclaw.ai/channels/qqbot',
    label: 'OpenClaw QQ Bot Channel Docs',
  });
  assert.deepEqual(getChannelOfficialLink('feishu'), {
    href: 'https://docs.openclaw.ai/channels/feishu',
    label: 'OpenClaw Feishu Channel Docs',
  });
  assert.deepEqual(getChannelOfficialLink('openclaw-weixin'), {
    href: 'https://docs.openclaw.ai/channels/wechat',
    label: 'OpenClaw WeChat Plugin Docs',
  });
  assert.deepEqual(getChannelOfficialLink('wecom'), {
    href: 'https://github.com/WecomTeam/wecom-openclaw-plugin',
    label: 'Official WeCom OpenClaw Plugin',
  });
  assert.deepEqual(getChannelOfficialLink('dingtalk-connector'), {
    href: 'https://github.com/DingTalk-Real-AI/dingtalk-openclaw-connector',
    label: 'Official DingTalk OpenClaw Plugin',
  });
  assert.deepEqual(getChannelOfficialLink('dingtalk'), {
    href: 'https://soimy.github.io/openclaw-channel-dingtalk/',
    label: 'OpenClaw DingTalk Channel Plugin Docs',
  });
});

runTest('getChannelOfficialLink does not expose retired non-runtime channels', () => {
  for (const channelId of ['sdkworkchat', 'wechat', 'wehcat', 'qq']) {
    assert.equal(getChannelOfficialLink(channelId), null);
  }
});

runTest('isChannelDownloadAppAction does not mark runtime channels as download-only actions', () => {
  assert.equal(isChannelDownloadAppAction('telegram'), false);
  assert.equal(isChannelDownloadAppAction('slack'), false);
  assert.equal(isChannelDownloadAppAction('sdkworkchat'), false);
});

runTest('getChannelCatalogRegion groups bundled OpenClaw channels by runtime category', () => {
  assert.equal(getChannelCatalogRegion('imessage'), 'global');
  assert.equal(getChannelCatalogRegion('qqbot'), 'domestic');
  assert.equal(getChannelCatalogRegion('feishu'), 'domestic');
  assert.equal(getChannelCatalogRegion('openclaw-weixin'), 'domestic');
  assert.equal(getChannelCatalogRegion('wecom'), 'domestic');
  assert.equal(getChannelCatalogRegion('dingtalk-connector'), 'domestic');
  assert.equal(getChannelCatalogRegion('dingtalk'), 'domestic');
  assert.equal(getChannelCatalogRegion('telegram'), 'global');
  assert.equal(getChannelCatalogRegion('slack'), 'global');
  assert.equal(getChannelCatalogRegion('unknown-channel'), 'global');
});

runTest('getChannelCatalogRegions keeps iMessage visible in media workflows without adding retired media channels', () => {
  assert.deepEqual(getChannelCatalogRegions('imessage'), ['global', 'media']);
  assert.deepEqual(getChannelCatalogRegions('qqbot'), ['domestic']);
  assert.deepEqual(getChannelCatalogRegions('feishu'), ['domestic']);
  assert.deepEqual(getChannelCatalogRegions('openclaw-weixin'), ['domestic']);
  assert.deepEqual(getChannelCatalogRegions('wecom'), ['domestic']);
  assert.deepEqual(getChannelCatalogRegions('dingtalk-connector'), ['domestic']);
  assert.deepEqual(getChannelCatalogRegions('dingtalk'), ['domestic']);
  assert.deepEqual(getChannelCatalogRegions('telegram'), ['global']);
  assert.deepEqual(getChannelCatalogRegions('wehcat'), ['global']);
});

runTest('partitionChannelCatalogItemsByRegion builds tabs from supported runtime channels only', () => {
  const groups = partitionChannelCatalogItemsByRegion([
    {
      id: 'qqbot',
      name: 'QQ Bot',
      description: 'QQ official bot',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'feishu',
      name: 'Feishu',
      description: 'Feishu bot',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Slack workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Telegram bot',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'imessage',
      name: 'iMessage',
      description: 'iMessage bridge',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'openclaw-weixin',
      name: 'Weixin',
      description: 'Weixin plugin',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'wecom',
      name: 'WeCom',
      description: 'WeCom plugin',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'dingtalk-connector',
      name: 'DingTalk Connector',
      description: 'Official DingTalk plugin',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'dingtalk',
      name: 'DingTalk',
      description: 'DingTalk plugin',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'matrix',
      name: 'Matrix',
      description: 'Matrix workspace',
      status: 'not_configured',
      enabled: false,
    },
  ]);

  assert.deepEqual(
    groups.domestic.map((item) => item.id),
    ['qqbot', 'feishu', 'openclaw-weixin', 'wecom', 'dingtalk-connector', 'dingtalk'],
  );
  assert.deepEqual(
    groups.global.map((item) => item.id),
    ['imessage', 'matrix', 'slack', 'telegram'],
  );
  assert.deepEqual(
    groups.media.map((item) => item.id),
    ['imessage'],
  );
  assert.deepEqual(
    groups.all.map((item) => item.id),
    [
      'qqbot',
      'feishu',
      'openclaw-weixin',
      'wecom',
      'dingtalk-connector',
      'dingtalk',
      'imessage',
      'matrix',
      'slack',
      'telegram',
    ],
  );
  assert.equal(resolveDefaultChannelCatalogRegion(groups), 'domestic');
  assert.equal(
    resolveDefaultChannelCatalogRegion({
      domestic: [],
      global: [],
      media: groups.media,
      all: groups.all,
    }),
    'media',
  );
  assert.equal(
    resolveDefaultChannelCatalogRegion({
      domestic: [],
      global: [],
      media: [],
      all: [],
    }),
    'all',
  );
});

runTest('sortChannelCatalogItems keeps bundled runtime channels in catalog order', () => {
  const sorted = sortChannelCatalogItems([
    {
      id: 'qqbot',
      name: 'QQ Bot',
      description: 'QQ official bot',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'feishu',
      name: 'Feishu',
      description: 'Feishu bot',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Telegram bot',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'matrix',
      name: 'Matrix',
      description: 'Matrix workspace',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'imessage',
      name: 'iMessage',
      description: 'iMessage bridge',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Slack workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'irc',
      name: 'IRC',
      description: 'IRC network',
      status: 'not_configured',
      enabled: false,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['qqbot', 'feishu', 'imessage', 'irc', 'matrix', 'slack', 'telegram'],
  );
});

runTest('sortChannelCatalogItems orders unknown runtime-reported channels after known bundled channels by status and name', () => {
  const sorted = sortChannelCatalogItems([
    {
      id: 'unknown-b',
      name: 'Zulu',
      description: 'Runtime channel',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      description: 'Telegram bot',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'unknown-a',
      name: 'Alpha',
      description: 'Runtime channel',
      status: 'connected',
      enabled: true,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['telegram', 'unknown-a', 'unknown-b'],
  );
});
