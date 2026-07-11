import type { StudioInstanceRecord } from '@sdkwork/agentstudio-pc-types';
import { uuid } from '@sdkwork/utils/id';
import {
  createKernelChatAuthority,
  createKernelChatSessionRef,
  type KernelChatSession,
} from '@sdkwork/agentstudio-pc-types';
import {
  createKernelChatAdapterCapabilities,
  type KernelChatAdapter,
  type KernelChatAdapterCreateSessionInput,
} from '../kernelChatAdapter.ts';

export interface CreateTransportBackedKernelChatAdapterInput {
  instance: StudioInstanceRecord;
  now?: () => number;
  createSessionId?: () => string;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function buildTransportSession(input: {
  instance: StudioInstanceRecord;
  sessionId: string;
  timestamp: number;
  agentId?: string | null;
  actorBindingLabel?: string | null;
  title?: string | null;
  model?: string | null;
}): KernelChatSession {
  const agentId = normalizeOptionalString(input.agentId);
  const actorBindingLabel = normalizeOptionalString(input.actorBindingLabel);

  return {
    ref: createKernelChatSessionRef({
      kernelId: input.instance.runtimeKind,
      instanceId: input.instance.id,
      sessionId: input.sessionId,
      agentId,
    }),
    authority: createKernelChatAuthority({
      kind: 'http',
      durable: false,
    }),
    lifecycle: 'draft',
    title: normalizeOptionalString(input.title) ?? 'New Chat',
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    messageCount: 0,
    sessionKind: 'transport',
    actorBinding: agentId
      ? {
          agentId,
          profileId: null,
          label: actorBindingLabel,
        }
      : null,
    modelBinding: {
      model: normalizeOptionalString(input.model),
      defaultModel: normalizeOptionalString(input.model),
    },
    activeRunId: null,
    nativeMetadata: {
      runtimeKind: input.instance.runtimeKind,
      transportKind: input.instance.transportKind,
      authoritySource: 'transportBacked',
    },
  };
}

export function createTransportBackedKernelChatAdapter(
  input: CreateTransportBackedKernelChatAdapterInput,
): KernelChatAdapter {
  const now = input.now ?? (() => Date.now());
  const createSessionId =
    input.createSessionId ??
    (() => `transport-session-${uuid()}`);
  const sessionsById = new Map<string, KernelChatSession>();

  async function createSession(
    createInput: KernelChatAdapterCreateSessionInput,
  ): Promise<KernelChatSession> {
    const timestamp = now();
    const session = buildTransportSession({
      instance: input.instance,
      sessionId: createSessionId(),
      timestamp,
      agentId: createInput.agentId,
      actorBindingLabel: createInput.actorBindingLabel,
      title: createInput.title,
      model: createInput.model,
    });
    sessionsById.set(session.ref.sessionId, session);
    return session;
  }

  return {
    adapterId: 'transportBacked',
    getCapabilities() {
      return createKernelChatAdapterCapabilities({
        adapterId: 'transportBacked',
        authorityKind: 'http',
        durable: false,
        supportsStreaming: false,
        supportsRuns: false,
        supportsAgentProfiles: false,
      });
    },
    async listSessions(instanceId) {
      if (instanceId !== input.instance.id) {
        return [];
      }

      return [...sessionsById.values()];
    },
    async getSession(instanceId, sessionId) {
      if (instanceId !== input.instance.id) {
        return null;
      }

      return sessionsById.get(sessionId) ?? null;
    },
    createSession,
  };
}
