import type { KernelChatAdapterCapabilities } from './kernelChatAdapter.ts';
import type { InstanceChatRouteMode } from './instanceChatRouteService.ts';

export function isGatewayAuthorityKind(
  authorityKind: KernelChatAdapterCapabilities['authorityKind'] | null | undefined,
) {
  return authorityKind === 'gateway';
}

export function isGatewayAuthoritativeRouteMode(
  routeMode: InstanceChatRouteMode | null | undefined,
) {
  return routeMode === 'instanceOpenClawGatewayWs';
}

export function resolveGatewayAuthoritativeKernelChat(input: {
  adapterCapabilities?: KernelChatAdapterCapabilities | null;
  sessionAuthorityKind?: KernelChatAdapterCapabilities['authorityKind'] | null;
}) {
  return isGatewayAuthorityKind(
    input.sessionAuthorityKind ?? input.adapterCapabilities?.authorityKind ?? null,
  );
}

export function shouldUseOpenClawGatewayKernelCatalog(input: {
  adapterCapabilities?: KernelChatAdapterCapabilities | null;
  sessionAuthorityKind?: KernelChatAdapterCapabilities['authorityKind'] | null;
}) {
  return resolveGatewayAuthoritativeKernelChat({
    adapterCapabilities: input.adapterCapabilities,
    sessionAuthorityKind: input.sessionAuthorityKind,
  });
}

export function shouldUseGatewayAuthoritativeSessionStore(input: {
  routeMode?: InstanceChatRouteMode | null;
  adapterCapabilities?: KernelChatAdapterCapabilities | null;
  sessionAuthorityKind?: KernelChatAdapterCapabilities['authorityKind'] | null;
}) {
  return (
    isGatewayAuthoritativeRouteMode(input.routeMode) &&
    resolveGatewayAuthoritativeKernelChat({
      adapterCapabilities: input.adapterCapabilities,
      sessionAuthorityKind: input.sessionAuthorityKind,
    })
  );
}
