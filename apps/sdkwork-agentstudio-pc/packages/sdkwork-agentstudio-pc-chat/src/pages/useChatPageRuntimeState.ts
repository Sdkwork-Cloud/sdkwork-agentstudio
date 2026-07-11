import {
  resolveChatRuntimeState,
  type InstanceChatRouteMode,
  type KernelChatAdapterCapabilities,
} from '../services';
import type { GatewayConnectionStatus, SyncState } from '../store/useChatStore';

function getScopeKey(instanceId: string | null | undefined) {
  return instanceId ?? '__direct__';
}

export interface UseChatPageRuntimeStateInput {
  activeInstanceId: string | null | undefined;
  activeSessionIdByInstance: Record<string, string | null | undefined>;
  syncStateByInstance: Record<string, SyncState | undefined>;
  gatewayConnectionStatusByInstance: Record<string, GatewayConnectionStatus | undefined>;
  lastErrorByInstance: Record<string, string | undefined>;
  instanceRouteModeById: Record<string, InstanceChatRouteMode | undefined>;
  instanceChatAdapterCapabilitiesById: Record<string, KernelChatAdapterCapabilities | undefined>;
}

export function useChatPageRuntimeState({
  activeInstanceId,
  activeSessionIdByInstance,
  syncStateByInstance,
  gatewayConnectionStatusByInstance,
  lastErrorByInstance,
  instanceRouteModeById,
  instanceChatAdapterCapabilitiesById,
}: UseChatPageRuntimeStateInput) {
  const scopeKey = getScopeKey(activeInstanceId);
  const activeSessionId = activeSessionIdByInstance[scopeKey] ?? null;
  const syncState = syncStateByInstance[scopeKey] ?? 'idle';
  const routeMode = activeInstanceId ? instanceRouteModeById[activeInstanceId] : 'directLlm';
  const lastError = lastErrorByInstance[scopeKey];
  const activeAdapterCapabilities =
    activeInstanceId ? instanceChatAdapterCapabilitiesById[activeInstanceId] ?? null : null;
  const adapterRuntimeState = resolveChatRuntimeState({
    activeInstanceId,
    routeMode,
    adapterCapabilities: activeAdapterCapabilities,
    sessionState: null,
  });
  const isChatSupportedRoute = adapterRuntimeState.isChatAvailable;
  const agentCatalogMode = adapterRuntimeState.agentCatalogMode;
  const sessionScopeMode = adapterRuntimeState.sessionScopeMode;
  const sendMode = adapterRuntimeState.sendMode;
  const newSessionModelMode = adapterRuntimeState.newSessionModelMode;
  const supportsSessionScopeSync = adapterRuntimeState.supportsSessionScopeSync;
  const gatewayConnectionStatus =
    gatewayConnectionStatusByInstance[scopeKey] ?? (sendMode === 'gateway' ? 'disconnected' : null);

  return {
    activeSessionId,
    syncState,
    routeMode,
    lastError,
    activeAdapterCapabilities,
    isChatSupportedRoute,
    agentCatalogMode,
    sessionScopeMode,
    sendMode,
    newSessionModelMode,
    supportsSessionScopeSync,
    gatewayConnectionStatus,
  };
}
