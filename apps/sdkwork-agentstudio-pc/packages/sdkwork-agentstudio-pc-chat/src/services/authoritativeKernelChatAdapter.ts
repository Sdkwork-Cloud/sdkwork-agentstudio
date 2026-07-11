import { createAuthoritativeKernelChatAdapterRegistry } from './authoritativeKernelChatAdapterRegistryFactory.ts';

const authoritativeKernelChatAdapterRegistry = createAuthoritativeKernelChatAdapterRegistry();

export async function resolveAuthoritativeInstanceKernelChatAdapter(
  instanceId: string | null | undefined,
) {
  if (!instanceId) {
    return null;
  }

  return authoritativeKernelChatAdapterRegistry.resolveForInstance(instanceId);
}
