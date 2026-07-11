import type { DistributionManifest } from '../../index';

export const cnManifest: DistributionManifest = {
  id: 'cn',
  appId: 'agent-studio-cn',
  appName: 'Agent Studio CN',
  bundleIdentifier: 'com.sdkwork.agent-studio.cn',
  updateSource: 'self-hosted',
  mirrorStrategy: 'regional',
  apiBaseUrl: 'https://api.cn.sdkwork.local',
};
