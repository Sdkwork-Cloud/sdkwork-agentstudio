import { createElement, lazy, type ComponentType } from 'react';
import type {
  CreateKernelAgentResult,
  KernelDetailModuleRegistration,
} from '@sdkwork/claw-core';
import type { InstanceDetailSource } from '../instanceDetailSource.ts';
import type { InstanceBaseDetail } from '../instanceBaseDetail.ts';
import type { InstanceDetailModulePayload } from '../instanceDetailModulePayload.ts';
import type { Instance } from '../../types/index.ts';

export type SupportedInstanceDetailModuleChrome = 'sharedWorkbench' | 'kernelOwned';

export interface InstanceDetailModulePayloadLoadContext {
  instance: Instance;
  loadBaseDetail: () => Promise<InstanceBaseDetail | null>;
}

export interface InstanceDetailAgentMarketModalRequest {
  instanceId: string | null;
  onInstalled?: (
    result: CreateKernelAgentResult,
  ) => Promise<void> | void;
}

export interface InstanceDetailPageProps {
  source: InstanceDetailSource;
  onOpenAgentMarketModal: (
    request: InstanceDetailAgentMarketModalRequest,
  ) => void;
}

export interface SupportedInstanceDetailModule {
  chrome: SupportedInstanceDetailModuleChrome;
  loadModulePayload: (
    instanceId: string,
    context: InstanceDetailModulePayloadLoadContext,
  ) => Promise<InstanceDetailModulePayload | null>;
  DetailPage: ComponentType<InstanceDetailPageProps>;
}

export type SupportedInstanceDetailModuleRegistration =
  KernelDetailModuleRegistration<SupportedInstanceDetailModule>;

export function createLazyInstanceDetailModulePage(
  loader: () => Promise<{ default: ComponentType<InstanceDetailPageProps> }>,
): ComponentType<InstanceDetailPageProps> {
  const LazyInstanceDetailPage = lazy(loader);

  function RegisteredInstanceDetailModulePage({
    source,
    onOpenAgentMarketModal,
  }: InstanceDetailPageProps) {
    return createElement(LazyInstanceDetailPage, {
      source,
      onOpenAgentMarketModal,
    });
  }

  return RegisteredInstanceDetailModulePage;
}
