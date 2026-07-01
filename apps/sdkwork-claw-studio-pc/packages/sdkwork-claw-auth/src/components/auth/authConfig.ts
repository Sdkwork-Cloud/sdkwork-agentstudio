import type { AppAuthSocialProvider } from '@sdkwork/claw-core';

export type AuthMode = 'login' | 'register' | 'forgot';
export type AuthLoginMethod = 'password' | 'phoneCode' | 'emailCode';
export type AuthRegisterMethod = 'email' | 'phone';
export type AuthRecoveryMethod = 'email' | 'phone';
export type QrPanelState =
  | 'idle'
  | 'loading'
  | 'pending'
  | 'scanned'
  | 'confirmed'
  | 'expired'
  | 'error';

export interface AuthRuntimeConfig {
  loginMethods?: AuthLoginMethod[];
  registerMethods?: AuthRegisterMethod[];
  recoveryMethods?: AuthRecoveryMethod[];
  oauthProviders?: AppAuthSocialProvider[];
  qrLoginEnabled?: boolean;
  oauthLoginEnabled?: boolean;
}

type AuthRuntimeGlobal = typeof globalThis & {
  __SDKWORK_CLAW_AUTH__?: AuthRuntimeConfig;
  __SDKWORK_CLAW_AUTH_CONFIG__?: AuthRuntimeConfig;
};

export const DEFAULT_AUTH_LOGIN_METHODS: AuthLoginMethod[] = [
  'password',
  'phoneCode',
  'emailCode',
];

export const DEFAULT_AUTH_REGISTER_METHODS: AuthRegisterMethod[] = [
  'email',
  'phone',
];

export const DEFAULT_AUTH_RECOVERY_METHODS: AuthRecoveryMethod[] = [
  'email',
  'phone',
];

export const DEFAULT_AUTH_OAUTH_PROVIDERS: AppAuthSocialProvider[] = [
  'wechat',
  'douyin',
  'github',
  'google',
];

function readRuntimeConfig(): AuthRuntimeConfig | undefined {
  return getAuthRuntimeConfig();
}

function readEnvOAuthProviders(): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };

  return meta.env?.VITE_AUTH_OAUTH_PROVIDERS;
}

function readEnvLoginMethods(): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };

  return meta.env?.VITE_AUTH_LOGIN_METHODS;
}

function readEnvRegisterMethods(): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };

  return meta.env?.VITE_AUTH_REGISTER_METHODS;
}

function readEnvRecoveryMethods(): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };

  return meta.env?.VITE_AUTH_RECOVERY_METHODS;
}

function readEnvQrLoginEnabled(): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };

  return meta.env?.VITE_AUTH_QR_LOGIN_ENABLED;
}

function readEnvOAuthLoginEnabled(): string | undefined {
  const meta = import.meta as ImportMeta & {
    env?: Record<string, string | undefined>;
  };

  return meta.env?.VITE_AUTH_OAUTH_LOGIN_ENABLED;
}

function normalizeProvider(provider: string | undefined | null): AppAuthSocialProvider | null {
  const normalized = (provider || '').trim().toLowerCase();
  return normalized || null;
}

function parseProviderList(
  value: string | undefined | null,
): AppAuthSocialProvider[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\s]+/)
    .map((item) => normalizeProvider(item))
    .filter((item): item is AppAuthSocialProvider => Boolean(item));
}

function isAuthLoginMethod(value: string | undefined): value is AuthLoginMethod {
  return value === 'password' || value === 'phoneCode' || value === 'emailCode';
}

function isAuthRegisterMethod(value: string | undefined): value is AuthRegisterMethod {
  return value === 'email' || value === 'phone';
}

function isAuthRecoveryMethod(value: string | undefined): value is AuthRecoveryMethod {
  return value === 'email' || value === 'phone';
}

function parseMethodList<T extends string>(
  value: string | undefined | null,
  isAllowed: (value: string | undefined) => value is T,
): T[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\s]+/)
    .map((item) => (item || '').trim())
    .filter((item): item is T => isAllowed(item));
}

function dedupeValues<T extends string>(
  values: Array<T | null | undefined>,
): T[] {
  const seen = new Set<T>();

  return values.flatMap((value) => {
    if (!value || seen.has(value)) {
      return [];
    }

    seen.add(value);
    return [value];
  });
}

function parseBoolean(value: string | undefined | null): boolean | undefined {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }

  return undefined;
}

function normalizeQrType(type: string | undefined | null) {
  return (type || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function resolveAuthMode(pathname: string): AuthMode {
  if (pathname === '/register') {
    return 'register';
  }

  if (pathname === '/forgot-password') {
    return 'forgot';
  }

  return 'login';
}

export function resolveAuthOAuthProviders(
  explicitProviders?: AppAuthSocialProvider[],
): AppAuthSocialProvider[] {
  const runtimeProviders = readRuntimeConfig()?.oauthProviders || [];
  const envProviders = parseProviderList(readEnvOAuthProviders());
  const configuredProviders = explicitProviders?.length
    ? explicitProviders
    : runtimeProviders.length
      ? runtimeProviders
      : envProviders.length
        ? envProviders
        : DEFAULT_AUTH_OAUTH_PROVIDERS;

  return dedupeValues(
    configuredProviders.map((provider) => normalizeProvider(provider)),
  );
}

export function resolveAuthLoginMethods(
  explicitMethods?: AuthLoginMethod[],
): AuthLoginMethod[] {
  const runtimeMethods = dedupeValues(readRuntimeConfig()?.loginMethods || []);
  const envMethods = parseMethodList(readEnvLoginMethods(), isAuthLoginMethod);
  const configuredMethods = explicitMethods?.length
    ? explicitMethods
    : runtimeMethods.length
      ? runtimeMethods
      : envMethods.length
        ? envMethods
        : DEFAULT_AUTH_LOGIN_METHODS;

  return dedupeValues(configuredMethods);
}

export function resolveAuthRegisterMethods(
  explicitMethods?: AuthRegisterMethod[],
): AuthRegisterMethod[] {
  const runtimeMethods = dedupeValues(readRuntimeConfig()?.registerMethods || []);
  const envMethods = parseMethodList(readEnvRegisterMethods(), isAuthRegisterMethod);
  const configuredMethods = explicitMethods?.length
    ? explicitMethods
    : runtimeMethods.length
      ? runtimeMethods
      : envMethods.length
        ? envMethods
        : DEFAULT_AUTH_REGISTER_METHODS;

  return dedupeValues(configuredMethods);
}

export function resolveAuthRecoveryMethods(
  explicitMethods?: AuthRecoveryMethod[],
): AuthRecoveryMethod[] {
  const runtimeMethods = dedupeValues(readRuntimeConfig()?.recoveryMethods || []);
  const envMethods = parseMethodList(readEnvRecoveryMethods(), isAuthRecoveryMethod);
  const configuredMethods = explicitMethods?.length
    ? explicitMethods
    : runtimeMethods.length
      ? runtimeMethods
      : envMethods.length
        ? envMethods
        : DEFAULT_AUTH_RECOVERY_METHODS;

  return dedupeValues(configuredMethods);
}

export function isAuthQrLoginEnabled(explicitValue?: boolean): boolean {
  if (typeof explicitValue === 'boolean') {
    return explicitValue;
  }

  const runtimeValue = readRuntimeConfig()?.qrLoginEnabled;
  if (typeof runtimeValue === 'boolean') {
    return runtimeValue;
  }

  return parseBoolean(readEnvQrLoginEnabled()) ?? true;
}

export function isAuthOAuthLoginEnabled(explicitValue?: boolean): boolean {
  if (typeof explicitValue === 'boolean') {
    return explicitValue;
  }

  const runtimeValue = readRuntimeConfig()?.oauthLoginEnabled;
  if (typeof runtimeValue === 'boolean') {
    return runtimeValue;
  }

  return parseBoolean(readEnvOAuthLoginEnabled()) ?? true;
}

export function normalizeAuthOAuthProvider(
  provider: string | undefined,
): AppAuthSocialProvider | null {
  return normalizeProvider(provider);
}

export function isConfiguredAuthOAuthProvider(
  provider: string | undefined,
  configuredProviders = resolveAuthOAuthProviders(),
): provider is AppAuthSocialProvider {
  const normalized = normalizeProvider(provider);
  return Boolean(normalized && configuredProviders.includes(normalized));
}

export function resolveAuthProviderTranslationKey(provider: string) {
  return `auth.providers.${normalizeProvider(provider) || 'fallback'}`;
}

export function humanizeAuthProvider(provider: string) {
  return provider
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

export function resolveRecoveryChannel(method: AuthRecoveryMethod): 'EMAIL' | 'SMS' {
  return method === 'phone' ? 'SMS' : 'EMAIL';
}

export function getAuthRuntimeConfig(): AuthRuntimeConfig | undefined {
  const runtime = globalThis as AuthRuntimeGlobal;
  return runtime.__SDKWORK_CLAW_AUTH_CONFIG__ || runtime.__SDKWORK_CLAW_AUTH__;
}

export function setAuthRuntimeConfig(config: AuthRuntimeConfig): AuthRuntimeConfig {
  const runtime = globalThis as AuthRuntimeGlobal;
  runtime.__SDKWORK_CLAW_AUTH_CONFIG__ = { ...config };
  return runtime.__SDKWORK_CLAW_AUTH_CONFIG__;
}

export function clearAuthRuntimeConfig() {
  const runtime = globalThis as AuthRuntimeGlobal;
  delete runtime.__SDKWORK_CLAW_AUTH_CONFIG__;
  delete runtime.__SDKWORK_CLAW_AUTH__;
}

export function looksLikeEmailAddress(value: string | undefined | null): boolean {
  const normalized = (value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function looksLikePhoneNumber(value: string | undefined | null): boolean {
  const normalized = (value || '').trim().replace(/[\s()-]+/g, '');
  return /^\+?\d{6,20}$/.test(normalized);
}

export function resolveAuthQrTypeHintKey(type: string | undefined | null) {
  return normalizeQrType(type) === 'wechat_official_account'
    ? 'auth.qrTypeHints.wechatOfficialAccount'
    : 'auth.qrTypeHints.default';
}

export function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
