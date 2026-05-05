export type PcReactEnvSource = Record<string, string | undefined>;

export interface PcReactEnvConfig {
  [key: string]: unknown;
}

export interface PcReactRuntimeSession {
  authToken?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface ConfigurePcReactRuntimeOptions {
  legacyStorageKeys?: {
    authToken?: readonly string[];
    accessToken?: readonly string[];
    refreshToken?: readonly string[];
    runtimeSession?: readonly string[];
  };
}
