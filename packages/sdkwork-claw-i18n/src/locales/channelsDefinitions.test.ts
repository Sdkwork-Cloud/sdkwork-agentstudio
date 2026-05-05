import assert from 'node:assert/strict';
import en from './en/channels.json' with { type: 'json' };
import zh from './zh/channels.json' with { type: 'json' };

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const expectedChannelFields: Record<string, string[]> = {
  sdkworkchat: [],
  wechat: [],
  wehcat: ['appId', 'appSecret', 'token', 'encodingAesKey'],
  qq: ['botKey', 'groupId'],
  dingtalk: ['accessToken', 'secret'],
  wecom: ['corpId', 'agentId', 'secret'],
  feishu: ['appId', 'appSecret', 'encryptKey', 'verificationToken'],
  telegram: [
    'botToken',
    'tokenFile',
    'webhookUrl',
    'webhookSecret',
    'webhookPath',
    'webhookHost',
    'webhookPort',
    'errorPolicy',
    'errorCooldownMs',
  ],
  whatsapp: ['allowFrom', 'groups'],
  discord: ['token'],
  slack: ['botToken', 'appToken', 'signingSecret'],
  googlechat: [
    'serviceAccount',
    'serviceAccountRef',
    'audienceType',
    'audience',
    'webhookPath',
    'webhookUrl',
  ],
};

const expectedOfficialLinkChannels = [
  'sdkworkchat',
  'wechat',
  'wehcat',
  'feishu',
  'qq',
  'dingtalk',
  'wecom',
  'telegram',
  'discord',
  'slack',
  'googlechat',
];

await runTest('channels locale bundles expose validation copy and complete built-in channel definitions', () => {
  assert.equal(en.page.validation.requiredField, '{{field}} is required.');
  assert.equal(typeof zh.page.validation.requiredField, 'string');
  assert.equal(zh.page.validation.requiredField.length > 0, true);

  for (const [channelId, fieldKeys] of Object.entries(expectedChannelFields)) {
    const enDefinition = en.definitions.channels[channelId];
    const zhDefinition = zh.definitions.channels[channelId];

    assert.equal(typeof enDefinition?.name, 'string');
    assert.equal(enDefinition.name.length > 0, true);
    assert.equal(typeof zhDefinition?.name, 'string');
    assert.equal(zhDefinition.name.length > 0, true);

    assert.equal(typeof enDefinition?.description, 'string');
    assert.equal(enDefinition.description.length > 0, true);
    assert.equal(typeof zhDefinition?.description, 'string');
    assert.equal(zhDefinition.description.length > 0, true);

    assert.equal(Object.keys(enDefinition?.setupSteps || {}).length > 0, true);
    assert.equal(Object.keys(zhDefinition?.setupSteps || {}).length > 0, true);

    for (const fieldKey of fieldKeys) {
      assert.equal(typeof enDefinition?.fields?.[fieldKey]?.label, 'string');
      assert.equal(enDefinition.fields[fieldKey].label.length > 0, true);
      assert.equal(typeof enDefinition?.fields?.[fieldKey]?.placeholder, 'string');

      assert.equal(typeof zhDefinition?.fields?.[fieldKey]?.label, 'string');
      assert.equal(zhDefinition.fields[fieldKey].label.length > 0, true);
      assert.equal(typeof zhDefinition?.fields?.[fieldKey]?.placeholder, 'string');
    }
  }

  assert.equal(typeof en.definitions.sharedFields.contextVisibility.label, 'string');
  assert.equal(typeof en.definitions.sharedFields.contextVisibility.placeholder, 'string');
  assert.equal(typeof en.definitions.sharedFields.contextVisibility.helpText, 'string');
  assert.equal(typeof zh.definitions.sharedFields.contextVisibility.label, 'string');
  assert.equal(typeof zh.definitions.sharedFields.contextVisibility.placeholder, 'string');
  assert.equal(typeof zh.definitions.sharedFields.contextVisibility.helpText, 'string');
});

await runTest('channels locale bundles expose localized official link labels for built-in catalog actions', () => {
  for (const channelId of expectedOfficialLinkChannels) {
    assert.equal(typeof en.definitions.officialLinks[channelId], 'string');
    assert.equal(en.definitions.officialLinks[channelId].length > 0, true);
    assert.equal(typeof zh.definitions.officialLinks[channelId], 'string');
    assert.equal(zh.definitions.officialLinks[channelId].length > 0, true);
  }
});

await runTest('channels locale bundles expose QR connection copy and manual fallback labels', () => {
  const qrCopyKeys = [
    'qrConnectionTitle',
    'qrConnectionDescription',
    'qrConnectionAlt',
    'qrConnectionPending',
    'qrConnectionHint',
    'manualConfigurationAction',
  ] as const;

  for (const key of qrCopyKeys) {
    assert.equal(typeof en.page.panel[key], 'string');
    assert.equal(en.page.panel[key].length > 0, true);
    assert.equal(typeof zh.page.panel[key], 'string');
    assert.equal(zh.page.panel[key].length > 0, true);
  }
});
