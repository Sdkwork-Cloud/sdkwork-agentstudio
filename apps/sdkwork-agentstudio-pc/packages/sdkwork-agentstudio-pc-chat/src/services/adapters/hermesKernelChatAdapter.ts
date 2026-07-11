import {
  createKernelChatAdapterCapabilities,
  type KernelChatAdapter,
  type KernelChatAdapterCreateSessionInput,
  type KernelChatAdapterPatchSessionInput,
  type KernelChatAdapterStartRunInput,
} from '../kernelChatAdapter.ts';
import type {
  KernelChatAgentProfile,
  KernelChatAuthorityKind,
  KernelChatMessage,
  KernelChatRun,
  KernelChatSession,
} from '@sdkwork/agentstudio-pc-types';

const DEFAULT_HERMES_REASON = 'Hermes chat transport is not wired yet.';

export interface HermesKernelChatAdapterDependencies {
  authorityKind?: KernelChatAuthorityKind;
  supportsStreaming?: boolean;
  supportsRunAbort?: boolean;
  listAgentProfiles?: (instanceId: string) => Promise<KernelChatAgentProfile[]>;
  listSessions?: (instanceId: string) => Promise<KernelChatSession[]>;
  getSession?: (instanceId: string, sessionId: string) => Promise<KernelChatSession | null>;
  createSession?: (input: KernelChatAdapterCreateSessionInput) => Promise<KernelChatSession>;
  listRuns?: (instanceId: string, sessionId: string) => Promise<KernelChatRun[]>;
  getRun?: (
    instanceId: string,
    sessionId: string,
    runId: string,
  ) => Promise<KernelChatRun | null>;
  patchSession?: (input: KernelChatAdapterPatchSessionInput) => Promise<KernelChatSession>;
  deleteSession?: (instanceId: string, sessionId: string) => Promise<void>;
  startRun?: (input: KernelChatAdapterStartRunInput) => Promise<KernelChatRun>;
  abortRun?: (instanceId: string, sessionId: string, runId?: string | null) => Promise<boolean>;
  loadMessages?: (instanceId: string, sessionId: string) => Promise<KernelChatMessage[]>;
}

function createUnsupportedError() {
  return new Error(DEFAULT_HERMES_REASON);
}

function isFunction(value: unknown): value is (...args: any[]) => unknown {
  return typeof value === 'function';
}

function resolveHermesCapabilities(
  dependencies: HermesKernelChatAdapterDependencies,
) {
  const authorityKind = dependencies.authorityKind ?? 'sqlite';
  const hasListAgentProfiles = isFunction(dependencies.listAgentProfiles);
  const hasCreateSession = isFunction(dependencies.createSession);
  const hasPatchSession = isFunction(dependencies.patchSession);
  const hasDeleteSession = isFunction(dependencies.deleteSession);
  const hasStartRun = isFunction(dependencies.startRun);
  const hasAbortRun = isFunction(dependencies.abortRun);
  const supportsModelSelection = hasPatchSession;
  const supportsThinkingLevel = hasPatchSession;
  const supportsFastMode = hasPatchSession;
  const supportsVerboseLevel = hasPatchSession;
  const supportsReasoningControl = hasPatchSession;
  const requiredCapabilities = [
    ['listSessions', dependencies.listSessions],
    ['createSession', dependencies.createSession],
    ['loadMessages', dependencies.loadMessages],
    ['startRun', dependencies.startRun],
  ] as const;
  const missingRequiredCapabilities = requiredCapabilities
    .filter(([, capability]) => !isFunction(capability))
    .map(([name]) => name);
  const hasAnyCapability = [
    dependencies.listAgentProfiles,
    dependencies.listSessions,
    dependencies.getSession,
    dependencies.createSession,
    dependencies.listRuns,
    dependencies.getRun,
    dependencies.patchSession,
    dependencies.deleteSession,
    dependencies.startRun,
    dependencies.abortRun,
    dependencies.loadMessages,
  ].some((capability) => isFunction(capability));
  const supportsSessionMutation = hasCreateSession || hasPatchSession || hasDeleteSession;
  const supportsRuns = hasStartRun;
  const supportsStreaming = Boolean(dependencies.supportsStreaming && hasStartRun);
  const supportsRunAbort = Boolean(dependencies.supportsRunAbort && hasAbortRun);
  const supported = missingRequiredCapabilities.length === 0;

  return createKernelChatAdapterCapabilities({
    adapterId: 'hermes',
    authorityKind,
    supported,
    writable: supportsSessionMutation || hasStartRun || hasAbortRun,
    supportsStreaming,
    supportsRuns,
    supportsAgentProfiles: hasListAgentProfiles,
    supportsSessionMutation,
    supportsRunAbort,
    supportsModelSelection,
    supportsThinkingLevel,
    supportsFastMode,
    supportsVerboseLevel,
    supportsReasoningControl,
    reason: supported
      ? null
      : !hasAnyCapability
        ? DEFAULT_HERMES_REASON
        : `Hermes kernel chat adapter is missing required capabilities: ${missingRequiredCapabilities.join(', ')}.`,
  });
}

export function createHermesKernelChatAdapter(
  dependencies: HermesKernelChatAdapterDependencies = {},
): KernelChatAdapter {
  const capabilities = resolveHermesCapabilities(dependencies);

  return {
    adapterId: 'hermes',
    getCapabilities() {
      return capabilities;
    },
    async listAgentProfiles(instanceId) {
      return dependencies.listAgentProfiles
        ? dependencies.listAgentProfiles(instanceId)
        : [];
    },
    async listSessions(instanceId) {
      return dependencies.listSessions ? dependencies.listSessions(instanceId) : [];
    },
    async getSession(instanceId, sessionId) {
      return dependencies.getSession
        ? dependencies.getSession(instanceId, sessionId)
        : null;
    },
    async createSession(input) {
      if (!dependencies.createSession) {
        throw createUnsupportedError();
      }
      return dependencies.createSession(input);
    },
    async listRuns(instanceId, sessionId) {
      return dependencies.listRuns ? dependencies.listRuns(instanceId, sessionId) : [];
    },
    async getRun(instanceId, sessionId, runId) {
      return dependencies.getRun
        ? dependencies.getRun(instanceId, sessionId, runId)
        : null;
    },
    async patchSession(input) {
      if (!dependencies.patchSession) {
        throw createUnsupportedError();
      }
      return dependencies.patchSession(input);
    },
    async deleteSession(instanceId, sessionId) {
      if (!dependencies.deleteSession) {
        throw createUnsupportedError();
      }
      return dependencies.deleteSession(instanceId, sessionId);
    },
    async startRun(input) {
      if (!dependencies.startRun) {
        throw createUnsupportedError();
      }
      return dependencies.startRun(input);
    },
    async abortRun(instanceId, sessionId, runId) {
      if (!dependencies.abortRun) {
        throw createUnsupportedError();
      }
      return dependencies.abortRun(instanceId, sessionId, runId);
    },
    async loadMessages(instanceId, sessionId) {
      return dependencies.loadMessages
        ? dependencies.loadMessages(instanceId, sessionId)
        : [];
    },
  };
}
