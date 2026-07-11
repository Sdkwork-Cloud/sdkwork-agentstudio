import type {
  KernelChatAgentProfile,
  KernelChatAuthorityKind,
  KernelChatCapabilitySet,
  KernelChatMessage,
  KernelChatRun,
  KernelChatSession,
} from '@sdkwork/agentstudio-pc-types';
import { createKernelChatCapabilitySet } from '@sdkwork/agentstudio-pc-types';

export interface KernelChatAdapterCapabilities {
  adapterId: string;
  authorityKind: KernelChatAuthorityKind;
  supported: boolean;
  durable: boolean;
  writable: boolean;
  supportsStreaming: boolean;
  supportsRuns: boolean;
  supportsAgentProfiles: boolean;
  supportsSessionMutation: boolean;
  capabilitySet: KernelChatCapabilitySet;
  reason: string | null;
}

export interface KernelChatSubscriptionEvent {
  instanceId: string;
  session?: KernelChatSession | null;
  run?: KernelChatRun | null;
  message?: KernelChatMessage | null;
}

export interface KernelChatAdapterCreateSessionInput {
  instanceId: string;
  model?: string | null;
  agentId?: string | null;
  actorBindingLabel?: string | null;
  title?: string | null;
}

export interface KernelChatAdapterPatchSessionInput {
  instanceId: string;
  sessionId: string;
  title?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  fastMode?: boolean | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
}

export interface KernelChatAdapterStartRunInput {
  instanceId: string;
  sessionId: string;
  content: string;
  model?: string | null;
}

export interface KernelChatAdapter {
  adapterId: string;
  getCapabilities(): KernelChatAdapterCapabilities;
  listAgentProfiles?(instanceId: string): Promise<KernelChatAgentProfile[]>;
  listSessions?(instanceId: string): Promise<KernelChatSession[]>;
  getSession?(instanceId: string, sessionId: string): Promise<KernelChatSession | null>;
  createSession?(input: KernelChatAdapterCreateSessionInput): Promise<KernelChatSession>;
  listRuns?(instanceId: string, sessionId: string): Promise<KernelChatRun[]>;
  getRun?(
    instanceId: string,
    sessionId: string,
    runId: string,
  ): Promise<KernelChatRun | null>;
  patchSession?(input: KernelChatAdapterPatchSessionInput): Promise<KernelChatSession>;
  deleteSession?(instanceId: string, sessionId: string): Promise<void>;
  startRun?(input: KernelChatAdapterStartRunInput): Promise<KernelChatRun>;
  abortRun?(instanceId: string, sessionId: string, runId?: string | null): Promise<boolean>;
  loadMessages?(instanceId: string, sessionId: string): Promise<KernelChatMessage[]>;
  subscribe?(listener: (event: KernelChatSubscriptionEvent) => void): () => void;
}

export interface CreateKernelChatAdapterCapabilitiesInput {
  adapterId: string;
  authorityKind: KernelChatAuthorityKind;
  supported?: boolean;
  durable?: boolean;
  writable?: boolean;
  supportsStreaming?: boolean;
  supportsRuns?: boolean;
  supportsAgentProfiles?: boolean;
  supportsSessionMutation?: boolean;
  supportsRunAbort?: boolean;
  supportsModelSelection?: boolean;
  supportsReasoningControl?: boolean;
  supportsThinkingLevel?: boolean;
  supportsFastMode?: boolean;
  supportsVerboseLevel?: boolean;
  supportsAttachments?: boolean;
  reason?: string | null;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function createKernelChatAdapterCapabilities(
  input: CreateKernelChatAdapterCapabilitiesInput,
): KernelChatAdapterCapabilities {
  const isProjectionAuthority = input.authorityKind === 'localProjection';
  const capabilitySet = createKernelChatCapabilitySet({
    supportsAgentProfiles: input.supportsAgentProfiles ?? true,
    supportsSessionMutation: input.supportsSessionMutation ?? true,
    supportsStreaming: input.supportsStreaming ?? true,
    supportsRuns: input.supportsRuns ?? true,
    supportsRunAbort: input.supportsRunAbort ?? false,
    supportsModelSelection: input.supportsModelSelection ?? false,
    supportsReasoningControl: input.supportsReasoningControl ?? false,
    supportsThinkingLevel: input.supportsThinkingLevel ?? false,
    supportsFastMode: input.supportsFastMode ?? false,
    supportsVerboseLevel: input.supportsVerboseLevel ?? false,
    supportsAttachments: input.supportsAttachments ?? false,
  });

  return {
    adapterId: input.adapterId,
    authorityKind: input.authorityKind,
    supported: input.supported ?? true,
    durable: input.durable ?? !isProjectionAuthority,
    writable: input.writable ?? true,
    supportsStreaming: capabilitySet.supportsStreaming,
    supportsRuns: capabilitySet.supportsRuns,
    supportsAgentProfiles: capabilitySet.supportsAgentProfiles,
    supportsSessionMutation: capabilitySet.supportsSessionMutation,
    capabilitySet,
    reason: normalizeOptionalString(input.reason),
  };
}
