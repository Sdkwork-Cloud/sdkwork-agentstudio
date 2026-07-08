import type { DistributionManifest } from '../../index';

export const globalManifest: DistributionManifest = {
  id: 'global',
  appId: 'claw-studio-global',
  appName: 'Claw Studio',
  bundleIdentifier: 'com.sdkwork.claw-studio',
  updateSource: 'github',
  mirrorStrategy: 'global',
  apiBaseUrl: 'https://api.global.sdkwork.local',
};
