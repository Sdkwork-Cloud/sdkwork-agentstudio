import { OpenClawGatewayClient } from './openClawGatewayClient.ts';
import type { StudioInstanceDetailRecord, StudioInstanceRecord } from '@sdkwork/claw-types';
import { resolveAuthoritativeInstanceChatRoute } from '../store/index.ts';

type CachedOpenClawClientEntry = {
  client: OpenClawGatewayClient;
  authToken: string | null;
  websocketUrl: string;
};

const openClawClientByInstance = new Map<string, CachedOpenClawClientEntry>();

function resolveGatewayAuthToken(
  detail: StudioInstanceDetailRecord | null,
  instance: StudioInstanceRecord | null,
) {
  const candidates = [
    detail?.config.authToken,
    detail?.instance.config?.authToken,
    instance?.config.authToken,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

export async function getSharedOpenClawGatewayClient(instanceId: string) {
  const { detail, instance, route } = await resolveAuthoritativeInstanceChatRoute(instanceId);
  if (!instance) {
    throw new Error(`Unable to resolve OpenClaw instance: ${instanceId}`);
  }
  if (route.mode !== 'instanceOpenClawGatewayWs' || !route.websocketUrl) {
    throw new Error('The selected instance is not backed by an OpenClaw Gateway WebSocket.');
  }

  const authToken = resolveGatewayAuthToken(detail, instance);
  const cached = openClawClientByInstance.get(instanceId);
  if (
    cached &&
    cached.websocketUrl === route.websocketUrl &&
    cached.authToken === authToken
  ) {
    return cached.client;
  }

  cached?.client.disconnect();
  const client = new OpenClawGatewayClient({
    url: route.websocketUrl,
    authToken,
    instanceId,
  });

  openClawClientByInstance.set(instanceId, {
    client,
    authToken,
    websocketUrl: route.websocketUrl,
  });
  return client;
}
