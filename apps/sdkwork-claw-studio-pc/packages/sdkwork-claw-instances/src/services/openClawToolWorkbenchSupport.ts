import type { OpenClawToolsCatalogResult } from '@sdkwork/claw-infrastructure';
import type { InstanceWorkbenchAgent, InstanceWorkbenchTool } from '../types/index.ts';
import {
  normalizeOpenClawAgentId,
  titleCaseIdentifier,
} from './openClawSupport.ts';

export function inferToolCategory(
  toolId: string,
  groupId: string,
  groupLabel: string,
): InstanceWorkbenchTool['category'] {
  const source = `${toolId} ${groupId} ${groupLabel}`.toLowerCase();

  if (
    source.includes('file') ||
    source.includes('read') ||
    source.includes('write') ||
    source.includes('patch')
  ) {
    return 'filesystem';
  }
  if (
    source.includes('cron') ||
    source.includes('update') ||
    source.includes('automation')
  ) {
    return 'automation';
  }
  if (
    source.includes('log') ||
    source.includes('status') ||
    source.includes('usage') ||
    source.includes('secret')
  ) {
    return 'observability';
  }
  if (
    source.includes('session') ||
    source.includes('memory') ||
    source.includes('agent') ||
    source.includes('model')
  ) {
    return 'reasoning';
  }

  return 'integration';
}

export function inferToolAccess(toolId: string): InstanceWorkbenchTool['access'] {
  const normalized = toolId.toLowerCase();

  if (
    normalized.includes('read') ||
    normalized.includes('get') ||
    normalized.includes('list') ||
    normalized.includes('status') ||
    normalized.includes('search') ||
    normalized.includes('tail') ||
    normalized.includes('catalog') ||
    normalized.includes('resolve')
  ) {
    return 'read';
  }
  if (
    normalized.includes('set') ||
    normalized.includes('update') ||
    normalized.includes('patch') ||
    normalized.includes('install') ||
    normalized.includes('create') ||
    normalized.includes('delete') ||
    normalized.includes('logout')
  ) {
    return 'write';
  }

  return 'execute';
}

export function mergeUniqueValues(
  current: string[] | undefined,
  next: string[] | undefined,
) {
  const merged = [...(current || [])];

  (next || []).forEach((value) => {
    if (value && !merged.includes(value)) {
      merged.push(value);
    }
  });

  return merged.length > 0 ? merged : undefined;
}

export function mergeToolStatus(
  current: InstanceWorkbenchTool['status'],
  next: InstanceWorkbenchTool['status'],
): InstanceWorkbenchTool['status'] {
  const priority = {
    ready: 0,
    beta: 1,
    restricted: 2,
  } as const;

  return priority[next] > priority[current] ? next : current;
}

export function buildOpenClawTools(
  catalog: OpenClawToolsCatalogResult,
  agentNameById: ReadonlyMap<string, string> = new Map(),
): InstanceWorkbenchTool[] {
  const toolMap = new Map<string, InstanceWorkbenchTool>();
  const scopedAgentIds =
    typeof catalog.agentId === 'string' && catalog.agentId.trim()
      ? [normalizeOpenClawAgentId(catalog.agentId)]
      : [];
  const scopedAgentNames = scopedAgentIds
    .map((agentId) => agentNameById.get(agentId) || titleCaseIdentifier(agentId))
    .filter((value) => value.length > 0);

  (Array.isArray(catalog.groups) ? catalog.groups : []).forEach((group) => {
    const tools = Array.isArray(group.tools) ? group.tools : [];
    tools.forEach((tool) => {
      const id = typeof tool.id === 'string' ? tool.id : '';
      if (!id || toolMap.has(id)) {
        return;
      }

      toolMap.set(id, {
        id,
        name:
          (typeof tool.label === 'string' && tool.label.trim()) ||
          titleCaseIdentifier(id),
        description:
          (typeof tool.description === 'string' && tool.description.trim()) ||
          `${titleCaseIdentifier(id)} tool exposed by the OpenClaw gateway.`,
        category: inferToolCategory(
          id,
          typeof group.id === 'string' ? group.id : '',
          typeof group.label === 'string' ? group.label : '',
        ),
        status: tool.optional ? 'beta' : 'ready',
        access: inferToolAccess(id),
        command: `tool:${id}`,
        lastUsedAt: undefined,
        agentIds: scopedAgentIds.length > 0 ? [...scopedAgentIds] : undefined,
        agentNames: scopedAgentNames.length > 0 ? [...scopedAgentNames] : undefined,
      });
    });
  });

  return [...toolMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function buildOpenClawScopedTools(
  catalogs: OpenClawToolsCatalogResult[],
  agents: InstanceWorkbenchAgent[],
): InstanceWorkbenchTool[] {
  const toolMap = new Map<string, InstanceWorkbenchTool>();
  const agentNameById = new Map(
    agents.map((agent) => [agent.agent.id, agent.agent.name] as const),
  );

  catalogs.forEach((catalog) => {
    buildOpenClawTools(catalog, agentNameById).forEach((tool) => {
      const current = toolMap.get(tool.id);
      if (!current) {
        toolMap.set(tool.id, {
          ...tool,
          agentIds: tool.agentIds ? [...tool.agentIds] : undefined,
          agentNames: tool.agentNames ? [...tool.agentNames] : undefined,
        });
        return;
      }

      toolMap.set(tool.id, {
        ...current,
        status: mergeToolStatus(current.status, tool.status),
        agentIds: mergeUniqueValues(current.agentIds, tool.agentIds),
        agentNames: mergeUniqueValues(current.agentNames, tool.agentNames),
      });
    });
  });

  return [...toolMap.values()].sort((left, right) => left.name.localeCompare(right.name));
}
