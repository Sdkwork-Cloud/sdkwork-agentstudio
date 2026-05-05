declare module '@sdkwork/core-pc-react/runtime' {
  import type {
    ConfigurePcReactRuntimeOptions,
    PcReactRuntimeSession,
  } from './sdkwork-core-pc-react-shared.d.ts';

  export function configurePcReactRuntime(
    options?: ConfigurePcReactRuntimeOptions,
  ): ConfigurePcReactRuntimeOptions;

  export function resetPcReactRuntime(options?: {
    clearStorage?: boolean;
    clearConfiguration?: boolean;
  }): void;

  export function persistRuntimeSession(session: PcReactRuntimeSession): PcReactRuntimeSession;
  export const persistPcReactRuntimeSession: typeof persistRuntimeSession;
  export function readRuntimeSession(): PcReactRuntimeSession;
  export const readPcReactRuntimeSession: typeof readRuntimeSession;
  export function clearPcReactRuntimeSession(): Promise<void>;

  export const SDKWORK_PC_REACT_LEGACY_STORAGE_KEYS: {
    readonly authToken: string;
    readonly accessToken: string;
    readonly refreshToken: string;
  };

  export const SDKWORK_PC_REACT_LEGACY_ACCESS_TOKEN_STORAGE_KEY: string;
  export const SDKWORK_PC_REACT_LEGACY_AUTH_TOKEN_STORAGE_KEY: string;
  export const SDKWORK_PC_REACT_LEGACY_REFRESH_TOKEN_STORAGE_KEY: string;

  export function getImConnectionState(): unknown;
  export function getPcReactEnv(): Record<string, unknown>;
  export function getPcReactRuntimeVersion(): string;
  export function subscribeImConnectionState(listener: (state: unknown) => void): () => void;
  export function subscribePcReactRuntime(listener: (state: unknown) => void): () => void;
}
