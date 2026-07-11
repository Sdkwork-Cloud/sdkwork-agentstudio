export type AppRuntimeEnv = 'development' | 'staging' | 'production' | 'test';

export type AppDistributionId = 'cn' | 'global';

export interface AppEnvSource {
  [key: string]: string | undefined;
}

export interface AppEnvConfig {
  appEnv: AppRuntimeEnv;
  isDev: boolean;
  isStaging: boolean;
  isProduction: boolean;
  api: {
    baseUrl: string;
    timeout: number;
  };
  update: {
    appId: number | null;
    releaseChannel: string;
    enableStartupCheck: boolean;
  };
  distribution: {
    id: AppDistributionId;
  };
  platform: {
    id: string;
    isDesktop: boolean;
    isTauri: boolean;
  };
}

const DEFAULT_RUNTIME_ENV: AppRuntimeEnv = 'development';
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RELEASE_CHANNEL = 'stable';

interface ImportMetaEnvLike {
  env?: AppEnvSource;
}

function readRuntimeEnvSource(): AppEnvSource {
  return ((import.meta as ImportMetaEnvLike).env ?? {}) as AppEnvSource;
}

function readString(source: AppEnvSource, key: string, fallback = ''): string {
  const value = source[key];
  return value === undefined ? fallback : value.trim();
}

function readBoolean(source: AppEnvSource, key: string, fallback: boolean): boolean {
  const value = readString(source, key, String(fallback));
  return value === 'true' || value === '1';
}

function readPositiveNumber(source: AppEnvSource, key: string): number | null {
  const raw = readString(source, key);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function resolveRuntimeEnv(source: AppEnvSource): AppRuntimeEnv {
  const value = readString(source, 'VITE_APP_ENV', DEFAULT_RUNTIME_ENV).toLowerCase();
  if (value === 'production' || value === 'prod') {
    return 'production';
  }
  if (value === 'staging' || value === 'stage') {
    return 'staging';
  }
  if (value === 'test') {
    return 'test';
  }
  return DEFAULT_RUNTIME_ENV;
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/g, '');
}

function resolveDistributionId(source: AppEnvSource): AppDistributionId {
  return readString(source, 'VITE_DISTRIBUTION_ID') === 'cn' ? 'cn' : 'global';
}

function detectTauriRuntime(): boolean {
  return typeof window !== 'undefined' && typeof (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
}

function resolvePlatformId(source: AppEnvSource, isTauri: boolean): string {
  if (isTauri) {
    return 'desktop';
  }

  const configured = readString(source, 'VITE_PLATFORM');
  return configured || 'web';
}

export function createAppEnvConfig(source: AppEnvSource = readRuntimeEnvSource()): AppEnvConfig {
  const appEnv = resolveRuntimeEnv(source);
  const isTauri = detectTauriRuntime();
  const baseUrl = normalizeBaseUrl(readString(source, 'VITE_API_BASE_URL'));
  const timeout = readPositiveNumber(source, 'VITE_TIMEOUT') ?? DEFAULT_TIMEOUT;
  const appId = readPositiveNumber(source, 'VITE_APP_ID');

  return {
    appEnv,
    isDev: appEnv === 'development',
    isStaging: appEnv === 'staging',
    isProduction: appEnv === 'production',
    api: {
      baseUrl,
      timeout,
    },
    update: {
      appId,
      releaseChannel: readString(source, 'VITE_RELEASE_CHANNEL', DEFAULT_RELEASE_CHANNEL) || DEFAULT_RELEASE_CHANNEL,
      enableStartupCheck: readBoolean(source, 'VITE_ENABLE_STARTUP_UPDATE_CHECK', true),
    },
    distribution: {
      id: resolveDistributionId(source),
    },
    platform: {
      id: resolvePlatformId(source, isTauri),
      isDesktop: isTauri || readString(source, 'VITE_PLATFORM') === 'desktop',
      isTauri,
    },
  };
}

export const APP_ENV = createAppEnvConfig();

export function hasDesktopUpdateConfig(config: AppEnvConfig = APP_ENV): boolean {
  return !!config.api.baseUrl && config.update.appId !== null;
}

export function getApiUrl(path = '', config: AppEnvConfig = APP_ENV): string {
  const cleanPath = path.replace(/^\/+/, '');
  if (!cleanPath) {
    return config.api.baseUrl;
  }
  if (!config.api.baseUrl) {
    return `/${cleanPath}`;
  }
  return `${config.api.baseUrl}/${cleanPath}`;
}
