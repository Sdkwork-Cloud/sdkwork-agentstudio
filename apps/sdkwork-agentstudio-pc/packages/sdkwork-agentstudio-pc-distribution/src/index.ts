export type DistributionId = 'cn' | 'global';

export interface DistributionManifest {
  id: DistributionId;
  appId: string;
  appName: string;
  bundleIdentifier: string;
  updateSource: 'github' | 'self-hosted';
  mirrorStrategy: 'regional' | 'global';
  apiBaseUrl: string;
}

import { cnManifest } from './manifests/cn';
import { globalManifest } from './manifests/global';

const manifests: Record<DistributionId, DistributionManifest> = {
  cn: cnManifest,
  global: globalManifest,
};

export function getDistributionManifest(distributionId: DistributionId): DistributionManifest {
  return manifests[distributionId];
}

export { cnManifest } from './manifests/cn';
export { globalManifest } from './manifests/global';
