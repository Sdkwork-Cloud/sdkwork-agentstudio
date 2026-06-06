import type { SdkworkAppConfig } from '@sdkwork/app-sdk';
import {
  createDriveAppClient,
  type SdkworkDriveAppClient,
} from '@sdkwork/drive-app-sdk';
import {
  applyAppClientSessionTokens,
  createAppClientConfigFromEnv,
  getAppClient,
  getAppClientConfig,
  getAppClientWithSession,
  initAppClient,
  resolveAppClientAccessToken,
} from '@sdkwork/core-pc-react/app';
import { readPcReactEnvSource } from '@sdkwork/core-pc-react/env';
import {
  clearPcReactRuntimeSession,
  configurePcReactRuntime,
  persistPcReactRuntimeSession,
  readPcReactRuntimeSession,
  resetPcReactRuntime,
} from '@sdkwork/core-pc-react/runtime';
import {
  CLAW_STUDIO_USER_CENTER_NAMESPACE,
  CLAW_STUDIO_USER_CENTER_STORAGE_PLAN,
} from './userCenterContract.ts';
import { createUserCenterTokenStore } from './userCenterStorage.ts';

export type AppRuntimeEnv = 'development' | 'staging' | 'production' | 'test';

export interface AppSdkClientConfig extends SdkworkAppConfig {
  env: AppRuntimeEnv;
}

export type AppSdkClient = ReturnType<typeof getAppClient>;
export type DriveAppSdkClient = SdkworkDriveAppClient;

export interface AppSdkSessionTokens {
  authToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export const APP_SDK_SESSION_STORAGE_KEY = 'claw-studio-auth-session';
export const APP_SDK_USER_CENTER_NAMESPACE = CLAW_STUDIO_USER_CENTER_NAMESPACE;
export const APP_SDK_USER_CENTER_STORAGE_PLAN = CLAW_STUDIO_USER_CENTER_STORAGE_PLAN;

let runtimeConfigured = false;

function normalizeBearerTokenValue(value?: string | null): string | undefined {
  const normalized = (value || '').trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.replace(/^Bearer\s+/iu, '').trim() || undefined;
}

function normalizeRefreshTokenValue(value?: string | null): string | undefined {
  const normalized = (value || '').trim();
  return normalized || undefined;
}

function normalizeAppSdkSessionTokens(tokens: AppSdkSessionTokens): AppSdkSessionTokens {
  return {
    ...(normalizeBearerTokenValue(tokens.authToken)
      ? { authToken: normalizeBearerTokenValue(tokens.authToken) }
      : {}),
    ...(normalizeBearerTokenValue(tokens.accessToken)
      ? { accessToken: normalizeBearerTokenValue(tokens.accessToken) }
      : {}),
    ...(normalizeRefreshTokenValue(tokens.refreshToken)
      ? { refreshToken: normalizeRefreshTokenValue(tokens.refreshToken) }
      : {}),
  };
}

function createAppSdkUserCenterTokenStore() {
  return createUserCenterTokenStore(APP_SDK_USER_CENTER_STORAGE_PLAN, {
    legacySessionTokenKeys: [APP_SDK_SESSION_STORAGE_KEY],
  });
}

function readUserCenterSessionTokens(): AppSdkSessionTokens {
  const bundle = createAppSdkUserCenterTokenStore().readTokenBundle();

  return {
    ...(normalizeBearerTokenValue(bundle.authToken)
      ? { authToken: normalizeBearerTokenValue(bundle.authToken) }
      : {}),
    ...(normalizeBearerTokenValue(bundle.accessToken)
      ? { accessToken: normalizeBearerTokenValue(bundle.accessToken) }
      : {}),
    ...(normalizeRefreshTokenValue(bundle.refreshToken)
      ? { refreshToken: normalizeRefreshTokenValue(bundle.refreshToken) }
      : {}),
  };
}

function persistUserCenterSessionTokens(tokens: AppSdkSessionTokens): void {
  const normalizedTokens = normalizeAppSdkSessionTokens(tokens);

  createAppSdkUserCenterTokenStore().persistTokenBundle({
    accessToken: normalizedTokens.accessToken,
    authToken: normalizedTokens.authToken,
    refreshToken: normalizedTokens.refreshToken,
  });
}

function clearUserCenterSessionTokens(): void {
  createAppSdkUserCenterTokenStore().clearTokenBundle();
}

function synchronizeRuntimeSessionFromUserCenter(): void {
  const runtimeSession = readPcReactRuntimeSession();
  const userCenterTokens = readUserCenterSessionTokens();
  const nextRuntimeSession = {
    accessToken: runtimeSession.accessToken ?? userCenterTokens.accessToken,
    authToken: runtimeSession.authToken ?? userCenterTokens.authToken,
    refreshToken: runtimeSession.refreshToken ?? userCenterTokens.refreshToken,
  };

  if (
    nextRuntimeSession.authToken === runtimeSession.authToken
    && nextRuntimeSession.accessToken === runtimeSession.accessToken
    && nextRuntimeSession.refreshToken === runtimeSession.refreshToken
  ) {
    return;
  }

  persistPcReactRuntimeSession(nextRuntimeSession);
}

function ensureConfigured(): void {
  if (!runtimeConfigured) {
    configurePcReactRuntime({
      legacyStorageKeys: {
        accessToken: [APP_SDK_USER_CENTER_STORAGE_PLAN.accessTokenKey],
        authToken: [APP_SDK_USER_CENTER_STORAGE_PLAN.authTokenKey],
        refreshToken: [APP_SDK_USER_CENTER_STORAGE_PLAN.refreshTokenKey],
        runtimeSession: [APP_SDK_SESSION_STORAGE_KEY],
      },
    });
    runtimeConfigured = true;
  }

  synchronizeRuntimeSessionFromUserCenter();
}

export function createAppSdkClientConfig(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkClientConfig {
  return createAppClientConfigFromEnv(readPcReactEnvSource(), overrides) as AppSdkClientConfig;
}

export function initAppSdkClient(overrides: Partial<SdkworkAppConfig> = {}): AppSdkClient {
  ensureConfigured();
  return initAppClient(overrides);
}

export function getAppSdkClient(): AppSdkClient {
  ensureConfigured();
  return getAppClient();
}

export function getAppSdkClientConfig(): AppSdkClientConfig | null {
  return getAppClientConfig() as AppSdkClientConfig | null;
}

export function resolveAppSdkAccessToken(): string {
  ensureConfigured();
  return resolveAppClientAccessToken();
}

export function resetAppSdkClient(): void {
  resetPcReactRuntime({
    clearStorage: false,
    clearConfiguration: false,
  });
  runtimeConfigured = false;
}

export function applyAppSdkSessionTokens(tokens: AppSdkSessionTokens): void {
  ensureConfigured();
  applyAppClientSessionTokens(tokens);
}

export function readAppSdkSessionTokens(): AppSdkSessionTokens {
  ensureConfigured();
  const session = readPcReactRuntimeSession();
  const userCenterTokens = readUserCenterSessionTokens();

  return {
    authToken: userCenterTokens.authToken ?? session.authToken,
    accessToken: userCenterTokens.accessToken ?? session.accessToken,
    refreshToken: userCenterTokens.refreshToken ?? session.refreshToken,
  };
}

export function persistAppSdkSessionTokens(tokens: AppSdkSessionTokens): void {
  ensureConfigured();
  const normalizedTokens = normalizeAppSdkSessionTokens(tokens);
  persistUserCenterSessionTokens(normalizedTokens);
  persistPcReactRuntimeSession(normalizedTokens);
}

export function clearAppSdkSessionTokens(): void {
  ensureConfigured();
  clearUserCenterSessionTokens();
  void clearPcReactRuntimeSession();
}

export function getAppSdkClientWithSession(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkClient {
  ensureConfigured();
  return Object.keys(overrides).length > 0
    ? getAppClientWithSession(overrides)
    : getAppClientWithSession();
}

function applyDriveAppSdkSessionTokens(
  client: SdkworkDriveAppClient,
  tokens: AppSdkSessionTokens,
): void {
  const authToken = normalizeBearerTokenValue(tokens.authToken);
  const accessToken = normalizeBearerTokenValue(tokens.accessToken);

  if (authToken) {
    client.setAuthToken(authToken);
  }
  if (accessToken) {
    client.setAccessToken(accessToken);
  }
}

export function getDriveAppSdkClientWithSession(
  overrides: Partial<SdkworkAppConfig> = {},
): DriveAppSdkClient {
  ensureConfigured();
  const sessionTokens = readAppSdkSessionTokens();
  const client = createDriveAppClient(
    createAppSdkClientConfig({
      ...overrides,
      authToken: overrides.authToken ?? sessionTokens.authToken,
      accessToken: overrides.accessToken ?? sessionTokens.accessToken,
    }),
  );
  applyDriveAppSdkSessionTokens(client, sessionTokens);
  return client;
}

export function useAppSdkClient(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkClient {
  return getAppSdkClientWithSession(overrides);
}
