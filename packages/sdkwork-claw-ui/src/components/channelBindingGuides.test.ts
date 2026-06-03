import assert from 'node:assert/strict';
import { getChannelBindingGuide } from './channelBindingGuides.ts';

function runTest(name: string, callback: () => void) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('getChannelBindingGuide exposes official scan binding commands only for verified QR-capable domestic plugins', () => {
  assert.deepEqual(getChannelBindingGuide('qqbot')?.commands, [
    'openclaw channels add --channel qqbot',
    'openclaw gateway restart',
  ]);
  assert.deepEqual(getChannelBindingGuide('openclaw-weixin')?.commands, [
    'npx -y @tencent-weixin/openclaw-weixin-cli install',
    'openclaw channels login --channel openclaw-weixin',
    'openclaw gateway restart',
  ]);
  assert.deepEqual(getChannelBindingGuide('feishu')?.commands, [
    'openclaw channels login --channel feishu',
    'openclaw gateway restart',
  ]);
  assert.deepEqual(getChannelBindingGuide('dingtalk-connector')?.commands, [
    'npx -y @dingtalk-real-ai/dingtalk-connector install',
    'openclaw gateway restart',
  ]);

  for (const unsupportedChannelId of ['wecom', 'dingtalk', 'wechat', 'qq']) {
    assert.equal(getChannelBindingGuide(unsupportedChannelId), null);
  }
});

runTest('getChannelBindingGuide keeps scan binding actions on documented destinations with manual fallback', () => {
  for (const channelId of ['qqbot', 'openclaw-weixin', 'feishu', 'dingtalk-connector']) {
    const guide = getChannelBindingGuide(channelId);

    assert.equal(guide?.primaryAction, 'officialLink');
    assert.equal(guide?.manualFallback, true);
    assert.ok(guide?.steps.length && guide.steps.length >= 3);
    assert.equal(
      guide?.steps.every((step) => step.startsWith('channels.definitions.bindingGuides.')),
      true,
    );
  }
});
