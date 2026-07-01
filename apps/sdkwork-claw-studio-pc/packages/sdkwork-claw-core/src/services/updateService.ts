import {
  APP_ENV,
  checkAppUpdate as defaultCheckAppUpdate,
  hasDesktopUpdateConfig,
  platform,
  runtime,
  type AppEnvConfig,
  type AppUpdateClientOptions,
  type AppUpdateCheckRequest,
  type AppUpdateCheckResult,
  type RuntimeInfo,
} from '@sdkwork/claw-infrastructure';

export interface UpdateCapability {
  available: boolean;
  reason?: string;
}

export interface PreferredUpdateAction {
  kind: 'open-download' | 'open-store' | 'none';
  url?: string;
}

export interface UpdateServiceDependencies {
  env?: AppEnvConfig;
  getRuntimeInfo?: () => Promise<RuntimeInfo>;
  getDeviceId?: () => Promise<string>;
  getLocale?: () => string | undefined;
  checkAppUpdate?: (
    request: AppUpdateCheckRequest,
    options?: AppUpdateClientOptions,
  ) => Promise<AppUpdateCheckResult>;
  openExternal?: (url: string) => Promise<void>;
}

function resolveUpdatePlatform(runtimeInfo: RuntimeInfo): string {
  const target = [
    runtimeInfo.system?.family || '',
    runtimeInfo.system?.os || '',
    runtimeInfo.app?.target || '',
    runtimeInfo.system?.target || '',
  ].join(' ').toLowerCase();

  if (target.includes('windows')) {
    return 'desktop_windows';
  }
  if (target.includes('mac') || target.includes('darwin')) {
    return 'desktop_macos';
  }
  if (target.includes('linux')) {
    return 'desktop_linux';
  }

  return 'desktop_unknown';
}

function resolveArchitecture(runtimeInfo: RuntimeInfo): string {
  if (runtimeInfo.system?.arch) {
    return runtimeInfo.system.arch;
  }

  const target = runtimeInfo.app?.target || runtimeInfo.system?.target || '';
  const segments = target.split('-').filter(Boolean);
  return segments[0] || 'unknown';
}

function resolveLocale(getLocale?: () => string | undefined): string | undefined {
  const configured = getLocale?.();
  if (configured && configured.trim()) {
    return configured.trim();
  }

  if (typeof Intl !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  }

  return undefined;
}

function buildMissingConfigReason(env: AppEnvConfig): string {
  const missing: string[] = [];
  if (!env.api.baseUrl) {
    missing.push('VITE_API_BASE_URL');
  }
  if (env.update.appId === null) {
    missing.push('VITE_APP_ID');
  }
  if (!env.platform.isDesktop) {
    missing.push('desktop-runtime');
  }

  return missing.length > 0
    ? `App update capability is unavailable because ${missing.join(', ')} is missing or unsupported.`
    : 'App update capability is unavailable.';
}

export function createUpdateService(dependencies: UpdateServiceDependencies = {}) {
  const env = dependencies.env ?? APP_ENV;

  return {
    isStartupCheckEnabled(): boolean {
      return env.update.enableStartupCheck;
    },

    getUpdateCapability(): UpdateCapability {
      if (!hasDesktopUpdateConfig(env) || !env.platform.isDesktop) {
        return {
          available: false,
          reason: buildMissingConfigReason(env),
        };
      }

      return { available: true };
    },

    async checkForAppUpdate(): Promise<AppUpdateCheckResult | null> {
      const capability = this.getUpdateCapability();
      if (!capability.available) {
        return null;
      }

      const runtimeInfo = await (dependencies.getRuntimeInfo ?? (() => runtime.getRuntimeInfo()))();
      const deviceId = await (dependencies.getDeviceId ?? (() => platform.getDeviceId()))();

      const request: AppUpdateCheckRequest = {
        appId: env.update.appId as number,
        runtime: 'TAURI',
        platform: resolveUpdatePlatform(runtimeInfo),
        architecture: resolveArchitecture(runtimeInfo),
        currentVersion: runtimeInfo.app?.version || '0.0.0',
        buildNumber: undefined,
        releaseChannel: env.update.releaseChannel,
        packageName: runtimeInfo.app?.name,
        bundleId: undefined,
        deviceId,
        osVersion: runtimeInfo.system?.os,
        locale: resolveLocale(dependencies.getLocale),
        metadata: {
          distributionId: env.distribution.id,
          runtimePlatform: runtimeInfo.platform,
          target: runtimeInfo.app?.target || runtimeInfo.system?.target,
          family: runtimeInfo.system?.family,
        },
      };

      return (dependencies.checkAppUpdate ?? defaultCheckAppUpdate)(request, { env });
    },

    resolvePreferredUpdateAction(result: AppUpdateCheckResult): PreferredUpdateAction {
      const packageUrl = result.resolvedPackage?.url?.trim();
      if (packageUrl) {
        return {
          kind: 'open-download',
          url: packageUrl,
        };
      }

      const updateUrl = result.updateUrl?.trim();
      if (updateUrl) {
        return {
          kind: 'open-download',
          url: updateUrl,
        };
      }

      const storeUrl = result.storeUrl?.trim();
      if (storeUrl) {
        return {
          kind: 'open-store',
          url: storeUrl,
        };
      }

      return {
        kind: 'none',
      };
    },

    async openUpdateTarget(result: AppUpdateCheckResult): Promise<PreferredUpdateAction> {
      const action = this.resolvePreferredUpdateAction(result);
      if (!action.url) {
        throw new Error('No update target is available for the current update payload.');
      }

      await (dependencies.openExternal ?? ((url: string) => platform.openExternal(url)))(action.url);
      return action;
    },
  };
}

export const updateService = createUpdateService();
