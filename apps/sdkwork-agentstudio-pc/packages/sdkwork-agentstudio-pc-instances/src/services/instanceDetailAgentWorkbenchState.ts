import type { InstanceWorkbenchSectionId, InstanceWorkbenchSnapshot } from '../types/index.ts';
import type { AgentWorkbenchRequest, AgentWorkbenchSnapshot } from './agentWorkbenchServiceCore.ts';

type StateSetter<T> = (value: T | ((current: T) => T)) => void;

export interface ApplyInstanceDetailAgentWorkbenchSyncStateInput {
  agents: InstanceWorkbenchSnapshot['agents'] | null | undefined;
  setSelectedAgentId: StateSetter<string | null>;
  setSelectedAgentWorkbench: StateSetter<AgentWorkbenchSnapshot | null>;
  setAgentWorkbenchError: StateSetter<string | null>;
  setIsAgentWorkbenchLoading: StateSetter<boolean>;
}

export interface StartLoadInstanceDetailAgentWorkbenchInput {
  activeSection: InstanceWorkbenchSectionId;
  instanceId: string | null | undefined;
  workbench: InstanceWorkbenchSnapshot | null | undefined;
  selectedAgentId: string | null;
  setSelectedAgentWorkbench: StateSetter<AgentWorkbenchSnapshot | null>;
  setAgentWorkbenchError: StateSetter<string | null>;
  setIsAgentWorkbenchLoading: StateSetter<boolean>;
  loadAgentWorkbench: (input: AgentWorkbenchRequest) => Promise<AgentWorkbenchSnapshot>;
  reportError: (error: unknown) => void;
  fallbackErrorMessage: string;
}

export function applyInstanceDetailAgentWorkbenchSyncState({
  agents,
  setSelectedAgentId,
  setSelectedAgentWorkbench,
  setAgentWorkbenchError,
  setIsAgentWorkbenchLoading,
}: ApplyInstanceDetailAgentWorkbenchSyncStateInput) {
  const availableAgents = agents || [];

  if (availableAgents.length === 0) {
    setSelectedAgentId(null);
    setSelectedAgentWorkbench(null);
    setAgentWorkbenchError(null);
    setIsAgentWorkbenchLoading(false);
    return;
  }

  setSelectedAgentId((current) =>
    current && availableAgents.some((agent) => agent.agent.id === current)
      ? current
      : availableAgents[0].agent.id,
  );
}

export function startLoadInstanceDetailAgentWorkbench({
  activeSection,
  instanceId,
  workbench,
  selectedAgentId,
  setSelectedAgentWorkbench,
  setAgentWorkbenchError,
  setIsAgentWorkbenchLoading,
  loadAgentWorkbench,
  reportError,
  fallbackErrorMessage,
}: StartLoadInstanceDetailAgentWorkbenchInput) {
  if (activeSection !== 'agents' || !instanceId || !workbench || !selectedAgentId) {
    if (!selectedAgentId) {
      setSelectedAgentWorkbench(null);
      setAgentWorkbenchError(null);
    }
    return undefined;
  }

  let cancelled = false;
  setSelectedAgentWorkbench(null);
  setAgentWorkbenchError(null);
  setIsAgentWorkbenchLoading(true);

  void loadAgentWorkbench({
    instanceId,
    workbench,
    agentId: selectedAgentId,
  })
    .then((snapshot) => {
      if (!cancelled) {
        setSelectedAgentWorkbench(snapshot);
        setAgentWorkbenchError(null);
      }
    })
    .catch((error) => {
      reportError(error);
      if (!cancelled) {
        setSelectedAgentWorkbench(null);
        setAgentWorkbenchError(
          error instanceof Error && error.message.trim() ? error.message : fallbackErrorMessage,
        );
      }
    })
    .finally(() => {
      if (!cancelled) {
        setIsAgentWorkbenchLoading(false);
      }
    });

  return () => {
    cancelled = true;
  };
}
