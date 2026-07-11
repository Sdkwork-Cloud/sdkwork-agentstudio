import type { StudioInstanceRecord } from '@sdkwork/agentstudio-pc-types';

const TRANSPORT_BACKED_CHAT_TRANSPORTS = new Set<StudioInstanceRecord['transportKind']>([
  'zeroclawHttp',
  'openaiHttp',
  'customHttp',
  'ironclawWeb',
  'customWs',
]);

export function isOpenClawGatewayChatInstance(instance: StudioInstanceRecord) {
  return (
    instance.runtimeKind === 'openclaw' ||
    instance.transportKind === 'openclawGatewayWs'
  );
}

export function isHermesChatInstance(instance: StudioInstanceRecord) {
  return instance.runtimeKind === 'hermes';
}

export function isManagedHermesAuthoritativeChatInstance(
  instance: StudioInstanceRecord | null | undefined,
) {
  return Boolean(
    instance &&
      instance.runtimeKind === 'hermes' &&
      instance.deploymentMode === 'local-managed',
  );
}

export function isTransportBackedChatInstance(instance: StudioInstanceRecord) {
  return TRANSPORT_BACKED_CHAT_TRANSPORTS.has(instance.transportKind);
}
