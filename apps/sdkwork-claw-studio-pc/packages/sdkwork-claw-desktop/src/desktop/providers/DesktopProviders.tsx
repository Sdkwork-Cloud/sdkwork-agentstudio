import { useEffect, type ReactNode } from 'react';
import type { DistributionId } from '@sdkwork/claw-distribution';
import { getDistributionManifest } from '@sdkwork/claw-distribution';

function resolveDistributionId(): DistributionId {
  const distribution = import.meta.env.VITE_DISTRIBUTION_ID;
  return distribution === 'cn' ? 'cn' : 'global';
}

export function DesktopProviders({ children }: { children: ReactNode }) {
  const manifest = getDistributionManifest(resolveDistributionId());

  useEffect(() => {
    document.documentElement.setAttribute('data-distribution', manifest.id);
    document.title = manifest.appName;
  }, [manifest.appName, manifest.id]);

  return (
    <>
      {children}
    </>
  );
}
