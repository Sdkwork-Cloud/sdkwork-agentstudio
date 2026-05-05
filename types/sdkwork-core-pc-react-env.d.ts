declare module '@sdkwork/core-pc-react/env' {
  import type { PcReactEnvConfig, PcReactEnvSource } from './sdkwork-core-pc-react-shared.d.ts';

  export const SDKWORK_PC_REACT_ENV_KEYS: readonly string[];
  export function readPcReactEnvSource(): PcReactEnvSource;
  export function readPcReactNamedGlobalEnvSources(globalKeys?: string[]): PcReactEnvSource;
  export function createPcReactEnvConfig(source?: PcReactEnvSource): PcReactEnvConfig;
}
