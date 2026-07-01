import type { DistributionManifest } from '../../index';

export const cnManifest: DistributionManifest = {
  id: 'cn',
  appId: 'claw-studio-cn',
  appName: 'Claw Studio CN',
  bundleIdentifier: 'com.sdkwork.claw-studio.cn',
  updateSource: 'self-hosted',
  mirrorStrategy: 'regional',
  apiBaseUrl: 'https://api.cn.sdkwork.local',
};
