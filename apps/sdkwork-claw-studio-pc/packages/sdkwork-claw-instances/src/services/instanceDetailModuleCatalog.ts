import { createKernelDetailModuleRegistry } from '@sdkwork/claw-core';
import {
  instanceDetailModuleRegistrations,
  type SupportedInstanceDetailModule,
} from './instanceDetailModules/index.ts';

const instanceDetailModuleRegistry =
  createKernelDetailModuleRegistry<SupportedInstanceDetailModule>(instanceDetailModuleRegistrations);

export function listSupportedInstanceDetailModuleKernelIds() {
  return instanceDetailModuleRegistry.listKernelIds();
}

export function resolveSupportedInstanceDetailModule(
  kernelId: string | null | undefined,
): SupportedInstanceDetailModule | null {
  return instanceDetailModuleRegistry.resolve(kernelId);
}
