import {
  hostPlatformService,
  type HostPlatformSnapshot,
} from './hostPlatformService.ts';

export interface HostRuntimeModeSummary {
  mode: HostPlatformSnapshot['mode'];
  modeLabel: string;
  lifecycle: HostPlatformSnapshot['lifecycle'];
  lifecycleLabel: string;
  browserManagementSupported: boolean;
  browserManagementAvailable: boolean;
  browserManagementLabel: string;
  manageBasePath: string | null;
  internalBasePath: string | null;
}

export interface CreateHostRuntimeModeServiceOptions {
  hostPlatformService?: Pick<typeof hostPlatformService, 'getStatus'>;
}

function formatModeLabel(mode: HostPlatformSnapshot['mode']) {
  switch (mode) {
    case 'desktopCombined':
      return 'Desktop Combined';
    case 'server':
      return 'Server';
    default:
      return 'Web Preview';
  }
}

function formatLifecycleLabel(lifecycle: HostPlatformSnapshot['lifecycle']) {
  switch (lifecycle) {
    case 'ready':
      return 'Ready';
    case 'starting':
      return 'Starting';
    case 'degraded':
      return 'Degraded';
    case 'stopping':
      return 'Stopping';
    case 'stopped':
      return 'Stopped';
    default:
      return 'Inactive';
  }
}

function mapHostRuntimeModeSummary(
  status: HostPlatformSnapshot,
): HostRuntimeModeSummary {
  const browserManagementSupported =
    status.mode === 'desktopCombined' || status.mode === 'server';
  const browserManagementAvailable =
    browserManagementSupported
    && status.lifecycle === 'ready'
    && Boolean(status.manageBasePath && status.internalBasePath);

  return {
    mode: status.mode,
    modeLabel: formatModeLabel(status.mode),
    lifecycle: status.lifecycle,
    lifecycleLabel: formatLifecycleLabel(status.lifecycle),
    browserManagementSupported,
    browserManagementAvailable,
    browserManagementLabel: browserManagementAvailable
      ? status.mode === 'desktopCombined'
        ? 'Embedded Browser Management'
        : 'Hosted Browser Management'
      : browserManagementSupported
      ? 'Host Runtime Available'
      : 'Browser Management Unavailable',
    manageBasePath: status.manageBasePath ?? null,
    internalBasePath: status.internalBasePath ?? null,
  };
}

export function createHostRuntimeModeService(
  options: CreateHostRuntimeModeServiceOptions = {},
) {
  const resolveHostPlatformService =
    options.hostPlatformService ?? hostPlatformService;

  return {
    async getSummary(): Promise<HostRuntimeModeSummary> {
      const status = await resolveHostPlatformService.getStatus();
      return mapHostRuntimeModeSummary(status);
    },
  };
}

export const hostRuntimeModeService = createHostRuntimeModeService();
