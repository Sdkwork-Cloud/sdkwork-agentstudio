declare module '@sdkwork/core-pc-react/app' {
  import type { PcReactEnvSource, PcReactRuntimeSession } from './sdkwork-core-pc-react-shared.d.ts';

  export interface SdkworkAppConfig {
    baseUrl?: string;
    timeout?: number;
    apiKey?: string;
    authToken?: string;
    accessToken?: string;
    tenantId?: string;
    organizationId?: string;
    platform?: string;
    authMode?: 'apikey' | 'dual-token';
    headers?: Record<string, string>;
  }

  export interface SdkworkAppClient {
    setAuthToken(token: string): void;
    setAccessToken(token: string): void;
    [resourceName: string]: unknown;
  }

  export interface PcReactAppClientConfig extends SdkworkAppConfig {
    env: string;
  }

  export function decorateAppClientCompatAliases<TClient extends SdkworkAppClient>(
    client: TClient,
    aliases?: Record<string, string>,
  ): TClient;

  export function createAppClientConfigFromEnv(
    envSource: PcReactEnvSource,
    overrides?: Partial<SdkworkAppConfig>,
  ): PcReactAppClientConfig;

  export function resolveAppClientAccessTokenFromEnv(envSource: PcReactEnvSource): string;
  export function createAppClientConfig(overrides?: Partial<SdkworkAppConfig>): PcReactAppClientConfig;
  export function initAppClient(overrides?: Partial<SdkworkAppConfig>): SdkworkAppClient;
  export function getAppClient(): SdkworkAppClient;
  export function getAppClientConfig(): PcReactAppClientConfig | null;
  export function resolveAppClientAccessToken(): string;
  export function createScopedAppClient(overrides?: Partial<SdkworkAppConfig>): SdkworkAppClient;
  export function getAppClientWithSession(overrides?: Partial<SdkworkAppConfig>): SdkworkAppClient;
  export function applyRuntimeSessionToAppClient(session?: PcReactRuntimeSession): void;
  export function applyAppClientSessionTokens(
    tokens: Partial<Pick<PcReactRuntimeSession, 'authToken' | 'accessToken'>>,
  ): void;
}
