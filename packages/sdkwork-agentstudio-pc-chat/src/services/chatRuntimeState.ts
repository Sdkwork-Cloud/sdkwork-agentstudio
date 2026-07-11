import type { KernelChatAuthorityKind } from '@sdkwork/agentstudio-pc-types';
import type { KernelChatAdapterCapabilities } from './kernelChatAdapter.ts';
import type { InstanceChatRouteMode } from './instanceChatRouteService.ts';
import { resolveGatewayAuthoritativeKernelChat } from './kernelChatAuthorityPolicy.ts';

export interface ChatRuntimeState {
  hasResolvedContext: boolean;
  authorityKind: KernelChatAuthorityKind | null;
  isBlocked: boolean;
  isChatAvailable: boolean;
  isGatewayAuthority: boolean;
  agentCatalogMode: 'sharedCatalog' | 'kernelCatalog';
  sessionScopeMode: 'all' | 'agentBound';
  sendMode: 'local' | 'gateway';
  newSessionModelMode: 'modelName' | 'modelId';
  supportsSessionScopeSync: boolean;
  routeLabelKey:
    | 'chat.page.route.unsupported'
    | 'chat.page.route.gateway'
    | 'chat.page.route.direct';
}

export interface ResolveChatRuntimeStateInput {
  activeInstanceId: string | null | undefined;
  routeMode: InstanceChatRouteMode | undefined;
  adapterCapabilities?: KernelChatAdapterCapabilities | null;
  sessionState?: {
    authorityKind?: KernelChatAuthorityKind | null;
  } | null;
}

export function resolveChatRuntimeState(
  input: ResolveChatRuntimeStateInput,
): ChatRuntimeState {
  const hasSelectedInstance = Boolean(input.activeInstanceId);
  const hasResolvedContext =
    !hasSelectedInstance || Boolean(input.routeMode && input.adapterCapabilities);
  const authorityKind =
    input.sessionState?.authorityKind ?? input.adapterCapabilities?.authorityKind ?? null;
  const isGatewayAuthority = resolveGatewayAuthoritativeKernelChat({
    adapterCapabilities: input.adapterCapabilities,
    sessionAuthorityKind: authorityKind,
  });
  const agentCatalogMode = isGatewayAuthority ? 'kernelCatalog' : 'sharedCatalog';
  const sessionScopeMode = isGatewayAuthority ? 'agentBound' : 'all';
  const sendMode = isGatewayAuthority ? 'gateway' : 'local';
  const newSessionModelMode = isGatewayAuthority ? 'modelId' : 'modelName';
  const supportsSessionScopeSync = sessionScopeMode === 'agentBound';
  const isAdapterSupported =
    !hasSelectedInstance || input.adapterCapabilities?.supported !== false;
  const isRouteReady =
    !hasSelectedInstance ||
    Boolean(input.routeMode && input.routeMode !== 'unsupported');
  const isBlocked = hasResolvedContext ? !isAdapterSupported || !isRouteReady : false;

  return {
    hasResolvedContext,
    authorityKind,
    isBlocked,
    isChatAvailable: !isBlocked,
    isGatewayAuthority,
    agentCatalogMode,
    sessionScopeMode,
    sendMode,
    newSessionModelMode,
    supportsSessionScopeSync,
    routeLabelKey: isBlocked
      ? 'chat.page.route.unsupported'
      : isGatewayAuthority
        ? 'chat.page.route.gateway'
        : 'chat.page.route.direct',
  };
}
