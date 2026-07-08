import { getPlatformBridge } from '@sdkwork/clawstudio-infrastructure';
import type { StudioInstanceRecord } from '@sdkwork/clawstudio-types';
import type { HermesKernelChatAdapterDependencies } from './adapters/hermesKernelChatAdapter.ts';
import { isManagedHermesAuthoritativeChatInstance } from './kernelChatInstancePolicy.ts';

export function createPlatformHermesKernelChatAdapterDependencies(
  instance: StudioInstanceRecord | null | undefined,
): HermesKernelChatAdapterDependencies {
  if (!isManagedHermesAuthoritativeChatInstance(instance)) {
    return {};
  }

  const studioBridge = getPlatformBridge().studio;
  if (
    !studioBridge.listKernelChatSessions ||
    !studioBridge.createKernelChatSession ||
    !studioBridge.startKernelChatRun ||
    !studioBridge.loadKernelChatMessages
  ) {
    return {};
  }

  return {
    authorityKind: 'sqlite',
    supportsStreaming: false,
    // The current Hermes desktop bridge exposes an abort command surface, but the
    // Rust implementation is synchronous and returns false for run aborts.
    supportsRunAbort: false,
    listAgentProfiles: studioBridge.listKernelChatAgentProfiles
      ? (instanceId) => studioBridge.listKernelChatAgentProfiles!(instanceId)
      : undefined,
    listSessions: (instanceId) => studioBridge.listKernelChatSessions!(instanceId),
    getSession: studioBridge.getKernelChatSession
      ? (instanceId, sessionId) =>
          studioBridge.getKernelChatSession!(instanceId, sessionId)
      : undefined,
    createSession: (input) => studioBridge.createKernelChatSession!(input),
    listRuns: studioBridge.listKernelChatRuns
      ? (instanceId, sessionId) => studioBridge.listKernelChatRuns!(instanceId, sessionId)
      : undefined,
    getRun: studioBridge.getKernelChatRun
      ? (instanceId, sessionId, runId) =>
          studioBridge.getKernelChatRun!(instanceId, sessionId, runId)
      : undefined,
    patchSession: studioBridge.patchKernelChatSession
      ? (input) => studioBridge.patchKernelChatSession!(input)
      : undefined,
    deleteSession: studioBridge.deleteKernelChatSession
      ? (instanceId, sessionId) =>
          studioBridge.deleteKernelChatSession!(instanceId, sessionId)
      : undefined,
    startRun: (input) => studioBridge.startKernelChatRun!(input),
    abortRun: studioBridge.abortKernelChatRun
      ? (instanceId, sessionId, runId) =>
          studioBridge.abortKernelChatRun!(instanceId, sessionId, runId)
      : undefined,
    loadMessages: (instanceId, sessionId) =>
      studioBridge.loadKernelChatMessages!(instanceId, sessionId),
  };
}
