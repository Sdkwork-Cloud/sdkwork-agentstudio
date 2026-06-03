export type ChannelBindingGuidePrimaryAction = 'officialLink' | 'manual';

export interface ChannelBindingGuide {
  channelId: string;
  commands: string[];
  /**
   * Translation keys under channels.definitions.bindingGuides.
   */
  steps: string[];
  primaryAction: ChannelBindingGuidePrimaryAction;
  manualFallback: boolean;
}

const channelBindingGuides: Record<string, ChannelBindingGuide> = {
  qqbot: {
    channelId: 'qqbot',
    commands: [
      'openclaw channels add --channel qqbot',
      'openclaw gateway restart',
    ],
    steps: [
      'channels.definitions.bindingGuides.qqbot.steps.add',
      'channels.definitions.bindingGuides.qqbot.steps.scan',
      'channels.definitions.bindingGuides.qqbot.steps.restart',
    ],
    primaryAction: 'officialLink',
    manualFallback: true,
  },
  'openclaw-weixin': {
    channelId: 'openclaw-weixin',
    commands: [
      'npx -y @tencent-weixin/openclaw-weixin-cli install',
      'openclaw channels login --channel openclaw-weixin',
      'openclaw gateway restart',
    ],
    steps: [
      'channels.definitions.bindingGuides.openclaw-weixin.steps.install',
      'channels.definitions.bindingGuides.openclaw-weixin.steps.scan',
      'channels.definitions.bindingGuides.openclaw-weixin.steps.restart',
    ],
    primaryAction: 'officialLink',
    manualFallback: true,
  },
  feishu: {
    channelId: 'feishu',
    commands: [
      'openclaw channels login --channel feishu',
      'openclaw gateway restart',
    ],
    steps: [
      'channels.definitions.bindingGuides.feishu.steps.login',
      'channels.definitions.bindingGuides.feishu.steps.scan',
      'channels.definitions.bindingGuides.feishu.steps.restart',
    ],
    primaryAction: 'officialLink',
    manualFallback: true,
  },
  'dingtalk-connector': {
    channelId: 'dingtalk-connector',
    commands: [
      'npx -y @dingtalk-real-ai/dingtalk-connector install',
      'openclaw gateway restart',
    ],
    steps: [
      'channels.definitions.bindingGuides.dingtalk-connector.steps.install',
      'channels.definitions.bindingGuides.dingtalk-connector.steps.scan',
      'channels.definitions.bindingGuides.dingtalk-connector.steps.restart',
    ],
    primaryAction: 'officialLink',
    manualFallback: true,
  },
};

export function getChannelBindingGuide(channelId: string): ChannelBindingGuide | null {
  return channelBindingGuides[channelId] || null;
}
