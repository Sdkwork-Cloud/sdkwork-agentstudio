import type { KernelChatAdapter } from './kernelChatAdapter.ts';
import { createHermesKernelChatAdapter } from './adapters/hermesKernelChatAdapter.ts';
import {
  createOpenClawGatewayKernelChatAdapter,
  type OpenClawGatewayKernelChatStoreLike,
} from './adapters/openClawGatewayKernelChatAdapter.ts';
import { createTransportBackedKernelChatAdapter } from './adapters/transportBackedKernelChatAdapter.ts';
import { createKernelChatAdapterRegistry } from './kernelChatAdapterRegistry.ts';
import { createPlatformHermesKernelChatAdapterDependencies } from './platformKernelChatRuntime.ts';
import { resolveAuthoritativeInstanceChatRoute } from './store/index.ts';

const EMPTY_OPENCLAW_GATEWAY_STORE: OpenClawGatewayKernelChatStoreLike = {
  async hydrateInstance(_instanceId: string) {},
  getSnapshot(_instanceId: string) {
    return {
      sessions: [],
    };
  },
};

export interface CreateAuthoritativeKernelChatAdapterRegistryInput {
  gatewayStore?: OpenClawGatewayKernelChatStoreLike;
  transportBackedAdaptersByInstance?: Map<string, KernelChatAdapter>;
}

export function createAuthoritativeKernelChatAdapterRegistry(
  input: CreateAuthoritativeKernelChatAdapterRegistryInput = {},
) {
  return createKernelChatAdapterRegistry({
    async resolveInstance(instanceId) {
      return (await resolveAuthoritativeInstanceChatRoute(instanceId)).instance;
    },
    createOpenClawGatewayAdapter() {
      return createOpenClawGatewayKernelChatAdapter({
        gatewayStore: input.gatewayStore ?? EMPTY_OPENCLAW_GATEWAY_STORE,
      });
    },
    createTransportBackedAdapter(instance) {
      const existing = input.transportBackedAdaptersByInstance?.get(instance.id);
      if (existing) {
        return existing;
      }

      const adapter = createTransportBackedKernelChatAdapter({
        instance,
      });
      input.transportBackedAdaptersByInstance?.set(instance.id, adapter);
      return adapter;
    },
    createHermesAdapter(instance) {
      return createHermesKernelChatAdapter(
        createPlatformHermesKernelChatAdapterDependencies(instance),
      );
    },
  });
}
