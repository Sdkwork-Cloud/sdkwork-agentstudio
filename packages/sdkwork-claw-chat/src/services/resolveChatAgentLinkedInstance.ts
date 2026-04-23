import { studio } from '@sdkwork/claw-infrastructure';
import type { StudioInstanceRecord } from '@sdkwork/claw-types';
import { kernelChatAgentCatalogService } from './kernelChatAgentCatalogService.ts';
import { resolveAuthoritativeInstanceChatRoute } from './store/authoritativeInstanceChatRoute.ts';

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized || null;
}

function normalizeAgentId(value: string | null | undefined) {
  return normalizeOptionalString(value)?.toLowerCase() ?? null;
}

function resolveInstanceStatusPriority(status: StudioInstanceRecord['status']) {
  switch (status) {
    case 'online':
      return 0;
    case 'syncing':
      return 1;
    case 'starting':
      return 2;
    case 'offline':
      return 3;
    case 'error':
      return 4;
    default:
      return 5;
  }
}

function sortCandidateInstances(
  instances: StudioInstanceRecord[],
  preferredInstanceId: string | null,
) {
  return [...instances].sort((left, right) => {
    const leftPreferred = left.id === preferredInstanceId;
    const rightPreferred = right.id === preferredInstanceId;
    if (leftPreferred !== rightPreferred) {
      return leftPreferred ? -1 : 1;
    }

    const statusPriorityDiff =
      resolveInstanceStatusPriority(left.status) -
      resolveInstanceStatusPriority(right.status);
    if (statusPriorityDiff !== 0) {
      return statusPriorityDiff;
    }

    return left.name.localeCompare(right.name);
  });
}

async function supportsChat(instanceId: string) {
  try {
    const { route } = await resolveAuthoritativeInstanceChatRoute(instanceId);
    return route.mode !== 'unsupported';
  } catch {
    return false;
  }
}

async function containsAgent(instanceId: string, agentId: string) {
  try {
    const profiles = await kernelChatAgentCatalogService.listAgentProfiles(instanceId);
    return profiles.some(
      (profile) => normalizeAgentId(profile.agentId) === agentId,
    );
  } catch {
    return false;
  }
}

export interface ResolveChatAgentLinkedInstanceInput {
  agentId: string | null | undefined;
  preferredInstanceId?: string | null | undefined;
}

export async function resolveChatAgentLinkedInstanceId({
  agentId,
  preferredInstanceId,
}: ResolveChatAgentLinkedInstanceInput): Promise<string | null> {
  const normalizedAgentId = normalizeAgentId(agentId);
  if (!normalizedAgentId) {
    return null;
  }

  const normalizedPreferredInstanceId = normalizeOptionalString(preferredInstanceId);
  const instances = await studio.listInstances().catch(() => []);
  const candidateInstances = sortCandidateInstances(
    instances,
    normalizedPreferredInstanceId,
  );

  for (const instance of candidateInstances) {
    if (!(await supportsChat(instance.id))) {
      continue;
    }

    if (await containsAgent(instance.id, normalizedAgentId)) {
      return instance.id;
    }
  }

  return null;
}
