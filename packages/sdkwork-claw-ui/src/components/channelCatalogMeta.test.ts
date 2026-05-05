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

runTest('getChannelOfficialLink maps supported channels to their official setup destinations', () => {
  assert.deepEqual(getChannelOfficialLink('sdkworkchat'), {
    href: 'https://clawstudio.sdkwork.com/platforms/android',
    label: 'Sdkwork Chat App Download',
  });
  assert.deepEqual(getChannelOfficialLink('feishu'), {
    href: 'https://open.feishu.cn/app?lang=zh-CN',
    label: 'Feishu Open Platform',
  });
  assert.deepEqual(getChannelOfficialLink('qq'), {
    href: 'https://q.qq.com/qqbot/#/home',
    label: 'QQ Bot Platform',
  });
  assert.deepEqual(getChannelOfficialLink('dingtalk'), {
    href: 'https://open-dev.dingtalk.com/',
    label: 'DingTalk Developer Console',
  });
  assert.deepEqual(getChannelOfficialLink('wecom'), {
    href: 'https://work.weixin.qq.com/wework_admin/loginpage_wx?redirect_uri=https%3A%2F%2Fwork.weixin.qq.com%2Fwework_admin%2Fframe',
    label: 'WeCom Admin Console',
  });
  assert.deepEqual(getChannelOfficialLink('wehcat'), {
    href: 'https://mp.weixin.qq.com/',
    label: 'WeChat Official Account Platform',
  });
});

runTest('getChannelOfficialLink returns null for channels without a dedicated destination', () => {
  assert.equal(getChannelOfficialLink('webhook'), null);
});

runTest('isChannelDownloadAppAction only marks first-party Sdkwork Chat as a download-only action', () => {
  assert.equal(isChannelDownloadAppAction('sdkworkchat'), true);
  assert.equal(isChannelDownloadAppAction('wehcat'), false);
  assert.equal(isChannelDownloadAppAction('discord'), false);
});

runTest('getChannelCatalogRegion keeps domestic channels grouped separately from global channels', () => {
  assert.equal(getChannelCatalogRegion('sdkworkchat'), 'domestic');
  assert.equal(getChannelCatalogRegion('wechat'), 'domestic');
  assert.equal(getChannelCatalogRegion('wehcat'), 'media');
  assert.equal(getChannelCatalogRegion('qq'), 'domestic');
  assert.equal(getChannelCatalogRegion('dingtalk'), 'domestic');
  assert.equal(getChannelCatalogRegion('wecom'), 'domestic');
  assert.equal(getChannelCatalogRegion('feishu'), 'domestic');
  assert.equal(getChannelCatalogRegion('telegram'), 'global');
  assert.equal(getChannelCatalogRegion('discord'), 'global');
  assert.equal(getChannelCatalogRegion('unknown-channel'), 'global');
});

runTest('getChannelCatalogRegions allows Sdkwork Chat to appear in both domestic and global tabs', () => {
  assert.deepEqual(getChannelCatalogRegions('sdkworkchat'), ['domestic', 'global', 'media']);
  assert.deepEqual(getChannelCatalogRegions('wechat'), ['domestic']);
  assert.deepEqual(getChannelCatalogRegions('wehcat'), ['media']);
  assert.deepEqual(getChannelCatalogRegions('discord'), ['global']);
  assert.deepEqual(getChannelCatalogRegions('unknown-channel'), ['global']);
});

runTest('partitionChannelCatalogItemsByRegion builds domestic, global, media, and all tabs while keeping domestic as the default', () => {
  const groups = partitionChannelCatalogItemsByRegion([
    {
      id: 'discord',
      name: 'Discord',
      description: 'Discord workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'wechat',
      name: 'WeChat',
      description: 'WeChat workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'wehcat',
      name: 'WeChat Official Account',
      description: 'WeChat media account workspace',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'qq',
      name: 'QQ',
      description: 'QQ workspace',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'sdkworkchat',
      name: 'Sdkwork Chat',
      description: 'Sdkwork Chat workspace',
      status: 'connected',
      enabled: true,
    },
  ]);

  assert.deepEqual(
    groups.domestic.map((item) => item.id),
    ['sdkworkchat', 'wechat', 'qq'],
  );
  assert.deepEqual(
    groups.global.map((item) => item.id),
    ['sdkworkchat', 'discord'],
  );
  assert.deepEqual(
    groups.media.map((item) => item.id),
    ['sdkworkchat', 'wehcat'],
  );
  assert.deepEqual(
    groups.all.map((item) => item.id),
    ['sdkworkchat', 'wechat', 'wehcat', 'qq', 'discord'],
  );
  assert.equal(resolveDefaultChannelCatalogRegion(groups), 'domestic');
  assert.equal(
    resolveDefaultChannelCatalogRegion({
      domestic: [],
      global: groups.global,
      media: groups.media,
      all: groups.all,
    }),
    'global',
  );
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

runTest('sortChannelCatalogItems keeps Sdkwork Chat pinned first and preserves configured channels after it', () => {
  const sorted = sortChannelCatalogItems([
    {
      id: 'discord',
      name: 'Discord',
      description: 'Discord workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'sdkworkchat',
      name: 'Sdkwork Chat',
      description: 'Sdkwork Chat workspace',
      status: 'not_configured',
      enabled: false,
    },
    {
      id: 'wechat',
      name: 'WeChat',
      description: 'WeChat workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'wehcat',
      name: 'Wehcat',
      description: 'WeChat workspace',
      status: 'not_configured',
      enabled: false,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['sdkworkchat', 'wechat', 'wehcat', 'discord'],
  );
});

runTest('sortChannelCatalogItems keeps WeChat, media, and domestic channels in catalog order', () => {
  const sorted = sortChannelCatalogItems([
    {
      id: 'qq',
      name: 'QQ',
      description: 'QQ workspace',
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
      id: 'feishu',
      name: 'Feishu',
      description: 'Feishu workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'wechat',
      name: 'WeChat',
      description: 'WeChat workspace',
      status: 'connected',
      enabled: true,
    },
    {
      id: 'wehcat',
      name: 'Wehcat',
      description: 'WeChat workspace',
      status: 'connected',
      enabled: true,
    },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.id),
    ['wechat', 'wehcat', 'qq', 'feishu', 'slack'],
  );
});
