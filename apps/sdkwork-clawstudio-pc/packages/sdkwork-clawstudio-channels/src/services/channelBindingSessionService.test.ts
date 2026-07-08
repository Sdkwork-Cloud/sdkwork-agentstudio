import assert from 'node:assert/strict';
import { configurePlatformBridge, getPlatformBridge } from '@sdkwork/clawstudio-infrastructure';
import {
  channelBindingSessionService,
  extractChannelBindingQrPayload,
  resolveChannelBindingProfileId,
} from './channelBindingSessionService.ts';

async function runTest(name: string, callback: () => Promise<void> | void) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await runTest('resolveChannelBindingProfileId maps only documented scan-capable channels to desktop profiles', () => {
  assert.equal(resolveChannelBindingProfileId('qqbot'), 'channels.bind.qqbot');
  assert.equal(resolveChannelBindingProfileId('openclaw-weixin'), 'channels.bind.openclaw-weixin');
  assert.equal(resolveChannelBindingProfileId('feishu'), 'channels.bind.feishu');
  assert.equal(resolveChannelBindingProfileId('dingtalk-connector'), 'channels.bind.dingtalk-connector');

  for (const unsupported of ['qq', 'wechat', 'wecom', 'dingtalk', 'telegram']) {
    assert.equal(resolveChannelBindingProfileId(unsupported), null);
  }
});

await runTest('extractChannelBindingQrPayload reads official login URLs from noisy CLI output', () => {
  assert.equal(
    extractChannelBindingQrPayload('Scan this QR: https://login.weixin.qq.com/l/abc-123\n'),
    'https://login.weixin.qq.com/l/abc-123',
  );
  assert.equal(
    extractChannelBindingQrPayload('请使用飞书扫码 https://open.feishu.cn/open-apis/authen/v1/index?token=abc'),
    'https://open.feishu.cn/open-apis/authen/v1/index?token=abc',
  );
  assert.equal(
    extractChannelBindingQrPayload('DingTalk authorize: dingtalk://dingtalkclient/action/openapp?foo=bar'),
    'dingtalk://dingtalkclient/action/openapp?foo=bar',
  );
});

await runTest('extractChannelBindingQrPayload preserves terminal QR blocks when no URL is printed', () => {
  const terminalQr = [
    '████████████████████',
    '██ ▄▄▄▄▄ ██▀ ▄ ██',
    '██ █   █ █▀▄▀█ ██',
    '██ █▄▄▄█ ██▄▀▄ ██',
    '████████████████████',
  ].join('\n');

  assert.equal(extractChannelBindingQrPayload(terminalQr), terminalQr);
});

await runTest('startBinding submits the whitelisted desktop profile and returns a starting session', async () => {
  const originalBridge = getPlatformBridge();
  const submittedProfiles: string[] = [];

  configurePlatformBridge({
    runtime: {
      ...originalBridge.runtime,
      async submitProcessJob(profileId) {
        submittedProfiles.push(profileId);
        return 'job-channel-bind';
      },
    },
  });

  try {
    const session = await channelBindingSessionService.startBinding('openclaw-weixin');

    assert.deepEqual(submittedProfiles, ['channels.bind.openclaw-weixin']);
    assert.equal(session.channelId, 'openclaw-weixin');
    assert.equal(session.jobId, 'job-channel-bind');
    assert.equal(session.state, 'starting');
  } finally {
    configurePlatformBridge(originalBridge);
  }
});

await runTest('startBinding fails closed for unsupported channels before invoking runtime process jobs', async () => {
  const originalBridge = getPlatformBridge();
  let submitted = false;

  configurePlatformBridge({
    runtime: {
      ...originalBridge.runtime,
      async submitProcessJob() {
        submitted = true;
        return 'job-should-not-run';
      },
    },
  });

  try {
    const session = await channelBindingSessionService.startBinding('wecom');

    assert.equal(submitted, false);
    assert.equal(session.channelId, 'wecom');
    assert.equal(session.state, 'unsupported');
    assert.match(session.error || '', /not supported/i);
  } finally {
    configurePlatformBridge(originalBridge);
  }
});
