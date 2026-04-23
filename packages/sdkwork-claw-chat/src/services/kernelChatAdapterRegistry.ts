import { studio } from '@sdkwork/claw-infrastructure';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';
import type { KernelChatAdapter, KernelChatAdapterCapabilities } from './kernelChatAdapter.ts';
import { createKernelChatAdapterCapabilities } from './kernelChatAdapter.ts';
import {
  isHermesChatInstance,
  isManagedHermesAuthoritativeChatInstance,
  isOpenClawGatewayChatInstance,
  isTransportBackedChatInstance,
} from './kernelChatInstancePolicy.ts';

export interface KernelChatAdapterResolution {
  instanceId: string;
  instance: StudioInstanceRecord | null;
  adapterId: string;
  adapter: KernelChatAdapter;
  capabilities: KernelChatAdapterCapabilities;
}

export interface CreateUnsupportedKernelChatAdapterInput {
  instance: StudioInstanceRecord | null;
  reason: string;
}

export interface KernelChatAdapterRegistryDependencies {
  resolveInstance: (instanceId: string) => Promise<StudioInstanceRecord | null>;
  createOpenClawGatewayAdapter: (instance: StudioInstanceRecord) => KernelChatAdapter;
  createTransportBackedAdapter: (instance: StudioInstanceRecord) => KernelChatAdapter;
  createHermesAdapter: (instance: StudioInstanceRecord) => KernelChatAdapter;
  createUnsupportedAdapter: (
    input: CreateUnsupportedKernelChatAdapterInput,
  ) => KernelChatAdapter;
}

export interface KernelChatAdapterRegistryDependencyOverrides {
  resolveInstance?: KernelChatAdapterRegistryDependencies['resolveInstance'];
  createOpenClawGatewayAdapter?: KernelChatAdapterRegistryDependencies['createOpenClawGatewayAdapter'];
  createTransportBackedAdapter?: KernelChatAdapterRegistryDependencies['createTransportBackedAdapter'];
  createHermesAdapter?: KernelChatAdapterRegistryDependencies['createHermesAdapter'];
  createUnsupportedAdapter?: KernelChatAdapterRegistryDependencies['createUnsupportedAdapter'];
}

function createDefaultUnsupportedAdapter(
  input: CreateUnsupportedKernelChatAdapterInput,
): KernelChatAdapter {
  return {
    adapterId: 'unsupported',
    getCapabilities() {
      return createKernelChatAdapterCapabilities({
        adapterId: 'unsupported',
        authorityKind: 'localProjection',
        supported: false,
        durable: false,
        writable: false,
        supportsStreaming: false,
        supportsRuns: false,
        supportsAgentProfiles: false,
        supportsSessionMutation: false,
        reason: input.reason,
      });
    },
  };
}

class DefaultKernelChatAdapterRegistry {
  private readonly dependencies: KernelChatAdapterRegistryDependencies;

  constructor(dependencies: KernelChatAdapterRegistryDependencies) {
    this.dependencies = dependencies;
  }

  async resolveForInstance(instanceId: string): Promise<KernelChatAdapterResolution> {
    const instance = await this.dependencies.resolveInstance(instanceId);

    if (!instance) {
      const adapter = this.dependencies.createUnsupportedAdapter({
        instance,
        reason: 'Chat instance was not found.',
      });
      return {
        instanceId,
        instance,
        adapterId: adapter.adapterId,
        capabilities: adapter.getCapabilities(),
        adapter,
      };
    }

    const adapter = isOpenClawGatewayChatInstance(instance)
      ? this.dependencies.createOpenClawGatewayAdapter(instance)
      : isManagedHermesAuthoritativeChatInstance(instance)
        ? this.dependencies.createHermesAdapter(instance)
      : isTransportBackedChatInstance(instance)
        ? this.dependencies.createTransportBackedAdapter(instance)
        : isHermesChatInstance(instance)
          ? this.dependencies.createHermesAdapter(instance)
          : this.dependencies.createUnsupportedAdapter({
              instance,
              reason: 'This runtime does not expose a standardized kernel chat adapter.',
            });

    return {
      instanceId,
      instance,
      adapterId: adapter.adapterId,
      capabilities: adapter.getCapabilities(),
      adapter,
    };
  }
}

export function createKernelChatAdapterRegistry(
  overrides: KernelChatAdapterRegistryDependencyOverrides = {},
) {
  return new DefaultKernelChatAdapterRegistry({
    resolveInstance: overrides.resolveInstance || ((instanceId) => studio.getInstance(instanceId)),
    createOpenClawGatewayAdapter:
      overrides.createOpenClawGatewayAdapter ||
      (() => {
        throw new Error('OpenClaw gateway adapter is not registered yet.');
      }),
    createTransportBackedAdapter:
      overrides.createTransportBackedAdapter ||
      (() => {
        throw new Error('Transport-backed kernel chat adapter is not registered yet.');
      }),
    createHermesAdapter:
      overrides.createHermesAdapter ||
      (() => {
        throw new Error('Hermes kernel chat adapter is not registered yet.');
      }),
    createUnsupportedAdapter: overrides.createUnsupportedAdapter || createDefaultUnsupportedAdapter,
  });
}

export const kernelChatAdapterRegistry = createKernelChatAdapterRegistry();
