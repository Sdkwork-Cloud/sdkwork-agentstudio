import type { AgentInstallTarget, KernelAgentLibraryItem } from '@sdkwork/clawstudio-core';

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || null;
}

export function resolveChatAgentTemplateKey(
  agent: Pick<KernelAgentLibraryItem, 'sourceInstanceId' | 'sourceKernelId' | 'agentId'>,
) {
  return `${agent.sourceInstanceId}:${agent.sourceKernelId}:${agent.agentId}`;
}

export function filterChatAgentTemplates(
  agents: KernelAgentLibraryItem[],
  searchQuery: string,
): KernelAgentLibraryItem[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return agents;
  }

  return agents.filter((agent) =>
    [
      agent.displayName,
      agent.agentId,
      agent.description,
      agent.sourceInstanceName,
      agent.sourceKernelId,
    ]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
}

export function resolveChatAgentTemplateSelectionKey(
  agents: KernelAgentLibraryItem[],
  selectedAgentKey: string | null,
) {
  if (agents.length === 0) {
    return null;
  }

  if (
    selectedAgentKey
    && agents.some((agent) => resolveChatAgentTemplateKey(agent) === selectedAgentKey)
  ) {
    return selectedAgentKey;
  }

  return resolveChatAgentTemplateKey(agents[0]);
}

export function resolveChatAgentPreferredKernelId(input: {
  availableKernelIds: string[];
  selectedKernelId: string | null;
  sourceKernelId?: string | null;
  defaultKernelId?: string | null;
}) {
  const availableKernelIds = Array.from(
    new Set(
      input.availableKernelIds
        .map((kernelId) => normalizeOptionalString(kernelId))
        .filter((kernelId): kernelId is string => Boolean(kernelId)),
    ),
  );
  if (availableKernelIds.length === 0) {
    return null;
  }

  const selectedKernelId = normalizeOptionalString(input.selectedKernelId);
  if (selectedKernelId && availableKernelIds.includes(selectedKernelId)) {
    return selectedKernelId;
  }

  const sourceKernelId = normalizeOptionalString(input.sourceKernelId);
  if (sourceKernelId && availableKernelIds.includes(sourceKernelId)) {
    return sourceKernelId;
  }

  const defaultKernelId = normalizeOptionalString(input.defaultKernelId);
  if (defaultKernelId && availableKernelIds.includes(defaultKernelId)) {
    return defaultKernelId;
  }

  return availableKernelIds[0] ?? null;
}

export function resolveChatAgentMarketSelectedTemplateId(
  templates: Array<{ id: string }>,
  selectedTemplateId: string | null,
) {
  if (templates.length === 0) {
    return null;
  }

  if (selectedTemplateId && templates.some((template) => template.id === selectedTemplateId)) {
    return selectedTemplateId;
  }

  return templates[0]?.id ?? null;
}

function resolvePreferredTargetId(
  targets: AgentInstallTarget[],
  templateId: string,
  preferredTargetId: string,
) {
  if (targets.length === 0) {
    return '';
  }

  const preferredTarget =
    preferredTargetId ? targets.find((target) => target.id === preferredTargetId) || null : null;
  if (preferredTarget && !preferredTarget.installedTemplateIds.includes(templateId)) {
    return preferredTargetId;
  }

  return (
    targets.find((target) => !target.installedTemplateIds.includes(templateId))?.id
    || preferredTarget?.id
    || targets[0]?.id
    || ''
  );
}

export function resolveChatAgentMarketSelectedTargetId(input: {
  targets: AgentInstallTarget[];
  templateId: string | null;
  preferredTargetId: string;
  selectedTargetId: string;
}) {
  if (!input.templateId || input.targets.length === 0) {
    return '';
  }

  const selectedTarget =
    input.targets.find((target) => target.id === input.selectedTargetId) || null;
  if (selectedTarget) {
    const hasAlternativeInstallTarget =
      !input.preferredTargetId
      && input.targets.some(
        (target) => !target.installedTemplateIds.includes(input.templateId as string),
      );
    const selectedTargetNeedsUpgrade =
      !input.preferredTargetId
      && selectedTarget.installedTemplateIds.includes(input.templateId)
      && hasAlternativeInstallTarget;

    if (!selectedTargetNeedsUpgrade) {
      return selectedTarget.id;
    }
  }

  return resolvePreferredTargetId(
    input.targets,
    input.templateId,
    input.preferredTargetId,
  );
}
