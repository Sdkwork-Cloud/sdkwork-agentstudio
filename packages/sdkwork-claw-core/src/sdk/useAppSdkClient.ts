import {
  createClient as createAppbaseAppClient,
  type SdkworkAppClient as AppbaseAppSdkClient,
  type SdkworkAppConfig,
} from '@sdkwork/appbase-app-sdk';
import {
  createDriveAppClient,
  type SdkworkDriveAppClient,
} from '@sdkwork/drive-app-sdk';
import {
  createClient as createMessagingAppClient,
  type SdkworkAppClient as MessagingAppSdkClientType,
} from '@sdkwork/messaging-app-sdk';
import {
  createIamRuntime,
  type AuthTokenManager,
  type IamRuntime,
  type IamStoredSession,
  type IamTokenStore,
} from '@sdkwork/iam-runtime';
import { createIamSdkAdapters } from '@sdkwork/iam-sdk-adapter';
import {
  createAppClientConfigFromEnv,
  getAppClientWithSession as getRuntimeAppClientWithSession,
  getAppClientConfig,
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
import type { ClawStudioRemoteAppClient } from './appSdkPort.ts';

export type AppRuntimeEnv = 'development' | 'staging' | 'production' | 'test';

export interface AppSdkClientConfig extends SdkworkAppConfig {
  env: AppRuntimeEnv;
}

export type AppSdkClient = AppbaseAppSdkClient;
export type ClawStudioAppClient = ClawStudioRemoteAppClient;
export type DriveAppSdkClient = SdkworkDriveAppClient;
export type MessagingAppSdkClient = MessagingAppSdkClientType;

export interface AppSdkRuntime {
  appbaseClient: AppbaseAppSdkClient;
  config: AppSdkClientConfig;
  driveClient: SdkworkDriveAppClient;
  iamRuntime: IamRuntime;
  messagingClient: MessagingAppSdkClient;
  tokenManager: AuthTokenManager;
}

export interface AppSdkSessionTokens {
  authToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export const APP_SDK_SESSION_STORAGE_KEY = 'claw-studio-auth-session';
export const APP_SDK_USER_CENTER_NAMESPACE = CLAW_STUDIO_USER_CENTER_NAMESPACE;
export const APP_SDK_USER_CENTER_STORAGE_PLAN = CLAW_STUDIO_USER_CENTER_STORAGE_PLAN;

let runtimeConfigured = false;
let appSdkRuntime: AppSdkRuntime | null = null;

const CLAW_STUDIO_APP_ID = '10001';

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

function createAppSdkIamTokenStore(): IamTokenStore {
  return {
    clear: clearUserCenterSessionTokens,
    get: (): IamStoredSession => readUserCenterSessionTokens(),
    set: (session: IamStoredSession): void => {
      persistUserCenterSessionTokens(session);
      persistPcReactRuntimeSession(session);
    },
  };
}

function resolveIamEnvironment(env: AppRuntimeEnv): 'dev' | 'test' | 'prod' {
  if (env === 'production') {
    return 'prod';
  }
  if (env === 'test') {
    return 'test';
  }
  return 'dev';
}

function resolveIamDeploymentMode(config: AppSdkClientConfig): 'local' | 'private' | 'saas' {
  const baseUrl = config.baseUrl.trim().toLowerCase();
  if (
    baseUrl.includes('localhost')
    || baseUrl.includes('127.0.0.1')
    || baseUrl.includes('[::1]')
  ) {
    return 'local';
  }
  return 'saas';
}

function createTokenManagerAwareIamAppClient(
  appbaseClient: AppbaseAppSdkClient,
) {
  const { appbaseApp } = createIamSdkAdapters({ appbaseApp: appbaseClient });

  return {
    ...appbaseApp,
    setTokenManager: (manager: AuthTokenManager) => appbaseClient.setTokenManager(manager),
  };
}

function createComposedSdkRuntime(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkRuntime {
  const config = createAppSdkClientConfig(overrides);
  const appbaseClient = createAppbaseAppClient(config);
  const driveClient = createDriveAppClient(config);
  const messagingClient = createMessagingAppClient(config);
  const iamRuntime = createIamRuntime({
    clients: {
      appbaseApp: createTokenManagerAwareIamAppClient(appbaseClient),
      sdkClients: [driveClient, messagingClient],
    },
    config: {
      appApiBaseUrl: config.baseUrl,
      appId: CLAW_STUDIO_APP_ID,
      deploymentMode: resolveIamDeploymentMode(config),
      environment: resolveIamEnvironment(config.env),
    },
    tokenStore: createAppSdkIamTokenStore(),
  });

  return {
    appbaseClient,
    config,
    driveClient,
    iamRuntime,
    messagingClient,
    tokenManager: iamRuntime.tokenManager,
  };
}

function getComposedSdkRuntime(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkRuntime {
  ensureConfigured();
  if (Object.keys(overrides).length > 0) {
    return createComposedSdkRuntime(overrides);
  }
  if (!appSdkRuntime) {
    appSdkRuntime = createComposedSdkRuntime();
  }
  return appSdkRuntime;
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
  appSdkRuntime = createComposedSdkRuntime(overrides);
  return appSdkRuntime.appbaseClient;
}

export function getAppSdkClient(): AppSdkClient {
  return getComposedSdkRuntime().appbaseClient;
}

export function getAppSdkClientConfig(): AppSdkClientConfig | null {
  return appSdkRuntime?.config
    ?? getAppClientConfig() as AppSdkClientConfig | null;
}

export function resolveAppSdkAccessToken(): string {
  const tokens = getComposedSdkRuntime().tokenManager.getTokens();
  return tokens.accessToken ?? readAppSdkSessionTokens().accessToken ?? resolveAppClientAccessToken();
}

export function resetAppSdkClient(): void {
  resetPcReactRuntime({
    clearStorage: false,
    clearConfiguration: false,
  });
  runtimeConfigured = false;
  appSdkRuntime = null;
}

export function applyAppSdkSessionTokens(tokens: AppSdkSessionTokens): void {
  const normalizedTokens = normalizeAppSdkSessionTokens(tokens);
  const runtime = getComposedSdkRuntime();
  runtime.tokenManager.setTokens(normalizedTokens);
  persistUserCenterSessionTokens(normalizedTokens);
  persistPcReactRuntimeSession(normalizedTokens);
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
  appSdkRuntime?.tokenManager.setTokens(normalizedTokens);
  persistUserCenterSessionTokens(normalizedTokens);
  persistPcReactRuntimeSession(normalizedTokens);
}

export function clearAppSdkSessionTokens(): void {
  ensureConfigured();
  appSdkRuntime?.tokenManager.clearTokens();
  clearUserCenterSessionTokens();
  void clearPcReactRuntimeSession();
}

export function getAppSdkClientWithSession(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkClient {
  return getComposedSdkRuntime(overrides).appbaseClient;
}

export function getClawStudioAppClientWithSession(
  overrides: Partial<SdkworkAppConfig> = {},
): ClawStudioAppClient {
  ensureConfigured();
  return getRuntimeAppClientWithSession(overrides) as ClawStudioAppClient;
}

export function getDriveAppSdkClientWithSession(
  overrides: Partial<SdkworkAppConfig> = {},
): DriveAppSdkClient {
  return getComposedSdkRuntime(overrides).driveClient;
}

export function getMessagingAppSdkClientWithSession(
  overrides: Partial<SdkworkAppConfig> = {},
): MessagingAppSdkClient {
  return getComposedSdkRuntime(overrides).messagingClient;
}

export function useAppSdkClient(
  overrides: Partial<SdkworkAppConfig> = {},
): AppSdkClient {
  return getAppSdkClientWithSession(overrides);
}
