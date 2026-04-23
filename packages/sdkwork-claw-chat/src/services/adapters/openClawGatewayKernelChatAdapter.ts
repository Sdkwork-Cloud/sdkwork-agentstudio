import type { KernelChatSession } from '@sdkwork/claw-types';
import {
  createKernelChatAdapterCapabilities,
  type KernelChatAdapter,
} from '../kernelChatAdapter.ts';

export interface OpenClawGatewayKernelChatSnapshotLike {
  sessions: Array<{
    kernelSession?: KernelChatSession | null;
  }>;
}

export interface OpenClawGatewayKernelChatStoreLike {
  hydrateInstance(instanceId: string): Promise<unknown>;
  getSnapshot(instanceId: string): OpenClawGatewayKernelChatSnapshotLike;
  createDraftSession?(
    instanceId: string,
    model?: string,
    options?: {
      agentId?: string | null;
      sessionId?: string | null;
    },
  ): {
    kernelSession?: KernelChatSession | null;
  };
}

export interface CreateOpenClawGatewayKernelChatAdapterInput {
  gatewayStore: OpenClawGatewayKernelChatStoreLike;
}

function listKernelSessions(snapshot: OpenClawGatewayKernelChatSnapshotLike) {
  return snapshot.sessions
    .map((session) => session.kernelSession ?? null)
    .filter((session): session is KernelChatSession => Boolean(session));
}

export function createOpenClawGatewayKernelChatAdapter(
  input: CreateOpenClawGatewayKernelChatAdapterInput,
): KernelChatAdapter {
  return {
    adapterId: 'openclawGateway',
    getCapabilities() {
      return createKernelChatAdapterCapabilities({
        adapterId: 'openclawGateway',
        authorityKind: 'gateway',
        supportsStreaming: false,
        supportsRuns: false,
        supportsAgentProfiles: false,
      });
    },
    async listSessions(instanceId) {
      await input.gatewayStore.hydrateInstance(instanceId);
      return listKernelSessions(input.gatewayStore.getSnapshot(instanceId));
    },
    async getSession(instanceId, sessionId) {
      const sessions = await this.listSessions?.(instanceId);
      return sessions?.find((session) => session.ref.sessionId === sessionId) ?? null;
    },
    async createSession({ instanceId, model, agentId, title }) {
      if (!input.gatewayStore.createDraftSession) {
        throw new Error('OpenClaw gateway draft session creation is not available.');
      }

      const draft = input.gatewayStore.createDraftSession(instanceId, model ?? undefined, {
        agentId,
      });
      const kernelSession = draft.kernelSession;
      if (!kernelSession) {
        throw new Error('OpenClaw gateway draft session did not expose kernel session metadata.');
      }

      return title?.trim() ? { ...kernelSession, title: title.trim() } : kernelSession;
    },
  };
}
