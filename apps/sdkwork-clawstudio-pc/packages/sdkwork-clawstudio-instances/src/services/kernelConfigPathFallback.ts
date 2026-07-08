import type { StudioInstanceDetailRecord } from '@sdkwork/clawstudio-types';

export interface KernelConfigPathFallbackApi {
  resolveInstanceConfigPath?(
    detail: StudioInstanceDetailRecord | null | undefined,
  ): string | null | undefined;
  resolveAttachedKernelConfigFile?(
    detail: StudioInstanceDetailRecord | null | undefined,
  ): string | null | undefined;
}

export function resolveKernelConfigPathWithFallback(
  api: KernelConfigPathFallbackApi,
  detail: StudioInstanceDetailRecord | null | undefined,
) {
  return (
    api.resolveInstanceConfigPath?.(detail) ??
    api.resolveAttachedKernelConfigFile?.(detail) ??
    null
  );
}
