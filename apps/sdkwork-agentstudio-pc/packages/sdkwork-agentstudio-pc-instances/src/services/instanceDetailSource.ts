import type { InstanceBaseDetail } from './instanceBaseDetail.ts';
import type { InstanceDetailModulePayload } from './instanceDetailModulePayload.ts';
import type { Instance } from '../types/index.ts';

export type InstanceDetailModuleChrome = 'sharedWorkbench' | 'kernelOwned';

export interface InstanceDetailSource {
  instanceId: string;
  kernelId: string;
  chrome: InstanceDetailModuleChrome;
  instance: Instance;
  loadBaseDetail: () => Promise<InstanceBaseDetail | null>;
  loadModulePayload: () => Promise<InstanceDetailModulePayload | null>;
}

interface CreateInstanceDetailSourceArgs {
  instanceId: string;
  kernelId: string;
  chrome: InstanceDetailModuleChrome;
  instance: Instance;
  loadBaseDetail: (instanceId: string) => Promise<InstanceBaseDetail | null>;
  loadModulePayload: (instanceId: string) => Promise<InstanceDetailModulePayload | null>;
}

export function createInstanceDetailSource(
  args: CreateInstanceDetailSourceArgs,
): InstanceDetailSource {
  return {
    instanceId: args.instanceId,
    kernelId: args.kernelId,
    chrome: args.chrome,
    instance: args.instance,
    loadBaseDetail: () => args.loadBaseDetail(args.instanceId),
    loadModulePayload: () => args.loadModulePayload(args.instanceId),
  };
}
