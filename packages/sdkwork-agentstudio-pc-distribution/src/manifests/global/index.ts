import type { DistributionManifest } from '../../index';

export const globalManifest: DistributionManifest = {
  id: 'global',
  appId: 'agent-studio-global',
  appName: 'Agent Studio',
  bundleIdentifier: 'com.sdkwork.agent-studio',
  updateSource: 'github',
  mirrorStrategy: 'global',
  apiBaseUrl: 'https://api.global.sdkwork.local',
};
